# Shadow Runtime Observability Hooks

Status: R06 complete. This is a shadow-only hook layer over R05 activation
results. It binds decision trace, runtime monitor, assurance case, lineage graph,
and optional measurement-plane material without writing the audit plane or
claiming external observability export.

## Decision

`attestor.shadow-runtime-observability-hooks.v1` takes an R05
`attestor.shadow-runtime-activation-runner.v1` result and creates:

- a W06 decision trace snapshot using `attestor.decision-trace-logger.v1`
- an I10 runtime monitor observation using
  `attestor.runtime-monitor-skeleton.v1`
- an assurance case value using `attestor.assurance-case.v1`
- an I11 lineage graph using `attestor.decision-lineage-graph.v1`
- an optional measurement-plane binding to
  `attestor.assurance-measurement-plane.v1`

The hook is deterministic and digest-only. Trace correlation and lineage
correlation are evidence references, not authority. Measurement is read-only
input when supplied; R06 does not compute outcome feedback and does not let
measurement mutate policy, calibration, scores, or enforcement.

## Source Anchors

- OpenTelemetry and W3C Trace Context: trace correlation links runtime
  observations but does not grant authority.
- OPA Decision Logs: decision inputs and outputs require explicit boundaries and
  redaction discipline.
- NASA Runtime Assurance: monitor output observes and constrains evidence, but
  the monitor is not the controller.
- ENTRUST / living assurance cases: runtime evidence can open evidence nodes or
  defeaters in a living case.
- W3C PROV lineage: evidence relationships are represented as digest-bound
  entity/activity style links.

## Invariants

The hook fails closed unless:

- the activation version is `attestor.shadow-runtime-activation-runner.v1`
- the activation pipeline digest matches the nested W05 pipeline digest
- the activation envelope reference matches the nested W05 projection
- the activation is shadow-only and no-authority
- the decision trace append records successfully
- the decision trace snapshot verifies
- the runtime monitor remains read-only and no-authority
- the lineage graph remains digest-only and no-authority
- any supplied measurement plane is read-only and no-authority

R06 records `traceSnapshotDigest`, `runtimeMonitorDigest`,
`assuranceCaseDigest`, `lineageGraphDigest`, and optional
`measurementPlaneDigest`. These are hooks for later replay and review, not
external telemetry publication.

## Non-Claims

R06 does not claim:

- not audit-plane write
- not external OTel export
- not external lineage export
- not measurement authority
- not outcome feedback hook
- not live enforcement
- not policy activation
- not production readiness
- not customer deployment readiness

## Next

R07 is now complete. R08 adds the end-to-end fixture replay smoke that exercises
the R02-R07 path with synthetic shadow traffic.
