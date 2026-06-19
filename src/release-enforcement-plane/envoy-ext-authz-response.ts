import {
  createEnforcementDecision,
  createEnforcementReceipt,
  createEnforcementReceiptDigest,
  type EnforcementDecision,
  type EnforcementReceipt,
  type EnforcementRequest,
  type ReleasePresentation,
  type VerificationResult,
} from './object-model.js';
import type { OfflineReleaseVerification } from './offline-verifier.js';
import type { OnlineReleaseVerification } from './online-verifier.js';
import {
  ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER,
  ATTESTOR_RELEASE_TOKEN_HEADER,
} from './middleware.js';
import type { EnforcementFailureReason } from './types.js';
import {
  ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER,
  ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER,
  ENVOY_EXT_AUTHZ_DYNAMIC_METADATA_NAMESPACE,
  GRPC_STATUS_ABORTED,
  GRPC_STATUS_FAILED_PRECONDITION,
  GRPC_STATUS_OK,
  GRPC_STATUS_PERMISSION_DENIED,
  GRPC_STATUS_UNAUTHENTICATED,
  GRPC_STATUS_UNAVAILABLE,
  RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
  type EnvoyExtAuthzBridgeResult,
  type EnvoyExtAuthzBridgeStatus,
  type EnvoyExtAuthzCanonicalBinding,
  type EnvoyExtAuthzCheckResponse,
  type EnvoyExtAuthzHeaderValueOption,
  type EnvoyExtAuthzHttpServiceResponse,
  type EnvoyExtAuthzMetadata,
} from './envoy-ext-authz-types.js';
import { uniqueFailureReasons } from './envoy-ext-authz-utils.js';

function responseStatusForFailures(failureReasons: readonly EnforcementFailureReason[]): number {
  if (failureReasons.includes('missing-release-authorization')) {
    return 401;
  }
  if (failureReasons.includes('introspection-unavailable')) {
    return 503;
  }
  if (failureReasons.includes('replayed-authorization')) {
    return 409;
  }
  if (
    failureReasons.includes('fresh-introspection-required') &&
    failureReasons.every((reason) => reason === 'fresh-introspection-required')
  ) {
    return 428;
  }
  return 403;
}

function grpcStatusForFailures(failureReasons: readonly EnforcementFailureReason[]): number {
  if (failureReasons.includes('missing-release-authorization')) {
    return GRPC_STATUS_UNAUTHENTICATED;
  }
  if (failureReasons.includes('introspection-unavailable')) {
    return GRPC_STATUS_UNAVAILABLE;
  }
  if (failureReasons.includes('replayed-authorization')) {
    return GRPC_STATUS_ABORTED;
  }
  if (failureReasons.includes('fresh-introspection-required')) {
    return GRPC_STATUS_FAILED_PRECONDITION;
  }
  return GRPC_STATUS_PERMISSION_DENIED;
}

function bridgeFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const unique = uniqueFailureReasons(reasons);
  const hasHardFailure = unique.some(
    (reason) => reason !== 'fresh-introspection-required' && reason !== 'introspection-unavailable',
  );
  return hasHardFailure
    ? uniqueFailureReasons(unique.filter((reason) => reason !== 'fresh-introspection-required'))
    : unique;
}

function header(key: string, value: string): EnvoyExtAuthzHeaderValueOption {
  return Object.freeze({
    header: Object.freeze({ key, value }),
  });
}

function dynamicMetadata(result: {
  readonly status: EnvoyExtAuthzBridgeStatus;
  readonly checkedAt: string;
  readonly request: EnforcementRequest | null;
  readonly receipt: EnforcementReceipt | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly binding: EnvoyExtAuthzCanonicalBinding | null;
}): EnvoyExtAuthzMetadata {
  return Object.freeze({
    [ENVOY_EXT_AUTHZ_DYNAMIC_METADATA_NAMESPACE]: Object.freeze({
      version: RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
      status: result.status,
      checked_at: result.checkedAt,
      request_id: result.request?.id ?? null,
      target_id: result.binding?.target.id ?? null,
      output_hash: result.binding?.hashBundle.outputHash ?? null,
      consequence_hash: result.binding?.hashBundle.consequenceHash ?? null,
      receipt_digest: result.receipt?.receiptDigest ?? null,
      failure_reasons: result.failureReasons,
    }),
  });
}

function deniedBody(input: {
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
  readonly request: EnforcementRequest | null;
  readonly verificationResult: VerificationResult | null;
}): string {
  return JSON.stringify({
    version: RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
    status: 'denied',
    checkedAt: input.checkedAt,
    failureReasons: input.failureReasons,
    responseStatus: input.responseStatus,
    requestId: input.request?.id ?? null,
    verificationStatus: input.verificationResult?.status ?? null,
  });
}

function deniedHeaders(
  failureReasons: readonly EnforcementFailureReason[],
): readonly EnvoyExtAuthzHeaderValueOption[] {
  const headers = [
    header('cache-control', 'no-store'),
    header('content-type', 'application/json; charset=utf-8'),
    header(ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER, 'denied'),
  ];
  if (failureReasons.includes('missing-release-authorization')) {
    headers.push(
      header(
        'www-authenticate',
        'Bearer realm="attestor-release", error="invalid_token", error_description="Attestor release authorization is required"',
      ),
    );
  }
  return Object.freeze(headers);
}

