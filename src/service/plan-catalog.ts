/**
 * Hosted Plan Catalog — Single source of truth for monetizable hosted access.
 *
 * The catalog defines the small built-in plan set used by hosted onboarding,
 * quota defaults, and operator/admin surfaces. Self-hosted or externally
 * asserted tokens may still carry custom plan ids, but the managed hosted
 * shell should speak a consistent built-in vocabulary.
 */

export type HostedPlanId = 'developer' | 'trial' | 'starter' | 'pro' | 'scale' | 'enterprise';
export type LegacyHostedPlanId = 'community';

export interface HostedPlanDefinition {
  id: HostedPlanId;
  displayName: string;
  description: string;
  defaultEvaluationDays: number | null;
  defaultStripeTrialDays: number | null;
  defaultMonthlyRunQuota: number | null;
  defaultPipelineRequestsPerWindow: number | null;
  defaultAsyncPendingJobsPerTenant: number | null;
  defaultAsyncActiveJobsPerTenant: number | null;
  defaultAsyncDispatchWeight: number | null;
  intendedFor: 'evaluation' | 'hosted' | 'enterprise';
  defaultForHostedProvisioning: boolean;
}

export interface ResolvedPlanSpec {
  plan: HostedPlanDefinition | null;
  planId: string;
  monthlyRunQuota: number | null;
  knownPlan: boolean;
  quotaSource: 'override' | 'plan_default' | 'plan_unlimited' | 'custom_override' | 'custom_unlimited';
}

export interface PlanRateLimitSpec {
  planId: string;
  windowSeconds: number;
  requestsPerWindow: number | null;
  enforced: boolean;
  knownPlan: boolean;
  source: 'plan_default' | 'env_override' | 'custom_unlimited';
}

export interface PlanAsyncQueueSpec {
  planId: string;
  pendingJobsPerTenant: number | null;
  enforced: boolean;
  knownPlan: boolean;
  source: 'plan_default' | 'env_override' | 'custom_unlimited';
}

export interface PlanAsyncExecutionSpec {
  planId: string;
  activeJobsPerTenant: number | null;
  enforced: boolean;
  knownPlan: boolean;
  source: 'plan_default' | 'env_override' | 'custom_unlimited';
}

export interface PlanAsyncDispatchSpec {
  planId: string;
  dispatchWeight: number | null;
  dispatchWindowMs: number | null;
  enabled: boolean;
  knownPlan: boolean;
  baseIntervalMs: number;
  source: 'plan_default' | 'env_override' | 'custom_disabled';
}

export interface PlanStripePriceSpec {
  planId: string;
  priceId: string | null;
  configured: boolean;
  knownPlan: boolean;
  source: 'env' | 'unconfigured' | 'custom_unconfigured';
}

export interface PlanStripeOveragePriceSpec {
  planId: string;
  priceId: string | null;
  configured: boolean;
  knownPlan: boolean;
  billable: boolean;
  meterEventName: string;
  source: 'env' | 'unconfigured' | 'not_billable' | 'custom_unconfigured';
}

export interface PlanStripeTrialSpec {
  planId: string;
  trialDays: number | null;
  configured: boolean;
  knownPlan: boolean;
  source: 'plan_default' | 'env_override' | 'custom_unconfigured';
}

export interface PlanGenericAdmissionModeSpec {
  planId: string;
  mode: string;
  allowed: boolean;
  knownPlan: boolean;
  allowedModes: readonly string[];
  reasonCodes: readonly string[];
}

export interface PlanQuotaPolicySpec {
  planId: string;
  knownPlan: boolean;
  hardLimit: boolean;
  softOverage: boolean;
  source: 'evaluation_hard_limit' | 'paid_soft_overage' | 'custom_hard_limit';
}

export const SELF_HOST_PLAN_ID: HostedPlanId = 'developer';
export const DEFAULT_HOSTED_PLAN_ID: HostedPlanId = 'starter';
export const DEFAULT_STRIPE_OVERAGE_METER_EVENT_NAME = 'attestor_admission_overage';

