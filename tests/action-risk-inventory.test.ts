import assert from 'node:assert/strict';
import {
  createActionRiskInventory,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type ShadowAdmissionEvent,
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

function event(input: {
  readonly actor: string;
  readonly action: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly dataScope?: {
    readonly records: number | null;
    readonly classification: string | null;
    readonly fields: readonly string[];
  } | null;
  readonly occurredAt: string;
  readonly downstreamOutcome?: 'proceeded' | 'failed' | 'blocked' | 'held';
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected' | 'modified';
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: input.action,
      domain: input.domain,
      downstreamSystem: input.downstreamSystem,
      requestedAt: '2026-05-01T22:00:00.000Z',
      decidedAt: '2026-05-01T22:00:01.000Z',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      dataScope: input.dataScope ?? null,
      recipient: 'raw_recipient_must_not_escape',
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: `authority:${input.action}`,
          trustClass: 'trusted-authority',
          evidenceDigest: `sha256:authority-${input.action}`,
        },
      ],
      observedFeatures: {
        adapterReady: input.observedFeatures?.adapterReady ?? true,
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.downstreamOutcome ?? 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      rawCustomerMarker: 'raw_feature_must_not_escape',
    },
  });
}

function cleanOpsEvents(): readonly ShadowAdmissionEvent[] {
  return Array.from({ length: 5 }, (_, index) =>
    event({
      actor: 'ops-ai-agent',
      action: 'rotate_secret',
      domain: 'system-operation',
      downstreamSystem: 'secret-manager',
      policyRef: 'policy:ops:v1',
      evidenceRefs: [`change:${index}`],
      occurredAt: `2026-05-01T22:1${index}:02.000Z`,
    }),
  );
}

function testInventoryRanksAndSummarizesActionSurfaces(): void {
  const events = [
    event({
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      occurredAt: '2026-05-01T22:00:02.000Z',
    }),
    event({
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987'],
      occurredAt: '2026-05-01T22:01:02.000Z',
      downstreamOutcome: 'failed',
      humanOutcome: 'rejected',
    }),
    event({
      actor: 'analytics-ai-agent',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-delivery',
      policyRef: 'policy:reports:v1',
      dataScope: {
        records: 12,
        classification: 'internal',
        fields: ['ticket_id', 'status'],
      },
      occurredAt: '2026-05-01T22:02:02.000Z',
    }),
    ...cleanOpsEvents(),
  ];
  const inventory = createActionRiskInventory({
    events,
    generatedAt: '2026-05-01T22:20:00.000Z',
  });
  const serialized = JSON.stringify(inventory);
  const refundSurface = inventory.surfaces.find((surface) =>
    surface.actionSurface === 'refund-service.issue_refund'
  );
  const reportSurface = inventory.surfaces.find((surface) =>
    surface.actionSurface === 'report-delivery.export_customer_report'
  );
  const opsSurface = inventory.surfaces.find((surface) =>
    surface.actionSurface === 'secret-manager.rotate_secret'
  );

  equal(inventory.version, 'attestor.action-risk-inventory.v1', 'Action risk inventory: version is explicit');
  equal(inventory.eventCount, 8, 'Action risk inventory: event count is retained');
  equal(inventory.surfaceCount, 3, 'Action risk inventory: surface count is retained');
  equal(inventory.rawPayloadStored, false, 'Action risk inventory: raw payload boundary is explicit');
  equal(inventory.windowStart, '2026-05-01T22:00:02.000Z', 'Action risk inventory: window start is derived');
  equal(inventory.windowEnd, '2026-05-01T22:14:02.000Z', 'Action risk inventory: window end is derived');
  equal(inventory.surfaces[0]?.riskTier, 'critical', 'Action risk inventory: critical surfaces sort first');
  equal(refundSurface?.riskTier, 'critical', 'Action risk inventory: failed/rejected money movement is critical');
  equal(refundSurface?.recommendedNextStep, 'investigate-blocks', 'Action risk inventory: critical surface next step investigates');
  ok(refundSurface?.riskSignals.includes('policy-gap'), 'Action risk inventory: policy gaps are surfaced');
  ok(refundSurface?.riskSignals.includes('downstream-failure'), 'Action risk inventory: downstream failures are surfaced');
  ok(refundSurface?.riskSignals.includes('human-rejection'), 'Action risk inventory: human rejections are surfaced');
  equal(reportSurface?.riskTier, 'medium', 'Action risk inventory: evidence gap without blocks is medium');
  equal(reportSurface?.recommendedNextStep, 'bind-evidence', 'Action risk inventory: evidence gap recommends binding evidence');
  equal(opsSurface?.riskTier, 'low', 'Action risk inventory: clean shadow traffic is low risk');
  equal(opsSurface?.recommendedNextStep, 'candidate-for-enforce', 'Action risk inventory: clean shadow traffic can be an enforce candidate');
  ok(
    inventory.domainSummaries.some((summary) =>
      summary.domain === 'money-movement' && summary.highestRiskTier === 'critical'
    ),
    'Action risk inventory: domain summaries retain highest risk tier',
  );
  ok(inventory.digest.startsWith('sha256:'), 'Action risk inventory: digest is generated');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Action risk inventory: raw recipient is not serialized');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Action risk inventory: raw feature value is not serialized');
  ok(!serialized.includes('order:987'), 'Action risk inventory: raw evidence id is not serialized');
}

function testEmptyInventoryIsExplicit(): void {
  const inventory = createActionRiskInventory({
    events: [],
    generatedAt: '2026-05-01T22:30:00.000Z',
  });

  equal(inventory.eventCount, 0, 'Action risk inventory: empty event count is zero');
  equal(inventory.surfaceCount, 0, 'Action risk inventory: empty surface count is zero');
  equal(inventory.domainSummaries.length, 0, 'Action risk inventory: empty domain summaries are empty');
  equal(inventory.surfaces.length, 0, 'Action risk inventory: empty surfaces are empty');
}

function testInventorySurfacesDomainScopeGaps(): void {
  const inventory = createActionRiskInventory({
    events: [
      event({
        actor: 'analytics-ai-agent',
        action: 'export_customer_report',
        domain: 'data-disclosure',
        downstreamSystem: 'report-delivery',
        policyRef: 'policy:reports:v1',
        evidenceRefs: ['ticket:data-scope'],
        occurredAt: '2026-05-01T22:31:02.000Z',
      }),
    ],
    generatedAt: '2026-05-01T22:32:00.000Z',
  });
  const surface = inventory.surfaces.find((item) =>
    item.actionSurface === 'report-delivery.export_customer_report'
  );

  equal(surface?.gapCounts.dataScope, 1, 'Action risk inventory: data scope gaps are counted');
  ok(surface?.riskSignals.includes('scope-gap'), 'Action risk inventory: scope gaps are surfaced');
  equal(surface?.recommendedNextStep, 'bind-scope', 'Action risk inventory: scope gap recommends binding scope');
}

testInventoryRanksAndSummarizesActionSurfaces();
testEmptyInventoryIsExplicit();
testInventorySurfacesDomainScopeGaps();

console.log(`Action risk inventory tests: ${passed} passed, 0 failed`);
