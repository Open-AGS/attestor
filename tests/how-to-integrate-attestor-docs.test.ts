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

function testGuideExplainsTheCustomerIntegrationPath(): void {
  const doc = readProjectFile('docs', '01-overview', 'how-to-integrate-attestor.md');

  includes(doc, '# How To Integrate Attestor', 'How-to integrate docs: title is present');
  includes(doc, '[Docs index](../README.md)', 'How-to integrate docs: links back to docs index clearly');
  includes(doc, '[Repository README first-reader section](../../README.md#start-here)', 'How-to integrate docs: names the README section clearly');
  includes(doc, 'Do not start with a dashboard.', 'How-to integrate docs: rejects dashboard-first framing');
  includes(doc, 'Start with the line of code that does the real thing.', 'How-to integrate docs: starts at the side effect');
  includes(doc, 'AI prepares an action', 'How-to integrate docs: names the AI side');
  includes(doc, 'your app asks Attestor first', 'How-to integrate docs: names the app callout');
  includes(doc, 'admit / narrow / review / block', 'How-to integrate docs: keeps the four decision outcomes');
  includes(doc, 'The first integration is the gate before the side effect.', 'How-to integrate docs: keeps the core integration shape');
  includes(doc, 'await refundService.issueRefund(intent);', 'How-to integrate docs: shows the real side-effect line');
  includes(doc, 'const decision = await attestor.admit(intent);', 'How-to integrate docs: shows the decision call');
  includes(doc, "decision.outcome !== 'admit' && decision.outcome !== 'narrow'", 'How-to integrate docs: holds review and block');
  includes(doc, 'direct call to the downstream service must fail', 'How-to integrate docs: states no-bypass proof');
  includes(doc, 'Without that customer-owned gate, Attestor is decision evidence.', 'How-to integrate docs: keeps advisory boundary clear');
}

function testGuideUsesReferenceSafePayloadsAndNoOverclaim(): void {
  const doc = readProjectFile('docs', '01-overview', 'how-to-integrate-attestor.md');

  includes(doc, '"mode": "observe"', 'How-to integrate docs: starts with observe mode');
  includes(doc, '"policyRef": "policy:refunds:v1"', 'How-to integrate docs: uses policy references');
  includes(doc, '"evidenceRefs"', 'How-to integrate docs: uses evidence references');
  includes(doc, 'Attestor does not need the raw prompt', 'How-to integrate docs: forbids raw prompt');
  includes(doc, 'Boundary: this page explains the integration shape.', 'How-to integrate docs: carries boundary language');
  includes(doc, '[Action surface auto-context](../02-architecture/action-surface-auto-context.md)', 'How-to integrate docs: links the metadata-to-packet path');
  includes(doc, 'It does not prove live', 'How-to integrate docs: avoids live-proof overclaim');
  excludes(doc, /sk_(live|test)_[A-Za-z0-9_]+/u, 'How-to integrate docs: no Stripe secret keys');
  excludes(doc, /Bearer\s+(?!<redacted>)[A-Za-z0-9._-]+/u, 'How-to integrate docs: no bearer tokens');
  excludes(doc, /-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'How-to integrate docs: no private keys');
  excludes(doc, /\[Attestor Docs\]\(\.\.\/README\.md\)/u, 'How-to integrate docs: avoids vague docs-index link text');
  excludes(doc, /\[Start Here\]\(\.\.\/\.\.\/README\.md#start-here\)/u, 'How-to integrate docs: avoids vague README-section link text');
  excludes(doc, /production-ready/iu, 'How-to integrate docs: avoids production-ready claim wording');
  excludes(doc, /enterprise-grade/iu, 'How-to integrate docs: avoids enterprise marketing language');
}

function testGuideIsReachableFromPublicNavigation(): void {
  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');

  includes(readme, '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)', 'How-to integrate docs: README links guide');
  includes(navigator, '[How to integrate Attestor](how-to-integrate-attestor.md)', 'How-to integrate docs: navigator links guide');
}

function testGuideLinksResolve(): void {
  const docPath = join(process.cwd(), 'docs', '01-overview', 'how-to-integrate-attestor.md');
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

  assert.deepEqual(missing, [], 'How-to integrate docs: all relative links resolve');
  passed += 1;
}

function testPackageScriptIsExposed(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts['test:how-to-integrate-attestor-docs'],
    'tsx tests/how-to-integrate-attestor-docs.test.ts',
    'Package exposes how-to integrate docs test',
  );
  passed += 1;
}

testGuideExplainsTheCustomerIntegrationPath();
testGuideUsesReferenceSafePayloadsAndNoOverclaim();
testGuideIsReachableFromPublicNavigation();
testGuideLinksResolve();
testPackageScriptIsExposed();

console.log(`How-to integrate Attestor docs tests: ${passed} passed, 0 failed`);
