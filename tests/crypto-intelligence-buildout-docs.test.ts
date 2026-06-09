import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testTrackerIsLinkedFromCurrentTruthSources(): void {
  const readme = readProjectFile('README.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = readProjectFile('package.json');

  includes(
    readme,
    '[Repository navigator](docs/01-overview/repository-navigator.md)',
    'Crypto intelligence docs: README links the repository navigator',
  );
  includes(
    systemOverview,
    '[Crypto intelligence buildout](crypto-intelligence-buildout.md)',
    'Crypto intelligence docs: system overview links the tracker',
  );
  includes(
    packageJson,
    '"test:crypto-intelligence-buildout-docs"',
    'Crypto intelligence docs: package script exposes the docs guard',
  );
  includes(
    packageJson,
    '"./crypto-intelligence"',
    'Crypto intelligence docs: package export exposes the crypto intelligence subpath',
  );
  includes(
    packageJson,
    '"test:crypto-intelligence-package-surface"',
    'Crypto intelligence docs: package script exposes the package surface probe',
  );
}

function testTrackerPreservesScopeAndNonGoals(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'crypto-intelligence-buildout.md');

  includes(
    tracker,
    'after the completed crypto authorization core and crypto execution-admission tracks',
    'Crypto intelligence docs: tracker starts after completed crypto tracks',
  );
  includes(
    tracker,
    'Keep Attestor as one product with one platform core and modular packs.',
    'Crypto intelligence docs: one-product framing is preserved',
  );
  includes(
    tracker,
    'Do not add a public hosted crypto route as part of this tracker.',
    'Crypto intelligence docs: public hosted crypto route remains blocked',
  );
  includes(
    tracker,
    'Do not make Attestor a wallet, custody platform, bundler, paymaster, bridge, facilitator, solver, relayer, oracle, or market-data vendor.',
    'Crypto intelligence docs: tracker blocks role expansion',
  );
  includes(
    tracker,
    'Do not claim sanctions, fraud, compliance, or counterparty screening coverage unless',
    'Crypto intelligence docs: tracker blocks unsupported compliance or screening claims',
  );
  excludes(
    tracker,
    /hosted crypto route is ready|Attestor becomes a wallet|Attestor becomes a custody platform|native sanctions oracle/i,
    'Crypto intelligence docs: tracker avoids hosted-route and oracle overclaims',
  );
}

function testTrackerProtectsCryptoPrivacyBoundary(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'crypto-intelligence-buildout.md');

  includes(
    tracker,
    'Do not expose raw wallet metadata, raw transaction payloads, customer identifiers, custody callback bodies, provider error bodies, private policy thresholds, or solver route secrets',
    'Crypto intelligence docs: tracker blocks raw crypto and customer data exposure',
  );
  includes(
    tracker,
    'reason codes, missing evidence classes, safe instructions, scoped refs, and digests are allowed',
    'Crypto intelligence docs: tracker defines model-safe feedback shape',
  );
  includes(
    tracker,
    'Preserve fail-closed behavior when intelligence inputs are absent, stale, ambiguous, contradictory, or outside the admitted scope.',
    'Crypto intelligence docs: tracker preserves fail-closed intelligence posture',
  );
  includes(
    tracker,
    'operator-supplied risk inputs are provenance-bound, scoped, fresh, and non-oracular',
    'Crypto intelligence docs: completion definition keeps risk inputs non-oracular',
  );
}

function testTrackerFreezesTheStepList(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'crypto-intelligence-buildout.md');

  includes(tracker, '| Total frozen steps | 10 |', 'Crypto intelligence docs: step count is frozen');
  includes(tracker, '| Completed | 10 |', 'Crypto intelligence docs: all ten steps are complete');
  includes(tracker, '| Not started | 0 |', 'Crypto intelligence docs: no frozen steps remain pending');

  const steps = [
    '| 01 | complete | Define crypto intelligence scope, research anchors, vocabulary, and guardrails |',
    '| 02 | complete | Add crypto risk signal model and severity mapping |',
    '| 03 | complete | Add policy gap and safe narrowing candidate generation |',
    '| 04 | complete | Add adapter readiness matrix and manifest |',
    '| 05 | complete | Expand negative conformance fixtures for crypto intelligence |',
    '| 06 | complete | Harden crypto privacy and telemetry minimization |',
    '| 07 | complete | Add operator-supplied risk input contract |',
    '| 08 | complete | Add crypto intelligence dashboard summary |',
    '| 09 | complete | Add crypto intelligence performance budget and benchmarks |',
    '| 10 | complete | Package and document the crypto intelligence surface |',
  ];

  for (const step of steps) {
    includes(tracker, step, `Crypto intelligence docs: frozen step is present: ${step}`);
  }
}

