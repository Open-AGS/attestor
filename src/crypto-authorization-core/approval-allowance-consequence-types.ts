import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoCanonicalCounterpartyReference } from './canonical-references.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type {
  CryptoAuthorizationConsequenceKind,
  CryptoAuthorizationPolicyDimension,
} from './types.js';
import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';

export const CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION =
  'attestor.crypto-approval-allowance-consequence.v1';

export const CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS = [
  'erc20-approve',
  'erc20-increase-allowance',
  'erc20-decrease-allowance',
  'eip-2612-permit',
  'permit2-allowance',
  'permit2-signature-transfer',
  'erc-7674-temporary-approve',
  'wallet-permission-grant',
] as const;
export type CryptoApprovalAllowanceMechanism =
  typeof CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS[number];

export const CRYPTO_ALLOWANCE_AMOUNT_POSTURES = [
  'exact',
  'bounded',
  'unlimited',
  'decrease-only',
  'revoke',
] as const;
export type CryptoAllowanceAmountPosture =
  typeof CRYPTO_ALLOWANCE_AMOUNT_POSTURES[number];

export const CRYPTO_ALLOWANCE_DURATION_POSTURES = [
  'persistent',
  'time-bound',
  'transaction-scoped',
  'revoked',
] as const;
export type CryptoAllowanceDurationPosture =
  typeof CRYPTO_ALLOWANCE_DURATION_POSTURES[number];

export const CRYPTO_APPROVAL_ALLOWANCE_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type CryptoApprovalAllowanceOutcome =
  typeof CRYPTO_APPROVAL_ALLOWANCE_OUTCOMES[number];

export const CRYPTO_APPROVAL_ALLOWANCE_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type CryptoApprovalAllowanceObservationStatus =
  typeof CRYPTO_APPROVAL_ALLOWANCE_OBSERVATION_STATUSES[number];

export const CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS = [
  'approve-zero',
  'permit2-lockdown',
  'wallet-revoke',
  'temporary-expires',
  'not-applicable',
] as const;
export type CryptoApprovalAllowanceRevocationMethod =
  typeof CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS[number];

export const CRYPTO_APPROVAL_ALLOWANCE_CHECKS = [
  'approval-intent-kind',
  'approval-chain-runtime',
  'approval-token-bound',
  'approval-owner-bound',
  'approval-spender-bound',
  'approval-target-bound',
  'approval-function-selector-bound',
  'approval-amount-posture',
  'approval-amount-within-intent',
  'approval-resulting-allowance-within-intent',
  'approval-expiry-bound',
  'approval-budget-bound',
  'approval-revocation-bound',
  'approval-permit-evidence-bound',
  'approval-temporary-scope-bound',
  'approval-risk-assessment-bound',
] as const;
export type CryptoApprovalAllowanceCheck =
  typeof CRYPTO_APPROVAL_ALLOWANCE_CHECKS[number];

export interface CryptoApprovalAllowanceRevocationPosture {
  readonly revocable: boolean;
  readonly method?: CryptoApprovalAllowanceRevocationMethod | null;
  readonly authorityRef?: string | null;
  readonly revocationTarget?: string | null;
}

export interface CreateCryptoApprovalAllowanceConsequenceInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly spenderAddress: string;
  readonly requestedAmount: string;
  readonly tokenAddress?: string | null;
  readonly ownerAddress?: string | null;
  readonly currentAllowance?: string | null;
  readonly resultingAllowance?: string | null;
  readonly normalizedUsd?: string | null;
  readonly amountPosture?: CryptoAllowanceAmountPosture | null;
  readonly durationPosture?: CryptoAllowanceDurationPosture | null;
  readonly allowanceExpiration?: string | null;
  readonly permitDeadline?: string | null;
  readonly permitNonce?: string | null;
  readonly permitDomainChainId?: string | null;
  readonly permitDomainVerifyingContract?: string | null;
  readonly revocation?: CryptoApprovalAllowanceRevocationPosture | null;
  readonly budgetId?: string | null;
  readonly spenderLabel?: string | null;
  readonly approvalPolicyRef?: string | null;
  readonly isKnownSpender?: boolean | null;
  readonly consequenceId?: string | null;
}

export interface CryptoApprovalAllowanceObservation {
  readonly check: CryptoApprovalAllowanceCheck;
  readonly status: CryptoApprovalAllowanceObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CryptoApprovalAllowanceConsequence {
  readonly version: typeof CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION;
  readonly consequenceId: string;
  readonly intentId: string;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly durationPosture: CryptoAllowanceDurationPosture;
  readonly outcome: CryptoApprovalAllowanceOutcome;
  readonly chainId: string;
  readonly ownerAddress: string;
  readonly tokenAddress: string | null;
  readonly spenderAddress: string;
  readonly requestedAmount: string;
  readonly currentAllowance: string | null;
  readonly resultingAllowance: string;
  readonly allowanceExpiration: string | null;
  readonly permitDeadline: string | null;
  readonly permitNonce: string | null;
  readonly budgetId: string | null;
  readonly revocation: CryptoApprovalAllowanceRevocationPosture;
  readonly counterparty: CryptoCanonicalCounterpartyReference;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly CryptoApprovalAllowanceObservation[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoApprovalAllowanceConsequenceDescriptor {
  readonly version: typeof CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION;
  readonly mechanisms: typeof CRYPTO_APPROVAL_ALLOWANCE_MECHANISMS;
  readonly amountPostures: typeof CRYPTO_ALLOWANCE_AMOUNT_POSTURES;
  readonly durationPostures: typeof CRYPTO_ALLOWANCE_DURATION_POSTURES;
  readonly outcomes: typeof CRYPTO_APPROVAL_ALLOWANCE_OUTCOMES;
  readonly revocationMethods: typeof CRYPTO_APPROVAL_ALLOWANCE_REVOCATION_METHODS;
  readonly checks: typeof CRYPTO_APPROVAL_ALLOWANCE_CHECKS;
  readonly standards: readonly string[];
}
