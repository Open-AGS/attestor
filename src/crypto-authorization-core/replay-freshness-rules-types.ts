import type {
  CryptoAuthorizationDecision,
  CryptoAuthorizationIntent,
  CryptoReplayProtectionMode,
} from './object-model.js';
import type {
  CryptoAuthorizationConsequenceKind,
  CryptoAuthorizationRiskClass,
} from './types.js';
import type { CryptoEip712AuthorizationEnvelope } from './eip712-authorization-envelope.js';
import type { CryptoSignatureValidationProjection } from './erc1271-validation-projection.js';

export const CRYPTO_REPLAY_FRESHNESS_RULES_SPEC_VERSION =
  'attestor.crypto-replay-freshness-rules.v1';

export const CRYPTO_REPLAY_KEY_KINDS = [
  'authorization-digest',
  'nonce',
  'user-operation-nonce',
  'authorization-list-nonce',
  'permission-context',
  'idempotency-key',
] as const;
export type CryptoReplayKeyKind = typeof CRYPTO_REPLAY_KEY_KINDS[number];

export const CRYPTO_REVOCATION_SOURCE_KINDS = [
  'attestor-revocation-ledger',
  'wallet-permission-registry',
  'entrypoint-nonce-state',
  'eip-7702-authority-nonce',
  'custody-policy-engine',
] as const;
export type CryptoRevocationSourceKind =
  typeof CRYPTO_REVOCATION_SOURCE_KINDS[number];

export const CRYPTO_REVOCATION_STATUSES = [
  'active',
  'revoked',
  'suspended',
  'superseded',
  'unknown',
] as const;
export type CryptoRevocationStatus = typeof CRYPTO_REVOCATION_STATUSES[number];

export const CRYPTO_FRESHNESS_STATUSES = [
  'fresh',
  'not-yet-valid',
  'expired',
  'stale',
  'replayed',
  'revoked',
  'indeterminate',
  'invalid',
] as const;
export type CryptoFreshnessStatus = typeof CRYPTO_FRESHNESS_STATUSES[number];

export const CRYPTO_FRESHNESS_REASON_CODES = [
  'fresh',
  'not-yet-valid',
  'expired',
  'stale-authorization',
  'replay-ledger-hit',
  'replay-ledger-unavailable',
  'adapter-nonce-required',
  'adapter-nonce-mismatch',
  'revocation-check-required',
  'revocation-status-stale',
  'revoked',
  'suspended',
  'superseded',
  'revocation-status-unknown',
  'envelope-intent-mismatch',
] as const;
export type CryptoFreshnessReasonCode =
  typeof CRYPTO_FRESHNESS_REASON_CODES[number];

export interface CryptoFreshnessBaseline {
  readonly clockSkewSeconds: number;
  readonly maxAuthorizationAgeSeconds: number;
  readonly replayStoreSeconds: number;
  readonly maxRevocationStatusAgeSeconds: number;
}

export interface CryptoValidityWindowPlan {
  readonly validAfterEpochSeconds: number;
  readonly validUntilEpochSeconds: number;
  readonly issuedAtEpochSeconds: number;
  readonly clockSkewSeconds: number;
  readonly maxAuthorizationAgeSeconds: number;
  readonly maxAgeExpiresAtEpochSeconds: number;
  readonly effectiveExpiresAtEpochSeconds: number;
}

export interface CryptoReplayLedgerPlan {
  readonly mode: CryptoReplayProtectionMode;
  readonly keyKind: CryptoReplayKeyKind;
  readonly ledgerKey: string;
  readonly partitionKey: string;
  readonly storeUntilEpochSeconds: number;
  readonly consumeOnAllow: boolean;
  readonly requiresLedger: boolean;
  readonly chainAuthoritative: boolean;
}

export interface CryptoRevocationPlan {
  readonly required: boolean;
  readonly sourceKind: CryptoRevocationSourceKind;
  readonly revocationKey: string;
  readonly onlineCheckRequired: boolean;
  readonly failClosedOnUnknown: boolean;
  readonly maxStatusAgeSeconds: number;
}

export interface CryptoAdapterNoncePlan {
  readonly required: boolean;
  readonly sourceKind: CryptoRevocationSourceKind | null;
  readonly expectedNonce: string;
  readonly adapterNonceKind: CryptoReplayKeyKind;
}

