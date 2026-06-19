import type { JWK } from 'jose';
import type {
  ReleasePolicyProvenanceSource,
  ReleaseTokenClaims,
} from '../release-kernel/object-model.js';
import type {
  ReleaseTokenVerificationKey,
  ReleaseTokenVerificationResult,
} from '../release-kernel/release-token.js';
import type { DsseEnvelope, SignedAsyncConsequenceEnvelope } from './async-envelope.js';
import type {
  NonceLedgerEntry,
  ReleaseFreshnessEvaluation,
  ReplayLedgerEntry,
  ReplaySubjectKind,
} from './freshness.js';
import type { HttpMessageForSignature } from './http-message-signatures.js';
import type {
  EnforcementRequest,
  ReleaseEnforcementPolicyContext,
  ReleasePresentation,
  VerificationResult,
} from './object-model.js';
import type {
  EnforcementFailureReason,
} from './types.js';
import type { VerificationProfile } from './verification-profiles.js';

export const OFFLINE_RELEASE_VERIFIER_SPEC_VERSION =
  'attestor.release-enforcement-offline-verifier.v1';

export type OfflineReleaseVerificationStatus =
  | 'valid'
  | 'invalid'
  | 'indeterminate';

export interface OfflineVerifierExpectedBinding {
  readonly audience?: string;
  readonly tenantId?: string | null;
  readonly releaseTokenId?: string;
  readonly releaseDecisionId?: string;
  readonly consequenceType?: EnforcementRequest['enforcementPoint']['consequenceType'];
  readonly riskClass?: EnforcementRequest['enforcementPoint']['riskClass'];
  readonly outputHash?: string;
  readonly consequenceHash?: string;
  readonly policyHash?: string;
  readonly policyVersion?: string;
  readonly policyIrHash?: string;
  readonly policyProvenanceSource?: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion?: string;
  readonly compiledPolicyIrVersion?: string;
  readonly policyContext?: ReleaseEnforcementPolicyContext | null;
}

export interface OfflineHttpMessageSignatureVerificationContext {
  readonly message: HttpMessageForSignature;
  readonly publicJwk: JWK;
  readonly label?: string;
  readonly expectedNonce?: string | null;
  readonly expectedTag?: string | null;
  readonly requiredCoveredComponents?: readonly string[];
  readonly maxSignatureAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
}

export interface OfflineAsyncEnvelopeVerificationContext {
  readonly envelope: DsseEnvelope | SignedAsyncConsequenceEnvelope;
  readonly publicJwk: JWK;
  readonly expectedIdempotencyKey?: string | null;
  readonly expectedMessageId?: string | null;
  readonly expectedQueueOrTopic?: string | null;
  readonly maxEnvelopeAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
}

export interface OfflineTrustedWorkloadBinding {
  readonly expectedSpiffeId?: string | null;
  readonly expectedTrustDomain?: string | null;
  readonly expectedCertificateThumbprint?: string | null;
}

export interface OfflineReleaseVerificationInput {
  readonly request: EnforcementRequest;
  readonly presentation: ReleasePresentation;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly now: string;
  readonly profile?: VerificationProfile;
  readonly expected?: OfflineVerifierExpectedBinding;
  readonly replayKey?: string | null;
  readonly replaySubjectKind?: ReplaySubjectKind;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly nonceLedgerEntry?: NonceLedgerEntry | null;
  readonly httpMessageSignature?: OfflineHttpMessageSignatureVerificationContext;
  readonly asyncEnvelope?: OfflineAsyncEnvelopeVerificationContext;
  readonly trustedWorkloadBinding?: OfflineTrustedWorkloadBinding;
  readonly verificationResultId?: string;
}

export interface OfflineReleaseVerification {
  readonly version: typeof OFFLINE_RELEASE_VERIFIER_SPEC_VERSION;
  readonly status: OfflineReleaseVerificationStatus;
  readonly offlineVerified: boolean;
  readonly requiresOnlineIntrospection: boolean;
  readonly checkedAt: string;
  readonly profile: VerificationProfile;
  readonly freshness: ReleaseFreshnessEvaluation | null;
  readonly tenantBinding: {
    readonly expectedTenantId: string | null;
    readonly expectedSource: 'input' | 'request-enforcement-point' | 'tenantless-explicit';
    readonly claimsTenantId: string | null;
    readonly checked: boolean;
    readonly matched: boolean | null;
  };
  readonly verificationResult: VerificationResult;
  readonly tokenVerification: ReleaseTokenVerificationResult | null;
  readonly claims: ReleaseTokenClaims | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
}
