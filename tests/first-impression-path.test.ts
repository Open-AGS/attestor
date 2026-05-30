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

function testReadmeHasAPlainFirstThirtySeconds(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '**A gate for high-risk AI actions.**', 'README: opens with the short product promise');
  includes(readme, 'Attestor sits between what an AI wants to do and the system that would do it.', 'README: opens with plain placement language');
  includes(readme, 'It does not try to make the model perfect.', 'README: states what Attestor does not try to solve');
  includes(readme, 'It controls the proposed action before a customer system acts.', 'README: states the proposed-action control point');
  includes(readme, 'Prompts guide. They do not enforce.', 'README: keeps the prompt-control contrast');
  includes(readme, '## One Concrete Workflow', 'README: starts with one concrete workflow before abstract categories');
  includes(readme, 'Refund $8,750 to customer_123.', 'README: shows one high-risk action immediately');
  includes(readme, 'blocked before money moves', 'README: gives one concrete outcome without slash ambiguity');
  includes(
    readme,
    'manager approval is missing, the order/customer binding is incomplete,',
    'README: gives the concrete stop reason',
  );
  includes(readme, 'What the reviewer sees:', 'README: shows what a user sees');
  includes(readme, 'the AI-generated refund request can reach the refund service as an executable action', 'README: shows the without-Attestor failure mode');
  includes(readme, 'the refund is stopped', 'README: shows the with-Attestor result');
  includes(readme, 'the refund path is synthetic and shadow-only', 'README: keeps local-demo no-claims close to the example');
  appearsBefore(readme, '## One Concrete Workflow', '## What Attestor Does', 'README: concrete story comes before broad mechanism');
  appearsBefore(readme, '## Why This Matters Now', '## What Attestor Does', 'README: urgency comes before broad mechanism');
  appearsBefore(readme, '## One Concrete Workflow', '## The Same Pattern Across Actions', 'README: concrete story comes before pack taxonomy');
}

function testReadmeKeepsTheControlBoundaryAndLocalRunPath(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'AI proposes action', 'README: keeps the core flow start');
  includes(readme, 'Attestor checks the proposed action: policy, approval, evidence, allowed scope, freshness, replay, tenant, token, and proof references', 'README: keeps the check vocabulary');
  includes(readme, 'The real service runs only through the customer-owned gate.', 'README: keeps the customer gate boundary');
  includes(readme, 'Without an enforced customer-side gate, gateway, verifier, or adapter, Attestor is advisory evidence.', 'README: makes advisory versus control posture explicit');
  includes(readme, 'Start in shadow mode.', 'README: keeps the adoption wedge simple');
  includes(readme, 'npm ci', 'README: uses reproducible install for the reviewer path');
  includes(readme, 'npm run demo:golden-refund', 'README: shows the first concrete runnable path');
  includes(readme, 'npm run demo:golden-paths', 'README: shows the all-pack local evaluator');
}

function testReadmeKeepsEvaluationTruthBeforeDeepDocs(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '## Current State', 'README: exposes compact current state section');
  includes(readme, 'Package version: 0.2.0-evaluation', 'README: states current package version plainly');
  includes(readme, 'Release stage:   evaluation release', 'README: states evaluation-release status plainly');
  includes(readme, 'Release type:    GitHub pre-release / Golden Path evaluation baseline', 'README: states current release type plainly');
  includes(readme, 'These are examples over one Attestor engine.', 'README: keeps one-engine pack framing');
  includes(readme, 'They are not separate products and not equal-maturity claims.', 'README: keeps pack maturity scoped');
  includes(readme, 'Attestor is a control point, not a data lake.', 'README: states data posture plainly');
  appearsBefore(readme, '## Current State', '## Data Posture', 'README: current state comes before deeper trust posture');
  appearsBefore(readme, '## Decision Model', '## Start Here', 'README: bounded decision vocabulary comes before final links');
}

