# Approval/Dismiss Feedback Loop

Status: repository-side Step 22 contract for the unified Shadow-to-Policy plan.
This is not approval automation, not policy mutation, not model retraining, not
live target-system workflow integration, and not automatic policy activation.

## Decision

The Approval/Dismiss Feedback Loop sits after the
[Review-by-Exception Inbox](review-by-exception-inbox.md):

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR contract
  -> active question engine
  -> counterexample replay generator
  -> policy twin backtest
  -> review-by-exception inbox
  -> approval/dismiss feedback loop
  -> enterprise integration recipes
```

Its job is narrow: turn reviewer decisions into structured, digest-bound
feedback. Approval can mark a candidate as ready for the next approved-candidate
artifact. Dismissal can close a candidate. Stricter-version requests, threshold
edits, and rollback decisions require a new candidate. None of these feedback
events directly mutate a policy bundle, activate enforcement, or retrain a
model.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/approval-dismiss-feedback-loop.ts`.

Version:

```text
attestor.approval-dismiss-feedback-loop.v1
```

The feedback loop consumes:

```text
ReviewByExceptionInboxResult
ApprovalDismissFeedbackInput[]
```

Every input feedback item must bind:

```text
itemId
itemDigest
reviewContextDigest
reviewerRefDigest
reasonDigest
```

The `reviewContextDigest` behaves like a review-time state binding. If the
review item changed since the reviewer saw it, the feedback fails closed instead
of applying to stale material.

## Feedback Actions

Allowed actions:

| Action | Accepted when | Output |
|---|---|---|
| `approve-candidate` | Item is in `ready-to-approve` and not approval-blocked. | `candidate-approved` |
| `dismiss-candidate` | Item requires human action. | `candidate-dismissed` |
| `request-stricter-version` | Item requires human action. | `new-candidate-required` |
| `edit-threshold` | Item is `ready-to-approve` or `needs-answer`. | `new-candidate-required` |
| `request-rollback` | Item is `monitoring-only` or `ready-to-approve`. | `new-candidate-required` |

If an action is structurally valid but not allowed for the lane, the loop emits
`feedback-blocked`. It does not silently coerce the decision.

## Digest-Only Payloads

Threshold edits record only structural field names and digests:

```text
thresholdField
beforeDigest
afterDigest
unitDigest
```

Rollback and stricter-version requests are also digest-only:

```text
requestedConstraintDigest
requestedReasonDigest
rollbackPlanDigest
rollbackScopeDigest
rollbackReasonDigest
```

The contract does not store raw thresholds, raw reviewer comments, customer
identifiers, wallet material, raw transaction payloads, provider bodies,
secrets, or downstream error bodies.

## Output Shape

The result emits:

```text
status
feedbackCount
acceptedFeedbackCount
blockedFeedbackCount
newCandidateRequiredCount
counts
events[]
```

Allowed `status` values:

```text
empty
feedback-recorded
new-candidate-required
blocked
```

Each event carries:

```text
eventDigest
action
outcome
accepted
requiresNewCandidate
candidateMayAdvanceToApproved
sourceItemDigest
sourceReviewContextDigest
sourcePolicyCandidateDigest
sourcePolicyTwinCandidateDigest
reviewerRefDigest
reasonDigest
feedbackContextDigest
```

## Invariants

Every result records:

```text
requiresReviewContextDigest = true
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
mutatesPolicyBundle = false
updatesPolicyCandidate = false
retrainsModel = false
rawPayloadStored = false
productionReady = false
structuredFeedbackOnly = true
```

The feedback loop can record a reviewer decision. It cannot activate,
enforce, rollback, rewrite thresholds, or train anything by itself.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
  anchors observed-activity policy material followed by review, customization,
  creation, and attachment as separate steps.
- [Google Cloud Recommender state metadata](https://cloud.google.com/recommender/docs/use-api)
  anchors recommendation state transitions and metadata such as claiming,
  marking succeeded, and marking dismissed rather than treating a suggestion as
  automatically applied.
- [Google Cloud role recommendations](https://docs.cloud.google.com/policy-intelligence/docs/review-apply-role-recommendations)
  anchors review, apply, dismiss, and restore flows for recommendation
  handling.
- [GitHub code scanning alert triage](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts)
  anchors fixing, dismissing with reason/comment, reopening, filtering, and
  stale-configuration handling.
- [Workato business approvals](https://docs.workato.com/en/agentic/agent-studio/business-approvals.html)
  anchors reviewer assignment, decision capture, and audit trail for agentic
  approval requests.
- [n8n human-in-the-loop tool calls](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/)
  anchors approve/deny handling before tool execution.
- [Camunda human tasks](https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/)
  anchor human task assignment and completion as explicit workflow state.
- [Microsoft Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/)
  anchor efficient dismissal, correction, scoped behavior under uncertainty,
  and granular feedback.

These sources are engineering anchors only. They do not certify Attestor
policy correctness, target-system integration, customer approval, production
deployment, live workflow execution, crypto custody, or compliance readiness.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It is the digest-bound feedback layer that lets the next step package
enterprise integration recipes around structured approvals, dismissals,
stricter-version requests, threshold edits, and rollback requests.
