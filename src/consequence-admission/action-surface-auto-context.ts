import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceDeclaration,
  ActionSurfaceDeclaredCredentialPosture,
} from './action-surface-profiler.js';
import {
  createActionSurfaceOnboardingPacket,
  type ActionSurfaceOnboardingPacket,
  type ActionSurfaceOnboardingReadinessOverride,
} from './action-surface-onboarding-packet.js';
import type {
  CreateGenericAdmissionInput,
} from './contracts.js';
import type {
  EvidenceStateKind,
} from './evidence-state-model.js';
import {
  type AttestorIntegrationMode,
} from './integration-mode-readiness.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  type ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const ACTION_SURFACE_AUTO_CONTEXT_VERSION =
  'attestor.action-surface-auto-context.v1';

export const ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS = [
  'mcp-tool-definition',
  'mcp-tool-call',
  'openapi-operation',
  'asyncapi-operation',
  'workflow-job',
  'otel-span',
  'cloudevents-event',
  'gateway-log',
] as const;
export type ActionSurfaceAutoContextSignalKind =
  typeof ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS[number];

export const ACTION_SURFACE_AUTO_CONTEXT_FIELDS = [
  'source-signal',
  'action-surface',
  'domain',
  'downstream-system',
  'operation-ref',
  'input-shape',
  'argument-digest',
  'policy-ref',
  'evidence-ref',
  'approval-ref',
  'receipt-ref',
  'credential-boundary',
  'enforcement-boundary',
] as const;
export type ActionSurfaceAutoContextField =
  typeof ACTION_SURFACE_AUTO_CONTEXT_FIELDS[number];

export interface ActionSurfaceAutoContextSignal {
  readonly signalKind: ActionSurfaceAutoContextSignalKind;
  readonly sourceRef?: string | null;
  readonly producerRef?: string | null;
  readonly observedAt?: string | null;
  readonly actor?: string | null;
  readonly downstreamSystem?: string | null;
  readonly action?: string | null;
  readonly domain?: ConsequenceAdmissionDomain | string | null;
  readonly credentialPosture?: ActionSurfaceDeclaredCredentialPosture | null;
  readonly integrationModeHint?: AttestorIntegrationMode | null;
  readonly toolName?: string | null;
  readonly toolInputSchema?: unknown;
  readonly toolArguments?: unknown;
  readonly operationId?: string | null;
  readonly method?: string | null;
  readonly path?: string | null;
  readonly channel?: string | null;
  readonly workflowRef?: string | null;
  readonly spanName?: string | null;
  readonly httpRoute?: string | null;
  readonly httpMethod?: string | null;
  readonly messagingDestination?: string | null;
  readonly cloudEventType?: string | null;
  readonly cloudEventSource?: string | null;
  readonly cloudEventSubject?: string | null;
}

export interface CreateActionSurfaceAutoContextInput {
  readonly generatedAt?: string | null;
  readonly defaultActor?: string | null;
  readonly defaultDomain?: ConsequenceAdmissionDomain | string | null;
  readonly defaultDownstreamSystem?: string | null;
  readonly signals: readonly ActionSurfaceAutoContextSignal[];
}

export interface ActionSurfaceAutoContextFieldState {
  readonly field: ActionSurfaceAutoContextField;
  readonly state: EvidenceStateKind;
  readonly reasonCodes: readonly string[];
}

export interface ActionSurfaceAutoContextCandidate {
  readonly candidateId: string;
  readonly signalKind: ActionSurfaceAutoContextSignalKind;
  readonly sourceRef: string | null;
  readonly producerRefDigest: string | null;
  readonly actionSurface: string;
  readonly domain: ConsequenceAdmissionDomain;
  readonly downstreamSystem: string;
  readonly action: string;
  readonly operationRef: string | null;
  readonly credentialPosture: ActionSurfaceDeclaredCredentialPosture;
  readonly integrationModeHint: AttestorIntegrationMode;
  readonly inputShapeDigest: string | null;
  readonly argumentDigest: string | null;
  readonly observedAt: string;
  readonly fieldStates: readonly ActionSurfaceAutoContextFieldState[];
  readonly missingFields: readonly ActionSurfaceAutoContextField[];
  readonly declaration: ActionSurfaceDeclaration;
  readonly genericAdmissionDraft: CreateGenericAdmissionInput;
  readonly reviewRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly digest: string;
}

