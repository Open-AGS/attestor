import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANTHROPIC_REASONING_MODEL_ID,
  DEFAULT_ANTHROPIC_MAX_ATTEMPTS,
  DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS,
  DEFAULT_ANTHROPIC_TIMEOUT_MS,
  buildAnthropicMessagesRequestBody,
  buildAnthropicStrictToolRequestBody,
  callAnthropicReasoning,
  callAnthropicStrictTool,
  computeAnthropicRetryDelayMs,
  isAnthropicProductionLikeRuntime,
  resolveAnthropicRuntimePolicy,
  type AnthropicMessagesClient,
  type AnthropicMessagesTransportResponse,
} from '../src/api/anthropic.js';
import { ApiError } from '../src/utils/errors.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function fakeResponse(input: {
  readonly text?: string;
  readonly toolInput?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly model?: string;
} = {}): AnthropicMessagesTransportResponse {
  return {
    statusCode: 200,
    headers: input.headers ?? {
      'retry-after': '0',
      'anthropic-ratelimit-requests-remaining': '42',
      'anthropic-ratelimit-input-tokens-remaining': '12000',
      'anthropic-ratelimit-output-tokens-remaining': '4000',
    },
    body: {
      type: 'message',
      role: 'assistant',
      model: input.model ?? ANTHROPIC_REASONING_MODEL_ID,
      content: input.toolInput
        ? [{
            type: 'tool_use',
            id: 'toolu_test',
            name: 'emit_policy_candidate',
            input: input.toolInput,
          }]
        : [{
            type: 'text',
            text: input.text ?? 'safe result',
          }],
      usage: {
        input_tokens: 11,
        output_tokens: 7,
        cache_read_input_tokens: 3,
      },
    },
  };
}

function createFakeClient(input: {
  readonly failFirst?: boolean;
  readonly capture?: {
    requestBodies: unknown[];
    requestOptions: unknown[];
  };
  readonly response?: AnthropicMessagesTransportResponse;
} = {}): AnthropicMessagesClient {
  let calls = 0;
  return {
    createMessage: async (requestBody, requestOptions) => {
      calls += 1;
      input.capture?.requestBodies.push(requestBody);
      input.capture?.requestOptions.push(requestOptions);
      if (input.failFirst === true && calls === 1) {
        throw Object.assign(
          new ApiError('anthropic-runtime-policy-test', 'anthropic', 'rate limited', 429),
          { headers: { 'retry-after': '0' } },
        );
      }
      return input.response ?? fakeResponse();
    },
  };
}

