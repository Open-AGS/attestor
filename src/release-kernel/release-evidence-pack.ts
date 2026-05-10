import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from '../platform/file-store.js';
import type {
  EvidenceArtifactReference,
  EvidencePack,
  ReleaseDecision,
  ReleaseEvidencePolicyContext,
  ReleasePolicyProvenanceSource,
} from './object-model.js';
import { EVIDENCE_PACK_SPEC_VERSION, retentionClassForRiskClass } from './object-model.js';
import { canonicalizeReleaseJson } from './release-canonicalization.js';
import type { ReleaseDecisionLogEntry } from './release-decision-log.js';
import type { IssuedReleaseToken } from './release-token.js';
import { derivePublicKeyIdentity } from '../signing/keys.js';
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

const DEFAULT_RELEASE_EVIDENCE_PACK_STORE_PATH =
  '.attestor/release-evidence-pack-store.json';

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
}

export interface ReleaseEvidencePackIssuer {
  issue(input: ReleaseEvidencePackIssueInput): Promise<IssuedReleaseEvidencePack>;
  exportVerificationKey(): ReleaseEvidenceVerificationKey;
}

export interface ReleaseEvidencePackStore {
  upsert(pack: IssuedReleaseEvidencePack): IssuedReleaseEvidencePack;
  get(id: string): IssuedReleaseEvidencePack | null;
}

interface ReleaseEvidencePackStoreFile {
  readonly version: 1;
  packs: IssuedReleaseEvidencePack[];
}

export class ReleaseEvidencePackStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseEvidencePackStoreError';
  }
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function taggedSha256Hex(value: string | Buffer): string {
  return `sha256:${sha256Hex(value)}`;
}

function stripSha256Prefix(value: string): string {
  return value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
}

function canonicalDigest(value: unknown): string {
  return taggedSha256Hex(canonicalizeReleaseJson(value as never));
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalizeReleaseJson(left as never) === canonicalizeReleaseJson(right as never);
}

function assertSameNullableString(
  left: string | null | undefined,
  right: string | null | undefined,
  message: string,
): void {
  if ((left ?? null) !== (right ?? null)) {
    throw new Error(message);
  }
}

function assertNullableStringField(value: unknown, fieldName: string): void {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be a string or null.`);
  }
}

function assertRequiredStringField(value: unknown, fieldName: string): void {
  if (typeof value !== 'string') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be a string.`);
  }
}

function buildDecisionPolicyContext(decision: ReleaseDecision): ReleaseEvidencePolicyContext {
  return Object.freeze({
    policyVersion: decision.policyVersion,
    policyHash: decision.policyHash,
    policyIrHash: decision.policyProvenance?.compiledPolicyIrHash ?? null,
    policyProvenanceSource: decision.policyProvenance?.source ?? null,
    compiledPolicyIndexVersion: decision.policyProvenance?.compiledPolicyIndexVersion ?? null,
    compiledPolicyIrVersion: decision.policyProvenance?.compiledPolicyIrVersion ?? null,
  });
}

function buildEvidencePackPolicyContext(pack: {
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly policyIrHash: string | null;
  readonly policyProvenanceSource: ReleasePolicyProvenanceSource | null;
  readonly compiledPolicyIndexVersion: string | null;
  readonly compiledPolicyIrVersion: string | null;
}): ReleaseEvidencePolicyContext {
  return Object.freeze({
    policyVersion: pack.policyVersion,
    policyHash: pack.policyHash,
    policyIrHash: pack.policyIrHash,
    policyProvenanceSource: pack.policyProvenanceSource,
    compiledPolicyIndexVersion: pack.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: pack.compiledPolicyIrVersion,
  });
}

function buildTokenPolicyContext(
  issuedToken: IssuedReleaseToken,
): ReleaseEvidenceTokenPolicyContext {
  return Object.freeze({
    policyVersion: issuedToken.claims.policy_version ?? null,
    policyHash: issuedToken.claims.policy_hash,
    policyIrHash: issuedToken.claims.policy_ir_hash ?? null,
    policyProvenanceSource: issuedToken.claims.policy_provenance_source ?? null,
    compiledPolicyIndexVersion: issuedToken.claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: issuedToken.claims.compiled_policy_ir_version ?? null,
  });
}

function freezeReleaseEvidencePolicyContext(
  context: ReleaseEvidencePolicyContext,
): ReleaseEvidencePolicyContext {
  return Object.freeze({ ...context });
}

function freezeReleaseEvidenceTokenPolicyContext(
  context: ReleaseEvidenceTokenPolicyContext,
): ReleaseEvidenceTokenPolicyContext {
  return Object.freeze({ ...context });
}

