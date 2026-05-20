# REM-2026-POL-APPROVALTTL-001 - Risk-Class-Aware Approval Expiry

Lifecycle state: fixed
Finding ID: AUD-2026-POL-APPROVALTTL-001
Severity: low
Original report: legacy label `R24 B-078`
Original target ref: origin/master 318c2171fc69e53d235a065197bb1149ef3fea27
Protected principle: customer authority; fail-closed boundary; operational boundedness
Trust surface: release policy control-plane activation approvals

## Repository Evidence

- `src/release-policy-control-plane/activation-approvals.ts` previously used a
  24-hour default expiry for every approval request without considering the
  policy activation risk class.
- The approval requirement derivation already computes the highest relevant
  `riskClass` before default expiry is assigned.

## Risk Being Closed

High-risk policy activation approvals could remain pending for the same default
duration as low-risk activations, increasing the chance that stale context is
approved later.

## External Anchors

- NIST CSF Govern: approval policies should scale with risk and be governed by
  explicit oversight.
- OWASP ASVS: sensitive administrative workflows should have bounded,
  risk-aware authorization windows.

## Why Applicable

Policy activation can change the release control plane. Approval freshness is
therefore part of the authority boundary around policy mutation.

## Why Not Overclaimed

This remediation narrows repository-side default approval lifetimes. It does
not claim that every live deployment has external workflow tooling, ticket
expiry enforcement, or human-process SLA evidence.

## Smallest Safe Fix

Default approval expiry is now derived from risk class:

- `R4`: 4 hours
- `R3`: 8 hours
- `R0` through `R2`: 24 hours

Explicit caller-provided `expiresAt` still wins.

## Verification

```bash
tsx tests/release-policy-control-plane-activation-approvals.test.ts
npm run typecheck
npm run typecheck:hygiene
```

## Remaining Limitation

Live process evidence, ticket workflow expiry, and reviewer notification SLA
remain outside this repository-side fix.
