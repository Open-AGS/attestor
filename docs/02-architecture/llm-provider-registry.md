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

The registry does not instantiate Anthropic, Vertex AI, or Azure OpenAI clients,
execute provider failover, or prove production readiness. It evaluates whether a
requested provider route is selectable or blocked.

## Failover Compatibility Rule

Failover readiness cannot be satisfied by a generic second provider. A fallback
provider must be wired and compatible with the requested route:

- same requested purpose and configured model mapping;
- required text, vision, tool-calling, and structured-output capability;
- provider-specific structured-output mechanism when structured output matters;
- provider rate-limit signals before failover or production routing claims.

If a second provider is wired but cannot satisfy the route profile, the contract
fails closed with `llm-provider-compatible-failover-provider-not-ready`.

## Route Readiness Evidence Gate

`evaluateLlmProviderRoutingReadiness(...)` separates route selection from runtime
evidence. A non-production single-provider route can be selected by the registry
contract, but production-like, failover, tool-routing, and structured-output
claims require digest-only runtime evidence.

The readiness gate requires:

- primary provider evidence when production, failover, tool schema, structured
  output, or rate-limit policy matters;
- failover provider evidence for each compatible fallback provider before
  failover readiness can clear;
- live smoke proof, customer approval, data residency approval, retention
  approval, timeout policy, budget policy, and rate-limit policy digests before
  production-like route readiness can clear;
- output schema digest when structured output matters;
- tool schema digest when tool routing matters;
- SDK hidden retries disabled and provider response storage disabled before
  production-like route readiness can clear;
- raw prompt, raw provider body, and credential value exposure all absent.

This is still only a repository-side readiness contract. It does not call a
provider, install a provider client, switch hosted traffic, or prove live
production routing.

## Current Decision

OpenAI remains the only wired provider. Anthropic, Vertex AI, and Azure OpenAI are registered as planned provider surfaces only.

Default state:

- `single-provider-evaluation-ready`
- `productionReady: false`
- `multiProviderResilienceReady: false`

Production or failover-required state:

- blocked by `llm-provider-failover-provider-not-wired`;
- blocked by `llm-provider-compatible-failover-provider-not-ready` if a second
  wired provider is not route-compatible;
- blocked by `llm-provider-live-smoke-proof-required`.

Route-readiness state:

- default single-provider evaluation route: `evaluation-route-ready`;
- production-like route with complete digest-only runtime evidence:
  `production-route-contract-ready`;
- missing primary/fallback evidence, schema digest, rate-limit policy digest, or
  storage minimization proof: `blocked`;
- always `productionReady: false`.

OpenAI timeout and output-token budget enforcement are wired in
`src/api/openai.ts`. OpenAI reasoning live smoke proof is wired as an explicit
external-live probe in `scripts/probe-openai-live-smoke.ts`; production-like
OpenAI reasoning calls remain fail-closed until a fresh proof digest, timestamp,
model, and purpose are present in the runtime environment. This is still not a
production readiness claim because vision smoke proof, non-OpenAI providers, and
multi-provider failover remain absent.

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
- No OpenAI vision or non-OpenAI live provider smoke proof is wired yet.
- No hosted consequence-admission route depends on a live LLM provider.
- No route-readiness evidence evaluation activates a live provider call.

## Verification

- `npm run test:llm-provider-registry`
- `npm run test:openai-runtime-policy`
- `npm run test:openai-live-smoke-proof`
- `npm run test:f2-llm-provider-supply-chain-validation`
- `npm run test:f2-model-tool-config-drift-validation`
- `npm run test:f11-supply-chain-depth-validation`
