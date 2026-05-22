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
  const ascii = (...codes: readonly number[]): string => String.fromCharCode(...codes);
  const fixtureSecret = (...parts: string[]): string => parts.join('');
  const awsLongTermKeyPrefix = ascii(65, 75, 73, 65);
  const awsTemporaryKeyPrefix = ascii(65, 83, 73, 65);
  const googleApiKeyPrefix = ascii(65, 73, 122, 97);
  const googleOAuthPrefix = ascii(121, 97, 50, 57, 46);
  const githubClassicPatPrefix = ascii(103, 104, 112, 95);
  const githubFineGrainedPatPrefix = ascii(103, 105, 116, 104, 117, 98, 95, 112, 97, 116, 95);
  const slackBotTokenPrefix = ascii(120, 111, 120, 98);
  const anthropicApiKeyPrefix = ascii(115, 107, 45, 97, 110, 116, 45, 97, 112, 105, 48, 51, 45);
  const openAiProjectKeyPrefix = ascii(115, 107, 45, 112, 114, 111, 106, 45);
  const slackTokenSample = [slackBotTokenPrefix, '123456789012', '123456789012', 'abcdefghijklmnopqrstuv'].join('-');
  const privateKeyLabel = ['RSA', 'PRIVATE', 'KEY'].join(' ');
  const privateKeyBlock = [
    `-----BEGIN ${privateKeyLabel}-----`,
    'secret-key-material',
    `-----END ${privateKeyLabel}-----`,
  ].join('\n');
  const providerSamples = [
    fixtureSecret(awsLongTermKeyPrefix, 'IOSF', 'ODNN7', 'EXAMPLE'),
    fixtureSecret(awsTemporaryKeyPrefix, 'IOSF', 'ODNN7', 'EXAMPLE'),
    fixtureSecret(googleApiKeyPrefix, 'SyA1234567890', 'abcdefghijk', 'lmnopqrstuv'),
    fixtureSecret(googleOAuthPrefix, 'a0AfH6SMD', 'exampleexampleexample'),
    fixtureSecret(githubClassicPatPrefix, 'abcdefghijklmnopqrstuv', 'wxyzABCDE12345'),
    fixtureSecret(githubFineGrainedPatPrefix, '11ABCDEFG0', 'abcdefghijklmnopqrstuvwxyzABCDE1234567890'),
    slackTokenSample,
    fixtureSecret(anthropicApiKeyPrefix, 'abcdefghijklmnopqrstuvwxyz', 'ABCDE1234567890'),
    fixtureSecret(openAiProjectKeyPrefix, 'abcdefghijklmnopqrstuvwxyz', 'ABCDE1234567890'),
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ].join('.'),
    privateKeyBlock,
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
    `-----BEGIN ${privateKeyLabel}-----\n[redacted]\n-----END ${privateKeyLabel}-----`,
  ]) {
    ok(redacted.includes(expected), `Secret-safe output: provider redaction marker is present: ${expected.split('\n')[0]}`);
  }
}

function testCommittedProviderFixturesAvoidScannerReadySecrets(): void {
  const source = readProjectFile('tests', 'production-readiness-secret-safe-output.test.ts');

  ok(
    !/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u.test(source),
    'Secret-safe output: committed AWS fixtures are not scanner-ready access key ids',
  );
  ok(
    !/\bAIza[0-9A-Za-z_-]{35}\b/u.test(source),
    'Secret-safe output: committed Google fixtures are not scanner-ready API keys',
  );
  ok(
    !/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/u.test(source),
    'Secret-safe output: committed private-key fixtures are assembled at runtime only',
  );
  ok(
    !/\b(?:gh[pousr]_|github_pat_)[0-9A-Za-z_]{20,}\b/u.test(source),
    'Secret-safe output: committed GitHub token fixtures are assembled at runtime only',
  );
  ok(
    !/\b(?:sk-ant-api\d{2}-|sk-proj-)[0-9A-Za-z_-]{16,}\b/u.test(source),
    'Secret-safe output: committed LLM provider key fixtures are assembled at runtime only',
  );
  ok(
    !/\bxox[abprs]-[0-9A-Za-z-]{10,}\b/u.test(source),
    'Secret-safe output: committed Slack token fixtures are assembled at runtime only',
  );
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
  const awsAdjacentText = ['AKIA', 'XIOSFODNN7', 'EXAMPLE'].join('');
  const benign = [
    'Bearer of accountability is a phrase, not a token.',
    'github_patience is not a GitHub personal access token.',
    `${awsAdjacentText} is not an AWS access key id.`,
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
testCommittedProviderFixturesAvoidScannerReadySecrets();
testRuntimePolicyMarkersAreCoveredByRedaction();
testProviderRedactionFalsePositiveGuards();
testStringifyAndErrorsAreSecretSafe();
testDigestReferenceIsStableAndNonReversibleInOutput();
testCriticalOpsScriptsUseSecretSafeOutput();
testPublicArtifactRedactionScannerIsWired();

console.log(`production-readiness-secret-safe-output: ${passed} assertions passed`);
