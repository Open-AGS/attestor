# Policy Lifecycle Atomicity Boundary Validation - 2026-06-01

## Validation Frame

Source of truth: `origin/master` at
`b78f7f38da4dbe9e5fcd53852f02778514700d31`.

Scope:

- release-policy activation, rollback, emergency freeze, and emergency rollback
- shared policy-control store transaction boundaries
- policy-control metadata and policy mutation audit coupling
- generic middleware binding default claim reconciliation

Protected principles:

- fail-closed boundary
- customer authority
- proof integrity
- replay and idempotency safety
- auditability
- no overclaim

Primary anchors:

- PostgreSQL transaction guidance: grouped statements commit or roll back as one
  unit.
- PostgreSQL transaction-scoped advisory locks.
- OWASP authorization guidance: fail closed and validate authorization on each
  request.

## Recent Fixes Chain-Effect Check

The immediately preceding middleware/policy-freeze slice closed default
`GET`/`HEAD` middleware protection and static-discovery frozen activation
precedence. This pass keeps those closures intact.

The supplied middleware binding finding is contradicted by current repository
evidence: default binding headers are ignored unless `bindingHeaderMode:
'trusted-upstream'` is explicitly configured. One buildout sentence still used
old safe-method wording, so this pass updates that wording without changing the
runtime binding boundary.

## Findings

### OPS-206 - Policy activation lifecycle transition was not one atomic shared-store mutation

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `applyPolicyLifecycle(...)` snapshotted the store into a local copy, applied
  activation/freeze/rollback semantics, then persisted the applied activation
  and historical activation update through separate calls.
- Release-policy activation, rollback, emergency freeze, and emergency rollback
  routes published metadata and appended policy mutation audit after the
  lifecycle writes.
- The shared PostgreSQL store used transaction-scoped advisory locks per store
  call, not around the complete lifecycle transition.

Fix:

- Added a shared-store `applyActivationLifecycle(...)` mutation path.
- The shared path now takes a transaction-scoped policy-store lock and
  policy-audit lock, reads a consistent store snapshot, applies the lifecycle
  transition, writes applied and historical activation records, publishes
  metadata, and appends the policy mutation audit in one transaction.
- Route lifecycle mutations now use a single helper so shared stores take the
  atomic path and file-backed/evaluation stores keep the narrow local fallback.
- The release-enforcement buildout wording now reflects current default
  `GET`/`HEAD` protection and explicit protected-method opt-outs.

Locking evidence:

- `tests/release-policy-authority-store.test.ts`
- `tests/release-policy-control-plane-admin-routes.test.ts`

Boundary:

This closes the shared-store repository transition gap for the scoped
policy-control lifecycle routes. It does not prove live shared-store deployment,
operator emergency procedure execution, role-key deployment, customer PEP
no-bypass, or production readiness.

### Middleware binding default claim

State: contradicted by current repository evidence.

Current repository evidence:

- `src/release-enforcement-plane/middleware.ts` resolves target, output, and
  consequence bindings from trusted options by default.
- Header fallback is allowed only when `bindingHeaderMode: 'trusted-upstream'`
  is set.
- `tests/release-enforcement-plane-middleware.test.ts` proves default
  caller-supplied binding headers deny with `binding-mismatch`, while explicit
  trusted-upstream mode can consume pre-bound headers.
- `docs/audit/finding-index.md` already tracks OPS-194 as closed repo-side /
  live-proof-only.

No runtime fix was required for this claim.

## Positive Observations

- OPS-194, OPS-204, and OPS-205 remain aligned with current code and tests.
- Token lifecycle and decision-log store claims in the intake remain covered by
  current indexed tests.
- Static policy discovery still fails closed on matching frozen activations.

## Verdict

Repo-side remediation is complete for OPS-206. The middleware binding finding
is contradicted by current repository evidence.

Remaining proof is live/operator proof only:

- live shared policy-control store deployment
- live emergency procedure rehearsal
- live role-key deployment
- live customer PEP no-bypass
- production readiness
- enterprise readiness
