import type { Hono } from 'hono';
import type {
  AttestationCertificate,
  CertificateVerification,
  VerifyCertificateOptions,
} from '../../../signing/certificate.js';
import type {
  ChainVerification,
  TrustChain,
  VerifyTrustChainOptions,
} from '../../../signing/pki-chain.js';
import { verifyPkiBoundCertificate } from '../../../signing/verification-trust-binding.js';
import { logger } from '../../../utils/logger.js';
import { publicRouteRateLimitResponse } from '../../public-route-rate-limit.js';
import {
  clientSafeInternalError,
  clientSafeProblemDetail,
  routeErrorKind,
} from '../route-response-helpers.js';

interface PublicKeyIdentity {
  publicKeyHex: string;
  fingerprint: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function verifyRequestSummary(body: unknown): Record<string, boolean | string> {
  const record = isRecord(body) ? body : {};
  return {
    route: '/api/v1/verify',
    bodyShape: isRecord(body) ? 'object' : typeof body,
    hasCertificate: isRecord(record.certificate),
    hasPublicKeyPem: hasNonEmptyString(record.publicKeyPem),
    hasTrustChain: isRecord(record.trustChain),
    hasCaPublicKeyPem: hasNonEmptyString(record.caPublicKeyPem),
    hasTrustedCaFingerprint: hasNonEmptyString(record.trustedCaFingerprint),
  };
}

function logVerifyRejection(reasonCode: string, body: unknown): void {
  logger.warn('api.verify', 'Verification request rejected before PKI verification', {
    reasonCode,
    ...verifyRequestSummary(body),
  });
}

interface VerifyRequestBody {
  certificate?: unknown;
  publicKeyPem?: unknown;
  trustChain?: unknown;
  caPublicKeyPem?: unknown;
  trustedCaFingerprint?: unknown;
}

export interface PipelineVerificationRoutesDeps {
  verifyCertificate(
    certificate: AttestationCertificate,
    publicKeyPem: string,
    options?: VerifyCertificateOptions,
  ): CertificateVerification;
  verifyTrustChain(
    chain: TrustChain,
    caPublicKeyPem: string,
    options?: VerifyTrustChainOptions,
  ): ChainVerification;
  derivePublicKeyIdentity(publicKeyPem: string): PublicKeyIdentity;
}

export function registerPipelineVerificationRoutes(app: Hono, deps: PipelineVerificationRoutesDeps): void {
  const {
    verifyCertificate,
  } = deps;


// Verify Certificate

app.post('/api/v1/verify', async (c) => {
  const rateLimitResponse = publicRouteRateLimitResponse(c, {
    scope: 'verify',
    envVar: 'ATTESTOR_VERIFY_RATE_LIMIT_PER_MINUTE',
    defaultLimit: 120,
    maxLimit: 50_000,
    errorMessage: 'Verification route rate limit exceeded.',
    resetHeaderName: 'x-attestor-verify-rate-limit-reset-at',
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(clientSafeProblemDetail(
        'invalid_request',
        'Request body must be valid JSON.',
      ), 400);
    }
    const payload: VerifyRequestBody = isRecord(body) ? body : {};
    const {
      certificate,
      publicKeyPem,
      trustChain,
      caPublicKeyPem,
      trustedCaFingerprint,
    } = payload;
    if (!isRecord(certificate) || !hasNonEmptyString(publicKeyPem)) {
      return c.json({ error: 'certificate and publicKeyPem are required' }, 400);
    }

    // PKI mandatory gate: reject flat Ed25519 on the hosted API.
    const hasPkiMaterial =
      isRecord(trustChain) &&
      isRecord(trustChain.ca) &&
      isRecord(trustChain.leaf) &&
      hasNonEmptyString(caPublicKeyPem);
    if (!hasPkiMaterial) {
      logVerifyRejection('missing-pki-chain-material', body);
      return c.json({
        error: 'PKI trust chain required for verification.',
        hint: 'Submit trustChain and caPublicKeyPem alongside certificate and publicKeyPem.',
      }, 422);
    }
    const normalizedTrustedCaFingerprint =
      typeof trustedCaFingerprint === 'string' && trustedCaFingerprint.trim().length > 0
        ? trustedCaFingerprint.trim()
        : null;
    if (hasPkiMaterial && !normalizedTrustedCaFingerprint) {
      logVerifyRejection('missing-trusted-ca-fingerprint', body);
      return c.json({
        error: 'trustedCaFingerprint is required for independent PKI verification.',
        hint: 'Submit trustedCaFingerprint from an out-of-band trusted source alongside trustChain and caPublicKeyPem.',
      }, 422);
    }

    // 1. Verify PKI trust chain if provided
    let chainVerification = null;
    let pkiBound = false;
    let expectedFingerprint: string | null = null;
    let certResult: CertificateVerification | null = null;
    if (hasPkiMaterial) {
      const pkiTrustChain = trustChain as unknown as TrustChain;
      const pkiCaPublicKeyPem = caPublicKeyPem as string;
      const trustBinding = verifyPkiBoundCertificate({
        certificate: certificate as unknown as AttestationCertificate,
        publicKeyPem,
        trustChain: pkiTrustChain,
        caPublicKeyPem: pkiCaPublicKeyPem,
        trustedCaFingerprint: normalizedTrustedCaFingerprint,
      });
      const chainResult = trustBinding.chainVerification;
      expectedFingerprint = pkiTrustChain.leaf.subjectFingerprint;
      pkiBound = trustBinding.pkiBound;
      certResult = trustBinding.certificateVerification;

      chainVerification = {
        caValid: chainResult.caValid,
        leafValid: chainResult.leafValid,
        chainIntact: chainResult.chainIntact,
        issuerMatch: chainResult.issuerMatch,
        caExpired: chainResult.caExpired,
        leafExpired: chainResult.leafExpired,
        caRevoked: chainResult.caRevoked,
        leafRevoked: chainResult.leafRevoked,
        // Certificate-to-leaf binding
        leafMatchesCertificateKey: trustBinding.leafMatchesCertificateKey,
        leafMatchesCertificateFingerprint: trustBinding.leafMatchesCertificateFingerprint,
        trustedCaFingerprintMatch: trustBinding.trustedCaFingerprintMatch,
        independentTrustRootVerified: trustBinding.independentTrustRootVerified,
        pkiBound,
        overall: chainResult.overall,
        caName: pkiTrustChain.ca.name ?? null,
        leafSubject: pkiTrustChain.leaf.subject ?? null,
      };
    }

    // 3. Verify certificate signature with PKI-derived signer pin when available.
    certResult ??= verifyCertificate(certificate as unknown as AttestationCertificate, publicKeyPem, {
      expectedFingerprint,
    });

    // 4. Structured verification scope summary
    const pkiVerified = certResult.overall === 'valid' && pkiBound;
    const verificationMode = chainVerification ? 'pki' as const : 'legacy_ed25519' as const;
    const overall = verificationMode === 'pki' && !pkiVerified ? 'invalid' : certResult.overall;
    const explanation = verificationMode === 'pki' && !pkiVerified
      ? `PKI trust binding failed: certificate=${certResult.overall}, chain=${chainVerification?.overall ?? 'missing'}, pki_bound=${pkiBound}`
      : certResult.explanation;
    const trustBinding = {
      certificateSignature: certResult.signatureValid && certResult.fingerprintConsistent,
      chainValid: chainVerification?.chainIntact ?? false,
      certificateBoundToLeaf: pkiBound,
      pkiVerified,
    };

    return c.json({
      signatureValid: certResult.signatureValid,
      fingerprintConsistent: certResult.fingerprintConsistent,
      schemaValid: certResult.schemaValid,
      overall,
      explanation,
      verificationMode,
      deprecationNotice: null,
      chainVerification,
      trustBinding,
    });
  } catch (err) {
    logger.error('api.verify', 'Verification route failed with a redacted client response', {
      route: '/api/v1/verify',
      errorKind: routeErrorKind(err),
    });
    return c.json(clientSafeInternalError('Verification failed.'), 500);
  }
});
}
