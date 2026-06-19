import { createHash } from 'node:crypto';
import {
  ATTESTOR_RELEASE_TOKEN_HEADER,
} from './middleware.js';
import {
  normalizeHttpMessageHeaders,
  type HttpMessageForSignature,
  type HttpMessageHeaderValue,
} from './http-message-signatures.js';
import {
  ENFORCEMENT_FAILURE_REASONS,
  type EnforcementFailureReason,
} from './types.js';
import {
  strictAuthorizationCredential,
  strictReleaseTokenCredential,
} from './authorization-headers.js';
import {
  DEFAULT_WEBHOOK_RECEIVER_METHODS,
  type ReleaseWebhookReceiverContext,
  type ReleaseWebhookReceiverHttpRequest,
  type ReleaseWebhookReceiverOptions,
  type ReleaseWebhookReceiverResolver,
} from './webhook-receiver-types.js';

export function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

export function normalizeIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeMethod(method: string | undefined): string {
  return normalizeIdentifier(method)?.toUpperCase() ?? 'GET';
}

export function normalizeIsoTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Release webhook receiver now() must return a valid ISO timestamp.');
  }
  return timestamp.toISOString();
}

export function bodyBytes(body: ReleaseWebhookReceiverHttpRequest['body']): Uint8Array {
  if (body === undefined || body === null) {
    return new Uint8Array();
  }
  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
  }
  return new Uint8Array(body);
}

export function bodyForSignature(body: ReleaseWebhookReceiverHttpRequest['body']): Buffer {
  return Buffer.from(bodyBytes(body));
}

export function headerRecord(
  headers: ReleaseWebhookReceiverHttpRequest['headers'],
): Readonly<Record<string, HttpMessageHeaderValue>> {
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value;
    });
    return Object.freeze(record);
  }
  return headers as Readonly<Record<string, HttpMessageHeaderValue>>;
}

export function headerValue(
  headers: ReleaseWebhookReceiverHttpRequest['headers'],
  name: string,
): string | null {
  const lowerName = name.toLowerCase();
  if (headers instanceof Headers) {
    return normalizeIdentifier(headers.get(lowerName) ?? headers.get(name));
  }

  const record = headers as Readonly<Record<string, HttpMessageHeaderValue>>;
  const direct = record[lowerName] ?? record[name];
  if (Array.isArray(direct)) {
    return normalizeIdentifier(direct.map((value) => String(value)).join(', '));
  }
  if (direct === undefined || direct === null) {
    return null;
  }
  return normalizeIdentifier(String(direct));
}

export function bearerReleaseToken(headers: ReleaseWebhookReceiverHttpRequest['headers']): string | null {
  const authorization = headerValue(headers, 'authorization');
  if (authorization) {
    const parsed = strictAuthorizationCredential(authorization, ['bearer']);
    if (parsed) {
      return parsed.credential;
    }
  }

  return strictReleaseTokenCredential(headerValue(headers, ATTESTOR_RELEASE_TOKEN_HEADER));
}

export async function resolveOption<T>(
  option: ReleaseWebhookReceiverResolver<T> | undefined,
  context: ReleaseWebhookReceiverContext,
): Promise<T | undefined> {
  if (typeof option === 'function') {
    return (option as (context: ReleaseWebhookReceiverContext) => T | Promise<T>)(context);
  }
  return option;
}

export async function resolveRequiredBinding(
  option: ReleaseWebhookReceiverResolver<string | null | undefined> | undefined,
  context: ReleaseWebhookReceiverContext,
  headerName: string,
): Promise<string | null> {
  const resolved = normalizeIdentifier(await resolveOption(option, context));
  return resolved ?? headerValue(context.request.headers, headerName);
}

export function acceptedMethods(options: ReleaseWebhookReceiverOptions): ReadonlySet<string> {
  return new Set(
    (options.acceptedMethods ?? DEFAULT_WEBHOOK_RECEIVER_METHODS).map((method) =>
      method.trim().toUpperCase(),
    ),
  );
}

export function methodAllowed(
  request: ReleaseWebhookReceiverHttpRequest,
  options: ReleaseWebhookReceiverOptions,
): boolean {
  return acceptedMethods(options).has(normalizeMethod(request.method));
}

export function headersDigest(headers: ReleaseWebhookReceiverHttpRequest['headers']): string {
  const normalized = normalizeHttpMessageHeaders(headerRecord(headers));
  const canonical = Object.entries(normalized)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function releaseWebhookMessage(
  request: ReleaseWebhookReceiverHttpRequest,
): HttpMessageForSignature {
  return Object.freeze({
    method: normalizeMethod(request.method),
    uri: request.url,
    headers: headerRecord(request.headers),
    body: bodyForSignature(request.body),
  });
}
