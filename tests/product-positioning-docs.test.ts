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
  includes(readme, '**A gate for high-risk AI actions.**', 'Product docs: README keeps the short product promise');
  includes(readme, 'Attestor sits between what an AI wants to do and the system that would do it.', 'Product docs: README starts with plain placement language');
  includes(readme, 'Prompts guide. They do not enforce.', 'Product docs: README keeps the prompt-control contrast');
  includes(readme, 'A prompt can guide an AI, but it cannot stop your refund service', 'Product docs: README preserves the prompt-boundary thesis in plain language');
  includes(readme, '## One Concrete Workflow', 'Product docs: README starts product understanding from one concrete workflow');
  includes(readme, 'Refund $380 to customer_123.', 'Product docs: README uses a concrete refund action');
  includes(readme, 'blocked before money moves', 'Product docs: README gives one concrete refund outcome');
  includes(readme, 'manager approval is missing and duplicate-refund risk is present', 'Product docs: README shows a concrete stop reason');
  includes(readme, 'What the reviewer sees:', 'Product docs: README makes the reviewer view concrete');
  includes(readme, 'the AI-generated refund request can reach the refund service with no gate trace', 'Product docs: README shows the without-Attestor failure mode');
  includes(readme, 'money does not move', 'Product docs: README shows the with-Attestor gate behavior');
  includes(readme, '## Why This Matters Now', 'Product docs: README keeps urgency context after the core workflow');
  includes(readme, '[EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)', 'Product docs: README keeps the EU AI Act as a bounded context anchor');
  includes(readme, '[NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)', 'Product docs: README keeps NIST AI RMF as a bounded context anchor');
  includes(readme, '[DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554)', 'Product docs: README keeps DORA as a bounded context anchor');
  includes(readme, 'These links are context anchors, not compliance claims.', 'Product docs: README explicitly avoids compliance overclaim');
  includes(readme, 'the refund path is synthetic and shadow-only', 'Product docs: README keeps the refund demo no-claim visible');
  includes(readme, 'npm run demo:golden-refund', 'Product docs: README keeps the first runnable path visible');
}

function testReadmeKeepsSingleEngineAndCustomerBoundary(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'AI agent', 'Product docs: README keeps the actor side of the core flow');
  includes(readme, 'Attestor checks the proposed action: policy, approval, evidence, allowed scope, freshness, replay, tenant, token, and proof references', 'Product docs: README keeps the core check vocabulary in plain language');
  includes(readme, 'The real service runs only through the customer-owned gate.', 'Product docs: README keeps the customer enforcement boundary');
  includes(readme, 'Without an enforced customer-side gate, gateway, verifier, or adapter, Attestor is advisory evidence.', 'Product docs: README distinguishes advisory evidence from control point');
  includes(readme, 'Start in shadow mode.', 'Product docs: README keeps shadow mode as the adoption wedge');
  includes(readme, 'These are examples over one Attestor engine.', 'Product docs: README keeps one-engine pack framing');
  includes(readme, 'They are not separate products and not equal-maturity claims.', 'Product docs: README keeps pack maturity scoped');
  includes(readme, 'Attestor is a control point, not a data lake.', 'Product docs: README keeps data-posture positioning');
  includes(readme, 'Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path.', 'Product docs: README keeps customer ownership boundary');
}

