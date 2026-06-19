import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { Hono } from 'hono';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import {
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
} from '../src/release-enforcement-plane/http-message-signatures.js';
import {
  ATTESTOR_ENFORCEMENT_STATUS_HEADER,
  HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY,
  RELEASE_ENFORCEMENT_MIDDLEWARE_SPEC_VERSION,
  createHonoReleaseEnforcementMiddleware,
  createNodeReleaseEnforcementMiddleware,
  evaluateReleaseEnforcementHttpRequest,
  type HonoReleaseEnforcementEnv,
} from '../src/release-enforcement-plane/middleware.js';
import {
  COMPILED_POLICY_INDEX_VERSION,
  COMPILED_POLICY_IR_VERSION,
  CONSEQUENCE_HASH,
  OUTPUT_HASH,
  POLICY_HASH,
  POLICY_IR_HASH,
  TARGET_ID,
  baseOptions,
  deepEqual,
  enforcementPoint,
  equal,
  headerOnlyOptions,
  issueToken,
  ok,
  passedCount,
  releaseHeaders,
  throws,
} from './release-enforcement-plane-middleware-fixtures.js';

async function testHonoMiddlewareAllowsValidReleaseAuthorization(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_allow',
    decisionId: 'decision-middleware-hono-allow',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.post('/mutate/report', (context) => {
    handlerReached += 1;
    const result = context.get(HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY);
    return context.json({
      status: result.status,
      verificationStatus: result.verificationResult?.status,
      releaseTokenId: result.verificationResult?.releaseTokenId,
      idempotencyKey: result.request?.idempotencyKey,
    }, 201);
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: releaseHeaders(issued, decision),
  });
  const body = await response.json() as {
    readonly status: string;
    readonly verificationStatus: string;
    readonly releaseTokenId: string;
    readonly idempotencyKey: string;
  };

  equal(response.status, 201, 'Middleware: Hono allows valid release authorization');
  equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'allowed', 'Middleware: Hono stamps allowed status header');
  equal(handlerReached, 1, 'Middleware: Hono calls mutation handler after allow');
  equal(body.status, 'allowed', 'Middleware: Hono exposes allow result to handler context');
  equal(body.verificationStatus, 'valid', 'Middleware: Hono exposes valid verification result');
  equal(body.releaseTokenId, issued.tokenId, 'Middleware: Hono binds release token id');
  equal(body.idempotencyKey, 'idem-middleware-1', 'Middleware: Hono carries idempotency key into enforcement request');
}

