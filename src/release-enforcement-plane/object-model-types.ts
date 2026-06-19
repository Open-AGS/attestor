import type { ReleaseActorReference } from '../release-layer/index.js';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import type {
  EnforcementBreakGlassReason,
  EnforcementCacheState,
  EnforcementDegradedState,
  EnforcementFailureReason,
  EnforcementOutcome,
  EnforcementVerificationMode,
  ReleasePresentationMode,
} from './types.js';
import type {
  CreateEnforcementPointReferenceInput,
  EnforcementPointReference,
  ReleaseEnforcementConsequenceType,
  ReleaseEnforcementRiskClass,
} from './types.js';

export const RELEASE_ENFORCEMENT_OBJECT_MODEL_SPEC_VERSION =
  'attestor.release-enforcement-object-model.v1';
export const ENFORCEMENT_REQUEST_SPEC_VERSION =
  'attestor.enforcement-request.v1';
export const RELEASE_PRESENTATION_SPEC_VERSION =
  'attestor.release-presentation.v1';
export const INTROSPECTION_SNAPSHOT_SPEC_VERSION =
  'attestor.introspection-snapshot.v1';
export const VERIFICATION_RESULT_SPEC_VERSION =
  'attestor.verification-result.v1';
export const ENFORCEMENT_DECISION_SPEC_VERSION =
  'attestor.enforcement-decision.v1';
export const ENFORCEMENT_RECEIPT_SPEC_VERSION =
  'attestor.enforcement-receipt.v1';

export type VerificationStatus = 'valid' | 'invalid' | 'indeterminate';

export type EnforcementEvidenceBoundary = 'none' | 'declared-only' | 'verified';

export interface EnforcementEvidenceSemantics {
  readonly declarationBound: boolean;
  readonly verifiedEvidence: boolean;
  readonly declaredEvidenceCount: number;
  readonly verifiedEvidenceCount: number;
  readonly evidenceKinds: readonly string[];
  readonly boundary: EnforcementEvidenceBoundary;
}

export interface ReleaseEnforcementPolicyContext {
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}

export interface EnforcementRequest {
  readonly version: typeof ENFORCEMENT_REQUEST_SPEC_VERSION;
  readonly id: string;
  readonly receivedAt: string;
  readonly enforcementPoint: EnforcementPointReference;
  readonly enforcementPointLabel: string;
  readonly targetId: string;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly requester: ReleaseActorReference | null;
  readonly traceId: string | null;
  readonly idempotencyKey: string | null;
  readonly transport: EnforcementRequestTransport | null;
}

export type EnforcementRequestTransport =
  | {
      readonly kind: 'http';
      readonly method: string;
      readonly uri: string;
      readonly headersDigest: string | null;
      readonly bodyDigest: string | null;
    }
  | {
      readonly kind: 'async';
      readonly messageId: string;
      readonly queueOrTopic: string;
      readonly envelopeDigest: string | null;
    }
  | {
      readonly kind: 'artifact';
      readonly artifactId: string;
      readonly artifactDigest: string;
    };

export type ReleasePresentationProof =
  | {
      readonly kind: 'dpop';
      readonly proofJwt: string;
      readonly httpMethod: string;
      readonly httpUri: string;
      readonly proofJti: string;
      readonly accessTokenHash: string | null;
      readonly nonce: string | null;
      readonly keyThumbprint: string;
    }
  | {
      readonly kind: 'mtls';
      readonly certificateThumbprint: string;
      readonly subjectDn: string | null;
      readonly spiffeId: string | null;
    }
  | {
      readonly kind: 'spiffe';
      readonly spiffeId: string;
      readonly trustDomain: string;
      readonly svidThumbprint: string | null;
    }
  | {
      readonly kind: 'http-message-signature';
      readonly signatureInput: string;
      readonly signature: string;
      readonly keyId: string;
      readonly coveredComponents: readonly string[];
      readonly createdAt: string | null;
      readonly expiresAt: string | null;
      readonly nonce: string | null;
    }
  | {
      readonly kind: 'signed-json-envelope';
      readonly envelopeDigest: string;
      readonly subjectDigest: string;
      readonly signatureRef: string | null;
    };

export interface ReleasePresentation {
  readonly version: typeof RELEASE_PRESENTATION_SPEC_VERSION;
  readonly mode: ReleasePresentationMode;
  readonly presentedAt: string;
  readonly releaseToken: string | null;
  readonly releaseTokenId: string | null;
  readonly releaseTokenDigest: string | null;
  readonly issuer: string | null;
  readonly subject: string | null;
  readonly audience: string | null;
  readonly expiresAt: string | null;
  readonly scope: readonly string[];
  readonly proof: ReleasePresentationProof | null;
}

export interface IntrospectionSnapshot {
  readonly version: typeof INTROSPECTION_SNAPSHOT_SPEC_VERSION;
  readonly checkedAt: string;
  readonly authority: string;
  readonly active: boolean;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly issuer: string | null;
  readonly subject: string | null;
  readonly audience: string | null;
  readonly tenantId: string | null;
  readonly scope: readonly string[];
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly notBefore: string | null;
  readonly clientId: string | null;
  readonly consequenceType: ReleaseEnforcementConsequenceType | null;
  readonly riskClass: ReleaseEnforcementRiskClass | null;
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext;
}

