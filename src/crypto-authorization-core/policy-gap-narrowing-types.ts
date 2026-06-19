import type { CryptoAuthorizationPolicyDimension } from './types.js';
import type {
  CryptoIntelligenceEvidenceRef,
  CryptoIntelligenceMissingEvidenceClass,
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';

export const CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION =
  'attestor.crypto-policy-gap-narrowing.v1';

export const CRYPTO_POLICY_GAP_CLASSES = [
  'policy-dimension-missing',
  'policy-explicit-deny',
  'policy-implicit-deny',
  'policy-conflict',
  'policy-evidence-stale',
  'evidence-missing',
  'adapter-readiness-missing',
  'freshness-window-missing',
  'authority-review-required',
  'amount-boundary-unsafe',
  'counterparty-boundary-unsafe',
  'route-boundary-unsafe',
  'allowance-boundary-unsafe',
  'delegation-boundary-unsafe',
  'custody-control-missing',
  'payment-binding-missing',
  'solver-settlement-missing',
  'velocity-boundary-unsafe',
] as const;
export type CryptoPolicyGapClass = typeof CRYPTO_POLICY_GAP_CLASSES[number];

export const CRYPTO_NARROWING_CANDIDATE_KINDS = [
  'collect-evidence',
  'bind-policy-dimension',
  'lower-amount-band',
  'shorten-validity-window',
  'reduce-operation-count',
  'bind-counterparty-scope',
  'bind-route-commitment',
  'bind-revocation-path',
  'bind-custody-quorum',
  'bind-payment-proof',
  'bind-settlement-proof',
  'run-adapter-preflight',
  'route-to-review',
  'block-until-policy',
] as const;
export type CryptoNarrowingCandidateKind =
  typeof CRYPTO_NARROWING_CANDIDATE_KINDS[number];

export const CRYPTO_NARROWING_SCOPE_KINDS = [
  'amount',
  'validity-window',
  'operation-count',
  'counterparty',
  'route',
  'revocation',
  'custody',
  'payment',
  'settlement',
  'adapter-preflight',
  'review-only',
  'policy',
] as const;
export type CryptoNarrowingScopeKind =
  typeof CRYPTO_NARROWING_SCOPE_KINDS[number];

export const CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES = [
  'covered',
  'missing',
  'stale',
  'conflicting',
  'explicit-deny',
  'implicit-deny',
  'review-required',
] as const;
export type CryptoPolicyDimensionCoverageStatus =
  typeof CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES[number];

export const CRYPTO_POLICY_COVERAGE_SOURCE_KINDS = [
  'policy-rule',
  'scope-binding',
  'operator-risk-input',
  'adapter-readiness',
  'simulation',
  'external-review',
] as const;
export type CryptoPolicyCoverageSourceKind =
  typeof CRYPTO_POLICY_COVERAGE_SOURCE_KINDS[number];

export const CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION =
  'attestor.crypto-policy-intelligence-routing.v1';

export const CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS = [
  'admit-ready',
  'review-required',
  'block-missing-policy',
  'block-stale-policy',
  'block-policy-conflict',
  'block-implicit-deny',
  'block-explicit-deny',
] as const;
export type CryptoPolicyIntelligenceRouteKind =
  typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS[number];

export const CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS = [
  'admit-with-policy-evidence',
  'send-to-human-review',
  'bind-policy-dimension',
  'refresh-policy-evidence',
  'resolve-policy-conflict',
  'block-implicit-deny',
  'block-explicit-deny',
] as const;
export type CryptoPolicyIntelligenceOperatorAction =
  typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS[number];

export interface CryptoPolicyGap {
  readonly gapId: string;
  readonly gapClass: CryptoPolicyGapClass;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly modelSafeSummary: string;
  readonly blocksAdmission: boolean;
}

export interface CryptoNarrowingCandidate {
  readonly candidateId: string;
  readonly kind: CryptoNarrowingCandidateKind;
  readonly scopeKind: CryptoNarrowingScopeKind;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly sourceGapIds: readonly string[];
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly safeInstruction: string;
  readonly operatorAction: string;
  readonly modelFeedback: {
    readonly reasonCodes: readonly string[];
    readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
    readonly safeInstruction: string;
  };
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadRequired: false;
}

export interface CryptoPolicyDimensionCoverageInput {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly status: CryptoPolicyDimensionCoverageStatus;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef?: string | null;
  readonly evidenceRefs?: readonly CryptoIntelligenceEvidenceRef[] | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly observedAt?: string | null;
  readonly maxAgeSeconds?: number | null;
}

export interface CryptoPolicyDimensionCoverage {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly status: CryptoPolicyDimensionCoverageStatus;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef: string | null;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly observedAt: string | null;
  readonly maxAgeSeconds: number | null;
  readonly stale: boolean;
  readonly rawPolicyThresholdExposed: false;
}

export interface CreateCryptoPolicyCoverageProfileInput {
  readonly generatedAt: string;
  readonly scopeRef?: string | null;
  readonly entries: readonly CryptoPolicyDimensionCoverageInput[];
}

export interface CryptoPolicyCoverageProfile {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly entryCount: number;
  readonly coveredCount: number;
  readonly reviewCount: number;
  readonly blockCount: number;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly blockedPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly reasonCodes: readonly string[];
  readonly entries: readonly CryptoPolicyDimensionCoverage[];
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPolicyGapNarrowingAssessmentInput {
  readonly signalAssessment: CryptoIntelligenceRiskSignalAssessment;
  readonly generatedAt: string;
  readonly policyRef?: string | null;
  readonly operatorContextRef?: string | null;
  readonly allowedCandidateKinds?: readonly CryptoNarrowingCandidateKind[] | null;
  readonly policyCoverageProfile?: CryptoPolicyCoverageProfile | null;
}

export interface CryptoPolicyGapNarrowingAssessment {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly sourceSignalAssessmentDigest: string;
  readonly riskAssessmentDigest: string;
  readonly policyRef: string | null;
  readonly operatorContextRef: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly policyCoverageProfileDigest: string | null;
  readonly gapCount: number;
  readonly candidateCount: number;
  readonly blockedGapCount: number;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly gaps: readonly CryptoPolicyGap[];
  readonly candidates: readonly CryptoNarrowingCandidate[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPolicyIntelligenceRoutingProfileInput {
  readonly coverageProfile: CryptoPolicyCoverageProfile;
  readonly policyGapAssessment?: CryptoPolicyGapNarrowingAssessment | null;
  readonly generatedAt?: string | null;
  readonly scopeRef?: string | null;
}

export interface CryptoPolicyIntelligenceRoutingEntry {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly coverageStatus: CryptoPolicyDimensionCoverageStatus;
  readonly routeKind: CryptoPolicyIntelligenceRouteKind;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly precedence: number;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef: string | null;
  readonly operatorAction: CryptoPolicyIntelligenceOperatorAction;
  readonly modelSafeInstruction: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefCount: number;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
}

export interface CryptoPolicyIntelligenceRoutingBlocker {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly routeKind: CryptoPolicyIntelligenceRouteKind;
  readonly operatorAction: CryptoPolicyIntelligenceOperatorAction;
  readonly reasonCodes: readonly string[];
}

export interface CryptoPolicyIntelligenceRoutingProfile {
  readonly version: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly coverageProfileDigest: string;
  readonly policyGapAssessmentDigest: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly routeCounts: Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>>;
  readonly admitRouteCount: number;
  readonly reviewRouteCount: number;
  readonly blockRouteCount: number;
  readonly entries: readonly CryptoPolicyIntelligenceRoutingEntry[];
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly modelSafeSummary: string;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoPolicyGapNarrowingDescriptor {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly gapClasses: typeof CRYPTO_POLICY_GAP_CLASSES;
  readonly candidateKinds: typeof CRYPTO_NARROWING_CANDIDATE_KINDS;
  readonly scopeKinds: typeof CRYPTO_NARROWING_SCOPE_KINDS;
  readonly policyCoverageStatuses: typeof CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES;
  readonly policyCoverageSourceKinds: typeof CRYPTO_POLICY_COVERAGE_SOURCE_KINDS;
  readonly policyIntelligenceRoutingVersion:
    typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly policyIntelligenceRouteKinds: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS;
  readonly policyIntelligenceOperatorActions:
    typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly rawPolicyThresholdExposed: false;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
}

export interface CryptoPolicyIntelligenceRoutingDescriptor {
  readonly version: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly routeKinds: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS;
  readonly operatorActions: typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
}
