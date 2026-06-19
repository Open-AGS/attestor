export const CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION =
  'attestor.consequence-tamper-evident-history.v1';

export const CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS = [
  'shadow-admission-event',
  'shadow-simulation',
  'policy-discovery-candidates',
  'policy-promotion-packet',
  'downstream-integration-proof',
  'retry-attempt',
  'presentation-replay',
  'downstream-execution-receipt',
  'audit-evidence-export',
  'business-risk-dashboard',
  'custom-artifact',
] as const;
export type ConsequenceTamperEvidentHistoryEntryKind =
  typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS[number];

export const CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES = [
  'recorded',
  'duplicate',
  'held',
] as const;
export type ConsequenceTamperEvidentHistoryAppendOutcome =
  typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES[number];

export const CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS = [
  'source-conflict',
  'history-capacity-exhausted',
  'tenant-scope-mismatch',
  'environment-scope-mismatch',
] as const;
export type ConsequenceTamperEvidentHistoryFailureReason =
  typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS[number];

export const CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS = [
  'sequence-gap',
  'previous-entry-digest-mismatch',
  'previous-root-digest-mismatch',
  'entry-payload-digest-mismatch',
  'entry-digest-mismatch',
  'root-digest-mismatch',
  'tenant-scope-mismatch',
  'environment-scope-mismatch',
] as const;
export type ConsequenceTamperEvidentHistoryVerificationFailureReason =
  typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS[number];

export interface ConsequenceTamperEvidentHistoryArtifactRef {
  readonly kind: string;
  readonly id: string;
  readonly digest: string;
}

export interface RecordConsequenceTamperEvidentHistoryInput {
  readonly sourceKind: ConsequenceTamperEvidentHistoryEntryKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly occurredAt?: string | null;
  readonly recordedAt?: string | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly artifactRefs?: readonly ConsequenceTamperEvidentHistoryArtifactRef[] | null;
}

export interface ConsequenceTamperEvidentHistoryEntry {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
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
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
  readonly entryPayloadDigest: string;
  readonly entryDigest: string;
  readonly rootDigest: string;
  readonly rawPayloadStored: false;
}

export interface ConsequenceTamperEvidentHistoryAppendDecision {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly outcome: ConsequenceTamperEvidentHistoryAppendOutcome;
  readonly recorded: boolean;
  readonly duplicate: boolean;
  readonly failClosed: boolean;
  readonly historyId: string;
  readonly sourceKind: ConsequenceTamperEvidentHistoryEntryKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly sequence: number | null;
  readonly entry: ConsequenceTamperEvidentHistoryEntry | null;
  readonly failureReasons: readonly ConsequenceTamperEvidentHistoryFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
  readonly decisionDigest: string;
}

export interface ConsequenceTamperEvidentHistoryVerification {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly historyId: string;
  readonly valid: boolean;
  readonly failClosed: boolean;
  readonly verifiedEntryCount: number;
  readonly rootDigest: string | null;
  readonly firstEntryDigest: string | null;
  readonly lastEntryDigest: string | null;
  readonly failureReasons: readonly ConsequenceTamperEvidentHistoryVerificationFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly rawPayloadStored: false;
}

export interface ConsequenceTamperEvidentHistoryExport {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly historyId: string;
  readonly exportedAt: string;
  readonly entryCount: number;
  readonly rootDigest: string | null;
  readonly firstEntryDigest: string | null;
  readonly lastEntryDigest: string | null;
  readonly sourceKinds: readonly ConsequenceTamperEvidentHistoryEntryKind[];
  readonly entries: readonly ConsequenceTamperEvidentHistoryEntry[];
  readonly verification: ConsequenceTamperEvidentHistoryVerification;
  readonly appendOnly: true;
  readonly rawPayloadStored: false;
  readonly complianceClaimed: false;
  readonly externalImmutableStoreClaimed: false;
  readonly signatureIncluded: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceTamperEvidentHistorySnapshot {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly historyId: string;
  readonly entryCount: number;
  readonly rootDigest: string | null;
  readonly firstEntryDigest: string | null;
  readonly lastEntryDigest: string | null;
  readonly entries: readonly ConsequenceTamperEvidentHistoryEntry[];
}

export interface ConsequenceTamperEvidentHistoryLedger {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly historyId: string;
  readonly record: (
    input: RecordConsequenceTamperEvidentHistoryInput,
  ) => ConsequenceTamperEvidentHistoryAppendDecision;
  readonly list: () => readonly ConsequenceTamperEvidentHistoryEntry[];
  readonly snapshot: () => ConsequenceTamperEvidentHistorySnapshot;
  readonly verify: () => ConsequenceTamperEvidentHistoryVerification;
  readonly exportHistory: (exportedAt?: string | null) => ConsequenceTamperEvidentHistoryExport;
}

export interface CreateConsequenceTamperEvidentHistoryLedgerInput {
  readonly historyId?: string | null;
  readonly maxEntries?: number | null;
  readonly now?: (() => string) | null;
}

export interface VerifyConsequenceTamperEvidentHistoryInput {
  readonly historyId: string;
  readonly entries: readonly ConsequenceTamperEvidentHistoryEntry[];
}

export interface ConsequenceTamperEvidentHistoryDescriptor {
  readonly version: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly entryKinds: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_ENTRY_KINDS;
  readonly appendOutcomes: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_APPEND_OUTCOMES;
  readonly failureReasons: typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_FAILURE_REASONS;
  readonly verificationFailureReasons:
    typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERIFICATION_FAILURE_REASONS;
  readonly chainMode: 'linear-hash-chain';
  readonly appendOnly: true;
  readonly storesRawPayloads: false;
  readonly externalImmutableStoreIncluded: false;
  readonly merkleTransparencyLogIncluded: false;
  readonly signatureIncluded: false;
  readonly productionSharedStoreIncluded: false;
  readonly complianceClaimed: false;
  readonly failClosed: true;
}
