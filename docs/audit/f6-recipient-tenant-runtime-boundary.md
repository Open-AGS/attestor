# F6 Recipient/Tenant Runtime Boundary Bridge

Status: repository-side runtime bridge for F6-T8.

This does not claim universal route enforcement. It adds a central runtime decision surface so tenant, recipient, and redaction metadata can be evaluated
outside synthetic replay fixtures.

## Decision

`src/consequence-admission/recipient-tenant-boundary-runtime.ts` wraps the
existing recipient/tenant replay evaluator and emits a runtime decision:

- `pass` returns `allowed: true`
- `review` and `block` return `allowed: false` and `failClosed: true`
- raw tenant ids, recipient ids, communication contexts, and runtime surface
  refs are never serialized; only digests are emitted
- the bridge is digest-only, does not execute production traffic, and does not
  mutate downstream systems

## Repository Evidence

- `evaluateConsequenceRecipientTenantRuntimeBoundary()` renders fail-closed
  decisions for tenant, recipient, and data-minimization boundaries.
- `consequenceRecipientTenantRuntimeBoundaryDescriptor()` exposes the runtime
  bridge status without claiming production readiness.
- `failure-mode-guard-coverage.ts` now maps `cross-tenant-leakage` and
  `wrong-recipient-disclosure` to the runtime bridge instead of replay-only
  coverage.
- The architecture doc names both the replay contract and runtime bridge.

## Tests

Run:

```bash
npm run test:f6-recipient-tenant-runtime-boundary
```

The test verifies clean pass, foreign-tenant block, wrong-recipient/data-class
block, missing-evidence review, digest-only output, guard-coverage mapping, and
tracker alignment.

## Remaining Boundary

F6-T8 remains `partial`, not `fixed`, because this PR does not wire every
hosted dashboard, export, review packet, downstream sender, or customer gateway
to the bridge. It closes the replay-only repository gap by providing the central
runtime bridge and tests. Surface-by-surface enforcement adoption remains future
integration work.
