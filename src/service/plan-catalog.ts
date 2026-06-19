/**
 * Hosted Plan Catalog - account evaluation access.
 *
 * Billing is intentionally not modeled here. Paid commercial packaging is
 * workflow-level and lives in workflow-entitlement-catalog.ts. This module only
 * preserves Trial account access plus legacy account-plan aliases needed by
 * existing tenant keys and operator/admin compatibility surfaces.
 */

export type HostedPlanId = 'trial';
export type LegacyHostedPlanId =
  | 'community'
  | 'developer'
  | 'starter'
  | 'pro'
  | 'scale'
  | 'enterprise';

export interface HostedPlanDefinition {
  id: HostedPlanId;
  displayName: string;
  description: string;
  defaultEvaluationDays: number | null;
  defaultMonthlyRunQuota: number | null;
  defaultPipelineRequestsPerWindow: number | null;
  defaultAsyncPendingJobsPerTenant: number | null;
  defaultAsyncActiveJobsPerTenant: number | null;
  defaultAsyncDispatchWeight: number | null;
  intendedFor: 'evaluation';
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

export const SELF_HOST_PLAN_ID: HostedPlanId = 'trial';
export const DEFAULT_HOSTED_PLAN_ID: HostedPlanId = 'trial';

const PLAN_CATALOG: HostedPlanDefinition[] = [
  {
    id: 'trial',
    displayName: 'Free Shadow Trial',
    description: 'Thirty-day account-level evaluation path before paid workflow entitlements are created.',
    defaultEvaluationDays: 30,
    defaultMonthlyRunQuota: 10_000,
    defaultPipelineRequestsPerWindow: 60,
    defaultAsyncPendingJobsPerTenant: 8,
    defaultAsyncActiveJobsPerTenant: 2,
    defaultAsyncDispatchWeight: 2,
    intendedFor: 'evaluation',
    defaultForHostedProvisioning: true,
  },
];

function canonicalHostedPlanId(planId: string | null | undefined): string | null {
  const trimmed = planId?.trim();
  if (!trimmed) return null;
  return [
    'community',
    'developer',
    'starter',
    'pro',
    'scale',
    'enterprise',
  ].includes(trimmed) ? 'trial' : trimmed;
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
      throw new Error(`Unknown planId '${requestedPlanId}'. Valid plans: ${validHostedPlanIds().join(', ')}. Legacy account plan aliases resolve to 'trial'.`);
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
