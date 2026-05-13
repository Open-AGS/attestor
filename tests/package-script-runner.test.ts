import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type SuiteItem = {
  readonly label: string;
  readonly command: string;
};

const { resolveSuite } = await import('../scripts/run-suite.mjs') as {
  readonly resolveSuite: (suiteName: 'architecture' | 'test' | 'verify') => readonly SuiteItem[];
};

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(
    !content.includes(unexpected),
    `${message}\nDid not expect to find: ${unexpected}`,
  );
  passed += 1;
}

function packageJson(): {
  readonly private: boolean;
  readonly main: string;
  readonly types: string;
  readonly exports: Readonly<Record<string, { readonly types: string; readonly default: string }>>;
  readonly scripts: Readonly<Record<string, string>>;
} {
  return JSON.parse(readProjectFile('package.json')) as {
    readonly private: boolean;
    readonly main: string;
    readonly types: string;
    readonly exports: Readonly<Record<string, { readonly types: string; readonly default: string }>>;
    readonly scripts: Readonly<Record<string, string>>;
  };
}

function suiteText(suiteName: 'architecture' | 'test' | 'verify'): string {
  return resolveSuite(suiteName)
    .map((item) => `${item.label}\n${item.command}`)
    .join('\n');
}

function suiteCommands(suiteName: 'architecture' | 'test' | 'verify'): readonly string[] {
  return resolveSuite(suiteName).map((item) => item.command);
}

function testPackageJsonDelegatesLargeSuitesToRunner(): void {
  const pkg = packageJson();

  equal(pkg.scripts.test, 'node scripts/run-suite.mjs test', 'Package runner: npm test delegates to suite runner');
  equal(pkg.scripts.verify, 'node scripts/run-suite.mjs verify', 'Package runner: npm run verify delegates to suite runner');
  equal(pkg.scripts['verify:architecture'], 'node scripts/run-suite.mjs architecture', 'Package runner: architecture verification delegates to suite runner');
  equal(pkg.scripts['verify:full'], 'npm run verify && node scripts/run-live-ops-gate.mjs full', 'Package runner: full verification delegates live/ops work to the live/ops runner');
  equal(pkg.scripts['typecheck:hygiene'], 'tsc --noEmit --noUnusedLocals --noUnusedParameters', 'Package runner: strict unused-code hygiene is available as an explicit check');
  equal(pkg.scripts['test:package-script-runner'], 'tsx tests/package-script-runner.test.ts', 'Package runner: runner contract test is exposed');
}

function testFastSuiteKeepsCriticalCoverage(): void {
  const text = suiteText('test');

  for (const expected of [
    'test:financial',
    'test:signing',
    'test:consequence-admission-customer-gate',
    'test:consequence-taxonomy',
    'test:downstream-enforcement-contract',
    'test:consequence-verifier-helper',
    'test:policy-limit-model',
    'test:downstream-presentation-binding',
    'test:presentation-replay-ledger',
    'test:downstream-execution-receipt',
    'test:agent-loop-abuse-guard-shared',
    'test:non-bypassable-gateway-demo',
    'test:first-impression-path',
    'test:proof-surface-readiness',
    'test:evaluation-packet-docs',
    'test:evaluation-release-notes',
    'test:security-baseline-docs',
    'test:agent-guidance-contract',
    'test:research-provenance-ledger',
    'test:package-script-runner',
    'test:verify-live-ops-gate',
    'test:hosted-api-authorization-matrix',
    'test:hosted-sensitive-business-flow-abuse-guard',
    'test:hosted-webhook-async-reconciliation-hardening',
    'test:hosted-llm-agent-tool-boundary-guard',
    'test:hosted-production-runtime-health-contract',
    'test:hosted-release-provenance-slsa-alignment',
    'test:hosted-observability-privacy-incident-evidence',
    'test:crypto-intelligence-surface-consistency',
    'test:crypto-authorization-core-noble-hashes-dependency-risk',
    'test:node-26-runtime-validation',
    'test:production-rollout-public-boundary',
    'test:production-readiness-secret-safe-output',
    'tsx tests/account-session-cookie-security.test.ts',
    'tsx tests/release-kernel-release-decision-engine.test.ts',
    'tsx tests/release-layer-platform-surface.test.ts',
    'tsx tests/release-policy-control-plane-platform-surface.test.ts',
    'tsx tests/release-enforcement-plane-middleware.test.ts',
    'tsx tests/crypto-authorization-core-eip712-envelope.test.ts',
  ]) {
    includes(text, expected, `Package runner: fast suite includes ${expected}`);
  }
}

