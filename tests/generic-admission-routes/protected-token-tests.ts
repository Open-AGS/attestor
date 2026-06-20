import {
  Hono,
  createApp,
  createDpopProof,
  createInMemoryReleaseTokenIntrospectionStore,
  createLoopGuardedApp,
  digest,
  equal,
  generateDpopKeyPair,
  issueGenericAdmissionProtectedReleaseToken,
  ok,
  registerGenericAdmissionRoutes,
  releaseTokenIssuerFixture,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
  validAdmissionPayload,
} from './helpers.js';

async function testProtectedReleaseTokenIssuerReturnsAuthorizationWithoutRecordingRawToken(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const dpop = await generateDpopKeyPair();
  let recordedEnvelope: GenericAdmissionEnvelope | null = null;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-route-test-plan',
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    issueProtectedReleaseToken: ({ envelope }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: { jkt: dpop.publicKeyThumbprint },
        issuedAt: '2026-05-01T18:00:02.000Z',
      }),
    recordShadowAdmission: ({ envelope }) => {
      recordedEnvelope = envelope;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    protectedReleaseToken: {
      tokenId: string;
      tokenDigest: string;
      tenantId: string;
      rawReleaseTokenStored: boolean;
      introspectionAuthorityRegistered: boolean;
    };
    protectedReleaseTokenAuthorization: {
      token: string;
      tokenId: string;
      tokenDigest: string;
      storeRawTokenInAdmissionOrShadow: boolean;
    };
    admission: {
      proof: readonly {
        kind: string;
        id: string;
        digest: string | null;
      }[];
      operationalContext: Record<string, unknown>;
    };
  };

  equal(response.status, 200, 'Generic admission route: protected token issuance returns 200');
  ok(
    typeof body.protectedReleaseTokenAuthorization.token === 'string' &&
      body.protectedReleaseTokenAuthorization.token.length > 50,
    'Generic admission route: protected token authorization returns raw token to caller',
  );
  equal(
    body.protectedReleaseTokenAuthorization.storeRawTokenInAdmissionOrShadow,
    false,
    'Generic admission route: protected token authorization forbids raw-token storage',
  );
  equal(
    body.protectedReleaseToken.tokenId,
    body.protectedReleaseTokenAuthorization.tokenId,
    'Generic admission route: sanitized summary and authorization token id match',
  );
  equal(
    body.protectedReleaseToken.introspectionAuthorityRegistered,
    true,
    'Generic admission route: protected token is registered for online introspection',
  );
  equal(
    introspectionStore.findToken(body.protectedReleaseTokenAuthorization.tokenId)?.status,
    'issued',
    'Generic admission route: route issuer registers the token in the introspection store',
  );
  equal(
    body.protectedReleaseToken.tenantId,
    'tenant_route',
    'Generic admission route: protected token summary is tenant-bound to the route context',
  );
  equal(
    introspectionStore.findToken(body.protectedReleaseTokenAuthorization.tokenId)?.tenantId,
    'tenant_route',
    'Generic admission route: introspection authority stores the route tenant binding',
  );
  equal(
    body.admission.proof.some((proof) =>
      proof.kind === 'release-token' &&
      proof.id === body.protectedReleaseTokenAuthorization.tokenId &&
      proof.digest === body.protectedReleaseTokenAuthorization.tokenDigest),
    true,
    'Generic admission route: final admission carries release-token proof ref',
  );
  equal(
    body.admission.operationalContext.protectedReleaseTokenRawStored,
    false,
    'Generic admission route: final admission marks raw token as unstored',
  );
  ok(recordedEnvelope !== null, 'Generic admission route: protected token envelope is recorded');
  equal(
    JSON.stringify(recordedEnvelope).includes(body.protectedReleaseTokenAuthorization.token),
    false,
    'Generic admission route: recorded shadow envelope excludes raw token',
  );
}

async function testProtectedReleaseTokenRequiredFailsClosedWithoutIssuer(): Promise<void> {
  const app = new Hono();
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-route-test-plan',
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    requireProtectedReleaseTokenForHighRisk: true,
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'Generic admission route: missing required protected token issuer returns 503');
  equal(body.decision, 'block', 'Generic admission route: missing required protected token issuer blocks');
  equal(body.failClosed, true, 'Generic admission route: missing required protected token issuer fails closed');
  ok(
    body.reasonCodes.includes('protected-release-token-issuer-missing'),
    'Generic admission route: missing protected token issuer reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: missing protected token issuer is not shadow recorded');
}

