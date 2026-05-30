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

function testReadmeStartsWithAConcreteWorkflow(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '<img src="docs/assets/attestor-readme-logo.png"', 'Product docs: README uses the single current Attestor image');
  excludes(readme, /attestor-logo\.png|attestor-readme-hero\.png/u, 'Product docs: README does not use retired Attestor image assets');
  includes(readme, '**Control infrastructure for high-risk AI-driven operations.**', 'Product docs: README keeps the short product promise');
  includes(readme, 'Attestor sits between an AI-prepared action and the system that would execute it.', 'Product docs: README starts with plain placement language');
  includes(readme, 'Prompts guide. They do not enforce.', 'Product docs: README keeps the prompt-control contrast');
  includes(readme, 'Unsafe proposed actions can come from hallucination, stale context, poisoned', 'Product docs: README explains AI/action risk in plain language');
  includes(readme, 'A prompt cannot stop a refund service, export job, identity admin, deploy tool, or wallet adapter.', 'Product docs: README preserves the prompt-boundary thesis in plain language');
  includes(readme, 'Hostile content still has to pass action, authority, scope, freshness, replay', 'Product docs: README names outside manipulation without turning it into a security guarantee');
  includes(readme, 'Every decision leaves a trail', 'Product docs: README explains the audit trail in plain language');
  includes(readme, '## One Concrete Workflow', 'Product docs: README starts product understanding from one concrete workflow');
  includes(readme, 'Refund $8,750 to customer_123 for order_789.', 'Product docs: README uses a concrete refund action');
  includes(readme, 'refundService.issueRefund(...)', 'Product docs: README names the dangerous service call');
  includes(readme, 'stops it before the service runs', 'Product docs: README gives one concrete refund outcome');
  includes(readme, 'manager approval is missing', 'Product docs: README shows a concrete stop reason');
  includes(readme, 'that AI-prepared action can become a real refund call', 'Product docs: README shows the without-Attestor failure mode');
  includes(readme, 'The trail remains: proposed action', 'Product docs: README shows the trail left by the decision');
  includes(readme, '## Why This Matters Now', 'Product docs: README keeps urgency context after the core workflow');
  includes(readme, '[EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)', 'Product docs: README keeps the EU AI Act as a bounded context anchor');
  includes(readme, '[NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)', 'Product docs: README keeps NIST AI RMF as a bounded context anchor');
  includes(readme, '[DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554)', 'Product docs: README keeps DORA as a bounded context anchor');
  includes(readme, 'These are not compliance claims.', 'Product docs: README explicitly avoids compliance overclaim');
  includes(readme, 'The repo demo is synthetic and shadow-only', 'Product docs: README keeps the refund demo no-claim visible');
  includes(readme, '[Run the demos in order](docs/01-overview/demo-guide.md)', 'Product docs: README keeps the guided demo path visible');
}

function testReadmeKeepsSingleEngineAndCustomerBoundary(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'AI agent', 'Product docs: README keeps the actor side of the core flow');
  includes(readme, 'It checks policy, approval, evidence, allowed scope, freshness, replay, tenant', 'Product docs: README keeps the core check vocabulary in plain language');
  includes(readme, 'The real service should run only through the customer-owned gate.', 'Product docs: README keeps the customer enforcement boundary');
  includes(readme, 'Without a customer-side gate, gateway, verifier, or adapter, the decision is', 'Product docs: README distinguishes advisory evidence from control point');
  includes(readme, 'Run Attestor in shadow pilot mode - and map what your AI agents are trying to do', 'Product docs: README keeps exact shadow-pilot value line');
  includes(readme, '[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md)', 'Product docs: README links the shadow pilot guide');
  includes(readme, 'The same gate can sit before these action classes:', 'Product docs: README keeps cross-action framing concise');
  includes(readme, 'This is a control point, not a data lake.', 'Product docs: README keeps data-posture positioning');
  includes(readme, 'Customer systems keep the model, agent, workflow, wallet, database, service', 'Product docs: README keeps customer ownership boundary');
  includes(readme, 'Without a customer-owned gate, it is evidence, not enforcement.', 'Product docs: README keeps the customer enforcement no-claim simple');
}

