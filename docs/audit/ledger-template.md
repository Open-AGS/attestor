# Audit Ledger Template

This is a generic public-safe template for tracking audit and hardening findings.

Do not store private financial constraints, live secrets, customer data, tenant data, provider payloads, operator-only deployment details, or personal workflow notes in this ledger.

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
Status: open | confirmed | disputed | duplicate | out-of-scope | fixed | blocked | accepted limitation
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
Regression test or probe:
PR:
Commit:
Verification:
Remaining limitation:
Owner:
Date opened:
Date closed:
```

## Remediation Rule

Do not implement a fix from a finding until the finding is validated against repository evidence. If the finding is not supported, record the status as `disputed`, `duplicate`, `out-of-scope`, `blocked`, or `accepted limitation` with rationale.

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
