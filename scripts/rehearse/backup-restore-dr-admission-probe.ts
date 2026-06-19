import {
  consequenceAdmissionAllowsConsequence,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
} from '../../src/consequence-admission/index.js';

export function buildAdmissionProbe(): {
  readonly admissionAllowed: boolean;
  readonly blockedFailClosed: boolean;
} {
  const requestedAt = new Date().toISOString();
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    packFamily: 'finance',
    entryPoint: {
      kind: 'hosted-route',
      id: 'post-restore-dr-probe',
      route: '/api/v1/pipeline/run',
      packageSubpath: null,
      sourceRef: 'production-rehearsal-step-08',
    },
    proposedConsequence: {
      actor: 'dr-rehearsal',
      action: 'write restored financial record',
      downstreamSystem: 'replacement-target',
      consequenceKind: 'record',
      riskClass: 'R4',
      summary: 'Post-restore admission probe',
    },
    policyScope: {
      policyRef: 'production-rehearsal/dr',
      tenantId: 'tenant-dr-rehearsal',
      environment: 'production-shared',
    },
    authority: {
      actorRef: 'operator:dr-rehearsal',
      reviewerRef: 'reviewer:dr-rehearsal',
      authorityMode: 'dual-control',
    },
    evidence: [{
      id: 'dr-restore-summary',
      kind: 'production-rehearsal-summary',
      digest: 'sha256:post-restore-dr-probe',
      uri: null,
    }],
  });
  const admitted = createConsequenceAdmissionResponse({
    request,
    decidedAt: new Date().toISOString(),
    decision: 'admit',
    reason: 'Post-restore admission probe is allowed.',
    reasonCodes: ['DR_RESTORE_PROBE_ALLOWED'],
    proof: [{
      kind: 'release-evidence-pack',
      id: 'dr-restore-proof-ref',
      digest: 'sha256:dr-restore-proof-ref',
      uri: null,
      verifyHint: 'Verify the restored rehearsal evidence pack against the promotion bundle.',
    }],
  });
  const blocked = createConsequenceAdmissionResponse({
    request,
    decidedAt: new Date().toISOString(),
    decision: 'block',
    reason: 'Post-restore negative admission probe blocks fail-closed.',
    reasonCodes: ['DR_RESTORE_PROBE_BLOCKED'],
    proof: [],
  });
  return {
    admissionAllowed: consequenceAdmissionAllowsConsequence(admitted.decision) && admitted.allowed,
    blockedFailClosed: !blocked.allowed && blocked.failClosed,
  };
}
