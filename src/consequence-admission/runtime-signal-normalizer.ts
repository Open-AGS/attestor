import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  createRuntimeSignalEnvelope,
  type RuntimeSignalEnvelope,
  type RuntimeSignalKind,
  type RuntimeSignalSourceTrustLevel,
} from './runtime-signal-envelope.js';

export const RUNTIME_SIGNAL_NORMALIZER_VERSION =
  'attestor.runtime-signal-normalizer.v1';

export const RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS = [
  'mcp-tool',
  'openapi-operation',
  'asyncapi-operation',
  'cloudevents-event',
  'otel-log',
] as const;
export type RuntimeSignalNormalizerSourceKind =
  typeof RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS[number];

export const RUNTIME_SIGNAL_NORMALIZER_REQUIRED_FIELDS = [
  'sourceKind',
  'sourceSystem',
  'normalizedSourceRef',
  'sourceInputDigest',
  'envelope',
  'normalizerDigest',
] as const;
export type RuntimeSignalNormalizerRequiredField =
  typeof RUNTIME_SIGNAL_NORMALIZER_REQUIRED_FIELDS[number];

export interface RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: RuntimeSignalNormalizerSourceKind;
  readonly sourceSystem: string;
  readonly eventTime: string;
  readonly tenantRefDigest?: string | null;
  readonly actorRefDigest?: string | null;
  readonly runtimeRef?: string | null;
  readonly traceId?: string | null;
  readonly runId?: string | null;
  readonly actionSurface?: string | null;
  readonly downstreamSystem?: string | null;
  readonly policyRefs?: readonly string[] | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly approvalRefs?: readonly string[] | null;
}

export interface NormalizeMcpToolRuntimeSignalInput
  extends RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: 'mcp-tool';
  readonly toolName: string;
  readonly inputSchemaDigest: string;
  readonly serverRef?: string | null;
}

export interface NormalizeOpenApiOperationRuntimeSignalInput
  extends RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: 'openapi-operation';
  readonly method: string;
  readonly path: string;
  readonly operationId?: string | null;
  readonly inputSchemaDigest: string;
}

export interface NormalizeAsyncApiOperationRuntimeSignalInput
  extends RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: 'asyncapi-operation';
  readonly channel: string;
  readonly operationId: string;
  readonly messageRef?: string | null;
  readonly inputSchemaDigest: string;
}

export interface NormalizeCloudEventsRuntimeSignalInput
  extends RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: 'cloudevents-event';
  readonly eventType: string;
  readonly eventSource: string;
  readonly eventIdDigest: string;
  readonly subject?: string | null;
  readonly dataSchemaDigest?: string | null;
  readonly dataDigest?: string | null;
}

export interface NormalizeOtelLogRuntimeSignalInput
  extends RuntimeSignalNormalizerCommonInput {
  readonly sourceKind: 'otel-log';
  readonly serviceName: string;
  readonly logRecordRef: string;
  readonly spanId?: string | null;
  readonly eventName?: string | null;
  readonly severity?: string | null;
  readonly bodyDigest?: string | null;
}

export type NormalizeRuntimeSignalInput =
  | NormalizeMcpToolRuntimeSignalInput
  | NormalizeOpenApiOperationRuntimeSignalInput
  | NormalizeAsyncApiOperationRuntimeSignalInput
  | NormalizeCloudEventsRuntimeSignalInput
  | NormalizeOtelLogRuntimeSignalInput;

export interface RuntimeSignalNormalizerResult {
  readonly version: typeof RUNTIME_SIGNAL_NORMALIZER_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly sourceKind: RuntimeSignalNormalizerSourceKind;
  readonly normalizedSourceRef: string;
  readonly sourceInputDigest: string;
  readonly envelope: RuntimeSignalEnvelope;
  readonly digestOnly: true;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly normalizerDigest: string;
}

export interface RuntimeSignalNormalizerDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_NORMALIZER_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly sourceKinds: typeof RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS;
  readonly requiredFields: typeof RUNTIME_SIGNAL_NORMALIZER_REQUIRED_FIELDS;
  readonly sourceKindToSignalKind: Readonly<Record<
    RuntimeSignalNormalizerSourceKind,
    RuntimeSignalKind
  >>;
  readonly sourceKindToTrustLevel: Readonly<Record<
    RuntimeSignalNormalizerSourceKind,
    RuntimeSignalSourceTrustLevel
  >>;
  readonly digestOnly: true;
  readonly rejectsUnknownInputFields: true;
  readonly rejectsRawPayloadFields: true;
  readonly sourceInputDigestRequired: true;
  readonly declarationSourcesProduceDeclaredTrust: true;
  readonly observationSourcesProduceObservedTrust: true;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
}

