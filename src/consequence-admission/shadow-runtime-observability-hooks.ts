import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseContract,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  type AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  DECISION_LINEAGE_GRAPH_VERSION,
  createDecisionLineageGraph,
  type DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';
import {
  DECISION_TRACE_LOGGER_VERSION,
  createDecisionTraceLogger,
  type DecisionTraceSnapshot,
} from './decision-trace-logger.js';
import {
  RUNTIME_MONITOR_SKELETON_VERSION,
  createRuntimeMonitorSkeleton,
  type RuntimeMonitorSkeletonRecord,
} from './runtime-monitor-skeleton.js';
import {
  SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
  type ShadowRuntimeActivationResult,
} from './shadow-runtime-activation-runner.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
} from './shadow-runtime-pipeline.js';

export const SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION =
  'attestor.shadow-runtime-observability-hooks.v1';

export const SHADOW_RUNTIME_OBSERVABILITY_HOOK_SOURCE_ANCHORS = [
  'opentelemetry-log-trace-context-correlation',
  'w3c-trace-context-correlation-not-authority',
  'opa-decision-logs-input-output-boundary',
  'nasa-runtime-assurance-monitor-not-controller',
  'entrust-living-assurance-case-runtime-evidence',
  'w3c-prov-digest-bound-lineage',
] as const;
export type ShadowRuntimeObservabilityHookSourceAnchor =
  typeof SHADOW_RUNTIME_OBSERVABILITY_HOOK_SOURCE_ANCHORS[number];

export interface RunShadowRuntimeObservabilityHooksInput {
  readonly activation: ShadowRuntimeActivationResult;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly scopeDigest: string;
  readonly traceId?: string | null;
  readonly ttlSeconds?: number | null;
  readonly maxTraceEntries?: number | null;
  readonly monitorId?: string | null;
  readonly targetClaimNodeId?: string | null;
  readonly caseId?: string | null;
  readonly builderRefDigest?: string | null;
  readonly measurementPlane?: AssuranceMeasurementPlane | null;
  readonly maxObservationAgeSeconds?: number | null;
}

export interface ShadowRuntimeObservabilityHooksResult {
  readonly version: typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly shadowRuntimeActivationRunnerVersion:
    typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly runtimeMonitorSkeletonVersion: typeof RUNTIME_MONITOR_SKELETON_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly hookStatus: 'trace-lineage-measurement-bound';
  readonly executionMode: 'shadow-only';
  readonly activationDigest: string;
  readonly runnerInvocationDigest: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly tenantRefDigest: string;
  readonly traceId: string;
  readonly traceSnapshotDigest: string;
  readonly runtimeMonitorDigest: string;
  readonly assuranceCaseDigest: string;
  readonly lineageGraphDigest: string;
  readonly measurementPlaneDigest: string | null;
  readonly observedAt: string;
  readonly traceSnapshot: DecisionTraceSnapshot;
  readonly runtimeMonitor: RuntimeMonitorSkeletonRecord;
  readonly assuranceCase: AssuranceCaseContract;
  readonly lineageGraph: DecisionLineageGraphRecord;
  readonly reasonCodes: readonly string[];
  readonly traceHooked: true;
  readonly lineageHooked: true;
  readonly measurementHooked: boolean;
  readonly writesAuditPlane: false;
  readonly writesExternalTraceBackend: false;
  readonly externalLineageExportIncluded: false;
  readonly measurementAuthorityIncluded: false;
  readonly canAdmit: false;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly learnsFromTraffic: false;
  readonly crossTenantAggregation: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowRuntimeObservabilityHooksDescriptor {
  readonly version: typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly shadowRuntimeActivationRunnerVersion:
    typeof SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly runtimeMonitorSkeletonVersion: typeof RUNTIME_MONITOR_SKELETON_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly sourceAnchors: readonly ShadowRuntimeObservabilityHookSourceAnchor[];
  readonly traceHooked: true;
  readonly lineageHooked: true;
  readonly measurementHookOptional: true;
  readonly requiresR05Activation: true;
  readonly requiresVerifiedTraceSnapshot: true;
  readonly digestOnly: true;
  readonly shadowOnly: true;
  readonly writesAuditPlane: false;
  readonly writesExternalTraceBackend: false;
  readonly externalLineageExportIncluded: false;
  readonly measurementAuthorityIncluded: false;
  readonly canAdmit: false;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly learnsFromTraffic: false;
  readonly crossTenantAggregation: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow runtime observability hooks ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow runtime observability hooks ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow runtime observability hooks ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Shadow runtime observability hooks ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  defaultValue: number,
): number {
  const normalized = value ?? defaultValue;
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error(`Shadow runtime observability hooks ${fieldName} must be a positive integer.`);
  }
  return normalized;
}

