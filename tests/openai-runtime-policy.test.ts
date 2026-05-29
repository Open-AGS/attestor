import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_OPENAI_MAX_ATTEMPTS,
  DEFAULT_OPENAI_REASONING_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_TIMEOUT_MS,
  DEFAULT_OPENAI_VISION_MAX_OUTPUT_TOKENS,
  GPT_MODEL,
  GPT_VISION_MODEL,
  buildGptRequestBody,
  computeOpenAiRetryDelayMs,
  isOpenAiProductionLikeRuntime,
  resolveOpenAiRuntimePolicy,
} from '../src/api/openai.js';

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

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const openai = readProjectFile('src', 'api', 'openai.ts');
  const models = readProjectFile('src', 'api', 'llm-provider-models.ts');
  const financialCli = [
    readProjectFile('src', 'financial', 'cli.ts'),
    readProjectFile('src', 'financial', 'cli', 'live-scenario.ts'),
  ].join('\n');
  const financialTypes = readProjectFile('src', 'financial', 'types.ts');

  equal(GPT_MODEL, 'o3', 'OpenAI runtime policy: reasoning model remains o3');
  equal(GPT_VISION_MODEL, 'gpt-4o', 'OpenAI runtime policy: vision model remains gpt-4o');
  includes(models, "OPENAI_REASONING_MODEL = 'o3' as const", 'OpenAI runtime policy: model constant is centralized');
  includes(models, "OPENAI_VISION_MODEL = 'gpt-4o' as const", 'OpenAI runtime policy: vision constant is centralized');

  const defaultPolicy = resolveOpenAiRuntimePolicy({ purpose: 'reasoning', env: {} });
  equal(defaultPolicy.version, 'openai-runtime-policy.v1', 'OpenAI runtime policy: version is stable');
  equal(defaultPolicy.providerId, 'openai', 'OpenAI runtime policy: provider is explicit');
  equal(defaultPolicy.configuredModel, 'o3', 'OpenAI runtime policy: configured model is explicit');
  equal(defaultPolicy.timeoutMs, DEFAULT_OPENAI_TIMEOUT_MS, 'OpenAI runtime policy: default timeout is explicit');
  equal(defaultPolicy.maxAttempts, DEFAULT_OPENAI_MAX_ATTEMPTS, 'OpenAI runtime policy: default max attempts is explicit');
  equal(
    defaultPolicy.maxOutputTokens,
    DEFAULT_OPENAI_REASONING_MAX_OUTPUT_TOKENS,
    'OpenAI runtime policy: default reasoning token budget is explicit',
  );
  equal(defaultPolicy.sdkMaxRetries, 0, 'OpenAI runtime policy: SDK hidden retries are disabled');
  equal(defaultPolicy.responseStore, false, 'OpenAI runtime policy: provider response storage is disabled');
  equal(defaultPolicy.productionReady, false, 'OpenAI runtime policy: production readiness is not claimed');
  equal(defaultPolicy.liveSmokeProof.state, 'not-configured', 'OpenAI runtime policy: live smoke proof state is explicit');
  ok(/^sha256:[a-f0-9]{64}$/u.test(defaultPolicy.configDigest), 'OpenAI runtime policy: config digest is machine-checkable');

  const requestBudget = resolveOpenAiRuntimePolicy({ purpose: 'reasoning', requestedMaxTokens: 600, env: {} });
  equal(requestBudget.maxOutputTokens, 600, 'OpenAI runtime policy: requested token budget can narrow the cap');
  const body = buildGptRequestBody({
    stage: 'test',
    systemPrompt: 'system',
    userMessage: 'user',
    effort: 'low',
    maxTokens: 600,
  }, requestBudget);
  equal(body.max_output_tokens, 600, 'OpenAI request body: max_output_tokens uses policy budget');
  equal(body.store, false, 'OpenAI request body: Responses API storage is disabled');

  const visionPolicy = resolveOpenAiRuntimePolicy({ purpose: 'vision', env: {} });
  equal(
    visionPolicy.maxOutputTokens,
    DEFAULT_OPENAI_VISION_MAX_OUTPUT_TOKENS,
    'OpenAI runtime policy: default vision token budget is explicit',
  );
  equal(visionPolicy.configuredModel, 'gpt-4o', 'OpenAI runtime policy: vision model is explicit');

  const invalidBudget = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    requestedMaxTokens: DEFAULT_OPENAI_REASONING_MAX_OUTPUT_TOKENS + 1,
    env: {},
  });
  ok(
    invalidBudget.blockers.includes('openai-output-token-budget:requested-max-tokens-exceeds-budget'),
    'OpenAI runtime policy: oversized output request fails closed',
  );

  const invalidEnv = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    env: { ATTESTOR_OPENAI_TIMEOUT_MS: '0', ATTESTOR_OPENAI_MAX_ATTEMPTS: '99' },
  });
  ok(
    invalidEnv.blockers.includes('openai-timeout-budget:invalid-attestor_openai_timeout_ms'),
    'OpenAI runtime policy: invalid timeout env is a blocker',
  );
  ok(
    invalidEnv.blockers.includes('openai-retry-budget:invalid-attestor_openai_max_attempts'),
    'OpenAI runtime policy: invalid retry env is a blocker',
  );

  equal(isOpenAiProductionLikeRuntime({ NODE_ENV: 'production' }), true, 'OpenAI runtime policy: NODE_ENV production is production-like');
  equal(
    isOpenAiProductionLikeRuntime({ ATTESTOR_RUNTIME_PROFILE: 'production-shared' }),
    true,
    'OpenAI runtime policy: production-shared profile is production-like',
  );
  equal(isOpenAiProductionLikeRuntime({}), false, 'OpenAI runtime policy: empty env is not production-like');

  const productionLike = resolveOpenAiRuntimePolicy({ purpose: 'reasoning', env: { NODE_ENV: 'production' } });
  ok(
    productionLike.blockers.includes('openai-production-runtime-live-smoke-proof-not-wired'),
    'OpenAI runtime policy: production-like runtime blocks live-model call without smoke proof wiring',
  );

  equal(
    computeOpenAiRetryDelayMs(0, defaultPolicy, 0),
    defaultPolicy.retryInitialDelayMs,
    'OpenAI retry policy: first retry starts at initial delay',
  );
  equal(
    computeOpenAiRetryDelayMs(0, defaultPolicy, 1),
    Math.floor(defaultPolicy.retryInitialDelayMs * 1.25),
    'OpenAI retry policy: jitter is bounded',
  );
  equal(
    computeOpenAiRetryDelayMs(20, defaultPolicy, 1),
    defaultPolicy.retryMaxDelayMs,
    'OpenAI retry policy: retry delay is capped',
  );

  includes(openai, 'new OpenAI({ apiKey, maxRetries: 0 })', 'OpenAI runtime policy: SDK hidden retries are disabled in the client');
  includes(openai, 'responses.create(requestBody, openAiRequestOptions(runtimePolicy))', 'OpenAI runtime policy: Responses calls receive request options');
  includes(openai, 'runOpenAiLiveSmokeProof', 'OpenAI runtime policy: live smoke proof can be generated explicitly');
  includes(openai, 'chat.completions.create({', 'OpenAI runtime policy: vision call remains Chat Completions based');
  includes(openai, 'store: false', 'OpenAI runtime policy: provider-side response storage is disabled');
  includes(openai, 'providerProofContext', 'OpenAI runtime policy: call result carries provider proof context');
  includes(financialTypes, 'providerProofContext: LlmProviderProofContextBinding | null', 'OpenAI runtime policy: live proof type carries provider proof context');
  includes(financialCli, 'providerProofContext: result.providerProofContext', 'OpenAI runtime policy: financial live proof binds provider proof context');

  console.log(`OpenAI runtime policy tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('OpenAI runtime policy tests failed:', error);
  process.exitCode = 1;
}
