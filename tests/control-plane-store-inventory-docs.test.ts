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
    'Status: first split started.',
    '`src/service/control-plane-store.ts` as a compatibility facade',
    '| PostgreSQL connection and schema bootstrap | `pg.ts` plus `schema.ts` |',
    '`control-plane-store/schema.ts`',
    '`control-plane-store/mappers.ts`',
    '`control-plane-store/pipeline-idempotency-state.ts`',
    '| Normalizers, coercers, row mappers, shared helpers | `mappers.ts` |',
    '`control-plane-store/pg.ts`',
    '| Hosted account and billing state facade | 986-1496 |',
    '| Tenant keys and usage state facade | 1497-1765 |',
    '| Account users, sessions, tokens, SAML replay | 1766-2276 |',
    '| Admin audit and admin idempotency | 2277-2493 |',
    '| Pipeline idempotency | `pipeline-idempotency-state.ts` |',
    '| Stripe webhook processing | 2494-2776 |',
    '| Async dead-letter and hosted email delivery | 2777-3073 |',
    '| Snapshot export/restore and test reset | 3074-3628 |',
    'Schema SQL and PG helper extraction are complete.',
    'This is complete in `control-plane-store/mappers.ts`.',
    'Pipeline idempotency is complete in',
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
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/mappers.js';",
    'Control-plane store facade imports the isolated mapper helper module',
  );
  includes(
    readProjectFile('src', 'service', 'control-plane-store.ts'),
    "from './control-plane-store/pipeline-idempotency-state.js';",
    'Control-plane store facade re-exports the isolated pipeline idempotency module',
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
    packageJson,
    '"test:control-plane-store-inventory-docs": "tsx tests/control-plane-store-inventory-docs.test.ts"',
    'package.json exposes the inventory docs lock test',
  );

  console.log('Control-plane store inventory docs tests: passed');
} catch (error) {
  console.error('Control-plane store inventory docs tests failed:', error);
  process.exit(1);
}
