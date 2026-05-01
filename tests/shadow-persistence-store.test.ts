import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowAdmissionEventStore,
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
} from '../src/service/shadow-persistence-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-store-'));
const admissionPath = join(tempDir, 'shadow-events.json');
const candidatePath = join(tempDir, 'shadow-candidates.json');

const tenantA: TenantContext = {
  tenantId: 'tenant_shadow_a',
  tenantName: 'Shadow Tenant A',
  authenticatedAt: '2026-05-02T08:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const tenantB: TenantContext = {
  ...tenantA,
  tenantId: 'tenant_shadow_b',
  tenantName: 'Shadow Tenant B',
};

function createEvent(input: {
  readonly tenantId: string;
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt?: string;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      tenantId: input.tenantId,
      requestedAt: '2026-05-02T08:01:00.000Z',
      decidedAt: '2026-05-02T08:01:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: input.evidenceRefs ?? ['order:987'],
      policyRef: input.policyRef ?? null,
      observedFeatures: input.observedFeatures ?? {
        amountBucket: '25k-50k',
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt ?? '2026-05-02T08:01:02.000Z',
    downstreamOutcome: 'proceeded',
    observedFeatures: input.observedFeatures ?? {
      amountBucket: '25k-50k',
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function testShadowAdmissionStorePersistsTenantScopedEvents(): void {
  const store = createFileBackedShadowAdmissionEventStore({ path: admissionPath });
  const eventA = createEvent({ tenantId: tenantA.tenantId });
  const eventB = createEvent({
    tenantId: tenantB.tenantId,
    action: 'export_customer_data',
    domain: 'data-disclosure',
    downstreamSystem: 'warehouse',
  });
  const first = store.append({
    tenantId: tenantA.tenantId,
    event: eventA,
    recordedAt: '2026-05-02T08:02:00.000Z',
  });
  const duplicate = store.append({
    tenantId: tenantA.tenantId,
    event: eventA,
    recordedAt: '2026-05-02T08:03:00.000Z',
  });
  store.append({
    tenantId: tenantB.tenantId,
    event: eventB,
    recordedAt: '2026-05-02T08:04:00.000Z',
  });

  const tenantARecords = store.list({ tenantId: tenantA.tenantId });
  const tenantBRecords = store.list({ tenantId: tenantB.tenantId });
  const filtered = store.list({
    tenantId: tenantB.tenantId,
    domain: 'data-disclosure',
    actionSurface: 'warehouse.export_customer_data',
  });
  const summary = store.summarize({ tenantId: tenantA.tenantId }).summary;
  const fileText = readFileSync(admissionPath, 'utf8');

  equal(first.kind, 'recorded', 'Shadow persistence: first event is recorded');
  equal(duplicate.kind, 'duplicate', 'Shadow persistence: duplicate event is idempotent');
  equal(tenantARecords.events.length, 1, 'Shadow persistence: tenant A sees only its event');
  equal(tenantBRecords.events.length, 1, 'Shadow persistence: tenant B sees only its event');
  equal(filtered.events.length, 1, 'Shadow persistence: domain/action surface filters work');
  equal(summary.eventCount, 1, 'Shadow persistence: summary is tenant-scoped');
  equal(summary.rawPayloadStored, false, 'Shadow persistence: summary exposes raw payload boundary');
  equal(summary.productionReady, false, 'Shadow persistence: evaluation store is not production-ready');
  ok(summary.latestEventDigest?.startsWith('sha256:'), 'Shadow persistence: latest digest is retained');
  ok(!fileText.includes('raw_customer_value_must_not_escape'), 'Shadow persistence: raw recipient is not persisted');
  ok(!fileText.includes('raw_feature_value_must_not_escape'), 'Shadow persistence: raw feature value is not persisted');
  ok(!fileText.includes('order:987'), 'Shadow persistence: raw evidence id is not persisted');
  throws(
    () => store.append({ tenantId: tenantB.tenantId, event: eventA }),
    /tenant does not match/u,
    'Shadow persistence: cross-tenant event append fails closed',
  );
}

async function testAdmissionRouteRecordsAndSummaryReadsPersistedEvents(): Promise<void> {
  const store = createFileBackedShadowAdmissionEventStore({ path: admissionPath });
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => tenantA,
    recordShadowAdmission: ({ tenant, envelope }) => {
      store.append({
        tenantId: tenant.tenantId,
        event: createShadowAdmissionEvent({ admission: envelope }),
      });
    },
  });
  registerShadowRoutes(app, {
    currentTenant: () => tenantA,
    listShadowEvents: ({ tenant }) =>
      store.list({ tenantId: tenant.tenantId }).events,
    listShadowSimulations: () => [],
    now: () => '2026-05-02T08:05:00.000Z',
  });

  const admissionResponse = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-02T08:04:00.000Z',
      decidedAt: '2026-05-02T08:04:01.000Z',
      recipient: 'route_raw_customer_must_not_escape',
      evidenceRefs: ['route-order:987'],
    }),
  });
  const summaryResponse = await app.request('/api/v1/shadow/summary');
  const summaryText = await summaryResponse.text();
  const summary = JSON.parse(summaryText) as {
    readonly eventCount: number;
    readonly rawPayloadStored: boolean;
  };

  equal(admissionResponse.status, 200, 'Shadow persistence route: admission still returns 200');
  equal(summaryResponse.status, 200, 'Shadow persistence route: summary returns 200');
  ok(summary.eventCount >= 2, 'Shadow persistence route: summary reads persisted events');
  equal(summary.rawPayloadStored, false, 'Shadow persistence route: summary remains data-minimized');
  ok(!summaryText.includes('route_raw_customer_must_not_escape'), 'Shadow persistence route: raw recipient is not returned');
  ok(!summaryText.includes('route-order:987'), 'Shadow persistence route: raw evidence id is not returned');
}

