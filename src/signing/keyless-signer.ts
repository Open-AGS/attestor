/**
 * Keyless Signer — Sigstore-inspired default signing path
 *
 * Makes PKI-backed signing the default instead of flat ephemeral keys.
 * Follows the Sigstore pattern: identity IS the credential.
 *
 * ARCHITECTURE (mirrors Sigstore/Fulcio):
 * 1. Generate ephemeral Ed25519 key pair (per-signing, never persisted)
 * 2. CA issues a short-lived leaf certificate binding key to identity
 * 3. Artifact signed with ephemeral key
 * 4. Trust chain (CA cert + leaf cert) attached to artifact
 * 5. Ephemeral private key discarded immediately after signing
 *
 * VERIFICATION:
 * Verifier needs only the CA public key (trust root) to verify:
 * - CA self-signature valid
 * - Leaf issued by CA
 * - Leaf not expired
 * - Artifact signature matches leaf key
 * - Certificate-to-leaf binding intact
 *
 * BOUNDARY:
 * - No external Fulcio/Rekor integration (yet)
 * - No transparency log (yet)
 * - Self-hosted CA hierarchy, not public PKI
 * - Short-lived certs (configurable, default 1 hour)
 */

import {
  generateKeyPair,
  type AttestorKeyPair,
} from './keys.js';
import {
  createCaCertificate,
  issueLeafCertificateForDuration,
  buildTrustChain,
  verifyTrustChain,
  type CaCertificate,
  type TrustChain,
  type ChainVerification,
} from './pki-chain.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KeylessSigner {
  /** The ephemeral signing key pair (destroyed after use in production). */
  signingKeyPair: AttestorKeyPair;
  /** The trust chain binding the ephemeral key to the CA. */
  trustChain: TrustChain;
  /** The CA's public key PEM for verification. */
  caPublicKeyPem: string;
  /** Identity that was bound to the leaf certificate. */
  boundIdentity: BoundIdentity;
  /** Leaf certificate validity in minutes. */
  leafValidityMinutes: number;
}

export interface BoundIdentity {
  /** Subject name on the leaf certificate. */
  subject: string;
  /** Role/purpose. */
  role: 'runtime_signer' | 'reviewer';
  /** Identity source. */
  source: 'ephemeral' | 'oidc_verified' | 'operator_asserted';
  /** Original identifier (email, sub, or CLI user). */
  identifier: string;
}

export interface KeylessSignerConfig {
  /** CA name. Default: 'Attestor Keyless CA'. */
  caName?: string;
  /** Leaf certificate validity in minutes. Default: 60. */
  leafValidityMinutes?: number;
  /** CA validity in days. Default: 365. */
  caValidityDays?: number;
}

export interface KeylessCaRuntimeConfiguration {
  readonly source: 'release-runtime-bootstrap';
  readonly caFingerprint: string;
  readonly alreadyConfigured: boolean;
  readonly replacedExisting: boolean;
  readonly replacementReason: string | null;
}

export interface ConfigureReleaseRuntimeKeylessCaOptions {
  readonly allowReplace?: boolean;
  readonly replacementReason?: string;
}

// ─── CA Singleton (per-process) ─────────────────────────────────────────────

let cachedCa: { keyPair: AttestorKeyPair; certificate: CaCertificate } | null = null;

function envTruthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function isProductionLikeRuntimeEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === 'production'
    || envTruthy(env.ATTESTOR_HA_MODE)
    || Boolean(env.ATTESTOR_PUBLIC_HOSTNAME?.trim())
    || Boolean(env.ATTESTOR_PUBLIC_BASE_URL?.trim());
}

function assertCaMatchesKeyPair(ca: { keyPair: AttestorKeyPair; certificate: CaCertificate }): void {
  if (ca.certificate.type !== 'attestor.ca_certificate.v1' || ca.certificate.isCA !== true) {
    throw new Error('Keyless CA runtime configuration requires an Attestor CA certificate.');
  }
  if (ca.certificate.publicKey !== ca.keyPair.publicKeyHex) {
    throw new Error('Keyless CA runtime configuration public key mismatch.');
  }
  if (ca.certificate.fingerprint !== ca.keyPair.fingerprint) {
    throw new Error('Keyless CA runtime configuration fingerprint mismatch.');
  }
}