async function testHonoMiddlewareBindsFullPolicyProvenanceHeaders(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_policy_provenance',
    decisionId: 'decision-middleware-hono-policy-provenance',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.post('/mutate/report', (context) => {
    const result = context.get(HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY);
    return context.json({
      status: result.status,
      policyContext: result.verificationResult?.policyContext,
    }, 201);
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: releaseHeaders(issued, decision),
  });
  const body = await response.json() as {
    readonly status: string;
    readonly policyContext: unknown;
  };

  equal(response.status, 201, 'Middleware: Hono allows full policy provenance binding');
  equal(body.status, 'allowed', 'Middleware: full policy provenance binding remains allowed');
  deepEqual(
    body.policyContext,
    {
      policyHash: POLICY_HASH,
      policyVersion: 'policy.release-middleware-test.v1',
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    'Middleware: Hono carries the full structured policy context from binding headers',
  );
}

async function testHonoMiddlewareDeniesMissingAuthorization(): Promise<void> {
  const { verificationKey } = await issueToken({
    tokenId: 'rt_middleware_hono_missing',
    decisionId: 'decision-middleware-hono-missing',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.post('/mutate/report', (context) => {
    handlerReached += 1;
    return context.text('should not run');
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: new Headers({
      [ATTESTOR_TARGET_ID_HEADER]: TARGET_ID,
      [ATTESTOR_OUTPUT_HASH_HEADER]: OUTPUT_HASH,
      [ATTESTOR_CONSEQUENCE_HASH_HEADER]: CONSEQUENCE_HASH,
    }),
  });
  const body = await response.json() as { readonly failureReasons: readonly string[] };

  equal(response.status, 401, 'Middleware: Hono denies missing release authorization');
  equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'denied', 'Middleware: denied response stamps status');
  ok(response.headers.get('www-authenticate')?.includes('attestor-release'), 'Middleware: missing auth returns release authorization challenge');
  equal(handlerReached, 0, 'Middleware: denied Hono request does not reach mutation handler');
  deepEqual(body.failureReasons, ['missing-release-authorization'], 'Middleware: missing authorization failure is explicit');
}

async function testCoreEvaluatorRejectsAmbiguousAuthorizationCredentials(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_core_ambiguous_auth',
    decisionId: 'decision-middleware-core-ambiguous-auth',
  });
  const duplicateHeaders = Object.fromEntries(releaseHeaders(issued, decision).entries()) as Record<string, string | readonly string[]>;
  duplicateHeaders.authorization = [`Bearer ${issued.token}`, `Bearer ${issued.token}`];

  const duplicateResult = await evaluateReleaseEnforcementHttpRequest(
    {
      method: 'POST',
      url: 'https://middleware.attestor.test/mutate',
      headers: duplicateHeaders,
    },
    baseOptions({ verificationKey }),
  );

  equal(duplicateResult.status, 'denied', 'Middleware: duplicate Authorization headers fail closed');
  equal(duplicateResult.responseStatus, 401, 'Middleware: duplicate Authorization maps to missing authorization');
  deepEqual(
    duplicateResult.failureReasons,
    ['missing-release-authorization'],
    'Middleware: duplicate Authorization is not parsed as a release credential',
  );

  const parameterizedHeaders = Object.fromEntries(releaseHeaders(issued, decision).entries()) as Record<string, string>;
  parameterizedHeaders.authorization = `Bearer ${issued.token};injection=true`;
  const parameterizedResult = await evaluateReleaseEnforcementHttpRequest(
    {
      method: 'POST',
      url: 'https://middleware.attestor.test/mutate',
      headers: parameterizedHeaders,
    },
    baseOptions({ verificationKey }),
  );

  equal(parameterizedResult.status, 'denied', 'Middleware: parameterized bearer credential fails closed');
  equal(parameterizedResult.responseStatus, 401, 'Middleware: parameterized bearer maps to missing authorization');
}

async function testHonoMiddlewareDeniesBindingMismatch(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_binding',
    decisionId: 'decision-middleware-hono-binding',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({
    verificationKey,
    outputHash: 'sha256:wrong-output',
  })));
  app.post('/mutate/report', (context) => {
    handlerReached += 1;
    return context.text('should not run');
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: releaseHeaders(issued, decision),
  });
  const body = await response.json() as {
    readonly failureReasons: readonly string[];
    readonly verificationStatus: string;
    readonly requestId: string | null;
  };

  equal(response.status, 403, 'Middleware: Hono denies trusted resolver output hash binding mismatch');
  equal(handlerReached, 0, 'Middleware: binding mismatch does not reach handler');
  deepEqual(body.failureReasons, ['binding-mismatch'], 'Middleware: binding mismatch reason is explicit');
  equal(body.verificationStatus, 'invalid', 'Middleware: invalid verification status is exposed');
  ok(typeof body.requestId === 'string' && body.requestId.length > 0, 'Middleware: denied body carries enforcement request id');
}

async function testHonoMiddlewareDeniesPolicyIrMismatch(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_policy_ir',
    decisionId: 'decision-middleware-hono-policy-ir',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.post('/mutate/report', (context) => {
    handlerReached += 1;
    return context.text('should not run');
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: releaseHeaders(issued, decision, {
      [ATTESTOR_POLICY_IR_HASH_HEADER]: 'sha256:wrong-policy-ir',
    }),
  });
  const body = await response.json() as {
    readonly failureReasons: readonly string[];
    readonly verificationStatus: string;
  };

  equal(response.status, 403, 'Middleware: Hono denies policy IR binding mismatch');
  equal(handlerReached, 0, 'Middleware: policy IR mismatch does not reach handler');
  deepEqual(body.failureReasons, ['stale-policy'], 'Middleware: policy IR mismatch reason is explicit');
  equal(body.verificationStatus, 'invalid', 'Middleware: policy IR mismatch exposes invalid verification status');
}