function assertFalse(value: boolean, fieldName: string): void {
  if (value !== false) {
    throw new Error(`Shadow runtime observability hooks ${fieldName} must be false.`);
  }
}

function shortDigest(digest: string): string {
  return digest.replace(/^sha256:/u, '').slice(0, 16);
}

function assertActivation(activation: ShadowRuntimeActivationResult): void {
  if (activation.version !== SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION) {
    throw new Error(
      `Shadow runtime observability hooks activation.version must be ${SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION}.`,
    );
  }
  if (activation.shadowRuntimePipelineVersion !== SHADOW_RUNTIME_PIPELINE_VERSION) {
    throw new Error(
      `Shadow runtime observability hooks activation.shadowRuntimePipelineVersion must be ${SHADOW_RUNTIME_PIPELINE_VERSION}.`,
    );
  }
  if (activation.pipelineDigest !== activation.pipeline.digest) {
    throw new Error('Shadow runtime observability hooks activation pipeline digest mismatch.');
  }
  if (activation.envelopeRefDigest !== activation.pipeline.projection.envelopeRefDigest) {
    throw new Error('Shadow runtime observability hooks activation envelope digest mismatch.');
  }
  assertFalse(activation.grantsAuthority, 'activation.grantsAuthority');
  assertFalse(activation.canAdmit, 'activation.canAdmit');
  assertFalse(activation.activatesEnforcement, 'activation.activatesEnforcement');
  assertFalse(activation.autoEnforce, 'activation.autoEnforce');
  assertFalse(activation.rawPayloadRead, 'activation.rawPayloadRead');
  assertFalse(activation.rawPayloadStored, 'activation.rawPayloadStored');
  assertFalse(activation.learnsFromTraffic, 'activation.learnsFromTraffic');
  assertFalse(activation.crossTenantAggregation, 'activation.crossTenantAggregation');
  assertFalse(activation.productionReady, 'activation.productionReady');
}

function assertMeasurement(measurement: AssuranceMeasurementPlane | null): void {
  if (measurement === null) return;
  if (measurement.version !== ASSURANCE_MEASUREMENT_PLANE_VERSION) {
    throw new Error(
      `Shadow runtime observability hooks measurement.version must be ${ASSURANCE_MEASUREMENT_PLANE_VERSION}.`,
    );
  }
  if (
    measurement.measurementReadOnly !== true ||
    measurement.writesAuditPlane !== false ||
    measurement.grantsAuthority ||
    measurement.canAdmit ||
    measurement.activatesEnforcement ||
    measurement.autoEnforce ||
    measurement.rawPayloadStored ||
    measurement.productionReady
  ) {
    throw new Error('Shadow runtime observability hooks measurement must be read-only and no-authority.');
  }
}

function createRuntimeClaim(input: {
  readonly nodeId: string;
  readonly activation: ShadowRuntimeActivationResult;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly scopeDigest: string;
}): AssuranceCaseNode {
  return createAssuranceCaseNode({
    nodeId: input.nodeId,
    kind: 'claim',
    title: 'Shadow runtime activation is observable evidence only',
    bodyDigest: digestValue('shadow-runtime-observability-root-claim', {
      activationDigest: input.activation.digest,
      runnerInvocationDigest: input.activation.runnerInvocationDigest,
      pipelineDigest: input.activation.pipelineDigest,
      envelopeRefDigest: input.activation.envelopeRefDigest,
    }),
    tenantRefDigest: input.activation.tenantRefDigest,
    scopeDigest: input.scopeDigest,
    createdByRefDigest: input.observerRefDigest,
    createdAt: input.observedAt,
    sourceStandards: ['living-assurance-case', 'eliminative-argumentation'],
  });
}

function createRootTransition(input: {
  readonly claim: AssuranceCaseNode;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly activationDigest: string;
}): AssuranceCaseTransition {
  return createAssuranceCaseTransition({
    transitionId: `transition:create:${input.claim.nodeId}`,
    transitionKind: 'create-node',
    actorRefDigest: input.observerRefDigest,
    occurredAt: input.observedAt,
    reasonDigest: digestValue('shadow-runtime-observability-root-transition', {
      claimDigest: input.claim.digest,
      activationDigest: input.activationDigest,
    }),
    nodeId: input.claim.nodeId,
    evidenceRefDigest: input.activationDigest,
  });
}

