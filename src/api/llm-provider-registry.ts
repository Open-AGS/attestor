import { createHash } from 'node:crypto';

import { OPENAI_REASONING_MODEL, OPENAI_VISION_MODEL } from './llm-provider-models.js';

export const LLM_PROVIDER_REGISTRY_VERSION = 'llm-provider-registry.v1' as const;

export type LlmProviderId = 'openai' | 'anthropic' | 'vertex-ai' | 'azure-openai';
export type LlmProviderWireStatus = 'wired' | 'planned' | 'disabled';
export type LlmProviderPurpose = 'reasoning' | 'vision' | 'structured-output' | 'tool-routing' | 'fallback';
export type LlmProviderEvaluationState =
  | 'single-provider-evaluation-ready'
  | 'routing-contract-ready'
  | 'blocked';

export type LlmStructuredOutputMode =
  | 'openai-response-format-json-schema'
  | 'anthropic-strict-tool-schema'
  | 'vertex-response-schema'
  | 'azure-openai-json-schema'
  | 'none';

export interface LlmProviderSourceAnchor {
  readonly name: string;
  readonly url: string;
  readonly scope: string;
}

export interface LlmProviderCapabilities {
  readonly textGeneration: boolean;
  readonly multimodalVision: boolean;
  readonly toolCalling: boolean;
  readonly structuredOutputMode: LlmStructuredOutputMode;
  readonly responseApiStyle: 'responses' | 'messages' | 'generate-content' | 'deployment-chat-completions';
}

export interface LlmProviderReadinessPolicy {
  readonly customerApprovalRequired: boolean;
  readonly dataResidencyApprovalRequired: boolean;
  readonly retentionApprovalRequired: boolean;
  readonly timeoutPolicyRequired: boolean;
  readonly budgetPolicyRequired: boolean;
  readonly rateLimitPolicyRequired: boolean;
  readonly liveSmokeProofRequired: boolean;
}

export interface LlmProviderRegistration {
  readonly id: LlmProviderId;
  readonly displayName: string;
  readonly wireStatus: LlmProviderWireStatus;
  readonly defaultModelsByPurpose: Readonly<Partial<Record<LlmProviderPurpose, string>>>;
  readonly credentialRefs: readonly string[];
  readonly capability: LlmProviderCapabilities;
  readonly rateLimitSignals: readonly string[];
  readonly sourceAnchors: readonly LlmProviderSourceAnchor[];
  readonly readinessPolicy: LlmProviderReadinessPolicy;
}

export interface LlmProviderRuntimePolicy {
  readonly maxAttempts: number;
  readonly retryBackoff: 'openai-wrapper-jittered-exponential' | 'jittered-exponential-required-before-production';
  readonly timeoutBudget: 'openai-wrapper-wired' | 'required-before-production';
  readonly costBudget: 'openai-output-token-budget-wired' | 'required-before-production';
  readonly liveSmokeProof: 'openai-reasoning-external-live-probe-wired' | 'required-before-production';
  readonly failoverMode: 'disabled-single-provider' | 'fail-closed-until-two-wired-providers';
  readonly storesRawPrompt: false;
  readonly storesRawProviderBody: false;
  readonly exposesCredentialValues: false;
}

export interface LlmProviderRegistryDescriptor {
  readonly version: typeof LLM_PROVIDER_REGISTRY_VERSION;
  readonly protectedPrinciples: readonly string[];
  readonly providers: readonly LlmProviderRegistration[];
  readonly runtimePolicy: LlmProviderRuntimePolicy;
  readonly proofContextContract: {
    readonly bindsProviderId: boolean;
    readonly bindsConfiguredModel: boolean;
    readonly bindsObservedModelWhenPresent: boolean;
    readonly requiresPromptDigest: boolean;
    readonly requiresConfigDigest: boolean;
    readonly requiresToolSchemaDigestWhenToolsMatter: boolean;
    readonly rawPromptStored: false;
    readonly rawProviderBodyStored: false;
  };
  readonly nonClaims: readonly string[];
}

