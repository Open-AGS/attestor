# Active Question Engine

Status: repository-side Step 18 contract for the unified Shadow-to-Policy plan.
This is not replay completion, not policy correctness proof, not approval
automation, and not automatic policy activation.

## Decision

The Active Question Engine sits after the [Policy Candidate PR Contract](policy-candidate-pr-contract.md):

```text
canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate PR contract
  -> active question engine
  -> counterexample replay
  -> policy twin backtest
  -> review-by-exception inbox
```

Its job is narrow: rank the smallest useful set of human questions from
candidate PR material. It does not ask a human to write policy DSL. It does
not let an LLM decide policy. It does not activate enforcement.

The next repository-side layer is the
[Counterexample Replay Generator](counterexample-replay-generator.md), which
turns the candidate and unresolved-question context into digest-only negative
replay fixtures.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/active-question-engine.ts`.

Version:

```text
attestor.active-question-engine.v1
```

The engine consumes a `PolicyCandidatePrContract` and emits ranked questions
bound to:

```text
policyCandidatePrContractDigest
tenantRefDigest
graphDigest
schemaDigest
candidateId
surfaceId
sourcePolicyCandidateDigest
sourceEvidenceStateDigest
sourceEventDigests[]
```

No raw prompts, provider bodies, downstream payloads, customer identifiers,
wallet material, private thresholds, or raw producer strings are required in
the question output.

## Question Kinds

Allowed `kind` values:

```text
bind-missing-evidence
confirm-inferred-field
resolve-conflicting-evidence
refresh-stale-evidence
approve-or-replace-producer
attach-replay-digest
answer-review-gate
approve-or-dismiss-candidate
```

Allowed answer kinds:

```text
digest-ref
yes-no
choice
producer-trust-decision
conflict-resolution
replay-digest
approval-decision
```

This is the product point: the human gets a small number of concrete decisions,
not a blank policy editor.

## Ranking Scores

Every question carries four deterministic ranking dimensions:

| Score | Meaning |
|---|---|
| `riskReductionScore` | How much the answer can reduce candidate risk or close a fail-closed blocker. |
| `eventCoverageScore` | How much observed shadow evidence is behind the candidate. |
| `reviewLoadDeltaScore` | How much review work the answer can remove or collapse. |
| `uncertaintyReductionScore` | How much the answer separates fact from inference, missing evidence, stale evidence, or conflict. |

The engine emits:

```text
priorityScore
impactBand
omittedQuestionCount
topPriorityScore
```

`maxQuestions` defaults to 5 and is capped at 25. Lower-priority questions are
counted as omitted rather than expanded into a noisy review surface.

## Invariants

Every result and question carries:

```text
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
productionReady = false
decisionSupportOnly = true
```

The engine can make a reviewer faster. It cannot make a generated candidate
safe by itself.

## Review Flow

```text
missing evidence
  -> bind digest-only evidence

inferred field
  -> confirm yes/no

conflicting evidence
  -> resolve conflict and attach digest

stale evidence
  -> refresh evidence and attach digest

untrusted producer
  -> approve or replace producer source

missing replay
  -> attach replay/backtest digest

approval-ready candidate
  -> approve or dismiss candidate
```

This makes human work small and explicit. A reviewer answers the question that
unblocks the most candidate quality, not every possible policy design question.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [Microsoft Human-AI Experience Toolkit](https://www.microsoft.com/en-us/haxtoolkit/)
  anchors planning for AI behavior, prioritizing work items, and designing for
  recovery from likely AI failures.
- [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/)
  anchors calibrated trust, user control, feedback opportunities, partial
  explanations, and avoiding confidence displays that do not help decisions.
- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html)
  anchors observed-activity policy templates followed by review and
  customization.
- [Google Cloud role recommendations](https://cloud.google.com/policy-intelligence/docs/role-recommendations-overview)
  anchors observation-window-based recommendations and accuracy tradeoffs.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html)
  anchors schema-backed policy contracts and policy editor tooling from schema.
- [OPA policy testing](https://www.openpolicyagent.org/docs/policy-testing)
  anchors policy changes that are tested before trust.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchors audit/debug records with sensitive-field masking or erasure.

These sources are engineering anchors only. They do not certify Attestor user
research, policy correctness, target-system integration, customer approval,
production deployment, or compliance readiness.

## Non-Claims

This engine does not claim:

- policy correctness
- replay or backtest completion
- approval/dismiss feedback loop completion
- approval automation
- production policy-store readiness
- native target-system connector coverage
- customer deployment
- non-bypassable enforcement
- downstream receipt correctness
- compliance certification
- automatic policy activation
- completion of Step 22 Approval/dismiss feedback loop

It is the ranked human-question layer that lets the next step generate
counterexamples and replay fixtures against the right unresolved decisions.
