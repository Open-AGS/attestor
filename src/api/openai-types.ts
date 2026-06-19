import type {
  LlmProviderProofContextBinding,
  LlmProviderPurpose,
} from './llm-provider-registry.js';

export interface GptCallParams {
  systemPrompt: string;
  userMessage: string;
  stage: string;
  /** Reasoning effort level - maps to reasoning.effort on the Responses API. */
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

export interface GptCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Whether the response used cached input tokens (provider-side). */
  cachedInputTokens: number;
  /** Provider-returned model name, when the API response exposes one. */
  observedModel: string | null;
  /** True when the provider-returned model differs from Attestor's configured model. */
  modelDriftObserved: boolean;
  /** Digest-only provider/model/prompt/config binding for live-model proof. */
  providerProofContext: LlmProviderProofContextBinding;
  /** Non-secret runtime policy metadata applied to this provider call. */
  runtimePolicy: OpenAiRuntimePolicySummary;
}

export const OPENAI_RUNTIME_POLICY_VERSION = 'openai-runtime-policy.v1' as const;
export const DEFAULT_OPENAI_TIMEOUT_MS = 120_000;
export const DEFAULT_OPENAI_MAX_ATTEMPTS = 2;
export const DEFAULT_OPENAI_RETRY_INITIAL_DELAY_MS = 1_000;
export const DEFAULT_OPENAI_RETRY_MAX_DELAY_MS = 8_000;
export const DEFAULT_OPENAI_REASONING_MAX_OUTPUT_TOKENS = 32_000;
export const DEFAULT_OPENAI_VISION_MAX_OUTPUT_TOKENS = 4_000;
export const OPENAI_LIVE_SMOKE_PROOF_VERSION = 'openai-live-smoke-proof.v1' as const;
export const OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT = 'ATTESTOR_OPENAI_SMOKE_OK' as const;
export const DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS = 64;
export const DEFAULT_OPENAI_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES = 24 * 60;

export const OPENAI_LIVE_SMOKE_PROOF_ENV = Object.freeze({
  digest: 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_DIGEST',
  checkedAt: 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_CHECKED_AT',
  model: 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_MODEL',
  purpose: 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_PURPOSE',
  maxAgeMinutes: 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES',
} as const);

export type OpenAiRuntimePurpose = Extract<LlmProviderPurpose, 'reasoning' | 'vision'>;

export type OpenAiLiveSmokeProofState = 'not-configured' | 'valid' | 'invalid' | 'stale';

export interface OpenAiLiveSmokeProofEnvEvaluation {
  readonly version: typeof OPENAI_LIVE_SMOKE_PROOF_VERSION;
  readonly state: OpenAiLiveSmokeProofState;
  readonly proofDigest: string | null;
  readonly checkedAt: string | null;
  readonly model: string | null;
  readonly purpose: OpenAiRuntimePurpose | null;
  readonly maxAgeMinutes: number;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly blockers: readonly string[];
}

export interface OpenAiLiveSmokeProof {
  readonly version: typeof OPENAI_LIVE_SMOKE_PROOF_VERSION;
  readonly providerId: 'openai';
  readonly purpose: 'reasoning';
  readonly configuredModel: string;
  readonly observedModel: string | null;
  readonly modelDriftObserved: boolean;
  readonly checkedAt: string;
  readonly requestStore: false;
  readonly sdkMaxRetries: 0;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly responseAccepted: boolean;
  readonly responseDigest: string;
  readonly providerProofContext: LlmProviderProofContextBinding;
  readonly proofDigest: string;
  readonly env: Readonly<typeof OPENAI_LIVE_SMOKE_PROOF_ENV>;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly productionReady: false;
}

export interface OpenAiRuntimePolicy {
  readonly version: typeof OPENAI_RUNTIME_POLICY_VERSION;
  readonly providerId: 'openai';
  readonly purpose: OpenAiRuntimePurpose;
  readonly configuredModel: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly retryInitialDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly maxOutputTokens: number;
  readonly configuredMaxOutputTokens: number;
  readonly requestedMaxOutputTokens: number | null;
  readonly sdkMaxRetries: 0;
  readonly responseStore: false;
  readonly productionLikeRuntime: boolean;
  readonly productionReady: false;
  readonly liveSmokeProof: OpenAiLiveSmokeProofEnvEvaluation;
  readonly configDigest: string;
  readonly blockers: readonly string[];
}

export type OpenAiRuntimePolicySummary = Pick<
  OpenAiRuntimePolicy,
  | 'version'
  | 'providerId'
  | 'purpose'
  | 'configuredModel'
  | 'timeoutMs'
  | 'maxAttempts'
  | 'maxOutputTokens'
  | 'sdkMaxRetries'
  | 'responseStore'
  | 'productionLikeRuntime'
  | 'productionReady'
  | 'liveSmokeProof'
  | 'configDigest'
>;

export interface OpenAiModelObservation {
  configuredModel: string;
  observedModel: string | null;
  modelDriftObserved: boolean;
}

export interface GptVisionCallParams {
  systemPrompt: string;
  userText: string;
  /** Base64-encoded image data (PNG or JPEG). */
  imageBase64: string;
  /** MIME type of the image. */
  mediaType?: 'image/png' | 'image/jpeg' | 'image/webp';
  stage: string;
  maxTokens?: number;
}
