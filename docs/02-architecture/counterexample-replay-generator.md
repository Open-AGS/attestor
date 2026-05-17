# Counterexample Replay Generator

Status: repository-side Step 19 contract for the unified Shadow-to-Policy plan.
This is not replay execution, not policy correctness proof, not target-system
integration proof, and not automatic policy activation.

## Decision

The Counterexample Replay Generator sits after the
[Active Question Engine](active-question-engine.md):

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

Its job is narrow: generate digest-bound negative replay fixtures that later
backtests must use against policy candidates. It does not execute those
fixtures against a customer system, does not call downstream APIs, does not use
credentials, and does not make a generated policy enforceable.

The product reason is important: historical shadow traffic is usually biased
toward normal usage. A candidate that only passes normal historical traffic can
still admit the exact case Attestor must catch. Step 19 therefore creates
synthetic counterexamples before Step 20 runs backtests.

The next repository-side layer is [Policy Twin Backtest](policy-twin-backtest.md):
it consumes these fixtures, records historical decision deltas, and blocks
promotion when any `mustNotAdmit` fixture is admitted.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/counterexample-replay-generator.ts`.

Version:

```text
attestor.counterexample-replay-generator.v1
```

The generator consumes:

```text
PolicyCandidatePrContract
ActiveQuestionEngineResult
```

Every result is bound to:

```text
policyCandidatePrContractDigest
activeQuestionEngineDigest
tenantRefDigest
graphDigest
schemaDigest
```

Every fixture is bound to:

```text
candidateId
surfaceId
actionSurface
sourcePolicyCandidateDigest
sourceEvidenceStateDigest
sourceEventDigests[]
sourceQuestionDigests[]
schemaDigest
replayInputDigest
mutationDigest
```

The fixture body is digest-only. It does not store raw prompts, provider
bodies, downstream payloads, customer identifiers, wallet material, private
thresholds, secrets, raw transaction payloads, or raw producer strings.

## Fixture Kinds

Allowed `kind` values:

```text
tenant-mismatch
stale-approval
missing-evidence
bypass-route
repeated-action
prompt-injection
tool-poisoning
unsafe-approval
crypto-transaction-abuse
```

Allowed expected outcomes:

```text
block
review-required
hold
```

Allowed severity values:

```text
medium
high
blocker
```

The crypto fixture is still part of one engine. It applies to the general
crypto adapter surface, for example ordinary ERC-20 approval, permit, swap,
bridge, Safe transaction, account-abstraction UserOperation, session key, and
x402-style payment risks. It is not a wallet, custody, chain analytics, or
transaction-broadcast feature.

## Fixture Semantics

Each generated fixture states:

```text
mustNotAdmit = true
mustNotActivatePolicy = true
syntheticOnly = true
localReplayOnly = true
executesProductionTraffic = false
downstreamMutationAllowed = false
credentialUseAllowed = false
rawPayloadStored = false
```

This means a later replay/backtest layer can use the fixture as a negative
test case, but the fixture itself cannot become a live execution instruction.

## Counterexample Matrix

| Fixture | What it probes | Expected posture |
|---|---|---|
| `tenant-mismatch` | Candidate, event, or resource binding crosses tenant scope. | `block` |
| `stale-approval` | Approval evidence is older than the decision context. | `review-required` |
| `missing-evidence` | Required evidence or resource reference is absent. | `block` |
| `bypass-route` | The action path appears outside the protected admission route. | `block` |
| `repeated-action` | Same consequence is replayed or repeated beyond idempotency budget. | `hold` |
| `prompt-injection` | Untrusted context tries to alter the protected action. | `block` |
| `tool-poisoning` | Tool or MCP result attempts to smuggle new authority into the agent. | `block` |
| `unsafe-approval` | Human approval state is ambiguous, stale, or not bound to this candidate. | `review-required` |
| `crypto-transaction-abuse` | Wallet/transaction action overreaches spender, chain, asset, permit, delegation, or simulation bounds. | `block` |

The generator can cap fixtures per candidate. Omitted fixtures are counted, not
silently dropped.

## Invariants

Every result carries:

```text
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
productionReady = false
syntheticOnly = true
localReplayOnly = true
executesProductionTraffic = false
downstreamMutationAllowed = false
credentialUseAllowed = false
reviewMaterialOnly = true
```

The output can make the next backtest stricter. It cannot make a candidate safe
by itself.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [OPA policy testing](https://www.openpolicyagent.org/docs/policy-testing)
  anchors policy changes with explicit pass/fail/error tests, parameterized
  tests, JSON-readable test results, and mocked inputs before relying on a
  policy.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs)
  anchors replay/debug material that is bound to policy input, decision
  output, path, bundle metadata, and masked or erased sensitive fields.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html)
  anchors schema-backed policy validation before a policy is trusted against
  known principal, action, resource, and context shape.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  anchors prompt-injection, excessive agency, sensitive-data, and supply-chain
  risk categories for LLM-backed action systems.
- [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/)
  anchors the agentic-AI threat-model framing for autonomous tool-using
  systems.
- [OWASP MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)
  anchors tool-response poisoning as an indirect prompt-injection risk where
  runtime tool output crosses trust boundaries.
- [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  anchors generative-AI risk management as a lifecycle and evaluation problem,
  not a single model-output judgment.

These sources are engineering anchors only. They do not certify Attestor
policy correctness, target-system integration, customer approval, production
deployment, live replay execution, crypto custody, or compliance readiness.

## Non-Claims

This generator does not claim:

- policy correctness
- replay or backtest completion
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
- live customer pilot execution

It is the negative-fixture layer that makes Policy Twin backtesting harder to
fool than happy-path replay.
