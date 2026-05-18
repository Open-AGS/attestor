# Reviewer Open Defeater View

Status: I07 complete for Runtime Intelligence Activation v1.

This component turns I05 and I06 open defeater material into a bounded,
digest-only reviewer packet. It is not a reviewer UI, not a review decision,
not a defeater-closure mechanism, not a promotion gate, and not runtime
enforcement.

## Files

```text
src/consequence-admission/reviewer-open-defeater-view.ts
tests/reviewer-open-defeater-view.test.ts
docs/02-architecture/reviewer-open-defeater-view.md
```

## Decision

I07 is a deterministic view builder. It consumes:

- an I04 `CandidateInvariantSynthesizerRecord`
- zero or more I05 `CounterexampleMinimalWitnessRecord` values
- zero or more I06 `CalibrationLowerBoundRunnerRecord` values

It emits a digest-bound `ReviewerOpenDefeaterViewRecord` containing only open
defeater lines and bounded resolution questions:

```text
max 7 reason lines
max 3 questions
```

The record can say that a claim has no open defeaters and is ready to become
input to the later I08 promotion gate. It cannot close a defeater, decide a
review, promote a policy, admit a consequence, or activate enforcement.

## Version

```text
attestor.reviewer-open-defeater-view.v1
```

## Research Anchors

Microsoft Human-AI Interaction Guidelines emphasize making capability,
uncertainty, explanation, correction, and scope visible to the user. I07 imports
that as a bounded reviewer packet: show what remains open, show why, and keep
correction choices explicit.

Google People + AI Guidebook anchors the mental-model side of review: the
system should help people understand what the AI-derived material does and does
not know. I07 therefore renders open defeaters rather than raw event material or
unbounded evidence dumps.

GitHub code scanning alert resolution provides the triage pattern: alerts can
be resolved or dismissed with attributed reasons, but that action is distinct
from the alert display itself. I07 follows that split. It displays open
defeaters and possible resolution kinds, but does not perform the reviewer
decision.

GSN and the I00 assurance-case contract anchor the argument view: a reviewer
looks at the remaining open ways a claim could be wrong, not at an unrelated
dashboard of all evidence.

## Invariants

- The builder is pure and deterministic.
- The synthesized claim, counterexample witnesses, calibration runs, tenant,
  cohort, and invariant digests must bind to the same material.
- Only open I05 rebutting defeaters and open I06 undercutting defeaters are
  rendered.
- Closed, residual, or held material is not rendered as an open line.
- The view is digest-only and never requests raw evidence.
- Visible reason lines are capped at seven.
- Active resolution questions are capped at three.
- Truncation is explicit through `open-defeater-view-truncated`.
- Boundary requests for raw evidence or authority action are rejected.
- The view cannot admit, enforce, promote, train, learn, close defeat, or record
  a reviewer decision.

## Outcomes

```text
reviewer-view-ready-with-open-defeaters
reviewer-view-ready-no-open-defeaters
reviewer-view-held-for-claim-readiness
reviewer-view-held-for-assurance-case
reviewer-view-held-for-review-material
reviewer-view-rejected-boundary
```

## Non-Claims

```text
not-reviewer-ui
not-promotion-gate
not-defeater-closure
not-review-decision
not-raw-evidence-export
not-policy-activation
not-live-enforcement
not-production-ready
```

I07 is only the open-defeater packet shape and deterministic builder. Human
review workflows, closure transitions, promotion-gate execution, downstream
effects, and production deployment remain later steps or deployment-specific
work.
