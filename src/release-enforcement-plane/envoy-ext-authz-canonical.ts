import {
  canonicalizeReleaseJson,
  createCanonicalReleaseHashBundle,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { ReleaseTargetReference } from '../release-kernel/object-model.js';
import {
  RISK_CLASSES,
  isRiskClass,
  type OutputContractDescriptor,
} from '../release-kernel/types.js';
import {
  ATTESTOR_TARGET_ID_HEADER,
} from './http-message-signatures.js';
import { certificateThumbprintFromPem } from './workload-binding.js';
import type { ReleaseEnforcementRiskClass } from './types.js';
import {
  ENVOY_EXT_AUTHZ_DEFAULT_CONSEQUENCE_TYPE,
  ENVOY_EXT_AUTHZ_DEFAULT_RISK_CLASS,
  ENVOY_EXT_AUTHZ_OUTPUT_ARTIFACT_TYPE,
  ENVOY_EXT_AUTHZ_OUTPUT_EXPECTED_SHAPE,
  ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION,
  RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
  SENSITIVE_BINDING_HEADERS,
  type EnvoyExtAuthzAttributeContext,
  type EnvoyExtAuthzCanonicalBinding,
  type EnvoyExtAuthzCanonicalBindingOptions,
  type EnvoyExtAuthzCheckRequest,
  type EnvoyExtAuthzHeaderMapEntry,
  type EnvoyExtAuthzHeaderValue,
  type EnvoyExtAuthzHttpRequestAttributes,
  type EnvoyExtAuthzMetadata,
  type EnvoyExtAuthzPeer,
  type EnvoyExtAuthzProxyRequestCanonical,
} from './envoy-ext-authz-types.js';
import {
  canonicalValue,
  normalizeIdentifier,
  requireIdentifier,
  sha256,
} from './envoy-ext-authz-utils.js';

function bytesForBody(
  body: EnvoyExtAuthzHttpRequestAttributes['body'] | EnvoyExtAuthzHttpRequestAttributes['raw_body'],
): Buffer | null {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === 'string') {
    return Buffer.from(body, 'utf8');
  }
  return Buffer.from(body);
}

function headerValueToString(value: EnvoyExtAuthzHeaderValue): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean).join(', ');
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString('utf8').trim();
  }
  return String(value).trim();
}

function headerMapEntryValue(entry: EnvoyExtAuthzHeaderMapEntry): string | null {
  if (entry.value !== undefined) {
    return normalizeIdentifier(entry.value);
  }
  if (entry.raw_value === undefined) {
    return null;
  }
  if (typeof entry.raw_value === 'string') {
    return normalizeIdentifier(entry.raw_value);
  }
  return normalizeIdentifier(Buffer.from(entry.raw_value).toString('utf8'));
}

export function normalizeHeaders(
  http: EnvoyExtAuthzHttpRequestAttributes | undefined,
): Readonly<Record<string, string>> {
  const entries = new Map<string, string[]>();
  for (const [key, value] of Object.entries(http?.headers ?? {})) {
    const normalizedKey = key.trim().toLowerCase();
    const normalizedValue = headerValueToString(value);
    if (normalizedKey && normalizedValue) {
      entries.set(normalizedKey, [...(entries.get(normalizedKey) ?? []), normalizedValue]);
    }
  }

  for (const entry of http?.header_map?.headers ?? []) {
    const normalizedKey = normalizeIdentifier(entry.key)?.toLowerCase();
    const normalizedValue = headerMapEntryValue(entry);
    if (normalizedKey && normalizedValue) {
      entries.set(normalizedKey, [...(entries.get(normalizedKey) ?? []), normalizedValue]);
    }
  }

  return Object.freeze(
    Object.fromEntries(
      [...entries.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => [key, values.join(', ')]),
    ),
  );
}

export function headerValue(
  headers: Readonly<Record<string, string>>,
  name: string,
): string | null {
  return normalizeIdentifier(headers[name.toLowerCase()]);
}

