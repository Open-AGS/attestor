import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

let passed = 0;

function includes(haystack: string, needle: string, message: string): void {
  assert.ok(haystack.includes(needle), message);
  passed += 1;
}

function matches(haystack: string, pattern: RegExp, message: string): void {
  assert.match(haystack, pattern, message);
  passed += 1;
}

const policy = readFileSync(new URL('../.github/BRANCH_POLICY.md', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/branch-governance.yml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/check/check-stale-branches.mjs', import.meta.url), 'utf8');
const codeowners = readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8');
const contributing = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
const remediation = readFileSync(
  new URL('../docs/audit/v0.2.0-round12-stale-branch-governance-remediation.md', import.meta.url),
  'utf8',
);

includes(policy, '`master` is the only public branch', 'Branch policy: master is the only public source of truth');
includes(policy, '`codex/*` branches are temporary implementation branches only', 'Branch policy: codex branches are ephemeral');
includes(policy, 'delete_branch_on_merge', 'Branch policy: automatic branch deletion setting is named');
includes(policy, 'Do not ask users, reviewers, customers, scripts, or documentation to install or clone Attestor from a `codex/*` branch', 'Branch policy: direct codex branch consumption is forbidden');

includes(workflow, 'name: Branch Governance', 'Branch workflow: named');
includes(workflow, 'pull_request:', 'Branch workflow: runs on pull requests touching governance files');
includes(workflow, 'push:', 'Branch workflow: runs on master pushes touching governance files');
includes(workflow, "'.github/**'", 'Branch workflow: watches GitHub governance files');
includes(workflow, "'SECURITY.md'", 'Branch workflow: watches SECURITY.md');
includes(workflow, 'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6', 'Branch workflow: checkout action is SHA-pinned');
includes(workflow, 'node scripts/check/check-stale-branches.mjs --require-master-only', 'Branch workflow: stale branch checker runs in master-only mode');
includes(workflow, 'ATTESTOR_BRANCH_GOVERNANCE_TOKEN', 'Branch workflow: live governance probes require a dedicated admin-read token secret');
includes(workflow, 'GitHub Administration: read permission', 'Branch workflow: token permission boundary is explicit');
includes(workflow, "delete_branch_on_merge", 'Branch workflow: repository auto-delete setting is checked');
matches(workflow, /Verify stale branch policy\s+if: github\.event_name != 'pull_request'/u, 'Branch workflow: stale branch inventory enforcement is not run from pull_request branches');
matches(workflow, /Verify branch-governance admin-read token\s+if: github\.event_name != 'pull_request'/u, 'Branch workflow: admin-read token check is not run from pull_request branches');
matches(workflow, /Verify delete-branch-on-merge\s+if: github\.event_name != 'pull_request'/u, 'Branch workflow: repository setting probe is not run from pull_request tokens');
includes(workflow, "github.event_name != 'pull_request'", 'Branch workflow: live branch protection probe is not run from pull_request tokens');
includes(workflow, 'protection/required_signatures', 'Branch workflow: required signed commits setting is checked');
includes(workflow, 'required_signatures.enabled must remain true', 'Branch workflow: required signed commits failure is explicit');
includes(workflow, 'protection/required_pull_request_reviews', 'Branch workflow: required PR review settings are checked');
includes(workflow, 'required_approving_review_count', 'Branch workflow: required approving review count is checked');
includes(workflow, 'require_code_owner_reviews', 'Branch workflow: CODEOWNER review setting is checked');
includes(workflow, 'dismiss_stale_reviews', 'Branch workflow: stale review dismissal setting is checked');
includes(workflow, 'require_last_push_approval', 'Branch workflow: last-push approval setting is checked');

includes(script, '--require-master-only', 'Branch script: supports master-only enforcement');
includes(script, 'mergedCodexBranches', 'Branch script: reports merged codex branches');
includes(script, 'Remote branch policy requires master-only public branches.', 'Branch script: fails non-master branch inventory when required');

includes(codeowners, '/CONTRIBUTING.md @AI-gateway-systems', 'CODEOWNERS: contributing guidance requires owner review');
includes(codeowners, 'Per-surface teams must not be added as placeholders.', 'CODEOWNERS: placeholder surface teams are forbidden');
includes(codeowners, 'exists, is visible, and has explicit write access', 'CODEOWNERS: team-owner prerequisites are documented');

includes(contributing, '## Workflow Permission Discipline', 'Contributing: workflow permission discipline section exists');
includes(contributing, '`contents: read`', 'Contributing: contents read is the default workflow token posture');
includes(contributing, 'attestations: write', 'Contributing: release provenance attestation write scope is named');
includes(contributing, 'id-token: write', 'Contributing: OIDC write scope is named');
includes(contributing, 'security-events: write', 'Contributing: CodeQL security-events write scope is named');
includes(contributing, 'CODEOWNER review', 'Contributing: elevated write scopes require owner review');
includes(contributing, 'Do not add broad `write-all`, `contents: write`,', 'Contributing: broad write grants are forbidden');
includes(contributing, 'or unrelated write permissions for convenience.', 'Contributing: unrelated write grants are forbidden');
includes(contributing, '## CODEOWNERS Surface Ownership', 'Contributing: CODEOWNERS surface ownership section exists');
includes(contributing, 'placeholder per-surface team slugs', 'Contributing: placeholder surface teams are forbidden');
includes(contributing, 'create visible GitHub', 'Contributing: visible GitHub team prerequisite is documented');
includes(contributing, 'explicit write access to this repository', 'Contributing: team write-access prerequisite is documented');
includes(contributing, 'team membership policy', 'Contributing: team membership policy prerequisite is documented');

includes(remediation, 'delete_branch_on_merge=true', 'Branch remediation: final delete-branch-on-merge state is recorded');
matches(remediation, /branch inventory: `\["master"\]`/u, 'Branch remediation: final branch inventory is recorded');
includes(remediation, 'This remediation does not prove production readiness', 'Branch remediation: no-claim boundary is explicit');

console.log(`Branch governance policy tests: ${passed} passed, 0 failed`);
