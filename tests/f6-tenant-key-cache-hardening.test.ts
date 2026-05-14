import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractTenantContext,
  loadTenantKeysFromEnv,
  registerTenantKey,
  resetTenantEnvKeyCacheForTests,
  tenantEnvKeyCacheStatus,
} from '../src/service/tenant-isolation.js';
import { resetTenantKeyStoreForTests } from '../src/service/tenant-key-store.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const envKeys = [
  'ATTESTOR_TENANT_KEYS',
  'ATTESTOR_TENANT_KEY_STORE_PATH',
  'ATTESTOR_TENANT_KEY_ENV_CACHE_TTL_MS',
  'ATTESTOR_RUNTIME_PROFILE',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;
const tempDir = mkdtempSync(join(tmpdir(), 'attestor-f6-tenant-key-cache-'));
const tenantKeyStorePath = join(tempDir, 'tenant-keys.json');

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function resetCase(): void {
  restoreEnv();
  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = tenantKeyStorePath;
  delete process.env.ATTESTOR_TENANT_KEYS;
  delete process.env.ATTESTOR_TENANT_KEY_ENV_CACHE_TTL_MS;
  delete process.env.ATTESTOR_RUNTIME_PROFILE;
  resetTenantEnvKeyCacheForTests();
  resetTenantKeyStoreForTests();
}

async function main(): Promise<void> {
  try {
    resetCase();
    process.env.ATTESTOR_TENANT_KEYS = 'secret-a:tenant-a:Tenant A:pro:25';
    loadTenantKeysFromEnv();
    const status = tenantEnvKeyCacheStatus();
    equal(status.keyCount, 1, 'F6 tenant key cache: env cache loads one configured key');
    equal(
      status.lookupMaterial,
      'hashed-api-key',
      'F6 tenant key cache: env cache reports hashed lookup material',
    );
    equal(
      status.plaintextKeysStored,
      false,
      'F6 tenant key cache: env cache does not report plaintext key storage',
    );
    ok(status.loadedAt !== null, 'F6 tenant key cache: env cache exposes load timestamp');
    ok(status.expiresAt !== null, 'F6 tenant key cache: env cache exposes expiry timestamp');

    const tenant = await extractTenantContext('Bearer secret-a');
    equal(tenant?.tenantId, 'tenant-a', 'F6 tenant key cache: hashed env key resolves tenant');
    equal(tenant?.planId, 'pro', 'F6 tenant key cache: hashed env key preserves plan');
    equal(tenant?.monthlyRunQuota, 25, 'F6 tenant key cache: hashed env key preserves quota');

    resetCase();
    registerTenantKey('manual-secret', 'tenant-manual', 'Tenant Manual', 'team', 10);
    const manual = await extractTenantContext('Bearer manual-secret');
    equal(
      manual?.tenantId,
      'tenant-manual',
      'F6 tenant key cache: manual registration also uses hashed lookup',
    );

    resetCase();
    process.env.ATTESTOR_RUNTIME_PROFILE = 'production-shared';
    process.env.ATTESTOR_TENANT_KEYS = 'prod-secret:tenant-prod:Prod:pro:100';
    loadTenantKeysFromEnv();
    const disabled = tenantEnvKeyCacheStatus();
    equal(
      disabled.keyCount,
      0,
      'F6 tenant key cache: production-shared profile does not load per-pod env keys',
    );
    ok(
      disabled.disabledReason?.includes('production-shared'),
      'F6 tenant key cache: disabled status explains production-shared boundary',
    );
    const prodTenant = await extractTenantContext('Bearer prod-secret');
    equal(
      prodTenant,
      null,
      'F6 tenant key cache: production-shared profile refuses env-only tenant key lookup',
    );

    console.log(`F6 tenant key cache hardening tests: ${passed} passed, 0 failed`);
  } finally {
    resetCase();
    restoreEnv();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('F6 tenant key cache hardening tests failed:', error);
  process.exitCode = 1;
});
