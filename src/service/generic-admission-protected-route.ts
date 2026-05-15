export const GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION =
  'attestor.generic-admission-protected-route.v1';

export const HOSTED_GENERIC_ADMISSION_ROUTE_ID = 'POST /api/v1/admissions';

export const GENERIC_ADMISSION_PROTECTED_ROUTE_REQUIRED_PROOFS = Object.freeze([
  'npm run test:generic-admission-protected-route',
  'npm run test:generic-admission-routes',
  'npm run test:generic-admission-protected-release-token',
  'GET /api/v1/ready',
] as const);

export type GenericAdmissionProtectedRouteState =
  | 'evaluation-protected-route-guarded'
  | 'evaluation-compatibility-accepted'
  | 'hosted-protected-route-blocked'
  | 'hosted-protected-route-ready';

export type GenericAdmissionProtectedRouteIssuerBoundary =
  | 'runtime-release-token-issuer'
  | 'external-kms-hsm'
  | 'missing';

export type GenericAdmissionProtectedRouteSenderConfirmationSource =
  | 'dpop-jkt'
  | 'mtls-certificate-thumbprint'
  | 'spiffe-id'
  | 'http-message-signature'
  | 'custom-verifier'
  | 'none';

export type GenericAdmissionProtectedRouteBlocker =
  | 'protected-route-requirement-disabled'
  | 'missing-issuer-not-fail-closed'
  | 'shadow-raw-token-storage-risk'
  | 'admission-or-shadow-raw-token-storage-risk'
  | 'raw-token-not-limited-to-immediate-caller'
  | 'protected-release-token-issuer-not-configured'
  | 'sender-confirmation-source-not-configured'
  | 'production-issuer-boundary-not-external';

export type GenericAdmissionProtectedRouteNoGoCondition =
  | 'hosted-route-issuer-missing'
  | 'sender-proof-verifier-missing'
  | 'customer-pep-not-proven'
  | 'durable-introspection-replay-store-not-proven'
  | 'live-production-deployment-not-proven';

export interface GenericAdmissionProtectedRouteEvaluation {
  readonly version: typeof GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION;
  readonly routeId: typeof HOSTED_GENERIC_ADMISSION_ROUTE_ID;
  readonly runtimeProfileId: string | null;
  readonly state: GenericAdmissionProtectedRouteState;
  readonly requireProtectedReleaseTokenForHighRisk: boolean;
  readonly protectedIssuerRequired: boolean;
  readonly issuerConfigured: boolean;
  readonly issuerBoundary: GenericAdmissionProtectedRouteIssuerBoundary;
  readonly senderConfirmationSource: GenericAdmissionProtectedRouteSenderConfirmationSource;
  readonly failClosedOnMissingIssuer: boolean;
  readonly compatibilityModeAllowed: boolean;
  readonly shadowRecordsRawToken: boolean;
  readonly admissionOrShadowStoresRawToken: boolean;
  readonly rawTokenReturnedOnlyToCaller: boolean;
  readonly protectedRouteGuardReady: boolean;
  readonly productionIssuerBoundaryReady: boolean;
  readonly readyForSelectedProfile: boolean;
  readonly productionReady: false;
  readonly activatesIssuer: boolean;
  readonly blockers: readonly GenericAdmissionProtectedRouteBlocker[];
  readonly noGoConditions: readonly GenericAdmissionProtectedRouteNoGoCondition[];
  readonly requiredProofs: readonly string[];
  readonly limitation: string;
}

export interface EvaluateGenericAdmissionProtectedRouteInput {
  readonly runtimeProfileId?: string | null;
  readonly requireProtectedReleaseTokenForHighRisk: boolean;
  readonly issuerConfigured: boolean;
  readonly issuerBoundary?: GenericAdmissionProtectedRouteIssuerBoundary | null;
  readonly senderConfirmationSource?: GenericAdmissionProtectedRouteSenderConfirmationSource | null;
  readonly failClosedOnMissingIssuer: boolean;
  readonly shadowRecordsRawToken?: boolean | null;
  readonly admissionOrShadowStoresRawToken?: boolean | null;
  readonly rawTokenReturnedOnlyToCaller?: boolean | null;
}

