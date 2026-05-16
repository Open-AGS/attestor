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
- `createConsequenceAdmissionRetryAttemptLedgerInMemoryStore(...)`
- `consequenceAdmissionRetryAttemptLedgerDescriptor()`
- `recordSharedConsequenceRetryAttemptIfAbsent(...)` from `src/service/consequence-shared-atomic-stores.ts`

The consequence-admission package ledger remains an in-memory reference implementation for evaluation, tests, local demos, and agent-wrapper shape. Step 08 adds the PostgreSQL-backed shared atomic store slice under the service layer. The descriptor exposes that shared store but keeps `productionSharedStoreRuntimeWired: false`, because default runtime cutover and deployment probes are still separate work.

The shared-store contract remains part of the package surface so older audit
validation can still distinguish the contract from runtime cutover.

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

## Shared-Store Contract

The store contract must atomically record a retry attempt only if both of these bindings are still unused:

- retry attempt ID
- tenant plus previous admission plus idempotency key digest

The core operation is:

```text
recordIfAbsent(record, idempotencyScope, maxRecords)
```

If the attempt already exists, the store returns the original record as `duplicate`. If another attempt already owns the same idempotency scope, the store returns `idempotency-key-conflict`. The Step 08 shared backend implements this with PostgreSQL `INSERT ... ON CONFLICT`, a tenant-scope digest, a unique `(tenant_scope_digest, retry_attempt_id)` index, and a partial unique `(tenant_scope_digest, idempotency_scope_digest)` index. It stores the retry record JSON with `rawPayloadStored=false`, but it does not store raw idempotency keys.

The default package store remains `in-memory-reference` and `productionReady: false`. Passing the same store instance to two ledgers still proves the synchronous contract shape in package tests. The service-layer shared store proves the durable atomic primitive with embedded PostgreSQL tests; it does not by itself cut over every runtime path.

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

The in-memory ledger proves the contract shape. The service-layer shared atomic store proves a PostgreSQL-backed record-if-absent primitive for this slice. Neither one claims a live deployed production profile by itself.

Production money, data export, authority change, communication, operations, and programmable-money flows should use a shared store with atomic insert and unique constraints over:

- retry attempt ID
- tenant plus previous admission plus idempotency key digest

The important rule is that retry recording happens before a corrected request is treated as an eligible retry.

Primary implementation anchors for the shared store are PostgreSQL `INSERT ... ON CONFLICT`, unique constraints, row-security policy shape, and transaction-scoped session settings. These are engineering anchors, not a compliance or production-readiness claim.

## Relationship To Other Layers

- Admission feedback tells the model what can be safely corrected.
- Retry attempt binding points the corrected request back to the held admission.
- Retry budget evaluation decides whether the attempt is inside the retry rules.
- The retry attempt ledger records the attempt idempotently and keeps duplicates from becoming fresh probes.
- [Downstream presentation binding](downstream-presentation-binding.md), [presentation replay ledger](presentation-replay-ledger.md), and [downstream execution receipt](downstream-execution-receipt.md) protect the later customer-side execution path after a new admission has been evaluated.