async function testRuntimePolicyAndRequestShape(): Promise<void> {
  const anthropic = readProjectFile('src', 'api', 'anthropic.ts');
  const models = readProjectFile('src', 'api', 'llm-provider-models.ts');

  equal(ANTHROPIC_REASONING_MODEL_ID, 'claude-sonnet-4-6', 'Anthropic runtime: reasoning model is Claude Sonnet 4.6');
  includes(
    models,
    "ANTHROPIC_REASONING_MODEL = 'claude-sonnet-4-6' as const",
    'Anthropic runtime: model constant is centralized',
  );

  const defaultPolicy = resolveAnthropicRuntimePolicy({ purpose: 'reasoning', env: {} });
  equal(defaultPolicy.version, 'anthropic-runtime-policy.v1', 'Anthropic runtime: policy version is stable');
  equal(defaultPolicy.providerId, 'anthropic', 'Anthropic runtime: provider is explicit');
  equal(defaultPolicy.configuredModel, 'claude-sonnet-4-6', 'Anthropic runtime: configured model is explicit');
  equal(defaultPolicy.timeoutMs, DEFAULT_ANTHROPIC_TIMEOUT_MS, 'Anthropic runtime: default timeout is explicit');
  equal(defaultPolicy.maxAttempts, DEFAULT_ANTHROPIC_MAX_ATTEMPTS, 'Anthropic runtime: default max attempts is explicit');
  equal(
    defaultPolicy.maxOutputTokens,
    DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS,
    'Anthropic runtime: default reasoning token budget is explicit',
  );
  equal(defaultPolicy.transportMaxRetries, 0, 'Anthropic runtime: transport hidden retries are disabled');
  equal(defaultPolicy.responseStorageDisabled, true, 'Anthropic runtime: response storage is disabled');
  equal(defaultPolicy.productionReady, false, 'Anthropic runtime: production readiness is not claimed');
  equal(defaultPolicy.liveSmokeProof.state, 'not-configured', 'Anthropic runtime: live smoke proof state is explicit');
  ok(/^sha256:[a-f0-9]{64}$/u.test(defaultPolicy.configDigest), 'Anthropic runtime: config digest is machine-checkable');

  const narrowedBudget = resolveAnthropicRuntimePolicy({ purpose: 'reasoning', requestedMaxTokens: 600, env: {} });
  const body = buildAnthropicMessagesRequestBody({
    stage: 'test',
    systemPrompt: 'system',
    userMessage: 'user',
    maxTokens: 600,
  }, narrowedBudget);
  equal(body.model, 'claude-sonnet-4-6', 'Anthropic request: model is the configured Claude model');
  equal(body.max_tokens, 600, 'Anthropic request: max_tokens uses policy budget');
  equal(body.system, 'system', 'Anthropic request: system prompt uses top-level system parameter');
  equal(body.messages[0]?.role, 'user', 'Anthropic request: user content is a Messages API user message');

  const toolBody = buildAnthropicStrictToolRequestBody({
    stage: 'tool-test',
    systemPrompt: 'system',
    userMessage: 'emit json',
    tool: {
      name: 'emit_policy_candidate',
      description: 'Emit a candidate object.',
      input_schema: {
        type: 'object',
        properties: { decision: { type: 'string' } },
        required: ['decision'],
        additionalProperties: false,
      },
    },
  });
  equal(toolBody.tools[0]?.strict, true, 'Anthropic strict tool: strict mode is enabled');
  equal(toolBody.tool_choice.name, 'emit_policy_candidate', 'Anthropic strict tool: tool choice pins the expected tool');

  const invalidBudget = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: DEFAULT_ANTHROPIC_REASONING_MAX_OUTPUT_TOKENS + 1,
    env: {},
  });
  ok(
    invalidBudget.blockers.includes('anthropic-output-token-budget:requested-max-tokens-exceeds-budget'),
    'Anthropic runtime: oversized output request fails closed',
  );

  const invalidEnv = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    env: { ATTESTOR_ANTHROPIC_TIMEOUT_MS: '0', ATTESTOR_ANTHROPIC_MAX_ATTEMPTS: '99' },
  });
  ok(
    invalidEnv.blockers.includes('anthropic-timeout-budget:invalid-attestor_anthropic_timeout_ms'),
    'Anthropic runtime: invalid timeout env is a blocker',
  );
  ok(
    invalidEnv.blockers.includes('anthropic-retry-budget:invalid-attestor_anthropic_max_attempts'),
    'Anthropic runtime: invalid retry env is a blocker',
  );

  equal(isAnthropicProductionLikeRuntime({ NODE_ENV: 'production' }), true, 'Anthropic runtime: NODE_ENV production is production-like');
  equal(isAnthropicProductionLikeRuntime({}), false, 'Anthropic runtime: empty env is not production-like');
  const productionLike = resolveAnthropicRuntimePolicy({ purpose: 'reasoning', env: { NODE_ENV: 'production' } });
  ok(
    productionLike.blockers.includes('anthropic-production-runtime-live-smoke-proof-not-wired'),
    'Anthropic runtime: production-like runtime blocks live-model call without smoke proof wiring',
  );

  equal(
    computeAnthropicRetryDelayMs(0, defaultPolicy, null, 0),
    defaultPolicy.retryInitialDelayMs,
    'Anthropic retry: first retry starts at initial delay',
  );
  equal(
    computeAnthropicRetryDelayMs(0, defaultPolicy, '2', 1),
    2000,
    'Anthropic retry: retry-after header is honored within max delay',
  );
  equal(
    computeAnthropicRetryDelayMs(20, defaultPolicy, null, 1),
    defaultPolicy.retryMaxDelayMs,
    'Anthropic retry: retry delay is capped',
  );

  includes(anthropic, 'fetch(ANTHROPIC_MESSAGES_URL', 'Anthropic runtime: wrapper uses a direct Messages API fetch boundary');
  includes(anthropic, "'anthropic-version': ANTHROPIC_API_VERSION", 'Anthropic runtime: API version header is explicit');
  includes(anthropic, 'runAnthropicLiveSmokeProof', 'Anthropic runtime: live smoke proof can be generated explicitly');
  includes(anthropic, 'rawProviderBodyStored: false', 'Anthropic runtime: provider body storage non-claim is explicit');
}

