# LLM Provider Runtime Decision

Status: repository-side provider runtime decision for unlock Step 10. This is
not a live non-OpenAI runtime implementation, not live failover evidence, and
not production readiness.

## Decision

The first non-OpenAI runtime adapter target is:

```text
Anthropic Claude Messages API
```

The first route to prove is:

```text
reasoning route
  -> digest-only proof context
  -> Attestor-owned timeout and output budget
  -> provider rate-limit signal mapping
  -> no raw prompt or provider-body storage
  -> fake-client conformance tests
  -> opt-in external-live smoke probe
```

Structured output can be added in the same adapter only through the Anthropic
strict tool-schema path. It must not be described as equivalent to OpenAI JSON
schema output, Vertex response schema, or Azure OpenAI JSON schema until the
route-specific schema conformance tests prove parity for the Attestor use case.

## Why Anthropic First

| Candidate | Runtime fit | Decision |
|---|---|---|
| Anthropic Claude | Direct Messages API, first-class tool use, documented rate-limit headers, independent model family from OpenAI, and the smallest credential surface for the first second-provider proof. | First adapter target. |
| Google Vertex AI | Strong enterprise/IAM/regional posture, structured output, and function calling, but larger bootstrap surface: project, location, service-account/IAM, regional quotas, and customer cloud profile. | Second enterprise/cloud target after the direct second-provider path. |
| Azure OpenAI | Strong enterprise deployment and regional quota model, but close to the OpenAI API family and deployment-coupled model routing; useful for customer Azure mirrors more than first provider-family diversity. | Enterprise mirror target after one independent provider is proven. |

The goal is not provider-count vanity. The goal is to prove that Attestor can
carry one consequence route across a second model/provider boundary while
preserving proof minimization, rate-limit handling, budget controls, and
fail-closed readiness gates.

Vertex AI remains the next cloud/IAM target. Azure OpenAI remains the later
enterprise mirror target.

## Protected Principles

- fail-closed boundary
- customer authority
- data minimization and redaction
- runtime readiness
- auditability
- operational boundedness
- no overclaim

## Research Anchors

Reviewed on 2026-05-16.

- OpenAI Responses API and Structured Outputs remain the wired baseline for the
  current runtime contract: https://platform.openai.com/docs/api-reference/responses
  and https://platform.openai.com/docs/guides/structured-outputs.
- OpenAI rate-limit guidance anchors bounded retry/backoff expectations for the
  existing wrapper: https://platform.openai.com/docs/guides/rate-limits.
- Anthropic Messages API anchors the first non-OpenAI request surface:
  https://docs.anthropic.com/en/api/messages.
- Anthropic tool use anchors the client-executed tool boundary and strict tool
  schema path: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview.
- Anthropic rate-limit docs anchor `retry-after` and
  `anthropic-ratelimit-*` signal mapping:
  https://docs.anthropic.com/en/api/rate-limits.
- Vertex AI structured output and function calling remain the next cloud/IAM
  target, not the first adapter:
  https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output
  and https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling.
- Vertex AI quotas anchor why a Vertex adapter needs customer project,
  location, and quota evidence:
  https://cloud.google.com/vertex-ai/generative-ai/docs/quotas.
- Azure OpenAI structured outputs and quotas anchor the later enterprise mirror
  target:
  https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs
  and https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits.

These are engineering anchors only. They do not prove provider certification,
provider security, live runtime evidence, data-residency approval, customer
approval, failover, or production readiness.

## Repository Evidence

Current repo state:

- `src/api/openai.ts` is the only wired provider runtime.
- `src/api/llm-provider-registry.ts` already records OpenAI, Anthropic, Vertex
  AI, and Azure OpenAI provider boundaries.
- `docs/02-architecture/llm-provider-registry.md` already records route
  compatibility and route-readiness evidence gates.
- `tests/llm-provider-registry.test.ts` already proves that Anthropic, Vertex
  AI, and Azure OpenAI remain planned, not wired.

Step 10 adds a decision, not runtime code. Anthropic must stay `planned` in the
registry until Step 11 implements and tests an adapter.

## Step 11 Contract

The next PR should implement a narrow Anthropic runtime slice:

| Contract item | Required proof |
|---|---|
| Adapter boundary | A small Attestor-owned wrapper around the Anthropic Messages API, not a broad AI gateway. |
| Model mapping | A reasoning-purpose model mapping re-verified against current Anthropic docs at implementation time; no stale hard-coded model claim in the decision doc. |
| Prompt handling | Request builder stores only prompt/config/tool/output-schema digests in Attestor evidence. |
| Provider body handling | Raw provider request and response bodies are caller-local only and must not be stored in proof, telemetry, dashboards, packets, or docs. |
| Timeout | Attestor-owned request timeout required before route readiness can clear. |
| Output budget | Attestor-owned max-output-token budget required before route readiness can clear. |
| Retry | Bounded retry behavior with provider rate-limit signal handling; no unbounded SDK hidden retries. |
| Rate-limit mapping | At minimum `retry-after`, `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-input-tokens-remaining`, and `anthropic-ratelimit-output-tokens-remaining` mapped into digest-safe evidence. |
| Structured output | Strict tool-schema route only; schema digest required; route parity test required before claiming structured-output compatibility. |
| Fake-client tests | Unit tests for success, timeout, over-budget output, malformed tool output, rate-limit retry, redacted evidence, and no raw prompt/provider-body storage. |
| External-live smoke | Opt-in probe behind explicit external-live env, with digest-only output and no secret echo. |
| Registry readiness | Anthropic may move from `planned` to `wired` only when the fake-client contract, route mapping, and smoke-proof contract exist. |

## No-Go Boundaries

- Do not claim live multi-provider LLM resilience from this decision.
- Do not claim Anthropic, Vertex AI, or Azure OpenAI runtime execution.
- Do not claim live failover until OpenAI and Anthropic both execute compatible
  routes with digest-only evidence.
- Do not let the provider adapter store raw prompts, raw provider bodies,
  credentials, customer identifiers, private thresholds, or downstream payloads.
- Do not route protected consequence admission through a live provider unless
  the downstream PEP, release-token path, replay store, and customer approval
  remain the authority for execution.

## Verification

- `npm run test:llm-provider-runtime-decision`
- `npm run test:llm-provider-registry`
- `npm run test:attestor-unlock-source-of-truth`
- `npm run test:unified-shadow-to-policy-master-plan`
- `npm run test:research-provenance-ledger`
