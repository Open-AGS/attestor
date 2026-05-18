# TLA+ Trace Validator Bridge

Status: I09 implementation contract. This is a digest-only bridge from W06
decision trace snapshots to assurance-case evidence or open defeaters.

## Decision

`attestor.tla-trace-validator-bridge.v1` converts a verified
`DecisionTraceSnapshot` plus an external TLA+ validator report reference into
one of three review artifacts:

- an I00 evidence node when the validator report says the trace is valid
- an open rebutting defeater when the report says the trace violates the spec
- an open undercutting defeater when the report is unknown

It does not run TLC, Apalache, or any other model checker. It only records the
digest-bound result of such a check as assurance-case material.

## Files

```text
src/consequence-admission/tla-trace-validator-bridge.ts
tests/tla-trace-validator-bridge.test.ts
docs/02-architecture/tla-trace-validator-bridge.md
```

## Contract

Input:

```text
DecisionTraceSnapshot
specRefDigest
configRefDigest
invariantNames
validatorKind
validatorVerdict
validatorReportRefDigest
counterexampleRefDigest
tenantRefDigest
scopeDigest
targetClaimNodeId
```

Output:

```text
TlaTraceValidatorBridgeRecord
  evidenceNode | null
  openDefeater | null
  evidenceTransition | null
  defeaterTransition | null
  outcome
  dangerFlags
  reasonCodes
```

The spec module is the existing manual design-first module:

```text
AdmissionStateMachine
```

Tracked invariants:

```text
TypeOK
NoAdmitWithoutAuthority
NoEnforcementWithoutPacket
NoCrossTenantLeak
NoReviewBypass
MonotoneFusion
ReplaySafety
```

## Outcomes

```text
tla-trace-evidence-ready
tla-trace-held-for-trace-verification
tla-trace-held-for-spec-binding
tla-trace-held-for-validator-report
tla-trace-open-rebutting-defeater
tla-trace-open-undercutting-defeater
tla-trace-rejected-boundary
```

## Boundary Rules

- A valid external report creates only evidence.
- An invalid external report opens a rebutting defeater against the target claim.
- An unknown external report opens an undercutting defeater.
- Missing trace verification, spec/config binding, or report material holds
  fail-closed.
- Boundary requests for raw trace, raw spec, runtime oracle behavior, formal
  proof claims, policy activation, live enforcement, or authority action reject
  the bridge record.

## Source Anchors

- Microsoft Research, *Specifying Systems*: design-first formal specification
  framing.
- AWS, *How Amazon Web Services Uses Formal Methods*: specifications find
  design bugs, but are not production proof claims.
- AWS, *Systems Correctness Practices at AWS*: formal methods are one evidence
  source inside a broader correctness workflow.
- Apalache documentation: TLA+ model-checking/tooling reference.
- W06 Decision Trace Logger: Attestor's trace snapshot is already structured
  for offline spec checks.

## Non-Claims

This bridge is:

- `not-tlc-runner`
- `not-apalache-runner`
- `not-formal-proof`
- `not-runtime-oracle`
- `not-policy-activation`
- `not-live-enforcement`
- `not-production-ready`

It does not prove that TypeScript runtime behavior is formally verified. It
does not activate policy, admit a consequence, close a defeater, or write an
audit-plane record.
