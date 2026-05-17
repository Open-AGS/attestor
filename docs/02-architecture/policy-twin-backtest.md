# Policy Twin Backtest

Status: repository-side Step 20 contract for the unified Shadow-to-Policy plan.
This is not policy correctness proof, not production policy-store readiness,
not live target-system replay, and not automatic policy activation.

## Decision

The Policy Twin Backtest sits after the
[Counterexample Replay Generator](counterexample-replay-generator.md):

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR contract
  -> active question engine
  -> counterexample replay generator
  -> policy twin backtest
  -> review-by-exception inbox
```

Its job is narrow: bind candidate PR material and counterexample fixtures into
a deterministic backtest report. It reports what the candidate would do to the
historical shadow-event set, whether negative fixtures stayed non-admitted, how
much review load changes, and which no-go reasons remain. It does not execute
customer traffic, call downstream systems, use credentials, or activate
enforcement.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/policy-twin-backtest.ts`.

Version:

```text
attestor.policy-twin-backtest.v1
```

The backtest consumes:

```text
PolicyCandidatePrContract
CounterexampleReplayGeneratorResult
optional fixture outcome records
```

Every result is bound to:

```text
policyCandidatePrContractDigest
counterexampleReplayGeneratorDigest
tenantRefDigest
graphDigest
schemaDigest
```

The source digests must match. A counterexample packet generated for a
different candidate contract, tenant, graph, or schema fails closed.

## Output Shape

The top-level report emits:

```text
status
promotionBlocked
historicalEventCount
fixtureCount
missedEvidenceCount
unresolvedQuestionCount
missingReplayDigestCount
falseAdmitRiskCount
counterexampleOutcomeMismatchCount
noGoReasons[]
candidateResults[]
fixtureResults[]
```

Allowed `status` values:

```text
not-enough-evidence
review-required
counterexamples-failed
backtest-passed
```

Allowed decision values:

```text
admit
review
hold
block
```

The historical decision projection is intentionally conservative:

```text
blocked or missing-evidence candidate -> block
approval-ready or approved candidate  -> admit historical source events
draft or needs-answer candidate       -> review
```

Counterexample fixture outcomes default to the expected non-admit posture from
Step 19. A future runner can attach explicit fixture outcomes by digest. If a
fixture with `mustNotAdmit = true` comes back as `admit`, the backtest records
`falseAdmitRiskCount` and blocks promotion.

## Decision Impact

`decisionImpact` records the historical and counterexample side separately:

```text
historicalAdmitCount
historicalReviewCount
historicalHoldCount
historicalBlockCount
historicalAdmitRate
historicalReviewRate
historicalHoldRate
historicalBlockRate
counterexampleExpectedBlockCount
counterexampleExpectedReviewCount
counterexampleExpectedHoldCount
counterexampleActualAdmitCount
counterexampleOutcomeMismatchCount
falseAdmitRiskCount
```

This makes the product behavior visible without hiding the risk. A candidate
can reduce review load on normal historical traffic and still fail if it admits
a synthetic tenant, replay, approval, prompt/tool, or crypto abuse fixture.

## Review Load Impact

The baseline assumption is explicit:

```text
baselineAssumption = manual-review-everything
```

The report emits:

```text
manualReviewBaselineCount
simulatedReviewCount
simulatedHoldCount
reviewLoadDeltaCount
reviewLoadReductionRate
```

This is a reviewer-workload estimate, not an enforcement activation decision.

## No-Go Reasons

The backtest records no-go reasons such as:

```text
policy-twin-source-events-missing
policy-twin-counterexamples-missing
policy-twin-missed-evidence
policy-twin-active-question-open
policy-twin-replay-digest-missing
policy-twin-historical-blocks
policy-twin-historical-review-required
policy-twin-counterexample-false-admit
policy-twin-counterexample-outcome-mismatch
```

Any no-go reason blocks promotion from the backtest layer. The next
review-by-exception layer can group these into ready-to-approve, needs-answer,
blocked-by-evidence, failed-replay, and monitoring-only queues.

That queue is defined by the [Review-by-Exception Inbox](review-by-exception-inbox.md).
It consumes this backtest report as review material, not as approval authority.

## Invariants

Every result and candidate result carries:

```text
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
productionReady = false
policyTwinEvidenceOnly = true
localReplayOnly = true
executesProductionTraffic = false
downstreamMutationAllowed = false
credentialUseAllowed = false
reviewMaterialOnly = true
```

The backtest can make a candidate safer to review. It cannot make the candidate
enforceable by itself.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [OPA policy testing](https://www.openpolicyagent.org/docs/policy-testing)
  anchors explicit policy tests, failure/error reporting, parameterized cases,
  JSON-readable test output, and data/function mocking before trusting policy
  behavior.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchors audit/debug records that bind policy input, decision output, path,
  bundle metadata, timestamps, and sensitive-field masking or erasure.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html)
  anchors schema-backed policy/request validation against known principal,
  action, resource, and context shape.
- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan)
  anchors reviewable planned changes before applying side effects.
- [Kubernetes dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run)
  anchors server-side request processing through validation/admission while
  avoiding persistence side effects.
- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
  anchors generated policy material from observed access followed by review,
  customization, creation, and attachment as separate steps.
- [Google Cloud role recommendations](https://docs.cloud.google.com/policy-intelligence/docs/role-recommendations-overview)
  anchors observation-window-based recommendations and review before applying
  permission changes.
- [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  anchors generative-AI risk management as an evaluation lifecycle, not a
  single model-output judgment.

These sources are engineering anchors only. They do not certify Attestor
policy correctness, target-system integration, customer approval, production
deployment, live replay execution, crypto custody, or compliance readiness.

## Non-Claims

This backtest does not claim:

- policy correctness
- enterprise integration recipe completion
- approval automation
- production policy-store readiness
- live target-system connector coverage
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- crypto custody, wallet, exchange, or transaction broadcasting capability
- compliance certification
- automatic policy activation
- completion of Step 25 Spend, procurement, data, IAM, health, and insurance recipes

It is the digest-bound backtest layer that lets the next step route only the
exceptions that still need human work.
