export const WORKFLOW_ENTITLEMENT_SCHEMA_VERSION =
  'attestor.workflow-entitlement.v1';

export const WORKFLOW_BILLING_TIER_IDS = [
  'pilot-workflow',
  'starter-workflow',
  'pro-workflow',
] as const;
export type WorkflowBillingTierId = typeof WORKFLOW_BILLING_TIER_IDS[number];

export const WORKFLOW_CONSEQUENCE_PACKS = [
  'money-movement',
  'data-movement',
  'authority-change',
  'external-communication',
  'operational-execution',
  'programmable-money',
] as const;
export type WorkflowConsequencePackId = typeof WORKFLOW_CONSEQUENCE_PACKS[number];

export const WORKFLOW_MODES = [
  'observe',
  'warn',
  'review-simulation',
  'scoped-rollout-review',
  'review',
  'enforce',
] as const;
export type WorkflowMode = typeof WORKFLOW_MODES[number];

export const WORKFLOW_CAPABILITIES = [
  'shadow-ingestion',
  'shadow-summary',
  'action-risk-inventory',
  'action-surface-profiler',
  'manifest-intake',
  'policy-candidate-discovery',
  'policy-foundry-readiness',
  'policy-twin-backtest',
  'active-questions',
  'counterexample-ledger',
  'candidate-red-team-replay',
  'coverage-score',
  'gate-planner',
  'schema-bound-candidate-registry',
  'authority-relationship-context',
  'review-only-patch-pack',
  'self-onboarding-packet',
  'outcome-feedback-loop',
  'hosted-review-surface',
  'hosted-ui-flow',
  'customer-pep-adoption-package',
  'protected-admission-proof-plan',
  'review-mode',
  'customer-gated-enforce-mode',
  'audit-export',
  'webhook-queue-handoff',
  'hosted-wizard-state',
  'live-downstream-replay-contract',
  'all-current-hosted-packs',
  'drift-policy-debt-detector',
  'production-smoke-probe',
  'rbac',
  'sso',
  'dual-control-activation',
] as const;
export type WorkflowCapability = typeof WORKFLOW_CAPABILITIES[number];

export const WORKFLOW_SAFETY_MINIMUMS = [
  'redaction',
  'proof-verification',
  'tenant-isolation',
  'fail-closed-semantics',
  'deterministic-controls',
  'offline-verifier-access',
  'replay-idempotency-safety',
  'approval-required-promotion',
  'shadow-never-auto-enforces',
] as const;
export type WorkflowSafetyMinimum = typeof WORKFLOW_SAFETY_MINIMUMS[number];

export interface TrialAccountEntitlementDefinition {
  readonly id: 'trial';
  readonly publicName: 'Trial';
  readonly priceCents: 0;
  readonly durationDays: 30;
  readonly admissionQuotaTotal: 10_000;
  readonly maxShadowSurfaces: 2;
  readonly maxAccountUsers: 2;
  readonly retentionDays: 14;
  readonly billingUnit: 'account-evaluation';
  readonly stripeSubscriptionItemRequired: false;
  readonly publicLaunchReady: false;
}

export interface WorkflowBillingTierDefinition {
  readonly id: WorkflowBillingTierId;
  readonly publicName: string;
  readonly billingUnit: 'workflow-subscription-item';
  readonly currency: 'usd';
  readonly interval: 'month';
  readonly unitAmountCents: number;
  readonly includedAdmissionsMonthly: number;
  readonly overageUnitAmountDecimal: string | null;
  readonly overageBehavior: 'hard-stop' | 'soft-overage';
  readonly basePriceEnvName: string;
  readonly overagePriceEnvName: string | null;
  readonly maxAccountUsers: number;
  readonly retentionDays: number;
  readonly packScope: 'single-selected-pack' | 'all-current-hosted-packs';
  readonly allowedModes: readonly WorkflowMode[];
  readonly includedCapabilities: readonly WorkflowCapability[];
  readonly safetyMinimums: typeof WORKFLOW_SAFETY_MINIMUMS;
  readonly customerGateRequiredForEnforce: true;
  readonly publicLaunchReady: false;
}

export interface WorkflowStripePriceSpec {
  readonly tierId: WorkflowBillingTierId | string;
  readonly envName: string;
  readonly priceId: string | null;
  readonly configured: boolean;
  readonly knownTier: boolean;
  readonly billable: boolean;
  readonly source: 'env' | 'unconfigured' | 'not_billable' | 'custom_unconfigured';
}

export interface WorkflowStripeOveragePriceSpec extends WorkflowStripePriceSpec {
  readonly meterEventName: string;
}

export const DEFAULT_WORKFLOW_STRIPE_OVERAGE_METER_EVENT_NAME =
  'attestor_admission_overage';

