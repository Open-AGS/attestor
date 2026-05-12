# Audit Ledger Template

This is a generic public-safe template for tracking audit and hardening findings.

Do not store private financial constraints, live secrets, customer data, tenant data, provider payloads, operator-only deployment details, or personal workflow notes in this ledger.

## Finding Entry

```text
ID:
Title:
Status: open | confirmed | disputed | duplicate | out-of-scope | fixed | blocked | accepted limitation
Severity: critical | high | medium | low
Protected principle:
Trust surface:
Source:
Exact file/path:
Exact function/route/test/contract:
Observed behavior:
Expected behavior:
Risk:
Smallest safe fix:
Regression test or probe:
PR:
Commit:
Verification:
Remaining limitation:
Owner:
Date opened:
Date closed:
```

## Status Rules

- `open`: reported but not validated.
- `confirmed`: repository evidence proves the issue or gap.
- `disputed`: evidence does not support the finding as stated.
- `duplicate`: covered by another entry.
- `out-of-scope`: outside the agreed audit scope.
- `fixed`: merged and verified.
- `blocked`: external dependency or operator action required.
- `accepted limitation`: documented limitation, not a hidden defect.

## Closure Rule

A finding is not fixed until the fix is merged and the verification evidence is recorded.
