import {
  bindLlmProviderProofContext,
  digestLlmProviderContextValue,
  type LlmProviderProofContextBinding,
} from './llm-provider-registry.js';
import { ANTHROPIC_REASONING_MODEL } from './llm-provider-models.js';
import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
  ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
  ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
  ANTHROPIC_RATE_LIMIT_HEADER_NAMES,
  ANTHROPIC_RUNTIME_POLICY_VERSION,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
  DEFAULT_ANTHROPIC_MAX_ATTEMPTS,
  DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_RETRY_INITIAL_DELAY_MS,
  DEFAULT_ANTHROPIC_RETRY_MAX_DELAY_MS,
  DEFAULT_ANTHROPIC_TIMEOUT_MS,
  type AnthropicCallParams,
  type AnthropicCallResult,
  type AnthropicLiveSmokeProof,
  type AnthropicLiveSmokeProofEnvEvaluation,
  type AnthropicLiveSmokeProofState,
  type AnthropicMessageResponse,
  type AnthropicMessageTextBlock,
  type AnthropicMessageToolUseBlock,
  type AnthropicMessagesRequestOptions,
  type AnthropicMessagesTransportResponse,
  type AnthropicRateLimitSignal,
  type AnthropicRuntimePolicy,
  type AnthropicRuntimePolicySummary,
  type AnthropicRuntimePurpose,
  type AnthropicStrictToolCallParams,
  type AnthropicStrictToolCallResult,
} from './anthropic-types.js';
import {
  defaultSleep,
  envTruthy,
  errorHeaders,
  isAbortError,
  isRecord,
  isRetryableAnthropicError,
  normalizeAnthropicRuntimePurpose,
  normalizeIsoTimestamp,
  readAnthropicResponseHeaders,
  readBoundedIntegerEnv,
  stableJson,
  trimmedEnvValue,
} from './anthropic-helpers.js';
import { ApiError, ParseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
  ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
  ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
  ANTHROPIC_RATE_LIMIT_HEADER_NAMES,
  ANTHROPIC_RUNTIME_POLICY_VERSION,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
  DEFAULT_ANTHROPIC_MAX_ATTEMPTS,
  DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_RETRY_INITIAL_DELAY_MS,
  DEFAULT_ANTHROPIC_RETRY_MAX_DELAY_MS,
  DEFAULT_ANTHROPIC_TIMEOUT_MS,
} from './anthropic-types.js';
export type {
  AnthropicCallParams,
  AnthropicCallResult,
  AnthropicLiveSmokeProof,
  AnthropicLiveSmokeProofEnvEvaluation,
  AnthropicLiveSmokeProofState,
  AnthropicMessageContentBlock,
  AnthropicMessageResponse,
  AnthropicMessageTextBlock,
  AnthropicMessageToolUseBlock,
  AnthropicMessagesRequestOptions,
  AnthropicMessagesTransportResponse,
  AnthropicRateLimitSignal,
  AnthropicRuntimePolicy,
  AnthropicRuntimePolicySummary,
  AnthropicRuntimePurpose,
  AnthropicStrictToolCallParams,
  AnthropicStrictToolCallResult,
  AnthropicStrictToolDefinition,
} from './anthropic-types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages' as const;
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export interface AnthropicMessagesClient {
  createMessage(
    requestBody: ReturnType<typeof buildAnthropicMessagesRequestBody> | ReturnType<typeof buildAnthropicStrictToolRequestBody>,
    options: AnthropicMessagesRequestOptions,
  ): Promise<AnthropicMessagesTransportResponse>;
}

export interface RunAnthropicOptions {
  readonly client?: AnthropicMessagesClient;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly nowMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly allowMissingLiveSmokeProof?: boolean;
}

export interface RunAnthropicLiveSmokeProofOptions extends RunAnthropicOptions {
  readonly checkedAt?: string;
}

export const ANTHROPIC_REASONING_MODEL_ID = ANTHROPIC_REASONING_MODEL;

export function isAnthropicProductionLikeRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === 'production'
    || envTruthy(env.ATTESTOR_HA_MODE)
    || env.ATTESTOR_RUNTIME_PROFILE?.trim() === 'production-shared'
    || Boolean(env.ATTESTOR_PUBLIC_HOSTNAME?.trim())
    || Boolean(env.ATTESTOR_PUBLIC_BASE_URL?.trim());
}

export function resolveAnthropicRuntimePolicy(input: {
  readonly purpose: AnthropicRuntimePurpose;
  readonly requestedMaxTokens?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly nowMs?: number;
  readonly allowMissingLiveSmokeProof?: boolean;
}): AnthropicRuntimePolicy {
  const env = input.env ?? process.env;
  const blockers: string[] = [];
  const configuredModel = ANTHROPIC_REASONING_MODEL;
  const configuredMaxOutputTokens = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS',
    defaultValue: DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS,
    min: 1,
    max: 64_000,
    blockerPrefix: 'anthropic-output-token-budget',
    blockers,
  });
  const timeoutMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_ANTHROPIC_TIMEOUT_MS',
    defaultValue: DEFAULT_ANTHROPIC_TIMEOUT_MS,
    min: 1_000,
    max: 600_000,
    blockerPrefix: 'anthropic-timeout-budget',
    blockers,
  });
  const maxAttempts = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_ANTHROPIC_MAX_ATTEMPTS',
    defaultValue: DEFAULT_ANTHROPIC_MAX_ATTEMPTS,
    min: 1,
    max: 4,
    blockerPrefix: 'anthropic-retry-budget',
    blockers,
  });
  const retryInitialDelayMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_ANTHROPIC_RETRY_INITIAL_DELAY_MS',
    defaultValue: DEFAULT_ANTHROPIC_RETRY_INITIAL_DELAY_MS,
    min: 100,
    max: 60_000,
    blockerPrefix: 'anthropic-retry-initial-delay',
    blockers,
  });
  const retryMaxDelayMs = readBoundedIntegerEnv({
    env,
    name: 'ATTESTOR_ANTHROPIC_RETRY_MAX_DELAY_MS',
    defaultValue: DEFAULT_ANTHROPIC_RETRY_MAX_DELAY_MS,
    min: retryInitialDelayMs,
    max: 120_000,
    blockerPrefix: 'anthropic-retry-max-delay',
    blockers,
  });

  const requestedMaxOutputTokens = input.requestedMaxTokens ?? null;
  let maxOutputTokens = configuredMaxOutputTokens;
  if (requestedMaxOutputTokens !== null) {
    if (!Number.isInteger(requestedMaxOutputTokens) || requestedMaxOutputTokens < 1) {
      blockers.push('anthropic-output-token-budget:invalid-requested-max-tokens');
    } else if (requestedMaxOutputTokens > configuredMaxOutputTokens) {
      blockers.push('anthropic-output-token-budget:requested-max-tokens-exceeds-budget');
    } else {
      maxOutputTokens = requestedMaxOutputTokens;
    }
  }

  const productionLikeRuntime = isAnthropicProductionLikeRuntime(env);
  const liveSmokeProof = evaluateAnthropicLiveSmokeProofEnv({
    env,
    purpose: input.purpose,
    configuredModel,
    nowMs: input.nowMs ?? Date.now(),
  });
  if (productionLikeRuntime && input.allowMissingLiveSmokeProof !== true && liveSmokeProof.state !== 'valid') {
    blockers.push(...liveSmokeProof.blockers);
  }

  const digestMaterial = {
    version: ANTHROPIC_RUNTIME_POLICY_VERSION,
    providerId: 'anthropic' as const,
    purpose: input.purpose,
    configuredModel,
    timeoutMs,
    maxAttempts,
    retryInitialDelayMs,
    retryMaxDelayMs,
    maxOutputTokens,
    configuredMaxOutputTokens,
    transportMaxRetries: 0 as const,
    responseStorageDisabled: true as const,
    productionLikeRuntime,
    liveSmokeProofState: liveSmokeProof.state,
    liveSmokeProofDigest: liveSmokeProof.proofDigest,
  };

  return Object.freeze({
    ...digestMaterial,
    requestedMaxOutputTokens,
    productionReady: false,
    liveSmokeProof,
    blockers: Object.freeze(blockers),
    configDigest: digestLlmProviderContextValue(stableJson(digestMaterial)),
  });
}