function assertReleaseEvidencePolicyContextShape(
  value: unknown,
  fieldName: string,
  policyVersionMode: 'required' | 'nullable',
): void {
  if (!value || typeof value !== 'object') {
    throw new Error(`Release evidence pack verification requires ${fieldName} to be an object.`);
  }
  const context = value as Record<string, unknown>;
  if (policyVersionMode === 'required') {
    assertRequiredStringField(context.policyVersion, `${fieldName}.policyVersion`);
  } else {
    assertNullableStringField(context.policyVersion, `${fieldName}.policyVersion`);
  }
  assertRequiredStringField(context.policyHash, `${fieldName}.policyHash`);
  assertNullableStringField(context.policyIrHash, `${fieldName}.policyIrHash`);
  assertNullableStringField(
    context.policyProvenanceSource,
    `${fieldName}.policyProvenanceSource`,
  );
  assertNullableStringField(
    context.compiledPolicyIndexVersion,
    `${fieldName}.compiledPolicyIndexVersion`,
  );
  assertNullableStringField(
    context.compiledPolicyIrVersion,
    `${fieldName}.compiledPolicyIrVersion`,
  );
}

function assertPolicyContextMatchesFields(
  context: ReleaseEvidenceTokenPolicyContext,
  fields: ReleaseEvidenceTokenPolicyContext,
  label: string,
): void {
  assertSameNullableString(
    context.policyVersion,
    fields.policyVersion,
    `${label} policy version does not match flat policy version.`,
  );
  if (context.policyHash !== fields.policyHash) {
    throw new Error(`${label} policy hash does not match flat policy hash.`);
  }
  assertSameNullableString(
    context.policyIrHash,
    fields.policyIrHash,
    `${label} policy IR hash does not match flat policy IR hash.`,
  );
  if (context.policyProvenanceSource !== fields.policyProvenanceSource) {
    throw new Error(`${label} policy provenance source does not match flat policy provenance source.`);
  }
  assertSameNullableString(
    context.compiledPolicyIndexVersion,
    fields.compiledPolicyIndexVersion,
    `${label} compiled policy index version does not match flat compiled policy index version.`,
  );
  assertSameNullableString(
    context.compiledPolicyIrVersion,
    fields.compiledPolicyIrVersion,
    `${label} compiled policy IR version does not match flat compiled policy IR version.`,
  );
}

function resolveIssuedAt(issuedAt?: string): string {
  const resolved = issuedAt ? new Date(issuedAt) : new Date();
  if (Number.isNaN(resolved.getTime())) {
    throw new Error('Release evidence pack issuance requires a valid issuedAt timestamp.');
  }

  return resolved.toISOString();
}

function releaseDecisionRetentionClass(decision: ReleaseDecision): EvidencePack['retentionClass'] {
  const retention = decision.releaseConditions.items.find(
    (item): item is Extract<ReleaseDecision['releaseConditions']['items'][number], { kind: 'retention' }> =>
      item.kind === 'retention',
  );
  return retention?.retentionClass ?? retentionClassForRiskClass(decision.riskClass);
}

function summarizeDecisionLog(
  entries: readonly ReleaseDecisionLogEntry[],
  chainIntactOverride?: boolean,
): ReleaseEvidenceDecisionLogSummary {
  return {
    entryCount: entries.length,
    latestEntryDigest: entries.at(-1)?.entryDigest ?? null,
    chainIntact:
      chainIntactOverride ??
      entries.every((entry) => typeof entry.entryDigest === 'string' && entry.entryDigest.length > 0),
    phases: Object.freeze(entries.map((entry) => entry.phase)),
  };
}

function summarizeReview(detail?: ReleaseReviewerQueueDetail | null): ReleaseEvidenceReviewSummary | null {
  if (!detail) {
    return null;
  }

  return {
    reviewId: detail.id,
    status: detail.status,
    authorityState: detail.authorityState,
    approvalsRecorded: detail.approvalsRecorded,
    approvalsRemaining: detail.approvalsRemaining,
    reviewerDecisionCount: detail.reviewerDecisions.length,
    overrideReasonCode: detail.overrideGrant?.reasonCode ?? null,
  };
}

function summarizeReleaseToken(
  issuedToken?: IssuedReleaseToken | null,
): ReleaseEvidenceTokenSummary | null {
  if (!issuedToken) {
    return null;
  }
  const policyContext = buildTokenPolicyContext(issuedToken);

  return {
    tokenId: issuedToken.tokenId,
    audience: issuedToken.claims.aud,
    issuedAt: issuedToken.issuedAt,
    expiresAt: issuedToken.expiresAt,
    override: issuedToken.claims.override,
    introspectionRequired: issuedToken.claims.introspection_required,
    policyVersion: policyContext.policyVersion,
    policyHash: policyContext.policyHash,
    policyIrHash: policyContext.policyIrHash,
    policyProvenanceSource: policyContext.policyProvenanceSource,
    compiledPolicyIndexVersion: policyContext.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: policyContext.compiledPolicyIrVersion,
    policyContext,
  };
}

