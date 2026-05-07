/**
 * Attestor Attestation Certificate v1
 *
 * A portable, independently verifiable certificate that proves:
 * 1. WHO signed (Ed25519 public key identity)
 * 2. WHAT was decided (pass/fail/block/pending)
 * 3. HOW it was governed (authority chain summary)
 * 4. WHAT evidence anchors exist (hash chain roots/terminals)
 * 5. WHETHER execution was live or fixture-based
 * 6. WHEN it was issued
 *
 * Verification requires only the certificate JSON + the signer's public key.
 * No platform access, no database, no API call needed.
 *
 * Inspired by:
 * - C2PA (Content Credentials) — media provenance certificates
 * - SLSA / in-toto — software supply chain attestations
 * - Sigstore — keyless/keyed signing for artifacts
 *
 * But purpose-built for analytical outputs, not media or software builds.
 */

import { createHash } from 'node:crypto';
import { signPayload, verifySignature, canonicalize } from './sign.js';
import { derivePublicKeyIdentity } from './keys.js';
import type { AttestorKeyPair } from './keys.js';

// ─── Certificate Schema ──────────────────────────────────────────────────────

export interface AttestationCertificate {
  /** Schema version. */
  version: '1.0';
  /** Certificate type identifier. */
  type: 'attestor.certificate.v1';

  // ── Identity ──
  /** Unique certificate ID. */
  certificateId: string;
  /** ISO timestamp of issuance. */
  issuedAt: string;
  /** ISO timestamp when this certificate first becomes valid. */
  notBefore: string;
  /** ISO timestamp when this certificate expires. */
  notAfter: string;
  /** Run identity (deterministic, replay-stable). */
  runIdentity: string;

  // ── Decision ──
  /** Final pipeline decision. */
  decision: 'pass' | 'fail' | 'block' | 'pending_approval' | 'approved' | 'rejected' | 'warn';
  /** Human-readable decision summary. */
  decisionSummary: string;

  // ── Authority Chain ──
  authority: {
    /** Warrant status at finalization. */
    warrantStatus: string;
    /** Number of evidence obligations fulfilled. */
    obligationsFulfilled: number;
    /** Number of evidence obligations total. */
    obligationsTotal: number;
    /** Escrow release state. */
    escrowState: string;
    /** Receipt status. */
    receiptStatus: string;
    /** Capsule authority state. */
    capsuleAuthority: string;
  };

  // ── Evidence Anchors ──
  evidence: {
    /** Root hash of the evidence chain. */
    evidenceChainRoot: string;
    /** Terminal hash of the evidence chain. */
    evidenceChainTerminal: string;
    /** Whether the audit trail hash chain is intact. */
    auditChainIntact: boolean;
    /** Number of audit entries. */
    auditEntryCount: number;
    /** SQL query hash (for replay correlation). */
    sqlHash: string;
    /** Data snapshot hash (proves which data state was used). */
    snapshotHash: string;
  };

  // ── Governance Summary ──
  governance: {
    /** SQL governance result. */
    sqlGovernance: 'pass' | 'fail';
    /** Policy result. */
    policy: 'pass' | 'fail';
    /** Guardrails result. */
    guardrails: 'pass' | 'fail';
    /** Data contracts result. */
    dataContracts: 'pass' | 'fail' | 'warn' | 'skip';
    /** Number of scorers that ran. */
    scorersRun: number;
    /** Whether review was required. */
    reviewRequired: boolean;
  };

  // ── Live Proof ──
  liveProof: {
    /** Proof mode: offline_fixture | live_model | live_runtime | hybrid */
    mode: string;
    /** Whether upstream (model) was live. */
    upstreamLive: boolean;
    /** Whether execution was live. */
    executionLive: boolean;
    /** Whether proof is internally consistent. */
    consistent: boolean;
  };

  // ── Signing ──
  signing: {
    /** Signing algorithm. */
    algorithm: 'ed25519';
    /** Public key of the signer (hex-encoded, 32 bytes). */
    publicKey: string;
    /** Key fingerprint (truncated SHA-256 of SPKI DER). */
    fingerprint: string;
    /** Signature over the canonicalized certificate body (hex-encoded, 64 bytes). */
    signature: string;
  };
}

/** The certificate body that gets signed (everything except the signing section). */
export type CertificateBody = Omit<AttestationCertificate, 'signing'>;

const DEFAULT_CERTIFICATE_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_CERTIFICATE_CLOCK_SKEW_MS = 60_000;

// ─── Certificate Issuance ────────────────────────────────────────────────────

