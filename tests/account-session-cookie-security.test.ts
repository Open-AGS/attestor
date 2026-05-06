import { strict as assert } from 'node:assert';
import { sessionCookieSecure } from '../src/service/account-session-store.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

async function main(): Promise<void> {
  const previous = {
    ATTESTOR_SESSION_COOKIE_SECURE: process.env.ATTESTOR_SESSION_COOKIE_SECURE,
    ATTESTOR_PUBLIC_BASE_URL: process.env.ATTESTOR_PUBLIC_BASE_URL,
    ATTESTOR_PUBLIC_HOSTNAME: process.env.ATTESTOR_PUBLIC_HOSTNAME,
    NODE_ENV: process.env.NODE_ENV,
    ATTESTOR_HA_MODE: process.env.ATTESTOR_HA_MODE,
  };

  try {
    delete process.env.ATTESTOR_SESSION_COOKIE_SECURE;
    delete process.env.ATTESTOR_PUBLIC_BASE_URL;
    delete process.env.ATTESTOR_PUBLIC_HOSTNAME;
    delete process.env.NODE_ENV;
    delete process.env.ATTESTOR_HA_MODE;
    ok(sessionCookieSecure() === false, 'Account session cookies: local default stays insecure when no public endpoint is configured');

    process.env.ATTESTOR_PUBLIC_HOSTNAME = '203.0.113.10.sslip.io';
    ok(sessionCookieSecure() === true, 'Account session cookies: public hostname defaults cookies to secure');

    delete process.env.ATTESTOR_PUBLIC_HOSTNAME;
    process.env.ATTESTOR_PUBLIC_BASE_URL = 'https://attestor.example.invalid';
    ok(sessionCookieSecure() === true, 'Account session cookies: HTTPS public base URL defaults cookies to secure');

    delete process.env.ATTESTOR_PUBLIC_BASE_URL;
    process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'false';
    ok(sessionCookieSecure() === false, 'Account session cookies: explicit false override is still honored for local/test flows');

    delete process.env.ATTESTOR_PUBLIC_HOSTNAME;
    process.env.NODE_ENV = 'production';
    process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'false';
    ok(sessionCookieSecure() === true, 'Account session cookies: production-like runtime forces secure cookies');

    delete process.env.NODE_ENV;
    process.env.ATTESTOR_HA_MODE = 'true';
    process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'false';
    ok(sessionCookieSecure() === true, 'Account session cookies: HA runtime forces secure cookies');

    delete process.env.ATTESTOR_HA_MODE;
    process.env.ATTESTOR_SESSION_COOKIE_SECURE = 'true';
    ok(sessionCookieSecure() === true, 'Account session cookies: explicit true override is honored');

    console.log(`\nAccount session cookie security tests: ${passed} passed, 0 failed`);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error('\nAccount session cookie security tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
