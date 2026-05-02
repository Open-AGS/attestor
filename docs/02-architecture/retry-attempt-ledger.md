# Retry Attempt Ledger

A retry attempt binding says a corrected AI action points back to a held admission.

The retry attempt ledger answers the next question:

```text
Has this bound retry attempt already been recorded, and is its idempotency key already tied to another attempt?
```

If the answer cannot close safely, the retry holds. A customer or operator can review it, but the model should not keep probing.

```text
held admission
  -> model-safe feedback
  -> bound retry attempt
  -> retry budget check
  -> retry attempt ledger
  -> corrected admission request
```

## Why It Exists

The safe retry loop is useful only if it stays bounded.

An agent that forgot evidence can send a corrected request. It should not be able to replay the same attempt until it gets a better answer, reuse an idempotency key for a different attempt, or hide exhausted retries as fresh requests.

The ledger makes the retry path explicit:

```text
same retry attempt -> same ledger record
conflicting idempotency key -> hold
budget-held retry -> recorded as review evidence, not allowed
```

This is the difference between correction and probing.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceAdmissionRetryAttemptLedger(...)`
- `consequenceAdmissionRetryAttemptLedgerDescriptor()`

The included ledger is an in-memory reference implementation for evaluation, tests, local demos, and agent-wrapper shape. It is not a production shared store. Production deployments should back the same contract with a shared atomic store at the admission edge.

## Redacted Records

The ledger records enough to audit the retry chain without storing raw retry payloads:

- previous admission ID and digest
- previous request ID
- retry attempt ID and digest
- attempt number and timestamp
- correction reason codes and correction fields
- retry budget digest, outcome, and reason codes
- idempotency key digest

The raw idempotency key is not exported. The retry request body, customer data, payment material, wallet material, credentials, and private policy internals are not stored in the ledger record.

## Example: Refund Correction

```text
first admission:
  review: evidence-ref-missing

retry attempt:
  previous admission digest: sha256:...
  correction reason: evidence-ref-missing
  idempotency key: retry:refund:customer_123:attempt_1

ledger record:
  retry attempt digest: sha256:...
  retry budget digest: sha256:...
  idempotency key digest: sha256:...
  retryAllowed: true
```

If the same retry attempt arrives again, the ledger returns the existing record instead of appending another one.

If another retry attempt reuses the same idempotency key digest for the same tenant and held admission, the ledger holds fail-closed with `idempotency-key-conflict`.

## Budget-Held Attempts

The ledger records attempts even when the retry budget says `hold-for-review`, as long as the retry attempt, previous admission, and budget material are internally consistent.

That gives operators evidence such as:

```text
attemptNumber: 3
retryBudgetOutcome: hold-for-review
retryBudgetReasonCodes:
  - retry-budget-exhausted
```

The record does not make the retry allowed. It preserves evidence that the retry happened and must be reviewed or controlled by an operator.

## Failure Reasons

The evaluator returns explicit retry-attempt-ledger failure reasons:

- `previous-admission-id-mismatch`
- `previous-admission-digest-mismatch`
- `previous-request-id-mismatch`
- `retry-budget-attempt-mismatch`
- `retry-budget-previous-admission-mismatch`
- `retry-budget-previous-digest-mismatch`
- `retry-budget-attempt-number-mismatch`
- `retry-attempt-conflict`
- `idempotency-key-conflict`
- `ledger-capacity-exhausted`

These are ledger failures. Lower-level retry-budget reason codes such as `retry-window-expired`, `retry-budget-exhausted`, or `retry-correction-reason-unbound` remain attached to the decision.

## Production Boundary

The in-memory ledger proves the contract shape. It does not claim distributed retry accounting.

Production money, data export, authority change, communication, operations, and programmable-money flows should use a shared store with atomic insert and unique constraints over:

- retry attempt ID
- tenant plus previous admission plus idempotency key digest

The important rule is that retry recording happens before a corrected request is treated as an eligible retry.

## Relationship To Other Layers

- Admission feedback tells the model what can be safely corrected.
- Retry attempt binding points the corrected request back to the held admission.
- Retry budget evaluation decides whether the attempt is inside the retry rules.
- The retry attempt ledger records the attempt idempotently and keeps duplicates from becoming fresh probes.
- [Downstream presentation binding](downstream-presentation-binding.md), [presentation replay ledger](presentation-replay-ledger.md), and [downstream execution receipt](downstream-execution-receipt.md) protect the later customer-side execution path after a new admission has been evaluated.
