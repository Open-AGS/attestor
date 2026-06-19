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
  withUsageLedger('trial-hard-quota', () => {
    const initial = canConsumePipelineRun('tenant_trial', 'trial', 1);
    equal(initial.allowed, true, 'Usage overage policy: Trial starts under quota');
    equal(initial.usage.enforced, true, 'Usage overage policy: Trial quota is enforced');
    equal(initial.usage.hardLimit, true, 'Usage overage policy: Trial quota is a hard limit');
    equal(initial.usage.overage, false, 'Usage overage policy: Trial starts outside overage');

    const consumed = consumePipelineRun('tenant_trial', 'trial', 1);
    equal(consumed.used, 1, 'Usage overage policy: Trial first run is counted');
    equal(consumed.remaining, 0, 'Usage overage policy: Trial remaining quota reaches zero');
    equal(consumed.overage, false, 'Usage overage policy: Trial exact quota is not overage');

    const exhausted = canConsumePipelineRun('tenant_trial', 'trial', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: Trial is blocked at quota');
    equal(exhausted.usage.enforced, true, 'Usage overage policy: Trial exhausted quota stays enforced');
  });
}

function testLegacyAliasesUseTrialHardLimit(): void {
  withUsageLedger('community-hard-quota', () => {
    consumePipelineRun('tenant_community', 'community', 1);
    const exhausted = canConsumePipelineRun('tenant_community', 'community', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: legacy Community alias is hard-limited');
    equal(exhausted.usage.planId, 'trial', 'Usage overage policy: legacy Community reports canonical Trial plan');
    equal(exhausted.usage.hardLimit, true, 'Usage overage policy: legacy Community uses Trial hard limit');
  });
  withUsageLedger('developer-alias-hard-quota', () => {
    consumePipelineRun('tenant_developer_alias', 'developer', 1);
    const exhausted = canConsumePipelineRun('tenant_developer_alias', 'developer', 1);
    equal(exhausted.allowed, false, 'Usage overage policy: legacy Developer alias is hard-limited');
    equal(exhausted.usage.planId, 'trial', 'Usage overage policy: legacy Developer alias reports canonical Trial plan');
  });
}

function testLegacyPaidPlanAliasesUseTrialHardLimit(): void {
  withUsageLedger('legacy-paid-alias-hard-limit', () => {
    consumePipelineRun('tenant_pro', 'pro', 1);
    const atQuota = canConsumePipelineRun('tenant_pro', 'pro', 1);
    equal(atQuota.allowed, false, 'Usage overage policy: legacy Pro account plan alias is blocked at Trial quota');
    equal(atQuota.usage.planId, 'trial', 'Usage overage policy: legacy Pro account plan reports canonical Trial plan');
    equal(atQuota.usage.enforced, true, 'Usage overage policy: legacy Pro account plan uses enforced Trial quota');
    equal(atQuota.usage.hardLimit, true, 'Usage overage policy: legacy Pro account plan is a hard stop');
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
testLegacyAliasesUseTrialHardLimit();
testLegacyPaidPlanAliasesUseTrialHardLimit();
testCustomQuotaRemainsHardLimited();

console.log(`Usage meter overage policy tests: ${passed} passed, 0 failed`);
