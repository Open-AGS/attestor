import type { EvidenceArtifactReference, EvidencePack, ReleaseDecision } from './object-model.js';
import { EVIDENCE_PACK_SPEC_VERSION, retentionClassForRiskClass } from './object-model.js';
import type { ReleaseDecisionLogEntry } from './release-decision-log.js';
import type { IssuedReleaseToken } from './release-token.js';
import type { ReleaseReviewerQueueDetail } from './reviewer-queue.js';
import {
  RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
  RELEASE_EVIDENCE_PACK_PREDICATE_TYPE,
  RELEASE_EVIDENCE_PACK_STATEMENT_TYPE,
  type ReleaseEvidenceArtifactVerificationState,
  type ReleaseEvidenceArtifactVerificationSummary,
  type ReleaseEvidenceDecisionLogSummary,
  type ReleaseEvidenceDecisionSummary,
  type ReleaseEvidenceReviewSummary,
  type ReleaseEvidenceStatement,
  type ReleaseEvidenceTokenSummary,
} from './release-evidence-pack-types.js';
import {
  canonicalDigest,
  declaredUnverifiedArtifact,
  issuerDerivedArtifact,
  stripSha256Prefix,
  taggedSha256Hex,
} from './release-evidence-pack-digest.js';
import { buildDecisionPolicyContext, buildTokenPolicyContext } from './release-evidence-pack-policy-context.js';

export function resolveIssuedAt(issuedAt?: string): string {
  const resolved = issuedAt ? new Date(issuedAt) : new Date();
  if (Number.isNaN(resolved.getTime())) {
    throw new Error('Release evidence pack issuance requires a valid issuedAt timestamp.');
  }

  return resolved.toISOString();
}

export function releaseDecisionRetentionClass(decision: ReleaseDecision): EvidencePack['retentionClass'] {
  const retention = decision.releaseConditions.items.find(
    (item): item is Extract<ReleaseDecision['releaseConditions']['items'][number], { kind: 'retention' }> =>
      item.kind === 'retention',
  );
  return retention?.retentionClass ?? retentionClassForRiskClass(decision.riskClass);
}

export function summarizeDecisionLog(
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

export function summarizeReview(detail?: ReleaseReviewerQueueDetail | null): ReleaseEvidenceReviewSummary | null {
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

export function summarizeReleaseToken(
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

export function summarizeDecision(
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

export function buildArtifactReferences(input: {
  readonly decision: ReleaseDecision;
  readonly decisionLogEntries: readonly ReleaseDecisionLogEntry[];
  readonly review: ReleaseReviewerQueueDetail | null;
  readonly releaseToken: IssuedReleaseToken | null;
  readonly artifactReferences: readonly EvidenceArtifactReference[];
}): readonly EvidenceArtifactReference[] {
  const artifacts: EvidenceArtifactReference[] = [
    issuerDerivedArtifact({
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
    }),
    ...input.artifactReferences.map((artifact) => declaredUnverifiedArtifact(artifact)),
  ];

  if (input.review) {
    artifacts.push(issuerDerivedArtifact({
      kind: 'review-record',
      path: `release-review://${input.review.id}`,
      digest: canonicalDigest({
        id: input.review.id,
        status: input.review.status,
        authorityState: input.review.authorityState,
        reviewerDecisions: input.review.reviewerDecisions,
        timeline: input.review.timeline,
      }),
    }));
  }

  if (input.releaseToken) {
    artifacts.push(issuerDerivedArtifact({
      kind: 'signature',
      path: `release-token://${input.releaseToken.tokenId}`,
      digest: taggedSha256Hex(input.releaseToken.token),
    }));
  }

  return Object.freeze(
    artifacts.map((artifact) =>
      Object.freeze({
        kind: artifact.kind,
        path: artifact.path,
        digest: artifact.digest,
        verificationStatus: artifact.verificationStatus,
      }),
    ),
  );
}

export function summarizeArtifactVerification(
  artifacts: readonly EvidenceArtifactReference[],
): ReleaseEvidenceArtifactVerificationSummary {
  let issuerDerivedCount = 0;
  let declaredUnverifiedCount = 0;
  let unknownStatusCount = 0;

  for (const artifact of artifacts) {
    if (artifact.verificationStatus === 'issuer-derived') {
      issuerDerivedCount += 1;
    } else if (artifact.verificationStatus === 'declared-unverified') {
      declaredUnverifiedCount += 1;
    } else {
      unknownStatusCount += 1;
    }
  }

  const state: ReleaseEvidenceArtifactVerificationState =
    artifacts.length === 0
      ? 'none'
      : unknownStatusCount > 0
        ? 'unknown'
        : issuerDerivedCount > 0 && declaredUnverifiedCount > 0
          ? 'mixed'
          : declaredUnverifiedCount > 0
            ? 'declared-only'
            : 'issuer-derived-only';

  return Object.freeze({
    artifactCount: artifacts.length,
    issuerDerivedCount,
    declaredUnverifiedCount,
    unknownStatusCount,
    externalArtifactVerificationPerformed: false,
    allExternalArtifactsVerified: false,
    state,
  });
}

export function buildEvidencePack(
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

export function buildStatement(
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
