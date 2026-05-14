# Failure Mode Guard Coverage

This document describes the machine-readable guard coverage matrix for Attestor failure modes.

It is not a certification, not an independent audit, not a production-readiness claim, and not proof that every customer workflow is covered. The matrix records what kind of repository-side coverage exists for each known AI-action failure mode.

## Contract

- Matrix file: `src/consequence-admission/failure-mode-guard-coverage.ts`
- Version: `attestor.consequence-failure-mode-guard-coverage.v1`
- Source registry: `attestor.consequence-failure-mode-registry.v1`
- Source binding contract: `attestor.consequence-failure-control-binding.v1`
- Source replay matrix: `attestor.consequence-failure-replay-fixtures.v1`
- Test command: `npm run test:failure-mode-guard-coverage`
- Runtime stance: no auto-enforce, no production-ready claim, no enforcement activation, no raw payload storage

Each entry includes:

- `failureModeId`
- coverage kind
- runtime claim
- whether a dedicated guard exists
- whether control binding and replay fixture are present
- whether guard activation readiness is required
- whether customer integration is still required
- primary implementation path
- code, test, and documentation evidence paths
- explicit `notProven` statements
- explicit limitation

## Coverage Kinds

- `dedicated-guard`: a named guard module renders a deterministic decision for the failure mode.
- `deterministic-contract`: a deterministic contract or ledger exists, but it is not a dedicated guard module.
- `replay-contract`: the failure mode is represented by synthetic replay fixtures and supporting contracts.
- `policy-foundry-contract`: Policy Foundry can detect or explain the gap, but production enforcement still requires integration.
- `integration-required`: repo evidence exists, but customer-specific integration is the main missing proof.

## Runtime Claims

- `renders-decision`: repository code can render a deterministic decision or ledger result for supplied metadata.
- `detects-gap`: repository code can identify missing evidence, missing authority, or missing readiness.
- `synthetic-replay`: repository fixtures describe an adversarial case but do not execute customer infrastructure.
- `requires-integration`: repository contracts exist, but customer-specific source systems or adapters must supply evidence.

## Why It Exists

The F3 cross-cutting audit identified that named failure modes can be over-read if the repo only says "registered" or "bound". This matrix makes the distinction explicit:

```text
registered failure mode
  !=
dedicated guard
  !=
production enforcement
```

This prevents vague claims such as "all failure modes are enforced" when the real state may be dedicated guard, deterministic contract, replay-only, Policy Foundry gap detection, or integration-required.

## Current Limitations

- The matrix does not activate enforcement.
- The matrix does not prove route, PEP, or downstream verifier integration.
- The matrix does not prove live customer workflow coverage.
- The matrix does not certify production readiness.
- Some failure modes intentionally remain `integration-required`, especially where customer source systems must provide evidence.
- `agentic-supply-chain-compromise` now has `dedicated-guard` coverage through `src/consequence-admission/agentic-supply-chain-guard.ts`, but third-party code behavior and live adapter execution are still not proven without customer runtime evidence.
