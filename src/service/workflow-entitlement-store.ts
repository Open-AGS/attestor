import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { withFileLock, writeTextFileAtomic } from './file-store.js';
import {
  WORKFLOW_CONSEQUENCE_PACKS,
  WORKFLOW_ENTITLEMENT_SCHEMA_VERSION,
  findWorkflowBillingTierByStripePriceId,
  getWorkflowBillingTier,
  resolveWorkflowTierStripeOveragePrice,
  resolveWorkflowTierStripePrice,
  workflowStripeOverageMeterEventName,
  type WorkflowBillingTierId,
  type WorkflowConsequencePackId,
} from './workflow-entitlement-catalog.js';
import {
  WORKFLOW_ENTITLEMENT_STATUSES,
  type WorkflowEntitlementRecord,
  type WorkflowEntitlementStatus,
} from './workflow-entitlement.js';

export type WorkflowCheckoutAction = 'create' | 'upgrade' | 'downgrade';

export const WORKFLOW_USAGE_METER = 'workflow_monthly_admissions';

export interface StoredWorkflowEntitlementRecord
  extends WorkflowEntitlementRecord {
  readonly id: string;
  readonly schemaVersion: typeof WORKFLOW_ENTITLEMENT_SCHEMA_VERSION;
  readonly accountId: string;
  readonly tenantId: string;
  readonly workflowId: string;
  readonly tier: WorkflowBillingTierId;
  readonly status: WorkflowEntitlementStatus;
  readonly consequencePack: WorkflowConsequencePackId;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly stripeSubscriptionItemId: string | null;
  readonly stripePriceId: string | null;
  readonly stripeOveragePriceId: string | null;
  readonly downstreamSystemRefDigest: string | null;
  readonly policyGatePathRefDigest: string | null;
  readonly includedAdmissionsMonthly: number;
  readonly monthlyAdmissionsUsed: number;
  readonly admissionPeriod: string;
  readonly currentPeriodStart: string | null;
  readonly currentPeriodEnd: string | null;
  readonly customerGateProofPresent: boolean;
  readonly lastCheckoutAction: WorkflowCheckoutAction | null;
  readonly lastCheckoutSessionId: string | null;
  readonly lastCheckoutCompletedAt: string | null;
  readonly lastEventId: string | null;
  readonly lastEventType: string | null;
  readonly lastEventAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkflowEntitlementStoreSnapshot {
  readonly version: 1;
  readonly exportedAt: string;
  readonly recordCount: number;
  readonly records: StoredWorkflowEntitlementRecord[];
}

interface WorkflowEntitlementStoreFile {
  readonly version: 1;
  readonly records: StoredWorkflowEntitlementRecord[];
}

export interface ListWorkflowEntitlementsFilters {
  readonly accountId?: string | null;
  readonly tenantId?: string | null;
  readonly status?: WorkflowEntitlementStatus | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
}

export interface WorkflowStripeMetadata {
  readonly accountId: string;
  readonly tenantDigest: string;
  readonly workflowId: string;
  readonly tier: WorkflowBillingTierId;
  readonly consequencePack: WorkflowConsequencePackId;
  readonly downstreamSystemRefDigest: string | null;
  readonly policyGatePathRefDigest: string | null;
}

export interface PendingWorkflowEntitlementInput {
  readonly accountId: string;
  readonly tenantId: string;
  readonly workflowId: string;
  readonly tier: WorkflowBillingTierId;
  readonly consequencePack: WorkflowConsequencePackId;
  readonly downstreamSystemRefDigest?: string | null;
  readonly policyGatePathRefDigest?: string | null;
  readonly stripeCustomerId?: string | null;
  readonly stripeSubscriptionId?: string | null;
  readonly stripePriceId?: string | null;
  readonly stripeOveragePriceId?: string | null;
  readonly checkoutAction?: WorkflowCheckoutAction | null;
  readonly checkoutSessionId?: string | null;
  readonly checkoutCompletedAt?: string | null;
  readonly eventId?: string | null;
  readonly eventType?: string | null;
  readonly eventAt?: string | null;
}

export interface StripeWorkflowEntitlementInput
  extends PendingWorkflowEntitlementInput {
  readonly status: WorkflowEntitlementStatus;
  readonly stripeSubscriptionItemId?: string | null;
  readonly customerGateProofPresent?: boolean | null;
}

export interface WorkflowUsageContext {
  readonly workflowId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly tier: WorkflowBillingTierId;
  readonly meter: typeof WORKFLOW_USAGE_METER;
  readonly period: string;
  readonly used: number;
  readonly quota: number;
  readonly remaining: number;
  readonly hardLimit: boolean;
  readonly overage: boolean;
  readonly overageUnits: number;
}

export interface WorkflowUsageDecision {
  readonly allowed: boolean;
  readonly usage: WorkflowUsageContext;
  readonly entitlement: StoredWorkflowEntitlementRecord;
}

export const WORKFLOW_STRIPE_METADATA_KEYS = Object.freeze({
  accountId: 'attestor_account_id',
  tenantDigest: 'attestor_tenant_digest',
  workflowId: 'attestor_workflow_id',
  tier: 'attestor_workflow_tier',
  consequencePack: 'attestor_consequence_pack',
  downstreamDigest: 'attestor_downstream_ref_digest',
  policyGateDigest: 'attestor_policy_gate_digest',
});

function storePath(): string {
  return resolve(
    process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH
      ?? '.attestor/workflow-entitlements.json',
  );
}

function defaultStore(): WorkflowEntitlementStoreFile {
  return { version: 1, records: [] };
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : null;
}

function normalizePeriod(value: unknown): string {
  const normalized = normalizeString(value);
  return normalized ?? currentWorkflowUsagePeriod();
}

export function currentWorkflowUsagePeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function digestWorkflowMetadataRef(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function tenantWorkflowMetadataDigest(tenantId: string): string {
  return digestWorkflowMetadataRef(`tenant:${tenantId}`);
}

function normalizeTier(value: unknown): WorkflowBillingTierId {
  const tier = getWorkflowBillingTier(normalizeString(value));
  return tier?.id ?? 'pilot-workflow';
}

function normalizePack(value: unknown): WorkflowConsequencePackId {
  const normalized = normalizeString(value);
  return WORKFLOW_CONSEQUENCE_PACKS.includes(
    normalized as WorkflowConsequencePackId,
  )
    ? normalized as WorkflowConsequencePackId
    : 'money-movement';
}

function normalizeStatus(value: unknown): WorkflowEntitlementStatus {
  return WORKFLOW_ENTITLEMENT_STATUSES.includes(
    value as WorkflowEntitlementStatus,
  )
    ? value as WorkflowEntitlementStatus
    : 'incomplete';
}

function loadStore(): WorkflowEntitlementStoreFile {
  const path = storePath();
  if (!existsSync(path)) return defaultStore();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as WorkflowEntitlementStoreFile;
    if (parsed.version === 1 && Array.isArray(parsed.records)) {
      return {
        version: 1,
        records: parsed.records.map(normalizeWorkflowEntitlementRecord),
      };
    }
  } catch {
    // fall through to safe default
  }
  return defaultStore();
}

function saveStore(store: WorkflowEntitlementStoreFile): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeTextFileAtomic(path, `${JSON.stringify(store, null, 2)}\n`);
}