const PLAN_CATALOG: HostedPlanDefinition[] = [
  {
    id: 'developer',
    displayName: 'Developer',
    description: 'Perpetual free evaluation path for local proof work and low-volume shadow or warn testing before a paid hosted plan is needed.',
    defaultEvaluationDays: null,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: 500,
    defaultPipelineRequestsPerWindow: 10,
    defaultAsyncPendingJobsPerTenant: 2,
    defaultAsyncActiveJobsPerTenant: 1,
    defaultAsyncDispatchWeight: 1,
    intendedFor: 'evaluation',
    defaultForHostedProvisioning: false,
  },
  {
    id: 'trial',
    displayName: 'Free Shadow Trial',
    description: 'Sixty-day shadow-mode onboarding path with Pro-like discovery headroom before the customer chooses Developer or a paid hosted plan.',
    defaultEvaluationDays: 60,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: 5_000,
    defaultPipelineRequestsPerWindow: 60,
    defaultAsyncPendingJobsPerTenant: 8,
    defaultAsyncActiveJobsPerTenant: 2,
    defaultAsyncDispatchWeight: 2,
    intendedFor: 'evaluation',
    defaultForHostedProvisioning: false,
  },
  {
    id: 'starter',
    displayName: 'Starter',
    description: 'Hosted API access for the first live high-consequence workflow, including enforce mode and account-plane billing without building the control layer yourself.',
    defaultEvaluationDays: null,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: 25_000,
    defaultPipelineRequestsPerWindow: 120,
    defaultAsyncPendingJobsPerTenant: 8,
    defaultAsyncActiveJobsPerTenant: 2,
    defaultAsyncDispatchWeight: 2,
    intendedFor: 'hosted',
    defaultForHostedProvisioning: true,
  },
  {
    id: 'pro',
    displayName: 'Pro',
    description: 'Growth-stage hosted API plan for repeated release, finance, crypto, or operational control use across multiple workflows or one business unit.',
    defaultEvaluationDays: null,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: 250_000,
    defaultPipelineRequestsPerWindow: 600,
    defaultAsyncPendingJobsPerTenant: 32,
    defaultAsyncActiveJobsPerTenant: 4,
    defaultAsyncDispatchWeight: 4,
    intendedFor: 'hosted',
    defaultForHostedProvisioning: false,
  },
  {
    id: 'scale',
    displayName: 'Scale',
    description: 'High-volume hosted plan for larger admission volume, stronger retention and support needs, and heavier integration posture.',
    defaultEvaluationDays: null,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: 1_000_000,
    defaultPipelineRequestsPerWindow: 3_000,
    defaultAsyncPendingJobsPerTenant: 128,
    defaultAsyncActiveJobsPerTenant: 16,
    defaultAsyncDispatchWeight: 8,
    intendedFor: 'hosted',
    defaultForHostedProvisioning: false,
  },
  {
    id: 'enterprise',
    displayName: 'Enterprise',
    description: 'Hosted enterprise or customer-operated deployment plan for regulated reporting environments, higher-scale control surfaces, or negotiated deployment boundaries.',
    defaultEvaluationDays: null,
    defaultStripeTrialDays: null,
    defaultMonthlyRunQuota: null,
    defaultPipelineRequestsPerWindow: 10_000,
    defaultAsyncPendingJobsPerTenant: 256,
    defaultAsyncActiveJobsPerTenant: 32,
    defaultAsyncDispatchWeight: 16,
    intendedFor: 'enterprise',
    defaultForHostedProvisioning: false,
  },
];

function canonicalHostedPlanId(planId: string | null | undefined): string | null {
  const trimmed = planId?.trim();
  if (!trimmed) return null;
  return trimmed === 'community' ? 'developer' : trimmed;
}

function normalizeQuota(quota: number | null | undefined): number | null {
  if (typeof quota !== 'number' || !Number.isInteger(quota) || quota < 0) return null;
  return quota;
}

