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

Before scoring, the fusion function runs `assertLayerOpinionRuntimeInvariants()`
on every `LayerOpinion`. This keeps the belief mass conservation and envelope
binding requirements behavioral at the fusion boundary, not only TypeScript
shape claims.

The function also canonicalizes calculation order before scoring:

```text
opinions sorted by opinionId
relationships sorted by relationshipId
modulators sorted by modulatorId
contributions sorted by source kind and source id
threshold-relevant scores normalized to fixed decimal precision
```

This makes shuffled input ordering produce identical fusion output for the same
evidence set.

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

These result claims are runtime-asserted before the result is returned. If a
hard-floor signal enters fusion, the result must carry
`hard-floor-preserved`, must retain hard-floor block pressure, and must not
return `clear`. If the fused score would fall below the maximum raw input
hazard, fusion throws instead of returning a misleading
`monotoneNoLoosening = true` result.

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

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
