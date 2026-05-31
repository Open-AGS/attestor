# Invariant Calibration Contract

Status: W11 Runtime Assurance Wiring v1 contract. This is not a calibration
training engine, not invariant promotion, not live enforcement, and not
production readiness.

## Decision

`attestor.invariant-calibration-contract.v1` records calibration evidence for
a review-ready candidate invariant. It exists between W10 and W12:

```text
Candidate Invariants Catalog
  -> Invariant Calibration Contract
  -> Invariant Promotion Gate
```

W11 does not mine invariants, train a model, promote an invariant, or make an
action safer. It only records whether the candidate has enough calibration
evidence to be handed to the promotion gate.

Raw classifier score and calibrated confidence are never authority inputs.
They cannot admit, block, relax, or activate enforcement.

## External Anchors

Niculescu-Mizil and Caruana show that classifier accuracy or ROC area is not
enough when probability quality matters; calibration needs independent
probability evidence and can overfit when data is scarce:
[Predicting Good Probabilities With Supervised Learning](https://icml.cc/Conferences/2005/proceedings/papers/079_GoodProbabilities_NiculescuMizilCaruana.pdf).

scikit-learn's probability calibration guide defines calibrated probabilities
as confidence levels whose bins match observed frequencies, and warns that
Brier/log-loss can mix calibration, resolution, and uncertainty:
[Probability calibration](https://scikit-learn.org/stable/modules/calibration.html).

scikit-learn's `CalibratedClassifierCV` documentation supports sigmoid,
isotonic, and temperature calibration, and warns that isotonic calibration is
not recommended with too few samples:
[CalibratedClassifierCV](https://scikit-learn.org/stable/modules/generated/sklearn.calibration.CalibratedClassifierCV.html).

Guo, Pleiss, Sun, and Weinberger show that modern neural networks can be
miscalibrated and that confidence calibration must be evaluated explicitly:
[On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html).

NIST TEVV frames trustworthy AI as dependent on reliable measurement and
evaluation methods. W11 is only a measurement contract:
[NIST AI Test, Evaluation, Validation and Verification](https://www.nist.gov/ai-test-evaluation-validation-and-verification-tevv).

## Contract

Implementation:

```text
src/consequence-admission/invariant-calibration-contract.ts
```

Test:

```text
tests/invariant-calibration-contract.test.ts
```

Package script:

```text
npm run test:invariant-calibration-contract
```

The contract exposes:

```text
INVARIANT_CALIBRATION_CONTRACT_VERSION
invariantCalibrationContractDescriptor()
createInvariantCalibrationRecord()
evaluateInvariantCalibrationReadiness()
```

## Supported Methods

The initial contract recognizes:

```text
platt-sigmoid
isotonic-regression
temperature-scaling
```

`platt-sigmoid` is the W11 name for Platt/sigmoid calibration. It is the
default small-sample method in this contract because it has fewer degrees of
freedom than isotonic regression.

`isotonic-regression` requires at least 1000 calibration samples. Below that
floor, the record is held for method sample floor because isotonic regression
can overfit when the calibration set is small.

`temperature-scaling` is recognized as future measurement vocabulary for
multi-class confidence calibration. W11 records it but does not train or fit a
temperature scaling calibrator.

## Required Evidence

A calibration record must bind:

```text
candidate invariant digest
calibration set digest
holdout set digest
sample count
positive and negative label counts
expected calibration error
Brier score
reliability bin count
reviewer digest
```

The record stays digest-only. It does not store raw model scores, raw labels,
raw prompts, raw payloads, provider bodies, customer identifiers, or tenant
identifiers.

## Outcomes

W11 can return:

```text
calibration-ready-for-promotion-review
held-for-candidate-review
held-for-sample-floor
held-for-method-sample-floor
held-for-class-coverage
held-for-calibration-evidence
held-for-metric-threshold
held-for-review
rejected-authority-score
```

Only `calibration-ready-for-promotion-review` may continue to W12. It still
does not promote an invariant or activate enforcement.

## Guardrails

The contract preserves these invariants:

- raw classifier score authority is rejected
- calibrated confidence authority is forbidden
- confidence is capped below the single-signal block reference
- calibration set and holdout set digests are required
- positive and negative label coverage is required
- isotonic regression has a 1000-sample floor
- metric threshold breaches hold the candidate
- reviewer digest is required
- automatic promotion is forbidden
- policy relaxation is not representable in this contract
- the contract cannot admit, enforce, train, or claim production readiness

## Non-Claims

Boundary: calibration evidence only: not a calibration training engine, not
policy activation, not live enforcement, and not production readiness. Weak or
missing calibration can add review pressure; it cannot grant authority.
