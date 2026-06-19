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
  type GoldenDataExportShadowFixtureDataFacts,
  type GoldenDataExportShadowFixturePosture,
} from './golden-data-export-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';
import {
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION,
  type GoldenDataExportReviewerSandboxDecisionSummary,
  type GoldenDataExportReviewerSandboxInput,
  type GoldenDataExportReviewerSandboxResult,
  type GoldenDataExportReviewerSandboxSafetyBoundary,
} from './golden-data-export-reviewer-sandbox-types.js';

export {
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION,
} from './golden-data-export-reviewer-sandbox-types.js';
export type {
  GoldenDataExportReviewerSandboxDecisionSummary,
  GoldenDataExportReviewerSandboxGate,
  GoldenDataExportReviewerSandboxInput,
  GoldenDataExportReviewerSandboxResult,
  GoldenDataExportReviewerSandboxSafetyBoundary,
  GoldenDataExportReviewerSandboxStatus,
} from './golden-data-export-reviewer-sandbox-types.js';

const GENERATED_AT = '2026-05-25T11:15:00.000Z';
const BASE_OCCURRED_AT = '2026-05-25T11:15:00.000Z';
const BASE_OBSERVED_AT = '2026-05-25T11:15:01.000Z';
const ENGINE_SCOPE = 'data_movement.controlled_export' as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const QUERY_CLASSES: readonly GoldenDataExportShadowFixtureDataFacts['queryClass'][] = [
  'aggregate-report',
  'customer-export',
  'controlled-data-package',
  'external-share',
  'write-query',
] as const;
const DATA_CLASSES: readonly GoldenDataExportShadowFixtureDataFacts['dataClass'][] = [
  'aggregate-metrics',
  'customer-personal-data',
  'customer-financial-data',
  'internal-operational-data',
] as const;
const RECIPIENT_CLASSES: readonly GoldenDataExportShadowFixtureDataFacts['recipientClass'][] = [
  'internal-analyst',
  'customer-account-owner',
  'approved-external-processor',
  'unapproved-external-recipient',
  'cross-tenant-principal',
] as const;
const FIELD_CLASSES: readonly GoldenDataExportShadowFixtureDataFacts['requestedFieldsClass'][] = [
  'aggregate-only',
  'approved-minimal',
  'overbroad-personal-data',
  'raw-row-level',
  'write-mutation',
] as const;
const ROW_COUNT_BUCKETS: readonly GoldenDataExportShadowFixtureDataFacts['rowCountBucket'][] = [
  '0-100',
  '100-1k',
  '1k-10k',
  'unbounded',
] as const;
const APPROVAL_FRESHNESS_VALUES:
readonly GoldenDataExportShadowFixtureDataFacts['approvalFreshness'][] = [
  'fresh',
  'stale',
  'missing',
] as const;
const TENANT_SCOPE_VALUES: readonly GoldenDataExportShadowFixtureDataFacts['tenantScope'][] = [
  'tenant-bound',
  'tenant-mismatch',
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

function safetyBoundary(): GoldenDataExportReviewerSandboxSafetyBoundary {
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
    'not-live-data-export',
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
  readonly input: GoldenDataExportReviewerSandboxInput | null;
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
    if (!(GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  const version = raw.version;
  if (version !== GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION}`);
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

  if (!includesString(QUERY_CLASSES, raw.queryClass)) {
    errors.push(`queryClass must be one of ${QUERY_CLASSES.join(', ')}`);
  }
  if (!includesString(DATA_CLASSES, raw.dataClass)) {
    errors.push(`dataClass must be one of ${DATA_CLASSES.join(', ')}`);
  }
  if (!includesString(RECIPIENT_CLASSES, raw.recipientClass)) {
    errors.push(`recipientClass must be one of ${RECIPIENT_CLASSES.join(', ')}`);
  }
  if (!includesString(FIELD_CLASSES, raw.requestedFieldsClass)) {
    errors.push(`requestedFieldsClass must be one of ${FIELD_CLASSES.join(', ')}`);
  }
  if (!includesString(ROW_COUNT_BUCKETS, raw.rowCountBucket)) {
    errors.push(`rowCountBucket must be one of ${ROW_COUNT_BUCKETS.join(', ')}`);
  }
  if (!includesString(APPROVAL_FRESHNESS_VALUES, raw.approvalFreshness)) {
    errors.push(`approvalFreshness must be one of ${APPROVAL_FRESHNESS_VALUES.join(', ')}`);
  }
  if (!includesString(TENANT_SCOPE_VALUES, raw.tenantScope)) {
    errors.push(`tenantScope must be one of ${TENANT_SCOPE_VALUES.join(', ')}`);
  }
  if (typeof raw.purposeBound !== 'boolean') errors.push('purposeBound must be boolean');
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (typeof raw.externalSideEffect !== 'boolean') {
    errors.push('externalSideEffect must be boolean');
  }
  if (typeof raw.writeSideEffect !== 'boolean') errors.push('writeSideEffect must be boolean');

  if (errors.length > 0) {
    return Object.freeze({
      input: null,
      errors: Object.freeze(errors),
      requestedActionSurface,
    });
  }

  return Object.freeze({
    input: Object.freeze({
      version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      queryClass: raw.queryClass as GoldenDataExportShadowFixtureDataFacts['queryClass'],
      dataClass: raw.dataClass as GoldenDataExportShadowFixtureDataFacts['dataClass'],
      recipientClass: raw.recipientClass as
        GoldenDataExportShadowFixtureDataFacts['recipientClass'],
      requestedFieldsClass: raw.requestedFieldsClass as
        GoldenDataExportShadowFixtureDataFacts['requestedFieldsClass'],
      rowCountBucket: raw.rowCountBucket as
        GoldenDataExportShadowFixtureDataFacts['rowCountBucket'],
      approvalFreshness: raw.approvalFreshness as
        GoldenDataExportShadowFixtureDataFacts['approvalFreshness'],
      tenantScope: raw.tenantScope as GoldenDataExportShadowFixtureDataFacts['tenantScope'],
      purposeBound: raw.purposeBound as boolean,
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      externalSideEffect: raw.externalSideEffect as boolean,
      writeSideEffect: raw.writeSideEffect as boolean,
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenDataExportReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (input.tenantScope === 'tenant-mismatch' ||
    input.recipientClass === 'cross-tenant-principal') {
    reasons.push('data-export:tenant-scope-mismatch', 'data-export:block-cross-tenant-export');
  }
  if (input.recipientClass === 'unapproved-external-recipient') {
    reasons.push('data-export:external-recipient-unapproved', 'data-export:hold-for-recipient-review');
  }
  if (
    input.requestedFieldsClass === 'overbroad-personal-data' ||
    input.requestedFieldsClass === 'raw-row-level'
  ) {
    reasons.push('data-export:overbroad-personal-data', 'data-export:narrow-to-approved-fields');
  }
  if (input.approvalFreshness === 'missing') {
    reasons.push('data-export:approval-missing', 'data-export:hold-for-approval');
  }
  if (input.approvalFreshness === 'stale') {
    reasons.push('data-export:approval-stale', 'data-export:block-stale-approval');
  }
  if (input.instructionLikeEvidence) {
    reasons.push(
      'data-export:instruction-like-evidence-text',
      'data-export:ignore-evidence-as-instruction',
    );
  }
  if (!input.purposeBound) {
    reasons.push('data-export:purpose-binding-missing');
  }
  if (
    input.writeSideEffect ||
    input.queryClass === 'write-query' ||
    input.requestedFieldsClass === 'write-mutation'
  ) {
    reasons.push('data-export:write-side-effect', 'data-export:block-write-query');
  }
  if (reasons.length === 1) {
    reasons.push('data-export:minimal-fields-approved', 'data-export:shadow-ready');
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenDataExportReviewerSandboxInput,
): GoldenDataExportShadowFixturePosture {
  if (
    input.writeSideEffect ||
    input.queryClass === 'write-query' ||
    input.requestedFieldsClass === 'write-mutation'
  ) {
    return 'blocked-write-side-effect';
  }
  if (input.tenantScope === 'tenant-mismatch' ||
    input.recipientClass === 'cross-tenant-principal') {
    return 'blocked-tenant-mismatch';
  }
  if (input.approvalFreshness === 'stale') return 'blocked-stale-approval';
  if (input.instructionLikeEvidence) return 'needs-instruction-text-review';
  if (input.recipientClass === 'unapproved-external-recipient') return 'needs-recipient-review';
  if (
    input.requestedFieldsClass === 'overbroad-personal-data' ||
    input.requestedFieldsClass === 'raw-row-level'
  ) {
    return 'needs-field-narrowing';
  }
  if (input.recipientClass === 'customer-account-owner') return 'export-ready-with-approval';
  return 'shadow-ready';
}

function decisionFor(issueCodes: readonly string[]): CanonicalShadowEventDecision {
  const block = issueCodes.some((code) =>
    code === 'data-export:block-cross-tenant-export' ||
    code === 'data-export:block-stale-approval' ||
    code === 'data-export:block-write-query'
  );
  const narrow = issueCodes.includes('data-export:narrow-to-approved-fields');
  const reviewNeeded = issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'data-export:minimal-fields-approved' &&
    code !== 'data-export:shadow-ready'
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
  input: GoldenDataExportReviewerSandboxInput,
): 'release_aggregate_report' | 'export_customer_data' | 'prepare_controlled_data_package' | 'publish_semantic_query' | 'execute_write_query' {
  if (input.queryClass === 'aggregate-report') return 'release_aggregate_report';
  if (input.queryClass === 'customer-export') return 'export_customer_data';
  if (input.queryClass === 'external-share' || input.externalSideEffect) {
    return 'prepare_controlled_data_package';
  }
  if (input.queryClass === 'write-query') return 'execute_write_query';
  return 'publish_semantic_query';
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
  input: GoldenDataExportReviewerSandboxInput,
): readonly string[] {
  const seeds = [
    'field-policy',
    'purpose-binding',
    `recipient-${input.recipientClass}`,
    `approval-${input.approvalFreshness}`,
  ];
  if (input.instructionLikeEvidence) seeds.push('instruction-like-evidence-digest');
  if (input.writeSideEffect) seeds.push('write-side-effect-digest');
  if (!input.purposeBound) seeds.push('purpose-binding-missing');
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenDataExportReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-data-export-reviewer-sandbox',
    inputDigest,
  });
  const targetAccountRefDigest = digestFor(
    'target-account',
    'golden-data-export-reviewer-sandbox',
  );
  const scenarioPrefix = `golden-data-export-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-data-export-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-data-export-reviewer-sandbox-tenant'),
    actorRefDigest: digestFor('actor', 'golden-data-export-reviewer-sandbox-reviewer'),
    observed: {
      targetSystem: 'analytics-warehouse',
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: input.queryClass === 'write-query' ? 'sql-execution' : 'tool-call',
      consequenceClass: 'data-movement',
      resourceRefDigest,
      dataClass: input.dataClass,
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'data-movement',
      resourceRefDigest: null,
      dataClass: input.queryClass,
      amountAssetChain: null,
      authorityDelta: issueCodes.includes('data-export:shadow-ready')
        ? null
        : {
            authorityKind: 'data-release-review-required',
            principalRefDigest: digestFor('actor', 'golden-data-export-reviewer-role'),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'data-release-approval'),
          },
    },
    decision: decisionFor(issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: issueCodes.includes('data-export:shadow-ready') ? null : 'not-reviewed',
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
      scope: 'golden-data-export-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-data-export-reviewer-sandbox',
      inputDigest,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-data-export-reviewer-sandbox',
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
  const fixtureRefDigest = digestFor('golden-data-export-reviewer-sandbox.fixture', {
    inputDigest,
    eventDigest: event.digest,
  });
  return runShadowRuntimeFixtureReplaySmoke({
    fixtureId: 'golden-data-export-reviewer-sandbox:reviewer-input',
    fixtureRefDigest,
    event,
    sourcePartitionDigest: digestFor(
      'golden-data-export-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-data-export-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-data-export-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-25T11:15:02.000Z',
    claimedAt: '2026-05-25T11:15:03.000Z',
    generatedAt: '2026-05-25T11:15:04.000Z',
    observedAt: '2026-05-25T11:15:05.000Z',
    outcomeObservedAt: '2026-05-25T11:15:06.000Z',
    feedbackGeneratedAt: '2026-05-25T11:15:07.000Z',
    evaluatedAt: '2026-05-25T11:15:08.000Z',
    workerRefDigest: digestFor('golden-data-export-reviewer-sandbox.worker', 'fixture-only-worker'),
    dispatcherRunDigest: digestFor(
      'golden-data-export-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-data-export-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-data-export-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-data-export-reviewer-sandbox.scope',
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
}): GoldenDataExportReviewerSandboxDecisionSummary {
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
      'golden-data-export-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(input: Omit<GoldenDataExportReviewerSandboxResult, 'canonical' | 'digest'>):
GoldenDataExportReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenDataExportReviewerSandbox(
  rawInput: unknown,
): GoldenDataExportReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION,
      step: 'D04',
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
      gateOrder: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-data-export-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION,
      step: 'D04',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-data-export-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS,
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
    version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION,
    step: 'D04',
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
    gateOrder: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS,
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

export function renderGoldenDataExportReviewerSandboxMarkdown(
  result: GoldenDataExportReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: Controlled Data Export Reviewer Sandbox

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
- target-system calls: ${result.safetyBoundary.noTargetSystemCall ? '0' : 'present'}
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
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenDataExportReviewerSandboxJson(
  result: GoldenDataExportReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
