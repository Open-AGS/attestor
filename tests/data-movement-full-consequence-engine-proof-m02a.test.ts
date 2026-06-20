import assert from 'node:assert/strict';
import type { Hono } from 'hono';
import {
  createDpopProof,
  createInMemoryReleaseTokenIntrospectionStore,
  generateDpopKeyPair,
  Hono as HonoConstructor,
  issueGenericAdmissionProtectedReleaseToken,
  registerGenericAdmissionRoutes,
  releaseTokenIssuerFixture,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
  validAdmissionPayload,
} from './generic-admission-routes/helpers.js';
import {
  evaluateConsequenceAdmissionGateWithReleaseEnforcement,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import {
  createDpopBoundReleasePresentation,
  dpopReplayKey,
  type DpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import { createEnforcementRequest } from '../src/release-enforcement-plane/object-model.js';
import { verifyOnlineReleaseAuthorization } from '../src/release-enforcement-plane/online-verifier.js';
import {
  createReleaseTokenIntrospector,
  type RegisteredReleaseToken,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import type { ReleaseTokenVerificationKey } from '../src/release-kernel/release-token.js';
import type { ReplayLedgerEntry } from '../src/release-enforcement-plane/freshness.js';
import type {
  EnforcementRequest,
  ReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';
import type { OnlineReleaseVerification } from '../src/release-enforcement-plane/online-verifier.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

const TENANT_ID = 'tenant_route';
const ADMISSION_ROUTE_URL = 'https://attestor.test/api/v1/admissions';
const DATA_EXPORT_TARGET = 'data-export-sandbox';
const PEP_ID = 'data-export-sandbox-pep';

type AdmissionProofBody = {
  readonly admission: GenericAdmissionEnvelope['admission'];
  readonly protectedReleaseToken: {
    readonly issued: boolean;
    readonly tokenId: string;
    readonly tokenDigest: string;
    readonly releaseDecisionId: string;
    readonly audience: string;
    readonly tenantId: string;
    readonly expiresAt: string;
    readonly senderConstrained: boolean;
    readonly introspectionRequired: boolean;
    readonly replayConsumptionRequired: boolean;
    readonly introspectionAuthorityRegistered: boolean;
    readonly rawReleaseTokenStored: boolean;
  };
  readonly protectedReleaseTokenAuthorization: {
    readonly token: string;
    readonly tokenId: string;
    readonly tokenDigest: string;
    readonly audience: string;
    readonly expiresAt: string;
    readonly storeRawTokenInAdmissionOrShadow: boolean;
  };
};

type AdmissionHarness = {
  readonly app: Hono;
  readonly dpop: DpopKeyPair;
  readonly introspectionStore: ReleaseTokenIntrospectionStore;
  readonly introspector: ReleaseTokenIntrospector;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly recordedEnvelopes: readonly GenericAdmissionEnvelope[];
};

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function withFreshAdmissionTimes(payload: Record<string, unknown>): Record<string, unknown> {
  const approvals = Array.isArray(payload.approvals)
    ? payload.approvals.map((approval) => ({
        ...(approval as Record<string, unknown>),
        issuedAt: isoNow(-60_000),
        expiresAt: isoNow(10 * 60_000),
      }))
    : payload.approvals;
  return {
    ...payload,
    requestedAt: isoNow(-1_000),
    decidedAt: isoNow(),
    approvals,
  };
}

function dataMovementAdmissionPayload(): Record<string, unknown> {
  return withFreshAdmissionTimes(validAdmissionPayload({
    action: 'export_controlled_report',
    domain: 'data-disclosure',
    downstreamSystem: DATA_EXPORT_TARGET,
    policyRef: 'policy:data-export:v1',
    actor: 'analytics-ai-agent',
    reviewerRef: 'reviewer:data-owner',
    evidenceRefs: ['query-plan:digest-only', 'classification:internal-aggregate'],
    dataScope: {
      records: 250,
      classification: 'internal-aggregate',
      fields: ['region', 'risk_band', 'monthly_count'],
    },
    amount: null,
    recipient: null,
    summary: 'analytics-ai-agent proposes a controlled aggregate data export.',
  }));
}

async function createHarness(): Promise<AdmissionHarness> {
  const app = new HonoConstructor();
  const issuer = releaseTokenIssuerFixture();
  const dpop = await generateDpopKeyPair();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(introspectionStore);
  const recordedEnvelopes: GenericAdmissionEnvelope[] = [];

  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: TENANT_ID,
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-data-movement-test-plan',
      monthlyRunQuota: 100,
    }),
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
    recordShadowAdmission: ({ envelope }) => {
      recordedEnvelopes.push(envelope);
    },
  });

  return {
    app,
    dpop,
    introspectionStore,
    introspector,
    verificationKey: await issuer.exportVerificationKey(),
    recordedEnvelopes,
  };
}

