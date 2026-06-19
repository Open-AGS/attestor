import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
} from './tamper-evident-history.js';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  type ShadowRuntimePipelineResult,
} from './shadow-runtime-pipeline.js';
import {
  DECISION_TRACE_APPEND_OUTCOMES,
  DECISION_TRACE_FAILURE_REASONS,
  DECISION_TRACE_LOGGER_VERSION,
  DECISION_TRACE_PHASES,
  type CreateDecisionTraceLoggerInput,
  type DecisionTraceAppendDecision,
  type DecisionTraceAppendOutcome,
  type DecisionTraceEntry,
  type DecisionTraceFailureReason,
  type DecisionTraceLogger,
  type DecisionTraceLoggerDescriptor,
  type DecisionTracePhase,
  type DecisionTracePhaseSpec,
  type DecisionTraceSnapshot,
  type DecisionTraceVerification,
  type VerifyDecisionTraceEntriesInput,
} from './decision-trace-logger-types.js';

export {
  DECISION_TRACE_APPEND_OUTCOMES,
  DECISION_TRACE_FAILURE_REASONS,
  DECISION_TRACE_LOGGER_VERSION,
  DECISION_TRACE_PHASES,
} from './decision-trace-logger-types.js';
export type {
  CreateDecisionTraceLoggerInput,
  DecisionTraceAppendDecision,
  DecisionTraceAppendOutcome,
  DecisionTraceEntry,
  DecisionTraceFailureReason,
  DecisionTraceLogger,
  DecisionTraceLoggerDescriptor,
  DecisionTracePhase,
  DecisionTracePhaseSpec,
  DecisionTraceSnapshot,
  DecisionTraceVerification,
  VerifyDecisionTraceEntriesInput,
} from './decision-trace-logger-types.js';

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
    throw new Error(`Decision trace logger ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Decision trace logger ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Decision trace logger ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Decision trace logger ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeTtlSeconds(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Decision trace logger ttlSeconds is required and must be a positive integer.');
  }
  return value;
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === null || value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Decision trace logger ${fieldName} must be a positive integer.`);
  }
  return value;
}

function ttlExpiresAt(observedAt: string, ttlSeconds: number): string {
  return new Date(new Date(observedAt).getTime() + ttlSeconds * 1000).toISOString();
}

function uniqueReasonCodes(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) =>
    normalizeIdentifier(value, 'reasonCodes[]'),
  ))].sort());
}

function orderedFailures(
  reasons: readonly DecisionTraceFailureReason[],
): readonly DecisionTraceFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    DECISION_TRACE_FAILURE_REASONS.filter((reason) => present.has(reason)),
  );
}

function entryPayloadDigest(input: {
  readonly traceId: string;
  readonly sequence: number;
  readonly phase: DecisionTracePhase;
  readonly componentVersion: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly observedAt: string;
  readonly ttlExpiresAt: string;
  readonly reasonCodes: readonly string[];
}): string {
  return digestValue('decision-trace-entry-payload', {
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId: input.traceId,
    sequence: input.sequence,
    phase: input.phase,
    componentVersion: input.componentVersion,
    pipelineDigest: input.pipelineDigest,
    envelopeRefDigest: input.envelopeRefDigest,
    inputDigest: input.inputDigest,
    outputDigest: input.outputDigest,
    observedAt: input.observedAt,
    ttlExpiresAt: input.ttlExpiresAt,
    reasonCodes: input.reasonCodes,
    rawPayloadStored: false,
  } as CanonicalReleaseJsonValue);
}

function entryDigest(input: {
  readonly traceId: string;
  readonly sequence: number;
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
  readonly entryPayloadDigest: string;
}): string {
  return digestValue('decision-trace-entry', {
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId: input.traceId,
    sequence: input.sequence,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: input.entryPayloadDigest,
  } as CanonicalReleaseJsonValue);
}

function rootDigest(input: {
  readonly traceId: string;
  readonly sequence: number;
  readonly previousRootDigest: string | null;
  readonly entryDigest: string;
}): string {
  return digestValue('decision-trace-root', {
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId: input.traceId,
    sequence: input.sequence,
    previousRootDigest: input.previousRootDigest,
    entryDigest: input.entryDigest,
  } as CanonicalReleaseJsonValue);
}

