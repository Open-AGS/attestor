import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  type AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  DECISION_TRACE_LOGGER_VERSION,
  type DecisionTraceSnapshot,
} from './decision-trace-logger.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  type ShadowRuntimePipelineResult,
} from './shadow-runtime-pipeline.js';

export const RUNTIME_MONITOR_SKELETON_VERSION =
  'attestor.runtime-monitor-skeleton.v1';

export const RUNTIME_MONITOR_SOURCE_ANCHORS = [
  'nasa-rta-monitor-observes-input-output-computation',
  'nasa-rse-runtime-monitoring-and-analysis',
  'entrust-dynamic-assurance-cases',
  'opentelemetry-log-event-observedtimestamp-trace-context',
  'google-sre-simple-actionable-monitoring',
  'nist-sp800-61r3-detection-response-lifecycle',
  'omg-sacm-auditable-claims-arguments-evidence',
] as const;
export type RuntimeMonitorSourceAnchor =
  typeof RUNTIME_MONITOR_SOURCE_ANCHORS[number];

export const RUNTIME_MONITOR_OBSERVATION_KINDS = [
  'pipeline-output-observed',
  'decision-trace-observed',
  'assurance-packet-observed',
  'measurement-plane-observed',
  'monitor-degraded-observed',
] as const;
export type RuntimeMonitorObservationKind =
  typeof RUNTIME_MONITOR_OBSERVATION_KINDS[number];

export const RUNTIME_MONITOR_OUTCOMES = [
  'runtime-monitor-evidence-ready',
  'runtime-monitor-open-undermining-defeater',
  'runtime-monitor-open-undercutting-defeater',
  'runtime-monitor-rejected-boundary',
] as const;
export type RuntimeMonitorOutcome = typeof RUNTIME_MONITOR_OUTCOMES[number];

export const RUNTIME_MONITOR_FINDINGS = [
  'trace-verification-failed',
  'trace-snapshot-empty',
  'trace-pipeline-digest-mismatch',
  'trace-envelope-digest-mismatch',
  'stale-observation',
  'clock-skew',
  'measurement-plane-degraded',
  'measurement-plane-no-data',
  'raw-payload-requested',
  'raw-trace-requested',
  'audit-write-requested',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type RuntimeMonitorFinding = typeof RUNTIME_MONITOR_FINDINGS[number];

export interface CreateRuntimeMonitorSkeletonInput {
  readonly pipeline: ShadowRuntimePipelineResult;
  readonly traceSnapshot: DecisionTraceSnapshot;
  readonly monitorId: string;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly measurementPlane?: AssuranceMeasurementPlane | null;
  readonly maxObservationAgeSeconds?: number | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly rawTraceRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface RuntimeMonitorSkeletonRecord {
  readonly version: typeof RUNTIME_MONITOR_SKELETON_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly monitorId: string;
  readonly monitorRefDigest: string;
  readonly observedAt: string;
  readonly observerRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly packetDigest: string;
  readonly traceSnapshotDigest: string;
  readonly traceId: string;
  readonly traceRootDigest: string | null;
  readonly traceEntryCount: number;
  readonly tracePipelineDigests: readonly string[];
  readonly traceEnvelopeDigests: readonly string[];
  readonly measurementPlaneDigest: string | null;
  readonly measurementStatus: AssuranceMeasurementPlane['status'] | null;
  readonly observationKinds: readonly RuntimeMonitorObservationKind[];
  readonly sourceObservedAt: string;
  readonly observationAgeSeconds: number;
  readonly maxObservationAgeSeconds: number;
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly openDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly openDefeaterDigest: string | null;
  readonly outcome: RuntimeMonitorOutcome;
  readonly findings: readonly RuntimeMonitorFinding[];
  readonly reasonCodes: readonly string[];
  readonly runtimeEvidenceReady: boolean;
  readonly opensUnderminingDefeater: boolean;
  readonly opensUndercuttingDefeater: boolean;
  readonly digestOnly: true;
  readonly readOnly: true;
  readonly noRawPayload: true;
  readonly noRawTrace: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly notRuntimeOracle: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface RuntimeMonitorSkeletonDescriptor {
  readonly version: typeof RUNTIME_MONITOR_SKELETON_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly sourceAnchors: readonly RuntimeMonitorSourceAnchor[];
  readonly observationKinds: readonly RuntimeMonitorObservationKind[];
  readonly outcomes: readonly RuntimeMonitorOutcome[];
  readonly findings: readonly RuntimeMonitorFinding[];
  readonly createsEvidenceNodeWhenHealthy: true;
  readonly opensUnderminingDefeaterOnInvalidEvidence: true;
  readonly opensUndercuttingDefeaterOnMonitorDegradation: true;
  readonly requiresVerifiedDecisionTrace: true;
  readonly requiresPipelineTraceBinding: true;
  readonly digestOnly: true;
  readonly readOnly: true;
  readonly noRawPayload: true;
  readonly noRawTrace: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly notRuntimeOracle: true;
  readonly noLearning: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DEFAULT_MAX_OBSERVATION_AGE_SECONDS = 3600;

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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Runtime monitor skeleton ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Runtime monitor skeleton ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Runtime monitor skeleton ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Runtime monitor skeleton ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  const raw = value ?? fallback;
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new Error(`Runtime monitor skeleton ${fieldName} must be a positive integer.`);
  }
  return raw;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: RUNTIME_MONITOR_SKELETON_VERSION,
    value,
  }).digest;
}