function normalizeRateLimit(limit: number | null | undefined): number | null {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) return null;
  return limit;
}

function envOverrideNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_RATE_LIMIT_${planId.toUpperCase()}_REQUESTS`;
}

function asyncPendingEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_ASYNC_PENDING_${planId.toUpperCase()}_JOBS`;
}

function asyncActiveEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_ASYNC_ACTIVE_${planId.toUpperCase()}_JOBS`;
}

function asyncDispatchWeightEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_ASYNC_DISPATCH_${planId.toUpperCase()}_WEIGHT`;
}

function stripePriceEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_STRIPE_PRICE_${planId.toUpperCase()}`;
}

function stripeOveragePriceEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_STRIPE_OVERAGE_PRICE_${planId.toUpperCase()}`;
}

function stripeTrialEnvNameForPlan(planId: HostedPlanId): string {
  return `ATTESTOR_STRIPE_${planId.toUpperCase()}_TRIAL_DAYS`;
}

function normalizeTrialDays(days: number | null | undefined): number | null {
  if (typeof days !== 'number' || !Number.isInteger(days) || days <= 0) return null;
  return days;
}

export function defaultRateLimitWindowSeconds(): number {
  const raw = Number.parseInt(process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS ?? '60', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

export function defaultAsyncDispatchBaseIntervalMs(): number {
  const raw = Number.parseInt(process.env.ATTESTOR_ASYNC_DISPATCH_BASE_INTERVAL_MS ?? '600', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 600;
}

export function listHostedPlans(): HostedPlanDefinition[] {
  return PLAN_CATALOG.map((plan) => ({ ...plan }));
}

export function validHostedPlanIds(): HostedPlanId[] {
  return PLAN_CATALOG.map((plan) => plan.id);
}

export function getHostedPlan(planId: string | null | undefined): HostedPlanDefinition | null {
  const canonicalPlanId = canonicalHostedPlanId(planId);
  if (!canonicalPlanId) return null;
  return PLAN_CATALOG.find((plan) => plan.id === canonicalPlanId) ?? null;
}

export function resolvePlanGenericAdmissionMode(
  planId: string | null | undefined,
  mode: string,
): PlanGenericAdmissionModeSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);
  const allowedModes =
    plan?.intendedFor === 'evaluation'
      ? Object.freeze(['observe', 'warn'])
      : Object.freeze(['observe', 'warn', 'review', 'enforce']);
  const allowed = allowedModes.includes(mode);

  return {
    planId: plan?.id ?? resolvedPlanId,
    mode,
    allowed,
    knownPlan: plan !== null,
    allowedModes,
    reasonCodes: allowed
      ? []
      : [
        'plan-mode-restricted',
        `plan-${plan?.id ?? resolvedPlanId}`,
        `mode-${mode}`,
      ],
  };
}

export function resolvePlanQuotaPolicy(planId: string | null | undefined): PlanQuotaPolicySpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      knownPlan: false,
      hardLimit: true,
      softOverage: false,
      source: 'custom_hard_limit',
    };
  }

  if (plan.intendedFor === 'evaluation') {
    return {
      planId: plan.id,
      knownPlan: true,
      hardLimit: true,
      softOverage: false,
      source: 'evaluation_hard_limit',
    };
  }

  return {
    planId: plan.id,
    knownPlan: true,
    hardLimit: false,
    softOverage: true,
    source: 'paid_soft_overage',
  };
}

export function resolvePlanRateLimit(planId: string | null | undefined): PlanRateLimitSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);
  const windowSeconds = defaultRateLimitWindowSeconds();

  if (!plan) {
    return {
      planId: resolvedPlanId,
      windowSeconds,
      requestsPerWindow: null,
      enforced: false,
      knownPlan: false,
      source: 'custom_unlimited',
    };
  }

  const envOverride = normalizeRateLimit(
    Number.parseInt(process.env[envOverrideNameForPlan(plan.id)] ?? '', 10),
  );
  const requestsPerWindow = envOverride ?? plan.defaultPipelineRequestsPerWindow;

  return {
    planId: plan.id,
    windowSeconds,
    requestsPerWindow,
    enforced: requestsPerWindow !== null,
    knownPlan: true,
    source: envOverride !== null ? 'env_override' : 'plan_default',
  };
}

