# LayerOpinion Schema

Status: Step 03 repo-side contract. This is a types-only shape for advisory
layer output. It is not scoring behavior, not fusion, not learning, not policy
activation, not runtime enforcement, and not production readiness.

## Decision

LayerOpinion is the output shape for advisory intelligence layers before
relationship-aware fusion. A layer opinion can report hazard, gap, conflict,
uncertainty, abstention, or no advisory objection. It cannot decide that an
action is safe.

The exported version is:

```text
attestor.layer-opinion-schema.v1
```

The package exports:

```text
LayerOpinion
LayerOpinionSignalProjection
LayerOpinionBeliefMass
LayerOpinionAbstention
LayerOpinionSourceDependence
assertLayerOpinionRuntimeInvariants()
layerOpinionSchemaDescriptor()
```

## Layer Scope

The schema covers the planned advisory layers:

| Layer | Source plane |
|---|---|
| layer-1-formal-verification | formal-verification |
| layer-2-shadow-baseline | shadow-baseline |
| layer-3-spatial-topology | spatial-topology |
| layer-4-temporal-trajectory | temporal-trajectory |
| layer-5-collective-intelligence | collective-intelligence |

These outputs are inputs to the Signal Relationship Fabric. They do not replace
Tier 1 hard gates, policy decisions, customer authority, or reviewer approval.

## Advisory Position

Allowed positions:

```text
hazard-indicated
gap-indicated
conflict-indicated
uncertainty-indicated
abstained
no-advisory-objection
```

`no-advisory-objection` is intentionally not a safety claim. It only means the
layer did not add an advisory objection. It cannot lower review pressure,
override a hard floor, or authorize an action.

## Uncertainty And Abstention

Every opinion carries:

```text
hazardScore
uncertainty
calibratedConfidence
evidenceQuality
novelty
contextFit
calibrationState
beliefMass
abstention
sourceDependence
```

The belief mass contract is runtime-checked before relationship-aware fusion:

```text
hazard + noAdvisoryObjection + uncertainty = 1
```

Abstention is first-class. A layer can explicitly say that it should not be used
because coverage is insufficient, the input is out of distribution, evidence is
missing, inputs conflict, measurement is degraded, the layer is not applicable,
or a dependency is missing.

This follows the engineering rule that uncertainty should become visible
review pressure, not hidden permission.

## Source Dependence

Every opinion records the evidence and read models it depends on:

```text
dependsOnEnvelope = true
evidenceRefDigests
readModelDigests
relationshipIds
rawTrainingDataAccess = false
crossTenantRawDataAccess = false
```

This keeps later duplicate-discount, conflict detection, and replay regression
work from treating correlated opinions as independent.

## No-Loosening Invariants

Every opinion is advisory-only:

```text
advisoryOnly = true
noLoosening = true
mayGrantAuthority = false
mayActivateEnforcement = false
mayLowerRequiredReview = false
mayMarkSafe = false
mayStoreRawMaterial = false
mayTrainModel = false
productionReady = false
```

The layer can reveal why a consequence may be unsafe or uncertain. It cannot
make a consequence safe.

## Primary Source Anchors

- STPA / STAMP: unsafe control actions and inadequate feedback are
  context-dependent; advisory output must preserve context and uncertainty.
- NASA runtime assurance: advanced or untrusted reasoning belongs behind a
  trusted assurance boundary; this schema is input evidence, not authority.
- Conformal prediction: abstention and uncertainty are valid first-class
  outputs when evidence does not support confident classification.
- NIST AI RMF: uncertainty, validity, reliability, and measurement boundaries
  should be made explicit; this schema records those fields without claiming
  conformance.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
