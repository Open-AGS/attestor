# Research-Backed Change Playbook

Use this playbook before implementing a non-trivial trust-control change.

The purpose is not to copy external guidance. The purpose is to extract the useful engineering pattern, translate it into Attestor's protected principles, and implement the smallest repo-grounded change.

## Required Steps

1. Identify the affected trust surface.
2. Identify the protected principle being strengthened.
3. Inspect current repository behavior.
4. Find primary or official external anchors where relevant.
5. Compare external guidance against Attestor's existing patterns.
6. Decide whether the output should be code, contract, test, documentation, probe, or no-go.
7. Plan the smallest safe fix.
8. Implement only after the plan is clear.
9. Verify with targeted tests and broader checks when risk warrants it.
10. Document limitations if evidence remains incomplete.

## Research Output

Before implementation, produce:

```text
Trust surface:
Protected principle:
External anchors:
Repository evidence:
Gap:
Proposed smallest safe fix:
Files likely affected:
Verification plan:
No-go or limitation:
```

## Translation Rules

- Prefer official sources over blog posts.
- Prefer existing repository patterns over new abstractions.
- Prefer deterministic checks over model judgment.
- Prefer contracts and tests over prose-only claims.
- Keep live/ops claims separate from secretless local verification.
- Keep private operator details out of public docs.