export interface CertificateInput {
  runIdentity: string;
  decision: AttestationCertificate['decision'];
  decisionSummary: string;
  warrant: { status: string; obligationsFulfilled: number; obligationsTotal: number };
  escrow: { state: string };
  receipt: { status: string };
  capsule: { authority: string };
  evidenceChainRoot: string;
  evidenceChainTerminal: string;
  auditChainIntact: boolean;
  auditEntryCount: number;
  sqlHash: string;
  snapshotHash: string;
  sqlGovernance: 'pass' | 'fail';
  policy: 'pass' | 'fail';
  guardrails: 'pass' | 'fail';
  dataContracts: 'pass' | 'fail' | 'warn' | 'skip';
  scorersRun: number;
  reviewRequired: boolean;
  liveProofMode: string;
  upstreamLive: boolean;
  executionLive: boolean;
  liveProofConsistent: boolean;
  validityMinutes?: number | null;
}

/**
 * Issue a signed attestation certificate.
 */
export function issueCertificate(
  input: CertificateInput,
  keyPair: AttestorKeyPair,
): AttestationCertificate {
  const issuedAt = new Date();
  const validityMs = input.validityMinutes === null || input.validityMinutes === undefined
    ? DEFAULT_CERTIFICATE_VALIDITY_MS
    : input.validityMinutes * 60 * 1000;
  if (!Number.isFinite(validityMs) || validityMs <= 0) {
    throw new Error('Attestation certificate validityMinutes must be a positive finite number.');
  }
  const notAfter = new Date(issuedAt.getTime() + Math.floor(validityMs));
  const certificateId = `cert_${createHash('sha256').update(`${input.runIdentity}:${input.evidenceChainTerminal}:${issuedAt.toISOString()}`).digest('hex').slice(0, 16)}`;

  const body: CertificateBody = {
    version: '1.0',
    type: 'attestor.certificate.v1',
    certificateId,
    issuedAt: issuedAt.toISOString(),
    notBefore: issuedAt.toISOString(),
    notAfter: notAfter.toISOString(),
    runIdentity: input.runIdentity,
    decision: input.decision,
    decisionSummary: input.decisionSummary,
    authority: {
      warrantStatus: input.warrant.status,
      obligationsFulfilled: input.warrant.obligationsFulfilled,
      obligationsTotal: input.warrant.obligationsTotal,
      escrowState: input.escrow.state,
      receiptStatus: input.receipt.status,
      capsuleAuthority: input.capsule.authority,
    },
    evidence: {
      evidenceChainRoot: input.evidenceChainRoot,
      evidenceChainTerminal: input.evidenceChainTerminal,
      auditChainIntact: input.auditChainIntact,
      auditEntryCount: input.auditEntryCount,
      sqlHash: input.sqlHash,
      snapshotHash: input.snapshotHash,
    },
    governance: {
      sqlGovernance: input.sqlGovernance,
      policy: input.policy,
      guardrails: input.guardrails,
      dataContracts: input.dataContracts,
      scorersRun: input.scorersRun,
      reviewRequired: input.reviewRequired,
    },
    liveProof: {
      mode: input.liveProofMode,
      upstreamLive: input.upstreamLive,
      executionLive: input.executionLive,
      consistent: input.liveProofConsistent,
    },
  };

  const canonical = canonicalize(body);
  const signature = signPayload(canonical, keyPair.privateKeyPem);

  return {
    ...body,
    signing: {
      algorithm: 'ed25519',
      publicKey: keyPair.publicKeyHex,
      fingerprint: keyPair.fingerprint,
      signature,
    },
  };
}

// ─── Certificate Verification ────────────────────────────────────────────────

export interface CertificateVerification {
  /** Is the signature cryptographically valid? */
  signatureValid: boolean;
  /** Does the signing public key match the claimed fingerprint? */
  fingerprintConsistent: boolean;
  /** Did an operator-pinned or PKI/JWKS-derived expected fingerprint match the key? */
  expectedFingerprintMatch: boolean;
  /** Does the certificate carry an explicit validity window? */
  expiryBounded: boolean;
  /** Is the certificate outside its validity window? */
  expired: boolean;
  /** Is the certificate explicitly revoked by caller-provided revocation material? */
  revoked: boolean;
  /** Is the certificate schema valid? */
  schemaValid: boolean;
  /** Overall result. */
  overall: 'valid' | 'invalid' | 'expired' | 'revoked' | 'schema_error';
  /** Human-readable explanation. */
  explanation: string;
}

