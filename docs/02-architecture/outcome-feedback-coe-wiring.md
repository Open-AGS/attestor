# Outcome Feedback / COE Wiring

Status: implemented I13 contract slice. This is a digest-only, read-only
assurance-case wiring layer for outcome feedback and Correction-of-Error style
review material. It is not a policy activation component, not live enforcement,
not a reviewer decision, not COE conformance, and not production readiness.

Version: `attestor.outcome-feedback-coe-wiring.v1`

## Decision

`attestor.outcome-feedback-coe-wiring.v1` reads the I00 assurance case and the
existing outcome/incident feedback contract:

```text
Assurance Case Contract
  + Outcome Incident Feedback Contract
  + optional digest-bound COE references
  -> Outcome Feedback / COE Wiring
```

It answers one narrow question:

```text
does observed outcome feedback support the claim, or does it rebut the claim?
```

Clean, direct, learning-ready feedback creates an evidence node. Failed,
contested, reversed, near-miss, confirmed-incident, replay-regression, or impact
feedback opens a `rebutting` defeater against the target claim. Missing COE
material stays visible as findings on the same rebutting path; it never hides
the negative outcome.

## Files

```text
src/consequence-admission/outcome-feedback-coe-wiring.ts
tests/outcome-feedback-coe-wiring.test.ts
docs/02-architecture/outcome-feedback-coe-wiring.md
```

Package script:

```bash
npm run test:outcome-feedback-coe-wiring
```

## Source Anchors

| Anchor | Imported rule |
|---|---|
| AWS Correction of Error | Incidents should produce systemic action items, not stop at human error. I13 requires COE material and action items for negative outcome learning. |
| Google SRE postmortem culture | Postmortems are blameless, action-oriented, and used for learning. I13 maps contradictory outcomes into rebutting defeaters instead of silent tuning. |
| NIST SP 800-61 Rev. 3 | Incident response includes post-incident activity and lessons learned. I13 treats incident/postmortem feedback as review/replay material first. |
| NIST AI RMF Manage | Feedback is managed risk input, not a hidden actuator. I13 never mutates policy, scores, calibration, or enforcement. |
| MIT STPA | Unsafe control actions and observed losses feed constraints back into the control model. I13 opens claim-level rebutting defeat for contradictory outcomes. |
| Assurance 2.0 / Eliminative Argumentation | Contradictory outcome evidence rebuts the claim. I13 emits an open rebutting defeater, not an auto-fix. |

These are engineering anchors only. They do not make this slice AWS COE, Google
SRE, NIST, STPA, or formal assurance-case conformant.

## Contract

The primary builder is:

```text
createOutcomeFeedbackCoeWiring(input)
```

Required inputs:

```text
assuranceCase             I00 AssuranceCaseContract
feedback                  OutcomeIncidentFeedbackContract
wiringId
evaluatedAt
evaluatorRefDigest
```

Optional inputs:

```text
targetClaimNodeId         defaults to the assurance-case root claim
coe                       digest-bound COE references
minimumActionItemCount    default: 1
evidenceNodeId
defeaterId
boundary request booleans
```

The COE reference object is digest-only:

```text
coeRefDigest
impactRefDigest
timelineRefDigest
fiveWhysRefDigest
actionItemDigests
```

## Findings

I13 flags these feedback and COE conditions:

```text
no-feedback-events
only-inferred-feedback
assurance-packet-not-ready
feedback-no-go-reasons-open
failed-outcome-observed
contested-outcome-observed
reversed-outcome-observed
near-miss-outcome-observed
confirmed-incident-observed
customer-impact-observed
tenant-impact-observed
systemic-impact-observed
replay-regression-required
blocked-mutation-requested
coe-reference-missing
coe-impact-missing
coe-timeline-missing
coe-five-whys-missing
coe-action-items-missing
```

Direct boundary requests are rejected:

```text
raw-feedback-requested
raw-payload-requested
audit-write-requested
policy-activation-requested
live-enforcement-requested
authority-action-requested
```

## Outcomes

```text
outcome-feedback-coe-evidence-ready
outcome-feedback-coe-open-rebutting-defeater
outcome-feedback-coe-held-for-feedback-binding
outcome-feedback-coe-rejected-boundary
```

Mapping:

```text
clean direct learning-ready feedback
  -> evidence node

failed, contested, reversed, near-miss, incident, impact, or replay-triggering
feedback
  -> open rebutting defeater

no feedback, inferred-only feedback, unready packet, or non-negative feedback
with open no-go reasons
  -> held for feedback binding, no trusted case material

raw feedback/payload, audit write, policy activation, live enforcement,
or authority action requested directly from I13
  -> rejected boundary, no trusted case material
```

## Invariants

```text
digest-only
read-only
assurance case is not mutated
feedback contract is not mutated
no raw feedback
no raw payload
no audit write
no policy activation
no live enforcement
no authority action
no learning
no training
not a reviewer decision
```

Feedback may become evidence or rebutting defeat material. It cannot become
authority. Negative outcome feedback is never allowed to silently tune scores,
calibration, policy, enforcement, or model training.

## Non-Claims

The descriptor exposes these non-claims:

```text
not-policy-activation
not-live-enforcement
not-feedback-authority
not-assurance-case-mutation
not-defeater-closure
not-review-decision
not-learning
not-training
not-production-readiness
not-coe-conformance
```

## Role In The Tracker

I13 closes the Runtime Intelligence Activation v1 tracker by converting the
feedback loop into assurance-case material:

```text
I00 assurance case
  -> I11 digest-bound lineage graph
  -> I12 measurement-as-authority guard
  -> I13 outcome feedback / COE wiring
```

I13 does not introduce a second decision engine. It feeds the same assurance
case fabric with post-outcome evidence or open rebutting defeaters so future
review and replay can see what the real world contradicted.
