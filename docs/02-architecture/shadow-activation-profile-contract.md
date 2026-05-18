# Shadow Activation Profile Contract

Status: R02 runtime activation implementation contract.
Version: `attestor.shadow-activation-profile-contract.v1`

This document records the activation profile contract that turns the R01
decision packet into a deterministic value. It is not worker behavior, not
outbox write integration, not audit-plane write integration, not packet
signing, not live enforcement, and not production readiness.

## Decision

The profile binds one canonical shadow event to one activation work key:

```text
activationWorkKeyDigest =
  sha256({
    version: 'attestor.runtime-activation-work-key.v1',
    sourceEventDigest,
    tenantRefDigest,
    shadowRuntimePipelineVersion,
    activationProfileVersion
  })
```

This keeps the R01 invariant intact:

```text
same source event digest + same activation profile version
  -> same activation work key
  -> duplicate work is detected, not reinterpreted
```

The default trigger mode is `hybrid-event-reconcile`:

```text
event-driven trigger for normal latency
reconcile-loop trigger for recovery
activation-work-key-digest for duplicate tolerance
tenant-source-partition ordering for operational boundedness
timestamps are evidence, not ordering proof
```

## Contract Files

```text
src/consequence-admission/shadow-activation-profile-contract.ts
tests/shadow-activation-profile-contract.test.ts
docs/02-architecture/shadow-activation-profile-contract.md
```

Package script:

```bash
npm run test:shadow-activation-profile-contract
```

## Repository Boundary

The contract accepts digest-only references:

- source event digest
- tenant reference digest
- source partition digest
- optional trace context digest

It binds:

- `attestor.canonical-shadow-event.v1`
- CloudEvents `specversion` `1.0`
- `attestor.shadow-runtime-pipeline.v1`
- `attestor.runtime-activation-work-key.v1`

It records:

- trigger mode
- at-least-once delivery semantics
- activation work key digest
- partition binding digest
- idempotency binding digest
- bounded retry and lease parameters
- no-authority and no-production flags

## Source Anchors

Reviewed on 2026-05-18:

- [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
  anchors a small event envelope with stable identity and source metadata.
- [Kubernetes controller concept](https://kubernetes.io/docs/concepts/architecture/controller/)
  anchors reconcile-loop activation over observed state.
- [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox)
  anchors writing state and message intent before asynchronous delivery.
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
  anchors retry-safe idempotency keys. This is the Stripe idempotency anchor.
- [Stripe webhooks](https://docs.stripe.com/webhooks)
  anchors quick acknowledgement before later event processing.
- [PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html)
  anchors shared queue claiming. R02 records this as the PostgreSQL `SKIP LOCKED`
  queue-claim anchor.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
  anchors application-defined locking primitives.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  and [W3C Trace Context](https://www.w3.org/TR/trace-context/) anchor trace
  correlation without treating trace context as authority.
- [Lamport, Time, Clocks, and the Ordering of Events](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
  anchors the choice of partial ordering over global total ordering.

These are engineering anchors only. They do not prove production delivery,
correctness of future workers, or customer deployment readiness.

## Invariants

The contract is pure and deterministic:

- same input gives the same activation work key digest
- source event schema must be `attestor.canonical-shadow-event.v1`
- CloudEvents `specversion` must be `1.0`
- shadow runtime pipeline version must be `attestor.shadow-runtime-pipeline.v1`
- delivery semantics are `at-least-once`
- duplicate handling is `activation-work-key-digest`
- ordering scope is `tenant-source-partition`
- raw idempotency key is not stored
- raw payload is neither read nor stored
- timestamps are evidence, not ordering proof

The profile does not grant authority:

```text
canAdmit = false
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
learnsFromTraffic = false
productionReady = false
```

## Non-Claims

R02 does not claim:

- worker behavior
- outbox write integration
- dispatcher or reconcile claim behavior
- audit-plane write integration
- packet signing
- live enforcement
- exactly-once delivery
- not exactly-once delivery
- global total ordering
- not global total ordering
- external event bus delivery
- learned invariant activation
- policy activation
- raw event storage
- production readiness
- customer deployment readiness

R03 and R04 are now complete. The next safe step is R05: Shadow Runtime
Activation Runner.
