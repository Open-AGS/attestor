import type { TenantContext } from '../tenant-isolation.js';
import type { UsageContext } from '../usage-meter.js';

export type PipelineUsageTenant = Pick<
  TenantContext,
  'tenantId' | 'planId' | 'monthlyRunQuota'
>;

export interface PipelineUsageDecision {
  allowed: boolean;
  usage: UsageContext;
}

export interface PipelineBillingMeteringResult {
  provider: 'stripe';
  status: 'not_applicable' | 'skipped' | 'mock_recorded' | 'sent' | 'failed';
  reason: string | null;
  eventName: string | null;
  eventIdentifier: string | null;
  value: number;
  mock: boolean;
}

export interface PipelineUsageConsumption {
  usage: UsageContext;
  billingMetering: PipelineBillingMeteringResult | null;
}

export interface PipelineUsageService {
  check(tenant: PipelineUsageTenant): Promise<PipelineUsageDecision>;
  consume(tenant: PipelineUsageTenant): Promise<PipelineUsageConsumption>;
}

export interface PipelineUsageServiceDeps {
  checkQuota(
    tenantId: string,
    planId: string | null | undefined,
    quota: number | null | undefined,
  ): Promise<PipelineUsageDecision>;
  consumeRun(
    tenantId: string,
    planId: string | null | undefined,
    quota: number | null | undefined,
  ): Promise<UsageContext>;
  recordOverageMetering?(input: {
    tenant: PipelineUsageTenant;
    usage: UsageContext;
  }): Promise<PipelineBillingMeteringResult | null>;
}

export function createPipelineUsageService(deps: PipelineUsageServiceDeps): PipelineUsageService {
  return {
    check(tenant) {
      return deps.checkQuota(tenant.tenantId, tenant.planId, tenant.monthlyRunQuota);
    },

    async consume(tenant) {
      const usage = await deps.consumeRun(tenant.tenantId, tenant.planId, tenant.monthlyRunQuota);
      const billingMetering = usage.overage && usage.overageUnits > 0
        ? await deps.recordOverageMetering?.({ tenant, usage }) ?? null
        : null;
      return { usage, billingMetering };
    },
  };
}
