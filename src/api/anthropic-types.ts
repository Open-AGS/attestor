import type {
  LlmProviderProofContextBinding,
  LlmProviderPurpose,
} from './llm-provider-registry.js';

export const ANTHROPIC_RUNTIME_POLICY_VERSION = 'anthropic-runtime-policy.v1' as const;
export const ANTHROPIC_LIVE_SMOKE_PROOF_VERSION = 'anthropic-live-smoke-proof.v1' as const;
export const ANTHROPIC_API_VERSION = '2023-06-01' as const;
export const DEFAULT_ANTHROPIC_TIMEOUT_MS = 120_000;
export const DEFAULT_ANTHROPIC_MAX_ATTEMPTS = 2;
export const DEFAULT_ANTHROPIC_RETRY_INITIAL_DELAY_MS = 1_000;
export const DEFAULT_ANTHROPIC_RETRY_MAX_DELAY_MS = 8_000;
export const DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS = 16_000;
export const DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS = 64;
export const DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES = 24 * 60;
export const ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT = 'ATTESTOR_ANTHROPIC_SMOKE_OK' as const;

export const ANTHROPIC_LIVE_SMOKE_PROOF_ENV = Object.freeze({
  digest: 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_DIGEST',
  checkedAt: 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_CHECKED_AT',
  model: 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_MODEL',
  purpose: 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_PURPOSE',
  maxAgeMinutes: 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES',
} as const);

export const ANTHROPIC_RATE_LIMIT_HEADER_NAMES = Object.freeze([
  'retry-after',
  'anthropic-ratelimit-requests-remaining',
  'anthropic-ratelimit-input-tokens-remaining',
  'anthropic-ratelimit-output-tokens-remaining',
] as const);

export type AnthropicRuntimePurpose =
  Extract<LlmProviderPurpose, 'reasoning' | 'structured-output' | 'tool-routing'>;
export type AnthropicLiveSmokeProofState = 'not-configured' | 'valid' | 'invalid' | 'stale';

export interface AnthropicCallParams {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly stage: string;
  readonly maxTokens?: number;
}

export interface AnthropicCallResult {
  readonly content: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly cachedInputTokens: number;
  readonly observedModel: string | null;
  readonly modelDriftObserved: boolean;
  readonly providerProofContext: LlmProviderProofContextBinding;
  readonly runtimePolicy: AnthropicRuntimePolicySummary;
  readonly rateLimitSignals: readonly AnthropicRateLimitSignal[];
  readonly rateLimitSignalDigest: string;
}

export interface AnthropicStrictToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Readonly<Record<string, unknown>>;
}

export interface AnthropicStrictToolCallParams extends AnthropicCallParams {
  readonly tool: AnthropicStrictToolDefinition;
}

export interface AnthropicStrictToolCallResult {
  readonly toolName: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly inputDigest: string;
  readonly observedModel: string | null;
  readonly modelDriftObserved: boolean;
  readonly providerProofContext: LlmProviderProofContextBinding;
  readonly runtimePolicy: AnthropicRuntimePolicySummary;
  readonly rateLimitSignals: readonly AnthropicRateLimitSignal[];
  readonly rateLimitSignalDigest: string;
}

export interface AnthropicRuntimePolicy {
  readonly version: typeof ANTHROPIC_RUNTIME_POLICY_VERSION;
  readonly providerId: 'anthropic';
  readonly purpose: AnthropicRuntimePurpose;
  readonly configuredModel: string;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly retryInitialDelayMs: number;
  readonly retryMaxDelayMs: number;
  readonly maxOutputTokens: number;
  readonly configuredMaxOutputTokens: number;
  readonly requestedMaxOutputTokens: number | null;
  readonly transportMaxRetries: 0;
  readonly responseStorageDisabled: true;
  readonly productionLikeRuntime: boolean;
  readonly productionReady: false;
  readonly liveSmokeProof: AnthropicLiveSmokeProofEnvEvaluation;
  readonly configDigest: string;
  readonly blockers: readonly string[];
}

export type AnthropicRuntimePolicySummary = Pick<
  AnthropicRuntimePolicy,
  | 'version'
  | 'providerId'
  | 'purpose'
  | 'configuredModel'
  | 'timeoutMs'
  | 'maxAttempts'
  | 'maxOutputTokens'
  | 'transportMaxRetries'
  | 'responseStorageDisabled'
  | 'productionLikeRuntime'
  | 'productionReady'
  | 'liveSmokeProof'
  | 'configDigest'
>;

export interface AnthropicLiveSmokeProofEnvEvaluation {
  readonly version: typeof ANTHROPIC_LIVE_SMOKE_PROOF_VERSION;
  readonly state: AnthropicLiveSmokeProofState;
  readonly proofDigest: string | null;
  readonly checkedAt: string | null;
  readonly model: string | null;
  readonly purpose: AnthropicRuntimePurpose | null;
  readonly maxAgeMinutes: number;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly blockers: readonly string[];
}

export interface AnthropicLiveSmokeProof {
  readonly version: typeof ANTHROPIC_LIVE_SMOKE_PROOF_VERSION;
  readonly providerId: 'anthropic';
  readonly purpose: 'reasoning';
  readonly configuredModel: string;
  readonly observedModel: string | null;
  readonly modelDriftObserved: boolean;
  readonly checkedAt: string;
  readonly transportMaxRetries: 0;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly responseAccepted: boolean;
  readonly responseDigest: string;
  readonly rateLimitSignalDigest: string;
  readonly providerProofContext: LlmProviderProofContextBinding;
  readonly proofDigest: string;
  readonly env: Readonly<typeof ANTHROPIC_LIVE_SMOKE_PROOF_ENV>;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly productionReady: false;
}

export interface AnthropicRateLimitSignal {
  readonly name: string;
  readonly valueDigest: string;
}

export interface AnthropicMessageTextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface AnthropicMessageToolUseBlock {
  readonly type: 'tool_use';
  readonly id?: string;
  readonly name: string;
  readonly input: unknown;
}

export type AnthropicMessageContentBlock =
  AnthropicMessageTextBlock | AnthropicMessageToolUseBlock;

export interface AnthropicMessageResponse {
  readonly id?: string;
  readonly type?: 'message';
  readonly role?: 'assistant';
  readonly content?: readonly AnthropicMessageContentBlock[];
  readonly model?: string;
  readonly stop_reason?: string | null;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_creation_input_tokens?: number;
    readonly cache_read_input_tokens?: number;
  };
}

export interface AnthropicMessagesRequestOptions {
  readonly timeoutMs: number;
}

export interface AnthropicMessagesTransportResponse {
  readonly body: AnthropicMessageResponse;
  readonly headers: Readonly<Record<string, string | null | undefined>>;
  readonly statusCode: number;
}
