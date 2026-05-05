# Agent Loop Abuse Guard

The agent loop abuse guard keeps a safe retry loop from becoming DoS or policy probing.

Safe feedback is useful because it lets an AI-assisted runtime correct a missing policy reference, evidence reference, or bounded field. The same feedback becomes dangerous if an agent can keep changing the request until the gate opens.

This guard sits above the retry attempt ledger:

```text
model-safe feedback
  -> retryAttempt binding
  -> agent loop abuse guard
  -> retry budget and ledger
  -> corrected admission evaluation
```

## What It Controls

The guard controls automatic retry behavior at the admission edge:

- retry attempts per previous admission
- retry/admission volume per actor, action, and downstream system
- non-model-retryable correction reasons
- distinct correction signatures for one held admission
- record capacity for the evaluation reference guard

If the answer cannot close, the guard fails closed. It returns a hold or throttle decision with a safe instruction for the caller to stop automatic retry and route the attempt to customer review or operator control.

## Why This Is Separate From Retry Budget

Retry budget answers:

```text
Is this retry attempt still inside the allowed correction count and window for the previous admission?
```

The agent loop abuse guard answers:

```text
Is the surrounding agent behavior starting to look like overload, replay, or policy probing?
```

Both are needed. A retry can be correctly bound and still be unsafe if the agent keeps varying correction reasons, burns through attempts, or floods the admission edge.

## Default Evaluation Policy

The in-memory reference guard uses conservative evaluation defaults:

- 300 second window
- 2 retry attempts per previous admission
- 120 admissions per actor/action/downstream window
- 2 distinct correction signatures per previous admission
- 1000 stored guard records

These are reference defaults, not a hosted pricing or production capacity claim. Customer-operated or hosted production deployments should back the same contract with shared edge, Redis, or control-plane storage so multiple service instances cannot reset the guard independently.

## Non-Retryable Reasons

The guard treats these correction reasons as not model-retryable:

- `policy-blocked`
- `feature-blocked`
- `feature-unsafe`
- `custom-domain-review-required`
- `adapter-readiness-missing`

Those reasons route to review or operator control. They should not become training material for an agent to keep trying variants.

## Redaction Boundary

Guard records contain:

- tenant id
- actor, action, and downstream system
- admission id and digest
- previous admission id
- retry attempt id
- attempt number
- correction signature digest
- decision and reason codes

Guard records do not store raw prompts, raw tool payloads, raw customer identifiers, raw retry payloads, raw idempotency keys, bank/payment data, wallet material, credentials, secrets, or downstream error bodies.

The correction signature is a digest over correction reason codes and correction fields. It is enough to spot variation/probing without disclosing the underlying business payload.

## Route Behavior

The generic hosted route can call the guard before accepting a retry admission:

```http
POST /api/v1/admissions
```

If the guard throttles, the route returns `429` with `Retry-After`.

If the guard holds because the retry is not model-retryable or looks like policy probing, the route returns a fail-closed problem response and does not record the request as an accepted shadow admission.

## Production Boundary

The included guard is an in-memory reference implementation for evaluation, local demos, and route-shape tests.

Production deployments should preserve the same semantics with a shared guard:

- tenant-bound keys
- actor/action/downstream windows
- previous-admission retry windows
- atomic counters or unique records
- no raw payload storage
- explicit `Retry-After` or review routing
- monitoring for repeated holds and throttles

The guard is not the customer authority path and does not authorize downstream execution. It only decides whether automatic retry is still allowed to continue.

## Relationship To Other Layers

- Admission feedback tells the agent what can be safely corrected.
- Retry attempt binding ties the correction to the held admission.
- Retry budget sets the count and time window for the correction.
- [Retry attempt ledger](retry-attempt-ledger.md) records the bound attempt idempotently.
- The agent loop abuse guard prevents the surrounding loop from turning into overload or policy probing.
- [Downstream presentation binding](downstream-presentation-binding.md), [presentation replay ledger](presentation-replay-ledger.md), and [downstream execution receipt](downstream-execution-receipt.md) protect the later execution edge.
