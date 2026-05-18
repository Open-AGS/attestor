# Runtime Monitor Skeleton

Status: initial I10 runtime-observation contract. This is not production
monitoring readiness, not a runtime enforcement monitor, not formal runtime
verification, and not an OpenTelemetry/SIEM conformance claim.

## Decision

`attestor.runtime-monitor-skeleton.v1` is a pure, deterministic, digest-only
bridge from runtime observation material into the I00 assurance case form.

It reads:

```text
W05 Shadow Runtime Pipeline result
W06 Decision Trace Snapshot
optional Assurance Measurement Plane result
```

It writes no audit record, mutates no policy, activates no enforcement, and
grants no authority. Its only output is an assurance-case update candidate:

```text
healthy runtime observation
  -> evidence node + create-node transition

invalid / stale / mismatched runtime evidence
  -> open undermining defeater

monitor or measurement degradation
  -> open undercutting defeater
```

This keeps Attestor as one consequence runtime. I10 does not introduce a second
monitoring product or an external observability platform dependency.

## Files

```text
src/consequence-admission/runtime-monitor-skeleton.ts
tests/runtime-monitor-skeleton.test.ts
docs/02-architecture/runtime-monitor-skeleton.md
```

Package script:

```text
npm run test:runtime-monitor-skeleton
```

## Research Anchors

- [NASA Runtime Assurance of Aeronautical Products](https://ntrs.nasa.gov/citations/20220015734) anchors the pattern of a runtime monitor observing a less-trusted system while staying simpler than the system under observation.
- [NASA Robust Software Engineering](https://www.nasa.gov/intelligent-systems-division/robust-software-engineering/) anchors runtime monitoring and analysis as a complementary project for fusion and analysis of live or simulation streams.
- [ENTRUST dynamic assurance cases](https://arxiv.org/abs/1703.06350) anchors the idea that runtime evidence can update an assurance case.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) anchors observed timestamp and trace-correlation fields for structured event observations.
- [Google SRE Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) anchors the rule that monitoring should stay simple, actionable, and separated from unrelated inspection complexity.
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) anchors detection/response/recovery as a lifecycle, not a one-shot signal.
- [OMG SACM 2.3](https://www.omg.org/spec/SACM) anchors auditable claims, arguments, and evidence as the exchange form.

These are engineering anchors only. They do not make this slice NASA RTA
conformant, OpenTelemetry conformant, NIST conformant, SACM conformant, or
production-ready.

## Contract

The primary builder is:

```text
createRuntimeMonitorSkeleton(input)
```

Required inputs:

```text
pipeline                    W05 ShadowRuntimePipelineResult
traceSnapshot               W06 DecisionTraceSnapshot
monitorId
observedAt
observerRefDigest
tenantRefDigest
scopeDigest
targetClaimNodeId
```

Optional input:

```text
measurementPlane            AssuranceMeasurementPlane
maxObservationAgeSeconds    default 3600
```

The record binds:

```text
pipelineDigest
envelopeRefDigest
packetDigest
traceSnapshotDigest
traceId
traceRootDigest
tracePipelineDigests
traceEnvelopeDigests
measurementPlaneDigest
measurementStatus
sourceObservedAt
observationAgeSeconds
```

## Findings

I10 makes runtime observation failures explicit:

```text
trace-verification-failed
trace-snapshot-empty
trace-pipeline-digest-mismatch
trace-envelope-digest-mismatch
stale-observation
clock-skew
measurement-plane-degraded
measurement-plane-no-data
raw-payload-requested
raw-trace-requested
audit-write-requested
policy-activation-requested
live-enforcement-requested
authority-action-requested
```

Boundary-request findings reject the monitor output. They do not create
evidence or defeat, because a boundary violation is not trusted observation
material.

## Outcomes

```text
runtime-monitor-evidence-ready
runtime-monitor-open-undermining-defeater
runtime-monitor-open-undercutting-defeater
runtime-monitor-rejected-boundary
```

Mapping:

```text
no findings
  -> runtime-monitor-evidence-ready

trace invalid, trace empty, digest mismatch, or stale observation
  -> runtime-monitor-open-undermining-defeater

clock skew, measurement-degraded, or measurement no-data
  -> runtime-monitor-open-undercutting-defeater

raw payload, raw trace, audit write, policy activation, live enforcement,
or authority action requested
  -> runtime-monitor-rejected-boundary
```

## Invariants

```text
digest-only
read-only
no raw payload
no raw trace
no audit write
no policy activation
no live enforcement
not runtime oracle
no learning
no training
no authority
```

The skeleton accepts only a `shadow-only` no-authority W05 pipeline and a
digest-only read-only W06 trace snapshot. If a measurement plane is provided,
it must also be read-only and no-authority.

## Non-Claims

```text
not-runtime-enforcement-monitor
not-audit-plane-writer
not-policy-activation
not-live-enforcement
not-production-monitoring-readiness
not-siem-or-otel-conformance
not-formal-runtime-verification
not-model-training
not-decision-authority
```

## Next Step

I11 should add the decision lineage graph. That graph will connect the signed
node and transition lineage across I00-I10 artifacts. I10 only emits digest-bound
runtime observation evidence or open defeaters; it does not build the lineage
graph itself.
