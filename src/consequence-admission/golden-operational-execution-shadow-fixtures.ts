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
import type { ConsequenceAdmissionDecision } from './index.js';

export const GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION =
  'attestor.golden-operational-execution-shadow-fixtures.v1';

export const GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS = [
  'canary-deploy-approved',
  'production-deploy-missing-rollback',
  'secret-rotation-stale-approval',
  'infrastructure-change-drift-review',
  'incident-restart-break-glass',
  'rollback-ready-approved',
  'prompt-injection-in-runbook',
  'duplicate-operation-replay-blocked',
] as const;
export type GoldenOperationalExecutionShadowFixtureScenario =
  typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS[number];

export const GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_POSTURES = [
  'shadow-ready',
  'needs-rollback-plan',
  'blocked-stale-approval',
  'needs-drift-review',
  'needs-break-glass-review',
  'rollback-ready-with-approval',
  'needs-runbook-instruction-review',
  'blocked-duplicate-operation-replay',
] as const;
export type GoldenOperationalExecutionShadowFixturePosture =
  typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_POSTURES[number];

export const GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_NON_CLAIMS = [
  'not-live-kubernetes-terraform-or-github-deployment',
  'not-native-ci-cd-or-cloud-connector',
  'not-customer-pep-enforcement-proof',
  'not-incident-response-correctness-proof',
  'not-production-ready',
] as const;

export interface GoldenOperationalExecutionShadowFixtureOperationFacts {
  readonly targetSystem:
    | 'kubernetes-deployment'
    | 'terraform-workspace'
    | 'secret-manager'
    | 'incident-automation'
    | 'github-deployment-environment';
  readonly operationClass:
    | 'canary-deploy'
    | 'production-deploy'
    | 'secret-rotation'
    | 'infrastructure-change'
    | 'incident-restart'
    | 'rollback';
  readonly environmentClass: 'staging' | 'production' | 'incident-response';
  readonly changeRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly approvalFreshness: 'fresh' | 'stale' | 'missing';
  readonly rollbackPlanStatus: 'verified' | 'missing' | 'stale';
  readonly dryRunStatus: 'passed' | 'missing' | 'drift-detected';
  readonly incidentState: 'none' | 'active' | 'resolved';
  readonly tenantScope: 'tenant-bound' | 'tenant-mismatch';
  readonly operatorAuthority: 'release-manager' | 'incident-commander' | 'model-rationale-only';
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly duplicateOperationAttempt: boolean;
}

