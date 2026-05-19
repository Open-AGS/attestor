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
import {
  GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
  type GoldenRefundEngineVisibilityGate,
} from './golden-refund-engine-visibility.js';
import {
  type GoldenRefundShadowFixtureRefundFacts,
  type GoldenRefundShadowFixturePosture,
} from './golden-refund-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_REFUND_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-refund-reviewer-sandbox.v1';
export const GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-refund-reviewer-sandbox-input.v1';

export const GOLDEN_REFUND_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'requestedAmountBucket',
  'refundReason',
  'refundMethod',
  'priorRefundCountClass',
  'evidenceFreshness',
  'approvalRequired',
  'externalFraudSignal',
  'instructionLikeEvidence',
  'policyLimitPosture',
] as const;

export const GOLDEN_REFUND_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'json-schema-allowlisted-shape',
  'owasp-input-validation-allowlist',
  'node-readfilesync-local-fixture-read',
  'terraform-plan-preview-without-apply',
  'kubernetes-dry-run-no-persistence',
  'stripe-idempotency-replay-discipline',
] as const;

export type GoldenRefundReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenRefundReviewerSandboxInput {
  readonly version: typeof GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly requestedAmountBucket: GoldenRefundShadowFixtureRefundFacts['requestedAmountBucket'];
  readonly refundReason: GoldenRefundShadowFixtureRefundFacts['refundReason'];
  readonly refundMethod: GoldenRefundShadowFixtureRefundFacts['refundMethod'];
  readonly priorRefundCountClass: GoldenRefundShadowFixtureRefundFacts['priorRefundCountClass'];
  readonly evidenceFreshness: GoldenRefundShadowFixtureRefundFacts['evidenceFreshness'];
  readonly approvalRequired: boolean;
  readonly externalFraudSignal: GoldenRefundShadowFixtureRefundFacts['externalFraudSignal'];
  readonly instructionLikeEvidence: boolean;
  readonly policyLimitPosture: GoldenRefundShadowFixtureRefundFacts['policyLimitPosture'];
}

export interface GoldenRefundReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface GoldenRefundReviewerSandboxDecisionSummary {
  readonly shadowDecision: CanonicalShadowEventDecision['shadowDecision'];
  readonly effectiveDecision: CanonicalShadowEventDecision['effectiveDecision'];
  readonly packetDecision: 'admit' | 'narrow' | 'review' | 'block';
  readonly fusionPosture: string;
  readonly conflictOutcome: string;
  readonly humanStatus: string;
  readonly evidenceCompletenessPercent: number;
  readonly reasonCodes: readonly string[];
  readonly decisionRelevantDigest: string;
}

