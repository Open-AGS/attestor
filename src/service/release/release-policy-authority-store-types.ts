import {
  activationApprovals,
  auditLog,
  objectModel,
  store as policyStore,
} from '../../release-policy-control-plane/index.js';
import { RELEASE_AUTHORITY_SCHEMA } from './release-authority-store.js';

export const POLICY_CONTROL_PLANE_COMPONENT = 'policy-control-plane-store';
export const POLICY_ACTIVATION_APPROVAL_COMPONENT = 'policy-activation-approval-store';
export const POLICY_MUTATION_AUDIT_COMPONENT = 'policy-mutation-audit-log';
export const POLICY_STORE_MUTATION_LOCK = 'policy-control-plane-store-mutate';
export const POLICY_APPROVAL_MUTATION_LOCK = 'policy-activation-approval-store-mutate';
export const POLICY_AUDIT_APPEND_LOCK = 'policy-mutation-audit-log-append';
export const SHARED_POLICY_AUTHORITY_STORE_VERSION = 1;

export const POLICY_METADATA_TABLE = `${RELEASE_AUTHORITY_SCHEMA}.policy_control_plane_metadata`;
export const POLICY_PACKS_TABLE = `${RELEASE_AUTHORITY_SCHEMA}.policy_packs`;
export const POLICY_BUNDLES_TABLE = `${RELEASE_AUTHORITY_SCHEMA}.policy_bundles`;
export const POLICY_ACTIVATIONS_TABLE = `${RELEASE_AUTHORITY_SCHEMA}.policy_activations`;
export const POLICY_ACTIVATION_APPROVALS_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.policy_activation_approvals`;
export const POLICY_MUTATION_AUDIT_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.policy_mutation_audit_entries`;

export type PgQueryResultRow = Record<string, unknown>;
export type PolicyControlPlaneMetadata = ReturnType<typeof objectModel.createPolicyControlPlaneMetadata>;
export type PolicyControlPlaneStore = ReturnType<typeof policyStore.createInMemoryPolicyControlPlaneStore>;
export type PolicyPackMetadata = ReturnType<typeof objectModel.createPolicyPackMetadata>;
export type PolicyActivationRecord = ReturnType<typeof objectModel.createPolicyActivationRecord>;
export type StoredPolicyBundleRecord = policyStore.StoredPolicyBundleRecord;
export type UpsertStoredPolicyBundleInput = policyStore.UpsertStoredPolicyBundleInput;
export type PolicyStoreSnapshot = ReturnType<
  ReturnType<typeof policyStore.createInMemoryPolicyControlPlaneStore>['exportSnapshot']
>;
export type PolicyActivationApprovalRequest =
  activationApprovals.PolicyActivationApprovalRequest;
export type PolicyActivationApprovalStoreSnapshot = ReturnType<
  ReturnType<typeof activationApprovals.createInMemoryPolicyActivationApprovalStore>['exportSnapshot']
>;
export type PolicyActivationApprovalState =
  activationApprovals.PolicyActivationApprovalState;
export type PolicyMutationAuditAppendInput = auditLog.PolicyMutationAuditAppendInput;
export type PolicyMutationAuditEntry = auditLog.PolicyMutationAuditEntry;
export type PolicyMutationAuditVerificationResult =
  auditLog.PolicyMutationAuditVerificationResult;
export type PolicyMutationAuditSnapshot = ReturnType<
  ReturnType<typeof auditLog.createInMemoryPolicyMutationAuditLogWriter>['exportSnapshot']
>;

export interface SharedPolicyActivationLifecycleResult {
  readonly appliedRecord: PolicyActivationRecord;
  readonly updatedHistoricalRecord?: PolicyActivationRecord | null;
}

export interface SharedPolicyActivationLifecycleMutationInput<
  T extends SharedPolicyActivationLifecycleResult,
> {
  readonly action: (localStore: PolicyControlPlaneStore) => T;
  readonly createMetadata?: (
    localStore: PolicyControlPlaneStore,
    lifecycle: T,
  ) => PolicyControlPlaneMetadata | null;
  readonly createAudit?: (lifecycle: T) => PolicyMutationAuditAppendInput;
}

export interface SharedPolicyActivationLifecycleMutationResult<
  T extends SharedPolicyActivationLifecycleResult,
> {
  readonly lifecycle: T;
  readonly audit: PolicyMutationAuditEntry | null;
}

