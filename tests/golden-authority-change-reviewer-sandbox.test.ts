import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenAuthorityChangeReviewerSandboxJson,
  renderGoldenAuthorityChangeReviewerSandboxMarkdown,
  runGoldenAuthorityChangeReviewerSandbox,
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
  version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'authority_change.identity_workflow',
  targetSystem: 'microsoft-entra-lifecycle-workflows',
  authorityClass: 'privileged-role',
  subjectClass: 'workforce-user',
  resourceClass: 'admin-role',
  permissionClass: 'admin',
  approvalFreshness: 'fresh',
  tenantScope: 'tenant-bound',
  separationOfDuties: 'clear',
  leastPrivilege: 'requires-narrowing',
  instructionLikeEvidence: false,
  externalSideEffect: false,
  breakGlass: false,
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenAuthorityChangeReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-authority-change-reviewer-sandbox.v1', 'A04 sandbox result: version is explicit');
  equal(result.step, 'A04', 'A04 sandbox result: step is explicit');
  equal(result.inputStatus, 'accepted', 'A04 sandbox result: accepted input runs');
  equal(result.engineRan, true, 'A04 sandbox result: engine runs for in-scope input');
  equal(result.engineScope, 'authority_change.identity_workflow', 'A04 sandbox result: scope is authority change surface');
  equal(result.expectedPosture, 'needs-privilege-narrowing', 'A04 sandbox result: privileged role maps to narrowing');
  ok(result.inputDigest?.startsWith('sha256:'), 'A04 sandbox result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'A04 sandbox result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'A04 sandbox result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'A04 sandbox result: decision digest is canonical');
  equal(result.decisionSummary?.packetDecision, 'block', 'A04 sandbox result: packet stays fail-closed/no-authority');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'A04 sandbox result: no target system call');
  equal(result.safetyBoundary.noIdentityProviderCall, true, 'A04 sandbox result: no identity provider call');
  equal(result.safetyBoundary.noAccessChange, true, 'A04 sandbox result: no access change');
  equal(result.safetyBoundary.canAdmit, false, 'A04 sandbox result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'A04 sandbox result: production readiness is false');
  ok(result.issueCodes.includes('authority-change:overbroad-privilege'), 'A04 sandbox result: privilege reason is explicit');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenAuthorityChangeReviewerSandbox({
    version: GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'authority_change.identity_workflow',
    targetSystem: 'microsoft-entra-lifecycle-workflows',
    rawSubject: 'raw-identity-sentinel',
  });
  const outside = runGoldenAuthorityChangeReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'data_movement.controlled_export',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'A04 sandbox invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'A04 sandbox invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'A04 sandbox invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'A04 sandbox outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'A04 sandbox outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-authority-change-scope'), 'A04 sandbox outside: issue code is explicit');
}

function testBreakGlassFailsClosed(): void {
  const result = runGoldenAuthorityChangeReviewerSandbox({
    ...ACCEPTED_INPUT,
    authorityClass: 'break-glass',
    subjectClass: 'break-glass-account',
    resourceClass: 'admin-role',
    permissionClass: 'admin',
    approvalFreshness: 'missing',
    breakGlass: true,
  });

  equal(result.inputStatus, 'accepted', 'A04 sandbox break-glass: schema-valid input is accepted');
  equal(result.engineRan, true, 'A04 sandbox break-glass: engine still runs');
  equal(result.expectedPosture, 'blocked-break-glass-approval-missing', 'A04 sandbox break-glass: expected posture blocks missing approval');
  ok(result.issueCodes.includes('authority-change:block-break-glass-without-approval'), 'A04 sandbox break-glass: block reason is visible');
  ok(result.decisionSummary?.reasonCodes.includes('authority-change:block-break-glass-without-approval'), 'A04 sandbox break-glass: decision summary carries reason');
}

function testRenderersAndCli(): void {
  const result = runGoldenAuthorityChangeReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenAuthorityChangeReviewerSandboxMarkdown(result);
  const json = renderGoldenAuthorityChangeReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-authority-change',
      '--',
      '--scenario',
      'fixtures/golden-authority-change-reviewer-sandbox.example.json',
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
      'demo:golden-authority-change',
      '--',
      '--scenario=fixtures/golden-authority-change-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: Authority Change Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 8',
    'overbroad-privilege',
    'identity-provider calls: 0',
    'access changes: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `A04 sandbox markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-authority-change-reviewer-sandbox.v1', 'A04 sandbox JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'A04 sandbox JSON: accepted status is explicit');
  equal(cli.status, 0, 'A04 sandbox CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: Authority Change Reviewer Sandbox', 'A04 sandbox CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'A04 sandbox CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'A04 sandbox CLI: scenario JSON is rendered');
  excludes(json, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A04 sandbox JSON: no raw email address is rendered');
  excludes(json, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A04 sandbox JSON: no raw identity fields are rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-authority-change',
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

  equal(outsideScenario.status, 1, 'A04 sandbox CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'A04 sandbox CLI boundary: scenario rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-authority-change-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after A04 lands: 4/4 complete. 0 steps remain.',
    '| A04 | complete once merged | Demo CLI and reviewer sandbox |',
    '--scenario fixtures/golden-authority-change-reviewer-sandbox.example.json',
    'strict JSON allowlist',
    'OWASP Input',
    'Validation discipline',
  ]) {
    includes(doc, expected, `A04 sandbox doc: records ${expected}`);
  }
  includes(ledger, 'Authority Change Golden Path A04', 'A04 sandbox ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_AUTHORITY_CHANGE_REVIEWER_SANDBOX_INPUT_VERSION, 'A04 sandbox fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-authority-change-reviewer-sandbox'],
    'tsx tests/golden-authority-change-reviewer-sandbox.test.ts',
    'A04 sandbox package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testBreakGlassFailsClosed();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-authority-change-reviewer-sandbox: ${passed} assertions passed`);
