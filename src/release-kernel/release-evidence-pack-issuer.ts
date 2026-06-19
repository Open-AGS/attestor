import { createPrivateKey, randomUUID, sign } from 'node:crypto';
import type { ReleaseDecision } from './object-model.js';
import { canonicalizeReleaseJson } from './release-canonicalization.js';
import { derivePublicKeyIdentity } from '../signing/keys.js';
import {
  RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE,
  RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
  RELEASE_EVIDENCE_PACK_VERIFICATION_KEY_SPEC_VERSION,
  type CreateReleaseEvidencePackIssuerInput,
  type IssuedReleaseEvidencePack,
  type ReleaseEvidencePackIssueInput,
  type ReleaseEvidenceDsseEnvelope,
  type ReleaseEvidencePackIssuer,
  type ReleaseEvidenceVerificationKey,
} from './release-evidence-pack-types.js';
import { buildBundleDigest, dssePreAuthEncoding } from './release-evidence-pack-dsse.js';
import { buildArtifactReferences, buildEvidencePack, buildStatement, resolveIssuedAt, summarizeDecisionLog, summarizeReleaseToken, summarizeReview } from './release-evidence-pack-summary.js';

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
