import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  createPolicyFoundrySelfOnboardingCliPacket,
  policyFoundrySelfOnboardingCliDescriptor,
} from '../src/consequence-admission/index.js';
import {
  renderPolicyFoundrySelfOnboarding,
} from '../scripts/render-policy-foundry-self-onboarding.ts';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
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
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function refundOpenApi(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'Refund API',
      version: '1.0.0',
    },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape whsec_must_not_escape',
          responses: {
            '200': {
              description: 'ok',
            },
          },
        },
      },
    },
  });
}

function testSelfOnboardingPacketComposesReviewArtifacts(): void {
  const packet = createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt: '2026-05-13T09:00:00.000Z',
    manifests: [
      {
        text: refundOpenApi(),
        sourceRef: 'openapi/refunds.json',
        manifestKind: 'openapi',
        defaultDomain: 'money-movement',
        downstreamSystem: 'refund-service',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const serialized = JSON.stringify(packet);

  equal(packet.version, 'attestor.policy-foundry-self-onboarding-cli.v1', 'Self-onboarding CLI: version is explicit');
  equal(packet.status, 'blocked', 'Self-onboarding CLI: declaration-only flow is blocked');
  equal(packet.surfaceCount, 1, 'Self-onboarding CLI: surface count is retained');
  equal(packet.shadowEventCount, 0, 'Self-onboarding CLI: shadow event count is retained');
  equal(packet.onboardingSession.version, 'attestor.policy-foundry-onboarding-session.v1', 'Self-onboarding CLI: session is rendered');
  equal(packet.coverage.version, 'attestor.policy-foundry-coverage-score.v1', 'Self-onboarding CLI: coverage is rendered');
  equal(packet.gatePlanner.version, 'attestor.policy-foundry-gate-planner.v1', 'Self-onboarding CLI: gate planner is rendered');
  equal(packet.reviewHandoff.version, 'attestor.action-surface-onboarding-review-handoff.v1', 'Self-onboarding CLI: review handoff is rendered');
  equal(packet.redTeamFixtures.version, 'attestor.action-surface-onboarding-red-team-fixtures.v1', 'Self-onboarding CLI: red-team fixtures are rendered');
  equal(packet.reviewOnlyPatchPack.version, 'attestor.policy-foundry-review-only-patch-pack.v1', 'Self-onboarding CLI: review patch pack is rendered');
  equal(packet.sourceDigests.onboardingPacketDigest, packet.onboardingPacket.digest, 'Self-onboarding CLI: onboarding packet digest is bound');
  equal(packet.sourceDigests.onboardingSessionDigest, packet.onboardingSession.digest, 'Self-onboarding CLI: session digest is bound');
  equal(packet.sourceDigests.coverageScoreDigest, packet.coverage.digest, 'Self-onboarding CLI: coverage digest is bound');
  equal(packet.sourceDigests.gatePlannerDigest, packet.gatePlanner.digest, 'Self-onboarding CLI: gate planner digest is bound');
  equal(packet.patchCount, packet.reviewOnlyPatchPack.patchCount, 'Self-onboarding CLI: patch count mirrors patch pack');
  equal(packet.redTeamCaseCount, 12, 'Self-onboarding CLI: one stable fixture set is generated per surface');
  equal(packet.approvalRequired, true, 'Self-onboarding CLI: approval is required');
  equal(packet.autoEnforce, false, 'Self-onboarding CLI: auto enforce is false');
  equal(packet.rawPayloadStored, false, 'Self-onboarding CLI: raw payload storage is false');
  equal(packet.productionReady, false, 'Self-onboarding CLI: production readiness is false');
  equal(packet.appliesPatches, false, 'Self-onboarding CLI: applies patches is false');
  equal(packet.deploysInfrastructure, false, 'Self-onboarding CLI: deploys infrastructure is false');
  equal(packet.issuesCredentials, false, 'Self-onboarding CLI: issues credentials is false');
  equal(packet.activatesEnforcement, false, 'Self-onboarding CLI: activates enforcement is false');
  equal(packet.nonBypassableClaimAllowed, false, 'Self-onboarding CLI: non-bypassable claim is blocked');
  equal(packet.reviewMaterialOnly, true, 'Self-onboarding CLI: output is review material only');
  ok(packet.blockers.includes('session:send-shadow-traffic'), 'Self-onboarding CLI: missing shadow traffic is a blocker');
  ok(packet.blockers.includes('coverage:shadow-traffic'), 'Self-onboarding CLI: coverage blocker is retained');
  ok(
    packet.blockers.some((blocker) => blocker.includes('agent-direct-credential-exposed')),
    'Self-onboarding CLI: credential blocker is retained',
  );
  excludes(serialized, /raw_prompt_must_not_escape/u, 'Self-onboarding CLI: raw OpenAPI descriptions are not serialized');
  excludes(serialized, /whsec_must_not_escape/u, 'Self-onboarding CLI: secret-like text is not serialized');
}

function testRendererWritesOneCommandPacketFiles(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-policy-foundry-self-onboarding-'));
  const manifestPath = resolve(tempDir, 'refund.openapi.json');
  const outputDir = resolve(tempDir, 'packet');

  try {
    writeFileSync(manifestPath, refundOpenApi(), 'utf8');
    const rendered = renderPolicyFoundrySelfOnboarding({
      generatedAt: '2026-05-13T09:05:00.000Z',
      outputDir,
      manifests: [{ path: manifestPath, manifestKind: 'openapi' }],
      defaultDomain: 'money-movement',
      downstreamSystem: 'refund-service',
      credentialPosture: 'agent-held-static-secret',
    });
    const readme = readFileSync(rendered.artifacts.readmePath, 'utf8');
    const summary = readFileSync(rendered.artifacts.summaryPath, 'utf8');

    equal(rendered.packet.status, 'blocked', 'Self-onboarding renderer: packet status is retained');
    ok(existsSync(rendered.artifacts.summaryPath), 'Self-onboarding renderer: summary is written');
    ok(existsSync(rendered.artifacts.readmePath), 'Self-onboarding renderer: README is written');
    ok(existsSync(rendered.artifacts.onboardingSessionPath), 'Self-onboarding renderer: session file is written');
    ok(existsSync(rendered.artifacts.coveragePath), 'Self-onboarding renderer: coverage file is written');
    ok(existsSync(rendered.artifacts.gatePlannerPath), 'Self-onboarding renderer: gate planner file is written');
    ok(existsSync(rendered.artifacts.reviewHandoffPath), 'Self-onboarding renderer: review handoff file is written');
    ok(existsSync(rendered.artifacts.redTeamFixturesPath), 'Self-onboarding renderer: red-team fixtures file is written');
    ok(existsSync(rendered.artifacts.reviewOnlyPatchPackPath), 'Self-onboarding renderer: patch pack file is written');
    includes(readme, 'Safety boundary', 'Self-onboarding renderer: README includes safety boundary');
    includes(readme, 'applies patches: false', 'Self-onboarding renderer: README blocks auto-apply');
    includes(summary, 'policy-foundry-self-onboarding-cli', 'Self-onboarding renderer: summary includes surface kind');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testPackageScriptRunsOneCommandPath(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-policy-foundry-self-onboarding-cli-'));
  const outputDir = resolve(tempDir, 'packet');

  try {
    const result = spawnSync(
      'npm',
      [
        'run',
        'policy-foundry:self-onboard',
        '--',
        '--openapi=examples/action-surface-onboarding/refund.openapi.json',
        '--default-domain=money-movement',
        '--downstream-system=refund-service',
        '--credential-posture=agent-held-static-secret',
        `--output-dir=${outputDir}`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
      },
    );

    equal(result.status, 0, 'Self-onboarding package script exits cleanly');
    ok(existsSync(resolve(outputDir, 'summary.json')), 'Self-onboarding package script writes summary');
    ok(existsSync(resolve(outputDir, 'coverage-score.json')), 'Self-onboarding package script writes coverage');
    ok(existsSync(resolve(outputDir, 'review-only-patch-pack.json')), 'Self-onboarding package script writes patch pack');
    includes(result.stdout, 'summary.json', 'Self-onboarding package script prints summary path');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = policyFoundrySelfOnboardingCliDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const readme = readProjectFile('README.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-self-onboarding-cli.v1', 'Self-onboarding descriptor: version is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-self-onboarding-cli', 'Self-onboarding descriptor: data minimization surface is explicit');
  equal(descriptor.appliesPatches, false, 'Self-onboarding descriptor: applies patches is false');
  equal(descriptor.reviewMaterialOnly, true, 'Self-onboarding descriptor: review material only is true');
  includes(doc, 'src/consequence-admission/policy-foundry-self-onboarding-cli.ts', 'Policy Foundry docs: self-onboarding contract is named');
  includes(doc, 'scripts/render-policy-foundry-self-onboarding.ts', 'Policy Foundry docs: self-onboarding renderer is named');
  includes(doc, 'test:policy-foundry-self-onboarding-cli', 'Policy Foundry docs: self-onboarding test command is named');
  includes(readme, 'npm run policy-foundry:self-onboard', 'README: self-onboarding command is named');
  includes(readme, 'session, coverage, blockers, gate plan, handoff, red-team fixtures', 'README: self-onboarding output is described');
  includes(tracker, 'complete | Add One-Command Self-Onboarding CLI', 'Deepening tracker: Step 09 is complete');
  includes(tracker, 'Step 01 through Step 12 are complete', 'Deepening tracker: self-onboarding list is complete');
  equal(
    pkg.scripts['policy-foundry:self-onboard'],
    'tsx scripts/render-policy-foundry-self-onboarding.ts',
    'Package: self-onboarding command is exposed',
  );
  equal(
    pkg.scripts['test:policy-foundry-self-onboarding-cli'],
    'tsx tests/policy-foundry-self-onboarding-cli.test.ts',
    'Package: self-onboarding test is exposed',
  );
}

try {
  testSelfOnboardingPacketComposesReviewArtifacts();
  testRendererWritesOneCommandPacketFiles();
  testPackageScriptRunsOneCommandPath();
  testDescriptorDocsAndPackageSurfaceStayAligned();
  ok(passed > 0, 'Policy Foundry self-onboarding CLI tests executed');
  console.log(`Policy Foundry self-onboarding CLI tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry self-onboarding CLI tests failed:', error);
  process.exitCode = 1;
}
