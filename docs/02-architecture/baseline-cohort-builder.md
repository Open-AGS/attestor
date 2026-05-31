# Baseline Cohort Builder

Status: I03 complete. This is a deterministic contract slice for Runtime
Intelligence Activation v1. It is not a baseline mining engine, not live
enforcement, not policy activation, and not production readiness.

## Decision

`attestor.baseline-cohort-builder.v1` turns an existing tenant-local
`BaselineCohortCandidate` into an Assurance Case evidence node only after three
inputs agree:

- W09 `BaselineCohortCandidate`: digest-only, tenant-local cohort material.
- I02 `ShadowDataQualityGateRecord`: every source event has quality evidence.
- I01 `LearnedArtifactReleaseBudgetRecord`: the cohort-summary release is
  budgeted and review-scoped.

The output is `BaselineCohortBuilderRecord`. It can be used by later candidate
claim synthesis, but it cannot admit, enforce, train, aggregate tenants, or
promote policy.

## Inputs

```text
BaselineCohortCandidate
ShadowDataQualityGateRecord[]
LearnedArtifactReleaseBudgetRecord
assuranceCaseRefDigest
createdByRefDigest
createdAt
```

The release budget must be for `baseline-cohort-summary`, must bind the same
tenant and cohort, and must use the cohort candidate digest as its
`artifactRefDigest`.

## Output

The builder creates:

```text
BaselineCohortBuilderRecord
  -> evidenceNode: AssuranceCaseNode | null
  -> evidenceTransition: AssuranceCaseTransition | null
  -> evidenceBodyDigest
  -> includedSourceEventDigests
  -> excludedSourceEventDigests
  -> dangerFlags
  -> reasonCodes
```

When the assurance case reference is missing, the record is held and no evidence
node is created.

## Outcomes

```text
cohort-evidence-ready-for-candidate-claim
cohort-held-for-quality-defeaters
cohort-held-for-budget
cohort-held-for-assurance-case
cohort-held-for-source-floor
cohort-held-for-safety-label
```

Every non-ready outcome is fail-closed and emits undermining-defeater material
for later review.

## Invariants

- every cohort source event must have at most one quality gate
- every quality gate must refer to a source event inside the cohort
- every quality gate must stay in the same tenant
- all source events must remain digest-only
- release budget tenant, cohort, and artifact refs must match the cohort
- assurance-case evidence node scope is the cohort ref digest
- the builder does not learn from traffic
- the builder does not train a model
- the builder does not aggregate across tenants
- the builder does not auto-promote candidate claims
- the builder cannot admit, block, narrow, or activate enforcement

## Source Anchors

- TensorFlow Data Validation detects anomalies by comparing statistics against a
  schema; Attestor maps this to quality-gated cohort evidence, not automatic
  safety claims.
- ML Metadata records artifacts, executions, events, and context for lineage;
  Attestor maps this to explicit evidence-node and transition lineage.
- Data Cards and Datasheets for Datasets show that dataset/cohort artifacts need
  documented scope, provenance, maintenance, and intended use.
- DVC keeps data versions in Git-tracked metafiles while large data stays
  outside the code repository; Attestor keeps cohort evidence digest-only.
- lakeFS uses content-addressed immutable commit material; Attestor uses
  canonical digests for cohort, evidence body, and node material.
- OpenLineage models run, job, and dataset metadata with extensible facets;
  Attestor keeps this as an engineering anchor for future lineage facets, not a
  conformance claim.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

Descriptor non-claim vocabulary:

```text
not-baseline-mining-engine
not-learned-invariant-synthesizer
not-model-training
not-live-enforcement
not-policy-activation
not-cross-tenant-aggregation
not-production-ready
```

## Files

```text
src/consequence-admission/baseline-cohort-builder.ts
tests/baseline-cohort-builder.test.ts
docs/02-architecture/baseline-cohort-builder.md
```

## Verification

```bash
npm run test:baseline-cohort-builder
```
