import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  renderActionSurfaceIntegrationKit,
} from '../scripts/render/render-action-surface-integration-kit.ts';

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
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function writeRefundOpenApi(path: string): void {
  writeFileSync(
    path,
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
}

function testRendererWritesReviewOnlyIntegrationKit(): void {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-integration-kit-render-'));
  const manifestPath = resolve(tempDir, 'refund.openapi.json');
  const outputDir = resolve(tempDir, 'kit');
  writeRefundOpenApi(manifestPath);

  try {
    const rendered = renderActionSurfaceIntegrationKit({
      generatedAt: '2026-05-31T13:00:00.000Z',
      attestorBaseUrl: 'https://attestor.example.com',
      outputDir,
      manifests: [{ path: manifestPath, manifestKind: 'openapi' }],
      downstreamSystem: 'refund-service',
      defaultDomain: 'money-movement',
      credentialPosture: 'agent-held-static-secret',
      targetOpenApiRef: 'refund.openapi.json',
    });
    const readme = readFileSync(rendered.artifacts.readmePath, 'utf8');
    const summary = readFileSync(rendered.artifacts.summaryPath, 'utf8');
    const artifactManifest = readFileSync(rendered.artifacts.artifactManifestPath, 'utf8');
    const openApiOverlay = readFileSync(rendered.artifacts.openApiOverlayPath, 'utf8');
    const mcpGatewayDrafts = readFileSync(rendered.artifacts.mcpGatewayDraftsPath, 'utf8');
    const noBypassBundle = readFileSync(rendered.artifacts.noBypassProbeBundlePath, 'utf8');
    const customerGateWiringPacket = readFileSync(
      rendered.artifacts.customerGateWiringPacketPath,
      'utf8',
    );

    equal(rendered.kit.status, 'review-required', 'Integration kit render: surfaces require review');
    equal(rendered.kit.deploysInfrastructure, false, 'Integration kit render: deployment is false');
    equal(rendered.kit.activatesEnforcement, false, 'Integration kit render: enforcement activation is false');
    equal(
      rendered.kit.nonBypassableClaimAllowed,
      false,
      'Integration kit render: no-bypass claim is false',
    );
    ok(existsSync(rendered.artifacts.readmePath), 'Integration kit render: README is written');
    ok(existsSync(rendered.artifacts.summaryPath), 'Integration kit render: summary is written');
    ok(
      existsSync(rendered.artifacts.artifactManifestPath),
      'Integration kit render: artifact manifest is written',
    );
    ok(
      existsSync(rendered.artifacts.noBypassProbesPath),
      'Integration kit render: no-bypass probes plan is written',
    );
    ok(
      existsSync(rendered.artifacts.approvalRecordTemplatePath),
      'Integration kit render: approval template is written',
    );
    ok(existsSync(rendered.artifacts.openApiOverlayPath), 'Integration kit render: overlay is written');
    ok(existsSync(rendered.artifacts.envoyExtAuthzPath), 'Integration kit render: Envoy draft is written');
    ok(
      existsSync(rendered.artifacts.mcpGatewayDraftsPath),
      'Integration kit render: MCP draft bundle is written',
    );
    ok(
      existsSync(rendered.artifacts.noBypassProbeBundlePath),
      'Integration kit render: no-bypass probe bundle is written',
    );
    ok(
      existsSync(rendered.artifacts.customerGateWiringPacketPath),
      'Integration kit render: customer gate wiring packet is written',
    );
    includes(readme, 'Start here:', 'Integration kit render: README starts with the reviewer entry point');
    includes(readme, 'What this is:', 'Integration kit render: README explains the local handoff shape');
    includes(
      readme,
      'local-first review package',
      'Integration kit render: README keeps local-first positioning',
    );
    includes(readme, 'Decision checklist:', 'Integration kit render: README gives reviewer decisions');
    includes(
      readme,
      'no source manifests are uploaded by this renderer',
      'Integration kit render: README keeps upload boundary explicit',
    );
    includes(readme, 'Safety boundary', 'Integration kit render: README exposes safety boundary');
    includes(readme, 'does not apply infrastructure', 'Integration kit render: README blocks apply claims');
    includes(summary, 'artifactManifestDigest', 'Integration kit render: summary binds artifact digest');
    includes(artifactManifest, 'gateway-proxy-config', 'Integration kit render: artifact manifest is useful');
    includes(
      openApiOverlay,
      'credentialBoundaryReviewRequired',
      'Integration kit render: overlay carries credential review field',
    );
    includes(
      mcpGatewayDrafts,
      '"annotationAuthority": "hint-only"',
      'Integration kit render: MCP draft keeps annotation authority bounded',
    );
    includes(noBypassBundle, '"executesProbes": false', 'Integration kit render: probe bundle does not run');
    includes(
      noBypassBundle,
      'evidenceBinding',
      'Integration kit render: probe bundle carries evidence binding',
    );
    includes(
      customerGateWiringPacket,
      'LP-CUSTOMER-PEP-NO-BYPASS',
      'Integration kit render: customer gate wiring packet names live proof blocker',
    );
    includes(
      customerGateWiringPacket,
      '"customerOwnedGateRequired": true',
      'Integration kit render: customer gate wiring packet requires customer gate',
    );
    includes(
      customerGateWiringPacket,
      '"activatesEnforcement": false',
      'Integration kit render: customer gate wiring packet does not activate enforcement',
    );
    excludes(summary, /raw_prompt_must_not_escape/u, 'Integration kit render: raw OpenAPI text is not serialized');
    excludes(summary, /sk_live_must_not_escape/u, 'Integration kit render: secret-like text is not serialized');
    excludes(readme, /production ready: true/iu, 'Integration kit render: README does not overclaim production');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRendererCliAndDocsAndPackageScript(): void {
  const tempDir = mkdtempSync(join(tmpdir(), 'attestor-integration-kit-cli-'));
  const manifestPath = join(tempDir, 'refund.openapi.json');
  const outputDir = join(tempDir, 'kit');
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  writeRefundOpenApi(manifestPath);

  try {
    const run = spawnSync(
      process.execPath,
      [
        tsxCli,
        'scripts/render/render-action-surface-integration-kit.ts',
        `--openapi=${manifestPath}`,
        `--output-dir=${outputDir}`,
        '--default-domain=money-movement',
        '--downstream-system=refund-service',
        '--credential-posture=agent-held-static-secret',
        '--generated-at=2026-05-31T13:05:00.000Z',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );
    equal(run.status, 0, `Integration kit render CLI exits successfully: ${run.stderr}`);
    includes(run.stdout, '"deploysInfrastructure": false', 'Integration kit CLI: stdout keeps no-deploy flag');
    includes(run.stdout, '"activatesEnforcement": false', 'Integration kit CLI: stdout keeps no-enforce flag');
    ok(existsSync(join(outputDir, 'README.md')), 'Integration kit CLI: README is written');
    ok(
      existsSync(join(outputDir, 'artifacts', 'no-bypass-probe-bundle.json')),
      'Integration kit CLI: no-bypass bundle is written',
    );
    ok(
      existsSync(join(outputDir, 'artifacts', 'customer-gate-wiring-packet.json')),
      'Integration kit CLI: customer gate wiring packet is written',
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');

  equal(
    pkg.scripts['render:action-surface-integration-kit'],
    'tsx scripts/render/render-action-surface-integration-kit.ts',
    'Integration kit render: package script is exposed',
  );
  equal(
    pkg.scripts['test:action-surface-integration-kit-render'],
    'tsx tests/action-surface-integration-kit-render.test.ts',
    'Integration kit render: package test is exposed',
  );
  includes(doc, 'render:action-surface-integration-kit', 'Integration kit doc: renderer command is named');
  excludes(doc, /renderer proves customer PEP no-bypass/iu, 'Integration kit doc: renderer does not overclaim');
}

try {
  testRendererWritesReviewOnlyIntegrationKit();
  testRendererCliAndDocsAndPackageScript();
  console.log(`Action surface integration kit render tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit render tests failed:', error);
  process.exitCode = 1;
}
