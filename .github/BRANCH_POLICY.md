# Attestor Branch Policy

## Safe Source Of Truth

`master` is the only public branch that may be treated as the Attestor source of truth.

All release, evaluation, security, audit, and documentation claims must resolve against `origin/master` unless a PR explicitly states a narrower review scope.

## Ephemeral Work Branches

`codex/*` branches are temporary implementation branches only.

They are not release channels, evaluation baselines, support branches, installation targets, or evidence sources. Do not ask users, reviewers, customers, scripts, or documentation to install or clone Attestor from a `codex/*` branch.

An active same-repository pull request may keep its head branch temporarily while review and required checks are in progress. That branch is a review ref only: it does not become a public source of truth, and it must be removed when the PR is merged or closed.

## Merge Cleanup

GitHub repository setting `delete_branch_on_merge` must stay enabled.

After a PR is merged, its head branch should be deleted automatically. If a branch remains after merge, delete it after verifying it is fully contained in `origin/master`.

## Stale Branches

Non-master branches without an open same-repository pull request are not allowed to remain as public work-in-progress.

If a branch is more than 30 days old, more than 50 commits behind `origin/master`, or contains trust-sensitive files, it must be handled in one of these ways:

- open or update a PR and rebase it onto `origin/master`;
- split the still-valid work into a fresh branch from `origin/master`;
- delete the branch if it has no active owner or review path.

## Trust-Sensitive Paths

Branches touching these surfaces require extra review before merge:

- `.github/**`
- `scripts/verify/validate-pr-contract.mjs`
- `src/consequence-admission/**`
- `src/release-enforcement-plane/**`
- `src/signing/**`
- `src/service/**`
- `src/connectors/**`
- `SECURITY.md`
- `README.md`
- `LICENSE`

## No-Claims

Deleting or cleaning stale branches does not prove production readiness, full repository audit completion, or absence of vulnerabilities. It only removes public stale-code branch surfaces and reduces accidental regression risk.
