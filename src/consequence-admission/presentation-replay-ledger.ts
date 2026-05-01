import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionResponse,
} from './index.js';
import type {
  ConsequenceAdmissionDownstreamContract,
  CreateConsequenceAdmissionDownstreamContractInput,
} from './downstream-enforcement-contract.js';
import {
  evaluateConsequenceAdmissionPresentationBinding,
  type ConsequenceAdmissionPresentationBinding,
  type ConsequenceAdmissionPresentationDecision,
  type ConsequenceAdmissionPresentationExpectation,
} from './presentation-binding.js';

export const CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION =
  'attestor.consequence-admission-presentation-replay-ledger.v1';

export const CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_OUTCOMES = [
  'consumed',
  'held',
] as const;
export type ConsequenceAdmissionPresentationReplayLedgerOutcome =
  typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS = [
  'presentation-held',
  'replay-key-missing',
  'replay-key-already-consumed',
  'retention-window-invalid',
] as const;
export type ConsequenceAdmissionPresentationReplayLedgerFailureReason =
  typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS[number];

export interface ConsequenceAdmissionPresentationReplayLedgerEntry {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly replayKeyDigest: string;
  readonly bindingId: string;
  readonly bindingDigest: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly targetDigest: string;
  readonly nonceDigest: string | null;
  readonly consumedAt: string;
  readonly presentationExpiresAt: string;
  readonly retainedUntil: string;
  readonly presentationReceiptDigest: string;
  readonly entryDigest: string;
}

export interface ConsumeConsequenceAdmissionPresentationReplayInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly presentation: ConsequenceAdmissionPresentationBinding;
  readonly expected?: ConsequenceAdmissionPresentationExpectation | null;
  readonly consumedAt?: string | null;
}

export interface ConsequenceAdmissionPresentationReplayLedgerDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION;
  readonly outcome: ConsequenceAdmissionPresentationReplayLedgerOutcome;
  readonly consumed: boolean;
  readonly failClosed: boolean;
  readonly ledgerId: string;
  readonly replayKeyDigest: string | null;
  readonly bindingId: string;
  readonly bindingDigest: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly consumedAt: string;
  readonly presentationDecision: ConsequenceAdmissionPresentationDecision;
  readonly entry: ConsequenceAdmissionPresentationReplayLedgerEntry | null;
  readonly failureReasons: readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
  readonly receiptDigest: string;
}

export interface ConsequenceAdmissionPresentationReplayLedgerSnapshot {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly entryCount: number;
  readonly entries: readonly ConsequenceAdmissionPresentationReplayLedgerEntry[];
}

export interface ConsequenceAdmissionPresentationReplayLedger {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION;
  readonly ledgerId: string;
  readonly consume: (
    input: ConsumeConsequenceAdmissionPresentationReplayInput,
  ) => ConsequenceAdmissionPresentationReplayLedgerDecision;
  readonly has: (replayKey: string, now?: string | null) => boolean;
  readonly snapshot: (
    now?: string | null,
  ) => ConsequenceAdmissionPresentationReplayLedgerSnapshot;
  readonly prune: (now?: string | null) => number;
}

export interface CreateConsequenceAdmissionPresentationReplayLedgerInput {
  readonly ledgerId?: string | null;
  readonly retentionSeconds?: number | null;
  readonly now?: (() => string) | null;
}

