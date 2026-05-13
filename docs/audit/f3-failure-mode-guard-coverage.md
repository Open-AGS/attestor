# F3-R5 Failure Mode Guard Coverage

This audit record captures the F3-R5 follow-up from the cross-cutting agentic guard audit.

It is not complete production enforcement, not an external audit, not a certification, and not a production readiness claim.

## Finding Addressed

The F3 cross-cutting audit identified a coverage ambiguity: some named failure modes had dedicated guard modules, while others had deterministic contracts, replay fixtures, Policy Foundry gap detection, or integration-required evidence.

The concrete risk was overclaiming:

```text
registered failure mode + control binding + replay fixture
  !=
dedicated runtime guard
  !=
production enforcement
```

## Implemented Control

F3-R5 adds a machine-readable guard coverage matrix:

- versioned contract: `attestor.consequence-failure-mode-guard-coverage.v1`
- one coverage entry per registry failure mode
- coverage kind: dedicated guard, deterministic contract, replay contract, Policy Foundry contract, or integration required
- runtime claim: renders decision, detects gap, synthetic replay, or requires integration
- primary implementation path
- code, test, and documentation evidence paths
- explicit `notProven` fields
- explicit limitation per failure mode
- conservative runtime stance: no auto-enforce, no production-ready claim, no enforcement activation

## Protected Principles

- no overclaim
- auditability
- fail-closed boundary
- runtime readiness
- customer authority

## Repository Evidence

Code evidence:

- `src/consequence-admission/failure-mode-guard-coverage.ts`
- `src/consequence-admission/index.ts`
- `scripts/probe-consequence-admission-package-surface.mjs`

Test evidence:

- `tests/failure-mode-guard-coverage.test.ts`
- package script: `npm run test:failure-mode-guard-coverage`

Documentation evidence:

- `docs/02-architecture/failure-mode-guard-coverage.md`
- this audit record

## Status

Status: repository-side coverage contract implemented.

Not complete:

- This does not activate runtime enforcement.
- This does not prove customer workflow coverage.
- This does not prove downstream verifier integration.
- This does not turn integration-required failure modes into dedicated guards.

Next required hardening: use this matrix to prioritize integration-required failure modes, especially agentic supply-chain compromise and indirect prompt-injection coverage.
