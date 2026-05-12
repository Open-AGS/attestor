# Cold Audit Playbook

Use this playbook for read-only adversarial review.

Do not modify files during a cold audit. Do not treat README claims as proof. Treat every claim as untrusted until it is supported by source code, tests, contracts, CI, package scripts, probes, or explicit limitation docs.

## Audit Steps

1. Define the audit scope and trust surface.
2. Identify the protected principles in scope.
3. Inspect source code, tests, contracts, docs, and package scripts.
4. Compare claims against implemented behavior.
5. Classify each issue as confirmed, disputed, duplicate, out-of-scope, fixed, blocked, or accepted limitation.
6. Recommend the smallest safe fix for confirmed issues.
7. Name the regression test or probe that would prove the fix.

## Finding Format

Use this shape for each finding:

```text
ID:
Severity:
Status:
Protected principle:
Trust surface:
Exact file/path:
Exact function/route/test/contract:
Observed behavior:
Expected behavior:
What can go wrong:
Exploitability or hardening gap:
Smallest safe fix:
Regression test or probe:
Does this weaken Attestor's core claim:
Remaining limitation:
```

## Severity Guidance

- `critical`: direct bypass of a consequence boundary, tenant boundary, release authority, or secret boundary.
- `high`: likely trust-control failure under realistic use.
- `medium`: meaningful hardening gap, drift risk, or incomplete enforcement.
- `low`: clarity, maintainability, or reviewer-evidence gap.

If evidence is incomplete, say `not proven`. Do not upgrade a suspicion into a confirmed finding without repository evidence.