function withWorkflowStoreLock<T>(
  action: (store: WorkflowEntitlementStoreFile, path: string) => T,
): T {
  const path = storePath();
  return withFileLock(path, () => action(loadStore(), path));
}

export function buildWorkflowStripeMetadata(
  input: WorkflowStripeMetadata,
): Record<string, string> {
  return {
    [WORKFLOW_STRIPE_METADATA_KEYS.accountId]: input.accountId,
    [WORKFLOW_STRIPE_METADATA_KEYS.tenantDigest]: input.tenantDigest,
    [WORKFLOW_STRIPE_METADATA_KEYS.workflowId]: input.workflowId,
    [WORKFLOW_STRIPE_METADATA_KEYS.tier]: input.tier,
    [WORKFLOW_STRIPE_METADATA_KEYS.consequencePack]: input.consequencePack,
    ...(input.downstreamSystemRefDigest
      ? {
          [WORKFLOW_STRIPE_METADATA_KEYS.downstreamDigest]:
            input.downstreamSystemRefDigest,
        }
      : {}),
    ...(input.policyGatePathRefDigest
      ? {
          [WORKFLOW_STRIPE_METADATA_KEYS.policyGateDigest]:
            input.policyGatePathRefDigest,
        }
      : {}),
  };
}

export function parseWorkflowStripeMetadata(
  ...sources: Array<Record<string, unknown> | null | undefined>
): WorkflowStripeMetadata | null {
  for (const metadata of sources) {
    if (!metadata) continue;
    const accountId = normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.accountId]);
    const tenantDigest = normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.tenantDigest]);
    const workflowId = normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.workflowId]);
    const tier = getWorkflowBillingTier(
      normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.tier]),
    );
    const consequencePack = normalizePack(
      metadata[WORKFLOW_STRIPE_METADATA_KEYS.consequencePack],
    );
    if (!accountId || !tenantDigest || !workflowId || !tier) continue;
    return {
      accountId,
      tenantDigest,
      workflowId,
      tier: tier.id,
      consequencePack,
      downstreamSystemRefDigest:
        normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.downstreamDigest]),
      policyGatePathRefDigest:
        normalizeString(metadata[WORKFLOW_STRIPE_METADATA_KEYS.policyGateDigest]),
    };
  }
  return null;
}

