import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION,
  renderGoldenOperationalExecutionReviewerSandboxJson,
  renderGoldenOperationalExecutionReviewerSandboxMarkdown,
  runGoldenOperationalExecutionReviewerSandbox,
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
  version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION,
  actionSurface: 'operational_execution.change_request',
  targetSystem: 'terraform-workspace',
  operationClass: 'infrastructure-change',
  environmentClass: 'production',
  changeRisk: 'high',
  approvalFreshness: 'fresh',
  rollbackPlanStatus: 'verified',
  dryRunStatus: 'drift-detected',
  incidentState: 'none',
  tenantScope: 'tenant-bound',
  operatorAuthority: 'release-manager',
  instructionLikeEvidence: false,
  externalSideEffect: true,
  duplicateOperationAttempt: false,
});

function testAcceptedInputRunsShadowEngine(): void {
  const result = runGoldenOperationalExecutionReviewerSandbox(ACCEPTED_INPUT);

  equal(result.version, 'attestor.golden-operational-execution-reviewer-sandbox.v1', 'O04 sandbox result: version is explicit');
  equal(result.step, 'O04', 'O04 sandbox result: step is explicit');
  equal(result.inputStatus, 'accepted', 'O04 sandbox result: accepted input runs');
  equal(result.engineRan, true, 'O04 sandbox result: engine runs for in-scope input');
  equal(result.engineScope, 'operational_execution.change_request', 'O04 sandbox result: scope is operational execution surface');
  equal(result.expectedPosture, 'needs-drift-review', 'O04 sandbox result: infrastructure drift maps to review posture');
  ok(result.inputDigest?.startsWith('sha256:'), 'O04 sandbox result: input digest is canonical');
  ok(result.eventDigest?.startsWith('sha256:'), 'O04 sandbox result: event digest is canonical shadow event digest');
  ok(result.smokeDigest?.startsWith('sha256:'), 'O04 sandbox result: smoke digest is canonical');
  ok(result.decisionSummary?.decisionRelevantDigest.startsWith('sha256:'), 'O04 sandbox result: decision digest is canonical');
  equal(result.safetyBoundary.noTargetSystemCall, true, 'O04 sandbox result: no target system call');
  equal(result.safetyBoundary.noDeployment, true, 'O04 sandbox result: no deployment');
  equal(result.safetyBoundary.noInfrastructureChange, true, 'O04 sandbox result: no infrastructure change');
  equal(result.safetyBoundary.noSecretManagerWrite, true, 'O04 sandbox result: no secret-manager write');
  equal(result.safetyBoundary.noIncidentAutomationExecution, true, 'O04 sandbox result: no incident automation execution');
  equal(result.safetyBoundary.noRunbookExecution, true, 'O04 sandbox result: no runbook execution');
  equal(result.safetyBoundary.canAdmit, false, 'O04 sandbox result: cannot admit');
  equal(result.safetyBoundary.productionReady, false, 'O04 sandbox result: production readiness is false');
  ok(result.issueCodes.includes('operational-execution:infrastructure-drift-detected'), 'O04 sandbox result: drift reason is explicit');
  ok(result.issueCodes.includes('operational-execution:review-before-apply'), 'O04 sandbox result: apply review reason is explicit');
}

function testInvalidAndOutsideScopeInputsAreBounded(): void {
  const invalid = runGoldenOperationalExecutionReviewerSandbox({
    version: GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION,
    actionSurface: 'operational_execution.change_request',
    targetSystem: 'kubernetes-deployment',
    rawDeploymentManifest: 'raw-manifest-sentinel',
    kubeconfig: 'raw-kubeconfig-sentinel',
  });
  const outside = runGoldenOperationalExecutionReviewerSandbox({
    ...ACCEPTED_INPUT,
    actionSurface: 'data_movement.controlled_export',
  });

  equal(invalid.inputStatus, 'invalid-schema', 'O04 sandbox invalid: schema invalid is explicit');
  equal(invalid.engineRan, false, 'O04 sandbox invalid: engine does not run');
  ok(invalid.schemaErrors.some((error) => error.includes('unknown field')), 'O04 sandbox invalid: unknown raw-like field is rejected');
  equal(outside.inputStatus, 'outside-scope', 'O04 sandbox outside: outside-scope is explicit');
  equal(outside.engineRan, false, 'O04 sandbox outside: engine does not run');
  ok(outside.issueCodes.includes('reviewer-sandbox:outside-golden-operational-execution-scope'), 'O04 sandbox outside: issue code is explicit');
}