export interface GoldenOperationalExecutionShadowFixture {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly scenario: GoldenOperationalExecutionShadowFixtureScenario;
  readonly fixtureId: string;
  readonly expectedPosture: GoldenOperationalExecutionShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly operationFacts: GoldenOperationalExecutionShadowFixtureOperationFacts;
  readonly event: CanonicalShadowEvent;
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly fixtureOnly: true;
  readonly synthetic: true;
  readonly shadowOnly: true;
  readonly noTargetSystemCall: true;
  readonly noDeployment: true;
  readonly noInfrastructureChange: true;
  readonly noSecretMaterial: true;
  readonly noRawPayload: true;
  readonly noRawRunbookText: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenOperationalExecutionShadowFixtureSuite {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly name: 'Golden Path: Operational Execution';
  readonly step: 'O01';
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly fixtureCount: 8;
  readonly scenarios: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS;
  readonly fixtures: readonly GoldenOperationalExecutionShadowFixture[];
  readonly shadowOnly: true;
  readonly noTargetSystemCalls: true;
  readonly noDeployment: true;
  readonly noInfrastructureChange: true;
  readonly noSecretMaterial: true;
  readonly noRawPayload: true;
  readonly noRawRunbookText: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenOperationalExecutionShadowFixturesDescriptor {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION;
  readonly step: 'O01';
  readonly sourceSchemaVersion: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly scenarios: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS;
  readonly shadowOnly: true;
  readonly synthetic: true;
  readonly noTargetSystemCalls: true;
  readonly noDeployment: true;
  readonly noInfrastructureChange: true;
  readonly noSecretMaterial: true;
  readonly noRawPayload: true;
  readonly noRawRunbookText: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: typeof GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_NON_CLAIMS;
}

interface ScenarioDefinition {
  readonly scenario: GoldenOperationalExecutionShadowFixtureScenario;
  readonly expectedPosture: GoldenOperationalExecutionShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly operationFacts: GoldenOperationalExecutionShadowFixtureOperationFacts;
  readonly actionName:
    | 'apply_canary_deploy'
    | 'apply_production_deploy'
    | 'rotate_production_secret'
    | 'apply_infrastructure_plan'
    | 'restart_incident_service'
    | 'apply_rollback'
    | 'execute_runbook_step';
  readonly actionKind: CanonicalShadowEventActionKind;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly decision: CanonicalShadowEventDecision;
  readonly evidenceSeeds: readonly string[];
  readonly approvalSeeds: readonly string[];
  readonly simulationSeeds: readonly string[];
  readonly receiptSeeds: readonly string[];
}

const BASE_OCCURRED_AT = '2026-05-26T10:00:00.000Z';
const BASE_OBSERVED_AT = '2026-05-26T10:00:01.000Z';

const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = Object.freeze([
  {
    scenario: 'canary-deploy-approved',
    expectedPosture: 'shadow-ready',
    expectedDecision: 'admit',
    operationFacts: Object.freeze({
      targetSystem: 'kubernetes-deployment',
      operationClass: 'canary-deploy',
      environmentClass: 'staging',
      changeRisk: 'medium',
      approvalFreshness: 'fresh',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'passed',
      incidentState: 'none',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'apply_canary_deploy',
    actionKind: 'workflow-step',
    expectedEvidenceStates: Object.freeze(['observed', 'dry-run-passed', 'rollback-verified', 'fresh-approval']),
    expectedSignals: Object.freeze(['canary-scope', 'release-manager-approved', 'rollback-ready']),
    reasonCodes: Object.freeze([
      'operational-execution:canary-approved',
      'operational-execution:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:canary-approved',
        'operational-execution:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze(['deployment-manifest-digest', 'release-window-digest']),
    approvalSeeds: Object.freeze(['release-manager-approval']),
    simulationSeeds: Object.freeze(['kubernetes-server-side-dry-run-passed']),
    receiptSeeds: Object.freeze(['no-live-deploy-receipt-fixture-only']),
  },
  {
    scenario: 'production-deploy-missing-rollback',
    expectedPosture: 'needs-rollback-plan',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      targetSystem: 'kubernetes-deployment',
      operationClass: 'production-deploy',
      environmentClass: 'production',
      changeRisk: 'high',
      approvalFreshness: 'fresh',
      rollbackPlanStatus: 'missing',
      dryRunStatus: 'passed',
      incidentState: 'none',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'apply_production_deploy',
    actionKind: 'api-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'dry-run-passed', 'rollback-missing']),
    expectedSignals: Object.freeze(['production-risk', 'rollback-plan-required']),
    reasonCodes: Object.freeze([
      'operational-execution:rollback-plan-missing',
      'operational-execution:review-before-deploy',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:rollback-plan-missing',
        'operational-execution:review-before-deploy',
      ]),
    }),
    evidenceSeeds: Object.freeze(['deployment-manifest-digest', 'release-window-digest']),
    approvalSeeds: Object.freeze(['release-manager-approval']),
    simulationSeeds: Object.freeze(['kubernetes-server-side-dry-run-passed']),
    receiptSeeds: Object.freeze(['no-live-deploy-receipt-fixture-only']),
  },
  {
    scenario: 'secret-rotation-stale-approval',
    expectedPosture: 'blocked-stale-approval',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      targetSystem: 'secret-manager',
      operationClass: 'secret-rotation',
      environmentClass: 'production',
      changeRisk: 'critical',
      approvalFreshness: 'stale',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'missing',
      incidentState: 'none',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'rotate_production_secret',
    actionKind: 'tool-call',
    expectedEvidenceStates: Object.freeze(['observed', 'secret-material-forbidden', 'approval-stale']),
    expectedSignals: Object.freeze(['secret-rotation-critical', 'fresh-approval-required']),
    reasonCodes: Object.freeze([
      'operational-execution:stale-approval',
      'operational-execution:block-before-secret-rotation',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'enforce',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:stale-approval',
        'operational-execution:block-before-secret-rotation',
      ]),
    }),
    evidenceSeeds: Object.freeze(['rotation-runbook-digest', 'secret-ref-digest-only']),
    approvalSeeds: Object.freeze(['stale-change-approval']),
    simulationSeeds: Object.freeze(['rotation-dry-run-missing']),
    receiptSeeds: Object.freeze(['no-secret-manager-write-fixture-only']),
  },
  {
    scenario: 'infrastructure-change-drift-review',
    expectedPosture: 'needs-drift-review',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      targetSystem: 'terraform-workspace',
      operationClass: 'infrastructure-change',
      environmentClass: 'production',
      changeRisk: 'high',
      approvalFreshness: 'fresh',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'drift-detected',
      incidentState: 'none',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'apply_infrastructure_plan',
    actionKind: 'workflow-step',
    expectedEvidenceStates: Object.freeze(['observed', 'plan-exists', 'drift-detected']),
    expectedSignals: Object.freeze(['terraform-plan-before-apply', 'drift-review-required']),
    reasonCodes: Object.freeze([
      'operational-execution:infrastructure-drift-detected',
      'operational-execution:review-before-apply',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:infrastructure-drift-detected',
        'operational-execution:review-before-apply',
      ]),
    }),
    evidenceSeeds: Object.freeze(['terraform-plan-digest', 'drift-summary-digest']),
    approvalSeeds: Object.freeze(['release-manager-approval']),
    simulationSeeds: Object.freeze(['terraform-plan-drift-detected']),
    receiptSeeds: Object.freeze(['no-terraform-apply-fixture-only']),
  },
  {
    scenario: 'incident-restart-break-glass',
    expectedPosture: 'needs-break-glass-review',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      targetSystem: 'incident-automation',
      operationClass: 'incident-restart',
      environmentClass: 'incident-response',
      changeRisk: 'critical',
      approvalFreshness: 'missing',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'missing',
      incidentState: 'active',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'incident-commander',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'restart_incident_service',
    actionKind: 'api-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'active-incident', 'break-glass-missing-secondary-approval']),
    expectedSignals: Object.freeze(['incident-commander-context', 'secondary-approval-required']),
    reasonCodes: Object.freeze([
      'operational-execution:break-glass-review-required',
      'operational-execution:incident-action-held',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:break-glass-review-required',
        'operational-execution:incident-action-held',
      ]),
    }),
    evidenceSeeds: Object.freeze(['incident-ticket-digest', 'runbook-step-digest']),
    approvalSeeds: Object.freeze(['incident-commander-context']),
    simulationSeeds: Object.freeze(['restart-impact-not-simulated']),
    receiptSeeds: Object.freeze(['no-live-restart-fixture-only']),
  },
  {
    scenario: 'rollback-ready-approved',
    expectedPosture: 'rollback-ready-with-approval',
    expectedDecision: 'admit',
    operationFacts: Object.freeze({
      targetSystem: 'github-deployment-environment',
      operationClass: 'rollback',
      environmentClass: 'production',
      changeRisk: 'high',
      approvalFreshness: 'fresh',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'passed',
      incidentState: 'active',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'apply_rollback',
    actionKind: 'approval-step',
    expectedEvidenceStates: Object.freeze(['observed', 'rollback-verified', 'fresh-approval']),
    expectedSignals: Object.freeze(['protected-environment-approved', 'rollback-target-bound']),
    reasonCodes: Object.freeze([
      'operational-execution:rollback-approved',
      'operational-execution:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:rollback-approved',
        'operational-execution:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze(['rollback-target-digest', 'deployment-environment-digest']),
    approvalSeeds: Object.freeze(['protected-environment-reviewer-approval']),
    simulationSeeds: Object.freeze(['rollback-plan-verified']),
    receiptSeeds: Object.freeze(['no-live-rollback-fixture-only']),
  },
  {
    scenario: 'prompt-injection-in-runbook',
    expectedPosture: 'needs-runbook-instruction-review',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      targetSystem: 'incident-automation',
      operationClass: 'incident-restart',
      environmentClass: 'incident-response',
      changeRisk: 'critical',
      approvalFreshness: 'missing',
      rollbackPlanStatus: 'missing',
      dryRunStatus: 'missing',
      incidentState: 'active',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'model-rationale-only',
      instructionLikeEvidence: true,
      externalSideEffect: true,
      duplicateOperationAttempt: false,
    }),
    actionName: 'execute_runbook_step',
    actionKind: 'mcp-tool',
    expectedEvidenceStates: Object.freeze(['observed', 'instruction-like-runbook-text', 'operator-authority-missing']),
    expectedSignals: Object.freeze(['runbook-text-not-authority', 'operator-approval-required']),
    reasonCodes: Object.freeze([
      'operational-execution:ignore-runbook-text-as-instruction',
      'operational-execution:model-rationale-not-authority',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:ignore-runbook-text-as-instruction',
        'operational-execution:model-rationale-not-authority',
      ]),
    }),
    evidenceSeeds: Object.freeze(['runbook-text-digest', 'incident-context-digest']),
    approvalSeeds: Object.freeze(['missing-human-approval']),
    simulationSeeds: Object.freeze(['no-impact-simulation']),
    receiptSeeds: Object.freeze(['no-live-runbook-execution-fixture-only']),
  },
  {
    scenario: 'duplicate-operation-replay-blocked',
    expectedPosture: 'blocked-duplicate-operation-replay',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      targetSystem: 'kubernetes-deployment',
      operationClass: 'production-deploy',
      environmentClass: 'production',
      changeRisk: 'high',
      approvalFreshness: 'fresh',
      rollbackPlanStatus: 'verified',
      dryRunStatus: 'passed',
      incidentState: 'none',
      tenantScope: 'tenant-bound',
      operatorAuthority: 'release-manager',
      instructionLikeEvidence: false,
      externalSideEffect: true,
      duplicateOperationAttempt: true,
    }),
    actionName: 'apply_production_deploy',
    actionKind: 'api-operation',
    expectedEvidenceStates: Object.freeze(['observed', 'duplicate-operation', 'idempotency-conflict']),
    expectedSignals: Object.freeze(['replay-detected', 'block-duplicate-operation']),
    reasonCodes: Object.freeze([
      'operational-execution:duplicate-operation-replay',
      'operational-execution:block-before-execution',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'enforce',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'operational-execution:duplicate-operation-replay',
        'operational-execution:block-before-execution',
      ]),
    }),
    evidenceSeeds: Object.freeze(['deployment-manifest-digest', 'previous-operation-digest']),
    approvalSeeds: Object.freeze(['release-manager-approval']),
    simulationSeeds: Object.freeze(['kubernetes-server-side-dry-run-passed']),
    receiptSeeds: Object.freeze(['no-live-deploy-receipt-fixture-only']),
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

