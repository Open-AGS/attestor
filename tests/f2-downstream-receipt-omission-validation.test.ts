import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const note = readProjectFile('docs', 'audit', 'f2-downstream-receipt-omission-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const receipt = readProjectFile('src', 'consequence-admission', 'downstream-execution-receipt.ts');
  const coverage = readProjectFile('src', 'consequence-admission', 'failure-mode-guard-coverage.ts');
  const bindings = readProjectFile('src', 'consequence-admission', 'failure-mode-control-bindings.ts');
  const feedback = readProjectFile(
    'src',
    'consequence-admission',
    'policy-foundry-outcome-feedback-loop.ts',
  );
  const receiptTests = readProjectFile('tests', 'downstream-execution-receipt.test.ts');
  const feedbackTests = readProjectFile('tests', 'policy-foundry-outcome-feedback-loop.test.ts');

  includes(note, 'Status: `partial`.', 'Validation note: status is partial');
  includes(
    note,
    'The original finding is stale if it says Attestor has no downstream execution',
    'Validation note: stale original wording is explicit',
  );
  includes(
    note,
    'Current repo evidence supports `partial`, not `fixed`.',
    'Validation note: partial-not-fixed conclusion is explicit',
  );
  includes(note, 'https://cloudevents.io', 'Validation note: CloudEvents source is recorded');
  includes(
    tracker,
    'F2-AG-5 hidden downstream side effects / receipt omission | `partial`',
    'Tracker: downstream receipt omission finding is partial',
  );
  includes(
    packageJson,
    '"test:f2-downstream-receipt-omission-validation"',
    'Package: focused receipt omission validation test script exists',
  );

  for (const expected of [
    'replay-not-consumed',
    'executed-before-replay-consumption',
    'success-result-missing',
    'failure-result-missing',
    'skip-reason-missing',
    'cloudEventsCompatible: true',
    'failClosed: true',
  ]) {
    includes(receipt, expected, `Receipt evidence: ${expected} is present`);
  }

  includes(
    coverage,
    "'hidden-downstream-side-effect':",
    'Coverage evidence: hidden downstream side-effect is mapped',
  );
  includes(coverage, "runtimeClaim: 'detects-gap'", 'Coverage evidence: runtime claim is detects-gap');
  includes(
    coverage,
    'each adapter still has to prove side-effect declaration and receipt semantics',
    'Coverage evidence: adapter receipt limitation is explicit',
  );

  includes(
    bindings,
    "requiredEvidence: ['side-effect-inventory', 'reversibility-class', 'execution-receipt']",
    'Binding evidence: side-effect inventory and execution receipt are required',
  );
  includes(
    feedback,
    "'missing-receipts-after-review'",
    'Outcome feedback evidence: missing receipts after review are no-go',
  );
  includes(feedback, 'scoringInputOnly: true', 'Outcome feedback evidence: feedback is scoring input only');
  includes(feedback, 'activatesEnforcement: false', 'Outcome feedback evidence: feedback does not activate enforcement');

  for (const expected of [
    'testHoldsWithoutReplayConsumption',
    'testStatusSpecificEvidenceRequirements',
    'testRawResultMaterialMustBeDigestShaped',
  ]) {
    includes(receiptTests, expected, `Receipt test evidence: ${expected} exists`);
  }
  for (const expected of [
    'missing-receipts-after-review',
    'no-downstream-receipts',
    'testIncompleteOrNegativeFeedbackStaysCollecting',
  ]) {
    includes(feedbackTests, expected, `Feedback test evidence: ${expected} exists`);
  }

  excludes(
    receipt,
    /receiptDeadline|expectedReceiptDeadline|missing-receipt-escalation/iu,
    'Receipt evidence: no runtime receipt-deadline escalation exists yet',
  );

  console.log(`F2 downstream receipt omission validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 downstream receipt omission validation tests failed:', error);
  process.exitCode = 1;
}
