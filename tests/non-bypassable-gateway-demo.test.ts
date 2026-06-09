import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runNonBypassableGatewayDemo } from '../examples/non-bypassable-gateway-demo.js';

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

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testDemoMakesGatewayNonBypassableAtTheAdapter(): void {
  const demo = runNonBypassableGatewayDemo();

  equal(demo.rawDispatchExposed, false, 'Non-bypassable demo: raw dispatch is not exposed');
  equal(demo.scenarios.length, 4, 'Non-bypassable demo: covers allowed, bypass, wrong target, and blocked cases');
  equal(demo.ledger.length, 1, 'Non-bypassable demo: only one downstream payment executes');

  const [allowed, missingReplay, wrongTarget, blocked] = demo.scenarios;

  equal(allowed.outcome, 'executed', 'Non-bypassable demo: valid payment executes');
  equal(allowed.verification.verified, true, 'Non-bypassable demo: valid payment is verified');
  equal(allowed.ledgerCountAfter, 1, 'Non-bypassable demo: ledger changes after valid payment');

  equal(missingReplay.requestedBypass, true, 'Non-bypassable demo: missing replay case is a bypass attempt');
  equal(missingReplay.outcome, 'held', 'Non-bypassable demo: missing idempotency is held');
  ok(
    missingReplay.verification.downstreamDecision.failureReasons.includes('idempotency-key-missing'),
    'Non-bypassable demo: missing idempotency reason is explicit',
  );
  equal(missingReplay.ledgerCountAfter, 1, 'Non-bypassable demo: bypass attempt does not change ledger');

  equal(wrongTarget.requestedBypass, true, 'Non-bypassable demo: wrong target case is a bypass attempt');
  equal(wrongTarget.outcome, 'held', 'Non-bypassable demo: wrong downstream target is held');
  ok(
    wrongTarget.verification.downstreamDecision.failureReasons.includes('downstream-system-mismatch'),
    'Non-bypassable demo: downstream mismatch reason is explicit',
  );
  equal(wrongTarget.ledgerCountAfter, 1, 'Non-bypassable demo: wrong target does not change ledger');

  equal(blocked.outcome, 'held', 'Non-bypassable demo: blocked admission is held');
  ok(
    blocked.verification.downstreamDecision.failureReasons.includes('decision-not-executable'),
    'Non-bypassable demo: blocked admission cannot execute',
  );
  equal(blocked.ledgerCountAfter, 1, 'Non-bypassable demo: blocked admission does not change ledger');
}

function testDemoOutputIsColdAndConcrete(): void {
  const demo = runNonBypassableGatewayDemo();

  includes(demo.output, 'Non-bypassable gateway demo', 'Non-bypassable demo: output has title');
  includes(
    demo.output,
    'Every path goes through the Attestor verifier helper before the ledger changes.',
    'Non-bypassable demo: output states the enforcement point',
  );
  includes(demo.output, 'raw dispatch exposed: false', 'Non-bypassable demo: output shows raw dispatch is hidden');
  includes(demo.output, 'gateway outcome: EXECUTED', 'Non-bypassable demo: output shows executed path');
  includes(demo.output, 'gateway outcome: HELD', 'Non-bypassable demo: output shows held paths');
  includes(demo.output, 'failure reasons: idempotency-key-missing', 'Non-bypassable demo: output shows replay failure');
  includes(demo.output, 'failure reasons: downstream-system-mismatch', 'Non-bypassable demo: output shows target failure');
  includes(demo.output, 'final ledger entries: 1', 'Non-bypassable demo: output shows only one consequence');
  includes(demo.output, 'No verifier allow, no downstream consequence.', 'Non-bypassable demo: output has the core rule');
}

function testDemoIsReachableFromDocsAndScripts(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };
  const readme = readProjectFile('README.md');
  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const doc = readProjectFile('docs', '01-overview', 'non-bypassable-gateway-demo.md');

  equal(
    packageJson.scripts['example:non-bypassable-gateway'],
    'tsx examples/non-bypassable-gateway-demo.ts',
    'Non-bypassable demo: example script is exported',
  );
  equal(
    packageJson.scripts['test:non-bypassable-gateway-demo'],
    'tsx tests/non-bypassable-gateway-demo.test.ts',
    'Non-bypassable demo: test script is exported',
  );
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md)', 'Non-bypassable demo: README links first-run guide');
  includes(quickstart, 'non-bypassable gateway demo', 'Non-bypassable demo: quickstart links demo');
  includes(tryFirst, '`npm run example:non-bypassable-gateway`', 'Non-bypassable demo: try-first names demo command');
  includes(doc, 'npm run example:non-bypassable-gateway', 'Non-bypassable demo: doc includes command');
  includes(doc, 'No verifier allow, no downstream consequence.', 'Non-bypassable demo: doc carries core rule');
}

testDemoMakesGatewayNonBypassableAtTheAdapter();
testDemoOutputIsColdAndConcrete();
testDemoIsReachableFromDocsAndScripts();

console.log(`Non-bypassable gateway demo tests: ${passed} passed, 0 failed`);
