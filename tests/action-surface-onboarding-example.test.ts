import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderActionSurfaceOnboardingPacket } from '../scripts/render/render-action-surface-onboarding-packet.ts';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function testExampleManifestRendersAReviewOnlyPacket(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-action-surface-example-'));
  const outputDir = resolve(tempDir, 'packet');

  try {
    const rendered = renderActionSurfaceOnboardingPacket({
      generatedAt: '2026-05-12T18:00:00.000Z',
      outputDir,
      manifests: [{
        path: 'examples/action-surface-onboarding/refund.openapi.json',
        manifestKind: 'openapi',
      }],
      downstreamSystem: 'refund-service',
      defaultDomain: 'money-movement',
      credentialPosture: 'agent-held-static-secret',
    });
    const summary = readFileSync(rendered.artifacts.summaryPath, 'utf8');
    const readme = readFileSync(rendered.artifacts.readmePath, 'utf8');

    equal(rendered.packet.status, 'requires-review', 'Action surface example: packet requires review');
    equal(rendered.packet.manifestCount, 1, 'Action surface example: one OpenAPI manifest is consumed');
    equal(rendered.packet.declarationCount, 2, 'Action surface example: write operations become declarations');
    equal(rendered.packet.surfacePlans.length, 2, 'Action surface example: two refund surfaces are planned');
    equal(rendered.packet.approvalRequired, true, 'Action surface example: approval remains required');
    equal(rendered.packet.autoEnforce, false, 'Action surface example: auto enforce is disabled');
    equal(rendered.packet.rawPayloadStored, false, 'Action surface example: raw payload is not stored');
    equal(rendered.packet.productionReady, false, 'Action surface example: production readiness is not claimed');
    equal(rendered.packet.deploysInfrastructure, false, 'Action surface example: packet does not deploy infrastructure');
    equal(rendered.packet.issuesCredentials, false, 'Action surface example: packet does not issue credentials');
    equal(rendered.packet.activatesEnforcement, false, 'Action surface example: packet does not activate enforcement');
    includes(summary, 'refund_service.issue_refund', 'Action surface example: issueRefund surface is normalized');
    includes(summary, 'refund_service.approve_refund', 'Action surface example: approveRefund surface is normalized');
    includes(summary, 'gateway-proxy-config', 'Action surface example: gateway draft is generated as review material');
    includes(summary, 'policy-twin-backtest', 'Action surface example: Policy Twin draft is generated');
    includes(readme, 'Safety boundary', 'Action surface example: README exposes safety boundary');
    includes(readme, 'add-shadow-capture', 'Action surface example: README asks for shadow capture before enforcement');
    excludes(summary, /sk_live|rk_live|whsec|private_key|secret=/iu, 'Action surface example: summary excludes secret-like strings');
    excludes(readme, /production ready: true/iu, 'Action surface example: README does not overclaim production readiness');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testPackageScriptRunsWithOverrideOutputDir(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-action-surface-example-cli-'));
  const outputDir = resolve(tempDir, 'packet');
  const integrationKitOutputDir = resolve(tempDir, 'integration-kit');

  try {
    const result = spawnSync(
      'npm',
      ['run', 'example:action-surface-onboarding', '--', `--output-dir=${outputDir}`],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    );
    equal(result.status, 0, 'Action surface example: package script exits cleanly');
    ok(existsSync(resolve(outputDir, 'summary.json')), 'Action surface example: package script writes summary');
    ok(existsSync(resolve(outputDir, 'README.md')), 'Action surface example: package script writes README');
    includes(result.stdout, 'summary.json', 'Action surface example: CLI prints rendered packet summary path');

    const integrationKit = spawnSync(
      'npm',
      ['run', 'example:action-surface-integration-kit', '--', `--output-dir=${integrationKitOutputDir}`],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    );
    equal(integrationKit.status, 0, 'Action surface example: integration kit package script exits cleanly');
    ok(
      existsSync(resolve(integrationKitOutputDir, 'README.md')),
      'Action surface example: integration kit writes README',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'summary.json')),
      'Action surface example: integration kit writes summary',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'artifact-manifest.json')),
      'Action surface example: integration kit writes artifact manifest',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'no-bypass-probes.json')),
      'Action surface example: integration kit writes no-bypass probes',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'approval-record.template.json')),
      'Action surface example: integration kit writes approval template',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'artifacts', 'openapi-overlay.json')),
      'Action surface example: integration kit writes OpenAPI overlay draft',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'artifacts', 'envoy-ext-authz.json')),
      'Action surface example: integration kit writes Envoy draft',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'artifacts', 'mcp-gateway-drafts.json')),
      'Action surface example: integration kit writes MCP gateway drafts',
    );
    ok(
      existsSync(resolve(integrationKitOutputDir, 'artifacts', 'no-bypass-probe-bundle.json')),
      'Action surface example: integration kit writes no-bypass probe bundle',
    );
    includes(
      integrationKit.stdout,
      '"nonBypassableClaimAllowed": false',
      'Action surface example: integration kit stdout keeps no-bypass non-claim',
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testDocsExposeTheExampleWithoutOverclaiming(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const onboardingExampleScript = [
    'tsx scripts/render/render-action-surface-onboarding-packet.ts',
    '--openapi=examples/action-surface-onboarding/refund.openapi.json',
    '--default-domain=money-movement',
    '--downstream-system=refund-service',
    '--credential-posture=agent-held-static-secret',
  ].join(' ');
  const integrationKitExampleScript = [
    'tsx scripts/render/render-action-surface-integration-kit.ts',
    '--openapi=examples/action-surface-onboarding/refund.openapi.json',
    '--default-domain=money-movement',
    '--downstream-system=refund-service',
    '--credential-posture=agent-held-static-secret',
    '--target-openapi=examples/action-surface-onboarding/refund.openapi.json',
  ].join(' ');
  const readme = readProjectFile('README.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const demoGuide = readProjectFile('docs', '01-overview', 'demo-guide.md');
  const architectureDoc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  const integrationKitDoc = readProjectFile(
    'docs',
    '02-architecture',
    'action-surface-integration-kit-buildout.md',
  );
  const exampleDoc = readProjectFile('examples', 'action-surface-onboarding', 'README.md');

  equal(
    pkg.scripts['example:action-surface-onboarding'],
    onboardingExampleScript,
    'Action surface example: package script is stable',
  );
  equal(
    pkg.scripts['test:action-surface-onboarding-example'],
    'tsx tests/action-surface-onboarding-example.test.ts',
    'Action surface example: package test is exposed',
  );
  equal(
    pkg.scripts['example:action-surface-integration-kit'],
    integrationKitExampleScript,
    'Action surface example: integration kit package script is stable',
  );
  includes(
    readme,
    '[Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md) - turn reviewed metadata into a review-required integration plan.',
    'Action surface example: README links onboarding before the integration kit',
  );
  includes(
    readme,
    '[Action surface integration kit buildout](docs/02-architecture/action-surface-integration-kit-buildout.md) - render review files from existing metadata before any apply or deploy step.',
    'Action surface example: README links integration kit after onboarding',
  );
  includes(tryFirst, 'npm run example:action-surface-onboarding', 'Action surface example: try-first doc includes command');
  includes(
    tryFirst,
    'npm run example:action-surface-integration-kit',
    'Action surface example: try-first doc includes integration kit command',
  );
  includes(
    demoGuide,
    'npm run example:action-surface-integration-kit',
    'Action surface example: demo guide includes integration kit command',
  );
  includes(architectureDoc, 'examples/action-surface-onboarding/refund.openapi.json', 'Action surface example: architecture doc names fixture');
  includes(
    integrationKitDoc,
    'npm run example:action-surface-integration-kit',
    'Action surface example: integration kit doc names bundled example command',
  );
  includes(exampleDoc, 'review material only', 'Action surface example: example README keeps safety boundary');
  includes(
    exampleDoc,
    'artifacts/no-bypass-probe-bundle.json',
    'Action surface example: example README names generated no-bypass bundle',
  );
  excludes(readme, /action-surface onboarding example is production-ready/iu, 'Action surface example: README does not overclaim');
  excludes(exampleDoc, /integration kit example is production-ready/iu, 'Action surface example: integration kit README does not overclaim');
}

try {
  testExampleManifestRendersAReviewOnlyPacket();
  testPackageScriptRunsWithOverrideOutputDir();
  testDocsExposeTheExampleWithoutOverclaiming();
  console.log(`Action surface onboarding example tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding example tests failed:', error);
  process.exitCode = 1;
}
