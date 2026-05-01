import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicySimulationReport,
  createShadowSummarySurface,
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

function shadowEvent(input: {
  readonly mode: 'observe' | 'warn' | 'review' | 'enforce';
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt: string;
}) {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input.mode,
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T21:00:00.000Z',
      decidedAt: '2026-05-01T21:00:01.000Z',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
  });
}

function testSummaryCreatesSimulationWithoutRawPayloads(): void {
  const events = [
    shadowEvent({
      mode: 'observe',
      occurredAt: '2026-05-01T21:00:02.000Z',
    }),
    shadowEvent({
      mode: 'observe',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987'],
      occurredAt: '2026-05-01T21:01:02.000Z',
    }),
  ];
  const surface = createShadowSummarySurface({
    events,
    generatedAt: '2026-05-01T21:02:00.000Z',
    proposedMode: 'review',
  });
  const serialized = JSON.stringify(surface);

  equal(surface.version, 'attestor.shadow-summary-surface.v1', 'Shadow summary surface: version is explicit');
  equal(surface.storageMode, 'runtime-supplied', 'Shadow summary surface: storage mode is bounded');
  equal(surface.productionReady, false, 'Shadow summary surface: production readiness is not overclaimed');
  equal(surface.rawPayloadStored, false, 'Shadow summary surface: raw payload storage is explicitly false');
  equal(surface.eventCount, 2, 'Shadow summary surface: event count is retained');
  equal(surface.summary.totalEvents, 2, 'Shadow summary surface: embedded summary is retained');
  equal(surface.latestSimulation?.eventCount, 2, 'Shadow summary surface: report is generated from events');
  ok(surface.digest.startsWith('sha256:'), 'Shadow summary surface: digest is generated');
  ok(
    surface.recommendations.some((item) => item.kind === 'define-policy'),
    'Shadow summary surface: policy gaps are exposed as recommendations',
  );
  ok(!serialized.includes('customer_123'), 'Shadow summary surface: raw recipient is not serialized');
  ok(!serialized.includes('order:987'), 'Shadow summary surface: raw evidence id is not serialized');
}

function testSummaryPrefersLatestRuntimeSimulation(): void {
  const events = [
    shadowEvent({
      mode: 'observe',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987'],
      occurredAt: '2026-05-01T21:03:02.000Z',
    }),
  ];
  const older = createShadowPolicySimulationReport({
    events,
    proposedMode: 'warn',
    generatedAt: '2026-05-01T21:04:00.000Z',
  });
  const newer = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-01T21:05:00.000Z',
  });
  const surface = createShadowSummarySurface({
    events,
    simulations: [older, newer],
    generatedAt: '2026-05-01T21:06:00.000Z',
  });

  equal(surface.latestSimulation?.reportId, newer.reportId, 'Shadow summary surface: newest runtime simulation wins');
  equal(surface.latestSimulation?.proposedMode, 'review', 'Shadow summary surface: newest simulation mode is preserved');
}

function testEmptySummaryIsExplicit(): void {
  const surface = createShadowSummarySurface({
    events: [],
    generatedAt: '2026-05-01T21:07:00.000Z',
  });

  equal(surface.eventCount, 0, 'Shadow summary surface: empty event count is zero');
  equal(surface.latestSimulation, null, 'Shadow summary surface: empty inputs do not invent simulation');
  equal(surface.recommendations.length, 0, 'Shadow summary surface: empty inputs do not invent recommendations');
}

testSummaryCreatesSimulationWithoutRawPayloads();
testSummaryPrefersLatestRuntimeSimulation();
testEmptySummaryIsExplicit();

console.log(`Shadow summary surface tests: ${passed} passed, 0 failed`);