export interface GoldenRefundReviewerSandboxResult {
  readonly version: typeof GOLDEN_REFUND_REVIEWER_SANDBOX_VERSION;
  readonly step: 'G09';
  readonly generatedAt: string;
  readonly inputVersion: typeof GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenRefundReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'refund_service.issue_refund';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenRefundShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: readonly GoldenRefundEngineVisibilityGate[];
  readonly decisionSummary: GoldenRefundReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_REFUND_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenRefundReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-19T11:45:00.000Z';
const BASE_OCCURRED_AT = '2026-05-19T11:45:00.000Z';
const BASE_OBSERVED_AT = '2026-05-19T11:45:01.000Z';
const ENGINE_SCOPE = 'refund_service.issue_refund' as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const REQUESTED_AMOUNT_BUCKETS = [
  '0-25-usd',
  '25-100-usd',
  '100-250-usd',
  '250-1000-usd',
] as const;
const REFUND_REASONS: readonly GoldenRefundShadowFixtureRefundFacts['refundReason'][] = [
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'service_failure',
  'policy_exception',
] as const;
const REFUND_METHODS: readonly GoldenRefundShadowFixtureRefundFacts['refundMethod'][] = [
  'original_payment_method',
  'store_credit',
  'manual_review_only',
] as const;
const PRIOR_REFUND_COUNT_CLASSES:
readonly GoldenRefundShadowFixtureRefundFacts['priorRefundCountClass'][] = [
  'none',
  'one',
  'multiple',
] as const;
const EVIDENCE_FRESHNESS_VALUES:
readonly GoldenRefundShadowFixtureRefundFacts['evidenceFreshness'][] = [
  'fresh',
  'stale',
  'missing',
] as const;
const EXTERNAL_FRAUD_SIGNAL_VALUES:
readonly GoldenRefundShadowFixtureRefundFacts['externalFraudSignal'][] = [
  'none',
  'low',
  'high',
] as const;
const POLICY_LIMIT_POSTURES:
readonly GoldenRefundShadowFixtureRefundFacts['policyLimitPosture'][] = [
  'within-policy',
  'over-policy',
] as const;

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

function digestFor(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safetyBoundary(): GoldenRefundReviewerSandboxSafetyBoundary {
  return Object.freeze({
    noTargetSystemCall: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-live-refund-execution',
    'not-target-system-call',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
    'not-general-byo-action-runtime',
  ]);
}

function includesString<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function validateInput(raw: unknown): {
  readonly input: GoldenRefundReviewerSandboxInput | null;
  readonly errors: readonly string[];
  readonly requestedActionSurface: string | null;
} {
  if (!isRecord(raw)) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(['input must be a JSON object']),
      requestedActionSurface: null,
    });
  }

  const errors: string[] = [];
  for (const key of Object.keys(raw).sort()) {
    if (!(GOLDEN_REFUND_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  const version = raw.version;
  if (version !== GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION}`);
  }

  const actionSurface = raw.actionSurface;
  const requestedActionSurface = typeof actionSurface === 'string'
    ? actionSurface.trim()
    : null;
  if (
    typeof actionSurface !== 'string' ||
    actionSurface.trim().length === 0 ||
    actionSurface.trim().length > 96 ||
    CONTROL_CHARACTER_PATTERN.test(actionSurface)
  ) {
    errors.push('actionSurface must be a non-empty bounded string');
  }

  if (!includesString(REQUESTED_AMOUNT_BUCKETS, raw.requestedAmountBucket)) {
    errors.push(`requestedAmountBucket must be one of ${REQUESTED_AMOUNT_BUCKETS.join(', ')}`);
  }
  if (!includesString(REFUND_REASONS, raw.refundReason)) {
    errors.push(`refundReason must be one of ${REFUND_REASONS.join(', ')}`);
  }
  if (!includesString(REFUND_METHODS, raw.refundMethod)) {
    errors.push(`refundMethod must be one of ${REFUND_METHODS.join(', ')}`);
  }
  if (!includesString(PRIOR_REFUND_COUNT_CLASSES, raw.priorRefundCountClass)) {
    errors.push(
      `priorRefundCountClass must be one of ${PRIOR_REFUND_COUNT_CLASSES.join(', ')}`,
    );
  }
  if (!includesString(EVIDENCE_FRESHNESS_VALUES, raw.evidenceFreshness)) {
    errors.push(`evidenceFreshness must be one of ${EVIDENCE_FRESHNESS_VALUES.join(', ')}`);
  }
  if (typeof raw.approvalRequired !== 'boolean') {
    errors.push('approvalRequired must be boolean');
  }
  if (!includesString(EXTERNAL_FRAUD_SIGNAL_VALUES, raw.externalFraudSignal)) {
    errors.push(`externalFraudSignal must be one of ${EXTERNAL_FRAUD_SIGNAL_VALUES.join(', ')}`);
  }
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (!includesString(POLICY_LIMIT_POSTURES, raw.policyLimitPosture)) {
    errors.push(`policyLimitPosture must be one of ${POLICY_LIMIT_POSTURES.join(', ')}`);
  }

  if (errors.length > 0) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(errors),
      requestedActionSurface,
    });
  }

  return Object.freeze({
    input: Object.freeze({
      version: GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      requestedAmountBucket: raw.requestedAmountBucket as
        GoldenRefundShadowFixtureRefundFacts['requestedAmountBucket'],
      refundReason: raw.refundReason as GoldenRefundShadowFixtureRefundFacts['refundReason'],
      refundMethod: raw.refundMethod as GoldenRefundShadowFixtureRefundFacts['refundMethod'],
      priorRefundCountClass: raw.priorRefundCountClass as
        GoldenRefundShadowFixtureRefundFacts['priorRefundCountClass'],
      evidenceFreshness: raw.evidenceFreshness as
        GoldenRefundShadowFixtureRefundFacts['evidenceFreshness'],
      approvalRequired: raw.approvalRequired as boolean,
      externalFraudSignal: raw.externalFraudSignal as
        GoldenRefundShadowFixtureRefundFacts['externalFraudSignal'],
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      policyLimitPosture: raw.policyLimitPosture as
        GoldenRefundShadowFixtureRefundFacts['policyLimitPosture'],
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenRefundReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (!input.approvalRequired && input.refundMethod === 'manual_review_only') {
    reasons.push('refund:inconsistent-input-detected');
  }
  if (!input.approvalRequired && input.externalFraudSignal === 'high') {
    reasons.push('refund:inconsistent-input-detected');
  }
  if (!input.approvalRequired && input.policyLimitPosture === 'over-policy') {
    reasons.push('refund:inconsistent-input-detected');
  }
  if (input.evidenceFreshness === 'missing') {
    reasons.push('refund:missing-payment-evidence', 'refund:hold-for-evidence');
  }
  if (input.evidenceFreshness === 'stale') {
    reasons.push('refund:stale-payment-evidence', 'refund:review-for-freshness');
  }
  if (input.priorRefundCountClass === 'multiple') {
    reasons.push('refund:prior-refund-multiple', 'refund:relationship-review-required');
  }
  if (input.approvalRequired) {
    reasons.push('refund:human-approval-required');
  }
  if (input.instructionLikeEvidence) {
    reasons.push(
      'refund:instruction-like-evidence-text',
      'refund:ignore-evidence-as-instruction',
    );
  }
  if (input.externalFraudSignal === 'high') {
    reasons.push('refund:external-fraud-signal-high', 'refund:review-external-risk-signal');
  }
  if (input.policyLimitPosture === 'over-policy') {
    reasons.push('refund:over-policy-amount', 'refund:policy-limit-review-required');
  }
  if (reasons.length === 1) {
    reasons.push('refund:evidence-complete', 'refund:shadow-ready');
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenRefundReviewerSandboxInput,
): GoldenRefundShadowFixturePosture {
  if (input.evidenceFreshness === 'missing') return 'needs-evidence';
  if (input.evidenceFreshness === 'stale') return 'needs-freshness-review';
  if (input.instructionLikeEvidence) return 'needs-instruction-text-review';
  if (input.externalFraudSignal === 'high') return 'needs-external-risk-review';
  if (input.policyLimitPosture === 'over-policy') return 'needs-policy-limit-review';
  if (input.approvalRequired) return 'needs-human-approval';
  if (input.priorRefundCountClass === 'multiple') return 'needs-relationship-review';
  return 'shadow-ready';
}

function decisionFor(
  input: GoldenRefundReviewerSandboxInput,
  issueCodes: readonly string[],
): CanonicalShadowEventDecision {
  const reviewNeeded = issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'refund:evidence-complete' &&
    code !== 'refund:shadow-ready'
  );
  const shadowDecision = input.evidenceFreshness === 'missing'
    ? 'would_block'
    : input.policyLimitPosture === 'over-policy'
      ? 'would_narrow'
      : reviewNeeded
        ? 'would_review'
        : 'would_admit';
  return Object.freeze({
    admissionDigest: null,
    mode: reviewNeeded ? 'review' : 'observe',
    shadowDecision,
    effectiveDecision: input.evidenceFreshness === 'missing' ? 'block' : 'review',
    allowed: false,
    failClosed: true,
    reasonCodes: issueCodes,
  });
}

function ref(
  kind: CanonicalShadowEventReference['kind'],
  value: CanonicalReleaseJsonValue,
  origin: CanonicalShadowEventReference['origin'] = 'observed',
): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: digestFor(kind, value),
    origin,
  });
}

function evidenceSeedsFor(
  input: GoldenRefundReviewerSandboxInput,
  issueCodes: readonly string[],
): readonly string[] {
  const seeds = [
    'order-evidence',
    'customer-authority',
    `prior-refund-${input.priorRefundCountClass}`,
  ];
  if (input.evidenceFreshness === 'fresh') seeds.push('payment-evidence');
  if (input.evidenceFreshness === 'stale') seeds.push('payment-evidence-stale');
  if (input.instructionLikeEvidence) seeds.push('instruction-like-evidence-digest');
  if (input.externalFraudSignal !== 'none') {
    seeds.push(`external-fraud-signal-${input.externalFraudSignal}`);
  }
  if (input.policyLimitPosture === 'over-policy') seeds.push('policy-limit-evidence');
  if (issueCodes.includes('refund:inconsistent-input-detected')) {
    seeds.push('inconsistent-input-detected');
  }
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenRefundReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-refund-reviewer-sandbox',
    inputDigest,
  });
  const targetAccountRefDigest = digestFor(
    'target-account',
    'golden-refund-reviewer-sandbox',
  );
  const scenarioPrefix = `golden-refund-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-refund-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-refund-reviewer-sandbox-tenant'),
    actorRefDigest: digestFor('actor', 'golden-refund-reviewer-sandbox-reviewer'),
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest,
      dataClass: 'money-movement',
      amountAssetChain: {
        amountBucket: input.requestedAmountBucket,
        assetRefDigest: digestFor('asset', 'usd'),
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
      authorityDelta: input.approvalRequired
        ? {
            authorityKind: 'refund-review-approval-required',
            principalRefDigest: digestFor('actor', 'golden-refund-reviewer-role'),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'refund-approval'),
          }
        : null,
    },
    decision: decisionFor(input, issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: input.approvalRequired ? 'not-reviewed' : null,
    },
    evidenceRefs: evidenceSeedsFor(input, issueCodes).map((seed) =>
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
    idempotencyRefDigest: digestFor('idempotency', {
      scope: 'golden-refund-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-refund-reviewer-sandbox',
      inputDigest,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-refund-reviewer-sandbox',
      inputDigest,
    }),
    schemaRefDigest: digestFor('schema', CANONICAL_SHADOW_EVENT_SCHEMA_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
}

function runSandboxSmoke(
  event: CanonicalShadowEvent,
  inputDigest: string,
): ShadowRuntimeFixtureReplaySmokeResult {
  const fixtureRefDigest = digestFor('golden-refund-reviewer-sandbox.fixture', {
    inputDigest,
    eventDigest: event.digest,
  });
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: 'golden-refund-reviewer-sandbox:reviewer-input',
    fixtureRefDigest,
    event,
    sourcePartitionDigest: digestFor(
      'golden-refund-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-refund-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-refund-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-19T11:45:02.000Z',
    claimedAt: '2026-05-19T11:45:03.000Z',
    generatedAt: '2026-05-19T11:45:04.000Z',
    observedAt: '2026-05-19T11:45:05.000Z',
    outcomeObservedAt: '2026-05-19T11:45:06.000Z',
    feedbackGeneratedAt: '2026-05-19T11:45:07.000Z',
    evaluatedAt: '2026-05-19T11:45:08.000Z',
    workerRefDigest: digestFor('golden-refund-reviewer-sandbox.worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor(
      'golden-refund-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-refund-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-refund-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-refund-reviewer-sandbox.scope',
      'shadow-only-reviewer-sandbox',
    ),
  });
}

function completenessPercent(coverageGapScore: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - coverageGapScore) * 100)));
}

