import type {
  GenericAdmissionMode,
  ShadowCustomerActivationHandoff,
  ShadowAdmissionEvent,
  ShadowCustomerActivationReceipt,
  ShadowCustomerActivationReceiptStatus,
  ShadowPolicyDiscoveryCandidate,
  ShadowPolicyDiscoveryCandidates,
  ShadowPolicySimulationReport,
} from '../../consequence-admission/index.js';

export const SHADOW_ADMISSION_EVENT_STORE_VERSION =
  'attestor.shadow-admission-event-store.v1';
export const SHADOW_POLICY_CANDIDATE_STORE_VERSION =
  'attestor.shadow-policy-candidate-store.v1';
export const SHADOW_POLICY_SIMULATION_REPORT_STORE_VERSION =
  'attestor.shadow-policy-simulation-report-store.v1';
export const SHADOW_CUSTOMER_ACTIVATION_HANDOFF_STORE_VERSION =
  'attestor.shadow-customer-activation-handoff-store.v1';
export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_VERSION =
  'attestor.shadow-customer-activation-receipt-store.v1';

export const SHADOW_POLICY_CANDIDATE_STATUSES = [
  'draft',
  'proposed',
  'approved',
  'rejected',
  'activated',
  'superseded',
] as const;
export type ShadowPolicyCandidateStatus =
  typeof SHADOW_POLICY_CANDIDATE_STATUSES[number];

export type ShadowAdmissionStoreAppendResultKind = 'recorded' | 'duplicate';
export type ShadowPolicyCandidateUpsertKind = 'created' | 'updated' | 'unchanged';
export type ShadowPolicySimulationReportAppendKind = 'recorded' | 'duplicate';
export type ShadowCustomerActivationHandoffAppendKind = 'recorded' | 'duplicate';
export type ShadowCustomerActivationReceiptAppendKind = 'recorded' | 'duplicate';

export interface ShadowAdmissionEventStoreRecord {
  readonly version: typeof SHADOW_ADMISSION_EVENT_STORE_VERSION;
  readonly tenantId: string;
  readonly sequence: number;
  readonly recordedAt: string;
  readonly event: ShadowAdmissionEvent;
  readonly rawPayloadStored: false;
}

export interface ShadowAdmissionEventListFilters {
  readonly tenantId: string;
  readonly actionSurface?: string | null;
  readonly domain?: string | null;
  readonly limit?: number | null;
}

export interface ShadowAdmissionEventStoreSummary {
  readonly tenantId: string;
  readonly storageMode: 'file-backed-evaluation';
  readonly eventCount: number;
  readonly latestEventDigest: string | null;
  readonly latestRecordedAt: string | null;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
}

export interface AppendShadowAdmissionEventInput {
  readonly tenantId: string;
  readonly event: ShadowAdmissionEvent;
  readonly recordedAt?: string | null;
}

export interface AppendShadowAdmissionEventResult {
  readonly kind: ShadowAdmissionStoreAppendResultKind;
  readonly record: ShadowAdmissionEventStoreRecord;
  readonly path: string;
}

export interface FileBackedShadowAdmissionEventStore {
  append(input: AppendShadowAdmissionEventInput): AppendShadowAdmissionEventResult;
  list(filters: ShadowAdmissionEventListFilters): {
    readonly records: readonly ShadowAdmissionEventStoreRecord[];
    readonly events: readonly ShadowAdmissionEvent[];
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: ShadowAdmissionEventStoreSummary;
    readonly path: string;
  };
  exportSnapshot(): {
    readonly path: string;
    readonly version: 1;
    readonly exportedAt: string;
    readonly recordCount: number;
    readonly records: readonly ShadowAdmissionEventStoreRecord[];
  };
}

export interface ShadowPolicySimulationReportStoreRecord {
  readonly version: typeof SHADOW_POLICY_SIMULATION_REPORT_STORE_VERSION;
  readonly tenantId: string;
  readonly reportId: string;
  readonly reportDigest: string;
  readonly proposedMode: GenericAdmissionMode;
  readonly eventCount: number;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly recordedAt: string;
  readonly report: ShadowPolicySimulationReport;
  readonly rawPayloadStored: false;
}

