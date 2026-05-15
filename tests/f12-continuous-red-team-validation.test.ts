import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const { resolveFSeriesContinuousValidationScripts } = await import('../scripts/run-f-series-continuous-validation.mjs') as {
  readonly resolveFSeriesContinuousValidationScripts: (root?: string) => readonly {
    readonly label: string;
    readonly command: string;
  }[];
};

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function matches(content: string, expected: RegExp, message: string): void {
  assert.match(content, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const packageJson = JSON.parse(readProjectFile('package.json')) as {
  readonly scripts: Readonly<Record<string, string>>;
};
const workflow = readProjectFile('.github', 'workflows', 'f-series-continuous-validation.yml');
const runner = readProjectFile('scripts', 'run-f-series-continuous-validation.mjs');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const validationDoc = readProjectFile('docs', 'audit', 'f12-continuous-red-team-validation.md');
const researchLedger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
const security = readProjectFile('SECURITY.md');
const securityTxt = readProjectFile('.well-known', 'security.txt');
const securityTesting = readProjectFile('docs', '03-governance', 'security-testing.md');
const resolvedLabels = resolveFSeriesContinuousValidationScripts().map((item) => item.label);
const resolvedText = resolvedLabels.join('\n');

includes(
  packageJson.scripts['audit:f-series-continuous-validation'],
  'scripts/run-f-series-continuous-validation.mjs',
  'F12 validation: package exposes the F-series continuous validation runner',
);
includes(
  packageJson.scripts['test:f12-continuous-red-team-validation'],
  'tests/f12-continuous-red-team-validation.test.ts',
  'F12 validation: package exposes the F12 validation test',
);
includes(
  packageJson.scripts['test:f12-canonicalizer-fuzz-smoke'],
  'tests/f12-canonicalizer-fuzz-smoke.test.ts',
  'F12 validation: package exposes the canonicalizer fuzz smoke test',
);

includes(workflow, 'name: F-Series Continuous Validation', 'F12 workflow: title is stable');
includes(workflow, 'permissions:\n  contents: read', 'F12 workflow: repository contents permission stays read-only');
includes(workflow, 'cron: "0 3 * * *"', 'F12 workflow: nightly cron is configured');
includes(workflow, 'pull_request:', 'F12 workflow: PR-time replay is configured');
includes(workflow, 'push:', 'F12 workflow: master push replay is configured');
includes(workflow, 'npm run audit:f-series-continuous-validation', 'F12 workflow: runs the F-series continuous validation runner');
matches(workflow, /uses: actions\/checkout@[0-9a-f]{40}/u, 'F12 workflow: checkout action is pinned by SHA');
matches(workflow, /uses: actions\/setup-node@[0-9a-f]{40}/u, 'F12 workflow: setup-node action is pinned by SHA');
excludes(workflow, /attestations:\s*write|id-token:\s*write|contents:\s*write/iu, 'F12 workflow: no elevated token permissions');

includes(runner, 'SUPPORTING_SECURITY_AND_REPLAY_SCRIPTS', 'F12 runner: supporting replay script set is explicit');
includes(runner, 'test:action-surface-onboarding-red-team-fixtures', 'F12 runner: action-surface red-team fixtures are included');
includes(runner, 'test:policy-foundry-red-team-replay', 'F12 runner: policy-foundry red-team replay is included');
includes(runner, 'test:policy-foundry-adversarial-replay-executor', 'F12 runner: adversarial replay executor is included');
includes(runner, 'test:policy-foundry-live-downstream-replay', 'F12 runner: downstream replay fixture is included');
includes(runner, 'test:failure-mode-guard-coverage', 'F12 runner: guard coverage invariant is included');
includes(runner, 'test:agentic-supply-chain-guard', 'F12 runner: supply-chain guard invariant is included');
includes(runner, 'test:decision-context-drift-binding', 'F12 runner: model/tool/config drift invariant is included');
includes(runner, 'test:audit-remediation-tracker', 'F12 runner: tracker self-test is included');
includes(runner, 'test:research-provenance-ledger', 'F12 runner: research provenance self-test is included');
excludes(resolvedText, /^test:live/mu, 'F12 runner: external live tests are not part of the secretless nightly replay');
excludes(resolvedText, /^test:observability/mu, 'F12 runner: observability live/ops probes are not part of the secretless nightly replay');
for (const expected of [
  'test:f1-backlog-closure-validation',
  'test:f2-customer-gate-validation',
  'test:f4-trust-class-pki-proof-validation',
  'test:f5-ca-pin-required-validation',
  'test:f6-tenant-blast-radius-validation',
  'test:f7-shadow-infrastructure-validation',
  'test:f8-operational-resilience-validation',
  'test:f9-compliance-gap-validation',
  'test:f10-escape-hatch-validation',
  'test:f11-supply-chain-depth-validation',
  'test:f12-canonicalizer-fuzz-smoke',
  'test:f12-continuous-red-team-validation',
]) {
  ok(resolvedLabels.includes(expected), `F12 runner: ${expected} is resolved`);
}

includes(validationDoc, 'Status: repository-side F12 validation complete.', 'F12 doc: status is explicit');
includes(validationDoc, 'F12-RT-1 external AI safety benchmarks cited but not integrated | `backlog`', 'F12 doc: AgentDojo integration remains backlogged');
includes(validationDoc, 'F12-RT-2 no nightly drift / regression cron | `fixed`', 'F12 doc: nightly cron finding is fixed');
includes(validationDoc, 'F12-RT-3 no fuzz harness for canonicalizer / verifier | `partial`', 'F12 doc: fuzz harness boundary is partial');
includes(validationDoc, 'F12-RT-5 bug bounty / public VDP missing | `partial`', 'F12 doc: VDP vs paid bounty boundary is partial');
includes(validationDoc, 'F12-RT-11 external pentest cadence undocumented | `invalid-as-stated`', 'F12 doc: security-testing doc stale finding is invalid as stated');
includes(validationDoc, 'F12-RT-12 coordinated disclosure timeline / SLA not declared | `fixed`', 'F12 doc: disclosure timeline is fixed');

includes(tracker, 'F12 continuous red-team automation | 12 | 3 | 9 | 0', 'Tracker: F12 count row is tracked');
includes(tracker, 'Remaining F12 queue after continuous red-team validation: 0 planned', 'Tracker: F12 remaining estimate is explicit');
includes(tracker, 'F12 Continuous Red-Team Automation', 'Tracker: F12 section is present');
includes(tracker, 'F12-RT-2 no nightly drift / regression cron | `fixed`', 'Tracker: F12 nightly cron is fixed');
includes(tracker, 'F12-RT-12 coordinated disclosure timeline / SLA not declared | `fixed`', 'Tracker: F12 disclosure SLA is fixed');
excludes(tracker, /F12 continuous red-team automation\. Not started\./u, 'Tracker: stale F12 not-started marker is removed');

includes(researchLedger, '### 23. F12 Continuous Red-Team Automation Closure', 'Research ledger: F12 closure entry is present');
includes(researchLedger, 'docs/audit/f12-continuous-red-team-validation.md', 'Research ledger: F12 validation doc is indexed');
includes(researchLedger, 'tests/f12-continuous-red-team-validation.test.ts', 'Research ledger: F12 validation test is indexed');
includes(researchLedger, 'does not prove AgentDojo benchmark execution', 'Research ledger: external benchmark non-claim is explicit');

includes(security, 'The repository also publishes `/.well-known/security.txt`', 'SECURITY.md: public security.txt entry is documented');
includes(security, 'acknowledge: 48 hours', 'SECURITY.md: acknowledgement target is documented');
includes(security, 'initial triage: 7 days', 'SECURITY.md: triage target is documented');
includes(security, 'high or critical repository-side fix target: 90 days', 'SECURITY.md: high/critical fix target is documented');
includes(security, 'medium or low repository-side fix target: 180 days', 'SECURITY.md: medium/low fix target is documented');
includes(security, 'not a cash-reward promise', 'SECURITY.md: no paid bounty overclaim is explicit');
includes(securityTxt, 'Contact: https://github.com/AI-gateway-systems/attestor/security/advisories/new', 'security.txt: private reporting contact is present');
includes(securityTxt, 'Policy: https://github.com/AI-gateway-systems/attestor/blob/master/SECURITY.md', 'security.txt: policy link is present');
includes(securityTxt, 'Preferred-Languages: en, hu', 'security.txt: language preference is present');
matches(securityTxt, /^Expires: 2027-05-15T00:00:00Z$/mu, 'security.txt: expiry is explicit');
ok(existsSync(join(process.cwd(), '.well-known', 'security.txt')), 'security.txt: file exists at .well-known/security.txt');
includes(securityTesting, 'F1-F12 validation tests, continuous red-team runner, and remediation tracker', 'Security testing doc: F12 validation posture is current');
includes(securityTesting, 'annual or release-gated penetration test', 'Security testing doc: external pentest cadence recommendation is present');
includes(securityTesting, 'nightly F-series regression and red-team replay', 'Security testing doc: continuous red-team cadence is present');

console.log(`f12-continuous-red-team-validation.test.ts: ${passed} assertions passed`);
