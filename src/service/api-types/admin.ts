/**
 * Attestor service API admin types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

import type { AccountBillingEntitlementRecord } from './account.js';
import type { AccountBillingExportResponse, AccountBillingReconciliationResponse } from './billing.js';

export interface AdminTenantKeyRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  planId: string | null;
  monthlyRunQuota: number | null;
  apiKeyPreview: string;
  sealedStorage: {
    enabled: boolean;
    provider: 'vault_transit' | null;
    keyName: string | null;
    keyVersion: number | null;
    sealedAt: string | null;
    breakGlassRecoverable: boolean;
  };
  status: 'active' | 'inactive' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
  deactivatedAt: string | null;
  revokedAt: string | null;
  rotatedFromKeyId: string | null;
  supersededByKeyId: string | null;
  supersededAt: string | null;
}

export interface AdminListTenantKeysResponse {
  keys: AdminTenantKeyRecord[];
  defaults: {
    maxActiveKeysPerTenant: number;
  };
}

export interface AdminIssueTenantKeyRequest {
  tenantId: string;
  tenantName: string;
  planId?: string;
  monthlyRunQuota?: number | null;
}

export interface AdminIssueTenantKeyResponse {
  key: AdminTenantKeyRecord & { apiKey: string };
}

export interface AdminRotateTenantKeyRequest {
  planId?: string;
  monthlyRunQuota?: number | null;
}

export interface AdminRotateTenantKeyResponse {
  previousKey: AdminTenantKeyRecord;
  newKey: AdminTenantKeyRecord & { apiKey: string };
}

export interface AdminTenantKeyStatusResponse {
  key: AdminTenantKeyRecord;
}

export interface AdminRecoverTenantKeyRequest {
  reason?: string;
}

export interface AdminRecoverTenantKeyResponse {
  key: AdminTenantKeyRecord & { apiKey: string };
}

export interface AdminAccountBillingSummary {
  provider: 'stripe' | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  stripePriceId: string | null;
  lastCheckoutSessionId: string | null;
  lastCheckoutCompletedAt: string | null;
  lastCheckoutPlanId: string | null;
  lastInvoiceId: string | null;
  lastInvoiceStatus: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  lastInvoiceCurrency: string | null;
  lastInvoiceAmountPaid: number | null;
  lastInvoiceAmountDue: number | null;
  lastInvoiceEventId: string | null;
  lastInvoiceEventType: string | null;
  lastInvoiceProcessedAt: string | null;
  lastInvoicePaidAt: string | null;
  delinquentSince: string | null;
  lastWebhookEventId: string | null;
  lastWebhookEventType: string | null;
  lastWebhookProcessedAt: string | null;
}

export interface AdminAccountRecord {
  id: string;
  accountName: string;
  contactEmail: string;
  primaryTenantId: string;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  archivedAt: string | null;
  billing: AdminAccountBillingSummary;
}

export interface AdminListAccountsResponse {
  accounts: AdminAccountRecord[];
}

export interface AdminCreateAccountRequest {
  accountName: string;
  contactEmail: string;
  tenantId: string;
  tenantName: string;
  planId?: string;
  monthlyRunQuota?: number | null;
}

export interface AdminCreateAccountResponse {
  account: AdminAccountRecord;
  initialKey: AdminTenantKeyRecord & { apiKey: string };
}

export interface AdminAttachStripeBillingRequest {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  stripePriceId?: string | null;
}

export interface AdminAccountLifecycleResponse {
  account: AdminAccountRecord;
}

export interface HostedPlanSummary {
  id: 'trial';
  displayName: string;
  description: string;
  defaultEvaluationDays: number | null;
  defaultMonthlyRunQuota: number | null;
  defaultPipelineRequestsPerWindow: number | null;
  defaultAsyncPendingJobsPerTenant: number | null;
  defaultAsyncActiveJobsPerTenant: number | null;
  billingSurface: 'workflow_entitlement';
  intendedFor: 'evaluation';
  defaultForHostedProvisioning: boolean;
}

export interface AdminListPlansResponse {
  plans: HostedPlanSummary[];
  defaults: {
    hostedProvisioningPlanId: 'trial';
    maxActiveKeysPerTenant: number;
    rateLimitWindowSeconds: number;
    asyncExecutionShared: boolean;
    asyncExecutionBackend: 'memory' | 'redis';
  };
}

export interface AdminAuditRecordResponse {
  id: string;
  occurredAt: string;
  actorType: 'admin_api_key' | 'stripe_webhook';
  actorLabel: string;
  action:
    | 'account.created'
    | 'account.suspended'
    | 'account.reactivated'
    | 'account.archived'
    | 'account.billing.attached'
    | 'async_job.retried'
    | 'billing.stripe.webhook_applied'
    | 'policy_activation.approval_approved'
    | 'policy_activation.approval_rejected'
    | 'policy_activation.approval_requested'
    | 'policy_activation.activated'
    | 'policy_activation.emergency_frozen'
    | 'policy_activation.emergency_rolled_back'
    | 'policy_activation.rolled_back'
    | 'policy_bundle.published'
    | 'policy_pack.upserted'
    | 'release_break_glass.issued'
    | 'release_enforcement.degraded_mode.grant_created'
    | 'release_enforcement.degraded_mode.grant_revoked'
    | 'release_review.approved'
    | 'release_review.rejected'
    | 'release_token.revoked'
    | 'tenant_key.issued'
    | 'tenant_key.rotated'
    | 'tenant_key.deactivated'
    | 'tenant_key.reactivated'
    | 'tenant_key.recovered'
    | 'tenant_key.revoked';
  routeId: string;
  accountId: string | null;
  tenantId: string | null;
  tenantKeyId: string | null;
  planId: string | null;
  monthlyRunQuota: number | null;
  idempotencyKey: string | null;
  requestHash: string;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  eventHash: string;
}

export interface AdminAuditResponse {
  records: AdminAuditRecordResponse[];
  summary: {
    actionFilter:
      | 'account.created'
      | 'account.suspended'
      | 'account.reactivated'
      | 'account.archived'
      | 'account.billing.attached'
      | 'async_job.retried'
      | 'billing.stripe.webhook_applied'
      | 'policy_activation.approval_approved'
      | 'policy_activation.approval_rejected'
      | 'policy_activation.approval_requested'
      | 'policy_activation.activated'
      | 'policy_activation.emergency_frozen'
      | 'policy_activation.emergency_rolled_back'
      | 'policy_activation.rolled_back'
      | 'policy_bundle.published'
      | 'policy_pack.upserted'
      | 'release_break_glass.issued'
      | 'release_enforcement.degraded_mode.grant_created'
      | 'release_enforcement.degraded_mode.grant_revoked'
      | 'release_review.approved'
      | 'release_review.rejected'
      | 'release_token.revoked'
      | 'tenant_key.issued'
      | 'tenant_key.rotated'
      | 'tenant_key.deactivated'
      | 'tenant_key.reactivated'
      | 'tenant_key.recovered'
      | 'tenant_key.revoked'
      | null;
    tenantFilter: string | null;
    accountFilter: string | null;
    recordCount: number;
    chainIntact: boolean;
    latestHash: string | null;
  };
}

export interface AdminUsageRecord {
  tenantId: string;
  tenantName: string | null;
  accountId: string | null;
  accountName: string | null;
  planId: string | null;
  monthlyRunQuota: number | null;
  meter: 'monthly_admission_runs';
  period: string;
  used: number;
  remaining: number | null;
  enforced: boolean;
  updatedAt: string;
}

export interface AdminUsageResponse {
  records: AdminUsageRecord[];
  summary: {
    tenantFilter: string | null;
    periodFilter: string | null;
    recordCount: number;
    tenantCount: number;
    totalUsed: number;
  };
}

export interface AdminBillingEventRecord {
  id: string;
  provider: 'stripe';
  source: 'stripe_webhook';
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  outcome: 'pending' | 'applied' | 'ignored';
  reason: string | null;
  accountId: string | null;
  tenantId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceStatus: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  stripeInvoiceCurrency: string | null;
  stripeInvoiceAmountPaid: number | null;
  stripeInvoiceAmountDue: number | null;
  accountStatusBefore: 'active' | 'suspended' | 'archived' | null;
  accountStatusAfter: 'active' | 'suspended' | 'archived' | null;
  billingStatusBefore:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  billingStatusAfter:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  mappedPlanId: string | null;
  receivedAt: string;
  processedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AdminBillingEventsResponse {
  records: AdminBillingEventRecord[];
  summary: {
    providerFilter: 'stripe' | null;
    accountFilter: string | null;
    tenantFilter: string | null;
    eventTypeFilter: string | null;
    outcomeFilter: 'applied' | 'ignored' | null;
    recordCount: number;
    appliedCount: number;
    ignoredCount: number;
    pendingCount: number;
  };
}

export interface AdminBillingEntitlementsResponse {
  records: AccountBillingEntitlementRecord[];
  summary: {
    accountFilter: string | null;
    tenantFilter: string | null;
    statusFilter:
      | 'provisioned'
      | 'checkout_completed'
      | 'active'
      | 'trialing'
      | 'delinquent'
      | 'suspended'
      | 'archived'
      | null;
    recordCount: number;
    accessEnabledCount: number;
    providerCounts: {
      manual: number;
      stripe: number;
    };
  };
}

export interface AdminAccountBillingExportResponse extends AccountBillingExportResponse {}
export interface AdminAccountBillingReconciliationResponse extends AccountBillingReconciliationResponse {}

export interface AdminAsyncQueueTenantSnapshot {
  tenantId: string;
  planId: string | null;
  pendingJobs: number;
  pendingLimit: number | null;
  enforced: boolean;
  activeExecutions: number;
  activeExecutionLimit: number | null;
  activeExecutionEnforced: boolean;
  activeExecutionBackend: 'memory' | 'redis';
  weightedDispatchEnforced: boolean;
  weightedDispatchBackend: 'memory' | 'redis';
  weightedDispatchWeight: number | null;
  weightedDispatchWindowMs: number | null;
  weightedDispatchNextEligibleAt: string | null;
  weightedDispatchWaitMs: number;
  scanLimit: number;
  scanTruncated: boolean;
  states: {
    waiting: number;
    active: number;
    delayed: number;
    prioritized: number;
    failed: number;
  };
}

export interface AdminAsyncQueueSummaryResponse {
  backendMode: 'bullmq' | 'in_process';
  queueName: string | null;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    prioritized: number;
    completed: number;
    failed: number;
    paused: number;
  };
  retryPolicy: {
    attempts: number;
    backoffMs: number;
    maxStalledCount: number;
    workerConcurrency: number;
    completedTtlSeconds: number;
    failedTtlSeconds: number;
  };
  tenant: AdminAsyncQueueTenantSnapshot | null;
}

export interface AdminAsyncDeadLetterRecord {
  jobId: string;
  name: string;
  backendMode: 'bullmq' | 'in_process';
  tenantId: string | null;
  planId: string | null;
  state: string;
  failedReason: string | null;
  attemptsMade: number;
  maxAttempts: number;
  requestedAt: string | null;
  submittedAt: string | null;
  processedAt: string | null;
  failedAt: string | null;
  recordedAt: string;
}

export interface AdminAsyncDeadLetterResponse {
  records: AdminAsyncDeadLetterRecord[];
  summary: {
    backendMode: 'bullmq' | 'in_process';
    tenantFilter: string | null;
    limit: number;
    recordCount: number;
  };
}

export interface AdminAsyncRetryResponse {
  job: AdminAsyncDeadLetterRecord;
}
