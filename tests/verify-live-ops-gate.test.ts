import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type GateItem = {
  readonly label: string;
  readonly command: string;
};

const {
  liveOpsGroups,
  resolveLiveOpsGate,
} = await import('../scripts/run-live-ops-gate.mjs') as {
  readonly liveOpsGroups: {
    readonly localLive: readonly string[];
    readonly opsRender: readonly string[];
    readonly externalLive: readonly string[];
  };
  readonly resolveLiveOpsGate: (mode: string, options?: { readonly includeExternal?: boolean }) => readonly GateItem[];
};

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nDid not expect to find: ${unexpected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function labels(items: readonly GateItem[]): readonly string[] {
  return items.map((item) => item.label);
}

function testLocalAndOpsGatesAreExplicit(): void {
  const local = labels(resolveLiveOpsGate('local-live'));
  const ops = labels(resolveLiveOpsGate('ops'));

  includes(local.join('\n'), 'test:live-pg', 'Live/ops gate: local live includes embedded PostgreSQL proof');
  includes(local.join('\n'), 'test:live-account-oidc-sso', 'Live/ops gate: local live includes account SSO live-path rehearsal');
  includes(local.join('\n'), 'test:live-worker-health', 'Live/ops gate: local live includes worker health probe');
  includes(ops.join('\n'), 'test:observability-promotion-packet', 'Live/ops gate: ops includes observability promotion packet');
  includes(ops.join('\n'), 'test:kubernetes-ha-bundle', 'Live/ops gate: ops includes Kubernetes HA bundle');
  includes(ops.join('\n'), 'test:production-readiness-packet', 'Live/ops gate: ops includes production readiness packet');

  equal(local.length, liveOpsGroups.localLive.length, 'Live/ops gate: local mode maps exactly to local group');
  equal(ops.length, liveOpsGroups.opsRender.length, 'Live/ops gate: ops mode maps exactly to ops group');
}

function testExternalLiveCannotJoinByAccident(): void {
  const fullWithoutExternal = labels(resolveLiveOpsGate('full', { includeExternal: false })).join('\n');
  const fullWithExternal = labels(resolveLiveOpsGate('full', { includeExternal: true })).join('\n');
  const externalWithoutGate = resolveLiveOpsGate('external-live', { includeExternal: false });
  const externalWithGate = labels(resolveLiveOpsGate('external-live', { includeExternal: true })).join('\n');

  excludes(fullWithoutExternal, 'test:live-snowflake', 'Live/ops gate: full mode excludes Snowflake without external gate');
  excludes(fullWithoutExternal, 'test:live-vsac', 'Live/ops gate: full mode excludes VSAC without external gate');
  excludes(fullWithoutExternal, 'test:live-cypress', 'Live/ops gate: full mode excludes Cypress without external gate');
  includes(fullWithExternal, 'test:live-snowflake', 'Live/ops gate: full mode can include Snowflake when explicitly enabled');
  includes(fullWithExternal, 'test:live-vsac', 'Live/ops gate: full mode can include VSAC when explicitly enabled');
  includes(fullWithExternal, 'test:live-cypress', 'Live/ops gate: full mode can include Cypress when explicitly enabled');
  equal(externalWithoutGate.length, 0, 'Live/ops gate: external mode resolves no commands without opt-in');
  includes(externalWithGate, 'test:live-snowflake', 'Live/ops gate: external mode includes Snowflake when opted in');
}

function testPackageAndWorkflowExposeBoundaries(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as { readonly scripts: Record<string, string> };
  const workflow = readProjectFile('.github', 'workflows', 'full-verify.yml');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');

  equal(packageJson.scripts['verify:live-local'], 'node scripts/run-live-ops-gate.mjs local-live', 'Live/ops gate: package exposes local live gate');
  equal(packageJson.scripts['verify:ops'], 'node scripts/run-live-ops-gate.mjs ops', 'Live/ops gate: package exposes ops render gate');
  equal(packageJson.scripts['verify:external-live'], 'node scripts/run-live-ops-gate.mjs external-live', 'Live/ops gate: package exposes external live gate');
  equal(packageJson.scripts['verify:full'], 'npm run verify && node scripts/run-live-ops-gate.mjs full', 'Live/ops gate: full gate delegates to runner');
  includes(workflow, 'type: choice', 'Live/ops gate: workflow dispatch exposes explicit mode choices');
  includes(workflow, 'github_environment', 'Live/ops gate: workflow has protected environment input');
  includes(workflow, 'ATTESTOR_RUN_EXTERNAL_LIVE_TESTS: "true"', 'Live/ops gate: workflow opts external live tests in explicitly');
  includes(workflow, 'environment:', 'Live/ops gate: external live job uses a GitHub Environment');
  includes(productionReadiness, 'External live checks are opt-in', 'Live/ops gate: production docs explain external live boundary');
}

testLocalAndOpsGatesAreExplicit();
testExternalLiveCannotJoinByAccident();
testPackageAndWorkflowExposeBoundaries();

console.log(`Verify live/ops gate tests: ${passed} passed, 0 failed`);
