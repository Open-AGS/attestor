# Learned Artifact Release Budget

Status: I01 complete. This is a contract artifact for Runtime Intelligence
Activation v1. It is not a differential privacy engine, not a DP guarantee, not
a public-release mechanism, not cross-tenant aggregation, not model training,
and not production readiness.

## Decision

Learned artifacts can leak information about the shadow events and cohorts that
produced them. Attestor therefore treats every learned artifact release as an
information release that must be budgeted, tenant-bound, cohort-bound, and tied
back into the Assurance Case Contract.

The contract does not say "this artifact is private." It says:

```text
this artifact is tied to this tenant and cohort
this release spends from this bounded release budget
this reconstruction risk was considered
these risks become undermining defeaters
only assurance-review release can become review-ready
```

## Source Anchors

- [NIST SP 800-226](https://csrc.nist.gov/pubs/sp/800/226/final): differential
  privacy as a way to quantify privacy loss, plus practical privacy hazards.
- [OpenDP Context and composition](https://docs.opendp.org/en/stable/api/user-guide/context/index.html):
  privacy budget is specified before queries and access is mediated by a
  compositor.
- [OpenDP workflow](https://docs.opendp.org/en/stable/getting-started/typical-workflow.html):
  adaptive composition and budget splitting across releases.
- [U.S. Census reconstruction research](https://www.census.gov/library/working-papers/2023/adrm/CES-WP-23-63.html):
  published statistics can enable reconstruction and reidentification attacks.
- [Google Differential Privacy libraries](https://github.com/google/differential-privacy):
  accounting libraries and stochastic testing are explicit parts of practical
  privacy-preserving systems.

These sources are anchors, not claims that Attestor implements differential
privacy in this PR.

## Contract Surface

```text
src/consequence-admission/learned-artifact-release-budget.ts
tests/learned-artifact-release-budget.test.ts
```

The contract exports:

- `LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION`
- `learnedArtifactReleaseBudgetDescriptor()`
- `createLearnedArtifactReleaseBudget()`
- `evaluateLearnedArtifactReleaseBudget()`

The record is a deterministic value with canonical JSON and a SHA-256 digest. It
has no database, no network, no runtime budget store, no model call, and no
authority to admit or enforce a consequence.

## Invariants

- Budget tenant must match artifact tenant.
- Budget cohort must match artifact cohort.
- Budget spend cannot exceed total budget shape.
- A release request must spend positive budget units.
- Public release is rejected.
- Cross-tenant release is rejected.
- Raw material release is rejected.
- Small cohorts are held.
- Missing reviewer is held.
- Missing assurance case reference is held.
- Differential privacy claims without proof are held.
- External DP proof is evidence only; this contract still does not provide a DP
  guarantee.
- High or unknown reconstruction risk opens an undermining-defeater path.
- High-resolution, unique-subject, and frequent-pattern releases open
  undermining-defeater paths.
- The contract cannot grant authority, admit, activate enforcement,
  auto-promote, train a model, or claim production readiness.

## Assurance Case Role

I01 feeds I00. Its output becomes:

- a context node: budget, cohort, reconstruction-risk, and release-mode facts
- an undermining defeater when privacy or reconstruction risk is unresolved
- evidence for later promotion gates that the artifact was not released from an
  unbounded or cross-tenant information path

This is why I01 must exist before shadow-derived candidates become easier to
promote. Without it, a learned invariant can accidentally become a side channel
about the events that produced it.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

I01 only adds a release-budget and reconstruction-risk contract. It does not
release artifacts, mine cohorts, synthesize invariants, calibrate confidence,
or promote policies.
