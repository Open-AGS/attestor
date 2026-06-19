import {
  activationApprovals,
  auditLog,
  store as policyStore,
} from '../../release-policy-control-plane/index.js';
import {
  SharedPolicyAuthorityStoreError,
  type PgQueryResultRow,
  type PolicyActivationApprovalRequest,
  type PolicyActivationRecord,
  type PolicyControlPlaneMetadata,
  type PolicyMutationAuditEntry,
  type PolicyPackMetadata,
  type StoredPolicyBundleRecord,
  type UpsertStoredPolicyBundleInput,
} from './release-policy-authority-store-types.js';

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SharedPolicyAuthorityStoreError(
      `Shared policy authority row has invalid ${fieldName}.`,
    );
  }
  return value;
}

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) {
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SharedPolicyAuthorityStoreError(
      `Shared policy authority row has invalid ${fieldName}.`,
    );
  }
  return value;
}

function normalizeIso(value: unknown, fieldName: string): string {
  const parsed =
    value instanceof Date
      ? value
      : new Date(requireString(value, fieldName));
  if (Number.isNaN(parsed.getTime())) {
    throw new SharedPolicyAuthorityStoreError(
      `Shared policy authority row has invalid ${fieldName}.`,
    );
  }
  return parsed.toISOString();
}

function rowJsonObject(row: PgQueryResultRow, fieldName: string): Record<string, unknown> {
  const value = row[fieldName];
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, unknown>;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new SharedPolicyAuthorityStoreError(
    `Shared policy authority row has invalid ${fieldName}.`,
  );
}

export function freezeClone<T>(value: T): T {
  return Object.freeze(structuredClone(value)) as T;
}

function assertRowField<T>(actual: T, expected: T, fieldName: string): void {
  if (actual !== expected) {
    throw new SharedPolicyAuthorityStoreError(
      `Shared policy authority row is inconsistent for ${fieldName}.`,
    );
  }
}

export function normalizeMetadata(metadata: PolicyControlPlaneMetadata): PolicyControlPlaneMetadata {
  const store = policyStore.createInMemoryPolicyControlPlaneStore();
  return store.setMetadata(metadata);
}

export function normalizePack(pack: PolicyPackMetadata): PolicyPackMetadata {
  const store = policyStore.createInMemoryPolicyControlPlaneStore();
  return store.upsertPack(pack);
}

export function normalizeBundle(input: UpsertStoredPolicyBundleInput): StoredPolicyBundleRecord {
  const store = policyStore.createInMemoryPolicyControlPlaneStore();
  return store.upsertBundle(input);
}

export function normalizeActivation(record: PolicyActivationRecord): PolicyActivationRecord {
  const store = policyStore.createInMemoryPolicyControlPlaneStore();
  return store.upsertActivation(record);
}

export function normalizeApproval(
  request: PolicyActivationApprovalRequest,
): PolicyActivationApprovalRequest {
  const store = activationApprovals.createInMemoryPolicyActivationApprovalStore();
  return store.upsert(request);
}

export function rowToMetadata(row: PgQueryResultRow): PolicyControlPlaneMetadata {
  return freezeClone(rowJsonObject(row, 'metadata_json')) as unknown as PolicyControlPlaneMetadata;
}

export function rowToPack(row: PgQueryResultRow): PolicyPackMetadata {
  const pack = freezeClone(rowJsonObject(row, 'pack_json')) as unknown as PolicyPackMetadata;
  assertRowField(requireString(row.pack_id, 'pack_id'), pack.id, 'pack_id');
  return pack;
}

export function rowToBundle(row: PgQueryResultRow): StoredPolicyBundleRecord {
  const record = freezeClone(rowJsonObject(row, 'bundle_json')) as unknown as StoredPolicyBundleRecord;
  if (record.version !== policyStore.POLICY_STORE_RECORD_SPEC_VERSION) {
    throw new SharedPolicyAuthorityStoreError(
      'Shared policy bundle record has an invalid version.',
    );
  }
  assertRowField(requireString(row.pack_id, 'pack_id'), record.packId, 'pack_id');
  assertRowField(requireString(row.bundle_id, 'bundle_id'), record.bundleId, 'bundle_id');
  assertRowField(
    requireString(row.bundle_version, 'bundle_version'),
    record.bundleVersion,
    'bundle_version',
  );
  assertRowField(normalizeIso(row.stored_at, 'stored_at'), record.storedAt, 'stored_at');
  return record;
}

