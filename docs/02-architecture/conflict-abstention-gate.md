# Conflict And Abstention Gate

Status: Step 06 repo-side deterministic contract and pure function. This is
not policy activation, not runtime enforcement, not model calibration, and not
production readiness.

## Decision

The conflict and abstention gate runs after relationship-aware monotone fusion.
It translates conflict, abstention, uncertainty, and coverage pressure into a
bounded gate outcome. It cannot admit, approve, loosen, or make an action safe.

The exported version is:

```text
attestor.conflict-abstention-gate.v1
```

The package exports:

```text
ConflictAbstentionGateResult
conflictAbstentionGateDescriptor()
evaluateConflictAbstentionGate()
```

## Gate Outcomes

The gate output vocabulary is deliberately not an admission vocabulary:

```text
continue       -> no conflict/abstention objection from this gate only
review         -> human or higher gate must resolve the issue
abstain-hold   -> the system lacks enough reliable coverage to continue safely
block-pressure -> strong hazard pressure for later terminal gates
```

`continue` is not `admit`. It only means this gate has no additional objection.

## Gate Rules

The first implementation is deliberately conservative:

```text
high conflict pressure -> review or block-pressure
contradictory relationships -> conflict pressure
abstention with missing/degraded evidence -> abstain-hold capable
high uncertainty -> review
low or unknown coverage -> review
no reviewed inputs -> abstain-hold
fusion watch posture -> review-visible pressure, never silent continue
fusion block pressure -> preserved
```

The gate keeps the following invariants:

```text
noLoosening = true
failClosedOnUncertainty = true
runsAfterRelationshipAwareFusion = true
canAdmit = false
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

## Primary Source Anchors

- STPA / STAMP: unsafe control actions depend on context, conflicts, gaps, and
  missing feedback. This gate treats conflict and missing feedback as safety
  signals, not as permission to continue silently.
- NIST AI RMF: risk management is iterative across map, measure, and manage.
  This gate is a manage-time boundary for uncertainty and conflict; it does not
  claim NIST conformance.
- Conformal prediction with reject option: abstention/rejection is the right
  response when a predictor should not be trusted for an instance. This gate
  borrows the engineering posture, but it does not implement conformal
  prediction or calibrated statistical guarantees.
- Google SRE monitoring: alerting should focus on actionable symptoms. This
  gate emits compact reason codes, not raw diagnostic payloads.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
