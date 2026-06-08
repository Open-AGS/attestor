import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

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

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function countOccurrences(content: string, expected: string): number {
  return content.split(expected).length - 1;
}

function testNavigatorKeepsFirstVisitorPaths(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');

  includes(doc, '# Repository Navigator', 'Repository navigator: title is present');
  includes(doc, 'Use this when the repository feels large', 'Repository navigator: purpose is plain');
  includes(doc, 'This is secondary navigation.', 'Repository navigator: stays secondary to the front README');
  includes(doc, '## Primary Paths', 'Repository navigator: primary paths are the first navigation surface');
  includes(doc, '## Start By Intent', 'Repository navigator: task-first navigation is present');
  includes(doc, '## Start By Role', 'Repository navigator: role-first navigation is present');
  includes(doc, '## Maintainer Maps', 'Repository navigator: deep maps are grouped behind a maintainer section');
  includes(doc, '## If You Are Lost', 'Repository navigator: lost-reader rescue path is present');
  excludes(doc, /## What This Opens/u, 'Repository navigator: does not keep an extra navigation hub section');
  excludes(doc, /## Pick One Door/u, 'Repository navigator: avoids duplicate guided-entry sections');
  excludes(doc, /Stop when\.\.\./u, 'Repository navigator: removes the old stopping-rule table');

  for (const expected of [
    '[Try Attestor first](try-attestor-first.md)',
    '[Run the local evaluation path](demo-guide.md)',
    '[How to integrate Attestor](how-to-integrate-attestor.md)',
    '[How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md)',
    '[README current state](../../README.md#current-state)',
    '[Live proof register](../audit/live-proof-register.md)',
    '[Run Attestor in shadow pilot mode](shadow-event-payload-examples.md)',
    '[Customer middleware examples](../../examples/customer-middleware/README.md)',
    '[Reason codes](../05-proof/reason-codes.md)',
    '[Audit evidence system](../audit/README.md)',
    '[Internal machine map](../02-architecture/attestor-internal-machine-map.md)',
    '[Developer entry path](developer-entry-path.md)',
    '[Repository map](repository-map.md)',
    '[Repository map](repository-map.md#code-map)',
    '[Repository map](repository-map.md#package-surface-map)',
    '[Service organization plan](../02-architecture/service-organization-plan.md)',
    '[Large file budget](../02-architecture/large-file-budget.md)',
    '[Test system map](../02-architecture/test-system-map.md)',
  ]) {
    includes(doc, expected, `Repository navigator: links ${expected}`);
  }

  for (const expected of [
    '# Run The Local Evaluation Path',
    '## Five-Minute Developer Path',
    'POST /api/v1/admissions',
    'assertConsequenceAdmissionGateAllows',
    'proof trail after the decision',
    '## Proof Boundary',
    'repo-side shape: proposed action, checks, outcome',
    '## 4. Pick The Action Class You Care About',
    'npm run demo:golden-refund',
    'npm run demo:golden-paths',
    'npm run example:non-bypassable-gateway',
  ]) {
    includes(demoGuide, expected, `Demo guide: records ${expected}`);
  }
}

function testNavigatorKeepsServiceMap(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-map.md');

  includes(doc, '# Repository Map', 'Repository map: title is present');
  includes(doc, '## Code Map', 'Repository map: code map is present');
  includes(doc, '## Package Surface Map', 'Repository map: package surface map is present');

  for (const expected of [
    '| `src/service/` | Hosted runtime and cross-cutting service support.',
    '| `src/service/account/` | Hosted account stores',
    '| `src/service/billing/` | Billing entitlements',
    '| `src/service/async/` | Async pipeline',
    '| `src/service/pipeline/` | Pipeline idempotency store',
    '| `src/service/release/` | Release authority stores',
    '| `src/service/hosted/` | Hosted product-flow contracts',
    '| `src/service/policy-foundry/` | Policy Foundry billing entitlement enforcement',
    '| `src/service/shadow/` | Shadow persistence store.',
    '| `src/service/application/` | Route-facing application services',
    '| `src/financial/` | Finance proof wedge',
    '| `src/financial/cli/` | Financial CLI command families',
    '| `tests/README.md` | Short test navigator',
  ]) {
    includes(doc, expected, `Repository navigator: keeps service map row ${expected}`);
  }
}

function testExistingSystemsOverviewIsPlainAndBounded(): void {
  const doc = readProjectFile('docs', '01-overview', 'how-attestor-connects-to-existing-systems.md');

  includes(doc, '# How Attestor Connects To Existing Systems', 'Existing-system overview: title is present');
  includes(doc, 'without finding every risky action by hand', 'Existing-system overview: explains why the page exists');
  includes(doc, 'keeps real execution behind a customer-owned gate', 'Existing-system overview: keeps the connection path practical');
  includes(doc, 'review material, not authority', 'Existing-system overview: keeps signal authority bounded');
  includes(doc, 'Final rules remain human-approved.', 'Existing-system overview: keeps rule activation human-owned');
  includes(doc, 'The decision becomes enforcement only when the customer-owned gate sits before', 'Existing-system overview: ties enforcement to customer gate placement');
  includes(doc, 'external security audit remain separate proof steps.', 'Existing-system overview: keeps proof boundaries concise');

  for (const expected of [
    '[Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md)',
    '[System signals and gate placement](../02-architecture/runtime-signal-handling.md)',
    '[Run Attestor in shadow pilot mode](shadow-event-payload-examples.md)',
    '[Policy Foundry onboarding](../02-architecture/policy-foundry-onboarding.md)',
    '[Consequence admission quickstart](consequence-admission-quickstart.md)',
    '[Customer admission gate](customer-admission-gate.md)',
    '[Proof model](../05-proof/proof-model.md)',
    '[Customer middleware examples](../../examples/customer-middleware/README.md)',
    '[Reason codes](../05-proof/reason-codes.md)',
    '[Downstream enforcement contract](../02-architecture/downstream-enforcement-contract.md)',
    '[Repository navigator](repository-navigator.md)',
  ]) {
    includes(doc, expected, `Existing-system overview: links ${expected}`);
  }

  excludes(doc, /generated gate plan/iu, 'Existing-system overview: avoids implying gate generation');
  excludes(doc, /production readiness/iu, 'Existing-system overview: avoids production-readiness wording');
}

function testDeveloperEntryPathIsConcreteAndBounded(): void {
  const doc = readProjectFile('docs', '01-overview', 'developer-entry-path.md');

  includes(doc, '# Developer Entry Path', 'Developer entry path: title is present');
  includes(
    doc,
    'Use this when you want to understand the main Attestor runtime path before',
    'Developer entry path: purpose is practical',
  );
  includes(
    doc,
    'not a full architecture map, a line-by-line audit, live proof, or',
    'Developer entry path: scope boundary is explicit',
  );
  includes(doc, 'npm run example:admission', 'Developer entry path: starts with admission example');
  includes(doc, 'npm run example:non-bypassable-gateway', 'Developer entry path: starts with gateway example');
  includes(doc, 'proposed consequence', 'Developer entry path: names the flow start');
  includes(doc, 'guard evaluation', 'Developer entry path: names guard evaluation');
  includes(doc, 'customer gate before the downstream action', 'Developer entry path: names customer gate');

  for (const expected of [
    '`examples/first-useful-admission-demo.ts`',
    '`examples/non-bypassable-gateway-demo.ts`',
    '`src/service/http/routes/generic-admission-routes.ts`',
    '`src/consequence-admission/generic-input-normalization.ts`',
    '`src/consequence-admission/generic-engine.ts`',
    '`src/consequence-admission/customer-gate.ts`',
    '`src/consequence-admission/downstream-enforcement-contract.ts`',
    '`src/consequence-admission/index.ts`',
    '`tests/generic-admission-routes.test.ts`',
    '`tests/generic-admission-guard-route-matrix.test.ts`',
    '`tests/critical-admission-property-suite.test.ts`',
    '`tests/consequence-admission-customer-gate.test.ts`',
    '`tests/downstream-enforcement-contract.test.ts`',
  ]) {
    includes(doc, expected, `Developer entry path: names concrete repo path ${expected}`);
  }

  includes(doc, 'local example is not live customer enforcement', 'Developer entry path: local/live boundary is explicit');
  includes(doc, 'shadow record is not downstream execution', 'Developer entry path: shadow/execution split is explicit');
  includes(doc, 'release proof is not customer PEP no-bypass proof', 'Developer entry path: release/customer gate proof split is explicit');
  includes(doc, 'repo-side evidence is not production readiness', 'Developer entry path: production no-claim is explicit');
}

function testNavigatorKeepsNoClaimBoundaries(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  const map = readProjectFile('docs', '01-overview', 'repository-map.md');

  includes(doc, 'audit and live', 'Repository navigator: readiness claim source starts with audit/live proof records');
  includes(doc, 'proof records remain the source for readiness claims.', 'Repository navigator: readiness claims stay with evidence records');
  includes(doc, 'repo-side evidence is not live production proof', 'Repository navigator: live proof boundary is explicit');
  includes(doc, 'package boundary is not hosted enforcement', 'Repository navigator: package boundary no-claim is explicit');
  includes(doc, 'admission decision is not downstream execution', 'Repository navigator: decision/execution split is explicit');
  includes(doc, 'customer gate is where non-bypassability must be proven', 'Repository navigator: customer gate proof boundary is explicit');
  excludes(doc, /"Is this production-ready\?"/u, 'Repository navigator: avoids production-ready as a front-door link prompt');
  includes(map, 'This is a code map.', 'Repository map: map purpose is plain');
  includes(map, 'proven in their own evidence records.', 'Repository map: readiness boundary points to evidence records');
  includes(map, 'package map = what import path means', 'Repository map: package map boundary is explicit');
}

function assertLinksResolve(...segments: string[]): void {
  const docPath = join(process.cwd(), ...segments);
  const doc = readFileSync(docPath, 'utf8');
  const docDir = dirname(docPath);
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const missing: string[] = [];

  for (const match of doc.matchAll(linkPattern)) {
    const href = match[1];
    if (/^[a-z]+:/iu.test(href) || href.startsWith('#')) continue;
    const pathOnly = href.split('#')[0];
    const resolved = normalize(join(docDir, pathOnly));
    if (!existsSync(resolved)) missing.push(href);
  }

  assert.deepEqual(missing, [], `${segments.join('/')}: all relative links resolve`);
  passed += 1;
}

function testNavigatorLinksResolve(): void {
  assertLinksResolve('docs', '01-overview', 'repository-navigator.md');
  assertLinksResolve('docs', '01-overview', 'how-attestor-connects-to-existing-systems.md');
  assertLinksResolve('docs', '01-overview', 'developer-entry-path.md');
  assertLinksResolve('docs', '01-overview', 'repository-map.md');
  assertLinksResolve('docs', '01-overview', 'demo-guide.md');
  assertLinksResolve('docs', 'README.md');
}

function testDocsFrontDoorPullsReadersToTheNextAction(): void {
  const doc = readProjectFile('docs', 'README.md');

  includes(doc, '# Attestor Docs', 'Docs front door: title is present');
  includes(doc, 'Use this docs index after the repository README.', 'Docs front door: purpose names the index');
  includes(doc, 'understand -> try -> observe -> integrate -> explain -> verify -> maintain', 'Docs front door: keeps the reader path explicit');
  includes(doc, '## Start Here', 'Docs front door: has a first-reader section');
  includes(doc, 'It is secondary navigation, not', 'Docs front door: stays secondary to the repository README');
  includes(doc, 'Observe one real action path', 'Docs front door: keeps observe path near the top');
  equal(
    countOccurrences(doc, '| Run the local evaluation path'),
    0,
    'Docs front door: local evaluation path is not duplicated in Start Here',
  );
  includes(doc, '## Canonical Docs', 'Docs front door: has a canonical-docs section');
  includes(doc, 'This table is navigation; readiness', 'Docs front door: canonical table is navigation');
  includes(doc, 'claims stay with the linked evidence records.', 'Docs front door: canonical table points readiness claims at evidence records');
  includes(doc, '## Integrate', 'Docs front door: has an integration section');
  includes(doc, '## Explain Decisions', 'Docs front door: has a decision-explanation section');
  includes(doc, '## Evaluate Trust', 'Docs front door: has a trust-evaluation section');
  includes(doc, '## Understand The System', 'Docs front door: has a system-understanding section');
  includes(doc, '## Maintain The Repo', 'Docs front door: has a maintainer section');
  includes(doc, '[AI Action Control Plane architecture](02-architecture/ai-action-control-plane-architecture.md)', 'Docs front door: names AI Action Control Plane owner doc');
  includes(doc, '[Downstream enforcement contract](02-architecture/downstream-enforcement-contract.md)', 'Docs front door: names customer gate owner doc');
  includes(doc, '[Policy Foundry onboarding](02-architecture/policy-foundry-onboarding.md)', 'Docs front door: names Policy Foundry owner doc');
  includes(doc, '[Repository README](../README.md)', 'Docs front door: names repository README clearly');
  includes(doc, '[README current state](../README.md#current-state)', 'Docs front door: names README current state clearly');
  includes(doc, '[Live proof register](audit/live-proof-register.md)', 'Docs front door: links live proof owner doc');
  includes(doc, '[How to integrate Attestor](01-overview/how-to-integrate-attestor.md)', 'Docs front door: links integration guide');
  includes(doc, '[How Attestor connects to existing systems](01-overview/how-attestor-connects-to-existing-systems.md)', 'Docs front door: links existing-system connection overview');
  includes(doc, '[Action surface onboarding packet](02-architecture/action-surface-onboarding-packet.md)', 'Docs front door: links the metadata onboarding entry point');
  includes(doc, '[Developer entry path](01-overview/developer-entry-path.md)', 'Docs front door: links developer entry path');
  includes(doc, '[Customer middleware examples](../examples/customer-middleware/README.md)', 'Docs front door: links middleware examples');
  includes(doc, '[Reason codes](05-proof/reason-codes.md)', 'Docs front door: links reason codes');
  includes(doc, '[License and use](01-overview/license-and-use.md)', 'Docs front door: links license-and-use guide');
  includes(doc, '[Repository navigator](01-overview/repository-navigator.md)', 'Docs front door: links repository navigator');
  includes(doc, '[Repository map](01-overview/repository-map.md)', 'Docs front door: links repository map');
  includes(doc, 'repo-side evidence is not live production proof', 'Docs front door: keeps live-proof boundary visible');
  includes(doc, 'customer PEP / gate is where non-bypassability must be proven', 'Docs front door: keeps customer PEP proof boundary visible');
}

function testReadmeLinksNavigator(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '[Repository navigator](docs/01-overview/repository-navigator.md)', 'Repository navigator: README links the navigator');
  includes(readme, 'Start light. Go deeper only when you need the detail.', 'Repository navigator: README presents the short first-reader path');
  assert.doesNotMatch(readme, /\[Docs front door\]\(docs\/README\.md\)/u, 'Repository navigator: README does not expose docs front door beside the navigator');
  passed += 1;
  assert.doesNotMatch(readme, /\[Repository map\]\(docs\/01-overview\/repository-map\.md\)/u, 'Repository navigator: README does not expose repository map beside the navigator');
  passed += 1;
}

testNavigatorKeepsFirstVisitorPaths();
testNavigatorKeepsServiceMap();
testExistingSystemsOverviewIsPlainAndBounded();
testDeveloperEntryPathIsConcreteAndBounded();
testNavigatorKeepsNoClaimBoundaries();
testNavigatorLinksResolve();
testDocsFrontDoorPullsReadersToTheNextAction();
testReadmeLinksNavigator();

console.log(`Repository navigator docs tests: ${passed} passed, 0 failed`);
