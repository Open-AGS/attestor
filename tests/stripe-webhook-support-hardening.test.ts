import assert from 'node:assert/strict';
import { stripeClient } from '../src/service/stripe-webhook-support.js';

let passed = 0;
function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const envKeys = [
  'NODE_ENV',
  'ATTESTOR_HA_MODE',
  'ATTESTOR_PUBLIC_HOSTNAME',
  'ATTESTOR_PUBLIC_BASE_URL',
  'STRIPE_API_KEY',
] as const;
const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

try {
  for (const key of envKeys) delete process.env[key];
  ok(Boolean(stripeClient()), 'Stripe webhook support hardening: local fallback client remains available for evaluation/dev');

  process.env.NODE_ENV = 'production';
  assert.throws(
    () => stripeClient(),
    /STRIPE_API_KEY/u,
    'Stripe webhook support hardening: production-like runtime requires STRIPE_API_KEY',
  );
  passed += 1;

  process.env.STRIPE_API_KEY = 'sk_test_explicit_key';
  ok(Boolean(stripeClient()), 'Stripe webhook support hardening: explicit Stripe API key is accepted');

  console.log(`Stripe webhook support hardening tests: ${passed} passed, 0 failed`);
} finally {
  restoreEnv();
}