const pilotCapabilities: readonly WorkflowCapability[] = Object.freeze([
  'shadow-ingestion',
  'shadow-summary',
  'action-risk-inventory',
  'action-surface-profiler',
  'manifest-intake',
  'policy-candidate-discovery',
  'policy-foundry-readiness',
  'policy-twin-backtest',
  'active-questions',
  'counterexample-ledger',
  'candidate-red-team-replay',
  'coverage-score',
  'gate-planner',
  'schema-bound-candidate-registry',
  'authority-relationship-context',
  'review-only-patch-pack',
  'self-onboarding-packet',
  'outcome-feedback-loop',
  'hosted-review-surface',
  'hosted-ui-flow',
  'audit-export',
]);

const starterCapabilities: readonly WorkflowCapability[] = Object.freeze([
  ...pilotCapabilities,
  'customer-pep-adoption-package',
  'protected-admission-proof-plan',
  'review-mode',
  'customer-gated-enforce-mode',
  'webhook-queue-handoff',
  'hosted-wizard-state',
  'live-downstream-replay-contract',
]);

const proCapabilities: readonly WorkflowCapability[] = Object.freeze([
  ...starterCapabilities,
  'all-current-hosted-packs',
  'drift-policy-debt-detector',
  'production-smoke-probe',
  'rbac',
  'sso',
  'dual-control-activation',
]);

export const TRIAL_ACCOUNT_ENTITLEMENT: TrialAccountEntitlementDefinition =
  Object.freeze({
    id: 'trial',
    publicName: 'Trial',
    priceCents: 0,
    durationDays: 30,
    admissionQuotaTotal: 10_000,
    maxShadowSurfaces: 2,
    maxAccountUsers: 2,
    retentionDays: 14,
    billingUnit: 'account-evaluation',
    stripeSubscriptionItemRequired: false,
    publicLaunchReady: false,
  });

const WORKFLOW_TIER_DEFINITIONS: readonly WorkflowBillingTierDefinition[] =
  Object.freeze([
    Object.freeze({
      id: 'pilot-workflow',
      publicName: 'Pilot Workflow',
      billingUnit: 'workflow-subscription-item',
      currency: 'usd',
      interval: 'month',
      unitAmountCents: 9_900,
      includedAdmissionsMonthly: 15_000,
      overageUnitAmountDecimal: null,
      overageBehavior: 'hard-stop',
      basePriceEnvName: 'ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW',
      overagePriceEnvName: null,
      maxAccountUsers: 3,
      retentionDays: 30,
      packScope: 'single-selected-pack',
      allowedModes: [
        'observe',
        'warn',
        'review-simulation',
        'scoped-rollout-review',
      ] satisfies readonly WorkflowMode[],
      includedCapabilities: pilotCapabilities,
      safetyMinimums: WORKFLOW_SAFETY_MINIMUMS,
      customerGateRequiredForEnforce: true,
      publicLaunchReady: false,
    }),
    Object.freeze({
      id: 'starter-workflow',
      publicName: 'Starter Workflow',
      billingUnit: 'workflow-subscription-item',
      currency: 'usd',
      interval: 'month',
      unitAmountCents: 29_900,
      includedAdmissionsMonthly: 25_000,
      overageUnitAmountDecimal: '5',
      overageBehavior: 'soft-overage',
      basePriceEnvName: 'ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW',
      overagePriceEnvName: 'ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW',
      maxAccountUsers: 5,
      retentionDays: 90,
      packScope: 'single-selected-pack',
      allowedModes: ['observe', 'warn', 'review', 'enforce'] satisfies readonly WorkflowMode[],
      includedCapabilities: starterCapabilities,
      safetyMinimums: WORKFLOW_SAFETY_MINIMUMS,
      customerGateRequiredForEnforce: true,
      publicLaunchReady: false,
    }),
    Object.freeze({
      id: 'pro-workflow',
      publicName: 'Pro Workflow',
      billingUnit: 'workflow-subscription-item',
      currency: 'usd',
      interval: 'month',
      unitAmountCents: 99_900,
      includedAdmissionsMonthly: 250_000,
      overageUnitAmountDecimal: '2.5',
      overageBehavior: 'soft-overage',
      basePriceEnvName: 'ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW',
      overagePriceEnvName: 'ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW',
      maxAccountUsers: 25,
      retentionDays: 365,
      packScope: 'all-current-hosted-packs',
      allowedModes: ['observe', 'warn', 'review', 'enforce'] satisfies readonly WorkflowMode[],
      includedCapabilities: proCapabilities,
      safetyMinimums: WORKFLOW_SAFETY_MINIMUMS,
      customerGateRequiredForEnforce: true,
      publicLaunchReady: false,
    }),
  ]);

