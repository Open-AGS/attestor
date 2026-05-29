import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(haystack: string, needle: string, message: string): void {
  assert.equal(haystack.includes(needle), true, message);
}

try {
  const doc = readProjectFile('docs', '02-architecture', 'control-plane-store-inventory.md');
  const budget = readProjectFile('docs', '02-architecture', 'large-file-budget.md');
  const packageJson = readProjectFile('package.json');

  for (const expected of [
    'Status: facade closeout complete.',
    'The public service import path remains `src/service/control-plane-store.ts`.',
    '`control-plane-store/snapshots.ts`',
    '| Compatibility facade | `control-plane-store.ts` |',
    '| Snapshot export/restore and test reset | `snapshots.ts` |',
    '| PostgreSQL connection and schema bootstrap | `pg.ts` plus `schema.ts` |',
    '`control-plane-store/schema.ts`',
    '`control-plane-store/mappers.ts`',
    '`control-plane-store/pipeline-idempotency-state.ts`',
    '`control-plane-store/admin-audit-state.ts`',
    '`control-plane-store/admin-idempotency-state.ts`',
    '`control-plane-store/async-dead-letter-state.ts`',
    '`control-plane-store/email-delivery-state.ts`',
    '`control-plane-store/stripe-webhook-state.ts`',
    '`control-plane-store/tenant-key-state.ts`',
    '`control-plane-store/usage-state.ts`',
    '`control-plane-store/account-auth-state.ts`',
    '`control-plane-store/hosted-billing-state.ts`',
    '| Normalizers, coercers, row mappers, shared helpers | `mappers.ts` |',
    '`control-plane-store/pg.ts`',
    '| Hosted account and billing state facade | `hosted-billing-state.ts` |',
    '| Tenant keys and usage state facade | `tenant-key-state.ts` plus `usage-state.ts` |',
    '| Account users, sessions, tokens, SAML replay | `account-auth-state.ts` |',
    '| Admin audit and admin idempotency | `admin-audit-state.ts` plus `admin-idempotency-state.ts` |',
    '| Pipeline idempotency | `pipeline-idempotency-state.ts` |',
    '| Stripe webhook processing | `stripe-webhook-state.ts` |',
    '| Async dead-letter state | `async-dead-letter-state.ts` |',
    '| Hosted email delivery | `email-delivery-state.ts` |',
    'Schema SQL and PG helper extraction are complete.',
    'This is complete in `control-plane-store/mappers.ts`.',
    'Pipeline idempotency is complete in',
    'admin audit/idempotency is complete in',
    'async dead-letter state',
    'delivery state is complete in `control-plane-store/email-delivery-state.ts`',
    'Stripe webhook state is complete in `control-plane-store/stripe-webhook-state.ts`',
    'tenant keys and usage. This is complete in',
    'sessions, action tokens, and hosted SAML replay are complete in',
    'billing entitlements, and Stripe billing event state are complete in',
    'snapshot export/restore now lives in `snapshots.ts`',
    'No behavior change in the store-family split PR.',
    'No schema change unless it is isolated in a separate migration PR.',
    'No production, multi-region, RLS, or live HA claim from this refactor.',
  ]) {
    includes(doc, expected, `Control-plane store inventory keeps: ${expected}`);
  }

  includes(
    budget,
    '`src/service/control-plane-store.ts` inventory is now documented',
    'Large-file budget records the control-plane store inventory closeout',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now imports the PostgreSQL schema SQL',
    'Large-file budget records the schema extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now imports PostgreSQL pool, schema, and',
    'Large-file budget records the PG helper extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now imports side-effect-free normalizers,',
    'Large-file budget records the mapper extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports pipeline idempotency state',
    'Large-file budget records the pipeline idempotency extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now imports and re-exports admin audit',
    'Large-file budget records the admin state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports async dead-letter state',
    'Large-file budget records the async dead-letter state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports hosted email delivery',
    'Large-file budget records the hosted email delivery state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports Stripe webhook state',
    'Large-file budget records the Stripe webhook state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports tenant key state',
    'Large-file budget records the tenant key state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports usage ledger state',
    'Large-file budget records the usage ledger state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports account auth state',
    'Large-file budget records the account auth state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports hosted account and billing',
    'Large-file budget records the hosted account and billing state extraction slice',
  );
  includes(
    budget,
    '`src/service/control-plane-store.ts` now re-exports control-plane backup,',
    'Large-file budget records the control-plane snapshot closeout slice',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'schema.ts'),
    'CREATE TABLE IF NOT EXISTS attestor_control_plane.hosted_accounts',
    'Control-plane schema module keeps hosted account table DDL',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'pg.ts'),
    "import { CONTROL_PLANE_SCHEMA_SQL } from './schema.js';",
    'Control-plane PG helper module imports the isolated schema SQL module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/pg.js';",
    'Control-plane store facade imports the isolated PG helper module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'snapshots.ts'),
    "from './mappers.js';",
    'Control-plane snapshot module imports the isolated mapper helper module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/pipeline-idempotency-state.js';",
    'Control-plane store facade re-exports the isolated pipeline idempotency module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/admin-audit-state.js';",
    'Control-plane store facade imports the isolated admin audit module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/admin-idempotency-state.js';",
    'Control-plane store facade imports the isolated admin idempotency module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/async-dead-letter-state.js';",
    'Control-plane store facade re-exports the isolated async dead-letter module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/email-delivery-state.js';",
    'Control-plane store facade re-exports the isolated hosted email delivery module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/stripe-webhook-state.js';",
    'Control-plane store facade re-exports the isolated Stripe webhook module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/tenant-key-state.js';",
    'Control-plane store facade re-exports the isolated tenant key module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/usage-state.js';",
    'Control-plane store facade re-exports the isolated usage module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/account-auth-state.js';",
    'Control-plane store facade re-exports the isolated account auth module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/hosted-billing-state.js';",
    'Control-plane store facade re-exports the isolated hosted billing module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/snapshots.js';",
    'Control-plane store facade re-exports the isolated snapshot module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'mappers.ts'),
    'export function rowToHostedAccount',
    'Control-plane mapper module keeps hosted account row projection',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'pipeline-idempotency-state.ts'),
    'export async function lookupPipelineIdempotencyState',
    'Control-plane pipeline idempotency module keeps lookup behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'admin-audit-state.ts'),
    'export async function appendAdminAuditRecordState',
    'Control-plane admin audit module keeps append behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'admin-idempotency-state.ts'),
    'export async function lookupAdminIdempotencyState',
    'Control-plane admin idempotency module keeps lookup behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'async-dead-letter-state.ts'),
    'export async function listAsyncDeadLetterRecordsState',
    'Control-plane async dead-letter module keeps list behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'email-delivery-state.ts'),
    'export async function recordHostedEmailProviderEventState',
    'Control-plane hosted email delivery module keeps provider event behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'stripe-webhook-state.ts'),
    'export async function claimProcessedStripeWebhookState',
    'Control-plane Stripe webhook module keeps claim behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'stripe-webhook-state.ts'),
    'export async function releaseAllStripeWebhookClaimLeasesForTests',
    'Control-plane Stripe webhook module keeps test lease cleanup behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'tenant-key-state.ts'),
    'export async function issueTenantApiKeyState',
    'Control-plane tenant key module keeps issue behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'tenant-key-state.ts'),
    'export async function recoverTenantApiKeyState',
    'Control-plane tenant key module keeps recovery behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'usage-state.ts'),
    'export async function consumePipelineRunState',
    'Control-plane usage module keeps consume behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'account-auth-state.ts'),
    'export async function issueAccountSessionState',
    'Control-plane account auth module keeps session issue behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'account-auth-state.ts'),
    'export async function recordHostedSamlReplayState',
    'Control-plane account auth module keeps hosted SAML replay behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'account-auth-state.ts'),
    'export async function exportAccountUserStoreSnapshot',
    'Control-plane account auth module keeps account user snapshot behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'hosted-billing-state.ts'),
    'export async function provisionHostedAccountState',
    'Control-plane hosted billing module keeps account provisioning behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'hosted-billing-state.ts'),
    'export async function applyStripeSubscriptionStateState',
    'Control-plane hosted billing module keeps Stripe subscription behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'hosted-billing-state.ts'),
    'export async function exportHostedAccountStoreSnapshot',
    'Control-plane hosted billing module keeps hosted account snapshot behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'snapshots.ts'),
    'export async function resetSharedControlPlaneStoreForTests',
    'Control-plane snapshot module keeps shared-store test reset behavior',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store', 'snapshots.ts'),
    'export async function exportAdminAuditLogStoreSnapshot',
    'Control-plane snapshot module keeps admin audit snapshot behavior',
  );
  includes(
    packageJson,
    '"test:control-plane-store-inventory-docs": "tsx tests/control-plane-store-inventory-docs.test.ts"',
    'package.json exposes the inventory docs lock test',
  );

  console.log('Control-plane store inventory docs tests: passed');
} catch (error) {
  console.error('Control-plane store inventory docs tests failed:', error);
  process.exit(1);
}
