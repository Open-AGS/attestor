import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicySimulationReport,
  SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR,
  SHADOW_POLICY_SIMULATION_MAX_EVENTS,
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
    authoritySources: [
      {
        sourceKind: 'authority-record',
        claimKind: 'authorization',
        sourceRef: 'authority:support-ai-agent',
        trustClass: 'trusted-authority',
        evidenceDigest: 'sha256:authority-support',
      },
    ],
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
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:analytics-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-analytics',
        },
      ],
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
  equal(report.requestedMinimumPromotionEvents, null, 'Shadow simulation: requested promotion threshold is null by default');
  equal(report.minimumPromotionEvents, SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR, 'Shadow simulation: default threshold uses server-owned floor');
  equal(report.minimumPromotionEventsFloor, SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR, 'Shadow simulation: threshold floor is explicit');
  equal(report.minimumPromotionEventsSource, 'server-default-floor', 'Shadow simulation: default threshold source is explicit');
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
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:ops-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-ops',
        },
      ],
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

function testSimulationMapsDomainScopeReasonsToSpecificRecommendations(): void {
  const amountGap = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-01T20:21:00.000Z',
      decidedAt: '2026-05-01T20:21:01.000Z',
      recipient: 'customer_123',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['ticket:amount-gap'],
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:support-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-support',
        },
      ],
    }),
    occurredAt: '2026-05-01T20:21:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const recipientGap = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'treasury-ai-agent',
      action: 'prepare_transfer',
      domain: 'programmable-money',
      downstreamSystem: 'wallet-gateway',
      requestedAt: '2026-05-01T20:22:00.000Z',
      decidedAt: '2026-05-01T20:22:01.000Z',
      amount: {
        value: 2400,
        currency: 'USD',
        asset: null,
        chain: null,
      },
      policyRef: 'policy:wallet:v1',
      evidenceRefs: ['ticket:recipient-gap'],
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:treasury-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-treasury',
        },
      ],
      observedFeatures: {
        adapterReady: true,
      },
      observedFeatureOrigins: {
        adapterReady: 'operator-attested',
      },
    }),
    occurredAt: '2026-05-01T20:22:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const dataGap = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'analytics-ai-agent',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-delivery',
      requestedAt: '2026-05-01T20:23:00.000Z',
      decidedAt: '2026-05-01T20:23:01.000Z',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:data-gap'],
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:analytics-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-analytics',
        },
      ],
    }),
    occurredAt: '2026-05-01T20:23:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const authorityGap = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'iam-ai-agent',
      action: 'grant_admin_role',
      domain: 'authority-change',
      downstreamSystem: 'identity-provider',
      requestedAt: '2026-05-01T20:24:00.000Z',
      decidedAt: '2026-05-01T20:24:01.000Z',
      policyRef: 'policy:iam:v1',
      evidenceRefs: ['ticket:authority-gap'],
    }),
    occurredAt: '2026-05-01T20:24:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const customGap = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'custom-ai-agent',
      action: 'perform_customer_defined_action',
      domain: 'custom',
      downstreamSystem: 'customer-defined-system',
      requestedAt: '2026-05-01T20:25:00.000Z',
      decidedAt: '2026-05-01T20:25:01.000Z',
      policyRef: 'policy:custom:v1',
      evidenceRefs: ['ticket:custom-gap'],
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: 'authority:custom-ai-agent',
          trustClass: 'trusted-authority',
          evidenceDigest: 'sha256:authority-custom',
        },
      ],
    }),
    occurredAt: '2026-05-01T20:25:02.000Z',
    downstreamOutcome: 'proceeded',
  });

  const report = createShadowPolicySimulationReport({
    events: [amountGap, recipientGap, dataGap, authorityGap, customGap],
    proposedMode: 'review',
    generatedAt: '2026-05-01T20:26:00.000Z',
  });
  const kinds = report.recommendations.map((item) => item.kind);

  equal(report.gapCounts.amountScope, 1, 'Shadow simulation: amount scope gaps are counted');
  equal(report.gapCounts.recipientScope, 1, 'Shadow simulation: recipient scope gaps are counted');
  equal(report.gapCounts.dataScope, 1, 'Shadow simulation: data scope gaps are counted');
  equal(report.gapCounts.authority, 1, 'Shadow simulation: authority-mode gaps count as authority gaps');
  equal(report.gapCounts.customDomain, 1, 'Shadow simulation: custom-domain gaps are counted');
  ok(kinds.includes('bind-amount-scope'), 'Shadow simulation: amount scope gap gets a specific recommendation');
  ok(kinds.includes('bind-recipient-scope'), 'Shadow simulation: recipient scope gap gets a specific recommendation');
  ok(kinds.includes('bind-data-scope'), 'Shadow simulation: data scope gap gets a specific recommendation');
  ok(kinds.includes('bind-authority'), 'Shadow simulation: authority-mode gap gets an authority recommendation');
  ok(kinds.includes('scope-custom-domain'), 'Shadow simulation: custom domain gap gets a scoped-domain recommendation');
}