export interface ActionSurfaceAutoContextResult {
  readonly version: typeof ACTION_SURFACE_AUTO_CONTEXT_VERSION;
  readonly generatedAt: string;
  readonly signalCount: number;
  readonly candidateCount: number;
  readonly candidates: readonly ActionSurfaceAutoContextCandidate[];
  readonly declarations: readonly ActionSurfaceDeclaration[];
  readonly genericAdmissionDrafts: readonly CreateGenericAdmissionInput[];
  readonly reviewChecklist: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceAutoContextDescriptor {
  readonly version: typeof ACTION_SURFACE_AUTO_CONTEXT_VERSION;
  readonly signalKinds: typeof ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS;
  readonly fields: typeof ACTION_SURFACE_AUTO_CONTEXT_FIELDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}

const WRITE_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Action surface auto-context ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeString(
  value: string | null | undefined,
  fallback: string,
): string {
  return normalizeOptionalString(value) ?? fallback;
}

function slug(value: string | null | undefined, fallback: string): string {
  const raw = value ?? fallback;
  const withCamelBreaks = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
  const normalized = withCamelBreaks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized || fallback;
}

function digestUnknown(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return hashCanonical(value as CanonicalReleaseJsonValue);
}

function digestString(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  return hashCanonical(normalized);
}

function textForInference(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function hasSeparatedToken(text: string, tokens: readonly string[]): boolean {
  return tokens.some((token) =>
    new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, 'u').test(text)
  );
}

function isKnownDomain(value: string | null | undefined): value is ConsequenceAdmissionDomain {
  return typeof value === 'string' &&
    (CONSEQUENCE_ADMISSION_DOMAINS as readonly string[]).includes(value);
}

function inferDomain(
  parts: readonly (string | null | undefined)[],
  fallback: ConsequenceAdmissionDomain | string | null | undefined,
): ConsequenceAdmissionDomain {
  const explicit = normalizeOptionalString(fallback ?? null);
  if (isKnownDomain(explicit)) return explicit;
  const text = textForInference(parts);
  if (hasSeparatedToken(text, [
    'refund',
    'payment',
    'payout',
    'invoice',
    'billing',
    'charge',
    'credit',
    'settlement',
  ])) {
    return 'money-movement';
  }
  if (hasSeparatedToken(text, [
    'wallet',
    'chain',
    'token',
    'contract',
    'transaction',
    'swap',
    'bridge',
    'custody',
    'safe',
    'userop',
  ])) {
    return 'programmable-money';
  }
  if (
    hasSeparatedToken(text, [
      'export',
      'download',
      'warehouse',
      'query',
      'report',
      'backup',
      'extract',
    ]) ||
    /customer[_ -]?data/u.test(text)
  ) {
    return 'data-disclosure';
  }
  if (hasSeparatedToken(text, ['filing', 'tax', 'regulatory', 'disclosure', 'legal', 'statutory'])) {
    return 'regulated-filing';
  }
  if (hasSeparatedToken(text, ['email', 'message', 'notify', 'notification', 'ticket', 'reply', 'sms', 'slack'])) {
    return 'external-communication';
  }
  if (hasSeparatedToken(text, ['role', 'permission', 'entitlement', 'admin', 'account', 'user', 'access', 'delegation'])) {
    return 'authority-change';
  }
  if (hasSeparatedToken(text, ['deploy', 'release', 'rollout', 'infra', 'cloud', 'secret', 'rotate', 'restart', 'incident', 'workflow'])) {
    return 'system-operation';
  }
  if (hasSeparatedToken(text, ['triage', 'recommend', 'analysis', 'analyze', 'briefing', 'score', 'classify'])) {
    return 'decision-support';
  }
  return 'custom';
}

function normalizeCredentialPosture(
  value: ActionSurfaceDeclaredCredentialPosture | null | undefined,
): ActionSurfaceDeclaredCredentialPosture {
  return value ?? 'unknown';
}

function integrationModeFor(
  signal: ActionSurfaceAutoContextSignal,
  method: string | null,
): AttestorIntegrationMode {
  if (signal.integrationModeHint) return signal.integrationModeHint;
  switch (signal.signalKind) {
    case 'mcp-tool-call':
    case 'mcp-tool-definition':
      return 'mcp-tool-gateway';
    case 'workflow-job':
      return 'sidecar-ext-authz';
    case 'openapi-operation':
    case 'gateway-log':
      return method && WRITE_HTTP_METHODS.has(method) ? 'gateway-proxy' : 'shadow-capture-sdk';
    case 'asyncapi-operation':
    case 'cloudevents-event':
    case 'otel-span':
      return 'shadow-capture-sdk';
  }
}

function methodFor(signal: ActionSurfaceAutoContextSignal): string | null {
  const method = normalizeOptionalString(signal.method ?? signal.httpMethod ?? null);
  return method ? method.toUpperCase() : null;
}

function primaryName(signal: ActionSurfaceAutoContextSignal): string {
  return normalizeString(
    signal.action ??
      signal.toolName ??
      signal.operationId ??
      signal.spanName ??
      signal.cloudEventType ??
      signal.workflowRef ??
      signal.path ??
      signal.channel ??
      signal.httpRoute,
    'unknown_action',
  );
}

function downstreamSystemFor(
  signal: ActionSurfaceAutoContextSignal,
  fallback: string | null,
): string {
  const selected = signal.downstreamSystem ??
    signal.cloudEventSource ??
    signal.messagingDestination ??
    fallback ??
    'unknown-system';
  return slug(selected, 'unknown_system');
}

function operationRefFor(
  signal: ActionSurfaceAutoContextSignal,
  method: string | null,
): string | null {
  if (signal.toolName) return `tool:${signal.toolName}`;
  if (method && signal.path) return `${method} ${signal.path}`;
  if (signal.operationId) return `operation:${signal.operationId}`;
  if (signal.channel) return `channel:${signal.channel}`;
  if (signal.workflowRef) return `workflow:${signal.workflowRef}`;
  if (signal.spanName) return `otel:${signal.spanName}`;
  if (signal.cloudEventType) return `cloudevent:${signal.cloudEventType}`;
  if (signal.httpRoute) return method ? `${method} ${signal.httpRoute}` : `route:${signal.httpRoute}`;
  return null;
}

function sourceKindFor(signalKind: ActionSurfaceAutoContextSignalKind): ActionSurfaceDeclaration['sourceKind'] {
  switch (signalKind) {
    case 'mcp-tool-call':
    case 'mcp-tool-definition':
      return 'mcp-tools';
    case 'openapi-operation':
      return 'openapi';
    case 'asyncapi-operation':
      return 'asyncapi';
    case 'workflow-job':
      return 'workflow-manifest';
    case 'otel-span':
    case 'cloudevents-event':
    case 'gateway-log':
      return 'provider-log';
  }
}

function fieldState(input: {
  readonly field: ActionSurfaceAutoContextField;
  readonly state: EvidenceStateKind;
  readonly reasonCodes: readonly string[];
}): ActionSurfaceAutoContextFieldState {
  return Object.freeze({
    field: input.field,
    state: input.state,
    reasonCodes: Object.freeze([...input.reasonCodes].sort()),
  });
}

function fieldStatesFor(input: {
  readonly signal: ActionSurfaceAutoContextSignal;
  readonly domainExplicit: boolean;
  readonly downstreamExplicit: boolean;
  readonly operationRef: string | null;
  readonly inputShapeDigest: string | null;
  readonly argumentDigest: string | null;
}): readonly ActionSurfaceAutoContextFieldState[] {
  return Object.freeze([
    fieldState({
      field: 'source-signal',
      state: 'observed',
      reasonCodes: ['auto-context-source-signal-observed'],
    }),
    fieldState({
      field: 'action-surface',
      state: 'inferred',
      reasonCodes: ['auto-context-action-surface-inferred'],
    }),
    fieldState({
      field: 'domain',
      state: input.domainExplicit ? 'observed' : 'inferred',
      reasonCodes: [
        input.domainExplicit
          ? 'auto-context-domain-observed'
          : 'auto-context-domain-inferred',
      ],
    }),
    fieldState({
      field: 'downstream-system',
      state: input.downstreamExplicit ? 'observed' : 'inferred',
      reasonCodes: [
        input.downstreamExplicit
          ? 'auto-context-downstream-observed'
          : 'auto-context-downstream-inferred',
      ],
    }),
    fieldState({
      field: 'operation-ref',
      state: input.operationRef ? 'observed' : 'missing',
      reasonCodes: [
        input.operationRef
          ? 'auto-context-operation-ref-observed'
          : 'auto-context-operation-ref-missing',
      ],
    }),
    fieldState({
      field: 'input-shape',
      state: input.inputShapeDigest ? 'observed' : 'missing',
      reasonCodes: [
        input.inputShapeDigest
          ? 'auto-context-input-shape-digest-observed'
          : 'auto-context-input-shape-missing',
      ],
    }),
    fieldState({
      field: 'argument-digest',
      state: input.argumentDigest ? 'observed' : 'missing',
      reasonCodes: [
        input.argumentDigest
          ? 'auto-context-argument-digest-observed'
          : 'auto-context-argument-digest-missing',
      ],
    }),
    fieldState({
      field: 'policy-ref',
      state: 'missing',
      reasonCodes: ['auto-context-policy-ref-missing'],
    }),
    fieldState({
      field: 'evidence-ref',
      state: 'missing',
      reasonCodes: ['auto-context-evidence-ref-missing'],
    }),
    fieldState({
      field: 'approval-ref',
      state: 'missing',
      reasonCodes: ['auto-context-approval-ref-missing'],
    }),
    fieldState({
      field: 'receipt-ref',
      state: 'missing',
      reasonCodes: ['auto-context-receipt-ref-missing'],
    }),
    fieldState({
      field: 'credential-boundary',
      state: input.signal.credentialPosture &&
        input.signal.credentialPosture !== 'unknown'
        ? 'observed'
        : 'missing',
      reasonCodes: [
        input.signal.credentialPosture && input.signal.credentialPosture !== 'unknown'
          ? 'auto-context-credential-boundary-observed'
          : 'auto-context-credential-boundary-missing',
      ],
    }),
    fieldState({
      field: 'enforcement-boundary',
      state: 'missing',
      reasonCodes: ['auto-context-enforcement-boundary-missing'],
    }),
  ]);
}

function missingFields(
  states: readonly ActionSurfaceAutoContextFieldState[],
): readonly ActionSurfaceAutoContextField[] {
  return Object.freeze(
    states
      .filter((state) =>
        state.state === 'missing' ||
        state.state === 'inferred' ||
        state.state === 'conflicting' ||
        state.state === 'untrusted' ||
        state.state === 'stale'
      )
      .map((state) => state.field),
  );
}

function candidateFor(input: {
  readonly signal: ActionSurfaceAutoContextSignal;
  readonly generatedAt: string;
  readonly defaultActor: string;
  readonly defaultDomain: ConsequenceAdmissionDomain | string | null | undefined;
  readonly defaultDownstreamSystem: string | null | undefined;
}): ActionSurfaceAutoContextCandidate {
  const signal = input.signal;
  if (!ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS.includes(signal.signalKind)) {
    throw new Error(
      `Action surface auto-context signalKind must be one of: ${ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS.join(', ')}.`,
    );
  }
  const method = methodFor(signal);
  const action = slug(primaryName(signal), 'unknown_action');
  const downstreamSystem = downstreamSystemFor(signal, input.defaultDownstreamSystem ?? null);
  const domain = inferDomain(
    [
      signal.domain ?? null,
      input.defaultDomain ?? null,
      signal.toolName,
      signal.operationId,
      signal.action,
      signal.path,
      signal.channel,
      signal.workflowRef,
      signal.spanName,
      signal.cloudEventType,
      signal.cloudEventSubject,
      signal.httpRoute,
    ],
    signal.domain ?? input.defaultDomain ?? null,
  );
  const integrationModeHint = integrationModeFor(signal, method);
  const actionSurface = `${downstreamSystem}.${action}`;
  const operationRef = operationRefFor(signal, method);
  const inputShapeDigest = digestUnknown(signal.toolInputSchema);
  const argumentDigest = digestUnknown(signal.toolArguments);
  const observedAt = normalizeIsoTimestamp(signal.observedAt, input.generatedAt, 'signals[].observedAt');
  const domainExplicit = isKnownDomain(normalizeOptionalString(signal.domain ?? null));
  const downstreamExplicit = normalizeOptionalString(signal.downstreamSystem ?? null) !== null;
  const fieldStates = fieldStatesFor({
    signal,
    domainExplicit,
    downstreamExplicit,
    operationRef,
    inputShapeDigest,
    argumentDigest,
  });
  const sourceRef = normalizeOptionalString(signal.sourceRef);
  const credentialPosture = normalizeCredentialPosture(signal.credentialPosture);
  const declaration: ActionSurfaceDeclaration = Object.freeze({
    sourceKind: sourceKindFor(signal.signalKind),
    actionSurface,
    domain,
    downstreamSystem,
    action,
    operationRef,
    method,
    path: normalizeOptionalString(signal.path ?? signal.httpRoute ?? null),
    channel: normalizeOptionalString(signal.channel ?? signal.messagingDestination ?? null),
    toolName: normalizeOptionalString(signal.toolName),
    workflowRef: normalizeOptionalString(signal.workflowRef),
    credentialPosture,
    integrationModeHint,
  });
  const candidateBase = {
    signalKind: signal.signalKind,
    sourceRef,
    producerRefDigest: digestString(signal.producerRef),
    actionSurface,
    domain,
    downstreamSystem,
    action,
    operationRef,
    credentialPosture,
    integrationModeHint,
    inputShapeDigest,
    argumentDigest,
    observedAt,
    fieldStates,
    missingFields: missingFields(fieldStates),
    declaration,
  } as const;
  const digest = hashCanonical(candidateBase as unknown as CanonicalReleaseJsonValue);
  const candidateId = `action-surface-auto-context:${digest}`;
  const genericAdmissionDraft: CreateGenericAdmissionInput = Object.freeze({
    mode: 'observe',
    actor: normalizeString(signal.actor, input.defaultActor),
    action,
    domain,
    downstreamSystem,
    requestedAt: observedAt,
    policyRef: null,
    evidenceRefs: [],
    nativeInputRefs: [candidateId],
    observedFeatures: {
      actionSurfaceAutoContext: true,
    },
    observedFeatureOrigins: {
      actionSurfaceAutoContext: 'attestor-runtime' as const,
    },
    summary:
      'Auto-context draft. Review policy, evidence, approval, receipt, credential, and enforcement gaps before any execution path.',
  });
  return Object.freeze({
    candidateId,
    ...candidateBase,
    genericAdmissionDraft,
    reviewRequired: true,
    autoEnforce: false,
    canGrantAuthority: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    digest,
  });
}

function reviewChecklist(
  candidates: readonly ActionSurfaceAutoContextCandidate[],
): readonly string[] {
  const checklist = new Set<string>();
  for (const candidate of candidates) {
    for (const field of candidate.missingFields) {
      checklist.add(field);
    }
  }
  return Object.freeze([...checklist].sort());
}

export function createActionSurfaceAutoContext(
  input: CreateActionSurfaceAutoContextInput,
): ActionSurfaceAutoContextResult {
  if (!Array.isArray(input.signals)) {
    throw new Error('Action surface auto-context requires signals.');
  }
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const defaultActor = normalizeString(input.defaultActor, 'unknown-actor');
  const candidates = Object.freeze(
    input.signals.map((signal) =>
      candidateFor({
        signal,
        generatedAt,
        defaultActor,
        defaultDomain: input.defaultDomain,
        defaultDownstreamSystem: input.defaultDownstreamSystem,
      })
    ),
  );
  const body = {
    version: ACTION_SURFACE_AUTO_CONTEXT_VERSION,
    generatedAt,
    signalCount: input.signals.length,
    candidateCount: candidates.length,
    candidates,
    declarations: Object.freeze(candidates.map((candidate) => candidate.declaration)),
    genericAdmissionDrafts: Object.freeze(candidates.map((candidate) =>
      candidate.genericAdmissionDraft
    )),
    reviewChecklist: reviewChecklist(candidates),
    approvalRequired: true,
    autoEnforce: false,
    canGrantAuthority: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createActionSurfaceAutoContextOnboardingPacket(input: {
  readonly autoContext: ActionSurfaceAutoContextResult;
  readonly attestorBaseUrl?: string | null;
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly readinessOverrides?: readonly ActionSurfaceOnboardingReadinessOverride[] | null;
}): ActionSurfaceOnboardingPacket {
  return createActionSurfaceOnboardingPacket({
    generatedAt: input.autoContext.generatedAt,
    attestorBaseUrl: input.attestorBaseUrl,
    declarations: input.autoContext.declarations,
    events: input.events ?? [],
    readinessOverrides: input.readinessOverrides ?? [],
  });
}

export function actionSurfaceAutoContextDescriptor(): ActionSurfaceAutoContextDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_AUTO_CONTEXT_VERSION,
    signalKinds: ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS,
    fields: ACTION_SURFACE_AUTO_CONTEXT_FIELDS,
    approvalRequired: true,
    autoEnforce: false,
    canGrantAuthority: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  });
}
