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

export function passedCount(): number { return passed; }

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export const POLICY_HASH = 'sha256:policy';
export const POLICY_VERSION = 'policy.release-offline-test.v1';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';
export const WORKLOAD_CERT_THUMBPRINT = 'cert-thumbprint';
export const WORKLOAD_SPIFFE_ID = 'spiffe://attestor/tests/finance-writer';

export function trustedWorkloadBinding() {
  return {
    expectedCertificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
    expectedSpiffeId: WORKLOAD_SPIFFE_ID,
    expectedTrustDomain: 'attestor',
  } as const;
}

export function expectedPolicyContext(): ReleaseEnforcementPolicyContext {
  return {
    policyHash: POLICY_HASH,
    policyVersion: POLICY_VERSION,
    policyIrHash: POLICY_IR_HASH,
    policyProvenanceSource: 'compiled-admission-policy-index',
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
  };
}

export function policyProvenance(input: {
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

export function makeDecision(input: {
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

export function makeRequest(input: {
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

export function bearerPresentation(input: {
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

export async function setupIssuer() {
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

export async function testLowRiskOfflineAllow(): Promise<void> {
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
