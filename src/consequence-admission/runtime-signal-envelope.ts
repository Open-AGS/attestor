import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const RUNTIME_SIGNAL_ENVELOPE_VERSION =
  'attestor.runtime-signal-envelope.v1';

export const RUNTIME_SIGNAL_KINDS = [
  'declaration',
  'observation',
  'proposed-action',
  'enforcement-proof',
] as const;
export type RuntimeSignalKind = typeof RUNTIME_SIGNAL_KINDS[number];

export const RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS = [
  'declared',
  'observed',
  'authenticated-source',
  'signed-or-bound',
  'customer-attested',
  'enforcement-proof',
] as const;
export type RuntimeSignalSourceTrustLevel =
  typeof RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS[number];

export const RUNTIME_SIGNAL_ENVELOPE_REQUIRED_FIELDS = [
  'signalKind',
  'sourceTrustLevel',
  'sourceSystem',
  'tenantRefDigest',
  'actorRefDigest',
  'runtimeRef',
  'traceId',
  'runId',
  'eventTime',
  'actionSurface',
  'downstreamSystem',
  'operationRef',
  'inputSchemaDigest',
  'argumentOrBodyDigest',
  'policyRefs',
  'evidenceRefs',
  'approvalRefs',
  'signalDigest',
] as const;
export type RuntimeSignalEnvelopeRequiredField =
  typeof RUNTIME_SIGNAL_ENVELOPE_REQUIRED_FIELDS[number];

export interface CreateRuntimeSignalEnvelopeInput {
  readonly signalKind: RuntimeSignalKind;
  readonly sourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly sourceSystem: string;
  readonly tenantRefDigest?: string | null;
  readonly actorRefDigest?: string | null;
  readonly runtimeRef?: string | null;
  readonly traceId?: string | null;
  readonly runId?: string | null;
  readonly eventTime: string;
  readonly actionSurface?: string | null;
  readonly downstreamSystem?: string | null;
  readonly operationRef?: string | null;
  readonly inputSchemaDigest?: string | null;
  readonly argumentOrBodyDigest?: string | null;
  readonly policyRefs?: readonly string[] | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly approvalRefs?: readonly string[] | null;
}

export interface RuntimeSignalEnvelope {
  readonly version: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly signalKind: RuntimeSignalKind;
  readonly sourceTrustLevel: RuntimeSignalSourceTrustLevel;
  readonly sourceSystem: string;
  readonly tenantRefDigest: string | null;
  readonly actorRefDigest: string | null;
  readonly runtimeRef: string | null;
  readonly traceId: string | null;
  readonly runId: string | null;
  readonly eventTime: string;
  readonly actionSurface: string | null;
  readonly downstreamSystem: string | null;
  readonly operationRef: string | null;
  readonly inputSchemaDigest: string | null;
  readonly argumentOrBodyDigest: string | null;
  readonly policyRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly approvalRefs: readonly string[];
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawCustomerIdentifierStored: false;
  readonly rawTenantIdentifierStored: false;
  readonly canGrantAuthority: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly signalDigest: string;
}

export interface RuntimeSignalEnvelopeDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly signalKinds: typeof RUNTIME_SIGNAL_KINDS;
  readonly sourceTrustLevels: typeof RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS;
  readonly requiredFields: typeof RUNTIME_SIGNAL_ENVELOPE_REQUIRED_FIELDS;
  readonly digestFirst: true;
  readonly rejectsUnknownInputFields: true;
  readonly canonicalDigestRequired: true;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly canGrantAuthority: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
}

const ALLOWED_INPUT_FIELDS = new Set([
  'signalKind',
  'sourceTrustLevel',
  'sourceSystem',
  'tenantRefDigest',
  'actorRefDigest',
  'runtimeRef',
  'traceId',
  'runId',
  'eventTime',
  'actionSurface',
  'downstreamSystem',
  'operationRef',
  'inputSchemaDigest',
  'argumentOrBodyDigest',
  'policyRefs',
  'evidenceRefs',
  'approvalRefs',
]);

const RAW_MATERIAL_PATTERNS = [
  /\bsk_(?:live|test)_[a-z0-9]/iu,
  /\bwhsec_[a-z0-9]/iu,
  /\bbearer\s+[a-z0-9._-]+/iu,
  /\bpostgres(?:ql)?:\/\//iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:api[_-]?key|password|secret)\s*[:=]/iu,
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

function assertNoUnknownInputFields(input: object): void {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUT_FIELDS.has(key)) {
      throw new Error(`Runtime signal envelope input contains unknown field: ${key}.`);
    }
  }
}