export function normalizeWorkflowEntitlementRecord(
  record: StoredWorkflowEntitlementRecord,
): StoredWorkflowEntitlementRecord {
  const tier = normalizeTier(record.tier);
  const tierDefinition = getWorkflowBillingTier(tier)!;
  const period = normalizePeriod(record.admissionPeriod);
  return {
    ...record,
    id: normalizeString(record.id) ?? `went_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    schemaVersion: WORKFLOW_ENTITLEMENT_SCHEMA_VERSION,
    accountId: normalizeString(record.accountId) ?? 'account_missing',
    tenantId: normalizeString(record.tenantId) ?? 'tenant_missing',
    workflowId: normalizeString(record.workflowId) ?? 'workflow_missing',
    tier,
    status: normalizeStatus(record.status),
    stripeCustomerId: normalizeString(record.stripeCustomerId),
    stripeSubscriptionId: normalizeString(record.stripeSubscriptionId),
    stripeSubscriptionItemId: normalizeString(record.stripeSubscriptionItemId),
    stripePriceId: normalizeString(record.stripePriceId),
    stripeOveragePriceId: normalizeString(record.stripeOveragePriceId),
    consequencePack: normalizePack(record.consequencePack),
    downstreamSystemRefDigest: normalizeString(record.downstreamSystemRefDigest),
    policyGatePathRefDigest: normalizeString(record.policyGatePathRefDigest),
    includedAdmissionsMonthly: tierDefinition.includedAdmissionsMonthly,
    monthlyAdmissionsUsed:
      Number.isInteger(record.monthlyAdmissionsUsed) && record.monthlyAdmissionsUsed >= 0
        ? record.monthlyAdmissionsUsed
        : 0,
    admissionPeriod: period,
    currentPeriodStart: normalizeString(record.currentPeriodStart),
    currentPeriodEnd: normalizeString(record.currentPeriodEnd),
    customerGateProofPresent: record.customerGateProofPresent === true,
    lastCheckoutAction:
      record.lastCheckoutAction === 'create' ||
      record.lastCheckoutAction === 'upgrade' ||
      record.lastCheckoutAction === 'downgrade'
        ? record.lastCheckoutAction
        : null,
    lastCheckoutSessionId: normalizeString(record.lastCheckoutSessionId),
    lastCheckoutCompletedAt: normalizeString(record.lastCheckoutCompletedAt),
    lastEventId: normalizeString(record.lastEventId),
    lastEventType: normalizeString(record.lastEventType),
    lastEventAt: normalizeString(record.lastEventAt),
    createdAt: normalizeString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: normalizeString(record.updatedAt) ?? new Date().toISOString(),
  };
}

export function projectPendingWorkflowEntitlement(
  previous: StoredWorkflowEntitlementRecord | null,
  input: PendingWorkflowEntitlementInput,
): StoredWorkflowEntitlementRecord {
  const tier = getWorkflowBillingTier(input.tier)!;
  const now = new Date().toISOString();
  const period = currentWorkflowUsagePeriod();
  const previousSamePeriod = previous?.admissionPeriod === period;
  return normalizeWorkflowEntitlementRecord({
    id: previous?.id ?? `went_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    schemaVersion: WORKFLOW_ENTITLEMENT_SCHEMA_VERSION,
    accountId: input.accountId,
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    tier: tier.id,
    status: previous?.status ?? 'incomplete',
    stripeCustomerId: input.stripeCustomerId ?? previous?.stripeCustomerId ?? null,
    stripeSubscriptionId:
      input.stripeSubscriptionId ?? previous?.stripeSubscriptionId ?? null,
    stripeSubscriptionItemId: previous?.stripeSubscriptionItemId ?? null,
    stripePriceId: input.stripePriceId ?? previous?.stripePriceId ?? null,
    stripeOveragePriceId:
      input.stripeOveragePriceId ?? previous?.stripeOveragePriceId ?? null,
    consequencePack: input.consequencePack,
    downstreamSystemRefDigest:
      input.downstreamSystemRefDigest ?? previous?.downstreamSystemRefDigest ?? null,
    policyGatePathRefDigest:
      input.policyGatePathRefDigest ?? previous?.policyGatePathRefDigest ?? null,
    includedAdmissionsMonthly: tier.includedAdmissionsMonthly,
    monthlyAdmissionsUsed: previousSamePeriod
      ? previous?.monthlyAdmissionsUsed ?? 0
      : 0,
    admissionPeriod: period,
    currentPeriodStart: previousSamePeriod ? previous?.currentPeriodStart ?? null : null,
    currentPeriodEnd: previousSamePeriod ? previous?.currentPeriodEnd ?? null : null,
    customerGateProofPresent: previous?.customerGateProofPresent ?? false,
    lastCheckoutAction: input.checkoutAction ?? previous?.lastCheckoutAction ?? null,
    lastCheckoutSessionId:
      input.checkoutSessionId ?? previous?.lastCheckoutSessionId ?? null,
    lastCheckoutCompletedAt:
      input.checkoutCompletedAt ?? previous?.lastCheckoutCompletedAt ?? null,
    lastEventId: input.eventId ?? previous?.lastEventId ?? null,
    lastEventType: input.eventType ?? previous?.lastEventType ?? null,
    lastEventAt: input.eventAt ?? previous?.lastEventAt ?? null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  });
}

