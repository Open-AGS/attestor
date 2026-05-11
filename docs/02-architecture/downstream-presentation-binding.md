# Downstream Presentation Binding

An admission is not enough by itself. The downstream enforcement point also needs to know how the admission was presented at the moment a real system was about to act.

The presentation binding is that short-lived handoff record.

```text
Attestor admission
  -> downstream contract
  -> presentation binding
  -> target/method/body/replay/freshness checks
  -> allow or hold
```

It answers a narrower question than the admission:

```text
Is this exact allowed consequence being presented to this exact enforcement point,
for this exact target, with this body, in this time window, and with a replay key
that has not already been consumed?
```

If the answer is not closed, the consequence is held.

## What It Binds

A downstream presentation binding carries:

- admission id and digest
- downstream contract id
- enforcement point id
- downstream system
- policy ref
- consequence kind
- target URI or target ref
- method when the surface has a method
- body digest when the surface has an executable body
- replay key or idempotency key
- optional nonce
- presentation freshness window
- proof reference ids
- acknowledged constraint ids for `narrow` decisions

The point is not to create another proof format for its own sake. The point is to prevent an admitted decision from being copied into a different target, body, enforcement point, or replay attempt.

Executable body material must be supplied as a digest reference such as `sha256:...`. If raw request body material is placed in `bodyDigest`, binding creation rejects it, and presentation evaluation holds fail-closed rather than treating raw material as proof.

## Replay Observation Boundary

The binding object carries the short-lived replay key that the customer-owned enforcement point is about to consume. Decision and proof surfaces should not echo raw replay keys back out.

Replay reuse checks support `usedReplayKeyDigests`, where each observed replay key is supplied as `sha256:...`. Digest observations are the preferred replay interface for adapters, receipts, tests, and operator surfaces. The older `usedReplayKeys` expectation remains compatible for local callers that still hold raw runtime material, but it should not be used for exported proof, telemetry, dashboard, or review surfaces.

The runtime binding still carries the target, enforcement point, downstream system, policy ref, replay key, and nonce so the customer enforcement point can compare and consume them. The canonical payload binds targets, enforcement points, downstream systems, policy refs, replay keys, and nonces by digest, so the stable `bindingId`, `digest`, and `canonical` fields do not retain those raw runtime values.

## Constraint Acknowledgement Boundary

`narrow` acknowledgement uses raw constraint ids only as local runtime input. The presentation binding keeps `acceptedConstraintIds` for the enforcement point comparison, but the canonical payload uses `acceptedConstraintIdDigests`.

This keeps stable proof material from retaining private constraint names or policy-control details. The nested downstream decision also returns digest-only `constraintRefs`, not raw constraint summaries.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceAdmissionPresentationBinding(...)`
- `evaluateConsequenceAdmissionPresentationBinding(...)`
- `consequenceAdmissionPresentationBindingDescriptor()`

This model does not perform cryptographic sender-constrained token verification. That remains the release-enforcement plane's job. This model defines the plain, typed contract that customer adapters can verify before entering the stronger token, DPoP, HTTP message signature, online introspection, or gateway verification path.

## Example: Payment Adapter

An AI-assisted workflow proposes a supplier payment. Attestor returns `admit`, and the downstream contract accepts only the supplier payment service.

The payment adapter presents:

```text
target: POST https://payments.example.internal/supplier-payments
body digest: sha256:...
replay key: payment:tenant_a:invoice_1938:attempt_1
expires: 60 seconds from presentation
```

If the same admission is replayed to a different route, with a different body digest, after expiry, or with a consumed replay key, the presentation binding returns `hold`.

That is the difference between "Attestor once allowed something" and "this exact consequence is allowed here, now."

## Example: Wallet Adapter

A crypto adapter prepares a Safe transaction, wallet RPC call, ERC-4337 user operation, custody callback, or solver handoff.

The presentation should bind:

- wallet, Safe, bundler, custody provider, or solver target
- chain-specific target ref when applicable
- transaction or user-operation digest
- replay key or nonce
- proof reference ids
- acknowledged `narrow` constraints

The wallet still owns signing and execution. The presentation binding only decides whether this admission may be presented to that wallet-side enforcement point.

## Example: Data Export

An AI-assisted analyst proposes an export. The admission may allow a bounded export, but the presentation should bind the target export job and body digest:

```text
target ref: export-job:tenant_a:quarterly-risk-pack
body digest: sha256:...
replay key: export:quarterly-risk-pack:2026-q1
```

If the body changes from aggregated risk metrics to raw customer rows, the body digest no longer matches and the export is held.

## Failure Reasons

The evaluator returns explicit failure reasons:

- `admission-id-mismatch`
- `admission-digest-mismatch`
- `contract-id-mismatch`
- `enforcement-point-mismatch`
- `downstream-system-mismatch`
- `policy-ref-mismatch`
- `consequence-kind-mismatch`
- `target-uri-mismatch`
- `target-ref-mismatch`
- `method-mismatch`
- `body-digest-invalid`
- `body-digest-mismatch`
- `body-digest-missing`
- `replay-key-missing`
- `replay-key-reused`
- `nonce-missing`
- `nonce-mismatch`
- `presentation-not-yet-valid`
- `presentation-expired`
- `freshness-window-too-long`
- `proof-ref-missing`
- `constraint-acknowledgement-missing`
- `downstream-contract-held`

For single-use replay consumption, see [Presentation replay ledger](presentation-replay-ledger.md). The included ledger is an in-memory reference implementation with redacted entries; production systems should back the same contract with a shared atomic store at the enforcement boundary.

## Relationship To The Other Layers

- [Consequence taxonomy](consequence-taxonomy.md) names what kind of consequence is being controlled.
- [Downstream enforcement contract](downstream-enforcement-contract.md) defines which customer enforcement point may act.
- [Policy limit model](policy-limit-model.md) defines the bounds of the allowed consequence.
- Presentation binding checks whether the allowed consequence is being shown to the enforcement point in the exact bounded form.
- [Presentation replay ledger](presentation-replay-ledger.md) consumes the presentation replay key once and keeps redacted evidence of that consumption.
- The release-enforcement plane performs the deeper cryptographic verification path where signed release tokens and sender-constrained presentations are available.
