# Failure Mode Replay Fixtures

This document describes the failure-mode replay fixture matrix.

It does not execute customer infrastructure, does not activate enforcement, does not certify production readiness, and does not prove customer workflow coverage. It is a synthetic adversarial scenario catalog tied to the failure mode registry and control binding contract.

## Contract

- Matrix file: `src/consequence-admission/failure-mode-replay-fixtures.ts`
- Version: `attestor.consequence-failure-replay-fixtures.v1`
- Source registry: `attestor.consequence-failure-mode-registry.v1`
- Source binding contract: `attestor.consequence-failure-control-binding.v1`
- Test command: `npm run test:failure-mode-replay-fixtures`
- Runtime stance: synthetic only, review material only, no auto-enforce, no production-ready claim, no raw payload storage

Placement is defined by [Replay layer placement](replay-layer-placement.md). Failure-mode replay fixtures are synthetic review material; they are not the same thing as presentation replay consumption or sandbox downstream replay.

Each fixture includes:

- `failureModeId`
- scenario
- risky input
- intended AI action
- hidden risk
- expected decision
- expected replay result
- missing evidence
- missing authority
- required scope limits
- required next step
- expected audit records
- catching components
- invariant ids
- control ids
- source refs

## Required Enterprise Cases

The first matrix gives every registered failure mode a replay target. It explicitly includes:

- `fake-approval-laundering`: fake manager approval in chat text
- `indirect-prompt-injection`: tool-returned document treated as instruction
- `no-go-hold-bypass`: refund attempted during fraud review
- `stale-authority-or-policy`: old approval after policy or fraud-state change
- `duplicate-execution-replay`: repeated payment or refund attempt
- `cross-tenant-leakage`: foreign tenant record in a summary or review packet
- `wrong-recipient-disclosure`: internal data sent to an external customer
- `scope-explosion`: single-record action expanded to batch action

## How It Is Used Now

This step creates stable replay targets for later execution/hardening steps.

Current use:

- keep failure mode, control binding, and replay language aligned
- give Policy Foundry a concrete way to explain which replay would fail
- give later executable replay runners stable fixture ids and expected outcomes
- prevent vague claims that a failure mode is covered without a scenario, evidence gap, authority gap, audit record, and expected decision

## Current Limitations

- Fixtures are synthetic scenario definitions, not executed tests against customer infrastructure.
- Passing or existing fixture definitions do not prove production readiness.
- Real customer rollout still requires downstream verifier evidence, shared replay/idempotency where applicable, source-specific evidence validators, customer approval, deployment smoke tests, and runtime readiness checks.
- README alignment remains a later step after the failure-mode registry, control bindings, and replay matrix are all in place.
