import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPENDABOT_PR_AUTHOR,
  validateBaselineAlignment,
  validateBaselineTemplate,
} from '../scripts/check-baseline-alignment.mjs';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function completeTemplate(template: string): string {
  return template
    .replace('Mode:', 'Mode: implement')
    .replace('Tracker:', 'Tracker: Current posture baseline')
    .replace('Step:', 'Step: baseline alignment')
    .replace('Progress:', 'Progress: 1/1 complete, 0 remaining')
    .replace('Evidence state:', 'Evidence state: repo-proven')
    .replace('Next:', 'Next: wait for checks')
    .replace(
      'Newest user/request in operational terms:',
      'Newest user/request in operational terms: bind PR work to the current posture baseline',
    )
    .replace('Affected trust surface:', 'Affected trust surface: PR governance')
    .replace('Protected principle:', 'Protected principle: no overclaim')
    .replace('Repository evidence checked:', 'Repository evidence checked: baseline doc and PR template')
    .replace('Official / primary sources checked:', 'Official / primary sources checked: NIST SSDF, NIST CSF, OWASP SAMM')
    .replace('- [ ] P0/P1 blocker closure', '- [x] P0/P1 blocker closure')
    .replace('Baseline blocker addressed:', 'Baseline blocker addressed: current posture baseline enforcement')
    .replace('Baseline phase:', 'Baseline phase: Baseline update only')
    .replace(
      'Baseline checked against current origin/master:',
      'Baseline checked against current origin/master: 7b33af4f2c10cfc18e24cf6ccd0d766ae7c4370c',
    )
    .replace(
      'If this PR does not map to the current baseline, explain why:',
      'If this PR does not map to the current baseline, explain why: n/a',
    )
    .replace('Finding index updated:', 'Finding index updated: yes, docs/audit/finding-index.md')
    .replace('Report index updated:', 'Report index updated: yes, docs/audit/report-index.md')
    .replace('Live proof register updated:', 'Live proof register updated: yes, docs/audit/live-proof-register.md')
    .replace(
      'Control map / research index updated:',
      'Control map / research index updated: yes, docs/audit/control-map.md and docs/research/README.md',
    )
    .replace('Evidence system exception:', 'Evidence system exception: n/a')
    .replace('Files changed:', 'Files changed: docs/audit/current-posture-baseline.md')
    .replace('What this PR does NOT prove:', 'What this PR does NOT prove: production or enterprise readiness')
    .replace('- [ ] contract-only', '- [x] contract-only')
    .replace('- [ ] OK to merge', '- [x] OK to merge');
}

function testTemplateContainsBaselineContract(): void {
  const template = readProjectFile('.github', 'pull_request_template.md');
  const result = validateBaselineTemplate(template);

  equal(result.ok, true, 'baseline alignment template check passes');
}

function testBlankTemplateIsNotACompletedPrBody(): void {
  const template = readProjectFile('.github', 'pull_request_template.md');
  const result = validateBaselineAlignment(template);

  equal(result.ok, false, 'baseline alignment rejects blank PR template as completed body');
  ok(result.emptyFields.includes('Baseline blocker addressed:'), 'baseline check reports empty blocker field');
  ok(result.emptyFields.includes('Finding index updated:'), 'baseline check reports empty finding-index field');
  ok(result.noCheckedPhase, 'baseline check requires a selected phase');
}

function testCompletedTemplatePasses(): void {
  const body = completeTemplate(readProjectFile('.github', 'pull_request_template.md'));
  const result = validateBaselineAlignment(body);

  equal(result.ok, true, 'baseline alignment accepts completed PR body');
}

function testBaselinePhaseIsRequired(): void {
  const body = completeTemplate(readProjectFile('.github', 'pull_request_template.md'))
    .replace('- [x] P0/P1 blocker closure', '- [ ] P0/P1 blocker closure');
  const result = validateBaselineAlignment(body);

  equal(result.ok, false, 'baseline alignment rejects body without checked phase');
  equal(result.noCheckedPhase, true, 'baseline alignment reports missing checked phase');
}

function testReadinessClaimRequiresNoClaimEvidence(): void {
  const body = completeTemplate(readProjectFile('.github', 'pull_request_template.md'))
    .replace('What this PR does NOT prove: production or enterprise readiness', 'What this PR does NOT prove:')
    .concat('\nThis PR makes Attestor production-ready.\n');
  const result = validateBaselineAlignment(body);

  equal(result.ok, false, 'baseline alignment rejects production-ready claim without no-claim evidence');
  equal(result.missingNoOverclaimEvidence, true, 'baseline alignment reports missing no-overclaim evidence');
}

function testBaselineSmugglingInsideFenceIsRejected(): void {
  const completed = completeTemplate(readProjectFile('.github', 'pull_request_template.md'));
  const body = [
    'This PR intentionally omits the real baseline alignment section.',
    '',
    '```markdown',
    completed,
    '```',
  ].join('\n');
  const result = validateBaselineAlignment(body);

  equal(result.ok, false, 'baseline alignment rejects sections inside fenced code');
  ok(
    result.missingTemplateItems.includes('### Baseline alignment'),
    'baseline alignment requires section heading outside fenced code',
  );
}

function testDependabotBypass(): void {
  const result = validateBaselineAlignment('Bumps hono from 4.12.18 to 4.12.19.', {
    prAuthor: DEPENDABOT_PR_AUTHOR,
  });

  equal(result.ok, true, 'baseline alignment accepts Dependabot-authored dependency PRs');
  equal(result.dependencyAutomationBypass, true, 'baseline alignment records Dependabot bypass');
}

testTemplateContainsBaselineContract();
testBlankTemplateIsNotACompletedPrBody();
testCompletedTemplatePasses();
testBaselinePhaseIsRequired();
testReadinessClaimRequiresNoClaimEvidence();
testBaselineSmugglingInsideFenceIsRejected();
testDependabotBypass();

console.log(`Baseline alignment contract tests: ${passed} passed, 0 failed`);
