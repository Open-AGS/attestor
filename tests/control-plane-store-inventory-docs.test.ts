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
    'Status: inventory-only.',
    '`src/service/control-plane-store.ts` as a compatibility facade',
    '| PostgreSQL connection and schema bootstrap | 315-684 |',
    '| Hosted account and billing state facade | 1786-2296 |',
    '| Tenant keys and usage state facade | 2297-2558 |',
    '| Account users, sessions, tokens, SAML replay | 2566-3076 |',
    '| Admin audit and admin idempotency | 3077-3293 |',
    '| Pipeline idempotency | 3294-3442 |',
    '| Stripe webhook processing | 3443-3725 |',
    '| Async dead-letter and hosted email delivery | 3726-4067 |',
    '| Snapshot export/restore and test reset | 4068-4584 |',
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
    packageJson,
    '"test:control-plane-store-inventory-docs": "tsx tests/control-plane-store-inventory-docs.test.ts"',
    'package.json exposes the inventory docs lock test',
  );

  console.log('Control-plane store inventory docs tests: 17 passed, 0 failed');
} catch (error) {
  console.error('Control-plane store inventory docs tests failed:', error);
  process.exit(1);
}
