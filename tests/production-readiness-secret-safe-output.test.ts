import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  digestReference,
  redactSensitiveOutput,
  safeErrorMessage,
  stringifySecretSafe,
} from '../scripts/secret-safe-output.ts';
import { CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS } from '../src/consequence-admission/data-minimization-redaction-policy.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function testRedactsKnownLiveSecretShapes(): void {
  const raw = [
    'sk_live_51TVAhQsecret',
    'rk_live_51TVAhQrestricted',
    'whsec_F6ayeSecret',
    'Authorization: Bearer tenant_admin_secret',
    'postgres://user:password@db.example/attestor',
    'redis://:password@redis.example/0',
    'cus_123',
    'sub_123',
    'cs_test_123',
    'bps_123',
    'evt_123',
    'we_123',
    'acct_123',
  ].join('\n');
  const redacted = redactSensitiveOutput(raw);

  for (const forbidden of [
    'sk_live_51TVAhQsecret',
    'rk_live_51TVAhQrestricted',
    'whsec_F6ayeSecret',
    'tenant_admin_secret',
    'password@',
    'cus_123',
    'sub_123',
    'cs_test_123',
    'bps_123',
    'evt_123',
    'we_123',
    'acct_123',
  ]) {
    ok(!redacted.includes(forbidden), `Secret-safe output: ${forbidden} is redacted`);
  }
  ok(redacted.includes('sk_live_[redacted]'), 'Secret-safe output: live secret key is marked redacted');
  ok(redacted.includes('rk_live_[redacted]'), 'Secret-safe output: live restricted key is marked redacted');
  ok(redacted.includes('whsec_[redacted]'), 'Secret-safe output: webhook secret is marked redacted');
}

function testStringifyAndErrorsAreSecretSafe(): void {
  const json = stringifySecretSafe({
    apiKey: 'sk_live_private',
    webhookSecret: 'whsec_private',
    customerId: 'cus_private',
    nested: ['Authorization: Bearer private-token'],
  });
  const error = safeErrorMessage(new Error('failed with rk_live_private and whsec_private'));

  ok(!json.includes('sk_live_private'), 'Secret-safe output: JSON stringifier redacts API keys');
  ok(!json.includes('whsec_private'), 'Secret-safe output: JSON stringifier redacts webhook secrets');
  ok(!json.includes('cus_private'), 'Secret-safe output: JSON stringifier redacts customer refs');
  ok(!json.includes('private-token'), 'Secret-safe output: JSON stringifier redacts bearer tokens');
  ok(!error.includes('rk_live_private'), 'Secret-safe output: error formatter redacts restricted keys');
  ok(!error.includes('whsec_private'), 'Secret-safe output: error formatter redacts webhook secrets');
}

function testRedactsProviderSecretShapes(): void {
  const slackTokenSample = ['xoxb', '123456789012', '123456789012', 'abcdefghijklmnopqrstuv'].join('-');
  const providerSamples = [
    'AKIAIOSFODNN7EXAMPLE',
    'ASIAIOSFODNN7EXAMPLE',
    'AIzaSyA1234567890abcdefghijklmnopqrstuv',
    'ya29.a0AfH6SMDexampleexampleexample',
    'ghp_abcdefghijklmnopqrstuvwxyzABCDE12345',
    'github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyzABCDE1234567890',
    slackTokenSample,
    'sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDE1234567890',
    'sk-proj-abcdefghijklmnopqrstuvwxyzABCDE1234567890',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    '-----BEGIN RSA PRIVATE KEY-----\nsecret-key-material\n-----END RSA PRIVATE KEY-----',
  ] as const;
  const redacted = redactSensitiveOutput(providerSamples.join('\n'));

  for (const sample of providerSamples) {
    ok(!redacted.includes(sample), `Secret-safe output: provider sample is redacted: ${sample.slice(0, 12)}`);
  }
  for (const expected of [
    'AKIA[redacted]',
    'ASIA[redacted]',
    'AIza[redacted]',
    'ya29.[redacted]',
    'ghp_[redacted]',
    'github_pat_[redacted]',
    'xoxb-[redacted]',
    'sk-ant-api[redacted]',
    'sk-[redacted]',
    'jwt.[redacted]',
    '-----BEGIN RSA PRIVATE KEY-----\n[redacted]\n-----END RSA PRIVATE KEY-----',
  ]) {
    ok(redacted.includes(expected), `Secret-safe output: provider redaction marker is present: ${expected.split('\n')[0]}`);
  }
}

function testRuntimePolicyMarkersAreCoveredByRedaction(): void {
  const markerSamples = new Map<string, string>([
    ['bearer ', 'Authorization: Bearer short-token'],
    ['jwt.', 'jwt: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRlc3RvciJ9.signature123456'],
    ['private_key', 'private_key=raw-private-key-material'],
    ['secret=', 'secret=raw-secret-material'],
    ['release-token=', 'release-token=raw-release-token-material'],
    ['attestor-release-token', 'attestor-release-token=raw-attestor-release-token'],
  ]);

  for (const marker of CONSEQUENCE_DATA_MINIMIZATION_RUNTIME_SECRET_MARKERS) {
    const sample = markerSamples.get(marker);
    ok(sample, `Secret-safe output: policy marker ${marker} has a representative sample`);
    if (!sample) continue;
    const redacted = redactSensitiveOutput(sample);
    ok(!redacted.includes('raw-'), `Secret-safe output: policy marker ${marker} sample redacts raw material`);
    ok(redacted.includes('[redacted]'), `Secret-safe output: policy marker ${marker} sample carries redaction marker`);
  }
}

