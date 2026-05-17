# Review-by-Exception Inbox

Status: repository-side Step 21 contract for the unified Shadow-to-Policy plan.
This is not approval automation, not a production task queue, not live
target-system workflow integration, and not automatic policy activation.

## Decision

The Review-by-Exception Inbox sits after the
[Policy Twin Backtest](policy-twin-backtest.md):

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
```

Its job is narrow: turn candidate and backtest results into the smallest useful
set of human work items. It groups by candidate, not by event, so reviewers do
not have to inspect every shadow action or replay fixture.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/review-by-exception-inbox.ts`.

Version:

```text
attestor.review-by-exception-inbox.v1
```

The inbox consumes:

```text
PolicyCandidatePrContract
PolicyTwinBacktestResult
```

The source digests must match:

```text
policyCandidatePrContractDigest
policyTwinBacktestDigest
tenantRefDigest
graphDigest
schemaDigest
```

A Policy Twin result generated for a different candidate contract, tenant,
graph, or schema fails closed.

## Lanes

Every candidate becomes at most one item in exactly one lane:

| Lane | Required action | Meaning |
|---|---|---|
| `failed-replay` | `fix-replay` | A counterexample was admitted or a fixture outcome mismatched expected posture. |
| `blocked-by-evidence` | `provide-evidence` | Evidence, replay digest, source event, counterexample, or historical block proof is missing. |
| `needs-answer` | `answer-question` | A narrow business or approval question remains open. |
| `ready-to-approve` | `approve-candidate` | Candidate is approval-ready and passed backtest without no-go reasons. |
| `monitoring-only` | `monitor` | Candidate was already approved and passed backtest, so it is hidden from the default work queue. |

Lane priority is conservative:

```text
failed-replay
  > blocked-by-evidence
  > needs-answer
  > ready-to-approve
  > monitoring-only
```

This means a candidate that looks approval-ready but admits a negative fixture
is routed to `failed-replay`, not to approval.

## Output Shape

The result emits:

```text
status
itemCount
candidateCount
humanActionItemCount
defaultVisibleItemCount
monitoringOnlyCount
laneCounts
approvalPacketReady
items[]
```

Allowed `status` values:

```text
empty
blocked
needs-human-input
ready-for-approval
monitoring-only
```

Each item carries only digest-bound context:

```text
candidateId
surfaceId
actionSurface
candidateApprovalState
candidateRiskBand
candidateRiskScore
sourcePolicyCandidateDigest
sourcePolicyTwinCandidateDigest
sourceEvidenceStateDigest
sourceEventDigests[]
sourceQuestionDigests[]
fixtureDigests[]
noGoReasons[]
reasonCodes[]
reviewContextDigest
```

It does not store raw prompts, provider bodies, downstream payloads, customer
identifiers, wallet material, private thresholds, secrets, raw transaction
payloads, or raw producer strings.

## Review-by-Exception Invariants

Every result records:

```text
oneItemPerCandidate = true
eventLevelItemsCreated = false
noisyEventInspectionRequired = false
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
productionReady = false
reviewMaterialOnly = true
```

The inbox can prepare work for human review. It cannot approve, dismiss,
activate, or enforce a policy candidate by itself.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
  anchors the pattern of generating policy material from observed activity,
  then reviewing, customizing, creating, and attaching as separate steps.
- [Google Cloud role recommendations](https://docs.cloud.google.com/policy-intelligence/docs/review-apply-role-recommendations)
  anchors explicit view, apply, and dismiss permissions plus caution before
  applying recommendations that might affect other access controls.
- [GitHub code scanning alerts](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts)
  anchor alert triage, fixing, dismissing with recorded reason/comment,
  reopening, filtering, and stale-configuration handling.
- [Workato business approvals](https://docs.workato.com/en/agentic/agent-studio/business-approvals.html)
  anchors approval requests assigned to reviewers, stored in data tables, and
  retained as audit trail for compliance, debugging, and reporting.
- [n8n human-in-the-loop tool calls](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/)
  anchors pausing tool execution, showing the requested tool and parameters to
  a reviewer, then approving or denying before tool execution.
- [Camunda agentic orchestration](https://docs.camunda.io/docs/components/agentic-orchestration/agentic-orchestration-overview/)
  anchors human tasks, deterministic rule sets, and AI-driven decisions
  collaborating in one process model.
- [Microsoft Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/)
  anchor contextually relevant information, efficient dismissal/correction,
  scoping when uncertain, explaining why the system acted, and granular
  feedback.

These sources are engineering anchors only. They do not certify Attestor
policy correctness, target-system integration, customer approval, production
deployment, live workflow execution, crypto custody, or compliance readiness.

## Non-Claims

This inbox does not claim:

- policy correctness
- approval automation
- enterprise integration recipe completion
- production task queue readiness
- production policy-store readiness
- live target-system connector coverage
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- crypto custody, wallet, exchange, or transaction broadcasting capability
- compliance certification
- automatic policy activation
- completion of Step 25 Spend, procurement, data, IAM, health, and insurance recipes

It is the digest-bound triage layer that lets the next step turn approvals,
dismissals, stricter-version requests, threshold edits, and rollback decisions
into structured feedback. That next contract is the
[Approval/Dismiss Feedback Loop](approval-dismiss-feedback-loop.md).