export interface LlmProviderRegistryEvaluationOptions {
  readonly providers?: readonly LlmProviderRegistration[];
  readonly requireProductionRuntime?: boolean;
  readonly requireFailover?: boolean;
  readonly requireStructuredOutput?: boolean;
  readonly purpose?: LlmProviderPurpose;
}

export interface LlmProviderRegistryEvaluation {
  readonly version: typeof LLM_PROVIDER_REGISTRY_VERSION;
  readonly state: LlmProviderEvaluationState;
  readonly purpose: LlmProviderPurpose;
  readonly wiredProviderIds: readonly LlmProviderId[];
  readonly plannedProviderIds: readonly LlmProviderId[];
  readonly selectedPrimaryProviderId: LlmProviderId | null;
  readonly multiProviderResilienceReady: boolean;
  readonly productionReady: false;
  readonly blockers: readonly string[];
  readonly nonClaims: readonly string[];
}

export interface LlmProviderRouteRequest {
  readonly purpose: LlmProviderPurpose;
  readonly providerId?: LlmProviderId;
  readonly requireProductionRuntime?: boolean;
  readonly requireFailover?: boolean;
  readonly requireStructuredOutput?: boolean;
  readonly providers?: readonly LlmProviderRegistration[];
}

export interface LlmProviderRouteDecision {
  readonly status: 'selected' | 'blocked';
  readonly providerId: LlmProviderId | null;
  readonly model: string | null;
  readonly failoverProviderIds: readonly LlmProviderId[];
  readonly blockers: readonly string[];
  readonly productionReady: false;
  readonly activatesLiveProviderCall: false;
}

export interface LlmProviderProofContextInput {
  readonly providerId: LlmProviderId;
  readonly configuredModel: string;
  readonly observedModel?: string | null;
  readonly purpose: LlmProviderPurpose;
  readonly promptDigest: string;
  readonly configDigest: string;
  readonly templateDigest?: string;
  readonly toolSchemaDigest?: string;
  readonly outputSchemaDigest?: string;
}

