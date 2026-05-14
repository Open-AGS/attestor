# Untrusted Content Authority Guard

This document describes `attestor.consequence-untrusted-content-authority-guard.v1`.

The guard turns the invariant `untrusted-content-cannot-authorize-action` into a deterministic contract for the failure mode `untrusted-content-authorizes-action`.

It is not a certification, not a complete admission integration, and not a claim of production readiness. It does not prove every admission, review, or downstream surface has integrated the guard.

## Why It Exists

AI workflows often receive instructions, approvals, and explanations through untrusted channels: prompts, customer emails, external documents, web pages, ticket comments, tool output, retrieved content, and model summaries.

Those channels can explain context, but they cannot create business authority. A customer email saying "the manager approved this refund" is not approval. An LLM summary saying "policy allows this export" is not policy. Tool output is not authority unless a separate trusted source, integrity record, and allowed evidence class make it usable for the specific control.

## Contract

Source file:

```text
src/consequence-admission/untrusted-content-authority-guard.ts
```

Test command:

```bash
npm run test:untrusted-content-authority-guard
```

The guard classifies each source by:

- source kind
- claim kind
- trust class
- digest-only source reference
- optional evidence digest
- rejected trust-class override state
- trusted-authority evidence presence

Raw prompt, email, ticket, document, tool, or model-summary content is not stored in the decision output.

## Decisions

The guard returns one of:

- `pass`: a trusted authority source is present, and content is separated from authority
- `review`: authority is missing, trusted-authority evidence is missing, evidence exists without authority, a trust-class override was rejected, or trusted and untrusted authority claims are mixed
- `block`: untrusted content or model-generated text is the only authority source for authorization, approval, or policy

Only `pass` is `allowed=true`. `review` and `block` are fail-closed.

## Trusted Authority Sources

Trusted authority can come from:

- verified approval
- approval workflow
- customer policy
- identity provider directory
- authority record
- manual review

Trusted evidence can support a decision, but it is not the same as authority.
Trusted authority sources must carry an evidence digest. A source kind such as
`verified-approval` without digest-bound approval evidence is not enough for a
`pass`; it returns `review`.

## Untrusted Or Model-Generated Sources

These cannot authorize action:

- user prompt
- customer email
- external document
- web page
- chat message
- ticket comment
- tool output
- LLM summary
- retrieved content

If one of these sources claims authorization, approval, or policy authority, the guard returns `block` unless a trusted authority source is also present. Mixed trusted and untrusted authority claims return `review`.

Untrusted or model-generated source kinds cannot be promoted by a supplied
`trustClass`. For example, a `customer-email` source with
`trustClass: trusted-authority` is still treated as `untrusted-content`, records
`trust-class-override-rejected`, and cannot authorize action.

## Binding

The guard reuses the Control Binding Contract for:

```text
failureModeId: untrusted-content-authorizes-action
invariantId: untrusted-content-cannot-authorize-action
```

Required controls, evidence, authority, and audit records come from:

```text
src/consequence-admission/failure-mode-control-bindings.ts
```

## Limitations

This is a central guard contract, not full surface coverage.

Remaining work:

- admission routes must consume the guard where authority source data is available
- review surfaces must show content-as-authority risk clearly
- downstream verifier helpers must reject review/block outcomes
- tool result classification is handled in the later Tool Result Poisoning Guard step
- README positioning is handled in the final docs alignment step