export function configureReleaseRuntimeKeylessCa(
  ca: { keyPair: AttestorKeyPair; certificate: CaCertificate },
  options: ConfigureReleaseRuntimeKeylessCaOptions = {},
): KeylessCaRuntimeConfiguration {
  assertCaMatchesKeyPair(ca);
  const existingFingerprint = cachedCa?.certificate.fingerprint ?? null;
  if (existingFingerprint !== null && existingFingerprint !== ca.certificate.fingerprint) {
    if (options.allowReplace !== true) {
      throw new Error(
        `Refusing to replace configured keyless CA ${existingFingerprint} with ${ca.certificate.fingerprint} in-process.`,
      );
    }
    if (typeof options.replacementReason !== 'string' || options.replacementReason.trim().length === 0) {
      throw new Error('Keyless CA replacement requires a replacement reason.');
    }
  }
  cachedCa = ca;
  return Object.freeze({
    source: 'release-runtime-bootstrap',
    caFingerprint: ca.certificate.fingerprint,
    alreadyConfigured: existingFingerprint === ca.certificate.fingerprint,
    replacedExisting: existingFingerprint !== null && existingFingerprint !== ca.certificate.fingerprint,
    replacementReason:
      existingFingerprint !== null && existingFingerprint !== ca.certificate.fingerprint
        ? options.replacementReason!.trim()
        : null,
  });
}

function getOrCreateCa(config?: KeylessSignerConfig): { keyPair: AttestorKeyPair; certificate: CaCertificate } {
  if (!cachedCa) {
    if (isProductionLikeRuntimeEnv()) {
      throw new Error(
        'Keyless CA auto-generation is disabled in production-like runtime; configure the release-runtime keyless CA before creating keyless signers.',
      );
    }
    const caKeyPair = generateKeyPair();
    const caCert = createCaCertificate(
      config?.caName ?? 'Attestor Keyless CA',
      caKeyPair,
      config?.caValidityDays ?? 365,
    );
    cachedCa = { keyPair: caKeyPair, certificate: caCert };
  }
  return cachedCa;
}

/**
 * Reset CA for isolated tests. Production runtime code must configure the CA
 * through configureReleaseRuntimeKeylessCa instead of resetting the singleton.
 */
export function resetKeylessCaForTesting(testOnlyReason: string): void {
  if (isProductionLikeRuntimeEnv()) {
    throw new Error('resetKeylessCaForTesting is disabled in production-like runtime.');
  }
  if (!testOnlyReason.trim()) {
    throw new Error('resetKeylessCaForTesting requires a non-empty test-only reason.');
  }
  cachedCa = null;
}

// ─── Keyless Signer Creation ────────────────────────────────────────────────

/**
 * Create a keyless signer: ephemeral key + short-lived CA-issued leaf cert.
 *
 * This is the DEFAULT signing path. The ephemeral key should be discarded
 * after the signing operation completes.
 */
export function createKeylessSigner(
  identity: BoundIdentity,
  config?: KeylessSignerConfig,
): KeylessSigner {
  const ca = getOrCreateCa(config);
  const leafValidityMinutes = config?.leafValidityMinutes ?? 60;

  // Generate ephemeral key pair (will be discarded after signing)
  const signingKeyPair = generateKeyPair();

  // Issue short-lived leaf certificate
  const leafCert = issueLeafCertificateForDuration(
    identity.subject,
    identity.role,
    signingKeyPair,
    ca.keyPair,
    ca.certificate,
    leafValidityMinutes * 60 * 1000,
  );

  const trustChain = buildTrustChain(ca.certificate, leafCert);

  return {
    signingKeyPair,
    trustChain,
    caPublicKeyPem: ca.keyPair.publicKeyPem,
    boundIdentity: identity,
    leafValidityMinutes,
  };
}

/**
 * Create a keyless signer pair: one for runtime signing, one for reviewer.
 */
export function createKeylessSignerPair(
  signerIdentity?: Partial<BoundIdentity>,
  reviewerIdentity?: Partial<BoundIdentity>,
  config?: KeylessSignerConfig,
): { signer: KeylessSigner; reviewer: KeylessSigner } {
  const signer = createKeylessSigner({
    subject: signerIdentity?.subject ?? 'Runtime Signer',
    role: 'runtime_signer',
    source: signerIdentity?.source ?? 'ephemeral',
    identifier: signerIdentity?.identifier ?? 'keyless-runtime',
  }, config);

  const reviewer = createKeylessSigner({
    subject: reviewerIdentity?.subject ?? 'Reviewer',
    role: 'reviewer',
    source: reviewerIdentity?.source ?? 'ephemeral',
    identifier: reviewerIdentity?.identifier ?? 'keyless-reviewer',
  }, config);

  return { signer, reviewer };
}

/**
 * Verify a keyless signer's trust chain.
 */
export function verifyKeylessSigner(signer: KeylessSigner): ChainVerification {
  return verifyTrustChain(signer.trustChain, signer.caPublicKeyPem);
}
