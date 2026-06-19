import type { EvidencePack } from './object-model.js';
import { RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION, type ReleaseEvidenceDsseEnvelope, type ReleaseEvidenceStatement, type ReleaseEvidenceVerificationKey } from './release-evidence-pack-types.js';
import { canonicalDigest } from './release-evidence-pack-digest.js';

export function dssePreAuthEncoding(payloadType: string, payload: Buffer): Buffer {
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

export function buildBundleDigest(input: {
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
