export const GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION =
  'attestor.generic-admission-protected-route.v1';

export const HOSTED_GENERIC_ADMISSION_ROUTE_ID = 'POST /api/v1/admissions';

export const GENERIC_ADMISSION_PROTECTED_ROUTE_REQUIRED_PROOFS = Object.freeze([
  'npm run test:generic-admission-protected-route',
  'npm run test:hosted-generic-admission-sender-confirmation',
  'npm run test:release-enforcement-plane-dpop',
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

export type GenericAdmissionProtectedRouteIssuerBoundaryEvidenceSource =
  | 'runtime-signing-provider-diagnostics'
  | 'release-tenant-signer-boundary-descriptor'
  | 'none';

export type GenericAdmissionProtectedRouteIssuerLiveProofState =
  | 'not-provided'
  | 'valid'
  | 'invalid'
  | 'stale';

export type GenericAdmissionProtectedRouteAuthorityStoreDurability =
  | 'shared'
  | 'local'
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
  | 'production-issuer-boundary-not-external'
  | 'external-issuer-boundary-proof-missing'
  | 'external-issuer-boundary-proof-mismatch'
  | 'external-issuer-boundary-proof-not-production-ready'
  | 'external-issuer-live-provider-proof-not-valid'
  | 'external-issuer-provider-response-storage-risk'
  | 'token-introspection-store-not-configured'
  | 'replay-consumption-store-not-configured'
  | 'sender-proof-replay-store-not-configured'
  | 'production-token-introspection-store-not-shared'
  | 'production-replay-consumption-store-not-shared'
  | 'production-sender-proof-replay-store-not-shared';

export type GenericAdmissionProtectedRouteNoGoCondition =
  | 'hosted-route-issuer-missing'
  | 'sender-proof-verifier-missing'
  | 'sender-proof-replay-store-not-proven'
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
  readonly issuerBoundaryEvidenceSource: GenericAdmissionProtectedRouteIssuerBoundaryEvidenceSource;
  readonly externalIssuerLiveProviderVerified: boolean;
  readonly tokenIntrospectionStoreConfigured: boolean;
  readonly tokenIntrospectionStoreDurability: GenericAdmissionProtectedRouteAuthorityStoreDurability;
  readonly replayConsumptionStoreConfigured: boolean;
  readonly replayConsumptionStoreDurability: GenericAdmissionProtectedRouteAuthorityStoreDurability;
  readonly tokenIntrospectionStoreReady: boolean;
  readonly replayConsumptionStoreReady: boolean;
  readonly senderConfirmationSource: GenericAdmissionProtectedRouteSenderConfirmationSource;
  readonly senderProofReplayRequired: boolean;
  readonly senderProofReplayStoreConfigured: boolean;
  readonly senderProofReplayStoreDurability: GenericAdmissionProtectedRouteAuthorityStoreDurability;
  readonly senderProofReplayStoreReady: boolean;
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

export interface GenericAdmissionProtectedRouteIssuerBoundaryEvidence {
  readonly source: Exclude<
    GenericAdmissionProtectedRouteIssuerBoundaryEvidenceSource,
    'none'
  >;
  readonly issuerBoundary: GenericAdmissionProtectedRouteIssuerBoundary;
  readonly productionReady: boolean;
  readonly liveProviderVerified: boolean;
  readonly liveProviderProofState: GenericAdmissionProtectedRouteIssuerLiveProofState;
  readonly proofDigest?: string | null;
  readonly rawProviderResponseStored: false;
}

export interface EvaluateGenericAdmissionProtectedRouteInput {
  readonly runtimeProfileId?: string | null;
  readonly requireProtectedReleaseTokenForHighRisk: boolean;
  readonly issuerConfigured: boolean;
  readonly issuerBoundary?: GenericAdmissionProtectedRouteIssuerBoundary | null;
  readonly issuerBoundaryEvidence?: GenericAdmissionProtectedRouteIssuerBoundaryEvidence | null;
  readonly tokenIntrospectionStoreConfigured?: boolean | null;
  readonly tokenIntrospectionStoreDurability?: GenericAdmissionProtectedRouteAuthorityStoreDurability | null;
  readonly replayConsumptionStoreConfigured?: boolean | null;
  readonly replayConsumptionStoreDurability?: GenericAdmissionProtectedRouteAuthorityStoreDurability | null;
  readonly senderConfirmationSource?: GenericAdmissionProtectedRouteSenderConfirmationSource | null;
  readonly senderProofReplayStoreConfigured?: boolean | null;
  readonly senderProofReplayStoreDurability?: GenericAdmissionProtectedRouteAuthorityStoreDurability | null;
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
  const issuerBoundaryEvidence = input.issuerBoundaryEvidence ?? null;
  const externalIssuerEvidenceReady =
    issuerBoundary === 'external-kms-hsm' &&
    issuerBoundaryEvidence !== null &&
    issuerBoundaryEvidence.issuerBoundary === 'external-kms-hsm' &&
    issuerBoundaryEvidence.productionReady &&
    issuerBoundaryEvidence.liveProviderVerified &&
    issuerBoundaryEvidence.liveProviderProofState === 'valid' &&
    issuerBoundaryEvidence.rawProviderResponseStored === false;
  const tokenIntrospectionStoreConfigured =
    input.tokenIntrospectionStoreConfigured === true;
  const tokenIntrospectionStoreDurability =
    tokenIntrospectionStoreConfigured
      ? input.tokenIntrospectionStoreDurability ?? 'local'
      : 'missing';
  const replayConsumptionStoreConfigured =
    input.replayConsumptionStoreConfigured === true;
  const replayConsumptionStoreDurability =
    replayConsumptionStoreConfigured
      ? input.replayConsumptionStoreDurability ?? 'local'
      : 'missing';
  const tokenIntrospectionStoreReady =
    tokenIntrospectionStoreConfigured &&
    (!productionSharedSelected || tokenIntrospectionStoreDurability === 'shared');
  const replayConsumptionStoreReady =
    replayConsumptionStoreConfigured &&
    (!productionSharedSelected || replayConsumptionStoreDurability === 'shared');
  const senderConfirmationSource = input.senderConfirmationSource ?? 'none';
  const senderProofReplayRequired = senderConfirmationSource === 'dpop-jkt';
  const senderProofReplayStoreConfigured =
    input.senderProofReplayStoreConfigured === true;
  const senderProofReplayStoreDurability =
    senderProofReplayStoreConfigured
      ? input.senderProofReplayStoreDurability ?? 'local'
      : 'missing';
  const senderProofReplayStoreReady =
    !senderProofReplayRequired ||
    (senderProofReplayStoreConfigured &&
      (!productionSharedSelected || senderProofReplayStoreDurability === 'shared'));
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
    !productionSharedSelected || externalIssuerEvidenceReady;
  const readyForSelectedProfile = productionSharedSelected
    ? protectedRouteGuardReady &&
      issuerReady &&
      productionIssuerBoundaryReady &&
      tokenIntrospectionStoreReady &&
      replayConsumptionStoreReady &&
      senderProofReplayStoreReady
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
  if (!tokenIntrospectionStoreConfigured) {
    blockers.push('token-introspection-store-not-configured');
  }
  if (!replayConsumptionStoreConfigured) {
    blockers.push('replay-consumption-store-not-configured');
  }
  if (senderProofReplayRequired && !senderProofReplayStoreConfigured) {
    blockers.push('sender-proof-replay-store-not-configured');
  }
  if (productionSharedSelected && issuerBoundary !== 'external-kms-hsm') {
    blockers.push('production-issuer-boundary-not-external');
  }
  if (
    productionSharedSelected &&
    tokenIntrospectionStoreConfigured &&
    tokenIntrospectionStoreDurability !== 'shared'
  ) {
    blockers.push('production-token-introspection-store-not-shared');
  }
  if (
    productionSharedSelected &&
    replayConsumptionStoreConfigured &&
    replayConsumptionStoreDurability !== 'shared'
  ) {
    blockers.push('production-replay-consumption-store-not-shared');
  }
  if (
    productionSharedSelected &&
    senderProofReplayRequired &&
    senderProofReplayStoreConfigured &&
    senderProofReplayStoreDurability !== 'shared'
  ) {
    blockers.push('production-sender-proof-replay-store-not-shared');
  }
  if (productionSharedSelected && issuerBoundary === 'external-kms-hsm') {
    if (issuerBoundaryEvidence === null) {
      blockers.push('external-issuer-boundary-proof-missing');
    } else {
      if (issuerBoundaryEvidence.issuerBoundary !== 'external-kms-hsm') {
        blockers.push('external-issuer-boundary-proof-mismatch');
      }
      if (!issuerBoundaryEvidence.productionReady) {
        blockers.push('external-issuer-boundary-proof-not-production-ready');
      }
      if (
        !issuerBoundaryEvidence.liveProviderVerified ||
        issuerBoundaryEvidence.liveProviderProofState !== 'valid'
      ) {
        blockers.push('external-issuer-live-provider-proof-not-valid');
      }
      if (issuerBoundaryEvidence.rawProviderResponseStored !== false) {
        blockers.push('external-issuer-provider-response-storage-risk');
      }
    }
  }

  const noGoConditions: GenericAdmissionProtectedRouteNoGoCondition[] = [
    'customer-pep-not-proven',
    'live-production-deployment-not-proven',
  ];
  if (!tokenIntrospectionStoreReady || !replayConsumptionStoreReady) {
    noGoConditions.push('durable-introspection-replay-store-not-proven');
  }
  if (!senderProofReplayStoreReady) {
    noGoConditions.push('sender-proof-replay-store-not-proven');
  }
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
    issuerBoundaryEvidenceSource: issuerBoundaryEvidence?.source ?? 'none',
    externalIssuerLiveProviderVerified:
      issuerBoundaryEvidence?.liveProviderVerified ?? false,
    tokenIntrospectionStoreConfigured,
    tokenIntrospectionStoreDurability,
    replayConsumptionStoreConfigured,
    replayConsumptionStoreDurability,
    tokenIntrospectionStoreReady,
    replayConsumptionStoreReady,
    senderConfirmationSource,
    senderProofReplayRequired,
    senderProofReplayStoreConfigured,
    senderProofReplayStoreDurability,
    senderProofReplayStoreReady,
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
      'This proves hosted route fail-closed configuration and repository-side introspection/token-use replay readiness for protected high-risk generic admissions. DPoP sender-proof replay needs a separate shared proof replay store before production-shared readiness can clear. This is not a live authorization server, customer PEP deployment, external KMS/HSM signer adapter, or production deployment.',
  });
}
