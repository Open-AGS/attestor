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

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nUnexpected text: ${unexpected}`);
  passed += 1;
}

function testDockerBuildInstallStaysScriptless(): void {
  const dockerfile = readProjectFile('Dockerfile');

  includes(
    dockerfile,
    'RUN npm ci --ignore-scripts --no-audit --no-fund && npm cache clean --force',
    'Container security: Docker build dependency install disables lifecycle scripts and cleans npm cache',
  );
  excludes(
    dockerfile,
    '\nRUN npm ci\n',
    'Container security: Docker build does not run dependency lifecycle scripts implicitly',
  );
}

function testMultiRoleImageDoesNotCarryApiOnlyHealthcheck(): void {
  const dockerfile = readProjectFile('Dockerfile');

  includes(
    dockerfile,
    'Used by both API and Worker services (different CMD)',
    'Container security: Dockerfile documents the shared API/worker image contract',
  );
  excludes(
    dockerfile,
    'HEALTHCHECK',
    'Container security: shared image does not bake in an API-only healthcheck that would break worker containers',
  );
}

testDockerBuildInstallStaysScriptless();
testMultiRoleImageDoesNotCarryApiOnlyHealthcheck();

console.log(`Container security baseline tests: ${passed} passed, 0 failed`);
