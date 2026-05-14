import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  ReleaseTokenVerificationFailure,
  verifyIssuedReleaseToken,
} from '../src/release-kernel/release-token.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import {
  createEnforcementRequest,
  createReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';
import { verifyOfflineReleaseAuthorization } from '../src/release-enforcement-plane/offline-verifier.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function makeDecision() {
  return createReleaseDecisionSkeleton({
    id: 'decision-f6-tenant-bound',
    createdAt: '2026-05-14T08:00:00.000Z',
    status: 'accepted',
    policyVersion: 'policy.f6-tenant-bound.v1',
    policyHash: 'sha256:policy-f6',
    policyProvenance: {
      source: 'compiled-admission-policy-index',
      policyId: 'policy.f6-tenant-bound',
      policySpecVersion: 'attestor.release-policy.v1',
      policyHash: 'sha256:policy-f6',
      compiledPolicyHash: 'sha256:policy-f6',
      compiledPolicyIrHash: 'sha256:policy-ir-f6',
      compiledPolicyIndexVersion: 'attestor.policy-index.f6.v1',
      compiledPolicyIrVersion: 'attestor.policy-ir.f6.v1',
      verificationValid: true,
      verificationErrorCodes: [],
      verificationWarningCodes: [],
    },
    outputHash: 'sha256:output-f6',
    consequenceHash: 'sha256:consequence-f6',
    outputContract: {
      artifactType: 'f6.tenant-bound.artifact',
      expectedShape: 'tenant-bound release-token validation artifact',
      consequenceType: 'decision-support',
      riskClass: 'R1',
    },
    capabilityBoundary: {
      allowedTools: ['f6-decision-support'],
      allowedTargets: ['analytics.tenant-a'],
      allowedDataDomains: ['tenant-a-records'],
    },
    requester: {
      id: 'svc.f6-release-token',
      type: 'service',
    },
    target: {
      kind: 'endpoint',
      id: 'analytics.tenant-a',
    },
  });
}

async function main(): Promise<void> {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const verificationKey = await issuer.exportVerificationKey();
  const decision = makeDecision();
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-05-14T08:00:00.000Z',
    tokenId: 'rt_f6_tenant_a',
    audience: 'analytics.tenant-a',
    tenantId: 'tenant-a',
  });

  equal(
    issued.claims.tenant_id,
    'tenant-a',
    'F6 tenant-bound token: issuer stamps tenant_id into release-token claims',
  );

  const verified = await verifyIssuedReleaseToken({
    token: issued.token,
    verificationKey,
    audience: 'analytics.tenant-a',
    expectedTenantId: 'tenant-a',
    currentDate: '2026-05-14T08:01:00.000Z',
  });
  equal(
    verified.claims.tenant_id,
    'tenant-a',
    'F6 tenant-bound token: low-level verifier accepts the expected tenant binding',
  );

  await assert.rejects(
    () =>
      verifyIssuedReleaseToken({
        token: issued.token,
        verificationKey,
        audience: 'analytics.tenant-a',
        expectedTenantId: 'tenant-b',
        currentDate: '2026-05-14T08:01:00.000Z',
      }),
    (error: unknown) =>
      error instanceof ReleaseTokenVerificationFailure &&
      error.code === 'invalid' &&
      error.message.includes('tenant_id'),
    'F6 tenant-bound token: low-level verifier rejects a mismatched expected tenant',
  );
  passed += 1;

  const store = createInMemoryReleaseTokenIntrospectionStore();
  store.registerIssuedToken({ issuedToken: issued, decision });
  const introspection = await createReleaseTokenIntrospector(store).introspect({
    token: issued.token,
    verificationKey,
    audience: 'analytics.tenant-a',
    currentDate: '2026-05-14T08:01:00.000Z',
    resourceServerId: 'decision-support-f6',
  });
  ok(introspection.active, 'F6 tenant-bound token: registered token introspects as active');
  if (introspection.active) {
    equal(
      introspection.tenant_id,
      'tenant-a',
      'F6 tenant-bound token: introspection returns the tenant_id claim',
    );
  }

  const request = createEnforcementRequest({
    id: 'erq-f6-tenant-bound',
    receivedAt: '2026-05-14T08:01:00.000Z',
    enforcementPoint: {
      environment: 'test',
      enforcementPointId: 'decision-support-f6',
      pointKind: 'application-middleware',
      boundaryKind: 'http-request',
      consequenceType: 'decision-support',
      riskClass: 'R1',
      tenantId: 'tenant-a',
      accountId: 'acct-a',
      audience: 'analytics.tenant-a',
    },
    targetId: 'analytics.tenant-a',
    outputHash: 'sha256:output-f6',
    consequenceHash: 'sha256:consequence-f6',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });
  const presentation = createReleasePresentation({
    mode: 'bearer-release-token',
    presentedAt: '2026-05-14T08:01:00.000Z',
    releaseToken: issued.token,
    releaseTokenId: issued.tokenId,
    releaseTokenDigest: tokenDigest(issued.token),
    issuer: 'attestor.release.local',
    subject: `releaseDecision:${decision.id}`,
    audience: 'analytics.tenant-a',
    expiresAt: issued.expiresAt,
  });

  const offline = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    now: '2026-05-14T08:01:00.000Z',
    expected: {
      tenantId: 'tenant-a',
      policyHash: 'sha256:policy-f6',
      policyVersion: 'policy.f6-tenant-bound.v1',
      policyIrHash: 'sha256:policy-ir-f6',
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: 'attestor.policy-index.f6.v1',
      compiledPolicyIrVersion: 'attestor.policy-ir.f6.v1',
    },
    replayLedgerEntry: null,
  });
  equal(
    offline.status,
    'valid',
    'F6 tenant-bound token: offline verifier accepts matching tenant binding',
  );
  equal(
    offline.verificationResult.tenantId,
    'tenant-a',
    'F6 tenant-bound token: verification result records the tenant binding',
  );

  const mismatched = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    now: '2026-05-14T08:01:00.000Z',
    expected: {
      tenantId: 'tenant-b',
      policyHash: 'sha256:policy-f6',
      policyVersion: 'policy.f6-tenant-bound.v1',
      policyIrHash: 'sha256:policy-ir-f6',
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: 'attestor.policy-index.f6.v1',
      compiledPolicyIrVersion: 'attestor.policy-ir.f6.v1',
    },
    replayLedgerEntry: null,
  });
  equal(
    mismatched.status,
    'invalid',
    'F6 tenant-bound token: offline verifier rejects mismatched tenant binding',
  );
  ok(
    mismatched.failureReasons.includes('binding-mismatch'),
    'F6 tenant-bound token: mismatched tenant produces binding-mismatch',
  );

  console.log(`F6 tenant-bound release-token tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('F6 tenant-bound release-token tests failed:', error);
  process.exitCode = 1;
});