function assertPipelineBoundary(pipeline: ShadowRuntimePipelineResult): void {
  if (pipeline.version !== SHADOW_RUNTIME_PIPELINE_VERSION) {
    throw new Error('Decision trace logger input must be a shadow runtime pipeline result.');
  }
  normalizeDigest(pipeline.digest, 'pipeline.digest');
  normalizeDigest(pipeline.projection.envelopeRefDigest, 'projection.envelopeRefDigest');
  if (
    pipeline.executionMode !== 'shadow-only' ||
    pipeline.noLiveEnforcement !== true ||
    pipeline.grantsAuthority !== false ||
    pipeline.canAdmit !== false ||
    pipeline.activatesEnforcement !== false ||
    pipeline.autoEnforce !== false ||
    pipeline.learnsFromTraffic !== false ||
    pipeline.crossTenantAggregation !== false ||
    pipeline.rawPayloadRead !== false ||
    pipeline.rawPayloadStored !== false ||
    pipeline.productionReady !== false
  ) {
    throw new Error(
      'Decision trace logger input pipeline must preserve shadow-only no-authority invariants.',
    );
  }
}

function digestMany(kind: string, values: readonly string[]): string {
  return digestValue(kind, [...values].sort());
}

function phaseSpecs(pipeline: ShadowRuntimePipelineResult): readonly DecisionTracePhaseSpec[] {
  const signalBatchDigest = digestMany(
    'decision-trace.signal-batches',
    pipeline.signalBatches.map((batch) => batch.digest),
  );
  const signalDigest = digestMany(
    'decision-trace.signals',
    pipeline.signals.map((signal) =>
      digestValue('decision-trace.signal', signal as unknown as CanonicalReleaseJsonValue)
    ),
  );
  const opinionDigest = digestMany(
    'decision-trace.opinions',
    pipeline.opinions.map((opinion) =>
      digestValue('decision-trace.opinion', opinion as unknown as CanonicalReleaseJsonValue)
    ),
  );
  const modulatorDigest = digestMany(
    'decision-trace.modulators',
    pipeline.modulators.map((modulator) =>
      digestValue('decision-trace.modulator', modulator as unknown as CanonicalReleaseJsonValue)
    ),
  );
  const fusionDigest = digestValue(
    'decision-trace.fusion',
    pipeline.fusion as unknown as CanonicalReleaseJsonValue,
  );
  const conflictDigest = digestValue(
    'decision-trace.conflict-gate',
    pipeline.conflictGate as unknown as CanonicalReleaseJsonValue,
  );
  const humanGateDigest = digestValue(
    'decision-trace.human-gate',
    pipeline.humanComprehensionGate as unknown as CanonicalReleaseJsonValue,
  );
  return Object.freeze([
    {
      phase: 'shadow-event',
      componentVersion: pipeline.projection.accepts,
      inputDigest: pipeline.projection.sourceEventDigest,
      outputDigest: pipeline.projection.sourceEventDigest,
      reasonCodes: ['shadow-event-digest-bound'],
    },
    {
      phase: 'envelope-projection',
      componentVersion: pipeline.shadowEnvelopeProjectorVersion,
      inputDigest: pipeline.projection.sourceEventDigest,
      outputDigest: pipeline.projection.digest,
      reasonCodes: ['envelope-projected'],
    },
    {
      phase: 'signal-extraction',
      componentVersion: pipeline.signalExtractorContractVersion,
      inputDigest: pipeline.projection.digest,
      outputDigest: digestMany('decision-trace.signal-extraction', [
        signalBatchDigest,
        signalDigest,
      ]),
      reasonCodes: ['typed-signals-extracted'],
    },
    {
      phase: 'relationship-detection',
      componentVersion: pipeline.relationshipDetectorContractVersion,
      inputDigest: signalDigest,
      outputDigest: pipeline.relationshipDetection.digest,
      reasonCodes: ['relationships-detected-before-fusion'],
    },
    {
      phase: 'relationship-aware-fusion',
      componentVersion: pipeline.relationshipAwareMonotoneFusionVersion,
      inputDigest: digestMany('decision-trace.fusion-input', [
        pipeline.relationshipDetection.digest,
        opinionDigest,
        modulatorDigest,
      ]),
      outputDigest: fusionDigest,
      reasonCodes: pipeline.fusion.reasonCodes,
    },
    {
      phase: 'conflict-abstention-gate',
      componentVersion: pipeline.conflictAbstentionGateVersion,
      inputDigest: fusionDigest,
      outputDigest: conflictDigest,
      reasonCodes: pipeline.conflictGate.reasonCodes,
    },
    {
      phase: 'human-comprehension-gate',
      componentVersion: pipeline.humanComprehensionGateVersion,
      inputDigest: conflictDigest,
      outputDigest: humanGateDigest,
      reasonCodes: pipeline.humanComprehensionGate.reasonCodes,
    },
    {
      phase: 'assurance-packet',
      componentVersion: pipeline.signedAssurancePacketVersion,
      inputDigest: humanGateDigest,
      outputDigest: pipeline.assurancePacket.digest,
      reasonCodes: [
        ...pipeline.assurancePacket.decisionBinding.reasonCodes,
        ...pipeline.assurancePacket.remainingActivationBlockers,
      ],
    },
  ]);
}