export function resolvePlanAsyncQueue(planId: string | null | undefined): PlanAsyncQueueSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      pendingJobsPerTenant: null,
      enforced: false,
      knownPlan: false,
      source: 'custom_unlimited',
    };
  }

  const rawOverride = process.env[asyncPendingEnvNameForPlan(plan.id)]?.trim() ?? '';
  const parsedOverride = rawOverride ? normalizeRateLimit(Number.parseInt(rawOverride, 10)) : null;
  const pendingJobsPerTenant = parsedOverride ?? plan.defaultAsyncPendingJobsPerTenant;

  return {
    planId: plan.id,
    pendingJobsPerTenant,
    enforced: pendingJobsPerTenant !== null,
    knownPlan: true,
    source: parsedOverride !== null ? 'env_override' : 'plan_default',
  };
}

export function resolvePlanAsyncExecution(planId: string | null | undefined): PlanAsyncExecutionSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      activeJobsPerTenant: null,
      enforced: false,
      knownPlan: false,
      source: 'custom_unlimited',
    };
  }

  const rawOverride = process.env[asyncActiveEnvNameForPlan(plan.id)]?.trim() ?? '';
  const parsedOverride = rawOverride ? normalizeRateLimit(Number.parseInt(rawOverride, 10)) : null;
  const activeJobsPerTenant = parsedOverride ?? plan.defaultAsyncActiveJobsPerTenant;

  return {
    planId: plan.id,
    activeJobsPerTenant,
    enforced: activeJobsPerTenant !== null,
    knownPlan: true,
    source: parsedOverride !== null ? 'env_override' : 'plan_default',
  };
}

export function resolvePlanAsyncDispatch(planId: string | null | undefined): PlanAsyncDispatchSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);
  const baseIntervalMs = defaultAsyncDispatchBaseIntervalMs();

  if (!plan) {
    return {
      planId: resolvedPlanId,
      dispatchWeight: null,
      dispatchWindowMs: null,
      enabled: false,
      knownPlan: false,
      baseIntervalMs,
      source: 'custom_disabled',
    };
  }

  const rawOverride = process.env[asyncDispatchWeightEnvNameForPlan(plan.id)]?.trim() ?? '';
  const parsedOverride = rawOverride ? normalizeRateLimit(Number.parseInt(rawOverride, 10)) : null;
  const dispatchWeight = parsedOverride ?? plan.defaultAsyncDispatchWeight;
  const dispatchWindowMs = dispatchWeight === null ? null : Math.max(50, Math.floor(baseIntervalMs / dispatchWeight));

  return {
    planId: plan.id,
    dispatchWeight,
    dispatchWindowMs,
    enabled: dispatchWeight !== null,
    knownPlan: true,
    baseIntervalMs,
    source: parsedOverride !== null ? 'env_override' : 'plan_default',
  };
}

export function resolvePlanStripePrice(planId: string | null | undefined): PlanStripePriceSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      priceId: null,
      configured: false,
      knownPlan: false,
      source: 'custom_unconfigured',
    };
  }

  if (plan.intendedFor === 'evaluation') {
    return {
      planId: plan.id,
      priceId: null,
      configured: false,
      knownPlan: true,
      source: 'unconfigured',
    };
  }

  const priceId = process.env[stripePriceEnvNameForPlan(plan.id)]?.trim() || null;
  return {
    planId: plan.id,
    priceId,
    configured: Boolean(priceId),
    knownPlan: true,
    source: priceId ? 'env' : 'unconfigured',
  };
}

