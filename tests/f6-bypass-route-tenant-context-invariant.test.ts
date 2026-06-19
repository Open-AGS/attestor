import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  ANONYMOUS_TENANT_ID,
  TENANT_CONTEXT_VERIFIED_HEADER,
  getTenantContextFromHeaders,
  hasVerifiedTenantContext,
  resetTenantEnvKeyCacheForTests,
  tenantMiddleware,
} from '../src/service/tenant-isolation.js';
import {
  currentAccountAccess,
  currentTenant,
} from '../src/service/request-context.js';
import { resetTenantKeyStoreForTests } from '../src/service/tenant-key-store.js';

let passed = 0;

function ok(condition: boolean, msg: string): void {
  assert(condition, msg);
  passed += 1;
}

const envKeys = [
  'NODE_ENV',
  'ATTESTOR_HA_MODE',
  'ATTESTOR_PUBLIC_HOSTNAME',
  'ATTESTOR_PUBLIC_BASE_URL',
  'ATTESTOR_RUNTIME_PROFILE',
  'ATTESTOR_TENANT_KEYS',
  'ATTESTOR_TENANT_KEY_STORE_PATH',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;
const tempDir = mkdtempSync(join(tmpdir(), `attestor-bypass-tenant-context-${randomUUID()}-`));
const tenantKeyStorePath = join(tempDir, 'tenant-keys.json');

function restoreSavedEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function resetEnvForCase(): void {
  restoreSavedEnv();
  for (const key of envKeys) delete process.env[key];
  process.env.ATTESTOR_TENANT_KEY_STORE_PATH = tenantKeyStorePath;
  resetTenantEnvKeyCacheForTests();
  resetTenantKeyStoreForTests();
}

function createApp(): Hono {
  const app = new Hono();
  app.use('/api/*', tenantMiddleware());
  app.get('/api/v1/health', (c) => c.json({
    rawTenantId: c.req.raw.headers.get('x-attestor-tenant-id'),
    rawTenantSource: c.req.raw.headers.get('x-attestor-tenant-source'),
    verified: c.req.raw.headers.get(TENANT_CONTEXT_VERIFIED_HEADER),
    currentTenant: currentTenant(c),
    currentAccountAccess: currentAccountAccess(c),
  }));
  app.get('/api/v1/protected', (c) => c.json({
    rawTenantId: c.req.raw.headers.get('x-attestor-tenant-id'),
    rawTenantSource: c.req.raw.headers.get('x-attestor-tenant-source'),
    rawPlanId: c.req.raw.headers.get('x-attestor-plan-id'),
    verified: c.req.raw.headers.get(TENANT_CONTEXT_VERIFIED_HEADER),
    currentTenant: currentTenant(c),
    rawParserTenant: getTenantContextFromHeaders(c.req.raw.headers),
    currentAccountAccess: currentAccountAccess(c),
  }));
  return app;
}

async function readJson(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

const spoofedHeaders = {
  'x-attestor-tenant-id': 'victim-tenant',
  'x-attestor-tenant-source': 'api_key',
  'x-attestor-plan-id': 'enterprise',
  'x-attestor-monthly-run-quota': '999999',
  'x-attestor-account-id': 'acct_victim',
  'x-attestor-account-user-id': 'user_victim',
  'x-attestor-account-role': 'owner',
  'x-attestor-account-session-id': 'sess_victim',
};

async function run() {
  console.log('\nF6 Bypass Route Tenant Context Invariant Tests');

  try {
    resetEnvForCase();
    const app = createApp();

    {
      const response = await app.request('/api/v1/health', { headers: spoofedHeaders });
      const body = await readJson(response);
      ok(response.status === 200, 'bypass health route remains routable');
      ok(body.rawTenantId === null, 'bypass route strips client-supplied tenant id header');
      ok(body.rawTenantSource === null, 'bypass route strips client-supplied tenant source header');
      ok(body.verified === null, 'bypass route does not mark tenant context verified');
      ok(body.currentTenant?.tenantId === ANONYMOUS_TENANT_ID, 'currentTenant refuses unverified spoofed bypass tenant id');
      ok(body.currentTenant?.source === 'anonymous', 'currentTenant returns anonymous source on bypass routes');
      ok(body.currentAccountAccess === null, 'currentAccountAccess refuses unverified spoofed account headers');
    }

    {
      const response = await app.request('/api/v1/protected', { headers: spoofedHeaders });
      const body = await readJson(response);
      ok(response.status === 200, 'non-bypass route remains routable in local-dev anonymous mode');
      ok(body.rawTenantId === ANONYMOUS_TENANT_ID, 'non-bypass route overwrites spoofed tenant id');
      ok(body.rawTenantSource === 'anonymous', 'non-bypass route overwrites spoofed tenant source');
      ok(body.rawPlanId === 'trial', 'non-bypass route overwrites spoofed plan id');
      ok(body.verified === 'true', 'non-bypass route marks internally-written tenant context verified');
      ok(hasVerifiedTenantContext(new Headers({ [TENANT_CONTEXT_VERIFIED_HEADER]: 'true' })), 'verified helper accepts only the internal verified marker');
      ok(body.currentTenant?.tenantId === ANONYMOUS_TENANT_ID, 'currentTenant reads only internally-written tenant context');
      ok(body.rawParserTenant?.tenantId === ANONYMOUS_TENANT_ID, 'raw parser sees the sanitized tenant header after middleware');
      ok(body.currentAccountAccess === null, 'non-session request does not preserve spoofed account headers');
    }

    console.log(`F6 Bypass Route Tenant Context Invariant Tests: ${passed} passed, 0 failed`);
  } finally {
    restoreSavedEnv();
    process.env.ATTESTOR_TENANT_KEY_STORE_PATH = tenantKeyStorePath;
    resetTenantEnvKeyCacheForTests();
    resetTenantKeyStoreForTests();
    restoreSavedEnv();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
