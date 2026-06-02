import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
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

function testBuildoutDocDefinesHumanAndMachineOutputs(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'action-surface-integration-kit-buildout.md',
  );

  includes(doc, 'Action Surface Integration Kit Buildout', 'Integration kit doc: title exists');
  includes(
    doc,
    'It stays inside the same consequence admission engine',
    'Integration kit doc: one-engine boundary is explicit',
  );
  includes(
    doc,
    '.attestor/action-surface-integration-kit/latest/',
    'Integration kit doc: target output directory is documented',
  );
  includes(doc, 'README.md', 'Integration kit doc: human review entry point is named');
  includes(doc, 'summary.json', 'Integration kit doc: machine summary is named');
  includes(doc, 'artifact-manifest.json', 'Integration kit doc: artifact manifest is named');
  includes(doc, 'no-bypass-probes.json', 'Integration kit doc: no-bypass probe plan is named');
  includes(doc, 'approval-record.template.json', 'Integration kit doc: approval template is named');
  includes(doc, 'Local-First Use', 'Integration kit doc: local-first use section exists');
  includes(
    doc,
    'The first supported path is local-first.',
    'Integration kit doc: local-first path is explicit',
  );
  includes(
    doc,
    'does not require customers to send full API inventories',
    'Integration kit doc: hosted upload boundary is explicit',
  );
  includes(doc, 'rawPayloadStored: false', 'Integration kit doc: raw payload storage boundary is explicit');
  includes(doc, 'productionReady: false', 'Integration kit doc: production readiness no-claim is explicit');
  includes(doc, 'nonBypassableClaimAllowed: false', 'Integration kit doc: non-bypassable claim guard is explicit');
}

function testBuildoutDocLocksResearchAnchorsAndProbeCases(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'action-surface-integration-kit-buildout.md',
  );

  includes(doc, 'OpenAPI Overlay', 'Integration kit doc: OpenAPI Overlay anchor is documented');
  includes(doc, 'MCP tools', 'Integration kit doc: MCP tools anchor is documented');
  includes(doc, 'Gateway API ExternalAuth', 'Integration kit doc: Gateway API anchor is documented');
  includes(doc, 'Terraform plan', 'Integration kit doc: plan/apply anchor is documented');
  includes(doc, 'NIST AI RMF human-AI interaction', 'Integration kit doc: human review anchor is documented');
  includes(
    doc,
    'direct downstream call without Attestor presentation',
    'Integration kit doc: direct bypass probe is required',
  );
  includes(doc, 'stale or replayed presentation', 'Integration kit doc: replay probe is required');
  includes(
    doc,
    '`narrow` decision executed with the original wider request',
    'Integration kit doc: narrow mismatch probe is required',
  );
  includes(
    doc,
    'Attestor/verifier unavailable in enforcement mode',
    'Integration kit doc: outage probe is required',
  );
  includes(doc, 'LP-CUSTOMER-PEP-NO-BYPASS', 'Integration kit doc: live customer proof remains named');
}

function testBuildoutDocStaysReviewOnlyAndLinked(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'action-surface-integration-kit-buildout.md',
  );
  const docsReadme = readProjectFile('docs', 'README.md');
  const onboardingDoc = readProjectFile('docs', '02-architecture', 'action-surface-onboarding-packet.md');
  const artifactsDoc = readProjectFile(
    'docs',
    '02-architecture',
    'action-surface-integration-artifacts.md',
  );
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(
    doc,
    'does not deploy gateways, issue credentials',
    'Integration kit doc: deployment boundary is documented',
  );
  includes(
    doc,
    'focused on the next decision instead of long explanatory checklists',
    'Integration kit doc: renderer output stays human-decision focused',
  );
  includes(
    doc,
    'Use [Action Surface Integration Artifacts](action-surface-integration-artifacts.md)',
    'Integration kit doc: links artifact contract',
  );
  includes(
    docsReadme,
    '[Action surface onboarding packet](02-architecture/action-surface-onboarding-packet.md)',
    'Docs index routes integration kit work through the onboarding packet',
  );
  excludes(
    docsReadme,
    /\[Action surface integration kit buildout\]\(02-architecture\/action-surface-integration-kit-buildout\.md\)/u,
    'Docs index keeps integration kit buildout nested inside the onboarding path',
  );
  includes(
    onboardingDoc,
    '[Action Surface Integration Kit Buildout](action-surface-integration-kit-buildout.md)',
    'Onboarding packet doc links integration kit buildout',
  );
  includes(
    artifactsDoc,
    '[Action Surface Integration Kit Buildout](action-surface-integration-kit-buildout.md)',
    'Integration artifacts doc links integration kit buildout',
  );
  equal(
    pkg.scripts['test:action-surface-integration-kit-buildout'],
    'tsx tests/action-surface-integration-kit-buildout.test.ts',
    'package.json exposes integration kit buildout test',
  );

  excludes(
    doc,
    /integration kit activates enforcement/iu,
    'Integration kit doc: enforcement activation is not overclaimed',
  );
  excludes(
    doc,
    /integration kit proves production readiness/iu,
    'Integration kit doc: production readiness is not overclaimed',
  );
  excludes(
    doc,
    /generated files prove customer PEP no-bypass/iu,
    'Integration kit doc: no-bypass proof is not overclaimed',
  );
}

try {
  testBuildoutDocDefinesHumanAndMachineOutputs();
  testBuildoutDocLocksResearchAnchorsAndProbeCases();
  testBuildoutDocStaysReviewOnlyAndLinked();
  console.log(`Action surface integration kit buildout tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit buildout tests failed:', error);
  process.exitCode = 1;
}
