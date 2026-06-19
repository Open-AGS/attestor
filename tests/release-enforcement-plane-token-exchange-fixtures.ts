import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import type { ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
} from '../src/release-kernel/release-token.js';
import {
  createEnforcementRequest,
  createReleasePresentation,
  type EnforcementRequest,
  type ReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';

let passed = 0;

export const WORKLOAD_CERT_THUMBPRINT = 'cert-thumbprint';
export const WORKLOAD_SPIFFE_ID = 'spiffe://attestor/tests/finance-writer';
export const POLICY_HASH = 'sha256:policy';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const SOURCE_POLICY_VERSION = 'policy.release-token-exchange-test.v1';
export const EXCHANGED_POLICY_VERSION = 'attestor.release-token-exchange.derived-policy.v1';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';

export function passedCount(): number {
  return passed;
}

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

export function trustedWorkloadBinding() {
  return {
    expectedCertificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
    expectedSpiffeId: WORKLOAD_SPIFFE_ID,
    expectedTrustDomain: 'attestor',
  } as const;
}

export function trustedExchangeActor(actor: {
  readonly id: string;
  readonly type: 'human' | 'service' | 'agent';
  readonly displayName?: string;
  readonly role?: string;
  readonly tokenSubject?: string;
}) {
  return {
    ...actor,
    proofSource: 'trusted-exchange-gateway',
    proofId: `proof:${actor.id}`,
  } as const;
}

export function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export function expectedExchangedPolicyContext() {
  return {
    policyHash: POLICY_HASH,
    policyVersion: EXCHANGED_POLICY_VERSION,
    policyIrHash: POLICY_IR_HASH,
    policyProvenanceSource: 'compiled-admission-policy-index',
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
  } as const;
}

export function expectedExchangedTokenPolicy() {
  return {
    policy_hash: POLICY_HASH,
    policy_version: EXCHANGED_POLICY_VERSION,
    policy_ir_hash: POLICY_IR_HASH,
    policy_provenance_source: 'compiled-admission-policy-index',
    compiled_policy_index_version: COMPILED_POLICY_INDEX_VERSION,
    compiled_policy_ir_version: COMPILED_POLICY_IR_VERSION,
  } as const;
}

function policyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-token-exchange-test',
    policySpecVersion: 'attestor.release-policy.v1',
    policyHash: POLICY_HASH,
    compiledPolicyHash: POLICY_HASH,
    compiledPolicyIrHash: POLICY_IR_HASH,
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

export function makeDecision(input: {
  readonly id: string;
  readonly consequenceType: 'record' | 'decision-support';
  readonly riskClass: 'R1' | 'R4';
  readonly targetId: string;
}) {
  return createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: '2026-04-18T10:00:00.000Z',
    status: 'accepted',
    policyVersion: SOURCE_POLICY_VERSION,
    policyHash: POLICY_HASH,
    policyProvenance: policyProvenance(),
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'release-token-exchange-test.artifact',
      expectedShape: 'deterministic test artifact',
      consequenceType: input.consequenceType,
      riskClass: input.riskClass,
    },
    capabilityBoundary: {
      allowedTools: ['release-token-exchange-test-tool'],
      allowedTargets: [input.targetId],
      allowedDataDomains: ['release-token-exchange-test'],
    },
    requester: {
      id: 'svc.release-token-exchange-test',
      type: 'service',
    },
    target: {
      kind: input.consequenceType === 'record' ? 'record-store' : 'endpoint',
      id: input.targetId,
    },
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

export function bearerPresentation(input: {
  readonly issued: IssuedReleaseToken;
  readonly presentedAt?: string;
}): ReleasePresentation {
  return createReleasePresentation({
    mode: 'bearer-release-token',
    presentedAt: input.presentedAt ?? '2026-04-18T10:01:00.000Z',
    releaseToken: input.issued.token,
    releaseTokenId: input.issued.tokenId,
    releaseTokenDigest: tokenDigest(input.issued.token),
    issuer: 'attestor.release.local',
    subject: input.issued.claims.sub,
    audience: input.issued.claims.aud,
    expiresAt: input.issued.expiresAt,
    scope: input.issued.claims.scope?.split(/\s+/) ?? [],
  });
}

export function mtlsPresentation(input: {
  readonly issued: IssuedReleaseToken;
}): ReleasePresentation {
  return createReleasePresentation({
    mode: 'mtls-bound-token',
    presentedAt: '2026-04-18T10:01:00.000Z',
    releaseToken: input.issued.token,
    releaseTokenId: input.issued.tokenId,
    releaseTokenDigest: tokenDigest(input.issued.token),
    issuer: 'attestor.release.local',
    subject: input.issued.claims.sub,
    audience: input.issued.claims.aud,
    expiresAt: input.issued.expiresAt,
    scope: input.issued.claims.scope?.split(/\s+/) ?? [],
    proof: {
      kind: 'mtls',
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      subjectDn: 'CN=finance-writer',
      spiffeId: WORKLOAD_SPIFFE_ID,
    },
  });
}

export function makeRequest(input: {
  readonly id: string;
  readonly targetId: string;
  readonly consequenceType?: 'record' | 'decision-support';
  readonly riskClass?: 'R1' | 'R4';
  readonly boundaryKind?: 'http-request' | 'record-write';
  readonly pointKind?: 'application-middleware' | 'record-write-gateway';
  readonly releaseTokenId: string;
  readonly releaseDecisionId: string;
}): EnforcementRequest {
  return createEnforcementRequest({
    id: input.id,
    receivedAt: '2026-04-18T10:01:00.000Z',
    enforcementPoint: {
      environment: 'test',
      enforcementPointId: `${input.id}-pep`,
      pointKind: input.pointKind ?? 'application-middleware',
      boundaryKind: input.boundaryKind ?? 'http-request',
      consequenceType: input.consequenceType ?? 'decision-support',
      riskClass: input.riskClass ?? 'R1',
      tenantId: 'tenant-test',
      accountId: 'acct-test',
      workloadId: 'spiffe://attestor/tests/token-exchange',
      audience: input.targetId,
    },
    targetId: input.targetId,
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
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
