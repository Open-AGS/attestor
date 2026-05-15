/**
 * OpenAI API client for the configured reasoning model.
 * Used for upstream analysis and verification.
 *
 * Uses the Responses API for reasoning control support.
 * The `effort` parameter maps to `reasoning.effort` on the request,
 * giving the model explicit guidance on how much thinking to invest.
 */

import OpenAI from 'openai';
import {
  bindLlmProviderProofContext,
  digestLlmProviderContextValue,
  type LlmProviderProofContextBinding,
  type LlmProviderPurpose,
} from './llm-provider-registry.js';
import { OPENAI_REASONING_MODEL, OPENAI_VISION_MODEL } from './llm-provider-models.js';
import { ApiError, ParseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ApiError('api', 'openai', 'OPENAI_API_KEY is not set in environment');
    }
    client = new OpenAI({ apiKey, maxRetries: 0 });
  }
  return client;
}

export interface GptCallParams {
  systemPrompt: string;
  userMessage: string;
  stage: string;
  /** Reasoning effort level — maps to reasoning.effort on the Responses API. */
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

export type OpenAiRuntimePurpose = Extract<LlmProviderPurpose, 'reasoning' | 'vision'>;

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
  | 'configDigest'
>;

/** Primary GPT model used for upstream analysis and verification. */
export const GPT_MODEL = OPENAI_REASONING_MODEL;
const MODEL = GPT_MODEL;

export interface OpenAiModelObservation {
  configuredModel: string;
  observedModel: string | null;
  modelDriftObserved: boolean;
}

function extractObservedModel(response: unknown): string | null {
  const model = (response as { readonly model?: unknown } | null)?.model;
  return typeof model === 'string' && model.trim() ? model.trim() : null;
}

export function observeOpenAiModel(configuredModel: string, response: unknown): OpenAiModelObservation {
  const observedModel = extractObservedModel(response);
  return {
    configuredModel,
    observedModel,
    modelDriftObserved: Boolean(observedModel && observedModel !== configuredModel),
  };
}

function logOpenAiModelObservation(stage: string, observation: OpenAiModelObservation): void {
  const fields = {
    configuredModel: observation.configuredModel,
    observedModel: observation.observedModel,
    modelDriftObserved: observation.modelDriftObserved,
  };

  if (observation.modelDriftObserved) {
    logger.warn(stage, 'OpenAI response model drift observed', fields);
    return;
  }

  logger.info(stage, 'OpenAI response model observation recorded', fields);
}

export function isOpenAiProductionLikeRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === 'production'
    || envTruthy(env.ATTESTOR_HA_MODE)
    || env.ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared'
    || Boolean(env.ATTESTOR_PUBLIC_HOSTNAME?.trim())
    || Boolean(env.ATTESTOR_PUBLIC_BASE_URL?.trim());
}

export function resolveOpenAiRuntimePolicy(input: {
  readonly purpose: OpenAiRuntimePurpose;
  readonly requestedMaxTokens?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): OpenAiRuntimePolicy {
  const env = input.env ?? process.env;
  const blockers: string[] = [];
  const configuredModel = input.purpose === 'reasoning' ? MODEL : VISION_MODEL;
  const configuredMaxOutputTokens = readBoundedIntegerEnv({
    env,
    name: input.purpose === 'reasoning'
      ? 'ATTESTOR_OPENAI_REASONING_MAX_OUTPUT_TOKENS'
      : 'ATTESTOR_OPENAI_VISION_MAX_OUTPUT_TOKENS',
    defaultValue: input.purpose === 'reasoning'
      ? DEFAULT_OPENAI_REASONING_MAX_OUTPUT_TOKENS
      : DEFAULT_OPENAI_VISION_MAX_OUTPUT_TOKENS,
    min: 1,
    max: input.purpose === 'reasoning' ? 128_000 : 16_000,
    blockerPrefix: 'openai-output-token-budget',
    blockers,
  });
  const timeoutMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_OPENAI_TIMEOUT_MS',
    defaultValue: DEFAULT_OPENAI_TIMEOUT_MS,
    min: 1_000,
    max: 600_000,
    blockerPrefix: 'openai-timeout-budget',
    blockers,
  });
  const maxAttempts = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_OPENAI_MAX_ATTEMPTS',
    defaultValue: DEFAULT_OPENAI_MAX_ATTEMPTS,
    min: 1,
    max: 4,
    blockerPrefix: 'openai-retry-budget',
    blockers,
  });
  const retryInitialDelayMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_OPENAI_RETRY_INITIAL_DELAY_MS',
    defaultValue: DEFAULT_OPENAI_RETRY_INITIAL_DELAY_MS,
    min: 100,
    max: 60_000,
    blockerPrefix: 'openai-retry-initial-delay',
    blockers,
  });
  const retryMaxDelayMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_OPENAI_RETRY_MAX_DELAY_MS',
    defaultValue: DEFAULT_OPENAI_RETRY_MAX_DELAY_MS,
    min: retryInitialDelayMs,
    max: 120_000,
    blockerPrefix: 'openai-retry-max-delay',
    blockers,
  });

  const requestedMaxOutputTokens = input.requestedMaxTokens ?? null;
  let maxOutputTokens = configuredMaxOutputTokens;
  if (requestedMaxOutputTokens !== null) {
    if (!Number.isInteger(requestedMaxOutputTokens) || requestedMaxOutputTokens < 1) {
      blockers.push('openai-output-token-budget:invalid-requested-max-tokens');
    } else if (requestedMaxOutputTokens > configuredMaxOutputTokens) {
      blockers.push('openai-output-token-budget:requested-max-tokens-exceeds-budget');
    } else {
      maxOutputTokens = requestedMaxOutputTokens;
    }
  }

  const productionLikeRuntime = isOpenAiProductionLikeRuntime(env);
  if (productionLikeRuntime) {
    blockers.push('openai-production-runtime-live-smoke-proof-not-wired');
  }

  const digestMaterial = {
    version: OPENAI_RUNTIME_POLICY_VERSION,
    providerId: 'openai' as const,
    purpose: input.purpose,
    configuredModel,
    timeoutMs,
    maxAttempts,
    retryInitialDelayMs,
    retryMaxDelayMs,
    maxOutputTokens,
    configuredMaxOutputTokens,
    sdkMaxRetries: 0 as const,
    responseStore: false as const,
    productionLikeRuntime,
  };

  return Object.freeze({
    ...digestMaterial,
    requestedMaxOutputTokens,
    productionReady: false,
    blockers: Object.freeze(blockers),
    configDigest: digestLlmProviderContextValue(stableJson(digestMaterial)),
  });
}