export function stripeOverageMeterEventName(env: Record<string, string | undefined> = process.env): string {
  const configured = env.ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME?.trim();
  return configured || DEFAULT_STRIPE_OVERAGE_METER_EVENT_NAME;
}

export function resolvePlanStripeOveragePrice(
  planId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): PlanStripeOveragePriceSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);
  const meterEventName = stripeOverageMeterEventName(env);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      priceId: null,
      configured: false,
      knownPlan: false,
      billable: false,
      meterEventName,
      source: 'custom_unconfigured',
    };
  }

  if (plan.intendedFor !== 'hosted') {
    return {
      planId: plan.id,
      priceId: null,
      configured: false,
      knownPlan: true,
      billable: false,
      meterEventName,
      source: 'not_billable',
    };
  }

  const priceId = env[stripeOveragePriceEnvNameForPlan(plan.id)]?.trim() || null;
  return {
    planId: plan.id,
    priceId,
    configured: Boolean(priceId),
    knownPlan: true,
    billable: true,
    meterEventName,
    source: priceId ? 'env' : 'unconfigured',
  };
}

export function resolvePlanStripeTrialDays(planId: string | null | undefined): PlanStripeTrialSpec {
  const resolvedPlanId = canonicalHostedPlanId(planId) || SELF_HOST_PLAN_ID;
  const plan = getHostedPlan(resolvedPlanId);

  if (!plan) {
    return {
      planId: resolvedPlanId,
      trialDays: null,
      configured: false,
      knownPlan: false,
      source: 'custom_unconfigured',
    };
  }

  const rawOverride = process.env[stripeTrialEnvNameForPlan(plan.id)]?.trim() ?? '';
  const parsedOverride = rawOverride ? normalizeTrialDays(Number.parseInt(rawOverride, 10)) : null;
  const trialDays = parsedOverride ?? plan.defaultStripeTrialDays;

  return {
    planId: plan.id,
    trialDays,
    configured: trialDays !== null,
    knownPlan: true,
    source: parsedOverride !== null ? 'env_override' : 'plan_default',
  };
}

export function findHostedPlanByStripePriceId(priceId: string | null | undefined): HostedPlanDefinition | null {
  const resolvedPriceId = priceId?.trim();
  if (!resolvedPriceId) return null;
  for (const plan of PLAN_CATALOG) {
    if (resolvePlanStripePrice(plan.id).priceId === resolvedPriceId) {
      return { ...plan };
    }
  }
  return null;
}

export function resolvePlanSpec(options?: {
  planId?: string | null;
  monthlyRunQuota?: number | null;
  defaultPlanId?: HostedPlanId;
  allowCustomPlan?: boolean;
}): ResolvedPlanSpec {
  const requestedPlanId = canonicalHostedPlanId(options?.planId) || options?.defaultPlanId || SELF_HOST_PLAN_ID;
  const overrideQuota = normalizeQuota(options?.monthlyRunQuota);
  const plan = getHostedPlan(requestedPlanId);

  if (!plan) {
    if (!options?.allowCustomPlan) {
      throw new Error(`Unknown planId '${requestedPlanId}'. Valid plans: ${validHostedPlanIds().join(', ')}. Legacy alias 'community' resolves to 'developer'.`);
    }
    return {
      plan: null,
      planId: requestedPlanId,
      monthlyRunQuota: overrideQuota,
      knownPlan: false,
      quotaSource: overrideQuota === null ? 'custom_unlimited' : 'custom_override',
    };
  }

  if (overrideQuota !== null) {
    return {
      plan,
      planId: plan.id,
      monthlyRunQuota: overrideQuota,
      knownPlan: true,
      quotaSource: 'override',
    };
  }

  return {
    plan,
    planId: plan.id,
    monthlyRunQuota: plan.defaultMonthlyRunQuota,
    knownPlan: true,
    quotaSource: plan.defaultMonthlyRunQuota === null ? 'plan_unlimited' : 'plan_default',
  };
}
