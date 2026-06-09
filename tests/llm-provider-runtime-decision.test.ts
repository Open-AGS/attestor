import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_LLM_PROVIDER_REGISTRATIONS } from '../src/api/llm-provider-registry.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testDecisionDocRecordsTheRuntimeTarget(): void {
  const decision = readProjectFile(
    'docs',
    '02-architecture',
    'llm-provider-runtime-decision.md',
  );

  for (const expected of [
    '# LLM Provider Runtime Decision',
    'Anthropic Claude Messages API',
    'The first route to prove is:',
    'reasoning route',
    'strict tool-schema path',
    'The goal is not provider-count vanity.',
    'Vertex AI remains the next cloud/IAM target',
    'enterprise mirror target.',
    'selected Anthropic runtime slice',
  ]) {
    includes(decision, expected, `Runtime decision: records ${expected}`);
  }
}

function testDecisionDocRecordsPrimarySourcesAndContract(): void {
  const decision = readProjectFile(
    'docs',
    '02-architecture',
    'llm-provider-runtime-decision.md',
  );

  for (const expected of [
    'OpenAI Responses API',
    'OpenAI rate-limit guidance',
    'Anthropic Messages API',
    'Anthropic tool use',
    'Anthropic rate-limit docs',
    'Vertex AI structured output and function calling',
    'Vertex AI quotas',
    'Azure OpenAI structured outputs and quotas',
    'A small Attestor-owned wrapper around the Anthropic Messages API',
    'no stale hard-coded model claim in the decision doc',
    'Raw provider request and response bodies are caller-local only',
    'At minimum `retry-after`, `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-input-tokens-remaining`, and `anthropic-ratelimit-output-tokens-remaining`',
    'Fake-client tests',
    'Opt-in probe behind explicit external-live env',
  ]) {
    includes(decision, expected, `Runtime decision: source or contract ${expected} is recorded`);
  }

  for (const expected of [
    'Do not claim live multi-provider LLM resilience from this decision or from',
    'Do not claim Vertex AI or Azure OpenAI runtime execution.',
    'Do not claim live failover until OpenAI and Anthropic both execute compatible',
    'Do not let the provider adapter store raw prompts, raw provider bodies',
  ]) {
    includes(decision, expected, `Runtime decision: no-go ${expected} is explicit`);
  }

  excludes(
    decision,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|proof))/iu,
    'Runtime decision: does not make an unqualified production-ready claim',
  );
}

function testRegistryStillBlocksRuntimeClaims(): void {
  const openai = DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'openai');
  const anthropic = DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'anthropic');
  const vertex = DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'vertex-ai');
  const azure = DEFAULT_LLM_PROVIDER_REGISTRATIONS.find((provider) => provider.id === 'azure-openai');

  assert.equal(openai?.wireStatus, 'wired', 'Runtime decision: OpenAI remains wired');
  assert.equal(anthropic?.wireStatus, 'wired', 'Runtime decision: Anthropic is wired after Step 11');
  assert.equal(vertex?.wireStatus, 'planned', 'Runtime decision: Vertex AI remains planned after the decision');
  assert.equal(azure?.wireStatus, 'planned', 'Runtime decision: Azure OpenAI remains planned after the decision');
  assert.equal(
    anthropic?.defaultModelsByPurpose.reasoning,
    'claude-sonnet-4-6',
    'Runtime decision: Anthropic runtime model mapping is configured by Step 11',
  );
  passed += 5;
}

function testTrackersAndIndexesAreUpdated(): void {
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );
  const registry = readProjectFile('docs', '02-architecture', 'llm-provider-registry.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '| Complete in this tracker | 12 |',
    '| Remaining after this tracker | 0 |',
    '| 10 | complete | LLM provider runtime decision |',
    '| 11 | complete | Anthropic runtime PR |',
    '| 12 | complete | Production rehearsal go/no-go packet |',
    'Step 12 adds the production go/no-go packet',
  ]) {
    includes(tracker, expected, `Runtime decision: unlock tracker records ${expected}`);
  }

  for (const expected of [
    '| Complete | 26 |',
    '| Remaining | 0 |',
    '| 10 | complete | LLM provider runtime decision |',
    '| 11 | complete | Anthropic runtime PR |',
    '| 12 | complete | Production rehearsal go/no-go packet |',
    '| 13 | complete | Target-system compatibility matrix |',
    '| 14 | complete | Shadow event canonical schema |',
    '| 15 | complete | Action surface graph |',
    '| 16 | complete | Evidence state model |',
    'live customer pilot execution',
  ]) {
    includes(plan, expected, `Runtime decision: unified plan records ${expected}`);
  }

  includes(
    registry,
    '[LLM Provider Runtime Decision](llm-provider-runtime-decision.md)',
    'Runtime decision: provider registry links the decision doc',
  );
  includes(
    systemOverview,
    '[LLM provider runtime decision](llm-provider-runtime-decision.md)',
    'Runtime decision: system overview links the decision doc',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Runtime decision: README links the integration overview',
  );
  includes(
    ledger,
    '### 52. LLM Provider Runtime Decision',
    'Runtime decision: research ledger entry is present',
  );
  includes(
    ledger,
    'tests/llm-provider-runtime-decision.test.ts',
    'Runtime decision: research ledger indexes the decision test',
  );
  assert.equal(
    packageJson.scripts['test:llm-provider-runtime-decision'],
    'tsx tests/llm-provider-runtime-decision.test.ts',
    'Runtime decision: package script is registered',
  );
  passed += 1;
}

testDecisionDocRecordsTheRuntimeTarget();
testDecisionDocRecordsPrimarySourcesAndContract();
testRegistryStillBlocksRuntimeClaims();
testTrackersAndIndexesAreUpdated();

console.log(`LLM provider runtime decision tests: ${passed} passed, 0 failed`);
