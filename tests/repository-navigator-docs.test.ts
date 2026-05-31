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

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testNavigatorKeepsFirstVisitorPaths(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');

  includes(doc, '# Repository Navigator', 'Repository navigator: title is present');
  includes(doc, 'Use this when the repository feels large', 'Repository navigator: purpose is plain');
  includes(doc, '## What This Opens', 'Repository navigator: names the embedded navigation hubs');
  includes(doc, '## Pick One Door', 'Repository navigator: guided decision entry is present');
  includes(doc, 'Do not read everything.', 'Repository navigator: avoids scavenger-hunt reading');
  includes(doc, 'Stop when...', 'Repository navigator: each path has a stopping rule');
  includes(doc, '"What is proven today?"', 'Repository navigator: frames readiness as evidence, not a production claim');
  includes(doc, '## Start By Intent', 'Repository navigator: task-first navigation is present');
  includes(doc, '## Start By Role', 'Repository navigator: role-first navigation is present');
  includes(doc, '## Maintainer Maps', 'Repository navigator: deep maps are grouped behind a maintainer section');
  includes(doc, '## If You Are Lost', 'Repository navigator: lost-reader rescue path is present');

  for (const expected of [
    '[Try Attestor first](try-attestor-first.md)',
    '[Run the demos in order](demo-guide.md)',
    '[How to integrate Attestor](how-to-integrate-attestor.md)',
    '[Docs index](../README.md)',
    '[README current state](../../README.md#current-state)',
    '[Live proof register](../audit/live-proof-register.md)',
    '[Run Attestor in shadow pilot mode](shadow-event-payload-examples.md)',
    '[Customer middleware examples](../../examples/customer-middleware/README.md)',
    '[Reason codes](../05-proof/reason-codes.md)',
    '[Audit evidence system](../audit/README.md)',
    '[Internal machine map](../02-architecture/attestor-internal-machine-map.md)',
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
    '# Run The Demos In Order',
    '## 3. Pick The Action Class You Care About',
    'npm run demo:golden-refund',
    'npm run demo:golden-paths',
    'npm run example:non-bypassable-gateway',
    'They do not prove live customer enforcement',
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

function testNavigatorKeepsNoClaimBoundaries(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  const map = readProjectFile('docs', '01-overview', 'repository-map.md');

  includes(doc, 'This is a map, not a new authority surface.', 'Repository navigator: map is not an authority surface');
  includes(doc, 'repo-side evidence is not live production proof', 'Repository navigator: live proof boundary is explicit');
  includes(doc, 'package boundary is not hosted enforcement', 'Repository navigator: package boundary no-claim is explicit');
  includes(doc, 'admission decision is not downstream execution', 'Repository navigator: decision/execution split is explicit');
  includes(doc, 'customer PEP / gate is where non-bypassability must be proven', 'Repository navigator: customer PEP proof boundary is explicit');
  excludes(doc, /"Is this production-ready\?"/u, 'Repository navigator: avoids production-ready as a front-door link prompt');
  includes(map, 'This is a map, not an authority surface.', 'Repository map: map is not an authority surface');
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
  assertLinksResolve('docs', '01-overview', 'repository-map.md');
  assertLinksResolve('docs', '01-overview', 'demo-guide.md');
  assertLinksResolve('docs', 'README.md');
}

function testDocsFrontDoorPullsReadersToTheNextAction(): void {
  const doc = readProjectFile('docs', 'README.md');

  includes(doc, '# Attestor Docs', 'Docs front door: title is present');
  includes(doc, 'Use this docs index when the README gave you the shape', 'Docs front door: purpose names the index');
  includes(doc, 'understand -> try -> integrate -> explain decisions -> verify claims -> maintain', 'Docs front door: keeps the reader path explicit');
  includes(doc, '## Start Here', 'Docs front door: has a first-reader section');
  includes(doc, '## Canonical Docs', 'Docs front door: has a canonical-docs section');
  includes(doc, 'This table is navigation, not a new authority surface.', 'Docs front door: canonical table is not an authority surface');
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
  includes(doc, '[Run the demos in order](01-overview/demo-guide.md)', 'Docs front door: links guided demo path');
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
testNavigatorKeepsNoClaimBoundaries();
testNavigatorLinksResolve();
testDocsFrontDoorPullsReadersToTheNextAction();
testReadmeLinksNavigator();

console.log(`Repository navigator docs tests: ${passed} passed, 0 failed`);
