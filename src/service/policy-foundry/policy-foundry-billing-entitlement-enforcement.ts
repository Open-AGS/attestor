import type { HostedBillingEntitlementRecord } from '../billing/billing-entitlement-store.js';
import {
  POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES,
  POLICY_FOUNDRY_COMMERCIAL_PLANS,
  type PolicyFoundryCommercialCapability,
  type PolicyFoundryCommercialPlan,
} from '../../consequence-admission/index.js';
import type { WorkflowEntitlementAccessDecision } from '../workflow-entitlement.js';

export const POLICY_FOUNDRY_BILLING_ENTITLEMENT_ENFORCEMENT_VERSION =
  'attestor.policy-foundry-billing-entitlement-enforcement.v1';

export const POLICY_FOUNDRY_BILLING_ENTITLEMENT_ENFORCEMENT_NO_GO_REASONS = [
  'billing-entitlement-missing',
  'billing-access-disabled',
  'requested-plan-not-entitled',
  'requested-plan-unsupported',
  'billing-plan-unsupported',
  'production-enforcement-not-entitled',
  'customer-operated-not-entitled',
] as const;
export type PolicyFoundryBillingEntitlementEnforcementNoGoReason =
  typeof POLICY_FOUNDRY_BILLING_ENTITLEMENT_ENFORCEMENT_NO_GO_REASONS[number];

export type PolicyFoundryBillingEntitlementEnforcementMode =
  | 'billing-provider-enforced'
  | 'tenant-context-only';

export interface CreatePolicyFoundryBillingEntitlementEnforcementInput {
  readonly evaluatedAt: string;
  readonly tenantPlanId?: string | null;
  readonly requestedPlan?: string | null;
  readonly requestedPlanExplicit?: boolean | null;
  readonly requestedCapabilities?: readonly PolicyFoundryCommercialCapability[] | readonly string[] | null;
  readonly requestedProductionWorkflowCount?: number | null;
  readonly requestedHostedProduction?: boolean | null;
  readonly requestedCustomerOperatedDeployment?: boolean | null;
  readonly entitlement?: HostedBillingEntitlementRecord | null;
  readonly entitlementResolverConfigured?: boolean | null;
  readonly workflowEntitlementAccess?: WorkflowEntitlementAccessDecision | null;
  readonly workflowEntitlementResolverConfigured?: boolean | null;
}

export interface PolicyFoundryBillingEntitlementEnforcement {
  readonly version: typeof POLICY_FOUNDRY_BILLING_ENTITLEMENT_ENFORCEMENT_VERSION;
  readonly evaluatedAt: string;
  readonly enforcementMode: PolicyFoundryBillingEntitlementEnforcementMode;
  readonly entitlementResolverConfigured: boolean;
  readonly entitlementPresent: boolean;
  readonly provider: HostedBillingEntitlementRecord['provider'] | null;
  readonly entitlementStatus: HostedBillingEntitlementRecord['status'] | null;
  readonly accessEnabled: boolean | null;
  readonly workflowEntitlementResolverConfigured: boolean;
  readonly workflowEntitlementPresent: boolean;
  readonly workflowEntitlementTier: string | null;
  readonly workflowEntitlementStatus: string | null;
  readonly workflowEntitlementAction: string | null;
  readonly workflowEntitlementReasonCodes: readonly string[];
  readonly stripeSummaryUpdatedAt: string | null;
  readonly requestedPlan: string | null;
  readonly requestedPlanExplicit: boolean;
  readonly tenantPlanId: string | null;
  readonly effectiveBillingPlanId: string | null;
  readonly commercialPlanForBoundary: PolicyFoundryCommercialPlan | string;
  readonly requestedCapabilities: readonly string[];
  readonly requestedProductionWorkflowCount: number;
  readonly requestedHostedProduction: boolean;
  readonly requestedCustomerOperatedDeployment: boolean;
  readonly billingStateRequired: boolean;
  readonly noGoReasons: readonly PolicyFoundryBillingEntitlementEnforcementNoGoReason[];
  readonly commercialCapabilitiesAllowed: boolean;
  readonly safetyMinimumsRemainAvailable: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly entitlementDecisionAuthority: false;
  readonly commercialAccessGate: true;
  readonly rawPayloadStored: false;
  readonly nextSafeStep: string;
  readonly limitation: string;
}

const PLAN_RANKS: Readonly<Record<PolicyFoundryCommercialPlan, number>> = Object.freeze({
  trial: 0,
  'pilot-workflow': 1,
  'starter-workflow': 2,
  'pro-workflow': 3,
  'negotiated-deployment': 4,
});

function isPlan(value: string | null | undefined): value is PolicyFoundryCommercialPlan {
  return typeof value === 'string' && (POLICY_FOUNDRY_COMMERCIAL_PLANS as readonly string[]).includes(value);
}