function assuranceCaseFromMonitor(input: {
  readonly activation: ShadowRuntimeActivationResult;
  readonly monitor: RuntimeMonitorSkeletonRecord;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly scopeDigest: string;
  readonly caseId: string;
  readonly targetClaimNodeId: string;
}): AssuranceCaseContract {
  const rootClaim = createRuntimeClaim({
    nodeId: input.targetClaimNodeId,
    activation: input.activation,
    observedAt: input.observedAt,
    observerRefDigest: input.observerRefDigest,
    scopeDigest: input.scopeDigest,
  });
  const nodes: AssuranceCaseNode[] = [rootClaim];
  if (input.monitor.evidenceNode !== null) {
    nodes.push(input.monitor.evidenceNode);
  }
  const transitions: AssuranceCaseTransition[] = [
    createRootTransition({
      claim: rootClaim,
      observedAt: input.observedAt,
      observerRefDigest: input.observerRefDigest,
      activationDigest: input.activation.digest,
    }),
  ];
  if (input.monitor.evidenceTransition !== null) {
    transitions.push(input.monitor.evidenceTransition);
  }
  if (input.monitor.defeaterTransition !== null) {
    transitions.push(input.monitor.defeaterTransition);
  }

  return createAssuranceCaseContract({
    caseId: input.caseId,
    tenantRefDigest: input.activation.tenantRefDigest,
    rootClaimId: rootClaim.nodeId,
    createdAt: input.observedAt,
    lastReviewedAt: input.observedAt,
    nodes,
    defeaters: input.monitor.openDefeater === null
      ? []
      : [input.monitor.openDefeater],
    transitions,
    moduleRefDigests: [
      input.activation.digest,
      input.monitor.digest,
    ],
  });
}

