# Calibration Lower-Bound Runner

Status: I06 complete for Runtime Intelligence Activation v1.

This component converts an already-ready W11 invariant calibration record into
I00 assurance-case evidence only when the conservative lower confidence bound is
strong enough and I05 counterexample witness material is present. If the lower
bound is too weak, it opens an undercutting defeater against the I04 strategy
node instead of creating positive evidence.

## Files

```text
src/consequence-admission/calibration-lower-bound-runner.ts
tests/calibration-lower-bound-runner.test.ts
docs/02-architecture/calibration-lower-bound-runner.md
```

## Decision

I06 is a deterministic review-evidence builder. It consumes:

- an I04 `CandidateInvariantSynthesizerRecord`
- a W11 `InvariantCalibrationRecord`
- one or more I05 `CounterexampleMinimalWitnessRecord` values

It emits a digest-bound `CalibrationLowerBoundRunnerRecord` with either:

- an assurance-case evidence node for lower-bound confidence evidence, or
- an open undercutting defeater when the lower bound cannot support review.

## Version

```text
attestor.calibration-lower-bound-runner.v1
```

## Research Anchors

FDA pharmacovigilance uses empirical-Bayes lower-bound framing such as EB05 in
MGPS signal detection. That is the important import for Attestor: the lower
bound matters more than the point estimate when evidence can be sparse or noisy.

NIST/SEMATECH statistical guidance treats measurement with uncertainty context,
and NIST AI RMF places measurement inside a risk-management function rather than
inside the authority path. scikit-learn calibration guidance distinguishes model
score calibration from action choice. I06 follows that split: calibrated point
confidence is recorded, but only a conservative lower bound can become review
evidence, and neither value can become authority.

## Invariants

- The runner is pure and deterministic.
- Candidate, calibration, witness, tenant, cohort, and invariant digests must
  bind to the same material.
- A lower bound cannot exceed the capped calibrated confidence from W11.
- Missing counterexample witness material holds the runner.
- Any open I05 rebutting counterexample holds the runner.
- Weak lower-bound evidence opens an undercutting defeater instead of producing
  positive evidence.
- Point estimates are never authority.
- Lower bounds are never authority.
- The runner cannot admit, enforce, promote, train, learn, or activate policy.

## Outcomes

```text
lower-bound-ready-for-promotion-review
held-for-candidate-readiness
held-for-calibration-readiness
held-for-counterexample-evidence
held-for-open-counterexample-defeater
held-for-lower-bound-threshold
held-for-assurance-case
rejected-authority-confidence
```

## Non-Claims

```text
not-calibration-training-engine
not-point-estimate-authority
not-lower-bound-authority
not-promotion-gate
not-policy-activation
not-live-enforcement
not-production-ready
```

I06 is not a calibration trainer, not a statistical guarantee, not a promotion
gate, not a policy writer, not a runtime enforcement path, and not production
readiness evidence.
