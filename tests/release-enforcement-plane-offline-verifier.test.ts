import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import type { ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import {
  createEnforcementRequest,
  createReleasePresentation,
  type EnforcementRequest,
  type ReleaseEnforcementPolicyContext,
  type ReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';
import {
  OFFLINE_RELEASE_VERIFIER_SPEC_VERSION,
  verifyOfflineReleaseAuthorization,
} from '../src/release-enforcement-plane/offline-verifier.js';
import { resolveVerificationProfile } from '../src/release-enforcement-plane/verification-profiles.js';
import { createMtlsReleaseTokenConfirmation } from '../src/release-enforcement-plane/workload-binding.js';

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

function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

const POLICY_HASH = 'sha256:policy';
const POLICY_VERSION = 'policy.release-offline-test.v1';
const POLICY_IR_HASH = 'sha256:policy-ir';
const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';
const WORKLOAD_CERT_THUMBPRINT = 'cert-thumbprint';
const WORKLOAD_SPIFFE_ID = 'spiffe://attestor/tests/finance-writer';

function trustedWorkloadBinding() {
  return {
    expectedCertificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
    expectedSpiffeId: WORKLOAD_SPIFFE_ID,
    expectedTrustDomain: 'attestor',
  } as const;
}

function expectedPolicyContext(): ReleaseEnforcementPolicyContext {
  return {
    policyHash: POLICY_HASH,
    policyVersion: POLICY_VERSION,
    policyIrHash: POLICY_IR_HASH,
    policyProvenanceSource: 'compiled-admission-policy-index',
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
  };
}

function policyProvenance(input: {
  readonly policyHash?: string;
  readonly policyIrHash?: string | null;
} = {}): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-offline-test',
    policySpecVersion: 'attestor.release-policy.v1',
    policyHash: input.policyHash ?? POLICY_HASH,
    compiledPolicyHash: input.policyHash ?? POLICY_HASH,
    compiledPolicyIrHash: input.policyIrHash ?? POLICY_IR_HASH,
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

function makeDecision(input: {
  readonly id: string;
  readonly consequenceType: 'communication' | 'record' | 'action' | 'decision-support';
  readonly riskClass: 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
  readonly targetId: string;
  readonly outputHash?: string;
  readonly consequenceHash?: string;
  readonly policyHash?: string;
  readonly policyIrHash?: string | null;
  readonly includePolicyProvenance?: boolean;
}) {
  const policyHash = input.policyHash ?? POLICY_HASH;
  return createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: '2026-04-18T08:00:00.000Z',
    status: 'accepted',
    policyVersion: POLICY_VERSION,
    policyHash,
    policyProvenance:
      input.includePolicyProvenance === false
        ? null
        : policyProvenance({
            policyHash,
            policyIrHash: input.policyIrHash,
          }),
    outputHash: input.outputHash ?? 'sha256:output',
    consequenceHash: input.consequenceHash ?? 'sha256:consequence',
    outputContract: {
      artifactType: 'release-offline-test.artifact',
      expectedShape: 'deterministic test artifact',
      consequenceType: input.consequenceType,
      riskClass: input.riskClass,
    },
    capabilityBoundary: {
      allowedTools: ['release-offline-test-tool'],
      allowedTargets: [input.targetId],
      allowedDataDomains: ['release-offline-test'],
    },
    requester: {
      id: 'svc.release-offline-test',
      type: 'service',
    },
    target: {
      kind: input.consequenceType === 'record' ? 'record-store' : 'endpoint',
      id: input.targetId,
    },
  });
}

function makeRequest(input: {
  readonly id: string;
  readonly targetId: string;
  readonly boundaryKind?: 'http-request' | 'record-write' | 'communication-send';
  readonly pointKind?: 'application-middleware' | 'record-write-gateway' | 'communication-send-gateway';
  readonly consequenceType?: 'communication' | 'record' | 'decision-support';
  readonly riskClass?: 'R1' | 'R3' | 'R4';
  readonly outputHash?: string;
  readonly consequenceHash?: string;
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
}): EnforcementRequest {
  return createEnforcementRequest({
    id: input.id,
    receivedAt: '2026-04-18T08:01:00.000Z',
    enforcementPoint: {
      environment: 'test',
      enforcementPointId: `${input.id}-pep`,
      pointKind: input.pointKind ?? 'application-middleware',
      boundaryKind: input.boundaryKind ?? 'http-request',
      consequenceType: input.consequenceType ?? 'decision-support',
      riskClass: input.riskClass ?? 'R1',
      tenantId: 'tenant-test',
      accountId: 'acct-test',
      workloadId: 'spiffe://attestor/tests/offline-verifier',
      audience: input.targetId,
    },
    targetId: input.targetId,
    outputHash: input.outputHash ?? 'sha256:output',
    consequenceHash: input.consequenceHash ?? 'sha256:consequence',
    releaseTokenId: input.releaseTokenId,
    releaseDecisionId: input.releaseDecisionId,
    transport: {
      kind: 'http',
      method: 'POST',
      uri: `https://attestor.test/${input.id}`,
      headersDigest: 'sha256:headers',
      bodyDigest: 'sha256:body',
    },
  });
}

