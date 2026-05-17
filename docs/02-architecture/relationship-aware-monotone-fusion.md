# Relationship-Aware Monotone Fusion

Status: Step 05 repo-side deterministic contract and pure function. This is
not learning, not policy activation, not runtime enforcement, and not
production readiness.

## Decision

Relationship-aware monotone fusion combines LayerOpinion, Signal Relationship,
and Modulator Authority inputs after relationships have already been typed. It
computes caution pressure. It cannot approve, loosen, or make an action safe.

The exported version is:

```text
attestor.relationship-aware-monotone-fusion.v1
```

The package exports:

```text
RelationshipAwareMonotoneFusionResult
relationshipAwareMonotoneFusionDescriptor()
fuseRelationshipAwareMonotoneHazard()
```

## Fusion Rules

The first implementation is deliberately conservative:

```text
max input hazard is preserved
duplicate relationships discount duplicate advisory contributions
confirmation relationships add caution pressure
contradiction relationships add conflict pressure
requires_review relationships add review pressure
directed overrides and escalations preserve stricter pressure
modulators can only add tightening/context pressure
```

The result posture is:

```text
clear
watch
review
block-pressure
```

`block-pressure` is not a block decision. It is an input for later gates.

## No-Loosening Invariants

Every result keeps these invariants:

```text
monotoneNoLoosening = true
preservesHardFloor = true
relationshipAware = true
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

The fused score must not fall below the maximum raw input hazard. Duplicate
discounting can reduce duplicate advisory contribution, but it cannot average
away the strongest hazard already observed.

## Primary Source Anchors

- STPA / STAMP: losses can emerge from unsafe interactions and inadequate
  feedback; relationships are evaluated before fusion.
- NRC fault tree analysis: explicit relationships between events matter for
  system hazard reasoning; this implementation does not claim probabilistic
  fault-tree correctness.
- NASA FMEA: component effects and upstream/downstream dependencies should be
  visible before risk mitigation.
- Google SRE monitoring: alerting should focus on symptoms and imminent real
  problems; fusion output is pressure/diagnostic evidence, not authority.

## Non-Claims

This file does not claim:

- that the score is calibrated
- that causal inference is implemented
- that formal verification is implemented
- that review or block decisions are made here
- that policy can be activated automatically
- that repo-side readiness equals live deployment readiness
