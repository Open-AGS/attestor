import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
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

function notIncludes(content: string, unexpected: string, message: string): void {
  assert.ok(
    !content.includes(unexpected),
    `${message}\nDid not expect to find: ${unexpected}`,
  );
  passed += 1;
}

function workflow(): string {
  return readProjectFile('.github', 'workflows', 'production-rehearsal.yml').replace(/\r\n/g, '\n');
}

function testWorkflowIsManualOnly(): void {
  const yaml = workflow();

  includes(yaml, 'workflow_dispatch:', 'Production rehearsal workflow: manual dispatch is enabled');
  notIncludes(yaml, 'pull_request:', 'Production rehearsal workflow: must not run on pull_request');
  notIncludes(yaml, '\n  push:', 'Production rehearsal workflow: must not run on push');
  notIncludes(yaml, '\n  schedule:', 'Production rehearsal workflow: must not run on a schedule');
}

function testPlanAndExecuteAreSeparated(): void {
  const yaml = workflow();

  includes(yaml, 'jobs:\n  plan:', 'Production rehearsal workflow: plan job exists without target secrets');
  includes(yaml, '  execute:\n    if: ${{ inputs.mode == \'execute\' }}', 'Production rehearsal workflow: execute job is gated by execute mode');
  includes(yaml, 'needs: plan', 'Production rehearsal workflow: execute job depends on a successful plan');
  includes(yaml, 'environment:\n      name: ${{ inputs.github_environment }}\n      deployment: false', 'Production rehearsal workflow: execute uses the selected protected environment without creating a deployment object');
}

function testPermissionsStayReadOnly(): void {
  const yaml = workflow();

  includes(yaml, 'permissions:\n  contents: read', 'Production rehearsal workflow: top-level token permissions are read-only');
  includes(yaml, 'permissions:\n      contents: read\n      actions: read', 'Production rehearsal workflow: execute only adds actions:read for artifact download');
  notIncludes(yaml, 'contents: write', 'Production rehearsal workflow: must not grant contents write');
  notIncludes(yaml, 'id-token: write', 'Production rehearsal workflow: must not mint OIDC tokens');
  notIncludes(yaml, 'attestations: write', 'Production rehearsal workflow: must not create attestations');
}

function testExecuteModeRefusesUnsafeInputs(): void {
  const yaml = workflow();

  includes(yaml, 'Execute mode requires a filled target manifest, not the example template.', 'Production rehearsal workflow: execute mode rejects the example manifest');
  includes(yaml, 'Execute mode requires release_provenance_run_id', 'Production rehearsal workflow: execute mode requires a release provenance run id');
  includes(yaml, 'gh run download "$RELEASE_PROVENANCE_RUN_ID"', 'Production rehearsal workflow: execute downloads release provenance artifacts by run id');
  includes(yaml, 'gh attestation verify .attestor/rehearsal/release-provenance/evaluation-artifacts.tar.gz', 'Production rehearsal workflow: execute verifies the downloaded release artifact attestation');
}

function testWorkflowRunsTargetBoundChain(): void {
  const yaml = workflow();

  includes(yaml, 'npm run plan:production-rehearsal -- --manifest "$MANIFEST_PATH"', 'Production rehearsal workflow: plan command is manifest-bound');
  includes(yaml, 'npm run verify', 'Production rehearsal workflow: execute starts from the repository verify gate');
  includes(yaml, 'npm run benchmark:ha', 'Production rehearsal workflow: execute captures target HA benchmark evidence');
  includes(yaml, 'npm run benchmark:observability', 'Production rehearsal workflow: execute captures target observability benchmark evidence');
  includes(yaml, 'npm run render:production-readiness-packet', 'Production rehearsal workflow: execute renders the production readiness packet');
  includes(yaml, 'npm run probe:production-rehearsal-substrates', 'Production rehearsal workflow: execute probes production rehearsal substrates');
  includes(yaml, 'npm run rehearse:production-consequence', 'Production rehearsal workflow: execute rehearses consequence behavior');
  includes(yaml, 'npm run rehearse:production-async-recovery', 'Production rehearsal workflow: execute rehearses async recovery');
  includes(yaml, 'npm run rehearse:production-backup-restore-dr', 'Production rehearsal workflow: execute rehearses backup/restore/DR');
  includes(yaml, 'npm run rehearse:production-observability-alerting', 'Production rehearsal workflow: execute rehearses observability and alerting');
  includes(yaml, 'npm run package:production-promotion-candidate -- --manifest "$MANIFEST_PATH"', 'Production rehearsal workflow: execute packages the promotion candidate from the selected manifest');
  includes(yaml, 'npm run render:production-go-no-go-packet', 'Production rehearsal workflow: execute renders the final go/no-go packet');
  includes(yaml, 'ATTESTOR_PRODUCTION_GO_NO_GO_EXTERNAL_SIGNER_PROOF_DIGEST', 'Production rehearsal workflow: execute requires target signer proof env');
  includes(yaml, 'ATTESTOR_PRODUCTION_GO_NO_GO_APPROVAL_SOURCE', 'Production rehearsal workflow: execute requires an explicit approval source env');
  includes(yaml, 'ATTESTOR_PRODUCTION_GO_NO_GO_APPROVAL_EVIDENCE_REF', 'Production rehearsal workflow: execute requires an approval evidence reference env');
  includes(yaml, '--approved-by="$ATTESTOR_PRODUCTION_GO_NO_GO_APPROVED_BY"', 'Production rehearsal workflow: execute passes operator-supplied approval actor metadata');
  includes(yaml, '--approval-source="$ATTESTOR_PRODUCTION_GO_NO_GO_APPROVAL_SOURCE"', 'Production rehearsal workflow: execute passes the independent approval source');
  notIncludes(yaml, '--approved-by="$GITHUB_ACTOR"', 'Production rehearsal workflow: execute must not convert dispatcher identity into approval');
  includes(yaml, 'npm run check:public-artifacts-redaction -- --root .attestor/rehearsal', 'Production rehearsal workflow: execute scans rehearsal artifacts before upload');
  includes(yaml, 'path: .attestor/rehearsal/', 'Production rehearsal workflow: execute uploads rehearsal artifacts');
  ok(
    yaml.indexOf('Scan production rehearsal artifacts for redaction') <
      yaml.indexOf('Upload production rehearsal artifacts'),
    'Production rehearsal workflow: redaction scan runs before artifact upload',
  );
  includes(yaml, "steps.rehearsal_artifact_redaction.outcome == 'success'", 'Production rehearsal workflow: upload is gated on redaction scan success');
}

function testDocsAndPackageScriptReferenceWorkflow(): void {
  const docs = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.md');
  const packageJson = readJson<PackageJson>('package.json');

  includes(docs, '.github/workflows/production-rehearsal.yml', 'Production rehearsal workflow: manifest docs link the workflow');
  includes(docs, 'plan-only', 'Production rehearsal workflow: docs name the plan-only mode');
  includes(docs, 'execute', 'Production rehearsal workflow: docs name the execute mode');
  includes(docs, 'protected GitHub Environment', 'Production rehearsal workflow: docs require a protected GitHub Environment');
  ok(Boolean(packageJson.scripts['test:production-rehearsal-workflow']), 'Production rehearsal workflow: package script exists');
}

testWorkflowIsManualOnly();
testPlanAndExecuteAreSeparated();
testPermissionsStayReadOnly();
testExecuteModeRefusesUnsafeInputs();
testWorkflowRunsTargetBoundChain();
testDocsAndPackageScriptReferenceWorkflow();

console.log(`Production rehearsal workflow tests: ${passed} passed, 0 failed`);
