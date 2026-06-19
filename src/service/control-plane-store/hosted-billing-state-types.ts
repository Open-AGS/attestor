import type { HostedAccountRecord } from '../account/account-store.js';
import type { HostedBillingEntitlementStoreSnapshot } from '../billing/billing-entitlement-store.js';
import type { WorkflowEntitlementStoreSnapshot } from '../workflow-entitlement-store.js';

export interface HostedAccountStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: HostedAccountRecord[];
}

export interface BillingEntitlementStoreSnapshot extends HostedBillingEntitlementStoreSnapshot {}
export interface WorkflowEntitlementSnapshot extends WorkflowEntitlementStoreSnapshot {}
