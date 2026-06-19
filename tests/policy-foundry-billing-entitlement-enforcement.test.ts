import assert from 'node:assert/strict';
import {
  createPolicyFoundryBillingEntitlementEnforcement,
} from '../src/service/policy-foundry/policy-foundry-billing-entitlement-enforcement.js';
import type { HostedBillingEntitlementRecord } from '../src/service/billing/billing-entitlement-store.js';
import {
  evaluateWorkflowEntitlementAccess,
  type WorkflowEntitlementAccessDecision,
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

function entitlement(overrides: Partial<HostedBillingEntitlementRecord> = {}): HostedBillingEntitlementRecord {
  return {
    id: 'ent_policy_foundry',
    accountId: 'acct_policy_foundry',
    tenantId: 'tenant_policy_foundry',
    provider: 'stripe',
    status: 'active',
    accessEnabled: true,
    effectivePlanId: 'trial',
    requestedPlanId: 'trial',
    monthlyRunQuota: 100,
    requestsPerWindow: 100,
    asyncPendingJobsPerTenant: 2,
    accountStatus: 'active',
    stripeCustomerId: 'cus_policy_foundry',
    stripeSubscriptionId: 'sub_policy_foundry',
    stripeSubscriptionStatus: 'active',
    stripePriceId: 'price_starter_workflow_monthly',
    stripeCheckoutSessionId: 'cs_policy_foundry',
    stripeInvoiceId: 'in_policy_foundry',
    stripeInvoiceStatus: 'paid',
    stripeEntitlementLookupKeys: [],
    stripeEntitlementFeatureIds: [],
    stripeEntitlementSummaryUpdatedAt: '2026-05-13T10:00:00.000Z',
    lastEventId: 'evt_policy_foundry',
    lastEventType: 'entitlements.active_entitlement_summary.updated',
    lastEventAt: '2026-05-13T10:00:00.000Z',
    effectiveAt: '2026-05-13T10:00:00.000Z',
    delinquentSince: null,
    reason: 'subscription_active',
    createdAt: '2026-05-13T09:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
    ...overrides,
  };
}

function workflowAccess(input: {
  readonly tier?: string;
  readonly status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  readonly customerGateProofPresent?: boolean;
} = {}): WorkflowEntitlementAccessDecision {
  return evaluateWorkflowEntitlementAccess({
    workflowId: 'wf_policy_foundry',
    entitlement: {
      workflowId: 'wf_policy_foundry',
      tier: input.tier ?? 'starter-workflow',
      status: input.status ?? 'active',
      consequencePack: 'money-movement',
      stripeSubscriptionItemId: 'si_policy_foundry',
      stripePriceId: 'price_policy_foundry',
      customerGateProofPresent: input.customerGateProofPresent ?? true,
    },
    requestedMode: 'enforce',
    requestedCapability: 'customer-gated-enforce-mode',
  });
}

function testBillingProviderPlanPreventsPlanSpoofing(): void {
  const result = createPolicyFoundryBillingEntitlementEnforcement({
    evaluatedAt: '2026-05-13T11:00:00.000Z',
    tenantPlanId: 'trial',
    requestedPlan: 'pro-workflow',
    requestedPlanExplicit: true,
    requestedCapabilities: ['customer-operated-deployment'],
    requestedCustomerOperatedDeployment: true,
    entitlement: entitlement({ effectivePlanId: 'trial' }),
    entitlementResolverConfigured: true,
    workflowEntitlementAccess: workflowAccess({ tier: 'starter-workflow' }),
    workflowEntitlementResolverConfigured: true,
  });

  equal(result.version, 'attestor.policy-foundry-billing-entitlement-enforcement.v1', 'Billing entitlement enforcement: version is explicit');
  equal(result.enforcementMode, 'billing-provider-enforced', 'Billing entitlement enforcement: provider mode is enabled');
  equal(result.effectiveBillingPlanId, 'starter-workflow', 'Billing entitlement enforcement: effective billing tier comes from workflow entitlement');
  equal(result.commercialPlanForBoundary, 'starter-workflow', 'Billing entitlement enforcement: boundary uses effective workflow tier');
  ok(result.noGoReasons.includes('requested-plan-not-entitled'), 'Billing entitlement enforcement: explicit plan elevation is blocked');
  ok(result.noGoReasons.includes('customer-operated-not-entitled'), 'Billing entitlement enforcement: customer-operated request needs negotiated deployment');
  equal(result.commercialCapabilitiesAllowed, false, 'Billing entitlement enforcement: commercial capabilities are not allowed on mismatch');
  equal(result.entitlementDecisionAuthority, false, 'Billing entitlement enforcement: billing is not policy authority');
  equal(result.safetyMinimumsRemainAvailable, true, 'Billing entitlement enforcement: safety minimums remain available');
}

function testMissingProviderStateFailsClosedForProductionRequests(): void {
  const result = createPolicyFoundryBillingEntitlementEnforcement({
    evaluatedAt: '2026-05-13T11:05:00.000Z',
    tenantPlanId: 'trial',
    requestedCapabilities: ['review-enforce-ladder'],
    requestedProductionWorkflowCount: 1,
    requestedHostedProduction: true,
    entitlement: null,
    entitlementResolverConfigured: true,
    workflowEntitlementAccess: null,
    workflowEntitlementResolverConfigured: true,
  });

  equal(result.entitlementPresent, false, 'Billing entitlement enforcement: missing entitlement is explicit');
  equal(result.commercialPlanForBoundary, 'trial', 'Billing entitlement enforcement: missing provider state fails closed to trial boundary');
  ok(result.noGoReasons.includes('billing-entitlement-missing'), 'Billing entitlement enforcement: missing entitlement is no-go');
  ok(result.noGoReasons.includes('production-enforcement-not-entitled'), 'Billing entitlement enforcement: production request is not entitled');
  equal(result.commercialCapabilitiesAllowed, false, 'Billing entitlement enforcement: production request is not commercially allowed');
}

function testDelinquentProviderStateDisablesCommercialCapabilities(): void {
  const result = createPolicyFoundryBillingEntitlementEnforcement({
    evaluatedAt: '2026-05-13T11:10:00.000Z',
    tenantPlanId: 'trial',
    requestedCapabilities: ['candidate-red-team-replay'],
    entitlement: entitlement({
      status: 'delinquent',
      accessEnabled: false,
      effectivePlanId: 'pro-workflow',
      stripeSubscriptionStatus: 'past_due',
      reason: 'subscription_past_due',
    }),
    entitlementResolverConfigured: true,
  });

  equal(result.accessEnabled, false, 'Billing entitlement enforcement: disabled access is reflected');
  equal(result.commercialPlanForBoundary, 'trial', 'Billing entitlement enforcement: disabled access fails closed to trial boundary');
  ok(result.noGoReasons.includes('billing-access-disabled'), 'Billing entitlement enforcement: disabled access is no-go');
  equal(result.productionReady, false, 'Billing entitlement enforcement: production readiness is not claimed');
}

function testTenantContextOnlyKeepsEvaluationPath(): void {
  const result = createPolicyFoundryBillingEntitlementEnforcement({
    evaluatedAt: '2026-05-13T11:15:00.000Z',
    tenantPlanId: 'trial',
    requestedCapabilities: ['basic-shadow-summary'],
    entitlement: null,
    entitlementResolverConfigured: false,
  });

  equal(result.enforcementMode, 'tenant-context-only', 'Billing entitlement enforcement: tenant-context mode is explicit');
  equal(result.billingStateRequired, false, 'Billing entitlement enforcement: basic shadow summary does not require billing state');
  equal(result.noGoReasons.length, 0, 'Billing entitlement enforcement: safety/evaluation path remains open');
  equal(result.commercialPlanForBoundary, 'trial', 'Billing entitlement enforcement: tenant plan remains boundary plan without provider resolver');
}

try {
  testBillingProviderPlanPreventsPlanSpoofing();
  testMissingProviderStateFailsClosedForProductionRequests();
  testDelinquentProviderStateDisablesCommercialCapabilities();
  testTenantContextOnlyKeepsEvaluationPath();
  ok(passed > 0, 'Policy Foundry billing entitlement enforcement tests executed');
  console.log(`Policy Foundry billing entitlement enforcement tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry billing entitlement enforcement tests failed:', error);
  process.exitCode = 1;
}
