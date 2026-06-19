import type {
  CryptoCanonicalAccountReference,
  CryptoCanonicalAssetReference,
  CryptoCanonicalChainReference,
  CryptoCanonicalCounterpartyReference,
} from './canonical-references.js';
import type { CryptoAuthorizationPolicyDimension } from './types.js';
import type {
  CryptoAuthorizationDecision,
  CryptoAuthorizationIntent,
} from './object-model.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type {
  ReleaseActorReference,
  ReleasePolicyDefinition,
  ReleasePolicyRolloutMode,
} from '../release-layer/index.js';
import type { SignablePolicyBundleArtifact } from '../release-policy-control-plane/bundle-format.js';
import type {
  PolicyActivationRecord,
  PolicyBundleEntry,
  PolicyBundleManifest,
  PolicyPackMetadata,
} from '../release-policy-control-plane/object-model.js';
import type {
  PolicyActivationTarget,
  PolicyBundleReference,
  PolicyScopeSelector,
} from '../release-policy-control-plane/types.js';
import type { StoredPolicyBundleRecord } from '../release-policy-control-plane/store.js';
import type { DryRunPolicyActivationOverlay } from '../release-policy-control-plane/simulation.js';
import type { PolicyMutationAuditAppendInput } from '../release-policy-control-plane/audit-log.js';

/**
 * Crypto authorization binding into the release policy control plane.
 *
 * Step 09 keeps crypto scope rich enough for chain/account/asset/budget policy,
 * while projecting it into the generic policy-control-plane activation grammar
 * that already signs, activates, simulates, and audits release policies.
 */

export const CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_SPEC_VERSION =
  'attestor.crypto-policy-control-plane-scope-binding.v1';

export const CRYPTO_POLICY_CONTROL_PLANE_DOMAIN_ID = 'crypto-authorization';
export const CRYPTO_POLICY_CONTROL_PLANE_DEFAULT_PACK_ID =
  'crypto-authorization-core';
export const CRYPTO_POLICY_CONTROL_PLANE_POLICY_SCHEMA_ID =
  'attestor.crypto-authorization-policy-scope';
export const CRYPTO_POLICY_CONTROL_PLANE_POLICY_SCHEMA_VERSION = '1.0.0';
export const CRYPTO_POLICY_CONTROL_PLANE_POLICY_SCHEMA_URI =
  'https://schemas.attestor.ai/crypto-authorization/policy-scope/v1';

export const CRYPTO_POLICY_CONTROL_PLANE_SCOPE_DIMENSIONS = [
  'chain',
  'account',
  'actor',
  'asset',
  'counterparty',
  'spender',
  'protocol',
  'function-selector',
  'calldata-class',
  'amount',
  'budget',
  'validity-window',
  'cadence',
  'risk-tier',
  'approval-quorum',
  'runtime-context',
] as const satisfies readonly CryptoAuthorizationPolicyDimension[];

export const CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_CHECKS = [
  'crypto-decision-matches-intent',
  'risk-assessment-matches-decision',
  'risk-required-dimensions-are-covered',
  'canonical-chain-account-asset-scope-is-bound',
  'spender-counterparty-protocol-budget-scope-is-bound',
  'control-plane-activation-target-is-derived',
  'policy-bundle-entry-hash-is-bound',
  'signable-policy-pack-artifact-is-bound',
  'simulation-overlay-is-bound',
  'audit-snapshot-is-bound',
] as const;
export type CryptoPolicyControlPlaneScopeBindingCheck =
  typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_CHECKS[number];

export interface CryptoPolicyControlPlaneBudgetScope {
  readonly maxAmount: string | null;
  readonly budgetId: string | null;
  readonly cadence: string | null;
  readonly validAfter: string;
  readonly validUntil: string;
  readonly nonce: string;
  readonly replayProtectionMode: string;
  readonly digestMode: string;
}

export interface CryptoPolicyControlPlaneExtendedScope {
  readonly version: typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_SPEC_VERSION;
  readonly providedDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly requiredDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly chain: CryptoCanonicalChainReference;
  readonly account: CryptoCanonicalAccountReference;
  readonly asset: CryptoCanonicalAssetReference | null;
  readonly counterparty: CryptoCanonicalCounterpartyReference | null;
  readonly actor: {
    readonly actorKind: CryptoAuthorizationIntent['requester']['actorKind'];
    readonly actorId: string;
    readonly authorityRef: string | null;
  };
  readonly spender: string | null;
  readonly protocol: string | null;
  readonly functionSelector: string | null;
  readonly calldataClass: string | null;
  readonly budget: CryptoPolicyControlPlaneBudgetScope;
  readonly consequenceKind: CryptoAuthorizationIntent['consequenceKind'];
  readonly executionAdapterKind: CryptoAuthorizationIntent['executionAdapterKind'];
  readonly accountKind: CryptoAuthorizationIntent['account']['accountKind'];
  readonly targetKind: CryptoAuthorizationIntent['target']['targetKind'];
  readonly referenceBundleDigest: string;
  readonly policyPackRef: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPolicyControlPlaneScopeBindingInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly cryptoDecision: CryptoAuthorizationDecision;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding?: CryptoReleaseDecisionBinding | null;
  readonly policyDefinition?: ReleasePolicyDefinition | null;
  readonly generatedAt?: string | null;
  readonly storedAt?: string | null;
  readonly packId?: string | null;
  readonly packName?: string | null;
  readonly packDescription?: string | null;
  readonly bundleId?: string | null;
  readonly bundleVersion?: string | null;
  readonly entryId?: string | null;
  readonly activationId?: string | null;
  readonly actor?: ReleaseActorReference | null;
  readonly planId?: string | null;
  readonly cohortId?: string | null;
  readonly rolloutMode?: ReleasePolicyRolloutMode | null;
}

export interface CryptoPolicyControlPlaneScopeBinding {
  readonly version: typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_SPEC_VERSION;
  readonly bindingId: string;
  readonly intentId: string;
  readonly cryptoDecisionId: string;
  readonly releaseDecisionId: string | null;
  readonly policyPackId: string;
  readonly bundleId: string;
  readonly activationId: string;
  readonly activationTarget: PolicyActivationTarget;
  readonly scopeSelector: PolicyScopeSelector;
  readonly targetLabel: string;
  readonly cryptoScope: CryptoPolicyControlPlaneExtendedScope;
  readonly policyPack: PolicyPackMetadata;
  readonly bundleReference: PolicyBundleReference;
  readonly policyBundleEntry: PolicyBundleEntry;
  readonly policyBundleManifest: PolicyBundleManifest;
  readonly signableArtifact: SignablePolicyBundleArtifact;
  readonly bundleRecord: StoredPolicyBundleRecord;
  readonly activationRecord: PolicyActivationRecord;
  readonly simulationOverlay: DryRunPolicyActivationOverlay;
  readonly auditAppendInput: PolicyMutationAuditAppendInput;
  readonly bindingChecks: readonly CryptoPolicyControlPlaneScopeBindingCheck[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoPolicyControlPlaneScopeBindingDescriptor {
  readonly version: typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_SPEC_VERSION;
  readonly domainId: typeof CRYPTO_POLICY_CONTROL_PLANE_DOMAIN_ID;
  readonly cryptoScopeDimensions: typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_DIMENSIONS;
  readonly bindingChecks: typeof CRYPTO_POLICY_CONTROL_PLANE_SCOPE_BINDING_CHECKS;
  readonly standards: readonly string[];
}