function bearerPresentation(input: {
  readonly token: string;
  readonly tokenId: string;
  readonly decisionId: string;
  readonly issuer?: string;
  readonly subject?: string;
  readonly audience?: string;
  readonly expiresAt?: string;
  readonly digest?: string;
}): ReleasePresentation {
  return createReleasePresentation({
    mode: 'bearer-release-token',
    presentedAt: '2026-04-18T08:01:00.000Z',
    releaseToken: input.token,
    releaseTokenId: input.tokenId,
    releaseTokenDigest: input.digest ?? tokenDigest(input.token),
    issuer: input.issuer ?? 'attestor.release.local',
    subject: input.subject ?? `releaseDecision:${input.decisionId}`,
    audience: input.audience,
    expiresAt: input.expiresAt,
  });
}

async function setupIssuer() {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  return {
    issuer,
    verificationKey: await issuer.exportVerificationKey(),
  };
}

async function testLowRiskOfflineAllow(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-low-risk',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_low_risk',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-low-risk',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'analytics.memo.preview',
      expiresAt: issued.expiresAt,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyHash: POLICY_HASH,
      policyVersion: POLICY_VERSION,
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
      policyContext: expectedPolicyContext(),
    },
    replayLedgerEntry: null,
  });

  equal(verified.version, OFFLINE_RELEASE_VERIFIER_SPEC_VERSION, 'Offline verifier: result stamps stable spec version');
  equal(verified.status, 'valid', 'Offline verifier: low-risk token can be fully accepted offline');
  equal(verified.offlineVerified, true, 'Offline verifier: local signature and binding verification succeeded');
  equal(verified.requiresOnlineIntrospection, false, 'Offline verifier: R1 HTTP profile does not require online introspection');
  deepEqual(verified.failureReasons, [], 'Offline verifier: valid low-risk verification has no failure reasons');
  equal(verified.claims?.jti, 'rt_low_risk', 'Offline verifier: verified claims preserve token id');
  equal(verified.claims?.aud, 'analytics.memo.preview', 'Offline verifier: verified claims preserve target audience');
  equal(verified.verificationResult.status, 'valid', 'Offline verifier: object-model verification result is valid');
  equal(verified.verificationResult.releaseTokenId, 'rt_low_risk', 'Offline verifier: verification result binds token id');
  equal(verified.verificationResult.outputHash, 'sha256:output', 'Offline verifier: verification result carries output hash');
  equal(verified.verificationResult.policyVersion, POLICY_VERSION, 'Offline verifier: verification result carries policy version');
  equal(verified.verificationResult.policyIrHash, POLICY_IR_HASH, 'Offline verifier: verification result carries compiled policy IR hash');
  equal(verified.verificationResult.compiledPolicyIndexVersion, COMPILED_POLICY_INDEX_VERSION, 'Offline verifier: verification result carries compiled policy index version');
  deepEqual(
    verified.verificationResult.policyContext,
    {
      policyHash: POLICY_HASH,
      policyVersion: POLICY_VERSION,
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    'Offline verifier: verification result exposes structured policy context',
  );
}

