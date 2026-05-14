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
  const validation = readProjectFile('docs', 'audit', 'f7-shadow-bundle-signing-boundary-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const publication = readProjectFile(
    'src',
    'consequence-admission',
    'shadow-policy-bundle-publication.ts',
  );
  const publicationTests = readProjectFile('tests', 'shadow-policy-bundle-publication.test.ts');
  const packageJson = readProjectFile('package.json');

  includes(validation, '# F7 Shadow Bundle Signing Boundary Validation', 'F7 signing-boundary validation: title exists');
  includes(validation, 'repository slice for F7-S9', 'F7 signing-boundary validation: scope is explicit');
  includes(validation, '| F7-S9 shadow bundle signing boundary | `partial` | `fixed` |', 'F7 signing-boundary validation: S9 transition is recorded');
  includes(validation, 'one planned', 'F7 signing-boundary validation: remaining queue count is explicit');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 8 | 2 | 0 |', 'Tracker: F7 count is updated after signing-boundary slice');
  includes(tracker, 'Remaining F7 queue after shadow readiness and claim alignment: 0 planned', 'Tracker: F7 remaining count is updated');
  includes(tracker, 'F7-S9 shadow bundle signing boundary | `fixed`', 'Tracker: F7-S9 is fixed');
  includes(tracker, 'F7 Shadow Bundle Signing Boundary Validation', 'Tracker: F7 signing-boundary validation evidence is linked');

  includes(publication, 'SHADOW_POLICY_BUNDLE_PRODUCTION_SIGNING_BOUNDARIES', 'Source: production signing boundary set exists');
  includes(publication, "'external-kms-hsm'", 'Source: external KMS/HSM is the production signing boundary');
  includes(publication, 'productionSigningBoundaryRequired', 'Source: production signing boundary requirement is carried');
  includes(publication, 'productionSigningBoundaryReady', 'Source: production signing boundary readiness is carried');
  includes(publication, 'production-signing-boundary-invalid', 'Source: invalid production signing boundary blocks activation');

  includes(publicationTests, 'runtime production claim is downgraded to evaluation', 'Tests: runtime production claim is downgraded');
  includes(publicationTests, 'invalid production signing boundary is blocked', 'Tests: invalid production boundary is blocked');
  includes(publicationTests, 'external KMS/HSM signature is production-signed', 'Tests: external KMS/HSM production boundary is accepted');

  includes(packageJson, '"test:f7-shadow-bundle-signing-boundary-validation"', 'Package: F7 signing-boundary validation script is exposed');

  ok(validation.split('\n').length > 25, 'F7 signing-boundary validation: document has enough detail');

  console.log(`F7 shadow bundle signing boundary validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 shadow bundle signing boundary validation tests failed:', error);
  process.exitCode = 1;
}
