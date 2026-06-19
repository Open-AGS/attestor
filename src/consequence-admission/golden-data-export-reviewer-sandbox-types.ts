import type { CanonicalShadowEventDecision } from './canonical-shadow-event-schema.js';
import type {
  GoldenDataExportShadowFixtureDataFacts,
  GoldenDataExportShadowFixturePosture,
} from './golden-data-export-shadow-fixtures.js';
import type { ShadowRuntimeFixtureReplaySmokeResult } from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-data-export-reviewer-sandbox.v1';
export const GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-data-export-reviewer-sandbox-input.v1';

export const GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'queryClass',
  'dataClass',
  'recipientClass',
  'requestedFieldsClass',
  'rowCountBucket',
  'approvalFreshness',
  'tenantScope',
  'purposeBound',
  'instructionLikeEvidence',
  'externalSideEffect',
  'writeSideEffect',
] as const;

export const GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'tenant-scope-binding',
  'recipient-authority-check',
  'field-minimization-check',
  'approval-freshness-check',
  'instruction-like-evidence-review',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenDataExportReviewerSandboxGate =
  typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'json-schema-allowlisted-shape',
  'owasp-input-validation-allowlist',
  'snowflake-cortex-agent-tool-shape',
  'databricks-agent-tool-shape',
  'nist-privacy-data-minimization',
] as const;

export type GoldenDataExportReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenDataExportReviewerSandboxInput {
  readonly version: typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly queryClass: GoldenDataExportShadowFixtureDataFacts['queryClass'];
  readonly dataClass: GoldenDataExportShadowFixtureDataFacts['dataClass'];
  readonly recipientClass: GoldenDataExportShadowFixtureDataFacts['recipientClass'];
  readonly requestedFieldsClass: GoldenDataExportShadowFixtureDataFacts['requestedFieldsClass'];
  readonly rowCountBucket: GoldenDataExportShadowFixtureDataFacts['rowCountBucket'];
  readonly approvalFreshness: GoldenDataExportShadowFixtureDataFacts['approvalFreshness'];
  readonly tenantScope: GoldenDataExportShadowFixtureDataFacts['tenantScope'];
  readonly purposeBound: boolean;
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly writeSideEffect: boolean;
}

export interface GoldenDataExportReviewerSandboxSafetyBoundary {
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

export interface GoldenDataExportReviewerSandboxDecisionSummary {
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

export interface GoldenDataExportReviewerSandboxResult {
  readonly version: typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_VERSION;
  readonly step: 'D04';
  readonly generatedAt: string;
  readonly inputVersion: typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenDataExportReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'data_movement.controlled_export';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenDataExportShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenDataExportReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenDataExportReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}
