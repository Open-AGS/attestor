# Assurance Measurement Plane

Status: Step 10 contract for the Consequence Runtime Assurance sequence. This
is not a production monitoring claim, not a NIST AI RMF conformance claim, not
an SRE maturity claim, and not a decision-authority surface.

## Purpose

The Assurance Measurement Plane answers one question:

```text
Is the decision system itself working?
```

It is a read-only observer over digest-bound audit evidence, outcome feedback,
replay regression, review load, budget pressure, drift signals, and degraded
measurement-state signals.

It can report quality, drift, regression failure, budget pressure, and degraded
visibility. It cannot admit an action, relax policy, tune enforcement, mutate a
score, train a model, or write audit history.

## Source Anchors

Reviewed on 2026-05-17:

- NIST AI RMF Core: govern, map, measure, and manage are lifecycle functions,
  and measure is part of continuous risk management rather than a one-time
  checklist.
- Google SRE service-level objectives and error budgets: objective metrics and
  neutral monitoring can guide operational planning, while budgets must not hide
  correctness or user-impact failures.
- NIST CUSUM control charts: cumulative-sum monitoring is useful for detecting
  shifts in a measured process.
- MIT STPA Handbook: leading indicators and unsafe control-action analysis
  frame measurement as system safety evidence, not as component-only scoring.
- NIST SP 800-61 Rev. 3: incident response evidence should improve detection,
  response, and recovery activities without claiming completion from a metric.
- OWASP Agentic AI threats and mitigations: agentic systems create evolving
  tool/action risk that must be measured and regression-tested.

These are engineering anchors only. They do not prove production readiness,
compliance certification, live deployment, or mathematical correctness.

## Contract Shape

The TypeScript contract is:

```text
src/consequence-admission/assurance-measurement-plane.ts
tests/assurance-measurement-plane.test.ts
```

The measurement input contains:

```text
outcomeFeedback
auditEvidenceRefDigests
metricWindow
replayRegressionObservations
budgetScopes
driftWindows
degradedSignals
requestedMetricUses
```

Every external source reference is digest-bound. Raw prompts, raw tool payloads,
raw provider bodies, tenant identifiers, customer identifiers, downstream error
bodies, wallet material, payment detail, and private thresholds do not belong in
this contract.

## Metrics

Initial metrics:

```text
false-review-rate
false-admit-risk-count
abstention-rate
review-load
duplicate-evidence-discount-rate
conflict-trigger-rate
policy-gap-closure-rate
time-to-human-decision
drift-signal-rate
regression-replay-pass-rate
budget-pressure-rate
measurement-degraded-time
```

The metrics are planning and visibility signals. They do not directly tune
policy, thresholds, fusion, model behavior, enforcement, or admission decisions.

## Goodhart Protection

Allowed metric uses:

```text
operator-dashboard
regression-prioritization
budget-planning
```

Blocked metric uses:

```text
policy-relaxation
score-calibration
model-training
enforcement-activation
```

This is the Goodhart boundary: a measurement can become operator or regression
evidence, but it is not a gradient source for making the system more permissive.

## Drift And Regression

Drift windows use a deterministic CUSUM-style contract:

```text
positiveCusum = max(0, previous + sample - baselineMean - slack)
negativeCusum = max(0, previous + baselineMean - slack - sample)
driftDetected = positiveCusum > threshold OR negativeCusum > threshold
```

This is only a contract-level drift signal. It is not a calibrated statistical
guarantee and not a production anomaly detection claim.

Replay observations report pass/fail/skipped counts. A failed replay or
previous outcome-feedback replay trigger makes the measurement status
`regression-required`.

## Budget Accounting

Budgets are scoped:

```text
tenant
consequence-class
actor-class
target-system
time-window
```

A global review cap is not sufficient. Budget exhaustion must not fall open.
The budget result always records:

```text
fallsOpen: false
```

Overflow and elevated pressure become visible operator work, not hidden
admission authority.

## Degraded Mode

If measurement itself is degraded, the fabric can still evaluate decisions, but
dashboard and review surfaces need an explicit degraded-state signal:

```text
measurement-degraded
```

The failure is visible, not silent.

## Dashboard Contract

The dashboard contract is read-only:

```text
metric-health
drift
regression
budget
degraded-state
incident-review
```

The dashboard may show alerts and operator tasks. It cannot approve, admit,
block, mutate policy, trigger enforcement, write audit history, or train a
model.

## Non-Claims

This contract does not claim:

- production monitoring readiness
- NIST AI RMF conformance
- SRE maturity
- incident-response completion
- calibrated anomaly detection
- statistical confidence guarantees
- automatic policy tuning
- automatic score or calibration mutation
- model training readiness
- enforcement activation
- audit-plane write authority
- live dashboard implementation
