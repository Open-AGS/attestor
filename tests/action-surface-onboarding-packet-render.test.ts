import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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

function testRendererWritesReviewPacket(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-action-surface-render-'));
  const manifestPath = resolve(tempDir, 'refund.openapi.json');
  const outputDir = resolve(tempDir, 'packet');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Refund API', version: '1.0.0' },
      paths: {
        '/refunds': {
          post: {
            operationId: 'issueRefund',
            description: 'raw_prompt_must_not_escape sk_live_must_not_escape',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    }, null, 2)}\n`,
    'utf8',
  );

  try {
    const rendered = renderActionSurfaceOnboardingPacket({
      generatedAt: '2026-05-12T16:40:00.000Z',
      attestorBaseUrl: 'https://attestor.example.com',
      outputDir,
      manifests: [{ path: manifestPath, manifestKind: 'openapi' }],
      downstreamSystem: 'refund-service',
      defaultDomain: 'money-movement',
      credentialPosture: 'agent-held-static-secret',
    });
    const summary = readFileSync(rendered.artifacts.summaryPath, 'utf8');
    const readme = readFileSync(rendered.artifacts.readmePath, 'utf8');

    equal(rendered.packet.status, 'requires-review', 'Onboarding render: discovered surface requires review');
    equal(rendered.packet.productionReady, false, 'Onboarding render: packet does not claim production readiness');
    equal(rendered.packet.deploysInfrastructure, false, 'Onboarding render: packet does not deploy infrastructure');
    equal(rendered.packet.activatesEnforcement, false, 'Onboarding render: packet does not activate enforcement');
    ok(existsSync(rendered.artifacts.summaryPath), 'Onboarding render: summary JSON is written');
    ok(existsSync(rendered.artifacts.readmePath), 'Onboarding render: README is written');
    includes(summary, 'refund_service.issue_refund', 'Onboarding render: summary includes normalized action surface');
    includes(summary, 'gateway-proxy-config', 'Onboarding render: summary includes generated gateway draft kind');
    includes(readme, 'Safety boundary', 'Onboarding render: README exposes safety boundary');
    includes(readme, 'add-shadow-capture', 'Onboarding render: README exposes next onboarding step');
    excludes(summary, /raw_prompt_must_not_escape/u, 'Onboarding render: raw OpenAPI description is not serialized');
    excludes(summary, /sk_live_must_not_escape/u, 'Onboarding render: secret-like text is not serialized');
    excludes(readme, /production ready: true/iu, 'Onboarding render: README does not overclaim production readiness');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRendererDocsAndScripts(): void {
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const doc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  const readme = readProjectFile('README.md');

  equal(
    pkg.scripts['render:action-surface-onboarding-packet'],
    'tsx scripts/render/render-action-surface-onboarding-packet.ts',
    'Onboarding render: package script is exposed',
  );
  equal(
    pkg.scripts['test:action-surface-onboarding-packet-render'],
    'tsx tests/action-surface-onboarding-packet-render.test.ts',
    'Onboarding render: package test is exposed',
  );
  includes(doc, 'render:action-surface-onboarding-packet', 'Onboarding render: architecture doc names renderer');
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Onboarding render: README links the existing-systems overview',
  );
}

try {
  testRendererWritesReviewPacket();
  testRendererDocsAndScripts();
  console.log(`Action surface onboarding packet render tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface onboarding packet render tests failed:', error);
  process.exitCode = 1;
}
