import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testLifecycleContract(): void {
  const lifecycle = readProjectFile('docs', 'audit', 'finding-lifecycle-and-evidence-ledger.md');

  includes(lifecycle, '# Audit Finding Lifecycle And Remediation Evidence Ledger', 'Finding lifecycle: title is stable');
  includes(lifecycle, 'external audit', 'Finding lifecycle: external audit no-claim is explicit');
  includes(lifecycle, 'not a certification', 'Finding lifecycle: certification no-claim is explicit');
  includes(lifecycle, 'not production readiness', 'Finding lifecycle: production readiness no-claim is explicit');
  includes(lifecycle, 'NIST SP 800-115', 'Finding lifecycle: NIST testing/reporting anchor is present');
  includes(lifecycle, 'NIST CSF 2.0', 'Finding lifecycle: NIST CSF anchor is present');
  includes(lifecycle, 'OWASP ASVS', 'Finding lifecycle: OWASP ASVS anchor is present');
  includes(lifecycle, 'OWASP DSOVS', 'Finding lifecycle: OWASP DSOVS anchor is present');
  includes(lifecycle, 'reported\n  -> validated\n  -> accepted\n  -> fixed\n  -> tested\n  -> re-audited\n  -> closed', 'Finding lifecycle: canonical closure path is explicit');
  includes(lifecycle, 'Side exits are allowed, but they require evidence', 'Finding lifecycle: evidence-backed side exits are explicit');
  includes(lifecycle, '| `closed` | Fix is merged, checks are green, and `origin/master` has been verified.', 'Finding lifecycle: closed requires merge verification');
  includes(lifecycle, 'For trust-boundary findings, a passing happy-path test is not enough.', 'Finding lifecycle: negative/adversarial evidence is required for trust boundaries');
  includes(lifecycle, 'Mapping to at least one accepted risk or verification taxonomy', 'Finding lifecycle: closure rule requires mapping');
  includes(lifecycle, 'Control-mapping rationale: external anchors, why those anchors apply', 'Finding lifecycle: closure rule requires control-mapping rationale');
  includes(lifecycle, 'Negative/adversarial tests:', 'Finding lifecycle: remediation record requires negative/adversarial tests');
  includes(lifecycle, 'Mapping:', 'Finding lifecycle: remediation record requires mapping field');
  includes(lifecycle, 'External anchors:', 'Finding lifecycle: remediation record requires external anchor field');
  includes(lifecycle, 'Why applicable:', 'Finding lifecycle: remediation record requires applicability rationale');
  includes(lifecycle, 'Why not overclaimed:', 'Finding lifecycle: remediation record requires no-overclaim rationale');
  includes(lifecycle, 'Re-audit result:', 'Finding lifecycle: remediation record requires re-audit result');
  includes(lifecycle, 'Residual risk:', 'Finding lifecycle: remediation record requires residual risk');
  includes(lifecycle, 'Mapping: CWE-352; OWASP CSRF guidance; NIST SP 800-115 mitigation reporting', 'Finding lifecycle: example record includes risk mapping');
  includes(lifecycle, 'External anchors: NIST SP 800-115; NIST CSF Govern; OWASP ASVS', 'Finding lifecycle: example record includes external anchors');
  includes(lifecycle, 'Why applicable: the finding concerns a hosted mutation control', 'Finding lifecycle: example record explains applicability');
  includes(lifecycle, 'Why not overclaimed: the mapping supports remediation evidence only', 'Finding lifecycle: example record explains no-overclaim boundary');
  includes(lifecycle, 'EH-2026-SESSION-CSRF-001', 'Finding lifecycle: first evidence record example is present');
  excludes(lifecycle, /\bsecure by default for production\b/iu, 'Finding lifecycle: production security is not overclaimed');
}

function testLedgerTemplateUsesLifecycle(): void {
  const template = readProjectFile('docs', 'audit', 'ledger-template.md');

  includes(template, 'docs/audit/finding-lifecycle-and-evidence-ledger.md', 'Ledger template: links canonical lifecycle');
  includes(template, 'Lifecycle state: reported | validated | disputed | duplicate | out-of-scope | blocked | accepted-limitation | superseded | accepted | fixed | tested | re-audited | closed', 'Ledger template: uses canonical state vocabulary');
  includes(template, 'Negative/adversarial test:', 'Ledger template: captures negative/adversarial evidence');
  includes(template, 'Positive/regression test or probe:', 'Ledger template: captures positive/regression evidence');
  includes(template, 'Mapping:', 'Ledger template: captures CWE/NIST/OWASP/STRIDE/STPA mapping evidence');
  includes(template, 'External anchors:', 'Ledger template: captures external anchor evidence');
  includes(template, 'Why applicable:', 'Ledger template: captures anchor applicability rationale');
  includes(template, 'Why not overclaimed:', 'Ledger template: captures no-overclaim rationale');
  includes(template, 'CI checks:', 'Ledger template: captures CI evidence');
  includes(template, 'Re-audit result:', 'Ledger template: captures re-audit evidence');
  includes(template, '`closed`: merged, checks are green, and `origin/master` has been verified.', 'Ledger template: closed state requires origin/master evidence');
  includes(template, 'A finding is not closed until the fix is merged', 'Ledger template: closure rule is evidence-bound');
}

function testTrackerLinksLifecycle(): void {
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');

  includes(tracker, 'Per-finding closure contract:', 'Audit tracker: links per-finding closure contract');
  includes(tracker, 'docs/audit/finding-lifecycle-and-evidence-ledger.md', 'Audit tracker: lifecycle link is present');
}

function testPackageScript(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  assert.equal(
    packageJson.scripts['test:audit-finding-lifecycle'],
    'tsx tests/audit-finding-lifecycle.test.ts',
    'Package scripts: audit finding lifecycle docs guard is exposed',
  );
  passed += 1;
  assert.equal(
    packageJson.scripts['test:audit-finding-evidence'],
    'node scripts/check/check-audit-finding-evidence.mjs',
    'Package scripts: audit finding evidence checker is exposed',
  );
  passed += 1;
  assert.equal(
    packageJson.scripts['test:audit-finding-test-coverage'],
    'tsx tests/finding-test-coverage.test.ts',
    'Package scripts: audit finding test-coverage checker is exposed',
  );
  passed += 1;
}

function testEvidenceChecker(): void {
  const output = execFileSync('node', ['scripts/check/check-audit-finding-evidence.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  includes(output, 'Audit finding evidence checks: passed', 'Audit evidence checker: passes current repository docs');
}

testLifecycleContract();
testLedgerTemplateUsesLifecycle();
testTrackerLinksLifecycle();
testPackageScript();
testEvidenceChecker();

console.log(`Audit finding lifecycle tests: ${passed} passed, 0 failed`);
