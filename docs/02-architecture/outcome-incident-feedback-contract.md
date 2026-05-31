# Outcome And Incident Feedback Contract

Status: Step 09 repo-side deterministic contract and pure feedback builder.
This is not a learning system, not an incident-management product, not policy
mutation, and not runtime enforcement.

## Decision

Outcome feedback is a typed evidence stream after the signed assurance packet.
It separates what happened from what the system is allowed to change.

The exported version is:

```text
attestor.outcome-incident-feedback-contract.v1
```

The package exports:

```text
OutcomeIncidentFeedbackContract
outcomeIncidentFeedbackContractDescriptor()
createOutcomeIncidentFeedbackContract()
```

## Source Classes

Feedback sources are not equivalent:

```text
downstream-receipt
reviewer-label
confirmed-incident
operator-annotation
inferred-signal
```

An inferred signal cannot close feedback alone. A confirmed incident is stronger
than a reviewer label. A downstream receipt is not the same as a postmortem.
The contract keeps these source classes separate instead of flattening them
into one ground-truth field.

## State Path

The happy path is first-class:

```text
admitted -> executed -> receipted -> learned
```

The incident path is also first-class:

```text
admitted -> executed -> contested -> reversed -> incident -> postmortem -> learned
```

The contract records contested, reversed, incident, and postmortem states as
regression or incident-review triggers. It does not allow those states to become
silent learning signals.

## Bounded Mutation Rules

Feedback may request changes, but this contract blocks every automatic mutation:

```text
policy-update
score-update
model-training
enforcement-activation
measurement-update
```

Every requested mutation is recorded as blocked evidence. Future humans or
reviewed PRs can use the evidence, but the feedback contract itself cannot
mutate policy, scoring, calibration, measurement, enforcement, or model
training data.

## Invariants

Every output keeps these invariants:

```text
feedbackInputOnly = true
automaticPolicyMutationAllowed = false
automaticScoreMutationAllowed = false
automaticCalibrationMutationAllowed = false
llmTrainingAllowed = false
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
rawPayloadStored = false
productionReady = false
```

## Primary Source Anchors

- NIST SP 800-61 Rev. 3: incident response should be incorporated into
  cybersecurity risk management across preparation, detection, response, and
  recovery. This contract maps incident feedback into bounded evidence without
  claiming NIST conformance.
- Google SRE postmortem culture: incidents should produce written records of
  impact, mitigation or resolution actions, causes, and follow-up actions. This
  contract requires digest-bound incident, postmortem, replay, and action-item
  references for incident paths.
- NIST AI RMF: risk management is iterative across govern, map, measure, and
  manage. This contract feeds measurement and review without turning feedback
  into automatic decision authority.
- MIT STPA: unsafe control actions depend on control and feedback paths. This
  contract treats missing, late, contested, and reversed outcomes as feedback
  path evidence that can trigger replay regression.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.