export function rowToActivation(row: PgQueryResultRow): PolicyActivationRecord {
  const record = freezeClone(rowJsonObject(row, 'activation_json')) as unknown as PolicyActivationRecord;
  assertRowField(requireString(row.activation_id, 'activation_id'), record.id, 'activation_id');
  assertRowField(requireString(row.activation_state, 'activation_state'), record.state, 'activation_state');
  assertRowField(requireString(row.target_label, 'target_label'), record.targetLabel, 'target_label');
  assertRowField(requireString(row.pack_id, 'pack_id'), record.bundle.packId, 'pack_id');
  assertRowField(requireString(row.bundle_id, 'bundle_id'), record.bundle.bundleId, 'bundle_id');
  return record;
}

export function rowToApproval(row: PgQueryResultRow): PolicyActivationApprovalRequest {
  const request = freezeClone(rowJsonObject(row, 'request_json')) as unknown as PolicyActivationApprovalRequest;
  if (request.version !== activationApprovals.POLICY_ACTIVATION_APPROVAL_SPEC_VERSION) {
    throw new SharedPolicyAuthorityStoreError(
      'Shared policy activation approval has an invalid version.',
    );
  }
  assertRowField(requireString(row.request_id, 'request_id'), request.id, 'request_id');
  assertRowField(requireString(row.request_state, 'request_state'), request.state, 'request_state');
  assertRowField(requireString(row.target_label, 'target_label'), request.targetLabel, 'target_label');
  assertRowField(requireString(row.pack_id, 'pack_id'), request.bundle.packId, 'pack_id');
  assertRowField(requireString(row.bundle_id, 'bundle_id'), request.bundle.bundleId, 'bundle_id');
  assertRowField(requireString(row.approval_digest, 'approval_digest'), request.approvalDigest, 'approval_digest');
  return request;
}

export function rowToAuditEntry(row: PgQueryResultRow): PolicyMutationAuditEntry {
  const entry = freezeClone(rowJsonObject(row, 'entry_json')) as unknown as PolicyMutationAuditEntry;
  if (entry.version !== auditLog.POLICY_MUTATION_AUDIT_LOG_SPEC_VERSION) {
    throw new SharedPolicyAuthorityStoreError(
      'Shared policy mutation audit entry has an invalid version.',
    );
  }
  assertRowField(requireInteger(row.sequence, 'sequence'), entry.sequence, 'sequence');
  assertRowField(requireString(row.entry_id, 'entry_id'), entry.entryId, 'entry_id');
  assertRowField(requireString(row.action, 'action'), entry.action, 'action');
  assertRowField(normalizeIso(row.occurred_at, 'occurred_at'), entry.occurredAt, 'occurred_at');
  assertRowField(requireString(row.entry_digest, 'entry_digest'), entry.entryDigest, 'entry_digest');
  return entry;
}

export function compareBundles(
  left: StoredPolicyBundleRecord,
  right: StoredPolicyBundleRecord,
): number {
  return (
    Date.parse(right.storedAt) - Date.parse(left.storedAt) ||
    right.bundleVersion.localeCompare(left.bundleVersion) ||
    right.bundleId.localeCompare(left.bundleId)
  );
}

export function compareActivations(
  left: PolicyActivationRecord,
  right: PolicyActivationRecord,
): number {
  return (
    Date.parse(right.activatedAt) - Date.parse(left.activatedAt) ||
    right.id.localeCompare(left.id)
  );
}

export function compareApprovals(
  left: PolicyActivationApprovalRequest,
  right: PolicyActivationApprovalRequest,
): number {
  return (
    Date.parse(right.requestedAt) - Date.parse(left.requestedAt) ||
    right.id.localeCompare(left.id)
  );
}
