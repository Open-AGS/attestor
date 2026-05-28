import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
  ANTHROPIC_LIVE_SMOKE_PROOF_ENV,
  ANTHROPIC_REASONING_MODEL_ID,
  DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  buildAnthropicLiveSmokeRequestBody,
  evaluateAnthropicLiveSmokeProofEnv,
  resolveAnthropicRuntimePolicy,
  runAnthropicLiveSmokeProof,
  type AnthropicMessagesClient,
} from '../src/api/anthropic.js';
import { requiredAnthropicLiveSmokeManifest } from '../scripts/probe/probe-anthropic-live-smoke.ts';

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

function createFakeAnthropicClient(capture: {
  requestBody?: ReturnType<typeof buildAnthropicLiveSmokeRequestBody>;
  requestOptions?: unknown;
  responseText?: string;
  observedModel?: string;
}): AnthropicMessagesClient {
  return {
    createMessage: async (requestBody, requestOptions) => {
      capture.requestBody = requestBody as ReturnType<typeof buildAnthropicLiveSmokeRequestBody>;
      capture.requestOptions = requestOptions;
      return {
        statusCode: 200,
        headers: {
          'retry-after': '0',
          'anthropic-ratelimit-requests-remaining': '42',
          'anthropic-ratelimit-input-tokens-remaining': '12000',
          'anthropic-ratelimit-output-tokens-remaining': '4000',
        },
        body: {
          type: 'message',
          role: 'assistant',
          model: capture.observedModel ?? ANTHROPIC_REASONING_MODEL_ID,
          content: [{
            type: 'text',
            text: capture.responseText ?? ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT,
          }],
          usage: {
            input_tokens: 9,
            output_tokens: 3,
          },
        },
      };
    },
  };
}

async function testLiveSmokeProofUsesBoundedSecretSafeRequest(): Promise<string> {
  const capture: {
    requestBody?: ReturnType<typeof buildAnthropicLiveSmokeRequestBody>;
    requestOptions?: { readonly timeoutMs?: number };
  } = {};
  const checkedAt = '2026-05-15T10:00:00.000Z';
  const proof = await runAnthropicLiveSmokeProof({
    client: createFakeAnthropicClient(capture),
    env: {},
    checkedAt,
  });
  const serialized = JSON.stringify(proof);

  equal(proof.version, 'anthropic-live-smoke-proof.v1', 'Anthropic live smoke: proof version is stable');
  equal(proof.providerId, 'anthropic', 'Anthropic live smoke: provider id is explicit');
  equal(proof.purpose, 'reasoning', 'Anthropic live smoke: proof is scoped to reasoning calls');
  equal(proof.checkedAt, checkedAt, 'Anthropic live smoke: checkedAt is normalized and retained');
  equal(proof.transportMaxRetries, 0, 'Anthropic live smoke: transport hidden retries are disabled');
  equal(proof.maxOutputTokens, DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS, 'Anthropic live smoke: probe has a small output budget');
  equal(proof.responseAccepted, true, 'Anthropic live smoke: expected sentinel was accepted');
  ok(/^sha256:[a-f0-9]{64}$/u.test(proof.proofDigest), 'Anthropic live smoke: proof digest is machine-checkable');
  ok(/^sha256:[a-f0-9]{64}$/u.test(proof.responseDigest), 'Anthropic live smoke: response body is represented by digest');
  ok(/^sha256:[a-f0-9]{64}$/u.test(proof.rateLimitSignalDigest), 'Anthropic live smoke: rate-limit signal digest is machine-checkable');
  equal(proof.rawPromptStored, false, 'Anthropic live smoke: raw prompt is not stored');
  equal(proof.rawProviderBodyStored, false, 'Anthropic live smoke: raw provider body is not stored');
  equal(proof.productionReady, false, 'Anthropic live smoke: probe does not claim production readiness');
  equal(capture.requestBody?.model, ANTHROPIC_REASONING_MODEL_ID, 'Anthropic live smoke: request uses the configured Claude model');
  equal(capture.requestBody?.max_tokens, DEFAULT_ANTHROPIC_LIVE_SMOKE_MAX_OUTPUT_TOKENS, 'Anthropic live smoke: request body uses probe budget');
  equal(capture.requestOptions?.timeoutMs, 120000, 'Anthropic live smoke: request options carry the wrapper timeout');
  excludes(serialized, /ANTHROPIC_API_KEY|sk_live|sk_test|Bearer\s+/u, 'Anthropic live smoke: proof does not serialize credential material');
  excludes(serialized, /Return exactly:/u, 'Anthropic live smoke: proof does not serialize the raw probe prompt');
  excludes(serialized, new RegExp(ANTHROPIC_LIVE_SMOKE_EXPECTED_OUTPUT, 'u'), 'Anthropic live smoke: proof does not serialize raw model output');

  return proof.proofDigest;
}

