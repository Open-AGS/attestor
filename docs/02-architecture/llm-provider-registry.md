# LLM Provider Registry Contract

Status: repository-side contract only. Not a live multi-provider runtime.

## Protected Principles

- fail-closed boundary
- customer authority
- data minimization and redaction
- runtime readiness
- auditability
- operational boundedness
- no overclaim

## Primary Source Anchors

Checked on 2026-05-15.

- OpenAI Responses API supports text, image, JSON output, and tool-capable response creation: https://platform.openai.com/docs/api-reference/responses
- OpenAI structured outputs use JSON schema response formatting for supported models: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI rate-limit guidance recommends retry with exponential backoff and a maximum retry bound: https://platform.openai.com/docs/guides/rate-limits
- Anthropic Messages and tool-use docs separate model-returned tool calls from application-executed client tools, and strict tool use can enforce schema conformance: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
- Anthropic rate-limit docs expose retry and rate-limit headers such as `retry-after` and `anthropic-ratelimit-*`: https://docs.anthropic.com/en/api/rate-limits
- Vertex AI structured output uses `responseMimeType` and `responseSchema`: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output
- Azure OpenAI structured outputs use `response_format` with `json_schema` and `strict: true`: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs
- Azure OpenAI quotas are bounded by region, subscription, model or deployment type, TPM, and RPM: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits

## Registry Boundary

`src/api/llm-provider-registry.ts` defines a deterministic registry for:

- provider inventory: OpenAI, Anthropic, Vertex AI, Azure OpenAI;
- provider wire status;
- model-purpose mapping;
- structured-output mechanism;
- provider rate-limit signal names;
- credential reference names only, never values;
- proof-context binding for provider id, configured model, observed model, prompt digest, config digest, and tool/schema digests.

The registry does not instantiate SDK clients, execute provider calls, or perform failover. It evaluates whether a requested provider route is selectable or blocked.

## Current Decision

OpenAI remains the only wired provider. Anthropic, Vertex AI, and Azure OpenAI are registered as planned provider surfaces only.

Default state:

- `single-provider-evaluation-ready`
- `productionReady: false`
- `multiProviderResilienceReady: false`

Production or failover-required state:

- blocked by `llm-provider-failover-provider-not-wired`;
- blocked by `llm-provider-production-timeout-budget-not-wired`;
- blocked by `llm-provider-production-cost-budget-not-wired`;
- blocked by `llm-provider-live-smoke-proof-required`.

## Proof Context Contract

Live-model proof paths must bind:

- provider id;
- configured model;
- observed provider-returned model when present;
- prompt digest;
- provider/config digest;
- template digest when templates matter;
- tool schema digest when tools matter;
- output schema digest when structured output matters.

The binding helper rejects non-digest prompt/config fields and records:

- `rawPromptStored: false`
- `rawProviderBodyStored: false`
- `exposesCredentialValues: false`

## Not Claimed

- No Anthropic, Vertex AI, or Azure OpenAI client is implemented by this PR.
- No live provider failover is active.
- No hosted production LLM runtime readiness is claimed.
- No timeout or cost-budget enforcement is wired into `src/api/openai.ts` yet.
- No hosted consequence-admission route depends on a live LLM provider.

## Verification

- `npm run test:llm-provider-registry`
- `npm run test:f2-llm-provider-supply-chain-validation`
- `npm run test:f2-model-tool-config-drift-validation`
- `npm run test:f11-supply-chain-depth-validation`
