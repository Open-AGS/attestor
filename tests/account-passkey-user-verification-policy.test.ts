import { strict as assert } from 'node:assert';
import { loadHostedPasskeyConfig } from '../src/service/account/account-passkeys.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function main(): Promise<void> {
  const keys = [
    'ATTESTOR_WEBAUTHN_ORIGIN',
    'ATTESTOR_WEBAUTHN_REQUIRE_USER_VERIFICATION',
    'NODE_ENV',
    'ATTESTOR_HA_MODE',
    'ATTESTOR_PUBLIC_HOSTNAME',
    'ATTESTOR_PUBLIC_BASE_URL',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Record<
    typeof keys[number],
    string | undefined
  >;

  try {
    for (const key of keys) delete process.env[key];
    process.env.ATTESTOR_WEBAUTHN_ORIGIN = 'https://accounts.attestor.example.invalid';

    ok(
      loadHostedPasskeyConfig().requireUserVerification === false,
      'Passkey UV policy: local default remains preferred for dev/test compatibility',
    );

    process.env.NODE_ENV = 'production';
    ok(
      loadHostedPasskeyConfig().requireUserVerification === true,
      'Passkey UV policy: production-like runtime defaults to required user verification',
    );

    process.env.ATTESTOR_WEBAUTHN_REQUIRE_USER_VERIFICATION = 'false';
    ok(
      loadHostedPasskeyConfig().requireUserVerification === false,
      'Passkey UV policy: explicit rollout override is honored',
    );

    delete process.env.NODE_ENV;
    delete process.env.ATTESTOR_WEBAUTHN_REQUIRE_USER_VERIFICATION;
    process.env.ATTESTOR_PUBLIC_HOSTNAME = 'attestor.example.invalid';
    ok(
      loadHostedPasskeyConfig().requireUserVerification === true,
      'Passkey UV policy: public hostname defaults to required user verification',
    );

    console.log(`\nAccount passkey user-verification policy tests: ${passed} passed, 0 failed`);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error('\nAccount passkey user-verification policy tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