async function postAdmission(
  harness: AdmissionHarness,
  proofJti = 'dpop-data-movement-admission-m02a',
): Promise<{
  readonly response: Response;
  readonly body: AdmissionProofBody;
}> {
  const proof = await createDpopProof({
    privateJwk: harness.dpop.privateJwk,
    publicJwk: harness.dpop.publicJwk,
    httpMethod: 'POST',
    httpUri: ADMISSION_ROUTE_URL,
    proofJti,
    issuedAt: isoNow(),
  });
  const response = await harness.app.request(ADMISSION_ROUTE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      DPoP: proof.proofJwt,
    },
    body: JSON.stringify(dataMovementAdmissionPayload()),
  });
  return {
    response,
    body: await response.json() as AdmissionProofBody,
  };
}

function registeredTokenFor(
  harness: AdmissionHarness,
  body: AdmissionProofBody,
): RegisteredReleaseToken {
  const record = harness.introspectionStore.findToken(
    body.protectedReleaseTokenAuthorization.tokenId,
  );
  if (record === null) {
    throw new Error('Expected route-issued protected token to be registered for introspection.');
  }
  return record;
}

function releaseEnforcementRequestFor(input: {
  readonly body: AdmissionProofBody;
  readonly record: RegisteredReleaseToken;
  readonly targetId?: string;
}): EnforcementRequest {
  const targetId = input.targetId ?? input.record.audience;
  return createEnforcementRequest({
    id: `erq-data-export-m02a-${targetId}`,
    receivedAt: isoNow(),
    enforcementPoint: {
      environment: 'local-engine-proof',
      enforcementPointId: PEP_ID,
      pointKind: 'application-middleware',
      boundaryKind: 'http-request',
      consequenceType: input.record.consequenceType,
      riskClass: input.record.riskClass,
      tenantId: TENANT_ID,
      audience: targetId,
    },
    targetId,
    outputHash: input.record.outputHash,
    consequenceHash: input.record.consequenceHash,
    releaseTokenId: input.record.tokenId,
    releaseDecisionId: input.record.decisionId,
    requester: {
      id: 'svc.data-export-sandbox',
      type: 'service',
    },
    idempotencyKey: 'idem-data-export-m02a-release-enforcement',
    transport: {
      kind: 'http',
      method: 'POST',
      uri: 'https://data-export-sandbox.local/admission-gate',
      headersDigest: `sha256:${'3'.repeat(64)}`,
      bodyDigest: input.body.admission.digest,
    },
  });
}

async function releasePresentationFor(input: {
  readonly body: AdmissionProofBody;
  readonly dpop: DpopKeyPair;
  readonly request: EnforcementRequest;
  readonly nonce: string;
  readonly proofJti: string;
}): Promise<{
  readonly proofJwt: string;
  readonly presentation: ReleasePresentation;
}> {
  const proof = await createDpopProof({
    privateJwk: input.dpop.privateJwk,
    publicJwk: input.dpop.publicJwk,
    httpMethod: input.request.transport?.kind === 'http'
      ? input.request.transport.method
      : 'POST',
    httpUri: input.request.transport?.kind === 'http'
      ? input.request.transport.uri
      : 'https://data-export-sandbox.local/admission-gate',
    accessToken: input.body.protectedReleaseTokenAuthorization.token,
    nonce: input.nonce,
    proofJti: input.proofJti,
    issuedAt: isoNow(),
  });
  const presentation = createDpopBoundReleasePresentation({
    proof,
    releaseToken: input.body.protectedReleaseTokenAuthorization.token,
    releaseTokenId: input.body.protectedReleaseTokenAuthorization.tokenId,
    issuer: 'attestor.generic-admission.route.test',
    subject: `releaseDecision:${input.body.protectedReleaseToken.releaseDecisionId}`,
    audience: input.body.protectedReleaseTokenAuthorization.audience,
    expiresAt: input.body.protectedReleaseTokenAuthorization.expiresAt,
    presentedAt: isoNow(),
    scope: ['data-disclosure:export_controlled_report'],
  });
  return {
    proofJwt: proof.proofJwt,
    presentation,
  };
}

