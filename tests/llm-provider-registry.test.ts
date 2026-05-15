import assert from 'node:assert/strict';

import {
  DEFAULT_LLM_PROVIDER_REGISTRATIONS,
  bindLlmProviderProofContext,
  digestLlmProviderContextValue,
  evaluateLlmProviderRegistry,
  evaluateLlmProviderRoute,
  evaluateLlmProviderRoutingReadiness,
  llmProviderRegistryDescriptor,
  type LlmProviderRuntimeEvidence,
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
    descriptor.runtimePolicy.failoverCompatibility,
    'same-purpose-model-capability-rate-limit-required',
    'Registry: failover requires same-purpose model, capability, and rate-limit compatibility',
  );
  equal(
    descriptor.runtimePolicy.retryBackoff,
    'openai-wrapper-jittered-exponential',
    'Registry: OpenAI wrapper has bounded jittered retry policy',
  );
  equal(
    descriptor.runtimePolicy.timeoutBudget,
    'openai-wrapper-wired',
    'Registry: OpenAI wrapper timeout budget is wired',
  );
  equal(
    descriptor.runtimePolicy.costBudget,
    'openai-output-token-budget-wired',
    'Registry: OpenAI output token budget is wired',
  );
  equal(
    descriptor.runtimePolicy.liveSmokeProof,
    'openai-reasoning-external-live-probe-wired',
    'Registry: OpenAI reasoning live smoke proof is wired as an external live probe',
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
    'llm-provider-live-smoke-proof-required',
    'Evaluation: live smoke proof blocker is explicit',
  );

  const openAiRoute = evaluateLlmProviderRoute({ purpose: 'reasoning' });
  equal(openAiRoute.status, 'selected', 'Route: default reasoning route is selectable');
  equal(openAiRoute.providerId, 'openai', 'Route: default reasoning route uses OpenAI');
  equal(openAiRoute.model, 'o3', 'Route: default reasoning route uses o3');
  equal(openAiRoute.requiredCapabilities.textGeneration, true, 'Route: reasoning requires text generation');
  equal(openAiRoute.requiredCapabilities.structuredOutput, false, 'Route: reasoning does not require structured output by default');
  equal(
    openAiRoute.selectedProviderStructuredOutputMode,
    'openai-response-format-json-schema',
    'Route: selected provider structured-output mode is exposed',
  );
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
  equal(failoverRoute.requiredCapabilities.rateLimitPolicy, true, 'Route: failover requires provider rate-limit policy');
  deepEqual(failoverRoute.failoverProviderIds, [], 'Route: failover providers only include compatible wired providers');
  equal(failoverRoute.failoverCompatibilityReady, false, 'Route: failover compatibility is not ready with one wired provider');
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
  const openAiProvider = DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'openai')!;
  const anthropicWiredWithoutReasoningModel: LlmProviderRegistration = {
    ...anthropicWired,
    defaultModelsByPurpose: {},
  };
  const missingModelFailoverEvaluation = evaluateLlmProviderRegistry({
    providers: [openAiProvider, anthropicWiredWithoutReasoningModel],
    requireFailover: true,
  });
  equal(
    missingModelFailoverEvaluation.state,
    'blocked',
    'Evaluation: a second wired provider without a purpose model does not satisfy failover',
  );
  includes(
    missingModelFailoverEvaluation.blockers,
    'llm-provider-compatible-failover-provider-not-ready',
    'Evaluation: incompatible wired fallback blocker is explicit',
  );
  const missingModelFailoverRoute = evaluateLlmProviderRoute({
    purpose: 'reasoning',
    providers: [openAiProvider, anthropicWiredWithoutReasoningModel],
    requireFailover: true,
  });
  deepEqual(
    missingModelFailoverRoute.failoverProviderIds,
    [],
    'Route: fallback list excludes wired providers missing the requested purpose model',
  );
  equal(
    missingModelFailoverRoute.failoverCompatibilityReady,
    false,
    'Route: failover compatibility is false when fallback model mapping is absent',
  );

  const anthropicWiredWithoutStructuredOutput: LlmProviderRegistration = {
    ...anthropicWired,
    capability: {
      ...anthropicWired.capability,
      structuredOutputMode: 'none',
    },
  };
  const structuredFailoverRoute = evaluateLlmProviderRoute({
    purpose: 'reasoning',
    providers: [openAiProvider, anthropicWiredWithoutStructuredOutput],
    requireFailover: true,
    requireStructuredOutput: true,
  });
  equal(
    structuredFailoverRoute.status,
    'blocked',
    'Route: structured-output failover blocks when the fallback provider cannot match structured output',
  );
  includes(
    structuredFailoverRoute.blockers,
    'llm-provider-compatible-failover-provider-not-ready',
    'Route: structured-output fallback incompatibility is explicit',
  );
  deepEqual(
    structuredFailoverRoute.failoverProviderIds,
    [],
    'Route: structured-output route excludes non-structured fallback providers',
  );

  const anthropicWiredWithoutRateLimitSignals: LlmProviderRegistration = {
    ...anthropicWired,
    rateLimitSignals: [],
  };
  const rateLimitFailoverRoute = evaluateLlmProviderRoute({
    purpose: 'reasoning',
    providers: [openAiProvider, anthropicWiredWithoutRateLimitSignals],
    requireFailover: true,
  });
  equal(
    rateLimitFailoverRoute.status,
    'blocked',
    'Route: failover blocks when the fallback provider lacks rate-limit signals',
  );
  includes(
    rateLimitFailoverRoute.blockers,
    'llm-provider-compatible-failover-provider-not-ready',
    'Route: fallback rate-limit incompatibility is explicit',
  );

  const defaultReadiness = evaluateLlmProviderRoutingReadiness({
    request: { purpose: 'reasoning' },
  });
  equal(
    defaultReadiness.state,
    'evaluation-route-ready',
    'Routing readiness: default non-production route is ready without live evidence',
  );
  equal(
    defaultReadiness.activatesLiveProviderCall,
    false,
    'Routing readiness: readiness evaluation does not activate provider calls',
  );

  const productionReadinessWithoutEvidence = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'structured-output',
      requireProductionRuntime: true,
      requireStructuredOutput: true,
    },
  });
  equal(
    productionReadinessWithoutEvidence.state,
    'blocked',
    'Routing readiness: production structured-output route blocks without runtime evidence',
  );
  includes(
    productionReadinessWithoutEvidence.blockers,
    'llm-provider-primary-runtime-evidence-missing',
    'Routing readiness: missing primary runtime evidence is explicit',
  );

  const validOpenAiStructuredEvidence: LlmProviderRuntimeEvidence = {
    providerId: 'openai',
    purpose: 'structured-output',
    configuredModel: 'o3',
    observedModel: 'o3',
    liveSmokeProofState: 'valid',
    liveSmokeProofDigest: digestLlmProviderContextValue('openai-structured-live-smoke-proof'),
    customerApprovalDigest: digestLlmProviderContextValue('customer-approval'),
    dataResidencyApprovalDigest: digestLlmProviderContextValue('data-residency-approval'),
    retentionApprovalDigest: digestLlmProviderContextValue('retention-approval'),
    rateLimitPolicyDigest: digestLlmProviderContextValue('rate-limit-policy'),
    timeoutPolicyDigest: digestLlmProviderContextValue('timeout-policy'),
    budgetPolicyDigest: digestLlmProviderContextValue('budget-policy'),
    outputSchemaDigest: digestLlmProviderContextValue('output-schema'),
    sdkRetriesDisabled: true,
    responseStorageDisabled: true,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    credentialValuesExposed: false,
  };
  const productionReadinessWithEvidence = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'structured-output',
      requireProductionRuntime: true,
      requireStructuredOutput: true,
    },
    primaryEvidence: validOpenAiStructuredEvidence,
  });
  equal(
    productionReadinessWithEvidence.state,
    'production-route-contract-ready',
    'Routing readiness: complete primary evidence clears the production route contract',
  );
  equal(
    productionReadinessWithEvidence.readyForSelectedProfile,
    true,
    'Routing readiness: complete evidence marks the selected profile ready',
  );
  equal(
    productionReadinessWithEvidence.productionReady,
    false,
    'Routing readiness: complete evidence still does not claim production readiness',
  );

  const rawPromptEvidence = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'structured-output',
      requireProductionRuntime: true,
      requireStructuredOutput: true,
    },
    primaryEvidence: {
      ...validOpenAiStructuredEvidence,
      rawPromptStored: true,
    },
  });
  includes(
    rawPromptEvidence.blockers,
    'llm-provider-primary-raw-prompt-storage-risk',
    'Routing readiness: raw prompt storage blocks provider readiness',
  );

  const twoProviderEvaluation = evaluateLlmProviderRegistry({
    providers: [openAiProvider, anthropicWired],
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
  const compatibleFailoverRoute = evaluateLlmProviderRoute({
    purpose: 'reasoning',
    providers: [openAiProvider, anthropicWired],
    requireFailover: true,
    requireStructuredOutput: true,
  });
  equal(compatibleFailoverRoute.status, 'selected', 'Route: compatible structured-output failover route can be selected');
  deepEqual(compatibleFailoverRoute.failoverProviderIds, ['anthropic'], 'Route: compatible fallback provider is exposed');
  equal(
    compatibleFailoverRoute.failoverCompatibilityReady,
    true,
    'Route: failover compatibility is true only after purpose, capability, and rate-limit parity',
  );

  const openAiReasoningEvidence: LlmProviderRuntimeEvidence = {
    providerId: 'openai',
    purpose: 'reasoning',
    configuredModel: 'o3',
    rateLimitPolicyDigest: digestLlmProviderContextValue('openai-rate-limit-policy'),
    rawPromptStored: false,
    rawProviderBodyStored: false,
    credentialValuesExposed: false,
  };
  const anthropicReasoningEvidence: LlmProviderRuntimeEvidence = {
    providerId: 'anthropic',
    purpose: 'reasoning',
    configuredModel: 'claude-sonnet-placeholder',
    rateLimitPolicyDigest: digestLlmProviderContextValue('anthropic-rate-limit-policy'),
    rawPromptStored: false,
    rawProviderBodyStored: false,
    credentialValuesExposed: false,
  };
  const failoverReadinessWithoutEvidence = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'reasoning',
      providers: [openAiProvider, anthropicWired],
      requireFailover: true,
    },
  });
  equal(
    failoverReadinessWithoutEvidence.state,
    'blocked',
    'Routing readiness: compatible failover route still blocks without runtime evidence',
  );
  includes(
    failoverReadinessWithoutEvidence.blockers,
    'llm-provider-primary-runtime-evidence-missing',
    'Routing readiness: failover requires primary provider evidence',
  );
  includes(
    failoverReadinessWithoutEvidence.blockers,
    'llm-provider-failover-runtime-evidence-missing',
    'Routing readiness: failover requires fallback provider evidence',
  );
  const failoverReadinessWithEvidence = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'reasoning',
      providers: [openAiProvider, anthropicWired],
      requireFailover: true,
    },
    primaryEvidence: openAiReasoningEvidence,
    failoverEvidence: [anthropicReasoningEvidence],
  });
  equal(
    failoverReadinessWithEvidence.state,
    'evaluation-route-ready',
    'Routing readiness: failover route clears after primary and fallback evidence',
  );
  deepEqual(
    failoverReadinessWithEvidence.evidenceProviderIds,
    ['openai', 'anthropic'],
    'Routing readiness: evidence provider ids are recorded without credentials',
  );

  console.log(`LLM provider registry tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('LLM provider registry tests failed:', error);
  process.exitCode = 1;
}
