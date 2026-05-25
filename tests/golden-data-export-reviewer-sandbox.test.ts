import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenDataExportReviewerSandboxJson,
  renderGoldenDataExportReviewerSandboxMarkdown,
  runGoldenDataExportReviewerSandbox,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
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

const ACCEPTED_INPUT = Object.freeze({
  version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'data_movement.controlled_export',
  queryClass: 'external-share',
  dataClass: 'customer-financial-data',
  recipientClass: 'unapproved-external-recipient',
  requestedFieldsClass: 'approved-minimal',
  rowCountBucket: '100-1k',
  approvalFreshness: 'missing',
  tenantScope: 'tenant-bound',
  purposeBound: true,
  instructionLikeEvidence: false,
  externalSideEffect: true,
  writeSideEffect: false,
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenDataExportReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-data-export-reviewer-sandbox.v1', 'D04 sandbox result: version is explicit');
  equal(result.step, 'D04', 'D04 sandbox result: step is explicit');
  equal(result.inputStatus, 'accepted', 'D04 sandbox result: accepted input runs');
  equal(result.engineRan, true, 'D04 sandbox result: engine runs for in-scope input');
  equal(result.engineScope, 'data_movement.controlled_export', 'D04 sandbox result: scope is data export surface');
  equal(result.expectedPosture, 'needs-recipient-review', 'D04 sandbox result: external recipient maps to recipient review');
  ok(result.inputDigest?.startsWith('sha256:'), 'D04 sandbox result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'D04 sandbox result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'D04 sandbox result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'D04 sandbox result: decision digest is canonical');
  equal(result.decisionSummary?.packetDecision, 'block', 'D04 sandbox result: packet stays fail-closed/no-authority');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'D04 sandbox result: no target system call');
  equal(result.safetyBoundary.noAuditWrite, true, 'D04 sandbox result: no audit write');
  equal(result.safetyBoundary.canAdmit, false, 'D04 sandbox result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'D04 sandbox result: production readiness is false');
  ok(result.issueCodes.includes('data-export:external-recipient-unapproved'), 'D04 sandbox result: recipient reason is explicit');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenDataExportReviewerSandbox({
    version: GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'data_movement.controlled_export',
    queryClass: 'external-share',
    rawCustomerEmail: 'customer@example.com',
  });
  const outside = runGoldenDataExportReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'email_service.send_message',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'D04 sandbox invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'D04 sandbox invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'D04 sandbox invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'D04 sandbox outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'D04 sandbox outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-data-export-scope'), 'D04 sandbox outside: issue code is explicit');
}

function testWriteSideEffectFailsClosed(): void {
  const result = runGoldenDataExportReviewerSandbox({
    ...ACCEPTED_INPUT,
    queryClass: 'write-query',
    requestedFieldsClass: 'write-mutation',
    approvalFreshness: 'missing',
    purposeBound: false,
    writeSideEffect: true,
  });

  equal(result.inputStatus, 'accepted', 'D04 sandbox write: schema-valid input is accepted');
  equal(result.engineRan, true, 'D04 sandbox write: engine still runs');
  equal(result.expectedPosture, 'blocked-write-side-effect', 'D04 sandbox write: expected posture blocks write side effects');
  ok(result.issueCodes.includes('data-export:block-write-query'), 'D04 sandbox write: block write query reason is visible');
  ok(result.decisionSummary?.reasonCodes.includes('data-export:block-write-query'), 'D04 sandbox write: decision summary carries reason');
}

function testRenderersAndCli(): void {
  const result = runGoldenDataExportReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenDataExportReviewerSandboxMarkdown(result);
  const json = renderGoldenDataExportReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-data-export',
      '--',
      '--scenario',
      'fixtures/golden-data-export-reviewer-sandbox.example.json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  const cliJson = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-data-export',
      '--',
      '--scenario=fixtures/golden-data-export-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: Controlled Data Export Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 8',
    'external-recipient-unapproved',
    'target-system calls: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `D04 sandbox markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-data-export-reviewer-sandbox.v1', 'D04 sandbox JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'D04 sandbox JSON: accepted status is explicit');
  equal(cli.status, 0, 'D04 sandbox CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: Controlled Data Export Reviewer Sandbox', 'D04 sandbox CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'D04 sandbox CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'D04 sandbox CLI: scenario JSON is rendered');
  excludes(json, /\bSELECT\s+.+\bFROM\b|\bUPDATE\s+\S+\s+SET\b|\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b/iu, 'D04 sandbox JSON: no raw SQL statement is rendered');
  excludes(json, /\b(email|customerEmail|customerName|accountNumber|ssn|phoneNumber)\b/iu, 'D04 sandbox JSON: no raw customer fields are rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-data-export',
      '--',
      '--scenario',
      'package.json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(outsideScenario.status, 1, 'D04 sandbox CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'D04 sandbox CLI boundary: scenario rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-data-export-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after D04 lands: 4/4 complete. 0 steps remain.',
    '| D04 | complete | Demo CLI and reviewer sandbox |',
    '--scenario fixtures/golden-data-export-reviewer-sandbox.example.json',
    'JSON Schema',
    'OWASP Input Validation',
  ]) {
    includes(doc, expected, `D04 sandbox doc: records ${expected}`);
  }
  includes(ledger, 'Controlled Data Export Golden Path D04', 'D04 sandbox ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_DATA_EXPORT_REVIEWER_SANDBOX_INPUT_VERSION, 'D04 sandbox fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-data-export-reviewer-sandbox'],
    'tsx tests/golden-data-export-reviewer-sandbox.test.ts',
    'D04 sandbox package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testWriteSideEffectFailsClosed();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-data-export-reviewer-sandbox: ${passed} assertions passed`);
