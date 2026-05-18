# Promotion Gate Runner

Status: I08 complete for Runtime Intelligence Activation v1.

This component executes the bounded promotion predicate for a candidate
invariant claim after the reviewer-open-defeater view has no remaining open
defeat material. It is a deterministic handoff gate. It is not a reviewer
decision, not a defeater-closure mechanism, not a policy patch generator, not
policy activation, and not runtime enforcement.

## Files

```text
src/consequence-admission/promotion-gate-runner.ts
tests/promotion-gate-runner.test.ts
docs/02-architecture/promotion-gate-runner.md
```

## Decision

I08 consumes:

- an I04 `CandidateInvariantSynthesizerRecord`
- an I07 `ReviewerOpenDefeaterViewRecord`

It emits a digest-bound `PromotionGateRunnerRecord` that says whether the
claim can move to a **review-only patch handoff**. The predicate is bounded to
the I07 reviewer-open-defeater view:

```text
claim ready
+ assurance case bound
+ claim node present
+ strategy node present
+ reviewer view ready
+ open defeater count = 0
+ no raw/authority/closure/activation request
= review-only patch handoff allowed
```

The record deliberately does not claim global proof, live enforcement, or final
reviewer approval. It only records that the I07 open-defeater slice no longer
blocks the next review-only promotion step.

## Version

```text
attestor.promotion-gate-runner.v1
```

## Research Anchors

Assurance 2.0 frames the readiness question around indefeasibility: a claim is
not ready because evidence accumulated, but because explicit defeaters for the
claim and inference have been handled within the stated scope. I08 imports that
as a bounded predicate over the I07 reviewer-open-defeater view.

CMU SEI Eliminative Argumentation anchors the confidence posture: confidence
comes from eliminating named ways the argument can fail, not from a raw score.
I08 therefore checks that open rebutting and undercutting material is absent
before it permits a handoff.

OMG SACM and GSN provide the argument substrate and human-readable structure:
claim, strategy, evidence, context, and argument links remain explicit. I08
therefore requires an assurance case reference plus claim and strategy node
digests.

CISA SSVC provides the decision-tree pattern: evidence is mapped to a bounded
next action, while the tree itself does not silently remediate. I08 maps the
bounded predicate to one action only: review-only patch handoff.

GitHub code scanning alert resolution provides the separation pattern: viewing
and triaging an alert is distinct from dismissal and from the recorded
resolution. I08 follows that boundary. It does not close defeat or record a
reviewer decision.

## Invariants

- The runner is pure and deterministic.
- The synthesized claim and reviewer view must bind to the same tenant,
  cohort, invariant, candidate invariant, and synthesized claim digest.
- Assurance case, claim node, and strategy node digests are required.
- The I07 reviewer view must be ready and must have zero open defeaters.
- Boundary requests for raw evidence, reviewer decision, defeater closure,
  policy activation, live enforcement, or authority action are rejected.
- The output is digest-only.
- The runner cannot admit, enforce, activate policy, generate a patch, train,
  learn, close defeat, or record a reviewer decision.
- The predicate scope is explicit: `reviewer-open-defeater-view`.

## Outcomes

```text
promotion-gate-ready-for-review-only-patch-handoff
promotion-gate-held-for-open-defeaters
promotion-gate-held-for-assurance-case
promotion-gate-held-for-claim-readiness
promotion-gate-held-for-reviewer-view
promotion-gate-rejected-boundary
```

## Non-Claims

```text
not-review-decision
not-defeater-closure
not-policy-patch-generator
not-policy-activation
not-live-enforcement
not-authority-granting
not-production-ready
```

I08 is only the bounded predicate runner and deterministic handoff record.
Human review workflows, defeater closure transitions, policy patch generation,
promotion PR creation, downstream effects, and production deployment remain
separate steps.