async function testHonoMiddlewareDeniesCompiledPolicyVersionMismatch(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_compiled_policy_version',
    decisionId: 'decision-middleware-hono-compiled-policy-version',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.post('/mutate/report', (context) => {
    handlerReached += 1;
    return context.text('should not run');
  });

  const response = await app.request('/mutate/report', {
    method: 'POST',
    headers: releaseHeaders(issued, decision, {
      [ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER]: 'attestor.policy-ir.tampered.v1',
    }),
  });
  const body = await response.json() as {
    readonly failureReasons: readonly string[];
    readonly verificationStatus: string;
  };

  equal(response.status, 403, 'Middleware: Hono denies compiled policy IR version mismatch');
  equal(handlerReached, 0, 'Middleware: compiled policy version mismatch does not reach handler');
  deepEqual(body.failureReasons, ['stale-policy'], 'Middleware: compiled policy version mismatch reason is explicit');
  equal(body.verificationStatus, 'invalid', 'Middleware: compiled policy version mismatch exposes invalid verification status');
}

async function testHonoMiddlewareProtectsReadExportsByDefault(): Promise<void> {
  const { verificationKey } = await issueToken({
    tokenId: 'rt_middleware_hono_get_default',
    decisionId: 'decision-middleware-hono-get-default',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({ verificationKey })));
  app.get('/mutate/report', (context) => {
    handlerReached += 1;
    return context.json({ status: 'should-not-run' });
  });

  const response = await app.request('/mutate/report', { method: 'GET' });
  const body = await response.json() as { readonly failureReasons: readonly string[] };

  equal(response.status, 401, 'Middleware: Hono protects GET by default');
  equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'denied', 'Middleware: default GET denial is observable');
  equal(handlerReached, 0, 'Middleware: default GET denial does not reach handler');
  deepEqual(body.failureReasons, ['missing-release-authorization'], 'Middleware: default GET requires release authorization');
}

async function testHonoMiddlewareSkipsReadOnlyRoutesOnlyWhenExplicit(): Promise<void> {
  const { verificationKey } = await issueToken({
    tokenId: 'rt_middleware_hono_explicit_skip',
    decisionId: 'decision-middleware-hono-explicit-skip',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();

  throws(
    () =>
      createHonoReleaseEnforcementMiddleware({
        ...baseOptions({ verificationKey }),
        protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
      }),
    /methodCoverageProof/u,
    'Middleware: method opt-out requires an explicit coverage proof',
  );

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware({
    ...baseOptions({ verificationKey }),
    protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    methodCoverageProof: {
      proofRef: 'route-map:read-only-export-reviewed',
      readOnlyRoutesOnly: true,
    },
  }));
  app.get('/mutate/report', (context) => {
    const result = context.get(HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY);
    return context.json({ status: result.status });
  });

  const response = await app.request('/mutate/report', { method: 'GET' });
  const body = await response.json() as { readonly status: string };

  equal(response.status, 200, 'Middleware: explicit mutation-only configuration can skip GET');
  equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'skipped', 'Middleware: explicit skipped GET is observable');
  equal(body.status, 'skipped', 'Middleware: explicit skipped status is available in Hono context');
}

async function testHonoMiddlewareOnlineVerifierDeniesHighRiskBearer(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_online',
    decisionId: 'decision-middleware-hono-online',
    consequenceType: 'communication',
    riskClass: 'R3',
  });
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  store.registerIssuedToken({ issuedToken: issued, decision });
  const app = new Hono<HonoReleaseEnforcementEnv>();
  let handlerReached = 0;

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware({
    ...baseOptions({
      verificationKey,
      riskClass: 'R3',
      consequenceType: 'communication',
    }),
    verifierMode: 'online',
    introspector,
  }));
  app.post('/mutate/send', (context) => {
    handlerReached += 1;
    const result = context.get(HONO_RELEASE_ENFORCEMENT_CONTEXT_KEY);
    return context.json({
      status: result.status,
      onlineChecked: result.online?.onlineChecked,
      offlineStatus: result.online?.offline.status,
    }, 202);
  });

  const response = await app.request('/mutate/send', {
    method: 'POST',
    headers: releaseHeaders(issued, decision),
  });
  const body = await response.json() as {
    readonly failureReasons: readonly string[];
    readonly verificationStatus: string;
  };

  equal(response.status, 403, 'Middleware: Hono online verifier denies bearer-only high-risk release');
  equal(handlerReached, 0, 'Middleware: high-risk bearer denial does not reach handler');
  deepEqual(body.failureReasons, ['binding-mismatch'], 'Middleware: high-risk bearer denial is explicit');
  equal(body.verificationStatus, 'invalid', 'Middleware: high-risk bearer denial exposes invalid verification');
}