function isCapability(value: string): value is PolicyFoundryCommercialCapability {
  return (POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES as readonly string[]).includes(value);
}

function normalizePlan(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === '') return null;
  if (normalized === 'developer' || normalized === 'community') return 'trial';
  return normalized;
}

function normalizeCapabilities(values: readonly string[] | null | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0 && isCapability(value)))].sort());
}

function nonNegativeInteger(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Policy Foundry billing entitlement enforcement requestedProductionWorkflowCount must be a non-negative integer.');
  }
  return value;
}

function requiresBillingState(input: {
  readonly requestedProductionWorkflowCount: number;
  readonly requestedHostedProduction: boolean;
  readonly requestedCustomerOperatedDeployment: boolean;
  readonly requestedCapabilities: readonly string[];
}): boolean {
  return input.requestedProductionWorkflowCount > 0 ||
    input.requestedHostedProduction ||
    input.requestedCustomerOperatedDeployment ||
    input.requestedCapabilities.some((capability) => ![
      'basic-shadow-summary',
      'action-risk-inventory',
      'limited-policy-candidate-preview',
    ].includes(capability));
}

function requestedPlanOutranksEntitled(
  requestedPlan: string | null,
  effectivePlan: string | null,
): boolean {
  if (!isPlan(requestedPlan)) return false;
  if (!isPlan(effectivePlan)) return true;
  return PLAN_RANKS[requestedPlan] > PLAN_RANKS[effectivePlan];
}

function nextSafeStepFor(reasons: readonly PolicyFoundryBillingEntitlementEnforcementNoGoReason[]): string {
  if (reasons.includes('billing-entitlement-missing')) {
    return 'Keep Policy Foundry in review-only evaluation until hosted billing entitlement state is present for the tenant.';
  }
  if (reasons.includes('billing-access-disabled')) {
    return 'Restore hosted billing access before allowing paid Policy Foundry capabilities or production rollout requests.';
  }
  if (reasons.includes('requested-plan-not-entitled')) {
    return 'Use the billing-provider workflow tier, or buy the required workflow entitlement before requesting higher-tier Policy Foundry capabilities.';
  }
  if (reasons.includes('customer-operated-not-entitled')) {
    return 'Keep customer-operated Policy Foundry deployment behind a negotiated deployment entitlement.';
  }
  if (reasons.includes('production-enforcement-not-entitled')) {
    return 'Keep the workflow in shadow or review mode until the billing-provider entitlement allows production workflow rollout.';
  }
  if (reasons.length > 0) {
    return 'Keep this request in billing review before using commercial Policy Foundry capabilities.';
  }
  return 'Commercial access is entitlement-aligned; production rollout still requires approval, verifier evidence, deployment readiness, and smoke tests.';
}

