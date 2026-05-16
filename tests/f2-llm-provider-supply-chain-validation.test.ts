import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
  consequenceAgenticSupplyChainGuardDescriptor,
} from '../src/consequence-admission/index.js';
import {
  evaluateLlmProviderRegistry,
  evaluateLlmProviderRoute,
  evaluateLlmProviderRoutingReadiness,
  llmProviderRegistryDescriptor,
} from '../src/api/llm-provider-registry.js';

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

function projectFiles(root: string): readonly string[] {
  const absRoot = join(process.cwd(), root);
  const output: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
        walk(abs);
      } else if (/\.(ts|tsx|js|mjs|md|json)$/u.test(entry)) {
        output.push(abs);
      }
    }
  }
  walk(absRoot);
  return Object.freeze(output);
}

function countOccurrencesOutsideOpenAi(pattern: RegExp): number {
  let count = 0;
  for (const file of projectFiles('src')) {
    if (file.endsWith(join('src', 'api', 'openai.ts'))) continue;
    const text = readFileSync(file, 'utf8');
    count += [...text.matchAll(pattern)].length;
  }
  return count;
}

try {
  const doc = readProjectFile('docs', 'audit', 'f2-llm-provider-supply-chain-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const openai = readProjectFile('src', 'api', 'openai.ts');
  const openaiSmoke = readProjectFile('scripts', 'probe-openai-live-smoke.ts');
  const anthropic = readProjectFile('src', 'api', 'anthropic.ts');
  const anthropicSmoke = readProjectFile('scripts', 'probe-anthropic-live-smoke.ts');
  const models = readProjectFile('src', 'api', 'llm-provider-models.ts');
  const financialCli = readProjectFile('src', 'financial', 'cli.ts');
  const financialTypes = readProjectFile('src', 'financial', 'types.ts');
  const evaluationPacket = readProjectFile('docs', '00-evaluation', 'v0.1-evaluation-packet.md');
  const registryDoc = readProjectFile('docs', '02-architecture', 'llm-provider-registry.md');
  const descriptor = consequenceAgenticSupplyChainGuardDescriptor();
  const registry = llmProviderRegistryDescriptor();
  const registryEvaluation = evaluateLlmProviderRegistry({ requireProductionRuntime: true, requireFailover: true });
  const failoverRoute = evaluateLlmProviderRoute({ purpose: 'reasoning', requireFailover: true });
  const routeReadiness = evaluateLlmProviderRoutingReadiness({
    request: {
      purpose: 'structured-output',
      requireProductionRuntime: true,
      requireStructuredOutput: true,
    },
  });

  ok(
    CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS.includes('model-provider-sdk'),
    'LLM provider supply-chain validation: model provider SDK is a supply-chain component kind',
  );
  equal(descriptor.requiresPinnedSource, true, 'LLM provider supply-chain validation: pinned source is required');
  equal(descriptor.requiresVerifiedProvenance, true, 'LLM provider supply-chain validation: verified provenance is required');
  equal(descriptor.productionReady, false, 'LLM provider supply-chain validation: guard does not claim production readiness');
  equal(descriptor.activatesEnforcement, false, 'LLM provider supply-chain validation: guard does not activate enforcement');

  includes(models, "OPENAI_REASONING_MODEL = 'o3' as const", 'LLM provider supply-chain validation: OpenAI reasoning model is single configured model');
  includes(models, "OPENAI_VISION_MODEL = 'gpt-4o' as const", 'LLM provider supply-chain validation: OpenAI vision model is present');
  includes(models, "ANTHROPIC_REASONING_MODEL = 'claude-sonnet-4-6' as const", 'LLM provider supply-chain validation: Anthropic reasoning model is configured');
  includes(openai, 'new OpenAI({ apiKey, maxRetries: 0 })', 'LLM provider supply-chain validation: OpenAI SDK client is used directly without hidden retries');
  includes(openai, 'resolveOpenAiRuntimePolicy', 'LLM provider supply-chain validation: OpenAI wrapper has runtime policy');
  includes(openai, 'runOpenAiLiveSmokeProof', 'LLM provider supply-chain validation: OpenAI wrapper has explicit live smoke proof');
  includes(openai, 'store: false', 'LLM provider supply-chain validation: provider-side response storage is disabled');
  includes(openai, 'providerProofContext', 'LLM provider supply-chain validation: live model result carries provider proof context');
  includes(openai, 'ATTESTOR_OPENAI_LIVE_SMOKE_PROOF_DIGEST', 'LLM provider supply-chain validation: OpenAI runtime policy names the smoke proof digest env');
  includes(openaiSmoke, 'stringifySecretSafe', 'LLM provider supply-chain validation: OpenAI smoke proof output is secret-safe');
  includes(openaiSmoke, 'runtimeGateValues', 'LLM provider supply-chain validation: OpenAI smoke proof emits runtime gate values');
  excludes(openai, /Anthropic|LlmProviderRegistry|providerRegistry/u, 'LLM provider supply-chain validation: OpenAI wrapper has no provider registry');
  includes(anthropic, 'fetch(ANTHROPIC_MESSAGES_URL', 'LLM provider supply-chain validation: Anthropic wrapper uses direct Messages API fetch boundary');
  includes(anthropic, "'anthropic-version': ANTHROPIC_API_VERSION", 'LLM provider supply-chain validation: Anthropic API version header is explicit');
  includes(anthropic, 'resolveAnthropicRuntimePolicy', 'LLM provider supply-chain validation: Anthropic wrapper has runtime policy');
  includes(anthropic, 'runAnthropicLiveSmokeProof', 'LLM provider supply-chain validation: Anthropic wrapper has explicit live smoke proof');
  includes(anthropic, 'rawProviderBodyStored: false', 'LLM provider supply-chain validation: Anthropic wrapper keeps provider-body storage false');
  includes(anthropicSmoke, 'stringifySecretSafe', 'LLM provider supply-chain validation: Anthropic smoke proof output is secret-safe');
  includes(anthropicSmoke, 'runtimeGateValues', 'LLM provider supply-chain validation: Anthropic smoke proof emits runtime gate values');
  includes(
    registry.providers.map((provider) => provider.id).join(','),
    'openai,anthropic,vertex-ai,azure-openai',
    'LLM provider supply-chain validation: registry records expected provider inventory',
  );
  equal(registry.providers.filter((provider) => provider.wireStatus === 'wired').length, 2, 'LLM provider supply-chain validation: two providers are wired repository-side');
  equal(registry.providers.find((provider) => provider.id === 'openai')?.wireStatus, 'wired', 'LLM provider supply-chain validation: OpenAI is wired');
  equal(registry.providers.find((provider) => provider.id === 'anthropic')?.wireStatus, 'wired', 'LLM provider supply-chain validation: Anthropic is wired');
  equal(registry.runtimePolicy.storesRawPrompt, false, 'LLM provider supply-chain validation: registry does not store raw prompts');
  equal(
    registry.runtimePolicy.failoverCompatibility,
    'same-purpose-model-capability-rate-limit-required',
    'LLM provider supply-chain validation: registry requires compatible failover providers',
  );
  equal(registry.proofContextContract.requiresPromptDigest, true, 'LLM provider supply-chain validation: proof context requires prompt digest');
  equal(registryEvaluation.productionReady, false, 'LLM provider supply-chain validation: registry does not claim production readiness');
  includes(
    registryEvaluation.blockers.join(','),
    'llm-provider-live-smoke-proof-required',
    'LLM provider supply-chain validation: production/failover readiness blocks without smoke proof evidence',
  );
  equal(failoverRoute.status, 'selected', 'LLM provider supply-chain validation: repository failover route can be selected');
  equal(failoverRoute.failoverCompatibilityReady, true, 'LLM provider supply-chain validation: repository failover compatibility is ready');
  equal(routeReadiness.state, 'blocked', 'LLM provider supply-chain validation: production route readiness blocks without evidence');
  includes(
    routeReadiness.blockers.join(','),
    'llm-provider-primary-runtime-evidence-missing',
    'LLM provider supply-chain validation: production route readiness requires primary runtime evidence',
  );

  equal(countOccurrencesOutsideOpenAi(/\bcallGpt\(/gu), 1, 'LLM provider supply-chain validation: callGpt has one caller outside the wrapper');
  equal(countOccurrencesOutsideOpenAi(/\bcallGptVision\(/gu), 0, 'LLM provider supply-chain validation: callGptVision has no caller outside the wrapper');
  includes(financialCli, 'OPENAI_API_KEY is required for live financial SQL generation.', 'LLM provider supply-chain validation: live model CLI requires OpenAI key');
  includes(financialTypes, 'ANTHROPIC_API_KEY', 'LLM provider supply-chain validation: readiness mentions Anthropic credentials');
  excludes(financialTypes, /from ['"].*anthropic/iu, 'LLM provider supply-chain validation: no Anthropic client import exists in readiness types');
  includes(evaluationPacket, 'Optional live-upstream variant', 'LLM provider supply-chain validation: live upstream path is optional');
  includes(evaluationPacket, 'Optional live-model variant, not the default reviewer path.', 'LLM provider supply-chain validation: live model is not default reviewer path');

  includes(doc, 'F2-AG-7 agentic supply-chain and LLM provider dependency: `partial`.', 'LLM provider supply-chain validation doc: F2-AG-7 status is partial');
  includes(doc, 'F2-AG-8 multimodal vision input future risk: `backlog`.', 'LLM provider supply-chain validation doc: F2-AG-8 status is backlog');
  includes(doc, 'F4-LLM03-A agentic supply-chain coverage gap / single LLM provider: `partial`.', 'LLM provider supply-chain validation doc: F4-LLM03-A status is partial');
  includes(doc, 'F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope: `partial`.', 'LLM provider supply-chain validation doc: F4-D status is partial');
  includes(doc, 'No hosted production, multi-provider resilience, or prompt-leakage closure claim is made.', 'LLM provider supply-chain validation doc: no overclaim is present');
  includes(doc, 'route-readiness evidence now separates route selection from production-like or', 'LLM provider supply-chain validation doc: route-readiness evidence gate is recorded');
  includes(registryDoc, 'Status: repository-side provider contract with OpenAI and Anthropic runtime', 'LLM provider registry doc: runtime boundary is explicit');
  includes(registryDoc, 'Failover Compatibility Rule', 'LLM provider registry doc: compatible failover rule is documented');
  includes(registryDoc, 'Route Readiness Evidence Gate', 'LLM provider registry doc: route-readiness evidence gate is documented');
  includes(
    registryDoc,
    'llm-provider-compatible-failover-provider-not-ready',
    'LLM provider registry doc: incompatible fallback blocker is documented',
  );
  includes(registryDoc, 'OpenAI timeout and output-token budget enforcement are wired', 'LLM provider registry doc: OpenAI timeout/cost boundary is explicit');
  includes(registryDoc, 'Anthropic timeout, retry, output-token, strict-tool, and', 'LLM provider registry doc: Anthropic timeout/cost boundary is explicit');
  includes(registryDoc, 'reasoning live smoke proofs are wired as explicit external-live probes', 'LLM provider registry doc: provider smoke proof boundary is explicit');
  includes(registryDoc, 'No route-readiness evidence evaluation activates a live provider call.', 'LLM provider registry doc: live call non-activation is explicit');

  includes(tracker, 'F2-AG-7 agentic supply-chain and LLM provider dependency | `partial`', 'Tracker: F2-AG-7 remains partial');
  includes(tracker, 'F2-AG-8 multimodal vision input future risk | `backlog`', 'Tracker: F2-AG-8 is backlog');
  includes(tracker, 'F4-LLM03-A agentic supply-chain coverage gap / single LLM provider | `partial`', 'Tracker: F4-LLM03-A is partial');
  includes(tracker, 'F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `partial`', 'Tracker: F4-D is partial');
  includes(tracker, 'route-readiness evidence gating', 'Tracker: F4-D route-readiness evidence gate is recorded');
  includes(tracker, 'docs/audit/f2-llm-provider-supply-chain-validation.md', 'Tracker: validation doc is linked');
  includes(packageJson, '"test:f2-llm-provider-supply-chain-validation"', 'Package: validation test is exposed');
  includes(packageJson, '"test:llm-provider-registry"', 'Package: registry test is exposed');
  includes(packageJson, '"test:openai-runtime-policy"', 'Package: OpenAI runtime policy test is exposed');
  includes(packageJson, '"test:openai-live-smoke-proof"', 'Package: OpenAI live smoke proof test is exposed');
  includes(packageJson, '"probe:openai-live-smoke"', 'Package: OpenAI live smoke probe is exposed');
  includes(packageJson, '"test:anthropic-runtime-policy"', 'Package: Anthropic runtime policy test is exposed');
  includes(packageJson, '"test:anthropic-live-smoke-proof"', 'Package: Anthropic live smoke proof test is exposed');
  includes(packageJson, '"probe:anthropic-live-smoke"', 'Package: Anthropic live smoke probe is exposed');

  excludes(tracker, /F4-D Attestor-owned OpenAI usage .*`fixed`/u, 'Tracker: F4-D is not overclaimed as fixed');
  excludes(tracker, /F2-AG-8 multimodal vision input future risk .*`fixed`/u, 'Tracker: F2-AG-8 is not overclaimed as fixed');

  console.log(`F2 LLM provider supply-chain validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 LLM provider supply-chain validation tests failed:', error);
  process.exitCode = 1;
}
