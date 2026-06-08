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

  includes(readme, '**Control infrastructure for high-risk AI-driven operations.**', 'README: opens with the short product promise');
  includes(readme, 'Attestor sits between an AI-prepared operation and the system that would execute it.', 'README: opens with plain placement language');
  includes(readme, 'Prompts can guide behavior, but they cannot enforce it', 'README: keeps the prompt-control contrast');
  includes(readme, 'Unsafe requests can come from hallucination, stale context, poisoned tool output', 'README: explains why a proposed request can be unsafe');
  includes(readme, 'Before anything runs, Attestor checks', 'README: names pre-execution checks without overclaiming');
  includes(readme, 'With a customer-owned gate in place, the downstream action stays behind', 'README: keeps the no-bypass posture tied to the customer gate');
  includes(readme, 'The trail records what was proposed', 'README: shows that the decision stays reviewable');
  excludes(readme, /## One Concrete Workflow/u, 'README: keeps the concrete workflow behind the first-run guide');
  includes(readme, '## Why This Matters Now', 'README: moves from placement into urgency before mechanism');
  includes(readme, 'Attestor translates AI intent into a structured consequence, then reduces it to', 'README: states the consequence translation shape');
  includes(readme, 'a decision, gate/readiness status, and proof references.', 'README: avoids implying a live gate outcome before customer gate placement');
  includes(readme, 'gate-placement/readiness plan', 'README: frames runtime signals as placement/readiness review, not gate deployment');
  includes(readme, 'docs/02-architecture/runtime-signal-handling.md#rs12-example-path', 'README: links the runtime signal example path directly');
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md)', 'README: sends the concrete first run to the first-run guide');
  appearsBefore(readme, '## Why This Matters Now', '## What It Does', 'README: urgency comes before broad mechanism');
  appearsBefore(readme, '## What It Does', '## The Same Pattern Across Operations', 'README: mechanism comes before pack taxonomy');
}