export interface CryptoReplayFreshnessRules {
  readonly version: typeof CRYPTO_REPLAY_FRESHNESS_RULES_SPEC_VERSION;
  readonly ruleId: string;
  readonly envelopeId: string;
  readonly intentId: string;
  readonly decisionId: string;
  readonly chainId: string;
  readonly accountAddress: string;
  readonly signerAddress: string;
  readonly domainVerifyingContract: string;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly validityWindow: CryptoValidityWindowPlan;
  readonly replayLedger: CryptoReplayLedgerPlan;
  readonly revocation: CryptoRevocationPlan;
  readonly adapterNonce: CryptoAdapterNoncePlan;
  readonly requiredChecks: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoReplayFreshnessRulesInput {
  readonly envelope: CryptoEip712AuthorizationEnvelope;
  readonly intent: CryptoAuthorizationIntent;
  readonly decision: CryptoAuthorizationDecision;
  readonly validationProjection?: CryptoSignatureValidationProjection | null;
  readonly permissionContext?: string | null;
  readonly idempotencyKey?: string | null;
  readonly revocationSourceKind?: CryptoRevocationSourceKind | null;
}

export interface CryptoValidityWindowEvaluation {
  readonly status: 'valid' | 'not-yet-valid' | 'expired' | 'stale';
  readonly accepted: boolean;
  readonly checkedAtEpochSeconds: number;
  readonly reasonCodes: readonly CryptoFreshnessReasonCode[];
}

export interface CryptoReplayLedgerEntry {
  readonly ledgerKey: string;
  readonly firstSeenAtEpochSeconds: number;
  readonly expiresAtEpochSeconds: number;
  readonly consumedAtEpochSeconds?: number | null;
}

export interface CryptoReplayLedgerEvaluationInput {
  readonly rules: CryptoReplayFreshnessRules;
  readonly nowEpochSeconds: number;
  readonly ledgerAvailable?: boolean;
  readonly ledgerEntry?: CryptoReplayLedgerEntry | null;
}

export interface CryptoReplayLedgerEvaluation {
  readonly status: 'fresh' | 'replayed' | 'indeterminate';
  readonly accepted: boolean;
  readonly storeUntilEpochSeconds: number | null;
  readonly consumeOnAllow: boolean;
  readonly reasonCodes: readonly CryptoFreshnessReasonCode[];
}

export interface CryptoRevocationObservation {
  readonly revocationKey: string;
  readonly status: CryptoRevocationStatus;
  readonly checkedAtEpochSeconds: number;
  readonly reasonCode?: string | null;
}

export interface CryptoRevocationEvaluationInput {
  readonly rules: CryptoReplayFreshnessRules;
  readonly nowEpochSeconds: number;
  readonly observation?: CryptoRevocationObservation | null;
}

export interface CryptoRevocationEvaluation {
  readonly status: 'not-required' | 'active' | 'revoked' | 'indeterminate';
  readonly accepted: boolean;
  readonly reasonCodes: readonly CryptoFreshnessReasonCode[];
}

export interface CryptoAdapterNonceObservation {
  readonly nonce: string;
  readonly matchesExpected: boolean;
  readonly checkedAtEpochSeconds: number;
  readonly sourceKind: CryptoRevocationSourceKind;
}

export interface CryptoAdapterNonceEvaluationInput {
  readonly rules: CryptoReplayFreshnessRules;
  readonly observation?: CryptoAdapterNonceObservation | null;
}

export interface CryptoAdapterNonceEvaluation {
  readonly status: 'not-required' | 'valid' | 'invalid' | 'indeterminate';
  readonly accepted: boolean;
  readonly reasonCodes: readonly CryptoFreshnessReasonCode[];
}

export interface EvaluateCryptoAuthorizationFreshnessInput {
  readonly rules: CryptoReplayFreshnessRules;
  readonly nowEpochSeconds: number;
  readonly replayLedgerAvailable?: boolean;
  readonly replayLedgerEntry?: CryptoReplayLedgerEntry | null;
  readonly revocationObservation?: CryptoRevocationObservation | null;
  readonly adapterNonceObservation?: CryptoAdapterNonceObservation | null;
}

export interface CryptoAuthorizationFreshnessEvaluation {
  readonly version: typeof CRYPTO_REPLAY_FRESHNESS_RULES_SPEC_VERSION;
  readonly rulesDigest: string;
  readonly status: CryptoFreshnessStatus;
  readonly accepted: boolean;
  readonly checkedAtEpochSeconds: number;
  readonly reasonCodes: readonly CryptoFreshnessReasonCode[];
  readonly validityWindow: CryptoValidityWindowEvaluation;
  readonly replayLedger: CryptoReplayLedgerEvaluation;
  readonly revocation: CryptoRevocationEvaluation;
  readonly adapterNonce: CryptoAdapterNonceEvaluation;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoReplayFreshnessRulesDescriptor {
  readonly version: typeof CRYPTO_REPLAY_FRESHNESS_RULES_SPEC_VERSION;
  readonly replayKeyKinds: typeof CRYPTO_REPLAY_KEY_KINDS;
  readonly revocationSourceKinds: typeof CRYPTO_REVOCATION_SOURCE_KINDS;
  readonly revocationStatuses: typeof CRYPTO_REVOCATION_STATUSES;
  readonly freshnessStatuses: typeof CRYPTO_FRESHNESS_STATUSES;
  readonly reasonCodes: typeof CRYPTO_FRESHNESS_REASON_CODES;
  readonly standards: readonly string[];
}

export const CRYPTO_FRESHNESS_BASELINES: Record<
  CryptoAuthorizationRiskClass,
  CryptoFreshnessBaseline
> = Object.freeze({
  R0: Object.freeze({
    clockSkewSeconds: 120,
    maxAuthorizationAgeSeconds: 86_400,
    replayStoreSeconds: 3_600,
    maxRevocationStatusAgeSeconds: 3_600,
  }),
  R1: Object.freeze({
    clockSkewSeconds: 120,
    maxAuthorizationAgeSeconds: 3_600,
    replayStoreSeconds: 3_600,
    maxRevocationStatusAgeSeconds: 900,
  }),
  R2: Object.freeze({
    clockSkewSeconds: 60,
    maxAuthorizationAgeSeconds: 900,
    replayStoreSeconds: 900,
    maxRevocationStatusAgeSeconds: 300,
  }),
  R3: Object.freeze({
    clockSkewSeconds: 30,
    maxAuthorizationAgeSeconds: 300,
    replayStoreSeconds: 300,
    maxRevocationStatusAgeSeconds: 60,
  }),
  R4: Object.freeze({
    clockSkewSeconds: 15,
    maxAuthorizationAgeSeconds: 120,
    replayStoreSeconds: 120,
    maxRevocationStatusAgeSeconds: 30,
  }),
});