const SOURCE_KIND_TO_SIGNAL_KIND = Object.freeze({
  'mcp-tool': 'declaration',
  'openapi-operation': 'declaration',
  'asyncapi-operation': 'declaration',
  'cloudevents-event': 'observation',
  'otel-log': 'observation',
} satisfies Readonly<Record<RuntimeSignalNormalizerSourceKind, RuntimeSignalKind>>);

const SOURCE_KIND_TO_TRUST_LEVEL = Object.freeze({
  'mcp-tool': 'declared',
  'openapi-operation': 'declared',
  'asyncapi-operation': 'declared',
  'cloudevents-event': 'observed',
  'otel-log': 'observed',
} satisfies Readonly<Record<
  RuntimeSignalNormalizerSourceKind,
  RuntimeSignalSourceTrustLevel
>>);

const COMMON_INPUT_FIELDS = [
  'sourceKind',
  'sourceSystem',
  'eventTime',
  'tenantRefDigest',
  'actorRefDigest',
  'runtimeRef',
  'traceId',
  'runId',
  'actionSurface',
  'downstreamSystem',
  'policyRefs',
  'evidenceRefs',
  'approvalRefs',
] as const;

const SOURCE_SPECIFIC_FIELDS = Object.freeze({
  'mcp-tool': ['toolName', 'inputSchemaDigest', 'serverRef'],
  'openapi-operation': ['method', 'path', 'operationId', 'inputSchemaDigest'],
  'asyncapi-operation': ['channel', 'operationId', 'messageRef', 'inputSchemaDigest'],
  'cloudevents-event': [
    'eventType',
    'eventSource',
    'eventIdDigest',
    'subject',
    'dataSchemaDigest',
    'dataDigest',
  ],
  'otel-log': [
    'serviceName',
    'logRecordRef',
    'spanId',
    'eventName',
    'severity',
    'bodyDigest',
  ],
} satisfies Readonly<Record<RuntimeSignalNormalizerSourceKind, readonly string[]>>);

const RAW_FIELD_NAMES = new Set([
  'body',
  'data',
  'payload',
  'prompt',
  'providerBody',
  'rawBody',
  'rawData',
  'rawPayload',
  'rawPrompt',
  'rawProviderBody',
  'rawToolArguments',
  'toolArguments',
]);

const RAW_MATERIAL_PATTERNS = [
  /\bsk_(?:live|test)_[a-z0-9]/iu,
  /\bwhsec_[a-z0-9]/iu,
  /\bbearer\s+[a-z0-9._-]+/iu,
  /\bpostgres(?:ql)?:\/\//iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:api[_-]?key|password|secret)\s*[:=]/iu,
] as const;

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'TRACE',
] as const;

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function assertNoRawMaterialMarker(value: string, fieldName: string): void {
  for (const pattern of RAW_MATERIAL_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Runtime signal normalizer ${fieldName} must not contain raw sensitive material.`);
    }
  }
}

function normalizeSourceKind(value: unknown): RuntimeSignalNormalizerSourceKind {
  if (
    typeof value !== 'string' ||
    !RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS.includes(
      value as RuntimeSignalNormalizerSourceKind,
    )
  ) {
    throw new Error(`Runtime signal normalizer sourceKind must be one of: ${RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS.join(', ')}.`);
  }
  return value as RuntimeSignalNormalizerSourceKind;
}

function assertAllowedFields(
  input: NormalizeRuntimeSignalInput,
  sourceKind: RuntimeSignalNormalizerSourceKind,
): void {
  const allowed = new Set([...COMMON_INPUT_FIELDS, ...SOURCE_SPECIFIC_FIELDS[sourceKind]]);
  for (const key of Object.keys(input)) {
    if (RAW_FIELD_NAMES.has(key)) {
      throw new Error(`Runtime signal normalizer input must not include raw payload field: ${key}.`);
    }
    if (!allowed.has(key)) {
      throw new Error(`Runtime signal normalizer input contains unknown field: ${key}.`);
    }
  }
}

function normalizeBoundedString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Runtime signal normalizer ${fieldName} must be a bounded string.`);
  }
  const normalized = value.trim();
  assertNoRawMaterialMarker(normalized, fieldName);
  if (
    normalized.length === 0 ||
    normalized.length > 256 ||
    /[\u0000-\u001f\u007f]/u.test(normalized) ||
    /^[{[]/u.test(normalized)
  ) {
    throw new Error(`Runtime signal normalizer ${fieldName} must be bounded metadata.`);
  }
  return normalized;
}

function normalizeOptionalBoundedString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeBoundedString(value, fieldName);
}