export interface SharedPolicyControlPlaneStoreSummary {
  readonly component: typeof POLICY_CONTROL_PLANE_COMPONENT;
  readonly metadataTable: typeof POLICY_METADATA_TABLE;
  readonly packsTable: typeof POLICY_PACKS_TABLE;
  readonly bundlesTable: typeof POLICY_BUNDLES_TABLE;
  readonly activationsTable: typeof POLICY_ACTIVATIONS_TABLE;
  readonly packCount: number;
  readonly bundleCount: number;
  readonly activationCount: number;
  readonly hasMetadata: boolean;
  readonly componentStatus: 'pending' | 'ready';
}

export interface SharedPolicyActivationApprovalStoreSummary {
  readonly component: typeof POLICY_ACTIVATION_APPROVAL_COMPONENT;
  readonly table: typeof POLICY_ACTIVATION_APPROVALS_TABLE;
  readonly requestCount: number;
  readonly pendingCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly componentStatus: 'pending' | 'ready';
}

export interface SharedPolicyMutationAuditLogSummary {
  readonly component: typeof POLICY_MUTATION_AUDIT_COMPONENT;
  readonly table: typeof POLICY_MUTATION_AUDIT_TABLE;
  readonly entryCount: number;
  readonly latestSequence: number;
  readonly latestEntryDigest: string | null;
  readonly componentStatus: 'pending' | 'ready';
}

export interface SharedPolicyControlPlaneStore {
  getMetadata(): Promise<PolicyControlPlaneMetadata | null>;
  setMetadata(metadata: PolicyControlPlaneMetadata): Promise<PolicyControlPlaneMetadata>;
  upsertPack(pack: PolicyPackMetadata): Promise<PolicyPackMetadata>;
  getPack(packId: string): Promise<PolicyPackMetadata | null>;
  listPacks(): Promise<readonly PolicyPackMetadata[]>;
  upsertBundle(input: UpsertStoredPolicyBundleInput): Promise<StoredPolicyBundleRecord>;
  getBundle(packId: string, bundleId: string): Promise<StoredPolicyBundleRecord | null>;
  listBundleHistory(packId: string): Promise<readonly StoredPolicyBundleRecord[]>;
  listBundles(): Promise<readonly StoredPolicyBundleRecord[]>;
  upsertActivation(record: PolicyActivationRecord): Promise<PolicyActivationRecord>;
  applyActivationLifecycle<T extends SharedPolicyActivationLifecycleResult>(
    input: SharedPolicyActivationLifecycleMutationInput<T>,
  ): Promise<SharedPolicyActivationLifecycleMutationResult<T>>;
  getActivation(id: string): Promise<PolicyActivationRecord | null>;
  listActivations(): Promise<readonly PolicyActivationRecord[]>;
  exportSnapshot(): Promise<PolicyStoreSnapshot>;
  summary(): Promise<SharedPolicyControlPlaneStoreSummary>;
}

export interface SharedPolicyActivationApprovalStore {
  upsert(request: PolicyActivationApprovalRequest): Promise<PolicyActivationApprovalRequest>;
  get(id: string): Promise<PolicyActivationApprovalRequest | null>;
  list(filters?: SharedPolicyActivationApprovalListFilters): Promise<readonly PolicyActivationApprovalRequest[]>;
  exportSnapshot(): Promise<PolicyActivationApprovalStoreSnapshot>;
  summary(): Promise<SharedPolicyActivationApprovalStoreSummary>;
}

export interface SharedPolicyActivationApprovalListFilters {
  readonly state?: PolicyActivationApprovalState | null;
  readonly targetLabel?: string | null;
  readonly bundleId?: string | null;
  readonly packId?: string | null;
}

export interface SharedPolicyMutationAuditLogWriter {
  append(input: PolicyMutationAuditAppendInput): Promise<PolicyMutationAuditEntry>;
  entries(): Promise<readonly PolicyMutationAuditEntry[]>;
  latestEntryDigest(): Promise<string | null>;
  verify(): Promise<PolicyMutationAuditVerificationResult>;
  exportSnapshot(): Promise<PolicyMutationAuditSnapshot>;
  summary(): Promise<SharedPolicyMutationAuditLogSummary>;
}

export class SharedPolicyAuthorityStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SharedPolicyAuthorityStoreError';
  }
}