export interface AppendShadowPolicySimulationReportInput {
  readonly tenantId: string;
  readonly report: ShadowPolicySimulationReport;
  readonly recordedAt?: string | null;
}

export interface AppendShadowPolicySimulationReportResult {
  readonly kind: ShadowPolicySimulationReportAppendKind;
  readonly record: ShadowPolicySimulationReportStoreRecord;
  readonly path: string;
}

export interface ShadowPolicySimulationReportListFilters {
  readonly tenantId: string;
  readonly proposedMode?: GenericAdmissionMode | null;
  readonly limit?: number | null;
}

export interface FileBackedShadowPolicySimulationReportStore {
  append(input: AppendShadowPolicySimulationReportInput): AppendShadowPolicySimulationReportResult;
  list(filters: ShadowPolicySimulationReportListFilters): {
    readonly records: readonly ShadowPolicySimulationReportStoreRecord[];
    readonly reports: readonly ShadowPolicySimulationReport[];
    readonly path: string;
  };
  find(input: {
    readonly tenantId: string;
    readonly reportId: string;
  }): {
    readonly record: ShadowPolicySimulationReportStoreRecord | null;
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: {
      readonly tenantId: string;
      readonly storageMode: 'file-backed-evaluation';
      readonly reportCount: number;
      readonly latestReportDigest: string | null;
      readonly latestRecordedAt: string | null;
      readonly rawPayloadStored: false;
      readonly productionReady: false;
    };
    readonly path: string;
  };
}

export interface ShadowPolicyCandidateStatusChange {
  readonly status: ShadowPolicyCandidateStatus;
  readonly changedAt: string;
  readonly actorRef: string;
  readonly reason: string;
}

