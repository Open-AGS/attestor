# F2-AG-7 / F2-AG-8 / F4-LLM03-A / F4-D LLM Provider Supply Chain Validation

Statuses:

- F2-AG-7 agentic supply-chain and LLM provider dependency: `partial`.
- F2-AG-8 multimodal vision input future risk: `backlog`.
- F4-LLM03-A agentic supply-chain coverage gap / single LLM provider: `partial`.
- F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope: `partial`.

This validation separates three concerns that were conflated in the supplied audit reports:

1. customer/agent supply-chain controls for tools, adapters, connectors, domain packs, and model-provider SDKs;
2. Attestor's own optional live-model proof path;
3. future multimodal image input exposure.

## External Source Check

OWASP LLM03:2025 Supply Chain covers vulnerabilities in LLM application supply chains, including third-party components, model/provider dependencies, plugins, extensions, datasets, pre-trained models, and vendor components that can affect integrity, availability, and trustworthiness.

Attestor's relevant repo interpretation is:

- agentic supply-chain controls belong in the consequence-admission guard layer;
- Attestor's own live-model dependency is a separate runtime/provider dependency;
- CLI-only optional proof helpers are not equivalent to a hosted production attack surface.

Source:

- https://genai.owasp.org/llmrisk/llm032025-supply-chain/

## Current Repo Evidence

### Agentic supply-chain guard

`src/consequence-admission/agentic-supply-chain-guard.ts` is real coverage for the agentic supply-chain half of the finding.

It covers:

- `npm-package`
- `container-image`
- `github-action`
- `connector`
- `plugin`
- `mcp-server`
- `workflow`
- `generated-adapter`
- `domain-pack`
- `model-provider-sdk`
- `custom-tool`

It requires pinned source, integrity digest, provenance, signatures where relevant, SBOM where relevant, owner authority, review digest, permission scope, adapter readiness, and runtime replay evidence for high-impact components.

Existing proof:

- `npm run test:agentic-supply-chain-guard`
- `docs/02-architecture/agentic-supply-chain-guard.md`
- PR #297 in the tracker.

This closes the original "no guard module" wording as stale. It does not close all runtime provider dependency risk.

### Attestor-owned OpenAI usage

`src/api/openai.ts` is still a single OpenAI SDK wrapper:

- `GPT_MODEL = 'o3'`
- `GPT_VISION_MODEL = 'gpt-4o'`
- bounded wrapper-controlled retry attempts with jittered exponential backoff
- OpenAI SDK hidden retries disabled with `maxRetries: 0`
- per-request timeout policy through OpenAI SDK request options
- output-token budget enforcement before live calls
- `store: false` on OpenAI Responses and Chat Completions requests
- opt-in OpenAI reasoning live smoke proof through `scripts/probe-openai-live-smoke.ts`
- no failover provider implementation

`src/api/llm-provider-registry.ts` now defines a repository-side provider
registry contract:

- OpenAI is the only `wired` provider.
- Anthropic, Vertex AI, and Azure OpenAI are registered as `planned` provider
  surfaces only.
- production/failover-required evaluation fails closed until a compatible
  second provider, timeout budget, cost budget, and live smoke proof are wired.
- failover compatibility requires the same requested purpose, model mapping,
  route capabilities, structured-output support when required, and provider
  rate-limit signals.
- route-readiness evidence now separates route selection from production-like or
  failover claims by requiring digest-only primary/fallback runtime evidence,
  live smoke proof, customer/data/retention approvals, timeout/budget/rate-limit
  policy digests, schema digests, SDK retry/storage controls, and raw
  prompt/provider-body minimization before those claims can clear.
- proof-context binding accepts prompt/config/tool/schema digests, not raw prompt
  bodies or raw provider response bodies.
- `callGpt(...)` and `callGptVision(...)` return a digest-only provider proof
  context; the optional financial live-model proof stores that context without
  storing the raw prompt or provider body.

Current caller evidence:

- `callGpt(...)` is called from `src/financial/cli.ts` only.
- `callGptVision(...)` currently has no repo caller outside its own definition.
- `docs/00-evaluation/v0.1-evaluation-packet.md` labels the live upstream path as optional and not the default reviewer path.
- `src/financial/types.ts` mentions `ANTHROPIC_API_KEY` in readiness reporting, but there is no Anthropic client implementation equivalent to `src/api/openai.ts`.

So the live-model risk is scope-bounded today: it is not part of the hosted consequence-admission API path based on current repo evidence. The provider registry narrows the contract gap, but runtime provider resilience remains incomplete before any broader claim.

## Status Decisions

### F2-AG-7: `partial`

Reason:

- The agentic supply-chain guard exists and is tested.
- It explicitly includes `model-provider-sdk`.
- It remains `productionReady: false` and `activatesEnforcement: false`.
- Attestor's own runtime LLM provider dependency is separate and not closed by the guard.

### F2-AG-8: `backlog`

Reason:

- `callGptVision` exists and accepts base64 imagery.
- There is no current caller of `callGptVision` outside `src/api/openai.ts`.
- No hosted route currently wires arbitrary user imagery into this helper.

Required future guard if exposed:

- input size limit;
- allowed MIME list;
- image source classification;
- prompt-injection/redaction boundary;
- budget/timeout;
- no raw image payload in public proof/review artifacts.

### F4-LLM03-A: `partial`

Reason:

- Agentic supply-chain guard coverage is real.
- Single-provider runtime dependency remains true for `src/api/openai.ts`.
- The report must be split: adapter/tool supply chain is partially covered; Attestor-owned live-model provider resilience remains backlog.

### F4-D: `partial`

Reason:

- Current OpenAI usage is optional and CLI-scoped.
- `LlmProviderRegistry` records provider inventory, wire status, structured-output mechanisms, credential reference names, rate-limit signal names, and proof-context digest binding.
- Route evaluation now rejects a generic second wired provider unless it is
  purpose/model/capability/structured-output/rate-limit compatible.
- Route-readiness evaluation now blocks production-like, structured-output,
  tool-routing, and failover claims unless primary and fallback providers carry
  digest-only runtime evidence with live smoke, approval, policy, schema,
  retry/storage, and minimization controls.
- The OpenAI wrapper now has explicit per-call timeout and output-token budget enforcement, disables provider SDK hidden retries, sets provider response storage to `false`, and can produce digest-only OpenAI reasoning smoke proof.
- The OpenAI wrapper still has no live failover provider, no OpenAI vision smoke proof, and no non-OpenAI smoke proof.
- It should block future claims that Attestor has production-grade multi-provider live-model resilience.

## Required Follow-Up

To close the runtime LLM provider side as `fixed`, Attestor still needs runtime wiring beyond the registry contract:

1. Wire non-OpenAI providers only after each client has timeout, budget, retry, redaction, and smoke-proof parity.
2. Add live failover policy and route execution after at least two providers are wired.
3. Bind provider/model/version and prompt/template digests into every proof packet where live model output matters.
4. Add live smoke tests for each production-enabled provider profile beyond OpenAI reasoning.
5. Keep optional live-model proof paths separate from hosted consequence-admission enforcement claims.

## Tracker Effect

- F2-AG-7 remains `partial`, with clearer split evidence.
- F2-AG-8 moves from `needs-revalidation` to `backlog`.
- F4-LLM03-A moves from `needs-revalidation` to `partial`.
- F4-D moves from `backlog` to `partial`.
- No hosted production, multi-provider resilience, or prompt-leakage closure claim is made.
