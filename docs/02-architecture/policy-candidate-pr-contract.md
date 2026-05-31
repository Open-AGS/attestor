# Policy Candidate PR Contract

Status: repository-side Step 17 contract for the unified Shadow-to-Policy plan.
This is not enforcement activation, not policy correctness proof, not a
production policy store, and not automatic policy activation.

## Decision

The Policy Candidate PR contract sits after the evidence state model:

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR contract
  -> active questions
  -> replay / backtest / review
  -> approval packet
```

Its job is narrow: turn each tenant-bound evidence-state surface into review
material that can be represented as a candidate diff. It does not write a live
policy bundle, deploy an admission rule, or mark a generated candidate
enforceable.

The next repository-side layer is the [Active Question Engine](active-question-engine.md),
which ranks the smallest high-impact human questions from these candidate
diffs.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/policy-candidate-pr-contract.ts`.

Version:

```text
attestor.policy-candidate-pr-contract.v1
```

Every contract is bound to:

```text
evidenceStateModelDigest
graphDigest
tenantRefDigest
schemaDigest
basePolicyBundleDigest?
```

Every candidate is bound to:

```text
surfaceId
actionSurface
sourceEvidenceStateDigest
sourceEvidenceModelDigest
sourceGraphDigest
sourceEventDigests[]
schemaDigest
basePolicyBundleDigest?
```

The `sourceEventDigests[]` field is the bridge back to the shadow evidence. It
keeps the candidate traceable without storing raw prompts, provider bodies,
customer payloads, wallet material, or private identifiers.

## Candidate Shape

Each candidate records:

| Field | Meaning |
|---|---|
| `diffKind` | Review-only shape of the proposed change. |
| `approvalState` | Human-review state. |
| `riskScore` / `riskBand` | Deterministic candidate triage signal, not an LLM judgment. |
| `replayDigest` | Digest of replay/backtest evidence when available. |
| `questionDigests` | Digest-only references to active human questions. |
| `inferredFields` | Evidence-state fields that remain inference, not facts. |
| `missingEvidenceFields` | Evidence-state fields requiring digest-bound evidence. |
| `blockerReasonCodes` | Fail-closed reasons that keep the candidate in shadow. |
| `proposedPolicyDigest` | Digest of the candidate policy draft. |
| `proposedPolicyPatch` | Digest-only review patch; no raw policy DSL or private thresholds. |
| `reviewChecklist` | Minimal human work needed before approval. |

Allowed `diffKind` values:

```text
add-policy-candidate
add-evidence-requirement
add-review-gate
keep-shadow
```

Allowed `approvalState` values:

```text
draft
blocked
needs-answer
approval-ready
approved
```

The contract fails closed if a caller tries to mark a blocked candidate as
reviewable or approved, or if an approval-ready/approved state lacks replay
digest evidence.

## Invariants

Every bundle and candidate carries the same no-auto-enforcement boundary:

```text
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
productionReady = false
reviewMaterialOnly = true
```

This is the core safety boundary. A candidate PR can be reviewed, replayed,
approved, dismissed, or used as input to a later promotion packet. It cannot
itself activate enforcement.

## Review Flow

```text
clean evidence + replay digest
  -> add-policy-candidate
  -> approval-ready

clean evidence + active questions
  -> add-review-gate
  -> needs-answer

missing evidence
  -> add-evidence-requirement
  -> blocked

conflicting / stale / untrusted evidence
  -> keep-shadow or evidence requirement
  -> blocked
```

The human work is intentionally narrow:

```text
answer active questions
bind missing digest-only evidence
resolve conflicts
refresh stale evidence
approve or replace untrusted producer
approve or dismiss the candidate
```

The human should not have to inspect raw payloads or write a full policy DSL
just to decide whether a candidate is ready for deeper replay and promotion.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
  anchors the pattern of generating a policy template from observed activity,
  then requiring review, customization, creation, and attachment as separate
  steps.
- [Google Cloud role recommendations](https://cloud.google.com/policy-intelligence/docs/role-recommendations-overview)
  anchors the use of observation windows and recommendation review rather than
  unreviewed permission changes.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html)
  anchors schema-backed policy validation against known entity, action,
  principal, resource, and context shapes.
- [OPA policy testing](https://www.openpolicyagent.org/docs/policy-testing)
  anchors policy tests as first-class artifacts before policy changes are
  trusted.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchors auditable policy queries and masked/erased sensitive decision-log
  fields.
- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan)
  anchors reviewable planned changes before applying infrastructure changes.
- [Kubernetes dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run)
  anchors evaluating mutating requests through validation/admission without
  persisting side effects.

These sources are engineering anchors only. They do not certify Attestor
policy correctness, target-system integration, customer approval, production
deployment, or compliance readiness.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It is the review-only candidate diff layer that lets the next step ask the
smallest useful human questions without hiding evidence uncertainty.
