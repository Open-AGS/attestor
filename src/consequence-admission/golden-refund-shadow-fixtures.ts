import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
} from './canonical-shadow-event-schema.js';

export const GOLDEN_REFUND_SHADOW_FIXTURES_VERSION =
  'attestor.golden-refund-shadow-fixtures.v1';

export const GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS = [
  'normal',
  'missing-evidence',
  'stale-evidence',
  'repeated-refund',
  'approval-required',
] as const;
export type GoldenRefundShadowFixtureScenario =
  typeof GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS[number];

export const GOLDEN_REFUND_SHADOW_FIXTURE_POSTURES = [
  'shadow-ready',
  'needs-evidence',
  'needs-freshness-review',
  'needs-relationship-review',
  'needs-human-approval',
] as const;
export type GoldenRefundShadowFixturePosture =
  typeof GOLDEN_REFUND_SHADOW_FIXTURE_POSTURES[number];

export const GOLDEN_REFUND_SHADOW_FIXTURE_NON_CLAIMS = [
  'not-live-refund-execution',
  'not-live-connector-coverage',
  'not-policy-activation',
  'not-runtime-worker-readiness',
  'not-production-ready',
] as const;

export interface GoldenRefundShadowFixtureRefundFacts {
  readonly requestedAmountBucket: string;
  readonly refundReason:
    | 'duplicate'
    | 'fraudulent'
    | 'requested_by_customer'
    | 'service_failure'
    | 'policy_exception';
  readonly refundMethod:
    | 'original_payment_method'
    | 'store_credit'
    | 'manual_review_only';
  readonly priorRefundCountClass: 'none' | 'one' | 'multiple';
  readonly evidenceFreshness: 'fresh' | 'stale' | 'missing';
  readonly approvalRequired: boolean;
}