async function verifyReleaseEnforcement(input: {
  readonly harness: AdmissionHarness;
  readonly body: AdmissionProofBody;
  readonly targetId?: string;
  readonly nonce: string;
  readonly proofJti: string;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly consumeOnSuccess?: boolean;
}): Promise<{
  readonly request: EnforcementRequest;
  readonly proofJwt: string;
  readonly releaseEnforcement: OnlineReleaseVerification;
}> {
  const record = registeredTokenFor(input.harness, input.body);
  const request = releaseEnforcementRequestFor({
    body: input.body,
    record,
    targetId: input.targetId,
  });
  const { proofJwt, presentation } = await releasePresentationFor({
    body: input.body,
    dpop: input.harness.dpop,
    request,
    nonce: input.nonce,
    proofJti: input.proofJti,
  });
  const checkedAt = isoNow();
  const releaseEnforcement = await verifyOnlineReleaseAuthorization({
    request,
    presentation,
    verificationKey: input.harness.verificationKey,
    now: checkedAt,
    introspector: input.harness.introspector,
    usageStore: input.harness.introspectionStore,
    consumeOnSuccess: input.consumeOnSuccess ?? true,
    forceOnlineIntrospection: true,
    replayLedgerEntry: input.replayLedgerEntry ?? null,
    nonceLedgerEntry: {
      nonce: input.nonce,
      issuedAt: isoNow(-1_000),
      expiresAt: isoNow(60_000),
    },
    resourceServerId: PEP_ID,
  });
  return { request, proofJwt, releaseEnforcement };
}

async function testAdmissionTokenFeedsReleaseEnforcementAndCustomerGate(): Promise<void> {
  const harness = await createHarness();
  const { response, body } = await postAdmission(harness);

  equal(response.status, 200, 'M02A: real admission route accepts controlled data export admission');
  equal(body.admission.allowed, true, 'M02A: admission decision is allowed before the PEP receives it');
  equal(body.protectedReleaseToken.issued, true, 'M02A: protected release token is issued by the route');
  equal(body.protectedReleaseToken.senderConstrained, true, 'M02A: protected token is sender-constrained');
  equal(body.protectedReleaseToken.introspectionRequired, true, 'M02A: token requires online introspection');
  equal(body.protectedReleaseToken.replayConsumptionRequired, true, 'M02A: token requires replay consumption');
  equal(
    body.protectedReleaseToken.introspectionAuthorityRegistered,
    true,
    'M02A: route registers token in introspection authority',
  );
  equal(
    registeredTokenFor(harness, body).status,
    'issued',
    'M02A: introspection store marks token as issued before the PEP call',
  );
  equal(
    body.protectedReleaseToken.audience,
    DATA_EXPORT_TARGET,
    'M02A: token audience binds the downstream data-export target',
  );
  equal(
    body.protectedReleaseToken.rawReleaseTokenStored,
    false,
    'M02A: sanitized proof summary stores no raw release token',
  );
  equal(
    body.protectedReleaseTokenAuthorization.storeRawTokenInAdmissionOrShadow,
    false,
    'M02A: caller-only authorization forbids storing raw token in admission or shadow',
  );
  equal(
    body.admission.proof.some((proof) =>
      proof.kind === 'release-token' &&
      proof.id === body.protectedReleaseTokenAuthorization.tokenId &&
      proof.digest === body.protectedReleaseTokenAuthorization.tokenDigest),
    true,
    'M02A: final admission carries a release-token proof reference',
  );
  ok(
    harness.recordedEnvelopes.length === 1 &&
      !JSON.stringify(harness.recordedEnvelopes[0]).includes(
        body.protectedReleaseTokenAuthorization.token,
      ),
    'M02A: recorded shadow envelope excludes caller raw token material',
  );

  const { proofJwt, releaseEnforcement } = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-data-export-m02a',
    proofJti: 'dpop-data-export-release-enforcement-m02a',
  });
  const gate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: body.admission,
    downstreamAction: DATA_EXPORT_TARGET,
    releaseEnforcement,
    releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
  });
  const serialized = JSON.stringify(gate);

  equal(releaseEnforcement.status, 'valid', 'M02A: release-enforcement verifier accepts the route-issued token');
  equal(releaseEnforcement.onlineChecked, true, 'M02A: release-enforcement verifier performs online introspection');
  equal(releaseEnforcement.consumed, true, 'M02A: release-enforcement verifier consumes token use');
  deepEqual(releaseEnforcement.failureReasons, [], 'M02A: release-enforcement verifier reports no failures');
  equal(gate.outcome, 'proceed', 'M02A: customer gate proceeds after valid release-enforcement proof');
  equal(gate.releaseEnforcement.valid, true, 'M02A: customer gate marks release-enforcement proof valid');
  equal(gate.releaseEnforcement.proofRefMatched, true, 'M02A: customer gate matches admission release-token proof ref');
  equal(gate.releaseEnforcement.rawReleaseTokenStored, false, 'M02A: gate decision stores no raw token');
  equal(serialized.includes(body.protectedReleaseTokenAuthorization.token), false, 'M02A: gate decision excludes raw release token');
  equal(serialized.includes(proofJwt), false, 'M02A: gate decision excludes raw DPoP proof JWT');
  equal(
    registeredTokenFor(harness, body).status,
    'consumed',
    'M02A: successful release-enforcement proof consumes the protected token',
  );
}

