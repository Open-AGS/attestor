import { createHash } from 'node:crypto';
import {
  HTTP_MESSAGE_SIGNATURE_CONTENT_DIGEST_ALGORITHM,
  type HttpMessageForSignature,
  type HttpMessageHeaderValue,
} from './http-message-signatures-types.js';
import { ENFORCEMENT_FAILURE_REASONS } from './types.js';
import type { EnforcementFailureReason } from './types.js';

export function uniqueFailureReasons(
  reasons: readonly EnforcementFailureReason[],
): readonly EnforcementFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(ENFORCEMENT_FAILURE_REASONS.filter((reason) => present.has(reason)));
}

export function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`HTTP message signature ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeHeaderName(name: string): string {
  const normalized = normalizeIdentifier(name, 'headerName').toLowerCase();
  if (normalized.startsWith('@')) {
    return normalized;
  }
  if (!/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(normalized)) {
    throw new Error(`HTTP message signature header name is invalid: ${name}`);
  }
  return normalized;
}

export function normalizeComponentName(component: string): string {
  return normalizeHeaderName(component);
}

export function normalizeHttpMethod(method: string): string {
  return normalizeIdentifier(method, 'method').toUpperCase();
}

export function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`HTTP message signature ${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

export function epochSeconds(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export function isoFromEpochSeconds(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

function bytesForBody(body: HttpMessageForSignature['body']): Buffer {
  if (body === undefined || body === null) {
    return Buffer.alloc(0);
  }
  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }
  return Buffer.from(body);
}

export function contentDigestForBody(body: HttpMessageForSignature['body']): string {
  const digest = createHash('sha256').update(bytesForBody(body)).digest('base64');
  return `${HTTP_MESSAGE_SIGNATURE_CONTENT_DIGEST_ALGORITHM}=:${digest}:`;
}

export function httpReleaseTokenDigest(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function normalizedUri(uri: string): URL {
  const parsed = new URL(normalizeIdentifier(uri, 'uri'));
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';
  return parsed;
}

export function normalizeHttpSignatureTargetUri(uri: string): string {
  return normalizedUri(uri).toString();
}

function normalizeHeaderValue(value: HttpMessageHeaderValue): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
    return values.length > 0 ? values.join(', ') : null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeHttpMessageHeaders(
  headers: Readonly<Record<string, HttpMessageHeaderValue>> | undefined,
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  if (!headers) {
    return Object.freeze(normalized);
  }

  for (const [name, value] of Object.entries(headers)) {
    const headerName = normalizeHeaderName(name);
    const headerValue = normalizeHeaderValue(value);
    if (headerValue !== null) {
      normalized[headerName] = headerValue;
    }
  }

  return Object.freeze(normalized);
}

function headerValueForComponent(
  headers: Readonly<Record<string, string>>,
  component: string,
): string {
  const value = headers[normalizeHeaderName(component)];
  if (value === undefined) {
    throw new Error(`HTTP message signature missing covered header: ${component}`);
  }
  return value;
}

export function componentValue(message: HttpMessageForSignature, component: string): string {
  const normalizedComponent = normalizeComponentName(component);
  const uri = normalizedUri(message.uri);
  const headers = normalizeHttpMessageHeaders(message.headers);

  switch (normalizedComponent) {
    case '@method':
      return normalizeHttpMethod(message.method);
    case '@target-uri':
      return uri.toString();
    case '@authority':
      return uri.host.toLowerCase();
    case '@scheme':
      return uri.protocol.slice(0, -1);
    case '@path':
      return uri.pathname || '/';
    case '@query':
      return uri.search || '?';
    case '@request-target':
      return `${uri.pathname || '/'}${uri.search}`;
    default:
      if (normalizedComponent.startsWith('@')) {
        throw new Error(`HTTP message signature unsupported derived component: ${component}`);
      }
      return headerValueForComponent(headers, normalizedComponent);
  }
}
