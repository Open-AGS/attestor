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
  readonly retryBackoff: 'openai-and-anthropic-wrapper-jittered-exponential' | 'jittered-exponential-required-before-production';
  readonly timeoutBudget: 'openai-and-anthropic-wrapper-wired' | 'required-before-production';
  readonly costBudget: 'openai-and-anthropic-output-token-budget-wired' | 'required-before-production';
  readonly liveSmokeProof: 'openai-and-anthropic-reasoning-external-live-probes-wired' | 'required-before-production';
  readonly failoverMode: 'disabled-single-provider' | 'fail-closed-until-two-wired-providers';
  readonly failoverCompatibility: 'same-purpose-model-capability-rate-limit-required';
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

export interface LlmProviderRouteRequirements {
  readonly textGeneration: boolean;
  readonly multimodalVision: boolean;
  readonly toolCalling: boolean;
  readonly structuredOutput: boolean;
  readonly rateLimitPolicy: boolean;
}

export interface LlmProviderRouteDecision {
  readonly status: 'selected' | 'blocked';
  readonly providerId: LlmProviderId | null;
  readonly model: string | null;
  readonly requiredCapabilities: LlmProviderRouteRequirements;
  readonly selectedProviderStructuredOutputMode: LlmStructuredOutputMode | null;
  readonly failoverProviderIds: readonly LlmProviderId[];
  readonly failoverCompatibilityReady: boolean;
  readonly blockers: readonly string[];
  readonly productionReady: false;
  readonly activatesLiveProviderCall: false;
}

export type LlmProviderLiveSmokeProofState =
  | 'not-configured'
  | 'valid'
  | 'invalid'
  | 'stale';

export type LlmProviderRoutingReadinessState =
  | 'evaluation-route-ready'
  | 'production-route-contract-ready'
  | 'blocked';

export interface LlmProviderRuntimeEvidence {
  readonly providerId: LlmProviderId;
  readonly purpose: LlmProviderPurpose;
  readonly configuredModel: string;
  readonly observedModel?: string | null;
  readonly liveSmokeProofState?: LlmProviderLiveSmokeProofState | null;
  readonly liveSmokeProofDigest?: string | null;
  readonly customerApprovalDigest?: string | null;
  readonly dataResidencyApprovalDigest?: string | null;
  readonly retentionApprovalDigest?: string | null;
  readonly rateLimitPolicyDigest?: string | null;
  readonly timeoutPolicyDigest?: string | null;
  readonly budgetPolicyDigest?: string | null;
  readonly outputSchemaDigest?: string | null;
  readonly toolSchemaDigest?: string | null;
  readonly sdkRetriesDisabled?: boolean | null;
  readonly responseStorageDisabled?: boolean | null;
  readonly rawPromptStored?: boolean | null;
  readonly rawProviderBodyStored?: boolean | null;
  readonly credentialValuesExposed?: boolean | null;
}

export interface EvaluateLlmProviderRoutingReadinessInput {
  readonly request: LlmProviderRouteRequest;
  readonly primaryEvidence?: LlmProviderRuntimeEvidence | null;
  readonly failoverEvidence?: readonly LlmProviderRuntimeEvidence[];
}

export interface LlmProviderRoutingReadinessEvaluation {
  readonly version: typeof LLM_PROVIDER_REGISTRY_VERSION;
  readonly state: LlmProviderRoutingReadinessState;
  readonly purpose: LlmProviderPurpose;
  readonly selectedPrimaryProviderId: LlmProviderId | null;
  readonly selectedPrimaryModel: string | null;
  readonly failoverProviderIds: readonly LlmProviderId[];
  readonly evidenceProviderIds: readonly LlmProviderId[];
  readonly readyForSelectedProfile: boolean;
  readonly productionReady: false;
  readonly activatesLiveProviderCall: false;
  readonly blockers: readonly string[];
  readonly nonClaims: readonly string[];
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