export function evaluateAnthropicLiveSmokeProofEnv(input: {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly purpose: AnthropicRuntimePurpose;
  readonly configuredModel: string;
  readonly nowMs?: number;
}): AnthropicLiveSmokeProofEnvEvaluation {
  const env = input.env ?? process.env;
  const blockers: string[] = [];
  const proofDigest = trimmedEnvValue(env, ANTHROPIC_LIVE_SMOKE_PROOF_ENV.digest);
  const checkedAt = trimmedEnvValue(env, ANTHROPIC_LIVE_SMOKE_PROOF_ENV.checkedAt);
  const model = trimmedEnvValue(env, ANTHROPIC_LIVE_SMOKE_PROOF_ENV.model);
  const rawPurpose = trimmedEnvValue(env, ANTHROPIC_LIVE_SMOKE_PROOF_ENV.purpose);
  const purpose = normalizeAnthropicRuntimePurpose(rawPurpose);
  const maxAgeMinutes = readBoundedIntegerEnv({
    env,
    name: ANTHROPIC_LIVE_SMOKE_PROOF_ENV.maxAgeMinutes,
    defaultValue: DEFAULT_ANTHROPIC_LIVE_SMOKE_PROOF_MAX_AGE_MINUTES,
    min: 1,
    max: 7 * 24 * 60,
    blockerPrefix: 'anthropic-live-smoke-proof',
    blockers,
  });
  const anyConfigured = Boolean(proofDigest || checkedAt || model || rawPurpose);

  if (!anyConfigured) {
    blockers.push('anthropic-production-runtime-live-smoke-proof-not-wired');
    return Object.freeze({
      version: ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
      state: 'not-configured',
      proofDigest: null,
      checkedAt: null,
      model: null,
      purpose: null,
      maxAgeMinutes,
      rawPromptStored: false,
      rawProviderBodyStored: false,
      blockers: Object.freeze(blockers),
    });
  }

  if (!proofDigest || !SHA256_DIGEST_PATTERN.test(proofDigest)) {
    blockers.push('anthropic-live-smoke-proof:invalid-proof-digest');
  }
  if (!checkedAt) {
    blockers.push('anthropic-live-smoke-proof:checked-at-missing');
  }
  if (!model) {
    blockers.push('anthropic-live-smoke-proof:model-missing');
  } else if (model !== input.configuredModel) {
    blockers.push('anthropic-live-smoke-proof:model-mismatch');
  }
  if (!purpose) {
    blockers.push('anthropic-live-smoke-proof:purpose-missing-or-invalid');
  } else if (purpose !== input.purpose) {
    blockers.push('anthropic-live-smoke-proof:purpose-mismatch');
  }

  let state: AnthropicLiveSmokeProofState = 'invalid';
  if (checkedAt) {
    const checkedAtMs = Date.parse(checkedAt);
    const nowMs = input.nowMs ?? Date.now();
    if (!Number.isFinite(checkedAtMs)) {
      blockers.push('anthropic-live-smoke-proof:checked-at-invalid');
    } else if (checkedAtMs - nowMs > 5 * 60 * 1000) {
      blockers.push('anthropic-live-smoke-proof:checked-at-in-future');
    } else if (nowMs - checkedAtMs > maxAgeMinutes * 60 * 1000) {
      blockers.push('anthropic-live-smoke-proof:stale');
      state = 'stale';
    }
  }

  if (blockers.length === 0) state = 'valid';

  return Object.freeze({
    version: ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
    state,
    proofDigest: proofDigest ?? null,
    checkedAt: checkedAt ?? null,
    model: model ?? null,
    purpose,
    maxAgeMinutes,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    blockers: Object.freeze(blockers),
  });
}

