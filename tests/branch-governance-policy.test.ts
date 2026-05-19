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
const script = readFileSync(new URL('../scripts/check-stale-branches.mjs', import.meta.url), 'utf8');
const remediation = readFileSync(
  new URL('../docs/audit/v0.2.0-round12-stale-branch-governance-remediation.md', import.meta.url),
  'utf8',
);

includes(policy, '`master` is the only public branch', 'Branch policy: master is the only public source of truth');
includes(policy, '`codex/*` branches are temporary implementation branches only', 'Branch policy: codex branches are ephemeral');
includes(policy, 'delete_branch_on_merge', 'Branch policy: automatic branch deletion setting is named');
includes(policy, 'Do not ask users, reviewers, customers, scripts, or documentation to install or clone Attestor from a `codex/*` branch', 'Branch policy: direct codex branch consumption is forbidden');

includes(workflow, 'name: Branch Governance', 'Branch workflow: named');
includes(workflow, 'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6', 'Branch workflow: checkout action is SHA-pinned');
includes(workflow, 'node scripts/check-stale-branches.mjs --require-master-only', 'Branch workflow: stale branch checker runs in master-only mode');
includes(workflow, "delete_branch_on_merge", 'Branch workflow: repository auto-delete setting is checked');

includes(script, '--require-master-only', 'Branch script: supports master-only enforcement');
includes(script, 'mergedCodexBranches', 'Branch script: reports merged codex branches');
includes(script, 'Remote branch policy requires master-only public branches.', 'Branch script: fails non-master branch inventory when required');

includes(remediation, 'delete_branch_on_merge=true', 'Branch remediation: final delete-branch-on-merge state is recorded');
matches(remediation, /branch inventory: `\["master"\]`/u, 'Branch remediation: final branch inventory is recorded');
includes(remediation, 'This remediation does not prove production readiness', 'Branch remediation: no-claim boundary is explicit');

console.log(`Branch governance policy tests: ${passed} passed, 0 failed`);
