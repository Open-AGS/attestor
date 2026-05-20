# REM-2026-POL-DIGEST-001 - Locale-Independent Policy Control-Plane Digests

Lifecycle state: fixed
Finding ID: AUD-2026-POL-DIGEST-001
Severity: low
Original report: legacy label `R24 B-079`
Original target ref: origin/master 318c2171fc69e53d235a065197bb1149ef3fea27
Protected principle: proof integrity; auditability; release provenance
Trust surface: release policy control-plane approval and audit digests

## Repository Evidence

- `src/release-policy-control-plane/activation-approvals.ts` used
  `left.localeCompare(right)` while ordering object keys for approval digests.
- `src/release-policy-control-plane/audit-log.ts` used the same comparator for
  policy mutation audit digest snapshots.
- Those functions feed `approvalDigest`, `decisionDigest`, `mutationDigest`,
  and `entryDigest`.

## Risk Being Closed

Locale-sensitive key ordering can make canonical digests depend on runtime
locale or collation behavior instead of byte-identical input structure.

## External Anchors

- RFC 8785 JSON Canonicalization Scheme: deterministic JSON object member order
  is a code-unit based canonicalization concern, not locale collation.
- ECMA-402 `String.prototype.localeCompare`: comparison can be
  locale-sensitive through international collation behavior.

## Why Applicable

Approval and audit digests are proof-integrity surfaces. Two runtimes must not
produce different digests because of locale-sensitive sorting.

## Why Not Overclaimed

This remediation only removes locale-sensitive sorting from the two policy
control-plane digest functions named in the finding. It does not claim every
`localeCompare` use in the repository is security-critical or digest-bearing.

## Smallest Safe Fix

Both digest functions now sort object keys with binary string comparison:

```ts
if (left < right) return -1;
if (left > right) return 1;
return 0;
```

The regression tests trap `String.prototype.localeCompare` and prove the
approval and audit digest paths no longer call it.

## Verification

```bash
tsx tests/release-policy-control-plane-activation-approvals.test.ts
tsx tests/release-policy-control-plane-audit-log.test.ts
npm run typecheck
npm run typecheck:hygiene
```

## Remaining Limitation

Non-digest display sorting may still use `localeCompare`. That is outside this
fix unless a later audit proves a specific proof or digest surface depends on
it.
