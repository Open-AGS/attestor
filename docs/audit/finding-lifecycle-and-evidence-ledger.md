# Audit Finding Lifecycle And Remediation Evidence Ledger

Status: canonical repository-side lifecycle for Attestor audit findings.

This document defines how a finding moves from report to closure. It is not an
external audit, not a certification, not production readiness, and not a claim
that every historical finding is closed. It is the operating contract for
closing findings with evidence instead of closing them by assertion.

## Research Anchors

- NIST SP 800-115: technical security testing should plan tests, analyze
  findings, and develop mitigation strategies.
- NIST CSF 2.0: cybersecurity risks need a standardized method for calculating,
  documenting, categorizing, and prioritizing risk.
- OWASP ASVS: verification should provide a basis for testing technical
  controls and for specifying verifiable requirements.
- OWASP DSOVS: DevSecOps maturity includes security issue tracking design,
  security test management, security test coverage, and release-policy
  enforcement.

These anchors are engineering references. They do not certify Attestor.

## Protected Principles

Every non-trivial audit finding must name at least one protected principle:

- proof integrity
- fail-closed boundary
- tenant isolation
- customer authority
- data minimization and redaction
- no overclaim
- runtime readiness
- release provenance
- auditability
- replay and idempotency safety
- operational boundedness

## Canonical State Machine

The normal closure path is:

```text
reported
  -> validated
  -> accepted
  -> fixed
  -> tested
  -> re-audited
  -> closed
```

Side exits are allowed, but they require evidence:

```text
reported
  -> disputed
  -> duplicate
  -> out-of-scope
  -> blocked
  -> accepted-limitation
  -> superseded
```

## State Rules

| State | Meaning | Minimum evidence |
|---|---|---|
| `reported` | Finding received but not validated against current `origin/master`. | Source report, target ref if known, affected surface. |
| `validated` | Current repo evidence proves the issue or gap exists. | File/line, route, test, command output, or config evidence. |
| `disputed` | Current repo evidence does not support the finding as stated. | Counterevidence and narrowed rationale. |
| `duplicate` | Same risk already tracked elsewhere. | Canonical duplicate ID and why it covers this finding. |
| `out-of-scope` | Outside the agreed audit/remediation scope. | Scope statement and future owner if any. |
| `blocked` | Cannot be closed by repository code alone. | External dependency, owner decision, live env, billing, or provider blocker. |
| `accepted-limitation` | Real limitation, intentionally not claimed as solved. | Public-safe limitation text and no-claim boundary. |
| `superseded` | Later code or architecture made the original finding stale. | Fresh `origin/master` evidence and replacement behavior. |
| `accepted` | Maintainer accepts the validated finding for remediation. | Smallest safe fix and verification plan. |
| `fixed` | Code/docs/config change exists but closure evidence is not complete yet. | PR or commit reference and changed files. |
| `tested` | Regression, negative, or probe evidence exists. | Test/probe names and local or CI result. |
| `re-audited` | Original finding has been checked against the fix. | Re-audit result and residual risk. |
| `closed` | Fix is merged, checks are green, and `origin/master` has been verified. | Merge commit, CI run/checks, residual risk, closer identity/date. |

## Closure Rules

A finding is not closed by code alone. Closure requires all of:

1. Current `origin/master` target ref.
2. Original risk statement and protected principle.
3. Validation evidence or dispute evidence.
4. Fix PR and merge commit, unless closed as `disputed`, `out-of-scope`,
   `accepted-limitation`, `blocked`, `duplicate`, or `superseded`.
5. Negative test, adversarial fixture, property test, probe, or explicit reason
   why a test is not possible.
6. CI or local verification command.
7. Re-audit result against the original finding.
8. Residual risk and no-claim boundary.
9. Mapping to at least one accepted risk or verification taxonomy such as CWE,
   NIST, OWASP ASVS, OWASP DSOVS, STRIDE, or STPA.
10. Control-mapping rationale: external anchors, why those anchors apply to the
    finding, and why the mapping does not overclaim certification, compliance,
    production readiness, or audit completion.

For trust-boundary findings, a passing happy-path test is not enough. The
closure evidence should include at least one negative or adversarial case unless
the finding is documentation-only.

## Remediation Evidence Record

Use this schema for every high or medium finding, and for any low finding that
touches a protected principle:

```text
Finding ID:
Lifecycle state:
Severity:
Original report:
Original target ref:
Current validation ref:
Protected principle:
Trust surface:
Original risk:
Repository evidence:
Research anchors:
Mapping:
External anchors:
Why applicable:
Why not overclaimed:
Decision:
Smallest safe fix:
Files changed:
Negative/adversarial tests:
Positive/regression tests:
CI checks:
Fix PR:
Merge commit:
Re-audit result:
Residual risk:
No-claims:
Closed by:
Date opened:
Date closed:
```

## Example Record

```text
Finding ID: EH-2026-SESSION-CSRF-001
Lifecycle state: closed
Severity: medium
Original report: enterprise hardening service-layer review
Original target ref: origin/master 2362487e4e1070f748cb0fe7ebb2d2ab11b715d4
Current validation ref: origin/master 83c7bc7720e767391e927d831533d5693fb4f7c4
Protected principle: customer authority; fail-closed boundary; runtime readiness
Trust surface: hosted account session cookie mutations
Original risk: cookie-authenticated account mutations lacked an explicit
  same-origin/API-client confirmation header.
Repository evidence: requireAccountSession now rejects unsafe cookie-session
  mutations without x-attestor-csrf; tenant isolation records cookie vs header
  session transport.
Research anchors: OWASP CSRF guidance; NIST SP 800-115 mitigation reporting
Mapping: CWE-352; OWASP CSRF guidance; NIST SP 800-115 mitigation reporting
External anchors: NIST SP 800-115; NIST CSF Govern; OWASP ASVS
Why applicable: the finding concerns a hosted mutation control, mitigation
  evidence, and verification of a web security boundary.
Why not overclaimed: the mapping supports remediation evidence only; it is not a
  SOC 2, ISO, OWASP, or NIST certification claim.
Decision: validated and accepted for narrow service-layer remediation.
Smallest safe fix: require x-attestor-csrf only for unsafe methods when the
  account session was resolved from a cookie.
Files changed: request-context.ts; tenant-isolation.ts; hosted journey
  contract; hosted signup/billing tests; deployment docs.
Negative/adversarial tests: hosted signup flow rejects API-key issuance without
  x-attestor-csrf.
Positive/regression tests: hosted signup flow; hosted Stripe billing flow;
  hosted product flow contract/docs/readiness; account session cookie security.
CI checks: CodeQL, evaluation-smoke, f-series, pr-contract, npm-audit-high,
  dependency-review, supply-chain-baseline.
Fix PR: #482
Merge commit: 83c7bc7720e767391e927d831533d5693fb4f7c4
Re-audit result: re-audited against the original cookie-session mutation risk.
Residual risk: complete browser app CORS/WAF/customer deployment posture remains
  not proven.
No-claims: not production readiness; not a complete browser security audit.
Closed by: Codex
Date opened: 2026-05-19
Date closed: 2026-05-19
```

## Relationship To Existing Tracker

`docs/audit/attestor-audit-remediation-tracker.md` remains the historical
aggregate tracker for F-series work. This lifecycle document is the per-finding
closure contract. Future tracker rows should reference this state machine when
moving a finding to `fixed`, `accepted-limitation`, `superseded`,
`invalid-as-stated`, or `backlog`.

