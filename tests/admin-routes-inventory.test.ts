import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

const EXPECTED_ROUTES = Object.freeze([
  ['GET', '/api/v1/admin/tenant-keys'],
  ['GET', '/api/v1/admin/accounts'],
  ['GET', '/api/v1/admin/accounts/:id/billing/export'],
  ['GET', '/api/v1/admin/accounts/:id/features'],
  ['GET', '/api/v1/admin/accounts/:id/billing/reconciliation'],
  ['GET', '/api/v1/admin/plans'],
  ['GET', '/api/v1/admin/audit'],
  ['GET', '/api/v1/admin/billing/events'],
  ['GET', '/api/v1/admin/billing/entitlements'],
  ['GET', '/api/v1/admin/metrics'],
  ['GET', '/api/v1/metrics'],
  ['GET', '/api/v1/admin/telemetry'],
  ['GET', '/api/v1/admin/email/deliveries'],
  ['GET', '/api/v1/admin/queue'],
  ['GET', '/api/v1/admin/queue/dlq'],
  ['POST', '/api/v1/admin/queue/jobs/:id/retry'],
  ['POST', '/api/v1/admin/accounts'],
  ['POST', '/api/v1/admin/accounts/:id/billing/stripe'],
  ['POST', '/api/v1/admin/accounts/:id/suspend'],
  ['POST', '/api/v1/admin/accounts/:id/reactivate'],
  ['POST', '/api/v1/admin/accounts/:id/archive'],
  ['POST', '/api/v1/admin/tenant-keys'],
  ['POST', '/api/v1/admin/tenant-keys/:id/rotate'],
  ['POST', '/api/v1/admin/tenant-keys/:id/deactivate'],
  ['POST', '/api/v1/admin/tenant-keys/:id/reactivate'],
  ['POST', '/api/v1/admin/tenant-keys/:id/recover'],
  ['POST', '/api/v1/admin/tenant-keys/:id/revoke'],
  ['POST', '/api/v1/admin/release-tokens/:id/revoke'],
  ['GET', '/api/v1/admin/release-enforcement/degraded-mode/grants'],
  ['POST', '/api/v1/admin/release-enforcement/degraded-mode/grants'],
  ['POST', '/api/v1/admin/release-enforcement/degraded-mode/grants/:id/revoke'],
  ['GET', '/api/v1/admin/usage'],
] as const);

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(value: unknown, message: string): void {
  assert.ok(value, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function routeKey(route: readonly [string, string]): string {
  return `${route[0]} ${route[1]}`;
}

function readAdminRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^admin(?:-|$).*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function sourceRoutes(): string[] {
  const source = readAdminRouteSources();
  const routePattern = /app\.(get|post|put|patch|delete)\('([^']+)'/gu;
  const routes = [];
  for (const match of source.matchAll(routePattern)) {
    routes.push(`${match[1]!.toUpperCase()} ${match[2]!}`);
  }
  return routes.sort();
}

function docRoutes(): string[] {
  const doc = readProjectFile('docs', '02-architecture', 'admin-routes-inventory.md');
  const routePattern = /^\| `(GET|POST|PUT|PATCH|DELETE)` \| `([^`]+)` \|/gmu;
  const routes = [];
  for (const match of doc.matchAll(routePattern)) {
    routes.push(`${match[1]!} ${match[2]!}`);
  }
  return routes.sort();
}

function testInventoryMatchesRouteSources(): void {
  const expected = EXPECTED_ROUTES.map(routeKey).sort();
  equal(sourceRoutes(), expected, 'Admin route inventory: route source still exposes the expected method/path set');
  equal(docRoutes(), expected, 'Admin route inventory: documentation lists the expected method/path set');
}

function testInventoryLocksAuthorityAndSplitBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'admin-routes-inventory.md');
  const source = readAdminRouteSources();

  for (const expected of [
    'authorizeAdminRoute',
    'currentMetricsAuthorized',
    'beginAdminMutation',
    'Idempotency-Key',
    'admin-route-context.ts',
    'admin-read-routes.ts',
    'admin-account-mutation-routes.ts',
    'admin-tenant-key-routes.ts',
    'admin-queue-routes.ts',
    'admin-release-enforcement-routes.ts',
    'It does not prove live customer enforcement',
  ]) {
    ok(doc.includes(expected), `Admin route inventory: expected boundary text is present: ${expected}`);
  }

  ok(source.includes('authorizeAdminRoute'), 'Admin route inventory: source uses admin route authorization');
  ok(source.includes('currentMetricsAuthorized'), 'Admin route inventory: source keeps metrics authorization explicit');
  ok(source.includes('beginAdminMutation'), 'Admin route inventory: source keeps mutation bridge entrypoint explicit');
  ok(source.includes("context.req.header('Idempotency-Key')"), 'Admin route inventory: source binds idempotency key');
  ok(source.includes('ADMIN_RELEASE_ROLES'), 'Admin route inventory: source keeps release roles explicit');
}

function testPackageScriptExists(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  equal(
    packageJson.scripts['test:admin-routes-inventory'],
    'tsx tests/admin-routes-inventory.test.ts',
    'Package: admin route inventory test script is registered',
  );
}

testInventoryMatchesRouteSources();
testInventoryLocksAuthorityAndSplitBoundaries();
testPackageScriptExists();

console.log(`Admin routes inventory tests: ${passed} passed, 0 failed`);
