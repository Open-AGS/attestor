# Approval Provenance Guard

This document describes `attestor.consequence-approval-provenance-guard.v1`.

The guard turns the failure mode `fake-approval-laundering` into a deterministic approval-provenance contract.

It is not a certification, not a complete customer approval integration, and not a claim of production readiness. It does not prove every customer IdP, approval workflow, reviewer queue, or downstream verifier has integrated the guard.

## Why It Exists

AI workflows often see text that looks like approval:

- a Slack or Teams message saying "approved"
- a customer email claiming a manager authorized a refund
- a ticket comment pasted from somewhere else
- an LLM summary that infers approval
- a tool result that repeats an approval-like phrase

Those are not approvals. They are content.

Approval must come from a verified reviewer, workflow, authority source, or signed approval artifact with digest-bound provenance.

## Contract

Source file:

```text
src/consequence-admission/approval-provenance-guard.ts
```

Test command:

```bash
npm run test:approval-provenance-guard
```

The guard evaluates:

- approval source kind
- trust class
- approval state
- reviewer identity
- reviewer authority digest
- approval digest
- scope digest
- issued timestamp
- optional expiry
- required approval count
- step-up requirement

Raw approval text, raw reviewer identity, and raw source references are not stored in the decision output.

## Decisions

The guard returns one of:

- `pass`: enough distinct verified approvals have complete provenance
- `review`: approval provenance is incomplete, pending, expired, mixed with fake approval, or count is insufficient
- `block`: approval comes from untrusted content, model-generated text, unverified tool output, rejected/revoked state, or duplicate reviewer reuse for dual approval

Only `pass` is `allowed=true`. `review` and `block` are fail-closed.

## Trusted Approval Sources

Trusted approval can come from:

- approval workflow
- reviewer queue
- manual review
- signed approval
- identity provider directory
- policy control plane

Each passing approval must bind:

- reviewer identity
- reviewer authority
- approval digest
- action scope
- issue time

## Untrusted Approval Sources

These cannot approve action:

- chat message
- customer email
- ticket comment
- user prompt
- external document
- tool output
- LLM summary

If one of these sources says "approved", the guard returns `block` unless the action also has separate verified approval. Mixed verified and fake approval returns `review`.

## Binding

The guard reuses the Control Binding Contract for:

```text
failureModeId: fake-approval-laundering
invariants:
- verified-approval-provenance-required
- untrusted-content-cannot-authorize-action
- human-review-packet-must-highlight-risk
```

Required controls, evidence, authority, and audit records come from:

```text
src/consequence-admission/failure-mode-control-bindings.ts
```

## Limitations

This is a central guard contract, not full customer workflow coverage.

Remaining work:

- customer IdP and approval workflow integrations must emit provenance metadata
- admission routes must consume the guard where approval evidence is accepted
- review surfaces must highlight fake approval attempts
- downstream verifier helpers must reject review/block outcomes
- stale approval and stale policy handling are deepened in the next list step
- README positioning is handled in the final docs alignment step
