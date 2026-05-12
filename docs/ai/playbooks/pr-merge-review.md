# PR Merge Review Playbook

Use this playbook before merging or asking an operator to merge.

## Pre-PR

1. Confirm the branch is based on the intended remote base.
2. Confirm the working tree contains only intended changes.
3. Review the diff before staging.
4. Stage explicit files when the worktree is mixed.
5. Commit with a focused message.
6. Push the branch.
7. Open a PR with a clear body and validation evidence.

## Review Checks

Before merge:

- PR state is open.
- Required checks are green.
- Failed or pending checks are not ignored.
- Unresolved actionable comments are handled or explicitly deferred.
- The PR does not overclaim production readiness, compliance, audit status, or live environment readiness.
- The validation commands in the PR body match the actual work.

## Merge Rule

Do not merge unless the operator explicitly authorizes merge for that PR or the project workflow already delegates merge authority for that class of change.

If the operator owns merges, stop after PR readiness and say exactly what remains:

```text
PR ready.
Merge not done.
Waiting on operator merge.
```

## Post-Merge Verification

After merge, verify:

- PR state is merged.
- Merge commit exists.
- `origin/master` or the intended base contains the merge.
- The feature branch can be deleted if no longer needed.

Do not claim merged until this is checked.