function testTrackerStaysGroundedInExistingCryptoSurfaces(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'crypto-intelligence-buildout.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');

  for (const surface of [
    'wallet RPC',
    'Safe guard',
    'ERC-4337 bundler',
    'modular-account',
    'delegated-EOA',
    'x402 resource-server',
    'custody policy engine',
    'intent solver',
  ]) {
    includes(tracker, surface, `Crypto intelligence docs: tracker names existing surface ${surface}`);
  }

  includes(
    systemOverview,
    'crypto intelligence now packages risk signals, policy gaps, adapter readiness, operator risk inputs, dashboard summaries, conformance fixtures, privacy gates, performance budgets, and package-surface consistency checks through `attestor/crypto-intelligence`',
    'Crypto intelligence docs: system overview points future crypto work to this tracker',
  );
  includes(
    tracker,
    'The frozen crypto intelligence buildout track is complete',
    'Crypto intelligence docs: immediate next step closes the frozen track',
  );
  includes(
    tracker,
    'src/crypto-intelligence/index.ts',
    'Crypto intelligence docs: Step 10 evidence points to package index',
  );
  includes(
    tracker,
    'scripts/probe/probe-crypto-intelligence-package-surface.mjs',
    'Crypto intelligence docs: Step 10 evidence points to package boundary probe',
  );
  includes(
    tracker,
    'docs/02-architecture/crypto-intelligence-platform-surface.md',
    'Crypto intelligence docs: Step 10 evidence points to platform surface docs',
  );
  includes(
    tracker,
    'Node package `exports` maps define explicit package entrypoints',
    'Crypto intelligence docs: Step 10 research anchor covers Node package exports',
  );
  includes(
    tracker,
    'TypeScript `moduleResolution: "bundler"` supports package `exports` and `imports`',
    'Crypto intelligence docs: Step 10 research anchor covers TypeScript package export resolution',
  );
  includes(
    tracker,
    'src/crypto-authorization-core/intelligence-performance-budget.ts',
    'Crypto intelligence docs: Step 09 evidence points to performance budget contract',
  );
  includes(
    tracker,
    'scripts/benchmark/benchmark-crypto-intelligence-performance.ts',
    'Crypto intelligence docs: Step 09 evidence points to performance benchmark script',
  );
  includes(
    tracker,
    'src/crypto-authorization-core/intelligence-dashboard-summary.ts',
    'Crypto intelligence docs: Step 08 evidence points to dashboard summary contract',
  );
  includes(
    tracker,
    'tests/crypto-authorization-core-intelligence-dashboard-summary.test.ts',
    'Crypto intelligence docs: Step 08 evidence points to dashboard summary tests',
  );
  includes(
    tracker,
    'src/crypto-authorization-core/operator-risk-input-contract.ts',
    'Crypto intelligence docs: Step 07 evidence points to operator risk input contract',
  );
  includes(
    tracker,
    'tests/crypto-authorization-core-operator-risk-input-contract.test.ts',
    'Crypto intelligence docs: Step 07 evidence points to operator risk input tests',
  );
  includes(
    tracker,
    'W3C PROV models provenance around entities, activities, and agents',
    'Crypto intelligence docs: Step 07 research anchor covers provenance',
  );
  includes(
    tracker,
    'OFAC publishes sanctions list services and data formats',
    'Crypto intelligence docs: Step 07 research anchor avoids sanctions overclaim',
  );
  includes(
    tracker,
    "Node's performance hooks and crypto hashing APIs provide stable local measurement and digest primitives",
    'Crypto intelligence docs: Step 09 research anchor covers performance measurement',
  );
  includes(
    tracker,
    'src/crypto-authorization-core/intelligence-privacy-minimization.ts',
    'Crypto intelligence docs: Step 06 evidence points to privacy minimization module',
  );
  includes(
    tracker,
    'tests/crypto-authorization-core-intelligence-privacy-minimization.test.ts',
    'Crypto intelligence docs: Step 06 evidence points to privacy minimization tests',
  );
  includes(
    tracker,
    'src/crypto-execution-admission/adapter-readiness-manifest.ts',
    'Crypto intelligence docs: Step 04 evidence points to adapter readiness manifest',
  );
  includes(
    tracker,
    'tests/crypto-execution-admission-negative-conformance-fixtures.test.ts',
    'Crypto intelligence docs: Step 05 evidence points to negative conformance fixtures',
  );
}

testTrackerIsLinkedFromCurrentTruthSources();
testTrackerPreservesScopeAndNonGoals();
testTrackerProtectsCryptoPrivacyBoundary();
testTrackerFreezesTheStepList();
testTrackerStaysGroundedInExistingCryptoSurfaces();

console.log(`Crypto intelligence buildout docs tests: ${passed} passed, 0 failed`);
