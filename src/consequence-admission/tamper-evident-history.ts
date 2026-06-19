import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  type ConsequenceTamperEvidentHistoryAppendDecision,
  type ConsequenceTamperEvidentHistoryAppendOutcome,
  type ConsequenceTamperEvidentHistoryArtifactRef,
  type ConsequenceTamperEvidentHistoryDescriptor,
  type ConsequenceTamperEvidentHistoryEntry,
  type ConsequenceTamperEvidentHistoryEntryKind,
  type ConsequenceTamperEvidentHistoryExport,
  type ConsequenceTamperEvidentHistoryFailureReason,
  type ConsequenceTamperEvidentHistoryLedger,
  type ConsequenceTamperEvidentHistorySnapshot,
  type ConsequenceTamperEvidentHistoryVerification,
  type ConsequenceTamperEvidentHistoryVerificationFailureReason,
  type CreateConsequenceTamperEvidentHistoryLedgerInput,
  type RecordConsequenceTamperEvidentHistoryInput,
  type VerifyConsequenceTamperEvidentHistoryInput,
} from './tamper-evident-history-types.js';

export {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS,
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
} from './tamper-evident-history-types.js';
export type {
  ConsequenceTamperEvidentHistoryAppendDecision,
  ConsequenceTamperEvidentHistoryAppendOutcome,
  ConsequenceTamperEvidentHistoryArtifactRef,
  ConsequenceTamperEvidentHistoryDescriptor,
  ConsequenceTamperEvidentHistoryEntry,
  ConsequenceTamperEvidentHistoryEntryKind,
  ConsequenceTamperEvidentHistoryExport,
  ConsequenceTamperEvidentHistoryFailureReason,
  ConsequenceTamperEvidentHistoryLedger,
  ConsequenceTamperEvidentHistorySnapshot,
  ConsequenceTamperEvidentHistoryVerification,
  ConsequenceTamperEvidentHistoryVerificationFailureReason,
  CreateConsequenceTamperEvidentHistoryLedgerInput,
  RecordConsequenceTamperEvidentHistoryInput,
  VerifyConsequenceTamperEvidentHistoryInput,
} from './tamper-evident-history-types.js';

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence tamper-evident history ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence tamper-evident history ${fieldName} requires a non-empty value.`,
    );
  }
  if (normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(
      `Consequence tamper-evident history ${fieldName} must be bounded and control-free.`,
    );
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^sha256:[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error(
      `Consequence tamper-evident history ${fieldName} must be a sha256 digest.`,
    );
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence tamper-evident history ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Consequence tamper-evident history ${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

function normalizeEntryKind(
  value: ConsequenceTamperEvidentHistoryEntryKind,
): ConsequenceTamperEvidentHistoryEntryKind {
  if (!CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS.includes(value)) {
    throw new Error(
      `Consequence tamper-evident history sourceKind must be one of: ${CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS.join(', ')}.`,
    );
  }
  return value;
}

function normalizeReasonCodes(value: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze(
    [...new Set([...(value ?? [])].map((reason) =>
      normalizeIdentifier(reason, 'reasonCodes[]'),
    ))].sort(),
  );
}

function normalizeArtifactRefs(
  value: readonly ConsequenceTamperEvidentHistoryArtifactRef[] | null | undefined,
): readonly ConsequenceTamperEvidentHistoryArtifactRef[] {
  return Object.freeze(
    [...(value ?? [])]
      .map((artifact) => Object.freeze({
        kind: normalizeIdentifier(artifact.kind, 'artifactRefs[].kind'),
        id: normalizeIdentifier(artifact.id, 'artifactRefs[].id'),
        digest: normalizeDigest(artifact.digest, 'artifactRefs[].digest'),
      }))
      .sort((left, right) =>
        `${left.kind}:${left.id}:${left.digest}`.localeCompare(
          `${right.kind}:${right.id}:${right.digest}`,
        )
      ),
  );
}

function entryPayloadDigest(input: {
  readonly historyId: string;
  readonly sequence: number;
  readonly sourceKind: ConsequenceTamperEvidentHistoryEntryKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly reasonCodes: readonly string[];
  readonly artifactRefs: readonly ConsequenceTamperEvidentHistoryArtifactRef[];
}): string {
  return digestValue({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: input.historyId,
    sequence: input.sequence,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourceDigest: input.sourceDigest,
    tenantId: input.tenantId,
    environment: input.environment,
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt,
    reasonCodes: input.reasonCodes,
    artifactRefs: input.artifactRefs,
    rawPayloadStored: false,
  } as unknown as CanonicalReleaseJsonValue);
}

function historyEntryDigest(input: {
  readonly historyId: string;
  readonly sequence: number;
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
  readonly entryPayloadDigest: string;
}): string {
  return digestValue({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: input.historyId,
    sequence: input.sequence,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: input.entryPayloadDigest,
  } as CanonicalReleaseJsonValue);
}

function historyRootDigest(input: {
  readonly historyId: string;
  readonly sequence: number;
  readonly previousRootDigest: string | null;
  readonly entryDigest: string;
}): string {
  return digestValue({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: input.historyId,
    sequence: input.sequence,
    previousRootDigest: input.previousRootDigest,
    entryDigest: input.entryDigest,
  } as CanonicalReleaseJsonValue);
}

function sourceKey(input: {
  readonly sourceKind: ConsequenceTamperEvidentHistoryEntryKind;
  readonly sourceId: string;
}): string {
  return `${input.sourceKind}\u0000${input.sourceId}`;
}

function readonlyEntries(
  records: readonly ConsequenceTamperEvidentHistoryEntry[],
): readonly ConsequenceTamperEvidentHistoryEntry[] {
  return Object.freeze([...records]);
}

function uniqueKinds(
  entries: readonly ConsequenceTamperEvidentHistoryEntry[],
): readonly ConsequenceTamperEvidentHistoryEntryKind[] {
  return Object.freeze([...new Set(entries.map((entry) => entry.sourceKind))].sort());
}

function orderedAppendFailures(
  reasons: readonly ConsequenceTamperEvidentHistoryFailureReason[],
): readonly ConsequenceTamperEvidentHistoryFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function orderedVerificationFailures(
  reasons: readonly ConsequenceTamperEvidentHistoryVerificationFailureReason[],
): readonly ConsequenceTamperEvidentHistoryVerificationFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function appendDecision(input: {
  readonly outcome: ConsequenceTamperEvidentHistoryAppendOutcome;
  readonly historyId: string;
  readonly sourceKind: ConsequenceTamperEvidentHistoryEntryKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly entry: ConsequenceTamperEvidentHistoryEntry | null;
  readonly failureReasons?: readonly ConsequenceTamperEvidentHistoryFailureReason[];
  readonly reason: string;
  readonly instruction: string;
}): ConsequenceTamperEvidentHistoryAppendDecision {
  const failureReasons = orderedAppendFailures(input.failureReasons ?? []);
  const failClosed = input.outcome === 'held';
  const reasonCodes = Object.freeze(
    failureReasons.length === 0
      ? [`tamper-history-${input.outcome}`]
      : failureReasons.map((reason) => `tamper-history-${reason}`),
  );
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    outcome: input.outcome,
    recorded: input.outcome === 'recorded',
    duplicate: input.outcome === 'duplicate',
    failClosed,
    historyId: input.historyId,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourceDigest: input.sourceDigest,
    sequence: input.entry?.sequence ?? null,
    entry: input.entry,
    failureReasons,
    reasonCodes,
    reason: input.reason,
    instruction: input.instruction,
    decisionDigest: digestValue({
      version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
      outcome: input.outcome,
      historyId: input.historyId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      sourceDigest: input.sourceDigest,
      entryDigest: input.entry?.entryDigest ?? null,
      rootDigest: input.entry?.rootDigest ?? null,
      failureReasons,
    } as CanonicalReleaseJsonValue),
  });
}

function entryFrom(input: {
  readonly historyId: string;
  readonly sequence: number;
  readonly record: RecordConsequenceTamperEvidentHistoryInput;
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
  readonly now: () => string;
}): ConsequenceTamperEvidentHistoryEntry {
  const sourceKind = normalizeEntryKind(input.record.sourceKind);
  const sourceId = normalizeIdentifier(input.record.sourceId, 'sourceId');
  const sourceDigest = normalizeDigest(input.record.sourceDigest, 'sourceDigest');
  const tenantId = normalizeOptionalIdentifier(input.record.tenantId, 'tenantId');
  const environment = normalizeOptionalIdentifier(input.record.environment, 'environment');
  const recordedAt = normalizeIsoTimestamp(input.record.recordedAt ?? input.now(), 'recordedAt');
  const occurredAt = normalizeIsoTimestamp(input.record.occurredAt ?? recordedAt, 'occurredAt');
  const reasonCodes = normalizeReasonCodes(input.record.reasonCodes);
  const artifactRefs = normalizeArtifactRefs(input.record.artifactRefs);
  const payloadDigest = entryPayloadDigest({
    historyId: input.historyId,
    sequence: input.sequence,
    sourceKind,
    sourceId,
    sourceDigest,
    tenantId,
    environment,
    occurredAt,
    recordedAt,
    reasonCodes,
    artifactRefs,
  });
  const entryDigest = historyEntryDigest({
    historyId: input.historyId,
    sequence: input.sequence,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: payloadDigest,
  });
  const rootDigest = historyRootDigest({
    historyId: input.historyId,
    sequence: input.sequence,
    previousRootDigest: input.previousRootDigest,
    entryDigest,
  });
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId: input.historyId,
    sequence: input.sequence,
    sourceKind,
    sourceId,
    sourceDigest,
    tenantId,
    environment,
    occurredAt,
    recordedAt,
    reasonCodes,
    artifactRefs,
    previousEntryDigest: input.previousEntryDigest,
    previousRootDigest: input.previousRootDigest,
    entryPayloadDigest: payloadDigest,
    entryDigest,
    rootDigest,
    rawPayloadStored: false,
  });
}

export function verifyConsequenceTamperEvidentHistoryEntries(
  input: VerifyConsequenceTamperEvidentHistoryInput,
): ConsequenceTamperEvidentHistoryVerification {
  const historyId = normalizeIdentifier(input.historyId, 'historyId');
  const failures: ConsequenceTamperEvidentHistoryVerificationFailureReason[] = [];
  let previousEntryDigest: string | null = null;
  let previousRootDigest: string | null = null;
  let firstEntryDigest: string | null = null;
  let lastEntryDigest: string | null = null;
  let rootDigest: string | null = null;
  let tenantId: string | null | undefined;
  let environment: string | null | undefined;

  input.entries.forEach((entry, index) => {
    const expectedSequence = index + 1;
    if (entry.sequence !== expectedSequence) failures.push('sequence-gap');
    if (entry.previousEntryDigest !== previousEntryDigest) {
      failures.push('previous-entry-digest-mismatch');
    }
    if (entry.previousRootDigest !== previousRootDigest) {
      failures.push('previous-root-digest-mismatch');
    }
    const payloadDigest = entryPayloadDigest({
      historyId,
      sequence: entry.sequence,
      sourceKind: entry.sourceKind,
      sourceId: entry.sourceId,
      sourceDigest: entry.sourceDigest,
      tenantId: entry.tenantId,
      environment: entry.environment,
      occurredAt: entry.occurredAt,
      recordedAt: entry.recordedAt,
      reasonCodes: entry.reasonCodes,
      artifactRefs: entry.artifactRefs,
    });
    if (payloadDigest !== entry.entryPayloadDigest) {
      failures.push('entry-payload-digest-mismatch');
    }
    const expectedEntryDigest = historyEntryDigest({
      historyId,
      sequence: entry.sequence,
      previousEntryDigest: entry.previousEntryDigest,
      previousRootDigest: entry.previousRootDigest,
      entryPayloadDigest: entry.entryPayloadDigest,
    });
    if (expectedEntryDigest !== entry.entryDigest) {
      failures.push('entry-digest-mismatch');
    }
    const expectedRootDigest = historyRootDigest({
      historyId,
      sequence: entry.sequence,
      previousRootDigest: entry.previousRootDigest,
      entryDigest: entry.entryDigest,
    });
    if (expectedRootDigest !== entry.rootDigest) {
      failures.push('root-digest-mismatch');
    }
    if (tenantId === undefined) {
      tenantId = entry.tenantId;
    } else if (tenantId !== entry.tenantId) {
      failures.push('tenant-scope-mismatch');
    }
    if (environment === undefined) {
      environment = entry.environment;
    } else if (environment !== entry.environment) {
      failures.push('environment-scope-mismatch');
    }
    firstEntryDigest ??= entry.entryDigest;
    lastEntryDigest = entry.entryDigest;
    rootDigest = entry.rootDigest;
    previousEntryDigest = entry.entryDigest;
    previousRootDigest = entry.rootDigest;
  });

  const failureReasons = orderedVerificationFailures(failures);
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId,
    valid: failureReasons.length === 0,
    failClosed: failureReasons.length > 0,
    verifiedEntryCount: input.entries.length,
    rootDigest,
    firstEntryDigest,
    lastEntryDigest,
    failureReasons,
    reasonCodes: Object.freeze(
      failureReasons.length === 0
        ? ['tamper-history-verified']
        : failureReasons.map((reason) => `tamper-history-${reason}`),
    ),
    rawPayloadStored: false,
  });
}

function exportDigest(input: Omit<ConsequenceTamperEvidentHistoryExport, 'canonical' | 'digest'>):
{ readonly canonical: string; readonly digest: string } {
  return canonicalObject(input as unknown as CanonicalReleaseJsonValue);
}

export function createConsequenceTamperEvidentHistoryLedger(
  input: CreateConsequenceTamperEvidentHistoryLedgerInput = {},
): ConsequenceTamperEvidentHistoryLedger {
  const historyId = normalizeOptionalIdentifier(input.historyId, 'historyId') ??
    'consequence-history:default';
  const maxEntries = normalizePositiveInteger(input.maxEntries, 'maxEntries', 10_000);
  const now = input.now ?? (() => new Date().toISOString());
  const records: ConsequenceTamperEvidentHistoryEntry[] = [];
  const recordsBySource = new Map<string, ConsequenceTamperEvidentHistoryEntry>();

  function record(
    candidate: RecordConsequenceTamperEvidentHistoryInput,
  ): ConsequenceTamperEvidentHistoryAppendDecision {
    const last = records.at(-1) ?? null;
    const entry = entryFrom({
      historyId,
      sequence: records.length + 1,
      record: candidate,
      previousEntryDigest: last?.entryDigest ?? null,
      previousRootDigest: last?.rootDigest ?? null,
      now,
    });
    const key = sourceKey(entry);
    const existing = recordsBySource.get(key) ?? null;
    if (existing !== null) {
      if (existing.sourceDigest === entry.sourceDigest) {
        return appendDecision({
          outcome: 'duplicate',
          historyId,
          sourceKind: entry.sourceKind,
          sourceId: entry.sourceId,
          sourceDigest: entry.sourceDigest,
          entry: existing,
          reason: 'The source artifact was already present in the tamper-evident history.',
          instruction: 'Use the existing history entry instead of creating a second append.',
        });
      }
      return appendDecision({
        outcome: 'held',
        historyId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        sourceDigest: entry.sourceDigest,
        entry: null,
        failureReasons: ['source-conflict'],
        reason: 'The source id is already bound to a different digest.',
        instruction: 'Do not append conflicting history; investigate the changed source artifact.',
      });
    }
    if (records.length >= maxEntries) {
      return appendDecision({
        outcome: 'held',
        historyId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        sourceDigest: entry.sourceDigest,
        entry: null,
        failureReasons: ['history-capacity-exhausted'],
        reason: 'The tamper-evident history reached its configured entry capacity.',
        instruction: 'Export the current root and move to a production shared history store.',
      });
    }
    const first = records[0] ?? null;
    if (first !== null && first.tenantId !== entry.tenantId) {
      return appendDecision({
        outcome: 'held',
        historyId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        sourceDigest: entry.sourceDigest,
        entry: null,
        failureReasons: ['tenant-scope-mismatch'],
        reason: 'The history already has a different tenant scope.',
        instruction: 'Use a separate tenant-scoped history for this artifact.',
      });
    }
    if (first !== null && first.environment !== entry.environment) {
      return appendDecision({
        outcome: 'held',
        historyId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        sourceDigest: entry.sourceDigest,
        entry: null,
        failureReasons: ['environment-scope-mismatch'],
        reason: 'The history already has a different environment scope.',
        instruction: 'Use a separate environment-scoped history for this artifact.',
      });
    }
    records.push(entry);
    recordsBySource.set(key, entry);
    return appendDecision({
      outcome: 'recorded',
      historyId,
      sourceKind: entry.sourceKind,
      sourceId: entry.sourceId,
      sourceDigest: entry.sourceDigest,
      entry,
      reason: 'The source artifact was appended to the tamper-evident history.',
      instruction: 'Preserve the exported root digest with the audit evidence packet.',
    });
  }

  function snapshot(): ConsequenceTamperEvidentHistorySnapshot {
    const first = records[0] ?? null;
    const last = records.at(-1) ?? null;
    return Object.freeze({
      version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
      historyId,
      entryCount: records.length,
      rootDigest: last?.rootDigest ?? null,
      firstEntryDigest: first?.entryDigest ?? null,
      lastEntryDigest: last?.entryDigest ?? null,
      entries: readonlyEntries(records),
    });
  }

  function verify(): ConsequenceTamperEvidentHistoryVerification {
    return verifyConsequenceTamperEvidentHistoryEntries({
      historyId,
      entries: records,
    });
  }

  function exportHistory(exportedAt?: string | null): ConsequenceTamperEvidentHistoryExport {
    const current = snapshot();
    const verification = verify();
    const exported = {
      version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
      historyId,
      exportedAt: normalizeIsoTimestamp(exportedAt ?? now(), 'exportedAt'),
      entryCount: current.entryCount,
      rootDigest: current.rootDigest,
      firstEntryDigest: current.firstEntryDigest,
      lastEntryDigest: current.lastEntryDigest,
      sourceKinds: uniqueKinds(current.entries),
      entries: current.entries,
      verification,
      appendOnly: true,
      rawPayloadStored: false,
      complianceClaimed: false,
      externalImmutableStoreClaimed: false,
      signatureIncluded: false,
    } as const;
    const canonical = exportDigest(exported);
    return Object.freeze({
      ...exported,
      canonical: canonical.canonical,
      digest: canonical.digest,
    });
  }

  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    historyId,
    record,
    list: () => readonlyEntries(records),
    snapshot,
    verify,
    exportHistory,
  });
}

export function consequenceTamperEvidentHistoryDescriptor():
ConsequenceTamperEvidentHistoryDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    entryKinds: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS,
    appendOutcomes: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES,
    failureReasons: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS,
    verificationFailureReasons: CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS,
    chainMode: 'linear-hash-chain',
    appendOnly: true,
    storesRawPayloads: false,
    externalImmutableStoreIncluded: false,
    merkleTransparencyLogIncluded: false,
    signatureIncluded: false,
    productionSharedStoreIncluded: false,
    complianceClaimed: false,
    failClosed: true,
  });
}
