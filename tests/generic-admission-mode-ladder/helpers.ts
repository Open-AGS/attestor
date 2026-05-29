import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  GENERIC_ADMISSION_MODES,
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createDecisionLineageGraph,
  createGenericAdmissionEnvelope,
  consequenceAdmissionDescriptor,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageGraphRecord,
} from '../../src/consequence-admission/index.js';

export {
  GENERIC_ADMISSION_MODES,
  createGenericAdmissionEnvelope,
  consequenceAdmissionDescriptor,
};
export { assert };

let passed = 0;

export function getPassedCount(): number {
  return passed;
}

export function markPassed(): void {
  passed += 1;
}

export function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

export function sha(seed: string): string {
  return `sha256:${createHash('sha256').update(seed).digest('hex')}`;
}

const authorityCreepTenantDigest = sha('tenant:generic-authority-creep');
const authorityCreepScopeDigest = sha('scope:generic-authority-creep');
export const authorityCreepActorDigest = sha('actor:generic-authority-creep');
const authorityCreepTransitionDigest = sha('transition:generic-authority-creep');

export function trustedApprovals(): readonly Record<string, string | boolean>[] {
  return [{
    approvalRef: 'approval:refund:987',
    sourceKind: 'approval-workflow',
    state: 'approved',
    sourceRef: 'workflow:refund-approval:987',
    reviewerRef: 'reviewer:risk-owner',
    reviewerAuthorityDigest: digest('b'),
    approvalDigest: digest('c'),
    scopeDigest: digest('d'),
    issuedAt: '2026-05-01T17:00:00.000Z',
    expiresAt: '2026-05-01T19:00:00.000Z',
    signatureVerified: true,
  }];
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  markPassed();
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  markPassed();
}

export function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  markPassed();
}

export function baseMoneyAdmission(mode: string) {
  return {
    mode,
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:00:00.000Z',
    decidedAt: '2026-05-01T17:00:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: [
      {
        sourceKind: 'verified-approval',
        claimKind: 'approval',
        sourceRef: 'approval:refund:987',
        evidenceDigest: `sha256:${'a'.repeat(64)}`,
      },
    ],
    approvals: trustedApprovals(),
    policyRef: 'policy:refunds:v1',
  };
}

export function authorityCreepLineageGraph(
  artifacts: readonly DecisionLineageArtifactRefInput[] = [],
): DecisionLineageGraphRecord {
  const claim = createAssuranceCaseNode({
    nodeId: 'claim:generic-authority-bounded',
    kind: 'claim',
    title: 'Generic admission authority remains bounded',
    bodyDigest: sha('claim:generic-authority-creep'),
    tenantRefDigest: authorityCreepTenantDigest,
    scopeDigest: authorityCreepScopeDigest,
    createdByRefDigest: authorityCreepActorDigest,
    createdAt: '2026-05-01T16:58:00.000Z',
  });
  const evidence = createAssuranceCaseNode({
    nodeId: 'evidence:generic-runtime-lineage',
    kind: 'evidence',
    title: 'Generic admission runtime lineage evidence',
    bodyDigest: sha('evidence:generic-authority-creep'),
    tenantRefDigest: authorityCreepTenantDigest,
    scopeDigest: authorityCreepScopeDigest,
    createdByRefDigest: authorityCreepActorDigest,
    createdAt: '2026-05-01T16:58:01.000Z',
  });
  const assuranceCase = createAssuranceCaseContract({
    caseId: 'case:generic-authority-creep',
    tenantRefDigest: authorityCreepTenantDigest,
    rootClaimId: claim.nodeId,
    createdAt: '2026-05-01T16:58:00.000Z',
    lastReviewedAt: '2026-05-01T16:59:00.000Z',
    nodes: [claim, evidence],
    defeaters: [],
    transitions: [
      createAssuranceCaseTransition({
        transitionId: 'transition:generic-authority-claim',
        transitionKind: 'create-node',
        actorRefDigest: authorityCreepActorDigest,
        occurredAt: '2026-05-01T16:58:02.000Z',
        reasonDigest: authorityCreepTransitionDigest,
        nodeId: claim.nodeId,
        evidenceRefDigest: claim.digest,
      }),
      createAssuranceCaseTransition({
        transitionId: 'transition:generic-authority-evidence',
        transitionKind: 'create-node',
        actorRefDigest: authorityCreepActorDigest,
        occurredAt: '2026-05-01T16:58:03.000Z',
        reasonDigest: authorityCreepTransitionDigest,
        nodeId: evidence.nodeId,
        evidenceRefDigest: evidence.digest,
      }),
    ],
  });
  return createDecisionLineageGraph({
    assuranceCase,
    lineageId: 'lineage:generic-authority-creep',
    generatedAt: '2026-05-01T16:59:30.000Z',
    builderRefDigest: authorityCreepActorDigest,
    artifactRefs: artifacts,
  });
}

export function authorityCreepMeasurementArtifact(
  targetNodeId: string,
): DecisionLineageArtifactRefInput {
  return {
    artifactId: 'artifact:generic-measurement-plane',
    artifactKind: 'measurement-plane-record',
    artifactDigest: sha('artifact:generic-measurement-plane'),
    sourceVersion: 'attestor.assurance-measurement-plane.v1',
    producedAt: '2026-05-01T16:59:20.000Z',
    producerRefDigest: authorityCreepActorDigest,
    targetNodeId,
  };
}

export function cleanAuthorityCreepMetadata(): Record<string, unknown> {
  return {
    lineageGraph: authorityCreepLineageGraph(),
    evaluatorRefDigest: authorityCreepActorDigest,
  };
}
