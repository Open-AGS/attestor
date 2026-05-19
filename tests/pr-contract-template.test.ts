import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALLOWED_EVIDENCE_STATES,
  DEPENDABOT_PR_AUTHOR,
  REQUIRED_NON_EMPTY_FIELDS,
  REQUIRED_SECTIONS,
  validatePrContract,
} from '../scripts/validate-pr-contract.mjs';

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
    .replace('Tracker:', 'Tracker: PR Contract Gate v1')
    .replace('Step:', 'Step: template validation')
    .replace('Progress:', 'Progress: 1/1 complete, 0 remaining')
    .replace('Evidence state:', 'Evidence state: repo-proven')
    .replace('Next:', 'Next: wait for checks')
    .replace(
      'Newest user/request in operational terms:',
      'Newest user/request in operational terms: validate the PR contract gate',
    )
    .replace('Affected trust surface:', 'Affected trust surface: PR governance')
    .replace('Protected principle:', 'Protected principle: no overclaim')
    .replace('Repository evidence checked:', 'Repository evidence checked: template and validator tests')
    .replace('Official / primary sources checked:', 'Official / primary sources checked: not needed for template-only test')
    .replace('Files changed:', 'Files changed: .github/pull_request_template.md')
    .replace('What this PR does NOT prove:', 'What this PR does NOT prove: branch protection is configured')
    .replace('- [ ] contract-only', '- [x] contract-only')
    .replace('- [ ] OK to merge', '- [x] OK to merge');
}

function testTemplateContainsRequiredContract(): void {
  const template = readProjectFile('.github', 'pull_request_template.md');

  for (const section of REQUIRED_SECTIONS) {
    ok(template.includes(section), `PR contract template includes ${section}`);
  }
  for (const field of REQUIRED_NON_EMPTY_FIELDS) {
    ok(template.includes(field), `PR contract template includes ${field}`);
  }
  for (const evidenceState of ALLOWED_EVIDENCE_STATES) {
    ok(
      template.includes(evidenceState) || evidenceState === 'opinion / design hypothesis',
      `PR contract template includes or intentionally omits legacy evidence state ${evidenceState}`,
    );
  }
}

function testValidatorRejectsBlankTemplate(): void {
  const template = readProjectFile('.github', 'pull_request_template.md');
  const result = validatePrContract(template);

  equal(result.ok, false, 'PR contract validator rejects the blank template');
  ok(result.emptyFields.includes('Mode:'), 'PR contract validator reports empty status mode');
  ok(result.noMergeClassification, 'PR contract validator requires merge classification');
  equal(result.invalidFinalDecisionCount, 0, 'PR contract validator requires human admission decision');
}

function testValidatorAcceptsCompletedTemplate(): void {
  const template = completeTemplate(readProjectFile('.github', 'pull_request_template.md'));
  const result = validatePrContract(template);

  equal(result.ok, true, 'PR contract validator accepts completed template');
}

function testValidatorRejectsInvalidEvidenceState(): void {
  const template = completeTemplate(readProjectFile('.github', 'pull_request_template.md'))
    .replace('Evidence state: repo-proven', 'Evidence state: vibes');
  const result = validatePrContract(template);

  equal(result.ok, false, 'PR contract validator rejects invalid evidence state');
  equal(result.invalidEvidenceState, 'vibes', 'PR contract validator reports invalid evidence state');
}

function testValidatorAcceptsDependabotAutomationBody(): void {
  const body = [
    'Bumps hono from 4.12.18 to 4.12.19.',
    '',
    '<details><summary>Release notes</summary></details>',
  ].join('\n');
  const result = validatePrContract(body, { prAuthor: DEPENDABOT_PR_AUTHOR });

  equal(result.ok, true, 'PR contract validator accepts Dependabot-authored dependency PRs');
  equal(result.dependencyAutomationBypass, true, 'PR contract validator marks Dependabot automation bypass');
}

function testValidatorStillRejectsAutomationBodyFromHumanAuthor(): void {
  const body = 'Bumps hono from 4.12.18 to 4.12.19.';
  const result = validatePrContract(body, { prAuthor: 'human-author' });

  equal(result.ok, false, 'PR contract validator still rejects non-template bodies from human authors');
  ok(result.missingSections.includes('## Attestor PR Contract'), 'PR contract remains required for human PRs');
}

testTemplateContainsRequiredContract();
testValidatorRejectsBlankTemplate();
testValidatorAcceptsCompletedTemplate();
testValidatorRejectsInvalidEvidenceState();
testValidatorAcceptsDependabotAutomationBody();
testValidatorStillRejectsAutomationBodyFromHumanAuthor();

console.log(`PR contract template tests: ${passed} passed, 0 failed`);
