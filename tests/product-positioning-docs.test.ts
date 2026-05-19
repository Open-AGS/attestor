import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function testTopLevelPositioningStaysAligned(): void {
  const readme = readProjectFile('README.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const actionPositioning = readProjectFile('docs', '01-overview', 'action-authorization-positioning.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packaging = readProjectFile('docs', '01-overview', 'product-packaging.md');
  const useCases = readProjectFile('docs', '01-overview', 'what-you-can-do.md');

  includes(readme, 'Attestor controls the boundary between AI intent and real-world consequence.', 'Product docs: README keeps AI Action Control Plane framing');
  includes(readme, '## Where It Sits In A Customer Stack', 'Product docs: README shows real customer stack placement');
  includes(readme, 'Customer PEP / gateway / verifier / adapter', 'Product docs: README puts customer enforcement before Attestor');
  includes(readme, 'With that enforced downstream point, Attestor becomes the control point before consequence.', 'Product docs: README distinguishes advisory evidence from control point');
  includes(readme, 'Start in shadow mode. See what your AI agents would have done before you let them act.', 'Product docs: README makes shadow mode the adoption wedge');
  includes(readme, 'observe -> recommend -> simulate -> approve -> enforce -> prove', 'Product docs: README keeps the shadow-to-enforcement path');
  includes(readme, 'Attestor can start in `observe` or `warn` mode.', 'Product docs: README makes non-blocking adoption concrete');
  includes(readme, '## Core Operating Loop', 'Product docs: README names the customer operating loop');
  includes(readme, 'shadow events', 'Product docs: README starts Foundry loop with shadow traffic');
  includes(readme, 'review-only policy candidates', 'Product docs: README keeps Foundry candidates non-authoritative');
  includes(readme, 'observe -> warn -> review -> enforce', 'Product docs: README keeps the adoption mode ladder');
  includes(readme, 'The current generic admission route implements the first control ladder for this path.', 'Product docs: README bounds implemented shadow ladder');
  includes(readme, '## Golden Path: Refund', 'Product docs: README gives the golden path its own block');
  includes(readme, 'not a refund product, finance-only product, or separate engine', 'Product docs: README keeps golden path scoped to one product');
  includes(readme, 'Admission responses also carry model-safe feedback.', 'Product docs: README introduces safe feedback contract');
  includes(readme, 'Some failures are deliberately not model-retryable.', 'Product docs: README blocks retry-loop overclaim');
  includes(readme, 'This is the route-level entry point for the shadow-to-enforcement ladder described above.', 'Product docs: README avoids repeating the route mode explanation');
  includes(readme, 'a treasury or wallet workflow prepares a programmable-money transaction', 'Product docs: README uses consequence-pack examples');
  includes(readme, 'Attestor is one product: an AI Action Control Plane with a shared consequence-admission core and modular packs for specific consequence domains.', 'Product docs: README keeps one-product control-plane framing');
  includes(readme, 'The deeper architecture decision is [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md).', 'Product docs: README links the control-plane ADR');
  includes(readme, '[Attestor language contract](docs/02-architecture/attestor-language-contract.md)', 'Product docs: README links the language contract');
  includes(readme, '[Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)', 'Product docs: README links the domain-pack boundary');
  includes(readme, 'The machine-readable domain-pack boundary is exported from `attestor/consequence-admission`.', 'Product docs: README names the packaged domain-pack boundary contract');
  includes(readme, 'This is not a claim that every customer workflow is already non-bypassable', 'Product docs: README keeps reference-monitor non-claim visible');
  includes(readme, 'Attestor without that enforced downstream PEP is advisory, not control.', 'Product docs: README states the PEP enforcement boundary');
  includes(readme, 'AI action control-plane infrastructure', 'Product docs: README names the infrastructure category');
  includes(readme, '## Consequence Packs', 'Product docs: README names consequence packs before architecture');
  includes(readme, 'A pack does not answer "is this finance or crypto?" It answers the control question:', 'Product docs: README blocks industry-pack framing');
  includes(readme, 'The pack is the consequence class. Adapters sit underneath it.', 'Product docs: README keeps adapters below consequence packs');
  includes(readme, 'The pack list is taxonomy, not an equal-maturity claim.', 'Product docs: README keeps consequence taxonomy separate from maturity claims');
  includes(actionPositioning, 'AI Action Control Plane is the product category.', 'Product docs: action authorization positioning names the category');
  includes(actionPositioning, 'The operating model is consequence admission:', 'Product docs: action authorization positioning preserves consequence-admission language');
  includes(actionPositioning, 'AI proposes -> Attestor checks -> consequence is admitted, narrowed, reviewed, or blocked -> proof remains', 'Product docs: action authorization positioning keeps the front-page control flow');
  includes(actionPositioning, 'Authorization remains valid inside Attestor, but it is not the whole product category.', 'Product docs: action authorization positioning scopes authorization language');
  includes(actionPositioning, 'This is the pack language.', 'Product docs: action authorization positioning names consequence-class pack language');
  includes(actionPositioning, 'observe -> recommend -> simulate -> approve -> enforce -> prove', 'Product docs: action authorization positioning keeps shadow mode adoption path');
  includes(actionPositioning, 'Current implementation note: `POST /api/v1/admissions` already has the first mode ladder', 'Product docs: action authorization positioning bounds shadow implementation');
  includes(actionPositioning, 'Attestor returns bounded correction feedback so agents can retry safely without learning sensitive data or bypassing policy.', 'Product docs: action authorization positioning frames safe retry correctly');
  includes(purpose, 'Attestor is one product:', 'Product docs: purpose keeps one-product framing');
  includes(purpose, '[Attestor language contract](../02-architecture/attestor-language-contract.md)', 'Product docs: purpose links the language contract');
  includes(purpose, '[Domain pack boundary](../02-architecture/domain-pack-boundary.md)', 'Product docs: purpose links domain pack boundary');
  includes(purpose, '`attestor/consequence-admission`', 'Product docs: purpose names consequence admission package surface');
  includes(purpose, 'The domain-pack boundary keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core.', 'Product docs: purpose keeps pack boundary explicit');
  includes(systemOverview, 'Attestor should be understood as one product:', 'Product docs: system overview keeps one-product framing');
  includes(systemOverview, 'an AI Action Control Plane for proposed AI actions before business consequences', 'Product docs: system overview keeps AI Action Control Plane framing');
  includes(systemOverview, 'The security target is reference-monitor-style', 'Product docs: system overview keeps reference-monitor-style boundary explicit');
  includes(systemOverview, '| PDP | Consequence admission, release kernel, and release layer |', 'Product docs: system overview names the PDP surface');
  includes(systemOverview, '| PEP | Enforcement plane, verifier helper, adapter framework, customer gateways |', 'Product docs: system overview names the PEP surface');
  includes(systemOverview, '| PIP | Evidence, authority, tenant, recipient, freshness, policy-version, no-go, and runtime context providers |', 'Product docs: system overview names the PIP surface');
  includes(systemOverview, '| PAP | Release policy control plane and Policy Foundry surfaces |', 'Product docs: system overview names the PAP surface');
  includes(packaging, 'Attestor is one product:', 'Product docs: packaging keeps one-product framing');
  includes(packaging, 'Attestor is one product: an **AI Action Control Plane for high-consequence systems**.', 'Product docs: packaging uses control-plane product category');
  includes(packaging, '[Domain pack boundary](../02-architecture/domain-pack-boundary.md)', 'Product docs: packaging links domain pack boundary');
  includes(useCases, 'Attestor owns the control point before consequence:', 'Product docs: use-case bridge keeps control-point framing');
  includes(useCases, 'AI agent / workflow', 'Product docs: use-case bridge shows real-stack AI workflow');
  includes(useCases, 'customer PEP, gateway, verifier, or adapter', 'Product docs: use-case bridge shows customer enforcement point');
  includes(useCases, 'Without that customer-side enforcement point, Attestor produces advisory', 'Product docs: use-case bridge keeps advisory boundary visible');
  includes(readme, 'docs/01-overview/what-you-can-do.md', 'Product docs: README links the use-case bridge');
  includes(readme, 'Read the architecture as a path, not a stack diagram:', 'Product docs: README avoids table-first architecture framing');
  includes(readme, 'Attestor does not guess what to run automatically, and it does not bypass the customer\'s own enforcement point.', 'Product docs: README blocks automatic-pack overclaim');
  includes(readme, 'Green local checks such as `npm run verify` are repo-side evidence only.', 'Product docs: README separates repo checks from production readiness');
  includes(purpose, 'not a magical router that guesses the correct pack automatically', 'Product docs: purpose blocks automatic-pack overclaim');
  includes(useCases, 'Not automatic pack detection.', 'Product docs: use-case bridge blocks automatic-pack overclaim');
}

function testCoreAndPackStatusStayConsistent(): void {
  const readme = readProjectFile('README.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const firstIntegrations = readProjectFile('docs', '01-overview', 'finance-and-crypto-first-integrations.md');

  for (const packageSurface of [
    'attestor/release-layer',
    'attestor/release-layer/finance',
    'attestor/release-policy-control-plane',
    'attestor/release-enforcement-plane',
    'attestor/crypto-authorization-core',
    'attestor/crypto-execution-admission',
  ]) {
    includes(purpose, packageSurface, `Product docs: purpose names ${packageSurface}`);
    includes(systemOverview, packageSurface, `Product docs: system overview names ${packageSurface}`);
  }

  includes(readme, '**PDP:** turns structured action intent, policy, evidence, authority, scope, and failure-mode controls into `admit`, `narrow`, `review`, or `block`.', 'Product docs: README PDP role is concrete');
  includes(readme, '**PEP:** sits at the downstream edge and verifies the decision, proof, binding, and replay posture before execution.', 'Product docs: README PEP role is concrete');
  includes(readme, '**PIP:** supplies evidence, authority, tenant, recipient, freshness, policy-version, no-go, and context facts.', 'Product docs: README PIP role is concrete');
  includes(readme, '**PAP:** handles policy lifecycle: signed bundles, simulation, rollout, activation rules, reviewer constraints, and provenance checks.', 'Product docs: README PAP role is concrete');
  includes(readme, 'Pack-specific adapters live below this layer.', 'Product docs: README keeps adapter role below consequence packs');
  includes(readme, 'keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core', 'Product docs: README keeps domain pack boundary summary');
  includes(readme, 'other packs name consequence classes and integration boundaries that can mature at different speeds without becoming separate products', 'Product docs: README avoids equal-maturity pack claim');
  includes(readme, 'Money Movement', 'Product docs: README names Money Movement pack');
  includes(readme, 'Data Movement', 'Product docs: README names Data Movement pack');
  includes(readme, 'Authority Change', 'Product docs: README names Authority Change pack');
  includes(readme, 'External Communication', 'Product docs: README names External Communication pack');
  includes(readme, 'Operational Execution', 'Product docs: README names Operational Execution pack');
  includes(readme, 'Programmable Money', 'Product docs: README names Programmable Money pack');
  excludes(readme, /\| Layer \| Role \| Current status \|/u, 'Product docs: README should not use the old layer table');
  excludes(readme, /\| Pack \| What it means today \| Status \|/u, 'Product docs: README should not use the old pack table');
  excludes(readme, /Finance, crypto, data export, authority change, and future packs should not invent/u, 'Product docs: README should not use old finance-crypto-first pack wording');
  excludes(readme, /separate product per domain/iu, 'Product docs: README should not imply domain products');
  excludes(readme, /a finance assistant prepares a report from live warehouse data/u, 'Product docs: README should not lead use cases with finance-only wording');
  excludes(readme, /a crypto workflow prepares a Safe transaction/u, 'Product docs: README should not lead use cases with crypto-only wording');
  excludes(readme, /\*\*AI Action Authorization Layer\.\*\*/u, 'Product docs: README should not lead with old authorization-layer category');
  excludes(readme, /Attestor is the authorization layer for AI actions before they become consequences/u, 'Product docs: README should not use old authorization-layer headline sentence');
  includes(purpose, 'The finance pack remains the deepest proven wedge today.', 'Product docs: purpose keeps finance as strongest wedge');
  includes(purpose, 'not a public hosted crypto HTTP route', 'Product docs: purpose keeps crypto hosted-route guardrail');
  includes(firstIntegrations, 'Do not describe crypto as generally available through a public hosted route', 'Product docs: first integrations keep crypto hosted-route guardrail');
}

function testReadmeDoesNotReintroduceFrozenStepFractions(): void {
  const readme = readProjectFile('README.md');

  excludes(readme, /\b\d+\s*\/\s*\d+\b/u, 'Product docs: README should not expose frozen step fractions');
  excludes(readme, /\bfirst[- ]slice\b/iu, 'Product docs: README should not use first-slice posture');
}

function testPurposeDoesNotCarryStaleSnapshotLanguage(): void {
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');

  excludes(purpose, /\bfirst[- ]slice\b/iu, 'Product docs: purpose should not describe current shipped surfaces as first-slice');
  excludes(purpose, /not yet imply release-layer completeness/iu, 'Product docs: purpose should not carry old release-layer caveat');
  excludes(purpose, /financial reference path/iu, 'Product docs: purpose should not reduce platform truth to the old finance-only snapshot');
}

function testServiceRefactorStatusStaysVisible(): void {
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const serviceRefactor = readProjectFile('docs', '02-architecture', 'service-api-refactor-buildout.md');

  includes(purpose, '`api-server.ts` is now a small Hono composition root', 'Product docs: purpose records thin API server');
  includes(serviceRefactor, '| API route runtime composition | Complete |', 'Product docs: service refactor tracker records route runtime completion');
  includes(serviceRefactor, '| Thin API server | Complete |', 'Product docs: service refactor tracker records thin API server completion');
  includes(serviceRefactor, 'the boundary test caps it at 120 lines', 'Product docs: service refactor tracker records anti-regression guard');
}

testTopLevelPositioningStaysAligned();
testCoreAndPackStatusStayConsistent();
testReadmeDoesNotReintroduceFrozenStepFractions();
testPurposeDoesNotCarryStaleSnapshotLanguage();
testServiceRefactorStatusStaysVisible();

console.log(`Product positioning docs tests: ${passed} passed, 0 failed`);