function summarizeDecision(
  decision: ReleaseDecision,
  evidencePackId: string,
): ReleaseEvidenceDecisionSummary {
  const policyContext = buildDecisionPolicyContext(decision);

  return {
    id: decision.id,
    createdAt: decision.createdAt,
    status: decision.status,
    consequenceType: decision.consequenceType,
    riskClass: decision.riskClass,
    policyVersion: policyContext.policyVersion,
    policyHash: policyContext.policyHash,
    policyIrHash: policyContext.policyIrHash,
    policyProvenanceSource: policyContext.policyProvenanceSource,
    compiledPolicyIndexVersion: policyContext.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: policyContext.compiledPolicyIrVersion,
    policyContext,
    targetId: decision.target.id,
    targetDisplayName: decision.target.displayName ?? null,
    requesterId: decision.requester.id,
    requesterType: decision.requester.type,
    requesterLabel: decision.requester.displayName ?? null,
    releaseTokenId: decision.releaseTokenId,
    evidencePackId,
    override: decision.override
      ? {
          reasonCode: decision.override.reasonCode,
          ticketId: decision.override.ticketId ?? null,
          requestedById: decision.override.requestedBy.id,
          requestedByLabel: decision.override.requestedBy.displayName ?? null,
          requestedByRole: decision.override.requestedBy.role ?? null,
        }
      : null,
  };
}

function buildArtifactReferences(input: {
  readonly decision: ReleaseDecision;
  readonly decisionLogEntries: readonly ReleaseDecisionLogEntry[];
  readonly review: ReleaseReviewerQueueDetail | null;
  readonly releaseToken: IssuedReleaseToken | null;
  readonly artifactReferences: readonly EvidenceArtifactReference[];
}): readonly EvidenceArtifactReference[] {
  const artifacts: EvidenceArtifactReference[] = [
    {
      kind: 'other',
      path: `release-decision-log://${input.decision.id}`,
      digest: canonicalDigest(
        input.decisionLogEntries.map((entry) => ({
          entryId: entry.entryId,
          phase: entry.phase,
          entryDigest: entry.entryDigest,
          previousEntryDigest: entry.previousEntryDigest,
        })),
      ),
    },
    ...input.artifactReferences,
  ];

  if (input.review) {
    artifacts.push({
      kind: 'review-record',
      path: `release-review://${input.review.id}`,
      digest: canonicalDigest({
        id: input.review.id,
        status: input.review.status,
        authorityState: input.review.authorityState,
        reviewerDecisions: input.review.reviewerDecisions,
        timeline: input.review.timeline,
      }),
    });
  }

  if (input.releaseToken) {
    artifacts.push({
      kind: 'signature',
      path: `release-token://${input.releaseToken.tokenId}`,
      digest: taggedSha256Hex(input.releaseToken.token),
    });
  }

  return Object.freeze(
    artifacts.map((artifact) =>
      Object.freeze({
        kind: artifact.kind,
        path: artifact.path,
        digest: artifact.digest,
      }),
    ),
  );
}

function buildEvidencePack(
  decision: ReleaseDecision,
  evidencePackId: string,
  artifacts: readonly EvidenceArtifactReference[],
): EvidencePack {
  const policyContext = buildDecisionPolicyContext(decision);

  return Object.freeze({
    version: EVIDENCE_PACK_SPEC_VERSION,
    id: evidencePackId,
    outputHash: decision.outputHash,
    consequenceHash: decision.consequenceHash,
    policyVersion: policyContext.policyVersion,
    policyHash: policyContext.policyHash,
    policyIrHash: policyContext.policyIrHash,
    policyProvenanceSource: policyContext.policyProvenanceSource,
    compiledPolicyIndexVersion: policyContext.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: policyContext.compiledPolicyIrVersion,
    policyContext,
    retentionClass: releaseDecisionRetentionClass(decision),
    findings: Object.freeze(decision.findings.map((finding) => Object.freeze({ ...finding }))),
    artifacts,
  });
}

function buildStatement(
  input: {
    readonly decision: ReleaseDecision;
    readonly evidencePack: EvidencePack;
    readonly decisionLogSummary: ReleaseEvidenceDecisionLogSummary;
    readonly review: ReleaseEvidenceReviewSummary | null;
    readonly releaseToken: ReleaseEvidenceTokenSummary | null;
    readonly exportedAt: string;
  },
): ReleaseEvidenceStatement {
  return Object.freeze({
    _type: RELEASE_EVIDENCE_PACK_STATEMENT_TYPE,
    subject: Object.freeze([
      Object.freeze({
        name: `release-output/${input.decision.id}`,
        digest: Object.freeze({
          sha256: stripSha256Prefix(input.decision.outputHash),
        }),
      }),
      Object.freeze({
        name: `release-consequence/${input.decision.target.id}`,
        digest: Object.freeze({
          sha256: stripSha256Prefix(input.decision.consequenceHash),
        }),
      }),
    ]),
    predicateType: RELEASE_EVIDENCE_PACK_PREDICATE_TYPE,
    predicate: Object.freeze({
      version: RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
      exportedAt: input.exportedAt,
      evidencePack: input.evidencePack,
      decision: summarizeDecision(input.decision, input.evidencePack.id),
      decisionLog: input.decisionLogSummary,
      review: input.review,
      releaseToken: input.releaseToken,
    }),
  });
}

