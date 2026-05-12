# Implementation Hardening Playbook

Use this playbook after a finding or research-backed plan is approved for implementation.

## Steps

1. Re-read the files that will be changed.
2. Re-check nearby tests and package scripts.
3. State the intended file changes before editing.
4. Make the smallest behavior-preserving or behavior-correcting change.
5. Add or update tests when behavior changes.
6. Update contracts or docs only where the system claim changes.
7. Run targeted verification first.
8. Run broader verification when the change touches shared trust behavior.
9. Commit a focused diff.
10. Push and open a PR with validation evidence.

## Hardening Rules

- Do not hide a failed check by weakening the test.
- Do not suppress an error without explaining and testing the root cause.
- Do not move a runtime boundary into documentation only.
- Do not add broad dependencies for narrow trust logic.
- Do not weaken secret, tenant, replay, idempotency, or fail-closed controls to improve ergonomics.

## PR Evidence

The PR body should include:

- what changed
- protected principle
- risk closed
- files changed
- verification commands
- remaining limitation or no-go

If a check could not run, state why.
