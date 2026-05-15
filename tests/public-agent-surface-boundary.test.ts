import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function trackedFiles(): string {
  return execFileSync('git', ['ls-files'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).replace(/\r\n/gu, '\n');
}

function ignoredPath(path: string): string {
  return execFileSync('git', ['check-ignore', '-v', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).replace(/\r\n/gu, '\n');
}

const gitignore = readProjectFile('.gitignore');
const tracked = trackedFiles();
const packageJson = readProjectFile('package.json');

for (const path of [
  'AGENTS.md',
  'CLAUDE.md',
  'Claude.md',
  'claude.md',
  '.claude/',
  '.github/copilot-instructions.md',
  'docs/ai/',
]) {
  includes(gitignore, path, `Public agent surface: ${path} is ignored`);
}

for (const path of [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'docs/ai/attestor-assurance-engineering.md',
  'docs/ai/playbooks/cold-audit.md',
]) {
  assert.ok(!tracked.split('\n').includes(path), `Public agent surface: ${path} is not tracked`);
  passed += 1;
}

for (const path of [
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'docs/ai/',
]) {
  includes(ignoredPath(path), path, `Public agent surface: ${path} is ignored by git`);
}

excludes(packageJson, /test:agent-guidance-contract/u, 'Public agent surface: private agent-guidance test is not exposed');
includes(packageJson, '"test:public-agent-surface-boundary"', 'Public agent surface: boundary test is exposed');

console.log(`Public agent surface boundary tests: ${passed} passed, 0 failed`);
