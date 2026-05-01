import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicySimulationReport,
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

function moneyAdmission(mode: string) {
  return {
    mode,
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T20:00:00.000Z',
    decidedAt: '2026-05-01T20:00:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
  };
}

function testSimulationReplaysShadowDecisions(): void {
  const reviewEvent = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T20:01:00.000Z',
      decidedAt: '2026-05-01T20:01:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'customer_123',
    }),
    occurredAt: '2026-05-01T20:01:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const blockEvent = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      ...moneyAdmission('enforce'),
      observedFeatures: {
        policyBlocked: true,
      },
    }),
    occurredAt: '2026-05-01T20:02:02.000Z',
    downstreamOutcome: 'blocked',
    humanOutcome: 'rejected',
  });
  const admitEvent = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'analytics-ai-agent',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-delivery',
      requestedAt: '2026-05-01T20:03:00.000Z',
      decidedAt: '2026-05-01T20:03:01.000Z',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:555'],
      dataScope: {
        records: 12,
        classification: 'internal',
        fields: ['ticket_id', 'status'],
      },
    }),
    occurredAt: '2026-05-01T20:03:02.000Z',
    downstreamOutcome: 'proceeded',
  });

  const report = createShadowPolicySimulationReport({
    events: [reviewEvent, blockEvent, admitEvent],
    proposedMode: 'enforce',
    generatedAt: '2026-05-01T20:05:00.000Z',
  });

  equal(report.version, 'attestor.shadow-policy-simulation.v1', 'Shadow simulation: version is explicit');
  equal(report.proposedMode, 'enforce', 'Shadow simulation: proposed mode is retained');
  equal(report.eventCount, 3, 'Shadow simulation: event count is retained');
  equal(report.windowStart, '2026-05-01T20:01:02.000Z', 'Shadow simulation: window start is derived');
  equal(report.windowEnd, '2026-05-01T20:03:02.000Z', 'Shadow simulation: window end is derived');
  equal(report.simulatedDecisionCounts.admit, 1, 'Shadow simulation: would-admit count is replayed');
  equal(report.simulatedDecisionCounts.review, 1, 'Shadow simulation: would-review count is replayed');
  equal(report.simulatedDecisionCounts.block, 1, 'Shadow simulation: would-block count is replayed');
  equal(report.reviewLoadCount, 1, 'Shadow simulation: review load is explicit');
  equal(report.blockedCount, 1, 'Shadow simulation: blocked count is explicit');
  equal(report.gapCounts.policy, 1, 'Shadow simulation: policy gaps are counted');
  equal(report.gapCounts.evidence, 1, 'Shadow simulation: evidence gaps are counted');
  equal(report.nonEnforcingEventCount, 2, 'Shadow simulation: non-enforcing shadow events are counted');
  equal(report.rawPayloadEventCount, 0, 'Shadow simulation: raw payload count remains zero');
  ok(report.digest.startsWith('sha256:'), 'Shadow simulation: report digest is generated');
  ok(
    report.surfaceSimulations.some((surface) =>
      surface.actionSurface === 'refund-service.issue_refund' &&
      surface.simulatedDecisionCounts.review === 1 &&
      surface.simulatedDecisionCounts.block === 1,
    ),
    'Shadow simulation: action surface summary combines matching surfaces',
  );
  ok(
    report.recommendations.some((item) => item.kind === 'define-policy'),
    'Shadow simulation: policy gap produces policy recommendation',
  );
  ok(
    report.recommendations.some((item) => item.kind === 'bind-evidence'),
    'Shadow simulation: evidence gap produces evidence recommendation',
  );
  ok(
    report.recommendations.some((item) => item.kind === 'investigate-blocks'),
    'Shadow simulation: block/rejection produces blocker recommendation',
  );
}

function testPromotionRecommendationRequiresCleanShadowTraffic(): void {
  const events = Array.from({ length: 5 }, (_, index) =>
    createShadowAdmissionEvent({
      admission: createGenericAdmissionEnvelope({
        mode: 'observe',
        actor: 'ops-ai-agent',
        action: 'rotate_secret',
        domain: 'system-operation',
        downstreamSystem: 'secret-manager',
        requestedAt: `2026-05-01T20:1${index}:00.000Z`,
        decidedAt: `2026-05-01T20:1${index}:01.000Z`,
        policyRef: 'policy:ops:v1',
        evidenceRefs: [`change:${index}`],
      }),
      occurredAt: `2026-05-01T20:1${index}:02.000Z`,
      downstreamOutcome: 'proceeded',
    }),
  );
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-01T20:20:00.000Z',
  });

  equal(report.simulatedDecisionCounts.admit, 5, 'Shadow simulation: clean traffic replays as admit');
  ok(
    report.recommendations.some((item) => item.kind === 'promote-to-enforce'),
    'Shadow simulation: clean shadow traffic can recommend enforce-mode rehearsal',
  );
}

function testInvalidModeFailsClosed(): void {
  throws(
    () =>
      createShadowPolicySimulationReport({
        events: [],
        proposedMode: 'magic' as never,
      }),
    /proposedMode must be observe, warn, review, or enforce/u,
    'Shadow simulation: invalid proposed mode fails closed',
  );
}

testSimulationReplaysShadowDecisions();
testPromotionRecommendationRequiresCleanShadowTraffic();
testInvalidModeFailsClosed();

console.log(`Shadow policy simulation tests: ${passed} passed, 0 failed`);
