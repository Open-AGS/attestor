# Candidate Invariants Catalog

Status: W10 Runtime Assurance Wiring v1 contract. This is not an invariant
mining engine, not learned invariant promotion, not live enforcement, and not
production readiness.

## Decision

`attestor.candidate-invariants-catalog.v1` defines the safe vocabulary for
candidate invariants that may be handed to a reviewer after W09 baseline cohort
screening. It does not infer invariants from traffic and it never treats
frequency as safety.

The catalog exists to keep later Layer 2 work bounded:

```text
Baseline Cohort Contract
  -> Candidate Invariants Catalog
  -> Invariant Calibration Contract
  -> Invariant Promotion Gate
```

W10 says which candidate shapes can be discussed. W11 will attach calibration
metadata. W12 will decide whether a reviewer-approved invariant can be promoted
as a strengthening control.

## External Anchors

Daikon reports likely invariants from observed executions. Its language is
useful for candidate shapes, but likely invariants are not safety guarantees:
[Daikon dynamic invariant detection](https://homes.cs.washington.edu/~mernst/pubs/daikon-tool-scp2007-abstract.html).

DIDUCE dynamically hypothesizes invariants and relaxes them as violations are
seen. Attestor deliberately does not adopt relaxation in W10; relaxation is a
danger flag because it can weaken an existing control:
[DIDUCE anomaly detection](https://www.cs.cmu.edu/~15849g/readings/hangal02.pdf).

Texada mines temporal LTL specifications from execution traces. W10 uses this
only as an anchor for temporal candidate templates such as precedence and
response; it does not mine temporal properties:
[Texada LTL specification mining](https://www.cs.ubc.ca/~bestchai/papers/texada-ase15_final.pdf).

Dwyer, Avrunin, and Corbett describe property specification patterns that make
formal properties easier to classify and reuse. W10 adopts the pattern-catalog
idea so candidate invariants are not free-form text:
[Property Specification Patterns](https://people.cs.ksu.edu/~dwyer/spec-patterns.ORIGINAL).

NIST AI 100-2 describes data poisoning and related adversarial ML attack
classes. W10 therefore flags poisoned, under-reviewed, cross-tenant, and
frequency-only candidates instead of accepting them as learned truth:
[NIST AI 100-2 E2025](https://csrc.nist.gov/pubs/ai/100/2/e2025/final).

## Contract

Implementation:

```text
src/consequence-admission/candidate-invariants-catalog.ts
```

Test:

```text
tests/candidate-invariants-catalog.test.ts
```

Package script:

```text
npm run test:candidate-invariants-catalog
```

The contract exposes:

```text
CANDIDATE_INVARIANTS_CATALOG_VERSION
candidateInvariantsCatalogDescriptor()
createCandidateInvariantFromBaseline()
evaluateCandidateInvariantReviewReadiness()
```

## Candidate Kinds

The first catalog supports these candidate invariant kinds:

```text
field-presence
digest-binding
tenant-boundary
authority-evidence-required
freshness-window-bound
temporal-precedence
bounded-rate
outcome-receipt-link
counterexample-exclusion
monotone-risk-floor
```

These are review candidates only. A candidate cannot admit an action, activate
enforcement, train a model, or mutate policy.

## Template Kinds

Templates are bounded to known property shapes:

```text
always
never
precedence
response
bounded-window
state-equality
threshold-bound
```

This keeps candidate invariant text readable while keeping the shape close to
formal verification and trace-mining literature.

## Danger Flags

W10 explicitly records danger flags:

```text
frequency-implies-safety
post-hoc-correlation
cross-tenant-generalization
relaxes-existing-control
uses-blocked-traffic
raw-material-dependent
insufficient-sample
missing-counterexample-replay
silent-authority-upgrade
external-effect-unobserved
unreviewed-promotion
unsafe-baseline-cohort
```

The following flags reject the candidate immediately:

```text
frequency-implies-safety
cross-tenant-generalization
relaxes-existing-control
uses-blocked-traffic
raw-material-dependent
silent-authority-upgrade
```

Other flags hold the candidate until the missing evidence, reviewer label, or
counterexample replay exists.

## Review Outcomes

The catalog can return:

```text
review-ready
held-for-counterexample-replay
held-for-review
held-for-baseline
rejected-danger-flag
```

`review-ready` only means the candidate can be shown to a reviewer. It is not
promotion, not activation, and not enforcement.

## Non-Claims

Boundary: review-ready candidate catalog only: not an invariant mining engine,
not learned invariant promotion, not live enforcement, and
not production readiness. Candidates remain reviewer-owned until separate
evidence promotes them.
