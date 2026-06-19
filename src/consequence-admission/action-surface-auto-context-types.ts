import type {
  ActionSurfaceDeclaration,
  ActionSurfaceDeclaredCredentialPosture,
} from './action-surface-profiler.js';
import type { CreateGenericAdmissionInput } from './contracts.js';
import type { EvidenceStateKind } from './evidence-state-model.js';
import type { AttestorIntegrationMode } from './integration-mode-readiness.js';
import { RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION } from './runtime-signal-consequence-mapping.js';
import { RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION } from './runtime-signal-authority-guard.js';
import { RUNTIME_SIGNAL_ENVELOPE_VERSION, type RuntimeSignalEnvelope } from './runtime-signal-envelope.js';
import type { ConsequenceAdmissionDomain } from './taxonomy.js';

export const ACTION_SURFACE_AUTO_CONTEXT_VERSION =
  'attestor.action-surface-auto-context.v1';

export const ACTION_SURFACE_RUNTIME_SIGNAL_BRIDGE_VERSION =
  'attestor.action-surface-runtime-signal-bridge.v1';

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
  readonly inputShapeDigest?: string | null;
  readonly argumentDigest?: string | null;
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

export interface CreateActionSurfaceAutoContextFromRuntimeSignalsInput {
  readonly generatedAt?: string | null;
  readonly defaultActor?: string | null;
  readonly defaultDomain?: ConsequenceAdmissionDomain | string | null;
  readonly defaultDownstreamSystem?: string | null;
  readonly envelopes: readonly RuntimeSignalEnvelope[];
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
  readonly runtimeSignalBridgeVersion: typeof ACTION_SURFACE_RUNTIME_SIGNAL_BRIDGE_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly runtimeSignalConsequenceMappingVersion: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly signalKinds: typeof ACTION_SURFACE_AUTO_CONTEXT_SIGNAL_KINDS;
  readonly fields: typeof ACTION_SURFACE_AUTO_CONTEXT_FIELDS;
  readonly acceptsRuntimeSignalEnvelopes: true;
  readonly runtimeSignalBridgeUsesExistingAutoContextPath: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly canGrantAuthority: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}