export interface GoldenRefundShadowFixture {
  readonly version: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly scenario: GoldenRefundShadowFixtureScenario;
  readonly fixtureId: string;
  readonly expectedPosture: GoldenRefundShadowFixturePosture;
  readonly refundFacts: GoldenRefundShadowFixtureRefundFacts;
  readonly event: CanonicalShadowEvent;
  readonly sourceManifestRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly fixtureOnly: true;
  readonly synthetic: true;
  readonly shadowOnly: true;
  readonly noTargetSystemCall: true;
  readonly noRawPayload: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenRefundShadowFixtureSuite {
  readonly version: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly name: 'Golden Path: Refund';
  readonly step: 'G03';
  readonly sourceManifestRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly fixtureCount: 5;
  readonly scenarios: typeof GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS;
  readonly fixtures: readonly GoldenRefundShadowFixture[];
  readonly shadowOnly: true;
  readonly noTargetSystemCalls: true;
  readonly noRawPayload: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenRefundShadowFixturesDescriptor {
  readonly version: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly step: 'G03';
  readonly sourceSchemaVersion: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly scenarios: typeof GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS;
  readonly shadowOnly: true;
  readonly synthetic: true;
  readonly noTargetSystemCalls: true;
  readonly noRawPayload: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: typeof GOLDEN_REFUND_SHADOW_FIXTURE_NON_CLAIMS;
}

interface ScenarioDefinition {
  readonly scenario: GoldenRefundShadowFixtureScenario;
  readonly expectedPosture: GoldenRefundShadowFixturePosture;
  readonly refundFacts: GoldenRefundShadowFixtureRefundFacts;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly decision: CanonicalShadowEventDecision;
  readonly evidenceSeeds: readonly string[];
}

const BASE_OCCURRED_AT = '2026-05-19T06:00:00.000Z';
const BASE_OBSERVED_AT = '2026-05-19T06:00:01.000Z';

const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = Object.freeze([
  {
    scenario: 'normal',
    expectedPosture: 'shadow-ready',
    refundFacts: Object.freeze({
      requestedAmountBucket: '0-25-usd',
      refundReason: 'requested_by_customer',
      refundMethod: 'original_payment_method',
      priorRefundCountClass: 'none',
      evidenceFreshness: 'fresh',
      approvalRequired: false,
    }),
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'enforceable']),
    expectedSignals: Object.freeze(['evidence-complete', 'refund-shadow-ready']),
    reasonCodes: Object.freeze([
      'refund:evidence-complete',
      'refund:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'refund:evidence-complete',
        'refund:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze([
      'order-evidence',
      'payment-evidence',
      'customer-authority',
      'prior-refund-none',
    ]),
  },
  {
    scenario: 'missing-evidence',
    expectedPosture: 'needs-evidence',
    refundFacts: Object.freeze({
      requestedAmountBucket: '0-25-usd',
      refundReason: 'service_failure',
      refundMethod: 'original_payment_method',
      priorRefundCountClass: 'none',
      evidenceFreshness: 'missing',
      approvalRequired: false,
    }),
    expectedEvidenceStates: Object.freeze(['observed', 'missing']),
    expectedSignals: Object.freeze(['payment-evidence-gap', 'undermining-defeater']),
    reasonCodes: Object.freeze([
      'refund:missing-payment-evidence',
      'refund:hold-for-evidence',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'refund:hold-for-evidence',
        'refund:missing-payment-evidence',
      ]),
    }),
    evidenceSeeds: Object.freeze([
      'order-evidence',
      'customer-authority',
      'prior-refund-none',
    ]),
  },
  {
    scenario: 'stale-evidence',
    expectedPosture: 'needs-freshness-review',
    refundFacts: Object.freeze({
      requestedAmountBucket: '25-100-usd',
      refundReason: 'policy_exception',
      refundMethod: 'manual_review_only',
      priorRefundCountClass: 'none',
      evidenceFreshness: 'stale',
      approvalRequired: true,
    }),
    expectedEvidenceStates: Object.freeze(['observed', 'stale']),
    expectedSignals: Object.freeze(['freshness-gap', 'review-required']),
    reasonCodes: Object.freeze([
      'refund:stale-payment-evidence',
      'refund:review-for-freshness',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'refund:review-for-freshness',
        'refund:stale-payment-evidence',
      ]),
    }),
    evidenceSeeds: Object.freeze([
      'order-evidence',
      'payment-evidence-stale',
      'customer-authority',
      'prior-refund-none',
    ]),
  },
  {
    scenario: 'repeated-refund',
    expectedPosture: 'needs-relationship-review',
    refundFacts: Object.freeze({
      requestedAmountBucket: '25-100-usd',
      refundReason: 'duplicate',
      refundMethod: 'original_payment_method',
      priorRefundCountClass: 'multiple',
      evidenceFreshness: 'fresh',
      approvalRequired: true,
    }),
    expectedEvidenceStates: Object.freeze(['observed', 'conflicting', 'approved']),
    expectedSignals: Object.freeze(['prior-refund-escalates', 'relationship-review']),
    reasonCodes: Object.freeze([
      'refund:prior-refund-multiple',
      'refund:relationship-review-required',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'refund:prior-refund-multiple',
        'refund:relationship-review-required',
      ]),
    }),
    evidenceSeeds: Object.freeze([
      'order-evidence',
      'payment-evidence',
      'customer-authority',
      'prior-refund-multiple',
    ]),
  },
  {
    scenario: 'approval-required',
    expectedPosture: 'needs-human-approval',
    refundFacts: Object.freeze({
      requestedAmountBucket: '100-250-usd',
      refundReason: 'fraudulent',
      refundMethod: 'manual_review_only',
      priorRefundCountClass: 'one',
      evidenceFreshness: 'fresh',
      approvalRequired: true,
    }),
    expectedEvidenceStates: Object.freeze(['observed', 'approved', 'review-required']),
    expectedSignals: Object.freeze(['authority-gap', 'human-approval-required']),
    reasonCodes: Object.freeze([
      'refund:human-approval-required',
      'refund:manual-review-only',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'refund:human-approval-required',
        'refund:manual-review-only',
      ]),
    }),
    evidenceSeeds: Object.freeze([
      'order-evidence',
      'payment-evidence',
      'customer-authority',
      'prior-refund-one',
    ]),
  },
]);

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestFor(kind: string, value: string): string {
  return canonicalObject({ kind, value }).digest;
}

function ref(
  kind: CanonicalShadowEventReference['kind'],
  value: string,
  origin: CanonicalShadowEventReference['origin'] = 'observed',
): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: digestFor(kind, value),
    origin,
  });
}

