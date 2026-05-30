import {
  WORKFLOW_ENTITLEMENT_SCHEMA_VERSION,
  getWorkflowBillingTier,
  type WorkflowBillingTierId,
  type WorkflowCapability,
  type WorkflowConsequencePackId,
  type WorkflowMode,
} from './workflow-entitlement-catalog.js';

export const WORKFLOW_ENTITLEMENT_ACCESS_VERSION =
  'attestor.workflow-entitlement-access.v1';

export const WORKFLOW_ENTITLEMENT_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
] as const;
export type WorkflowEntitlementStatus =
  typeof WORKFLOW_ENTITLEMENT_STATUSES[number];

export const WORKFLOW_ENTITLEMENT_REASON_CODES = [
  'workflow-id-required',
  'workflow-entitlement-missing',
  'workflow-entitlement-workflow-mismatch',
  'workflow-tier-unsupported',
  'workflow-status-inactive',
  'workflow-status-trialing-not-enabled',
  'workflow-status-past-due',
  'workflow-status-past-due-grace-review-only',
  'workflow-mode-not-in-tier',
  'workflow-capability-not-in-tier',
  'workflow-pack-not-in-tier',
  'customer-gate-proof-required',
  'billing-metadata-incomplete',
] as const;
export type WorkflowEntitlementReasonCode =
  typeof WORKFLOW_ENTITLEMENT_REASON_CODES[number];

export interface WorkflowEntitlementRecord {
  readonly schemaVersion?: typeof WORKFLOW_ENTITLEMENT_SCHEMA_VERSION;
  readonly workflowId: string;
  readonly accountId?: string | null;
  readonly tenantId?: string | null;
  readonly tier: WorkflowBillingTierId | string;
  readonly status: WorkflowEntitlementStatus;
  readonly stripeCustomerId?: string | null;
  readonly stripeSubscriptionId?: string | null;
  readonly stripeSubscriptionItemId?: string | null;
  readonly stripePriceId?: string | null;
  readonly stripeOveragePriceId?: string | null;
  readonly consequencePack: WorkflowConsequencePackId | string;
  readonly downstreamSystemRefDigest?: string | null;
  readonly policyGatePathRefDigest?: string | null;
  readonly includedAdmissionsMonthly?: number | null;
  readonly monthlyAdmissionsUsed?: number | null;
  readonly currentPeriodStart?: string | null;
  readonly currentPeriodEnd?: string | null;
  readonly customerGateProofPresent?: boolean | null;
}

export interface EvaluateWorkflowEntitlementAccessInput {
  readonly workflowId?: string | null;
  readonly entitlement?: WorkflowEntitlementRecord | null;
  readonly requestedMode: WorkflowMode | string;
  readonly requestedCapability?: WorkflowCapability | string | null;
  readonly requestedConsequencePack?: WorkflowConsequencePackId | string | null;
  readonly customerGateProofPresent?: boolean | null;
  readonly allowStripeTrialingEntitlements?: boolean | null;
  readonly pastDueGraceActive?: boolean | null;
}

export interface WorkflowEntitlementAccessDecision {
  readonly version: typeof WORKFLOW_ENTITLEMENT_ACCESS_VERSION;
  readonly schemaVersion: typeof WORKFLOW_ENTITLEMENT_SCHEMA_VERSION;
  readonly workflowId: string | null;
  readonly tier: WorkflowBillingTierId | 'unsupported' | null;
  readonly status: WorkflowEntitlementStatus | 'missing' | null;
  readonly allowed: boolean;
  readonly action: 'allow' | 'review-only' | 'block';
  readonly reasonCodes: readonly WorkflowEntitlementReasonCode[];
  readonly allowedModes: readonly WorkflowMode[];
  readonly allowedCapabilities: readonly WorkflowCapability[];
  readonly includedAdmissionsMonthly: number | null;
  readonly overageUnitAmountDecimal: string | null;
  readonly customerGateRequiredForEnforce: boolean;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly entitlementDecisionAuthority: false;
  readonly billingProviderStateRequiredForPaidFeatures: true;
  readonly safetyMinimumsPaidOnlyAllowed: false;
  readonly limitation: string;
}

function normalizeId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function uniqueReasons(
  reasons: readonly WorkflowEntitlementReasonCode[],
): readonly WorkflowEntitlementReasonCode[] {
  return Object.freeze([...new Set(reasons)].sort());
}

function hasStripeSubscriptionItemBinding(
  entitlement: WorkflowEntitlementRecord,
): boolean {
  return Boolean(
    normalizeId(entitlement.stripeSubscriptionItemId) &&
    normalizeId(entitlement.stripePriceId),
  );
}