function testProviderRedactionFalsePositiveGuards(): void {
  const benign = [
    'Bearer of accountability is a phrase, not a token.',
    'github_patience is not a GitHub personal access token.',
    'AKIAXIOSFODNN7EXAMPLE is not an AWS access key id.',
    '-----BEGIN PUBLIC KEY-----\npublic-key-material\n-----END PUBLIC KEY-----',
  ].join('\n');

  equal(redactSensitiveOutput(benign), benign, 'Secret-safe output: benign provider-adjacent text is not redacted');
}

function testDigestReferenceIsStableAndNonReversibleInOutput(): void {
  const raw = 'acct_customer_private_value';
  const first = digestReference('account', raw);
  const second = digestReference('account', raw);

  equal(first, second, 'Secret-safe output: digest reference is stable');
  ok(typeof first === 'string' && first.startsWith('account:'), 'Secret-safe output: digest reference keeps the kind prefix');
  ok(!first?.includes(raw), 'Secret-safe output: digest reference does not include the raw value');
}

function testCriticalOpsScriptsUseSecretSafeOutput(): void {
  for (const script of [
    'scripts/probe-production-hosted-flow.ts',
    'scripts/probe-ha-release-inputs.ts',
    'scripts/probe-observability-release-inputs.ts',
    'scripts/probe-policy-foundry-production-smoke.ts',
    'scripts/render-ha-promotion-packet.ts',
    'scripts/render-observability-promotion-packet.ts',
    'scripts/render-production-readiness-packet.ts',
  ]) {
    const source = readProjectFile(...script.split('/'));
    ok(
      source.includes('safeErrorMessage') || source.includes('stringifySecretSafe'),
      `Secret-safe output: ${script} uses the shared secret-safe output helper`,
    );
  }

  const hostedFlow = readProjectFile('scripts', 'probe-production-hosted-flow.ts');
  ok(!hostedFlow.includes('accountId: account.id,'), 'Secret-safe output: hosted flow does not print raw account ids');
  ok(!hostedFlow.includes('tenantId: account.primaryTenantId,'), 'Secret-safe output: hosted flow does not print raw tenant ids');
  ok(hostedFlow.includes("digestReference('account'"), 'Secret-safe output: hosted flow emits digest account reference');
  ok(hostedFlow.includes("digestReference('checkout-session'"), 'Secret-safe output: hosted flow emits digest checkout reference');

  const policyFoundrySmoke = readProjectFile('scripts', 'probe-policy-foundry-production-smoke.ts');
  ok(policyFoundrySmoke.includes("digestReference('base-url'"), 'Secret-safe output: Policy Foundry smoke emits digest base URL reference');
  ok(policyFoundrySmoke.includes('stringifySecretSafe'), 'Secret-safe output: Policy Foundry smoke stringifies results through redaction helper');
  ok(policyFoundrySmoke.includes('safeErrorMessage'), 'Secret-safe output: Policy Foundry smoke formats errors through redaction helper');
  ok(!policyFoundrySmoke.includes('console.log(result)'), 'Secret-safe output: Policy Foundry smoke does not print raw result objects');
}

function testPublicArtifactRedactionScannerIsWired(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const workflow = readProjectFile('.github', 'workflows', 'security-scan.yml');
  const scanner = readProjectFile('scripts', 'check-public-artifacts-redaction.mjs');

  equal(
    packageJson.scripts['check:public-artifacts-redaction'],
    'tsx scripts/check-public-artifacts-redaction.mjs',
    'Secret-safe output: public artifact redaction scanner is exposed',
  );
  equal(
    packageJson.scripts['test:public-artifacts-redaction'],
    'npm run check:public-artifacts-redaction',
    'Secret-safe output: public artifact scanner has a test alias',
  );
  ok(workflow.includes('npm run check:public-artifacts-redaction'), 'Secret-safe output: security scan runs public artifact redaction scan');
  ok(scanner.includes('docs/evidence'), 'Secret-safe output: scanner includes public evidence artifacts');
  ok(scanner.includes('docs/00-evaluation'), 'Secret-safe output: scanner includes evaluation artifacts');
}

testRedactsKnownLiveSecretShapes();
testRedactsProviderSecretShapes();
testRuntimePolicyMarkersAreCoveredByRedaction();
testProviderRedactionFalsePositiveGuards();
testStringifyAndErrorsAreSecretSafe();
testDigestReferenceIsStableAndNonReversibleInOutput();
testCriticalOpsScriptsUseSecretSafeOutput();
testPublicArtifactRedactionScannerIsWired();

console.log(`production-readiness-secret-safe-output: ${passed} assertions passed`);
