# Stale Authority Policy Guard

This document describes `attestor.consequence-stale-authority-policy-guard.v1`.

The guard turns the failure mode `stale-authority-or-policy` into a deterministic freshness and version-binding contract.

It is not a certification, not a complete customer policy-store integration, and not a claim of production readiness. It does not prove customer policy stores, IdP checks, approval workflows, or downstream verifiers are wired to the latest source-of-truth state.

## Why It Exists

AI workflows can reuse stale context:

- an approval issued before a policy update
- an approval used after its validity window
- an authority check older than the allowed freshness window
- an action evaluated against a superseded policy version
- a no-go or drift state explained away by natural language

Those states cannot authorize current business action.

## Contract

Source file:

```text
src/consequence-admission/stale-authority-policy-guard.ts
```

Test command:

```bash
npm run test:stale-authority-policy-guard
```

The guard evaluates:

- requested policy version
- current policy version
- optional policy digest and current policy digest
- policy update and supersession timestamps
- approval issue time and validity window
- authority freshness timestamp and optional expiry
- maximum allowed authority age
- drift state
- no-go reasons

Raw policy versions, policy digests, and no-go reason text are not stored in the decision output. The decision output stores digests and counts.

## Decisions

The guard returns one of:

- `pass`: policy is current, approval is valid, authority is fresh, and no drift/no-go state is active
- `review`: policy/current version evidence is missing, approval validity is incomplete, authority freshness is missing or too old, or drift requires review
- `block`: policy mismatches current policy, policy is superseded, approval expired, policy changed after approval, authority expired, drift is no-go, or no-go reasons are present

Only `pass` is `allowed=true`. `review` and `block` are fail-closed.

## Binding

The guard reuses the Control Binding Contract for:

```text
failureModeId: stale-authority-or-policy
invariants:
- decision-context-version-must-be-bound
- verified-approval-provenance-required
- no-go-hold-overrides-natural-language
```

Required controls, evidence, authority, and audit records come from:

```text
src/consequence-admission/failure-mode-control-bindings.ts
```

## Limitations

This is a central guard contract, not full source-of-truth wiring.

Remaining work:

- customer policy stores must provide current policy version and digest metadata
- IdP or authority services must provide freshness and expiry metadata
- approval workflows must emit issued-at and validity-window metadata
- admission routes must consume the guard where policy and authority evidence is accepted
- downstream verifier helpers must reject review/block outcomes
- no-go hold ledger tightening is handled in a later list step
- README positioning is handled in the final docs alignment step
