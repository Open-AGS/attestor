import type { CanonicalShadowEventDecision } from './canonical-shadow-event-schema.js';
import type {
  GoldenExternalCommunicationShadowFixtureMessageFacts,
  GoldenExternalCommunicationShadowFixturePosture,
} from './golden-external-communication-shadow-fixtures.js';
import type { ShadowRuntimeFixtureReplaySmokeResult } from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-external-communication-reviewer-sandbox.v1';
export const GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-external-communication-reviewer-sandbox-input.v1';

export const GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'channelClass',
  'messageClass',
  'recipientClass',
  'claimClass',
  'approvalFreshness',
  'tenantScope',
  'commercialEmailPosture',
  'evidenceAuthority',
  'instructionLikeEvidence',
  'publicClaim',
  'externalSideEffect',
  'duplicateSendAttempt',
] as const;

export const GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'recipient-tenant-binding',
  'claim-authority-check',
  'commercial-email-control-check',
  'instruction-like-evidence-review',
  'duplicate-send-replay-check',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenExternalCommunicationReviewerSandboxGate =
  typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'strict-json-allowlisted-shape',
  'owasp-input-validation-allowlist',
  'ftc-can-spam-commercial-email-controls',
  'ftc-endorsement-public-claim-discipline',
  'sendgrid-sandbox-mode-no-delivery-pattern',
  'mailgun-test-mode-no-delivery-pattern',
  'nist-ai-rmf-risk-control-vocabulary',
] as const;

export type GoldenExternalCommunicationReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenExternalCommunicationReviewerSandboxInput {
  readonly version: typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly channelClass: GoldenExternalCommunicationShadowFixtureMessageFacts['channelClass'];
  readonly messageClass: GoldenExternalCommunicationShadowFixtureMessageFacts['messageClass'];
  readonly recipientClass: GoldenExternalCommunicationShadowFixtureMessageFacts['recipientClass'];
  readonly claimClass: GoldenExternalCommunicationShadowFixtureMessageFacts['claimClass'];
  readonly approvalFreshness: GoldenExternalCommunicationShadowFixtureMessageFacts['approvalFreshness'];
  readonly tenantScope: GoldenExternalCommunicationShadowFixtureMessageFacts['tenantScope'];
  readonly commercialEmailPosture: GoldenExternalCommunicationShadowFixtureMessageFacts['commercialEmailPosture'];
  readonly evidenceAuthority: GoldenExternalCommunicationShadowFixtureMessageFacts['evidenceAuthority'];
  readonly instructionLikeEvidence: boolean;
  readonly publicClaim: boolean;
  readonly externalSideEffect: boolean;
  readonly duplicateSendAttempt: boolean;
}

export interface GoldenExternalCommunicationReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noMessageDelivery: true;
  readonly noProviderCall: true;
  readonly noCrmOrTicketingCall: true;
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
  readonly rawMessageBodyRead: false;
  readonly rawMessageBodyStored: false;
  readonly rawRecipientIdentifiersRead: false;
  readonly rawRecipientIdentifiersStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

export interface GoldenExternalCommunicationReviewerSandboxDecisionSummary {
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

export interface GoldenExternalCommunicationReviewerSandboxResult {
  readonly version: typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_VERSION;
  readonly step: 'E04';
  readonly generatedAt: string;
  readonly inputVersion:
    typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenExternalCommunicationReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'external_communication.customer_message';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenExternalCommunicationShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenExternalCommunicationReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenExternalCommunicationReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}
