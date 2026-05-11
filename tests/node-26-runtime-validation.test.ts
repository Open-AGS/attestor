import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageJson = {
  readonly engines?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
};

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function readPackageJson(): PackageJson {
  return JSON.parse(readProjectFile('package.json')) as PackageJson;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nUnexpected text: ${unexpected}`);
  passed += 1;
}

function workflowUsesNode22Only(path: string): void {
  const workflow = readProjectFile(...path.split('/'));
  includes(
    workflow,
    'node-version: 22',
    `Node 26 runtime validation: ${path} keeps the reviewer/runtime CI baseline on Node 22`,
  );
  excludes(
    workflow,
    'node-version: 26',
    `Node 26 runtime validation: ${path} does not claim Node 26 CI compatibility yet`,
  );
}

function testRuntimeContractStaysNode22(): void {
  const packageJson = readPackageJson();
  const security = readProjectFile('SECURITY.md');

  equal(
    packageJson.engines?.node,
    '>=22 <23',
    'Node 26 runtime validation: package.json keeps the declared runtime contract on Node 22',
  );
  includes(
    security,
    'The runtime and type baseline is Node 22.',
    'Node 26 runtime validation: public security baseline names Node 22',
  );
}

function testDockerfileDoesNotAcceptNode26Current(): void {
  const dockerfile = readProjectFile('Dockerfile');
  const node22Digest =
    'node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f';

  includes(
    dockerfile,
    `FROM ${node22Digest} AS build`,
    'Node 26 runtime validation: build stage remains on the reviewed Node 22 Alpine digest',
  );
  includes(
    dockerfile,
    `FROM ${node22Digest}`,
    'Node 26 runtime validation: runtime stage remains on the reviewed Node 22 Alpine digest',
  );
  excludes(
    dockerfile,
    'node:26-alpine',
    'Node 26 runtime validation: Node 26 Current is not accepted as the production container baseline',
  );
}

function testReviewerWorkflowsDoNotOverclaimNode26(): void {
  for (const path of [
    '.github/workflows/evaluation-smoke.yml',
    '.github/workflows/security-scan.yml',
    '.github/workflows/full-verify.yml',
    '.github/workflows/release-provenance.yml',
  ]) {
    workflowUsesNode22Only(path);
  }
}

function testTrackerRecordsDecisionAndFutureGate(): void {
  const docs = readProjectFile('docs', '02-architecture', 'crypto-engine-hardening-ii.md');
  const packageJson = readPackageJson();

  includes(
    docs,
    'Node.js 26 is `Current`, while production applications should only use Active LTS or Maintenance LTS releases.',
    'Node 26 runtime validation: tracker records the Node release-status blocker',
  );
  includes(
    docs,
    'Node 26 remains a no-go for the production Docker baseline until it reaches LTS',
    'Node 26 runtime validation: tracker records the no-go decision',
  );
  includes(
    docs,
    'Docker build plus API/worker runtime smoke',
    'Node 26 runtime validation: tracker requires container smoke before future acceptance',
  );
  includes(
    docs,
    '| 09 | complete | Node 26 runtime validation |',
    'Node 26 runtime validation: tracker marks Step 09 complete with a no-go outcome',
  );
  equal(
    packageJson.scripts?.['test:node-26-runtime-validation'],
    'tsx tests/node-26-runtime-validation.test.ts',
    'Node 26 runtime validation: package.json exposes the focused runtime guard',
  );
}

testRuntimeContractStaysNode22();
testDockerfileDoesNotAcceptNode26Current();
testReviewerWorkflowsDoNotOverclaimNode26();
testTrackerRecordsDecisionAndFutureGate();

console.log(`node-26-runtime-validation: ${passed} assertions passed`);
