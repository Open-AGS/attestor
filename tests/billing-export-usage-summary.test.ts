import assert from 'node:assert/strict';
import type { HostedAccountRecord } from '../src/service/account/account-store.js';
import {
  buildHostedBillingExport,
  renderHostedBillingExportCsv,
} from '../src/service/billing/billing-export.js';
import type { UsageContext } from '../src/service/usage-meter.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const account: HostedAccountRecord = {
  id: 'acct_usage_export',
  accountName: 'Usage Export Co',
  contactEmail: 'billing@example.test',
  primaryTenantId: 'tenant_usage_export',
  status: 'active',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  suspendedAt: null,
  archivedAt: null,
  billing: {
    provider: 'stripe',
    stripeCustomerId: null,
    stripeSubscriptionId: 'sub_usage_export_workflow',
    stripeSubscriptionStatus: 'active',
    stripePriceId: 'price_pro_workflow_monthly',
    lastCheckoutSessionId: null,
    lastCheckoutCompletedAt: null,
    lastCheckoutPlanId: null,
    lastInvoiceId: null,
    lastInvoiceStatus: null,
    lastInvoiceCurrency: null,
    lastInvoiceAmountPaid: null,
    lastInvoiceAmountDue: null,
    lastInvoiceEventId: null,
    lastInvoiceEventType: null,
    lastInvoiceProcessedAt: null,
    lastInvoicePaidAt: null,
    delinquentSince: null,
    lastWebhookEventId: null,
    lastWebhookEventType: null,
    lastWebhookProcessedAt: null,
  },
};

const usage: UsageContext = {
  tenantId: 'tenant_usage_export',
  planId: 'trial',
  meter: 'monthly_admission_runs',
  period: '2026-05',
  used: 250_001,
  quota: 250_000,
  remaining: 0,
  enforced: false,
  hardLimit: false,
  overage: true,
  overageUnits: 1,
};

async function testBillingExportIncludesUsagePosture(): Promise<void> {
  const payload = await buildHostedBillingExport({
    account,
    usage,
    limit: 5,
  });

  equal(payload.usage?.used, 250_001, 'Billing export usage: used count is included');
  equal(payload.usage?.quota, 250_000, 'Billing export usage: included quota is included');
  equal(payload.usage?.overage, true, 'Billing export usage: overage flag is included');
  equal(payload.usage?.overageUnits, 1, 'Billing export usage: overage units are included');
  equal(payload.summary.usageOverage, true, 'Billing export summary: overage flag is summarized');
  equal(payload.summary.usageOverageUnits, 1, 'Billing export summary: overage units are summarized');
  equal(payload.summary.usageHardLimit, false, 'Billing export summary: paid hosted plan is not hard-limited');
}

async function testBillingExportCsvIncludesUsageRow(): Promise<void> {
  const payload = await buildHostedBillingExport({
    account,
    usage,
    limit: 5,
  });
  const csv = renderHostedBillingExportCsv(payload);
  const rows = csv.trim().split('\n').map((row) => row.split(','));
  const header = rows[0];
  const usageRow = rows.find((row) => row[0] === 'usage');

  ok(Boolean(usageRow), 'Billing export CSV: usage row is emitted');
  equal(header.length, usageRow?.length, 'Billing export CSV: usage row matches header width');
  equal(header.includes('usageOverageUnits'), true, 'Billing export CSV: overage unit column is present');
  equal(usageRow?.[header.indexOf('usageUsed')], '250001', 'Billing export CSV: usage used value is present');
  equal(usageRow?.[header.indexOf('usageQuota')], '250000', 'Billing export CSV: usage quota value is present');
  equal(usageRow?.[header.indexOf('usageOverage')], 'true', 'Billing export CSV: usage overage value is present');
  equal(usageRow?.[header.indexOf('usageOverageUnits')], '1', 'Billing export CSV: usage overage units value is present');
  equal(usageRow?.[header.indexOf('usageHardLimit')], 'false', 'Billing export CSV: usage hard-limit value is present');
}

await testBillingExportIncludesUsagePosture();
await testBillingExportCsvIncludesUsageRow();

console.log(`Billing export usage summary tests: ${passed} passed, 0 failed`);
