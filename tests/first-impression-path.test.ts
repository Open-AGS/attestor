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

  includes(readme, 'AI Action Control Plane for high-risk AI actions.', 'README: opens with the AI Action Control Plane category');
  includes(readme, 'Attestor controls the boundary between AI intent and real-world consequence.', 'README: opens with the canonical control-plane sentence');
  includes(readme, 'Attestor treats that proposed action as a consequence to admit, narrow, review, or block before the customer system changes state.', 'README: explains the control point before architecture');
  includes(readme, 'The trust boundary is the action, not the model response.', 'README: frames the risk before architecture');
  includes(readme, 'Without an enforced customer-side PEP, gateway, verifier, or adapter in front of the downstream system, Attestor is advisory evidence, not a control point.', 'README: makes the PEP dependency explicit near the top');
  includes(readme, 'Start in shadow mode. See what your AI agents would have done before you let them act.', 'README: makes shadow mode visible immediately');
  includes(readme, 'AI proposes -> Attestor checks -> consequence is admitted, narrowed, reviewed, or blocked -> proof remains', 'README: keeps the front-page control flow short');
  includes(readme, '- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)', 'README: starts the review list with the Golden Path');
  includes(readme, 'Every case has the same shape: a proposed consequence must pass policy, authority, evidence, freshness, scope, replay, and enforcement checks before a downstream system acts.', 'README: explains the fail-closed gateway result');
  includes(readme, 'Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system.', 'README: keeps replacement non-claim near the top');
  includes(readme, '## Current Repository Truth', 'README: exposes the evaluation boundary near the top');
  includes(readme, 'proposed consequence -> consequence admission -> proof material -> customer enforcement', 'README: keeps one product language near the top');
  includes(readme, 'not a finished public SaaS', 'README: avoids public SaaS overclaim');
  includes(readme, 'Green local checks such as `npm run verify` are repo-side evidence only.', 'README: keeps local verification separate from production readiness');
  includes(readme, '## Golden Path: Refund', 'README: gives the golden path its own first-reading block');
  includes(readme, 'is the first end-to-end repo path a reviewer should run', 'README: makes the golden path the first concrete story');
  includes(readme, 'not a refund product, finance-only product, or separate engine', 'README: keeps the golden path inside the one product');
  includes(readme, 'refund action surface -> canonical shadow fixtures -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet -> demo output', 'README: shows the golden path pipeline in one line');
  includes(readme, 'Use it to inspect whether the Attestor consequence engine is coherent before looking at lower-level admission primitives.', 'README: positions lower-level demos after the golden path');
  includes(readme, '## The Control Boundary', 'README: names the operating model before architecture');
  includes(readme, 'Use Attestor where a capable AI-assisted system should not be able to act just because it can form a request:', 'README: moves quickly from category to use cases');
  includes(readme, 'a procurement agent proposes paying a supplier after reading a changed bank-account instruction', 'README: frames money movement by consequence');
  includes(readme, 'an analytics agent requests a customer-data export or live database-backed report', 'README: frames data movement by consequence');
  includes(readme, 'a treasury or wallet workflow prepares a programmable-money transaction', 'README: frames programmable money by consequence');
  includes(readme, '## Adoption Path', 'README: exposes shadow mode as the adoption path');
  includes(readme, 'observe -> warn -> review -> enforce', 'README: explains the adoption mode ladder');
  includes(readme, 'observe -> recommend -> simulate -> approve -> enforce -> prove', 'README: explains shadow-to-enforcement sequence');
  includes(readme, '## Why It Exists', 'README: explains the category before architecture');
  includes(readme, 'AI action control-plane infrastructure', 'README: positions Attestor as infrastructure, not a generic tool');
  includes(readme, '## Try It In 60 Seconds', 'README: exposes a fast first run near the top');
  includes(readme, 'npm ci', 'README: uses reproducible install for the reviewer path');
  includes(readme, 'npm run demo:golden-refund', 'README: shows the current golden path command');
  includes(readme, 'npm run example:admission', 'README: shows the first runnable command');
  includes(readme, 'npm run example:action-surface-onboarding', 'README: shows the first onboarding packet command');
  includes(readme, 'digest-only canonical shadow fixtures', 'README: explains digest-only golden path fixtures');
  includes(readme, 'runtime assurance smoke over the refund scenarios', 'README: explains runtime assurance golden path');
  includes(readme, 'Policy Foundry summary material with named gaps', 'README: explains Foundry summary material');
  includes(readme, 'explicit no-claims: no live Stripe or Shopify refund, no customer deployment, no policy activation, no auto-enforcement', 'README: keeps golden path no-claims visible');
  includes(readme, '## Decision Model', 'README: makes the decision vocabulary prominent');
  includes(readme, 'Admission responses also carry model-safe feedback.', 'README: exposes safe retry feedback near the decision model');
  includes(readme, 'sameRequestReplayAllowed', 'README: makes replay unsafe for model repair');
  includes(readme, '## Proof Model', 'README: surfaces proof as a first-class concept near the top');
  includes(readme, 'local proof artifacts that can be reviewed later', 'README: explains why proof matters');
  includes(readme, 'Read "proof material" as typed evidence, not one universal cryptographic guarantee:', 'README: narrows the proof vocabulary');
  includes(readme, 'A production signing boundary unless external KMS/HSM readiness is specifically proven.', 'README: prevents signed artifact production-boundary overclaim');
  includes(readme, '`verify:cert` may report `PROOF_DEGRADED`', 'README: explains degraded proof verification honestly');
  includes(readme, 'npm run proof:surface', 'README: exposes the proof surface command near the first proof explanation');
  includes(readme, 'POST /api/v1/admissions', 'README: exposes the generic admission route');
  includes(readme, '`observe`, `warn`, `review`, or `enforce`', 'README: explains the generic mode ladder');
  includes(readme, '"domain": "money-movement"', 'README: shows the route is consequence-domain based');
  includes(readme, '## Consequence Packs', 'README: introduces consequence packs before architecture');
  includes(readme, 'The pack is the consequence class. Adapters sit underneath it.', 'README: keeps consequence packs above adapters');
  includes(readme, 'The pack list is taxonomy, not an equal-maturity claim.', 'README: blocks consequence-pack maturity overclaim');
  includes(readme, 'Attestor is designed as a control point, not a data lake.', 'README: explains data handling posture early');
  appearsBefore(readme, '- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)', '- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)', 'README: review list starts with the Golden Path');
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md)', 'README: links to the guided first run');
  appearsBefore(readme, '## Current Repository Truth', '## Architecture: Core And Packs', 'README: keeps evaluation boundary before architecture');
  appearsBefore(readme, '## Golden Path: Refund', '## The Control Boundary', 'README: puts the concrete golden path before the broad domain list');
  appearsBefore(readme, '## Adoption Path', '## Why It Exists', 'README: positions shadow mode before deeper category explanation');
  appearsBefore(readme, '## Try It In 60 Seconds', '## Architecture: Core And Packs', 'README: keeps the runnable path before product packaging');
  appearsBefore(readme, '## Consequence Packs', '## Architecture: Core And Packs', 'README: names consequence packs before architecture detail');
  appearsBefore(readme, 'npm run proof:surface', '## Architecture: Core And Packs', 'README: keeps proof inspection before platform packaging');
  appearsBefore(readme, '## Data And Security Posture', '## What Attestor Is Not', 'README: explains trust boundaries before non-claims');
}

function testTryFirstDocKeepsTheBoundaryHonest(): void {
  const doc = readProjectFile('docs', '01-overview', 'try-attestor-first.md');

  includes(doc, 'npm ci', 'Try-first doc: uses reproducible install command');
  includes(doc, 'npm run example:admission', 'Try-first doc: includes the runnable command');
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
  includes(packageJson.scripts.test, 'scripts/run-suite.mjs test', 'Package: npm test delegates to the suite runner');
  includes(packageJson.scripts.verify, 'scripts/run-suite.mjs verify', 'Package: verify delegates to the suite runner');
}

testReadmeHasAFirstImpressionPath();
testTryFirstDocKeepsTheBoundaryHonest();
testQuickstartPointsToTheFastPath();
testDemoOutputIsPitchReady();
testPackageScriptsProtectThePath();

console.log(`First impression path tests: ${passed} passed, 0 failed`);
