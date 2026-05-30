import assert from 'node:assert/strict';
import {
  TRIAL_ACCOUNT_ENTITLEMENT,
  findWorkflowBillingTierByStripePriceId,
  getWorkflowBillingTier,
  listWorkflowBillingTierIds,
  resolveWorkflowTierStripeOveragePrice,
  resolveWorkflowTierStripePrice,
  workflowStripeOverageMeterEventName,
} from '../src/service/workflow-entitlement-catalog.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function testTrialStaysAccountLevelEvaluation(): void {
  equal(TRIAL_ACCOUNT_ENTITLEMENT.id, 'trial', 'Workflow catalog: trial id is stable');
  equal(TRIAL_ACCOUNT_ENTITLEMENT.priceCents, 0, 'Workflow catalog: trial remains free');
  equal(TRIAL_ACCOUNT_ENTITLEMENT.durationDays, 30, 'Workflow catalog: trial is 30 days');
  equal(
    TRIAL_ACCOUNT_ENTITLEMENT.admissionQuotaTotal,
    10_000,
    'Workflow catalog: trial has 10k total admissions',
  );
  equal(
    TRIAL_ACCOUNT_ENTITLEMENT.stripeSubscriptionItemRequired,
    false,
    'Workflow catalog: trial is not a Stripe subscription item',
  );
  equal(
    TRIAL_ACCOUNT_ENTITLEMENT.publicLaunchReady,
    false,
    'Workflow catalog: trial contract is private prep, not public launch',
  );
}

function testWorkflowTiersMatchLaunchPrepModel(): void {
  deepEqual(
    listWorkflowBillingTierIds(),
    ['pilot-workflow', 'starter-workflow', 'pro-workflow'],
    'Workflow catalog: only launch-prep workflow tiers are listed',
  );
  ok(
    !listWorkflowBillingTierIds().some((tier) => tier.includes('scale')),
    'Workflow catalog: Scale is not a workflow self-service launch tier',
  );
  ok(
    !listWorkflowBillingTierIds().some((tier) => tier.includes('enterprise')),
    'Workflow catalog: Enterprise is not a workflow self-service launch tier',
  );

  const pilot = getWorkflowBillingTier('pilot-workflow');
  const starter = getWorkflowBillingTier('starter-workflow');
  const pro = getWorkflowBillingTier('pro-workflow');

  equal(pilot?.unitAmountCents, 9_900, 'Workflow catalog: Pilot Workflow is $99');
  equal(
    pilot?.includedAdmissionsMonthly,
    15_000,
    'Workflow catalog: Pilot Workflow includes 15k admissions',
  );
  equal(pilot?.overageUnitAmountDecimal, null, 'Workflow catalog: Pilot has no overage');
  equal(pilot?.overageBehavior, 'hard-stop', 'Workflow catalog: Pilot hard-stops at quota');

  equal(starter?.unitAmountCents, 29_900, 'Workflow catalog: Starter Workflow is $299');
  equal(
    starter?.includedAdmissionsMonthly,
    25_000,
    'Workflow catalog: Starter Workflow includes 25k admissions',
  );
  equal(starter?.overageUnitAmountDecimal, '5', 'Workflow catalog: Starter overage is 5c');

  equal(pro?.unitAmountCents, 99_900, 'Workflow catalog: Pro Workflow is $999');
  equal(
    pro?.includedAdmissionsMonthly,
    250_000,
    'Workflow catalog: Pro Workflow includes 250k admissions',
  );
  equal(pro?.overageUnitAmountDecimal, '2.5', 'Workflow catalog: Pro overage is 2.5c');
  equal(
    pro?.packScope,
    'all-current-hosted-packs',
    'Workflow catalog: Pro can use all current hosted packs inside one workflow boundary',
  );
}

function testStripeEnvResolution(): void {
  const env = {
    ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW: 'price_pilot_workflow_live',
    ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW: 'price_starter_workflow_live',
    ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW: 'price_pro_workflow_live',
    ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW: 'price_starter_workflow_overage_live',
    ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW: 'price_pro_workflow_overage_live',
  };

  equal(
    resolveWorkflowTierStripePrice('pilot-workflow', env).priceId,
    'price_pilot_workflow_live',
    'Workflow catalog: Pilot price resolves from workflow env name',
  );
  equal(
    resolveWorkflowTierStripeOveragePrice('pilot-workflow', env).billable,
    false,
    'Workflow catalog: Pilot overage is not billable at launch',
  );
  equal(
    resolveWorkflowTierStripeOveragePrice('starter-workflow', env).priceId,
    'price_starter_workflow_overage_live',
    'Workflow catalog: Starter overage price resolves from workflow env name',
  );
  equal(
    workflowStripeOverageMeterEventName(env),
    'attestor_admission_overage',
    'Workflow catalog: shared admission overage meter event is stable',
  );
  equal(
    findWorkflowBillingTierByStripePriceId('price_pro_workflow_live', env)?.id,
    'pro-workflow',
    'Workflow catalog: Stripe base price id maps back to a workflow tier',
  );
}

testTrialStaysAccountLevelEvaluation();
testWorkflowTiersMatchLaunchPrepModel();
testStripeEnvResolution();

console.log(`Workflow entitlement catalog tests: ${passed} passed, 0 failed`);
