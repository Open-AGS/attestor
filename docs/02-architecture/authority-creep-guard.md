# Authority-Creep Guard

Status: implemented I12 contract slice. This is a digest-only, read-only guard
for Goodhart and measurement-as-authority paths. It is not a policy activation
component, not live enforcement, not a reviewer decision, and not production
readiness.

Version: `attestor.authority-creep-guard.v1`

## Decision

`attestor.authority-creep-guard.v1` reads the I11 decision lineage graph and,
optionally, the I10/I06 measurement material already represented by the
assurance measurement plane:

```text
Decision Lineage Graph
  + optional Assurance Measurement Plane
  -> Authority-Creep Guard
```

The guard answers one narrow question:

```text
did measurement, budget, calibration, lineage, or metric material start acting
like decision authority?
```

If no authority-creep path is visible, the guard emits an evidence node. If a
measurement-as-authority path is visible, it opens an `undercutting` defeater
against the target claim. It never closes defeaters, mutates the lineage graph,
activates policy, admits, narrows, blocks, or enforces.

## Files

```text
src/consequence-admission/authority-creep-guard.ts
tests/authority-creep-guard.test.ts
docs/02-architecture/authority-creep-guard.md
```

Package script:

```bash
npm run test:authority-creep-guard
```

## Source Anchors

| Anchor | Imported rule |
|---|---|
| Goodhart's Law / metric gaming literature | A metric that becomes a target can stop being reliable measurement. I12 treats measurement-as-authority as defeat material. |
| NIST AI RMF | Measure informs risk management; it is not a silent decision actuator. I12 keeps measurement output as evidence or defeat only. |
| Google SRE error budget policy | Budgets inform release/control policy through explicit process; budget pressure must not silently relax safeguards. |
| CISA SSVC | Evidence is mapped through an explicit decision rule; the score or input fact is not itself the decision authority. |
| Assurance 2.0 / Eliminative Argumentation | A flaw in the inference rule is an undercutting defeater. I12 uses this for measurement-as-authority paths. |
| Decision Lineage Graph | Provenance is digest-bound support material, not authority. I12 reads the graph and adds separate case material. |

These are engineering anchors only. They do not make this slice NIST, SRE,
SSVC, or formal assurance-case conformant.

## Contract

The primary builder is:

```text
createAuthorityCreepGuard(input)
```

Required inputs:

```text
lineageGraph              I11 DecisionLineageGraphRecord
guardId
evaluatedAt
evaluatorRefDigest
```

Optional inputs:

```text
measurementPlane          I10/I06 AssuranceMeasurementPlane
targetClaimNodeId         defaults to the lineage root claim
evidenceNodeId
defeaterId
boundary request booleans
```

## Findings

I12 flags these authority-creep paths:

```text
measurement-artifact-targets-claim
measurement-artifact-targets-strategy
measurement-blocked-metric-use-requested
measurement-policy-relaxation-requested
measurement-score-calibration-requested
measurement-model-training-requested
measurement-enforcement-activation-requested
lineage-policy-activation-requested
lineage-live-enforcement-requested
lineage-authority-action-requested
lineage-audit-write-requested
lineage-rejected-boundary
lineage-signature-coverage-missing
```

Direct guard boundary requests are rejected:

```text
raw-payload-requested
raw-evidence-requested
audit-write-requested
policy-activation-requested
live-enforcement-requested
authority-action-requested
```

## Outcomes

```text
authority-creep-evidence-ready
authority-creep-open-undercutting-defeater
authority-creep-held-for-lineage-binding
authority-creep-rejected-boundary
```

Mapping:

```text
no findings
  -> evidence node

measurement-as-authority, blocked metric use, or lineage authority request
  -> open undercutting defeater

missing signature coverage in the lineage graph
  -> held for lineage binding + open undercutting defeater

raw payload/evidence, audit write, policy activation, live enforcement,
or authority action requested directly from I12
  -> rejected boundary, no trusted case material
```

## Invariants

```text
digest-only
read-only
lineage graph is not mutated
measurement plane is not mutated
no raw payload
no raw evidence
no audit write
no policy activation
no live enforcement
no authority action
no learning
no training
not a reviewer decision
```

The guard requires a no-authority decision lineage graph and, when supplied, a
no-authority assurance measurement plane. Measurement output may become
evidence or an undercutting defeater, but it cannot become authority.

## Non-Claims

The descriptor exposes these non-claims:

```text
not-policy-activation
not-live-enforcement
not-measurement-authority
not-lineage-mutation
not-defeater-closure
not-review-decision
not-learning
not-training
not-production-readiness
```

## Role In The Tracker

I12 uses I11 lineage and I10/I06 measurement material to detect authority creep
before I13 outcome feedback closes the loop:

```text
I00 assurance case
  -> I11 digest-bound lineage graph
  -> I12 measurement-as-authority guard
  -> I13 outcome feedback / COE wiring
```

I12 does not introduce a second decision engine. It adds defeater material to
the same assurance-case fabric when measurement, calibration, budget, or
lineage evidence begins to act like policy authority.
