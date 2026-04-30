/**
 * Tenant Admin CLI — Hosted API onboarding first slice
 *
 * Usage:
 *   npm run tenant:keys -- plans
 *   npm run tenant:keys -- list
 *   npm run tenant:keys -- issue --tenant-id tenant-pro --name Acme [--plan pro] [--quota 1000] [--out ./tenant.key]
 *   npm run tenant:keys -- rotate --id tkey_... [--plan pro] [--quota 1000] [--out ./tenant.key]
 *   npm run tenant:keys -- deactivate --id tkey_...
 *   npm run tenant:keys -- reactivate --id tkey_...
 *   npm run tenant:keys -- revoke --id tkey_...
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  tenantKeyStorePolicy,
  TenantKeyStoreError,
} from './tenant-key-store.js';
import {
  issueTenantApiKeyState,
  listTenantKeyRecordsState,
  recoverTenantApiKeyState,
  revokeTenantApiKeyState,
  rotateTenantApiKeyState,
  setTenantApiKeyStatusState,
} from './control-plane-store.js';
import { DEFAULT_HOSTED_PLAN_ID, listHostedPlans, resolvePlanRateLimit, resolvePlanStripePrice, validHostedPlanIds } from './plan-catalog.js';

function readFlag(flag: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

function printUsage(): void {
  console.log('Tenant Admin CLI');
  console.log('');
  console.log('Commands:');
  console.log('  plans');
  console.log('  list');
  console.log('  issue --tenant-id <id> --name <tenant name> [--plan <plan>] [--quota <n>] [--out <secret-file>]');
  console.log('  rotate --id <tenant-key-record-id> [--plan <plan>] [--quota <n>] [--out <secret-file>]');
  console.log('  deactivate --id <tenant-key-record-id>');
  console.log('  reactivate --id <tenant-key-record-id>');
  console.log('  recover --id <tenant-key-record-id> [--out <secret-file>]');
  console.log('  revoke --id <tenant-key-record-id>');
  console.log('');
  console.log('Secret material is never printed to the console. Use --out to write it once to a local file.');
}

function writeSecretFile(secret: string, outputPath: string): string {
  const absolutePath = resolve(outputPath);
  writeFileSync(absolutePath, `${secret}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return absolutePath;
}

function reportSecretDelivery(secret: string, outputPath: string | undefined, label: string): void {
  if (!outputPath) {
    console.log(`${label} generated but not printed. Use --out <secret-file> when the caller must receive it.`);
    return;
  }
  const absolutePath = writeSecretFile(secret, outputPath);
  console.log(`${label} written to ${absolutePath}. Treat the file as secret material and delete it after use.`);
}

async function main() {
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help') {
    printUsage();
    process.exit(0);
  }

  if (command === 'list') {
    const { records, path } = await listTenantKeyRecordsState();
    console.log(`Store: ${path}`);
    if (records.length === 0) {
      console.log('No tenant API keys issued yet.');
      return;
    }
    for (const record of records) {
      console.log([
        `id=${record.id}`,
        `tenant=${record.tenantId}`,
        `name="${record.tenantName}"`,
        `plan=${record.planId ?? 'community'}`,
        `quota=${record.monthlyRunQuota ?? 'unlimited'}`,
        'secret=redacted',
        `sealed=${record.recoveryEnvelope?.provider ?? '-'}`,
        `status=${record.status}`,
        `lastUsed=${record.lastUsedAt ?? 'never'}`,
        `rotatedFrom=${record.rotatedFromKeyId ?? '-'}`,
        `replacedBy=${record.supersededByKeyId ?? '-'}`,
      ].join(' | '));
    }
    return;
  }

  if (command === 'plans') {
    console.log(`Policy: maxActiveKeysPerTenant=${tenantKeyStorePolicy().maxActiveKeysPerTenant}`);
    console.log('Built-in hosted plans:');
    for (const plan of listHostedPlans()) {
      const rateLimit = resolvePlanRateLimit(plan.id);
      const stripePrice = resolvePlanStripePrice(plan.id);
      console.log([
        `id=${plan.id}`,
        `name="${plan.displayName}"`,
        `quota=${plan.defaultMonthlyRunQuota ?? 'unlimited'}`,
        `rateLimit=${rateLimit.requestsPerWindow ?? 'unlimited'}/${rateLimit.windowSeconds}s`,
        `stripePrice=${stripePrice.priceId ?? 'unconfigured'}`,
        `defaultForHostedProvisioning=${plan.defaultForHostedProvisioning}`,
        `scope=${plan.intendedFor}`,
      ].join(' | '));
    }
    return;
  }

  if (command === 'issue') {
    const tenantId = readFlag('--tenant-id') ?? readFlag('--tenant');
    const tenantName = readFlag('--name');
    const planId = readFlag('--plan') ?? DEFAULT_HOSTED_PLAN_ID;
    const quotaRaw = readFlag('--quota');
    const outputPath = readFlag('--out');
    const monthlyRunQuota = quotaRaw ? Number.parseInt(quotaRaw, 10) : null;

    if (!tenantId || !tenantName) {
      console.error('issue requires --tenant-id and --name');
      process.exit(1);
    }
    if (!validHostedPlanIds().includes(planId as any)) {
      console.error(`issue received unknown --plan '${planId}'. Valid plans: ${validHostedPlanIds().join(', ')}`);
      process.exit(1);
    }

    const { apiKey, record, path } = await issueTenantApiKeyState({
      tenantId,
      tenantName,
      planId,
      monthlyRunQuota: Number.isFinite(monthlyRunQuota as number) ? monthlyRunQuota : null,
    });

    console.log(`Store: ${path}`);
    console.log(`Issued tenant key record ${record.id}`);
    console.log(`Tenant: ${record.tenantId} (${record.tenantName})`);
    console.log(`Plan: ${record.planId ?? 'community'}`);
    console.log(`Quota: ${record.monthlyRunQuota ?? 'unlimited'}`);
    console.log('');
    console.log('Secret material generated.');
    reportSecretDelivery(apiKey, outputPath, 'API key');
    return;
  }

  if (command === 'rotate') {
    const id = readFlag('--id');
    const planId = readFlag('--plan');
    const quotaRaw = readFlag('--quota');
    const outputPath = readFlag('--out');
    const monthlyRunQuota = quotaRaw ? Number.parseInt(quotaRaw, 10) : null;
    if (!id) {
      console.error('rotate requires --id');
      process.exit(1);
    }
    if (planId && !validHostedPlanIds().includes(planId as any)) {
      console.error(`rotate received unknown --plan '${planId}'. Valid plans: ${validHostedPlanIds().join(', ')}`);
      process.exit(1);
    }
    const { apiKey, record, previousRecord, path } = await rotateTenantApiKeyState(id, {
      planId: planId ?? null,
      monthlyRunQuota: Number.isFinite(monthlyRunQuota as number) ? monthlyRunQuota : null,
    });
    console.log(`Store: ${path}`);
    console.log(`Rotated ${previousRecord.id} -> ${record.id} for tenant ${record.tenantId}`);
    console.log(`Plan: ${record.planId ?? 'community'}`);
    console.log(`Quota: ${record.monthlyRunQuota ?? 'unlimited'}`);
    console.log('');
    console.log('Replacement secret material generated.');
    reportSecretDelivery(apiKey, outputPath, 'New API key');
    return;
  }

  if (command === 'deactivate' || command === 'reactivate') {
    const id = readFlag('--id');
    if (!id) {
      console.error(`${command} requires --id`);
      process.exit(1);
    }
    const nextStatus = command === 'deactivate' ? 'inactive' : 'active';
    const { record, path } = await setTenantApiKeyStatusState(id, nextStatus);
    console.log(`Store: ${path}`);
    console.log(`${command}d ${record.id} -> status=${record.status}`);
    return;
  }

  if (command === 'recover') {
    const id = readFlag('--id');
    const outputPath = readFlag('--out');
    if (!id) {
      console.error('recover requires --id');
      process.exit(1);
    }
    const { record, apiKey, path } = await recoverTenantApiKeyState(id);
    console.log(`Store: ${path}`);
    console.log(`Recovered ${record.id} for tenant ${record.tenantId}`);
    console.log('');
    console.log('Break-glass secret material recovered.');
    reportSecretDelivery(apiKey, outputPath, 'Recovered API key');
    return;
  }

  if (command === 'revoke') {
    const id = readFlag('--id');
    if (!id) {
      console.error('revoke requires --id');
      process.exit(1);
    }
    const result = await revokeTenantApiKeyState(id);
    if (!result.record) {
      console.error(`Tenant key record not found: ${id}`);
      process.exit(1);
    }
    console.log(`Store: ${result.path}`);
    console.log(`Revoked ${result.record.id} for tenant ${result.record.tenantId}`);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  if (err instanceof TenantKeyStoreError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