export function summarizeAnthropicRuntimePolicy(policy: AnthropicRuntimePolicy): AnthropicRuntimePolicySummary {
  return Object.freeze({
    version: policy.version,
    providerId: policy.providerId,
    purpose: policy.purpose,
    configuredModel: policy.configuredModel,
    timeoutMs: policy.timeoutMs,
    maxAttempts: policy.maxAttempts,
    maxOutputTokens: policy.maxOutputTokens,
    transportMaxRetries: policy.transportMaxRetries,
    responseStorageDisabled: policy.responseStorageDisabled,
    productionLikeRuntime: policy.productionLikeRuntime,
    productionReady: policy.productionReady,
    liveSmokeProof: policy.liveSmokeProof,
    configDigest: policy.configDigest,
  });
}

export function computeAnthropicRetryDelayMs(
  attemptIndex: number,
  policy: Pick<AnthropicRuntimePolicy, 'retryInitialDelayMs' | 'retryMaxDelayMs'>,
  retryAfterSeconds: string | null | undefined = null,
  jitter: number = Math.random(),
): number {
  const retryAfterMs = retryAfterSeconds ? Number(retryAfterSeconds) * 1000 : NaN;
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(policy.retryMaxDelayMs, Math.floor(retryAfterMs));
  }
  const boundedJitter = Math.max(0, Math.min(1, jitter));
  const exponentialDelay = policy.retryInitialDelayMs * (2 ** Math.max(0, attemptIndex));
  const jitterDelay = Math.floor(exponentialDelay * 0.25 * boundedJitter);
  return Math.min(policy.retryMaxDelayMs, exponentialDelay + jitterDelay);
}

export function buildAnthropicMessagesRequestBody(
  params: AnthropicCallParams,
  runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: params.maxTokens,
  }),
) {
  return {
    model: ANTHROPIC_REASONING_MODEL,
    max_tokens: runtimePolicy.maxOutputTokens,
    system: params.systemPrompt,
    messages: [
      {
        role: 'user' as const,
        content: params.userMessage,
      },
    ],
  };
}

export function buildAnthropicStrictToolRequestBody(
  params: AnthropicStrictToolCallParams,
  runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'structured-output',
    requestedMaxTokens: params.maxTokens,
  }),
) {
  return {
    ...buildAnthropicMessagesRequestBody(params, runtimePolicy),
    tools: [
      {
        ...params.tool,
        strict: true as const,
      },
    ],
    tool_choice: {
      type: 'tool' as const,
      name: params.tool.name,
    },
  };
}

export function buildAnthropicLiveSmokeRequestBody(
  runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
    allowMissingLiveSmokeProof: true,
  }),
) {
  return buildAnthropicMessagesRequestBody({
    stage: 'anthropic-live-smoke-proof',
    systemPrompt: 'Return exactly the requested sentinel string. Do not include markdown or additional text.',
    userMessage: `Return exactly: ${ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT}`,
    maxTokens: DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  }, runtimePolicy);
}

export function collectAnthropicRateLimitSignals(
  headers: Readonly<Record<string, string | null | undefined>>,
): readonly AnthropicRateLimitSignal[] {
  const normalizedHeaders = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.trim()) {
      normalizedHeaders.set(name.toLowerCase(), value.trim());
    }
  }

  return Object.freeze(ANTHROPIC_RATE_LIMIT_HEADER_NAMES.flatMap((name) => {
    const value = normalizedHeaders.get(name);
    return value
      ? [{
          name,
          valueDigest: digestLlmProviderContextValue(value),
        }]
      : [];
  }));
}