function createScenarioEvent(definition: ScenarioDefinition): CanonicalShadowEvent {
  const targetAccountRefDigest = digestFor('target-account', 'golden-refund-shadow');
  const resourceRefDigest = digestFor('resource', `refund:${definition.scenario}`);
  const assetRefDigest = digestFor('asset', 'usd');
  const scenarioPrefix = `golden-refund:${definition.scenario}`;

  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-refund-shadow-fixtures',
    tenantRefDigest: digestFor('tenant', 'golden-refund-synthetic-tenant'),
    actorRefDigest: digestFor('actor', 'golden-refund-synthetic-agent'),
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest,
      dataClass: 'money-movement',
      amountAssetChain: {
        amountBucket: definition.refundFacts.requestedAmountBucket,
        assetRefDigest,
        chainRefDigest: null,
      },
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'financial',
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: definition.refundFacts.approvalRequired
        ? {
            authorityKind: 'refund-review-approval-required',
            principalRefDigest: digestFor('actor', 'golden-refund-reviewer-role'),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'refund-approval'),
          }
        : null,
    },
    decision: definition.decision,
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: definition.refundFacts.approvalRequired ? 'not-reviewed' : null,
    },
    evidenceRefs: definition.evidenceSeeds.map((seed) =>
      ref('evidence', `${scenarioPrefix}:${seed}`)
    ),
    simulationRefs: [
      ref('simulation', `${scenarioPrefix}:shadow-runtime-replay`, 'inferred'),
    ],
    approvalRefs: [],
    receiptRefs: [],
    policyRefs: [
      ref('policy', `${scenarioPrefix}:review-only-policy-candidate`, 'inferred'),
    ],
    idempotencyRefDigest: digestFor('idempotency', `${scenarioPrefix}:idempotency`),
    replayRefDigest: digestFor('replay', `${scenarioPrefix}:replay`),
    traceRefDigest: digestFor('trace', `${scenarioPrefix}:trace`),
    schemaRefDigest: digestFor('schema', CANONICAL_SHADOW_EVENT_SCHEMA_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
}

function createFixture(definition: ScenarioDefinition): GoldenRefundShadowFixture {
  const sourceManifestRefDigest = digestFor(
    'action-surface',
    'examples/action-surface-onboarding/refund.openapi.json',
  );
  const actionSurfaceRefDigest = digestFor('action-surface', 'refunds.issue_refund');
  const event = createScenarioEvent(definition);
  const payload = {
    version: GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
    scenario: definition.scenario,
    fixtureId: `golden-refund:${definition.scenario}`,
    expectedPosture: definition.expectedPosture,
    refundFacts: definition.refundFacts,
    eventDigest: event.digest,
    sourceManifestRefDigest,
    actionSurfaceRefDigest,
    expectedEvidenceStates: definition.expectedEvidenceStates,
    expectedSignals: definition.expectedSignals,
    reasonCodes: definition.reasonCodes,
    fixtureOnly: true,
    synthetic: true,
    shadowOnly: true,
    noTargetSystemCall: true,
    noRawPayload: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    event,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createGoldenRefundShadowFixtureSuite(): GoldenRefundShadowFixtureSuite {
  const fixtures = Object.freeze(SCENARIO_DEFINITIONS.map(createFixture));
  const sourceManifestRefDigest = digestFor(
    'action-surface',
    'examples/action-surface-onboarding/refund.openapi.json',
  );
  const actionSurfaceRefDigest = digestFor('action-surface', 'refunds.issue_refund');
  const payload = {
    version: GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
    name: 'Golden Path: Refund',
    step: 'G03',
    sourceManifestRefDigest,
    actionSurfaceRefDigest,
    fixtureCount: fixtures.length,
    scenarios: GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS,
    fixtureDigests: fixtures.map((fixture) => fixture.digest),
    shadowOnly: true,
    noTargetSystemCalls: true,
    noRawPayload: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    fixtureCount: 5,
    fixtures,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenRefundShadowFixturesDescriptor(): GoldenRefundShadowFixturesDescriptor {
  return Object.freeze({
    version: GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
    step: 'G03',
    sourceSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    scenarios: GOLDEN_REFUND_SHADOW_FIXTURE_SCENARIOS,
    shadowOnly: true,
    synthetic: true,
    noTargetSystemCalls: true,
    noRawPayload: true,
    autoEnforce: false,
    productionReady: false,
    nonClaims: GOLDEN_REFUND_SHADOW_FIXTURE_NON_CLAIMS,
  });
}
