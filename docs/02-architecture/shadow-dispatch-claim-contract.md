# Shadow Dispatch Claim Contract

Status: R04 implementation contract.
Version: `attestor.shadow-dispatch-claim-contract.v1`
Claim token version: `attestor.shadow-dispatch-claim-token.v1`

## Decision

R04 defines the digest-only claim and lease contract for an R03 pending work
item. It records the shape a dispatcher/reconcile loop must produce when it
claims a work item, without performing the database mutation or invoking the
shadow runtime runner.

```text
R03 pending work item
  -> workerRefDigest
  -> claim mode
  -> claimedAt evidence
  -> claim token digest
  -> time-bounded lease
```

This is the claim semantics contract, not the storage implementation. The
actual `FOR UPDATE SKIP LOCKED` mutation and lease release remain outside R04.

## Files

```text
src/consequence-admission/shadow-dispatch-claim-contract.ts
tests/shadow-dispatch-claim-contract.test.ts
docs/02-architecture/shadow-dispatch-claim-contract.md
```

Targeted test:

```bash
npm run test:shadow-dispatch-claim-contract
```

## Source Anchors

- PostgreSQL `SKIP LOCKED` for concurrent queue claiming without blocking other
  workers.
- PostgreSQL advisory lock for tenant-scoped transaction coordination.
- Kubernetes controller/reconcile loop for missed-event recovery.
- Transactional Outbox for separating recorded work from asynchronous dispatch.
- Stripe idempotency and webhook guidance for duplicate-tolerant processing.
- CloudEvents for common event shape.
- OpenTelemetry Logs and W3C Trace Context for correlation as evidence, not
  authority.
- Lamport partial ordering for local happened-before reasoning without claiming
  a global total order.

## Contract Shape

The claim record contains:

```text
claimStatus: claimed
claimLeaseSemantics: time-bounded-lease
rowLockSemantics: for-update-skip-locked
advisoryLockScope: tenant-source-partition
retrySemantics: bounded-attempt-increment
workerRefDigest
claimAttempt
claimedAt
claimExpiresAt
claimTokenDigest
claimLeaseDigest
workerBindingDigest
partitionClaimDigest
```

`claimAttempt` increments from the R03 work item attempt count. `claimExpiresAt`
is computed from `claimedAt + leaseSeconds`. The claim token digest is bound to:

```text
claimTokenVersion
outboxWorkItemDigest
activationWorkKeyDigest
workerRefDigest
claimAttempt
claimedAt
claimMode
```

## Invariants

- The input work item must be R03 `pending`.
- The input work item must not already contain a claim token or worker digest.
- Claiming cannot happen before `workItem.availableAt`.
- Attempts fail closed once `attemptCount >= maxAttempts`.
- Claim token, lease, worker, and partition bindings are digest-only.
- The contract records `for-update-skip-locked` and tenant/source partition
  advisory-lock scope, but does not run SQL.
- The contract records bounded retry semantics, but does not execute a worker.
- Timestamps are evidence, not ordering proof.
- Duplicate handling remains `activation-work-key-digest`.
- The record cannot admit, enforce, learn, publish, sign packets, or become
  production-ready.

## No-Claims

R04 stays a claim-record contract: not storage claim mutation,
not worker behavior, not runner invocation, not outbox write integration,
not audit-plane write integration, and not live enforcement. It also does not
claim exactly-once delivery, global total ordering, packet signing, production
readiness, or customer deployment readiness.

R05, R06, R07, and R08 are now complete. The R-series is complete at synthetic
fixture replay level.
