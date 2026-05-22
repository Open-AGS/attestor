import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  issueCertificate,
  type CertificateInput,
} from '../src/signing/certificate.js';
import { derivePublicKeyIdentity } from '../src/signing/keys.js';
import {
  generatePkiHierarchy,
  verifyTrustChain,
} from '../src/signing/pki-chain.js';
import { verifyCertificate } from '../src/signing/certificate.js';
import { registerPipelineVerificationRoutes } from '../src/service/http/routes/pipeline-verification-routes.js';
import { resetPublicRouteRateLimiterForTests } from '../src/service/public-route-rate-limit.js';
import { logger } from '../src/utils/logger.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function certInput(): CertificateInput {
  return {
    runIdentity: 'run_pki_route_test',
    decision: 'pass',
    decisionSummary: 'PKI route test accepted.',
    warrant: { status: 'fulfilled', obligationsFulfilled: 1, obligationsTotal: 1 },
    escrow: { state: 'released' },
    receipt: { status: 'issued' },
    capsule: { authority: 'valid' },
    evidenceChainRoot: 'root_pki_route_test',
    evidenceChainTerminal: 'terminal_pki_route_test',
    auditChainIntact: true,
    auditEntryCount: 1,
    sqlHash: 'sql_hash_pki_route_test',
    snapshotHash: 'snapshot_hash_pki_route_test',
    sqlGovernance: 'pass',
    policy: 'pass',
    guardrails: 'pass',
    dataContracts: 'pass',
    scorersRun: 1,
    reviewRequired: false,
    liveProofMode: 'live_runtime',
    upstreamLive: true,
    executionLive: true,
    liveProofConsistent: true,
  };
}

function routeApp(): Hono {
  const app = new Hono();
  registerPipelineVerificationRoutes(app, {
    verifyCertificate,
    verifyTrustChain,
    derivePublicKeyIdentity,
  });
  return app;
}

async function postVerify(app: Hono, body: unknown, headers?: Record<string, string>): Promise<{
  readonly status: number;
  readonly headers: Headers;
  readonly body: Record<string, unknown>;
}> {
  const response = await app.request('/api/v1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json() as Record<string, unknown>,
  };
}

async function testPkiBoundVerificationPasses(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.status, 200, 'PKI verification route: valid request returns 200');
  equal(result.body.overall, 'valid', 'PKI verification route: valid chain returns overall valid');
  equal(
    (result.body.trustBinding as { pkiVerified: boolean }).pkiVerified,
    true,
    'PKI verification route: valid chain is fully PKI verified',
  );
  equal(
    (result.body.chainVerification as { independentTrustRootVerified: boolean }).independentTrustRootVerified,
    true,
    'PKI verification route: pinned CA establishes independent trust root',
  );
}

async function testPkiBindingFailureControlsOverall(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const tamperedChain = {
    ...pki.chains.signer,
    leaf: {
      ...pki.chains.signer.leaf,
      subjectFingerprint: '00000000000000000000000000000000',
    },
  };
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: tamperedChain,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
    trustedCaFingerprint: pki.ca.certificate.fingerprint,
  });

  equal(result.status, 200, 'PKI verification route: binding failure is reported as verification result');
  equal(result.body.overall, 'invalid', 'PKI verification route: PKI binding failure controls overall invalid');
  equal(
    (result.body.trustBinding as { pkiVerified: boolean }).pkiVerified,
    false,
    'PKI verification route: tampered chain is not PKI verified',
  );
  ok(
    String(result.body.explanation).includes('PKI trust binding failed'),
    'PKI verification route: explanation names trust-binding failure',
  );
}

async function testMissingTrustedCaFingerprintFailsClosed(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const result = await postVerify(routeApp(), {
    certificate,
    publicKeyPem: pki.signer.keyPair.publicKeyPem,
    trustChain: pki.chains.signer,
    caPublicKeyPem: pki.ca.keyPair.publicKeyPem,
  });

  equal(result.status, 422, 'PKI verification route: missing trusted CA fingerprint returns 422');
  equal(
    result.body.error,
    'trustedCaFingerprint is required for independent PKI verification.',
    'PKI verification route: trusted CA pin is required for third-party verification',
  );
}