function createEntry(input: {
  readonly traceId: string;
  readonly sequence: number;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly phase: DecisionTracePhaseSpec;
  readonly observedAt: string;
  readonly ttlExpiresAt: string;
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
}): DecisionTraceEntry {
  const reasonCodes = uniqueReasonCodes(input.phase.reasonCodes);
  const payloadDigest = entryPayloadDigest({
    traceId: input.traceId,
    sequence: input.sequence,
    phase: input.phase.phase,
    componentVersion: input.phase.componentVersion,
    pipelineDigest: input.pipelineDigest,
    envelopeRefDigest: input.envelopeRefDigest,
    inputDigest: normalizeDigest(input.phase.inputDigest, 'phase.inputDigest'),
    outputDigest: normalizeDigest(input.phase.outputDigest, 'phase.outputDigest'),
    observedAt: input.observedAt,
    ttlExpiresAt: input.ttlExpiresAt,
    reasonCodes,
  });
  const digest = entryDigest({
    traceId: input.traceId,
    sequence: input.sequence,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: payloadDigest,
  });
  const root = rootDigest({
    traceId: input.traceId,
    sequence: input.sequence,
    previousRootDigest: input.previousRootDigest,
    entryDigest: digest,
  });
  return Object.freeze({
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId: input.traceId,
    sequence: input.sequence,
    phase: input.phase.phase,
    componentVersion: input.phase.componentVersion,
    pipelineDigest: input.pipelineDigest,
    envelopeRefDigest: input.envelopeRefDigest,
    inputDigest: normalizeDigest(input.phase.inputDigest, 'phase.inputDigest'),
    outputDigest: normalizeDigest(input.phase.outputDigest, 'phase.outputDigest'),
    observedAt: input.observedAt,
    ttlExpiresAt: input.ttlExpiresAt,
    reasonCodes,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: payloadDigest,
    entryDigest: digest,
    rootDigest: root,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function appendDecision(input: {
  readonly outcome: DecisionTraceAppendOutcome;
  readonly traceId: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly entries: readonly DecisionTraceEntry[];
  readonly failureReasons?: readonly DecisionTraceFailureReason[];
}): DecisionTraceAppendDecision {
  const failureReasons = orderedFailures(input.failureReasons ?? []);
  const reasonCodes = uniqueReasonCodes(
    failureReasons.length === 0
      ? [`decision-trace-${input.outcome}`]
      : failureReasons.map((reason) => `decision-trace-${reason}`),
  );
  return Object.freeze({
    version: DECISION_TRACE_LOGGER_VERSION,
    outcome: input.outcome,
    recorded: input.outcome === 'recorded',
    failClosed: input.outcome !== 'recorded',
    traceId: input.traceId,
    pipelineDigest: input.pipelineDigest,
    envelopeRefDigest: input.envelopeRefDigest,
    entryCount: input.entries.length,
    entries: Object.freeze([...input.entries]),
    failureReasons,
    reasonCodes,
    decisionDigest: digestValue('decision-trace-append-decision', {
      version: DECISION_TRACE_LOGGER_VERSION,
      outcome: input.outcome,
      traceId: input.traceId,
      pipelineDigest: input.pipelineDigest,
      envelopeRefDigest: input.envelopeRefDigest,
      entryDigests: input.entries.map((entry) => entry.entryDigest),
      failureReasons,
    } as CanonicalReleaseJsonValue),
  });
}

function readonlyEntries(
  records: readonly DecisionTraceEntry[],
): readonly DecisionTraceEntry[] {
  return Object.freeze([...records]);
}

function verificationFor(input: {
  readonly traceId: string;
  readonly entries: readonly DecisionTraceEntry[];
  readonly verifiedAt: string;
}): DecisionTraceVerification {
  const failures: DecisionTraceFailureReason[] = [];
  let previousEntryDigest: string | null = null;
  let previousRootDigest: string | null = null;
  let expectedSequence = 1;

  for (const entry of input.entries) {
    if (entry.version !== DECISION_TRACE_LOGGER_VERSION) {
      failures.push('entry-payload-digest-mismatch');
    }
    if (entry.traceId !== input.traceId || entry.sequence !== expectedSequence) {
      failures.push('sequence-gap');
    }
    if (entry.previousEntryDigest !== previousEntryDigest) {
      failures.push('previous-entry-digest-mismatch');
    }
    if (entry.previousRootDigest !== previousRootDigest) {
      failures.push('previous-root-digest-mismatch');
    }
    const expectedPayloadDigest = entryPayloadDigest({
      traceId: entry.traceId,
      sequence: entry.sequence,
      phase: entry.phase,
      componentVersion: entry.componentVersion,
      pipelineDigest: entry.pipelineDigest,
      envelopeRefDigest: entry.envelopeRefDigest,
      inputDigest: entry.inputDigest,
      outputDigest: entry.outputDigest,
      observedAt: entry.observedAt,
      ttlExpiresAt: entry.ttlExpiresAt,
      reasonCodes: entry.reasonCodes,
    });
    if (entry.entryPayloadDigest !== expectedPayloadDigest) {
      failures.push('entry-payload-digest-mismatch');
    }
    const expectedEntryDigest = entryDigest({
      traceId: entry.traceId,
      sequence: entry.sequence,
      previousEntryDigest: entry.previousEntryDigest,
      previousRootDigest: entry.previousRootDigest,
      entryPayloadDigest: entry.entryPayloadDigest,
    });
    if (entry.entryDigest !== expectedEntryDigest) {
      failures.push('entry-digest-mismatch');
    }
    const expectedRootDigest = rootDigest({
      traceId: entry.traceId,
      sequence: entry.sequence,
      previousRootDigest: entry.previousRootDigest,
      entryDigest: entry.entryDigest,
    });
    if (entry.rootDigest !== expectedRootDigest) {
      failures.push('root-digest-mismatch');
    }
    if (new Date(input.verifiedAt).getTime() > new Date(entry.ttlExpiresAt).getTime()) {
      failures.push('ttl-expired');
    }
    previousEntryDigest = entry.entryDigest;
    previousRootDigest = entry.rootDigest;
    expectedSequence += 1;
  }

  const ordered = orderedFailures(failures);
  return Object.freeze({
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId: input.traceId,
    valid: ordered.length === 0,
    failClosed: ordered.length > 0,
    verifiedEntryCount: input.entries.length,
    rootDigest: input.entries.at(-1)?.rootDigest ?? null,
    firstEntryDigest: input.entries[0]?.entryDigest ?? null,
    lastEntryDigest: input.entries.at(-1)?.entryDigest ?? null,
    failureReasons: ordered,
    rawPayloadStored: false,
    productionReady: false,
  });
}

export function verifyDecisionTraceEntries(
  input: VerifyDecisionTraceEntriesInput,
): DecisionTraceVerification {
  return verificationFor({
    traceId: normalizeIdentifier(input.traceId, 'traceId'),
    entries: input.entries,
    verifiedAt: normalizeIsoTimestamp(
      input.verifiedAt,
      new Date().toISOString(),
      'verifiedAt',
    ),
  });
}

export function decisionTraceLoggerDescriptor():
  DecisionTraceLoggerDescriptor {
  return Object.freeze({
    version: DECISION_TRACE_LOGGER_VERSION,
    shadowRuntimePipelineVersion: SHADOW_RUNTIME_PIPELINE_VERSION,
    tamperEvidentHistoryVersion: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    phases: DECISION_TRACE_PHASES,
    appendOutcomes: DECISION_TRACE_APPEND_OUTCOMES,
    failureReasons: DECISION_TRACE_FAILURE_REASONS,
    chainMode: 'linear-hash-chain',
    ttlRequired: true,
    replayRejected: true,
    digestOnly: true,
    structuredForOfflineSpecChecks: true,
    writesAuditPlane: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-audit-plane-write',
      'not-production-log-integrity',
      'not-external-immutability',
      'not-formal-verification',
      'not-live-enforcement',
      'not-policy-activation',
      'not-production-ready',
    ]),
  });
}

export function createDecisionTraceLogger(
  input: CreateDecisionTraceLoggerInput,
): DecisionTraceLogger {
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds);
  const maxEntries = normalizePositiveInteger(input.maxEntries, 'maxEntries', 1024);
  const now = input.now ?? (() => new Date().toISOString());
  const traceId = normalizeIdentifier(
    input.traceId ?? digestValue('decision-trace-id', { createdAt: now() }),
    'traceId',
  );
  const entries: DecisionTraceEntry[] = [];
  const recordedPipelines = new Set<string>();

  function recordPipeline(
    pipeline: ShadowRuntimePipelineResult,
    observedAtInput?: string | null,
  ): DecisionTraceAppendDecision {
    assertPipelineBoundary(pipeline);
    const observedAt = normalizeIsoTimestamp(observedAtInput, now(), 'observedAt');
    const expiresAt = ttlExpiresAt(observedAt, ttlSeconds);
    const pipelineDigest = normalizeDigest(pipeline.digest, 'pipeline.digest');
    const envelopeRefDigest = normalizeDigest(
      pipeline.projection.envelopeRefDigest,
      'projection.envelopeRefDigest',
    );
    if (recordedPipelines.has(pipelineDigest)) {
      return appendDecision({
        outcome: 'replay-rejected',
        traceId,
        pipelineDigest,
        envelopeRefDigest,
        entries: [],
        failureReasons: ['pipeline-replay'],
      });
    }
    const phases = phaseSpecs(pipeline);
    if (entries.length + phases.length > maxEntries) {
      return appendDecision({
        outcome: 'held',
        traceId,
        pipelineDigest,
        envelopeRefDigest,
        entries: [],
        failureReasons: ['trace-capacity-exhausted'],
      });
    }
    const createdEntries: DecisionTraceEntry[] = [];
    for (const phase of phases) {
      const previous = createdEntries.at(-1) ?? entries.at(-1) ?? null;
      const entry = createEntry({
        traceId,
        sequence: entries.length + createdEntries.length + 1,
        pipelineDigest,
        envelopeRefDigest,
        phase,
        observedAt,
        ttlExpiresAt: expiresAt,
        previousEntryDigest: previous?.entryDigest ?? null,
        previousRootDigest: previous?.rootDigest ?? null,
      });
      createdEntries.push(entry);
    }
    entries.push(...createdEntries);
    recordedPipelines.add(pipelineDigest);
    return appendDecision({
      outcome: 'recorded',
      traceId,
      pipelineDigest,
      envelopeRefDigest,
      entries: createdEntries,
    });
  }

  function list(): readonly DecisionTraceEntry[] {
    return readonlyEntries(entries);
  }

  function verify(verifiedAt?: string | null): DecisionTraceVerification {
    return verificationFor({
      traceId,
      entries,
      verifiedAt: normalizeIsoTimestamp(verifiedAt, now(), 'verifiedAt'),
    });
  }

  function snapshot(exportedAt?: string | null): DecisionTraceSnapshot {
    const exportedTimestamp = normalizeIsoTimestamp(exportedAt, now(), 'exportedAt');
    const verification = verify(exportedTimestamp);
    const payload = {
      version: DECISION_TRACE_LOGGER_VERSION,
      traceId,
      exportedAt: exportedTimestamp,
      entryCount: entries.length,
      rootDigest: verification.rootDigest,
      firstEntryDigest: verification.firstEntryDigest,
      lastEntryDigest: verification.lastEntryDigest,
      entries: readonlyEntries(entries),
      verification,
      appendOnly: true,
      digestOnly: true,
      writesAuditPlane: false,
      signatureIncluded: false,
      externalImmutabilityClaimed: false,
      complianceClaimed: false,
      rawPayloadStored: false,
      productionReady: false,
    } as const;
    const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
    return Object.freeze({
      ...payload,
      canonical: canonical.canonical,
      digest: canonical.digest,
    });
  }

  return Object.freeze({
    version: DECISION_TRACE_LOGGER_VERSION,
    traceId,
    ttlSeconds,
    recordPipeline,
    list,
    verify,
    snapshot,
    writesAuditPlane: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  });
}
