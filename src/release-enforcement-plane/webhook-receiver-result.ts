import {
  HTTP_MESSAGE_SIGNATURE_LABEL,
} from './http-message-signatures.js';
import type { EnforcementFailureReason } from './types.js';
import {
  ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER,
  DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS,
  RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
  type ReleaseWebhookReceiverDeniedBody,
  type ReleaseWebhookReceiverResult,
} from './webhook-receiver-types.js';
import {
  uniqueFailureReasons,
} from './webhook-receiver-utils.js';

export function responseStatusForFailures(
  failureReasons: readonly EnforcementFailureReason[],
  fallback = 403,
): number {
  if (failureReasons.includes('missing-release-authorization')) {
    return 401;
  }
  if (failureReasons.includes('introspection-unavailable') || failureReasons.includes('break-glass-required')) {
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
  return fallback;
}

export function isRetryableFailure(failureReasons: readonly EnforcementFailureReason[]): boolean {
  return (
    failureReasons.includes('introspection-unavailable') ||
    failureReasons.includes('fresh-introspection-required') ||
    failureReasons.includes('break-glass-required')
  );
}

export function receiverFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const unique = uniqueFailureReasons(reasons);
  const hasHardFailure = unique.some(
    (reason) =>
      reason !== 'fresh-introspection-required' &&
      reason !== 'introspection-unavailable' &&
      reason !== 'break-glass-required',
  );
  return hasHardFailure
    ? uniqueFailureReasons(unique.filter((reason) => reason !== 'fresh-introspection-required'))
    : unique;
}

export function resultFromEarlyRejection(input: {
  readonly checkedAt: string;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly responseStatus?: number;
}): ReleaseWebhookReceiverResult {
  const failureReasons = uniqueFailureReasons(input.failureReasons);
  return Object.freeze({
    version: RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
    status: 'rejected',
    checkedAt: input.checkedAt,
    request: null,
    presentation: null,
    signature: null,
    verificationResult: null,
    offline: null,
    online: null,
    decision: null,
    receipt: null,
    breakGlass: null,
    failureReasons,
    responseStatus: input.responseStatus ?? responseStatusForFailures(failureReasons),
    retryable: isRetryableFailure(failureReasons),
  });
}

export function releaseWebhookReceiverDeniedBody(
  result: ReleaseWebhookReceiverResult,
): ReleaseWebhookReceiverDeniedBody {
  return Object.freeze({
    version: RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
    status: 'rejected',
    checkedAt: result.checkedAt,
    failureReasons: result.failureReasons,
    verificationStatus: result.verificationResult?.status ?? null,
    requestId: result.request?.id ?? null,
    retryable: result.retryable,
  });
}

export function releaseWebhookReceiverResponseHeaders(
  result: ReleaseWebhookReceiverResult,
): Headers {
  const headers = new Headers({
    'cache-control': 'no-store',
    [ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER]: result.status,
  });
  if (result.status === 'rejected') {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  if (result.failureReasons.includes('missing-release-authorization')) {
    headers.set(
      'www-authenticate',
      'Bearer realm="attestor-webhook", error="invalid_token", error_description="Attestor release authorization is required"',
    );
  }
  if (result.failureReasons.includes('missing-nonce') || result.failureReasons.includes('invalid-nonce')) {
    headers.set('accept-signature', `${HTTP_MESSAGE_SIGNATURE_LABEL}=("${DEFAULT_WEBHOOK_RECEIVER_HTTP_AUTHORIZATION_COMPONENTS.join('" "')}")`);
  }
  return headers;
}

export function rejectedResponse(result: ReleaseWebhookReceiverResult): Response {
  return new Response(JSON.stringify(releaseWebhookReceiverDeniedBody(result)), {
    status: result.responseStatus,
    headers: releaseWebhookReceiverResponseHeaders(result),
  });
}
