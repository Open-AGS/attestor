import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
  consequenceAgenticSupplyChainGuardDescriptor,
} from '../src/consequence-admission/index.js';
import { observeOpenAiModel } from '../src/api/openai.js';
import { evaluateLlmProviderRegistry, llmProviderRegistryDescriptor } from '../src/api/llm-provider-registry.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function containerRefs(content: string): readonly string[] {
  const refs: string[] = [];
  for (const match of content.matchAll(/^\s*FROM\s+([^\s]+)(?:\s+AS\s+\S+)?\s*$/gimu)) {
    refs.push(match[1] ?? '');
  }
  for (const match of content.matchAll(/^\s*image:\s*([^\s#]+)\s*$/gmu)) {
    refs.push(match[1] ?? '');
  }
  return refs;
}

function assertDigestPinnedRefs(fileLabel: string, content: string): void {
  const refs = containerRefs(content);
  ok(refs.length > 0, `F11-SC-1/2: ${fileLabel} exposes image refs`);
  for (const ref of refs) {
    excludes(ref, /:latest(?:@|$)/u, `F11-SC-1/2: ${fileLabel} avoids :latest for ${ref}`);
    ok(/@sha256:[0-9a-f]{64}$/u.test(ref), `F11-SC-1/2: ${fileLabel} digest-pins ${ref}`);
  }
}

function testContainerImagePins(): void {
  for (const file of [
    'Dockerfile',
    'docker-compose.ha.yml',
    'docker-compose.dr.yml',
    'docker-compose.observability.yml',
    'ops/kubernetes/observability/deployment.yaml',
    'ops/kubernetes/observability/providers/grafana-alloy/patch-deployment.yaml',
  ]) {
    assertDigestPinnedRefs(file, readProjectFile(...file.split('/')));
  }

  const baseline = readProjectFile('scripts', 'check-supply-chain-baseline.mjs');
  includes(baseline, 'digestPinnedContainerFiles', 'F11-SC-1/2: supply-chain baseline checks container image files');
  includes(baseline, 'must not use a floating :latest image', 'F11-SC-2: supply-chain baseline rejects :latest');
  includes(baseline, 'image must be digest-pinned', 'F11-SC-1: supply-chain baseline rejects missing digests');
}

function testCriticalRuntimeDependenciesAreExactPinned(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly dependencies: Record<string, string>;
  };
  const lock = JSON.parse(readProjectFile('package-lock.json')) as {
    readonly packages: Record<string, { readonly dependencies?: Record<string, string> }>;
  };
  const rootLockDependencies = lock.packages['']?.dependencies ?? {};

  for (const dependency of [
    '@hono/node-server',
    'bullmq',
    'hono',
    'ioredis',
    'jose',
    'node-forge',
    'openai',
    'openid-client',
    'pg',
    'snowflake-sdk',
    'stripe',
  ]) {
    const range = packageJson.dependencies[dependency];
    ok(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(range), `F11-SC-3/10: ${dependency} is exact-pinned`);
    equal(rootLockDependencies[dependency], range, `F11-SC-3/10: ${dependency} root lock entry matches package.json`);
  }

  includes(
    readProjectFile('scripts', 'check-supply-chain-baseline.mjs'),
    'criticalExactPinnedRuntimeDependencies',
    'F11-SC-3/10: supply-chain baseline protects the critical exact-pin list',
  );
}

function testOpenAiModelObservation(): void {
  const openai = readProjectFile('src', 'api', 'openai.ts');
  const same = observeOpenAiModel('o3', { model: 'o3' });
  const drift = observeOpenAiModel('o3', { model: 'o3-2026-05-15' });
  const missing = observeOpenAiModel('o3', {});

  equal(same.modelDriftObserved, false, 'F11-SC-6: same observed model does not drift');
  equal(drift.modelDriftObserved, true, 'F11-SC-6: different observed model flags drift');
  equal(drift.observedModel, 'o3-2026-05-15', 'F11-SC-6: observed model is retained as metadata');
  equal(missing.observedModel, null, 'F11-SC-6: missing response model remains explicit null');
  includes(openai, 'OpenAI response model drift observed', 'F11-SC-6: drift warning is logged');
  includes(openai, 'modelDriftObserved', 'F11-SC-6: call result carries model drift metadata');
  includes(openai, 'resolveOpenAiRuntimePolicy', 'F11-SC-4: OpenAI wrapper resolves runtime policy');
  includes(openai, 'maxRetries: 0', 'F11-SC-4: OpenAI SDK hidden retries are disabled');
  includes(openai, 'store: false', 'F11-SC-4: OpenAI provider-side response storage is disabled');
  includes(openai, 'providerProofContext', 'F11-SC-6: OpenAI call result carries digest-only provider context');
}

function testExistingSupplyChainControlsRemainScoped(): void {
  const descriptor = consequenceAgenticSupplyChainGuardDescriptor();
  const providerRegistry = llmProviderRegistryDescriptor();
  const providerEvaluation = evaluateLlmProviderRegistry({ requireFailover: true });
  const kinds = CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS;
  const releaseProvenance = readProjectFile('.github', 'workflows', 'release-provenance.yml');
  const securityBaseline = readProjectFile('tests', 'security-baseline-docs.test.ts');

  ok(kinds.includes('model-provider-sdk'), 'F11-SC-4: model-provider-sdk is a supply-chain component kind');
  equal(providerRegistry.providers.filter((provider) => provider.wireStatus === 'wired').length, 1, 'F11-SC-4: only one LLM provider is wired');
  equal(providerEvaluation.productionReady, false, 'F11-SC-4: provider registry does not claim production readiness');
  ok(
    providerEvaluation.blockers.includes('llm-provider-failover-provider-not-wired'),
    'F11-SC-4: provider registry fails closed without failover provider',
  );
  ok(kinds.includes('generated-adapter'), 'F11-SC-5: generated-adapter is a supply-chain component kind');
  ok(kinds.includes('mcp-server'), 'F11-SC-9: mcp-server is a supply-chain component kind');
  ok(kinds.includes('connector'), 'F11-SC-10: connector is a supply-chain component kind');
  ok(kinds.includes('plugin'), 'F11-SC-10: plugin is a supply-chain component kind');
  equal(descriptor.requiresPinnedSource, true, 'F11-SC-5/10: guard requires pinned source');
  equal(descriptor.requiresVerifiedProvenance, true, 'F11-SC-5/10: guard requires verified provenance');

  includes(releaseProvenance, 'npm run sbom:cyclonedx', 'F11-SC-11: release provenance generates SBOM');
  includes(releaseProvenance, '.attestor/release-provenance/sbom.cyclonedx.json', 'F11-SC-11: SBOM artifact path is packaged');
  includes(releaseProvenance, 'attestations: write', 'F11-SC-12: attestation write is isolated to release provenance');
  includes(releaseProvenance, 'id-token: write', 'F11-SC-12: OIDC write is isolated to release provenance');
  includes(releaseProvenance, '- "v*-evaluation"', 'F11-SC-12: tagged evaluation release trigger is explicit');
  includes(securityBaseline, 'evaluation smoke must not yet request attestation write', 'F11-SC-12: workflow permission regression test exists');
}

function testWebhookAndEvidenceBoundariesAreTracked(): void {
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const f2Evidence = readProjectFile('docs', 'audit', 'f2-evidence-confidence-validation.md');
  const stripeWebhook = readProjectFile('tests', 'service-stripe-webhook-service.test.ts');
  const emailWebhook = readProjectFile('tests', 'service-email-webhook-service.test.ts');

  includes(tracker, 'F8-R12 webhook signature route proof | `fixed`', 'F11-SC-8: webhook proof inherits F8 fixed evidence');
  includes(stripeWebhook, 'testMissingSignatureFailsClosed', 'F11-SC-8: Stripe missing signature rejection is tested');
  includes(emailWebhook, 'testSendGridWebhookRejectsUnsignedRequests', 'F11-SC-8: SendGrid unsigned request rejection is tested');
  includes(emailWebhook, 'testMailgunWebhookRejectsReplayTokenWithoutDigest', 'F11-SC-8: Mailgun replay-token rejection is tested');
  includes(f2Evidence, 'source-system-verification', 'F11-SC-7: evidence confidence keeps source-system verification explicit');
  includes(tracker, 'F2-AG-6 unsupported confidence / hallucinated evidence | `partial`', 'F11-SC-7: universal evidence re-fetch remains partial');
}

function testDocsTrackerAndPackageStayAligned(): void {
  const validation = readProjectFile('docs', 'audit', 'f11-supply-chain-depth-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const research = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const pkg = readProjectFile('package.json');

  includes(validation, '# F11 Supply Chain Depth Validation', 'F11 doc: title exists');
  includes(validation, '| F11-SC-1 container base images use floating tags | `fixed` |', 'F11 doc: SC-1 is fixed');
  includes(validation, '| F11-SC-4 single OpenAI provider / provider registry contract | `partial` |', 'F11 doc: SC-4 boundary remains partial');
  includes(validation, 'apply timeout/output-token runtime policy', 'F11 doc: SC-4 runtime policy is documented');
  includes(validation, '| F11-SC-11 SBOM packaging not located | `invalid-as-stated` |', 'F11 doc: SC-11 stale claim is invalidated');
  includes(validation, 'F11 is closed for planned repository-side work in this slice.', 'F11 doc: closure statement is explicit');
  includes(tracker, 'F11 supply-chain depth | 12 | 7 | 5 | 0', 'Tracker: F11 count row exists');
  includes(tracker, 'Remaining F11 queue after supply-chain depth validation: 0 planned', 'Tracker: F11 remaining queue is explicit');
  includes(research, '### 22. F11 Supply Chain Depth Closure', 'Research ledger: F11 closure exists');
  includes(pkg, '"test:f11-supply-chain-depth-validation"', 'Package: F11 validation script exists');

  excludes(validation, /\bSLSA Level [0-9]+ achieved\b/iu, 'F11 doc: avoids SLSA overclaim');
  excludes(tracker, /\bmulti-provider LLM resilience.*`fixed`/iu, 'Tracker: avoids multi-provider overclaim');
}

try {
  testContainerImagePins();
  testCriticalRuntimeDependenciesAreExactPinned();
  testOpenAiModelObservation();
  testExistingSupplyChainControlsRemainScoped();
  testWebhookAndEvidenceBoundariesAreTracked();
  testDocsTrackerAndPackageStayAligned();
  console.log(`F11 supply-chain depth validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F11 supply-chain depth validation tests failed:', error);
  process.exitCode = 1;
}
