# Candidate Invariant Synthesizer

Status: I04 complete. This is a deterministic contract slice for Runtime
Intelligence Activation v1. It is not an invariant mining engine, not automatic
claim acceptance, not learned invariant promotion, not live enforcement, and
not production readiness.

## Decision

`attestor.candidate-invariant-synthesizer.v1` converts a review-ready W10
candidate invariant plus a ready I03 baseline cohort evidence record into
Assurance Case claim and strategy nodes.

It does not infer invariants from traffic. It does not decide that an invariant
is true. It only creates a bounded argument shape that a later open-defeater
review can inspect.

```text
I03 Baseline Cohort Builder
        +
W10 Candidate Invariants Catalog
        -> I04 Candidate Invariant Synthesizer
        -> claim node + strategy node
        -> later open-defeater review
```

## Inputs

```text
BaselineCohortBuilderRecord
CandidateInvariant
assuranceCaseRefDigest
createdByRefDigest
createdAt
```

The baseline evidence must be `readyForCandidateClaim`. The W10 candidate must
be `review-ready`. Tenant and cohort refs must match exactly.

## Outputs

```text
CandidateInvariantSynthesizerRecord
  -> claimNode: AssuranceCaseNode | null
  -> strategyNode: AssuranceCaseNode | null
  -> claimTransition: AssuranceCaseTransition | null
  -> strategyTransition: AssuranceCaseTransition | null
  -> claimBodyDigest
  -> strategyBodyDigest
  -> dangerFlags
  -> reasonCodes
```

When the evidence, candidate, or assurance-case context is not ready, no claim
or strategy node is created.

## Outcomes

```text
invariant-claim-ready-for-open-defeater-review
invariant-held-for-baseline-evidence
invariant-held-for-candidate-readiness
invariant-held-for-assurance-case
invariant-rejected-danger-flag
```

`invariant-claim-ready-for-open-defeater-review` means only that an assurance
case claim and strategy node can be shown to the reviewer. It is not promotion,
not enforcement, not policy activation, and not proof.

## Invariants

- baseline evidence must be ready before claim nodes are created
- W10 candidate must be review-ready before claim nodes are created
- candidate tenant must match baseline evidence tenant
- candidate baseline cohort ref must match baseline evidence cohort ref
- frequency-only and relaxation danger paths are rejected
- missing assurance-case context holds the record
- claim and strategy nodes are digest-bound and deterministic
- no raw material is read or emitted
- no mining, learning, model training, auto-promotion, or policy activation

## Source Anchors

- Daikon describes likely invariants from observed executions. Attestor uses
  this only as a warning: likely invariants are candidates, not proofs.
- Texada mines LTL specifications from traces. Attestor imports the bounded
  temporal-template idea, not automatic temporal policy activation.
- Synoptic mines execution-log invariants and model structure. Attestor imports
  the trace-to-hypothesis pattern, not runtime authority.
- Dwyer property specification patterns show why candidate claims should use
  known property shapes instead of free-form text.
- GitHub CodeQL model/sanitizer workflows show that a structural model can
  affect an entire alert family, so Attestor keeps candidate claim creation
  separate from promotion.
- Assurance-case claim/strategy nodes keep the candidate in a defeater-first
  review structure.

## Non-Claims

Descriptor non-claim vocabulary:

```text
not-invariant-mining-engine
not-automatic-claim-acceptance
not-learned-invariant-promotion
not-model-training
not-policy-activation
not-live-enforcement
not-production-ready
```

This slice does not claim:

- Daikon, Texada, Synoptic, Dwyer-pattern, CodeQL, SACM, or GSN conformance
- formal proof
- model training
- automatic invariant synthesis
- automatic policy promotion
- live enforcement
- production readiness

## Files

```text
src/consequence-admission/candidate-invariant-synthesizer.ts
tests/candidate-invariant-synthesizer.test.ts
docs/02-architecture/candidate-invariant-synthesizer.md
```

## Verification

```bash
npm run test:candidate-invariant-synthesizer
```