export interface VerifyCertificateOptions {
  readonly now?: Date;
  readonly clockSkewMs?: number;
  /**
   * Expected signer fingerprint from a trusted source: PKI chain leaf, JWKS, or
   * operator-pinned trust store. Do not derive this from certificate.signing.
   */
  readonly expectedFingerprint?: string | null;
  /**
   * Compatibility escape hatch for historical v1 certificates created before
   * notBefore/notAfter existed. New production verifiers should leave this false.
   */
  readonly allowLegacyUnbounded?: boolean;
  readonly revokedCertificateIds?: readonly string[];
  readonly revokedFingerprints?: readonly string[];
}

/**
 * Verify an attestation certificate.
 *
 * Requires certificate JSON and a signer public key PEM from a trusted source.
 * No platform access needed when the trust anchor is already pinned.
 */
// publicKeyPem must come from a trusted PKI/JWKS/operator-pinned source, not
// from certificate.signing.publicKey converted back into PEM.
export function verifyCertificate(
  certificate: AttestationCertificate,
  publicKeyPem: string,
  options: VerifyCertificateOptions = {},
): CertificateVerification {
  const invalid = (
    overall: CertificateVerification['overall'],
    explanation: string,
  ): CertificateVerification => ({
    signatureValid: false,
    fingerprintConsistent: false,
    expectedFingerprintMatch: false,
    expiryBounded: false,
    expired: false,
    revoked: false,
    schemaValid: false,
    overall,
    explanation,
  });

  // Schema validation
  if (certificate.version !== '1.0' || certificate.type !== 'attestor.certificate.v1') {
    return invalid('schema_error', `Unknown certificate version=${certificate.version} type=${certificate.type}`);
  }

  if (!certificate.signing?.algorithm || certificate.signing.algorithm !== 'ed25519') {
    return invalid('schema_error', `Unsupported algorithm: ${certificate.signing?.algorithm}`);
  }

  const notBeforeMs = Date.parse(certificate.notBefore);
  const notAfterMs = Date.parse(certificate.notAfter);
  const expiryBounded = Number.isFinite(notBeforeMs) && Number.isFinite(notAfterMs);
  const schemaValid = !!(
    certificate.certificateId &&
    certificate.runIdentity &&
    certificate.decision &&
    certificate.signing.signature &&
    (expiryBounded || options.allowLegacyUnbounded === true)
  );

  if (!schemaValid) {
    return invalid(
      'schema_error',
      'Attestation certificate schema is missing required identity, signing, or validity-window fields.',
    );
  }

  // Fingerprint consistency
  const derived = derivePublicKeyIdentity(publicKeyPem);
  const fingerprintConsistent = derived.fingerprint === certificate.signing.fingerprint;
  const expectedFingerprint = options.expectedFingerprint?.trim() || null;
  const expectedFingerprintMatch =
    expectedFingerprint === null || expectedFingerprint === derived.fingerprint;

  const nowMs = (options.now ?? new Date()).getTime();
  const clockSkewMs = Math.max(0, options.clockSkewMs ?? DEFAULT_CERTIFICATE_CLOCK_SKEW_MS);
  const expired = expiryBounded
    ? nowMs > notAfterMs + clockSkewMs || nowMs < notBeforeMs - clockSkewMs
    : false;
  const revokedCertificateIds = new Set(options.revokedCertificateIds ?? []);
  const revokedFingerprints = new Set(options.revokedFingerprints ?? []);
  const revoked =
    revokedCertificateIds.has(certificate.certificateId) ||
    revokedFingerprints.has(certificate.signing.fingerprint);

  // Signature verification: reconstruct the body (everything except signing) and verify
  const { signing: _signing, ...body } = certificate;
  const canonical = canonicalize(body);
  const signatureValid = verifySignature(canonical, certificate.signing.signature, publicKeyPem);

  const overall = revoked
    ? 'revoked'
    : expired
      ? 'expired'
      : signatureValid && fingerprintConsistent && expectedFingerprintMatch && schemaValid
        ? 'valid'
        : 'invalid';
  const explanation = overall === 'valid'
    ? `Certificate ${certificate.certificateId} is valid. Signed by ${certificate.signing.fingerprint} using Ed25519. Decision: ${certificate.decision}.`
    : `Certificate verification failed: signature=${signatureValid}, fingerprint=${fingerprintConsistent}, expected_fingerprint=${expectedFingerprintMatch}, schema=${schemaValid}, expired=${expired}, revoked=${revoked}`;

  return {
    signatureValid,
    fingerprintConsistent,
    expectedFingerprintMatch,
    expiryBounded,
    expired,
    revoked,
    schemaValid,
    overall,
    explanation,
  };
}