function assertPipeline(pipeline: ShadowRuntimePipelineResult): void {
  if (pipeline.version !== SHADOW_RUNTIME_PIPELINE_VERSION) {
    throw new Error('Runtime monitor skeleton pipeline version mismatch.');
  }
  if (
    pipeline.executionMode !== 'shadow-only' ||
    pipeline.grantsAuthority ||
    pipeline.canAdmit ||
    pipeline.activatesEnforcement ||
    pipeline.autoEnforce ||
    pipeline.rawPayloadRead ||
    pipeline.rawPayloadStored
  ) {
    throw new Error('Runtime monitor skeleton requires a shadow-only no-authority pipeline.');
  }
}

function assertTrace(snapshot: DecisionTraceSnapshot): void {
  if (snapshot.version !== DECISION_TRACE_LOGGER_VERSION) {
    throw new Error('Runtime monitor skeleton trace snapshot version mismatch.');
  }
  if (snapshot.verification.version !== DECISION_TRACE_LOGGER_VERSION) {
    throw new Error('Runtime monitor skeleton trace verification version mismatch.');
  }
  if (
    snapshot.digestOnly !== true ||
    snapshot.rawPayloadStored !== false ||
    snapshot.writesAuditPlane !== false
  ) {
    throw new Error('Runtime monitor skeleton requires digest-only read-only trace snapshots.');
  }
}

function assertMeasurementPlane(measurement: AssuranceMeasurementPlane | null): void {
  if (measurement === null) {
    return;
  }
  if (measurement.version !== ASSURANCE_MEASUREMENT_PLANE_VERSION) {
    throw new Error('Runtime monitor skeleton measurement plane version mismatch.');
  }
  if (
    measurement.measurementReadOnly !== true ||
    measurement.writesAuditPlane !== false ||
    measurement.grantsAuthority ||
    measurement.canAdmit ||
    measurement.activatesEnforcement ||
    measurement.rawPayloadStored
  ) {
    throw new Error('Runtime monitor skeleton requires read-only measurement plane input.');
  }
}

function observationAge(input: {
  readonly sourceObservedAt: string;
  readonly observedAt: string;
}): number {
  const observed = Date.parse(input.observedAt);
  const source = Date.parse(input.sourceObservedAt);
  return Number(((observed - source) / 1000).toFixed(3));
}

function tracePipelineDigests(snapshot: DecisionTraceSnapshot): readonly string[] {
  return uniqueSorted(snapshot.entries.map((entry) => entry.pipelineDigest));
}

function traceEnvelopeDigests(snapshot: DecisionTraceSnapshot): readonly string[] {
  return uniqueSorted(snapshot.entries.map((entry) => entry.envelopeRefDigest));
}