function digestValue(kind: string, value: string): string {
  return canonicalObject({ kind, value }).digest;
}

function ref(
  kind: CanonicalShadowEventReference['kind'],
  seed: string,
): CanonicalShadowEventReference {
  return Object.freeze({
    kind,
    digest: digestValue(kind, seed),
    origin: 'operator-supplied',
  });
}

function refs(
  kind: CanonicalShadowEventReference['kind'],
  seeds: readonly string[],
): readonly CanonicalShadowEventReference[] {
  return Object.freeze(seeds.map((seed) => ref(kind, seed)));
}

function canonicalScenario(definition: ScenarioDefinition): GoldenOperationalExecutionShadowFixture {
  const sourceRecipeRefDigest = digestValue('source-recipe', 'golden-operational-execution-o01');
  const actionSurfaceRefDigest = digestValue('action-surface', 'operational_execution.change_request');
  const fixtureId = `golden-operational-execution:${definition.scenario}`;
  const event = createCanonicalShadowEvent({
    occurredAt: BASE_OCCURRED_AT,
    observedAt: BASE_OBSERVED_AT,
    sourceKind: 'admission-shadow',
    producer: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
    tenantRefDigest: digestValue('tenant', `tenant:${definition.scenario}`),
    actorRefDigest: digestValue('actor', `operator:${definition.operationFacts.operatorAuthority}`),
    observed: {
      targetSystem: definition.operationFacts.targetSystem,
      targetAccountRefDigest: digestValue('target-account', `operations:${definition.operationFacts.environmentClass}`),
      actionName: definition.actionName,
      actionKind: definition.actionKind,
      consequenceClass: 'operational-execution',
      resourceRefDigest: digestValue('resource', `${definition.operationFacts.targetSystem}:${definition.operationFacts.operationClass}`),
      dataClass: `operational:${definition.operationFacts.operationClass}`,
      amountAssetChain: null,
      authorityDelta: null,
    },
    decision: definition.decision,
    evidenceRefs: refs('evidence', definition.evidenceSeeds),
    simulationRefs: refs('simulation', definition.simulationSeeds),
    approvalRefs: refs('approval', definition.approvalSeeds),
    receiptRefs: refs('receipt', definition.receiptSeeds),
    policyRefs: refs('policy', ['operational-execution-shadow-policy-v1']),
    idempotencyRefDigest: digestValue('idempotency', `${definition.scenario}:idempotency`),
    replayRefDigest: digestValue('replay', `${definition.scenario}:replay`),
    traceRefDigest: digestValue('trace', `${definition.scenario}:trace`),
    schemaRefDigest: digestValue('schema', GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
  const body = {
    version: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
    scenario: definition.scenario,
    fixtureId,
    expectedPosture: definition.expectedPosture,
    expectedDecision: definition.expectedDecision,
    operationFacts: definition.operationFacts,
    event,
    sourceRecipeRefDigest,
    actionSurfaceRefDigest,
    expectedEvidenceStates: definition.expectedEvidenceStates,
    expectedSignals: definition.expectedSignals,
    reasonCodes: definition.reasonCodes,
    fixtureOnly: true,
    synthetic: true,
    shadowOnly: true,
    noTargetSystemCall: true,
    noDeployment: true,
    noInfrastructureChange: true,
    noSecretMaterial: true,
    noRawPayload: true,
    noRawRunbookText: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createGoldenOperationalExecutionShadowFixtureSuite(): GoldenOperationalExecutionShadowFixtureSuite {
  const fixtures = Object.freeze(SCENARIO_DEFINITIONS.map(canonicalScenario));
  const sourceRecipeRefDigest = digestValue('source-recipe', 'golden-operational-execution-o01');
  const actionSurfaceRefDigest = digestValue('action-surface', 'operational_execution.change_request');
  const body = {
    version: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
    name: 'Golden Path: Operational Execution',
    step: 'O01',
    sourceRecipeRefDigest,
    actionSurfaceRefDigest,
    fixtureCount: 8,
    scenarios: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS,
    fixtures,
    shadowOnly: true,
    noTargetSystemCalls: true,
    noDeployment: true,
    noInfrastructureChange: true,
    noSecretMaterial: true,
    noRawPayload: true,
    noRawRunbookText: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenOperationalExecutionShadowFixturesDescriptor(): GoldenOperationalExecutionShadowFixturesDescriptor {
  return Object.freeze({
    version: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURES_VERSION,
    step: 'O01',
    sourceSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    scenarios: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_SCENARIOS,
    shadowOnly: true,
    synthetic: true,
    noTargetSystemCalls: true,
    noDeployment: true,
    noInfrastructureChange: true,
    noSecretMaterial: true,
    noRawPayload: true,
    noRawRunbookText: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
    nonClaims: GOLDEN_OPERATIONAL_EXECUTION_SHADOW_FIXTURE_NON_CLAIMS,
  });
}