function testReadmeKeepsTheControlBoundaryAndLocalRunPath(): void {
  const readme = readProjectFile('README.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');

  includes(readme, 'proposes an operation', 'README: keeps the core flow start');
  includes(readme, 'It checks policy, approval, evidence, allowed scope, freshness, replay, tenant', 'README: keeps the check vocabulary');
  includes(readme, 'The real service should run only through the customer-owned gate.', 'README: keeps the customer gate boundary');
  includes(readme, 'Without a customer-side gate, gateway, verifier, or adapter, the decision is', 'README: makes advisory versus control posture explicit');
  includes(readme, '### Run Attestor in shadow pilot mode - and map what your AI agents are trying to do in the shadow of your systems.', 'README: restores the shadow pilot path before the operation table');
  includes(readme, 'Observe mode maps every action your agents would take', 'README: explains shadow mode as observe-first visibility');
  includes(readme, '[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md)', 'README: links the shadow pilot path directly');
  appearsBefore(readme, '### Run Attestor in shadow pilot mode', '## The Same Pattern Across Operations', 'README: shadow mode appears before the operation-class table');
  excludes(readme, /\[Run the local evaluation path\]\(docs\/01-overview\/demo-guide\.md\)/u, 'README: keeps local evaluation behind the first-run and navigator paths');
  includes(readme, '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)', 'README: links the integration guide for customer-gate placement');
  includes(readme, '[Repository navigator](docs/01-overview/repository-navigator.md)', 'README: routes deeper proof and maintainer docs through the navigator');
  includes(demoGuide, 'npm run demo:golden-paths', 'Demo guide: shows the all-pack local evaluator');
  includes(demoGuide, 'npm ci', 'Demo guide: keeps reproducible install for the reviewer path');
  includes(demoGuide, 'npm run demo:golden-refund', 'Demo guide: shows the first concrete runnable path');
  includes(demoGuide, '## Five-Minute Developer Path', 'Demo guide: opens with the short developer path');
  includes(demoGuide, 'local examples', 'Demo guide: names the local runnable examples');
  includes(demoGuide, 'hosted/API shape', 'Demo guide: names the hosted route shape');
  includes(demoGuide, 'customer app', 'Demo guide: names the customer-side placement');
  includes(demoGuide, 'POST /api/v1/admissions', 'Demo guide: shows the admission route shape');
  includes(demoGuide, 'assertConsequenceAdmissionGateAllows', 'Demo guide: shows the gate call');
  includes(demoGuide, 'proof trail after the decision', 'Demo guide: keeps proof output close to the flow');
  excludes(readme, /## Local Demos/u, 'README: moves the long demo table out of the front page');
}

function testReadmeKeepsEvaluationTruthBeforeDeepDocs(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '## Current State', 'README: exposes compact current state section');
  includes(readme, 'Package version: 0.3.0-evaluation', 'README: states current package version plainly');
  includes(readme, 'Release stage:   evaluation release', 'README: states evaluation-release status plainly');
  includes(readme, 'Release type:    GitHub pre-release / multi-path evaluation baseline', 'README: states current release type plainly');
  includes(readme, 'The same gate can sit before these operation classes:', 'README: keeps cross-operation framing concise');
  includes(readme, 'This is an evaluation release.', 'README: keeps evaluation no-claim near current state');
  includes(readme, '## Data Posture', 'README: exposes the data boundary before first-reader links');
  includes(readme, 'Attestor is a control point, not a data lake.', 'README: keeps raw customer data posture visible');
  includes(readme, 'structured request', 'README: states bounded request context plainly');
  includes(readme, 'not raw customer data', 'README: states data minimization plainly');
  includes(readme, 'If you are new, follow this order: [local run](docs/01-overview/try-attestor-first.md), [shadow pilot](docs/01-overview/shadow-event-payload-examples.md), then [customer gate](docs/01-overview/customer-admission-gate.md).', 'README: Start Here gives first readers a linked order');
  includes(readme, '[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md) - observe one real action surface before enforcing anything.', 'README: Start Here includes observe mode before integration');
  includes(readme, 'Use boundaries: [License and use](docs/01-overview/license-and-use.md) and [Security Policy](SECURITY.md).', 'README: use boundaries are separated from main onboarding paths');
  appearsBefore(readme, '[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md) - observe one real action surface before enforcing anything.', '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)', 'README: observe path comes before integration path');
  appearsBefore(readme, '## Current State', '## Data Posture', 'README: current state comes before data posture');
  appearsBefore(readme, '## Data Posture', '## Start Here', 'README: data posture comes before first-reader links');
  appearsBefore(readme, '## Current State', '## Start Here', 'README: current state comes before first-reader links');
  excludes(readme, /## Decision Model/u, 'README: should not keep a separate decision-model section');
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
  includes(doc, 'npm run example:action-surface-integration-kit', 'Try-first doc: includes the integration kit example command');
  includes(doc, 'one is admitted', 'Try-first doc: explains admitted path');
  includes(doc, 'one is blocked fail-closed', 'Try-first doc: explains blocked path');
  includes(doc, 'proposed consequence -> Attestor admission decision -> proof refs -> downstream gate', 'Try-first doc: explains the operating shape');
  includes(doc, 'not the generic hosted `POST /api/v1/admissions` route', 'Try-first doc: separates local demo from generic hosted route');
  includes(doc, 'not an apply step for the generated action-surface onboarding packet', 'Try-first doc: separates onboarding packet from apply');
  includes(doc, 'not a public hosted crypto route', 'Try-first doc: does not invent a hosted crypto route');
  includes(doc, 'not a wallet, custody platform, agent runtime, or orchestration layer', 'Try-first doc: keeps Attestor role narrow');
  includes(doc, 'does not auto-detect packs from payload shape', 'Try-first doc: rejects automatic pack detection');
  includes(doc, 'Need current package/adapter boundaries?', 'Try-first doc: keeps finance and crypto framed as boundaries');
  excludes(doc, /Need the finance and crypto entry paths\?/u, 'Try-first doc: avoids making finance and crypto sound like separate products');
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
  includes(packageJson.scripts['example:action-surface-integration-kit'], 'scripts/render/render-action-surface-integration-kit.ts', 'Package: exposes the action-surface integration kit example');
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