function normalizeDigest(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Runtime signal normalizer ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeOptionalDigest(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeHttpMethod(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Runtime signal normalizer method must be a supported HTTP method.');
  }
  const normalized = value.trim().toUpperCase();
  if (!HTTP_METHODS.includes(normalized as typeof HTTP_METHODS[number])) {
    throw new Error('Runtime signal normalizer method must be a supported HTTP method.');
  }
  return normalized;
}

function normalizePath(value: unknown): string {
  const normalized = normalizeBoundedString(value, 'path');
  if (!normalized.startsWith('/')) {
    throw new Error('Runtime signal normalizer path must start with /.');
  }
  return normalized;
}

function sourceRefFor(input: NormalizeRuntimeSignalInput): string {
  switch (input.sourceKind) {
    case 'mcp-tool': {
      const toolName = normalizeBoundedString(input.toolName, 'toolName');
      const serverRef = normalizeOptionalBoundedString(input.serverRef, 'serverRef');
      return serverRef ? `mcp.tool:${serverRef}:${toolName}` : `mcp.tool:${toolName}`;
    }
    case 'openapi-operation': {
      const method = normalizeHttpMethod(input.method);
      const path = normalizePath(input.path);
      const operationId = normalizeOptionalBoundedString(input.operationId, 'operationId');
      return operationId ? `${method} ${path}#${operationId}` : `${method} ${path}`;
    }
    case 'asyncapi-operation': {
      const operationId = normalizeBoundedString(input.operationId, 'operationId');
      const channel = normalizeBoundedString(input.channel, 'channel');
      const messageRef = normalizeOptionalBoundedString(input.messageRef, 'messageRef');
      return messageRef
        ? `asyncapi.operation:${operationId}@${channel}#${messageRef}`
        : `asyncapi.operation:${operationId}@${channel}`;
    }
    case 'cloudevents-event': {
      const eventType = normalizeBoundedString(input.eventType, 'eventType');
      const eventSource = normalizeBoundedString(input.eventSource, 'eventSource');
      const subject = normalizeOptionalBoundedString(input.subject, 'subject');
      return subject
        ? `cloudevent:${eventType}@${eventSource}#${subject}`
        : `cloudevent:${eventType}@${eventSource}`;
    }
    case 'otel-log': {
      const serviceName = normalizeBoundedString(input.serviceName, 'serviceName');
      const eventName = normalizeOptionalBoundedString(input.eventName, 'eventName');
      const logRecordRef = normalizeBoundedString(input.logRecordRef, 'logRecordRef');
      return eventName
        ? `otel.log:${serviceName}:${eventName}#${logRecordRef}`
        : `otel.log:${serviceName}#${logRecordRef}`;
    }
  }
}

function schemaDigestFor(input: NormalizeRuntimeSignalInput): string | null {
  if (input.sourceKind === 'cloudevents-event') {
    return normalizeOptionalDigest(input.dataSchemaDigest, 'dataSchemaDigest');
  }
  if (input.sourceKind === 'otel-log') {
    return null;
  }
  return normalizeDigest(input.inputSchemaDigest, 'inputSchemaDigest');
}

function argumentOrBodyDigestFor(input: NormalizeRuntimeSignalInput): string | null {
  if (input.sourceKind === 'cloudevents-event') {
    normalizeDigest(input.eventIdDigest, 'eventIdDigest');
    return normalizeOptionalDigest(input.dataDigest, 'dataDigest');
  }
  if (input.sourceKind === 'otel-log') {
    return normalizeOptionalDigest(input.bodyDigest, 'bodyDigest');
  }
  return null;
}

function sourceInputDigestFor(
  input: NormalizeRuntimeSignalInput,
  normalizedSourceRef: string,
): string {
  switch (input.sourceKind) {
    case 'mcp-tool':
      return canonicalObject({
        sourceKind: input.sourceKind,
        normalizedSourceRef,
        toolName: normalizeBoundedString(input.toolName, 'toolName'),
        inputSchemaDigest: normalizeDigest(input.inputSchemaDigest, 'inputSchemaDigest'),
        serverRef: normalizeOptionalBoundedString(input.serverRef, 'serverRef'),
      }).digest;
    case 'openapi-operation':
      return canonicalObject({
        sourceKind: input.sourceKind,
        normalizedSourceRef,
        method: normalizeHttpMethod(input.method),
        path: normalizePath(input.path),
        operationId: normalizeOptionalBoundedString(input.operationId, 'operationId'),
        inputSchemaDigest: normalizeDigest(input.inputSchemaDigest, 'inputSchemaDigest'),
      }).digest;
    case 'asyncapi-operation':
      return canonicalObject({
        sourceKind: input.sourceKind,
        normalizedSourceRef,
        channel: normalizeBoundedString(input.channel, 'channel'),
        operationId: normalizeBoundedString(input.operationId, 'operationId'),
        messageRef: normalizeOptionalBoundedString(input.messageRef, 'messageRef'),
        inputSchemaDigest: normalizeDigest(input.inputSchemaDigest, 'inputSchemaDigest'),
      }).digest;
    case 'cloudevents-event':
      return canonicalObject({
        sourceKind: input.sourceKind,
        normalizedSourceRef,
        eventType: normalizeBoundedString(input.eventType, 'eventType'),
        eventSource: normalizeBoundedString(input.eventSource, 'eventSource'),
        eventIdDigest: normalizeDigest(input.eventIdDigest, 'eventIdDigest'),
        subject: normalizeOptionalBoundedString(input.subject, 'subject'),
        dataSchemaDigest: normalizeOptionalDigest(input.dataSchemaDigest, 'dataSchemaDigest'),
        dataDigest: normalizeOptionalDigest(input.dataDigest, 'dataDigest'),
      }).digest;
    case 'otel-log':
      return canonicalObject({
        sourceKind: input.sourceKind,
        normalizedSourceRef,
        serviceName: normalizeBoundedString(input.serviceName, 'serviceName'),
        logRecordRef: normalizeBoundedString(input.logRecordRef, 'logRecordRef'),
        spanId: normalizeOptionalBoundedString(input.spanId, 'spanId'),
        eventName: normalizeOptionalBoundedString(input.eventName, 'eventName'),
        severity: normalizeOptionalBoundedString(input.severity, 'severity'),
        bodyDigest: normalizeOptionalDigest(input.bodyDigest, 'bodyDigest'),
      }).digest;
  }
}

export function normalizeRuntimeSignal(
  input: NormalizeRuntimeSignalInput,
): RuntimeSignalNormalizerResult {
  const sourceKind = normalizeSourceKind(input.sourceKind);
  assertAllowedFields(input, sourceKind);

  const normalizedSourceRef = sourceRefFor(input);
  const sourceInputDigest = sourceInputDigestFor(input, normalizedSourceRef);
  const envelope = createRuntimeSignalEnvelope({
    signalKind: SOURCE_KIND_TO_SIGNAL_KIND[sourceKind],
    sourceTrustLevel: SOURCE_KIND_TO_TRUST_LEVEL[sourceKind],
    sourceSystem: input.sourceSystem,
    tenantRefDigest: normalizeOptionalDigest(input.tenantRefDigest, 'tenantRefDigest'),
    actorRefDigest: normalizeOptionalDigest(input.actorRefDigest, 'actorRefDigest'),
    runtimeRef: normalizeOptionalBoundedString(input.runtimeRef, 'runtimeRef'),
    traceId: input.traceId,
    runId: normalizeOptionalBoundedString(input.runId, 'runId'),
    eventTime: input.eventTime,
    actionSurface: normalizeOptionalBoundedString(input.actionSurface, 'actionSurface'),
    downstreamSystem: normalizeOptionalBoundedString(input.downstreamSystem, 'downstreamSystem'),
    operationRef: normalizedSourceRef,
    inputSchemaDigest: schemaDigestFor(input),
    argumentOrBodyDigest: argumentOrBodyDigestFor(input),
    policyRefs: input.policyRefs,
    evidenceRefs: input.evidenceRefs,
    approvalRefs: input.approvalRefs,
  });

  const payload = {
    version: RUNTIME_SIGNAL_NORMALIZER_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    sourceKind,
    normalizedSourceRef,
    sourceInputDigest,
    envelopeSignalDigest: envelope.signalDigest,
    digestOnly: true,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    envelope,
    canonical: canonical.canonical,
    normalizerDigest: canonical.digest,
  });
}

export function runtimeSignalNormalizerDescriptor(): RuntimeSignalNormalizerDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_NORMALIZER_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    sourceKinds: RUNTIME_SIGNAL_NORMALIZER_SOURCE_KINDS,
    requiredFields: RUNTIME_SIGNAL_NORMALIZER_REQUIRED_FIELDS,
    sourceKindToSignalKind: SOURCE_KIND_TO_SIGNAL_KIND,
    sourceKindToTrustLevel: SOURCE_KIND_TO_TRUST_LEVEL,
    digestOnly: true,
    rejectsUnknownInputFields: true,
    rejectsRawPayloadFields: true,
    sourceInputDigestRequired: true,
    declarationSourcesProduceDeclaredTrust: true,
    observationSourcesProduceObservedTrust: true,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-authority',
      'not-admission',
      'not-enforcement',
      'not-production-ready',
    ]),
  });
}
