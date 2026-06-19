import type {
  CryptoSimulationObservation,
  CryptoSimulationReadiness,
} from './authorization-simulation.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type {
  CryptoAuthorizationPolicyDimension,
  CryptoAuthorizationRiskClass,
  CryptoChainReference,
  CryptoExecutionAdapterKind,
} from './types.js';

export const CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION =
  'attestor.crypto-intelligence-risk-signals.v1';

export const CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES = [
  'account',
  'chain',
  'asset',
  'amount',
  'counterparty',
  'route',
  'allowance',
  'delegation',
  'custody',
  'x402',
  'solver',
  'freshness',
  'velocity',
  'readiness',
] as const;
export type CryptoIntelligenceSignalCategory =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES[number];

export const CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES = [
  'info',
  'warning',
  'critical',
] as const;
export type CryptoIntelligenceSignalSeverity =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES[number];

export const CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS = [
  'admit',
  'review',
  'block',
] as const;
export type CryptoIntelligenceSignalDisposition =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS[number];

export const CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES = [
  'amount',
  'counterparty',
  'policy-dimension',
  'route-commitment',
  'revocation-path',
  'delegation-authorization',
  'delegation-nonce',
  'custody-policy-decision',
  'custody-quorum',
  'x402-payment-requirement',
  'x402-payment-signature',
  'x402-payment-response',
  'solver-settlement-preflight',
  'freshness-window',
  'adapter-preflight',
] as const;
export type CryptoIntelligenceMissingEvidenceClass =
  typeof CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES[number];

export const CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS = Object.freeze({
  operationReview: 5,
  operationCritical: 20,
  amountReviewUsd: '50000',
  amountCriticalUsd: '250000',
  counterpartyReview: 3,
  counterpartyCritical: 10,
});

export interface CryptoIntelligenceEvidenceRef {
  readonly kind: 'digest' | 'scoped-ref' | 'reason-code';
  readonly value: string;
}

export interface CryptoIntelligenceRiskSignal {
  readonly code: string;
  readonly category: CryptoIntelligenceSignalCategory;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly message: string;
  readonly sourceRiskClass: CryptoAuthorizationRiskClass | null;
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
}

export interface CryptoIntelligenceRouteContext {
  readonly isCrossChain?: boolean | null;
  readonly usesBridge?: boolean | null;
  readonly routeCommitmentDigest?: string | null;
  readonly settlementDeadlineIso?: string | null;
  readonly refundPathBound?: boolean | null;
}

export interface CryptoIntelligenceAllowanceContext {
  readonly isUnlimitedApproval?: boolean | null;
  readonly hasRevocationPath?: boolean | null;
  readonly hasExpiry?: boolean | null;
  readonly spenderKnown?: boolean | null;
}

export interface CryptoIntelligenceDelegationContext {
  readonly authorizationTupleDigest?: string | null;
  readonly nonceFresh?: boolean | null;
  readonly delegateRevocationPath?: boolean | null;
  readonly delegateCodeDigest?: string | null;
}

export interface CryptoIntelligenceCustodyContext {
  readonly requiresPolicy?: boolean | null;
  readonly policyDecisionDigest?: string | null;
  readonly quorumMet?: boolean | null;
  readonly providerTerminalStatus?: 'allow' | 'deny' | 'hold' | 'error' | null;
}

export interface CryptoIntelligenceX402Context {
  readonly paymentRequirementDigest?: string | null;
  readonly paymentSignatureDigest?: string | null;
  readonly paymentResponseDigest?: string | null;
  readonly idempotencyKeyDigest?: string | null;
}

export interface CryptoIntelligenceSolverContext {
  readonly routeCommitmentDigest?: string | null;
  readonly settlementPreflightDigest?: string | null;
  readonly refundPathBound?: boolean | null;
}

export interface CryptoIntelligenceFreshnessContext {
  readonly evaluatedAt: string;
  readonly evidenceCreatedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly maxAgeSeconds?: number | null;
}

export interface CryptoIntelligenceVelocityContext {
  readonly windowSeconds?: number | null;
  readonly operationCount?: number | null;
  readonly normalizedUsd?: string | null;
  readonly distinctCounterparties?: number | null;
}

export interface CryptoIntelligenceRiskSignalContext {
  readonly chain?: CryptoChainReference | null;
  readonly executionAdapterKind?: CryptoExecutionAdapterKind | null;
  readonly route?: CryptoIntelligenceRouteContext | null;
  readonly allowance?: CryptoIntelligenceAllowanceContext | null;
  readonly delegation?: CryptoIntelligenceDelegationContext | null;
  readonly custody?: CryptoIntelligenceCustodyContext | null;
  readonly x402?: CryptoIntelligenceX402Context | null;
  readonly solver?: CryptoIntelligenceSolverContext | null;
  readonly freshness?: CryptoIntelligenceFreshnessContext | null;
  readonly velocity?: CryptoIntelligenceVelocityContext | null;
}

export interface CreateCryptoIntelligenceRiskSignalAssessmentInput {
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly readiness?: CryptoSimulationReadiness | null;
  readonly observations?: readonly CryptoSimulationObservation[] | null;
  readonly context?: CryptoIntelligenceRiskSignalContext | null;
}

export interface CryptoIntelligenceRiskSignalAssessment {
  readonly version: typeof CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION;
  readonly riskAssessmentDigest: string;
  readonly consequenceKind: CryptoConsequenceRiskAssessment['consequenceKind'];
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly overallSeverity: CryptoIntelligenceSignalSeverity;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly signalCount: number;
  readonly criticalSignalCount: number;
  readonly reviewSignalCount: number;
  readonly blockSignalCount: number;
  readonly signals: readonly CryptoIntelligenceRiskSignal[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligenceRiskSignalsDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION;
  readonly categories: typeof CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES;
  readonly severities: typeof CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES;
  readonly dispositions: typeof CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS;
  readonly missingEvidenceClasses: typeof CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES;
  readonly velocityThresholds: typeof CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS;
}