export function createAnthropicFetchMessagesClient(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AnthropicMessagesClient {
  return {
    createMessage: async (requestBody, options) => {
      const apiKey = env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        throw new ApiError('api', 'anthropic', 'ANTHROPIC_API_KEY is not set in environment');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new ApiError(
            'api',
            'anthropic',
            `Messages API returned HTTP ${response.status}`,
            response.status,
          );
        }

        const body = await response.json() as AnthropicMessageResponse;
        return Object.freeze({
          body,
          headers: readAnthropicResponseHeaders(response.headers),
          statusCode: response.status,
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isAbortError(error)) {
          throw new ApiError('api', 'anthropic', `Messages API timed out after ${options.timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function runAnthropicLiveSmokeProof(
  options: RunAnthropicLiveSmokeProofOptions = {},
): Promise<AnthropicLiveSmokeProof> {
  const checkedAt = normalizeIsoTimestamp(options.checkedAt);
  const runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
    env: options.env,
    nowMs: Date.parse(checkedAt),
    allowMissingLiveSmokeProof: true,
  });
  assertAnthropicRuntimePolicyAllowsCall('anthropic-live-smoke-proof', runtimePolicy);

  const client = options.client ?? createAnthropicFetchMessagesClient(options.env);
  const response = await client.createMessage(
    buildAnthropicLiveSmokeRequestBody(runtimePolicy),
    { timeoutMs: runtimePolicy.timeoutMs },
  );
  const content = extractAnthropicResponseText(response.body);
  if (content?.trim() !== ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT) {
    throw new ParseError('anthropic-live-smoke-proof', 'Anthropic live smoke response did not match the expected sentinel.');
  }

  const modelObservation = observeAnthropicModel(ANTHROPIC_REASONING_MODEL, response.body);
  const providerProofContext = buildAnthropicProviderProofContext({
    purpose: 'reasoning',
    configuredModel: ANTHROPIC_REASONING_MODEL,
    observedModel: modelObservation.observedModel,
    runtimePolicy,
    promptDigest: digestLlmProviderContextValue(stableJson({
      expectedOutput: ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
      version: ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
    })),
  });
  const rateLimitSignals = collectAnthropicRateLimitSignals(response.headers);
  const rateLimitSignalDigest = digestLlmProviderContextValue(stableJson({ rateLimitSignals }));
  const proofMaterial = {
    version: ANTHROPIC_LIVE_SMOKE_PROOF_VERSION,
    providerId: 'anthropic' as const,
    purpose: 'reasoning' as const,
    configuredModel: ANTHROPIC_REASONING_MODEL,
    observedModel: modelObservation.observedModel,
    modelDriftObserved: modelObservation.modelDriftObserved,
    checkedAt,
    transportMaxRetries: 0 as const,
    timeoutMs: runtimePolicy.timeoutMs,
    maxOutputTokens: runtimePolicy.maxOutputTokens,
    responseAccepted: true,
    responseDigest: digestLlmProviderContextValue(content.trim()),
    rateLimitSignalDigest,
    promptDigest: providerProofContext.promptDigest,
    configDigest: providerProofContext.configDigest,
  };

  return Object.freeze({
    ...proofMaterial,
    providerProofContext,
    proofDigest: digestLlmProviderContextValue(stableJson(proofMaterial)),
    env: ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    productionReady: false,
  });
}

export async function callAnthropicReasoning(
  params: AnthropicCallParams,
  options: RunAnthropicOptions = {},
): Promise<AnthropicCallResult> {
  const runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: params.maxTokens,
    env: options.env,
    nowMs: options.nowMs,
    allowMissingLiveSmokeProof: options.allowMissingLiveSmokeProof,
  });
  assertAnthropicRuntimePolicyAllowsCall(params.stage, runtimePolicy);
  const transport = options.client ?? createAnthropicFetchMessagesClient(options.env);

  logger.info(params.stage, `Calling Anthropic reasoning model ${ANTHROPIC_REASONING_MODEL}...`, {
    timeoutMs: runtimePolicy.timeoutMs,
    maxOutputTokens: runtimePolicy.maxOutputTokens,
    maxAttempts: runtimePolicy.maxAttempts,
  });

  const response = await runAnthropicWithRetry({
    stage: params.stage,
    runtimePolicy,
    client: transport,
    requestBody: buildAnthropicMessagesRequestBody(params, runtimePolicy),
    sleep: options.sleep,
  });
  const content = extractAnthropicResponseText(response.body);
  if (!content) {
    throw new ParseError(params.stage, `Empty response from Anthropic model ${ANTHROPIC_REASONING_MODEL}`);
  }

  const modelObservation = observeAnthropicModel(ANTHROPIC_REASONING_MODEL, response.body);
  logAnthropicModelObservation(params.stage, modelObservation);
  const providerProofContext = buildAnthropicProviderProofContext({
    purpose: 'reasoning',
    configuredModel: ANTHROPIC_REASONING_MODEL,
    observedModel: modelObservation.observedModel,
    runtimePolicy,
    promptDigest: digestLlmProviderContextValue(stableJson({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
    })),
  });
  const usage = response.body.usage;
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cachedInputTokens = usage?.cache_read_input_tokens ?? 0;
  const rateLimitSignals = collectAnthropicRateLimitSignals(response.headers);

  logger.info(params.stage, `Anthropic model ${ANTHROPIC_REASONING_MODEL} response received`, {
    tokens: inputTokens + outputTokens,
    providerConfigDigest: providerProofContext.configDigest,
  });

  return Object.freeze({
    content,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cachedInputTokens,
    observedModel: modelObservation.observedModel,
    modelDriftObserved: modelObservation.modelDriftObserved,
    providerProofContext,
    runtimePolicy: summarizeAnthropicRuntimePolicy(runtimePolicy),
    rateLimitSignals,
    rateLimitSignalDigest: digestLlmProviderContextValue(stableJson({ rateLimitSignals })),
  });
}

export async function callAnthropicStrictTool(
  params: AnthropicStrictToolCallParams,
  options: RunAnthropicOptions = {},
): Promise<AnthropicStrictToolCallResult> {
  const runtimePolicy = resolveAnthropicRuntimePolicy({
    purpose: 'structured-output',
    requestedMaxTokens: params.maxTokens,
    env: options.env,
    nowMs: options.nowMs,
    allowMissingLiveSmokeProof: options.allowMissingLiveSmokeProof,
  });
  assertAnthropicRuntimePolicyAllowsCall(params.stage, runtimePolicy);
  const transport = options.client ?? createAnthropicFetchMessagesClient(options.env);
  const requestBody = buildAnthropicStrictToolRequestBody(params, runtimePolicy);

  const response = await runAnthropicWithRetry({
    stage: params.stage,
    runtimePolicy,
    client: transport,
    requestBody,
    sleep: options.sleep,
  });
  const input = extractAnthropicStrictToolInput(response.body, params.tool.name, params.stage);
  const modelObservation = observeAnthropicModel(ANTHROPIC_REASONING_MODEL, response.body);
  const toolSchemaDigest = digestLlmProviderContextValue(stableJson(params.tool.input_schema));
  const providerProofContext = bindLlmProviderProofContext({
    providerId: 'anthropic',
    configuredModel: ANTHROPIC_REASONING_MODEL,
    observedModel: modelObservation.observedModel,
    purpose: 'structured-output',
    promptDigest: digestLlmProviderContextValue(stableJson({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      toolName: params.tool.name,
    })),
    configDigest: runtimePolicy.configDigest,
    toolSchemaDigest,
    outputSchemaDigest: toolSchemaDigest,
  });
  const rateLimitSignals = collectAnthropicRateLimitSignals(response.headers);

  return Object.freeze({
    toolName: params.tool.name,
    input,
    inputDigest: digestLlmProviderContextValue(stableJson(input)),
    observedModel: modelObservation.observedModel,
    modelDriftObserved: modelObservation.modelDriftObserved,
    providerProofContext,
    runtimePolicy: summarizeAnthropicRuntimePolicy(runtimePolicy),
    rateLimitSignals,
    rateLimitSignalDigest: digestLlmProviderContextValue(stableJson({ rateLimitSignals })),
  });
}

function assertAnthropicRuntimePolicyAllowsCall(stage: string, policy: AnthropicRuntimePolicy): void {
  if (policy.blockers.length === 0) return;
  throw new ApiError(
    stage,
    'anthropic',
    `Anthropic runtime policy blocked call: ${policy.blockers.join(', ')}`,
  );
}

function buildAnthropicProviderProofContext(input: {
  readonly purpose: AnthropicRuntimePurpose;
  readonly configuredModel: string;
  readonly observedModel: string | null;
  readonly runtimePolicy: AnthropicRuntimePolicy;
  readonly promptDigest: string;
}): LlmProviderProofContextBinding {
  return bindLlmProviderProofContext({
    providerId: 'anthropic',
    configuredModel: input.configuredModel,
    observedModel: input.observedModel,
    purpose: input.purpose,
    promptDigest: input.promptDigest,
    configDigest: input.runtimePolicy.configDigest,
  });
}

async function runAnthropicWithRetry(input: {
  readonly stage: string;
  readonly runtimePolicy: AnthropicRuntimePolicy;
  readonly client: AnthropicMessagesClient;
  readonly requestBody: ReturnType<typeof buildAnthropicMessagesRequestBody> | ReturnType<typeof buildAnthropicStrictToolRequestBody>;
  readonly sleep?: (ms: number) => Promise<void>;
}): Promise<AnthropicMessagesTransportResponse> {
  let lastError: unknown;
  let lastHeaders: Readonly<Record<string, string | null | undefined>> = {};

  for (let attempt = 0; attempt < input.runtimePolicy.maxAttempts; attempt++) {
    try {
      return await input.client.createMessage(input.requestBody, { timeoutMs: input.runtimePolicy.timeoutMs });
    } catch (error) {
      lastError = error;
      lastHeaders = errorHeaders(error);

      if (error instanceof ParseError || !isRetryableAnthropicError(error)) throw error;

      const hasRetryBudget = attempt < input.runtimePolicy.maxAttempts - 1;
      if (hasRetryBudget) {
        const retryDelayMs = computeAnthropicRetryDelayMs(
          attempt,
          input.runtimePolicy,
          lastHeaders['retry-after'],
        );
        logger.warn(input.stage, `Anthropic model ${ANTHROPIC_REASONING_MODEL} call failed, retrying in ${retryDelayMs}ms...`, {
          error: error instanceof Error ? error.message : String(error),
        });
        await (input.sleep ?? defaultSleep)(retryDelayMs);
      }
    }
  }

  throw new ApiError(
    input.stage,
    'anthropic',
    `Failed after ${input.runtimePolicy.maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function extractAnthropicResponseText(response: AnthropicMessageResponse): string | undefined {
  const text = response.content
    ?.filter((block): block is AnthropicMessageTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return text?.trim() ? text : undefined;
}

function extractAnthropicStrictToolInput(
  response: AnthropicMessageResponse,
  toolName: string,
  stage: string,
): Readonly<Record<string, unknown>> {
  const toolUse = response.content?.find((block): block is AnthropicMessageToolUseBlock => {
    return block.type === 'tool_use' && block.name === toolName;
  });
  if (!toolUse) {
    throw new ParseError(stage, `Anthropic response did not include expected tool_use block ${toolName}`);
  }
  if (!isRecord(toolUse.input)) {
    throw new ParseError(stage, `Anthropic tool_use input for ${toolName} was not an object`);
  }
  return Object.freeze({ ...toolUse.input });
}

function observeAnthropicModel(configuredModel: string, response: AnthropicMessageResponse): {
  readonly configuredModel: string;
  readonly observedModel: string | null;
  readonly modelDriftObserved: boolean;
} {
  const observedModel = response.model?.trim() || null;
  return {
    configuredModel,
    observedModel,
    modelDriftObserved: Boolean(observedModel && observedModel !== configuredModel),
  };
}

function logAnthropicModelObservation(
  stage: string,
  observation: ReturnType<typeof observeAnthropicModel>,
): void {
  const fields = {
    configuredModel: observation.configuredModel,
    observedModel: observation.observedModel,
    modelDriftObserved: observation.modelDriftObserved,
  };

  if (observation.modelDriftObserved) {
    logger.warn(stage, 'Anthropic response model drift observed', fields);
    return;
  }

  logger.info(stage, 'Anthropic response model observation recorded', fields);
}