async function testMissingPkiMaterialFailsClosed(): Promise<void> {
  const pki = generatePkiHierarchy('Route Test CA', 'Route Test Signer', 'Route Test Reviewer');
  const certificate = issueCertificate(certInput(), pki.signer.keyPair);
  const warnEvents: Array<{
    stage: string;
    message: string;
    data?: Record<string, unknown>;
  }> = [];
  const originalWarn = logger.warn;
  logger.warn = (stage, message, data) => {
    warnEvents.push({ stage, message, data });
  };
  let result: Awaited<ReturnType<typeof postVerify>> | null = null;
  try {
    result = await postVerify(routeApp(), {
      certificate,
      publicKeyPem: pki.signer.keyPair.publicKeyPem,
    });
  } finally {
    logger.warn = originalWarn;
  }

  ok(result !== null, 'PKI verification route: missing chain material returns a response');
  equal(result.status, 422, 'PKI verification route: missing chain material returns 422');
  equal(
    result.body.error,
    'PKI trust chain required for verification.',
    'PKI verification route: missing chain material is fail-closed',
  );
  equal(warnEvents.length, 1, 'PKI verification route: missing chain material emits one structured warning');
  equal(warnEvents[0]?.stage, 'api.verify', 'PKI verification route: warning uses the verify stage');
  equal(
    warnEvents[0]?.data?.reasonCode,
    'missing-pki-chain-material',
    'PKI verification route: warning uses a bounded reason code',
  );
  equal(
    warnEvents[0]?.data?.hasPublicKeyPem,
    true,
    'PKI verification route: warning records only request-shape booleans',
  );
  ok(
    !JSON.stringify(warnEvents[0]?.data ?? {}).includes(pki.signer.keyPair.publicKeyPem),
    'PKI verification route: warning does not log raw public key material',
  );
}

async function testGenericVerifyFailureReturnsRedactedProblemDetail(): Promise<void> {
  const result = await postVerify(routeApp(), {
    certificate: { certificateId: 'cert_redacted' },
    publicKeyPem: 'not a valid public key SECRET_VERIFY_EXCEPTION_MARKER',
    trustChain: {
      ca: { name: 'Fake CA', fingerprint: 'fake-ca' },
      leaf: { subject: 'Fake Leaf', subjectFingerprint: 'fake-leaf' },
    },
    caPublicKeyPem: 'not a valid CA key SECRET_CA_EXCEPTION_MARKER',
    trustedCaFingerprint: 'fake-ca',
  });

  equal(result.status, 500, 'PKI verification route: unexpected verifier failure returns 500');
  equal(
    result.body.error,
    'internal_error',
    'PKI verification route: unexpected verifier failure uses a bounded error code',
  );
  equal(
    result.body.message,
    'Verification failed.',
    'PKI verification route: unexpected verifier failure uses a route-owned message',
  );
  ok(
    !JSON.stringify(result.body).includes('SECRET_VERIFY_EXCEPTION_MARKER') &&
      !JSON.stringify(result.body).includes('SECRET_CA_EXCEPTION_MARKER'),
    'PKI verification route: unexpected verifier failure does not echo raw exception context',
  );
}

function testVerifyRouteDoesNotUseConsoleLogging(): void {
  const source = readFileSync(
    join(process.cwd(), 'src', 'service', 'http', 'routes', 'pipeline-verification-routes.ts'),
    'utf8',
  );
  equal(
    source.includes('console.log'),
    false,
    'PKI verification route: rejection logging no longer uses console.log',
  );
  ok(
    source.includes("logger.warn('api.verify'"),
    'PKI verification route: rejection logging uses the structured logger',
  );
}

async function testVerifyRouteRateLimitShortCircuitsBeforeVerificationWork(): Promise<void> {
  const previousLimit = process.env.ATTESTOR_VERIFY_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_VERIFY_RATE_LIMIT_PER_MINUTE = '1';
  resetPublicRouteRateLimiterForTests();
  try {
    const app = routeApp();
    const headers = { 'x-real-ip': '198.51.100.20' };
    const first = await postVerify(app, {}, headers);
    equal(first.status, 400, 'PKI verification route rate limit: first request reaches route validation');

    const second = await postVerify(app, {}, headers);
    equal(second.status, 429, 'PKI verification route rate limit: second same-source request is throttled');
    equal(
      second.body.error,
      'Verification route rate limit exceeded.',
      'PKI verification route rate limit: over-limit response is explicit and bounded',
    );
    ok(
      Number.parseInt(second.headers.get('retry-after') ?? '', 10) > 0,
      'PKI verification route rate limit: over-limit response includes Retry-After',
    );
    ok(
      !!second.headers.get('x-attestor-verify-rate-limit-reset-at'),
      'PKI verification route rate limit: over-limit response includes reset timestamp',
    );
  } finally {
    resetPublicRouteRateLimiterForTests();
    if (previousLimit === undefined) {
      delete process.env.ATTESTOR_VERIFY_RATE_LIMIT_PER_MINUTE;
    } else {
      process.env.ATTESTOR_VERIFY_RATE_LIMIT_PER_MINUTE = previousLimit;
    }
  }
}

await testPkiBoundVerificationPasses();
await testPkiBindingFailureControlsOverall();
await testMissingTrustedCaFingerprintFailsClosed();
await testMissingPkiMaterialFailsClosed();
await testGenericVerifyFailureReturnsRedactedProblemDetail();
await testVerifyRouteRateLimitShortCircuitsBeforeVerificationWork();
testVerifyRouteDoesNotUseConsoleLogging();

console.log(`pipeline-verification-routes.test.ts: ${passed} assertions passed`);