async function testHonoMiddlewareOfflineHighRiskFailsClosed(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_hono_indeterminate',
    decisionId: 'decision-middleware-hono-indeterminate',
    consequenceType: 'communication',
    riskClass: 'R3',
  });
  const app = new Hono<HonoReleaseEnforcementEnv>();

  app.use('/mutate/*', createHonoReleaseEnforcementMiddleware(baseOptions({
    verificationKey,
    riskClass: 'R3',
    consequenceType: 'communication',
  })));
  app.post('/mutate/send', (context) => context.text('should not run'));

  const response = await app.request('/mutate/send', {
    method: 'POST',
    headers: releaseHeaders(issued, decision),
  });
  const body = await response.json() as {
    readonly failureReasons: readonly string[];
    readonly verificationStatus: string;
  };

  equal(response.status, 403, 'Middleware: offline high-risk bearer path fails closed before liveness');
  equal(body.verificationStatus, 'invalid', 'Middleware: sender-constraint failure is exposed as invalid');
  deepEqual(body.failureReasons, ['binding-mismatch'], 'Middleware: missing sender constraint is explicit');
}

async function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
      }
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function testNodeMiddlewareAllowsValidReleaseAuthorization(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_node_allow',
    decisionId: 'decision-middleware-node-allow',
  });
  const middleware = createNodeReleaseEnforcementMiddleware(baseOptions({ verificationKey }));
  let handlerReached = 0;
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      handlerReached += 1;
      const result = request.releaseEnforcement as ReleaseEnforcementMiddlewareResult;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        status: result.status,
        tokenId: result.verificationResult?.releaseTokenId,
      }));
    });
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/mutate`, {
      method: 'POST',
      headers: releaseHeaders(issued, decision),
    });
    const body = await response.json() as { readonly status: string; readonly tokenId: string };

    equal(response.status, 200, 'Middleware: Node adapter allows valid release authorization');
    equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'allowed', 'Middleware: Node adapter stamps allowed status');
    equal(handlerReached, 1, 'Middleware: Node adapter calls next after allow');
    equal(body.status, 'allowed', 'Middleware: Node adapter exposes result on request');
    equal(body.tokenId, issued.tokenId, 'Middleware: Node adapter binds release token id');
  } finally {
    await closeServer(server);
  }
}

async function testNodeMiddlewareDeniesMissingAuthorization(): Promise<void> {
  const { verificationKey } = await issueToken({
    tokenId: 'rt_middleware_node_missing',
    decisionId: 'decision-middleware-node-missing',
  });
  const middleware = createNodeReleaseEnforcementMiddleware(baseOptions({ verificationKey }));
  let handlerReached = 0;
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      handlerReached += 1;
      response.end('should not run');
    });
  });
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/mutate`, {
      method: 'POST',
      headers: new Headers({
        [ATTESTOR_TARGET_ID_HEADER]: TARGET_ID,
        [ATTESTOR_OUTPUT_HASH_HEADER]: OUTPUT_HASH,
        [ATTESTOR_CONSEQUENCE_HASH_HEADER]: CONSEQUENCE_HASH,
      }),
    });
    const body = await response.json() as { readonly failureReasons: readonly string[] };

    equal(response.status, 401, 'Middleware: Node adapter denies missing authorization');
    equal(response.headers.get(ATTESTOR_ENFORCEMENT_STATUS_HEADER), 'denied', 'Middleware: Node denied response stamps status');
    equal(handlerReached, 0, 'Middleware: Node denied request does not call next');
    deepEqual(body.failureReasons, ['missing-release-authorization'], 'Middleware: Node missing auth reason is explicit');
  } finally {
    await closeServer(server);
  }
}