export function summarizeOpenAiRuntimePolicy(policy: OpenAiRuntimePolicy): OpenAiRuntimePolicySummary {
  return Object.freeze({
    version: policy.version,
    providerId: policy.providerId,
    purpose: policy.purpose,
    configuredModel: policy.configuredModel,
    timeoutMs: policy.timeoutMs,
    maxAttempts: policy.maxAttempts,
    maxOutputTokens: policy.maxOutputTokens,
    sdkMaxRetries: policy.sdkMaxRetries,
    responseStore: policy.responseStore,
    productionLikeRuntime: policy.productionLikeRuntime,
    productionReady: policy.productionReady,
    configDigest: policy.configDigest,
  });
}

export function computeOpenAiRetryDelayMs(
  attemptIndex: number,
  policy: Pick<OpenAiRuntimePolicy, 'retryInitialDelayMs' | 'retryMaxDelayMs'>,
  jitter: number = Math.random(),
): number {
  const boundedJitter = Math.max(0, Math.min(1, jitter));
  const exponentialDelay = policy.retryInitialDelayMs * (2 ** Math.max(0, attemptIndex));
  const jitterDelay = Math.floor(exponentialDelay * 0.25 * boundedJitter);
  return Math.min(policy.retryMaxDelayMs, exponentialDelay + jitterDelay);
}

function assertOpenAiRuntimePolicyAllowsCall(stage: string, policy: OpenAiRuntimePolicy): void {
  if (policy.blockers.length === 0) return;
  throw new ApiError(
    stage,
    'openai',
    `OpenAI runtime policy blocked call: ${policy.blockers.join(', ')}`,
  );
}

function openAiRequestOptions(policy: OpenAiRuntimePolicy): { readonly timeout: number; readonly maxRetries: 0 } {
  return { timeout: policy.timeoutMs, maxRetries: 0 };
}

function envTruthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function readBoundedIntegerEnv(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly name: string;
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly blockerPrefix: string;
  readonly blockers: string[];
}): number {
  const raw = input.env[input.name]?.trim();
  if (!raw) return input.defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < input.min || parsed > input.max) {
    input.blockers.push(`${input.blockerPrefix}:invalid-${input.name.toLowerCase()}`);
    return input.defaultValue;
  }
  return parsed;
}

function stableJson(value: Record<string, unknown>): string {
  const sorted = Object.keys(value).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = value[key];
    return acc;
  }, {});
  return JSON.stringify(sorted);
}

function buildOpenAiProviderProofContext(input: {
  readonly purpose: OpenAiRuntimePurpose;
  readonly configuredModel: string;
  readonly observedModel: string | null;
  readonly runtimePolicy: OpenAiRuntimePolicy;
  readonly promptDigest: string;
}): LlmProviderProofContextBinding {
  return bindLlmProviderProofContext({
    providerId: 'openai',
    configuredModel: input.configuredModel,
    observedModel: input.observedModel,
    purpose: input.purpose,
    promptDigest: input.promptDigest,
    configDigest: input.runtimePolicy.configDigest,
  });
}

