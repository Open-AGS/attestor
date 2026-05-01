# Downstream Enforcement Contract

Attestor is only a gateway if the downstream system refuses to act without an admissible Attestor decision.

The downstream enforcement contract is the shared rule for that refusal. It tells a customer-owned enforcement point what it must bind before a consequence can proceed.

```text
Attestor admission
  -> downstream enforcement contract
  -> binding checks
  -> allow or hold
  -> downstream system acts only on allow
```

This contract is deliberately stricter than a recommendation. A customer integration should not treat Attestor as advisory text beside the real workflow. The enforcement point must fail closed when the admission is missing, stale, out of scope, weakly bound, or not executable.

## What Must Bind

A downstream enforcement point should bind the proposed consequence to:

- the Attestor admission id and digest
- the executable decision, limited to `admit` or `narrow`
- the consequence domain and consequence kind
- the accepted risk class
- the downstream system that is about to act
- the policy reference when the contract scopes one
- proof references when the consequence is executable
- an idempotency or replay key when the boundary can execute more than once
- explicit constraint acknowledgement when the decision is `narrow`

If any required binding is absent or mismatched, the contract returns `hold`.

## Contract Shape

The package surface is exported through `attestor/consequence-admission`.

The core objects are:

- `createConsequenceAdmissionDownstreamContract(...)`
- `evaluateConsequenceAdmissionDownstreamContract(...)`
- `consequenceAdmissionDownstreamContractDescriptor()`

The contract is not a wallet, payment rail, database permission system, or deployment tool. It is the shape a downstream enforcement point uses before it lets those systems act.

For the small customer-side `verify` / `assert` wrapper around this contract, see [Verifier helper](verifier-helper.md).

## Boundary Kinds

The current contract vocabulary covers:

- `http-handler`
- `message-consumer`
- `record-writer`
- `communication-sender`
- `action-dispatcher`
- `wallet-adapter`
- `payment-adapter`
- `artifact-exporter`
- `custom`

These are customer-side enforcement positions, not separate Attestor products.

## Example: Payment Adapter

An AI-assisted workflow proposes a supplier payment. Attestor may return `admit`, but the payment adapter should still check the downstream contract:

```text
contract domain: money-movement
boundary: payment-adapter
accepted kind: action or agent-payment
accepted downstream system: supplier-payment-service
required: proof, idempotency key, policy ref
```

The payment adapter only proceeds if the admission is allowed, not fail-closed, executable, in scope for money movement, bound to the payment service, carrying proof, and presented with an idempotency key.

If the AI repeats the same request or changes the target service, the contract holds.

## Example: Narrowed Refund

An AI-assisted support flow proposes a refund. Attestor returns `narrow` with a constraint:

```text
refund may proceed only up to 250 EUR
```

The refund service must acknowledge that exact constraint before it runs. Without acknowledgement, the downstream contract returns `hold` even though the decision is not `block`.

This is the practical difference between "allowed somehow" and "allowed only in the bounded form Attestor admitted."

## Example: Wallet Adapter

A crypto workflow prepares a wallet RPC call, Safe transaction, ERC-4337 user operation, custody callback, or solver handoff.

The wallet adapter should check:

- consequence domain is `programmable-money`
- consequence kind is one of the accepted wallet or programmable-money kinds
- the contract points to the expected wallet, custody, bundler, or solver surface
- proof exists
- idempotency or replay binding exists
- policy scope matches

The wallet still owns signing and execution. Attestor does not become custody. The contract decides whether the wallet adapter should even present the proposed consequence to the execution layer.

## Failure Reasons

The evaluator returns explicit failure reasons:

- `admission-not-allowed`
- `admission-fail-closed`
- `decision-not-executable`
- `proof-missing`
- `required-check-failed`
- `consequence-domain-mismatch`
- `consequence-kind-mismatch`
- `risk-class-mismatch`
- `downstream-system-mismatch`
- `policy-ref-mismatch`
- `idempotency-key-missing`
- `narrow-constraints-unacknowledged`
- `custom-domain-unscoped`

The point is not to produce a friendly explanation. The point is to let the downstream system refuse a consequence for a precise, inspectable reason.

## Relationship To Release Enforcement

The release-enforcement plane remains the deeper verification layer for signed release tokens, online introspection, sender-constrained presentations, middleware, gateway adapters, telemetry, and conformance fixtures.

The downstream enforcement contract sits one level above that:

- consequence admission answers whether a proposed AI consequence is admitted, narrowed, reviewed, or blocked
- the downstream enforcement contract checks whether this customer enforcement point may act on that admission
- the release-enforcement plane verifies stronger release-token and presentation material where available

For production money, crypto, data export, admin, and operations flows, the contract should be treated as mandatory customer-side integration logic, not optional display metadata.