export function projectStripeWorkflowEntitlement(
  previous: StoredWorkflowEntitlementRecord | null,
  input: StripeWorkflowEntitlementInput,
): StoredWorkflowEntitlementRecord {
  const pending = projectPendingWorkflowEntitlement(previous, input);
  return normalizeWorkflowEntitlementRecord({
    ...pending,
    status: input.status,
    stripeSubscriptionItemId:
      input.stripeSubscriptionItemId ?? pending.stripeSubscriptionItemId,
    customerGateProofPresent:
      input.customerGateProofPresent ?? pending.customerGateProofPresent,
  });
}

function usageFromRecord(record: StoredWorkflowEntitlementRecord): WorkflowUsageContext {
  const tier = getWorkflowBillingTier(record.tier)!;
  const quota = tier.includedAdmissionsMonthly;
  const overageUnits = Math.max(0, record.monthlyAdmissionsUsed - quota);
  return {
    workflowId: record.workflowId,
    accountId: record.accountId,
    tenantId: record.tenantId,
    tier: record.tier,
    meter: WORKFLOW_USAGE_METER,
    period: record.admissionPeriod,
    used: record.monthlyAdmissionsUsed,
    quota,
    remaining: Math.max(0, quota - record.monthlyAdmissionsUsed),
    hardLimit: tier.overageBehavior === 'hard-stop',
    overage: overageUnits > 0,
    overageUnits,
  };
}

export function projectWorkflowEntitlementAdmissionUsage(
  record: StoredWorkflowEntitlementRecord,
  now = new Date(),
): WorkflowUsageDecision {
  const period = currentWorkflowUsagePeriod(now);
  const normalized = normalizeWorkflowEntitlementRecord(record);
  const periodRecord = normalized.admissionPeriod === period
    ? normalized
    : normalizeWorkflowEntitlementRecord({
        ...normalized,
        admissionPeriod: period,
        monthlyAdmissionsUsed: 0,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });
  const tier = getWorkflowBillingTier(periodRecord.tier)!;
  const beforeUsage = usageFromRecord(periodRecord);
  if (beforeUsage.hardLimit && beforeUsage.used >= beforeUsage.quota) {
    return {
      allowed: false,
      usage: beforeUsage,
      entitlement: periodRecord,
    };
  }
  const updated = normalizeWorkflowEntitlementRecord({
    ...periodRecord,
    monthlyAdmissionsUsed: periodRecord.monthlyAdmissionsUsed + 1,
    includedAdmissionsMonthly: tier.includedAdmissionsMonthly,
    updatedAt: now.toISOString(),
  });
  return {
    allowed: true,
    usage: usageFromRecord(updated),
    entitlement: updated,
  };
}

export function findWorkflowBillingTierByStripeLineItemPrice(
  priceId: string | null | undefined,
): WorkflowBillingTierId | null {
  const tier = findWorkflowBillingTierByStripePriceId(priceId);
  if (!tier) return null;
  return resolveWorkflowTierStripePrice(tier.id).priceId === priceId
    ? tier.id
    : null;
}

