import type { CanonicalShadowEventDecision } from './canonical-shadow-event-schema.js';
import type {
  GoldenAuthorityChangeShadowFixtureAuthorityFacts,
  GoldenAuthorityChangeShadowFixturePosture,
} from './golden-authority-change-shadow-fixtures.js';
import type { ShadowRuntimeFixtureReplaySmokeResult } from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-authority-change-reviewer-sandbox.v1';
export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-authority-change-reviewer-sandbox-input.v1';

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'targetSystem',
  'authorityClass',
  'subjectClass',
  'resourceClass',
  'permissionClass',
  'approvalFreshness',
  'tenantScope',
  'separationOfDuties',
  'leastPrivilege',
  'instructionLikeEvidence',
  'externalSideEffect',
  'breakGlass',
] as const;

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'tenant-scope-binding',
  'approval-freshness-check',
  'least-privilege-check',
  'separation-of-duties-check',
  'instruction-like-evidence-review',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenAuthorityChangeReviewerSandboxGate =
  typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'strict-json-allowlisted-shape',
  'owasp-input-validation-allowlist',
  'nist-abac-subject-resource-action-environment',
  'nist-sp-800-53-access-control-audit-events',
  'identity-governance-workflow-shape',
] as const;

export type GoldenAuthorityChangeReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenAuthorityChangeReviewerSandboxInput {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly targetSystem: GoldenAuthorityChangeShadowFixtureAuthorityFacts['targetSystem'];
  readonly authorityClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['authorityClass'];
  readonly subjectClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['subjectClass'];
  readonly resourceClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['resourceClass'];
  readonly permissionClass: GoldenAuthorityChangeShadowFixtureAuthorityFacts['permissionClass'];
  readonly approvalFreshness: GoldenAuthorityChangeShadowFixtureAuthorityFacts['approvalFreshness'];
  readonly tenantScope: GoldenAuthorityChangeShadowFixtureAuthorityFacts['tenantScope'];
  readonly separationOfDuties: GoldenAuthorityChangeShadowFixtureAuthorityFacts['separationOfDuties'];
  readonly leastPrivilege: GoldenAuthorityChangeShadowFixtureAuthorityFacts['leastPrivilege'];
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly breakGlass: boolean;
}

export interface GoldenAuthorityChangeReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
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
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
}

export interface GoldenAuthorityChangeReviewerSandboxDecisionSummary {
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

export interface GoldenAuthorityChangeReviewerSandboxResult {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_VERSION;
  readonly step: 'A04';
  readonly generatedAt: string;
  readonly inputVersion: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenAuthorityChangeReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'authority_change.identity_workflow';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenAuthorityChangeShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenAuthorityChangeReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenAuthorityChangeReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}
