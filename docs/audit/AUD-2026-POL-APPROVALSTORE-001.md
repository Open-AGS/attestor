# AUD-2026-POL-APPROVALSTORE-001 - Policy Activation Approval Store Path Boundary

Lifecycle state: accepted-limitation
Severity: low
Original report: legacy label `R24 B-077`
Current validation ref: origin/master 318c2171fc69e53d235a065197bb1149ef3fea27
Protected principle: auditability; operational boundedness; no overclaim
Trust surface: release policy control-plane approval store

## Repository Evidence

- `src/release-policy-control-plane/activation-approvals.ts` resolves
  `ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH` when a caller uses the
  file-backed approval store default path.
- The same module also supports embedded-memory stores and explicit file paths
  supplied by tests or callers.
- File-backed writes use `withFileLock` and `writeTextFileAtomic`, so the
  accepted limitation is operator path custody, not torn writes.

## Risk

An operator can point the approval store at a writable but weakly protected
path. That can weaken the operational custody of approval records if the host
filesystem boundary is already compromised or misconfigured.

## External Anchors

- NIST CSF Govern: storage ownership, policy oversight, and operator
  accountability are governance controls, not properties that a local JSON file
  can prove by itself.
- OWASP ASVS: sensitive state storage should be tied to deployment access
  controls and operational verification evidence.

## Why Applicable

Approval records affect release-policy activation decisions. Their storage path
is therefore part of the auditability and operational-boundedness boundary.

## Why Not Overclaimed

This record does not claim the file-backed approval store is a shared,
tamper-proof, or production-grade durable store. It only records that local path
selection is an operator-controlled evaluation boundary.

## Decision

Status is `accepted-limitation`, not a code fix. This matches the existing
file-backed evaluation-store pattern in the repository. Production-shared
deployments still need a separately verified shared durable store boundary.

## Verification

Use these repository checks when this limitation is touched:

```bash
npm run test:audit-id-alias-registry
npm run test:audit-finding-evidence
npm run typecheck
npm run typecheck:hygiene
```

## Remaining Limitation

The default file-backed approval store remains host-local. A future
production-shared control-plane store must prove access control, backup,
restore, locking, and tamper-evidence at the deployment substrate.