async function testCoreEvaluatorRejectsCallerSuppliedBindingHeadersByDefault(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_core_caller_binding',
    decisionId: 'decision-middleware-core-caller-binding',
  });
  const result = await evaluateReleaseEnforcementHttpRequest(
    {
      method: 'POST',
      url: 'https://middleware.attestor.test/mutate',
      headers: releaseHeaders(issued, decision, {
        'content-digest': `sha256:${'c'.repeat(64)}`,
      }),
    },
    headerOnlyOptions({ verificationKey }),
  );

  equal(result.version, RELEASE_ENFORCEMENT_MIDDLEWARE_SPEC_VERSION, 'Middleware: core evaluator stamps stable spec version');
  equal(result.status, 'denied', 'Middleware: default evaluator fails closed on caller-supplied binding headers');
  equal(result.responseStatus, 403, 'Middleware: untrusted binding headers map to forbidden');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Middleware: untrusted binding headers map to binding mismatch');
}

async function testCoreEvaluatorAllowsExplicitTrustedUpstreamBindingHeaders(): Promise<void> {
  const { issued, verificationKey, decision } = await issueToken({
    tokenId: 'rt_middleware_core_trusted_upstream',
    decisionId: 'decision-middleware-core-trusted-upstream',
  });
  const trustedBodyDigest = `sha256:${'d'.repeat(64)}`;
  await assert.rejects(
    () =>
      evaluateReleaseEnforcementHttpRequest(
        {
          method: 'POST',
          url: 'https://middleware.attestor.test/mutate',
          headers: releaseHeaders(issued, decision, {
            'content-digest': trustedBodyDigest,
          }),
        },
        {
          ...headerOnlyOptions({ verificationKey }),
          bindingHeaderMode: 'trusted-upstream',
        },
      ),
    /trustedUpstreamProof/u,
    'Middleware: trusted-upstream mode requires upstream proof',
  );
  ok(true, 'Middleware: trusted-upstream mode requires upstream proof');

  const result = await evaluateReleaseEnforcementHttpRequest(
    {
      method: 'POST',
      url: 'https://middleware.attestor.test/mutate',
      headers: releaseHeaders(issued, decision, {
        'content-digest': trustedBodyDigest,
      }),
    },
    {
      ...headerOnlyOptions({ verificationKey }),
      bindingHeaderMode: 'trusted-upstream',
      trustedUpstreamProof: {
        proofRef: 'upstream:gateway-strips-and-signs-binding',
        nonBypassableUpstream: true,
        stripsClientAttestorHeaders: true,
        derivesBodyDigestFromRequest: true,
        signedBindingEnvelope: true,
      },
    },
  );

  equal(result.status, 'allowed', 'Middleware: explicit trusted-upstream mode can consume pre-bound headers');
  equal(result.request?.transport?.kind === 'http' ? result.request.transport.bodyDigest : null, trustedBodyDigest, 'Middleware: trusted-upstream mode records upstream body digest');
}

async function main(): Promise<void> {
  await testHonoMiddlewareAllowsValidReleaseAuthorization();
  await testHonoMiddlewareBindsFullPolicyProvenanceHeaders();
  await testHonoMiddlewareDeniesMissingAuthorization();
  await testCoreEvaluatorRejectsAmbiguousAuthorizationCredentials();
  await testHonoMiddlewareDeniesBindingMismatch();
  await testHonoMiddlewareDeniesPolicyIrMismatch();
  await testHonoMiddlewareDeniesCompiledPolicyVersionMismatch();
  await testHonoMiddlewareProtectsReadExportsByDefault();
  await testHonoMiddlewareSkipsReadOnlyRoutesOnlyWhenExplicit();
  await testHonoMiddlewareOnlineVerifierDeniesHighRiskBearer();
  await testHonoMiddlewareOfflineHighRiskFailsClosed();
  await testNodeMiddlewareAllowsValidReleaseAuthorization();
  await testNodeMiddlewareDeniesMissingAuthorization();
  await testCoreEvaluatorRejectsCallerSuppliedBindingHeadersByDefault();
  await testCoreEvaluatorAllowsExplicitTrustedUpstreamBindingHeaders();

  console.log(`Release enforcement-plane middleware tests: ${passedCount()} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane middleware tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
