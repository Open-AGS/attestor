import {
  verifyCertificate,
  type AttestationCertificate,
  type CertificateVerification,
  type VerifyCertificateOptions,
} from './certificate.js';
import { derivePublicKeyIdentity } from './keys.js';
import {
  verifyTrustChain,
  type ChainVerification,
  type TrustChain,
  type VerifyTrustChainOptions,
} from './pki-chain.js';

export const PKI_TRUST_BINDING_SPEC_VERSION = 'attestor.pki-trust-binding.v1';

export interface VerifyPkiBoundCertificateInput {
  readonly certificate: AttestationCertificate;
  readonly publicKeyPem: string;
  readonly trustChain: TrustChain;
  readonly caPublicKeyPem: string;
  readonly trustedCaFingerprint?: string | null;
  readonly allowKitContainedCaForDeveloperMode?: boolean;
  readonly now?: Date;
  readonly clockSkewMs?: number;
  readonly revokedCertificateIds?: readonly string[];
  readonly revokedFingerprints?: readonly string[];
}

export interface PkiTrustBindingVerification {
  readonly version: typeof PKI_TRUST_BINDING_SPEC_VERSION;
  readonly certificateVerification: CertificateVerification;
  readonly chainVerification: ChainVerification;
  readonly signerFingerprint: string;
  readonly caFingerprint: string;
  readonly expectedSignerFingerprint: string;
  readonly trustedCaFingerprint: string | null;
  readonly trustedCaFingerprintMatch: boolean;
  readonly independentTrustRootVerified: boolean;
  readonly kitContainedCaDeveloperMode: boolean;
  readonly leafMatchesCertificateKey: boolean;
  readonly leafMatchesCertificateFingerprint: boolean;
  readonly pkiBound: boolean;
  readonly pkiVerified: boolean;
  readonly failureReasons: readonly string[];
  readonly explanation: string;
}

function normalizeFingerprint(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function verifyPkiBoundCertificate(
  input: VerifyPkiBoundCertificateInput,
): PkiTrustBindingVerification {
  const trustedCaFingerprint = normalizeFingerprint(input.trustedCaFingerprint);
  const kitContainedCaDeveloperMode = input.allowKitContainedCaForDeveloperMode === true;
  const signerIdentity = derivePublicKeyIdentity(input.publicKeyPem);
  const caIdentity = derivePublicKeyIdentity(input.caPublicKeyPem);
  const chainOptions: VerifyTrustChainOptions = {
    now: input.now,
    clockSkewMs: input.clockSkewMs,
    revokedCertificateIds: input.revokedCertificateIds,
    revokedFingerprints: input.revokedFingerprints,
  };
  const certificateOptions: VerifyCertificateOptions = {
    now: input.now,
    clockSkewMs: input.clockSkewMs,
    expectedFingerprint: input.trustChain.leaf.subjectFingerprint,
    revokedCertificateIds: input.revokedCertificateIds,
    revokedFingerprints: input.revokedFingerprints,
  };

  const chainVerification = verifyTrustChain(input.trustChain, input.caPublicKeyPem, chainOptions);
  const certificateVerification = verifyCertificate(
    input.certificate,
    input.publicKeyPem,
    certificateOptions,
  );

  const leafMatchesCertificateKey =
    input.trustChain.leaf.subjectFingerprint === signerIdentity.fingerprint;
  const leafMatchesCertificateFingerprint =
    input.certificate.signing?.fingerprint === input.trustChain.leaf.subjectFingerprint;
  const trustedCaFingerprintProvided = trustedCaFingerprint !== null;
  const trustedCaFingerprintMatch =
    trustedCaFingerprintProvided &&
    (
      caIdentity.fingerprint.toLowerCase() === trustedCaFingerprint ||
      input.trustChain.ca.fingerprint.toLowerCase() === trustedCaFingerprint
    );
  const independentTrustRootVerified = trustedCaFingerprintMatch;
  const trustedCaSatisfied = trustedCaFingerprintMatch || kitContainedCaDeveloperMode;

  const pkiBound =
    chainVerification.overall === 'valid' &&
    leafMatchesCertificateKey &&
    leafMatchesCertificateFingerprint &&
    trustedCaSatisfied;
  const pkiVerified = certificateVerification.overall === 'valid' && pkiBound;
  const failureReasons: string[] = [];

  if (certificateVerification.overall !== 'valid') {
    failureReasons.push(`certificate-${certificateVerification.overall}`);
  }
  if (chainVerification.overall !== 'valid') {
    failureReasons.push(`chain-${chainVerification.overall}`);
  }
  if (!leafMatchesCertificateKey) {
    failureReasons.push('leaf-does-not-match-signer-public-key');
  }
  if (!leafMatchesCertificateFingerprint) {
    failureReasons.push('certificate-fingerprint-does-not-match-leaf');
  }
  if (!trustedCaFingerprintProvided && !kitContainedCaDeveloperMode) {
    failureReasons.push('trusted-ca-fingerprint-required');
  }
  if (!trustedCaFingerprintMatch) {
    if (trustedCaFingerprintProvided) {
      failureReasons.push('trusted-ca-fingerprint-mismatch');
    }
  }

  return Object.freeze({
    version: PKI_TRUST_BINDING_SPEC_VERSION,
    certificateVerification,
    chainVerification,
    signerFingerprint: signerIdentity.fingerprint,
    caFingerprint: caIdentity.fingerprint,
    expectedSignerFingerprint: input.trustChain.leaf.subjectFingerprint,
    trustedCaFingerprint,
    trustedCaFingerprintMatch,
    independentTrustRootVerified,
    kitContainedCaDeveloperMode,
    leafMatchesCertificateKey,
    leafMatchesCertificateFingerprint,
    pkiBound,
    pkiVerified,
    failureReasons: Object.freeze(failureReasons),
    explanation: pkiVerified && independentTrustRootVerified
      ? 'Certificate, trust chain, leaf binding, and trusted CA pin verified.'
      : pkiVerified
        ? 'Certificate, trust chain, and leaf binding verified in developer mode; independent trust root not established.'
      : `PKI trust binding failed: ${failureReasons.join(', ') || 'unknown'}`,
  });
}