function testProductionGateConsumesFreshSmokeProof(proofDigest: string): void {
  const checkedAt = '2026-05-15T10:00:00.000Z';
  const nowMs = Date.parse(checkedAt);
  const blocked = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    env: { NODE_ENV: 'production' },
    nowMs,
  });
  ok(
    blocked.blockers.includes('anthropic-production-runtime-live-smoke-proof-not-wired'),
    'Anthropic live smoke: production-like runtime blocks without proof env',
  );

  const env = {
    NODE_ENV: 'production',
    [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
    [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.checkedAt]: checkedAt,
    [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.model]: ANTHROPIC_REASONING_MODEL_ID,
    [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
  };
  const evaluation = evaluateAnthropicLiveSmokeProofEnv({
    env,
    purpose: 'reasoning',
    configuredModel: ANTHROPIC_REASONING_MODEL_ID,
    nowMs,
  });
  const allowed = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    env,
    nowMs,
  });

  equal(evaluation.state, 'valid', 'Anthropic live smoke: fresh proof env evaluates valid');
  equal(allowed.liveSmokeProof.state, 'valid', 'Anthropic live smoke: runtime policy carries valid proof state');
  equal(
    allowed.blockers.includes('anthropic-production-runtime-live-smoke-proof-not-wired'),
    false,
    'Anthropic live smoke: valid proof env clears the missing-smoke blocker',
  );
  equal(allowed.productionReady, false, 'Anthropic live smoke: valid proof does not claim production readiness');
}

function testStaleOrWrongSmokeProofFailsClosed(proofDigest: string): void {
  const oldCheckedAt = '2026-05-13T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-15T10:00:00.000Z');
  const stale = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    env: {
      NODE_ENV: 'production',
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.checkedAt]: oldCheckedAt,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.model]: ANTHROPIC_REASONING_MODEL_ID,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
    },
    nowMs,
  });
  ok(stale.blockers.includes('anthropic-live-smoke-proof:stale'), 'Anthropic live smoke: stale proof blocks production-like runtime');

  const wrongModel = resolveAnthropicRuntimePolicy({
    purpose: 'reasoning',
    env: {
      NODE_ENV: 'production',
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.checkedAt]: '2026-05-15T10:00:00.000Z',
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.model]: 'claude-opus-4-7',
      [ANTHROPIC_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
    },
    nowMs,
  });
  ok(wrongModel.blockers.includes('anthropic-live-smoke-proof:model-mismatch'), 'Anthropic live smoke: model mismatch blocks production-like runtime');
}

function testProbeManifestAndPackageSurface(): void {
  const manifest = requiredAnthropicLiveSmokeManifest();
  equal(manifest.requiredCredentialEnv, 'ANTHROPIC_API_KEY', 'Anthropic live smoke: manifest names credential env only');
  equal(manifest.requestContract.transportMaxRetries, 0, 'Anthropic live smoke: manifest records transport retry posture');
  equal(manifest.runtimeGateEnv.digest, 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_DIGEST', 'Anthropic live smoke: manifest names proof digest env');

  const run = spawnSync(
    process.execPath,
    [
      resolve('node_modules/tsx/dist/cli.mjs'),
      'scripts/probe/probe-anthropic-live-smoke.ts',
      '--print-required-env',
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: '',
      },
    },
  );
  equal(run.status, 0, 'Anthropic live smoke: required env manifest prints without API key');
  const printed = JSON.parse(run.stdout) as ReturnType<typeof requiredAnthropicLiveSmokeManifest>;
  equal(printed.runtimeGateEnv.model, 'ATTESTOR_ANTHROPIC_LIVE_SMOKE_PROOF_MODEL', 'Anthropic live smoke: printed manifest includes model gate env');

  const packageJson = readProjectFile('package.json');
  const liveOpsGate = readProjectFile('scripts', 'run', 'run-live-ops-gate.mjs');
  includes(packageJson, '"test:anthropic-live-smoke-proof"', 'Anthropic live smoke: package exposes contract test');
  includes(packageJson, '"probe:anthropic-live-smoke"', 'Anthropic live smoke: package exposes external live probe');
  includes(liveOpsGate, 'probe:anthropic-live-smoke', 'Anthropic live smoke: external live gate includes probe');
}

try {
  const proofDigest = await testLiveSmokeProofUsesBoundedSecretSafeRequest();
  testProductionGateConsumesFreshSmokeProof(proofDigest);
  testStaleOrWrongSmokeProofFailsClosed(proofDigest);
  testProbeManifestAndPackageSurface();
  console.log(`Anthropic live smoke proof tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Anthropic live smoke proof tests failed:', error);
  process.exitCode = 1;
}