export function workflowOveragePriceForTier(
  tierId: WorkflowBillingTierId,
): { priceId: string | null; meterEventName: string } {
  const overage = resolveWorkflowTierStripeOveragePrice(tierId);
  return {
    priceId: overage.priceId,
    meterEventName:
      overage.meterEventName || workflowStripeOverageMeterEventName(),
  };
}

export function upsertPendingWorkflowEntitlement(
  input: PendingWorkflowEntitlementInput,
): { record: StoredWorkflowEntitlementRecord; path: string } {
  return withWorkflowStoreLock((store, path) => {
    const index = store.records.findIndex((entry) =>
      entry.tenantId === input.tenantId && entry.workflowId === input.workflowId
    );
    const previous = index >= 0 ? store.records[index] ?? null : null;
    const record = projectPendingWorkflowEntitlement(previous, input);
    if (index >= 0) store.records[index] = record;
    else store.records.push(record);
    saveStore(store);
    return { record, path };
  });
}

export function upsertWorkflowEntitlementFromStripe(
  input: StripeWorkflowEntitlementInput,
): { record: StoredWorkflowEntitlementRecord; path: string } {
  return withWorkflowStoreLock((store, path) => {
    const index = store.records.findIndex((entry) =>
      entry.tenantId === input.tenantId && entry.workflowId === input.workflowId
    );
    const previous = index >= 0 ? store.records[index] ?? null : null;
    const record = projectStripeWorkflowEntitlement(previous, input);
    if (index >= 0) store.records[index] = record;
    else store.records.push(record);
    saveStore(store);
    return { record, path };
  });
}

export function findWorkflowEntitlementByTenantAndWorkflow(
  tenantId: string,
  workflowId: string,
): { record: StoredWorkflowEntitlementRecord | null; path: string } {
  const store = loadStore();
  return {
    record: store.records.find((entry) =>
      entry.tenantId === tenantId && entry.workflowId === workflowId
    ) ?? null,
    path: storePath(),
  };
}

export function findWorkflowEntitlementByStripeSubscriptionItemId(
  stripeSubscriptionItemId: string,
): { record: StoredWorkflowEntitlementRecord | null; path: string } {
  const store = loadStore();
  return {
    record: store.records.find((entry) =>
      entry.stripeSubscriptionItemId === stripeSubscriptionItemId
    ) ?? null,
    path: storePath(),
  };
}

export function listWorkflowEntitlements(
  filters?: ListWorkflowEntitlementsFilters,
): { records: StoredWorkflowEntitlementRecord[]; path: string } {
  const limit = Math.max(1, Math.min(1000, filters?.limit ?? 100));
  const offset = Math.max(0, filters?.offset ?? 0);
  let records = loadStore().records;
  if (filters?.accountId) {
    records = records.filter((entry) => entry.accountId === filters.accountId);
  }
  if (filters?.tenantId) {
    records = records.filter((entry) => entry.tenantId === filters.tenantId);
  }
  if (filters?.status) {
    records = records.filter((entry) => entry.status === filters.status);
  }
  records = [...records].sort((left, right) =>
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
  return {
    records: records.slice(offset, offset + limit),
    path: storePath(),
  };
}

export function consumeWorkflowEntitlementAdmission(
  tenantId: string,
  workflowId: string,
): { decision: WorkflowUsageDecision | null; path: string } {
  return withWorkflowStoreLock((store, path) => {
    const index = store.records.findIndex((entry) =>
      entry.tenantId === tenantId && entry.workflowId === workflowId
    );
    if (index < 0) return { decision: null, path };
    const current = store.records[index]!;
    const decision = projectWorkflowEntitlementAdmissionUsage(current);
    if (decision.allowed) {
      store.records[index] = decision.entitlement;
      saveStore(store);
    }
    return { decision, path };
  });
}

export function exportWorkflowEntitlementStoreSnapshot(): WorkflowEntitlementStoreSnapshot {
  const records = listWorkflowEntitlements({ limit: 1000 }).records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export function restoreWorkflowEntitlementStoreSnapshot(
  snapshot: WorkflowEntitlementStoreSnapshot,
): { recordCount: number; path: string } {
  return withWorkflowStoreLock((_store, path) => {
    const store: WorkflowEntitlementStoreFile = {
      version: 1,
      records: snapshot.records.map(normalizeWorkflowEntitlementRecord),
    };
    saveStore(store);
    return { recordCount: store.records.length, path };
  });
}

export function resetWorkflowEntitlementStoreForTests(): void {
  const path = storePath();
  if (existsSync(path)) rmSync(path, { force: true });
  if (existsSync(`${path}.lock`)) rmSync(`${path}.lock`, {
    recursive: true,
    force: true,
  });
}
