# Shadow Outbox Work Item Contract

Status: R03 implementation contract.
Version: `attestor.shadow-outbox-work-item-contract.v1`

## Decision

R03 defines the digest-only pending work item that sits between the R02 shadow
activation profile and the later dispatcher/worker steps. It is a pure,
deterministic value builder over:

```text
shadow activation profile
source history reference digest
requested/available scheduling evidence
optional source history sequence evidence
```

It does not write the outbox table, claim work, run the shadow runtime pipeline,
write the audit plane, sign packets, or grant authority.

## Files

```text
src/consequence-admission/shadow-outbox-work-item-contract.ts
tests/shadow-outbox-work-item-contract.test.ts
docs/02-architecture/shadow-outbox-work-item-contract.md
```

Targeted test:

```bash
npm run test:shadow-outbox-work-item-contract
```

## Source Anchors

- CloudEvents for a common event envelope and stable event identity.
- Transactional Outbox for recording pending work as data before asynchronous
  dispatch.
- Stripe idempotency and webhook guidance for retry-tolerant, duplicate-safe
  processing.
- PostgreSQL `SKIP LOCKED` and advisory locks as later R04 claim/lease anchors.
- Kubernetes controller/reconcile loop for eventual reconciliation after missed
  events.
- OpenTelemetry Logs and W3C Trace Context for correlation as evidence, not
  authority.
- Lamport partial ordering for the distinction between local order evidence and
  global total-order claims.

## Contract Shape

The work item records:

```text
eventType: attestor.shadow-runtime.activation.requested.v1
status: pending
sourceEventDigest
tenantRefDigest
sourcePartitionDigest
sourceHistoryRefDigest
activationProfileDigest
activationWorkKeyDigest
partitionKeyDigest
outboxPayloadDigest
outboxWorkItemDigest
dedupeKeyDigest
requestedAt
availableAt
attemptCount: 0
claimTokenDigest: null
claimWorkerDigest: null
```

The identity digest intentionally excludes scheduling evidence:

```text
outboxWorkItemDigest =
  sha256(version, eventType, sourceHistoryRefDigest,
         activationWorkKeyDigest, partitionKeyDigest)
```

The full work item digest includes timestamps and the complete pending value.
This keeps duplicate detection stable while still preserving scheduling evidence
for replay and review.

## Invariants

- The work item is always `pending`.
- Delivery is at-least-once; exactly-once delivery is not claimed.
- Ordering is scoped to tenant/source partition; global total ordering is not
  claimed.
- The ordering scope label is `tenant-source-partition`.
- Timestamps are evidence, not ordering proof.
- The clock boundary is stated as: timestamps are evidence, not ordering proof.
- Dedupe is bound to the R02 activation work key digest.
- Duplicate handling is `activation-work-key-digest`.
- Source history is referenced by digest only.
- Raw payloads and raw idempotency keys are never stored.
- Claim fields are null because claim/lease behavior is R04.
- Worker behavior is excluded because R05 only invokes the shadow dry-run
  runner; durable worker behavior remains outside this contract.
- Audit-plane write and packet signing are excluded.
- The value cannot admit, enforce, learn, or become production-ready.

## No-Claims

R03 does not claim:

- not claim behavior
- not worker behavior
- not outbox write integration
- audit-plane write integration
- not live enforcement
- exactly-once delivery
- global total ordering
- packet signing
- production readiness
- customer deployment readiness

R04, R05, R06, R07, and R08 are now complete. The R-series is complete at
synthetic fixture replay level.
