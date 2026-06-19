import type { ConsequenceAdmissionDomain } from './taxonomy.js';
import { assertRuntimeSignalAuthorityBoundary } from './runtime-signal-authority-guard.js';
import {
  mapRuntimeSignalToConsequenceCandidate,
  type RuntimeSignalConsequenceCandidate,
} from './runtime-signal-consequence-mapping.js';
import type { RuntimeSignalEnvelope } from './runtime-signal-envelope.js';
import type {
  ActionSurfaceAutoContextSignal,
  ActionSurfaceAutoContextSignalKind,
} from './action-surface-auto-context-types.js';

const RUNTIME_SIGNAL_HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
]);

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function domainForRuntimeSignalCandidate(
  candidate: RuntimeSignalConsequenceCandidate,
): ConsequenceAdmissionDomain {
  switch (candidate.consequenceClass) {
    case 'financial':
      return 'money-movement';
    case 'data-movement':
      return 'data-disclosure';
    case 'authority-change':
      return 'authority-change';
    case 'external-communication':
      return 'external-communication';
    case 'operational-execution':
      return 'system-operation';
    case 'programmable-money':
      return 'programmable-money';
    case 'health-claims':
      return 'decision-support';
    case 'unknown':
      return 'custom';
  }
}

function httpOperationParts(operationRef: string | null): {
  readonly method: string | null;
  readonly path: string | null;
  readonly operationId: string | null;
} {
  const value = normalizeOptionalString(operationRef);
  if (!value) {
    return Object.freeze({ method: null, path: null, operationId: null });
  }
  const separator = value.indexOf(' ');
  if (separator <= 0) {
    return Object.freeze({ method: null, path: null, operationId: null });
  }
  const method = value.slice(0, separator).toUpperCase();
  if (!RUNTIME_SIGNAL_HTTP_METHODS.has(method)) {
    return Object.freeze({ method: null, path: null, operationId: null });
  }
  let restStart = separator + 1;
  while (value.charCodeAt(restStart) === 32) {
    restStart += 1;
  }
  const rest = value.slice(restStart);
  if (!rest.startsWith('/')) {
    return Object.freeze({ method: null, path: null, operationId: null });
  }
  const hashIndex = rest.indexOf('#');
  const path = (hashIndex >= 0 ? rest.slice(0, hashIndex) : rest).trim();
  if (!path) {
    return Object.freeze({ method: null, path: null, operationId: null });
  }
  const operationId = hashIndex >= 0 ? normalizeOptionalString(rest.slice(hashIndex + 1)) : null;
  return Object.freeze({
    method,
    path,
    operationId,
  });
}

function mcpToolName(operationRef: string | null): string | null {
  const match = operationRef?.match(/^mcp\.tool:(?:(?:[^:]+):)?([^:]+)$/u);
  return match?.[1] ?? null;
}

function asyncApiParts(operationRef: string | null): {
  readonly operationId: string | null;
  readonly channel: string | null;
} {
  const match = operationRef?.match(/^asyncapi\.operation:([^@]+)@([^#]+)(?:#.+)?$/u);
  if (!match) {
    return Object.freeze({ operationId: null, channel: null });
  }
  return Object.freeze({
    operationId: match[1] ?? null,
    channel: match[2] ?? null,
  });
}

function cloudEventParts(operationRef: string | null): {
  readonly eventType: string | null;
  readonly eventSource: string | null;
} {
  const match = operationRef?.match(/^cloudevent:([^@]+)@([^#]+)(?:#.+)?$/u);
  if (!match) {
    return Object.freeze({ eventType: null, eventSource: null });
  }
  return Object.freeze({
    eventType: match[1] ?? null,
    eventSource: match[2] ?? null,
  });
}

function autoContextSignalKindForRuntimeSignal(
  envelope: RuntimeSignalEnvelope,
): ActionSurfaceAutoContextSignalKind {
  if (mcpToolName(envelope.operationRef)) return 'mcp-tool-definition';
  if (httpOperationParts(envelope.operationRef).method) return 'openapi-operation';
  if (asyncApiParts(envelope.operationRef).operationId) return 'asyncapi-operation';
  if (cloudEventParts(envelope.operationRef).eventType) return 'cloudevents-event';
  if (envelope.operationRef?.startsWith('otel.log:')) return 'gateway-log';
  if (envelope.signalKind === 'observation') return 'gateway-log';
  return 'workflow-job';
}

export function runtimeSignalEnvelopeToActionSurfaceAutoContextSignal(
  envelope: RuntimeSignalEnvelope,
): ActionSurfaceAutoContextSignal {
  assertRuntimeSignalAuthorityBoundary({
    signalKind: envelope.signalKind,
    sourceTrustLevel: envelope.sourceTrustLevel,
    target: envelope,
    targetLabel: 'runtime-signal-envelope',
  });
  const candidate = mapRuntimeSignalToConsequenceCandidate(envelope);
  const signalKind = autoContextSignalKindForRuntimeSignal(envelope);
  const http = httpOperationParts(envelope.operationRef);
  const asyncapi = asyncApiParts(envelope.operationRef);
  const cloudevent = cloudEventParts(envelope.operationRef);
  const toolName = mcpToolName(envelope.operationRef);
  const action = candidate.actionSurface === 'unknown'
    ? envelope.operationRef ?? 'runtime-signal'
    : candidate.actionSurface;

  return Object.freeze({
    signalKind,
    sourceRef: `runtime-signal:${envelope.signalDigest}`,
    producerRef: envelope.sourceSystem,
    observedAt: envelope.eventTime,
    actor: envelope.actorRefDigest ? `actor:${envelope.actorRefDigest}` : null,
    downstreamSystem: envelope.downstreamSystem,
    action,
    domain: domainForRuntimeSignalCandidate(candidate),
    credentialPosture: 'unknown',
    integrationModeHint: null,
    toolName,
    operationId: http.operationId ?? asyncapi.operationId,
    method: http.method,
    path: http.path,
    channel: asyncapi.channel,
    workflowRef: signalKind === 'workflow-job' ? envelope.operationRef : null,
    spanName: envelope.operationRef?.startsWith('otel.log:') ? envelope.operationRef : null,
    httpRoute: http.path,
    httpMethod: http.method,
    cloudEventType: cloudevent.eventType,
    cloudEventSource: cloudevent.eventSource,
    inputShapeDigest: envelope.inputSchemaDigest,
    argumentDigest: envelope.argumentOrBodyDigest,
  });
}
