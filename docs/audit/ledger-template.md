# Audit Ledger Template

This is a generic public-safe template for tracking audit and hardening findings.

Do not store private financial constraints, live secrets, customer data, tenant data, provider payloads, operator-only deployment details, or personal workflow notes in this ledger.

Canonical lifecycle: use
`docs/audit/finding-lifecycle-and-evidence-ledger.md` for state transitions,
closure evidence, and remediation records. This template remains the compact
entry form; the lifecycle document is the closure contract.

## Audit Run Header

```text
Audit ID:
Audit title:
Mode: read-only | remediation | verification
Target ref:
Date:
Reviewer:
Threat model / framework:
Research anchors:
Scope:
Files/modules inspected:
Out of scope:
Known limitations:
```

## Finding Entry

```text
ID:
Title:
Audit run:
Lifecycle state: reported | validated | disputed | duplicate | out-of-scope | blocked | accepted-limitation | superseded | accepted | fixed | tested | re-audited | closed
Severity: critical | high | medium | low
Protected principle:
Trust surface:
Source:
Exact file/path:
Exact function/route/test/contract:
Affected modules or chain:
Observed behavior:
Expected behavior:
Risk:
Validation evidence:
Dispute rationale:
Research anchors for fix:
Smallest safe fix:
Negative/adversarial test:
Positive/regression test or probe:
PR:
Commit:
CI checks:
Re-audit result:
Verification:
Remaining limitation:
Owner:
Date opened:
Date closed:
```

## Remediation Rule

Do not implement a fix from a finding until the finding is validated against repository evidence. If the finding is not supported, record the status as `disputed`, `duplicate`, `out-of-scope`, `blocked`, or `accepted limitation` with rationale.

## Status Rules

- `reported`: finding received but not validated.
- `validated`: repository evidence proves the issue or gap.
- `disputed`: evidence does not support the finding as stated.
- `duplicate`: covered by another entry.
- `out-of-scope`: outside the agreed audit scope.
- `blocked`: external dependency or operator action required.
- `accepted-limitation`: documented limitation, not a hidden defect.
- `superseded`: later code or architecture made the original finding stale.
- `accepted`: validated and accepted for remediation.
- `fixed`: code/docs/config change exists, but closure evidence is not complete.
- `tested`: regression or negative evidence exists.
- `re-audited`: original finding was rechecked against the fix.
- `closed`: merged, checks are green, and `origin/master` has been verified.

## Closure Rule

A finding is not closed until the fix is merged, the verification evidence is
recorded, the original finding is re-audited, residual risk is stated, and the
merge commit is verified on `origin/master`.
