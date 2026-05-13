# Tool Result Poisoning Guard

This document describes `attestor.consequence-tool-result-poisoning-guard.v1`.

The guard turns the failure mode `tool-result-poisoning` into a deterministic evidence-quality contract.

It is not a certification, not a complete adapter integration, and not a claim of production readiness. It does not prove every tool adapter emits source, timestamp, integrity, and evidence class metadata.

## Why It Exists

Tool results can be useful evidence, but they are not automatically trustworthy.

A search result, email parser output, retrieved document, model summary, or custom tool response can contain attacker-controlled instructions, stale data, incomplete provenance, or a misleading policy claim. Treating that output as proof can turn prompt injection or poisoned retrieval into business action.

The guard keeps a hard distinction between:

- tool output as untrusted or review-only context
- tool output as allowed evidence with source, timestamp, integrity, and evidence class metadata
- authority or instruction claims, which require separate authority controls

## Contract

Source file:

```text
src/consequence-admission/tool-result-poisoning-guard.ts
```

Test command:

```bash
npm run test:tool-result-poisoning-guard
```

The guard evaluates:

- tool kind
- source trust class
- result use
- source reference
- source timestamp
- integrity digest
- evidence digest
- evidence class
- allowed evidence classes
- tool risk

Raw tool output and raw source references are not stored in the decision output. The guard emits digests and reason codes only.

## Decisions

The guard returns one of:

- `pass`: trusted source, source timestamp, integrity digest, evidence digest, and allowed evidence class are all present
- `review`: provenance, integrity, timestamp, or allowed evidence class is missing or mismatched
- `block`: untrusted or model-generated tool result is used as authority or instruction

Only `pass` is `allowed=true`. `review` and `block` are fail-closed.

## Trusted Evidence Requirements

For tool output to count as evidence, it needs:

- source binding
- source timestamp
- integrity digest
- evidence digest
- evidence class
- allowed evidence class match

Trusted source classes are:

- provider-authoritative
- system-authoritative
- signed-attestation

Untrusted or review-only classes are:

- untrusted-external
- model-generated
- customer-controlled

## Binding

The guard reuses the Control Binding Contract for:

```text
failureModeId: tool-result-poisoning
invariants:
- trusted-evidence-required
- untrusted-content-cannot-authorize-action
- decision-context-version-must-be-bound
```

Required controls, evidence, authority, and audit records come from:

```text
src/consequence-admission/failure-mode-control-bindings.ts
```

## Limitations

This is a central guard contract, not full adapter coverage.

Remaining work:

- individual tool adapters must emit source, timestamp, integrity, and evidence class metadata
- admission routes must consume the guard where tool-result evidence is accepted
- review surfaces must show poisoned or incomplete tool evidence clearly
- downstream verifier helpers must reject review/block outcomes
- README positioning is handled in the final docs alignment step