export function runShadowRuntimeObservabilityHooks(
  input: RunShadowRuntimeObservabilityHooksInput,
): ShadowRuntimeObservabilityHooksResult {
  const activation = input.activation;
  assertActivation(activation);
  const measurementPlane = input.measurementPlane ?? null;
  assertMeasurement(measurementPlane);
  const observedAt = normalizeTimestamp(input.observedAt, 'observedAt');
  const observerRefDigest = normalizeDigest(input.observerRefDigest, 'observerRefDigest');
  const scopeDigest = normalizeDigest(input.scopeDigest, 'scopeDigest');
  const ttlSeconds = normalizePositiveInteger(input.ttlSeconds, 'ttlSeconds', 3600);
  const maxTraceEntries = normalizePositiveInteger(
    input.maxTraceEntries,
    'maxTraceEntries',
    128,
  );
  const targetClaimNodeId = normalizeIdentifier(
    input.targetClaimNodeId ??
      `claim:shadow-runtime-observability:${shortDigest(activation.runnerInvocationDigest)}`,
    'targetClaimNodeId',
  );
  const traceId = normalizeIdentifier(
    input.traceId ??
      `trace:r06:${shortDigest(activation.runnerInvocationDigest)}`,
    'traceId',
  );
  const monitorId = normalizeIdentifier(
    input.monitorId ??
      `runtime-monitor:r06:${shortDigest(activation.runnerInvocationDigest)}`,
    'monitorId',
  );
  const caseId = normalizeIdentifier(
    input.caseId ??
      `case:r06:${shortDigest(activation.runnerInvocationDigest)}`,
    'caseId',
  );
  const builderRefDigest = normalizeDigest(
    input.builderRefDigest ?? observerRefDigest,
    'builderRefDigest',
  );

  const traceLogger = createDecisionTraceLogger({
    traceId,
    ttlSeconds,
    maxEntries: maxTraceEntries,
    now: () => observedAt,
  });
  const appendDecision = traceLogger.recordPipeline(activation.pipeline, observedAt);
  if (appendDecision.outcome !== 'recorded') {
    throw new Error('Shadow runtime observability hooks decision trace append must record.');
  }
  const traceSnapshot = traceLogger.snapshot(observedAt);
  if (!traceSnapshot.verification.valid) {
    throw new Error('Shadow runtime observability hooks decision trace snapshot must verify.');
  }

  const runtimeMonitor = createRuntimeMonitorSkeleton({
    pipeline: activation.pipeline,
    traceSnapshot,
    measurementPlane,
    monitorId,
    observedAt,
    observerRefDigest,
    tenantRefDigest: activation.tenantRefDigest,
    scopeDigest,
    targetClaimNodeId,
    maxObservationAgeSeconds: input.maxObservationAgeSeconds,
  });
  const assuranceCase = assuranceCaseFromMonitor({
    activation,
    monitor: runtimeMonitor,
    observedAt,
    observerRefDigest,
    scopeDigest,
    caseId,
    targetClaimNodeId,
  });
  const lineageGraph = createDecisionLineageGraph({
    assuranceCase,
    lineageId: `lineage:r06:${shortDigest(assuranceCase.digest)}`,
    generatedAt: observedAt,
    builderRefDigest,
    artifactRefs: [
      {
        artifactId: 'artifact:r06:runtime-monitor',
        artifactKind: 'runtime-monitor-record',
        artifactDigest: runtimeMonitor.digest,
        sourceVersion: RUNTIME_MONITOR_SKELETON_VERSION,
        producedAt: observedAt,
        producerRefDigest: observerRefDigest,
        targetNodeId: runtimeMonitor.evidenceNode?.nodeId ?? targetClaimNodeId,
      },
      ...(measurementPlane === null
        ? []
        : [{
            artifactId: 'artifact:r06:measurement-plane',
            artifactKind: 'measurement-plane-record' as const,
            artifactDigest: measurementPlane.digest,
            sourceVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
            producedAt: observedAt,
            producerRefDigest: observerRefDigest,
            targetNodeId: targetClaimNodeId,
          }]),
    ],
  });
  const reasonCodes = Object.freeze([
    'observability:trace-lineage-measurement-bound',
    'trace:decision-trace-snapshot-verified',
    `runtime-monitor:${runtimeMonitor.outcome}`,
    `lineage:${lineageGraph.outcome}`,
    measurementPlane === null
      ? 'measurement:optional-not-supplied'
      : `measurement:${measurementPlane.status}`,
    'authority:observability-no-admit',
  ]);
  const material = {
    version: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    shadowRuntimeActivationRunnerVersion: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    runtimeMonitorSkeletonVersion: RUNTIME_MONITOR_SKELETON_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    hookStatus: 'trace-lineage-measurement-bound' as const,
    executionMode: 'shadow-only' as const,
    activationDigest: activation.digest,
    runnerInvocationDigest: activation.runnerInvocationDigest,
    pipelineDigest: activation.pipelineDigest,
    envelopeRefDigest: activation.envelopeRefDigest,
    tenantRefDigest: activation.tenantRefDigest,
    traceId,
    traceSnapshotDigest: traceSnapshot.digest,
    runtimeMonitorDigest: runtimeMonitor.digest,
    assuranceCaseDigest: assuranceCase.digest,
    lineageGraphDigest: lineageGraph.digest,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    observedAt,
    traceSnapshot,
    runtimeMonitor,
    assuranceCase,
    lineageGraph,
    reasonCodes,
    traceHooked: true as const,
    lineageHooked: true as const,
    measurementHooked: measurementPlane !== null,
    writesAuditPlane: false as const,
    writesExternalTraceBackend: false as const,
    externalLineageExportIncluded: false as const,
    measurementAuthorityIncluded: false as const,
    canAdmit: false as const,
    grantsAuthority: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    learnsFromTraffic: false as const,
    crossTenantAggregation: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowRuntimeObservabilityHooksResult, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(
    material as unknown as CanonicalReleaseJsonValue,
  );
  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowRuntimeObservabilityHooksDescriptor():
  ShadowRuntimeObservabilityHooksDescriptor {
  return Object.freeze({
    version: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    shadowRuntimeActivationRunnerVersion: SHADOW_RUNTIME_ACTIVATION_RUNNER_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    runtimeMonitorSkeletonVersion: RUNTIME_MONITOR_SKELETON_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    sourceAnchors: SHADOW_RUNTIME_OBSERVABILITY_HOOK_SOURCE_ANCHORS,
    traceHooked: true,
    lineageHooked: true,
    measurementHookOptional: true,
    requiresR05Activation: true,
    requiresVerifiedTraceSnapshot: true,
    digestOnly: true,
    shadowOnly: true,
    writesAuditPlane: false,
    writesExternalTraceBackend: false,
    externalLineageExportIncluded: false,
    measurementAuthorityIncluded: false,
    canAdmit: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    learnsFromTraffic: false,
    crossTenantAggregation: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-audit-plane-write',
      'not-external-otel-export',
      'not-external-lineage-export',
      'not-measurement-authority',
      'not-outcome-feedback-hook',
      'not-live-enforcement',
      'not-policy-activation',
      'not-production-readiness',
    ]),
  });
}