function normalizeRuntimeProfileId(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

export function evaluateGenericAdmissionProtectedRoute(
  input: EvaluateGenericAdmissionProtectedRouteInput,
): GenericAdmissionProtectedRouteEvaluation {
  const runtimeProfileId = normalizeRuntimeProfileId(input.runtimeProfileId);
  const productionSharedSelected = runtimeProfileId === 'production-shared';
  const issuerBoundary = input.issuerConfigured
    ? input.issuerBoundary ?? 'runtime-release-token-issuer'
    : 'missing';
  const senderConfirmationSource = input.senderConfirmationSource ?? 'none';
  const shadowRecordsRawToken = input.shadowRecordsRawToken === true;
  const admissionOrShadowStoresRawToken =
    input.admissionOrShadowStoresRawToken === true;
  const rawTokenReturnedOnlyToCaller =
    input.rawTokenReturnedOnlyToCaller ?? true;
  const protectedIssuerRequired =
    input.requireProtectedReleaseTokenForHighRisk === true;
  const protectedRouteGuardReady =
    protectedIssuerRequired &&
    input.failClosedOnMissingIssuer &&
    !shadowRecordsRawToken &&
    !admissionOrShadowStoresRawToken &&
    rawTokenReturnedOnlyToCaller;
  const issuerReady =
    input.issuerConfigured && senderConfirmationSource !== 'none';
  const productionIssuerBoundaryReady =
    !productionSharedSelected || issuerBoundary === 'external-kms-hsm';
  const readyForSelectedProfile = productionSharedSelected
    ? protectedRouteGuardReady && issuerReady && productionIssuerBoundaryReady
    : true;
  const state: GenericAdmissionProtectedRouteState = productionSharedSelected
    ? readyForSelectedProfile
      ? 'hosted-protected-route-ready'
      : 'hosted-protected-route-blocked'
    : protectedRouteGuardReady
      ? 'evaluation-protected-route-guarded'
      : 'evaluation-compatibility-accepted';

  const blockers: GenericAdmissionProtectedRouteBlocker[] = [];
  if (!protectedIssuerRequired) blockers.push('protected-route-requirement-disabled');
  if (!input.failClosedOnMissingIssuer) blockers.push('missing-issuer-not-fail-closed');
  if (shadowRecordsRawToken) blockers.push('shadow-raw-token-storage-risk');
  if (admissionOrShadowStoresRawToken) {
    blockers.push('admission-or-shadow-raw-token-storage-risk');
  }
  if (!rawTokenReturnedOnlyToCaller) {
    blockers.push('raw-token-not-limited-to-immediate-caller');
  }
  if (productionSharedSelected && !input.issuerConfigured) {
    blockers.push('protected-release-token-issuer-not-configured');
  }
  if (productionSharedSelected && senderConfirmationSource === 'none') {
    blockers.push('sender-confirmation-source-not-configured');
  }
  if (productionSharedSelected && issuerBoundary !== 'external-kms-hsm') {
    blockers.push('production-issuer-boundary-not-external');
  }

  const noGoConditions: GenericAdmissionProtectedRouteNoGoCondition[] = [
    'customer-pep-not-proven',
    'durable-introspection-replay-store-not-proven',
    'live-production-deployment-not-proven',
  ];
  if (!input.issuerConfigured) noGoConditions.push('hosted-route-issuer-missing');
  if (senderConfirmationSource === 'none') {
    noGoConditions.push('sender-proof-verifier-missing');
  }

  return Object.freeze({
    version: GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION,
    routeId: HOSTED_GENERIC_ADMISSION_ROUTE_ID,
    runtimeProfileId,
    state,
    requireProtectedReleaseTokenForHighRisk:
      input.requireProtectedReleaseTokenForHighRisk,
    protectedIssuerRequired,
    issuerConfigured: input.issuerConfigured,
    issuerBoundary,
    senderConfirmationSource,
    failClosedOnMissingIssuer: input.failClosedOnMissingIssuer,
    compatibilityModeAllowed: !protectedIssuerRequired,
    shadowRecordsRawToken,
    admissionOrShadowStoresRawToken,
    rawTokenReturnedOnlyToCaller,
    protectedRouteGuardReady,
    productionIssuerBoundaryReady,
    readyForSelectedProfile,
    productionReady: false,
    activatesIssuer: input.issuerConfigured,
    blockers: unique(blockers),
    noGoConditions: unique(noGoConditions),
    requiredProofs: GENERIC_ADMISSION_PROTECTED_ROUTE_REQUIRED_PROOFS,
    limitation:
      'This proves hosted route fail-closed configuration for protected high-risk generic admissions, not a live authorization server, customer PEP deployment, external KMS/HSM signer, durable replay/introspection backend, or production deployment.',
  });
}
