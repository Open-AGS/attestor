import type {
  ReleaseTokenConfirmationClaim,
} from '../release-layer/index.js';
import {
  DPOP_PRESENTATION_SPEC_VERSION,
  verifyDpopProof,
  type DpopProofVerification,
} from '../release-enforcement-plane/dpop.js';

export const HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION =
  'attestor.hosted-generic-admission-sender-confirmation.v1';

export type HostedGenericAdmissionSenderConfirmationStatus =
  | 'valid'
  | 'missing'
  | 'invalid';

export interface HostedGenericAdmissionDpopSenderConfirmation {
  readonly version: typeof HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION;
  readonly dpopVersion: typeof DPOP_PRESENTATION_SPEC_VERSION;
  readonly status: HostedGenericAdmissionSenderConfirmationStatus;
  readonly source: 'dpop-jkt' | 'none';
  readonly confirmation: ReleaseTokenConfirmationClaim | null;
  readonly proofJti: string | null;
  readonly publicKeyThumbprint: string | null;
  readonly rawProofStored: false;
  readonly failureReasons: readonly string[];
  readonly reasonCodes: readonly string[];
}

export interface ResolveHostedGenericAdmissionDpopSenderConfirmationInput {
  readonly proofJwt?: string | null;
  readonly httpMethod: string;
  readonly httpUri: string;
  readonly now: string;
}

function normalizedHeader(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resultFromVerification(
  verification: DpopProofVerification,
): HostedGenericAdmissionDpopSenderConfirmation {
  if (verification.status !== 'valid' || verification.publicKeyThumbprint === null) {
    return Object.freeze({
      version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
      dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
      status: 'invalid',
      source: 'none',
      confirmation: null,
      proofJti: verification.proofJti,
      publicKeyThumbprint: verification.publicKeyThumbprint,
      rawProofStored: false,
      failureReasons: verification.failureReasons,
      reasonCodes: Object.freeze([
        'hosted-generic-admission-dpop-invalid',
        ...verification.failureReasons.map((reason) => `dpop-${reason}`),
      ]),
    });
  }

  return Object.freeze({
    version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
    dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
    status: 'valid',
    source: 'dpop-jkt',
    confirmation: Object.freeze({ jkt: verification.publicKeyThumbprint }),
    proofJti: verification.proofJti,
    publicKeyThumbprint: verification.publicKeyThumbprint,
    rawProofStored: false,
    failureReasons: Object.freeze([]),
    reasonCodes: Object.freeze(['hosted-generic-admission-dpop-valid']),
  });
}

export async function resolveHostedGenericAdmissionDpopSenderConfirmation(
  input: ResolveHostedGenericAdmissionDpopSenderConfirmationInput,
): Promise<HostedGenericAdmissionDpopSenderConfirmation> {
  const proofJwt = normalizedHeader(input.proofJwt);
  if (proofJwt === null) {
    return Object.freeze({
      version: HOSTED_GENERIC_ADMISSION_SENDER_CONFIRMATION_SPEC_VERSION,
      dpopVersion: DPOP_PRESENTATION_SPEC_VERSION,
      status: 'missing',
      source: 'none',
      confirmation: null,
      proofJti: null,
      publicKeyThumbprint: null,
      rawProofStored: false,
      failureReasons: Object.freeze(['missing-dpop-proof']),
      reasonCodes: Object.freeze(['hosted-generic-admission-dpop-missing']),
    });
  }

  const verification = await verifyDpopProof({
    proofJwt,
    httpMethod: input.httpMethod,
    httpUri: input.httpUri,
    now: input.now,
  });
  return resultFromVerification(verification);
}