function decisionSummaryFor(input: {
  readonly event: CanonicalShadowEvent;
  readonly smoke: ShadowRuntimeFixtureReplaySmokeResult;
  readonly issueCodes: readonly string[];
}): GoldenRefundReviewerSandboxDecisionSummary {
  const pipeline = input.smoke.activation.pipeline;
  const material = {
    shadowDecision: input.event.decision.shadowDecision,
    effectiveDecision: input.event.decision.effectiveDecision,
    packetDecision: pipeline.assurancePacket.decisionBinding.decision,
    fusionPosture: pipeline.fusion.posture,
    conflictOutcome: pipeline.conflictGate.outcome,
    humanStatus: pipeline.humanComprehensionGate.status,
    evidenceCompletenessPercent: completenessPercent(
      pipeline.conflictGate.coverageGapScore,
    ),
    reasonCodes: Object.freeze([...new Set([
      ...input.issueCodes,
      ...pipeline.fusion.reasonCodes,
      ...pipeline.conflictGate.reasonCodes,
      ...pipeline.humanComprehensionGate.reasonCodes,
      ...pipeline.assurancePacket.decisionBinding.reasonCodes,
    ])].sort()),
  } as const;
  return Object.freeze({
    ...material,
    decisionRelevantDigest: digestFor(
      'golden-refund-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(input: Omit<GoldenRefundReviewerSandboxResult, 'canonical' | 'digest'>):
GoldenRefundReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenRefundReviewerSandbox(
  rawInput: unknown,
): GoldenRefundReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_REFUND_REVIEWER_SANDBOX_VERSION,
      step: 'G09',
      generatedAt: GENERATED_AT,
      inputVersion: null,
      inputStatus: 'invalid-schema',
      inputDigest: null,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.requestedActionSurface,
      schemaErrors: validated.errors,
      issueCodes: Object.freeze(['reviewer-sandbox:invalid-schema']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_REFUND_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-refund-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_REFUND_REVIEWER_SANDBOX_VERSION,
      step: 'G09',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-refund-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_REFUND_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const issueCodes = detectIssueCodes(validated.input);
  const event = createSandboxEvent(validated.input, inputDigest, issueCodes);
  const smoke = runSandboxSmoke(event, inputDigest);
  const decisionSummary = decisionSummaryFor({ event, smoke, issueCodes });
  return resultFor({
    version: GOLDEN_REFUND_REVIEWER_SANDBOX_VERSION,
    step: 'G09',
    generatedAt: GENERATED_AT,
    inputVersion: validated.input.version,
    inputStatus: 'accepted',
    inputDigest,
    engineScope: ENGINE_SCOPE,
    requestedActionSurface: validated.input.actionSurface,
    schemaErrors: Object.freeze([]),
    issueCodes,
    expectedPosture: expectedPostureFor(validated.input),
    eventDigest: event.digest,
    smokeDigest: smoke.digest,
    envelopeRefDigest: smoke.envelopeRefDigest,
    assurancePacketDigest: smoke.activation.assurancePacketDigest,
    gateOrder: GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_REFUND_REVIEWER_SANDBOX_SOURCE_ANCHORS,
    noClaims: noClaims(),
    safetyBoundary: safetyBoundary(),
    engineRan: true,
    shadowOnly: true,
    previewOnly: true,
    reviewerSupplied: true,
  });
}

function list(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function renderGoldenRefundReviewerSandboxMarkdown(
  result: GoldenRefundReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: Refund Reviewer Sandbox

Status: ${result.inputStatus}

## Input Boundary

- engine scope: ${result.engineScope}
- requested action surface: ${result.requestedActionSurface ?? 'not provided'}
- engine ran: ${result.engineRan}
- input digest: ${result.inputDigest ?? 'none'}

## Schema Errors

${list(result.schemaErrors)}

## Issue Codes

${list(result.issueCodes)}

## Decision Summary

- expected posture: ${result.expectedPosture ?? 'none'}
- shadow decision: ${decision?.shadowDecision ?? 'none'}
- effective decision: ${decision?.effectiveDecision ?? 'none'}
- packet decision: ${decision?.packetDecision ?? 'none'}
- fusion posture: ${decision?.fusionPosture ?? 'none'}
- conflict outcome: ${decision?.conflictOutcome ?? 'none'}
- human gate: ${decision?.humanStatus ?? 'none'}
- evidence completeness: ${decision?.evidenceCompletenessPercent ?? 0}%
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Gate Trace

${result.gateOrder.map((gate, index) => `${index + 1}. ${gate}`).join('\n')}

## No-Claims

${list(result.noClaims)}

## Safety Boundary

- target-system calls: ${result.safetyBoundary.noTargetSystemCall ? '0' : 'present'}
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenRefundReviewerSandboxJson(
  result: GoldenRefundReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