function observationKindsFor(
  measurementPlane: AssuranceMeasurementPlane | null,
  findings: readonly RuntimeMonitorFinding[],
): readonly RuntimeMonitorObservationKind[] {
  const kinds: RuntimeMonitorObservationKind[] = [
    'pipeline-output-observed',
    'decision-trace-observed',
    'assurance-packet-observed',
  ];
  if (measurementPlane !== null) {
    kinds.push('measurement-plane-observed');
  }
  if (
    findings.includes('measurement-plane-degraded') ||
    findings.includes('measurement-plane-no-data') ||
    findings.includes('clock-skew')
  ) {
    kinds.push('monitor-degraded-observed');
  }
  return uniqueSorted(kinds);
}

function findingsFor(input: {
  readonly pipeline: ShadowRuntimePipelineResult;
  readonly snapshot: DecisionTraceSnapshot;
  readonly measurementPlane: AssuranceMeasurementPlane | null;
  readonly tracePipelineDigests: readonly string[];
  readonly traceEnvelopeDigests: readonly string[];
  readonly observationAgeSeconds: number;
  readonly maxObservationAgeSeconds: number;
  readonly rawPayloadRequested: boolean;
  readonly rawTraceRequested: boolean;
  readonly auditWriteRequested: boolean;
  readonly policyActivationRequested: boolean;
  readonly liveEnforcementRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly RuntimeMonitorFinding[] {
  const findings = new Set<RuntimeMonitorFinding>();
  if (!input.snapshot.verification.valid) {
    findings.add('trace-verification-failed');
  }
  if (input.snapshot.entryCount === 0 || input.snapshot.entries.length === 0) {
    findings.add('trace-snapshot-empty');
  }
  if (
    input.tracePipelineDigests.length !== 1 ||
    input.tracePipelineDigests[0] !== input.pipeline.digest
  ) {
    findings.add('trace-pipeline-digest-mismatch');
  }
  if (
    input.traceEnvelopeDigests.length !== 1 ||
    input.traceEnvelopeDigests[0] !== input.pipeline.projection.envelopeRefDigest
  ) {
    findings.add('trace-envelope-digest-mismatch');
  }
  if (input.observationAgeSeconds < 0) {
    findings.add('clock-skew');
  }
  if (input.observationAgeSeconds > input.maxObservationAgeSeconds) {
    findings.add('stale-observation');
  }
  if (input.measurementPlane?.status === 'measurement-degraded') {
    findings.add('measurement-plane-degraded');
  }
  if (input.measurementPlane?.status === 'no-data') {
    findings.add('measurement-plane-no-data');
  }
  if (input.rawPayloadRequested) {
    findings.add('raw-payload-requested');
  }
  if (input.rawTraceRequested) {
    findings.add('raw-trace-requested');
  }
  if (input.auditWriteRequested) {
    findings.add('audit-write-requested');
  }
  if (input.policyActivationRequested) {
    findings.add('policy-activation-requested');
  }
  if (input.liveEnforcementRequested) {
    findings.add('live-enforcement-requested');
  }
  if (input.authorityActionRequested) {
    findings.add('authority-action-requested');
  }
  return uniqueSorted([...findings]);
}

function hasBoundaryFinding(findings: readonly RuntimeMonitorFinding[]): boolean {
  return findings.some((finding) =>
    finding === 'raw-payload-requested' ||
    finding === 'raw-trace-requested' ||
    finding === 'audit-write-requested' ||
    finding === 'policy-activation-requested' ||
    finding === 'live-enforcement-requested' ||
    finding === 'authority-action-requested'
  );
}

function hasUnderminingFinding(findings: readonly RuntimeMonitorFinding[]): boolean {
  return findings.some((finding) =>
    finding === 'trace-verification-failed' ||
    finding === 'trace-snapshot-empty' ||
    finding === 'trace-pipeline-digest-mismatch' ||
    finding === 'trace-envelope-digest-mismatch' ||
    finding === 'stale-observation'
  );
}

function hasUndercuttingFinding(findings: readonly RuntimeMonitorFinding[]): boolean {
  return findings.some((finding) =>
    finding === 'clock-skew' ||
    finding === 'measurement-plane-degraded' ||
    finding === 'measurement-plane-no-data'
  );
}

function outcomeFor(findings: readonly RuntimeMonitorFinding[]): RuntimeMonitorOutcome {
  if (hasBoundaryFinding(findings)) {
    return 'runtime-monitor-rejected-boundary';
  }
  if (hasUnderminingFinding(findings)) {
    return 'runtime-monitor-open-undermining-defeater';
  }
  if (hasUndercuttingFinding(findings)) {
    return 'runtime-monitor-open-undercutting-defeater';
  }
  return 'runtime-monitor-evidence-ready';
}

function reasonCodesFor(input: {
  readonly outcome: RuntimeMonitorOutcome;
  readonly findings: readonly RuntimeMonitorFinding[];
  readonly observationKinds: readonly RuntimeMonitorObservationKind[];
}): readonly string[] {
  const reasons = new Set<string>([
    `runtime-monitor-outcome:${input.outcome}`,
    ...input.observationKinds.map((kind) => `runtime-monitor-observation:${kind}`),
    ...input.findings.map((finding) => `runtime-monitor-finding:${finding}`),
  ]);
  if (input.findings.length === 0) {
    reasons.add('runtime-monitor-evidence-ready');
  }
  return uniqueSorted([...reasons]);
}

export function createRuntimeMonitorSkeleton(
  input: CreateRuntimeMonitorSkeletonInput,
): RuntimeMonitorSkeletonRecord {
  assertPipeline(input.pipeline);
  assertTrace(input.traceSnapshot);
  const measurementPlane = input.measurementPlane ?? null;
  assertMeasurementPlane(measurementPlane);
  const monitorId = normalizeIdentifier(input.monitorId, 'monitorId');
  const observedAt = normalizeIsoTimestamp(input.observedAt, 'observedAt');
  const observerRefDigest = normalizeDigest(input.observerRefDigest, 'observerRefDigest');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const scopeDigest = normalizeDigest(input.scopeDigest, 'scopeDigest');
  const targetClaimNodeId = normalizeIdentifier(input.targetClaimNodeId, 'targetClaimNodeId');
  const maxObservationAgeSeconds = normalizePositiveInteger(
    input.maxObservationAgeSeconds,
    'maxObservationAgeSeconds',
    DEFAULT_MAX_OBSERVATION_AGE_SECONDS,
  );
  const sourceObservedAt = input.pipeline.assurancePacket.generatedAt;
  const observationAgeSeconds = observationAge({ sourceObservedAt, observedAt });
  const pipelineDigests = tracePipelineDigests(input.traceSnapshot);
  const envelopeDigests = traceEnvelopeDigests(input.traceSnapshot);
  const findings = findingsFor({
    pipeline: input.pipeline,
    snapshot: input.traceSnapshot,
    measurementPlane,
    tracePipelineDigests: pipelineDigests,
    traceEnvelopeDigests: envelopeDigests,
    observationAgeSeconds,
    maxObservationAgeSeconds,
    rawPayloadRequested: input.rawPayloadRequested === true,
    rawTraceRequested: input.rawTraceRequested === true,
    auditWriteRequested: input.auditWriteRequested === true,
    policyActivationRequested: input.policyActivationRequested === true,
    liveEnforcementRequested: input.liveEnforcementRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const observationKinds = observationKindsFor(measurementPlane, findings);
  const outcome = outcomeFor(findings);
  const reasonCodes = reasonCodesFor({ outcome, findings, observationKinds });
  const monitorRefDigest = bodyDigest('runtime-monitor-ref', {
    monitorId,
    pipelineDigest: input.pipeline.digest,
    traceSnapshotDigest: input.traceSnapshot.digest,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    observedAt,
    observerRefDigest,
    tenantRefDigest,
    scopeDigest,
  } as CanonicalReleaseJsonValue);
  const evidenceBodyDigest = bodyDigest('runtime-monitor-evidence-body', {
    monitorId,
    monitorRefDigest,
    pipelineDigest: input.pipeline.digest,
    envelopeRefDigest: input.pipeline.projection.envelopeRefDigest,
    packetDigest: input.pipeline.assurancePacket.digest,
    traceSnapshotDigest: input.traceSnapshot.digest,
    traceEntryCount: input.traceSnapshot.entryCount,
    tracePipelineDigests: pipelineDigests,
    traceEnvelopeDigests: envelopeDigests,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    measurementStatus: measurementPlane?.status ?? null,
    sourceObservedAt,
    observedAt,
    observationAgeSeconds,
    maxObservationAgeSeconds,
    findings,
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const transitionReasonDigest = bodyDigest('runtime-monitor-transition-reason', {
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const runtimeEvidenceReady = outcome === 'runtime-monitor-evidence-ready';
  const opensUnderminingDefeater =
    outcome === 'runtime-monitor-open-undermining-defeater';
  const opensUndercuttingDefeater =
    outcome === 'runtime-monitor-open-undercutting-defeater';
  const evidenceNode = runtimeEvidenceReady
    ? createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ??
            `evidence:runtime-monitor:${shortDigest(monitorRefDigest)}`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'Runtime monitor observation evidence',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest,
        scopeDigest,
        createdByRefDigest: observerRefDigest,
        createdAt: observedAt,
        sourceStandards: ['living-assurance-case', 'eliminative-argumentation'],
      })
    : null;
  const openDefeater = opensUnderminingDefeater || opensUndercuttingDefeater
    ? createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ??
            `defeater:runtime-monitor:${shortDigest(monitorRefDigest)}`,
          'defeaterId',
        ),
        kind: opensUnderminingDefeater ? 'undermining' : 'undercutting',
        state: 'open',
        attacksNodeId: targetClaimNodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest,
        openedByRefDigest: observerRefDigest,
        openedAt: observedAt,
      })
    : null;
  const evidenceTransition = evidenceNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${evidenceNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: observerRefDigest,
        occurredAt: observedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: monitorRefDigest,
      });
  const defeaterTransition = openDefeater === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:open:${openDefeater.defeaterId}`,
        transitionKind: 'open-defeater',
        actorRefDigest: observerRefDigest,
        occurredAt: observedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: openDefeater.defeaterId,
        fromState: null,
        toState: 'open',
        evidenceRefDigest: monitorRefDigest,
      });
  const core: Omit<RuntimeMonitorSkeletonRecord, 'canonical' | 'digest'> = {
    version: RUNTIME_MONITOR_SKELETON_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    monitorId,
    monitorRefDigest,
    observedAt,
    observerRefDigest,
    tenantRefDigest,
    scopeDigest,
    targetClaimNodeId,
    pipelineDigest: input.pipeline.digest,
    envelopeRefDigest: input.pipeline.projection.envelopeRefDigest,
    packetDigest: input.pipeline.assurancePacket.digest,
    traceSnapshotDigest: input.traceSnapshot.digest,
    traceId: input.traceSnapshot.traceId,
    traceRootDigest: input.traceSnapshot.rootDigest,
    traceEntryCount: input.traceSnapshot.entryCount,
    tracePipelineDigests: pipelineDigests,
    traceEnvelopeDigests: envelopeDigests,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    measurementStatus: measurementPlane?.status ?? null,
    observationKinds,
    sourceObservedAt,
    observationAgeSeconds,
    maxObservationAgeSeconds,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    openDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    openDefeaterDigest: openDefeater?.digest ?? null,
    outcome,
    findings,
    reasonCodes,
    runtimeEvidenceReady,
    opensUnderminingDefeater,
    opensUndercuttingDefeater,
    digestOnly: true,
    readOnly: true,
    noRawPayload: true,
    noRawTrace: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    notRuntimeOracle: true,
    noLearning: true,
    noTraining: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...core,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function runtimeMonitorSkeletonDescriptor():
RuntimeMonitorSkeletonDescriptor {
  return Object.freeze({
    version: RUNTIME_MONITOR_SKELETON_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    sourceAnchors: RUNTIME_MONITOR_SOURCE_ANCHORS,
    observationKinds: RUNTIME_MONITOR_OBSERVATION_KINDS,
    outcomes: RUNTIME_MONITOR_OUTCOMES,
    findings: RUNTIME_MONITOR_FINDINGS,
    createsEvidenceNodeWhenHealthy: true,
    opensUnderminingDefeaterOnInvalidEvidence: true,
    opensUndercuttingDefeaterOnMonitorDegradation: true,
    requiresVerifiedDecisionTrace: true,
    requiresPipelineTraceBinding: true,
    digestOnly: true,
    readOnly: true,
    noRawPayload: true,
    noRawTrace: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    notRuntimeOracle: true,
    noLearning: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-runtime-enforcement-monitor',
      'not-audit-plane-writer',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-monitoring-readiness',
      'not-siem-or-otel-conformance',
      'not-formal-runtime-verification',
      'not-model-training',
      'not-decision-authority',
    ]),
  });
}
