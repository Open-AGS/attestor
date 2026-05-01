import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFirstUsefulAdmissionDemo } from '../examples/first-useful-admission-demo.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function appearsBefore(content: string, earlier: string, later: string, message: string): void {
  const earlierIndex = content.indexOf(earlier);
  const laterIndex = content.indexOf(later);
  assert.ok(earlierIndex >= 0, `${message}\nMissing earlier marker: ${earlier}`);
  assert.ok(laterIndex >= 0, `${message}\nMissing later marker: ${later}`);
  assert.ok(
    earlierIndex < laterIndex,
    `${message}\nExpected "${earlier}" to appear before "${later}"`,
  );
  passed += 1;
}

function testReadmeHasAFirstImpressionPath(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'AI is already taking actions.', 'README: opens with a sharper outside-reader hook');
  includes(readme, '## TL;DR', 'README: exposes a short top-level summary');
  includes(readme, 'AI proposes -> Attestor decides -> only safe actions execute.', 'README: explains the control flow in one line');
  includes(readme, 'Attestor does not replace your system.', 'README: explains placement before architecture');
  includes(readme, '## Why it matters', 'README: explains urgency before architecture');
  includes(readme, '## Example', 'README: gives a concrete blocked-action example');
  includes(readme, '## Decisions', 'README: makes the decision vocabulary prominent');
  includes(readme, '## Proof', 'README: surfaces proof as a first-class concept near the top');
  includes(readme, 'Proof can be stored, audited, and independently verified later.', 'README: explains why proof matters');
  includes(readme, '## What you can do with Attestor', 'README: surfaces concrete use cases before architecture');
  includes(readme, '## Try it in 60 seconds', 'README: exposes a fast first run near the top');
  includes(readme, 'npm run example:admission', 'README: shows the first runnable command');
  includes(readme, 'one path is admitted with proof references', 'README: explains admitted proof refs');
  includes(readme, 'one path is blocked fail-closed', 'README: explains blocked fail-closed path');
  includes(readme, 'the downstream gate only proceeds when the decision allows it', 'README: explains downstream gate behavior');
  includes(readme, 'npm run proof:surface', 'README: exposes the proof surface command near the first proof explanation');
  includes(readme, 'Attestor is designed as a control point, not a data lake.', 'README: explains data handling posture early');
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md)', 'README: links to the guided first run');
  appearsBefore(readme, '## Try it in 60 seconds', '## One product, modular packs', 'README: keeps the runnable path before product packaging');
  appearsBefore(readme, 'npm run proof:surface', '## One product, modular packs', 'README: keeps proof inspection before platform packaging');
  appearsBefore(readme, '## Data and security posture', '## One product, modular packs', 'README: explains trust boundaries before platform packaging');
}

function testTryFirstDocKeepsTheBoundaryHonest(): void {
  const doc = readProjectFile('docs', '01-overview', 'try-attestor-first.md');

  includes(doc, 'npm run example:admission', 'Try-first doc: includes the runnable command');
  includes(doc, 'one is admitted', 'Try-first doc: explains admitted path');
  includes(doc, 'one is blocked fail-closed', 'Try-first doc: explains blocked path');
  includes(doc, 'proposed consequence -> Attestor admission decision -> proof refs -> downstream gate', 'Try-first doc: explains the operating shape');
  includes(doc, 'not a universal hosted admission route', 'Try-first doc: does not invent a universal route');
  includes(doc, 'not a public hosted crypto route', 'Try-first doc: does not invent a hosted crypto route');
  includes(doc, 'not a wallet, custody platform, agent runtime, or orchestration layer', 'Try-first doc: keeps Attestor role narrow');
  includes(doc, 'does not auto-detect packs from payload shape', 'Try-first doc: rejects automatic pack detection');
}

function testQuickstartPointsToTheFastPath(): void {
  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');

  includes(quickstart, '[Try Attestor first](try-attestor-first.md)', 'Quickstart: links to the shortest first run');
}

function testDemoOutputIsPitchReady(): void {
  const { output } = runFirstUsefulAdmissionDemo();

  includes(output, 'Input:', 'Demo: output groups proposed consequence input');
  includes(output, 'Attestor decision:', 'Demo: output groups the admission result');
  includes(output, 'Proof refs:', 'Demo: output groups proof references');
  includes(output, 'Downstream result:', 'Demo: output groups downstream gate');
  includes(output, 'canonical: admit', 'Demo: output shows admit');
  includes(output, 'canonical: block', 'Demo: output shows block');
  includes(output, 'PROCEED ->', 'Demo: output shows proceed result');
  includes(output, 'HOLD ->', 'Demo: output shows hold result');
  excludes(output, /POST\s+\/api\/v1\/admit/u, 'Demo: output does not invent a universal hosted admission route');
}

function testPackageScriptsProtectThePath(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  includes(packageJson.scripts['example:admission'], 'examples/first-useful-admission-demo.ts', 'Package: exposes the admission example');
  includes(packageJson.scripts['test:first-impression-path'], 'tests/first-impression-path.test.ts', 'Package: exposes the first impression guard');
  includes(packageJson.scripts.test, 'scripts/run-suite.mjs test', 'Package: npm test delegates to the suite runner');
  includes(packageJson.scripts.verify, 'scripts/run-suite.mjs verify', 'Package: verify delegates to the suite runner');
}

testReadmeHasAFirstImpressionPath();
testTryFirstDocKeepsTheBoundaryHonest();
testQuickstartPointsToTheFastPath();
testDemoOutputIsPitchReady();
testPackageScriptsProtectThePath();

console.log(`First impression path tests: ${passed} passed, 0 failed`);
