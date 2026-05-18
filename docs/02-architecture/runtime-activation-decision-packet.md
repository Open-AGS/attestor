# Runtime Activation Decision Packet

Status: R01 decision packet for turning the existing shadow runtime pipeline
from callable pure functions into an automatically triggered shadow-only
runtime path. This is not runtime code, not live enforcement, not production
readiness, and not customer deployment evidence.

## Decision

Use a hybrid event-driven plus reconcile-loop activation model:

```text
canonical shadow event
  -> append digest-only history row
  -> create one pending outbox work item
  -> worker claims item with lease
  -> runShadowRuntimePipelineDryRun(...)
  -> record trace / lineage / measurement artifacts in later R-steps
  -> mark work item published or failed
  -> reconcile loop retries expired or failed work
```

The model is intentionally at-least-once and idempotent. It does not claim
exactly-once delivery. The safe invariant is:

```text
same source event digest + same activation profile version
  -> same activation work key
  -> duplicate work is detected, not reinterpreted
```

The worker must keep the W05 runner shadow-only:

```text
canAdmit = false
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
learnsFromTraffic = false
rawPayloadRead = false
productionReady = false
```

## Why This Shape

The repository already has the core pieces:

- `src/consequence-admission/shadow-runtime-pipeline.ts` runs the envelope,
  signal, relationship, fusion, conflict, human-comprehension, and unsigned
  assurance-packet path as a pure dry-run.
- `src/consequence-admission/canonical-shadow-event-schema.ts` defines a
  CloudEvents-shaped, digest-only, no-raw-payload shadow event.
- `src/service/consequence-shared-history-outbox-store.ts` already contains a
  shared append-only history plus outbox primitive using per-tenant advisory
  locking and `FOR UPDATE SKIP LOCKED` worker claims.
- `src/consequence-admission/decision-trace-logger.ts`,
  `src/consequence-admission/decision-lineage-graph.ts`,
  `src/consequence-admission/assurance-measurement-plane.ts`, and
  `src/consequence-admission/outcome-feedback-coe-wiring.ts` already provide
  downstream artifact contracts, but they are not yet automatically wired to
  real shadow event activation.

So R01 does not introduce a new engine. It selects the activation semantics for
the one Attestor consequence engine.

## Repository Evidence

| Area | Evidence | Status |
|---|---|---|
| Shadow runner | `src/consequence-admission/shadow-runtime-pipeline.ts`; `tests/shadow-runtime-pipeline.test.ts` | repo-proven callable dry-run, not automatic trigger |
| Canonical event input | `src/consequence-admission/canonical-shadow-event-schema.ts` | repo-proven canonical input contract |
| Legacy shadow event recorder | `src/consequence-admission/shadow-events.ts` | repo-proven in-memory/reference recorder, not R01 activation source |
| Retry/idempotency precedent | `src/consequence-admission/retry-attempt-ledger.ts` | repo-proven duplicate-binding pattern |
| Shared outbox primitive | `src/service/consequence-shared-history-outbox-store.ts`; `tests/consequence-shared-history-outbox-store.test.ts` | partial-repo for activation; production runtime still false |
| Decision trace | `src/consequence-admission/decision-trace-logger.ts` | repo-proven digest-only trace contract, not audit writer |
| Decision lineage | `src/consequence-admission/decision-lineage-graph.ts` | repo-proven digest-bound DAG contract, read-only/no-authority |
| Measurement plane | `src/consequence-admission/assurance-measurement-plane.ts` | repo-proven read-only measurement contract |
| Outcome feedback | `src/consequence-admission/outcome-feedback-coe-wiring.ts` | repo-proven COE wiring contract, read-only/no-authority |
| Replay fixtures | `src/consequence-admission/failure-mode-replay-fixtures.ts` | repo-proven synthetic replay source |
| Redaction boundary | `docs/02-architecture/data-minimization-redaction-policy.md` | repo-proven allowed/forbidden surface boundary |

## Primary Source Anchors

Reviewed on 2026-05-18:

