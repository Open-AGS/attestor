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

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testNavigatorKeepsFirstVisitorPaths(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(doc, '# Repository Navigator', 'Repository navigator: title is present');
  includes(doc, 'Use this when the repository feels large', 'Repository navigator: purpose is plain');
  includes(doc, '## Pick One Door', 'Repository navigator: guided decision entry is present');
  includes(doc, 'Do not read everything.', 'Repository navigator: avoids scavenger-hunt reading');
  includes(doc, 'Stop when...', 'Repository navigator: each path has a stopping rule');
  includes(doc, '## Start By Intent', 'Repository navigator: task-first navigation is present');
  includes(doc, '## Start By Role', 'Repository navigator: role-first navigation is present');
  includes(doc, '## Code Map', 'Repository navigator: code map is present');
  includes(doc, '## Package Surface Map', 'Repository navigator: package surface map is present');
  includes(doc, '## If You Are Lost', 'Repository navigator: lost-reader rescue path is present');

  for (const expected of [
    '[Try Attestor first](try-attestor-first.md)',
    '[Current repository truth](../../README.md#current-repository-truth)',
    '[Live proof register](../audit/live-proof-register.md)',
    '[Shadow event payload examples](shadow-event-payload-examples.md)',
    '[Customer middleware examples](../../examples/customer-middleware/README.md)',
    '[Reason codes](../05-proof/reason-codes.md)',
    '[Audit evidence system](../audit/README.md)',
    '[Internal machine map](../02-architecture/attestor-internal-machine-map.md)',
    '[Service organization plan](../02-architecture/service-organization-plan.md)',
  ]) {
    includes(doc, expected, `Repository navigator: links ${expected}`);
  }
}

function testNavigatorKeepsServiceMap(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');

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
  ]) {
    includes(doc, expected, `Repository navigator: keeps service map row ${expected}`);
  }
}

function testNavigatorKeepsNoClaimBoundaries(): void {
  const doc = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(doc, 'This is a map, not a new authority surface.', 'Repository navigator: map is not an authority surface');
  includes(doc, 'repo-side evidence is not live production proof', 'Repository navigator: live proof boundary is explicit');
  includes(doc, 'package boundary is not hosted enforcement', 'Repository navigator: package boundary no-claim is explicit');
  includes(doc, 'admission decision is not downstream execution', 'Repository navigator: decision/execution split is explicit');
  includes(doc, 'customer PEP / gate is where non-bypassability must be proven', 'Repository navigator: customer PEP proof boundary is explicit');
}

function testNavigatorLinksResolve(): void {
  const docPath = join(process.cwd(), 'docs', '01-overview', 'repository-navigator.md');
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

  assert.deepEqual(missing, [], 'Repository navigator: all relative links resolve');
  passed += 1;
}

function testReadmeLinksNavigator(): void {
  const readme = readProjectFile('README.md');

  includes(readme, '[Repository navigator](docs/01-overview/repository-navigator.md)', 'Repository navigator: README links the navigator');
}

testNavigatorKeepsFirstVisitorPaths();
testNavigatorKeepsServiceMap();
testNavigatorKeepsNoClaimBoundaries();
testNavigatorLinksResolve();
testReadmeLinksNavigator();

console.log(`Repository navigator docs tests: ${passed} passed, 0 failed`);
