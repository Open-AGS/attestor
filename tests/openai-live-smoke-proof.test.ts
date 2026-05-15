import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS,
  OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT,
  OPENAI_LIVE_SMOKE_PROOF_ENV,
  buildOpenAiLiveSmokeRequestBody,
  evaluateOpenAiLiveSmokeProofEnv,
  resolveOpenAiRuntimePolicy,
  runOpenAiLiveSmokeProof,
  type OpenAiLiveSmokeClient,
} from '../src/api/openai.js';
import { requiredOpenAiLiveSmokeManifest } from '../scripts/probe-openai-live-smoke.ts';

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

function createFakeOpenAiClient(capture: {
  requestBody?: ReturnType<typeof buildOpenAiLiveSmokeRequestBody>;
  requestOptions?: unknown;
  responseText?: string;
  observedModel?: string;
}): OpenAiLiveSmokeClient {
  return {
    responses: {
      create: async (requestBody, requestOptions) => {
        capture.requestBody = requestBody;
        capture.requestOptions = requestOptions;
        return {
          model: capture.observedModel ?? 'o3',
          output: [{
            type: 'message',
            content: [{
              type: 'output_text',
              text: capture.responseText ?? OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT,
            }],
          }],
          usage: {
            input_tokens: 9,
            output_tokens: 3,
          },
        };
      },
    },
  };
}

async function testLiveSmokeProofUsesBoundedSecretSafeRequest(): Promise<string> {
  const capture: {
    requestBody?: ReturnType<typeof buildOpenAiLiveSmokeRequestBody>;
    requestOptions?: { readonly timeout?: number; readonly maxRetries?: number };
  } = {};
  const checkedAt = '2026-05-15T10:00:00.000Z';
  const proof = await runOpenAiLiveSmokeProof({
    client: createFakeOpenAiClient(capture),
    env: {},
    checkedAt,
  });
  const serialized = JSON.stringify(proof);

  equal(proof.version, 'openai-live-smoke-proof.v1', 'OpenAI live smoke: proof version is stable');
  equal(proof.providerId, 'openai', 'OpenAI live smoke: provider id is explicit');
  equal(proof.purpose, 'reasoning', 'OpenAI live smoke: proof is scoped to reasoning calls');
  equal(proof.checkedAt, checkedAt, 'OpenAI live smoke: checkedAt is normalized and retained');
  equal(proof.requestStore, false, 'OpenAI live smoke: request disables provider response storage');
  equal(proof.sdkMaxRetries, 0, 'OpenAI live smoke: SDK hidden retries are disabled');
  equal(proof.maxOutputTokens, DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS, 'OpenAI live smoke: probe has a small output budget');
  equal(proof.responseAccepted, true, 'OpenAI live smoke: expected sentinel was accepted');
  ok(/^sha256:[a-f0-9]{64}$/u.test(proof.proofDigest), 'OpenAI live smoke: proof digest is machine-checkable');
  ok(/^sha256:[a-f0-9]{64}$/u.test(proof.responseDigest), 'OpenAI live smoke: response body is represented by digest');
  equal(proof.rawPromptStored, false, 'OpenAI live smoke: raw prompt is not stored');
  equal(proof.rawProviderBodyStored, false, 'OpenAI live smoke: raw provider body is not stored');
  equal(proof.productionReady, false, 'OpenAI live smoke: probe does not claim production readiness');
  equal(capture.requestBody?.store, false, 'OpenAI live smoke: request body sets store=false');
  equal(capture.requestBody?.max_output_tokens, DEFAULT_OPENAI_LIVE_SMOKE_MAX_OUTPUT_TOKENS, 'OpenAI live smoke: request body uses probe budget');
  equal(capture.requestOptions?.maxRetries, 0, 'OpenAI live smoke: request options disable SDK retry');
  excludes(serialized, /OPENAI_API_KEY|sk_live|sk_test|Bearer\s+/u, 'OpenAI live smoke: proof does not serialize credential material');
  excludes(serialized, /Return exactly:/u, 'OpenAI live smoke: proof does not serialize the raw probe prompt');
  excludes(serialized, new RegExp(OPENAI_LIVE_SMOKE_EXPECTED_OUTPUT, 'u'), 'OpenAI live smoke: proof does not serialize raw model output');

  return proof.proofDigest;
}