function testPolicyCandidateStorePreservesApprovalLifecycle(): void {
  const eventWithoutPolicy = createEvent({
    tenantId: tenantA.tenantId,
    policyRef: null,
    occurredAt: '2026-05-02T08:10:00.000Z',
  });
  const cleanEvent = createEvent({
    tenantId: tenantA.tenantId,
    action: 'rotate_secret',
    domain: 'system-operation',
    downstreamSystem: 'secret-manager',
    policyRef: 'policy:ops:v1',
    evidenceRefs: ['change:123'],
    observedFeatures: { adapterReady: true },
    occurredAt: '2026-05-02T08:11:00.000Z',
  });
  const report = createShadowPolicySimulationReport({
    events: [eventWithoutPolicy, cleanEvent],
    proposedMode: 'review',
    generatedAt: '2026-05-02T08:20:00.000Z',
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-02T08:21:00.000Z',
  });
  const store = createFileBackedShadowPolicyCandidateStore({ path: candidatePath });
  const upsert = store.upsertBundle({ tenantId: tenantA.tenantId, bundle });
  const draft = store.list({ tenantId: tenantA.tenantId, status: 'draft' }).records[0]!;
  const proposed = store.transitionStatus({
    tenantId: tenantA.tenantId,
    candidateId: draft.candidateId,
    status: 'proposed',
    actorRef: 'risk-owner:1',
    reason: 'Ready for policy owner review.',
    changedAt: '2026-05-02T08:22:00.000Z',
  }).record;
  const approved = store.transitionStatus({
    tenantId: tenantA.tenantId,
    candidateId: draft.candidateId,
    status: 'approved',
    actorRef: 'risk-owner:1',
    reason: 'Policy owner approved the candidate.',
    changedAt: '2026-05-02T08:23:00.000Z',
  }).record;
  const activated = store.transitionStatus({
    tenantId: tenantA.tenantId,
    candidateId: draft.candidateId,
    status: 'activated',
    actorRef: 'release-manager:1',
    reason: 'Activated as a customer-approved policy candidate.',
    changedAt: '2026-05-02T08:24:00.000Z',
  }).record;
  const tenantBStore = store.upsertCandidate({
    tenantId: tenantB.tenantId,
    candidate: bundle.candidates[0]!,
    sourceReportId: bundle.sourceReportId,
    sourceReportDigest: bundle.sourceReportDigest,
    observedAt: '2026-05-02T08:25:00.000Z',
  });
  const summary = store.summarize({ tenantId: tenantA.tenantId }).summary;
  const candidateFileText = readFileSync(candidatePath, 'utf8');

  ok(upsert.createdCount >= 1, 'Policy candidate persistence: bundle creates candidates');
  equal(proposed.status, 'proposed', 'Policy candidate persistence: candidate can be proposed');
  equal(approved.status, 'approved', 'Policy candidate persistence: candidate can be approved');
  equal(activated.status, 'activated', 'Policy candidate persistence: approved candidate can be activated');
  equal(activated.statusHistory.length, 4, 'Policy candidate persistence: status history is retained');
  equal(activated.approvalRequired, true, 'Policy candidate persistence: approval boundary is retained');
  equal(activated.autoEnforce, false, 'Policy candidate persistence: activation still does not auto-enforce');
  equal(activated.rawPayloadStored, false, 'Policy candidate persistence: raw payload boundary is retained');
  equal(tenantBStore.kind, 'created', 'Policy candidate persistence: same candidate id can exist for another tenant');
  equal(
    store.list({ tenantId: tenantB.tenantId }).records.length,
    1,
    'Policy candidate persistence: tenant B candidates are isolated',
  );
  ok(summary.candidateCount >= 1, 'Policy candidate persistence: summary counts tenant candidates');
  ok(summary.byStatus.activated >= 1, 'Policy candidate persistence: summary counts activated candidates');
  ok(!candidateFileText.includes('raw_customer_value_must_not_escape'), 'Policy candidate persistence: raw recipient is not persisted');
  ok(!candidateFileText.includes('raw_feature_value_must_not_escape'), 'Policy candidate persistence: raw feature value is not persisted');
  ok(!candidateFileText.includes('change:123'), 'Policy candidate persistence: raw evidence id is not persisted');
  throws(
    () =>
      store.transitionStatus({
        tenantId: tenantB.tenantId,
        candidateId: tenantBStore.record.candidateId,
        status: 'activated',
        actorRef: 'release-manager:1',
        reason: 'Skip approval.',
      }),
    /cannot transition from draft to activated/u,
    'Policy candidate persistence: activation requires prior approval',
  );
}

try {
  resetShadowPersistenceStoresForTests({
    admissionEventPath: admissionPath,
    policyCandidatePath: candidatePath,
  });
  testShadowAdmissionStorePersistsTenantScopedEvents();
  await testAdmissionRouteRecordsAndSummaryReadsPersistedEvents();
  testPolicyCandidateStorePreservesApprovalLifecycle();

  console.log(`Shadow persistence store tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({
    admissionEventPath: admissionPath,
    policyCandidatePath: candidatePath,
  });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