export interface VerificationResult {
  readonly version: typeof VERIFICATION_RESULT_SPEC_VERSION;
  readonly id: string;
  readonly checkedAt: string;
  readonly mode: EnforcementVerificationMode;
  readonly status: VerificationStatus;
  readonly cacheState: EnforcementCacheState;
  readonly degradedState: EnforcementDegradedState;
  readonly presentationMode: ReleasePresentationMode;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly issuer: string | null;
  readonly subject: string | null;
  readonly audience: string | null;
  readonly tenantId: string | null;
  readonly outputHash: string | null;
  readonly consequenceHash: string | null;
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly introspection: IntrospectionSnapshot | null;
}

export interface EnforcementBreakGlassGrant {
  readonly reason: EnforcementBreakGlassReason;
  readonly authorizedBy: ReleaseActorReference;
  readonly authorizedAt: string;
  readonly expiresAt: string;
  readonly ticketId: string | null;
  readonly rationale: string;
}

export interface EnforcementDecision {
  readonly version: typeof ENFORCEMENT_DECISION_SPEC_VERSION;
  readonly id: string;
  readonly requestId: string;
  readonly decidedAt: string;
  readonly outcome: EnforcementOutcome;
  readonly enforcementPoint: EnforcementPointReference;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly verification: VerificationResult;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly cacheState: EnforcementCacheState;
  readonly degradedState: EnforcementDegradedState;
  readonly breakGlass: EnforcementBreakGlassGrant | null;
}

export interface EnforcementReceipt {
  readonly version: typeof ENFORCEMENT_RECEIPT_SPEC_VERSION;
  readonly id: string;
  readonly issuedAt: string;
  readonly decisionId: string;
  readonly requestId: string;
  readonly outcome: EnforcementOutcome;
  readonly enforcementPointLabel: string;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly outputHash: string | null;
  readonly consequenceHash: string | null;
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext;
  readonly verificationStatus: VerificationStatus;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly evidenceSemantics: EnforcementEvidenceSemantics | null;
  readonly receiptDigest: string | null;
}

export interface EnforcementReceiptDigestMaterial {
  readonly decisionId: string;
  readonly requestId: string;
  readonly outcome: EnforcementOutcome;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly outputHash: string | null;
  readonly consequenceHash: string | null;
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext;
  readonly verificationStatus: VerificationStatus;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly evidenceSemantics?: EnforcementEvidenceSemantics;
}

export interface CreateEnforcementRequestInput {
  readonly id: string;
  readonly receivedAt: string;
  readonly enforcementPoint: CreateEnforcementPointReferenceInput | EnforcementPointReference;
  readonly targetId: string;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
  readonly requester?: ReleaseActorReference | null;
  readonly traceId?: string | null;
  readonly idempotencyKey?: string | null;
  readonly transport?: EnforcementRequestTransport | null;
}

export interface CreateReleasePresentationInput {
  readonly mode: ReleasePresentationMode;
  readonly presentedAt: string;
  readonly releaseToken?: string | null;
  readonly releaseTokenId?: string | null;
  readonly releaseTokenDigest?: string | null;
  readonly issuer?: string | null;
  readonly subject?: string | null;
  readonly audience?: string | null;
  readonly expiresAt?: string | null;
  readonly scope?: readonly string[];
  readonly proof?: ReleasePresentationProof | null;
}

export interface CreateIntrospectionSnapshotInput {
  readonly checkedAt: string;
  readonly authority: string;
  readonly active: boolean;
  readonly releaseTokenId?: string | null;
  readonly releaseDecisionId?: string | null;
  readonly issuer?: string | null;
  readonly subject?: string | null;
  readonly audience?: string | null;
  readonly tenantId?: string | null;
  readonly scope?: readonly string[];
  readonly issuedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly notBefore?: string | null;
  readonly clientId?: string | null;
  readonly consequenceType?: ReleaseEnforcementConsequenceType | null;
  readonly riskClass?: ReleaseEnforcementRiskClass | null;
  readonly policyHash?: string | null;
  readonly policyVersion?: string | null;
  readonly policyIrHash?: string | null;
  readonly policyProvenanceSource?: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion?: string | null;
  readonly compiledPolicyIrVersion?: string | null;
}

export interface CreateVerificationResultInput {
  readonly id: string;
  readonly checkedAt: string;
  readonly mode: EnforcementVerificationMode;
  readonly status: VerificationStatus;
  readonly cacheState?: EnforcementCacheState;
  readonly degradedState?: EnforcementDegradedState;
  readonly presentation: ReleasePresentation;
  readonly releaseDecisionId?: string | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
  readonly policyHash?: string | null;
  readonly policyVersion?: string | null;
  readonly policyIrHash?: string | null;
  readonly policyProvenanceSource?: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion?: string | null;
  readonly compiledPolicyIrVersion?: string | null;
  readonly tenantId?: string | null;
  readonly failureReasons?: readonly EnforcementFailureReason[];
  readonly introspection?: IntrospectionSnapshot | null;
}

export interface CreateEnforcementDecisionInput {
  readonly id: string;
  readonly request: EnforcementRequest;
  readonly decidedAt: string;
  readonly verification: VerificationResult;
  readonly outcome?: EnforcementOutcome;
  readonly failureReasons?: readonly EnforcementFailureReason[];
  readonly breakGlass?: EnforcementBreakGlassGrant | null;
}

export interface CreateEnforcementReceiptInput {
  readonly id: string;
  readonly issuedAt: string;
  readonly decision: EnforcementDecision;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
  readonly evidenceSemantics?: EnforcementEvidenceSemantics | null;
  readonly receiptDigest?: string | null;
}

export interface CreateEnforcementReceiptDigestInput {
  readonly decision: EnforcementDecision;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
  readonly evidenceSemantics?: EnforcementEvidenceSemantics | null;
}
