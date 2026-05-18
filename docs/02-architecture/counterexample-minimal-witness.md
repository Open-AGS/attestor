# Counterexample Minimal Witness

Status: I05 complete for Runtime Intelligence Activation v1. This is a
deterministic assurance-case contract, not a replay execution engine, not live
enforcement, and not production readiness.

## Decision

I05 converts a review-ready I04 candidate invariant claim plus a digest-only,
minimal, reproducing counterexample witness into:

```text
assurance-case evidence node
  + open rebutting defeater
  + signed transition records
```

The witness is review material. It does not reject the claim automatically. It
only makes the counterexample explicit so the later promotion gate can see what
remains unknown.

## Files

```text
src/consequence-admission/counterexample-minimal-witness.ts
tests/counterexample-minimal-witness.test.ts
docs/02-architecture/counterexample-minimal-witness.md
```

Package script:

```text
npm run test:counterexample-minimal-witness
```

## Contract

Version:

```text
attestor.counterexample-minimal-witness.v1
```

Input:

```text
CandidateInvariantSynthesizerRecord
witness id and kind
source replay digest
optional deterministic replay seed digest
trace digests
event digests
counterexample digests
minimality method
original/minimal/removed step counts
reproducesViolation flag
```

Output:

```text
witnessRefDigest
evidenceBodyDigest
Evidence node, when ready
Open rebutting defeater, when ready
create-node transition
open-defeater transition
reason codes
danger flags
```

## Minimality

The contract is grounded in minimal-witness engineering patterns:

| Source | Imported constraint |
|---|---|
| Elle / Jepsen | Prefer a small witness set that explains a violation. |
| ClusterFuzz / OSS-Fuzz | Minimize and deduplicate failure material before review. |
| QuickCheck | Shrink failing cases into smaller counterexamples. |
| Delta Debugging | Remove non-essential steps while preserving the failure. |
| FoundationDB | Keep deterministic replay anchored by digest and seed. |

The contract stores only digest references and counts. It does not execute the
replay, fetch payloads, call target systems, or use credentials.

## Outcomes

```text
minimal-witness-ready-for-rebutting-defeater
minimal-witness-held-for-synthesizer-readiness
minimal-witness-held-for-assurance-case
minimal-witness-held-for-minimality
```

Ready means all of these are true:

```text
I04 synthesized claim is ready for open-defeater review
assurance case digest is present
claim node digest is present
witness reproduces the violation
witness is minimal or reduced
tenant/cohort/invariant digests match
```

## Fail-Closed Boundaries

The contract fails closed when:

```text
tenant digest mismatches
cohort digest mismatches
invariant digest mismatches
candidate invariant digest mismatches
violated claim node id mismatches
step counts are internally inconsistent
trace/event/counterexample digest lists are empty
digest lists contain duplicates
```

Held records create no evidence node and no defeater.

## Non-Claims

I05 does not claim:

- `not-replay-execution-engine`
- `not-policy-correctness-proof`
- `not-target-system-integration`
- `not-production-traffic`
- `not-credential-use`
- `not-model-training`
- `not-automatic-claim-rejection`
- `not-automatic-promotion`
- `not-policy-activation`
- `not-live-enforcement`
- `not-production-ready`

## Next Step

I06 adds the calibration lower-bound runner. It should consume reviewable
evidence as evidence, not as authority, and must not turn point estimates into
admission power.
