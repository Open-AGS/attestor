# Shadow Runtime Activation Runner

Status: R05 complete. This is a runtime-wired, shadow-only activation runner
for claimed work. It is not worker behavior, not storage mutation, not live
enforcement, not policy activation, and not production readiness.

## Decision

`attestor.shadow-runtime-activation-runner.v1` validates an R04
`attestor.shadow-dispatch-claim-contract.v1` claim and its matching
`attestor.canonical-shadow-event.v1` event, then calls
`runShadowRuntimePipelineDryRun`.

The runner produces a deterministic `shadow-dry-run-complete` activation result
that binds:

- claim token digest
- claim lease digest
- source event digest
- tenant digest
- source partition digest
- source history digest
- activation work key digest
- outbox work item digest
- runner invocation digest
- W05 pipeline digest
- envelope reference digest
- unsigned assurance packet digest

This moves the R-series from "claimed work exists" to "claimed work can be
evaluated by the existing W05 shadow pipeline." It still does not execute a
worker loop, mutate an outbox row, release a lease, publish a result, write the
audit plane, or sign a packet.

## Source Anchors

The runner keeps the R01-R04 activation model and uses the following anchors:

- NASA Runtime Assurance / Simplex monitor pattern: the runtime monitor can
  evaluate and constrain behavior without becoming the advanced controller.
- Kubernetes controller and reconcile-loop pattern: a claimed unit of desired
  work can be reconciled independently from storage mutation.
- Transactional Outbox: the runner consumes a digest-bound work representation
  but does not itself claim persistence.
- PostgreSQL `SKIP LOCKED` / advisory-lock preconditions: the claim must already
  represent a bounded lease before the runner can execute.
- Stripe idempotency-key pattern: duplicate tolerance is bound to stable digests,
  not raw keys.
- CloudEvents common event-envelope pattern: the event stays canonical and
  source-bound.
- OpenTelemetry and W3C Trace Context: traces can correlate execution but cannot
  grant authority.
- OPA Decision Logs: decision observations must keep input/output boundaries and
  redaction explicit.

## Invariants

The runner fails closed unless:

- claim version is `attestor.shadow-dispatch-claim-contract.v1`
- claim token version is `attestor.shadow-dispatch-claim-token.v1`
- claim source work item version is
  `attestor.shadow-outbox-work-item-contract.v1`
- event version is `attestor.canonical-shadow-event.v1`
- event digest equals `claim.sourceEventDigest`
- event tenant digest equals `claim.tenantRefDigest`
- generated time is inside the claim lease window
- the nested W05 pipeline returns `shadow-only`
- the nested W05 pipeline projection still binds the same event and tenant
- all authority, raw payload, learning, cross-tenant, and production flags stay
  false

The output includes `runnerInvocationDigest` so later R06 trace, lineage, and
measurement hooks can reference this run without reading raw payload material or
claiming a storage write.

## Non-Claims

R05 does not claim:

- not worker behavior
- not claim storage mutation
- not outbox write integration
- not audit-plane write
- not live enforcement
- not policy activation
- not lease release
- not publish
- not packet signing
- not production readiness
- not exactly-once delivery
- not global total ordering
- not customer deployment readiness

## Next

R06 is Trace / Lineage / Measurement Hooks. It may read the R05 activation
result and bind it to W06/I10/I11 material, but must still avoid audit-plane
write authority, production readiness claims, and enforcement activation.
