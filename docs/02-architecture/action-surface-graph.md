# Action Surface Graph

Status: repository-side Step 15 contract for the unified Shadow-to-Policy plan.
This is not enforcement readiness, not a native connector claim, not a
production event store, and not automatic policy activation.

## Decision

The action surface graph is the first structure built from canonical shadow
events. It answers:

```text
which tenant-bound AI action surfaces exist
which systems, tools, resources, actors, and consequence classes they touch
which route evidence is present
which route evidence is missing
what the next safest onboarding step is
```

The graph is deliberately earlier than policy generation:

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate
  -> replay / review / approval
```

Observation alone never means a route can enforce. The graph only makes the
action topology and route coverage visible so later steps can ask narrow human
questions and generate policy candidates against known evidence.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/action-surface-graph.ts`.

The graph is tenant-bound:

```text
tenantRefDigest
  -> action surface
  -> actors / producer / source kind
  -> target system / action kind / consequence class
  -> resource / target account / data class / authority delta
  -> evidence / policy / approval / receipt / simulation refs
```

Every input event must share one `tenantRefDigest`. Mixed-tenant input fails
closed. Empty input must provide an explicit tenant digest or it also fails
closed.

## Node Model

Node kinds:

```text
tenant
actor
producer
source-kind
target-system
action-surface
action-kind
consequence-class
resource
target-account
data-class
authority
evidence
policy
approval
receipt
simulation
```

Digest-backed nodes keep raw tenant ids, actor ids, customer ids, wallet
material, evidence ids, policy ids, approval ids, receipt ids, trace ids, and
replay ids out of the graph. Human-readable labels are limited to structural
surface names such as target system, action name, source kind, or consequence
class.

## Edge Model

Edge kinds:

```text
tenant-owns-surface
actor-invoked-surface
producer-emitted-surface
surface-observed-from-source-kind
surface-targets-system
surface-has-action-kind
surface-has-consequence-class
surface-touches-resource
surface-uses-target-account
surface-carries-data-class
surface-has-authority-delta
surface-has-evidence
surface-has-policy
surface-has-approval
surface-has-receipt
surface-has-simulation
```

Edges carry event counts and event digests. They do not carry raw payloads or
downstream response bodies.

## Route Coverage

Each action surface records route coverage:

```text
canonicalEventCount
admissionShadowEventCount
targetSystemShadowEventCount
integrationDeclarationEventCount
cryptoExecutionAdmissionEventCount
manualImportEventCount
policyRefCount
evidenceRefCount
approvalRefCount
receiptRefCount
simulationRefCount
replayRefCount
traceRefCount
resourceRefCount
targetAccountRefCount
authorityDeltaCount
observedConsequenceClassCount
inferredConsequenceClassCount
```

Coverage status is descriptive:

```text
declared-only
shadow-observed
policy-and-evidence-linked
approval-linked
receipt-linked
manual-review-required
```

These states are not enforcement states. Even `receipt-linked` only means the
graph has a receipt reference for review. It does not prove customer deployment,
non-bypassability, or downstream correctness.

## Gap Reasons

The graph can report:

```text
missing-shadow-observation
missing-integration-declaration
missing-target-system-shadow
missing-policy-ref
missing-evidence-ref
missing-approval-ref
missing-receipt-ref
missing-resource-ref
inferred-consequence-class-only
manual-import-only
```

These are onboarding and review gaps, not proof that the route is broken. A
gap becomes a blocker only when a later evidence, replay, approval, or
production packet marks it as required for that rollout scope.

## Next Steps

The graph emits one conservative next step per surface:

```text
add-shadow-capture
add-integration-declaration
bind-policy
bind-evidence
bind-resource
route-for-review
collect-receipt
review-route-coverage
```

This is how the future user experience stays small: the customer sees a graph
of actual action surfaces plus a short list of missing route links, not a raw
log stream or a blank policy editor.

## Relationship To Existing Surfaces

The existing [Action Surface Profiler](action-surface-profiler.md) groups
shadow events and declared API/tool/workflow metadata into onboarding profiles.
The graph is the canonical-event-native layer that sits after the Step 14
schema and before the [Evidence State Model](evidence-state-model.md):

```text
OpenAPI / AsyncAPI / MCP / workflow declarations
  -> manifest intake / declaration ingestors
  -> canonical shadow event projection
  -> action surface graph
  -> evidence state model
  -> policy candidate
```

The graph complements the profiler rather than replacing it. The profiler is
the operator-friendly inventory; the graph is the stable machine contract that
later evidence-state, policy-candidate, replay, and review-by-exception work
can consume.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0.html) and
  [OpenAPI API endpoints guide](https://learn.openapis.org/specification/paths.html)
  anchor API action surfaces through paths, operations, methods, tags, and
  operation identifiers.
- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.1.0)
  anchors event-driven surfaces through channels, operations, messages,
  correlation ids, and protocol bindings.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
  anchors model-invokable tool surfaces through `tools/list`, tool names,
  input schemas, output schemas, and `tools/call`.
- [CloudEvents specification](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md)
  anchors source, id, subject, and producer-style event context.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  anchors observed timestamp, trace context, event name, and attributes.
- [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/) anchors graph-like
  provenance relationships across entities, activities, and agents.

These sources are engineering anchors only. They do not certify Attestor
interop, connector coverage, telemetry compliance, graph database operation,
customer deployment, or production readiness.

## Non-Claims

This graph does not claim:

- production event-store readiness
- graph database deployment
- native target-system connector coverage
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- compliance certification
- automatic policy activation
- completion of Step 23 Enterprise integration recipes

It is the tenant-bound action map consumed by the evidence-state, candidate,
replay, and review work.
