import type {
  ControlFailureDisposition,
  riskControlProfile,
} from '../release-kernel/risk-controls.js';
import type { ReviewAuthorityMode } from '../release-kernel/types.js';
import type {
  CryptoAccountReference,
  CryptoAssetReference,
  CryptoAuthorizationArtifactKind,
  CryptoAuthorizationConsequenceKind,
  CryptoAuthorizationPolicyDimension,
  CryptoAuthorizationRiskClass,
  CryptoExecutionAdapterKind,
} from './types.js';
import type { CryptoCanonicalCounterpartyReference } from './canonical-references.js';

export const CRYPTO_CONSEQUENCE_RISK_MAPPING_SPEC_VERSION =
  'attestor.crypto-consequence-risk-mapping.v1';

export const CRYPTO_CONSEQUENCE_RISK_FACTOR_KINDS = [
  'base-consequence',
  'amount',
  'account',
  'asset',
  'counterparty',
  'execution-context',
  'policy-posture',
] as const;
export type CryptoConsequenceRiskFactorKind =
  typeof CRYPTO_CONSEQUENCE_RISK_FACTOR_KINDS[number];

export const CRYPTO_CONSEQUENCE_CONTEXT_SIGNALS = [
  'known-counterparty',
  'new-counterparty',
  'cross-chain',
  'high-privilege-call',
  'admin-upgrade',
  'wallet-permission',
  'missing-expiry',
  'missing-budget',
  'missing-revocation',
  'agent-initiated',
  'user-initiated',
  'custody-policy-present',
  'custody-policy-missing',
  'offchain-settlement',
  'intent-solver-routing',
] as const;
export type CryptoConsequenceContextSignal =
  typeof CRYPTO_CONSEQUENCE_CONTEXT_SIGNALS[number];

export const CRYPTO_CONSEQUENCE_AMOUNT_THRESHOLDS_USD = Object.freeze({
  review: '10000',
  dualApproval: '100000',
  critical: '1000000',
});

export const CRYPTO_VALUE_MOVING_CONSEQUENCE_KINDS = [
  'transfer',
  'approval',
  'swap',
  'bridge',
  'agent-payment',
  'custody-withdrawal',
] as const satisfies readonly CryptoAuthorizationConsequenceKind[];
export type CryptoValueMovingConsequenceKind =
  typeof CRYPTO_VALUE_MOVING_CONSEQUENCE_KINDS[number];

export interface CryptoConsequenceAmountInput {
  readonly assetAmount?: string | null;
  readonly normalizedUsd?: string | null;
  readonly isUnlimitedApproval?: boolean;
}

export interface CryptoConsequenceRiskContextInput {
  readonly executionAdapterKind?: CryptoExecutionAdapterKind | null;
  readonly signals?: readonly CryptoConsequenceContextSignal[];
  readonly operationCount?: number | null;
  readonly hasExpiry?: boolean | null;
  readonly hasBudget?: boolean | null;
  readonly hasRevocationPath?: boolean | null;
  readonly isKnownCounterparty?: boolean | null;
  readonly requiresCustodyPolicy?: boolean | null;
  readonly hasCustodyPolicy?: boolean | null;
}

export interface CreateCryptoConsequenceRiskAssessmentInput {
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly account: CryptoAccountReference;
  readonly asset?: CryptoAssetReference | null;
  readonly amount?: CryptoConsequenceAmountInput | null;
  readonly counterparty?: CryptoCanonicalCounterpartyReference | null;
  readonly context?: CryptoConsequenceRiskContextInput | null;
}

export interface CryptoConsequenceRiskFinding {
  readonly factorKind: CryptoConsequenceRiskFactorKind;
  readonly code: string;
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly reason: string;
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
}

export interface CryptoConsequenceReviewRequirement {
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly authorityMode: ReviewAuthorityMode;
  readonly minimumReviewerCount: number;
  readonly requiresNamedReviewer: boolean;
  readonly failureDisposition: ControlFailureDisposition;
  readonly requiredArtifacts: readonly CryptoAuthorizationArtifactKind[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly tokenEnforcement: ReturnType<typeof riskControlProfile>['token']['minimumEnforcement'];
  readonly maxTokenTtlSeconds: number;
}

export interface CryptoConsequenceRiskAssessment {
  readonly version: typeof CRYPTO_CONSEQUENCE_RISK_MAPPING_SPEC_VERSION;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly accountKind: CryptoAccountReference['accountKind'];
  readonly assetKind: CryptoAssetReference['assetKind'] | null;
  readonly counterpartyKind: CryptoCanonicalCounterpartyReference['counterpartyKind'] | null;
  readonly amountNormalizedUsd: string | null;
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly defaultRiskClass: CryptoAuthorizationRiskClass;
  readonly review: CryptoConsequenceReviewRequirement;
  readonly findings: readonly CryptoConsequenceRiskFinding[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoConsequenceRiskMappingDescriptor {
  readonly version: typeof CRYPTO_CONSEQUENCE_RISK_MAPPING_SPEC_VERSION;
  readonly consequenceKinds: readonly CryptoAuthorizationConsequenceKind[];
  readonly riskClasses: readonly CryptoAuthorizationRiskClass[];
  readonly factorKinds: readonly CryptoConsequenceRiskFactorKind[];
  readonly contextSignals: readonly CryptoConsequenceContextSignal[];
  readonly valueMovingConsequenceKinds: readonly CryptoValueMovingConsequenceKind[];
  readonly amountThresholdsUsd: typeof CRYPTO_CONSEQUENCE_AMOUNT_THRESHOLDS_USD;
}
