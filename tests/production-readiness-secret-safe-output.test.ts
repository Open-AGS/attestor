import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  digestReference,
  redactSensitiveOutput,
  safeErrorMessage,
  stringifySecretSafe,
} from '../scripts/secret-safe-output.ts';

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
    'Bearer tenant_admin_secret',
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
    nested: ['Bearer private-token'],
  });
  const error = safeErrorMessage(new Error('failed with rk_live_private and whsec_private'));

  ok(!json.includes('sk_live_private'), 'Secret-safe output: JSON stringifier redacts API keys');
  ok(!json.includes('whsec_private'), 'Secret-safe output: JSON stringifier redacts webhook secrets');
  ok(!json.includes('cus_private'), 'Secret-safe output: JSON stringifier redacts customer refs');
  ok(!json.includes('private-token'), 'Secret-safe output: JSON stringifier redacts bearer tokens');
  ok(!error.includes('rk_live_private'), 'Secret-safe output: error formatter redacts restricted keys');
  ok(!error.includes('whsec_private'), 'Secret-safe output: error formatter redacts webhook secrets');
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
}

testRedactsKnownLiveSecretShapes();
testStringifyAndErrorsAreSecretSafe();
testDigestReferenceIsStableAndNonReversibleInOutput();
testCriticalOpsScriptsUseSecretSafeOutput();

console.log(`production-readiness-secret-safe-output: ${passed} assertions passed`);
