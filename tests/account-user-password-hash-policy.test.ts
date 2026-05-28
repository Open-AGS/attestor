import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import {
  createPasswordHashState,
  verifyAccountUserPasswordRecord,
  type AccountUserPasswordState,
} from '../src/service/account/account-user-store.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function legacyPasswordState(password: string): AccountUserPasswordState {
  const params = { N: 16_384, r: 8, p: 1, keylen: 64 };
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, params.keylen, {
    ...params,
    maxmem: 32 * 1024 * 1024,
  });

  return {
    algorithm: 'scrypt',
    params,
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
  };
}

function testNewPasswordHashesUseOwaspScryptFloor(): void {
  const state = createPasswordHashState('Correct Horse Battery Staple 2026!');

  ok(state.algorithm === 'scrypt', 'Password hash policy: account passwords use scrypt');
  ok(state.params.N >= 131_072, 'Password hash policy: scrypt N meets OWASP minimum 2^17 floor');
  ok(state.params.r >= 8, 'Password hash policy: scrypt block size is at least 8');
  ok(state.params.p >= 1, 'Password hash policy: scrypt parallelization is at least 1');
  ok(state.params.keylen >= 64, 'Password hash policy: derived key length remains 64 bytes');
  ok(verifyAccountUserPasswordRecord(state, 'Correct Horse Battery Staple 2026!'), 'Password hash policy: new scrypt hashes verify');
  ok(!verifyAccountUserPasswordRecord(state, 'wrong-password'), 'Password hash policy: incorrect candidate fails');
}

function testLegacyScryptHashesStillVerifyByStoredParams(): void {
  const state = legacyPasswordState('legacy-password');

  ok(verifyAccountUserPasswordRecord(state, 'legacy-password'), 'Password hash policy: legacy scrypt hashes verify by stored params');
  ok(!verifyAccountUserPasswordRecord(state, 'wrong-password'), 'Password hash policy: legacy incorrect candidate fails');
}

testNewPasswordHashesUseOwaspScryptFloor();
testLegacyScryptHashesStillVerifyByStoredParams();

console.log(`Account user password hash policy tests: ${passed} passed, 0 failed`);