function selectedBindingHeaders(
  headers: Readonly<Record<string, string>>,
  includeHeaders?: readonly string[],
): Readonly<Record<string, string>> {
  const include = includeHeaders
    ? new Set(includeHeaders.map((header) => header.trim().toLowerCase()).filter(Boolean))
    : null;

  return Object.freeze(
    Object.fromEntries(
      Object.entries(headers)
        .filter(([key]) => (include ? include.has(key) : !SENSITIVE_BINDING_HEADERS.has(key)))
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function lowerRecord(record: Readonly<Record<string, string>> | undefined): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record ?? {})
        .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
        .filter(([key, value]) => key.length > 0 && value.length > 0)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function metadataDigest(metadata: EnvoyExtAuthzMetadata | undefined): string | null {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }
  return sha256(canonicalizeReleaseJson(canonicalValue(metadata)));
}

function certificateThumbprintFromPeer(peer: EnvoyExtAuthzPeer | undefined): string | null {
  const certificate = normalizeIdentifier(peer?.certificate);
  if (!certificate) {
    return null;
  }
  try {
    return certificateThumbprintFromPem(certificate);
  } catch {
    return null;
  }
}

function bodyDigestFromHttp(http: EnvoyExtAuthzHttpRequestAttributes | undefined): string | null {
  const body = bytesForBody(http?.raw_body ?? http?.body);
  return body ? sha256(body) : null;
}

function normalizedHttpMethod(http: EnvoyExtAuthzHttpRequestAttributes | undefined): string {
  return normalizeIdentifier(http?.method)?.toUpperCase() ?? 'GET';
}

function normalizedHost(
  http: EnvoyExtAuthzHttpRequestAttributes | undefined,
  headers: Readonly<Record<string, string>>,
  attributes: EnvoyExtAuthzAttributeContext | undefined,
): string {
  return (
    normalizeIdentifier(http?.host) ??
    headerValue(headers, ':authority') ??
    headerValue(headers, 'host') ??
    normalizeIdentifier(attributes?.destination?.service) ??
    'unknown.local'
  );
}

function normalizedScheme(
  http: EnvoyExtAuthzHttpRequestAttributes | undefined,
  headers: Readonly<Record<string, string>>,
): string {
  const raw =
    normalizeIdentifier(http?.scheme) ??
    headerValue(headers, ':scheme') ??
    headerValue(headers, 'x-forwarded-proto') ??
    'https';
  return raw.toLowerCase();
}

function normalizedPath(
  http: EnvoyExtAuthzHttpRequestAttributes | undefined,
  headers: Readonly<Record<string, string>>,
): string {
  const raw = normalizeIdentifier(http?.path) ?? headerValue(headers, ':path') ?? '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function targetUriFromParts(input: {
  readonly scheme: string;
  readonly host: string;
  readonly path: string;
}): string {
  const uri = new URL(`${input.scheme}://${input.host}${input.path}`);
  uri.hash = '';
  return uri.toString();
}

function targetIdFromCheck(input: {
  readonly options: EnvoyExtAuthzCanonicalBindingOptions;
  readonly headers: Readonly<Record<string, string>>;
  readonly attributes: EnvoyExtAuthzAttributeContext | undefined;
  readonly host: string;
  readonly path: string;
}): string {
  return requireIdentifier(
    normalizeIdentifier(input.options.targetId) ??
      normalizeIdentifier(input.attributes?.context_extensions?.['attestor.target_id']) ??
      (input.options.allowClientTargetHeader
        ? headerValue(input.headers, ATTESTOR_TARGET_ID_HEADER)
        : null) ??
      normalizeIdentifier(input.attributes?.destination?.service) ??
      `${input.host}${input.path}`,
    'targetId',
  );
}

function routeRiskClassFromCheck(
  checkRequest: EnvoyExtAuthzCheckRequest,
): ReleaseEnforcementRiskClass | null {
  const raw = normalizeIdentifier(
    checkRequest.attributes?.context_extensions?.[
      ENVOY_EXT_AUTHZ_ROUTE_RISK_CLASS_CONTEXT_EXTENSION
    ],
  );
  if (!raw) {
    return null;
  }
  const normalized = raw.toUpperCase();
  if (!isRiskClass(normalized)) {
    throw new Error(
      `Envoy ext_authz bridge route risk class must be one of ${RISK_CLASSES.join(', ')}.`,
    );
  }
  return normalized;
}

