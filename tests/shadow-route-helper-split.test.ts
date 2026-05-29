import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(haystack: string, needle: string, message: string): void {
  ok(haystack.includes(needle), `${message}\nExpected to find: ${needle}`);
}

function excludes(haystack: string, needle: string, message: string): void {
  ok(!haystack.includes(needle), `${message}\nDid not expect to find: ${needle}`);
}

const shadowRoutes = readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts');
const shadowRouteModules = [
  shadowRoutes,
  readProjectFile('src', 'service', 'http', 'routes', 'shadow-summary-dashboard-routes.ts'),
  readProjectFile('src', 'service', 'http', 'routes', 'shadow-simulation-history-routes.ts'),
  readProjectFile('src', 'service', 'http', 'routes', 'shadow-policy-foundry-promotion-routes.ts'),
  readProjectFile('src', 'service', 'http', 'routes', 'shadow-downstream-activation-routes.ts'),
  readProjectFile('src', 'service', 'http', 'routes', 'shadow-customer-activation-routes.ts'),
].join('\n');
const helper = readProjectFile('src', 'service', 'http', 'routes', 'shadow-route-helpers.ts');

includes(
  shadowRouteModules,
  "from './shadow-route-helpers.js';",
  'Shadow route helper split: route-family modules import the bounded helper surface',
);

for (const exportedHelper of [
  'tenantSummary',
  'assertTenantBoundRecord',
  'assertTenantBoundRecords',
  'boundedErrorDetail',
  'caughtErrorStatus',
  'problem',
  'shadowListPage',
  'isRecord',
]) {
  includes(
    helper,
    `export function ${exportedHelper}`,
    `Shadow route helper split: ${exportedHelper} is exported from the helper module`,
  );
  excludes(
    shadowRouteModules,
    `function ${exportedHelper}`,
    `Shadow route helper split: ${exportedHelper} implementation is no longer embedded in route modules`,
  );
}

includes(
  helper,
  'SHADOW_TENANT_BOUNDARY_MARKER',
  'Shadow route helper split: tenant-boundary marker stays next to bounded error-detail handling',
);
excludes(
  helper,
  'ShadowRouteDeps',
  'Shadow route helper split: helper module does not import route dependency composition',
);
excludes(
  helper,
  "from './shadow-routes.js'",
  'Shadow route helper split: helper module does not reverse-import the route registrar',
);

console.log(`Shadow route helper split tests: ${passed} passed, 0 failed`);
