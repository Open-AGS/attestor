# Signal Relationship Contract

Status: Step 02 repo-side contract. This is a types-only shape for signals,
relationships, and monotone interaction rules. It is not fusion math, not
learning, not policy activation, not runtime enforcement, and not production
readiness.

## Decision

The Signal Relationship Contract is the first typed layer after the Consequence
Envelope. It records what each signal claims to know, what it cannot know, what
evidence it read, and how signals relate before any hazard fusion runs.

The exported version is:

```text
attestor.signal-relationship-contract.v1
```

The package exports:

```text
SignalRelationshipSignal
SignalRelationship
SignalInteractionRule
SignalRelationshipFabricContract
signalRelationshipContractDescriptor()
```

## Signal Categories

Signals are not a flat enum. Each kind belongs to one category:

| Category | Kinds |
|---|---|
| verdict | hard_floor, hazard, abstention |
| observation | anomaly, prediction, confirmation, contradiction |
| gap | evidence_gap, authority_gap, policy_gap, freshness_gap |
| boundary | tenant_boundary_signal, blast_radius_signal |
| context | reversibility_context, maturity_context, coverage_context |
| measurement | drift_signal, regression_signal, budget_pressure_signal, measurement_degraded_signal |

The category boundary matters because these values do not mean the same thing.
For example, `hazard` is a verdict signal, while `evidence_gap` is a gap signal.
They can participate in the same fabric, but future fusion rules must not treat
them as interchangeable numbers.

## Relationship Shapes

Direction is part of the type:

| Relationship | Shape | Meaning |
|---|---|---|
| confirms | symmetric | Two signals independently support the same hazard or gap. |
| contradicts | symmetric | Two signals disagree enough to raise conflict. |
| duplicates | symmetric | Signals share evidence or learned correlation and must be discounted later. |
| overrides | directed | One higher-authority signal constrains another signal. |
| depends_on | directed | One signal is meaningful only if another input exists. |
| modulates | directed | Context changes threshold, severity, or interpretation. |
| escalates | directed | A signal moves another signal toward stricter handling. |
| suppresses | directed | A higher-trust signal reduces a lower-trust signal's effect. |
| requires_review | unary | One signal alone is enough to force review later. |

This keeps `overrides(A, B)` distinct from `overrides(B, A)` and keeps
`requires_review(A)` distinct from any pairwise relationship.

## Interaction Rules

Interaction rules describe allowable effects, not behavior:

```text
raise-review-pressure
raise-block-pressure
mark-conflict
discount-duplicate-evidence
preserve-hard-floor
mark-dependency-missing
mark-measurement-degraded
```

Every interaction rule is monotone by contract:

```text
noLoosening = true
mayGrantAuthority = false
mayActivateEnforcement = false
mayLowerRequiredReview = false
mayStoreRawMaterial = false
productionReady = false
```

The rule can explain why later processing should be stricter or more cautious.
It cannot make an action safer, grant authority, lower review requirements, or
activate enforcement.

## Relationship Before Fusion

Relationship evaluation must happen before fusion. The reason is practical:
duplicate evidence, conflicting signals, missing dependencies, or hard-floor
preservation must be known before any later score or packet is computed.

This contract only records the shape:

```text
consequence envelope
  -> category-bound signals
  -> typed relationships
  -> monotone interaction rules
  -> later fusion/review/packet work
```

## Primary Source Anchors

- STPA / STAMP: complex losses can come from unsafe interactions between
  components even when individual components have not failed.
- STPA control-structure review: responsibilities, traceability, conflicts,
  gaps, control actions, and feedback should be explicit.
- NRC fault tree work: fault/event analysis codifies system relationships and
  dependency structures, but this contract does not claim probabilistic fault
  tree correctness.
- Pearl causality: causal and dependency structure should be separated from
  simple correlation; this contract records relationship type and direction.
- NIST AI RMF: risk management depends on lifecycle context, measurement, and
  uncertainty; this contract is mapping/evidence structure, not conformance.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
