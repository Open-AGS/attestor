import type {
  EvidenceArtifactReference,
  EvidencePack,
  ReleaseDecision,
  ReleaseEvidencePolicyContext,
  ReleasePolicyProvenanceSource,
} from './object-model.js';
import type { ReleaseDecisionLogEntry } from './release-decision-log.js';
import type { IssuedReleaseToken } from './release-token.js';
import type { ReleaseReviewerQueueDetail } from './reviewer-queue.js';

/**
 * Durable release evidence export.
 *
 * Current attestation systems increasingly separate short-lived authorization
 * from longer-lived signed evidence. Here we keep the release token as the
 * online gate and emit a portable DSSE-wrapped in-toto-style statement for the
 * durable proof plane.
 */

export const RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION =
  'attestor.release-evidence-pack-issuance.v1';
export const RELEASE_EVIDENCE_PACK_VERIFICATION_KEY_SPEC_VERSION =
  'attestor.release-evidence-pack-verification-key.v1';
export const RELEASE_EVIDENCE_PACK_VERIFICATION_SPEC_VERSION =
  'attestor.release-evidence-pack-verification.v1';
export const RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE = 'application/vnd.in-toto+json';
export const RELEASE_EVIDENCE_PACK_STATEMENT_TYPE = 'https://in-toto.io/Statement/v1';
export const RELEASE_EVIDENCE_PACK_PREDICATE_TYPE =
  'https://attestor.ai/attestation/release-evidence/v1';
export const ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV =
  'ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH';

export type ReleaseEvidencePackSigningAlgorithm = 'Ed25519';

export interface ReleaseEvidenceVerificationKey {
  readonly version: typeof RELEASE_EVIDENCE_PACK_VERIFICATION_KEY_SPEC_VERSION;
  readonly issuer: string;
  readonly algorithm: ReleaseEvidencePackSigningAlgorithm;
  readonly keyId: string;
  readonly publicKeyFingerprint: string;
  readonly publicKeyPem: string;
}

export interface ReleaseEvidenceStatementSubject {
  readonly name: string;
  readonly digest: {
    readonly sha256: string;
  };
}

export interface ReleaseEvidenceDecisionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly status: ReleaseDecision['status'];
  readonly consequenceType: ReleaseDecision['consequenceType'];
  readonly riskClass: ReleaseDecision['riskClass'];
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEvidencePolicyContext;
  readonly targetId: string;
  readonly targetDisplayName: string | null;
  readonly requesterId: string;
  readonly requesterType: ReleaseDecision['requester']['type'];
  readonly requesterLabel: string | null;
  readonly releaseTokenId: string | null;
  readonly evidencePackId: string;
  readonly override: {
    readonly reasonCode: string;
    readonly ticketId: string | null;
    readonly requestedById: string;
    readonly requestedByLabel: string | null;
    readonly requestedByRole: string | null;
  } | null;
}

export interface ReleaseEvidenceDecisionLogSummary {
  readonly entryCount: number;
  readonly latestEntryDigest: string | null;
  readonly chainIntact: boolean;
  readonly phases: readonly ReleaseDecisionLogEntry['phase'][];
}

export interface ReleaseEvidenceReviewSummary {
  readonly reviewId: string;
  readonly status: ReleaseReviewerQueueDetail['status'];
  readonly authorityState: ReleaseReviewerQueueDetail['authorityState'];
  readonly approvalsRecorded: number;
  readonly approvalsRemaining: number;
  readonly reviewerDecisionCount: number;
  readonly overrideReasonCode: string | null;
}

export interface ReleaseEvidenceTokenPolicyContext {
  readonly policyVersion: string | null;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}

export interface ReleaseEvidenceTokenSummary {
  readonly tokenId: string;
  readonly audience: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly override: boolean;
  readonly introspectionRequired: boolean;
  readonly policyVersion: string | null;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEvidenceTokenPolicyContext;
}

export interface ReleaseEvidencePredicate {
  readonly version: typeof RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION;
  readonly exportedAt: string;
  readonly evidencePack: EvidencePack;
  readonly decision: ReleaseEvidenceDecisionSummary;
  readonly decisionLog: ReleaseEvidenceDecisionLogSummary;
  readonly review: ReleaseEvidenceReviewSummary | null;
  readonly releaseToken: ReleaseEvidenceTokenSummary | null;
}

