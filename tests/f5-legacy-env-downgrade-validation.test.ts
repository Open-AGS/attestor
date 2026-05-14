import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string | RegExp, message: string): void {
  if (typeof unexpected === 'string') {
    assert.ok(!content.includes(unexpected), `${message}\nDid not expect to find: ${unexpected}`);
  } else {
    assert.doesNotMatch(content, unexpected, message);
  }
  passed += 1;
}

try {
  const cli = readProjectFile('src', 'signing', 'verify-cli.ts');
  const route = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-verification-routes.ts');
  const signingDoc = readProjectFile('docs', '06-signing', 'signing-verification.md');
  const auditDoc = readProjectFile('docs', 'audit', 'f5-legacy-env-downgrade-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(cli, "--allow-legacy-verify", 'F5 legacy env validation: explicit CLI flag remains visible');
  excludes(cli, 'ATTESTOR_ALLOW_LEGACY', 'F5 legacy env validation: CLI env downgrade is removed');
  excludes(route, 'ATTESTOR_ALLOW_LEGACY_API', 'F5 legacy env validation: API env downgrade is removed');
  excludes(route, 'legacyEscape', 'F5 legacy env validation: API no longer returns a legacy env escape hint');
  includes(
    route,
    'PKI trust chain required for verification.',
    'F5 legacy env validation: API still fails closed without PKI material',
  );
  includes(
    signingDoc,
    'no env-var downgrade is supported',
    'F5 legacy env validation: docs state no env-var downgrade',
  );
  excludes(
    signingDoc,
    /ATTESTOR_ALLOW_LEGACY(_API)?=true/u,
    'F5 legacy env validation: docs no longer document legacy env toggles',
  );
  includes(
    auditDoc,
    'Status: `fixed` for the scoped repository finding.',
    'F5 legacy env validation: audit doc has scoped fixed status',
  );
  includes(
    tracker,
    'F5-A2 legacy flat verify escape via env | `fixed`',
    'F5 legacy env validation: tracker marks F5-A2 fixed',
  );
  includes(
    packageJson,
    '"test:f5-legacy-env-downgrade-validation"',
    'F5 legacy env validation: package script is exposed',
  );

  console.log(`F5 legacy env downgrade validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F5 legacy env downgrade validation tests failed:', error);
  process.exitCode = 1;
}