function proxyRequestCanonical(
  checkRequest: EnvoyExtAuthzCheckRequest,
  options: EnvoyExtAuthzCanonicalBindingOptions,
): EnvoyExtAuthzProxyRequestCanonical {
  const attributes = checkRequest.attributes;
  const http = attributes?.request?.http;
  if (!http) {
    throw new Error('Envoy ext_authz bridge requires request.http attributes.');
  }

  const headers = normalizeHeaders(http);
  const method = normalizedHttpMethod(http);
  const scheme = normalizedScheme(http, headers);
  const host = normalizedHost(http, headers, attributes);
  const path = normalizedPath(http, headers);
  const targetUri = targetUriFromParts({ scheme, host, path });
  const sourceCertificateThumbprint = certificateThumbprintFromPeer(attributes?.source);

  return Object.freeze({
    requestId: normalizeIdentifier(http.id) ?? headerValue(headers, 'x-request-id'),
    method,
    scheme,
    host,
    path,
    targetUri,
    protocol: normalizeIdentifier(http.protocol),
    bodyDigest: bodyDigestFromHttp(http),
    selectedHeaders: selectedBindingHeaders(headers, options.includeHeaders),
    source: Object.freeze({
      service: normalizeIdentifier(attributes?.source?.service),
      principal: normalizeIdentifier(attributes?.source?.principal),
      certificateThumbprint: sourceCertificateThumbprint,
      labels: lowerRecord(attributes?.source?.labels),
    }),
    destination: Object.freeze({
      service: normalizeIdentifier(attributes?.destination?.service),
      host,
      sni: normalizeIdentifier(attributes?.tls_session?.sni),
      labels: lowerRecord(attributes?.destination?.labels),
    }),
    route: Object.freeze({
      contextExtensions: lowerRecord(attributes?.context_extensions),
      metadataDigest: metadataDigest(attributes?.metadata_context),
      routeMetadataDigest: metadataDigest(attributes?.route_metadata_context),
    }),
  });
}

export function envoyOriginalRequestUri(
  checkRequest: EnvoyExtAuthzCheckRequest,
): string {
  return proxyRequestCanonical(checkRequest, {}).targetUri;
}

export function buildEnvoyExtAuthzCanonicalBinding(
  checkRequest: EnvoyExtAuthzCheckRequest,
  options: EnvoyExtAuthzCanonicalBindingOptions = {},
): EnvoyExtAuthzCanonicalBinding {
  const proxyRequest = proxyRequestCanonical(checkRequest, options);
  const routeRiskClass = routeRiskClassFromCheck(checkRequest);
  const headers = normalizeHeaders(checkRequest.attributes?.request?.http);
  const targetId = targetIdFromCheck({
    options,
    headers,
    attributes: checkRequest.attributes,
    host: proxyRequest.host,
    path: proxyRequest.path,
  });
  const target: ReleaseTargetReference = Object.freeze({
    kind: options.targetKind ?? 'endpoint',
    id: targetId,
    displayName: `Proxy admission ${targetId}`,
  });
  const outputContract: OutputContractDescriptor = Object.freeze({
    artifactType: ENVOY_EXT_AUTHZ_OUTPUT_ARTIFACT_TYPE,
    expectedShape: ENVOY_EXT_AUTHZ_OUTPUT_EXPECTED_SHAPE,
    consequenceType: options.consequenceType ?? ENVOY_EXT_AUTHZ_DEFAULT_CONSEQUENCE_TYPE,
    riskClass: options.riskClass ?? routeRiskClass ?? ENVOY_EXT_AUTHZ_DEFAULT_RISK_CLASS,
  });
  const outputPayload: CanonicalReleaseJsonValue = Object.freeze({
    version: RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
    proxyRequest: canonicalValue(proxyRequest),
  });
  const consequencePayload: CanonicalReleaseJsonValue = Object.freeze({
    consequenceType: outputContract.consequenceType,
    riskClass: outputContract.riskClass,
    boundary: 'proxy-admission',
    targetId: target.id,
    method: proxyRequest.method,
    targetUri: proxyRequest.targetUri,
    bodyDigest: proxyRequest.bodyDigest,
    sourcePrincipal: proxyRequest.source.principal,
    destinationService: proxyRequest.destination.service,
  });
  const hashBundle = createCanonicalReleaseHashBundle({
    outputContract,
    target,
    outputPayload,
    consequencePayload,
    idempotencyKey: proxyRequest.requestId ?? undefined,
  });
  const checkCanonical = canonicalizeReleaseJson({
    outputHash: hashBundle.outputHash,
    consequenceHash: hashBundle.consequenceHash,
    proxyRequest: canonicalValue(proxyRequest),
  });

  return Object.freeze({
    version: RELEASE_ENVOY_EXT_AUTHZ_BRIDGE_SPEC_VERSION,
    target,
    outputContract,
    outputPayload,
    consequencePayload,
    hashBundle,
    proxyRequest,
    checkCanonical,
    checkHash: sha256(checkCanonical),
    headersDigest: sha256(canonicalizeReleaseJson(proxyRequest.selectedHeaders)),
    bodyDigest: proxyRequest.bodyDigest,
  });
}
