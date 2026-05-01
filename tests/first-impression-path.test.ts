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

  includes(readme, 'AI Action Authorization Layer.', 'README: opens with the AI action authorization category');
  includes(readme, 'The trust boundary is not the model response. The trust boundary is the action that reaches a real system.', 'README: frames the risk before architecture');
  includes(readme, 'Attestor sits at that boundary.', 'README: explains placement before architecture');
  includes(readme, 'Start in shadow mode. See what your AI agents would have done before you let them act.', 'README: makes shadow mode visible immediately');
  includes(readme, 'It is the authorization layer before a proposed AI action becomes a real-world consequence.', 'README: keeps the gate framing cold and direct');
  includes(readme, 'If policy, authority, evidence, freshness, scope, or verification cannot close, the consequence does not proceed silently.', 'README: explains the fail-closed gateway result');
  includes(readme, 'Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system.', 'README: keeps replacement non-claim near the top');
  includes(readme, '## Current Status', 'README: exposes the evaluation boundary near the top');
  includes(readme, 'not a finished public SaaS', 'README: avoids public SaaS overclaim');
  includes(readme, '## What Attestor Does', 'README: names the operating model before architecture');
  includes(readme, 'AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains', 'README: explains the control flow in one line');
  includes(readme, '## Start In Shadow Mode', 'README: exposes shadow mode as the adoption path');
  includes(readme, 'observe -> recommend -> simulate -> approve -> enforce -> prove', 'README: explains shadow-to-enforcement sequence');
  includes(readme, '## Why It Exists', 'README: explains the category before architecture');
  includes(readme, 'AI action authorization infrastructure', 'README: positions Attestor as infrastructure, not a generic tool');
  includes(readme, '## Try It In 60 Seconds', 'README: exposes a fast first run near the top');
  includes(readme, 'npm run example:admission', 'README: shows the first runnable command');
  includes(readme, 'one proposed consequence admitted with proof references', 'README: explains admitted proof refs');
  includes(readme, 'one proposed consequence blocked fail-closed', 'README: explains blocked fail-closed path');
  includes(readme, 'a customer-side gate that only proceeds when Attestor allows it', 'README: explains downstream gate behavior');
  includes(readme, 'a non-bypassable gateway demo where a payment adapter cannot dispatch without verifier allow', 'README: explains non-bypassable adapter behavior');
  includes(readme, '## Decision Model', 'README: makes the decision vocabulary prominent');
  includes(readme, '## Proof Model', 'README: surfaces proof as a first-class concept near the top');
  includes(readme, 'local proof artifacts that can be reviewed later', 'README: explains why proof matters');
  includes(readme, 'npm run proof:surface', 'README: exposes the proof surface command near the first proof explanation');
  includes(readme, 'POST /api/v1/admissions', 'README: exposes the generic admission route');
  includes(readme, '`observe`, `warn`, `review`, or `enforce`', 'README: explains the generic mode ladder');
  includes(readme, '## Consequence Packs', 'README: introduces consequence packs before architecture');
  includes(readme, 'The pack is the consequence class. Adapters sit underneath it.', 'README: keeps consequence packs above adapters');
  includes(readme, 'Attestor is designed as a control point, not a data lake.', 'README: explains data handling posture early');
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md)', 'README: links to the guided first run');
  appearsBefore(readme, '## Current Status', '## Architecture: Core And Packs', 'README: keeps evaluation boundary before architecture');
  appearsBefore(readme, '## Start In Shadow Mode', '## Why It Exists', 'README: positions shadow mode before deeper category explanation');
  appearsBefore(readme, '## Try It In 60 Seconds', '## Architecture: Core And Packs', 'README: keeps the runnable path before product packaging');
  appearsBefore(readme, '## Consequence Packs', '## Architecture: Core And Packs', 'README: names consequence packs before architecture detail');
  appearsBefore(readme, 'npm run proof:surface', '## Architecture: Core And Packs', 'README: keeps proof inspection before platform packaging');
  appearsBefore(readme, '## Data And Security Posture', '## What Attestor Is Not', 'README: explains trust boundaries before non-claims');
}

function testTryFirstDocKeepsTheBoundaryHonest(): void {
  const doc = readProjectFile('docs', '01-overview', 'try-attestor-first.md');

  includes(doc, 'npm run example:admission', 'Try-first doc: includes the runnable command');
  includes(doc, 'npm run example:non-bypassable-gateway', 'Try-first doc: includes the non-bypassable gateway command');
  includes(doc, 'one is admitted', 'Try-first doc: explains admitted path');
  includes(doc, 'one is blocked fail-closed', 'Try-first doc: explains blocked path');
  includes(doc, 'proposed consequence -> Attestor admission decision -> proof refs -> downstream gate', 'Try-first doc: explains the operating shape');
  includes(doc, 'not the generic hosted `POST /api/v1/admissions` route', 'Try-first doc: separates local demo from generic hosted route');
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
