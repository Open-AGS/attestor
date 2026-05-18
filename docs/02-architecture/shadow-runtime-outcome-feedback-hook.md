# Shadow Runtime Outcome Feedback Hook

Status: R07 runtime activation slice. This is a shadow-only, pure-value hook. It
does not write audit records, close defeaters, activate policy, mutate scoring,
train a model, or run live enforcement.

## Decision

`attestor.shadow-runtime-outcome-feedback-hook.v1` binds the R06 observability
result to digest-bound outcome feedback:

```text
R06 observability result
  + outcome incident feedback
  -> Outcome Feedback COE Wiring
  -> derived assurance-case value
  -> digest-bound lineage graph
```

The hook requires the feedback contract's `assurancePacketDigest` to match the
runtime monitor packet digest from R06. If the packet does not match, the hook
fails closed. This keeps outcome feedback attached to the exact shadow runtime
packet it is describing.

Version bindings:

- `attestor.shadow-runtime-observability-hooks.v1`
- `attestor.outcome-incident-feedback-contract.v1`
- `attestor.outcome-feedback-coe-wiring.v1`
- `attestor.assurance-case.v1`
- `attestor.decision-lineage-graph.v1`

## Inputs

- `ShadowRuntimeObservabilityHooksResult`
- `OutcomeIncidentFeedbackContract`
- evaluator digest
- evaluated timestamp
- optional COE references:
  - COE reference digest
  - impact reference digest
  - timeline reference digest
  - Five Whys reference digest
  - action item digests

The inputs are read-only. The hook builds a new derived assurance-case value when
COE wiring contributes an evidence node or opens a rebutting defeater.

## Outputs

- `OutcomeFeedbackCoeWiringRecord`
- derived `AssuranceCaseContract`
- `DecisionLineageGraphRecord`
- reason codes naming the outcome feedback posture
- no-authority boundary flags

Negative, contested, reversed, near-miss, confirmed incident, replay regression,
customer-impact, tenant-impact, or systemic-impact feedback can open a rebutting
defeater through the existing COE wiring contract. Clean feedback can only become
evidence if the COE wiring has no open findings.

## Anchors

- AWS Correction of Error: systemic action-item discipline
- Google SRE postmortem practice: blameless operational feedback
- W3C PROV: digest-bound outcome feedback lineage
- NIST AI RMF Manage: feedback loop remains managed, not autonomous authority
- Assurance 2.0 / eliminative argumentation: contradictory outcomes become
  rebutting defeaters

## Non-Claims

This hook is:

- not audit-plane write
- not external lineage export
- not policy activation
- not score mutation
- not calibration mutation
- not learning activation
- not training activation
- not live enforcement
- not production readiness

## Next

R08 adds the end-to-end fixture replay smoke that exercises the R02-R07 runtime
activation path with synthetic shadow traffic.
