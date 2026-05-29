import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

const EXPECTED_ROUTES = Object.freeze([
  ['POST', '/api/v1/account/users/bootstrap'],
  ['POST', '/api/v1/auth/signup'],
  ['POST', '/api/v1/auth/login'],
  ['POST', '/api/v1/auth/passkeys/options'],
  ['POST', '/api/v1/auth/passkeys/verify'],
  ['GET', '/api/v1/auth/saml/metadata'],
  ['POST', '/api/v1/auth/saml/login'],
  ['POST', '/api/v1/auth/saml/acs'],
  ['POST', '/api/v1/auth/oidc/login'],
  ['GET', '/api/v1/auth/oidc/callback'],
  ['POST', '/api/v1/auth/mfa/verify'],
  ['POST', '/api/v1/auth/logout'],
  ['POST', '/api/v1/auth/password/change'],
  ['GET', '/api/v1/auth/me'],
  ['GET', '/api/v1/account/mfa'],
  ['GET', '/api/v1/account/oidc'],
  ['GET', '/api/v1/account/saml'],
  ['GET', '/api/v1/account/passkeys'],
  ['POST', '/api/v1/account/passkeys/register/options'],
  ['POST', '/api/v1/account/passkeys/register/verify'],
  ['POST', '/api/v1/account/passkeys/:id/delete'],
  ['POST', '/api/v1/account/mfa/totp/enroll'],
  ['POST', '/api/v1/account/mfa/totp/confirm'],
  ['POST', '/api/v1/account/mfa/disable'],
  ['GET', '/api/v1/account/usage'],
  ['GET', '/api/v1/account'],
  ['GET', '/api/v1/account/entitlement'],
  ['GET', '/api/v1/account/features'],
  ['GET', '/api/v1/account/api-keys'],
  ['POST', '/api/v1/account/api-keys'],
  ['POST', '/api/v1/account/api-keys/:id/rotate'],
  ['POST', '/api/v1/account/api-keys/:id/deactivate'],
  ['POST', '/api/v1/account/api-keys/:id/reactivate'],
  ['POST', '/api/v1/account/api-keys/:id/revoke'],
  ['GET', '/api/v1/account/users'],
  ['POST', '/api/v1/account/users'],
  ['GET', '/api/v1/account/users/invites'],
  ['POST', '/api/v1/account/users/invites'],
  ['POST', '/api/v1/account/users/invites/:id/revoke'],
  ['POST', '/api/v1/account/users/invites/accept'],
  ['POST', '/api/v1/account/users/:id/deactivate'],
  ['POST', '/api/v1/account/users/:id/reactivate'],
  ['POST', '/api/v1/account/users/:id/password-reset'],
  ['POST', '/api/v1/auth/password/reset'],
  ['GET', '/api/v1/account/email/deliveries'],
  ['POST', '/api/v1/account/billing/checkout'],
  ['POST', '/api/v1/account/billing/portal'],
  ['GET', '/api/v1/account/billing/export'],
  ['GET', '/api/v1/account/billing/reconciliation'],
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

function readAccountRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^account.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function sourceRoutes(): string[] {
  const source = readAccountRouteSources();
  const routePattern = /app\.(get|post|put|patch|delete)\('([^']+)'/gu;
  const routes = [];
  for (const match of source.matchAll(routePattern)) {
    routes.push(`${match[1]!.toUpperCase()} ${match[2]!}`);
  }
  return routes.sort();
}

function docRoutes(): string[] {
  const doc = readProjectFile('docs', '02-architecture', 'account-routes-inventory.md');
  const routePattern = /^\| `(GET|POST|PUT|PATCH|DELETE)` \| `([^`]+)` \|/gmu;
  const routes = [];
  for (const match of doc.matchAll(routePattern)) {
    routes.push(`${match[1]!} ${match[2]!}`);
  }
  return routes.sort();
}

function testInventoryMatchesRouteSources(): void {
  const expected = EXPECTED_ROUTES.map(routeKey).sort();
  equal(sourceRoutes(), expected, 'Account route inventory: route source still exposes the expected method/path set');
  equal(docRoutes(), expected, 'Account route inventory: documentation lists the expected method/path set');
}

function testInventoryLocksSplitAndRiskBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'account-routes-inventory.md');

  for (const expected of [
    'method and path',
    'account mutation idempotency',
    'account-session mutation audit',
    'one-time clear-text API key material',
    '`Cache-Control: no-store`',
    'account-public-auth-routes.ts',
    'account-federated-auth-routes.ts',
    'account-mfa-passkey-routes.ts',
    'account-admin-user-routes.ts',
    'account-billing-routes.ts',
    'account-route-context.ts',
    'It does not prove live account mutation idempotency across replicas',
  ]) {
    ok(doc.includes(expected), `Account route inventory: expected boundary text is present: ${expected}`);
  }
}

function testPackageScriptExists(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  equal(
    packageJson.scripts['test:account-routes-inventory'],
    'tsx tests/account-routes-inventory.test.ts',
    'Package: account route inventory test script is registered',
  );
}

testInventoryMatchesRouteSources();
testInventoryLocksSplitAndRiskBoundaries();
testPackageScriptExists();

console.log(`Account routes inventory tests: ${passed} passed, 0 failed`);
