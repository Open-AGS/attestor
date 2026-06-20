import assert from 'node:assert/strict';
import {
  CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION,
  completeConsequenceAdmissionAccessRequestTask,
  createConsequenceAdmissionAccessRequestReevaluationContext,
  createConsequenceAdmissionAccessRequestTask,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionRequestableDenial,
  createConsequenceAdmissionResponse,
  type ConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function proofFixture() {
  return {
    kind: 'release-token' as const,
    id: 'release-token:fixture',
    digest: `sha256:${'a'.repeat(64)}`,
    uri: null,
    verifyHint: 'Verify with the release-enforcement plane.',
  };
}

function admissionFixture(decision: 'admit' | 'review' | 'block'): ConsequenceAdmissionResponse {
  const request = createConsequenceAdmissionRequest({
    requestedAt: '2026-06-18T10:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'generic-admission',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: 'support-ai-agent',
      action: 'issue_refund',
      downstreamSystem: 'refund-service',
      consequenceKind: 'transfer',
      riskClass: 'R3',
      summary: 'Refund requires fresh approval before execution.',
    },
    policyScope: {
      policyRef: 'policy:refunds:v1',
      tenantId: 'tenant_requestable_denial',
      environment: 'production',
      dimensions: {
        domain: 'money-movement',
      },
    },
    authority: {
      actorRef: 'service:support-ai-agent',
      authorityMode: 'single-reviewer',
    },
    evidence: [],
    nativeInputRefs: [],
  });

  return createConsequenceAdmissionResponse({
    request,
    decidedAt: '2026-06-18T10:00:01.000Z',
    decision,
    reason: decision === 'admit'
      ? 'The action is allowed for the fixture.'
      : 'Approval is required before this consequence can execute.',
    reasonCodes: decision === 'admit' ? ['fixture-admit'] : ['approval-required'],
    checks: [
      createConsequenceAdmissionCheck({
        kind: 'authority',
        label: 'authority check',
        outcome: decision === 'admit' ? 'pass' : 'warn',
        required: true,
        summary: decision === 'admit'
          ? 'Authority is present.'
          : 'Authority needs approval.',
        reasonCodes: decision === 'admit'
          ? ['authority-present']
          : ['approval-required'],
        evidenceRefs: [],
      }),
    ],
    proof: decision === 'admit' ? [proofFixture()] : [],
  });
}

function requestableDenialFixture() {
  return createConsequenceAdmissionRequestableDenial({
    admission: admissionFixture('review'),
    reason: 'approval-required',
    template: 'manager_approval',
    expiresAt: '2026-06-18T10:10:00.000Z',
    catalogRefs: ['catalog:manager-approval:v1', 'catalog:manager-approval:v1'],
  });
}

function testRequestableDenialIsNotAccessGrant(): void {
  const denial = requestableDenialFixture();
  const serialized = JSON.stringify(denial);

  equal(
    denial.version,
    CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION,
    'Access request approval: version is stable',
  );
  equal(denial.requestable, true, 'Access request approval: denial is explicitly requestable');
  equal(denial.approvalDoesNotPermitAccess, true, 'Access request approval: approval is not access');
  equal(denial.releaseTokenMayBeIssued, false, 'Access request approval: denial cannot issue release token');
  equal(denial.requiresReevaluation, true, 'Access request approval: denial requires re-evaluation');
  equal(denial.rawPayloadStored, false, 'Access request approval: denial stores no raw payload');
  equal(denial.catalogRefs.length, 1, 'Access request approval: catalog refs are de-duplicated');
  ok(denial.binding.digest.startsWith('sha256:'), 'Access request approval: binding is digest-shaped');
  ok(!serialized.includes('support-ai-agent'), 'Access request approval: actor is digest-only in denial binding');
  ok(!serialized.includes('refund-service'), 'Access request approval: downstream system is digest-only in denial binding');
  ok(!serialized.includes('policy:refunds:v1'), 'Access request approval: policy ref is digest-only in denial binding');
}

function testAllowedAdmissionCannotBecomeRequestableDenial(): void {
  throws(
    () =>
      createConsequenceAdmissionRequestableDenial({
        admission: admissionFixture('admit'),
        reason: 'approval-required',
        template: 'manager_approval',
        expiresAt: '2026-06-18T10:10:00.000Z',
      }),
    /requires a review or block decision/u,
    'Access request approval: admitted response cannot become requestable denial',
  );
}

