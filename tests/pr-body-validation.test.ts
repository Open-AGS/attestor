import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePrBody } from '../scripts/validate-pr-body.mjs';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function completeTemplate(template: string): string {
  return template
    .replace('Mode:', 'Mode: PR')
    .replace('Tracker:', 'Tracker: Combined PR body validation')
    .replace('Step:', 'Step: dry-run body')
    .replace('Progress:', 'Progress: 1/1 complete, 0 remaining')
    .replace('Evidence state:', 'Evidence state: repo-proven')
    .replace('Next:', 'Next: open PR')
    .replace(
      'Newest user/request in operational terms:',
      'Newest user/request in operational terms: dry-run both PR body gates before opening a PR',
    )
    .replace('Affected trust surface:', 'Affected trust surface: PR governance')
    .replace('Protected principle:', 'Protected principle: no overclaim; auditability')
    .replace('Repository evidence checked:', 'Repository evidence checked: PR template and gate scripts')
    .replace('Official / primary sources checked:', 'Official / primary sources checked: not needed for local gate wiring')
    .replace('- [ ] Public Demo / Marketing safety', '- [x] Public Demo / Marketing safety')
    .replace('Baseline blocker addressed:', 'Baseline blocker addressed: n/a; local body validation parity')
    .replace('Baseline phase:', 'Baseline phase: Public Demo / Marketing safety')
    .replace(
      'Baseline checked against current origin/master:',
      'Baseline checked against current origin/master: yes',
    )
    .replace(
      'If this PR does not map to the current baseline, explain why:',
      'If this PR does not map to the current baseline, explain why: n/a',
    )
    .replace('Finding index updated:', 'Finding index updated: no')
    .replace('Report index updated:', 'Report index updated: no')
    .replace('Live proof register updated:', 'Live proof register updated: no')
    .replace('Control map / research index updated:', 'Control map / research index updated: no')
    .replace('Evidence system exception:', 'Evidence system exception: no evidence-state change')
    .replace('Files changed:', 'Files changed: scripts/validate-pr-body.mjs; tests/pr-body-validation.test.ts')
    .replace(
      'Files intentionally not touched:',
      'Files intentionally not touched: runtime source; audit indexes',
    )
    .replace('What this PR does NOT prove:', 'What this PR does NOT prove: production readiness')
    .replace('Remaining blockers:', 'Remaining blockers: live proof remains unchanged')
    .replace('Dependency PR:', 'Dependency PR: no')
    .replace('Release notes / changelog / advisory checked:', 'Release notes / changelog / advisory checked: not applicable')
    .replace('Lockfile / manifest diff checked:', 'Lockfile / manifest diff checked: yes, no lockfile change')
    .replace('Runtime / security / build / action surface touched:', 'Runtime / security / build / action surface touched: no')
    .replace('- [ ] contract-only', '- [x] contract-only')
    .replace('- [ ] OK to merge', '- [x] OK to merge');
}

function testCombinedValidatorAcceptsBodyThatPassesBothCiGates(): void {
  const body = completeTemplate(readProjectFile('.github', 'pull_request_template.md'));
  const result = validatePrBody(body);

  equal(result.ok, true, 'combined PR body validator accepts a body that passes both gates');
}

function testCombinedValidatorRejectsBodyMissingBaselinePhase(): void {
  const body = completeTemplate(readProjectFile('.github', 'pull_request_template.md'))
    .replace('- [x] Public Demo / Marketing safety', '- [ ] Public Demo / Marketing safety');
  const result = validatePrBody(body);

  equal(result.ok, false, 'combined PR body validator rejects missing baseline phase');
  equal(result.contract.ok, true, 'combined PR body validator shows PR contract passed');
  equal(result.baseline.ok, false, 'combined PR body validator shows baseline alignment failed');
  equal(result.baseline.noCheckedPhase, true, 'combined PR body validator preserves baseline phase reason');
}

function testPackageScriptExposesCombinedGate(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    packageJson.scripts['check:pr-body'],
    'node scripts/validate-pr-body.mjs',
    'package script exposes combined PR body validation gate',
  );
  ok(
    packageJson.scripts['test:pr-body-validation'].includes('tests/pr-body-validation.test.ts'),
    'package script exposes combined PR body validation tests',
  );
}

testCombinedValidatorAcceptsBodyThatPassesBothCiGates();
testCombinedValidatorRejectsBodyMissingBaselinePhase();
testPackageScriptExposesCombinedGate();

console.log(`PR body validation tests: ${passed} passed, 0 failed`);
