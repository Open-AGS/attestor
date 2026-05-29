import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

const EXPECTED_ROUTES = Object.freeze([
  ['GET', '/api/v1/admin/release-policy/control-plane'],
  ['GET', '/api/v1/admin/release-policy/packs'],
  ['POST', '/api/v1/admin/release-policy/packs'],
  ['GET', '/api/v1/admin/release-policy/packs/:packId'],
  ['GET', '/api/v1/admin/release-policy/packs/:packId/bundles'],
  ['GET', '/api/v1/admin/release-policy/packs/:packId/versions'],
  ['POST', '/api/v1/admin/release-policy/bundles'],
  ['GET', '/api/v1/admin/release-policy/packs/:packId/bundles/:bundleId'],
  ['GET', '/api/v1/admin/release-policy/activation-approvals'],
  ['POST', '/api/v1/admin/release-policy/activation-approvals'],
  ['GET', '/api/v1/admin/release-policy/activation-approvals/:id'],
  ['POST', '/api/v1/admin/release-policy/activation-approvals/:id/approve'],
  ['POST', '/api/v1/admin/release-policy/activation-approvals/:id/reject'],
  ['GET', '/api/v1/admin/release-policy/activations'],
  ['POST', '/api/v1/admin/release-policy/activations'],
  ['GET', '/api/v1/admin/release-policy/activations/:id'],
  ['POST', '/api/v1/admin/release-policy/activations/:id/rollback'],
  ['POST', '/api/v1/admin/release-policy/emergency/freeze'],
  ['POST', '/api/v1/admin/release-policy/emergency/rollback'],
  ['POST', '/api/v1/admin/release-policy/resolve'],
  ['POST', '/api/v1/admin/release-policy/simulations'],
  ['GET', '/api/v1/admin/release-policy/audit'],
  ['GET', '/api/v1/admin/release-policy/audit/verify'],
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

function readReleasePolicyRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^release-policy-control.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function sourceRoutes(): string[] {
  const source = readReleasePolicyRouteSources();
  const routePattern = /app\.(get|post|put|patch|delete)\('([^']+)'/gu;
  const routes = [];
  for (const match of source.matchAll(routePattern)) {
    routes.push(`${match[1]!.toUpperCase()} ${match[2]!}`);
  }
  return routes.sort();
}

function docRoutes(): string[] {
  const doc = readProjectFile('docs', '02-architecture', 'release-policy-control-routes-inventory.md');
  const routePattern = /^\| `(GET|POST|PUT|PATCH|DELETE)` \| `([^`]+)` \|/gmu;
  const routes = [];
  for (const match of doc.matchAll(routePattern)) {
    routes.push(`${match[1]!} ${match[2]!}`);
  }
  return routes.sort();
}

function testInventoryMatchesRouteSources(): void {
  const expected = EXPECTED_ROUTES.map(routeKey).sort();
  equal(sourceRoutes(), expected, 'Release policy route inventory: route source still exposes the expected method/path set');
  equal(docRoutes(), expected, 'Release policy route inventory: documentation lists the expected method/path set');
}

function testInventoryLocksAuthorityAndSplitBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'release-policy-control-routes-inventory.md');
  const source = readReleasePolicyRouteSources();

  for (const expected of [
    'RELEASE_ADMIN_READ_ROLES',
    'RELEASE_ADMIN_MUTATION_ROLES',
    'RELEASE_ADMIN_BREAK_GLASS_ROLES',
    'adminMutationRequest',
    'finalizeAdminMutation',
    'noStore(c)',
    'conditional `If-None-Match` / ETag behavior',
    'release-policy-control-read-routes.ts',
    'release-policy-control-pack-routes.ts',
    'release-policy-control-activation-routes.ts',
    'release-policy-control-emergency-routes.ts',
    'release-policy-control-simulation-routes.ts',
    'release-policy-control-route-context.ts',
    'It does not prove live customer enforcement',
  ]) {
    ok(doc.includes(expected), `Release policy route inventory: expected boundary text is present: ${expected}`);
  }

  ok(source.includes('authorizeReleaseAdminRoute'), 'Release policy route inventory: source uses admin route authorization');
  ok(source.includes('RELEASE_ADMIN_BREAK_GLASS_ROLES'), 'Release policy route inventory: source keeps break-glass roles explicit');
  ok(source.includes('requireBreakGlassAuthorization'), 'Release policy route inventory: source keeps break-glass body authorization explicit');
  ok(source.includes('beginMutation'), 'Release policy route inventory: source keeps mutation bridge entrypoint explicit');
  ok(source.includes('finishMutation'), 'Release policy route inventory: source keeps mutation finalizer explicit');
  ok(source.includes('applyBundleCacheHeaders'), 'Release policy route inventory: source keeps bundle cache headers explicit');
}

function testPackageScriptExists(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  equal(
    packageJson.scripts['test:release-policy-control-routes-inventory'],
    'tsx tests/release-policy-control-routes-inventory.test.ts',
    'Package: release policy route inventory test script is registered',
  );
}

testInventoryMatchesRouteSources();
testInventoryLocksAuthorityAndSplitBoundaries();
testPackageScriptExists();

console.log(`Release policy control routes inventory tests: ${passed} passed, 0 failed`);
