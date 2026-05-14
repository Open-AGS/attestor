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

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(tracker, '# Attestor Audit Remediation Tracker', 'Tracker: title is present');
  includes(tracker, 'not a certification', 'Tracker: no-certification disclaimer is present');
  includes(tracker, '`origin/master` is the source of truth', 'Tracker: origin/master rule is present');
  includes(tracker, 'Estimated remaining work after this tracker lands: about 34 to 42', 'Tracker: remaining estimate is explicit');

  for (const pr of ['#220', '#291', '#292', '#293', '#294', '#295', '#296', '#297', '#298', '#299', '#300']) {
    includes(tracker, pr, `Tracker: ${pr} is referenced`);
  }

  for (const group of [
    'F1 Threat-Model Foundation',
    'F2 Agentic Consequence Surface',
    'F3 Cross-Cutting Guard Readiness',
    'F4 OWASP LLM / Input Surface Redo',
    'F5 Signing Layer',
    'Final Docs And Claim Alignment',
  ]) {
    includes(tracker, group, `Tracker: ${group} section exists`);
  }

  includes(tracker, 'F2-AG-4 multi-agent delegation confusion', 'Tracker: completed F2 remediation is named');
  includes(tracker, 'F3-CC-10 agentic supply-chain guard missing', 'Tracker: final F3 item is tracked');
  includes(tracker, 'F4-LLM10-B retry-attempt ledger storage claim', 'Tracker: detailed F4 redo is tracked');
  includes(tracker, 'F5-A6 transparency log missing', 'Tracker: F5 transparency limitation is tracked');
  includes(tracker, 'F5-NEW-4 duplicate verify helper calls in CLI', 'Tracker: detailed F5 redo is tracked');
  includes(tracker, 'No `needs-revalidation` row can remain before starting F6', 'Tracker: F6 gate is explicit');
  excludes(tracker, /production ready|certified|fully complete/iu, 'Tracker: avoids production/certification overclaim wording');
  includes(packageJson, '"test:audit-remediation-tracker"', 'Package: tracker test script is exposed');

  ok(tracker.split('\n').length > 120, 'Tracker: enough rows to cover supplied audit reports');
  console.log(`Audit remediation tracker tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Audit remediation tracker tests failed:', error);
  process.exitCode = 1;
}
