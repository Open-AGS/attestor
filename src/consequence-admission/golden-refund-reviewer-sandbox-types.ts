import type { CanonicalShadowEventDecision } from './canonical-shadow-event-schema.js';
import type { GoldenRefundEngineVisibilityGate } from './golden-refund-engine-visibility.js';
import type {
  GoldenRefundShadowFixturePosture,
  GoldenRefundShadowFixtureRefundFacts,
} from './golden-refund-shadow-fixtures.js';
import type { ShadowRuntimeFixtureReplaySmokeResult } from './shadow-runtime-fixture-replay-smoke.js';

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