function checkResponseForResult(input: {
  readonly status: EnvoyExtAuthzBridgeStatus;
  readonly checkedAt: string;
  readonly request: EnforcementRequest | null;
  readonly receipt: EnforcementReceipt | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus: number;
  readonly verificationResult: VerificationResult | null;
  readonly binding: EnvoyExtAuthzCanonicalBinding | null;
  readonly removeCredentialsOnAllow: boolean;
}): EnvoyExtAuthzCheckResponse {
  const metadata = dynamicMetadata(input);
  if (input.status === 'allowed') {
    return Object.freeze({
      status: Object.freeze({ code: GRPC_STATUS_OK, message: 'allowed' }),
      ok_response: Object.freeze({
        headers: Object.freeze([
          header(ATTESTOR_PROXY_ENFORCEMENT_STATUS_HEADER, 'allowed'),
          ...(input.request ? [header(ATTESTOR_ENFORCEMENT_REQUEST_ID_HEADER, input.request.id)] : []),
          ...(input.receipt?.receiptDigest
            ? [header(ATTESTOR_PROXY_ENFORCEMENT_RECEIPT_DIGEST_HEADER, input.receipt.receiptDigest)]
            : []),
        ]),
        headers_to_remove: input.removeCredentialsOnAllow
          ? Object.freeze(['authorization', 'dpop', ATTESTOR_RELEASE_TOKEN_HEADER])
          : Object.freeze([]),
        dynamic_metadata: metadata,
      }),
      dynamic_metadata: metadata,
    });
  }

  return Object.freeze({
    status: Object.freeze({
      code: grpcStatusForFailures(input.failureReasons),
      message: input.failureReasons.join(', '),
    }),
    denied_response: Object.freeze({
      status: Object.freeze({ code: input.responseStatus }),
      headers: deniedHeaders(input.failureReasons),
      body: deniedBody(input),
    }),
    dynamic_metadata: metadata,
  });
}

function httpResponseForCheckResponse(
  checkResponse: EnvoyExtAuthzCheckResponse,
): EnvoyExtAuthzHttpServiceResponse {
  if (checkResponse.status.code === GRPC_STATUS_OK) {
    return Object.freeze({
      status: 200,
      headers: Object.freeze(
        Object.fromEntries(
          (checkResponse.ok_response?.headers ?? []).map((entry) => [
            entry.header.key,
            entry.header.value,
          ]),
        ),
      ),
      body: '',
    });
  }

  return Object.freeze({
    status: checkResponse.denied_response?.status.code ?? 403,
    headers: Object.freeze(
      Object.fromEntries(
        (checkResponse.denied_response?.headers ?? []).map((entry) => [
          entry.header.key,
          entry.header.value,
        ]),
      ),
    ),
    body: checkResponse.denied_response?.body ?? '',
  });
}

function decisionAndReceipt(input: {
  readonly request: EnforcementRequest;
  readonly verification: VerificationResult;
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
}): {
  readonly decision: EnforcementDecision;
  readonly receipt: EnforcementReceipt;
} {
  const decision = createEnforcementDecision({
    id: `ed_envoy_ext_authz_${input.request.id}`,
    request: input.request,
    decidedAt: input.checkedAt,
    verification: input.verification,
    failureReasons: input.failureReasons,
  });
  const receipt = createEnforcementReceipt({
    id: `er_envoy_ext_authz_${input.request.id}`,
    issuedAt: input.checkedAt,
    decision,
    receiptDigest: createEnforcementReceiptDigest({ decision }),
  });

  return { decision, receipt };
}

export function bridgeResult(input: {
  readonly status: EnvoyExtAuthzBridgeStatus;
  readonly checkedAt: string;
  readonly binding: EnvoyExtAuthzCanonicalBinding | null;
  readonly request: EnforcementRequest | null;
  readonly presentation: ReleasePresentation | null;
  readonly verificationResult: VerificationResult | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly decision: EnforcementDecision | null;
  readonly receipt: EnforcementReceipt | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly removeCredentialsOnAllow: boolean;
}): EnvoyExtAuthzBridgeResult {
  const failureReasons = uniqueFailureReasons(input.failureReasons);
  const responseStatus = input.status === 'allowed' ? 200 : responseStatusForFailures(failureReasons);
  const checkResponse = checkResponseForResult({
    ...input,
    failureReasons,
    responseStatus,
  });
  return Object.freeze({
    version: RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
    status: input.status,
    checkedAt: input.checkedAt,
    binding: input.binding,
    request: input.request,
    presentation: input.presentation,
    verificationResult: input.verificationResult,
    offline: input.offline,
    online: input.online,
    decision: input.decision,
    receipt: input.receipt,
    failureReasons,
    responseStatus,
    checkResponse,
    httpResponse: httpResponseForCheckResponse(checkResponse),
  });
}

export function resultFromVerification(input: {
  readonly checkedAt: string;
  readonly binding: EnvoyExtAuthzCanonicalBinding;
  readonly request: EnforcementRequest;
  readonly presentation: ReleasePresentation;
  readonly offline: OfflineReleaseVerification | null;
  readonly online: OnlineReleaseVerification | null;
  readonly removeCredentialsOnAllow: boolean;
}): EnvoyExtAuthzBridgeResult {
  const verificationResult =
    input.online?.verificationResult ?? input.offline?.verificationResult ?? null;
  if (verificationResult === null) {
    return bridgeResult({
      ...input,
      status: 'denied',
      verificationResult: null,
      decision: null,
      receipt: null,
      failureReasons: ['invalid-signature'],
    });
  }

  const failureReasons = bridgeFailureReasons(
    input.online?.failureReasons ?? input.offline?.failureReasons ?? [],
  );
  const { decision, receipt } = decisionAndReceipt({
    request: input.request,
    verification: verificationResult,
    checkedAt: input.checkedAt,
    failureReasons,
  });
  const allowed = failureReasons.length === 0 && verificationResult.status === 'valid';

  return bridgeResult({
    ...input,
    status: allowed ? 'allowed' : 'denied',
    verificationResult,
    decision,
    receipt,
    failureReasons,
  });
}
