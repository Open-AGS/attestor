import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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

const accountRoutes = readProjectFile('src', 'service', 'http', 'routes', 'account-routes.ts');
const accountRouteSources = readdirSync(join(process.cwd(), 'src', 'service', 'http', 'routes'))
  .filter((file) => /^account.*\.ts$/u.test(file))
  .map((file) => readProjectFile('src', 'service', 'http', 'routes', file))
  .join('\n');
const helper = readProjectFile('src', 'service', 'http', 'routes', 'account-route-helpers.ts');

includes(
  accountRouteSources,
  "from './account-route-helpers.js';",
  'Account route helper split: account route modules import the route-owned helper surface',
);

for (const exportedFunction of [
  'accountRouteErrorMessage',
  'accountAuthServiceErrorResponse',
  'accountApiKeyServiceErrorResponse',
  'accountUserManagementServiceErrorResponse',
  'accountUserRoleFilter',
  'hostedEmailDeliveryStatusFilter',
  'hostedEmailDeliveryProviderFilter',
  'readAccountJsonBody',
  'authAttemptBucket',
  'authAttemptFor',
  'authAttemptForPasswordReset',
  'authAttemptForCurrentPassword',
  'authAttemptForActionToken',
  'accountPasswordErrorResponse',
  'authRateLimitResponse',
  'maybeRateLimitAuthAttempt',
  'maybeRateLimitFederatedCallback',
  'maybeRateLimitCurrentPasswordAttempt',
]) {
  includes(
    helper,
    `export ${exportedFunction === 'readAccountJsonBody' ||
      exportedFunction === 'maybeRateLimitAuthAttempt' ||
      exportedFunction === 'maybeRateLimitFederatedCallback' ||
      exportedFunction === 'maybeRateLimitCurrentPasswordAttempt'
      ? 'async function'
      : 'function'} ${exportedFunction}`,
    `Account route helper split: ${exportedFunction} is exported from the helper module`,
  );
  excludes(
    accountRoutes,
    `function ${exportedFunction}`,
    `Account route helper split: ${exportedFunction} implementation is no longer embedded in account-routes.ts`,
  );
}

includes(
  helper,
  'export const AUTH_ATTEMPT_KIND',
  'Account route helper split: typed auth-attempt vocabulary stays beside bucket helpers',
);
includes(
  helper,
  'acceptsJsonRequestBody',
  'Account route helper split: strict JSON pre-check stays in the helper module',
);
excludes(
  helper,
  "from './account-routes.js'",
  'Account route helper split: helper module does not reverse-import the route registrar',
);
excludes(
  helper,
  'AccountRouteDeps',
  'Account route helper split: helper module does not depend on route dependency composition',
);

console.log(`Account route helper split tests: ${passed} passed, 0 failed`);