function testSecretRotationAndDuplicateOperationFailClosed(): void {
  const staleSecret = runGoldenOperationalExecutionReviewerSandbox({
    ...ACCEPTED_INPUT,
    targetSystem: 'secret-manager',
    operationClass: 'secret-rotation',
    changeRisk: 'critical',
    approvalFreshness: 'stale',
    rollbackPlanStatus: 'verified',
    dryRunStatus: 'missing',
  });
  const duplicate = runGoldenOperationalExecutionReviewerSandbox({
    ...ACCEPTED_INPUT,
    targetSystem: 'kubernetes-deployment',
    operationClass: 'production-deploy',
    dryRunStatus: 'passed',
    duplicateOperationAttempt: true,
  });

  equal(staleSecret.inputStatus, 'accepted', 'O04 sandbox secret: schema-valid input is accepted');
  equal(staleSecret.expectedPosture, 'blocked-stale-approval', 'O04 sandbox secret: expected posture blocks stale secret approval');
  ok(staleSecret.issueCodes.includes('operational-execution:block-before-secret-rotation'), 'O04 sandbox secret: block reason is visible');
  ok(staleSecret.decisionSummary?.reasonCodes.includes('operational-execution:stale-approval'), 'O04 sandbox secret: decision summary carries stale approval');
  equal(duplicate.expectedPosture, 'blocked-duplicate-operation-replay', 'O04 sandbox duplicate: expected posture blocks duplicate operation');
  ok(duplicate.issueCodes.includes('operational-execution:duplicate-operation-replay'), 'O04 sandbox duplicate: replay reason is visible');
}

function testRunbookInstructionEvidenceNeedsReview(): void {
  const result = runGoldenOperationalExecutionReviewerSandbox({
    ...ACCEPTED_INPUT,
    targetSystem: 'incident-automation',
    operationClass: 'incident-restart',
    environmentClass: 'incident-response',
    changeRisk: 'critical',
    approvalFreshness: 'missing',
    rollbackPlanStatus: 'missing',
    dryRunStatus: 'missing',
    incidentState: 'active',
    operatorAuthority: 'model-rationale-only',
    instructionLikeEvidence: true,
  });

  equal(result.inputStatus, 'accepted', 'O04 sandbox runbook: input is accepted as structured review material');
  equal(result.expectedPosture, 'needs-break-glass-review', 'O04 sandbox runbook: active incident first maps to break-glass review');
  ok(result.issueCodes.includes('operational-execution:ignore-runbook-text-as-instruction'), 'O04 sandbox runbook: runbook text is not authority');
  ok(result.issueCodes.includes('operational-execution:model-rationale-not-authority'), 'O04 sandbox runbook: model rationale is not authority');
}