export interface LlmProviderProofContextBinding {
  readonly version: typeof LLM_PROVIDER_REGISTRY_VERSION;
  readonly providerId: LlmProviderId;
  readonly purpose: LlmProviderPurpose;
  readonly configuredModel: string;
  readonly configuredModelDigest: string;
  readonly observedModel: string | null;
  readonly observedModelDigest: string | null;
  readonly promptDigest: string;
  readonly configDigest: string;
  readonly templateDigest: string | null;
  readonly toolSchemaDigest: string | null;
  readonly outputSchemaDigest: string | null;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly exposesCredentialValues: false;
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

const ALWAYS_REQUIRED_READINESS: LlmProviderReadinessPolicy = Object.freeze({
  customerApprovalRequired: true,
  dataResidencyApprovalRequired: true,
  retentionApprovalRequired: true,
  timeoutPolicyRequired: true,
  budgetPolicyRequired: true,
  rateLimitPolicyRequired: true,
  liveSmokeProofRequired: true,
});

export const DEFAULT_LLM_PROVIDER_REGISTRATIONS: readonly LlmProviderRegistration[] = Object.freeze([
  {
    id: 'openai',
    displayName: 'OpenAI',
    wireStatus: 'wired',
    defaultModelsByPurpose: Object.freeze({
      reasoning: OPENAI_REASONING_MODEL,
      vision: OPENAI_VISION_MODEL,
      'structured-output': OPENAI_REASONING_MODEL,
    }),
    credentialRefs: Object.freeze(['OPENAI_API_KEY']),
    capability: Object.freeze({
      textGeneration: true,
      multimodalVision: true,
      toolCalling: true,
      structuredOutputMode: 'openai-response-format-json-schema',
      responseApiStyle: 'responses',
    }),
    rateLimitSignals: Object.freeze(['429 rate-limit error', 'retry-after', 'jittered exponential backoff required']),
    sourceAnchors: Object.freeze([
      {
        name: 'OpenAI Responses API',
        url: 'https://platform.openai.com/docs/api-reference/responses',
        scope: 'Text, image, JSON output, and tool-capable response surface.',
      },
      {
        name: 'OpenAI structured outputs',
        url: 'https://platform.openai.com/docs/guides/structured-outputs',
        scope: 'JSON schema structured output contract.',
      },
      {
        name: 'OpenAI rate limits',
        url: 'https://platform.openai.com/docs/guides/rate-limits',
        scope: 'Rate-limit retry and backoff expectations.',
      },
    ]),
    readinessPolicy: ALWAYS_REQUIRED_READINESS,
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic Claude',
    wireStatus: 'planned',
    defaultModelsByPurpose: Object.freeze({}),
    credentialRefs: Object.freeze(['ANTHROPIC_API_KEY']),
    capability: Object.freeze({
      textGeneration: true,
      multimodalVision: true,
      toolCalling: true,
      structuredOutputMode: 'anthropic-strict-tool-schema',
      responseApiStyle: 'messages',
    }),
    rateLimitSignals: Object.freeze([
      'retry-after',
      'anthropic-ratelimit-requests-remaining',
      'anthropic-ratelimit-input-tokens-remaining',
      'anthropic-ratelimit-output-tokens-remaining',
    ]),
    sourceAnchors: Object.freeze([
      {
        name: 'Anthropic Messages API',
        url: 'https://docs.anthropic.com/en/api/messages',
        scope: 'Claude message generation API surface.',
      },
      {
        name: 'Anthropic tool use',
        url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
        scope: 'Tool calls, client execution boundary, and strict tool-use schema.',
      },
      {
        name: 'Anthropic rate limits',
        url: 'https://docs.anthropic.com/en/api/rate-limits',
        scope: 'Provider rate-limit headers and retry signals.',
      },
    ]),
    readinessPolicy: ALWAYS_REQUIRED_READINESS,
  },
  {
    id: 'vertex-ai',
    displayName: 'Google Vertex AI',
    wireStatus: 'planned',
    defaultModelsByPurpose: Object.freeze({}),
    credentialRefs: Object.freeze(['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION']),
    capability: Object.freeze({
      textGeneration: true,
      multimodalVision: true,
      toolCalling: true,
      structuredOutputMode: 'vertex-response-schema',
      responseApiStyle: 'generate-content',
    }),
    rateLimitSignals: Object.freeze(['Vertex AI quota metrics', '429 resource exhausted', 'regional model quota']),
    sourceAnchors: Object.freeze([
      {
        name: 'Vertex AI structured output',
        url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output',
        scope: 'responseSchema and response MIME type contract.',
      },
      {
        name: 'Vertex AI generative quotas',
        url: 'https://cloud.google.com/vertex-ai/generative-ai/docs/quotas',
        scope: 'Provider quota boundary.',
      },
    ]),
    readinessPolicy: ALWAYS_REQUIRED_READINESS,
  },
  {
    id: 'azure-openai',
    displayName: 'Azure OpenAI',
    wireStatus: 'planned',
    defaultModelsByPurpose: Object.freeze({}),
    credentialRefs: Object.freeze(['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_DEPLOYMENT']),
    capability: Object.freeze({
      textGeneration: true,
      multimodalVision: true,
      toolCalling: true,
      structuredOutputMode: 'azure-openai-json-schema',
      responseApiStyle: 'deployment-chat-completions',
    }),
    rateLimitSignals: Object.freeze(['regional TPM quota', 'regional RPM quota', 'deployment quota']),
    sourceAnchors: Object.freeze([
      {
        name: 'Azure OpenAI structured outputs',
        url: 'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs',
        scope: 'JSON schema response_format with strict mode.',
      },
      {
        name: 'Azure OpenAI quotas and limits',
        url: 'https://learn.microsoft.com/en-us/azure/ai-foundry/openai/quotas-limits',
        scope: 'Regional TPM/RPM quota boundary by subscription and deployment.',
      },
    ]),
    readinessPolicy: ALWAYS_REQUIRED_READINESS,
  },
]);

export function llmProviderRegistryDescriptor(): LlmProviderRegistryDescriptor {
  return {
    version: LLM_PROVIDER_REGISTRY_VERSION,
    protectedPrinciples: Object.freeze([
      'fail-closed boundary',
      'customer authority',
      'data minimization and redaction',
      'runtime readiness',
      'auditability',
      'operational boundedness',
      'no overclaim',
    ]),
    providers: DEFAULT_LLM_PROVIDER_REGISTRATIONS,
    runtimePolicy: Object.freeze({
      maxAttempts: 2,
      retryBackoff: 'openai-wrapper-jittered-exponential',
      timeoutBudget: 'openai-wrapper-wired',
      costBudget: 'openai-output-token-budget-wired',
      liveSmokeProof: 'openai-reasoning-external-live-probe-wired',
      failoverMode: 'fail-closed-until-two-wired-providers',
      storesRawPrompt: false,
      storesRawProviderBody: false,
      exposesCredentialValues: false,
    }),
    proofContextContract: Object.freeze({
      bindsProviderId: true,
      bindsConfiguredModel: true,
      bindsObservedModelWhenPresent: true,
      requiresPromptDigest: true,
      requiresConfigDigest: true,
      requiresToolSchemaDigestWhenToolsMatter: true,
      rawPromptStored: false,
      rawProviderBodyStored: false,
    }),
    nonClaims: registryNonClaims(),
  };
}

export function evaluateLlmProviderRegistry(
  options: LlmProviderRegistryEvaluationOptions = {},
): LlmProviderRegistryEvaluation {
  const purpose = options.purpose ?? 'reasoning';
  const providers = options.providers ?? DEFAULT_LLM_PROVIDER_REGISTRATIONS;
  const wiredProviders = providers.filter((provider) => provider.wireStatus === 'wired');
  const plannedProviders = providers.filter((provider) => provider.wireStatus === 'planned');
  const selectedPrimaryProvider = findWiredProviderForPurpose(providers, purpose);
  const blockers = collectReadinessBlockers({
    providers,
    selectedPrimaryProvider,
    purpose,
    requireFailover: options.requireFailover ?? false,
    requireStructuredOutput: options.requireStructuredOutput ?? false,
    requireProductionRuntime: options.requireProductionRuntime ?? false,
  });

  const multiProviderResilienceReady = wiredProviders.length >= 2 && blockers.length === 0;
  const state: LlmProviderEvaluationState = blockers.length > 0
    ? 'blocked'
    : multiProviderResilienceReady
      ? 'routing-contract-ready'
      : 'single-provider-evaluation-ready';

  return {
    version: LLM_PROVIDER_REGISTRY_VERSION,
    state,
    purpose,
    wiredProviderIds: Object.freeze(wiredProviders.map((provider) => provider.id)),
    plannedProviderIds: Object.freeze(plannedProviders.map((provider) => provider.id)),
    selectedPrimaryProviderId: selectedPrimaryProvider?.id ?? null,
    multiProviderResilienceReady,
    productionReady: false,
    blockers: Object.freeze(blockers),
    nonClaims: registryNonClaims(),
  };
}

export function evaluateLlmProviderRoute(request: LlmProviderRouteRequest): LlmProviderRouteDecision {
  const providers = request.providers ?? DEFAULT_LLM_PROVIDER_REGISTRATIONS;
  const selectedProvider = request.providerId
    ? providers.find((provider) => provider.id === request.providerId)
    : findWiredProviderForPurpose(providers, request.purpose);

  const wiredFallbackProviders = providers.filter((provider) => {
    return provider.wireStatus === 'wired'
      && provider.id !== selectedProvider?.id
      && Boolean(provider.defaultModelsByPurpose[request.purpose]);
  });

  const blockers = collectReadinessBlockers({
    providers,
    selectedPrimaryProvider: selectedProvider ?? null,
    purpose: request.purpose,
    requireFailover: request.requireFailover ?? false,
    requireStructuredOutput: request.requireStructuredOutput ?? false,
    requireProductionRuntime: request.requireProductionRuntime ?? false,
  });

  const model = selectedProvider?.defaultModelsByPurpose[request.purpose] ?? null;

  return {
    status: blockers.length === 0 ? 'selected' : 'blocked',
    providerId: selectedProvider?.id ?? null,
    model,
    failoverProviderIds: Object.freeze(wiredFallbackProviders.map((provider) => provider.id)),
    blockers: Object.freeze(blockers),
    productionReady: false,
    activatesLiveProviderCall: false,
  };
}

export function bindLlmProviderProofContext(input: LlmProviderProofContextInput): LlmProviderProofContextBinding {
  requireDigest('promptDigest', input.promptDigest);
  requireDigest('configDigest', input.configDigest);
  requireOptionalDigest('templateDigest', input.templateDigest);
  requireOptionalDigest('toolSchemaDigest', input.toolSchemaDigest);
  requireOptionalDigest('outputSchemaDigest', input.outputSchemaDigest);

  return {
    version: LLM_PROVIDER_REGISTRY_VERSION,
    providerId: input.providerId,
    purpose: input.purpose,
    configuredModel: input.configuredModel,
    configuredModelDigest: digestText(input.configuredModel),
    observedModel: input.observedModel?.trim() || null,
    observedModelDigest: input.observedModel?.trim() ? digestText(input.observedModel.trim()) : null,
    promptDigest: input.promptDigest,
    configDigest: input.configDigest,
    templateDigest: input.templateDigest ?? null,
    toolSchemaDigest: input.toolSchemaDigest ?? null,
    outputSchemaDigest: input.outputSchemaDigest ?? null,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    exposesCredentialValues: false,
  };
}

export function digestLlmProviderContextValue(value: string): string {
  return digestText(value);
}

function findWiredProviderForPurpose(
  providers: readonly LlmProviderRegistration[],
  purpose: LlmProviderPurpose,
): LlmProviderRegistration | null {
  return providers.find((provider) => {
    return provider.wireStatus === 'wired' && Boolean(provider.defaultModelsByPurpose[purpose]);
  }) ?? null;
}

function collectReadinessBlockers(input: {
  readonly providers: readonly LlmProviderRegistration[];
  readonly selectedPrimaryProvider: LlmProviderRegistration | null;
  readonly purpose: LlmProviderPurpose;
  readonly requireFailover: boolean;
  readonly requireStructuredOutput: boolean;
  readonly requireProductionRuntime: boolean;
}): string[] {
  const blockers: string[] = [];
  const wiredProviders = input.providers.filter((provider) => provider.wireStatus === 'wired');

  if (!input.selectedPrimaryProvider) {
    blockers.push('llm-provider-primary-not-wired-for-purpose');
  } else if (input.selectedPrimaryProvider.wireStatus !== 'wired') {
    blockers.push('llm-provider-selected-provider-not-wired');
  }

  if (input.selectedPrimaryProvider && !input.selectedPrimaryProvider.defaultModelsByPurpose[input.purpose]) {
    blockers.push('llm-provider-model-not-configured-for-purpose');
  }

  if (input.requireStructuredOutput && input.selectedPrimaryProvider?.capability.structuredOutputMode === 'none') {
    blockers.push('llm-provider-structured-output-not-supported');
  }

  if (input.requireFailover && wiredProviders.length < 2) {
    blockers.push('llm-provider-failover-provider-not-wired');
  }

  if (input.requireProductionRuntime) {
    blockers.push('llm-provider-live-smoke-proof-required');
  }

  return blockers;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function requireDigest(field: string, value: string): void {
  if (!SHA256_DIGEST_PATTERN.test(value)) {
    throw new Error(`${field} must be a sha256:<hex> digest`);
  }
}

function requireOptionalDigest(field: string, value: string | undefined): void {
  if (value === undefined) return;
  requireDigest(field, value);
}

function registryNonClaims(): readonly string[] {
  return Object.freeze([
    'No Anthropic, Vertex AI, or Azure OpenAI client is implemented by this registry contract.',
    'No live provider failover is active.',
    'No hosted production LLM runtime readiness is claimed.',
    'No raw prompt or provider response body is stored by the proof-context binding.',
  ]);
}
