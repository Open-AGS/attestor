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

  includes(readme, '**Control infrastructure for high-risk AI actions.**', 'Product docs: README keeps the short product promise');
  includes(readme, 'Attestor sits between AI intent and real-world action.', 'Product docs: README starts with plain placement language');
  includes(readme, 'Prompts guide. They do not enforce.', 'Product docs: README keeps the prompt-control contrast');
  includes(readme, 'A prompt is not a formal rule; it is linguistic context interpreted by a probabilistic model.', 'Product docs: README preserves the prompt-boundary thesis');
  includes(readme, '## One Concrete Workflow', 'Product docs: README starts product understanding from one concrete workflow');
  includes(readme, 'Refund $380 to customer_123.', 'Product docs: README uses a concrete refund action');
  includes(readme, 'blocked before money moves', 'Product docs: README gives one concrete refund outcome');
  includes(readme, 'manager approval is missing and duplicate-refund risk is present', 'Product docs: README shows a concrete stop reason');
  includes(readme, 'What the reviewer sees:', 'Product docs: README makes the reviewer view concrete');
  includes(readme, 'the AI-generated refund request can reach the refund service with no gate trace', 'Product docs: README shows the without-Attestor failure mode');
  includes(readme, 'money does not move', 'Product docs: README shows the with-Attestor gate behavior');
  includes(readme, '## Why This Matters Now', 'Product docs: README moves urgency before broad mechanism');
  includes(readme, 'the refund path is synthetic and shadow-only', 'Product docs: README keeps the refund demo no-claim visible');
  includes(readme, 'npm run demo:golden-refund', 'Product docs: README keeps the first runnable path visible');
}

function testReadmeKeepsSingleEngineAndCustomerBoundary(): void {
  const readme = readProjectFile('README.md');

  includes(readme, 'AI proposes action', 'Product docs: README keeps the core flow start');
  includes(readme, 'Attestor checks policy, authority, evidence, scope, freshness, replay, tenant, token, and proof', 'Product docs: README keeps the core check vocabulary');
  includes(readme, 'downstream action executes only through the customer PEP / gate', 'Product docs: README keeps the customer enforcement boundary');
  includes(readme, 'Without an enforced customer-side PEP, gateway, verifier, or adapter, Attestor is advisory evidence.', 'Product docs: README distinguishes advisory evidence from control point');
  includes(readme, 'Start in shadow mode.', 'Product docs: README keeps shadow mode as the adoption wedge');
  includes(readme, 'These are domain packs over one Attestor engine.', 'Product docs: README keeps one-engine pack framing');
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
}

function testReadmeLinksTheRightDeeperDocsWithoutBecomingALinkWall(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '[What you can do with Attestor](docs/01-overview/what-you-can-do.md)', 'Product docs: README links the use-case bridge');
  includes(readme, '[Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)', 'Product docs: README links the evaluation packet');
  includes(readme, '[Security Policy](SECURITY.md)', 'Product docs: README links the security policy');
  includes(readme, '[Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)', 'Product docs: README links the reviewer CI path');
  includes(readme, '[Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)', 'Product docs: README links the provenance plan');
  includes(readme, '[Proof surface tracker](docs/02-architecture/proof-console-buildout.md)', 'Product docs: README links the proof surface tracker');
  includes(readme, '[AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md)', 'Product docs: README links the control-plane ADR');
  includes(readme, '[Attestor language contract](docs/02-architecture/attestor-language-contract.md)', 'Product docs: README links the language contract');
  includes(readme, '[Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)', 'Product docs: README links the domain-pack boundary');
  includes(readme, '[Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md)', 'Product docs: README links the downstream enforcement contract');
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
  excludes(readme, /<details>/u, 'Product docs: README should not hide a maintainer link wall in details');
  excludes(readme, /\| Layer \| Role \| Current status \|/u, 'Product docs: README should not use the old layer table');
  excludes(readme, /\| Pack \| What it means today \| Status \|/u, 'Product docs: README should not use the old pack table');
  excludes(readme, /a finance assistant prepares a report from live warehouse data/u, 'Product docs: README should not lead with finance-only wording');
  excludes(readme, /a crypto workflow prepares a Safe transaction/u, 'Product docs: README should not lead with crypto-only wording');
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

testReadmeStartsWithAConcreteWorkflow();
testReadmeKeepsSingleEngineAndCustomerBoundary();
testReadmeKeepsDomainPacksAndLocalTruth();
testReadmeLinksTheRightDeeperDocsWithoutBecomingALinkWall();
testArchitectureDocsStayAlignedWithThePublicReadme();
testReadmeDoesNotRegressToTheOldDenseShape();
testPurposeDoesNotCarryStaleSnapshotLanguage();
testServiceRefactorStatusStaysVisible();

console.log(`Product positioning docs tests: ${passed} passed, 0 failed`);
