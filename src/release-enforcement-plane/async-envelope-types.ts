import type { JWK } from 'jose';
import type { IssuedReleaseToken } from '../release-kernel/release-token.js';
import type { ReleasePolicyProvenanceSource } from '../release-kernel/object-model.js';
import type {
  ReleaseEnforcementPolicyContext,
  ReleasePresentation,
} from './object-model.js';
import type { ReplayLedgerEntry } from './freshness.js';
import type {
  EnforcementFailureReason,
  ReleaseEnforcementConsequenceType,
  ReleaseEnforcementRiskClass,
} from './types.js';

export const ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION =
  'attestor.release-enforcement-async-envelope.v1';
export const ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE =
  'application/vnd.attestor.release-enforcement.async-consequence-envelope+json;version=1';
export const ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE =
  'https://attestor.dev/release-enforcement/async-consequence-envelope/v1';
export const IN_TOTO_STATEMENT_V1_TYPE = 'https://in-toto.io/Statement/v1';
export const CLOUDEVENTS_SPEC_VERSION = '1.0';
export const ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM = 'ed25519';
export const DEFAULT_ASYNC_ENVELOPE_MAX_AGE_SECONDS = 900;
export const DEFAULT_ASYNC_ENVELOPE_CLOCK_SKEW_SECONDS = 30;

export type AsyncConsequenceBoundaryKind =
  | 'queue'
  | 'topic'
  | 'export'
  | 'file'
  | 'artifact';

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export type AsyncConsequenceEnvelopeAlgorithm =
  typeof ASYNC_CONSEQUENCE_ENVELOPE_ALGORITHM;

export interface AsyncConsequenceEnvelopeKeyPair {
  readonly algorithm: AsyncConsequenceEnvelopeAlgorithm;
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
  readonly publicKeyThumbprint: string;
  readonly keyId: string;
}

export interface AsyncConsequenceEnvelopeTarget {
  readonly kind: AsyncConsequenceBoundaryKind;
  readonly id: string;
}

export interface AsyncConsequencePayloadInput {
  readonly name: string;
  readonly mediaType?: string;
  readonly content?: string | Uint8Array | Buffer | CanonicalJsonValue | null;
  readonly digest?: string;
  readonly sizeBytes?: number;
}

export interface AsyncConsequencePayloadDescriptor {
  readonly name: string;
  readonly mediaType: string;
  readonly digest: string;
  readonly sizeBytes: number | null;
}

export interface AsyncConsequenceCloudEvent {
  readonly specversion: typeof CLOUDEVENTS_SPEC_VERSION;
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly subject: string;
  readonly time: string;
  readonly datacontenttype: string;
  readonly dataschema: string;
}

export interface AsyncConsequenceReleaseBinding {
  readonly tokenId: string;
  readonly tokenDigest: string;
  readonly decisionId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly audience: string;
  readonly expiresAt: string;
  readonly scope: readonly string[];
}

export interface AsyncConsequenceBinding {
  readonly consequenceType: ReleaseEnforcementConsequenceType;
  readonly riskClass: ReleaseEnforcementRiskClass;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly policyHash: string;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext;
}

export interface AsyncConsequenceTransportBinding {
  readonly messageId: string | null;
  readonly queueOrTopic: string | null;
}

export interface AsyncConsequenceSignerBinding {
  readonly algorithm: AsyncConsequenceEnvelopeAlgorithm;
  readonly keyId: string;
  readonly publicKeyThumbprint: string;
}

export interface AsyncConsequenceEnvelopePredicate {
  readonly version: typeof ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION;
  readonly envelopeId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly producer: string;
  readonly target: AsyncConsequenceEnvelopeTarget;
  readonly release: AsyncConsequenceReleaseBinding;
  readonly consequence: AsyncConsequenceBinding;
  readonly payload: AsyncConsequencePayloadDescriptor;
  readonly transport: AsyncConsequenceTransportBinding;
  readonly cloudEvent: AsyncConsequenceCloudEvent;
  readonly signer: AsyncConsequenceSignerBinding;
}

export interface InTotoStatementSubject {
  readonly name: string;
  readonly digest: Readonly<Record<'sha256', string>>;
}

export interface AsyncConsequenceEnvelopeStatement {
  readonly _type: typeof IN_TOTO_STATEMENT_V1_TYPE;
  readonly subject: readonly InTotoStatementSubject[];
  readonly predicateType: typeof ASYNC_CONSEQUENCE_ENVELOPE_PREDICATE_TYPE;
  readonly predicate: AsyncConsequenceEnvelopePredicate;
}

export interface DsseSignature {
  readonly keyid: string;
  readonly sig: string;
}

