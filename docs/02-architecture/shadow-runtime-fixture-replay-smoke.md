# Shadow Runtime Fixture Replay Smoke

Status: R08 runtime activation slice. This is a synthetic fixture replay smoke,
not a production worker, not a target-system integration, and not live
enforcement.

## Decision

`attestor.shadow-runtime-fixture-replay-smoke.v1` exercises the completed
Runtime Activation Series path with one canonical shadow event:

```text
R02 -> R03 -> R04 -> R05 -> R06 -> R07
```

The smoke runner builds:

1. R02 shadow activation profile
2. R03 shadow outbox work item
3. R04 dispatch / reconcile claim
4. R05 shadow runtime activation
5. R06 observability hooks
6. R07 outcome feedback hook

It returns one digest-bound replay record with all phase digests. The replay is
deterministic: the caller supplies every timestamp, digest, fixture id, source
history sequence, worker digest, observer digest, and evaluator digest.

## Inputs

- canonical shadow event
- fixture id and fixture digest
- source partition digest
- trace context digest
- source history digest and sequence
- requested / claimed / generated / observed / feedback / evaluated timestamps
- worker, dispatcher, observer, evaluator, and scope digests
- optional digest-only outcome feedback events

If no outcome feedback event is supplied, the runner creates one synthetic
digest-only downstream receipt for the fixture. This is a smoke assertion only;
it is not customer outcome evidence.

## Outputs

- activation profile digest
- outbox work item digest
- dispatch claim digest
- activation runner digest
- shadow runtime pipeline digest
- envelope digest
- observability digest
- outcome feedback digest
- final assurance case digest
- final lineage graph digest

## Anchors

- FoundationDB deterministic simulation: replay is controlled by explicit input
  material, not ambient process state.
- CloudEvents: event identity and source metadata are explicit.
- OpenTelemetry: trace/log correlation is metadata, not authority.
- W3C PROV: lineage is a digest-bound provenance graph.
- Stripe idempotency: retry identity is explicit and replay-safe.

## Non-Claims

R08 does not claim:

- not production worker
- not target-system call
- not audit-plane write
- not external event bus delivery
- not external trace export
- not external lineage export
- not policy activation
- not learning activation
- not training activation
- not live enforcement
- not production readiness

## Result

The R-series is complete at repo-side runtime-smoke level: R02-R07 can be
exercised together with synthetic shadow traffic. Production worker activation,
shared-store persistence, audit-plane writes, external telemetry export, target
system integration, and live enforcement remain separate future claims.
