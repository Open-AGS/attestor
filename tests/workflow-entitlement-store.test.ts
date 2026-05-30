import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  consumeWorkflowEntitlementAdmission,
  resetWorkflowEntitlementStoreForTests,
  restoreWorkflowEntitlementStoreSnapshot,
  upsertWorkflowEntitlementFromStripe,
} from '../src/service/workflow-entitlement-store.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

const tempRoot = mkdtempSync(join(tmpdir(), 'attestor-workflow-entitlement-'));
const previousPath = process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH;
process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH = join(tempRoot, 'workflow-entitlements.json');

try {
  resetWorkflowEntitlementStoreForTests();

  const pilot = upsertWorkflowEntitlementFromStripe({
    accountId: 'acct_123',
    tenantId: 'tenant_123',
    workflowId: 'wf_pilot',
    tier: 'pilot-workflow',
    consequencePack: 'money-movement',
    downstreamSystemRefDigest: 'sha256:downstream',
    policyGatePathRefDigest: 'sha256:gate',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    stripeSubscriptionItemId: 'si_pilot',
    stripePriceId: 'price_pilot_workflow_live',
    stripeOveragePriceId: null,
    status: 'active',
  }).record;

  equal(pilot.includedAdmissionsMonthly, 15_000, 'Workflow store: Pilot quota is normalized from the catalog');
  equal(pilot.monthlyAdmissionsUsed, 0, 'Workflow store: new entitlement starts with zero monthly admissions');

  const first = consumeWorkflowEntitlementAdmission('tenant_123', 'wf_pilot').decision;
  ok(first?.allowed, 'Workflow store: active Pilot entitlement allows first admission');
  equal(first?.usage.used, 1, 'Workflow store: first admission increments usage');
  equal(first?.usage.hardLimit, true, 'Workflow store: Pilot remains hard-stop over quota');

  const starter = upsertWorkflowEntitlementFromStripe({
    accountId: 'acct_123',
    tenantId: 'tenant_123',
    workflowId: 'wf_starter',
    tier: 'starter-workflow',
    consequencePack: 'money-movement',
    downstreamSystemRefDigest: 'sha256:downstream',
    policyGatePathRefDigest: 'sha256:gate',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_456',
    stripeSubscriptionItemId: 'si_starter',
    stripePriceId: 'price_starter_workflow_live',
    stripeOveragePriceId: 'price_starter_workflow_overage_live',
    status: 'active',
  }).record;

  restoreWorkflowEntitlementStoreSnapshot({
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: 2,
    records: [
      first!.entitlement,
      {
        ...starter,
        monthlyAdmissionsUsed: 25_000,
      },
    ],
  });
  const starterDecision = consumeWorkflowEntitlementAdmission('tenant_123', 'wf_starter').decision;
  ok(starterDecision?.allowed, 'Workflow store: Starter allows soft overage admission');
  equal(starterDecision?.usage.overage, true, 'Workflow store: Starter usage marks overage');
  equal(starterDecision?.usage.overageUnits, 1, 'Workflow store: Starter overage unit is counted');

  const missing = consumeWorkflowEntitlementAdmission('tenant_123', 'wf_missing').decision;
  equal(missing, null, 'Workflow store: missing workflow consumption returns null decision');

  console.log(`Workflow entitlement store tests: ${passed} passed, 0 failed`);
} finally {
  resetWorkflowEntitlementStoreForTests();
  if (previousPath === undefined) delete process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH;
  else process.env.ATTESTOR_WORKFLOW_ENTITLEMENT_STORE_PATH = previousPath;
  rmSync(tempRoot, { recursive: true, force: true });
}
