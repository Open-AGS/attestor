# Adversarial Evidence Fixtures

This document describes `attestor.consequence-adversarial-evidence-fixtures.v1`.

The fixture bundle turns a narrow invariant into replayable local cases:

```text
model text, retrieved content, tool output, or signed evidence
must not become customer authority by itself
```

It lives in `src/consequence-admission/adversarial-evidence-fixtures.ts`, is
covered by `tests/adversarial-evidence-fixtures.test.ts`, and is exposed through
`npm run test:adversarial-evidence-fixtures`.

## Why This Exists

The existing untrusted content authority guard already decides whether a source
may count as authority. These fixtures give that guard a stable adversarial
test bed for the AI-specific cases most likely to blur the boundary:

- direct prompt-injection authority claims;
- indirect web/retrieved-content authority claims;
- tool-output approval poisoning;
- model-rationale self-approval;
- signed evidence being confused with authority;
- mixed trusted and injected approval signals;
- attempted trust-class promotion from untrusted material.

The goal is not to classify every possible prompt-injection string. The goal is
to keep the Attestor boundary explicit: language can propose, explain, or carry
evidence, but it cannot grant authority to execute a high-risk action.

## Source Anchors

- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
  anchors direct and indirect prompt-injection risk for LLM applications.
- [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
  anchors measurement, governance, and risk-management discipline for AI
  system controls.
- [OpenAI safety guidance](https://platform.openai.com/docs/guides/safety-best-practices)
  anchors the need to treat model outputs and tool use as bounded surfaces,
  not as a substitute for deterministic application controls.

These anchors support the engineering shape only. They do not certify Attestor,
prove production readiness, or prove prompt-injection completeness.

## Contract

Each fixture case is synthetic and digest-bound:

```text
case kind
source kind
claim kind
source ref digest
expected outcome
expected reason codes
no-side-effect flags
```

The bundle preserves these fixed boundaries:

```text
approvalRequired = true
autoEnforce = false
activatesEnforcement = false
rawPayloadStored = false
syntheticOnly = true
localReplayOnly = true
executesProductionTraffic = false
downstreamMutationAllowed = false
credentialUseAllowed = false
productionReady = false
reviewMaterialOnly = true
```

## Fixture Cases

| Case | Source shape | Expected result |
|---|---|---|
| `direct-prompt-injection-authority` | `user-prompt` claims `authorization` | `block` |
| `indirect-web-content-authority` | `web-page` claims `policy` | `block` |
| `tool-output-authority-poisoning` | `tool-output` claims `approval` | `block` |
| `model-rationale-self-approval` | `llm-summary` claims `approval` | `block` |
| `signed-evidence-not-authority` | `signed-evidence` supplies `evidence` only | `review` |
| `mixed-trusted-and-injected-approval` | trusted approval plus injected ticket comment | `review` |
| `trust-class-promotion-attempt` | untrusted document asks to become trusted authority | `block` |

The `review` cases are intentional. They prevent false confidence: trusted
evidence can support a decision, and trusted approval can count as authority,
but mixed or evidence-only material still needs review before any downstream
effect.

## Non-Claims

This fixture bundle does not:

- run against customer infrastructure;
- execute tools or downstream systems;
- use credentials;
- store raw prompt or provider payload material;
- prove live prompt-injection resistance;
- activate policy or enforcement;
- replace customer PEP no-bypass proof.

It is repo-side review material for the single Attestor consequence boundary.