async function testHighRiskNeedsOnline(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-r4-record',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_r4_record',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const request = makeRequest({
    id: 'erq-r4-record',
    targetId: 'finance.reporting.record-store',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    consequenceType: 'record',
    riskClass: 'R4',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });
  const profile = resolveVerificationProfile({
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
  });
  const presentation = createReleasePresentation({
    mode: 'mtls-bound-token',
    presentedAt: '2026-04-18T08:01:00.000Z',
    releaseToken: issued.token,
    releaseTokenId: issued.tokenId,
    releaseTokenDigest: tokenDigest(issued.token),
    issuer: 'attestor.release.local',
    subject: `releaseDecision:${decision.id}`,
    audience: 'finance.reporting.record-store',
    expiresAt: issued.expiresAt,
    proof: {
      kind: 'mtls',
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      subjectDn: 'CN=finance-writer',
      spiffeId: WORKLOAD_SPIFFE_ID,
    },
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    profile,
    now: '2026-04-18T08:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
  });

  equal(verified.status, 'indeterminate', 'Offline verifier: high-risk token remains indeterminate until online liveness');
  equal(verified.offlineVerified, true, 'Offline verifier: high-risk signature and binding checks still pass locally');
  equal(verified.requiresOnlineIntrospection, true, 'Offline verifier: R4 record-write requires online introspection');
  deepEqual(verified.failureReasons, ['fresh-introspection-required'], 'Offline verifier: only missing online liveness remains');
  equal(verified.verificationResult.status, 'indeterminate', 'Offline verifier: verification result records indeterminate status');
  equal(verified.freshness?.status, 'indeterminate', 'Offline verifier: freshness evaluator records missing online state');
}

async function testRequiredSenderConstraintRejectsBearer(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-r4-bearer-sender-required',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_r4_bearer_sender_required',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const request = makeRequest({
    id: 'erq-r4-bearer-sender-required',
    targetId: 'finance.reporting.record-store',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    consequenceType: 'record',
    riskClass: 'R4',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'finance.reporting.record-store',
      expiresAt: issued.expiresAt,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: required sender constraint rejects bearer presentation');
  deepEqual(verified.failureReasons, ['binding-mismatch'], 'Offline verifier: required sender constraint maps bearer to binding mismatch');
  equal(verified.claims, null, 'Offline verifier: bearer presentation does not expose high-risk token claims when sender proof is required');
}

async function testMissingReplayLedgerLookupFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-missing-replay-ledger',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_missing_replay_ledger',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-missing-replay-ledger',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'analytics.memo.preview',
      expiresAt: issued.expiresAt,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyHash: POLICY_HASH,
    },
  });

  equal(verified.status, 'invalid', 'Offline verifier: omitted replay ledger lookup fails closed');
  deepEqual(verified.failureReasons, ['missing-replay-proof'], 'Offline verifier: missing replay lookup is explicit');
}

async function testAudienceMismatchFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-audience',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_audience',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-audience',
    targetId: 'another.target',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'analytics.memo.preview',
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: target audience mismatch is invalid');
  deepEqual(verified.failureReasons, ['wrong-audience'], 'Offline verifier: audience mismatch is explicit');
  equal(verified.verificationResult.status, 'invalid', 'Offline verifier: invalid audience flows into verification result');
}

async function testRequestTenantIsCheckedByDefault(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-tenant',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_tenant_mismatch',
    tenantId: 'tenant-other',
  });
  const request = makeRequest({
    id: 'erq-tenant',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const mismatch = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'analytics.memo.preview',
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    replayLedgerEntry: null,
  });

  equal(mismatch.status, 'invalid', 'Offline verifier: request tenant mismatch is invalid by default');
  deepEqual(mismatch.failureReasons, ['binding-mismatch'], 'Offline verifier: tenant mismatch maps to binding mismatch');
  equal(mismatch.tenantBinding.expectedTenantId, 'tenant-test', 'Offline verifier: request tenant is the default expected tenant');
  equal(mismatch.tenantBinding.expectedSource, 'request-enforcement-point', 'Offline verifier: tenant expectation source is visible');
  equal(mismatch.tenantBinding.claimsTenantId, 'tenant-other', 'Offline verifier: tenant binding records token tenant');
  equal(mismatch.tenantBinding.checked, true, 'Offline verifier: tenant binding was checked');
  equal(mismatch.tenantBinding.matched, false, 'Offline verifier: tenant binding mismatch is visible');

  const explicitTenantless = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      audience: 'analytics.memo.preview',
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      tenantId: null,
    },
    replayLedgerEntry: null,
  });

  equal(explicitTenantless.status, 'valid', 'Offline verifier: explicit tenantless verification can opt out');
  equal(explicitTenantless.tenantBinding.expectedTenantId, null, 'Offline verifier: explicit tenantless expected tenant is null');
  equal(explicitTenantless.tenantBinding.expectedSource, 'tenantless-explicit', 'Offline verifier: explicit tenantless source is visible');
  equal(explicitTenantless.tenantBinding.checked, false, 'Offline verifier: explicit tenantless verification skips tenant check visibly');
  equal(explicitTenantless.tenantBinding.matched, null, 'Offline verifier: skipped tenant check has no match value');
}

async function testOutputAndConsequenceBindingMismatchFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-binding',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_binding',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-binding',
    targetId: 'analytics.memo.preview',
    outputHash: 'sha256:other-output',
    consequenceHash: 'sha256:other-consequence',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: output/consequence hash mismatch is invalid');
  deepEqual(verified.failureReasons, ['binding-mismatch'], 'Offline verifier: hash mismatch is represented as binding mismatch');
}

async function testConsequenceAndRiskBindingMismatchFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-risk',
    consequenceType: 'decision-support',
    riskClass: 'R4',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_risk',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-risk',
    targetId: 'analytics.memo.preview',
    boundaryKind: 'http-request',
    pointKind: 'application-middleware',
    consequenceType: 'communication',
    riskClass: 'R1',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: wrong consequence and risk binding is invalid');
  ok(verified.failureReasons.includes('wrong-consequence'), 'Offline verifier: consequence mismatch is explicit');
  ok(verified.failureReasons.includes('binding-mismatch'), 'Offline verifier: risk mismatch is treated as binding mismatch');
}

async function testPolicyAndDigestBindingMismatchFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-policy',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_policy',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-policy',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
      digest: 'sha256:not-the-token',
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyHash: 'sha256:other-policy',
    },
  });

  equal(verified.status, 'invalid', 'Offline verifier: policy and presentation digest mismatch is invalid');
  deepEqual(verified.failureReasons, ['binding-mismatch'], 'Offline verifier: policy/digest mismatch is a binding mismatch');
}

async function testPolicyIrBindingMismatchFailsAsStalePolicy(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-policy-ir',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_policy_ir',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-policy-ir',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyIrHash: 'sha256:other-policy-ir',
    },
    replayLedgerEntry: null,
  });

  equal(verified.status, 'invalid', 'Offline verifier: policy IR hash mismatch is invalid');
  deepEqual(verified.failureReasons, ['stale-policy'], 'Offline verifier: policy IR mismatch maps to stale policy');

  const staleCompiledIndex = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyHash: POLICY_HASH,
      policyVersion: POLICY_VERSION,
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: 'attestor.policy-index.wrong.v1',
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    replayLedgerEntry: null,
  });

  equal(staleCompiledIndex.status, 'invalid', 'Offline verifier: compiled policy index mismatch is invalid');
  deepEqual(staleCompiledIndex.failureReasons, ['stale-policy'], 'Offline verifier: compiled policy index mismatch maps to stale policy');

  const stalePolicyContext = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    expected: {
      policyContext: {
        ...expectedPolicyContext(),
        policyIrHash: 'sha256:other-policy-context-ir',
      },
    },
    replayLedgerEntry: null,
  });

  equal(stalePolicyContext.status, 'invalid', 'Offline verifier: structured policy context mismatch is invalid');
  deepEqual(stalePolicyContext.failureReasons, ['stale-policy'], 'Offline verifier: structured policy context mismatch maps to stale policy');
}

async function testRequiredPolicyProvenanceMissingFailsClosed(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-r4-missing-policy-provenance',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
    includePolicyProvenance: false,
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_r4_missing_policy_provenance',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const request = makeRequest({
    id: 'erq-r4-missing-policy-provenance',
    targetId: 'finance.reporting.record-store',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    consequenceType: 'record',
    riskClass: 'R4',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });
  const presentation = createReleasePresentation({
    mode: 'mtls-bound-token',
    presentedAt: '2026-04-18T08:01:00.000Z',
    releaseToken: issued.token,
    releaseTokenId: issued.tokenId,
    releaseTokenDigest: tokenDigest(issued.token),
    issuer: 'attestor.release.local',
    subject: `releaseDecision:${decision.id}`,
    audience: 'finance.reporting.record-store',
    expiresAt: issued.expiresAt,
    proof: {
      kind: 'mtls',
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      subjectDn: 'CN=finance-writer',
      spiffeId: WORKLOAD_SPIFFE_ID,
    },
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
  });

  equal(verified.status, 'invalid', 'Offline verifier: required compiled policy provenance fails closed when missing');
  ok(verified.failureReasons.includes('stale-policy'), 'Offline verifier: missing required policy provenance is stale policy');
  equal(verified.verificationResult.policyIrHash, null, 'Offline verifier: missing policy provenance leaves no policy IR hash');
}

