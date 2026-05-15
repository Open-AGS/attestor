import assert from 'node:assert/strict';

import {
  DEFAULT_LLM_PROVIDER_REGISTRATIONS,
  bindLlmProviderProofContext,
  digestLlmProviderContextValue,
  evaluateLlmProviderRegistry,
  evaluateLlmProviderRoute,
  llmProviderRegistryDescriptor,
  type LlmProviderRegistration,
} from '../src/api/llm-provider-registry.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: readonly string[], expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

try {
  const descriptor = llmProviderRegistryDescriptor();
  const providers = descriptor.providers;
  const providerIds = providers.map((provider) => provider.id);

  deepEqual(
    providerIds,
    ['openai', 'anthropic', 'vertex-ai', 'azure-openai'],
    'Registry: provider inventory includes OpenAI, Anthropic, Vertex AI, and Azure OpenAI',
  );
  equal(descriptor.version, 'llm-provider-registry.v1', 'Registry: version is stable');
  includes(descriptor.protectedPrinciples, 'fail-closed boundary', 'Registry: fail-closed principle is explicit');
  includes(descriptor.protectedPrinciples, 'customer authority', 'Registry: customer authority principle is explicit');
  equal(descriptor.runtimePolicy.storesRawPrompt, false, 'Registry: runtime policy does not store raw prompts');
  equal(descriptor.runtimePolicy.storesRawProviderBody, false, 'Registry: runtime policy does not store provider bodies');
  equal(descriptor.runtimePolicy.exposesCredentialValues, false, 'Registry: runtime policy does not expose credential values');
  equal(
    descriptor.runtimePolicy.failoverMode,
    'fail-closed-until-two-wired-providers',
    'Registry: failover is fail-closed until two providers are wired',
  );
  equal(
    descriptor.runtimePolicy.timeoutBudget,
    'required-before-production',
    'Registry: production timeout budget is required before production',
  );
  equal(
    descriptor.runtimePolicy.costBudget,
    'required-before-production',
    'Registry: production cost budget is required before production',
  );

  const openai = providers.find((provider) => provider.id === 'openai');
  const anthropic = providers.find((provider) => provider.id === 'anthropic');
  const vertex = providers.find((provider) => provider.id === 'vertex-ai');
  const azure = providers.find((provider) => provider.id === 'azure-openai');
  ok(openai, 'Registry: OpenAI registration exists');
  ok(anthropic, 'Registry: Anthropic registration exists');
  ok(vertex, 'Registry: Vertex AI registration exists');
  ok(azure, 'Registry: Azure OpenAI registration exists');

  equal(openai?.wireStatus, 'wired', 'Registry: only OpenAI is wired today');
  equal(anthropic?.wireStatus, 'planned', 'Registry: Anthropic is planned, not wired');
  equal(vertex?.wireStatus, 'planned', 'Registry: Vertex AI is planned, not wired');
  equal(azure?.wireStatus, 'planned', 'Registry: Azure OpenAI is planned, not wired');
  equal(openai?.defaultModelsByPurpose.reasoning, 'o3', 'Registry: OpenAI reasoning model matches wrapper default');
  equal(openai?.defaultModelsByPurpose.vision, 'gpt-4o', 'Registry: OpenAI vision model matches wrapper default');
  equal(
    openai?.capability.structuredOutputMode,
    'openai-response-format-json-schema',
    'Registry: OpenAI structured output mode is recorded',
  );
  equal(
    anthropic?.capability.structuredOutputMode,
    'anthropic-strict-tool-schema',
    'Registry: Anthropic strict tool schema mode is recorded',
  );
  equal(vertex?.capability.structuredOutputMode, 'vertex-response-schema', 'Registry: Vertex response schema mode is recorded');
  equal(azure?.capability.structuredOutputMode, 'azure-openai-json-schema', 'Registry: Azure JSON schema mode is recorded');
  includes(openai?.credentialRefs ?? [], 'OPENAI_API_KEY', 'Registry: OpenAI credential is referenced by env var name only');
  includes(anthropic?.credentialRefs ?? [], 'ANTHROPIC_API_KEY', 'Registry: Anthropic credential is referenced by env var name only');
  includes(
    azure?.credentialRefs ?? [],
    'AZURE_OPENAI_ENDPOINT',
    'Registry: Azure endpoint configuration is referenced by name only',
  );
  ok(
    providers.every((provider) => provider.readinessPolicy.customerApprovalRequired),
    'Registry: every provider requires customer approval before hosted use',
  );
  ok(
    providers.every((provider) => provider.readinessPolicy.liveSmokeProofRequired),
    'Registry: every provider requires live smoke proof before production claim',
  );

  const sourceUrls = providers.flatMap((provider) => provider.sourceAnchors.map((anchor) => anchor.url));
  includes(sourceUrls, 'https://platform.openai.com/docs/api-reference/responses', 'Registry: OpenAI Responses source is anchored');
  includes(sourceUrls, 'https://docs.anthropic.com/en/api/rate-limits', 'Registry: Anthropic rate limit source is anchored');
  includes(
    sourceUrls,
    'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output',
    'Registry: Vertex structured output source is anchored',
  );
  includes(
    sourceUrls,
    'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits',
    'Registry: Azure quota source is anchored',
  );

  const defaultEvaluation = evaluateLlmProviderRegistry();
  equal(defaultEvaluation.state, 'single-provider-evaluation-ready', 'Evaluation: default is single-provider evaluation ready');
  deepEqual(defaultEvaluation.wiredProviderIds, ['openai'], 'Evaluation: OpenAI is the only wired provider');
  deepEqual(
    defaultEvaluation.plannedProviderIds,
    ['anthropic', 'vertex-ai', 'azure-openai'],
    'Evaluation: non-OpenAI providers remain planned',
  );
  equal(defaultEvaluation.selectedPrimaryProviderId, 'openai', 'Evaluation: OpenAI is selected for reasoning');
  equal(defaultEvaluation.multiProviderResilienceReady, false, 'Evaluation: multi-provider resilience is not ready');
  equal(defaultEvaluation.productionReady, false, 'Evaluation: no production readiness is claimed');

  const productionEvaluation = evaluateLlmProviderRegistry({ requireProductionRuntime: true, requireFailover: true });
  equal(productionEvaluation.state, 'blocked', 'Evaluation: production runtime is blocked');
  includes(
    productionEvaluation.blockers,
    'llm-provider-failover-provider-not-wired',
    'Evaluation: failover blocker is explicit',
  );
  includes(
    productionEvaluation.blockers,
    'llm-provider-production-timeout-budget-not-wired',
    'Evaluation: timeout blocker is explicit',
  );
  includes(
    productionEvaluation.blockers,
    'llm-provider-production-cost-budget-not-wired',
    'Evaluation: cost blocker is explicit',
  );
  includes(
    productionEvaluation.blockers,
    'llm-provider-live-smoke-proof-required',
    'Evaluation: live smoke proof blocker is explicit',
  );

  const openAiRoute = evaluateLlmProviderRoute({ purpose: 'reasoning' });
  equal(openAiRoute.status, 'selected', 'Route: default reasoning route is selectable');
  equal(openAiRoute.providerId, 'openai', 'Route: default reasoning route uses OpenAI');
  equal(openAiRoute.model, 'o3', 'Route: default reasoning route uses o3');
  equal(openAiRoute.activatesLiveProviderCall, false, 'Route: route evaluation does not activate live provider calls');
  equal(openAiRoute.productionReady, false, 'Route: route evaluation does not claim production readiness');

  const blockedAnthropicRoute = evaluateLlmProviderRoute({ purpose: 'reasoning', providerId: 'anthropic' });
  equal(blockedAnthropicRoute.status, 'blocked', 'Route: planned Anthropic route is blocked');
  includes(
    blockedAnthropicRoute.blockers,
    'llm-provider-selected-provider-not-wired',
    'Route: planned provider blocker is explicit',
  );
  includes(
    blockedAnthropicRoute.blockers,
    'llm-provider-model-not-configured-for-purpose',
    'Route: missing planned-provider model is explicit',
  );

  const failoverRoute = evaluateLlmProviderRoute({ purpose: 'reasoning', requireFailover: true });
  equal(failoverRoute.status, 'blocked', 'Route: failover route blocks until a second provider is wired');
  includes(
    failoverRoute.blockers,
    'llm-provider-failover-provider-not-wired',
    'Route: failover requires at least two wired providers',
  );

  const promptDigest = digestLlmProviderContextValue('prompt-template-v1');
  const configDigest = digestLlmProviderContextValue('provider-config-v1');
  const toolSchemaDigest = digestLlmProviderContextValue('tool-schema-v1');
  const binding = bindLlmProviderProofContext({
    providerId: 'openai',
    configuredModel: 'o3',
    observedModel: 'o3-2026-01-01',
    purpose: 'reasoning',
    promptDigest,
    configDigest,
    toolSchemaDigest,
  });
  equal(binding.version, 'llm-provider-registry.v1', 'Proof binding: version is included');
  equal(binding.providerId, 'openai', 'Proof binding: provider id is included');
  equal(binding.configuredModel, 'o3', 'Proof binding: configured model is included');
  equal(binding.observedModel, 'o3-2026-01-01', 'Proof binding: observed model is included when present');
  equal(binding.promptDigest, promptDigest, 'Proof binding: prompt digest is passed through');
  equal(binding.configDigest, configDigest, 'Proof binding: config digest is passed through');
  equal(binding.toolSchemaDigest, toolSchemaDigest, 'Proof binding: tool schema digest is passed through');
  equal(binding.rawPromptStored, false, 'Proof binding: raw prompt is not stored');
  equal(binding.rawProviderBodyStored, false, 'Proof binding: raw provider body is not stored');
  equal(binding.exposesCredentialValues, false, 'Proof binding: credentials are not exposed');
  ok(
    /^sha256:[a-f0-9]{64}$/u.test(binding.configuredModelDigest),
    'Proof binding: configured model digest is machine-checkable',
  );
  ok(
    binding.observedModelDigest !== null && /^sha256:[a-f0-9]{64}$/u.test(binding.observedModelDigest),
    'Proof binding: observed model digest is machine-checkable',
  );

  assert.throws(
    () => bindLlmProviderProofContext({
      providerId: 'openai',
      configuredModel: 'o3',
      purpose: 'reasoning',
      promptDigest: 'raw prompt text',
      configDigest,
    }),
    /promptDigest must be a sha256:<hex> digest/u,
    'Proof binding: raw prompt-like input is rejected',
  );
  passed += 1;

  const anthropicWired: LlmProviderRegistration = {
    ...DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'anthropic')!,
    wireStatus: 'wired',
    defaultModelsByPurpose: { reasoning: 'claude-sonnet-placeholder' },
  };
  const twoProviderEvaluation = evaluateLlmProviderRegistry({
    providers: [
      DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'openai')!,
      anthropicWired,
    ],
    requireFailover: true,
  });
  equal(
    twoProviderEvaluation.state,
    'routing-contract-ready',
    'Evaluation: two wired providers only make the routing contract ready',
  );
  equal(
    twoProviderEvaluation.multiProviderResilienceReady,
    true,
    'Evaluation: two wired providers satisfy repository-level failover contract',
  );
  equal(twoProviderEvaluation.productionReady, false, 'Evaluation: even two wired providers do not prove production readiness');

  console.log(`LLM provider registry tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('LLM provider registry tests failed:', error);
  process.exitCode = 1;
}
