import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testTenantAdminNeverPrintsApiKeyMaterial(): void {
  const source = readProjectFile('src', 'service', 'tenant-admin.ts');

  includes(
    source,
    'Secret material is never printed to the console. Use --out to write it once to a local file.',
    'Tenant admin secret output: CLI help documents file-only secret delivery',
  );
  includes(
    source,
    "writeFileSync(absolutePath, `${secret}\\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });",
    'Tenant admin secret output: secret files are owner-only and never overwrite existing paths',
  );
  includes(
    source,
    "reportSecretDelivery(apiKey, outputPath, 'API key');",
    'Tenant admin secret output: issued keys use the redacted delivery helper',
  );
  includes(
    source,
    "reportSecretDelivery(apiKey, outputPath, 'New API key');",
    'Tenant admin secret output: rotated keys use the redacted delivery helper',
  );
  includes(
    source,
    "reportSecretDelivery(apiKey, outputPath, 'Recovered API key');",
    'Tenant admin secret output: recovered keys use the redacted delivery helper',
  );

  excludes(source, /console\.(?:log|error|warn)\(\s*apiKey\s*\)/u, 'Tenant admin secret output: raw API keys are not logged');
  excludes(source, /console\.(?:log|error|warn)\([^)]*apiKeyPreview/iu, 'Tenant admin secret output: API key previews are not logged');
  excludes(source, /console\.(?:log|error|warn)\([^)]*(?:show once|copy now)/iu, 'Tenant admin secret output: logs do not instruct console copy of secrets');
}

function testPackageExposesTenantAdminGuard(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  assert.equal(
    pkg.scripts['test:tenant-admin-secret-output'],
    'tsx tests/tenant-admin-secret-output.test.ts',
    'Tenant admin secret output: package.json exposes the drift guard',
  );
  passed += 1;
}

testTenantAdminNeverPrintsApiKeyMaterial();
testPackageExposesTenantAdminGuard();

console.log(`Tenant admin secret output tests: ${passed} passed, 0 failed`);
