import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionRequestableDenial,
  createConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';
import {
  HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION,
  createFileBackedHostedGenericAdmissionAccessRequestStore,
} from '../src/service/hosted/hosted-generic-admission-access-request-store.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function requestableDenialFixture() {
  const request = createConsequenceAdmissionRequest({
    requestedAt: '2026-06-20T10:00:00.000Z',
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
      tenantId: 'tenant_store',
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
  const admission = createConsequenceAdmissionResponse({
    request,
    decidedAt: '2026-06-20T10:00:01.000Z',
    decision: 'review',
    reason: 'Approval is required before this consequence can execute.',
    reasonCodes: ['approval-missing', 'approval-review'],
    checks: [
      createConsequenceAdmissionCheck({
        kind: 'authority',
        label: 'approval check',
        outcome: 'warn',
        required: true,
        summary: 'Approval is missing.',
        reasonCodes: ['approval-missing'],
        evidenceRefs: [],
      }),
    ],
    proof: [],
  });
  return createConsequenceAdmissionRequestableDenial({
    admission,
    reason: 'approval-required',
    template: 'generic-admission:approval-required',
    expiresAt: '2026-06-20T10:10:00.000Z',
  });
}

function requesterFixture() {
  return {
    principalRef: 'tenant:api_key:store-client',
    source: 'tenant-context',
    role: 'api_key',
  };
}

function approverFixture() {
  return {
    principalRef: 'account-user:store-risk-owner',
    source: 'account-session',
    role: 'account_admin',
  };
}

function testFileBackedAccessRequestStore(): void {
  const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-access-request-store-'));
  const path = join(tempRoot, 'store.json');
  try {
    const store = createFileBackedHostedGenericAdmissionAccessRequestStore({ path });
    const denial = requestableDenialFixture();
    const created = store.create({
      tenantId: 'tenant_store',
      denial,
      createdAt: '2026-06-20T10:00:02.000Z',
      requester: requesterFixture(),
    });
    const duplicate = store.create({
      tenantId: 'tenant_store',
      denial,
      createdAt: '2026-06-20T10:00:03.000Z',
      requester: requesterFixture(),
    });
    const otherTenantCreated = store.create({
      tenantId: 'other_tenant',
      denial,
      createdAt: '2026-06-20T10:00:04.000Z',
      requester: requesterFixture(),
    });
    const reloaded = createFileBackedHostedGenericAdmissionAccessRequestStore({ path });
    const completed = reloaded.complete({
      tenantId: 'tenant_store',
      taskId: created.task.id,
      status: 'approved',
      decidedAt: '2026-06-20T10:01:00.000Z',
      decisionAuthority: approverFixture(),
      approval: {
        id: 'approval_store_001',
        approvedAt: '2026-06-20T10:00:30.000Z',
        approvedUntil: '2026-06-20T10:08:00.000Z',
        approvalRef: 'approval:raw-store-ref-001',
        authorityKind: 'approval',
        scopeDigest: denial.binding.scopeDigest,
        approvalState: 'approved',
      },
    });
    const fetched = reloaded.get({
      tenantId: 'tenant_store',
      taskId: created.task.id,
    });
    const listed = reloaded.list({
      tenantId: 'tenant_store',
      limit: 10,
    });
    const otherListed = reloaded.list({
      tenantId: 'other_tenant',
      limit: 10,
    });
    const otherTenant = reloaded.get({
      tenantId: 'missing_tenant',
      taskId: created.task.id,
    });
    const crossTenantComplete = reloaded.complete({
      tenantId: 'missing_tenant',
      taskId: created.task.id,
      status: 'approved',
      decidedAt: '2026-06-20T10:02:00.000Z',
      decisionAuthority: approverFixture(),
      approval: {
        id: 'approval_store_cross_tenant',
        approvedUntil: '2026-06-20T10:08:00.000Z',
        authorityKind: 'approval',
        scopeDigest: denial.binding.scopeDigest,
      },
    });
    const serialized = JSON.stringify(reloaded.exportSnapshot());

    equal(
      created.version,
      HOSTED_GENERIC_ADMISSION_ACCESS_REQUEST_STORE_VERSION,
      'Hosted access request store: record version is stable',
    );
    equal(created.task.status, 'pending', 'Hosted access request store: created task starts pending');
    equal(created.task.accessPermitted, false, 'Hosted access request store: task does not permit access');
    equal(created.task.releaseTokenMayBeIssued, false, 'Hosted access request store: task cannot issue release token');
    equal(created.rawPayloadStored, false, 'Hosted access request store: record stores no raw payload');
    equal(created.productionReady, false, 'Hosted access request store: record is not production proof');
    equal(
      created.task.statusEndpoint,
      `/api/v1/admissions/access-requests/${created.task.id}`,
      'Hosted access request store: task has a status endpoint',
    );
    equal(
      otherTenantCreated.task.id,
      created.task.id,
      'Hosted access request store: same denial may reuse task id across tenants',
    );
    equal(duplicate.task.id, created.task.id, 'Hosted access request store: duplicate denial reuses task');
    equal(completed?.task.status, 'approved', 'Hosted access request store: task can be approved');
    equal(
      completed?.task.result?.mode,
      'reevaluate',
      'Hosted access request store: approved task still requires re-evaluation',
    );
    equal(
      completed?.task.result?.accessPermitted,
      false,
      'Hosted access request store: approved task does not directly permit access',
    );
    equal(
      completed?.task.result?.releaseTokenMayBeIssued,
      false,
      'Hosted access request store: approved task cannot directly issue release tokens',
    );
    equal(
      completed?.task.result?.approval.scopeDigest,
      denial.binding.scopeDigest,
      'Hosted access request store: completed approval is scope-bound to the denial',
    );
    equal(fetched?.task.status, 'approved', 'Hosted access request store: completed task survives reload');
    equal(listed.records.length, 1, 'Hosted access request store: list returns the tenant task');
    equal(listed.records[0]?.task.status, 'approved', 'Hosted access request store: list returns the updated task');
    equal(otherListed.records.length, 1, 'Hosted access request store: list is tenant scoped');
    equal(
      otherListed.records[0]?.task.status,
      'pending',
      'Hosted access request store: completing one tenant does not update another tenant',
    );
    equal(otherTenant, null, 'Hosted access request store: task lookup is tenant scoped');
    equal(crossTenantComplete, null, 'Hosted access request store: completion is tenant scoped');
    ok(!serialized.includes('support-ai-agent'), 'Hosted access request store: actor raw ref is not stored');
    ok(!serialized.includes('refund-service'), 'Hosted access request store: downstream raw ref is not stored');
    ok(!serialized.includes('policy:refunds:v1'), 'Hosted access request store: policy raw ref is not stored');
    ok(!serialized.includes('approval:raw-store-ref-001'), 'Hosted access request store: approval raw ref is not stored');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

testFileBackedAccessRequestStore();

console.log(`Hosted generic admission access-request store tests: ${passed} passed, 0 failed`);