/**
 * Call the configured OpenAI reasoning model via the Responses API.
 *
 * The Responses API supports:
 * - reasoning.effort: controls how much thinking the model invests
 * - Automatic input caching for repeated prefixes (provider-managed)
 * - Structured input via system/user content blocks
 */
/**
 * Build the Responses API request body for testability.
 * Exported so tests can verify the exact request shape
 * without making real API calls.
 */
export function buildGptRequestBody(
  params: GptCallParams,
  runtimePolicy = resolveOpenAiRuntimePolicy({ purpose: 'reasoning', requestedMaxTokens: params.maxTokens }),
) {
  const { systemPrompt, userMessage, effort = 'high' } = params;
  return {
    model: MODEL,
    max_output_tokens: runtimePolicy.maxOutputTokens,
    reasoning: { effort },
    instructions: systemPrompt,
    input: userMessage,
    store: false,
  };
}

export async function callGpt(params: GptCallParams): Promise<GptCallResult> {
  const { stage, effort = 'high' } = params;
  const runtimePolicy = resolveOpenAiRuntimePolicy({ purpose: 'reasoning', requestedMaxTokens: params.maxTokens });
  assertOpenAiRuntimePolicyAllowsCall(stage, runtimePolicy);

  logger.info(stage, `Calling OpenAI reasoning model ${MODEL} (effort: ${effort})...`, {
    timeoutMs: runtimePolicy.timeoutMs,
    maxOutputTokens: runtimePolicy.maxOutputTokens,
    maxAttempts: runtimePolicy.maxAttempts,
    responseStore: runtimePolicy.responseStore,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < runtimePolicy.maxAttempts; attempt++) {
    try {
      const requestBody = buildGptRequestBody(params, runtimePolicy);
      const response = await getClient().responses.create(requestBody, openAiRequestOptions(runtimePolicy));

      // Extract text output from response — handle both message and text output items
      let content: string | undefined;
      for (const item of response.output) {
        if ((item as any).type === 'message') {
          const msgContent = (item as any).content;
          if (Array.isArray(msgContent)) {
            const textPart = msgContent.find((c: any) => c.type === 'output_text');
            if (textPart?.text) { content = textPart.text; break; }
          }
        }
        // Direct text output
        if ((item as any).type === 'output_text' && (item as any).text) {
          content = (item as any).text;
          break;
        }
      }
      // Fallback: try output_text at top level
      if (!content) {
        content = (response as any).output_text;
      }

      if (!content) {
        throw new ParseError(stage, `Empty response from OpenAI model ${MODEL}`);
      }

      const usage = response.usage;
      const inputTokens = usage?.input_tokens ?? 0;
      const outputTokens = usage?.output_tokens ?? 0;
      const cachedInputTokens = (usage as any)?.input_tokens_details?.cached_tokens ?? 0;
      const modelObservation = observeOpenAiModel(MODEL, response);
      logOpenAiModelObservation(stage, modelObservation);
      const providerProofContext = buildOpenAiProviderProofContext({
        purpose: 'reasoning',
        configuredModel: MODEL,
        observedModel: modelObservation.observedModel,
        runtimePolicy,
        promptDigest: digestLlmProviderContextValue(stableJson({
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
        })),
      });

      logger.info(stage, `OpenAI model ${MODEL} response received`, {
        tokens: inputTokens + outputTokens,
        effort,
        cached: cachedInputTokens,
        providerConfigDigest: providerProofContext.configDigest,
      });

      return {
        content,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens,
        observedModel: modelObservation.observedModel,
        modelDriftObserved: modelObservation.modelDriftObserved,
        providerProofContext,
        runtimePolicy: summarizeOpenAiRuntimePolicy(runtimePolicy),
      };
    } catch (err) {
      lastError = err;

      if (err instanceof ParseError) throw err;

      const hasRetryBudget = attempt < runtimePolicy.maxAttempts - 1;
      if (hasRetryBudget) {
        const retryDelayMs = computeOpenAiRetryDelayMs(attempt, runtimePolicy);
        logger.warn(stage, `OpenAI model ${MODEL} call failed, retrying in ${retryDelayMs}ms...`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  throw new ApiError(
    stage,
    'openai',
    `Failed after ${runtimePolicy.maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

// ─── Multimodal Vision API ──────────────────────────────────────────────────

/** Vision model used for multimodal observation (reference images). */
export const GPT_VISION_MODEL = OPENAI_VISION_MODEL;
const VISION_MODEL = GPT_VISION_MODEL;

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

/**
 * Call GPT-4o with image + text for structured visual observation.
 * Uses Chat Completions API (Vision is not on Responses API yet).
 */
export async function callGptVision(params: GptVisionCallParams): Promise<GptCallResult> {
  const {
    systemPrompt, userText, imageBase64, stage,
    mediaType = 'image/png',
  } = params;
  const runtimePolicy = resolveOpenAiRuntimePolicy({ purpose: 'vision', requestedMaxTokens: params.maxTokens });
  assertOpenAiRuntimePolicyAllowsCall(stage, runtimePolicy);

  logger.info(stage, 'Calling GPT-4o Vision...', {
    timeoutMs: runtimePolicy.timeoutMs,
    maxOutputTokens: runtimePolicy.maxOutputTokens,
    maxAttempts: runtimePolicy.maxAttempts,
    responseStore: runtimePolicy.responseStore,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < runtimePolicy.maxAttempts; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: VISION_MODEL,
        max_tokens: runtimePolicy.maxOutputTokens,
        store: false,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: userText },
            ],
          },
        ],
      }, openAiRequestOptions(runtimePolicy));

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new ParseError(stage, 'Empty response from GPT-4o Vision');
      }

      const usage = response.usage;
      const modelObservation = observeOpenAiModel(VISION_MODEL, response);
      logOpenAiModelObservation(stage, modelObservation);
      const providerProofContext = buildOpenAiProviderProofContext({
        purpose: 'vision',
        configuredModel: VISION_MODEL,
        observedModel: modelObservation.observedModel,
        runtimePolicy,
        promptDigest: digestLlmProviderContextValue(stableJson({
          imageDigest: digestLlmProviderContextValue(imageBase64),
          mediaType,
          systemPrompt,
          userText,
        })),
      });
      logger.info(stage, 'GPT-4o Vision response received', {
        tokens: usage?.total_tokens ?? 0,
        providerConfigDigest: providerProofContext.configDigest,
      });

      return {
        content: choice.message.content,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        cachedInputTokens: 0,
        observedModel: modelObservation.observedModel,
        modelDriftObserved: modelObservation.modelDriftObserved,
        providerProofContext,
        runtimePolicy: summarizeOpenAiRuntimePolicy(runtimePolicy),
      };
    } catch (err) {
      lastError = err;
      if (err instanceof ParseError) throw err;
      const hasRetryBudget = attempt < runtimePolicy.maxAttempts - 1;
      if (hasRetryBudget) {
        const retryDelayMs = computeOpenAiRetryDelayMs(attempt, runtimePolicy);
        logger.warn(stage, `GPT-4o Vision call failed, retrying in ${retryDelayMs}ms...`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  throw new ApiError(
    stage, 'openai',
    `Vision failed after ${runtimePolicy.maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

/**
 * Extract JSON from a GPT response that may contain markdown code fences.
 */
export function extractJson<T>(content: string, stage: string): T {
  // Try direct parse first
  try {
    return JSON.parse(content) as T;
  } catch {
    // Try extracting from code fence
    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]) as T;
      } catch (e) {
        throw new ParseError(stage, `JSON inside code fence is malformed: ${e instanceof Error ? e.message : String(e)}`, content);
      }
    }

    // Try finding JSON object/array boundaries
    const objStart = content.indexOf('{');
    const arrStart = content.indexOf('[');
    const start = objStart >= 0 && (arrStart < 0 || objStart < arrStart) ? objStart : arrStart;
    if (start >= 0) {
      const sub = content.slice(start);
      try {
        return JSON.parse(sub) as T;
      } catch {
        // D4: Try balanced-brace extraction — find the matching closing brace
        if (content[start] === '{') {
          let depth = 0;
          let end = -1;
          for (let i = start; i < content.length; i++) {
            if (content[i] === '{') depth++;
            if (content[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end > start) {
            try {
              return JSON.parse(content.slice(start, end + 1)) as T;
            } catch { /* fall through */ }
          }
        }
      }
    }

    throw new ParseError(stage, 'No valid JSON found in response', content.slice(0, 500));
  }
}

/**
 * Extract JSON from a tagged wrapper first, then fall back to generic extraction.
 * Useful for stages where we can demand a strict tagged payload from the model.
 */
export function extractTaggedJson<T>(content: string, stage: string, tagName: string): T {
  const taggedMatch = content.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  if (taggedMatch) {
    const body = taggedMatch[1].trim();
    try {
      return JSON.parse(body) as T;
    } catch (err) {
      throw new ParseError(
        stage,
        `Malformed JSON inside <${tagName}>: ${err instanceof Error ? err.message : String(err)}`,
        body.slice(0, 500),
      );
    }
  }

  return extractJson<T>(content, stage);
}
