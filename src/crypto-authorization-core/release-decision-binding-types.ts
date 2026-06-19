import type {
  CapabilityBoundaryDescriptor,
  ConsequenceType,
  OutputContractDescriptor,
} from '../release-kernel/types.js';
import type {
  EvidenceArtifactReference,
  EvidencePack,
  ReleaseActorReference,
  ReleaseDecision,
  ReleaseTargetReference,
  ReleaseTokenClaims,
  ReviewAuthority,
} from '../release-kernel/object-model.js';
import type {
  CanonicalReleaseHashBundle,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type { CryptoEip712AuthorizationEnvelope } from './eip712-authorization-envelope.js';
import type {
  CryptoErc1271ValidationResult,
  CryptoSignatureValidationProjection,
} from './erc1271-validation-projection.js';
import type {
  CryptoAuthorizationDecision as CryptoAuthorizationDecisionObject,
  CryptoAuthorizationIntent,
} from './object-model.js';
import type {
  CryptoAuthorizationFreshnessEvaluation,
  CryptoReplayFreshnessRules,
} from './replay-freshness-rules.js';
import type {
  CryptoAuthorizationConsequenceKind,
  CryptoAuthorizationRiskClass,
} from './types.js';

export const CRYPTO_RELEASE_DECISION_BINDING_SPEC_VERSION =
  'attestor.crypto-release-decision-binding.v1';

export const CRYPTO_RELEASE_ARTIFACT_PATHS = [
  'crypto-authorization-intent',
  'crypto-authorization-decision',
  'crypto-risk-assessment',
  'crypto-eip712-envelope',
  'crypto-signature-validation',
  'crypto-freshness-rules',
  'crypto-freshness-evaluation',
] as const;
export type CryptoReleaseArtifactPath = typeof CRYPTO_RELEASE_ARTIFACT_PATHS[number];

export const CRYPTO_RELEASE_BINDING_STATUSES = [
  'bound',
  'blocked',
  'review-required',
  'pending',
] as const;
export type CryptoReleaseBindingStatus =
  typeof CRYPTO_RELEASE_BINDING_STATUSES[number];

export const CRYPTO_RELEASE_BINDING_CHECKS = [
  'crypto-decision-matches-intent',
  'envelope-matches-crypto-decision',
  'risk-assessment-matches-decision',
  'release-hashes-match-crypto-payloads',
  'release-status-matches-crypto-result',
  'review-authority-is-not-weaker',
  'evidence-artifacts-are-bound',
  'release-token-posture-is-bound',
] as const;
export type CryptoReleaseBindingCheck = typeof CRYPTO_RELEASE_BINDING_CHECKS[number];

export interface CryptoReleaseHashBinding {
  readonly releaseHashBundle: CanonicalReleaseHashBundle;
  readonly outputPayloadDigest: string;
  readonly consequencePayloadDigest: string;
  readonly outputContract: OutputContractDescriptor;
  readonly capabilityBoundary: CapabilityBoundaryDescriptor;
  readonly target: ReleaseTargetReference;
}

export interface CryptoReleaseReviewerAuthorityBinding {
  readonly cryptoRequired: ReviewAuthority;
  readonly releaseBound: ReviewAuthority;
  readonly sufficient: boolean;
  readonly minimumReviewerCountDelta: number;
}

export interface CryptoReleaseTokenPosture {
  readonly required: boolean;
  readonly eligible: boolean;
  readonly tokenClaimStatus:
    | 'not-required'
    | 'required-not-present'
    | 'bound';
  readonly tokenId: string | null;
  readonly audience: string;
  readonly subject: string;
  readonly scope: string;
  readonly resource: string;
  readonly introspectionRequired: boolean;
  readonly consumeOnSuccess: boolean;
  readonly maxUses: number;
  readonly ttlCeilingSeconds: number;
}

export interface CryptoReleaseEvidenceBinding {
  readonly requiredArtifacts: readonly EvidenceArtifactReference[];
  readonly evidencePackStatus: 'not-provided' | 'bound';
  readonly evidencePackId: string | null;
}

export interface CryptoReleaseDecisionBinding {
  readonly version: typeof CRYPTO_RELEASE_DECISION_BINDING_SPEC_VERSION;
  readonly bindingId: string;
  readonly status: CryptoReleaseBindingStatus;
  readonly cryptoDecisionId: string;
  readonly releaseDecisionId: string;
  readonly chainId: string;
  readonly accountAddress: string;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly releaseConsequenceType: ConsequenceType;
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly releaseDecision: ReleaseDecision;
  readonly hashBinding: CryptoReleaseHashBinding;
  readonly reviewerAuthority: CryptoReleaseReviewerAuthorityBinding;
  readonly evidence: CryptoReleaseEvidenceBinding;
  readonly releaseTokenPosture: CryptoReleaseTokenPosture;
  readonly bindingChecks: readonly CryptoReleaseBindingCheck[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoReleaseDecisionBindingInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly cryptoDecision: CryptoAuthorizationDecisionObject;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly envelope: CryptoEip712AuthorizationEnvelope;
  readonly signatureValidation: CryptoSignatureValidationProjection;
  readonly signatureValidationResult?: CryptoErc1271ValidationResult | null;
  readonly freshnessRules: CryptoReplayFreshnessRules;
  readonly freshnessEvaluation?: CryptoAuthorizationFreshnessEvaluation | null;
  readonly releaseDecision?: ReleaseDecision | null;
  readonly evidencePack?: EvidencePack | null;
  readonly releaseTokenClaims?: ReleaseTokenClaims | null;
  readonly createdAt?: string | null;
  readonly policyVersion?: string | null;
  readonly policyHash?: string | null;
  readonly requester?: ReleaseActorReference | null;
  readonly target?: ReleaseTargetReference | null;
  readonly evidencePackId?: string | null;
  readonly releaseTokenId?: string | null;
  readonly requiredReviewerRoles?: readonly string[] | null;
  readonly requiredReviewerIds?: readonly string[] | null;
}

export interface CryptoReleaseDecisionBindingDescriptor {
  readonly version: typeof CRYPTO_RELEASE_DECISION_BINDING_SPEC_VERSION;
  readonly artifactPaths: typeof CRYPTO_RELEASE_ARTIFACT_PATHS;
  readonly statuses: typeof CRYPTO_RELEASE_BINDING_STATUSES;
  readonly bindingChecks: typeof CRYPTO_RELEASE_BINDING_CHECKS;
  readonly standards: readonly string[];
}