function testVerifySuiteKeepsGateOrdering(): void {
  const commands = suiteCommands('verify');
  const text = commands.join('\n');

  equal(commands[0], 'npm run typecheck', 'Package runner: verify starts with typecheck');
  includes(text, 'npm run test:service-bootstrap-boundary', 'Package runner: verify includes service bootstrap boundary');
  includes(text, 'npm run test:service-route-boundary', 'Package runner: verify includes service route boundary');
  includes(text, 'npm run build', 'Package runner: verify includes build before package probes');
  includes(text, 'npm run test:release-layer-package-surface', 'Package runner: verify includes release layer package probe');
  includes(text, 'npm run test:release-policy-control-plane-package-surface', 'Package runner: verify includes policy control-plane package probe');
  includes(text, 'npm run test:release-enforcement-plane-package-surface', 'Package runner: verify includes enforcement-plane package probe');
  includes(text, 'npm run test:crypto-authorization-core-package-surface', 'Package runner: verify includes crypto authorization package probe');
  includes(text, 'npm run test:crypto-intelligence-package-surface', 'Package runner: verify includes crypto intelligence package probe');
  includes(text, 'npm run test:crypto-execution-admission-package-surface', 'Package runner: verify includes crypto execution-admission package probe');
  includes(text, 'npm run test:consequence-admission-package-surface', 'Package runner: verify includes consequence-admission package probe');

  const buildIndex = commands.indexOf('npm run build');
  for (const probeCommand of commands.filter((command) => command.includes('-package-surface'))) {
    ok(buildIndex >= 0 && commands.indexOf(probeCommand) > buildIndex, `Package runner: ${probeCommand} runs after build`);
  }
}

function testArchitectureSuiteKeepsBoundaryCoverage(): void {
  const commands = suiteCommands('architecture');
  const text = commands.join('\n');

  for (const expected of [
    'npm run test:ai-action-control-plane-architecture',
    'npm run test:architecture-boundary-imports',
    'npm run test:platform-string-normalization',
    'npm run test:control-plane-role-naming',
    'npm run test:domain-pack-boundary',
    'npm run test:failure-mode-registry',
    'npm run test:failure-mode-control-bindings',
    'npm run test:failure-mode-replay-fixtures',
    'npm run test:failure-mode-guard-coverage',
    'npm run test:replay-layer-placement',
    'npm run test:guard-activation-readiness',
    'npm run test:consequence-admission-readiness',
    'npm run test:product-positioning-docs',
    'npm run test:hosted-product-flow-docs',
  ]) {
    includes(text, expected, `Package runner: architecture suite includes ${expected}`);
  }

  includes(text, 'npm run build', 'Package runner: architecture suite builds before package-surface probe');
  includes(text, 'npm run test:consequence-admission-package-surface', 'Package runner: architecture suite probes consequence-admission package surface');
  ok(
    commands.indexOf('npm run test:consequence-admission-package-surface') > commands.indexOf('npm run build'),
    'Package runner: architecture suite runs package-surface probe after build',
  );
}

function testDefaultSuitesExcludeLiveAndOpsGates(): void {
  const architectureText = suiteText('architecture');
  const testText = suiteText('test');
  const verifyText = suiteText('verify');

  for (const excluded of [
    'test:live-api',
    'test:live-postgres',
    'test:live-snowflake',
    'test:live-cypress',
    'test:live-vsac',
    'test:observability-bundle',
    'test:kubernetes-ha-bundle',
    'test:production-readiness-packet',
    'test:secret-manager-bootstrap-render',
  ]) {
    excludes(architectureText, excluded, `Package runner: architecture suite excludes live/ops gate ${excluded}`);
    excludes(testText, excluded, `Package runner: npm test excludes live/ops gate ${excluded}`);
    excludes(verifyText, excluded, `Package runner: npm run verify excludes live/ops gate ${excluded}`);
  }
}

function testPrivatePackageBoundaryIsDocumented(): void {
  const pkg = packageJson();
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');

  equal(pkg.private, true, 'Package boundary: repository package remains private');
  equal(pkg.main, 'dist/consequence-admission/index.js', 'Package boundary: root main points at the customer-facing admission facade');
  equal(pkg.types, 'dist/consequence-admission/index.d.ts', 'Package boundary: root types point at the customer-facing admission facade');
  equal(pkg.exports['.'].default, './dist/consequence-admission/index.js', 'Package boundary: root export avoids the side-effectful financial CLI');
  equal(pkg.exports['.'].types, './dist/consequence-admission/index.d.ts', 'Package boundary: root export types match the admission facade');
  includes(purpose, 'not a public npm publication claim', 'Package boundary: purpose clarifies private package posture');
  includes(systemOverview, 'not a public npm availability claim', 'Package boundary: system overview clarifies private package posture');
}

testPackageJsonDelegatesLargeSuitesToRunner();
testFastSuiteKeepsCriticalCoverage();
testVerifySuiteKeepsGateOrdering();
testArchitectureSuiteKeepsBoundaryCoverage();
testDefaultSuitesExcludeLiveAndOpsGates();
testPrivatePackageBoundaryIsDocumented();

console.log(`Package script runner tests: ${passed} passed, 0 failed`);
