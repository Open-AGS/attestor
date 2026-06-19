import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import type { ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
} from '../src/release-kernel/release-token.js';
import type { ActiveReleaseTokenIntrospectionResult } from '../src/release-kernel/release-introspection.js';
import {
  createEnforcementRequest,
  createReleasePresentation,
  type EnforcementRequest,
  type ReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';

let passed = 0;

export function passedCount(): number {
  return passed;
}

export const WORKLOAD_CERT_THUMBPRINT = 'cert-thumbprint';
export const WORKLOAD_SPIFFE_ID = 'spiffe://attestor/tests/finance-writer';
export const POLICY_HASH = 'sha256:policy';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';

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

function tokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function policyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-online-test',
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
    createdAt: '2026-04-18T09:00:00.000Z',
    status: 'accepted',
    policyVersion: 'policy.release-online-test.v1',
    policyHash: POLICY_HASH,
    policyProvenance: policyProvenance(),
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'release-online-test.artifact',
      expectedShape: 'deterministic test artifact',
      consequenceType: input.consequenceType,
      riskClass: input.riskClass,
    },
    capabilityBoundary: {
      allowedTools: ['release-online-test-tool'],
      allowedTargets: [input.targetId],
      allowedDataDomains: ['release-online-test'],
    },
    requester: {
      id: 'svc.release-online-test',
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
  readonly consequenceType?: 'record' | 'decision-support';
  readonly riskClass?: 'R1' | 'R4';
  readonly boundaryKind?: 'http-request' | 'record-write';
  readonly pointKind?: 'application-middleware' | 'record-write-gateway';
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
}): EnforcementRequest {
  return createEnforcementRequest({
    id: input.id,
    receivedAt: '2026-04-18T09:01:00.000Z',
    enforcementPoint: {
      environment: 'test',
      enforcementPointId: `${input.id}-pep`,
      pointKind: input.pointKind ?? 'application-middleware',
      boundaryKind: input.boundaryKind ?? 'http-request',
      consequenceType: input.consequenceType ?? 'decision-support',
      riskClass: input.riskClass ?? 'R1',
      tenantId: 'tenant-test',
      accountId: 'acct-test',
      workloadId: 'spiffe://attestor/tests/online-verifier',
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

export function bearerPresentation(input: {
  readonly issued: IssuedReleaseToken;
  readonly decisionId: string;
  readonly audience?: string;
}): ReleasePresentation {
  return createReleasePresentation({
    mode: 'bearer-release-token',
    presentedAt: '2026-04-18T09:01:00.000Z',
    releaseToken: input.issued.token,
    releaseTokenId: input.issued.tokenId,
    releaseTokenDigest: tokenDigest(input.issued.token),
    issuer: 'attestor.release.local',
    subject: `releaseDecision:${input.decisionId}`,
    audience: input.audience ?? input.issued.claims.aud,
    expiresAt: input.issued.expiresAt,
  });
}

export function mtlsPresentation(input: {
  readonly issued: IssuedReleaseToken;
  readonly decisionId: string;
}): ReleasePresentation {
  return createReleasePresentation({
    mode: 'mtls-bound-token',
    presentedAt: '2026-04-18T09:01:00.000Z',
    releaseToken: input.issued.token,
    releaseTokenId: input.issued.tokenId,
    releaseTokenDigest: tokenDigest(input.issued.token),
    issuer: 'attestor.release.local',
    subject: `releaseDecision:${input.decisionId}`,
    audience: input.issued.claims.aud,
    expiresAt: input.issued.expiresAt,
    proof: {
      kind: 'mtls',
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      subjectDn: 'CN=finance-writer',
      spiffeId: WORKLOAD_SPIFFE_ID,
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

export function activeIntrospectionFromIssued(
  issued: IssuedReleaseToken,
  overrides: Partial<ActiveReleaseTokenIntrospectionResult> = {},
): ActiveReleaseTokenIntrospectionResult {
  return {
    version: 'attestor.release-introspection.v2',
    active: true,
    token_type: 'attestor_release_token',
    checked_at: '2026-04-18T09:01:00.000Z',
    resource_server_id: 'erq-mismatch-pep',
    scope: `release:${issued.claims.consequence_type}`,
    iss: issued.claims.iss,
    sub: issued.claims.sub,
    aud: issued.claims.aud,
    jti: issued.claims.jti,
    iat: issued.claims.iat,
    nbf: issued.claims.nbf,
    exp: issued.claims.exp,
    decision_id: issued.claims.decision_id,
    decision: issued.claims.decision,
    consequence_type: issued.claims.consequence_type,
    risk_class: issued.claims.risk_class,
    output_hash: issued.claims.output_hash,
    consequence_hash: issued.claims.consequence_hash,
    policy_hash: issued.claims.policy_hash,
    ...(issued.claims.policy_version ? { policy_version: issued.claims.policy_version } : {}),
    ...(issued.claims.policy_ir_hash ? { policy_ir_hash: issued.claims.policy_ir_hash } : {}),
    ...(issued.claims.policy_provenance_source
      ? { policy_provenance_source: issued.claims.policy_provenance_source }
      : {}),
    ...(issued.claims.compiled_policy_index_version
      ? { compiled_policy_index_version: issued.claims.compiled_policy_index_version }
      : {}),
    ...(issued.claims.compiled_policy_ir_version
      ? { compiled_policy_ir_version: issued.claims.compiled_policy_ir_version }
      : {}),
    token_policy: tokenPolicyFromIssued(issued),
    override: issued.claims.override,
    authority_mode: issued.claims.authority_mode,
    introspection_required: issued.claims.introspection_required,
    ...overrides,
  };
}

export function tokenPolicyFromIssued(
  issued: IssuedReleaseToken,
): ActiveReleaseTokenIntrospectionResult['token_policy'] {
  return {
    policy_hash: issued.claims.policy_hash,
    ...(issued.claims.policy_version ? { policy_version: issued.claims.policy_version } : {}),
    ...(issued.claims.policy_ir_hash ? { policy_ir_hash: issued.claims.policy_ir_hash } : {}),
    ...(issued.claims.policy_provenance_source
      ? { policy_provenance_source: issued.claims.policy_provenance_source }
      : {}),
    ...(issued.claims.compiled_policy_index_version
      ? { compiled_policy_index_version: issued.claims.compiled_policy_index_version }
      : {}),
    ...(issued.claims.compiled_policy_ir_version
      ? { compiled_policy_ir_version: issued.claims.compiled_policy_ir_version }
      : {}),
  };
}