export interface DsseEnvelope {
  readonly payloadType: typeof ASYNC_CONSEQUENCE_ENVELOPE_PAYLOAD_TYPE;
  readonly payload: string;
  readonly signatures: readonly DsseSignature[];
}

export interface CreateSignedAsyncConsequenceEnvelopeInput {
  readonly issuedToken: IssuedReleaseToken;
  readonly privateJwk: JWK;
  readonly publicJwk: JWK;
  readonly keyId?: string;
  readonly envelopeId: string;
  readonly idempotencyKey: string;
  readonly target: AsyncConsequenceEnvelopeTarget;
  readonly payload: AsyncConsequencePayloadInput;
  readonly createdAt?: string;
  readonly expiresAt?: string;
  readonly producer?: string;
  readonly messageId?: string | null;
  readonly queueOrTopic?: string | null;
  readonly cloudEventSource?: string;
  readonly cloudEventType?: string;
  readonly cloudEventSubject?: string;
  readonly presentedAt?: string;
  readonly scope?: readonly string[];
}

export interface SignedAsyncConsequenceEnvelope {
  readonly version: typeof ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION;
  readonly algorithm: AsyncConsequenceEnvelopeAlgorithm;
  readonly envelope: DsseEnvelope;
  readonly statement: AsyncConsequenceEnvelopeStatement;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly releaseTokenDigest: string;
  readonly subjectDigest: string;
  readonly statementDigest: string;
  readonly envelopeDigest: string;
  readonly signatureRef: string;
  readonly keyId: string;
  readonly publicKeyThumbprint: string;
  readonly cloudEvent: AsyncConsequenceCloudEvent;
  readonly target: AsyncConsequenceEnvelopeTarget;
  readonly replayKey: string;
  readonly presentation: ReleasePresentation;
}

export interface VerifySignedAsyncConsequenceEnvelopeInput {
  readonly envelope: DsseEnvelope | SignedAsyncConsequenceEnvelope;
  readonly publicJwk: JWK;
  readonly now: string;
  readonly expectedKeyId?: string | null;
  readonly expectedJwkThumbprint?: string | null;
  readonly expectedReleaseTokenDigest?: string | null;
  readonly expectedReleaseTokenId?: string | null;
  readonly expectedReleaseDecisionId?: string | null;
  readonly expectedAudience?: string | null;
  readonly expectedTargetId?: string | null;
  readonly expectedOutputHash?: string | null;
  readonly expectedConsequenceHash?: string | null;
  readonly expectedPolicyHash?: string | null;
  readonly expectedPolicyVersion?: string | null;
  readonly expectedPolicyIrHash?: string | null;
  readonly expectedPolicyProvenanceSource?: ReleasePolicyProvenanceSource | null;
  readonly expectedCompiledPolicyIndexVersion?: string | null;
  readonly expectedCompiledPolicyIrVersion?: string | null;
  readonly expectedPolicyContext?: ReleaseEnforcementPolicyContext | null;
  readonly expectedConsequenceType?: ReleaseEnforcementConsequenceType | null;
  readonly expectedRiskClass?: ReleaseEnforcementRiskClass | null;
  readonly expectedIdempotencyKey?: string | null;
  readonly expectedMessageId?: string | null;
  readonly expectedQueueOrTopic?: string | null;
  readonly expectedEnvelopeDigest?: string | null;
  readonly expectedSubjectDigest?: string | null;
  readonly maxEnvelopeAgeSeconds?: number;
  readonly clockSkewSeconds?: number;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
}

export interface SignedAsyncConsequenceEnvelopeVerification {
  readonly version: typeof ASYNC_CONSEQUENCE_ENVELOPE_SPEC_VERSION;
  readonly status: 'valid' | 'invalid';
  readonly checkedAt: string;
  readonly keyId: string | null;
  readonly publicKeyThumbprint: string | null;
  readonly envelopeDigest: string | null;
  readonly subjectDigest: string | null;
  readonly statementDigest: string | null;
  readonly signatureRef: string | null;
  readonly createdAt: string | null;
  readonly expiresAt: string | null;
  readonly idempotencyKey: string | null;
  readonly releaseTokenDigest: string | null;
  readonly releaseTokenId: string | null;
  readonly releaseDecisionId: string | null;
  readonly policyHash: string | null;
  readonly policyVersion: string | null;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
  readonly policyContext: ReleaseEnforcementPolicyContext | null;
  readonly targetId: string | null;
  readonly messageId: string | null;
  readonly queueOrTopic: string | null;
  readonly cloudEvent: AsyncConsequenceCloudEvent | null;
  readonly replayKey: string | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
}