function testReadmeStaysReadableInsteadOfDense(): void {
  const readme = readProjectFile('README.md');

  excludes(readme, /## Core Operating Loop/u, 'README: should not reintroduce the old dense operating-loop section');
  excludes(readme, /## Architecture: Core And Packs/u, 'README: should not reintroduce the old architecture wall');
  excludes(readme, /## Proof Model/u, 'README: should keep proof details out of the front page');
  excludes(readme, /## Maintainer Reference/u, 'README: should not end with a maintainer link wall');
  excludes(readme, /<details>/u, 'README: should not hide a maintainer link wall');
  excludes(readme, /digest-only canonical shadow fixtures/u, 'README: should not lead with internal fixture language');
  excludes(readme, /runtime assurance smoke over the refund scenarios/u, 'README: should not lead with internal smoke-test language');
  excludes(readme, /\| Layer \| Role \| Current status \|/u, 'README: should not use the old layer table');
  excludes(readme, /\b\d+\s*\/\s*\d+\b/u, 'README: should not expose frozen step fractions');
  excludes(readme, /\bfirst[- ]slice\b/iu, 'README: should not use first-slice posture');
}

function testTryFirstDocKeepsTheBoundaryHonest(): void {
  const doc = readProjectFile('docs', '01-overview', 'try-attestor-first.md');

  includes(doc, 'npm ci', 'Try-first doc: uses reproducible install command');
  includes(doc, 'npm run example:admission', 'Try-first doc: includes the runnable command');
  includes(doc, 'npm run demo:golden-refund -- --determinism-check', 'Try-first doc: includes the determinism check command');
  includes(doc, 'Engine Visibility', 'Try-first doc: includes engine visibility');
  includes(doc, 'npm run example:non-bypassable-gateway', 'Try-first doc: includes the non-bypassable gateway command');
  includes(doc, 'npm run example:action-surface-onboarding', 'Try-first doc: includes the action-surface onboarding example command');
  includes(doc, 'one is admitted', 'Try-first doc: explains admitted path');
  includes(doc, 'one is blocked fail-closed', 'Try-first doc: explains blocked path');
  includes(doc, 'proposed consequence -> Attestor admission decision -> proof refs -> downstream gate', 'Try-first doc: explains the operating shape');
  includes(doc, 'not the generic hosted `POST /api/v1/admissions` route', 'Try-first doc: separates local demo from generic hosted route');
  includes(doc, 'not an apply step for the generated action-surface onboarding packet', 'Try-first doc: separates onboarding packet from apply');
  includes(doc, 'not a public hosted crypto route', 'Try-first doc: does not invent a hosted crypto route');
  includes(doc, 'not a wallet, custody platform, agent runtime, or orchestration layer', 'Try-first doc: keeps Attestor role narrow');
  includes(doc, 'does not auto-detect packs from payload shape', 'Try-first doc: rejects automatic pack detection');
}

function testQuickstartPointsToTheFastPath(): void {
  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');

  includes(quickstart, '[Try Attestor first](try-attestor-first.md)', 'Quickstart: links to the shortest first run');
  includes(quickstart, '[Non-bypassable gateway demo](non-bypassable-gateway-demo.md)', 'Quickstart: links to the protected adapter demo');
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
  includes(packageJson.scripts['example:non-bypassable-gateway'], 'examples/non-bypassable-gateway-demo.ts', 'Package: exposes the non-bypassable gateway example');
  includes(packageJson.scripts['example:action-surface-onboarding'], 'examples/action-surface-onboarding/refund.openapi.json', 'Package: exposes the action-surface onboarding example');
  includes(packageJson.scripts['test:first-impression-path'], 'tests/first-impression-path.test.ts', 'Package: exposes the first impression guard');
  includes(packageJson.scripts.test, 'scripts/run/run-suite.mjs test', 'Package: npm test delegates to the suite runner');
  includes(packageJson.scripts.verify, 'scripts/run/run-suite.mjs verify', 'Package: verify delegates to the suite runner');
}

testReadmeHasAPlainFirstThirtySeconds();
testReadmeKeepsTheControlBoundaryAndLocalRunPath();
testReadmeKeepsEvaluationTruthBeforeDeepDocs();
testReadmeStaysReadableInsteadOfDense();
testTryFirstDocKeepsTheBoundaryHonest();
testQuickstartPointsToTheFastPath();
testDemoOutputIsPitchReady();
testPackageScriptsProtectThePath();

console.log(`First impression path tests: ${passed} passed, 0 failed`);
