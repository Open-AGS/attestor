import assert from 'node:assert/strict';
import {
  evaluateWorkflowEntitlementAccess,
  type WorkflowEntitlementRecord,
} from '../src/service/workflow-entitlement.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function entitlement(
  overrides: Partial<WorkflowEntitlementRecord> = {},
): WorkflowEntitlementRecord {
  return {
    workflowId: 'wf_refunds',
    accountId: 'acct_123',
    tenantId: 'tenant_123',
    tier: 'starter-workflow',
    status: 'active',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    stripeSubscriptionItemId: 'si_123',
    stripePriceId: 'price_starter_workflow_live',
    stripeOveragePriceId: 'price_starter_workflow_overage_live',
    consequencePack: 'money-movement',
    downstreamSystemRefDigest: 'sha256:downstream',
    policyGatePathRefDigest: 'sha256:gate',
    customerGateProofPresent: true,
    ...overrides,
  };
}

function testMissingEntitlementFailsClosed(): void {
  const decision = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    entitlement: null,
  });

  equal(decision.allowed, false, 'Workflow entitlement: missing entitlement blocks access');
  equal(decision.action, 'block', 'Workflow entitlement: missing entitlement action is block');
  ok(
    decision.reasonCodes.includes('workflow-entitlement-missing'),
    'Workflow entitlement: missing entitlement reason is explicit',
  );
  equal(decision.productionReady, false, 'Workflow entitlement: access contract is not readiness');
  equal(
    decision.activatesEnforcement,
    false,
    'Workflow entitlement: access contract does not activate enforcement',
  );
}

function testPilotIncludesShadowButNotEnforce(): void {
  const pilot = entitlement({
    tier: 'pilot-workflow',
    stripePriceId: 'price_pilot_workflow_live',
    stripeOveragePriceId: null,
    customerGateProofPresent: false,
  });
  const reviewSimulation = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review-simulation',
    requestedCapability: 'policy-twin-backtest',
    requestedConsequencePack: 'money-movement',
    entitlement: pilot,
  });
  const enforce = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'enforce',
    requestedCapability: 'customer-gated-enforce-mode',
    requestedConsequencePack: 'money-movement',
    entitlement: pilot,
  });

  equal(reviewSimulation.allowed, true, 'Workflow entitlement: Pilot allows simulation');
  equal(enforce.allowed, false, 'Workflow entitlement: Pilot does not allow enforce');
  ok(
    enforce.reasonCodes.includes('workflow-mode-not-in-tier'),
    'Workflow entitlement: Pilot enforce denial names the tier mode boundary',
  );
}

function testStarterEnforceRequiresCustomerGateProof(): void {
  const missingGate = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'enforce',
    requestedCapability: 'customer-gated-enforce-mode',
    requestedConsequencePack: 'money-movement',
    entitlement: entitlement({ customerGateProofPresent: false }),
  });
  const withGate = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'enforce',
    requestedCapability: 'customer-gated-enforce-mode',
    requestedConsequencePack: 'money-movement',
    entitlement: entitlement({ customerGateProofPresent: true }),
  });

  equal(missingGate.allowed, false, 'Workflow entitlement: enforce blocks without gate proof');
  ok(
    missingGate.reasonCodes.includes('customer-gate-proof-required'),
    'Workflow entitlement: missing customer gate proof reason is explicit',
  );
  equal(withGate.allowed, true, 'Workflow entitlement: enforce can pass with gate proof');
  equal(withGate.includedAdmissionsMonthly, 25_000, 'Workflow entitlement: Starter quota is surfaced');
}

function testWorkflowPackAndStripeBindingAreFailClosed(): void {
  const packMismatch = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    requestedConsequencePack: 'data-movement',
    entitlement: entitlement({ consequencePack: 'money-movement' }),
  });
  const missingStripeItem = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    requestedConsequencePack: 'money-movement',
    entitlement: entitlement({ stripeSubscriptionItemId: null }),
  });

  equal(packMismatch.allowed, false, 'Workflow entitlement: selected-pack mismatch blocks');
  ok(
    packMismatch.reasonCodes.includes('workflow-pack-not-in-tier'),
    'Workflow entitlement: pack mismatch reason is explicit',
  );
  equal(missingStripeItem.allowed, false, 'Workflow entitlement: missing Stripe item blocks');
  ok(
    missingStripeItem.reasonCodes.includes('billing-metadata-incomplete'),
    'Workflow entitlement: missing Stripe binding reason is explicit',
  );
}

function testProStillKeepsCustomerGateBoundary(): void {
  const pro = entitlement({
    tier: 'pro-workflow',
    stripePriceId: 'price_pro_workflow_live',
    stripeOveragePriceId: 'price_pro_workflow_overage_live',
    consequencePack: 'money-movement',
    customerGateProofPresent: false,
  });
  const dataMovementReview = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    requestedCapability: 'all-current-hosted-packs',
    requestedConsequencePack: 'data-movement',
    entitlement: pro,
  });
  const enforce = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'enforce',
    requestedCapability: 'customer-gated-enforce-mode',
    requestedConsequencePack: 'data-movement',
    entitlement: pro,
  });

  equal(dataMovementReview.allowed, true, 'Workflow entitlement: Pro allows all hosted packs');
  equal(enforce.allowed, false, 'Workflow entitlement: Pro enforce still needs gate proof');
  ok(
    enforce.reasonCodes.includes('customer-gate-proof-required'),
    'Workflow entitlement: Pro cannot bypass the customer gate boundary',
  );
}

function testInactiveStatusesDoNotSilentlyEnablePaidFeatures(): void {
  const trialing = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    entitlement: entitlement({ status: 'trialing' }),
  });
  const pastDueGrace = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'review',
    entitlement: entitlement({ status: 'past_due' }),
    pastDueGraceActive: true,
  });
  const pastDueEnforce = evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_refunds',
    requestedMode: 'enforce',
    entitlement: entitlement({ status: 'past_due' }),
    pastDueGraceActive: true,
  });

  equal(trialing.allowed, false, 'Workflow entitlement: Stripe trialing is blocked by default');
  ok(
    trialing.reasonCodes.includes('workflow-status-trialing-not-enabled'),
    'Workflow entitlement: trialing block reason is explicit',
  );
  equal(pastDueGrace.allowed, true, 'Workflow entitlement: past-due grace can allow review');
  equal(pastDueGrace.action, 'review-only', 'Workflow entitlement: past-due grace is review-only');
  equal(pastDueEnforce.allowed, false, 'Workflow entitlement: past-due grace never allows enforce');
  ok(
    pastDueEnforce.reasonCodes.includes('workflow-status-past-due'),
    'Workflow entitlement: past-due enforce block reason is explicit',
  );
}

testMissingEntitlementFailsClosed();
testPilotIncludesShadowButNotEnforce();
testStarterEnforceRequiresCustomerGateProof();
testWorkflowPackAndStripeBindingAreFailClosed();
testProStillKeepsCustomerGateBoundary();
testInactiveStatusesDoNotSilentlyEnablePaidFeatures();

console.log(`Workflow entitlement access tests: ${passed} passed, 0 failed`);
