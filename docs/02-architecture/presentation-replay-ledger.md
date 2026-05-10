# Presentation Replay Ledger

A presentation binding says whether an allowed admission is being shown to the right enforcement point in the right shape.

The replay ledger answers the next question:

```text
Has this presentation replay key already been consumed?
```

If yes, the consequence is held. If the ledger cannot close the question, the customer edge should hold.

```text
Attestor admission
  -> downstream contract
  -> presentation binding
  -> replay ledger consumption
  -> downstream action
  -> downstream execution receipt
```

## Why It Exists

Replay is where an authorization gateway quietly becomes advisory if it is not strict.

An admitted supplier payment should not be reusable against the same adapter. A wallet handoff should not be presented twice because a retry path copied the same key. A data export should not run again because an async worker reprocessed the same message without checking consumption.

The ledger gives the customer-side enforcement point a small single-use replay consumption rule:

```text
allow only after the presentation binding allows and the replay key is consumed once
```

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceAdmissionPresentationReplayLedger(...)`
- `consequenceAdmissionPresentationReplayLedgerDescriptor()`

The included ledger is an in-memory reference implementation for evaluation, tests, local demos, and adapter shape. It is not a production shared store. Production deployments should back the same contract with a shared, atomic store at the enforcement boundary.

## Digest-Indexed Ledger Entries

The ledger normalizes the replay key only long enough to derive a digest, then indexes replay consumption by `replayKeyDigest`. The in-memory reference implementation does not retain raw replay keys as map keys or exported entries:

- replay key is stored as `replayKeyDigest`
- target is stored as `targetDigest`
- nonce is stored as `nonceDigest`
- body is never stored; only the already supplied body digest participates in the presentation binding

This keeps the replay proof useful without turning the ledger into a leak of payment routes, wallet details, customer data, nonce material, or downstream request bodies.

## Example: Supplier Payment

```text
presentation:
  target: POST https://payments.example.internal/supplier-payments
  body digest: sha256:...
  replay key: payment:tenant_a:invoice_1938:attempt_1
  expires: 60 seconds from presentation

first consume:
  consumed

second consume:
  held: replay-key-already-consumed
```

The downstream payment adapter should continue only after consumption succeeds. A passed presentation binding without replay consumption is not enough for money movement.

After the downstream action is attempted, record the observed result with [Downstream execution receipt](downstream-execution-receipt.md).

## Example: Wallet Handoff

A wallet adapter may bind a Safe transaction, wallet RPC request, ERC-4337 user operation, custody callback, or solver handoff to a replay key.

The replay ledger does not sign, custody, submit, or broadcast. It only protects the customer-side edge from presenting the same admitted consequence twice.

## Failure Reasons

The evaluator returns explicit replay-ledger failure reasons:

- `presentation-held`
- `replay-key-missing`
- `replay-key-already-consumed`
- `retention-window-invalid`

The presentation decision remains attached to the replay decision, so the caller can still see lower-level reasons such as `body-digest-mismatch`, `presentation-expired`, `nonce-mismatch`, or `downstream-contract-held`.

## Production Boundary

The in-memory ledger proves the contract shape. It does not claim distributed replay protection.

Production money, crypto, data export, admin, and operations flows should use a shared store with atomic consume semantics. The important rule is that replay consumption must happen at the same customer-owned enforcement boundary that is about to call the downstream system.

## Relationship To Other Layers

- [Downstream enforcement contract](downstream-enforcement-contract.md) decides whether this enforcement point may act.
- [Downstream presentation binding](downstream-presentation-binding.md) binds the allowed admission to target, body, nonce, proof, constraints, and freshness.
- The replay ledger consumes the presentation replay key once.
- [Downstream execution receipt](downstream-execution-receipt.md) records the observed result after replay consumption.
- The release-enforcement plane remains the deeper cryptographic path for signed release tokens, DPoP, HTTP message signatures, online introspection, and gateway verification.
