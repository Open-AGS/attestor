# Modulator Authority Tier

Status: Step 04 repo-side contract. This is a types-only shape for context
modulators. It is not fusion math, not learning, not policy activation, not
runtime enforcement, and not production readiness.

## Decision

The Modulator Authority Tier records context that can change how later layers
interpret advisory signals. It does not decide whether an action can run. It
cannot override a hard deny, grant authority, lower review requirements, or mark
an action safe.

The exported version is:

```text
attestor.modulator-authority-tier.v1
```

The package exports:

```text
ContextModulator
ModulatorAuthorityRule
ModulatorAuthorityTierContract
modulatorAuthorityTierDescriptor()
```

## Modulator Dimensions

Step 04 covers five context dimensions:

| Dimension | Why it matters |
|---|---|
| reversibility | irreversible or bounded consequences require stricter handling later |
| blast-radius | tenant, cross-tenant, and systemic consequences change review pressure |
| tenant-maturity | new and low-observation tenants should not be treated like mature tenants |
| coverage | low or unknown coverage should become visible uncertainty |
| freshness | stale or unknown freshness should not be silently accepted |

These dimensions are inputs to later fabric/fusion work. They are not verdicts.

## Authority Classes

Allowed modulator authority classes:

```text
context-only
tightening-only
review-pressure-only
measurement-degraded-only
```

The tier is intentionally monotone. It can preserve or increase caution. It
cannot make an action safer.

## Allowed Effects

Allowed effects:

```text
increase-review-pressure
increase-block-pressure
raise-evidence-requirement
preserve-hard-floor
mark-context-degraded
mark-coverage-insufficient
mark-freshness-risk
narrow-scope-only
```

No effect can lower review pressure, suppress hard deny, grant authority, or
activate enforcement.

## Context Snapshot

Each modulator carries a typed context snapshot:

```text
reversibilityClass
blastRadiusEstimate
tenantMaturityClass
coveragePosture
freshnessPosture
contextFit
```

The snapshot is digest/evidence referenced through the Signal Relationship and
LayerOpinion contracts. It is not allowed to carry raw prompts, provider bodies,
wallet material, payment detail, customer identifiers, tenant identifiers, or
private thresholds.

## No-Loosening Invariants

Every modulator and rule keeps these invariants:

```text
contextOnly = true
monotoneOnly = true
preservesHardFloor = true
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
mayLowerRequiredReview = false
maySuppressHardDeny = false
mayMarkSafe = false
mayStoreRawMaterial = false
productionReady = false
```

## Primary Source Anchors

- STPA / STAMP: whether a control action is unsafe depends on process model,
  feedback, timing, and context. The modulator tier preserves that context
  without making the decision.
- NASA runtime assurance: advanced controller context belongs behind a trusted
  assurance boundary; this tier is context input only.
- NIST AI RMF Map/Measure language: impact, context, uncertainty, and validity
  should be explicit, but this contract does not claim conformance.
- Google SRE overload/risk-budget practice: budget and pressure signals are
  operational context, not permission to bypass safety.

## Non-Claims

This file does not claim:

- that modulator evaluation is implemented
- that fusion math is implemented
- that context can approve or activate policy
- that hard denies can be overridden
- that review requirements can be lowered
- that repo-side readiness equals live deployment readiness
