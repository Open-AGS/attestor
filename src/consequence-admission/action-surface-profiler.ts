import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  type AttestorIntegrationMode,
} from './integration-mode-readiness.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';
import type {
  ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const ACTION_SURFACE_PROFILER_VERSION =
  'attestor.action-surface-profiler.v1';

export const ACTION_SURFACE_DISCOVERY_SOURCE_KINDS = [
  'shadow-events',
  'openapi',
  'asyncapi',
  'mcp-tools',
  'workflow-manifest',
  'provider-log',
  'manual',
] as const;
export type ActionSurfaceDiscoverySourceKind =
  typeof ACTION_SURFACE_DISCOVERY_SOURCE_KINDS[number];

export const ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES = [
  'unknown',
  'none',
  'agent-held-static-secret',
  'agent-held-scoped-secret',
  'short-lived-downscoped-token',
  'gateway-held-secret',
  'provider-native-delegation',
] as const;
export type ActionSurfaceDeclaredCredentialPosture =
  typeof ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES[number];

export const ACTION_SURFACE_PROFILE_SIGNALS = [
  'observed-shadow-traffic',
  'declared-only',
  'unobserved-declaration',
  'missing-policy',
  'missing-evidence',
  'missing-authority',
  'missing-scope',
  'adapter-readiness-missing',
  'direct-credential-risk',
  'http-write-operation',
  'async-operation',
  'mcp-tool-surface',
  'workflow-execution',
  'provider-native-surface',
  'manual-declaration',
  'candidate-for-shadow-capture',
  'candidate-for-gateway',
] as const;
export type ActionSurfaceProfileSignal =
  typeof ACTION_SURFACE_PROFILE_SIGNALS[number];

export const ACTION_SURFACE_PROFILE_NEXT_STEPS = [
  'add-shadow-capture',
  'bind-policy',
  'bind-evidence',
  'bind-authority',
  'bind-scope',
  'prepare-adapter',
  'isolate-credential',
  'generate-gateway-config',
  'evaluate-integration-readiness',
] as const;
export type ActionSurfaceProfileNextStep =
  typeof ACTION_SURFACE_PROFILE_NEXT_STEPS[number];

export interface ActionSurfaceDeclaration {
  readonly sourceKind: ActionSurfaceDiscoverySourceKind;
  readonly actionSurface: string;
  readonly domain?: ConsequenceAdmissionDomain | string | null;
  readonly downstreamSystem?: string | null;
  readonly action?: string | null;
  readonly operationRef?: string | null;
  readonly method?: string | null;
  readonly path?: string | null;
  readonly channel?: string | null;
  readonly toolName?: string | null;
  readonly workflowRef?: string | null;
  readonly credentialPosture?: ActionSurfaceDeclaredCredentialPosture | null;
  readonly integrationModeHint?: AttestorIntegrationMode | null;
}

export interface CreateActionSurfaceProfileInput {
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly declarations?: readonly ActionSurfaceDeclaration[] | null;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceProfile {
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly action: string | null;
  readonly sourceKinds: readonly ActionSurfaceDiscoverySourceKind[];
  readonly eventCount: number;
  readonly declarationCount: number;
  readonly actorCount: number;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly modeCounts: Readonly<Record<string, number>>;
  readonly decisionCounts: Readonly<Record<string, number>>;
  readonly reasonCodeCounts: Readonly<Record<string, number>>;
  readonly operationRefs: readonly string[];
  readonly credentialPosture: ActionSurfaceDeclaredCredentialPosture;
  readonly recommendedIntegrationMode: AttestorIntegrationMode;
  readonly signals: readonly ActionSurfaceProfileSignal[];
  readonly nextStep: ActionSurfaceProfileNextStep;
  readonly rawPayloadStored: false;
  readonly eventDigests: readonly string[];
  readonly declarationDigest: string;
}

export interface ActionSurfaceProfilerReport {
  readonly version: typeof ACTION_SURFACE_PROFILER_VERSION;
  readonly generatedAt: string;
  readonly surfaceCount: number;
  readonly observedSurfaceCount: number;
  readonly declaredSurfaceCount: number;
  readonly unobservedDeclaredSurfaceCount: number;
  readonly eventCount: number;
  readonly declarationCount: number;
  readonly profiles: readonly ActionSurfaceProfile[];
  readonly sourceKinds: readonly ActionSurfaceDiscoverySourceKind[];
  readonly recommendedNextSteps: readonly ActionSurfaceProfileNextStep[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceProfilerDescriptor {
  readonly version: typeof ACTION_SURFACE_PROFILER_VERSION;
  readonly sourceKinds: typeof ACTION_SURFACE_DISCOVERY_SOURCE_KINDS;
  readonly credentialPostures: typeof ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}

interface MutableProfile {
  actionSurface: string;
  domain: string | null;
  downstreamSystem: string | null;
  action: string | null;
  sourceKinds: Set<ActionSurfaceDiscoverySourceKind>;
  declarations: ActionSurfaceDeclaration[];
  actors: Set<string>;
  eventCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  modeCounts: Record<string, number>;
  decisionCounts: Record<string, number>;
  reasonCodeCounts: Record<string, number>;
  operationRefs: Set<string>;
  credentialPostures: Set<ActionSurfaceDeclaredCredentialPosture>;
  integrationModeHints: Set<AttestorIntegrationMode>;
  eventDigests: string[];
}

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
    throw new Error(`Action surface profiler ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeString(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Action surface profiler ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Action surface profiler ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalString(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeString(value, fieldName);
}

function normalizeSourceKind(
  value: ActionSurfaceDiscoverySourceKind,
): ActionSurfaceDiscoverySourceKind {
  if (!ACTION_SURFACE_DISCOVERY_SOURCE_KINDS.includes(value)) {
    throw new Error(
      `Action surface profiler sourceKind must be one of: ${ACTION_SURFACE_DISCOVERY_SOURCE_KINDS.join(', ')}.`,
    );
  }
  return value;
}

function normalizeCredentialPosture(
  value: ActionSurfaceDeclaredCredentialPosture | null | undefined,
): ActionSurfaceDeclaredCredentialPosture {
  if (value === undefined || value === null) return 'unknown';
  if (!ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES.includes(value)) {
    throw new Error(
      `Action surface profiler credentialPosture must be one of: ${ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES.join(', ')}.`,
    );
  }
  return value;
}

function normalizeIntegrationModeHint(
  value: AttestorIntegrationMode | null | undefined,
): AttestorIntegrationMode | null {
  if (value === undefined || value === null) return null;
  return value;
}

function normalizeDeclaration(declaration: ActionSurfaceDeclaration): ActionSurfaceDeclaration {
  return Object.freeze({
    sourceKind: normalizeSourceKind(declaration.sourceKind),
    actionSurface: normalizeString(declaration.actionSurface, 'declarations[].actionSurface'),
    domain: normalizeOptionalString(declaration.domain, 'declarations[].domain'),
    downstreamSystem: normalizeOptionalString(declaration.downstreamSystem, 'declarations[].downstreamSystem'),
    action: normalizeOptionalString(declaration.action, 'declarations[].action'),
    operationRef: normalizeOptionalString(declaration.operationRef, 'declarations[].operationRef'),
    method: normalizeOptionalString(declaration.method, 'declarations[].method'),
    path: normalizeOptionalString(declaration.path, 'declarations[].path'),
    channel: normalizeOptionalString(declaration.channel, 'declarations[].channel'),
    toolName: normalizeOptionalString(declaration.toolName, 'declarations[].toolName'),
    workflowRef: normalizeOptionalString(declaration.workflowRef, 'declarations[].workflowRef'),
    credentialPosture: normalizeCredentialPosture(declaration.credentialPosture),
    integrationModeHint: normalizeIntegrationModeHint(declaration.integrationModeHint),
  });
}

function incrementCount(
  counts: Record<string, number>,
  value: string | null | undefined,
): void {
  const key = value ?? 'none';
  counts[key] = (counts[key] ?? 0) + 1;
}

function profileKey(domain: string | null, actionSurface: string): string {
  return `${domain ?? 'unknown'}\n${actionSurface}`;
}

function surfaceNameFor(event: ShadowAdmissionEvent): string {
  return event.actionSurface ?? `${event.downstreamSystem}.${event.action}`;
}

function createMutableProfile(input: {
  readonly actionSurface: string;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly action: string | null;
}): MutableProfile {
  return {
    actionSurface: input.actionSurface,
    domain: input.domain,
    downstreamSystem: input.downstreamSystem,
    action: input.action,
    sourceKinds: new Set<ActionSurfaceDiscoverySourceKind>(),
    declarations: [],
    actors: new Set<string>(),
    eventCount: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    modeCounts: {},
    decisionCounts: {},
    reasonCodeCounts: {},
    operationRefs: new Set<string>(),
    credentialPostures: new Set<ActionSurfaceDeclaredCredentialPosture>(),
    integrationModeHints: new Set<AttestorIntegrationMode>(),
    eventDigests: [],
  };
}

function getOrCreateProfile(
  profiles: Map<string, MutableProfile>,
  input: {
    readonly actionSurface: string;
    readonly domain: string | null;
    readonly downstreamSystem: string | null;
    readonly action: string | null;
  },
): MutableProfile {
  const key = profileKey(input.domain, input.actionSurface);
  const existing = profiles.get(key);
  if (existing) {
    if (existing.downstreamSystem === null && input.downstreamSystem !== null) {
      existing.downstreamSystem = input.downstreamSystem;
    }
    if (existing.action === null && input.action !== null) {
      existing.action = input.action;
    }
    return existing;
  }
  const created = createMutableProfile(input);
  profiles.set(key, created);
  return created;
}

function addEvent(profile: MutableProfile, event: ShadowAdmissionEvent): void {
  profile.sourceKinds.add('shadow-events');
  profile.actors.add(event.actor);
  profile.eventCount += 1;
  profile.firstSeenAt =
    profile.firstSeenAt === null || event.occurredAt < profile.firstSeenAt
      ? event.occurredAt
      : profile.firstSeenAt;
  profile.lastSeenAt =
    profile.lastSeenAt === null || event.occurredAt > profile.lastSeenAt
      ? event.occurredAt
      : profile.lastSeenAt;
  incrementCount(profile.modeCounts, event.mode);
  incrementCount(profile.decisionCounts, event.effectiveDecision);
  for (const reasonCode of event.reasonCodes) {
    incrementCount(profile.reasonCodeCounts, reasonCode);
  }
  profile.eventDigests.push(event.digest);
}

function operationRefFor(declaration: ActionSurfaceDeclaration): string | null {
  if (declaration.operationRef) return declaration.operationRef;
  if (declaration.method && declaration.path) {
    return `${declaration.method.toUpperCase()} ${declaration.path}`;
  }
  if (declaration.channel) return `channel:${declaration.channel}`;
  if (declaration.toolName) return `tool:${declaration.toolName}`;
  if (declaration.workflowRef) return `workflow:${declaration.workflowRef}`;
  return null;
}

function addDeclaration(profile: MutableProfile, declaration: ActionSurfaceDeclaration): void {
  profile.sourceKinds.add(declaration.sourceKind);
  profile.declarations.push(declaration);
  const operationRef = operationRefFor(declaration);
  if (operationRef) profile.operationRefs.add(operationRef);
  profile.credentialPostures.add(normalizeCredentialPosture(declaration.credentialPosture));
  if (declaration.integrationModeHint) {
    profile.integrationModeHints.add(declaration.integrationModeHint);
  }
  if (profile.domain === null && declaration.domain) {
    profile.domain = declaration.domain;
  }
  if (profile.downstreamSystem === null && declaration.downstreamSystem) {
    profile.downstreamSystem = declaration.downstreamSystem;
  }
  if (profile.action === null && declaration.action) {
    profile.action = declaration.action;
  }
}

function freezeCounts(counts: Record<string, number>): Readonly<Record<string, number>> {
  return Object.freeze({ ...counts });
}

function strongestCredentialPosture(
  postures: Set<ActionSurfaceDeclaredCredentialPosture>,
): ActionSurfaceDeclaredCredentialPosture {
  if (postures.has('agent-held-static-secret')) return 'agent-held-static-secret';
  if (postures.has('agent-held-scoped-secret')) return 'agent-held-scoped-secret';
  if (postures.has('unknown') || postures.size === 0) return 'unknown';
  if (postures.has('short-lived-downscoped-token')) return 'short-lived-downscoped-token';
  if (postures.has('gateway-held-secret')) return 'gateway-held-secret';
  if (postures.has('provider-native-delegation')) return 'provider-native-delegation';
  return 'none';
}

function hasReason(profile: MutableProfile, reasonCode: string): boolean {
  return (profile.reasonCodeCounts[reasonCode] ?? 0) > 0;
}

function profileSignals(
  profile: MutableProfile,
  credentialPosture: ActionSurfaceDeclaredCredentialPosture,
): readonly ActionSurfaceProfileSignal[] {
  const signals = new Set<ActionSurfaceProfileSignal>();
  if (profile.eventCount > 0) signals.add('observed-shadow-traffic');
  if (profile.declarations.length > 0 && profile.eventCount === 0) {
    signals.add('declared-only');
    signals.add('unobserved-declaration');
    signals.add('candidate-for-shadow-capture');
  }
  if (hasReason(profile, 'policy-ref-missing')) signals.add('missing-policy');
  if (hasReason(profile, 'evidence-ref-missing')) signals.add('missing-evidence');
  if (
    hasReason(profile, 'authority-ref-missing') ||
    hasReason(profile, 'authority-mode-missing')
  ) {
    signals.add('missing-authority');
  }
  if (
    hasReason(profile, 'amount-scope-missing') ||
    hasReason(profile, 'recipient-scope-missing') ||
    hasReason(profile, 'data-scope-missing') ||
    hasReason(profile, 'custom-domain-review-required')
  ) {
    signals.add('missing-scope');
  }
  if (hasReason(profile, 'adapter-readiness-missing')) signals.add('adapter-readiness-missing');
  if (
    credentialPosture === 'agent-held-static-secret' ||
    credentialPosture === 'agent-held-scoped-secret'
  ) {
    signals.add('direct-credential-risk');
  }
  if (profile.sourceKinds.has('mcp-tools')) signals.add('mcp-tool-surface');
  if (profile.sourceKinds.has('asyncapi')) signals.add('async-operation');
  if (profile.sourceKinds.has('workflow-manifest')) signals.add('workflow-execution');
  if (profile.sourceKinds.has('provider-log')) signals.add('provider-native-surface');
  if (profile.sourceKinds.has('manual')) signals.add('manual-declaration');
  if (profile.declarations.some((declaration) =>
    declaration.sourceKind === 'openapi' &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes((declaration.method ?? '').toUpperCase())
  )) {
    signals.add('http-write-operation');
  }
  if (
    profile.sourceKinds.has('openapi') ||
    profile.sourceKinds.has('mcp-tools') ||
    profile.sourceKinds.has('provider-log')
  ) {
    signals.add('candidate-for-gateway');
  }
  return Object.freeze([...signals].sort());
}

function recommendedMode(
  profile: MutableProfile,
  signals: readonly ActionSurfaceProfileSignal[],
): AttestorIntegrationMode {
  const hint = [...profile.integrationModeHints].sort()[0];
  if (hint) return hint;
  if (signals.includes('mcp-tool-surface')) return 'mcp-tool-gateway';
  if (signals.includes('provider-native-surface')) return 'provider-native-connector';
  if (signals.includes('http-write-operation')) return 'gateway-proxy';
  if (signals.includes('workflow-execution')) return 'sidecar-ext-authz';
  if (signals.includes('observed-shadow-traffic')) return 'shadow-capture-sdk';
  return 'advisory-api';
}

function nextStepFor(
  signals: readonly ActionSurfaceProfileSignal[],
  mode: AttestorIntegrationMode,
): ActionSurfaceProfileNextStep {
  if (signals.includes('direct-credential-risk')) return 'isolate-credential';
  if (signals.includes('unobserved-declaration')) return 'add-shadow-capture';
  if (signals.includes('missing-policy')) return 'bind-policy';
  if (signals.includes('missing-evidence')) return 'bind-evidence';
  if (signals.includes('missing-authority')) return 'bind-authority';
  if (signals.includes('missing-scope')) return 'bind-scope';
  if (signals.includes('adapter-readiness-missing')) return 'prepare-adapter';
  if (
    mode === 'gateway-proxy' ||
    mode === 'mcp-tool-gateway' ||
    mode === 'sidecar-ext-authz' ||
    mode === 'provider-native-connector'
  ) {
    return 'generate-gateway-config';
  }
  return 'evaluate-integration-readiness';
}

function declarationDigestFor(declarations: readonly ActionSurfaceDeclaration[]): string {
  return hashCanonical({
    declarations: [...declarations].sort((left, right) =>
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.sourceKind.localeCompare(right.sourceKind)
    ),
  } as unknown as CanonicalReleaseJsonValue);
}

function surfaceIdFor(profile: MutableProfile): string {
  return `action-surface:${hashCanonical({
    actionSurface: profile.actionSurface,
    domain: profile.domain,
    downstreamSystem: profile.downstreamSystem,
    action: profile.action,
  } as unknown as CanonicalReleaseJsonValue)}`;
}

function freezeProfile(profile: MutableProfile): ActionSurfaceProfile {
  const credentialPosture = strongestCredentialPosture(profile.credentialPostures);
  const signals = profileSignals(profile, credentialPosture);
  const recommendedIntegrationMode = recommendedMode(profile, signals);
  return Object.freeze({
    surfaceId: surfaceIdFor(profile),
    actionSurface: profile.actionSurface,
    domain: profile.domain,
    downstreamSystem: profile.downstreamSystem,
    action: profile.action,
    sourceKinds: Object.freeze([...profile.sourceKinds].sort()),
    eventCount: profile.eventCount,
    declarationCount: profile.declarations.length,
    actorCount: profile.actors.size,
    firstSeenAt: profile.firstSeenAt,
    lastSeenAt: profile.lastSeenAt,
    modeCounts: freezeCounts(profile.modeCounts),
    decisionCounts: freezeCounts(profile.decisionCounts),
    reasonCodeCounts: freezeCounts(profile.reasonCodeCounts),
    operationRefs: Object.freeze([...profile.operationRefs].sort()),
    credentialPosture,
    recommendedIntegrationMode,
    signals,
    nextStep: nextStepFor(signals, recommendedIntegrationMode),
    rawPayloadStored: false,
    eventDigests: Object.freeze([...profile.eventDigests].sort()),
    declarationDigest: declarationDigestFor(profile.declarations),
  });
}

function reportSourceKinds(profiles: readonly ActionSurfaceProfile[]): readonly ActionSurfaceDiscoverySourceKind[] {
  const sourceKinds = new Set<ActionSurfaceDiscoverySourceKind>();
  for (const profile of profiles) {
    for (const sourceKind of profile.sourceKinds) {
      sourceKinds.add(sourceKind);
    }
  }
  return Object.freeze([...sourceKinds].sort());
}

function recommendedNextSteps(
  profiles: readonly ActionSurfaceProfile[],
): readonly ActionSurfaceProfileNextStep[] {
  return Object.freeze([...new Set(profiles.map((profile) => profile.nextStep))].sort());
}

export function createActionSurfaceProfilerReport(
  input: CreateActionSurfaceProfileInput,
): ActionSurfaceProfilerReport {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const profilesByKey = new Map<string, MutableProfile>();

  for (const event of input.events ?? []) {
    const actionSurface = surfaceNameFor(event);
    const profile = getOrCreateProfile(profilesByKey, {
      actionSurface,
      domain: event.domain,
      downstreamSystem: event.downstreamSystem,
      action: event.action,
    });
    addEvent(profile, event);
  }

  const declarations = (input.declarations ?? []).map(normalizeDeclaration);
  for (const declaration of declarations) {
    const profile = getOrCreateProfile(profilesByKey, {
      actionSurface: declaration.actionSurface,
      domain: declaration.domain ?? null,
      downstreamSystem: declaration.downstreamSystem ?? null,
      action: declaration.action ?? null,
    });
    addDeclaration(profile, declaration);
  }

  const profiles = Object.freeze(
    [...profilesByKey.values()]
      .map(freezeProfile)
      .sort((left, right) =>
        right.eventCount - left.eventCount ||
        left.actionSurface.localeCompare(right.actionSurface)
      ),
  );
  const payload = {
    version: ACTION_SURFACE_PROFILER_VERSION as typeof ACTION_SURFACE_PROFILER_VERSION,
    generatedAt,
    surfaceCount: profiles.length,
    observedSurfaceCount: profiles.filter((profile) => profile.eventCount > 0).length,
    declaredSurfaceCount: profiles.filter((profile) => profile.declarationCount > 0).length,
    unobservedDeclaredSurfaceCount: profiles.filter((profile) =>
      profile.declarationCount > 0 && profile.eventCount === 0
    ).length,
    eventCount: input.events?.length ?? 0,
    declarationCount: declarations.length,
    profiles,
    sourceKinds: reportSourceKinds(profiles),
    recommendedNextSteps: recommendedNextSteps(profiles),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceProfilerDescriptor(): ActionSurfaceProfilerDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_PROFILER_VERSION,
    sourceKinds: ACTION_SURFACE_DISCOVERY_SOURCE_KINDS,
    credentialPostures: ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  });
}