async function testProtectedReleaseTokenIssuerUsesRouteResolvedDpopConfirmation(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const dpop = await generateDpopKeyPair();
  const routeUrl = 'https://attestor.test/api/v1/admissions';
  const proof = await createDpopProof({
    privateJwk: dpop.privateJwk,
    publicJwk: dpop.publicJwk,
    httpMethod: 'POST',
    httpUri: routeUrl,
    proofJti: 'dpop-generic-route-issuer-bridge',
    issuedAt: '2026-05-01T18:00:01.000Z',
  });
  let resolvedThumbprint: string | null = null;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-route-test-plan',
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    resolveProtectedReleaseTokenConfirmation: async ({ context, receivedAt }) => {
      const confirmation =
        await resolveHostedGenericAdmissionDpopSenderConfirmation({
          proofJwt: context.req.header('DPoP') ?? null,
          httpMethod: context.req.method,
          httpUri: context.req.url,
          now: receivedAt,
        });
      resolvedThumbprint = confirmation.confirmation?.jkt ?? null;
      return confirmation.confirmation;
    },
    issueProtectedReleaseToken: ({ envelope, receivedAt, senderConfirmation }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: senderConfirmation ?? null,
        issuedAt: receivedAt,
      }),
    recordShadowAdmission: () => {},
  });
  const response = await app.request(routeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      DPoP: proof.proofJwt,
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    protectedReleaseToken: {
      tokenId: string;
      senderConstrained: boolean;
      rawReleaseTokenStored: boolean;
      introspectionAuthorityRegistered: boolean;
    };
    protectedReleaseTokenAuthorization: {
      token: string;
      storeRawTokenInAdmissionOrShadow: boolean;
    };
  };

  equal(response.status, 200, 'Generic admission route: DPoP-confirmed issuer returns 200');
  equal(
    resolvedThumbprint,
    dpop.publicKeyThumbprint,
    'Generic admission route: DPoP proof resolver returns the token cnf jkt',
  );
  equal(
    body.protectedReleaseToken.senderConstrained,
    true,
    'Generic admission route: issued route token is sender-constrained',
  );
  equal(
    body.protectedReleaseToken.introspectionAuthorityRegistered,
    true,
    'Generic admission route: DPoP-confirmed token is registered for online introspection',
  );
  equal(
    introspectionStore.findToken(body.protectedReleaseToken.tokenId)?.status,
    'issued',
    'Generic admission route: DPoP-confirmed token authority state is active',
  );
  equal(
    body.protectedReleaseToken.rawReleaseTokenStored,
    false,
    'Generic admission route: sanitized summary stores no raw token',
  );
  equal(
    JSON.stringify(body).includes(proof.proofJwt),
    false,
    'Generic admission route: response excludes raw DPoP proof JWT',
  );
  equal(
    body.protectedReleaseTokenAuthorization.storeRawTokenInAdmissionOrShadow,
    false,
    'Generic admission route: DPoP-confirmed authorization remains caller-only material',
  );
}

async function testProtectedReleaseTokenIssuerFailsClosedWithoutDpopConfirmation(): Promise<void> {
  const app = new Hono();
  const issuer = releaseTokenIssuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-route-test-plan',
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    resolveProtectedReleaseTokenConfirmation: async ({ context, receivedAt }) => {
      const confirmation =
        await resolveHostedGenericAdmissionDpopSenderConfirmation({
          proofJwt: context.req.header('DPoP') ?? null,
          httpMethod: context.req.method,
          httpUri: context.req.url,
          now: receivedAt,
        });
      return confirmation.confirmation;
    },
    issueProtectedReleaseToken: ({ envelope, receivedAt, senderConfirmation }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: senderConfirmation ?? null,
        issuedAt: receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  const response = await app.request('https://attestor.test/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload()),
  });
  const body = await response.json() as {
    decision: string;
    failClosed: boolean;
    reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'Generic admission route: missing DPoP confirmation returns 503');
  equal(body.decision, 'block', 'Generic admission route: missing DPoP confirmation blocks');
  equal(body.failClosed, true, 'Generic admission route: missing DPoP confirmation fails closed');
  ok(
    body.reasonCodes.includes('protected-release-token-sender-confirmation-required'),
    'Generic admission route: missing DPoP confirmation reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission route: missing DPoP confirmation is not shadow recorded');
}

export async function runProtectedTokenTests(): Promise<void> {
  await testProtectedReleaseTokenIssuerReturnsAuthorizationWithoutRecordingRawToken();
  await testProtectedReleaseTokenRequiredFailsClosedWithoutIssuer();
  await testProtectedReleaseTokenIssuerUsesRouteResolvedDpopConfirmation();
  await testProtectedReleaseTokenIssuerFailsClosedWithoutDpopConfirmation();
}