function tierSuffix(tierId: WorkflowBillingTierId): string {
  return tierId.replaceAll('-', '_').toUpperCase();
}

function normalizeEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function workflowStripeOverageMeterEventName(
  env: Record<string, string | undefined> = process.env,
): string {
  return normalizeEnvValue(env.ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME)
    ?? DEFAULT_WORKFLOW_STRIPE_OVERAGE_METER_EVENT_NAME;
}

export function isWorkflowBillingTierId(value: string): value is WorkflowBillingTierId {
  return (WORKFLOW_BILLING_TIER_IDS as readonly string[]).includes(value);
}

export function listWorkflowBillingTiers(): WorkflowBillingTierDefinition[] {
  return WORKFLOW_TIER_DEFINITIONS.map((tier) => ({
    ...tier,
    allowedModes: [...tier.allowedModes],
    includedCapabilities: [...tier.includedCapabilities],
    safetyMinimums: WORKFLOW_SAFETY_MINIMUMS,
  }));
}

export function listWorkflowBillingTierIds(): WorkflowBillingTierId[] {
  return WORKFLOW_TIER_DEFINITIONS.map((tier) => tier.id);
}

export function getWorkflowBillingTier(
  tierId: string | null | undefined,
): WorkflowBillingTierDefinition | null {
  const trimmed = tierId?.trim();
  if (!trimmed || !isWorkflowBillingTierId(trimmed)) return null;
  const tier = WORKFLOW_TIER_DEFINITIONS.find((entry) => entry.id === trimmed);
  return tier ? {
    ...tier,
    allowedModes: [...tier.allowedModes],
    includedCapabilities: [...tier.includedCapabilities],
    safetyMinimums: WORKFLOW_SAFETY_MINIMUMS,
  } : null;
}

export function workflowTierStripePriceEnvName(
  tierId: WorkflowBillingTierId,
): string {
  return `ATTESTOR_STRIPE_PRICE_${tierSuffix(tierId)}`;
}

export function workflowTierStripeOveragePriceEnvName(
  tierId: WorkflowBillingTierId,
): string {
  return `ATTESTOR_STRIPE_OVERAGE_PRICE_${tierSuffix(tierId)}`;
}

export function resolveWorkflowTierStripePrice(
  tierId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): WorkflowStripePriceSpec {
  const tier = getWorkflowBillingTier(tierId);
  if (!tier) {
    return {
      tierId: tierId?.trim() || '',
      envName: '',
      priceId: null,
      configured: false,
      knownTier: false,
      billable: false,
      source: 'custom_unconfigured',
    };
  }
  const priceId = normalizeEnvValue(env[tier.basePriceEnvName]);
  return {
    tierId: tier.id,
    envName: tier.basePriceEnvName,
    priceId,
    configured: priceId !== null,
    knownTier: true,
    billable: true,
    source: priceId ? 'env' : 'unconfigured',
  };
}

export function resolveWorkflowTierStripeOveragePrice(
  tierId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): WorkflowStripeOveragePriceSpec {
  const tier = getWorkflowBillingTier(tierId);
  const meterEventName = workflowStripeOverageMeterEventName(env);
  if (!tier) {
    return {
      tierId: tierId?.trim() || '',
      envName: '',
      priceId: null,
      configured: false,
      knownTier: false,
      billable: false,
      meterEventName,
      source: 'custom_unconfigured',
    };
  }
  if (!tier.overagePriceEnvName) {
    return {
      tierId: tier.id,
      envName: '',
      priceId: null,
      configured: false,
      knownTier: true,
      billable: false,
      meterEventName,
      source: 'not_billable',
    };
  }
  const priceId = normalizeEnvValue(env[tier.overagePriceEnvName]);
  return {
    tierId: tier.id,
    envName: tier.overagePriceEnvName,
    priceId,
    configured: priceId !== null,
    knownTier: true,
    billable: true,
    meterEventName,
    source: priceId ? 'env' : 'unconfigured',
  };
}

export function findWorkflowBillingTierByStripePriceId(
  priceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): WorkflowBillingTierDefinition | null {
  const resolvedPriceId = normalizeEnvValue(priceId ?? undefined);
  if (!resolvedPriceId) return null;
  for (const tier of WORKFLOW_TIER_DEFINITIONS) {
    if (resolveWorkflowTierStripePrice(tier.id, env).priceId === resolvedPriceId) {
      return getWorkflowBillingTier(tier.id);
    }
    if (resolveWorkflowTierStripeOveragePrice(tier.id, env).priceId === resolvedPriceId) {
      return getWorkflowBillingTier(tier.id);
    }
  }
  return null;
}