- [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
  for a small event envelope with stable identity, source, type, and extension
  attributes.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  and [W3C Trace Context](https://www.w3.org/TR/trace-context/) for
  trace-correlation without treating trace context as secret or authority.
- [Kubernetes controller concept](https://kubernetes.io/docs/concepts/architecture/controller/)
  for reconcile-loop activation: current state is observed, desired progress is
  attempted, and missed events are corrected by periodic reconciliation.
- [PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html)
  and [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
  for safe shared-worker claiming and per-tenant sequencing primitives.
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
  and [Stripe webhooks](https://docs.stripe.com/webhooks) for idempotent retry
  and duplicate-event tolerance.
- [Martin Fowler Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
  and [CQRS](https://martinfowler.com/bliki/CQRS.html) for separating append
  history from derived read-side processing.
- [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox)
  for writing state and message intent together before asynchronous delivery.
- [Lamport, Time, Clocks, and the Ordering of Events](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
  for the explicit decision that R01 needs per-tenant/source partial ordering,
  not a global total order.

These anchors guide runtime activation semantics. They do not prove production
readiness or correctness of future worker code.

## Activation Architecture

R01 chooses a hybrid controller/outbox path:

1. Intake accepts only `CanonicalShadowEvent` v1 material.
2. Intake appends a digest-only source-history row and creates exactly one
   pending outbox work item for that history row.
3. The work item key is deterministic:

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

4. A worker claims work with a lease and `SKIP LOCKED` semantics.
5. The worker runs `runShadowRuntimePipelineDryRun(...)`.
6. A later R-step attaches trace, lineage, measurement, and feedback artifacts.
7. Reconcile scans pending, failed, and expired claimed work items.

The trigger model is:

```text
event-driven trigger for normal latency
reconcile loop for recovery and missed notifications
idempotency key for duplicate tolerance
per-tenant/source partial order for operational boundedness
```

## Scheduling Semantics

| Question | R01 decision |
|---|---|
| Delivery | At-least-once. Exactly-once is not claimed. |
| Duplicate handling | Required by activation work key digest and source-history uniqueness. |
| Ordering | Per tenant/source partition ordering only. No global total order. |
| Retry | Lease expiry and failed/pending reconcile path. |
| Clock authority | Timestamps are evidence, not ordering proof. Digest and sequence are primary. |
| Failure posture | Fail-visible and retryable; no silent drop. |
| Authority posture | Worker output remains shadow-only/no-authority. |

If ordering across independent tenants or unrelated source partitions is needed,
it must be a separate future claim with explicit evidence. R01 rejects global
ordering as unnecessary and unsafe to overclaim.

## Observability Boundary

Allowed to store or emit:

- schema versions
- component versions
- event and artifact digests
- tenant scope digest
- envelope digest
- activation work key digest
- trace id / span id / correlation id
- status, phase, timestamps, counts, and reason codes
- no-go and degradation flags
- synthetic fixture ids

Forbidden to store or emit:

- raw prompt
- raw model output
- raw provider body
- raw tool payload
- raw customer identifier
- raw tenant identifier
- raw payment or wallet material
- raw idempotency key
- raw downstream response body
- private policy threshold
- credential or secret

Measurement and observability cannot become authority. Metrics may drive
operator dashboards, regression prioritization, and budget planning only. They
must not tune enforcement, relax policy, mutate calibration, train models, or
activate production paths.

## R-Series Plan

R01 defines the next runtime activation series. Current progress after R05:
5/8 complete, 3 steps remain.

| Step | Status | Slice | Output |
|---|---|---|---|
| R01 | complete | Runtime Activation Decision Packet | This document and targeted test |
| R02 | complete | Shadow Activation Profile Contract | `src/consequence-admission/shadow-activation-profile-contract.ts`; activation profile version, trigger mode, idempotency binding, no-authority flags |
| R03 | complete | Shadow Outbox Work Item Contract | `src/consequence-admission/shadow-outbox-work-item-contract.ts`; pending digest-only work item over R02 activation profile, source-history binding, stable dedupe key, null claim fields, no-authority flags |
| R04 | complete | Dispatcher / Reconcile Claim Contract | `src/consequence-admission/shadow-dispatch-claim-contract.ts`; time-bounded lease, `FOR UPDATE SKIP LOCKED` semantics, tenant/source partition advisory-lock scope, bounded attempt increment, digest-only claim token, no runner invocation |
| R05 | complete | Shadow Runtime Activation Runner | `src/consequence-admission/shadow-runtime-activation-runner.ts`; validates an R04 claim against a canonical event and calls W05 dry-run, still shadow-only |
| R06 | planned | Trace / Lineage / Measurement Hooks | Connects W06/I11/I10 without audit write or authority |
| R07 | planned | Outcome Feedback Hook | Connects I13 feedback material as read-only post-outcome input |
| R08 | planned | End-to-End Fixture Replay Smoke | Synthetic fixture replay through R02-R07, no live target system |

R06-R08 remain implementation steps after R05. R01 is only the architectural
decision; R02-R04 are small implementation contracts; R05 is the first
shadow-only runner invocation over claimed work.

## No-Claims

R01 does not claim:

- live enforcement
- production worker readiness
- customer deployment readiness
- exactly-once delivery
- global total ordering
- audit-plane write integration
- external event bus delivery
- Debezium, Temporal, AWS Lambda, or Kubernetes dependency
- learned invariant activation
- policy activation
- signed packet issuance
- raw event storage
- compliance certification

The next safe step is R06: Trace / Lineage / Measurement Hooks that bind the
R05 activation result to W06/I10/I11 material without audit-plane write
authority, enforcement activation, or production readiness claims.
