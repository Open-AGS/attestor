import { strict as assert } from 'node:assert';
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

const signingDocs = readProjectFile('docs', '06-signing', 'signing-verification.md');
const buildoutDocs = readProjectFile('docs', '02-architecture', 'release-enforcement-plane-buildout.md');
const validationDoc = readProjectFile('docs', 'audit', 'f5-transparency-log-claim-boundary-validation.md');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const keylessSigner = readProjectFile('src', 'signing', 'keyless-signer.ts');

includes(
  signingDocs,
  'Attestor does not implement a public Rekor-equivalent transparency log today.',
  'F5 transparency boundary: signing docs state the no-Rekor boundary',
);
includes(
  signingDocs,
  'Internal release-enforcement transparency receipts are Attestor receipts, not a',
  'F5 transparency boundary: internal receipts are separated from public logs',
);
includes(
  buildoutDocs,
  'These receipts are not a public Rekor-equivalent transparency log.',
  'F5 transparency boundary: release-enforcement buildout avoids public-log overclaim',
);
includes(
  validationDoc,
  'F5-A6 accepted limitation',
  'F5 transparency boundary: validation doc records accepted limitation status',
);
includes(
  validationDoc,
  'do not claim Rekor-equivalent witness semantics',
  'F5 transparency boundary: validation doc carries the no-overclaim rule',
);
includes(
  keylessSigner,
  'No transparency log (yet)',
  'F5 transparency boundary: signer source still marks transparency log absent',
);
includes(
  tracker,
  'F5-A6 transparency log missing | `accepted-limitation`',
  'F5 transparency boundary: tracker marks F5-A6 as accepted limitation',
);
excludes(
  `${signingDocs}\n${buildoutDocs}`,
  /\b(public|Rekor-equivalent|external)\s+transparency log\s+(is|exists|provides|proves)\b/iu,
  'F5 transparency boundary: public docs do not claim a public transparency log exists',
);

console.log(`F5 transparency log claim boundary validation tests: ${passed} passed, 0 failed`);
