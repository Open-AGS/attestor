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
  type GoldenExternalCommunicationShadowFixtureMessageFacts,
  type GoldenExternalCommunicationShadowFixturePosture,
} from './golden-external-communication-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';
import {
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION,
  type GoldenExternalCommunicationReviewerSandboxDecisionSummary,
  type GoldenExternalCommunicationReviewerSandboxInput,
  type GoldenExternalCommunicationReviewerSandboxResult,
} from './golden-external-communication-reviewer-sandbox-types.js';
import {
  externalCommunicationReviewerSandboxNoClaims,
  externalCommunicationReviewerSandboxSafetyBoundary,
} from './golden-external-communication-reviewer-sandbox-boundary.js';

export {
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION,
} from './golden-external-communication-reviewer-sandbox-types.js';
export type {
  GoldenExternalCommunicationReviewerSandboxDecisionSummary,
  GoldenExternalCommunicationReviewerSandboxGate,
  GoldenExternalCommunicationReviewerSandboxInput,
  GoldenExternalCommunicationReviewerSandboxResult,
  GoldenExternalCommunicationReviewerSandboxSafetyBoundary,
  GoldenExternalCommunicationReviewerSandboxStatus,
} from './golden-external-communication-reviewer-sandbox-types.js';

const GENERATED_AT = '2026-05-26T11:15:00.000Z';
const BASE_OCCURRED_AT = '2026-05-26T11:15:00.000Z';
const BASE_OBSERVED_AT = '2026-05-26T11:15:01.000Z';
const ENGINE_SCOPE = 'external_communication.customer_message' as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const CHANNEL_CLASSES: readonly GoldenExternalCommunicationShadowFixtureMessageFacts['channelClass'][] = [
  'support-ticket',
  'email',
  'status-page',
  'sms',
  'public-post',
] as const;
const MESSAGE_CLASSES: readonly GoldenExternalCommunicationShadowFixtureMessageFacts['messageClass'][] = [
  'support-reply',
  'billing-notice',
  'refund-or-credit-notice',
  'legal-notice',
  'public-status-update',
  'commercial-email',
] as const;
const RECIPIENT_CLASSES: readonly GoldenExternalCommunicationShadowFixtureMessageFacts['recipientClass'][] = [
  'customer-account-owner',
  'approved-billing-contact',
  'internal-support',
  'wrong-recipient',
  'public-audience',
  'suppression-list-contact',
] as const;
const CLAIM_CLASSES: readonly GoldenExternalCommunicationShadowFixtureMessageFacts['claimClass'][] = [
  'factual-case-update',
  'refund-or-credit-promise',
  'legal-liability-statement',
  'compliance-or-production-claim',
  'commercial-offer',
  'operational-status',
] as const;
const APPROVAL_FRESHNESS_VALUES:
readonly GoldenExternalCommunicationShadowFixtureMessageFacts['approvalFreshness'][] = [
  'fresh',
  'stale',
  'missing',
] as const;
const TENANT_SCOPE_VALUES: readonly GoldenExternalCommunicationShadowFixtureMessageFacts['tenantScope'][] = [
  'tenant-bound',
  'tenant-mismatch',
] as const;
const COMMERCIAL_EMAIL_POSTURE_VALUES:
readonly GoldenExternalCommunicationShadowFixtureMessageFacts['commercialEmailPosture'][] = [
  'not-applicable',
  'complete',
  'missing-unsubscribe-or-sender-controls',
] as const;
const EVIDENCE_AUTHORITY_VALUES:
readonly GoldenExternalCommunicationShadowFixtureMessageFacts['evidenceAuthority'][] = [
  'verified-system-record',
  'operator-approval',
  'untrusted-ticket-text',
  'model-rationale-only',
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

function includesString<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function validateInput(raw: unknown): {
  readonly input: GoldenExternalCommunicationReviewerSandboxInput | null;
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
    if (!(GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  if (raw.version !== GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION}`);
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

  if (!includesString(CHANNEL_CLASSES, raw.channelClass)) {
    errors.push(`channelClass must be one of ${CHANNEL_CLASSES.join(', ')}`);
  }
  if (!includesString(MESSAGE_CLASSES, raw.messageClass)) {
    errors.push(`messageClass must be one of ${MESSAGE_CLASSES.join(', ')}`);
  }
  if (!includesString(RECIPIENT_CLASSES, raw.recipientClass)) {
    errors.push(`recipientClass must be one of ${RECIPIENT_CLASSES.join(', ')}`);
  }
  if (!includesString(CLAIM_CLASSES, raw.claimClass)) {
    errors.push(`claimClass must be one of ${CLAIM_CLASSES.join(', ')}`);
  }
  if (!includesString(APPROVAL_FRESHNESS_VALUES, raw.approvalFreshness)) {
    errors.push(`approvalFreshness must be one of ${APPROVAL_FRESHNESS_VALUES.join(', ')}`);
  }
  if (!includesString(TENANT_SCOPE_VALUES, raw.tenantScope)) {
    errors.push(`tenantScope must be one of ${TENANT_SCOPE_VALUES.join(', ')}`);
  }
  if (!includesString(COMMERCIAL_EMAIL_POSTURE_VALUES, raw.commercialEmailPosture)) {
    errors.push(
      `commercialEmailPosture must be one of ${COMMERCIAL_EMAIL_POSTURE_VALUES.join(', ')}`,
    );
  }
  if (!includesString(EVIDENCE_AUTHORITY_VALUES, raw.evidenceAuthority)) {
    errors.push(`evidenceAuthority must be one of ${EVIDENCE_AUTHORITY_VALUES.join(', ')}`);
  }
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (typeof raw.publicClaim !== 'boolean') errors.push('publicClaim must be boolean');
  if (typeof raw.externalSideEffect !== 'boolean') {
    errors.push('externalSideEffect must be boolean');
  }
  if (typeof raw.duplicateSendAttempt !== 'boolean') {
    errors.push('duplicateSendAttempt must be boolean');
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
      version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      channelClass: raw.channelClass as GoldenExternalCommunicationShadowFixtureMessageFacts['channelClass'],
      messageClass: raw.messageClass as GoldenExternalCommunicationShadowFixtureMessageFacts['messageClass'],
      recipientClass: raw.recipientClass as GoldenExternalCommunicationShadowFixtureMessageFacts['recipientClass'],
      claimClass: raw.claimClass as GoldenExternalCommunicationShadowFixtureMessageFacts['claimClass'],
      approvalFreshness: raw.approvalFreshness as GoldenExternalCommunicationShadowFixtureMessageFacts['approvalFreshness'],
      tenantScope: raw.tenantScope as GoldenExternalCommunicationShadowFixtureMessageFacts['tenantScope'],
      commercialEmailPosture: raw.commercialEmailPosture as GoldenExternalCommunicationShadowFixtureMessageFacts['commercialEmailPosture'],
      evidenceAuthority: raw.evidenceAuthority as GoldenExternalCommunicationShadowFixtureMessageFacts['evidenceAuthority'],
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      publicClaim: raw.publicClaim as boolean,
      externalSideEffect: raw.externalSideEffect as boolean,
      duplicateSendAttempt: raw.duplicateSendAttempt as boolean,
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenExternalCommunicationReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (input.tenantScope === 'tenant-mismatch' || input.recipientClass === 'wrong-recipient') {
    reasons.push(
      'external-communication:recipient-tenant-mismatch',
      'external-communication:block-before-send',
    );
  }
  if (input.duplicateSendAttempt) {
    reasons.push(
      'external-communication:duplicate-send-replay',
      'external-communication:block-before-send',
    );
  }
  if (
    input.claimClass === 'legal-liability-statement' ||
    input.messageClass === 'legal-notice'
  ) {
    reasons.push(
      'external-communication:legal-claim-without-authority',
      'external-communication:block-before-send',
    );
  }
  if (input.claimClass === 'refund-or-credit-promise') {
    reasons.push('external-communication:refund-promise-needs-authority');
  }
  if (input.publicClaim || input.claimClass === 'compliance-or-production-claim') {
    reasons.push(
      'external-communication:public-claim-needs-narrowing',
      'external-communication:no-production-overclaim',
    );
  }
  if (
    input.commercialEmailPosture === 'missing-unsubscribe-or-sender-controls' ||
    input.messageClass === 'commercial-email' ||
    input.claimClass === 'commercial-offer'
  ) {
    reasons.push(
      'external-communication:commercial-email-control-gap',
      'external-communication:review-before-send',
    );
  }
  if (input.evidenceAuthority === 'model-rationale-only') {
    reasons.push('external-communication:model-rationale-not-authority');
  }
  if (input.instructionLikeEvidence || input.evidenceAuthority === 'untrusted-ticket-text') {
    reasons.push(
      'external-communication:ignore-evidence-as-instruction',
      'external-communication:untrusted-ticket-text',
    );
  }
  if (input.approvalFreshness === 'missing') reasons.push('external-communication:approval-missing');
  if (input.approvalFreshness === 'stale') reasons.push('external-communication:approval-stale');
  if (reasons.length === 1) {
    reasons.push(
      'external-communication:recipient-bound',
      'external-communication:factual-case-update',
      'external-communication:shadow-ready',
    );
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenExternalCommunicationReviewerSandboxInput,
): GoldenExternalCommunicationShadowFixturePosture {
  if (input.duplicateSendAttempt) return 'blocked-duplicate-send-replay';
  if (input.tenantScope === 'tenant-mismatch' || input.recipientClass === 'wrong-recipient') {
    return 'blocked-recipient-mismatch';
  }
  if (
    input.claimClass === 'legal-liability-statement' ||
    input.messageClass === 'legal-notice'
  ) {
    return 'blocked-legal-claim-without-authority';
  }
  if (input.publicClaim || input.claimClass === 'compliance-or-production-claim') {
    return 'needs-public-claim-narrowing';
  }
  if (
    input.commercialEmailPosture === 'missing-unsubscribe-or-sender-controls' ||
    input.messageClass === 'commercial-email' ||
    input.claimClass === 'commercial-offer'
  ) {
    return 'needs-commercial-email-controls';
  }
  if (input.instructionLikeEvidence || input.evidenceAuthority === 'untrusted-ticket-text') {
    return 'needs-instruction-text-review';
  }
  if (input.claimClass === 'refund-or-credit-promise') return 'needs-promise-review';
  return 'shadow-ready';
}

function decisionFor(issueCodes: readonly string[]): CanonicalShadowEventDecision {
  const block = issueCodes.includes('external-communication:block-before-send');
  const narrow = issueCodes.includes('external-communication:public-claim-needs-narrowing');
  const reviewNeeded = issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'external-communication:recipient-bound' &&
    code !== 'external-communication:factual-case-update' &&
    code !== 'external-communication:shadow-ready'
  );
  const shadowDecision = block
    ? 'would_block'
    : narrow
      ? 'would_narrow'
      : reviewNeeded
        ? 'would_review'
        : 'would_admit';
  return Object.freeze({
    admissionDigest: null,
    mode: reviewNeeded ? 'review' : 'observe',
    shadowDecision,
    effectiveDecision: block ? 'block' : 'review',
    allowed: false,
    failClosed: true,
    reasonCodes: issueCodes,
  });
}

function actionNameFor(
  input: GoldenExternalCommunicationReviewerSandboxInput,
): 'send_support_reply' | 'send_refund_promise_notice' | 'send_legal_notice' | 'publish_public_update' | 'send_commercial_email' {
  if (input.messageClass === 'legal-notice' || input.claimClass === 'legal-liability-statement') {
    return 'send_legal_notice';
  }
  if (input.messageClass === 'commercial-email' || input.claimClass === 'commercial-offer') {
    return 'send_commercial_email';
  }
  if (input.channelClass === 'public-post' || input.messageClass === 'public-status-update') {
    return 'publish_public_update';
  }
  if (input.messageClass === 'refund-or-credit-notice' ||
    input.claimClass === 'refund-or-credit-promise') {
    return 'send_refund_promise_notice';
  }
  return 'send_support_reply';
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
  input: GoldenExternalCommunicationReviewerSandboxInput,
): readonly string[] {
  const seeds = [
    'recipient-binding-digest',
    `approval-${input.approvalFreshness}`,
    `claim-${input.claimClass}`,
    `evidence-${input.evidenceAuthority}`,
  ];
  if (input.instructionLikeEvidence) seeds.push('instruction-like-message-evidence');
  if (input.commercialEmailPosture !== 'not-applicable') {
    seeds.push(`commercial-email-${input.commercialEmailPosture}`);
  }
  if (input.duplicateSendAttempt) seeds.push('duplicate-send-replay-evidence');
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenExternalCommunicationReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-external-communication-reviewer-sandbox',
    messageClass: input.messageClass,
    claimClass: input.claimClass,
    inputDigest,
  });
  const targetAccountRefDigest = digestFor('target-account', {
    scope: 'golden-external-communication-reviewer-sandbox',
    channelClass: input.channelClass,
    inputDigest,
  });
  const scenarioPrefix = `golden-external-communication-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-external-communication-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-external-communication-reviewer-sandbox-tenant'),
    actorRefDigest: digestFor('actor', 'golden-external-communication-reviewer-sandbox-reviewer'),
    observed: {
      targetSystem: `customer-${input.channelClass}-gateway`,
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: input.channelClass === 'sms' ? 'webhook-callback' : 'tool-call',
      consequenceClass: 'external-communication',
      resourceRefDigest,
      dataClass: input.messageClass,
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'external-communication',
      resourceRefDigest: null,
      dataClass: input.claimClass,
      amountAssetChain: null,
      authorityDelta: issueCodes.includes('external-communication:shadow-ready')
        ? null
        : {
            authorityKind: 'external-communication-review-required',
            principalRefDigest: digestFor(
              'actor',
              'golden-external-communication-reviewer-role',
            ),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'customer-message-send-approval'),
          },
    },
    decision: decisionFor(issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: issueCodes.includes('external-communication:shadow-ready') ? null : 'not-reviewed',
    },
    evidenceRefs: evidenceSeedsFor(input).map((seed) =>
      ref('evidence', `${scenarioPrefix}:${seed}`)
    ),
    simulationRefs: [
      ref('simulation', `${scenarioPrefix}:shadow-runtime-replay`, 'inferred'),
    ],
    approvalRefs: input.approvalFreshness === 'missing'
      ? []
      : [
          ref('approval', `${scenarioPrefix}:approval-${input.approvalFreshness}`),
        ],
    receiptRefs: [],
    policyRefs: [
      ref('policy', `${scenarioPrefix}:review-only-policy-candidate`, 'inferred'),
    ],
    idempotencyRefDigest: digestFor('idempotency', {
      scope: 'golden-external-communication-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-external-communication-reviewer-sandbox',
      inputDigest,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-external-communication-reviewer-sandbox',
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
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: 'golden-external-communication-reviewer-sandbox:reviewer-input',
    fixtureRefDigest: digestFor('golden-external-communication-reviewer-sandbox.fixture', {
      inputDigest,
      eventDigest: event.digest,
    }),
    event,
    sourcePartitionDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-external-communication-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-26T11:15:02.000Z',
    claimedAt: '2026-05-26T11:15:03.000Z',
    generatedAt: '2026-05-26T11:15:04.000Z',
    observedAt: '2026-05-26T11:15:05.000Z',
    outcomeObservedAt: '2026-05-26T11:15:06.000Z',
    feedbackGeneratedAt: '2026-05-26T11:15:07.000Z',
    evaluatedAt: '2026-05-26T11:15:08.000Z',
    workerRefDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.worker',
      'fixture-only-worker',
    ),
    dispatcherRunDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-external-communication-reviewer-sandbox.scope',
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
}): GoldenExternalCommunicationReviewerSandboxDecisionSummary {
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
      'golden-external-communication-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(
  input: Omit<GoldenExternalCommunicationReviewerSandboxResult, 'canonical' | 'digest'>,
): GoldenExternalCommunicationReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenExternalCommunicationReviewerSandbox(
  rawInput: unknown,
): GoldenExternalCommunicationReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION,
      step: 'E04',
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
      gateOrder: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: externalCommunicationReviewerSandboxNoClaims(),
      safetyBoundary: externalCommunicationReviewerSandboxSafetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-external-communication-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION,
      step: 'E04',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-external-communication-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: externalCommunicationReviewerSandboxNoClaims(),
      safetyBoundary: externalCommunicationReviewerSandboxSafetyBoundary(),
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
    version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION,
    step: 'E04',
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
    gateOrder: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
    noClaims: externalCommunicationReviewerSandboxNoClaims(),
    safetyBoundary: externalCommunicationReviewerSandboxSafetyBoundary(),
    engineRan: true,
    shadowOnly: true,
    previewOnly: true,
    reviewerSupplied: true,
  });
}

function list(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function renderGoldenExternalCommunicationReviewerSandboxMarkdown(
  result: GoldenExternalCommunicationReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: External Communication Reviewer Sandbox

Status: ${result.inputStatus}

## Practical Contrast

Without Attestor for this local input:

- no Attestor issue-code report
- no explicit no-claim boundary
- no decision-relevant digest from this engine

With Attestor for this local input:

- result status: ${result.inputStatus}
- engine ran: ${result.engineRan}
- visible gate stages: ${result.gateOrder.length}
- issue codes: ${result.issueCodes.length}
- message deliveries: ${result.safetyBoundary.noMessageDelivery ? '0' : 'present'}
- provider calls: ${result.safetyBoundary.noProviderCall ? '0' : 'present'}
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

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
- message delivery: ${result.safetyBoundary.noMessageDelivery ? '0' : 'present'}
- provider calls: ${result.safetyBoundary.noProviderCall ? '0' : 'present'}
- CRM/ticketing calls: ${result.safetyBoundary.noCrmOrTicketingCall ? '0' : 'present'}
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenExternalCommunicationReviewerSandboxJson(
  result: GoldenExternalCommunicationReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