function testReadmeKeepsDomainPacksAndLocalTruth(): void {
  const readme = readProjectFile('README.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');

  for (const pack of [
    'Money Movement',
    'Data Movement',
    'Authority Change',
    'External Communication',
    'Operational Execution',
    'Programmable Money',
  ]) {
    includes(readme, pack, `Product docs: README names ${pack}`);
  }

  includes(readme, '[Run the demos in order](docs/01-overview/demo-guide.md)', 'Product docs: README links the guided demo path early');
  includes(demoGuide, 'npm run demo:golden-data-export', 'Product docs: demo guide links the data golden path');
  includes(demoGuide, 'npm run demo:golden-authority-change', 'Product docs: demo guide links the authority golden path');
  includes(demoGuide, 'npm run demo:golden-external-communication', 'Product docs: demo guide links the communication golden path');
  includes(demoGuide, 'npm run demo:golden-operational-execution', 'Product docs: demo guide links the ops golden path');
  includes(demoGuide, 'npm run demo:golden-programmable-money', 'Product docs: demo guide links the programmable-money golden path');
  includes(readme, '## Current State', 'Product docs: README keeps a compact current state section');
  includes(readme, 'Package version: 0.2.0-evaluation', 'Product docs: README keeps package version visible');
  includes(readme, 'Tag target:      v0.2.0-evaluation', 'Product docs: README keeps tag target visible');
  includes(readme, 'Release stage:   evaluation release', 'Product docs: README keeps evaluation-release status visible');
  includes(readme, 'Release type:    GitHub pre-release / Golden Path evaluation baseline', 'Product docs: README keeps release type visible');
}