async function testFakeClientRuntimeConformance(): Promise<void> {
  const capture = { requestBodies: [] as unknown[], requestOptions: [] as unknown[] };
  const slept: number[] = [];
  const result = await callAnthropicReasoning({
    stage: 'anthropic-runtime-policy-test',
    systemPrompt: 'system',
    userMessage: 'user',
    maxTokens: 512,
  }, {
    client: createFakeClient({ failFirst: true, capture }),
    env: {},
    sleep: async (ms) => { slept.push(ms); },
  });
  const serialized = JSON.stringify(result);

  equal(capture.requestBodies.length, 2, 'Anthropic runtime: 429 fake client path retries once');
  equal(slept[0], 0, 'Anthropic runtime: retry-after from fake provider controls retry delay');
  equal(result.content, 'safe result', 'Anthropic runtime: text content is extracted');
  equal(result.inputTokens, 11, 'Anthropic runtime: input tokens are read from usage');
  equal(result.outputTokens, 7, 'Anthropic runtime: output tokens are read from usage');
  equal(result.cachedInputTokens, 3, 'Anthropic runtime: cache-read input tokens are exposed separately');
  equal(result.observedModel, 'claude-sonnet-4-6', 'Anthropic runtime: observed model is captured');
  equal(result.modelDriftObserved, false, 'Anthropic runtime: matching observed model has no drift');
  ok(result.rateLimitSignals.length >= 4, 'Anthropic runtime: rate-limit signals are mapped');
  ok(/^sha256:[a-f0-9]{64}$/u.test(result.rateLimitSignalDigest), 'Anthropic runtime: rate-limit signal digest is machine-checkable');
  equal(result.providerProofContext.providerId, 'anthropic', 'Anthropic runtime: proof context binds provider id');
  equal(result.providerProofContext.rawPromptStored, false, 'Anthropic runtime: proof context does not store raw prompt');
  excludes(serialized, /"systemPrompt"|"userMessage"|ANTHROPIC_API_KEY|sk_live|Bearer\s+/u, 'Anthropic runtime: result does not serialize raw prompt or credentials');

  const tool = await callAnthropicStrictTool({
    stage: 'anthropic-strict-tool-test',
    systemPrompt: 'system',
    userMessage: 'emit json',
    tool: {
      name: 'emit_policy_candidate',
      description: 'Emit a candidate object.',
      input_schema: {
        type: 'object',
        properties: { decision: { type: 'string' } },
        required: ['decision'],
        additionalProperties: false,
      },
    },
  }, {
    client: createFakeClient({
      response: fakeResponse({ toolInput: { decision: 'review' } }),
    }),
    env: {},
  });
  equal(tool.toolName, 'emit_policy_candidate', 'Anthropic strict tool: expected tool is returned');
  equal(tool.input.decision, 'review', 'Anthropic strict tool: input object is extracted');
  equal(tool.providerProofContext.outputSchemaDigest, tool.providerProofContext.toolSchemaDigest, 'Anthropic strict tool: schema digest binds output and tool schema');
  equal(tool.providerProofContext.rawProviderBodyStored, false, 'Anthropic strict tool: proof context does not store provider body');
}

try {
  await testRuntimePolicyAndRequestShape();
  await testFakeClientRuntimeConformance();
  console.log(`Anthropic runtime policy tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Anthropic runtime policy tests failed:', error);
  process.exitCode = 1;
}