export interface ShadowPolicyCandidateStoreRecord {
  readonly version: typeof SHADOW_POLICY_CANDIDATE_STORE_VERSION;
  readonly tenantId: string;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly status: ShadowPolicyCandidateStatus;
  readonly statusHistory: readonly ShadowPolicyCandidateStatusChange[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
}

export interface ShadowCustomerActivationReceiptStoreRecord {
  readonly version: typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STORE_VERSION;
  readonly tenantId: string;
  readonly receiptId: string;
  readonly receiptDigest: string;
  readonly sourceHandoffId: string;
  readonly sourceHandoffDigest: string;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly receiptReady: boolean;
  readonly activationClosed: boolean;
  readonly recordedAt: string;
  readonly receipt: ShadowCustomerActivationReceipt;
  readonly rawPayloadStored: false;
}

export interface ShadowCustomerActivationHandoffStoreRecord {
  readonly version: typeof SHADOW_CUSTOMER_ACTIVATION_HANDOFF_STORE_VERSION;
  readonly tenantId: string;
  readonly handoffId: string;
  readonly handoffDigest: string;
  readonly sourceActivationReadinessDigest: string;
  readonly handoffReady: boolean;
  readonly recordedAt: string;
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly rawPayloadStored: false;
}

export interface UpsertShadowPolicyCandidateInput {
  readonly tenantId: string;
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly sourceReportId?: string | null;
  readonly sourceReportDigest?: string | null;
  readonly observedAt?: string | null;
}

export interface UpsertShadowPolicyCandidateResult {
  readonly kind: ShadowPolicyCandidateUpsertKind;
  readonly record: ShadowPolicyCandidateStoreRecord;
  readonly path: string;
}

export interface UpsertShadowPolicyCandidateBundleResult {
  readonly records: readonly ShadowPolicyCandidateStoreRecord[];
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly unchangedCount: number;
  readonly path: string;
}

export interface ShadowPolicyCandidateListFilters {
  readonly tenantId: string;
  readonly status?: ShadowPolicyCandidateStatus | null;
  readonly actionSurface?: string | null;
  readonly domain?: string | null;
  readonly limit?: number | null;
}

export interface TransitionShadowPolicyCandidateInput {
  readonly tenantId: string;
  readonly candidateId: string;
  readonly status: ShadowPolicyCandidateStatus;
  readonly actorRef: string;
  readonly reason: string;
  readonly changedAt?: string | null;
}

export interface FileBackedShadowPolicyCandidateStore {
  upsertCandidate(input: UpsertShadowPolicyCandidateInput): UpsertShadowPolicyCandidateResult;
  upsertBundle(input: {
    readonly tenantId: string;
    readonly bundle: ShadowPolicyDiscoveryCandidates;
  }): UpsertShadowPolicyCandidateBundleResult;
  list(filters: ShadowPolicyCandidateListFilters): {
    readonly records: readonly ShadowPolicyCandidateStoreRecord[];
    readonly path: string;
  };
  transitionStatus(input: TransitionShadowPolicyCandidateInput): {
    readonly record: ShadowPolicyCandidateStoreRecord;
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: {
      readonly tenantId: string;
      readonly storageMode: 'file-backed-evaluation';
      readonly candidateCount: number;
      readonly byStatus: Readonly<Record<ShadowPolicyCandidateStatus, number>>;
      readonly approvalRequired: true;
      readonly autoEnforce: false;
      readonly rawPayloadStored: false;
      readonly productionReady: false;
    };
    readonly path: string;
  };
}

export interface AppendShadowCustomerActivationReceiptInput {
  readonly tenantId: string;
  readonly receipt: ShadowCustomerActivationReceipt;
  readonly recordedAt?: string | null;
}

export interface AppendShadowCustomerActivationHandoffInput {
  readonly tenantId: string;
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly recordedAt?: string | null;
}

export interface AppendShadowCustomerActivationHandoffResult {
  readonly kind: ShadowCustomerActivationHandoffAppendKind;
  readonly record: ShadowCustomerActivationHandoffStoreRecord;
  readonly path: string;
}

export interface AppendShadowCustomerActivationReceiptResult {
  readonly kind: ShadowCustomerActivationReceiptAppendKind;
  readonly record: ShadowCustomerActivationReceiptStoreRecord;
  readonly path: string;
}

export interface FileBackedShadowCustomerActivationHandoffStore {
  append(input: AppendShadowCustomerActivationHandoffInput): AppendShadowCustomerActivationHandoffResult;
  find(input: {
    readonly tenantId: string;
    readonly handoffId: string;
  }): {
    readonly record: ShadowCustomerActivationHandoffStoreRecord | null;
    readonly path: string;
  };
}

export interface ShadowCustomerActivationReceiptListFilters {
  readonly tenantId: string;
  readonly activationStatus?: ShadowCustomerActivationReceiptStatus | null;
  readonly receiptReady?: boolean | null;
  readonly sourceHandoffDigest?: string | null;
  readonly limit?: number | null;
}

export interface FileBackedShadowCustomerActivationReceiptStore {
  append(input: AppendShadowCustomerActivationReceiptInput): AppendShadowCustomerActivationReceiptResult;
  list(filters: ShadowCustomerActivationReceiptListFilters): {
    readonly records: readonly ShadowCustomerActivationReceiptStoreRecord[];
    readonly receipts: readonly ShadowCustomerActivationReceipt[];
    readonly path: string;
  };
  find(input: {
    readonly tenantId: string;
    readonly receiptId: string;
  }): {
    readonly record: ShadowCustomerActivationReceiptStoreRecord | null;
    readonly path: string;
  };
  summarize(input: { readonly tenantId: string }): {
    readonly summary: {
      readonly tenantId: string;
      readonly storageMode: 'file-backed-evaluation';
      readonly receiptCount: number;
      readonly readyReceiptCount: number;
      readonly heldReceiptCount: number;
      readonly latestReceiptDigest: string | null;
      readonly latestRecordedAt: string | null;
      readonly rawPayloadStored: false;
      readonly productionReady: false;
    };
    readonly path: string;
  };
}
