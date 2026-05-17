# Evidence State Model

Status: repository-side Step 16 contract for the unified Shadow-to-Policy plan.
This is not enforcement activation, not a production evidence store, not native
target-system integration proof, and not automatic policy activation.

## Decision

The evidence state model sits between the action graph and policy candidate
generation:

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR
  -> replay / review / approval
```

Its job is narrow: take the tenant-bound [Action Surface Graph](action-surface-graph.md)
and label every proof-relevant field with a machine-readable state. It does
not decide policy, generate a rule, or activate enforcement.

The next repository-side layer is the [Policy Candidate PR Contract](policy-candidate-pr-contract.md),
which consumes these states as review-only candidate diff input.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/evidence-state-model.ts`.

Version:

```text
attestor.evidence-state-model.v1
```

Allowed states:

```text
observed
inferred
missing
conflicting
stale
untrusted
approved
enforceable
```

The model is tenant-bound to the graph digest and tenant digest. A surface whose
tenant digest does not match the graph fails closed.

## State Meaning

| State | Meaning | Promotion posture |
|---|---|---|
| `observed` | The action graph has direct route coverage or digest refs for the field. | Usable as evidence input, but not approval. |
| `inferred` | The field is derived from other facts, not directly observed. | Blocks enforcement until confirmed or backed by stronger evidence. |
| `missing` | Required route coverage or reference is absent. | Blocks promotion for that field. |
| `conflicting` | Observed and inferred facts disagree, or an enforceability request conflicts with blockers. | Blocks promotion until resolved. |
| `stale` | The latest graph evidence is older than the configured freshness policy. | Blocks promotion until refreshed. |
| `untrusted` | The producer is outside the declared trusted producer set. | Blocks promotion until reviewed or replaced. |
| `approved` | Operator/customer input explicitly approved the surface or producer. | Can satisfy approval/trust gates, but still does not auto-enforce. |
| `enforceable` | The surface was explicitly marked enforceable and has no blocking state. | Eligible for later scoped rollout, still with `autoEnforce=false`. |

Blocking states are:

```text
inferred
missing
conflicting
stale
untrusted
```

`observed`, `approved`, and `enforceable` are not blockers by themselves.

## Field Matrix

Every surface receives one assignment for each field:

| Field | Primary input | Possible blocking states |
|---|---|---|
| `shadow-observation` | admission shadow, target-system shadow, or crypto execution-admission count | `missing` |
| `target-system-shadow` | target-system shadow or crypto execution-admission count | `missing` |
| `integration-declaration` | declaration count from manifests or integration metadata | `missing` |
| `policy-ref` | digest-only policy references | `missing` |
| `evidence-ref` | digest-only evidence references | `missing` |
| `approval-ref` | graph approval refs plus explicit approved surface ids | `missing` |
| `receipt-ref` | digest-only downstream receipt refs | `missing` |
| `resource-ref` | digest-only resource refs | `missing` |
| `consequence-class` | observed and inferred class counts from the graph | `inferred`, `missing`, `conflicting` |
| `producer-trust` | declared trusted producer set | `missing`, `untrusted` |
| `freshness` | surface `lastSeenAt` compared with `maxEvidenceAgeMs` | `missing`, `stale` |
| `enforceability` | explicit enforceable surface id plus no blockers | `missing`, `conflicting` |

This is the important product boundary: facts and inference are never flattened
into the same status. The UI and later candidate engine can show "we saw this",
"we inferred this", and "we need this" as different facts.

## Promotion Blockers

The model emits a `promotionBlockers[]` list per action surface. Each blocker
contains:

```text
field
state
reasonCodes[]
nextStep
```

Examples:

```text
missing shadow observation -> add-shadow-capture
missing evidence ref       -> bind-evidence
inferred consequence class -> confirm-consequence-class
untrusted producer         -> approve-or-replace-producer
stale evidence             -> refresh-shadow-evidence
```

This is what keeps human work small. The operator does not need to inspect all
raw events. They see the few fields blocking policy candidate quality or scoped
rollout.

## Enforceability Rule

`enforceable` is intentionally hard to reach:

```text
surface id is explicitly listed as enforceable
AND surface id is explicitly approved
AND no field has inferred/missing/conflicting/stale/untrusted state
```

Even then:

```text
autoEnforce = false
approvalRequired = true
productionReady = false
```

The model records eligibility for a later scoped rollout packet. It does not
turn on enforcement.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/) anchors provenance as
  entities, activities, agents, derivations, and responsibility relationships.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  anchors event time, observed time, trace id, span id, resource, and emitted
  scope fields.
- [CloudEvents specification](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md)
  anchors event source, id uniqueness, subject, time, producer context, and
  schema references.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchor audit-safe decision logging with erased or masked fields.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html)
  anchors schema-backed policy/request contracts so policy work is checked
  against known entity, action, principal, resource, and context shapes.
- [SLSA Provenance](https://slsa.dev/spec/v1.0/provenance) anchors subject,
  builder, build definition, resolved dependency, and provenance parsing
  discipline for trusted producer evidence.

These sources are engineering anchors only. They do not certify Attestor
interop, telemetry compliance, policy correctness, target deployment, or
production readiness.

## Non-Claims

This model does not claim:

- production evidence-store readiness
- native target-system connector coverage
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- compliance certification
- automatic policy activation
- policy candidate correctness
- live customer pilot execution

It is the explicit evidence-state layer that lets the next step generate
candidate diffs without hiding uncertainty.
