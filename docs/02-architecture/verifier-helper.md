# Verifier Helper

The verifier helper is the small customer-side wrapper around the downstream enforcement contract.

It is meant for the code path that is about to act:

```text
payment adapter
wallet adapter
record writer
message sender
action dispatcher
```

That code should not repeat the same contract checks by hand. It should call a verifier, receive `verified: true`, or hold fail-closed.

## What It Verifies

The helper verifies downstream contract binding:

- Attestor admission is allowed and not fail-closed
- decision is executable: `admit` or `narrow`
- consequence domain matches the contract
- consequence kind and risk class are accepted
- downstream system binding matches
- policy ref matches when scoped
- proof exists when required
- idempotency or replay key exists when required
- `narrow` constraints are explicitly acknowledged

It does not replace cryptographic release-token verification. Stronger token, signature, introspection, sender-constrained presentation, middleware, and gateway verification remains in the release-enforcement plane.

It also does not replace the final [Downstream presentation binding](downstream-presentation-binding.md). Use that when the adapter needs to bind the admitted consequence to an exact target, body digest, replay key, nonce, freshness window, proof refs, and acknowledged constraints at the customer edge.

## API

The helper is exported through `attestor/consequence-admission`:

- `createConsequenceAdmissionVerifier(...)`
- `verifyConsequenceAdmissionForDownstream(...)`
- `assertConsequenceAdmissionVerifiedForDownstream(...)`
- `ConsequenceAdmissionVerificationHeldError`

Use `verify...` when the caller wants a structured hold decision. Use `assert...` when the downstream operation must stop by throwing.

## Example

```ts
import {
  createConsequenceAdmissionVerifier,
} from 'attestor/consequence-admission';

const verifier = createConsequenceAdmissionVerifier({
  verifierRef: 'payment-adapter:supplier-payment-service',
  contract: {
    enforcementPointId: 'payment-adapter:supplier-payment-service',
    boundaryKind: 'payment-adapter',
    consequenceDomain: 'money-movement',
    downstreamSystems: ['supplier-payment-service'],
    acceptedConsequenceKinds: ['action', 'agent-payment'],
    acceptedRiskClasses: ['R3', 'R4'],
    policyRefs: ['policy:payments:v1'],
    environment: 'production',
  },
});

const verified = verifier.assert({
  admission,
  observation: {
    idempotencyKey: paymentRequest.idempotencyKey,
    downstreamSystem: 'supplier-payment-service',
  },
});

await supplierPaymentService.dispatch(paymentRequest, {
  attestorAdmissionId: verified.admissionId,
  attestorVerificationDigest: verified.receiptDigest,
});
```

If the admission is `review`, `block`, missing proof, bound to the wrong downstream system, missing an idempotency key, or carrying unacknowledged `narrow` constraints, `assert` throws `ConsequenceAdmissionVerificationHeldError`.

## Why This Helper Exists

The downstream enforcement contract is the explicit rule. The verifier helper is the ergonomic integration point.

Without a helper, every customer adapter would be tempted to implement a slightly different shortcut:

```text
if decision == "admit" then run
```

That is not enough. The useful check is:

```text
is this exact admitted consequence allowed to reach this exact downstream system now?
```

The helper keeps that question consistent across money, crypto, data export, admin, communication, filing, and operations integrations.