function testProductionGateConsumesFreshSmokeProof(proofDigest: string): void {
  const checkedAt = '2026-05-15T10:00:00.000Z';
  const nowMs = Date.parse(checkedAt);
  const blocked = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    env: { NODE_ENV: 'production' },
    nowMs,
  });
  ok(
    blocked.blockers.includes('openai-production-runtime-live-smoke-proof-not-wired'),
    'OpenAI live smoke: production-like runtime blocks without proof env',
  );

  const env = {
    NODE_ENV: 'production',
    [OPENAI_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
    [OPENAI_LIVE_SMOKE_PROOF_ENV.checkedAt]: checkedAt,
    [OPENAI_LIVE_SMOKE_PROOF_ENV.model]: 'o3',
    [OPENAI_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
  };
  const evaluation = evaluateOpenAiLiveSmokeProofEnv({
    env,
    purpose: 'reasoning',
    configuredModel: 'o3',
    nowMs,
  });
  const allowed = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    env,
    nowMs,
  });

  equal(evaluation.state, 'valid', 'OpenAI live smoke: fresh proof env evaluates valid');
  equal(allowed.liveSmokeProof.state, 'valid', 'OpenAI live smoke: runtime policy carries valid proof state');
  equal(
    allowed.blockers.includes('openai-production-runtime-live-smoke-proof-not-wired'),
    false,
    'OpenAI live smoke: valid proof env clears the missing-smoke blocker',
  );
  equal(allowed.productionReady, false, 'OpenAI live smoke: valid proof does not claim production readiness');
}

function testStaleOrWrongSmokeProofFailsClosed(proofDigest: string): void {
  const oldCheckedAt = '2026-05-13T10:00:00.000Z';
  const nowMs = Date.parse('2026-05-15T10:00:00.000Z');
  const stale = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    env: {
      NODE_ENV: 'production',
      [OPENAI_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.checkedAt]: oldCheckedAt,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.model]: 'o3',
      [OPENAI_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
    },
    nowMs,
  });
  ok(stale.blockers.includes('openai-live-smoke-proof:stale'), 'OpenAI live smoke: stale proof blocks production-like runtime');

  const wrongModel = resolveOpenAiRuntimePolicy({
    purpose: 'reasoning',
    env: {
      NODE_ENV: 'production',
      [OPENAI_LIVE_SMOKE_PROOF_ENV.digest]: proofDigest,
      [OPENAI_LIVE_SMOKE_PROOF_ENV.checkedAt]: '2026-05-15T10:00:00.000Z',
      [OPENAI_LIVE_SMOKE_PROOF_ENV.model]: 'gpt-4o',
      [OPENAI_LIVE_SMOKE_PROOF_ENV.purpose]: 'reasoning',
    },
    nowMs,
  });
  ok(wrongModel.blockers.includes('openai-live-smoke-proof:model-mismatch'), 'OpenAI live smoke: model mismatch blocks production-like runtime');
}

function testProbeManifestAndPackageSurface(): void {
  const manifest = requiredOpenAiLiveSmokeManifest();
  equal(manifest.requiredCredentialEnv, 'OPENAI_API_KEY', 'OpenAI live smoke: manifest names credential env only');
  equal(manifest.requestContract.responseStore, false, 'OpenAI live smoke: manifest records response storage posture');
  equal(manifest.runtimeGateEnv.digest, 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_DIGEST', 'OpenAI live smoke: manifest names proof digest env');

  const run = spawnSync(
    process.execPath,
    [
      resolve('node_modules/tsx/dist/cli.mjs'),
      'scripts/probe-openai-live-smoke.ts',
      '--print-required-env',
    ],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
      },
    },
  );
  equal(run.status, 0, 'OpenAI live smoke: required env manifest prints without API key');
  const printed = JSON.parse(run.stdout) as ReturnType<typeof requiredOpenAiLiveSmokeManifest>;
  equal(printed.runtimeGateEnv.model, 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_MODEL', 'OpenAI live smoke: printed manifest includes model gate env');

  const packageJson = readProjectFile('package.json');
  const liveOpsGate = readProjectFile('scripts', 'run-live-ops-gate.mjs');
  includes(packageJson, '"test:openai-live-smoke-proof"', 'OpenAI live smoke: package exposes contract test');
  includes(packageJson, '"probe:openai-live-smoke"', 'OpenAI live smoke: package exposes external live probe');
  includes(liveOpsGate, 'probe:openai-live-smoke', 'OpenAI live smoke: external live gate includes probe');
}

try {
  const proofDigest = await testLiveSmokeProofUsesBoundedSecretSafeRequest();
  testProductionGateConsumesFreshSmokeProof(proofDigest);
  testStaleOrWrongSmokeProofFailsClosed(proofDigest);
  testProbeManifestAndPackageSurface();
  console.log(`OpenAI live smoke proof tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('OpenAI live smoke proof tests failed:', error);
  process.exitCode = 1;
}
