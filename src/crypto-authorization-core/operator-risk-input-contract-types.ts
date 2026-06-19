import type {
  CryptoAuthorizationConsequenceKind,
  CryptoExecutionAdapterKind,
} from './types.js';
import type {
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';

export const CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION =
  'attestor.crypto-operator-risk-input-contract.v1';

export const CRYPTO_OPERATOR_RISK_INPUT_CLASSES = [
  'sanctions-screening',
  'counterparty-screening',
  'counterparty-risk',
  'route-risk',
  'liquidity-risk',
  'bridge-risk',
  'custody-risk',
  'market-risk',
  'fraud-risk',
] as const;
export type CryptoOperatorRiskInputClass =
  typeof CRYPTO_OPERATOR_RISK_INPUT_CLASSES[number];

export const CRYPTO_OPERATOR_RISK_SOURCE_KINDS = [
  'customer-owned-control',
  'customer-operated-screening-engine',
  'third-party-provider',
  'regulator-published-dataset',
  'manual-review-attestation',
] as const;
export type CryptoOperatorRiskSourceKind =
  typeof CRYPTO_OPERATOR_RISK_SOURCE_KINDS[number];

export const CRYPTO_OPERATOR_RISK_SCOPE_KINDS = [
  'chain',
  'account',
  'asset',
  'counterparty',
  'route',
  'custody-policy',
  'operation',
  'adapter',
  'x402-resource',
  'solver-route',
] as const;
export type CryptoOperatorRiskScopeKind =
  typeof CRYPTO_OPERATOR_RISK_SCOPE_KINDS[number];

export const CRYPTO_OPERATOR_RISK_TIERS = [
  'unknown',
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type CryptoOperatorRiskTier = typeof CRYPTO_OPERATOR_RISK_TIERS[number];

export const CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS = [
  'digest',
  'scoped-ref',
  'dataset-version',
  'provider-run',
  'method-ref',
] as const;
export type CryptoOperatorRiskEvidenceRefKind =
  typeof CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS[number];

export const CRYPTO_OPERATOR_RISK_INPUT_STATUSES = [
  'accepted',
  'needs-evidence',
  'stale',
  'rejected',
] as const;
export type CryptoOperatorRiskInputStatus =
  typeof CRYPTO_OPERATOR_RISK_INPUT_STATUSES[number];

export const CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES = [
  'source-provenance',
  'dataset-version',
  'method-reference',
  'evidence-digest',
  'scope-binding',
  'freshness-window',
  'privacy-minimization',
  'oracle-claim-disclaimer',
] as const;
export type CryptoOperatorRiskMissingEvidenceClass =
  typeof CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES[number];

export const CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS = [
  'attestor-crypto-intelligence-guardrails',
  'nist-ai-rmf-risk-documentation',
  'w3c-prov-entity-activity-agent',
  'ofac-sanctions-list-service-dataset-versioning',
  'opentelemetry-sensitive-attribute-opt-in',
] as const;
export type CryptoOperatorRiskGovernanceRef =
  typeof CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS[number];

export interface CryptoOperatorRiskEvidenceRef {
  readonly kind: CryptoOperatorRiskEvidenceRefKind;
  readonly value: string;
}

export interface CryptoOperatorRiskInputProvenance {
  readonly sourceKind: CryptoOperatorRiskSourceKind;
  readonly providerRef: string;
  readonly datasetRef: string;
  readonly datasetVersionRef: string;
  readonly methodRef: string;
  readonly retrievedAt: string;
  readonly evidenceDigest: string;
  readonly providerRunDigest?: string | null;
}

export interface CryptoOperatorRiskInputFreshness {
  readonly observedAt: string;
  readonly expiresAt?: string | null;
  readonly maxAgeSeconds?: number | null;
}

export interface CryptoOperatorRiskInputScope {
  readonly scopeKind: CryptoOperatorRiskScopeKind;
  readonly consequenceKind?: CryptoAuthorizationConsequenceKind | null;
  readonly chainRef?: string | null;
  readonly accountDigest?: string | null;
  readonly assetDigest?: string | null;
  readonly counterpartyDigest?: string | null;
  readonly routeDigest?: string | null;
  readonly operationDigest?: string | null;
  readonly adapterKind?: CryptoExecutionAdapterKind | null;
  readonly policyRef?: string | null;
}

export interface CryptoOperatorRiskInput {
  readonly inputId: string;
  readonly inputClass: CryptoOperatorRiskInputClass;
  readonly riskTier: CryptoOperatorRiskTier;
  readonly source: CryptoOperatorRiskInputProvenance;
  readonly freshness: CryptoOperatorRiskInputFreshness;
  readonly scope: CryptoOperatorRiskInputScope;
  readonly evidenceRefs: readonly CryptoOperatorRiskEvidenceRef[];
  readonly claimsAttestorNativeOracle?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
  readonly rawProviderResponseStored?: boolean | null;
  readonly customerIdentifiersStored?: boolean | null;
  readonly privatePolicyThresholdsStored?: boolean | null;
  readonly solverRouteSecretsStored?: boolean | null;
}

export interface CryptoOperatorRiskInputEntry {
  readonly inputId: string;
  readonly inputClass: CryptoOperatorRiskInputClass;
  readonly status: CryptoOperatorRiskInputStatus;
  readonly riskTier: CryptoOperatorRiskTier;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly sourceKind: CryptoOperatorRiskSourceKind;
  readonly scopeKind: CryptoOperatorRiskScopeKind;
  readonly providerRef: string;
  readonly datasetRef: string;
  readonly datasetVersionRef: string;
  readonly evidenceDigest: string;
  readonly scopeDigest: string;
  readonly evidenceRefs: readonly CryptoOperatorRiskEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly CryptoOperatorRiskMissingEvidenceClass[];
  readonly modelSafeSummary: string;
}

export interface CreateCryptoOperatorRiskInputBundleInput {
  readonly generatedAt: string;
  readonly scopeRef: string;
  readonly inputs?: readonly CryptoOperatorRiskInput[] | null;
  readonly maxInputAgeSeconds?: number | null;
}

export interface CryptoOperatorRiskInputBundle {
  readonly version: typeof CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION;
  readonly generatedAt: string;
  readonly scopeRef: string;
  readonly status: CryptoOperatorRiskInputStatus;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly inputCount: number;
  readonly acceptedCount: number;
  readonly needsEvidenceCount: number;
  readonly staleCount: number;
  readonly rejectedCount: number;
  readonly highestRiskTier: CryptoOperatorRiskTier;
  readonly operatorReviewRequired: boolean;
  readonly attestorNativeOracleClaim: false;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly CryptoOperatorRiskMissingEvidenceClass[];
  readonly entries: readonly CryptoOperatorRiskInputEntry[];
  readonly modelSafeFeedback: {
    readonly reasonCodes: readonly string[];
    readonly missingEvidenceClasses: readonly CryptoOperatorRiskMissingEvidenceClass[];
    readonly safeInstruction: string;
  };
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoOperatorRiskInputContractDescriptor {
  readonly version: typeof CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION;
  readonly inputClasses: typeof CRYPTO_OPERATOR_RISK_INPUT_CLASSES;
  readonly sourceKinds: typeof CRYPTO_OPERATOR_RISK_SOURCE_KINDS;
  readonly scopeKinds: typeof CRYPTO_OPERATOR_RISK_SCOPE_KINDS;
  readonly riskTiers: typeof CRYPTO_OPERATOR_RISK_TIERS;
  readonly evidenceRefKinds: typeof CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS;
  readonly missingEvidenceClasses: typeof CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES;
  readonly governanceRefs: typeof CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS;
  readonly attestorNativeOracleClaim: false;
  readonly autoApply: false;
  readonly approvalRequired: true;
  readonly rawPayloadStored: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}
