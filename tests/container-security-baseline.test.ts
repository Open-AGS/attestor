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

function testDockerBaseImageIsDigestPinned(): void {
  const dockerfile = readProjectFile('Dockerfile');
  const nodeDigestRef = 'node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f';

  includes(
    dockerfile,
    `FROM ${nodeDigestRef} AS build`,
    'Container security: build image pins the Node Alpine base image by digest',
  );
  includes(
    dockerfile,
    `FROM ${nodeDigestRef}`,
    'Container security: runtime image pins the Node Alpine base image by digest',
  );
}

function testComposeHealthchecksUseNodeRuntime(): void {
  const compose = `${readProjectFile('docker-compose.yml')}\n${readProjectFile('docker-compose.ha.yml')}`;

  includes(
    compose,
    "require('node:http').get('http://localhost:3700/api/v1/ready'",
    'Container security: compose healthchecks use Node instead of an external wget applet',
  );
  excludes(
    compose,
    'wget -q --spider',
    'Container security: compose healthchecks do not depend on wget availability',
  );
}

function testHaComposeRequiresExplicitDatabaseCredentials(): void {
  const compose = readProjectFile('docker-compose.ha.yml');

  includes(
    compose,
    '${ATTESTOR_DB_PASSWORD:?set ATTESTOR_DB_PASSWORD}',
    'Container security: HA compose requires explicit database credentials',
  );
  excludes(
    compose,
    'attestor:attestor@postgres',
    'Container security: HA compose does not embed the default attestor database password in connection URLs',
  );
  excludes(
    compose,
    'POSTGRES_PASSWORD: attestor',
    'Container security: HA compose does not start PostgreSQL with the default attestor password',
  );
}

testDockerBuildInstallStaysScriptless();
testMultiRoleImageDoesNotCarryApiOnlyHealthcheck();
testDockerBaseImageIsDigestPinned();
testComposeHealthchecksUseNodeRuntime();
testHaComposeRequiresExplicitDatabaseCredentials();

console.log(`Container security baseline tests: ${passed} passed, 0 failed`);
