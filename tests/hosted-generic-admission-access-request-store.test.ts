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
    });
    const duplicate = store.create({
      tenantId: 'tenant_store',
      denial,
      createdAt: '2026-06-20T10:00:03.000Z',
    });
    const reloaded = createFileBackedHostedGenericAdmissionAccessRequestStore({ path });
    const fetched = reloaded.get({
      tenantId: 'tenant_store',
      taskId: created.task.id,
    });
    const listed = reloaded.list({
      tenantId: 'tenant_store',
      limit: 10,
    });
    const otherTenant = reloaded.get({
      tenantId: 'other_tenant',
      taskId: created.task.id,
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
    equal(duplicate.task.id, created.task.id, 'Hosted access request store: duplicate denial reuses task');
    equal(fetched?.task.id, created.task.id, 'Hosted access request store: task survives reload');
    equal(listed.records.length, 1, 'Hosted access request store: list returns the tenant task');
    equal(otherTenant, null, 'Hosted access request store: task lookup is tenant scoped');
    ok(!serialized.includes('support-ai-agent'), 'Hosted access request store: actor raw ref is not stored');
    ok(!serialized.includes('refund-service'), 'Hosted access request store: downstream raw ref is not stored');
    ok(!serialized.includes('policy:refunds:v1'), 'Hosted access request store: policy raw ref is not stored');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

testFileBackedAccessRequestStore();

console.log(`Hosted generic admission access-request store tests: ${passed} passed, 0 failed`);