export interface ReleaseEvidenceStatement {
  readonly _type: typeof RELEASE_EVIDENCE_PACK_STATEMENT_TYPE;
  readonly subject: readonly ReleaseEvidenceStatementSubject[];
  readonly predicateType: typeof RELEASE_EVIDENCE_PACK_PREDICATE_TYPE;
  readonly predicate: ReleaseEvidencePredicate;
}

export interface ReleaseEvidenceDsseSignature {
  readonly keyid: string;
  readonly sig: string;
}

export interface ReleaseEvidenceDsseEnvelope {
  readonly payloadType: typeof RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE;
  readonly payload: string;
  readonly signatures: readonly ReleaseEvidenceDsseSignature[];
}

export type ReleaseEvidenceArtifactVerificationState =
  | 'none'
  | 'issuer-derived-only'
  | 'declared-only'
  | 'mixed'
  | 'unknown';

export interface ReleaseEvidenceArtifactVerificationSummary {
  readonly artifactCount: number;
  readonly issuerDerivedCount: number;
  readonly declaredUnverifiedCount: number;
  readonly unknownStatusCount: number;
  readonly externalArtifactVerificationPerformed: false;
  readonly allExternalArtifactsVerified: false;
  readonly state: ReleaseEvidenceArtifactVerificationState;
}

export interface IssuedReleaseEvidencePack {
  readonly version: typeof RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION;
  readonly evidencePack: EvidencePack;
  readonly statement: ReleaseEvidenceStatement;
  readonly envelope: ReleaseEvidenceDsseEnvelope;
  readonly verificationKey: ReleaseEvidenceVerificationKey;
  readonly bundleDigest: string;
  readonly issuedAt: string;
  readonly keyId: string;
  readonly publicKeyFingerprint: string;
}

export interface ReleaseEvidencePackIssueInput {
  readonly decision: ReleaseDecision;
  readonly evidencePackId?: string;
  readonly issuedAt?: string;
  readonly decisionLogEntries: readonly ReleaseDecisionLogEntry[];
  readonly decisionLogChainIntact?: boolean;
  readonly review?: ReleaseReviewerQueueDetail | null;
  readonly releaseToken?: IssuedReleaseToken | null;
  readonly artifactReferences?: readonly EvidenceArtifactReference[];
}

export interface CreateReleaseEvidencePackIssuerInput {
  readonly issuer: string;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly keyId?: string;
  readonly algorithm?: ReleaseEvidencePackSigningAlgorithm;
}

export interface VerifyReleaseEvidencePackInput {
  readonly issuedEvidencePack: IssuedReleaseEvidencePack;
  readonly verificationKey: ReleaseEvidenceVerificationKey;
}

export interface ReleaseEvidencePackVerificationResult {
  readonly version: typeof RELEASE_EVIDENCE_PACK_VERIFICATION_SPEC_VERSION;
  readonly valid: true;
  readonly evidencePackId: string;
  readonly decisionId: string;
  readonly decisionStatus: ReleaseDecision['status'];
  readonly consequenceType: ReleaseDecision['consequenceType'];
  readonly riskClass: ReleaseDecision['riskClass'];
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEvidencePolicyContext;
  readonly releaseTokenId: string | null;
  readonly reviewId: string | null;
  readonly keyId: string;
  readonly predicateType: string;
  readonly subjectCount: number;
  readonly bundleDigest: string;
  readonly artifactVerificationSummary: ReleaseEvidenceArtifactVerificationSummary;
}

export interface ReleaseEvidencePackIssuer {
  issue(input: ReleaseEvidencePackIssueInput): Promise<IssuedReleaseEvidencePack>;
  exportVerificationKey(): ReleaseEvidenceVerificationKey;
}

export interface ReleaseEvidencePackStore {
  upsert(pack: IssuedReleaseEvidencePack): IssuedReleaseEvidencePack;
  get(id: string): IssuedReleaseEvidencePack | null;
}

export class ReleaseEvidencePackStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseEvidencePackStoreError';
  }
}
