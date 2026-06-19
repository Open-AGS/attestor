import type { CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION } from './tamper-evident-history.js';
import type {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  ShadowRuntimePipelineResult,
} from './shadow-runtime-pipeline.js';

export const DECISION_TRACE_LOGGER_VERSION =
  'attestor.decision-trace-logger.v1';

export const DECISION_TRACE_PHASES = [
  'shadow-event',
  'envelope-projection',
  'signal-extraction',
  'relationship-detection',
  'relationship-aware-fusion',
  'conflict-abstention-gate',
  'human-comprehension-gate',
  'assurance-packet',
] as const;
export type DecisionTracePhase = typeof DECISION_TRACE_PHASES[number];

export const DECISION_TRACE_APPEND_OUTCOMES = [
  'recorded',
  'replay-rejected',
  'held',
] as const;
export type DecisionTraceAppendOutcome =
  typeof DECISION_TRACE_APPEND_OUTCOMES[number];

export const DECISION_TRACE_FAILURE_REASONS = [
  'ttl-required',
  'ttl-expired',
  'pipeline-boundary-invalid',
  'pipeline-replay',
  'trace-capacity-exhausted',
  'sequence-gap',
  'previous-entry-digest-mismatch',
  'previous-root-digest-mismatch',
  'entry-payload-digest-mismatch',
  'entry-digest-mismatch',
  'root-digest-mismatch',
] as const;
export type DecisionTraceFailureReason =
  typeof DECISION_TRACE_FAILURE_REASONS[number];

export interface DecisionTracePhaseSpec {
  readonly phase: DecisionTracePhase;
  readonly componentVersion: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly reasonCodes: readonly string[];
}

export interface DecisionTraceEntry {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
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
  readonly previousEntryDigest: string | null;
  readonly previousRootDigest: string | null;
  readonly entryPayloadDigest: string;
  readonly entryDigest: string;
  readonly rootDigest: string;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface DecisionTraceAppendDecision {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly outcome: DecisionTraceAppendOutcome;
  readonly recorded: boolean;
  readonly failClosed: boolean;
  readonly traceId: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly entryCount: number;
  readonly entries: readonly DecisionTraceEntry[];
  readonly failureReasons: readonly DecisionTraceFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly decisionDigest: string;
}

export interface DecisionTraceVerification {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly traceId: string;
  readonly valid: boolean;
  readonly failClosed: boolean;
  readonly verifiedEntryCount: number;
  readonly rootDigest: string | null;
  readonly firstEntryDigest: string | null;
  readonly lastEntryDigest: string | null;
  readonly failureReasons: readonly DecisionTraceFailureReason[];
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface DecisionTraceSnapshot {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly traceId: string;
  readonly entryCount: number;
  readonly rootDigest: string | null;
  readonly firstEntryDigest: string | null;
  readonly lastEntryDigest: string | null;
  readonly entries: readonly DecisionTraceEntry[];
  readonly verification: DecisionTraceVerification;
  readonly appendOnly: true;
  readonly digestOnly: true;
  readonly writesAuditPlane: false;
  readonly signatureIncluded: false;
  readonly externalImmutabilityClaimed: false;
  readonly complianceClaimed: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface DecisionTraceLogger {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly traceId: string;
  readonly ttlSeconds: number;
  readonly recordPipeline: (
    pipeline: ShadowRuntimePipelineResult,
    observedAt?: string | null,
  ) => DecisionTraceAppendDecision;
  readonly list: () => readonly DecisionTraceEntry[];
  readonly verify: (verifiedAt?: string | null) => DecisionTraceVerification;
  readonly snapshot: (exportedAt?: string | null) => DecisionTraceSnapshot;
  readonly writesAuditPlane: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface CreateDecisionTraceLoggerInput {
  readonly traceId?: string | null;
  readonly ttlSeconds: number;
  readonly maxEntries?: number | null;
  readonly now?: (() => string) | null;
}

export interface VerifyDecisionTraceEntriesInput {
  readonly traceId: string;
  readonly entries: readonly DecisionTraceEntry[];
  readonly verifiedAt?: string | null;
}

export interface DecisionTraceLoggerDescriptor {
  readonly version: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly shadowRuntimePipelineVersion: typeof SHADOW_RUNTIME_PIPELINE_VERSION;
  readonly tamperEvidentHistoryVersion:
    typeof CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION;
  readonly phases: readonly DecisionTracePhase[];
  readonly appendOutcomes: readonly DecisionTraceAppendOutcome[];
  readonly failureReasons: readonly DecisionTraceFailureReason[];
  readonly chainMode: 'linear-hash-chain';
  readonly ttlRequired: true;
  readonly replayRejected: true;
  readonly digestOnly: true;
  readonly structuredForOfflineSpecChecks: true;
  readonly writesAuditPlane: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}