function testReadmeKeepsDomainPacksAndLocalTruth(): void {
  const readme = readProjectFile('README.md');

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

  includes(readme, 'npm run demo:golden-data-export', 'Product docs: README links the data golden path');
  includes(readme, 'npm run demo:golden-authority-change', 'Product docs: README links the authority golden path');
  includes(readme, 'npm run demo:golden-external-communication', 'Product docs: README links the communication golden path');
  includes(readme, 'npm run demo:golden-operational-execution', 'Product docs: README links the ops golden path');
  includes(readme, 'npm run demo:golden-programmable-money', 'Product docs: README links the programmable-money golden path');
  includes(readme, 'Attestor is an **evaluation release**.', 'Product docs: README keeps evaluation status visible');
  includes(readme, 'They do not prove live cloud infrastructure, live customer enforcement, external KMS/HSM signing, shared replay stores, production readiness, or enterprise readiness.', 'Product docs: README separates local evidence from live proof');
  includes(readme, 'direct downstream bypass must fail', 'Product docs: README states customer PEP proof requirement');
  includes(readme, 'Plain-language summary: [License and use](docs/01-overview/license-and-use.md).', 'Product docs: README links the plain-language license summary');
}

function testReadmeLinksTheRightDeeperDocsWithoutBecomingALinkWall(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '## Start Here', 'Product docs: README exposes a short first-visitor link surface');
  includes(readme, 'Pick the shortest useful path. Do not read the whole repository first.', 'Product docs: README keeps the first path lightweight');
  includes(readme, 'Find the right page: [Docs front door](docs/README.md) and [Repository navigator](docs/01-overview/repository-navigator.md)', 'Product docs: README puts docs navigation at the top of the link path');
  includes(readme, 'Run the concrete refund workflow: [Try Attestor first](docs/01-overview/try-attestor-first.md)', 'Product docs: README leads with the first-run guide');
  includes(readme, 'Put Attestor before a real service call: [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)', 'Product docs: README links the integration guide');
  includes(readme, 'Copy framework-shaped examples: [Customer middleware examples](examples/customer-middleware/README.md)', 'Product docs: README links middleware examples');
  includes(readme, 'Send shadow events without an SDK: [Shadow event payload examples](docs/01-overview/shadow-event-payload-examples.md)', 'Product docs: README links shadow payload examples');
  includes(readme, 'Explain a `review` or `block`: [Reason codes](docs/05-proof/reason-codes.md)', 'Product docs: README links reason-code support');
  includes(readme, 'Make the first hosted request: [First hosted API call](docs/01-overview/hosted-first-api-call.md)', 'Product docs: README links the hosted first call');
  includes(readme, 'Understand what the license allows: [License and use](docs/01-overview/license-and-use.md)', 'Product docs: README links the license-and-use guide');
  includes(readme, '## Maintainer Reference', 'Product docs: README keeps deeper maintainer references behind an explicit heading');
  includes(readme, 'Use this after you already know what Attestor does.', 'Product docs: README explains why the maintainer section exists');
  includes(readme, '[Docs front door](docs/README.md)', 'Product docs: README links the docs front door');
  includes(readme, '[Repository map](docs/01-overview/repository-map.md)', 'Product docs: README links the repository map');
  includes(readme, '[Test system map](docs/02-architecture/test-system-map.md)', 'Product docs: README links the test system map');
  includes(readme, '[AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md)', 'Product docs: README links the control-plane ADR');
  includes(readme, '[Attestor language contract](docs/02-architecture/attestor-language-contract.md)', 'Product docs: README links the language contract');
  includes(readme, '[Glossary](docs/02-architecture/glossary.md)', 'Product docs: README links the glossary');
  includes(readme, '[Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)', 'Product docs: README links the domain-pack boundary');
  includes(readme, '[Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md)', 'Product docs: README links the downstream enforcement contract');
  includes(readme, '[Audit evidence system](docs/audit/README.md)', 'Product docs: README links the audit evidence system');
  includes(readme, '[Current posture baseline](docs/audit/current-posture-baseline.md)', 'Product docs: README links the current posture baseline');
  includes(readme, '[Live proof register](docs/audit/live-proof-register.md)', 'Product docs: README links the live proof register');
  includes(readme, '[Security Policy](SECURITY.md)', 'Product docs: README links the security policy');
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
  includes(readme, '## Maintainer Reference', 'Product docs: README keeps maintainer-only link depth after the short Start Here surface');
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
