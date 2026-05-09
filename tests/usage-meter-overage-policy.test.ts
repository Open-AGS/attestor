import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canConsumePipelineRun,
  consumePipelineRun,
  getUsageContext,
  resetUsageMeter,
} from '../src/service/usage-meter.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function withUsageLedger<T>(name: string, action: () => T): T {
  const previousPath = process.env.ATTESTOR_USAGE_LEDGER_PATH;
  const root = mkdtempSync(join(tmpdir(), `attestor-${name}-`));
  process.env.ATTESTOR_USAGE_LEDGER_PATH = join(root, 'usage-ledger.json');
  resetUsageMeter();
  try {
    return action();
  } finally {
    resetUsageMeter();
    if (previousPath === undefined) {
      delete process.env.ATTESTOR_USAGE_LEDGER_PATH;
    } else {
      process.env.ATTESTOR_USAGE_LEDGER_PATH = previousPath;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

function testEvaluationPlansRemainHardLimited(): void {
  withUsageLedger('developer-hard-quota', () => {
    const initial = canConsumePipelineRun('tenant_dev', 'developer', 1);
    equal(initial.allowed, true, 'Usage overage policy: Developer starts under quota');
    equal(initial.usage.enforced, true, 'Usage overage policy: Developer quota is enforced');
    equal(initial.usage.hardLimit, true, 'Usage overage policy: Developer quota is a hard limit');
    equal(initial.usage.overage, false, 'Usage overage policy: Developer starts outside overage');

    const consumed = consumePipelineRun('tenant_dev', 'developer', 1);
    equal(consumed.used, 1, 'Usage overage policy: Developer first run is counted');
    equal(consumed.remaining, 0, 'Usage overage policy: Developer remaining quota reaches zero');
    equal(consumed.overage, false, 'Usage overage policy: Developer exact quota is not overage');

    const exhausted = canConsumePipelineRun('tenant_dev', 'developer', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: Developer is blocked at quota');
    equal(exhausted.usage.enforced, true, 'Usage overage policy: Developer exhausted quota stays enforced');
  });
}

function testLegacyCommunityAliasUsesDeveloperHardLimit(): void {
  withUsageLedger('community-hard-quota', () => {
    consumePipelineRun('tenant_community', 'community', 1);
    const exhausted = canConsumePipelineRun('tenant_community', 'community', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: legacy Community alias is hard-limited');
    equal(exhausted.usage.planId, 'developer', 'Usage overage policy: legacy Community reports canonical Developer plan');
    equal(exhausted.usage.hardLimit, true, 'Usage overage policy: legacy Community uses Developer hard limit');
  });
}

function testPaidPlansContinueIntoOverage(): void {
  withUsageLedger('paid-soft-overage', () => {
    consumePipelineRun('tenant_pro', 'pro', 1);
    const atQuota = canConsumePipelineRun('tenant_pro', 'pro', 1);
    equal(atQuota.allowed, true, 'Usage overage policy: Pro remains allowed at included quota');
    equal(atQuota.usage.enforced, false, 'Usage overage policy: Pro included quota is not a hard stop');
    equal(atQuota.usage.hardLimit, false, 'Usage overage policy: Pro reports soft overage posture');
    equal(atQuota.usage.overage, false, 'Usage overage policy: Pro is not overage until usage exceeds quota');

    const overage = consumePipelineRun('tenant_pro', 'pro', 1);
    equal(overage.used, 2, 'Usage overage policy: Pro over-quota run is counted');
    equal(overage.remaining, 0, 'Usage overage policy: Pro remaining quota does not go negative');
    equal(overage.overage, true, 'Usage overage policy: Pro usage is marked as overage');
    equal(overage.overageUnits, 1, 'Usage overage policy: Pro reports overage units');
  });
}

function testCustomQuotaRemainsHardLimited(): void {
  withUsageLedger('custom-hard-quota', () => {
    consumePipelineRun('tenant_custom', 'custom-plan', 1);
    const exhausted = canConsumePipelineRun('tenant_custom', 'custom-plan', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: unknown custom quota remains hard-limited');
    equal(exhausted.usage.hardLimit, true, 'Usage overage policy: unknown custom quota reports hard limit');

    const unlimited = getUsageContext('tenant_custom_unlimited', 'custom-plan', null);
    equal(unlimited.enforced, false, 'Usage overage policy: custom unlimited plan is not enforced');
    equal(unlimited.overage, false, 'Usage overage policy: custom unlimited plan is not overage');
  });
}

testEvaluationPlansRemainHardLimited();
testLegacyCommunityAliasUsesDeveloperHardLimit();
testPaidPlansContinueIntoOverage();
testCustomQuotaRemainsHardLimited();

console.log(`Usage meter overage policy tests: ${passed} passed, 0 failed`);
