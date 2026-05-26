import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenExternalCommunicationReviewerSandboxJson,
  renderGoldenExternalCommunicationReviewerSandboxMarkdown,
  runGoldenExternalCommunicationReviewerSandbox,
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
  version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'external_communication.customer_message',
  channelClass: 'email',
  messageClass: 'commercial-email',
  recipientClass: 'suppression-list-contact',
  claimClass: 'commercial-offer',
  approvalFreshness: 'missing',
  tenantScope: 'tenant-bound',
  commercialEmailPosture: 'missing-unsubscribe-or-sender-controls',
  evidenceAuthority: 'model-rationale-only',
  instructionLikeEvidence: false,
  publicClaim: false,
  externalSideEffect: true,
  duplicateSendAttempt: false,
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenExternalCommunicationReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-external-communication-reviewer-sandbox.v1', 'E04 sandbox result: version is explicit');
  equal(result.step, 'E04', 'E04 sandbox result: step is explicit');
  equal(result.inputStatus, 'accepted', 'E04 sandbox result: accepted input runs');
  equal(result.engineRan, true, 'E04 sandbox result: engine runs for in-scope input');
  equal(result.engineScope, 'external_communication.customer_message', 'E04 sandbox result: scope is external communication surface');
  equal(result.expectedPosture, 'needs-commercial-email-controls', 'E04 sandbox result: commercial-email maps to review posture');
  ok(result.inputDigest?.startsWith('sha256:'), 'E04 sandbox result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'E04 sandbox result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'E04 sandbox result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'E04 sandbox result: decision digest is canonical');
  equal(result.decisionSummary?.packetDecision, 'block', 'E04 sandbox result: packet stays fail-closed/no-authority');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'E04 sandbox result: no target system call');
  equal(result.safetyBoundary.noMessageDelivery, true, 'E04 sandbox result: no message delivery');
  equal(result.safetyBoundary.noProviderCall, true, 'E04 sandbox result: no provider call');
  equal(result.safetyBoundary.canAdmit, false, 'E04 sandbox result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'E04 sandbox result: production readiness is false');
  ok(result.issueCodes.includes('external-communication:commercial-email-control-gap'), 'E04 sandbox result: commercial-email reason is explicit');
  ok(result.issueCodes.includes('external-communication:model-rationale-not-authority'), 'E04 sandbox result: model rationale is not authority');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenExternalCommunicationReviewerSandbox({
    version: GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'external_communication.customer_message',
    channelClass: 'email',
    rawRecipient: 'raw-recipient-sentinel',
  });
  const outside = runGoldenExternalCommunicationReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'authority_change.identity_workflow',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'E04 sandbox invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'E04 sandbox invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'E04 sandbox invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'E04 sandbox outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'E04 sandbox outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-external-communication-scope'), 'E04 sandbox outside: issue code is explicit');
}

function testLegalClaimAndDuplicateSendFailClosed(): void {
  const legal = runGoldenExternalCommunicationReviewerSandbox({
    ...ACCEPTED_INPUT,
    messageClass: 'legal-notice',
    recipientClass: 'customer-account-owner',
    claimClass: 'legal-liability-statement',
    commercialEmailPosture: 'not-applicable',
    evidenceAuthority: 'model-rationale-only',
  });
  const duplicate = runGoldenExternalCommunicationReviewerSandbox({
    ...ACCEPTED_INPUT,
    messageClass: 'billing-notice',
    recipientClass: 'approved-billing-contact',
    claimClass: 'operational-status',
    approvalFreshness: 'fresh',
    commercialEmailPosture: 'not-applicable',
    evidenceAuthority: 'verified-system-record',
    duplicateSendAttempt: true,
  });

  equal(legal.inputStatus, 'accepted', 'E04 sandbox legal: schema-valid input is accepted');
  equal(legal.expectedPosture, 'blocked-legal-claim-without-authority', 'E04 sandbox legal: expected posture blocks legal claim');
  ok(legal.issueCodes.includes('external-communication:legal-claim-without-authority'), 'E04 sandbox legal: block reason is visible');
  ok(legal.decisionSummary?.reasonCodes.includes('external-communication:block-before-send'), 'E04 sandbox legal: decision summary carries fail-closed reason');
  equal(duplicate.expectedPosture, 'blocked-duplicate-send-replay', 'E04 sandbox duplicate: expected posture blocks duplicate send');
  ok(duplicate.issueCodes.includes('external-communication:duplicate-send-replay'), 'E04 sandbox duplicate: replay reason is visible');
}

function testRenderersAndCli(): void {
  const result = runGoldenExternalCommunicationReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenExternalCommunicationReviewerSandboxMarkdown(result);
  const json = renderGoldenExternalCommunicationReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-external-communication',
      '--',
      '--scenario',
      'fixtures/golden-external-communication-reviewer-sandbox.example.json',
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
      'demo:golden-external-communication',
      '--',
      '--scenario=fixtures/golden-external-communication-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: External Communication Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 8',
    'commercial-email-control-gap',
    'message deliveries: 0',
    'provider calls: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `E04 sandbox markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-external-communication-reviewer-sandbox.v1', 'E04 sandbox JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'E04 sandbox JSON: accepted status is explicit');
  equal(cli.status, 0, 'E04 sandbox CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: External Communication Reviewer Sandbox', 'E04 sandbox CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'E04 sandbox CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'E04 sandbox CLI: scenario JSON is rendered');
  excludes(json, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E04 sandbox JSON: no raw email address is rendered');
  excludes(json, /"rawRecipient"\s*:|"rawCustomer"\s*:|"emailAddress"\s*:|"phoneNumber"\s*:|"customerName"\s*:|"messageBody"\s*:/iu, 'E04 sandbox JSON: no raw message/recipient fields are rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-external-communication',
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

  equal(outsideScenario.status, 1, 'E04 sandbox CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'E04 sandbox CLI boundary: scenario rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-external-communication-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-external-communication-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after E04 lands: 4/4 complete. 0 steps remain.',
    '| E04 | complete once merged | Demo CLI and reviewer sandbox |',
    '--scenario fixtures/golden-external-communication-reviewer-sandbox.example.json',
    'strict JSON allowlist',
    'OWASP Input',
    'Validation discipline',
  ]) {
    includes(doc, expected, `E04 sandbox doc: records ${expected}`);
  }
  includes(ledger, 'External Communication Golden Path E04', 'E04 sandbox ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_EXTERNAL_COMMUNICATION_REVIEWER_SANDBOX_INPUT_VERSION, 'E04 sandbox fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-external-communication-reviewer-sandbox'],
    'tsx tests/golden-external-communication-reviewer-sandbox.test.ts',
    'E04 sandbox package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testLegalClaimAndDuplicateSendFailClosed();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-external-communication-reviewer-sandbox: ${passed} assertions passed`);
