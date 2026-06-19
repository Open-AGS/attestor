import type { ReviewAuthorityMode } from '../release-kernel/types.js';
import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type {
  CryptoAuthorizationConsequenceKind,
  CryptoAuthorizationRiskClass,
  CryptoExecutionAdapterKind,
} from './types.js';

export const CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION =
  'attestor.crypto-authorization-simulation.v1';

export const CRYPTO_AUTHORIZATION_SIMULATION_OUTCOMES = [
  'allow-preview',
  'review-required',
  'deny-preview',
] as const;
export type CryptoAuthorizationSimulationOutcome =
  typeof CRYPTO_AUTHORIZATION_SIMULATION_OUTCOMES[number];

export const CRYPTO_SIMULATION_PREVIEW_CONFIDENCE = [
  'high',
  'medium',
  'low',
] as const;
export type CryptoSimulationPreviewConfidence =
  typeof CRYPTO_SIMULATION_PREVIEW_CONFIDENCE[number];

export const CRYPTO_SIMULATION_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
  'not-run',
  'not-applicable',
] as const;
export type CryptoSimulationObservationStatus =
  typeof CRYPTO_SIMULATION_OBSERVATION_STATUSES[number];

export const CRYPTO_SIMULATION_OBSERVATION_SEVERITIES = [
  'info',
  'warning',
  'critical',
] as const;
export type CryptoSimulationObservationSeverity =
  typeof CRYPTO_SIMULATION_OBSERVATION_SEVERITIES[number];

export const CRYPTO_SIMULATION_PREFLIGHT_SOURCES = [
  'wallet-capabilities',
  'wallet-call-preparation',
  'erc-4337-validation',
  'erc-7562-validation-scope',
  'erc-7715-permission',
  'eip-7702-authorization',
  'safe-guard',
  'module-hook',
  'custody-policy',
  'intent-settlement',
  'x402-payment',
] as const;
export type CryptoSimulationPreflightSource =
  typeof CRYPTO_SIMULATION_PREFLIGHT_SOURCES[number];

export const CRYPTO_SIMULATION_CHECKS = [
  'intent-risk-consistency',
  'policy-dimension-coverage',
  'risk-review-posture',
  'release-binding-readiness',
  'policy-binding-readiness',
  'enforcement-binding-readiness',
  'adapter-preflight-readiness',
  'execution-preview-readiness',
] as const;
export type CryptoSimulationCheck = typeof CRYPTO_SIMULATION_CHECKS[number];

