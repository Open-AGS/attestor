# Human Comprehension Gate

Status: Step 07 repo-side deterministic contract and pure function. This is
not a reviewer UI, not production readiness, not a human-factors
certification, and not runtime enforcement.

## Decision

The human comprehension gate bounds what gets handed to a human reviewer after
the conflict and abstention gate. It turns review material into a compact
handoff with capped reason lines, capped active questions, explicit review-load
visibility, and escalation posture.

The exported version is:

```text
attestor.human-comprehension-gate.v1
```

The package exports:

```text
HumanComprehensionGateResult
humanComprehensionGateDescriptor()
evaluateHumanComprehensionGate()
```

## Limits

The first implementation uses hard contract limits:

```text
max reason lines: 7
default active question cap: 3
hard active question cap: 5
first readable target: 30 seconds
typical decision target: 180 seconds
hard escalation: 600 seconds
review-load overload: 4+ review/minute
```

These limits are repo-side contract limits. They are not live reviewer capacity
proof.

## Gate Output

The gate status vocabulary is:

```text
compact
needs-human-review
escalate
overloaded
```

`compact` is not `admit`. It only means the review handoff is bounded and this
gate did not require escalation.

## Invariants

Every output keeps these invariants:

```text
boundedForHumanReview = true
noNoisyDashboard = true
canAdmit = false
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
rawPayloadStored = false
productionReady = false
```

## Primary Source Anchors

- NIST AI RMF Appendix C: human roles, responsibilities, oversight, and context
  in human-AI configurations must be explicit. This gate makes review role and
  handoff limits explicit without claiming NIST conformance.
- NASA Human Systems Integration: a system includes humans, software, data, and
  processes. This gate treats reviewer capacity and workload as part of the
  engineered boundary.
- Google SRE practical alerting: human-facing alerts should be actionable,
  deduplicated, routed, and not noisy. This gate caps reason lines and active
  questions instead of expanding a dashboard.
- Microsoft Human-AI Interaction Guidelines: AI handoffs should provide
  context, support correction/dismissal, and avoid burying useful action. This
  gate emits compact action hints and bounded questions.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
