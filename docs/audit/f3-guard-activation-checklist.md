# F3-R3 Guard Activation Checklist

This audit record captures the F3-R3 follow-up from the cross-cutting agentic guard audit.

It is not complete production enforcement, not an external audit, not a certification, and not a production readiness claim.

## Finding Addressed

The F3 cross-cutting audit identified that several Attestor guards can render decisions, but that rendering a guard decision is not the same as activating that guard as a production enforcement control.

The concrete risk was overclaiming:

```text
registered failure mode + guard decision output
  !=
production enforcement control
```

## Implemented Control

F3-R3 adds a machine-readable guard activation checklist:

- versioned contract: `attestor.consequence-guard-activation-readiness.v1`
- covered guard list
- required activation criteria
- per-guard readiness state
- blocker codes
- digest-first readiness output
- explicit `autoEnforce: false`
- explicit `activatesEnforcement: false`
- explicit `productionReady: false`

## Protected Principles

- fail-closed boundary
- no overclaim
- runtime readiness
- auditability
- replay/idempotency safety
- customer authority

## Repository Evidence

Code evidence:

- `src/consequence-admission/guard-activation-readiness.ts`
- `src/consequence-admission/index.ts`
- `scripts/probe-consequence-admission-package-surface.mjs`

Test evidence:

- `tests/guard-activation-readiness.test.ts`
- package script: `npm run test:guard-activation-readiness`

Documentation evidence:

- `docs/02-architecture/guard-activation-readiness.md`
- this audit record

## Activation Criteria

Every guard must prove:

- `guard-descriptor-exported`
- `fail-closed-decision-output`
- `raw-payload-storage-disabled`
- `production-shared-state-proven`
- `signed-decision-binding`
- `route-or-pep-enforcement-integrated`
- `downstream-verifier-integrated`
- `replay-fixture-covered`
- `audit-record-emitted`
- `operator-runbook-documented`
- `customer-activation-approved`

## Status

Status: repository-side checklist implemented.

Not complete:

- The checklist does not activate runtime enforcement.
- The checklist does not prove customer deployment readiness.
- The checklist does not replace downstream verifier integration.
- The checklist does not certify that every customer workflow is non-bypassable.

Next required hardening: use this checklist when evaluating each guard-specific production activation path.