export interface CryptoSimulationPreflightSignal {
  readonly source: CryptoSimulationPreflightSource;
  readonly status: Extract<
    CryptoSimulationObservationStatus,
    'pass' | 'warn' | 'fail' | 'not-run'
  >;
  readonly code: string;
  readonly message?: string | null;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CryptoSimulationAdapterPreflightProfile {
  readonly adapterKind: CryptoExecutionAdapterKind | 'adapter-neutral';
  readonly requiredSources: readonly CryptoSimulationPreflightSource[];
  readonly recommendedSources: readonly CryptoSimulationPreflightSource[];
  readonly standards: readonly string[];
  readonly notes: string;
}

export interface CryptoSimulationObservation {
  readonly check: CryptoSimulationCheck;
  readonly source: CryptoSimulationPreflightSource | 'attestor-core';
  readonly status: CryptoSimulationObservationStatus;
  readonly severity: CryptoSimulationObservationSeverity;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CryptoSimulationReadiness {
  readonly releaseBinding: 'ready' | 'missing' | 'blocked' | 'review-required';
  readonly policyBinding: 'ready' | 'missing' | 'blocked';
  readonly enforcementBinding: 'ready' | 'missing' | 'blocked';
  readonly adapterPreflight: 'ready' | 'missing' | 'blocked';
}

export interface CreateCryptoAuthorizationSimulationInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly simulatedAt: string;
  readonly releaseBinding?: CryptoReleaseDecisionBinding | null;
  readonly policyScopeBinding?: CryptoPolicyControlPlaneScopeBinding | null;
  readonly enforcementBinding?: CryptoEnforcementVerificationBinding | null;
  readonly preflightSignals?: readonly CryptoSimulationPreflightSignal[];
  readonly simulationId?: string | null;
  readonly operatorNote?: string | null;
}

export interface CryptoAuthorizationSimulationResult {
  readonly version: typeof CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION;
  readonly simulationId: string;
  readonly simulatedAt: string;
  readonly intentId: string;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly chainId: string;
  readonly accountAddress: string;
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly reviewAuthorityMode: ReviewAuthorityMode;
  readonly outcome: CryptoAuthorizationSimulationOutcome;
  readonly confidence: CryptoSimulationPreviewConfidence;
  readonly reasonCodes: readonly string[];
  readonly readiness: CryptoSimulationReadiness;
  readonly requiredPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly recommendedPreflightSources: readonly CryptoSimulationPreflightSource[];
  readonly observations: readonly CryptoSimulationObservation[];
  readonly requiredNextArtifacts: readonly string[];
  readonly releaseBindingDigest: string | null;
  readonly policyScopeDigest: string | null;
  readonly enforcementBindingDigest: string | null;
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoAuthorizationSimulationDescriptor {
  readonly version: typeof CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION;
  readonly outcomes: typeof CRYPTO_AUTHORIZATION_SIMULATION_OUTCOMES;
  readonly confidenceLevels: typeof CRYPTO_SIMULATION_PREVIEW_CONFIDENCE;
  readonly observationStatuses: typeof CRYPTO_SIMULATION_OBSERVATION_STATUSES;
  readonly preflightSources: typeof CRYPTO_SIMULATION_PREFLIGHT_SOURCES;
  readonly checks: typeof CRYPTO_SIMULATION_CHECKS;
  readonly standards: readonly string[];
}

export const CRYPTO_SIMULATION_ADAPTER_PREFLIGHT_PROFILES = Object.freeze({
  'adapter-neutral': Object.freeze({
    adapterKind: 'adapter-neutral',
    requiredSources: Object.freeze([] as const),
    recommendedSources: Object.freeze(['wallet-capabilities'] as const),
    standards: Object.freeze(['attestor-core']),
    notes:
      'Adapter-neutral simulation can preview core Attestor readiness before a concrete execution adapter is selected.',
  }),
  'safe-guard': Object.freeze({
    adapterKind: 'safe-guard',
    requiredSources: Object.freeze(['safe-guard'] as const),
    recommendedSources: Object.freeze(['wallet-call-preparation'] as const),
    standards: Object.freeze(['Safe Guard', 'release-enforcement-plane']),
    notes:
      'Safe transaction guard simulation requires explicit guard pre-check readiness before execution dispatch.',
  }),
  'safe-module-guard': Object.freeze({
    adapterKind: 'safe-module-guard',
    requiredSources: Object.freeze(['safe-guard', 'module-hook'] as const),
    recommendedSources: Object.freeze(['wallet-call-preparation'] as const),
    standards: Object.freeze(['Safe Module Guard', 'release-enforcement-plane']),
    notes:
      'Safe module execution needs both module-guard and module/hook readiness because module paths can bypass ordinary owner transaction flow.',
  }),
  'erc-4337-user-operation': Object.freeze({
    adapterKind: 'erc-4337-user-operation',
    requiredSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    recommendedSources: Object.freeze(['wallet-capabilities'] as const),
    standards: Object.freeze(['ERC-4337', 'ERC-7562']),
    notes:
      'UserOperation simulation must know account/paymaster/factory validation and ERC-7562 validation-scope posture before bundler submission.',
  }),
  'erc-7579-module': Object.freeze({
    adapterKind: 'erc-7579-module',
    requiredSources: Object.freeze(['module-hook'] as const),
    recommendedSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    standards: Object.freeze(['ERC-7579', 'ERC-4337', 'ERC-7562']),
    notes:
      'Modular account simulation requires module/hook pre-check readiness and benefits from UserOperation validation evidence.',
  }),
  'erc-6900-plugin': Object.freeze({
    adapterKind: 'erc-6900-plugin',
    requiredSources: Object.freeze(['module-hook'] as const),
    recommendedSources: Object.freeze([
      'erc-4337-validation',
      'erc-7562-validation-scope',
    ] as const),
    standards: Object.freeze(['ERC-6900', 'ERC-4337', 'ERC-7562']),
    notes:
      'Plugin simulation requires module/hook readiness while keeping plugin logic outside the core authorization model.',
  }),
  'eip-7702-delegation': Object.freeze({
    adapterKind: 'eip-7702-delegation',
    requiredSources: Object.freeze(['eip-7702-authorization'] as const),
    recommendedSources: Object.freeze(['wallet-call-preparation'] as const),
    standards: Object.freeze(['EIP-7702', 'EIP-5792', 'ERC-7836']),
    notes:
      'Delegated EOA simulation must prove authorization-list, delegate target, chain, and nonce readiness before any delegated execution is attempted.',
  }),
  'wallet-call-api': Object.freeze({
    adapterKind: 'wallet-call-api',
    requiredSources: Object.freeze([
      'wallet-capabilities',
      'wallet-call-preparation',
    ] as const),
    recommendedSources: Object.freeze([] as const),
    standards: Object.freeze(['EIP-5792', 'ERC-7836', 'ERC-7902']),
    notes:
      'Wallet call simulation relies on capability discovery and prepared-call evidence before wallet submission.',
  }),
  'x402-payment': Object.freeze({
    adapterKind: 'x402-payment',
    requiredSources: Object.freeze(['x402-payment'] as const),
    recommendedSources: Object.freeze(['wallet-capabilities'] as const),
    standards: Object.freeze(['x402', 'HTTP 402']),
    notes:
      'Agentic HTTP payment simulation must bind budget, recipient, and payment requirement evidence before payment execution.',
  }),
  'custody-cosigner': Object.freeze({
    adapterKind: 'custody-cosigner',
    requiredSources: Object.freeze(['custody-policy'] as const),
    recommendedSources: Object.freeze([] as const),
    standards: Object.freeze(['custody-policy-engine']),
    notes:
      'Custody simulation must carry an explicit custody policy pre-decision without replacing the custody platform key-management layer.',
  }),
  'intent-settlement': Object.freeze({
    adapterKind: 'intent-settlement',
    requiredSources: Object.freeze(['intent-settlement'] as const),
    recommendedSources: Object.freeze(['wallet-capabilities'] as const),
    standards: Object.freeze(['intent-settlement']),
    notes:
      'Intent-settlement simulation needs solver/settlement-route evidence before off-chain routing can become executable.',
  }),
} satisfies Record<
  CryptoExecutionAdapterKind | 'adapter-neutral',
  CryptoSimulationAdapterPreflightProfile
>);
