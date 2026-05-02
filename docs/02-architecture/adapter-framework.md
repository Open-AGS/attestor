# Adapter Framework

The adapter framework is the customer-side wrapper shape for protected tool calls, HTTP handlers, queue consumers, record writers, wallet adapters, payment adapters, and custom execution edges.

Its rule is simple:

```text
verify before execute
```

No Attestor verification, no downstream consequence.

## Why It Exists

Agent runtimes can route tools. MCP servers can expose tools. Workflow workers can consume messages. HTTP handlers can mutate state.

Those are useful only if the action edge is not advisory. A protected adapter makes the consequence boundary explicit:

```text
agent or worker proposes action
  -> Attestor admission exists
  -> downstream contract verifies the exact edge
  -> protected adapter executes only on allow
  -> raw input/result stays outside exported records
```

This keeps authorization out of prompt text and out of the model's discretion.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceAdmissionProtectedAdapter(...)`
- `consequenceAdmissionAdapterFrameworkDescriptor()`

Adapter kinds:

- `http-handler`
- `message-consumer`
- `tool-wrapper`
- `mcp-tool-wrapper`
- `record-writer`
- `communication-sender`
- `action-dispatcher`
- `payment-adapter`
- `wallet-adapter`
- `artifact-exporter`
- `custom`

## What It Does

A protected adapter receives:

- an Attestor admission
- a downstream observation such as downstream system, idempotency key, accepted constraints, and policy ref
- an optional input digest
- a private executor callback

It then:

1. verifies the admission with the downstream contract
2. holds fail-closed if verification does not allow
3. runs the executor only after verification succeeds
4. stores only result or error digests in the adapter decision

The framework does not expose the raw executor as part of the adapter object.

## Data Posture

Exported adapter decisions include:

- adapter id and kind
- invocation id
- admission id and digest through the verification object
- verification receipt digest
- result digest or error digest
- failure reasons
- final adapter receipt digest

They do not include:

- raw tool input
- raw downstream request body
- raw provider result
- raw provider error body
- raw idempotency key
- wallet keys, bank details, credentials, or secrets

## Failure Modes

The adapter framework has three outcomes:

- `executed`
- `held`
- `execution-failed`

`held` means the downstream contract did not allow execution, so the executor did not run.

`execution-failed` means the downstream executor threw after verification allowed the operation. The failure is recorded by digest, not by raw error body.

## Relationship To Other Layers

- [Downstream enforcement contract](downstream-enforcement-contract.md) defines what the edge must bind.
- [Verifier helper](verifier-helper.md) evaluates that contract.
- The adapter framework makes the helper operational by putting the verifier in front of the executor.
- [Downstream presentation binding](downstream-presentation-binding.md), [presentation replay ledger](presentation-replay-ledger.md), and [downstream execution receipt](downstream-execution-receipt.md) provide the deeper handoff and post-execution trail for production-grade customer edges.

The adapter framework is not a replacement for signed release-token verification, DPoP, HTTP message signatures, online introspection, or customer-operated enforcement infrastructure. It is the common wrapper shape that keeps AI tool execution from bypassing the consequence gateway.
