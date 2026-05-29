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

const adminRoutes = readProjectFile('src', 'service', 'http', 'routes', 'admin-routes.ts');
const adminRouteContext = readProjectFile('src', 'service', 'http', 'routes', 'admin-route-context.ts');
const helper = readProjectFile('src', 'service', 'http', 'routes', 'admin-route-helpers.ts');

includes(
  adminRoutes,
  "from './admin-route-context.js';",
  'Admin route helper split: admin-routes.ts imports the route-owned context surface',
);
includes(
  adminRouteContext,
  "from './admin-route-helpers.js';",
  'Admin route helper split: admin-route-context.ts imports the route-owned helper surface',
);
includes(
  adminRoutes,
  "export { resetAdminRouteAuthLimiterForTests } from './admin-route-context.js';",
  'Admin route helper split: legacy test reset export stays available through admin-routes.ts',
);

for (const exportedConstant of [
  'ADMIN_READ_ROLES',
  'ADMIN_ACCOUNT_ROLES',
  'ADMIN_KEY_ROLES',
  'ADMIN_BILLING_ROLES',
  'ADMIN_OPS_ROLES',
  'ADMIN_RELEASE_ROLES',
]) {
  includes(
    helper,
    `export const ${exportedConstant}`,
    `Admin route helper split: ${exportedConstant} is exported from the helper module`,
  );
}

for (const exportedFunction of [
  'normalizeAdminRole',
  'authorizeAdminRoute',
  'adminActorForMutation',
  'resetAdminRouteAuthLimiterForTests',
  'adminDegradedModeActor',
  'adminDegradedModeScope',
  'adminDegradedModeStringArray',
  'adminDegradedModeText',
  'adminDegradedModeError',
  'adminRouteErrorMessage',
  'adminControlServiceErrorResponse',
  'adminControlBillingEvent',
  'parseAdminJsonBody',
  'parseAdminListLimit',
  'adminAuditActionFilter',
  'billingEventProviderFilter',
  'billingEventOutcomeFilter',
  'billingEntitlementStatusFilter',
  'hostedEmailDeliveryStatusFilter',
  'hostedEmailDeliveryProviderFilter',
]) {
  const asyncPrefix = exportedFunction === 'parseAdminJsonBody' ? 'async ' : '';
  includes(
    helper,
    `export ${asyncPrefix}function ${exportedFunction}`,
    `Admin route helper split: ${exportedFunction} is exported from the helper module`,
  );
  excludes(
    adminRoutes,
    `function ${exportedFunction}`,
    `Admin route helper split: ${exportedFunction} implementation is no longer embedded in admin-routes.ts`,
  );
}

excludes(
  helper,
  "from './admin-routes.js'",
  'Admin route helper split: helper module does not reverse-import the route registrar',
);
excludes(
  helper,
  'AdminRouteDeps',
  'Admin route helper split: helper module does not depend on route dependency composition',
);

console.log(`Admin route helper split tests: ${passed} passed, 0 failed`);
