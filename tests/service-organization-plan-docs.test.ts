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

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function testPlanKeepsContractShape(): void {
  const doc = readProjectFile('docs', '02-architecture', 'service-organization-plan.md');

  for (const expected of [
    '# Service Organization Plan',
    'This is the refactor contract for reorganizing `src/service/`.',
    'At B-service-00, `src/service/` has 96 root-level files',
    '## Research Anchors',
    '## Protected Principles',
    '## Authority Boundary',
    '## Rules',
    '## Import Strategy',
    '## Planned Slices',
    '## Not Now',
    '## Slice Exit Criteria',
    '## Final Closeout',
    '## No-Claims',
  ]) {
    includes(doc, expected, `Service organization plan: keeps ${expected}`);
  }
}

function testPlanKeepsResearchAnchors(): void {
  const doc = readProjectFile('docs', '02-architecture', 'service-organization-plan.md');

  for (const expected of [
    'https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes',
    'https://www.typescriptlang.org/docs/handbook/modules/theory.html',
    'https://hono.dev/docs/api/routing#grouping-ordering',
    'https://kubernetes.io/docs/contribute/review/reviewing-prs/',
    'These are engineering anchors only. They are not certifications',
  ]) {
    includes(doc, expected, `Service organization plan: keeps source anchor ${expected}`);
  }
}

function testPlanKeepsMoveBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'service-organization-plan.md');

  for (const expected of [
    'Move one service family per PR.',
    'Do not split route files in this phase.',
    'Do not split `control-plane-store.ts` in this phase.',
    'Do not split `api-types.ts` in this phase.',
    'Do not change package exports in this phase.',
    'Use the smallest strategy that preserves runtime behavior.',
    '### Direct mechanical move',
    '### Compatibility shim',
    'prefer direct mechanical moves for private service internals',
    'prefer a shim when path stability is customer-facing or package-adjacent',
  ]) {
    includes(doc, expected, `Service organization plan: keeps move boundary ${expected}`);
  }
}

function testPlanKeepsSliceOrderAndGates(): void {
  const doc = readProjectFile('docs', '02-architecture', 'service-organization-plan.md');

  for (const expected of [
    '| B-service-00 | Plan/contract | no source move |',
    '| B-service-01 | Account support | `src/service/account/` |',
    '| B-service-02 | Billing and Stripe support | `src/service/billing/` and `src/service/billing/stripe/` |',
    '| B-service-03 | Release support | `src/service/release/` |',
    '| B-service-04 | Async and pipeline support | `src/service/pipeline/` and `src/service/async/` |',
    '| B-service-05 | Hosted, Policy Foundry, and shadow support | `src/service/hosted/`, `src/service/policy-foundry/`, `src/service/shadow/` |',
    '| B-service-06 | Closeout lock | docs/tests only unless drift is found |',
    '`npm run verify`',
    'If `npm run verify` times out or fails, B-service-06 is not complete.',
  ]) {
    includes(doc, expected, `Service organization plan: keeps slice/gate ${expected}`);
  }
}

function testPlanKeepsNoClaims(): void {
  const doc = readProjectFile('docs', '02-architecture', 'service-organization-plan.md');

  for (const expected of [
    'This plan does not make Attestor production-ready.',
    'It does not prove live customer enforcement',
    'customer PEP no-bypass',
    'live KMS signing',
    'live replay-store safety',
    'enterprise readiness',
  ]) {
    includes(doc, expected, `Service organization plan: keeps no-claim ${expected}`);
  }
}

function testPlanLinksResolveAndNavigationSurfaces(): void {
  const docPath = join(process.cwd(), 'docs', '02-architecture', 'service-organization-plan.md');
  const doc = readFileSync(docPath, 'utf8');
  const docDir = dirname(docPath);
  const missing: string[] = [];

  for (const match of doc.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (/^https?:\/\//iu.test(href) || href.startsWith('#')) continue;
    const pathOnly = href.split('#')[0];
    const resolved = normalize(join(docDir, pathOnly));
    if (!existsSync(resolved)) missing.push(href);
  }

  assert.deepEqual(missing, [], 'Service organization plan: all relative links resolve');
  passed += 1;

  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  includes(
    navigator,
    '[Service organization plan](../02-architecture/service-organization-plan.md)',
    'Service organization plan: repository navigator links the plan',
  );
  includes(
    navigator,
    'npm run test:service-organization-plan-docs',
    'Service organization plan: repository navigator names the docs guard',
  );
}

function testPackageScriptExposesPlanGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    packageJson.scripts['test:service-organization-plan-docs'],
    'tsx tests/service-organization-plan-docs.test.ts',
    'Package scripts: service organization plan docs guard is exposed',
  );
}

testPlanKeepsContractShape();
testPlanKeepsResearchAnchors();
testPlanKeepsMoveBoundaries();
testPlanKeepsSliceOrderAndGates();
testPlanKeepsNoClaims();
testPlanLinksResolveAndNavigationSurfaces();
testPackageScriptExposesPlanGuard();

console.log(`Service organization plan docs tests: ${passed} passed, 0 failed`);