export function createPolicyFoundryBillingEntitlementEnforcement(
  input: CreatePolicyFoundryBillingEntitlementEnforcementInput,
): PolicyFoundryBillingEntitlementEnforcement {
  const evaluatedAt = new Date(input.evaluatedAt);
  if (Number.isNaN(evaluatedAt.getTime())) {
    throw new Error('Policy Foundry billing entitlement enforcement evaluatedAt must be an ISO timestamp.');
  }
  const entitlementResolverConfigured = Boolean(input.entitlementResolverConfigured);
  const workflowEntitlementResolverConfigured = Boolean(input.workflowEntitlementResolverConfigured);
  const requestedPlan = normalizePlan(input.requestedPlan);
  const tenantPlanId = normalizePlan(input.tenantPlanId);
  const requestedCapabilities = normalizeCapabilities(input.requestedCapabilities as readonly string[] | null | undefined);
  const requestedProductionWorkflowCount = nonNegativeInteger(input.requestedProductionWorkflowCount);
  const requestedHostedProduction = input.requestedHostedProduction ?? requestedProductionWorkflowCount > 0;
  const requestedCustomerOperatedDeployment = input.requestedCustomerOperatedDeployment ?? false;
  const entitlement = input.entitlement ?? null;
  const workflowEntitlementAccess = input.workflowEntitlementAccess ?? null;
  const entitlementPresent = entitlement !== null;
  const workflowEntitlementPresent = workflowEntitlementAccess !== null &&
    workflowEntitlementAccess.status !== 'missing';
  const accessEnabled = entitlement?.accessEnabled ?? null;
  const entitlementPlan = normalizePlan(entitlement?.effectivePlanId ?? null);
  const workflowTier =
    workflowEntitlementAccess?.tier && isPlan(workflowEntitlementAccess.tier)
      ? workflowEntitlementAccess.tier
      : null;
  const billingStateRequired = requiresBillingState({
    requestedCapabilities,
    requestedProductionWorkflowCount,
    requestedHostedProduction,
    requestedCustomerOperatedDeployment,
  });
  const effectiveBillingPlanId = workflowEntitlementResolverConfigured
    ? workflowTier
    : entitlementResolverConfigured
      ? entitlementPlan
      : entitlementPlan ?? tenantPlanId;

  const noGoReasons = new Set<PolicyFoundryBillingEntitlementEnforcementNoGoReason>();
  if (requestedPlan !== null && !isPlan(requestedPlan)) {
    noGoReasons.add('requested-plan-unsupported');
  }
  if (effectiveBillingPlanId !== null && !isPlan(effectiveBillingPlanId)) {
    noGoReasons.add('billing-plan-unsupported');
  }
  if (entitlementResolverConfigured && !entitlementPresent && billingStateRequired) {
    noGoReasons.add('billing-entitlement-missing');
  }
  if (workflowEntitlementResolverConfigured && !workflowEntitlementPresent && billingStateRequired) {
    noGoReasons.add('billing-entitlement-missing');
  }
  if (entitlementPresent && accessEnabled === false && billingStateRequired) {
    noGoReasons.add('billing-access-disabled');
  }
  if (
    workflowEntitlementResolverConfigured &&
    workflowEntitlementAccess !== null &&
    workflowEntitlementAccess.action === 'block' &&
    billingStateRequired
  ) {
    noGoReasons.add('production-enforcement-not-entitled');
  }
  if (
    input.requestedPlanExplicit &&
    requestedPlanOutranksEntitled(requestedPlan, effectiveBillingPlanId)
  ) {
    noGoReasons.add('requested-plan-not-entitled');
  }
  if (requestedHostedProduction && (!isPlan(effectiveBillingPlanId) || PLAN_RANKS[effectiveBillingPlanId] < PLAN_RANKS['starter-workflow'])) {
    noGoReasons.add('production-enforcement-not-entitled');
  }
  if (requestedProductionWorkflowCount > 0 && (!isPlan(effectiveBillingPlanId) || PLAN_RANKS[effectiveBillingPlanId] < PLAN_RANKS['starter-workflow'])) {
    noGoReasons.add('production-enforcement-not-entitled');
  }
  if (requestedCustomerOperatedDeployment && effectiveBillingPlanId !== 'negotiated-deployment') {
    noGoReasons.add('customer-operated-not-entitled');
  }

  const sortedNoGoReasons = Object.freeze([...noGoReasons].sort());
  const commercialPlanForBoundary =
    (workflowEntitlementResolverConfigured && (!workflowEntitlementPresent || workflowEntitlementAccess?.action === 'block')) ||
    (entitlementResolverConfigured && (!entitlementPresent || accessEnabled === false))
      ? 'trial'
      : effectiveBillingPlanId ?? tenantPlanId ?? 'trial';

  return Object.freeze({
    version: POLICY_FOUNDRY_BILLING_ENTITLEMENT_ENFORCEMENT_VERSION,
    evaluatedAt: evaluatedAt.toISOString(),
    enforcementMode: entitlementResolverConfigured
      ? 'billing-provider-enforced'
      : 'tenant-context-only',
    entitlementResolverConfigured,
    entitlementPresent,
    provider: entitlement?.provider ?? null,
    entitlementStatus: entitlement?.status ?? null,
    accessEnabled,
    workflowEntitlementResolverConfigured,
    workflowEntitlementPresent,
    workflowEntitlementTier: workflowEntitlementAccess?.tier ?? null,
    workflowEntitlementStatus: workflowEntitlementAccess?.status ?? null,
    workflowEntitlementAction: workflowEntitlementAccess?.action ?? null,
    workflowEntitlementReasonCodes: Object.freeze([...(workflowEntitlementAccess?.reasonCodes ?? [])]),
    stripeSummaryUpdatedAt: entitlement?.stripeEntitlementSummaryUpdatedAt ?? null,
    requestedPlan,
    requestedPlanExplicit: Boolean(input.requestedPlanExplicit),
    tenantPlanId,
    effectiveBillingPlanId,
    commercialPlanForBoundary,
    requestedCapabilities,
    requestedProductionWorkflowCount,
    requestedHostedProduction,
    requestedCustomerOperatedDeployment,
    billingStateRequired,
    noGoReasons: sortedNoGoReasons,
    commercialCapabilitiesAllowed: sortedNoGoReasons.length === 0,
    safetyMinimumsRemainAvailable: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    entitlementDecisionAuthority: false,
    commercialAccessGate: true,
    rawPayloadStored: false,
    nextSafeStep: nextSafeStepFor(sortedNoGoReasons),
    limitation:
      'This gate enforces hosted commercial Policy Foundry access from billing-provider workflow entitlement state. It does not replace policy authority, activate production enforcement, or prove deployment readiness.',
  });
}