function assertNoRawMaterialMarker(value: string, fieldName: string): void {
  for (const pattern of RAW_MATERIAL_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Runtime signal envelope ${fieldName} must not contain raw sensitive material.`);
    }
  }
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`Runtime signal envelope ${fieldName} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function normalizeStableId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Runtime signal envelope ${fieldName} must be a stable lowercase id.`);
  }
  const normalized = value.trim();
  assertNoRawMaterialMarker(normalized, fieldName);
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/u.test(normalized)) {
    throw new Error(`Runtime signal envelope ${fieldName} must be a stable lowercase id.`);
  }
  return normalized;
}

function normalizeOptionalBoundedString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Runtime signal envelope ${fieldName} must be a bounded string.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  assertNoRawMaterialMarker(normalized, fieldName);
  if (
    normalized.length > 256 ||
    /[\u0000-\u001f\u007f]/u.test(normalized) ||
    /^[{[]/u.test(normalized)
  ) {
    throw new Error(`Runtime signal envelope ${fieldName} must be bounded metadata.`);
  }
  return normalized;
}

function normalizeOptionalDigest(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Runtime signal envelope ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeTraceId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{32}$/u.test(value) ||
    value === '00000000000000000000000000000000'
  ) {
    throw new Error('Runtime signal envelope traceId must be a non-zero W3C trace-id.');
  }
  return value;
}

function normalizeEventTime(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Runtime signal envelope eventTime must be an ISO timestamp.');
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Runtime signal envelope eventTime must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function normalizeReference(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Runtime signal envelope ${fieldName} entries must be stable references.`);
  }
  const normalized = value.trim();
  assertNoRawMaterialMarker(normalized, fieldName);
  if (!/^[a-z][a-z0-9_.:-]{1,127}$/u.test(normalized)) {
    throw new Error(`Runtime signal envelope ${fieldName} entries must be stable references.`);
  }
  return normalized;
}

function normalizeReferenceList(
  value: readonly string[] | null | undefined,
  fieldName: string,
): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Runtime signal envelope ${fieldName} must be a reference list.`);
  }
  return Object.freeze([...new Set(value.map((entry) =>
    normalizeReference(entry, fieldName)
  ))].sort());
}

function assertTrustBoundary(
  signalKind: RuntimeSignalKind,
  sourceTrustLevel: RuntimeSignalSourceTrustLevel,
): void {
  if (signalKind === 'enforcement-proof' && sourceTrustLevel !== 'enforcement-proof') {
    throw new Error('Runtime signal envelope enforcement-proof signals must use enforcement-proof trust.');
  }
  if (signalKind !== 'enforcement-proof' && sourceTrustLevel === 'enforcement-proof') {
    throw new Error('Runtime signal envelope enforcement-proof trust is only valid for enforcement-proof signals.');
  }
}

export function createRuntimeSignalEnvelope(
  input: CreateRuntimeSignalEnvelopeInput,
): RuntimeSignalEnvelope {
  assertNoUnknownInputFields(input);

  const signalKind = normalizeEnum(
    input.signalKind,
    RUNTIME_SIGNAL_KINDS,
    'signalKind',
  );
  const sourceTrustLevel = normalizeEnum(
    input.sourceTrustLevel,
    RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS,
    'sourceTrustLevel',
  );
  assertTrustBoundary(signalKind, sourceTrustLevel);

  const payload = {
    version: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    signalKind,
    sourceTrustLevel,
    sourceSystem: normalizeStableId(input.sourceSystem, 'sourceSystem'),
    tenantRefDigest: normalizeOptionalDigest(input.tenantRefDigest, 'tenantRefDigest'),
    actorRefDigest: normalizeOptionalDigest(input.actorRefDigest, 'actorRefDigest'),
    runtimeRef: normalizeOptionalBoundedString(input.runtimeRef, 'runtimeRef'),
    traceId: normalizeTraceId(input.traceId),
    runId: normalizeOptionalBoundedString(input.runId, 'runId'),
    eventTime: normalizeEventTime(input.eventTime),
    actionSurface: normalizeOptionalBoundedString(input.actionSurface, 'actionSurface'),
    downstreamSystem: normalizeOptionalBoundedString(input.downstreamSystem, 'downstreamSystem'),
    operationRef: normalizeOptionalBoundedString(input.operationRef, 'operationRef'),
    inputSchemaDigest: normalizeOptionalDigest(input.inputSchemaDigest, 'inputSchemaDigest'),
    argumentOrBodyDigest: normalizeOptionalDigest(input.argumentOrBodyDigest, 'argumentOrBodyDigest'),
    policyRefs: normalizeReferenceList(input.policyRefs, 'policyRefs'),
    evidenceRefs: normalizeReferenceList(input.evidenceRefs, 'evidenceRefs'),
    approvalRefs: normalizeReferenceList(input.approvalRefs, 'approvalRefs'),
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    rawCustomerIdentifierStored: false,
    rawTenantIdentifierStored: false,
    canGrantAuthority: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;

  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    signalDigest: canonical.digest,
  });
}

export function runtimeSignalEnvelopeDescriptor(): RuntimeSignalEnvelopeDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    signalKinds: RUNTIME_SIGNAL_KINDS,
    sourceTrustLevels: RUNTIME_SIGNAL_SOURCE_TRUST_LEVELS,
    requiredFields: RUNTIME_SIGNAL_ENVELOPE_REQUIRED_FIELDS,
    digestFirst: true,
    rejectsUnknownInputFields: true,
    canonicalDigestRequired: true,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    canGrantAuthority: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-authority',
      'not-admission',
      'not-proof-by-itself',
      'not-enforcement',
      'not-production-ready',
    ]),
  });
}
