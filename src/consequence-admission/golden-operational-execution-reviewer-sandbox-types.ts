import type {
  CanonicalShadowEventDecision,
} from './canonical-shadow-event-schema.js';
import type {
  GoldenOperationalExecutionShadowFixtureOperationFacts,
  GoldenOperationalExecutionShadowFixturePosture,
} from './golden-operational-execution-shadow-fixtures.js';
import type {
  ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-operational-execution-reviewer-sandbox.v1';
export const GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-operational-execution-reviewer-sandbox-input.v1';

export const GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'targetSystem',
  'operationClass',
  'environmentClass',
  'changeRisk',
  'approvalFreshness',
  'rollbackPlanStatus',
  'dryRunStatus',
  'incidentState',
  'tenantScope',
  'operatorAuthority',
  'instructionLikeEvidence',
  'externalSideEffect',
  'duplicateOperationAttempt',
] as const;

export const GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'operation-surface-binding',
  'tenant-scope-check',
  'operator-authority-check',
  'dry-run-plan-check',
  'rollback-readiness-check',
  'incident-break-glass-check',
  'duplicate-operation-replay-check',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenOperationalExecutionReviewerSandboxGate =
  typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'strict-json-allowlisted-shape',
  'kubernetes-server-side-dry-run-no-mutation-pattern',
  'terraform-plan-before-apply-pattern',
  'github-protected-deployment-environment-review-pattern',
  'nist-sp-800-61-rev3-incident-response-lifecycle',
  'opa-cedar-policy-test-pattern',
] as const;

export type GoldenOperationalExecutionReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenOperationalExecutionReviewerSandboxInput {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly targetSystem: GoldenOperationalExecutionShadowFixtureOperationFacts['targetSystem'];
  readonly operationClass: GoldenOperationalExecutionShadowFixtureOperationFacts['operationClass'];
  readonly environmentClass: GoldenOperationalExecutionShadowFixtureOperationFacts['environmentClass'];
  readonly changeRisk: GoldenOperationalExecutionShadowFixtureOperationFacts['changeRisk'];
  readonly approvalFreshness: GoldenOperationalExecutionShadowFixtureOperationFacts['approvalFreshness'];
  readonly rollbackPlanStatus: GoldenOperationalExecutionShadowFixtureOperationFacts['rollbackPlanStatus'];
  readonly dryRunStatus: GoldenOperationalExecutionShadowFixtureOperationFacts['dryRunStatus'];
  readonly incidentState: GoldenOperationalExecutionShadowFixtureOperationFacts['incidentState'];
  readonly tenantScope: GoldenOperationalExecutionShadowFixtureOperationFacts['tenantScope'];
  readonly operatorAuthority: GoldenOperationalExecutionShadowFixtureOperationFacts['operatorAuthority'];
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly duplicateOperationAttempt: boolean;
}

export interface GoldenOperationalExecutionReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noDeployment: true;
  readonly noInfrastructureChange: true;
  readonly noSecretManagerWrite: true;
  readonly noIncidentAutomationExecution: true;
  readonly noRunbookExecution: true;
  readonly noProviderCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawDeploymentManifestRead: false;
  readonly rawDeploymentManifestStored: false;
  readonly rawTerraformPlanRead: false;
  readonly rawTerraformPlanStored: false;
  readonly rawSecretMaterialRead: false;
  readonly rawSecretMaterialStored: false;
  readonly rawRunbookTextRead: false;
  readonly rawRunbookTextStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

export interface GoldenOperationalExecutionReviewerSandboxDecisionSummary {
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

export interface GoldenOperationalExecutionReviewerSandboxResult {
  readonly version: typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_VERSION;
  readonly step: 'O04';
  readonly generatedAt: string;
  readonly inputVersion:
    typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenOperationalExecutionReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'operational_execution.change_request';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenOperationalExecutionShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenOperationalExecutionReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenOperationalExecutionReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}
