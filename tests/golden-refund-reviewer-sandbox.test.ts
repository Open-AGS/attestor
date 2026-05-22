import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenRefundReviewerSandboxJson,
  renderGoldenRefundReviewerSandboxMarkdown,
  runGoldenRefundReviewerSandbox,
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
  version: GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'refund_service.issue_refund',
  requestedAmountBucket: '100-250-usd',
  refundReason: 'fraudulent',
  refundMethod: 'manual_review_only',
  priorRefundCountClass: 'one',
  evidenceFreshness: 'fresh',
  approvalRequired: true,
  externalFraudSignal: 'high',
  instructionLikeEvidence: false,
  policyLimitPosture: 'within-policy',
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenRefundReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-refund-reviewer-sandbox.v1', 'G09 result: version is explicit');
  equal(result.step, 'G09', 'G09 result: step is explicit');
  equal(result.inputStatus, 'accepted', 'G09 result: accepted input runs');
  equal(result.engineRan, true, 'G09 result: engine runs for in-scope input');
  equal(result.engineScope, 'refund_service.issue_refund', 'G09 result: scope is refund surface');
  equal(result.expectedPosture, 'needs-external-risk-review', 'G09 result: high external signal maps to external-risk review');
  ok(result.inputDigest?.startsWith('sha256:'), 'G09 result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'G09 result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'G09 result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'G09 result: decision digest is canonical');
  equal(result.decisionSummary?.packetDecision, 'block', 'G09 result: packet stays fail-closed/no-authority');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'G09 result: no target system call');
  equal(result.safetyBoundary.noAuditWrite, true, 'G09 result: no audit write');
  equal(result.safetyBoundary.canAdmit, false, 'G09 result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'G09 result: production readiness is false');
  ok(result.issueCodes.includes('refund:external-fraud-signal-high'), 'G09 result: external risk reason is explicit');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenRefundReviewerSandbox({
    version: GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'refund_service.issue_refund',
    requestedAmountBucket: '100-250-usd',
    refundReason: 'fraudulent',
    rawCustomerEmail: 'customer@example.com',
  });
  const outside = runGoldenRefundReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'email_service.send_message',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'G09 invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'G09 invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'G09 invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'G09 outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'G09 outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-refund-scope'), 'G09 outside: issue code is explicit');
}

function testInconsistentInputRunsWithReasonCode(): void {
  const result = runGoldenRefundReviewerSandbox({
    ...ACCEPTED_INPUT,
    approvalRequired: false,
    refundMethod: 'manual_review_only',
    externalFraudSignal: 'high',
  });

  equal(result.inputStatus, 'accepted', 'G09 inconsistent: schema-valid input is accepted');
  equal(result.engineRan, true, 'G09 inconsistent: engine still runs');
  ok(result.issueCodes.includes('refund:inconsistent-input-detected'), 'G09 inconsistent: reason code is visible');
  ok(result.decisionSummary?.reasonCodes.includes('refund:inconsistent-input-detected'), 'G09 inconsistent: decision summary carries reason');
}

function testRenderersAndCli(): void {
  const result = runGoldenRefundReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenRefundReviewerSandboxMarkdown(result);
  const json = renderGoldenRefundReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-refund',
      '--',
      '--scenario',
      'fixtures/golden-refund-reviewer-sandbox.example.json',
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
      'demo:golden-refund',
      '--',
      '--scenario=fixtures/golden-refund-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: Refund Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 7',
    'external-fraud-signal-high',
    'target-system calls: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `G09 markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-refund-reviewer-sandbox.v1', 'G09 JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'G09 JSON: accepted status is explicit');
  equal(cli.status, 0, 'G09 CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: Refund Reviewer Sandbox', 'G09 CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'G09 CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'G09 CLI: scenario JSON is rendered');
  excludes(json, /\bcus_[a-zA-Z0-9_]+/u, 'G09 JSON: no raw customer id is rendered');
  excludes(json, /customerEmail|customerName|paymentIntentId|stripeChargeId|shopifyOrderId/iu, 'G09 JSON: no raw commerce fields are rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-refund',
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
  const showcaseOutside = spawnSync(
    'npx',
    [
      'tsx',
      'scripts/render-proof-showcase.ts',
      '--skip-run',
      '--from',
      'package.json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  equal(outsideScenario.status, 1, 'G09 CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'G09 CLI boundary: scenario rejection names approved roots');
  equal(showcaseOutside.status, 1, 'Proof showcase boundary: source outside approved roots is rejected');
  includes(showcaseOutside.stderr, 'outside approved demo roots', 'Proof showcase boundary: source rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-refund-shadow-pilot.md');
  const readme = readProjectFile('README.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-refund-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after G09 lands: 9/9 complete. 0 steps remain.',
    '| G09 | complete | Reviewer Sandbox |',
    '--scenario fixtures/golden-refund-reviewer-sandbox.example.json',
    'JSON Schema',
    'OWASP Input Validation',
  ]) {
    includes(doc, expected, `G09 doc: records ${expected}`);
  }
  includes(readme, '--scenario fixtures/golden-refund-reviewer-sandbox.example.json', 'G09 README: documents scenario flag');
  includes(tryFirst, '--scenario fixtures/golden-refund-reviewer-sandbox.example.json', 'G09 try-first: documents scenario flag');
  includes(ledger, 'G09 reviewer sandbox', 'G09 ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_REFUND_REVIEWER_SANDBOX_INPUT_VERSION, 'G09 fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-refund-reviewer-sandbox'],
    'tsx tests/golden-refund-reviewer-sandbox.test.ts',
    'G09 package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testInconsistentInputRunsWithReasonCode();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-refund-reviewer-sandbox: ${passed} assertions passed`);