function testReadmeLinksTheRightDeeperDocsWithoutBecomingALinkWall(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '## Start Here', 'Product docs: README exposes a short first-visitor link surface');
  includes(readme, 'Use one entry point first. It opens the rest.', 'Product docs: README keeps the first path lightweight');
  includes(readme, 'Use one entry point first. It opens the rest.', 'Product docs: README explains the single navigation hub');
  includes(readme, '[Repository navigator](docs/01-overview/repository-navigator.md) - choose the right path for reading, integrating, verifying, or changing code.', 'Product docs: README leads with repository navigator');
  includes(readme, '[Try Attestor first](docs/01-overview/try-attestor-first.md) - run the refund workflow.', 'Product docs: README links the first-run guide');
  includes(readme, '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md) - place the check before a real service call.', 'Product docs: README links the integration guide');
  includes(readme, '[Reason codes](docs/05-proof/reason-codes.md) - explain a `review` or `block`.', 'Product docs: README links reason-code support');
  includes(readme, '[License and use](docs/01-overview/license-and-use.md) - understand allowed use.', 'Product docs: README links license guidance');
  includes(readme, '[Security Policy](SECURITY.md)', 'Product docs: README links the security policy');
  excludes(readme, /## Maintainer Reference/u, 'Product docs: README should not keep a maintainer link wall');
  excludes(readme, /## Decision Model/u, 'Product docs: README should keep decision model details out of the front page');
  excludes(readme, /## Local Demos/u, 'Product docs: README should keep long demo tables out of the front page');
  excludes(readme, /\[Repository map\]\(docs\/01-overview\/repository-map\.md\)/u, 'Product docs: README should route repository map through the navigator');
  excludes(readme, /\[Docs front door\]\(docs\/README\.md\)/u, 'Product docs: README should route docs front door through the navigator');
}

function testArchitectureDocsStayAlignedWithThePublicReadme(): void {
  const actionPositioning = readProjectFile('docs', '01-overview', 'action-authorization-positioning.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packaging = readProjectFile('docs', '01-overview', 'product-packaging.md');
  const useCases = readProjectFile('docs', '01-overview', 'what-you-can-do.md');

  includes(actionPositioning, 'AI Action Control Plane is the product category.', 'Product docs: action positioning names the product category');
  includes(actionPositioning, 'The operating model is consequence admission:', 'Product docs: action positioning preserves consequence-admission language');
  includes(actionPositioning, 'Current implementation note: `POST /api/v1/admissions` already has the first mode ladder', 'Product docs: action positioning bounds hosted admission implementation');
  includes(purpose, 'Attestor is one product:', 'Product docs: purpose keeps one-product framing');
  includes(purpose, '[Attestor language contract](../02-architecture/attestor-language-contract.md)', 'Product docs: purpose links the language contract');
  includes(purpose, '[Domain pack boundary](../02-architecture/domain-pack-boundary.md)', 'Product docs: purpose links domain pack boundary');
  includes(purpose, 'not a magical router that guesses the correct pack automatically', 'Product docs: purpose blocks automatic-pack overclaim');
  includes(systemOverview, 'Attestor should be understood as one product:', 'Product docs: system overview keeps one-product framing');
  includes(systemOverview, 'The security target is reference-monitor-style', 'Product docs: system overview keeps reference-monitor-style boundary explicit');
  includes(systemOverview, '| PDP | Consequence admission, release kernel, and release layer |', 'Product docs: system overview names the PDP surface');
  includes(systemOverview, '| PEP | Enforcement plane, verifier helper, adapter framework, customer gateways |', 'Product docs: system overview names the PEP surface');
  includes(packaging, 'Attestor is one product:', 'Product docs: packaging keeps one-product framing');
  includes(packaging, '[Domain pack boundary](../02-architecture/domain-pack-boundary.md)', 'Product docs: packaging links domain pack boundary');
  includes(useCases, 'Attestor owns the control point before consequence:', 'Product docs: use-case bridge keeps control-point framing');
  includes(useCases, 'customer PEP, gateway, verifier, or adapter', 'Product docs: use-case bridge shows customer enforcement point');
  includes(useCases, 'Not automatic pack detection.', 'Product docs: use-case bridge blocks automatic-pack overclaim');
}

function testReadmeDoesNotRegressToTheOldDenseShape(): void {
  const readme = readProjectFile('README.md');

  excludes(readme, /## Core Operating Loop/u, 'Product docs: README should not reintroduce the old dense operating-loop section');
  excludes(readme, /## Architecture: Core And Packs/u, 'Product docs: README should not reintroduce the old architecture wall');
  excludes(readme, /<details>/u, 'Product docs: README should keep maintainer references under a visible heading, not hidden details');
  excludes(readme, /## Maintainer Reference/u, 'Product docs: README should not expose maintainer-only link depth on the front page');
  excludes(readme, /\| Layer \| Role \| Current status \|/u, 'Product docs: README should not use the old layer table');
  excludes(readme, /\| Pack \| What it means today \| Status \|/u, 'Product docs: README should not use the old pack table');
  excludes(readme, /a finance assistant prepares a report from live warehouse data/u, 'Product docs: README should not lead with finance-only wording');
  excludes(readme, /a crypto workflow prepares a Safe transaction/u, 'Product docs: README should not lead with crypto-only wording');
  excludes(readme, /U\.S\. Interagency Guidance on Third-Party Relationships/u, 'Product docs: README should keep context anchors short and not become a regulation link wall');
  excludes(readme, /Attestor does not claim compliance; it provides/u, 'Product docs: README should avoid vendor-style compliance-positioning phrasing');
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

function testLicenseNamesTheCurrentLicensor(): void {
  const license = readProjectFile('LICENSE');
  const licenseGuide = readProjectFile('docs', '01-overview', 'license-and-use.md');

  includes(license, 'Licensor: Gömöri Gábor', 'Product docs: LICENSE names the current licensor');
  excludes(license, /Licensor:\s+0xLamarr Labs/u, 'Product docs: LICENSE does not use the old lab placeholder as licensor');
  includes(licenseGuide, 'Attestor is source-available under the Business Source License 1.1.', 'Product docs: license guide keeps source-available wording');
  includes(licenseGuide, 'You need a commercial license for production use before the Change Date.', 'Product docs: license guide keeps production-use boundary');
  includes(licenseGuide, 'Source-available is not the same as OSI open source.', 'Product docs: license guide avoids open-source overclaim');
  includes(licenseGuide, 'If this page and the license file ever disagree, the license file controls.', 'Product docs: license guide defers to the legal license');
}

testReadmeStartsWithAConcreteWorkflow();
testReadmeKeepsSingleEngineAndCustomerBoundary();
testReadmeKeepsDomainPacksAndLocalTruth();
testReadmeLinksTheRightDeeperDocsWithoutBecomingALinkWall();
testArchitectureDocsStayAlignedWithThePublicReadme();
testReadmeDoesNotRegressToTheOldDenseShape();
testPurposeDoesNotCarryStaleSnapshotLanguage();
testServiceRefactorStatusStaysVisible();
testLicenseNamesTheCurrentLicensor();

console.log(`Product positioning docs tests: ${passed} passed, 0 failed`);
