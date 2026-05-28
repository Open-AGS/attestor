import assert from 'node:assert/strict';
import { buildPasswordResetTokenRecord } from '../src/service/account/account-user-token-store.js';

const envKey = 'ATTESTOR_PASSWORD_RESET_MAX_ATTEMPTS';
const saved = process.env[envKey];

function restoreEnv(): void {
  if (saved === undefined) delete process.env[envKey];
  else process.env[envKey] = saved;
}

function resetRecord() {
  return buildPasswordResetTokenRecord({
    accountId: 'acct_123',
    accountUserId: 'user_123',
    email: 'ops@example.com',
    issuedByAccountUserId: 'admin_123',
  }).record;
}

try {
  delete process.env[envKey];
  assert.equal(resetRecord().maxAttempts, 5, 'password reset tokens default to five attempts');

  process.env[envKey] = '3';
  assert.equal(resetRecord().maxAttempts, 3, 'password reset max attempts can be configured');

  process.env[envKey] = '0';
  assert.equal(resetRecord().maxAttempts, 5, 'invalid password reset max attempts fall back safely');

  console.log('Account user action token store tests: 3 passed, 0 failed');
} finally {
  restoreEnv();
}