async function testMissingDpopProofFailsClosedBeforeShadowRecord(): Promise<void> {
  const harness = await createHarness();
  const response = await harness.app.request(ADMISSION_ROUTE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(dataMovementAdmissionPayload()),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 503, 'M02A: missing DPoP proof fails closed at the route');
  equal(body.decision, 'block', 'M02A: missing proof cannot execute');
  equal(body.failClosed, true, 'M02A: missing proof failure is fail-closed');
  ok(
    body.reasonCodes.includes('protected-release-token-sender-confirmation-required'),
    'M02A: missing proof reason is explicit',
  );
  equal(harness.recordedEnvelopes.length, 0, 'M02A: failed token issuance is not shadow-recorded');
}

async function testWrongAudienceFailsClosedWithoutConsumingToken(): Promise<void> {
  const harness = await createHarness();
  const { body } = await postAdmission(harness, 'dpop-data-movement-admission-wrong-audience-m02a');
  const { releaseEnforcement } = await verifyReleaseEnforcement({
    harness,
    body,
    targetId: 'data-export-sandbox-other',
    nonce: 'nonce-data-export-wrong-audience-m02a',
    proofJti: 'dpop-data-export-wrong-audience-m02a',
  });
  const gate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: body.admission,
    downstreamAction: DATA_EXPORT_TARGET,
    releaseEnforcement,
    releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
  });

  equal(releaseEnforcement.status, 'invalid', 'M02A: wrong audience release-enforcement proof is invalid');
  ok(
    releaseEnforcement.failureReasons.includes('wrong-audience'),
    'M02A: wrong audience failure is explicit',
  );
  equal(gate.outcome, 'hold', 'M02A: customer gate holds a wrong-audience proof');
  ok(
    gate.releaseEnforcement.failureReasons.includes('release-enforcement-invalid'),
    'M02A: customer gate records invalid release-enforcement proof',
  );
  equal(
    registeredTokenFor(harness, body).status,
    'issued',
    'M02A: wrong-audience failure does not consume the protected token',
  );
}

async function testReplayedProofAndReusedTokenFailClosed(): Promise<void> {
  const harness = await createHarness();
  const { body } = await postAdmission(harness, 'dpop-data-movement-admission-replay-m02a');
  const replayLedgerEntry: ReplayLedgerEntry = {
    subjectKind: 'dpop-proof',
    key: dpopReplayKey('dpop-data-export-replayed-proof-m02a'),
    firstSeenAt: isoNow(-500),
    expiresAt: isoNow(60_000),
  };
  const replayed = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-data-export-replayed-proof-m02a',
    proofJti: 'dpop-data-export-replayed-proof-m02a',
    replayLedgerEntry,
  });

  equal(replayed.releaseEnforcement.status, 'invalid', 'M02A: replayed DPoP proof is invalid');
  ok(
    replayed.releaseEnforcement.failureReasons.includes('replayed-authorization'),
    'M02A: replayed proof failure is explicit',
  );
  equal(
    registeredTokenFor(harness, body).status,
    'issued',
    'M02A: replayed-proof failure does not consume the protected token',
  );

  const firstUse = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-data-export-first-use-m02a',
    proofJti: 'dpop-data-export-first-use-m02a',
  });
  equal(firstUse.releaseEnforcement.status, 'valid', 'M02A: first valid token use succeeds');

  const secondUse = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-data-export-second-use-m02a',
    proofJti: 'dpop-data-export-second-use-m02a',
  });

  equal(secondUse.releaseEnforcement.status, 'invalid', 'M02A: reused consumed token is invalid');
  ok(
    secondUse.releaseEnforcement.failureReasons.includes('replayed-authorization'),
    'M02A: reused consumed token reports replayed authorization',
  );
  equal(
    registeredTokenFor(harness, body).status,
    'consumed',
    'M02A: token remains consumed after rejected reuse',
  );
}

async function main(): Promise<void> {
  await testAdmissionTokenFeedsReleaseEnforcementAndCustomerGate();
  await testMissingDpopProofFailsClosedBeforeShadowRecord();
  await testWrongAudienceFailsClosedWithoutConsumingToken();
  await testReplayedProofAndReusedTokenFailClosed();

  console.log(`Data Movement M02A consequence engine proof tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nData Movement M02A consequence engine proof tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