function testRenderersAndCli(): void {
  const result = runGoldenOperationalExecutionReviewerSandbox(ACCEPTED_INPUT);
  const markdown = renderGoldenOperationalExecutionReviewerSandboxMarkdown(result);
  const json = renderGoldenOperationalExecutionReviewerSandboxJson(result);
  const parsed = JSON.parse(json) as { readonly version: string; readonly inputStatus: string };
  const cli = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-operational-execution',
      '--',
      '--scenario',
      'fixtures/golden-operational-execution-reviewer-sandbox.example.json',
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
      'demo:golden-operational-execution',
      '--',
      '--scenario=fixtures/golden-operational-execution-reviewer-sandbox.example.json',
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );

  for (const expected of [
    '# Golden Path: Operational Execution Reviewer Sandbox',
    'Status: accepted',
    '## Practical Contrast',
    'Without Attestor for this local input:',
    'With Attestor for this local input:',
    'engine ran: true',
    'visible gate stages: 10',
    'infrastructure-drift-detected',
    'deployments: 0',
    'infrastructure changes: 0',
    'secret-manager writes: 0',
    'production ready: false',
  ]) {
    includes(markdown, expected, `O04 sandbox markdown: records ${expected}`);
  }
  equal(parsed.version, 'attestor.golden-operational-execution-reviewer-sandbox.v1', 'O04 sandbox JSON: version is explicit');
  equal(parsed.inputStatus, 'accepted', 'O04 sandbox JSON: accepted status is explicit');
  equal(cli.status, 0, 'O04 sandbox CLI: scenario markdown exits cleanly');
  includes(cli.stdout, '# Golden Path: Operational Execution Reviewer Sandbox', 'O04 sandbox CLI: scenario markdown is rendered');
  equal(cliJson.status, 0, 'O04 sandbox CLI: scenario JSON exits cleanly');
  includes(cliJson.stdout, '"inputStatus": "accepted"', 'O04 sandbox CLI: scenario JSON is rendered');
  excludes(json, /-----BEGIN|api[_-]?key|password|secretValue|kubeconfig|tfstate/iu, 'O04 sandbox JSON: no raw operational secrets are rendered');
  excludes(json, /"rawDeploymentManifest"\s*:|"rawTerraformPlan"\s*:|"rawSecretMaterial"\s*:|"rawRunbookText"\s*:/iu, 'O04 sandbox JSON: no raw operational material fields are rendered');
}

function testDemoCliPathBoundary(): void {
  const outsideScenario = spawnSync(
    'npm',
    [
      'run',
      'demo:golden-operational-execution',
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

  equal(outsideScenario.status, 1, 'O04 sandbox CLI boundary: scenario outside fixtures is rejected');
  includes(outsideScenario.stderr, 'outside approved demo roots', 'O04 sandbox CLI boundary: scenario rejection names approved roots');
}

function testDocsAndScriptsStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'golden-operational-execution-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const fixture = readProjectFile('fixtures', 'golden-operational-execution-reviewer-sandbox.example.json');

  for (const expected of [
    'Progress after O04 lands: 4/4 complete. 0 steps remain.',
    '| O04 | complete once merged | Demo CLI and reviewer sandbox |',
    '--scenario fixtures/golden-operational-execution-reviewer-sandbox.example.json',
    'strict JSON allowlist',
    'NIST SP 800-61 Rev. 3',
    'reviewer sandbox',
  ]) {
    includes(doc, expected, `O04 sandbox doc: records ${expected}`);
  }
  includes(ledger, 'Operational Execution Golden Path O04', 'O04 sandbox ledger: records reviewer sandbox');
  includes(fixture, GOLDEN_OPERATIONAL_EXECUTION_REVIEWER_SANDBOX_INPUT_VERSION, 'O04 sandbox fixture: example input version is present');
  equal(
    packageJson.scripts['test:golden-operational-execution-reviewer-sandbox'],
    'tsx tests/golden-operational-execution-reviewer-sandbox.test.ts',
    'O04 sandbox package script: targeted test is registered',
  );
}

testAcceptedInputRunsShadowEngine();
testInvalidAndOutsideScopeInputsAreBounded();
testSecretRotationAndDuplicateOperationFailClosed();
testRunbookInstructionEvidenceNeedsReview();
testRenderersAndCli();
testDemoCliPathBoundary();
testDocsAndScriptsStayAligned();

console.log(`golden-operational-execution-reviewer-sandbox: ${passed} assertions passed`);
