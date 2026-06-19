import assert from 'node:assert/strict';
import {
  createPipelineUsageService,
  type PipelineUsageServiceDeps,
} from '../src/service/application/pipeline-usage-service.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import type { UsageContext } from '../src/service/usage-meter.js';

const tenant: TenantContext = {
  tenantId: 'tenant_123',
  tenantName: 'Acme',
  authenticatedAt: '2026-04-21T10:00:00.000Z',
  source: 'api_key',
  planId: 'trial',
  monthlyRunQuota: 10,
};

function usage(overrides: Partial<UsageContext> = {}): UsageContext {
  return {
    tenantId: 'tenant_123',
    planId: 'trial',
    meter: 'monthly_admission_runs',
    period: '2026-04',
    used: 3,
    quota: 10,
    remaining: 7,
    enforced: true,
    hardLimit: true,
    overage: false,
    overageUnits: 0,
    ...overrides,
  };
}

function createDeps(calls: string[]): PipelineUsageServiceDeps {
  return {
    async checkQuota(tenantId, planId, quota) {
      calls.push(`check:${tenantId}:${planId}:${quota}`);
      return {
        allowed: true,
        usage: usage(),
      };
    },
    async consumeRun(tenantId, planId, quota) {
      calls.push(`consume:${tenantId}:${planId}:${quota}`);
      return usage({ used: 4, remaining: 6 });
    },
  };
}

async function testUsageServiceChecksQuotaFromTenantContext(): Promise<void> {
  const calls: string[] = [];
  const service = createPipelineUsageService(createDeps(calls));

  const result = await service.check(tenant);

  assert.equal(result.allowed, true);
  assert.equal(result.usage.remaining, 7);
  assert.deepEqual(calls, ['check:tenant_123:trial:10']);
}

async function testUsageServiceConsumesRunFromTenantContext(): Promise<void> {
  const calls: string[] = [];
  const service = createPipelineUsageService(createDeps(calls));

  const result = await service.consume(tenant);

  assert.equal(result.usage.used, 4);
  assert.equal(result.usage.remaining, 6);
  assert.equal(result.billingMetering, null);
  assert.deepEqual(calls, ['consume:tenant_123:trial:10']);
}

async function testUsageServiceRecordsOverageMetering(): Promise<void> {
  const calls: string[] = [];
  const service = createPipelineUsageService({
    ...createDeps(calls),
    async consumeRun(tenantId, planId, quota) {
      calls.push(`consume:${tenantId}:${planId}:${quota}`);
      return usage({ used: 11, remaining: 0, enforced: false, hardLimit: false, overage: true, overageUnits: 1 });
    },
    async recordOverageMetering({ tenant: meteredTenant, usage: meteredUsage }) {
      calls.push(`meter:${meteredTenant.tenantId}:${meteredUsage.used}:${meteredUsage.overageUnits}`);
      return {
        provider: 'stripe',
        status: 'mock_recorded',
        reason: null,
        eventName: 'attestor_admission_overage',
        eventIdentifier: 'attestor_meter_event',
        value: 1,
        mock: true,
      };
    },
  });

  const result = await service.consume(tenant);

  assert.equal(result.usage.overage, true);
  assert.equal(result.billingMetering?.status, 'mock_recorded');
  assert.deepEqual(calls, ['consume:tenant_123:trial:10', 'meter:tenant_123:11:1']);
}

await testUsageServiceChecksQuotaFromTenantContext();
await testUsageServiceConsumesRunFromTenantContext();
await testUsageServiceRecordsOverageMetering();

console.log('Service pipeline usage service tests: 3 passed, 0 failed');