function decision(input: {
  readonly workflowId: string | null;
  readonly tier: WorkflowBillingTierId | 'unsupported' | null;
  readonly status: WorkflowEntitlementStatus | 'missing' | null;
  readonly allowed: boolean;
  readonly action: 'allow' | 'review-only' | 'block';
  readonly reasonCodes: readonly WorkflowEntitlementReasonCode[];
  readonly allowedModes?: readonly WorkflowMode[];
  readonly allowedCapabilities?: readonly WorkflowCapability[];
  readonly includedAdmissionsMonthly?: number | null;
  readonly overageUnitAmountDecimal?: string | null;
  readonly customerGateRequiredForEnforce?: boolean;
}): WorkflowEntitlementAccessDecision {
  return Object.freeze({
    version: WORKFLOW_ENTITLEMENT_ACCESS_VERSION,
    schemaVersion: WORKFLOW_ENTITLEMENT_SCHEMA_VERSION,
    workflowId: input.workflowId,
    tier: input.tier,
    status: input.status,
    allowed: input.allowed,
    action: input.action,
    reasonCodes: uniqueReasons(input.reasonCodes),
    allowedModes: Object.freeze([...(input.allowedModes ?? [])]),
    allowedCapabilities: Object.freeze([...(input.allowedCapabilities ?? [])]),
    includedAdmissionsMonthly: input.includedAdmissionsMonthly ?? null,
    overageUnitAmountDecimal: input.overageUnitAmountDecimal ?? null,
    customerGateRequiredForEnforce: input.customerGateRequiredForEnforce ?? true,
    productionReady: false,
    activatesEnforcement: false,
    entitlementDecisionAuthority: false,
    billingProviderStateRequiredForPaidFeatures: true,
    safetyMinimumsPaidOnlyAllowed: false,
    limitation:
      'Workflow entitlement access is billing and capability context only. It does not grant policy authority, deploy a customer gate, prove customer PEP no-bypass, or prove production readiness.',
  });
}

export function evaluateWorkflowEntitlementAccess(
  input: EvaluateWorkflowEntitlementAccessInput,
): WorkflowEntitlementAccessDecision {
  const requestedWorkflowId = normalizeId(input.workflowId);
  if (!requestedWorkflowId) {
    return decision({
      workflowId: null,
      tier: null,
      status: null,
      allowed: false,
      action: 'block',
      reasonCodes: ['workflow-id-required'],
    });
  }

  const entitlement = input.entitlement ?? null;
  if (!entitlement) {
    return decision({
      workflowId: requestedWorkflowId,
      tier: null,
      status: 'missing',
      allowed: false,
      action: 'block',
      reasonCodes: ['workflow-entitlement-missing'],
    });
  }

  const tier = getWorkflowBillingTier(entitlement.tier);
  if (!tier) {
    return decision({
      workflowId: requestedWorkflowId,
      tier: 'unsupported',
      status: entitlement.status,
      allowed: false,
      action: 'block',
      reasonCodes: ['workflow-tier-unsupported'],
    });
  }

  const reasons: WorkflowEntitlementReasonCode[] = [];
  const entitlementWorkflowId = normalizeId(entitlement.workflowId);
  if (entitlementWorkflowId !== requestedWorkflowId) {
    reasons.push('workflow-entitlement-workflow-mismatch');
  }
  if (!hasStripeSubscriptionItemBinding(entitlement)) {
    reasons.push('billing-metadata-incomplete');
  }

  const requestedMode = input.requestedMode;
  const modeAllowed = (tier.allowedModes as readonly string[]).includes(requestedMode);
  if (!modeAllowed) {
    reasons.push('workflow-mode-not-in-tier');
  }

  const requestedCapability = normalizeId(input.requestedCapability);
  if (
    requestedCapability &&
    !(tier.includedCapabilities as readonly string[]).includes(requestedCapability)
  ) {
    reasons.push('workflow-capability-not-in-tier');
  }

  const requestedPack = normalizeId(input.requestedConsequencePack);
  const entitlementPack = normalizeId(entitlement.consequencePack);
  if (
    tier.packScope === 'single-selected-pack' &&
    requestedPack &&
    entitlementPack !== requestedPack
  ) {
    reasons.push('workflow-pack-not-in-tier');
  }

  const customerGateProofPresent =
    input.customerGateProofPresent === true ||
    entitlement.customerGateProofPresent === true;
  if (
    requestedMode === 'enforce' &&
    tier.customerGateRequiredForEnforce &&
    !customerGateProofPresent
  ) {
    reasons.push('customer-gate-proof-required');
  }

  let action: 'allow' | 'review-only' | 'block' = 'allow';
  if (entitlement.status === 'trialing' && input.allowStripeTrialingEntitlements !== true) {
    reasons.push('workflow-status-trialing-not-enabled');
  } else if (entitlement.status === 'past_due') {
    if (input.pastDueGraceActive === true && requestedMode !== 'enforce') {
      action = 'review-only';
      reasons.push('workflow-status-past-due-grace-review-only');
    } else {
      reasons.push('workflow-status-past-due');
    }
  } else if (
    entitlement.status === 'canceled' ||
    entitlement.status === 'incomplete'
  ) {
    reasons.push('workflow-status-inactive');
  }

  const blockingReasons = reasons.filter(
    (reason) => reason !== 'workflow-status-past-due-grace-review-only',
  );
  const allowed = blockingReasons.length === 0;

  return decision({
    workflowId: requestedWorkflowId,
    tier: tier.id,
    status: entitlement.status,
    allowed,
    action: allowed ? action : 'block',
    reasonCodes: reasons,
    allowedModes: tier.allowedModes,
    allowedCapabilities: tier.includedCapabilities,
    includedAdmissionsMonthly: tier.includedAdmissionsMonthly,
    overageUnitAmountDecimal: tier.overageUnitAmountDecimal,
    customerGateRequiredForEnforce: tier.customerGateRequiredForEnforce,
  });
}