function testApprovalTaskStillRequiresReevaluation(): void {
  const denial = requestableDenialFixture();
  const task = createConsequenceAdmissionAccessRequestTask({
    denial,
    taskId: 'arq_refund_001',
    createdAt: '2026-06-18T10:00:02.000Z',
    statusEndpoint: 'https://attestor.example/access/v1/requests/arq_refund_001',
  });
  const approved = completeConsequenceAdmissionAccessRequestTask({
    task,
    status: 'approved',
    decidedAt: '2026-06-18T10:04:00.000Z',
    approval: {
      id: 'apr_refund_001',
      approvalRef: 'approval:manager:raw-refund-approval',
      approvedUntil: '2026-06-18T10:08:00.000Z',
      authorityKind: 'approval',
      scopeDigest: `sha256:${'b'.repeat(64)}`,
      approvalState: 'signed-approval-state-raw',
    },
  });
  const serialized = JSON.stringify(approved);
  const reevaluation = createConsequenceAdmissionAccessRequestReevaluationContext({
    task: approved,
    reevaluateAt: '2026-06-18T10:04:10.000Z',
  });

  equal(task.status, 'pending', 'Access request approval: created task starts pending');
  equal(task.accessPermitted, false, 'Access request approval: pending task does not permit access');
  equal(task.releaseTokenMayBeIssued, false, 'Access request approval: pending task cannot issue release token');
  equal(approved.status, 'approved', 'Access request approval: approval terminal state is recorded');
  equal(approved.result?.mode, 'reevaluate', 'Access request approval: approved result mode is re-evaluate');
  equal(approved.result?.accessPermitted, false, 'Access request approval: approved task still does not permit access');
  equal(approved.result?.releaseTokenMayBeIssued, false, 'Access request approval: approved task still cannot issue release token');
  equal(approved.result?.reevaluationRequired, true, 'Access request approval: approved task requires re-evaluation');
  equal(approved.result?.approval.rawApprovalStored, false, 'Access request approval: raw approval is not stored');
  ok(!serialized.includes('approval:manager:raw-refund-approval'), 'Access request approval: approval ref is digest-only');
  ok(!serialized.includes('signed-approval-state-raw'), 'Access request approval: approval state is digest-only');
  equal(
    reevaluation.releaseTokenMayBeIssuedBeforeReevaluation,
    false,
    'Access request approval: re-evaluation context forbids pre-evaluation release token',
  );
  equal(
    reevaluation.originalAdmissionDigest,
    denial.binding.originalAdmissionDigest,
    'Access request approval: re-evaluation context binds original admission digest',
  );
}

function testDeniedTaskDoesNotProduceReevaluationContext(): void {
  const task = createConsequenceAdmissionAccessRequestTask({
    denial: requestableDenialFixture(),
    taskId: 'arq_refund_002',
    createdAt: '2026-06-18T10:00:02.000Z',
  });
  const denied = completeConsequenceAdmissionAccessRequestTask({
    task,
    status: 'denied',
    decidedAt: '2026-06-18T10:04:00.000Z',
  });

  equal(denied.status, 'denied', 'Access request approval: denied task records terminal status');
  equal(denied.result, null, 'Access request approval: denied task has no approval result');
  throws(
    () =>
      createConsequenceAdmissionAccessRequestReevaluationContext({
        task: denied,
        reevaluateAt: '2026-06-18T10:04:10.000Z',
      }),
    /requires an approved access request task/u,
    'Access request approval: denied task cannot be used for re-evaluation',
  );
}

function testExpiredApprovalCannotReevaluate(): void {
  const task = createConsequenceAdmissionAccessRequestTask({
    denial: requestableDenialFixture(),
    taskId: 'arq_refund_003',
    createdAt: '2026-06-18T10:00:02.000Z',
  });
  const approved = completeConsequenceAdmissionAccessRequestTask({
    task,
    status: 'approved',
    decidedAt: '2026-06-18T10:04:00.000Z',
    approval: {
      id: 'apr_refund_003',
      approvedUntil: '2026-06-18T10:05:00.000Z',
      authorityKind: 'approval',
    },
  });

  throws(
    () =>
      createConsequenceAdmissionAccessRequestReevaluationContext({
        task: approved,
        reevaluateAt: '2026-06-18T10:05:01.000Z',
      }),
    /expired approval/u,
    'Access request approval: expired approval cannot support re-evaluation context',
  );
  throws(
    () =>
      createConsequenceAdmissionAccessRequestReevaluationContext({
        task: approved,
        reevaluateAt: '2026-06-18T10:05:00.000Z',
      }),
    /expired approval/u,
    'Access request approval: approval expiry boundary is exclusive',
  );
}

testRequestableDenialIsNotAccessGrant();
testAllowedAdmissionCannotBecomeRequestableDenial();
testApprovalTaskStillRequiresReevaluation();
testDeniedTaskDoesNotProduceReevaluationContext();
testExpiredApprovalCannotReevaluate();

console.log(`Consequence admission access-request approval tests: ${passed} passed, 0 failed`);
