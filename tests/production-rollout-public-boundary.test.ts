import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageJson = {
  readonly scripts?: Readonly<Record<string, string>>;
};

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function readPackageJson(): PackageJson {
  return JSON.parse(readProjectFile('package.json')) as PackageJson;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testProductionRolloutBlockerUsesNeutralPublicLanguage(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'crypto-engine-hardening-ii.md');

  includes(
    tracker,
    '| 10 | blocked | Production rollout readiness | deployment target and operator-managed runtime access |',
    'Production rollout public boundary: Step 10 uses neutral technical blocker language',
  );
  includes(
    tracker,
    'full production rollout still requires operator-managed deployment env, service restart, readiness probe, and smoke tests on a working deployment target',
    'Production rollout public boundary: Step 10 states the concrete technical next gate',
  );
  excludes(
    tracker,
    /\bfunding\b|\bcash\b|\bcan't afford\b|\bpayment paused\b|\bpayouts paused\b|\bbilling suspension\b|\btrial expired\b|\bfizet|\bp[eé]nz/iu,
    'Production rollout public boundary: public tracker must not expose private financial or account-status explanations',
  );
  excludes(
    tracker,
    /\b(?:sk|rk)_live_[A-Za-z0-9_]+\b|\bwhsec_[A-Za-z0-9_]+\b/iu,
    'Production rollout public boundary: public tracker must not contain concrete live Stripe secrets',
  );
}

function testPublicBoundaryGuardIsRegistered(): void {
  const packageJson = readPackageJson();
  const runner = readProjectFile('tests', 'package-script-runner.test.ts');
  const docsGuard = readProjectFile('tests', 'crypto-engine-hardening-ii-docs.test.ts');

  includes(
    packageJson.scripts?.['test:production-rollout-public-boundary'] ?? '',
    'tsx tests/production-rollout-public-boundary.test.ts',
    'Production rollout public boundary: package.json exposes the focused guard',
  );
  includes(
    runner,
    'test:production-rollout-public-boundary',
    'Production rollout public boundary: package runner keeps the guard in the fast suite',
  );
  includes(
    docsGuard,
    'deployment target and operator-managed runtime access',
    'Production rollout public boundary: tracker docs test locks the neutral blocker phrase',
  );
}

testProductionRolloutBlockerUsesNeutralPublicLanguage();
testPublicBoundaryGuardIsRegistered();

console.log(`production-rollout-public-boundary: ${passed} assertions passed`);