function dssePreAuthEncoding(payloadType: string, payload: Buffer): Buffer {
  const payloadTypeBuffer = Buffer.from(payloadType, 'utf-8');
  return Buffer.concat([
    Buffer.from('DSSEv1 ', 'utf-8'),
    Buffer.from(String(payloadTypeBuffer.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payloadTypeBuffer,
    Buffer.from(' ', 'utf-8'),
    Buffer.from(String(payload.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payload,
  ]);
}

function buildBundleDigest(input: {
  readonly evidencePack: EvidencePack;
  readonly statement: ReleaseEvidenceStatement;
  readonly envelope: ReleaseEvidenceDsseEnvelope;
  readonly verificationKey: ReleaseEvidenceVerificationKey;
  readonly issuedAt: string;
  readonly keyId: string;
  readonly publicKeyFingerprint: string;
}): string {
  return canonicalDigest({
    version: RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
    evidencePack: input.evidencePack,
    statement: input.statement,
    envelope: input.envelope,
    verificationKey: input.verificationKey,
    issuedAt: input.issuedAt,
    keyId: input.keyId,
    publicKeyFingerprint: input.publicKeyFingerprint,
  });
}

function assertSubjectDigestMatches(
  subject: ReleaseEvidenceStatementSubject | undefined,
  expectedName: string,
  expectedDigest: string,
): void {
  if (!subject || subject.name !== expectedName || subject.digest.sha256 !== stripSha256Prefix(expectedDigest)) {
    throw new Error('Release evidence pack statement subject does not match its signed release material.');
  }
}

function assertPredicateInternalConsistency(statement: ReleaseEvidenceStatement): void {
  const { evidencePack, decision, releaseToken } = statement.predicate;
  assertNullableStringField(evidencePack.policyIrHash, 'evidencePack.policyIrHash');
  assertNullableStringField(
    evidencePack.policyProvenanceSource,
    'evidencePack.policyProvenanceSource',
  );
  assertNullableStringField(
    evidencePack.compiledPolicyIndexVersion,
    'evidencePack.compiledPolicyIndexVersion',
  );
  assertNullableStringField(
    evidencePack.compiledPolicyIrVersion,
    'evidencePack.compiledPolicyIrVersion',
  );
  assertNullableStringField(decision.policyIrHash, 'decision.policyIrHash');
  assertNullableStringField(
    decision.policyProvenanceSource,
    'decision.policyProvenanceSource',
  );
  assertNullableStringField(
    decision.compiledPolicyIndexVersion,
    'decision.compiledPolicyIndexVersion',
  );
  assertNullableStringField(decision.compiledPolicyIrVersion, 'decision.compiledPolicyIrVersion');
  if (evidencePack.policyContext !== undefined) {
    assertReleaseEvidencePolicyContextShape(
      evidencePack.policyContext,
      'evidencePack.policyContext',
      'required',
    );
  }
  if (decision.policyContext !== undefined) {
    assertReleaseEvidencePolicyContextShape(
      decision.policyContext,
      'decision.policyContext',
      'required',
    );
  }
  const evidencePackPolicyContext =
    evidencePack.policyContext ?? buildEvidencePackPolicyContext(evidencePack);
  const decisionPolicyContext =
    decision.policyContext ??
    buildEvidencePackPolicyContext({
      policyVersion: decision.policyVersion,
      policyHash: decision.policyHash,
      policyIrHash: decision.policyIrHash,
      policyProvenanceSource: decision.policyProvenanceSource,
      compiledPolicyIndexVersion: decision.compiledPolicyIndexVersion,
      compiledPolicyIrVersion: decision.compiledPolicyIrVersion,
    });
  assertPolicyContextMatchesFields(
    evidencePackPolicyContext,
    buildEvidencePackPolicyContext(evidencePack),
    'Release evidence pack policy context',
  );
  assertPolicyContextMatchesFields(
    decisionPolicyContext,
    {
      policyVersion: decision.policyVersion,
      policyHash: decision.policyHash,
      policyIrHash: decision.policyIrHash,
      policyProvenanceSource: decision.policyProvenanceSource,
      compiledPolicyIndexVersion: decision.compiledPolicyIndexVersion,
      compiledPolicyIrVersion: decision.compiledPolicyIrVersion,
    },
    'Release evidence pack decision policy context',
  );
  if (releaseToken) {
    assertNullableStringField(releaseToken.policyVersion, 'releaseToken.policyVersion');
    assertNullableStringField(releaseToken.policyIrHash, 'releaseToken.policyIrHash');
    assertNullableStringField(
      releaseToken.policyProvenanceSource,
      'releaseToken.policyProvenanceSource',
    );
    assertNullableStringField(
      releaseToken.compiledPolicyIndexVersion,
      'releaseToken.compiledPolicyIndexVersion',
    );
    assertNullableStringField(
      releaseToken.compiledPolicyIrVersion,
      'releaseToken.compiledPolicyIrVersion',
    );
    if (releaseToken.policyContext !== undefined) {
      assertReleaseEvidencePolicyContextShape(
        releaseToken.policyContext,
        'releaseToken.policyContext',
        'nullable',
      );
    }
    assertPolicyContextMatchesFields(
      releaseToken.policyContext ?? {
        policyVersion: releaseToken.policyVersion,
        policyHash: releaseToken.policyHash,
        policyIrHash: releaseToken.policyIrHash,
        policyProvenanceSource: releaseToken.policyProvenanceSource,
        compiledPolicyIndexVersion: releaseToken.compiledPolicyIndexVersion,
        compiledPolicyIrVersion: releaseToken.compiledPolicyIrVersion,
      },
      {
        policyVersion: releaseToken.policyVersion,
        policyHash: releaseToken.policyHash,
        policyIrHash: releaseToken.policyIrHash,
        policyProvenanceSource: releaseToken.policyProvenanceSource,
        compiledPolicyIndexVersion: releaseToken.compiledPolicyIndexVersion,
        compiledPolicyIrVersion: releaseToken.compiledPolicyIrVersion,
      },
      'Release evidence pack token policy context',
    );
  }

  if (decision.evidencePackId !== evidencePack.id) {
    throw new Error('Release evidence pack decision summary does not match the evidence pack id.');
  }
  if (decision.policyVersion !== evidencePack.policyVersion) {
    throw new Error('Release evidence pack decision summary policy version does not match the evidence pack.');
  }
  if (decision.policyHash !== evidencePack.policyHash) {
    throw new Error('Release evidence pack decision summary policy hash does not match the evidence pack.');
  }
  assertSameNullableString(
    decision.policyIrHash,
    evidencePack.policyIrHash,
    'Release evidence pack decision summary policy IR hash does not match the evidence pack.',
  );
  if (decision.policyProvenanceSource !== evidencePack.policyProvenanceSource) {
    throw new Error('Release evidence pack decision summary policy provenance source does not match the evidence pack.');
  }
  assertSameNullableString(
    decision.compiledPolicyIndexVersion,
    evidencePack.compiledPolicyIndexVersion,
    'Release evidence pack decision summary compiled policy index version does not match the evidence pack.',
  );
  assertSameNullableString(
    decision.compiledPolicyIrVersion,
    evidencePack.compiledPolicyIrVersion,
    'Release evidence pack decision summary compiled policy IR version does not match the evidence pack.',
  );

  if (releaseToken) {
    assertSameNullableString(
      releaseToken.policyVersion,
      evidencePack.policyVersion,
      'Release evidence pack token summary policy version does not match the evidence pack.',
    );
    if (releaseToken.policyHash !== evidencePack.policyHash) {
      throw new Error('Release evidence pack token summary policy hash does not match the evidence pack.');
    }
    assertSameNullableString(
      releaseToken.policyIrHash,
      evidencePack.policyIrHash,
      'Release evidence pack token summary policy IR hash does not match the evidence pack.',
    );
    if (releaseToken.policyProvenanceSource !== evidencePack.policyProvenanceSource) {
      throw new Error('Release evidence pack token summary policy provenance source does not match the evidence pack.');
    }
    assertSameNullableString(
      releaseToken.compiledPolicyIndexVersion,
      evidencePack.compiledPolicyIndexVersion,
      'Release evidence pack token summary compiled policy index version does not match the evidence pack.',
    );
    assertSameNullableString(
      releaseToken.compiledPolicyIrVersion,
      evidencePack.compiledPolicyIrVersion,
      'Release evidence pack token summary compiled policy IR version does not match the evidence pack.',
    );
  }

  assertSubjectDigestMatches(
    statement.subject[0],
    `release-output/${decision.id}`,
    evidencePack.outputHash,
  );
  assertSubjectDigestMatches(
    statement.subject[1],
    `release-consequence/${decision.targetId}`,
    evidencePack.consequenceHash,
  );
}

export function createReleaseEvidencePackIssuer(
  input: CreateReleaseEvidencePackIssuerInput,
): ReleaseEvidencePackIssuer {
  const algorithm = input.algorithm ?? 'Ed25519';
  const keyIdentity = derivePublicKeyIdentity(input.publicKeyPem);
  const keyId = input.keyId ?? keyIdentity.fingerprint;
  const verificationKey: ReleaseEvidenceVerificationKey = Object.freeze({
    version: RELEASE_EVIDENCE_PACK_VERIFICATION_KEY_SPEC_VERSION,
    issuer: input.issuer,
    algorithm,
    keyId,
    publicKeyFingerprint: keyIdentity.fingerprint,
    publicKeyPem: input.publicKeyPem,
  });

  return {
    async issue(issueInput: ReleaseEvidencePackIssueInput): Promise<IssuedReleaseEvidencePack> {
      const issuedAt = resolveIssuedAt(issueInput.issuedAt);
      const evidencePackId = issueInput.evidencePackId ?? `ep_${randomUUID()}`;
      const decisionSnapshot: ReleaseDecision = Object.freeze({
        ...issueInput.decision,
        evidencePackId,
        releaseTokenId: issueInput.releaseToken?.tokenId ?? issueInput.decision.releaseTokenId,
      });
      const decisionLogEntries = Object.freeze(
        issueInput.decisionLogEntries
          .filter((entry) => entry.decisionId === decisionSnapshot.id)
          .map((entry) => Object.freeze({ ...entry })),
      );
      const reviewSummary = summarizeReview(issueInput.review ?? null);
      const releaseTokenSummary = summarizeReleaseToken(issueInput.releaseToken ?? null);
      const artifacts = buildArtifactReferences({
        decision: decisionSnapshot,
        decisionLogEntries,
        review: issueInput.review ?? null,
        releaseToken: issueInput.releaseToken ?? null,
        artifactReferences: issueInput.artifactReferences ?? [],
      });
      const evidencePack = buildEvidencePack(decisionSnapshot, evidencePackId, artifacts);
      const statement = buildStatement({
        decision: decisionSnapshot,
        evidencePack,
        decisionLogSummary: summarizeDecisionLog(
          decisionLogEntries,
          issueInput.decisionLogChainIntact,
        ),
        review: reviewSummary,
        releaseToken: releaseTokenSummary,
        exportedAt: issuedAt,
      });

      const payload = Buffer.from(canonicalizeReleaseJson(statement as never), 'utf-8');
      const pae = dssePreAuthEncoding(RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE, payload);
      const signature = sign(null, pae, createPrivateKey(input.privateKeyPem));
      const envelope: ReleaseEvidenceDsseEnvelope = Object.freeze({
        payloadType: RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE,
        payload: payload.toString('base64'),
        signatures: Object.freeze([
          Object.freeze({
            keyid: keyId,
            sig: signature.toString('base64'),
          }),
        ]),
      });

      return Object.freeze({
        version: RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
        evidencePack,
        statement,
        envelope,
        verificationKey,
        bundleDigest: buildBundleDigest({
          evidencePack,
          statement,
          envelope,
          verificationKey,
          issuedAt,
          keyId,
          publicKeyFingerprint: keyIdentity.fingerprint,
        }),
        issuedAt,
        keyId,
        publicKeyFingerprint: keyIdentity.fingerprint,
      });
    },

    exportVerificationKey(): ReleaseEvidenceVerificationKey {
      return verificationKey;
    },
  };
}

export function verifyIssuedReleaseEvidencePack(
  input: VerifyReleaseEvidencePackInput,
): ReleaseEvidencePackVerificationResult {
  const pack = input.issuedEvidencePack;
  if (!input.verificationKey) {
    throw new Error(
      'Release evidence pack verification requires an explicit trusted verification key.',
    );
  }
  const verificationKey = input.verificationKey;
  const payload = Buffer.from(pack.envelope.payload, 'base64');
  const pae = dssePreAuthEncoding(pack.envelope.payloadType, payload);
  const signature = pack.envelope.signatures[0];
  if (!signature) {
    throw new Error('Release evidence pack is missing DSSE signatures.');
  }

  const valid = verify(
    null,
    pae,
    createPublicKey(verificationKey.publicKeyPem),
    Buffer.from(signature.sig, 'base64'),
  );
  if (!valid) {
    throw new Error('Release evidence pack DSSE signature is invalid.');
  }

  const statement = JSON.parse(payload.toString('utf-8')) as ReleaseEvidenceStatement;
  if (
    statement._type !== RELEASE_EVIDENCE_PACK_STATEMENT_TYPE ||
    statement.predicateType !== RELEASE_EVIDENCE_PACK_PREDICATE_TYPE
  ) {
    throw new Error('Release evidence pack statement type is not recognized.');
  }

  if (!canonicalEqual(statement, pack.statement)) {
    throw new Error('Release evidence pack signed payload does not match the exported statement.');
  }

  if (!canonicalEqual(statement.predicate.evidencePack, pack.evidencePack)) {
    throw new Error('Release evidence pack signed payload does not match the exported evidence pack.');
  }

  if (statement.predicate.evidencePack.id !== pack.evidencePack.id) {
    throw new Error('Release evidence pack payload does not match the exported pack id.');
  }

  if (statement.subject.length < 2) {
    throw new Error('Release evidence pack statement subjects are incomplete.');
  }
  assertPredicateInternalConsistency(statement);

  const expectedBundleDigest = buildBundleDigest({
    evidencePack: pack.evidencePack,
    statement: pack.statement,
    envelope: pack.envelope,
    verificationKey: pack.verificationKey,
    issuedAt: pack.issuedAt,
    keyId: pack.keyId,
    publicKeyFingerprint: pack.publicKeyFingerprint,
  });
  if (expectedBundleDigest !== pack.bundleDigest) {
    throw new Error('Release evidence pack bundle digest does not match its contents.');
  }

  return {
    version: RELEASE_EVIDENCE_PACK_VERIFICATION_SPEC_VERSION,
    valid: true,
    evidencePackId: pack.evidencePack.id,
    decisionId: statement.predicate.decision.id,
    decisionStatus: statement.predicate.decision.status,
    consequenceType: statement.predicate.decision.consequenceType,
    riskClass: statement.predicate.decision.riskClass,
    outputHash: pack.evidencePack.outputHash,
    consequenceHash: pack.evidencePack.consequenceHash,
    policyVersion: pack.evidencePack.policyVersion,
    policyHash: pack.evidencePack.policyHash,
    policyIrHash: pack.evidencePack.policyIrHash,
    policyProvenanceSource: pack.evidencePack.policyProvenanceSource,
    compiledPolicyIndexVersion: pack.evidencePack.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: pack.evidencePack.compiledPolicyIrVersion,
    policyContext:
      pack.evidencePack.policyContext ?? buildEvidencePackPolicyContext(pack.evidencePack),
    releaseTokenId: statement.predicate.releaseToken?.tokenId ?? null,
    reviewId: statement.predicate.review?.reviewId ?? null,
    keyId: signature.keyid,
    predicateType: statement.predicateType,
    subjectCount: statement.subject.length,
    bundleDigest: pack.bundleDigest,
  };
}

function freezeEvidencePack(pack: EvidencePack): EvidencePack {
  return Object.freeze({
    ...pack,
    policyContext: freezeReleaseEvidencePolicyContext(
      pack.policyContext ?? buildEvidencePackPolicyContext(pack),
    ),
    findings: Object.freeze(pack.findings.map((finding) => Object.freeze({ ...finding }))),
    artifacts: Object.freeze(pack.artifacts.map((artifact) => Object.freeze({ ...artifact }))),
  });
}

function freezeReleaseEvidenceDecisionSummary(
  summary: ReleaseEvidenceDecisionSummary,
): ReleaseEvidenceDecisionSummary {
  return Object.freeze({
    ...summary,
    policyContext: freezeReleaseEvidencePolicyContext(
      summary.policyContext ??
        buildEvidencePackPolicyContext({
          policyVersion: summary.policyVersion,
          policyHash: summary.policyHash,
          policyIrHash: summary.policyIrHash,
          policyProvenanceSource: summary.policyProvenanceSource,
          compiledPolicyIndexVersion: summary.compiledPolicyIndexVersion,
          compiledPolicyIrVersion: summary.compiledPolicyIrVersion,
        }),
    ),
    override: summary.override
      ? Object.freeze({ ...summary.override })
      : null,
  });
}

function freezeReleaseEvidenceDecisionLogSummary(
  summary: ReleaseEvidenceDecisionLogSummary,
): ReleaseEvidenceDecisionLogSummary {
  return Object.freeze({
    ...summary,
    phases: Object.freeze([...summary.phases]),
  });
}

function freezeReleaseEvidenceReviewSummary(
  summary: ReleaseEvidenceReviewSummary | null,
): ReleaseEvidenceReviewSummary | null {
  return summary ? Object.freeze({ ...summary }) : null;
}

function freezeReleaseEvidenceTokenSummary(
  summary: ReleaseEvidenceTokenSummary | null,
): ReleaseEvidenceTokenSummary | null {
  return summary
    ? Object.freeze({
        ...summary,
        policyContext: freezeReleaseEvidenceTokenPolicyContext(
          summary.policyContext ?? {
            policyVersion: summary.policyVersion,
            policyHash: summary.policyHash,
            policyIrHash: summary.policyIrHash,
            policyProvenanceSource: summary.policyProvenanceSource,
            compiledPolicyIndexVersion: summary.compiledPolicyIndexVersion,
            compiledPolicyIrVersion: summary.compiledPolicyIrVersion,
          },
        ),
      })
    : null;
}

function freezeReleaseEvidenceStatement(
  statement: ReleaseEvidenceStatement,
): ReleaseEvidenceStatement {
  return Object.freeze({
    ...statement,
    subject: Object.freeze(
      statement.subject.map((subject) =>
        Object.freeze({
          ...subject,
          digest: Object.freeze({ ...subject.digest }),
        }),
      ),
    ),
    predicate: Object.freeze({
      ...statement.predicate,
      evidencePack: freezeEvidencePack(statement.predicate.evidencePack),
      decision: freezeReleaseEvidenceDecisionSummary(statement.predicate.decision),
      decisionLog: freezeReleaseEvidenceDecisionLogSummary(statement.predicate.decisionLog),
      review: freezeReleaseEvidenceReviewSummary(statement.predicate.review),
      releaseToken: freezeReleaseEvidenceTokenSummary(statement.predicate.releaseToken),
    }),
  });
}

function freezeIssuedReleaseEvidencePack(
  pack: IssuedReleaseEvidencePack,
): IssuedReleaseEvidencePack {
  return Object.freeze({
    ...pack,
    evidencePack: freezeEvidencePack(pack.evidencePack),
    statement: freezeReleaseEvidenceStatement(pack.statement),
    envelope: Object.freeze({
      ...pack.envelope,
      signatures: Object.freeze(pack.envelope.signatures.map((entry) => Object.freeze({ ...entry }))),
    }),
    verificationKey: Object.freeze({ ...pack.verificationKey }),
  });
}

function defaultReleaseEvidencePackStoreFile(): ReleaseEvidencePackStoreFile {
  return {
    version: 1,
    packs: [],
  };
}

function defaultReleaseEvidencePackStorePath(): string {
  return resolve(
    process.env[ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV] ??
      DEFAULT_RELEASE_EVIDENCE_PACK_STORE_PATH,
  );
}

function ensureReleaseEvidencePackStoreDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function verifyReleaseEvidencePackStoreFileIntegrity(
  file: ReleaseEvidencePackStoreFile,
  path: string,
): void {
  for (const pack of file.packs) {
    try {
      verifyIssuedReleaseEvidencePack({
        issuedEvidencePack: pack,
        verificationKey: pack.verificationKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ReleaseEvidencePackStoreError(
        `Release evidence pack store '${path}' failed integrity verification for pack '${pack.evidencePack?.id ?? 'unknown'}': ${message}`,
      );
    }
  }
}

function normalizeReleaseEvidencePackStoreFile(
  value: unknown,
  path: string,
): ReleaseEvidencePackStoreFile {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { packs?: unknown }).packs)
  ) {
    throw new ReleaseEvidencePackStoreError(
      `Release evidence pack store '${path}' has an invalid file shape.`,
    );
  }

  const file: ReleaseEvidencePackStoreFile = {
    version: 1,
    packs: (value as { packs: IssuedReleaseEvidencePack[] }).packs.map((pack) =>
      freezeIssuedReleaseEvidencePack(pack),
    ),
  };
  verifyReleaseEvidencePackStoreFileIntegrity(file, path);
  return file;
}

function loadReleaseEvidencePackStoreFile(path: string): ReleaseEvidencePackStoreFile {
  ensureReleaseEvidencePackStoreDirectory(path);
  if (!existsSync(path)) return defaultReleaseEvidencePackStoreFile();

  try {
    return normalizeReleaseEvidencePackStoreFile(
      JSON.parse(readFileSync(path, 'utf8')) as unknown,
      path,
    );
  } catch (error) {
    if (error instanceof ReleaseEvidencePackStoreError) throw error;
    throw new ReleaseEvidencePackStoreError(
      `Release evidence pack store '${path}' could not be parsed.`,
    );
  }
}

function saveReleaseEvidencePackStoreFile(
  path: string,
  file: ReleaseEvidencePackStoreFile,
): void {
  writeTextFileAtomic(
    path,
    `${JSON.stringify(
      {
        version: 1,
        packs: file.packs,
      },
      null,
      2,
    )}\n`,
  );
}

function upsertIssuedReleaseEvidencePack(
  file: ReleaseEvidencePackStoreFile,
  pack: IssuedReleaseEvidencePack,
): IssuedReleaseEvidencePack {
  verifyIssuedReleaseEvidencePack({
    issuedEvidencePack: pack,
    verificationKey: pack.verificationKey,
  });
  const stored = freezeIssuedReleaseEvidencePack(pack);
  const existingIndex = file.packs.findIndex(
    (entry) => entry.evidencePack.id === stored.evidencePack.id,
  );
  if (existingIndex >= 0) {
    file.packs[existingIndex] = stored;
  } else {
    file.packs.push(stored);
  }
  return stored;
}

function createReleaseEvidencePackStoreFromAccessors(accessors: {
  readonly read: () => ReleaseEvidencePackStoreFile;
  readonly mutate: <T>(action: (file: ReleaseEvidencePackStoreFile) => T) => T;
}): ReleaseEvidencePackStore {
  return {
    upsert(pack: IssuedReleaseEvidencePack): IssuedReleaseEvidencePack {
      return accessors.mutate((file) => upsertIssuedReleaseEvidencePack(file, pack));
    },
    get(id: string): IssuedReleaseEvidencePack | null {
      return accessors.read().packs.find((pack) => pack.evidencePack.id === id) ?? null;
    },
  };
}

export function createInMemoryReleaseEvidencePackStore(): ReleaseEvidencePackStore {
  let file = defaultReleaseEvidencePackStoreFile();

  return createReleaseEvidencePackStoreFromAccessors({
    read: () => file,
    mutate: (action) => {
      const workingCopy: ReleaseEvidencePackStoreFile = {
        version: 1,
        packs: [...file.packs],
      };
      const result = action(workingCopy);
      file = workingCopy;
      return result;
    },
  });
}

export function createFileBackedReleaseEvidencePackStore(
  path = defaultReleaseEvidencePackStorePath(),
): ReleaseEvidencePackStore {
  loadReleaseEvidencePackStoreFile(path);

  return createReleaseEvidencePackStoreFromAccessors({
    read: () => withFileLock(path, () => loadReleaseEvidencePackStoreFile(path)),
    mutate: (action) =>
      withFileLock(path, () => {
        const file = loadReleaseEvidencePackStoreFile(path);
        const result = action(file);
        saveReleaseEvidencePackStoreFile(path, file);
        return result;
      }),
  });
}

export function resetFileBackedReleaseEvidencePackStoreForTests(path?: string): void {
  const resolvedPath = path ?? defaultReleaseEvidencePackStorePath();
  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { force: true });
  }
  if (existsSync(`${resolvedPath}.lock`)) {
    rmSync(`${resolvedPath}.lock`, { recursive: true, force: true });
  }
}
