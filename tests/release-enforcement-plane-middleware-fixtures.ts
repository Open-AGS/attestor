import assert from 'node:assert/strict';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import type { ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
  type ReleaseTokenVerificationKey,
} from '../src/release-kernel/release-token.js';
import type { ReleaseDecision } from '../src/release-kernel/object-model.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import type { CreateEnforcementPointReferenceInput } from '../src/release-enforcement-plane/types.js';
import {
  ATTESTOR_CONSEQUENCE_HASH_HEADER,
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_OUTPUT_HASH_HEADER,
  ATTESTOR_POLICY_HASH_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  ATTESTOR_RELEASE_DECISION_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_ID_HEADER,
  ATTESTOR_TARGET_ID_HEADER,
} from '../src/release-enforcement-plane/http-message-signatures.js';
import {
  ATTESTOR_IDEMPOTENCY_KEY_HEADER,
  type ReleaseEnforcementMiddlewareOptions,
} from '../src/release-enforcement-plane/middleware.js';

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
  assert.deepEqual(actual, expected);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp, message: string): void {
  assert.throws(fn, expected);
  passed += 1;
}

export const TARGET_ID = 'middleware.release.target';
export const OUTPUT_HASH = 'sha256:output';
export const CONSEQUENCE_HASH = 'sha256:consequence';
export const POLICY_HASH = 'sha256:policy';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';

export function policyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-middleware-test',
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
  readonly targetId?: string;
  readonly consequenceType?: 'decision-support' | 'communication' | 'action';
  readonly riskClass?: 'R1' | 'R3';
}) {
  const consequenceType = input.consequenceType ?? 'decision-support';
  return createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: '2026-04-18T15:00:00.000Z',
    status: 'accepted',
    policyVersion: 'policy.release-middleware-test.v1',
    policyHash: POLICY_HASH,
    policyProvenance: policyProvenance(),
    outputHash: OUTPUT_HASH,
    consequenceHash: CONSEQUENCE_HASH,
    outputContract: {
      artifactType: 'release-middleware-test.artifact',
      expectedShape: 'deterministic middleware test artifact',
      consequenceType,
      riskClass: input.riskClass ?? 'R1',
    },
    capabilityBoundary: {
      allowedTools: ['release-middleware-test-tool'],
      allowedTargets: [input.targetId ?? TARGET_ID],
      allowedDataDomains: ['release-middleware-test'],
    },
    requester: {
      id: 'svc.release-middleware-test',
      type: 'service',
    },
    target: {
      kind: consequenceType === 'action' ? 'workflow' : 'endpoint',
      id: input.targetId ?? TARGET_ID,
    },
  });
}

export function enforcementPoint(input: {
  readonly riskClass?: 'R1' | 'R3';
  readonly consequenceType?: 'decision-support' | 'communication' | 'action';
} = {}): CreateEnforcementPointReferenceInput {
  return {
    environment: 'test',
    enforcementPointId: 'middleware-pep',
    pointKind: 'application-middleware',
    boundaryKind: 'http-request',
    consequenceType: input.consequenceType ?? 'decision-support',
    riskClass: input.riskClass ?? 'R1',
    tenantId: 'tenant-test',
    accountId: 'acct-test',
    workloadId: 'spiffe://attestor/tests/middleware',
    audience: TARGET_ID,
  };
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

export async function issueToken(input: {
  readonly tokenId: string;
  readonly decisionId: string;
  readonly targetId?: string;
  readonly consequenceType?: 'decision-support' | 'communication' | 'action';
  readonly riskClass?: 'R1' | 'R3';
}): Promise<{
  readonly issued: IssuedReleaseToken;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly decision: ReleaseDecision;
}> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: input.decisionId,
    targetId: input.targetId,
    consequenceType: input.consequenceType,
    riskClass: input.riskClass,
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T15:00:00.000Z',
    tokenId: input.tokenId,
    tenantId: 'tenant-test',
  });
  return { issued, verificationKey, decision };
}

export function releaseHeaders(
  issued: IssuedReleaseToken,
  decision: ReleaseDecision,
  overrides: Record<string, string> = {},
): Headers {
  return new Headers({
    authorization: `Bearer ${issued.token}`,
    [ATTESTOR_RELEASE_TOKEN_ID_HEADER]: issued.tokenId,
    [ATTESTOR_RELEASE_DECISION_ID_HEADER]: decision.id,
    [ATTESTOR_TARGET_ID_HEADER]: decision.target.id,
    [ATTESTOR_OUTPUT_HASH_HEADER]: decision.outputHash,
    [ATTESTOR_CONSEQUENCE_HASH_HEADER]: decision.consequenceHash,
    [ATTESTOR_POLICY_HASH_HEADER]: decision.policyHash,
    [ATTESTOR_POLICY_VERSION_HEADER]: decision.policyVersion,
    [ATTESTOR_POLICY_IR_HASH_HEADER]: decision.policyProvenance?.compiledPolicyIrHash ?? POLICY_IR_HASH,
    [ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER]:
      decision.policyProvenance?.source ?? 'compiled-admission-policy-index',
    [ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER]:
      decision.policyProvenance?.compiledPolicyIndexVersion ?? COMPILED_POLICY_INDEX_VERSION,
    [ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER]:
      decision.policyProvenance?.compiledPolicyIrVersion ?? COMPILED_POLICY_IR_VERSION,
    [ATTESTOR_IDEMPOTENCY_KEY_HEADER]: 'idem-middleware-1',
    ...overrides,
  });
}

export function baseOptions(input: {
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly riskClass?: 'R1' | 'R3';
  readonly consequenceType?: 'decision-support' | 'communication' | 'action';
  readonly targetId?: string | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
}): ReleaseEnforcementMiddlewareOptions {
  return {
    verificationKey: input.verificationKey,
    enforcementPoint: enforcementPoint({
      riskClass: input.riskClass,
      consequenceType: input.consequenceType,
    }),
    targetId: input.targetId ?? TARGET_ID,
    outputHash: input.outputHash ?? OUTPUT_HASH,
    consequenceHash: input.consequenceHash ?? CONSEQUENCE_HASH,
    replayLedgerEntry: null,
    now: () => '2026-04-18T15:01:00.000Z',
  };
}

export function headerOnlyOptions(input: {
  readonly verificationKey: ReleaseTokenVerificationKey;
}): ReleaseEnforcementMiddlewareOptions {
  return {
    verificationKey: input.verificationKey,
    enforcementPoint: enforcementPoint(),
    replayLedgerEntry: null,
    now: () => '2026-04-18T15:01:00.000Z',
  };
}
