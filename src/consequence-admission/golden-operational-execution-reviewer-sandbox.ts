import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventActionKind,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
} from './canonical-shadow-event-schema.js';
import {
  type GoldenOperationalExecutionShadowFixtureOperationFacts,
  type GoldenOperationalExecutionShadowFixturePosture,
} from './golden-operational-execution-shadow-fixtures.js';
import {
  runShadowRuntimeFixtureReplaySmoke,
  type ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';
import {
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_ALLOWED_KEYS,
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER,
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION,
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION,
  type GoldenOperationalExecutionReviewerSandboxDecisionSummary,
  type GoldenOperationalExecutionReviewerSandboxInput,
  type GoldenOperationalExecutionReviewerSandboxResult,
  type GoldenOperationalExecutionReviewerSandboxSafetyBoundary,
} from './golden-operational-execution-reviewer-sandbox-types.js';

export * from './golden-operational-execution-reviewer-sandbox-types.js';
export * from './golden-operational-execution-reviewer-sandbox-renderers.js';

const GENERATED_AT = '2026-05-26T11:45:00.000Z';
const BASE_OCCURRED_AT = '2026-05-26T11:45:00.000Z';
const BASE_OBSERVED_AT = '2026-05-26T11:45:01.000Z';
const ENGINE_SCOPE = 'operational_execution.change_request' as const;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

const TARGET_SYSTEMS:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['targetSystem'][] = [
  'kubernetes-deployment',
  'terraform-workspace',
  'secret-manager',
  'incident-automation',
  'github-deployment-environment',
] as const;
const OPERATION_CLASSES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['operationClass'][] = [
  'canary-deploy',
  'production-deploy',
  'secret-rotation',
  'infrastructure-change',
  'incident-restart',
  'rollback',
] as const;
const ENVIRONMENT_CLASSES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['environmentClass'][] = [
  'staging',
  'production',
  'incident-response',
] as const;
const CHANGE_RISKS:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['changeRisk'][] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
const APPROVAL_FRESHNESS_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['approvalFreshness'][] = [
  'fresh',
  'stale',
  'missing',
] as const;
const ROLLBACK_PLAN_STATUS_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['rollbackPlanStatus'][] = [
  'verified',
  'missing',
  'stale',
] as const;
const DRY_RUN_STATUS_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['dryRunStatus'][] = [
  'passed',
  'missing',
  'drift-detected',
] as const;
const INCIDENT_STATE_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['incidentState'][] = [
  'none',
  'active',
  'resolved',
] as const;
const TENANT_SCOPE_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['tenantScope'][] = [
  'tenant-bound',
  'tenant-mismatch',
] as const;
const OPERATOR_AUTHORITY_VALUES:
readonly GoldenOperationalExecutionShadowFixtureOperationFacts['operatorAuthority'][] = [
  'release-manager',
  'incident-commander',
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

function safetyBoundary(): GoldenOperationalExecutionReviewerSandboxSafetyBoundary {
  return Object.freeze({
    noTargetSystemCall: true,
    noDeployment: true,
    noInfrastructureChange: true,
    noSecretManagerWrite: true,
    noIncidentAutomationExecution: true,
    noRunbookExecution: true,
    noProviderCall: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noExternalTraceExport: true,
    noExternalLineageExport: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawDeploymentManifestRead: false,
    rawDeploymentManifestStored: false,
    rawTerraformPlanRead: false,
    rawTerraformPlanStored: false,
    rawSecretMaterialRead: false,
    rawSecretMaterialStored: false,
    rawRunbookTextRead: false,
    rawRunbookTextStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-live-kubernetes-terraform-or-github-deployment',
    'not-native-ci-cd-cloud-secret-manager-or-incident-connector',
    'not-runbook-executor',
    'not-terraform-apply',
    'not-secret-rotation',
    'not-incident-response-correctness-proof',
    'not-customer-pep-enforcement-proof',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
  ]);
}

function validateInput(raw: unknown): {
  readonly input: GoldenOperationalExecutionReviewerSandboxInput | null;
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
    if (!(GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field: ${key}`);
    }
  }

  if (raw.version !== GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION) {
    errors.push(`version must be ${GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION}`);
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

  if (!includesString(TARGET_SYSTEMS, raw.targetSystem)) {
    errors.push(`targetSystem must be one of ${TARGET_SYSTEMS.join(', ')}`);
  }
  if (!includesString(OPERATION_CLASSES, raw.operationClass)) {
    errors.push(`operationClass must be one of ${OPERATION_CLASSES.join(', ')}`);
  }
  if (!includesString(ENVIRONMENT_CLASSES, raw.environmentClass)) {
    errors.push(`environmentClass must be one of ${ENVIRONMENT_CLASSES.join(', ')}`);
  }
  if (!includesString(CHANGE_RISKS, raw.changeRisk)) {
    errors.push(`changeRisk must be one of ${CHANGE_RISKS.join(', ')}`);
  }
  if (!includesString(APPROVAL_FRESHNESS_VALUES, raw.approvalFreshness)) {
    errors.push(`approvalFreshness must be one of ${APPROVAL_FRESHNESS_VALUES.join(', ')}`);
  }
  if (!includesString(ROLLBACK_PLAN_STATUS_VALUES, raw.rollbackPlanStatus)) {
    errors.push(`rollbackPlanStatus must be one of ${ROLLBACK_PLAN_STATUS_VALUES.join(', ')}`);
  }
  if (!includesString(DRY_RUN_STATUS_VALUES, raw.dryRunStatus)) {
    errors.push(`dryRunStatus must be one of ${DRY_RUN_STATUS_VALUES.join(', ')}`);
  }
  if (!includesString(INCIDENT_STATE_VALUES, raw.incidentState)) {
    errors.push(`incidentState must be one of ${INCIDENT_STATE_VALUES.join(', ')}`);
  }
  if (!includesString(TENANT_SCOPE_VALUES, raw.tenantScope)) {
    errors.push(`tenantScope must be one of ${TENANT_SCOPE_VALUES.join(', ')}`);
  }
  if (!includesString(OPERATOR_AUTHORITY_VALUES, raw.operatorAuthority)) {
    errors.push(`operatorAuthority must be one of ${OPERATOR_AUTHORITY_VALUES.join(', ')}`);
  }
  if (typeof raw.instructionLikeEvidence !== 'boolean') {
    errors.push('instructionLikeEvidence must be boolean');
  }
  if (typeof raw.externalSideEffect !== 'boolean') {
    errors.push('externalSideEffect must be boolean');
  }
  if (typeof raw.duplicateOperationAttempt !== 'boolean') {
    errors.push('duplicateOperationAttempt must be boolean');
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
      version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION,
      actionSurface: requestedActionSurface ?? ENGINE_SCOPE,
      targetSystem: raw.targetSystem as GoldenOperationalExecutionShadowFixtureOperationFacts['targetSystem'],
      operationClass: raw.operationClass as GoldenOperationalExecutionShadowFixtureOperationFacts['operationClass'],
      environmentClass: raw.environmentClass as GoldenOperationalExecutionShadowFixtureOperationFacts['environmentClass'],
      changeRisk: raw.changeRisk as GoldenOperationalExecutionShadowFixtureOperationFacts['changeRisk'],
      approvalFreshness: raw.approvalFreshness as GoldenOperationalExecutionShadowFixtureOperationFacts['approvalFreshness'],
      rollbackPlanStatus: raw.rollbackPlanStatus as GoldenOperationalExecutionShadowFixtureOperationFacts['rollbackPlanStatus'],
      dryRunStatus: raw.dryRunStatus as GoldenOperationalExecutionShadowFixtureOperationFacts['dryRunStatus'],
      incidentState: raw.incidentState as GoldenOperationalExecutionShadowFixtureOperationFacts['incidentState'],
      tenantScope: raw.tenantScope as GoldenOperationalExecutionShadowFixtureOperationFacts['tenantScope'],
      operatorAuthority: raw.operatorAuthority as GoldenOperationalExecutionShadowFixtureOperationFacts['operatorAuthority'],
      instructionLikeEvidence: raw.instructionLikeEvidence as boolean,
      externalSideEffect: raw.externalSideEffect as boolean,
      duplicateOperationAttempt: raw.duplicateOperationAttempt as boolean,
    }),
    errors: Object.freeze([]),
    requestedActionSurface,
  });
}

function detectIssueCodes(
  input: GoldenOperationalExecutionReviewerSandboxInput,
): readonly string[] {
  const reasons = ['reviewer-sandbox:schema-valid'];
  if (input.tenantScope === 'tenant-mismatch') {
    reasons.push(
      'operational-execution:tenant-scope-mismatch',
      'operational-execution:block-before-execution',
    );
  }
  if (input.duplicateOperationAttempt) {
    reasons.push(
      'operational-execution:duplicate-operation-replay',
      'operational-execution:block-before-execution',
    );
  }
  if (input.approvalFreshness === 'stale') {
    reasons.push(
      'operational-execution:stale-approval',
      input.operationClass === 'secret-rotation'
        ? 'operational-execution:block-before-secret-rotation'
        : 'operational-execution:review-before-execution',
    );
  }
  if (input.approvalFreshness === 'missing') {
    reasons.push('operational-execution:approval-missing');
  }
  if (input.rollbackPlanStatus === 'missing' && input.environmentClass === 'production') {
    reasons.push(
      'operational-execution:rollback-plan-missing',
      'operational-execution:review-before-deploy',
    );
  }
  if (input.rollbackPlanStatus === 'stale') {
    reasons.push('operational-execution:rollback-plan-stale');
  }
  if (input.dryRunStatus === 'missing') {
    reasons.push('operational-execution:dry-run-or-plan-missing');
  }
  if (input.dryRunStatus === 'drift-detected') {
    reasons.push(
      'operational-execution:infrastructure-drift-detected',
      'operational-execution:review-before-apply',
    );
  }
  if (input.incidentState === 'active' && input.approvalFreshness !== 'fresh') {
    reasons.push(
      'operational-execution:break-glass-review-required',
      'operational-execution:incident-action-held',
    );
  }
  if (input.operatorAuthority === 'model-rationale-only') {
    reasons.push('operational-execution:model-rationale-not-authority');
  }
  if (input.instructionLikeEvidence) {
    reasons.push('operational-execution:ignore-runbook-text-as-instruction');
  }
  if (input.operationClass === 'secret-rotation' && input.approvalFreshness !== 'fresh') {
    reasons.push('operational-execution:block-before-secret-rotation');
  }
  if (reasons.length === 1) {
    reasons.push(
      'operational-execution:operator-authority-bound',
      'operational-execution:dry-run-plan-present',
      'operational-execution:shadow-ready',
    );
  }
  return Object.freeze([...new Set(reasons)].sort());
}

function expectedPostureFor(
  input: GoldenOperationalExecutionReviewerSandboxInput,
): GoldenOperationalExecutionShadowFixturePosture {
  if (input.duplicateOperationAttempt) return 'blocked-duplicate-operation-replay';
  if (input.approvalFreshness === 'stale' && input.operationClass === 'secret-rotation') {
    return 'blocked-stale-approval';
  }
  if (input.rollbackPlanStatus === 'missing' && input.environmentClass === 'production') {
    return 'needs-rollback-plan';
  }
  if (input.dryRunStatus === 'drift-detected') return 'needs-drift-review';
  if (input.incidentState === 'active' && input.approvalFreshness !== 'fresh') {
    return 'needs-break-glass-review';
  }
  if (input.instructionLikeEvidence || input.operatorAuthority === 'model-rationale-only') {
    return 'needs-runbook-instruction-review';
  }
  if (input.operationClass === 'rollback' && input.rollbackPlanStatus === 'verified') {
    return 'rollback-ready-with-approval';
  }
  return 'shadow-ready';
}

function decisionFor(issueCodes: readonly string[]): CanonicalShadowEventDecision {
  const block = issueCodes.includes('operational-execution:block-before-execution') ||
    issueCodes.includes('operational-execution:block-before-secret-rotation');
  const reviewNeeded = block || issueCodes.some((code) =>
    code !== 'reviewer-sandbox:schema-valid' &&
    code !== 'operational-execution:operator-authority-bound' &&
    code !== 'operational-execution:dry-run-plan-present' &&
    code !== 'operational-execution:shadow-ready'
  );
  const shadowDecision = block
    ? 'would_block'
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
  input: GoldenOperationalExecutionReviewerSandboxInput,
): 'apply_canary_deploy' | 'apply_production_deploy' | 'rotate_production_secret' | 'apply_infrastructure_plan' | 'restart_incident_service' | 'apply_rollback' | 'execute_runbook_step' {
  if (input.instructionLikeEvidence) return 'execute_runbook_step';
  if (input.operationClass === 'canary-deploy') return 'apply_canary_deploy';
  if (input.operationClass === 'production-deploy') return 'apply_production_deploy';
  if (input.operationClass === 'secret-rotation') return 'rotate_production_secret';
  if (input.operationClass === 'infrastructure-change') return 'apply_infrastructure_plan';
  if (input.operationClass === 'incident-restart') return 'restart_incident_service';
  return 'apply_rollback';
}

function actionKindFor(
  input: GoldenOperationalExecutionReviewerSandboxInput,
): CanonicalShadowEventActionKind {
  if (input.instructionLikeEvidence) return 'mcp-tool';
  if (input.operationClass === 'secret-rotation') return 'tool-call';
  if (input.operationClass === 'incident-restart') return 'api-operation';
  if (input.operationClass === 'rollback') return 'approval-step';
  return 'workflow-step';
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
  input: GoldenOperationalExecutionReviewerSandboxInput,
): readonly string[] {
  const seeds = [
    `operation-${input.operationClass}`,
    `environment-${input.environmentClass}`,
    `approval-${input.approvalFreshness}`,
    `rollback-${input.rollbackPlanStatus}`,
    `dry-run-${input.dryRunStatus}`,
    `authority-${input.operatorAuthority}`,
  ];
  if (input.incidentState !== 'none') seeds.push(`incident-${input.incidentState}`);
  if (input.instructionLikeEvidence) seeds.push('instruction-like-runbook-evidence');
  if (input.duplicateOperationAttempt) seeds.push('duplicate-operation-replay-evidence');
  return Object.freeze(seeds);
}

function createSandboxEvent(
  input: GoldenOperationalExecutionReviewerSandboxInput,
  inputDigest: string,
  issueCodes: readonly string[],
): CanonicalShadowEvent {
  const resourceRefDigest = digestFor('resource', {
    scope: 'golden-operational-execution-reviewer-sandbox',
    targetSystem: input.targetSystem,
    operationClass: input.operationClass,
    inputDigest,
  });
  const targetAccountRefDigest = digestFor('target-account', {
    scope: 'golden-operational-execution-reviewer-sandbox',
    targetSystem: input.targetSystem,
    environmentClass: input.environmentClass,
    inputDigest,
  });
  const scenarioPrefix = `golden-operational-execution-reviewer-sandbox:${inputDigest}`;
  return createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: 'attestor.golden-operational-execution-reviewer-sandbox',
    tenantRefDigest: digestFor('tenant', 'golden-operational-execution-reviewer-sandbox-tenant'),
    actorRefDigest: digestFor('actor', `golden-operational-execution:${input.operatorAuthority}`),
    observed: {
      targetSystem: input.targetSystem,
      targetAccountRefDigest,
      actionName: actionNameFor(input),
      actionKind: actionKindFor(input),
      consequenceClass: 'operational-execution',
      resourceRefDigest,
      dataClass: `operational:${input.operationClass}`,
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'operational-execution',
      resourceRefDigest: null,
      dataClass: `operational-risk:${input.changeRisk}`,
      amountAssetChain: null,
      authorityDelta: issueCodes.includes('operational-execution:shadow-ready')
        ? null
        : {
            authorityKind: 'operational-execution-review-required',
            principalRefDigest: digestFor(
              'actor',
              'golden-operational-execution-reviewer-role',
            ),
            resourceRefDigest,
            permissionRefDigest: digestFor('authority', 'operational-change-approval'),
          },
    },
    decision: decisionFor(issueCodes),
    outcome: {
      downstreamOutcome: 'blocked',
      humanOutcome: issueCodes.includes('operational-execution:shadow-ready') ? null : 'not-reviewed',
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
      scope: 'golden-operational-execution-reviewer-sandbox',
      inputDigest,
    }),
    replayRefDigest: digestFor('replay', {
      scope: 'golden-operational-execution-reviewer-sandbox',
      inputDigest,
    }),
    traceRefDigest: digestFor('trace', {
      scope: 'golden-operational-execution-reviewer-sandbox',
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
    fixtureId: 'golden-operational-execution-reviewer-sandbox:reviewer-input',
    fixtureRefDigest: digestFor('golden-operational-execution-reviewer-sandbox.fixture', {
      inputDigest,
      eventDigest: event.digest,
    }),
    event,
    sourcePartitionDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.source-partition',
      'single-reviewer-input',
    ),
    traceContextDigest: digestFor('golden-operational-execution-reviewer-sandbox.trace-context', {
      inputDigest,
      eventDigest: event.digest,
    }),
    sourceHistoryRefDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.source-history',
      'single-reviewer-input',
    ),
    sourceHistorySequence: 1,
    requestedAt: '2026-05-26T11:45:02.000Z',
    claimedAt: '2026-05-26T11:45:03.000Z',
    generatedAt: '2026-05-26T11:45:04.000Z',
    observedAt: '2026-05-26T11:45:05.000Z',
    outcomeObservedAt: '2026-05-26T11:45:06.000Z',
    feedbackGeneratedAt: '2026-05-26T11:45:07.000Z',
    evaluatedAt: '2026-05-26T11:45:08.000Z',
    workerRefDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.worker',
      'fixture-only-worker',
    ),
    dispatcherRunDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.dispatcher',
      inputDigest,
    ),
    observerRefDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.observer',
      'fixture-only-observer',
    ),
    evaluatorRefDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.evaluator',
      'fixture-only-evaluator',
    ),
    scopeDigest: digestFor(
      'golden-operational-execution-reviewer-sandbox.scope',
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
}): GoldenOperationalExecutionReviewerSandboxDecisionSummary {
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
      'golden-operational-execution-reviewer-sandbox.decision-summary',
      material as unknown as CanonicalReleaseJsonValue,
    ),
  });
}

function resultFor(
  input: Omit<GoldenOperationalExecutionReviewerSandboxResult, 'canonical' | 'digest'>,
): GoldenOperationalExecutionReviewerSandboxResult {
  const canonical = canonicalObject(input as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...input,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runGoldenOperationalExecutionReviewerSandbox(
  rawInput: unknown,
): GoldenOperationalExecutionReviewerSandboxResult {
  const validated = validateInput(rawInput);
  if (!validated.input) {
    return resultFor({
      version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION,
      step: 'O04',
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
      gateOrder: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
      noClaims: noClaims(),
      safetyBoundary: safetyBoundary(),
      engineRan: false,
      shadowOnly: true,
      previewOnly: true,
      reviewerSupplied: true,
    });
  }

  const inputDigest = digestFor(
    'golden-operational-execution-reviewer-sandbox.input',
    validated.input as unknown as CanonicalReleaseJsonValue,
  );
  if (validated.input.actionSurface !== ENGINE_SCOPE) {
    return resultFor({
      version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION,
      step: 'O04',
      generatedAt: GENERATED_AT,
      inputVersion: validated.input.version,
      inputStatus: 'outside-scope',
      inputDigest,
      engineScope: ENGINE_SCOPE,
      requestedActionSurface: validated.input.actionSurface,
      schemaErrors: Object.freeze([]),
      issueCodes: Object.freeze(['reviewer-sandbox:outside-golden-operational-execution-scope']),
      expectedPosture: null,
      eventDigest: null,
      smokeDigest: null,
      envelopeRefDigest: null,
      assurancePacketDigest: null,
      gateOrder: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER,
      decisionSummary: null,
      smokeResult: null,
      sourceAnchors: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
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
    version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION,
    step: 'O04',
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
    gateOrder: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER,
    decisionSummary,
    smokeResult: null,
    sourceAnchors: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS,
    noClaims: noClaims(),
    safetyBoundary: safetyBoundary(),
    engineRan: true,
    shadowOnly: true,
    previewOnly: true,
    reviewerSupplied: true,
  });
}