export interface ConsequenceAdmissionPresentationReplayLedgerDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION;
  readonly outcomes: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_OUTCOMES;
  readonly failureReasons: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS;
  readonly storesRawReplayKeysExternally: false;
  readonly storesRawTargetsExternally: false;
  readonly storesRawNoncesExternally: false;
  readonly inMemoryReferenceImplementation: true;
  readonly productionSharedStoreIncluded: false;
  readonly failClosed: true;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission presentation replay ledger ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence admission presentation replay ledger ${fieldName} requires a non-empty value.`,
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

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence admission presentation replay ledger ${fieldName} must be an ISO timestamp.`,
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
      `Consequence admission presentation replay ledger ${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

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

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function retentionLimit(input: {
  readonly consumedAt: string;
  readonly presentationExpiresAt: string;
  readonly retentionSeconds: number;
}): string {
  const consumedUntil = new Date(input.consumedAt).getTime() + input.retentionSeconds * 1000;
  const expiresAt = new Date(input.presentationExpiresAt).getTime();
  return new Date(Math.max(consumedUntil, expiresAt)).toISOString();
}

function orderedFailureReasons(
  reasons: readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[],
): readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function entryDigest(
  input: Omit<ConsequenceAdmissionPresentationReplayLedgerEntry, 'entryDigest'>,
): string {
  return digestValue({
    version: input.version,
    ledgerId: input.ledgerId,
    replayKeyDigest: input.replayKeyDigest,
    bindingId: input.bindingId,
    bindingDigest: input.bindingDigest,
    admissionId: input.admissionId,
    admissionDigest: input.admissionDigest,
    contractId: input.contractId,
    enforcementPointId: input.enforcementPointId,
    targetDigest: input.targetDigest,
    nonceDigest: input.nonceDigest,
    consumedAt: input.consumedAt,
    presentationExpiresAt: input.presentationExpiresAt,
    retainedUntil: input.retainedUntil,
    presentationReceiptDigest: input.presentationReceiptDigest,
  } as CanonicalReleaseJsonValue);
}

function decisionReceiptDigest(input: {
  readonly outcome: ConsequenceAdmissionPresentationReplayLedgerOutcome;
  readonly ledgerId: string;
  readonly replayKeyDigest: string | null;
  readonly bindingId: string;
  readonly bindingDigest: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly consumedAt: string;
  readonly presentationReceiptDigest: string;
  readonly failureReasons: readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[];
  readonly entryDigest: string | null;
}): string {
  return digestValue({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    outcome: input.outcome,
    ledgerId: input.ledgerId,
    replayKeyDigest: input.replayKeyDigest,
    bindingId: input.bindingId,
    bindingDigest: input.bindingDigest,
    admissionId: input.admissionId,
    admissionDigest: input.admissionDigest,
    consumedAt: input.consumedAt,
    presentationReceiptDigest: input.presentationReceiptDigest,
    failureReasons: input.failureReasons,
    entryDigest: input.entryDigest,
  } as CanonicalReleaseJsonValue);
}

function reasonFor(
  outcome: ConsequenceAdmissionPresentationReplayLedgerOutcome,
  failureReasons: readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[],
): string {
  if (outcome === 'consumed') {
    return 'Presentation replay ledger consumed the replay key after the downstream presentation binding allowed the consequence.';
  }
  if (failureReasons.includes('replay-key-already-consumed')) {
    return 'Presentation replay ledger held the consequence because the replay key was already consumed.';
  }
  if (failureReasons.includes('replay-key-missing')) {
    return 'Presentation replay ledger held the consequence because no replay key was present.';
  }
  if (failureReasons.includes('presentation-held')) {
    return 'Presentation replay ledger held the consequence because the presentation binding did not allow it.';
  }
  return 'Presentation replay ledger held the consequence because replay consumption could not close safely.';
}

function decision(input: {
  readonly outcome: ConsequenceAdmissionPresentationReplayLedgerOutcome;
  readonly ledgerId: string;
  readonly replayKeyDigest: string | null;
  readonly presentation: ConsequenceAdmissionPresentationBinding;
  readonly consumedAt: string;
  readonly presentationDecision: ConsequenceAdmissionPresentationDecision;
  readonly entry: ConsequenceAdmissionPresentationReplayLedgerEntry | null;
  readonly failureReasons: readonly ConsequenceAdmissionPresentationReplayLedgerFailureReason[];
}): ConsequenceAdmissionPresentationReplayLedgerDecision {
  const failureReasons = orderedFailureReasons(input.failureReasons);
  const receiptDigest = decisionReceiptDigest({
    outcome: input.outcome,
    ledgerId: input.ledgerId,
    replayKeyDigest: input.replayKeyDigest,
    bindingId: input.presentation.bindingId,
    bindingDigest: input.presentation.digest,
    admissionId: input.presentation.admissionId,
    admissionDigest: input.presentation.admissionDigest,
    consumedAt: input.consumedAt,
    presentationReceiptDigest: input.presentationDecision.receiptDigest,
    failureReasons,
    entryDigest: input.entry?.entryDigest ?? null,
  });

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    outcome: input.outcome,
    consumed: input.outcome === 'consumed',
    failClosed: input.outcome !== 'consumed',
    ledgerId: input.ledgerId,
    replayKeyDigest: input.replayKeyDigest,
    bindingId: input.presentation.bindingId,
    bindingDigest: input.presentation.digest,
    admissionId: input.presentation.admissionId,
    admissionDigest: input.presentation.admissionDigest,
    consumedAt: input.consumedAt,
    presentationDecision: input.presentationDecision,
    entry: input.entry,
    failureReasons,
    reasonCodes: Object.freeze([
      ...input.presentationDecision.reasonCodes,
      ...failureReasons.map((reason) => `presentation-replay-ledger-${reason}`),
      `presentation-replay-ledger-${input.outcome}`,
    ]),
    reason: reasonFor(input.outcome, failureReasons),
    instruction: input.outcome === 'consumed'
      ? `Continue after replay consumption in ledger: ${input.ledgerId}`
      : `Do not continue; replay consumption did not close in ledger: ${input.ledgerId}`,
    receiptDigest,
  });
}

export function createConsequenceAdmissionPresentationReplayLedger(
  input: CreateConsequenceAdmissionPresentationReplayLedgerInput = {},
): ConsequenceAdmissionPresentationReplayLedger {
  const ledgerId = normalizeOptionalIdentifier(input.ledgerId, 'ledgerId') ??
    'consequence-admission-presentation-replay-ledger:memory';
  const retentionSeconds = normalizePositiveInteger(
    input.retentionSeconds,
    'retentionSeconds',
    3600,
  );
  const now = input.now ?? defaultNow;
  const entries = new Map<string, ConsequenceAdmissionPresentationReplayLedgerEntry>();

  function prune(nowValue: string | null = null): number {
    const prunedAt = new Date(normalizeIsoTimestamp(nowValue ?? now(), 'now')).getTime();
    let removed = 0;
    for (const [replayKey, entry] of entries.entries()) {
      if (new Date(entry.retainedUntil).getTime() < prunedAt) {
        entries.delete(replayKey);
        removed += 1;
      }
    }
    return removed;
  }

  function activeReplayKeys(nowValue: string): readonly string[] {
    prune(nowValue);
    return Object.freeze([...entries.keys()].sort());
  }

  function has(replayKey: string, nowValue: string | null = null): boolean {
    const key = normalizeIdentifier(replayKey, 'replayKey');
    prune(nowValue ?? now());
    return entries.has(key);
  }

  function snapshot(
    nowValue: string | null = null,
  ): ConsequenceAdmissionPresentationReplayLedgerSnapshot {
    prune(nowValue ?? now());
    const redactedEntries = Object.freeze(
      [...entries.values()].sort((a, b) => a.replayKeyDigest.localeCompare(b.replayKeyDigest)),
    );
    return Object.freeze({
      version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
      ledgerId,
      entryCount: redactedEntries.length,
      entries: redactedEntries,
    });
  }

  function consume(
    consumeInput: ConsumeConsequenceAdmissionPresentationReplayInput,
  ): ConsequenceAdmissionPresentationReplayLedgerDecision {
    const consumedAt = normalizeIsoTimestamp(consumeInput.consumedAt ?? now(), 'consumedAt');
    const replayKey = normalizeOptionalIdentifier(
      consumeInput.presentation.replayKey,
      'presentation.replayKey',
    );
    const replayKeyDigest = replayKey === null ? null : digestText(replayKey);
    const expectedUsedReplayKeys = Object.freeze(
      Array.from(
        new Set([
          ...(consumeInput.expected?.usedReplayKeys ?? []),
          ...activeReplayKeys(consumedAt),
        ]),
      ).sort(),
    );
    const presentationDecision = evaluateConsequenceAdmissionPresentationBinding({
      admission: consumeInput.admission,
      contract: consumeInput.contract,
      presentation: consumeInput.presentation,
      expected: {
        ...(consumeInput.expected ?? {}),
        requireReplayKey: consumeInput.expected?.requireReplayKey ?? true,
        usedReplayKeys: expectedUsedReplayKeys,
      },
      now: consumedAt,
    });
    const replayAlreadyConsumed =
      replayKey !== null && expectedUsedReplayKeys.includes(replayKey);
    const failureReasons = orderedFailureReasons([
      ...(!presentationDecision.allowed ? ['presentation-held' as const] : []),
      ...(replayKey === null ? ['replay-key-missing' as const] : []),
      ...(replayAlreadyConsumed ? ['replay-key-already-consumed' as const] : []),
    ]);

    if (failureReasons.length > 0 || replayKey === null) {
      return decision({
        outcome: 'held',
        ledgerId,
        replayKeyDigest,
        presentation: consumeInput.presentation,
        consumedAt,
        presentationDecision,
        entry: null,
        failureReasons,
      });
    }

    const consumedReplayKeyDigest = digestText(replayKey);
    const entryBase = Object.freeze({
      version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
      ledgerId,
      replayKeyDigest: consumedReplayKeyDigest,
      bindingId: consumeInput.presentation.bindingId,
      bindingDigest: consumeInput.presentation.digest,
      admissionId: consumeInput.presentation.admissionId,
      admissionDigest: consumeInput.presentation.admissionDigest,
      contractId: consumeInput.presentation.contractId,
      enforcementPointId: consumeInput.presentation.enforcementPointId,
      targetDigest: digestValue(consumeInput.presentation.target as unknown as CanonicalReleaseJsonValue),
      nonceDigest: consumeInput.presentation.nonce === null
        ? null
        : digestText(consumeInput.presentation.nonce),
      consumedAt,
      presentationExpiresAt: consumeInput.presentation.expiresAt,
      retainedUntil: retentionLimit({
        consumedAt,
        presentationExpiresAt: consumeInput.presentation.expiresAt,
        retentionSeconds,
      }),
      presentationReceiptDigest: presentationDecision.receiptDigest,
    } satisfies Omit<ConsequenceAdmissionPresentationReplayLedgerEntry, 'entryDigest'>);
    const entry = Object.freeze({
      ...entryBase,
      entryDigest: entryDigest(entryBase),
    });
    entries.set(replayKey, entry);

    return decision({
      outcome: 'consumed',
      ledgerId,
      replayKeyDigest: consumedReplayKeyDigest,
      presentation: consumeInput.presentation,
      consumedAt,
      presentationDecision,
      entry,
      failureReasons: [],
    });
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    ledgerId,
    consume,
    has,
    snapshot,
    prune,
  });
}

export function consequenceAdmissionPresentationReplayLedgerDescriptor():
ConsequenceAdmissionPresentationReplayLedgerDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
    outcomes: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_OUTCOMES,
    failureReasons: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS,
    storesRawReplayKeysExternally: false,
    storesRawTargetsExternally: false,
    storesRawNoncesExternally: false,
    inMemoryReferenceImplementation: true,
    productionSharedStoreIncluded: false,
    failClosed: true,
  });
}
