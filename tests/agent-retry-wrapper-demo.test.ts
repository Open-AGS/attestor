import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAgentRetryWrapperDemo } from '../examples/agent-retry-wrapper-demo.js';
import {
  createConsequenceAdmissionRetryAttemptBinding,
} from '../src/consequence-admission/index.js';

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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testWrapperShowsBoundedCorrectionPath(): void {
  const demo = runAgentRetryWrapperDemo();

  equal(demo.initial.decision, 'review', 'Agent retry wrapper: initial incomplete action is held for review');
  equal(demo.initial.retryAllowed, true, 'Agent retry wrapper: model-safe correction is allowed');
  ok(
    demo.initial.missingFields.includes('policyRef'),
    'Agent retry wrapper: initial feedback names missing policyRef',
  );
  ok(
    demo.initial.missingFields.includes('evidenceRefs'),
    'Agent retry wrapper: initial feedback names missing evidenceRefs',
  );
  equal(demo.retry.budgetOutcome, 'allow-retry', 'Agent retry wrapper: retry budget allows first correction');
  equal(demo.retry.ledgerOutcome, 'recorded', 'Agent retry wrapper: retry attempt is recorded');
  equal(demo.retry.ledgerRetryAllowed, true, 'Agent retry wrapper: ledger allows corrected retry');
  equal(demo.retry.finalDecision, 'admit', 'Agent retry wrapper: corrected request admits');
  equal(demo.retry.finalAllowed, true, 'Agent retry wrapper: corrected request is allowed');
  ok(
    demo.retry.attemptId.startsWith('retry-attempt:sha256:'),
    'Agent retry wrapper: retry attempt id is canonical digest-shaped',
  );
  ok(
    demo.retry.ledgerReceiptDigest.startsWith('sha256:'),
    'Agent retry wrapper: ledger decision has receipt digest',
  );
}

function testDuplicateAndUnsafePathsStopCleanly(): void {
  const demo = runAgentRetryWrapperDemo();

  equal(demo.duplicateLedger.outcome, 'duplicate', 'Agent retry wrapper: duplicate retry returns duplicate');
  equal(demo.duplicateLedger.duplicate, true, 'Agent retry wrapper: duplicate flag is true');
  equal(demo.duplicateLedger.recordCountAfter, 1, 'Agent retry wrapper: duplicate does not append');
  equal(demo.unsafe.decision, 'review', 'Agent retry wrapper: unsafe action is held');
  equal(demo.unsafe.retryAllowed, false, 'Agent retry wrapper: unsafe action is not model-retryable');
  ok(
    demo.unsafe.operatorOnlyReasonCodes.includes('feature-unsafe'),
    'Agent retry wrapper: unsafe reason routes to operator control',
  );
  equal(demo.unsafe.retryAttemptCreated, false, 'Agent retry wrapper: unsafe action creates no retry attempt');
  equal(demo.ledgerSummary.recordCount, 1, 'Agent retry wrapper: ledger has one recorded retry');
  equal(demo.ledgerSummary.rawPayloadStored, false, 'Agent retry wrapper: ledger summary preserves data-minimized posture');
}

function testOutputIsColdAndDoesNotLeakRetrySecrets(): void {
  const demo = runAgentRetryWrapperDemo();

  includes(demo.output, 'Agent retry wrapper demo', 'Agent retry wrapper: output has title');
  includes(
    demo.output,
    'The wrapper lets an agent retry only when Attestor returns model-safe correction feedback.',
    'Agent retry wrapper: output states the retry condition',
  );
  includes(demo.output, 'budget outcome: allow-retry', 'Agent retry wrapper: output shows budget result');
  includes(demo.output, 'ledger outcome: recorded', 'Agent retry wrapper: output shows ledger record');
  includes(demo.output, 'ledger outcome: duplicate', 'Agent retry wrapper: output shows duplicate handling');
  includes(demo.output, 'retry attempt created: false', 'Agent retry wrapper: output shows unsafe path stops');
  includes(
    demo.output,
    'Feedback is for bounded correction, not for teaching the model how to bypass the gate.',
    'Agent retry wrapper: output carries the core boundary',
  );
  excludes(
    demo.output,
    /retry:agent-wrapper:refund:attempt-1/u,
    'Agent retry wrapper: output does not expose raw idempotency key',
  );
  excludes(
    demo.output,
    /wallet key|bank account|credential|secret/iu,
    'Agent retry wrapper: output avoids sensitive secret-bearing language',
  );
}

function testRetryAttemptBindingHelperIsExported(): void {
  const binding = createConsequenceAdmissionRetryAttemptBinding({
    previousAdmissionId: 'sha256:previous-admission',
    previousAdmissionDigest: 'sha256:previous-digest',
    previousRequestId: 'sha256:previous-request',
    attemptNumber: 1,
    attemptedAt: '2026-05-02T09:01:00.000Z',
    correctionReasonCodes: ['evidence-ref-missing'],
    correctionFields: ['evidenceRefs'],
    idempotencyKey: 'retry:test:1',
  });

  ok(
    binding.attemptId.startsWith('retry-attempt:sha256:'),
    'Agent retry wrapper: public helper creates canonical retry attempt id',
  );
}

function testDemoIsReachableFromDocsAndScripts(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };
  const readme = readProjectFile('README.md');
  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const doc = readProjectFile('docs', '01-overview', 'agent-retry-wrapper-demo.md');

  equal(
    packageJson.scripts['example:agent-retry-wrapper'],
    'tsx examples/agent-retry-wrapper-demo.ts',
    'Agent retry wrapper: example script is exported',
  );
  equal(
    packageJson.scripts['test:agent-retry-wrapper-demo'],
    'tsx tests/agent-retry-wrapper-demo.test.ts',
    'Agent retry wrapper: test script is exported',
  );
  includes(readme, 'npm run example:agent-retry-wrapper', 'Agent retry wrapper: README includes command');
  includes(quickstart, 'agent retry wrapper demo', 'Agent retry wrapper: quickstart links demo');
  includes(tryFirst, '[Agent retry wrapper demo](agent-retry-wrapper-demo.md)', 'Agent retry wrapper: try-first links demo');
  includes(doc, 'npm run example:agent-retry-wrapper', 'Agent retry wrapper: doc includes command');
  includes(
    doc,
    'correction, not probing',
    'Agent retry wrapper: doc states retry boundary',
  );
}

testWrapperShowsBoundedCorrectionPath();
testDuplicateAndUnsafePathsStopCleanly();
testOutputIsColdAndDoesNotLeakRetrySecrets();
testRetryAttemptBindingHelperIsExported();
testDemoIsReachableFromDocsAndScripts();

console.log(`Agent retry wrapper demo tests: ${passed} passed, 0 failed`);