function testCallerThresholdBelowFloorDoesNotPromote(): void {
  const event = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'ops-ai-agent',
      action: 'rotate_secret',
      domain: 'system-operation',
      downstreamSystem: 'secret-manager',
      requestedAt: '2026-05-01T20:40:00.000Z',
      decidedAt: '2026-05-01T20:40:01.000Z',
      policyRef: 'policy:ops:v1',
      evidenceRefs: ['change:below-floor'],
    }),
    occurredAt: '2026-05-01T20:40:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const report = createShadowPolicySimulationReport({
    events: [event],
    proposedMode: 'review',
    generatedAt: '2026-05-01T20:41:00.000Z',
    minimumPromotionEvents: 1,
  });

  equal(report.requestedMinimumPromotionEvents, 1, 'Shadow simulation: caller-requested threshold is recorded');
  equal(report.minimumPromotionEvents, SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR, 'Shadow simulation: caller threshold below floor is raised');
  equal(report.minimumPromotionEventsSource, 'caller-request-raised-to-floor', 'Shadow simulation: raised threshold source is explicit');
  ok(
    !report.recommendations.some((item) => item.kind === 'promote-to-enforce'),
    'Shadow simulation: one clean event cannot bypass the promotion floor',
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

function testOversizedSimulationFailsClosed(): void {
  const event = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      ...moneyAdmission('observe'),
      requestId: 'shadow-limit-request',
    }),
    occurredAt: '2026-05-01T20:30:02.000Z',
    downstreamOutcome: 'proceeded',
  });
  const events = Array.from({ length: SHADOW_POLICY_SIMULATION_MAX_EVENTS + 1 }, () => event);

  throws(
    () =>
      createShadowPolicySimulationReport({
        events,
        proposedMode: 'review',
      }),
    /event count exceeds maximum/u,
    'Shadow simulation: oversized event windows fail closed',
  );
}

function testInvalidPromotionThresholdFailsClosed(): void {
  throws(
    () =>
      createShadowPolicySimulationReport({
        events: [],
        proposedMode: 'review',
        minimumPromotionEvents: 0,
      }),
    /minimumPromotionEvents must be a positive integer/u,
    'Shadow simulation: invalid promotion threshold fails closed',
  );
}

testSimulationReplaysShadowDecisions();
testPromotionRecommendationRequiresCleanShadowTraffic();
testSimulationMapsDomainScopeReasonsToSpecificRecommendations();
testCallerThresholdBelowFloorDoesNotPromote();
testInvalidModeFailsClosed();
testInvalidPromotionThresholdFailsClosed();
testOversizedSimulationFailsClosed();

console.log(`Shadow policy simulation tests: ${passed} passed, 0 failed`);
