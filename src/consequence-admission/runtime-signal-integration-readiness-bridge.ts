import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
  type AttestorCredentialIsolationPosture,
  type AttestorGeneratedIntegrationArtifactKind,
  type AttestorIntegrationMode,
  type AttestorIntegrationModeReadiness,
  type AttestorIntegrationModeSignals,
  evaluateAttestorIntegrationModeReadiness,
} from './integration-mode-readiness.js';
import {
  RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
  assertRuntimeSignalAuthorityBoundary,
} from './runtime-signal-authority-guard.js';
import {
  RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
  mapRuntimeSignalToConsequenceCandidate,
  type RuntimeSignalConsequenceCandidate,
} from './runtime-signal-consequence-mapping.js';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  type RuntimeSignalEnvelope,
} from './runtime-signal-envelope.js';
import type {
  ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION =
  'attestor.runtime-signal-integration-readiness-bridge.v1';

export const RUNTIME_SIGNAL_GATE_PLACEMENT_KINDS = [
  'advisory-only',
  'shadow-capture',
  'sdk-pre-execution',
  'http-gateway-proxy',
  'mcp-tool-gateway',
  'sidecar-ext-authz',
  'provider-native-connector',
] as const;
export type RuntimeSignalGatePlacementKind =
  typeof RUNTIME_SIGNAL_GATE_PLACEMENT_KINDS[number];

export interface CreateRuntimeSignalIntegrationReadinessBridgeInput {
  readonly envelope: RuntimeSignalEnvelope;
  readonly candidate?: RuntimeSignalConsequenceCandidate | null;
  readonly workflowId?: string | null;
  readonly modeHint?: AttestorIntegrationMode | null;
  readonly credentialIsolationHint?: AttestorCredentialIsolationPosture | null;
  readonly controlSignals?: AttestorIntegrationModeSignals | null;
  readonly generatedArtifacts?: readonly AttestorGeneratedIntegrationArtifactKind[] | null;
  readonly generatedAt?: string | null;
}

export interface RuntimeSignalIntegrationReadinessBridge {
  readonly version: typeof RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly runtimeSignalConsequenceMappingVersion: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly integrationModeReadinessVersion: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly sourceSignalDigest: string;
  readonly candidateDigest: string;
  readonly workflowId: string;
  readonly mode: AttestorIntegrationMode;
  readonly credentialIsolation: AttestorCredentialIsolationPosture;
  readonly gatePlacement: RuntimeSignalGatePlacementKind;
  readonly actionSurface: string;
  readonly domain: ConsequenceAdmissionDomain;
  readonly downstreamSystem: string | null;
  readonly signalsApplied: AttestorIntegrationModeSignals;
  readonly readiness: AttestorIntegrationModeReadiness;
  readonly runtimeSignalBridgeUsesExistingReadinessEvaluator: true;
  readonly runtimeSignalAloneCanClaimNonBypassable: false;
  readonly credentialIsolationInferredFromSignal: false;
  readonly generatedArtifactsNeedReview: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface RuntimeSignalIntegrationReadinessBridgeDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly runtimeSignalConsequenceMappingVersion: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly integrationModeReadinessVersion: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly gatePlacementKinds: typeof RUNTIME_SIGNAL_GATE_PLACEMENT_KINDS;
  readonly usesExistingReadinessEvaluator: true;
  readonly runtimeSignalAloneCanClaimNonBypassable: false;
  readonly credentialIsolationInferredFromSignal: false;
  readonly generatedArtifactsNeedReview: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
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

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function httpMethod(operationRef: string | null): string | null {
  const value = normalizeOptionalString(operationRef);
  if (!value) return null;
  const separator = value.indexOf(' ');
  if (separator <= 0) return null;
  const method = value.slice(0, separator).toUpperCase();
  return WRITE_HTTP_METHODS.has(method) ? method : null;
}

function consequenceDomainFor(
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

function modeForRuntimeSignal(input: {
  readonly envelope: RuntimeSignalEnvelope;
  readonly modeHint?: AttestorIntegrationMode | null;
}): AttestorIntegrationMode {
  if (input.modeHint) return input.modeHint;
  const operationRef = input.envelope.operationRef ?? '';
  if (operationRef.startsWith('mcp.tool:')) return 'mcp-tool-gateway';
  if (httpMethod(operationRef)) return 'gateway-proxy';
  if (input.envelope.signalKind === 'proposed-action') return 'sdk-gate';
  if (input.envelope.signalKind === 'observation') return 'shadow-capture-sdk';
  return 'advisory-api';
}

function gatePlacementFor(mode: AttestorIntegrationMode): RuntimeSignalGatePlacementKind {
  switch (mode) {
    case 'advisory-api':
      return 'advisory-only';
    case 'shadow-capture-sdk':
      return 'shadow-capture';
    case 'sdk-gate':
      return 'sdk-pre-execution';
    case 'gateway-proxy':
      return 'http-gateway-proxy';
    case 'mcp-tool-gateway':
      return 'mcp-tool-gateway';
    case 'sidecar-ext-authz':
      return 'sidecar-ext-authz';
    case 'provider-native-connector':
      return 'provider-native-connector';
  }
}

function credentialIsolationFor(input: {
  readonly mode: AttestorIntegrationMode;
  readonly hint?: AttestorCredentialIsolationPosture | null;
}): AttestorCredentialIsolationPosture {
  if (input.hint) return input.hint;
  if (input.mode === 'shadow-capture-sdk') return 'not-required';
  return 'agent-held-static-secret';
}

function inferredSignalsFor(
  envelope: RuntimeSignalEnvelope,
): AttestorIntegrationModeSignals {
  switch (envelope.signalKind) {
    case 'declaration':
      return Object.freeze({});
    case 'observation':
      return Object.freeze({
        shadowCaptureObserved: true,
      });
    case 'proposed-action':
      return Object.freeze({
        admissionCallObserved: true,
      });
    case 'enforcement-proof':
      throw new Error('Runtime signal integration readiness bridge leaves enforcement-proof signals for RS10 proof intake.');
  }
}

function mergeSignals(
  inferred: AttestorIntegrationModeSignals,
  explicit: AttestorIntegrationModeSignals | null | undefined,
): AttestorIntegrationModeSignals {
  return Object.freeze({
    ...inferred,
    ...explicit,
  });
}

function workflowIdFor(input: {
  readonly workflowId?: string | null;
  readonly envelope: RuntimeSignalEnvelope;
}): string {
  const explicit = normalizeOptionalString(input.workflowId);
  if (explicit) return explicit;
  return `runtime-signal:${input.envelope.signalDigest.slice(7, 23)}`;
}

export function createRuntimeSignalIntegrationReadinessBridge(
  input: CreateRuntimeSignalIntegrationReadinessBridgeInput,
): RuntimeSignalIntegrationReadinessBridge {
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: input.envelope,
    targetLabel: 'runtime-signal-envelope',
  });
  if (input.envelope.signalKind === 'enforcement-proof') {
    throw new Error('Runtime signal integration readiness bridge leaves enforcement-proof signals for RS10 proof intake.');
  }

  const candidate = input.candidate ?? mapRuntimeSignalToConsequenceCandidate(input.envelope);
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: candidate,
    targetLabel: 'runtime-signal-consequence-candidate',
  });
  if (candidate.sourceSignalDigest !== input.envelope.signalDigest) {
    throw new Error('Runtime signal integration readiness bridge requires candidate source digest to match envelope.');
  }

  const mode = modeForRuntimeSignal({
    envelope: input.envelope,
    modeHint: input.modeHint,
  });
  const credentialIsolation = credentialIsolationFor({
    mode,
    hint: input.credentialIsolationHint,
  });
  const signalsApplied = mergeSignals(
    inferredSignalsFor(input.envelope),
    input.controlSignals,
  );
  const domain = consequenceDomainFor(candidate);
  const actionSurface = candidate.actionSurface;
  const downstreamSystem = input.envelope.downstreamSystem;
  const workflowId = workflowIdFor({
    workflowId: input.workflowId,
    envelope: input.envelope,
  });
  const readiness = evaluateAttestorIntegrationModeReadiness({
    workflowId,
    mode,
    credentialIsolation,
    signals: signalsApplied,
    generatedArtifacts: input.generatedArtifacts,
    actionSurface,
    domain,
    downstreamSystem,
    generatedAt: input.generatedAt ?? input.envelope.eventTime,
  });
  const payload = {
    version: RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    runtimeSignalConsequenceMappingVersion: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    integrationModeReadinessVersion: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    sourceSignalDigest: input.envelope.signalDigest,
    candidateDigest: candidate.candidateDigest,
    workflowId,
    mode,
    credentialIsolation,
    gatePlacement: gatePlacementFor(mode),
    actionSurface,
    domain,
    downstreamSystem,
    signalsApplied,
    readiness,
    runtimeSignalBridgeUsesExistingReadinessEvaluator: true,
    runtimeSignalAloneCanClaimNonBypassable: false,
    credentialIsolationInferredFromSignal: false,
    generatedArtifactsNeedReview: true,
    approvalRequired: true,
    autoEnforce: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  assertRuntimeSignalAuthorityBoundary({
    signalKind: input.envelope.signalKind,
    sourceTrustLevel: input.envelope.sourceTrustLevel,
    target: payload,
    targetLabel: 'runtime-signal-integration-readiness-bridge',
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runtimeSignalIntegrationReadinessBridgeDescriptor():
  RuntimeSignalIntegrationReadinessBridgeDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_INTEGRATION_READINESS_BRIDGE_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    runtimeSignalConsequenceMappingVersion: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    integrationModeReadinessVersion: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    gatePlacementKinds: RUNTIME_SIGNAL_GATE_PLACEMENT_KINDS,
    usesExistingReadinessEvaluator: true,
    runtimeSignalAloneCanClaimNonBypassable: false,
    credentialIsolationInferredFromSignal: false,
    generatedArtifactsNeedReview: true,
    approvalRequired: true,
    autoEnforce: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-authority',
      'not-admission',
      'not-gate-deployment',
      'not-proof-intake',
      'not-production-ready',
    ]),
  });
}
