# Shadow Data Quality Gate

Status: I02 complete. This is a contract artifact for Runtime Intelligence
Activation v1. It evaluates whether a canonical shadow event is clean enough to
serve as assurance-case evidence, or whether the evidence must be attacked by an
`undermining` defeater.

It is not a new product surface, not an admission decision, not a data-quality
platform, not a learning system, and not production readiness.

## Decision

Shadow evidence cannot become trusted evidence merely because it exists. Before
baseline cohorts, candidate invariants, replay witnesses, or promotion packets
can depend on a shadow event, Attestor checks that the event is:

- canonical and schema-bound
- digest-only and raw-material clean
- provenance-backed
- trace/replay correlated
- fresh enough for the configured window
- observed-fact dominant rather than inferred-fact dominant
- tied to an assurance case and target evidence node

If these checks fail, the output is not "unsafe action" or "blocked action". The
output is **defeater material**: the assurance case must explicitly record why
this shadow evidence is weak, stale, sparse, untrusted, or unbound.

## Repository Artifacts

```text
src/consequence-admission/shadow-data-quality-gate.ts
tests/shadow-data-quality-gate.test.ts
docs/02-architecture/shadow-data-quality-gate.md
```

Package script:

```bash
npm run test:shadow-data-quality-gate
```

## Source Anchors

- CloudEvents required context, event identity, and privacy/security guidance:
  [CloudEvents spec](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
- Timestamp vs observed timestamp, trace id, and event field modeling:
  [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- Provenance vocabulary and validation constraints:
  [W3C PROV Overview](https://www.w3.org/TR/prov-overview/)
- Trace correlation model:
  [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- Producer, schema URL, and event time metadata pattern:
  [OpenLineage API](https://openlineage.io/apidocs/openapi/)
- Validation result shape as an artifact:
  [Great Expectations Validation Result](https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/validation_result/)
- Data quality checks as explicit assumptions:
  [AWS Deequ](https://github.com/awslabs/deequ)

## Contract Shape

`createShadowDataQualityGate(input)` produces a deterministic
`ShadowDataQualityGateRecord`.

Inputs:

- `CanonicalShadowEvent`
- `evaluatedAt`
- `evaluatorRefDigest`
- optional `assuranceCaseRefDigest`
- optional `attacksNodeId`
- optional producer allow-list and freshness/coverage thresholds

Outputs:

- check list across schema, provenance, freshness, coverage, redaction,
  correlation, and decision-integrity dimensions
- danger flags
- outcome
- assurance-case linkage
- undermining-defeater requirement and reason codes
- digest-only canonical record

## Outcomes

| Outcome | Meaning |
|---|---|
| `quality-ready-for-assurance-evidence` | The event can be used as evidence material inside the assurance case. |
| `quality-open-undermining-defeater` | The event is usable only with explicit undermining-defeater material. |
| `quality-held-for-provenance` | Core evidence, provenance, or schema references are missing. |
| `quality-held-for-assurance-case` | The event is not bound to an assurance case and evidence node. |
| `quality-rejected-raw-material` | Raw payload/material storage was attempted and must fail closed. |

## Checks

| Check | Dimension | Why it exists |
|---|---|---|
| `canonical-schema-version` | schema | Prevents non-canonical shadow events from becoming evidence. |
| `raw-material-boundary` | redaction | Ensures raw payload, prompt, provider body, wallet material, and customer identifiers are not carried. |
| `evidence-ref-presence` | provenance | Requires digest evidence references. |
| `provenance-ref-presence` | provenance | Requires explicit provenance refs, not just generic evidence. |
| `schema-ref-presence` | schema | Requires schema binding. |
| `trace-correlation` | correlation | Preserves request/path correlation when required. |
| `replay-or-idempotency-correlation` | correlation | Preserves replay and idempotency anchors. |
| `timestamp-order` | freshness | Rejects observed-before-occurred evidence. |
| `observation-lag` | freshness | Flags stale observation windows. |
| `observed-fact-coverage` | coverage | Flags sparse observed facts. |
| `inferred-fact-ratio` | coverage | Flags inferred material dominating observed material. |
| `producer-trust` | provenance | Fails events without a scoped producer allow-list, and fails producers outside that allow-list. |
| `decision-fail-closed-posture` | decision-integrity | Flags shadow records whose own decision posture admits without fail-closed evidence. |

## Assurance Case Role

I02 generates **undermining-defeater material**. In Eliminative Argumentation,
an undermining defeater attacks the evidence, not the claim itself. That is the
right fit here:

```text
claim: candidate policy is supported by shadow traffic
  evidence: shadow event cohort
  defeater: shadow data quality is stale / sparse / provenance-missing
```

The gate does not create the full assurance case. It produces a digest-bound
record that later steps can turn into assurance-case nodes and transitions.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

## Next Step

I03 is the Baseline Cohort Builder. It may only use shadow events that are
quality-ready, or it must carry the I02 undermining defeater forward into the
assurance case.