async function testReplayLedgerHitFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-replay',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_replay',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-replay',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
    replayLedgerEntry: {
      subjectKind: 'release-token',
      key: 'release-token:rt_replay',
      firstSeenAt: '2026-04-18T08:00:30.000Z',
      expiresAt: '2026-04-18T08:03:00.000Z',
    },
  });

  equal(verified.status, 'invalid', 'Offline verifier: replay ledger hit fails closed');
  deepEqual(verified.failureReasons, ['replayed-authorization'], 'Offline verifier: replay failure is explicit');
  equal(verified.freshness?.replay.status, 'replayed', 'Offline verifier: replay evaluator records replayed status');
}

async function testExpiredTokenFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-expired',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_expired',
    tenantId: 'tenant-test',
    ttlSeconds: 60,
  });
  const request = makeRequest({
    id: 'erq-expired',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey,
    now: '2026-04-18T08:02:30.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: expired release token is invalid');
  deepEqual(verified.failureReasons, ['expired-authorization'], 'Offline verifier: expired token maps to expiry reason');
  equal(verified.claims, null, 'Offline verifier: expired token does not expose trusted claims');
}

async function testWrongVerificationKeyFails(): Promise<void> {
  const { issuer } = await setupIssuer();
  const other = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-wrong-key',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_wrong_key',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-wrong-key',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({
      token: issued.token,
      tokenId: issued.tokenId,
      decisionId: decision.id,
    }),
    verificationKey: other.verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: wrong verification key is invalid');
  deepEqual(verified.failureReasons, ['invalid-signature'], 'Offline verifier: wrong key maps to invalid signature');
  equal(verified.tokenVerification, null, 'Offline verifier: invalid signature does not expose token verification');
}

async function testMissingTokenFails(): Promise<void> {
  const { verificationKey } = await setupIssuer();
  const request = makeRequest({
    id: 'erq-missing-token',
    targetId: 'analytics.memo.preview',
  });
  const presentation = createReleasePresentation({
    mode: 'bearer-release-token',
    presentedAt: '2026-04-18T08:01:00.000Z',
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: missing release token is invalid');
  deepEqual(verified.failureReasons, ['missing-release-authorization'], 'Offline verifier: missing token is explicit');
  equal(verified.verificationResult.releaseTokenId, null, 'Offline verifier: missing token verification result has no token id');
}

async function testDisallowedPresentationModeFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-mode',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T08:00:00.000Z',
    tokenId: 'rt_mode',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-mode',
    targetId: 'finance.reporting.record-store',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    consequenceType: 'record',
    riskClass: 'R4',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });
  const presentation = createReleasePresentation({
    mode: 'http-message-signature',
    presentedAt: '2026-04-18T08:01:00.000Z',
    releaseToken: issued.token,
    releaseTokenId: issued.tokenId,
    releaseTokenDigest: tokenDigest(issued.token),
    proof: {
      kind: 'http-message-signature',
      signatureInput: '("@method" "@target-uri");created=1776499260',
      signature: 'base64:signature',
      keyId: 'key-1',
      coveredComponents: ['@method', '@target-uri'],
      createdAt: '2026-04-18T08:01:00.000Z',
      expiresAt: '2026-04-18T08:02:00.000Z',
      nonce: 'nonce-1',
    },
  });

  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation,
    verificationKey,
    now: '2026-04-18T08:01:00.000Z',
  });

  equal(verified.status, 'invalid', 'Offline verifier: disallowed presentation mode is invalid');
  deepEqual(verified.failureReasons, ['binding-mismatch'], 'Offline verifier: disallowed mode maps to binding mismatch');
  equal(verified.claims, null, 'Offline verifier: disallowed mode short-circuits before trusting token claims');
}

async function main(): Promise<void> {
  await testLowRiskOfflineAllow();
  await testHighRiskNeedsOnline();
  await testRequiredSenderConstraintRejectsBearer();
  await testMissingReplayLedgerLookupFails();
  await testAudienceMismatchFails();
  await testRequestTenantIsCheckedByDefault();
  await testOutputAndConsequenceBindingMismatchFails();
  await testConsequenceAndRiskBindingMismatchFails();
  await testPolicyAndDigestBindingMismatchFails();
  await testPolicyIrBindingMismatchFailsAsStalePolicy();
  await testRequiredPolicyProvenanceMissingFailsClosed();
  await testReplayLedgerHitFails();
  await testExpiredTokenFails();
  await testWrongVerificationKeyFails();
  await testMissingTokenFails();
  await testDisallowedPresentationModeFails();

  console.log(`Release enforcement-plane offline-verifier tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane offline-verifier tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
