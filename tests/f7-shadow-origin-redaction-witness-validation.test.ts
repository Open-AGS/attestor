import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const validation = readProjectFile('docs', 'audit', 'f7-shadow-origin-redaction-witness-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const shadowEvents = readProjectFile('src', 'consequence-admission', 'shadow-events.ts');
  const shadowEventTests = readProjectFile('tests', 'shadow-admission-events.test.ts');
  const packageJson = readProjectFile('package.json');

  includes(validation, '# F7 Shadow Event Origin And Redaction Witness Validation', 'F7 witness validation: title exists');
  includes(validation, 'repository slice for F7-S1 and F7-S2', 'F7 witness validation: scope is explicit');
  includes(validation, 'does not claim an external transparency log', 'F7 witness validation: no external-log overclaim');
  includes(validation, '| F7-S1 shadow event injection without origin-binding | `partial` | `fixed` |', 'F7 witness validation: S1 transition is recorded');
  includes(validation, '| F7-S2 operator-supplied redaction self-attest | `partial` | `fixed` |', 'F7 witness validation: S2 transition is recorded');
  includes(validation, 'five planned', 'F7 witness validation: remaining queue count is explicit');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 6 | 4 | 0 |', 'Tracker: F7 count is updated after high-risk activation slice');
  includes(tracker, 'Remaining F7 queue after high-risk two-person activation: 2 planned', 'Tracker: F7 remaining count is updated');
  includes(tracker, 'F7-S1 shadow event injection without origin-binding | `fixed`', 'Tracker: F7-S1 is fixed');
  includes(tracker, 'F7-S2 operator-supplied redaction self-attest | `fixed`', 'Tracker: F7-S2 is fixed');
  includes(tracker, 'F7 Shadow Event Origin And Redaction Witness Validation', 'Tracker: F7 witness validation evidence is linked');

  includes(shadowEvents, 'SHADOW_ADMISSION_ORIGIN_WITNESS_VERSION', 'Source: origin witness version is defined');
  includes(shadowEvents, 'SHADOW_ADMISSION_REDACTION_WITNESS_VERSION', 'Source: redaction witness version is defined');
  includes(shadowEvents, 'originWitnessDigest', 'Source: origin witness digest is on the event');
  includes(shadowEvents, 'redactionWitnessDigest', 'Source: redaction witness digest is on the event');
  includes(shadowEvents, 'CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION', 'Source: redaction witness binds policy version');
  includes(shadowEvents, 'rawObservedValuesStored: false', 'Source: redaction witness records raw observed values boundary');
  includes(shadowEvents, 'admission-response-digest-binding', 'Source: origin witness kind is explicit');
  includes(shadowEvents, 'redaction-policy-digest-binding', 'Source: redaction witness kind is explicit');

  includes(shadowEventTests, 'origin witness binds admission digest', 'Tests: origin witness digest binding is asserted');
  includes(shadowEventTests, 'redaction witness binds policy version', 'Tests: redaction policy version binding is asserted');
  includes(shadowEventTests, 'redaction witness declares raw observed values are not stored', 'Tests: raw observed value boundary is asserted');

  includes(packageJson, '"test:f7-shadow-origin-redaction-witness-validation"', 'Package: F7 witness validation script is exposed');

  ok(validation.split('\n').length > 40, 'F7 witness validation: document has enough detail');

  console.log(`F7 shadow origin/redaction witness validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 shadow origin/redaction witness validation tests failed:', error);
  process.exitCode = 1;
}
