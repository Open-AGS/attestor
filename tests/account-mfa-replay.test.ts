import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TOTP_PENDING_ENROLLMENT_TTL_MS,
  generateCurrentTotpCode,
  generateRecoveryCodes,
  generateTotpSecretBase32,
  isPendingTotpEnrollmentFresh,
  verifyTotpCodeWithStep,
} from '../src/service/account/account-mfa.js';
import {
  createAccountUser,
  recordAccountUserTotpVerificationStep,
  resetAccountUserStoreForTests,
  type AccountUserTotpState,
} from '../src/service/account/account-user-store.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function pendingTotpState(pendingIssuedAt: string | null): AccountUserTotpState {
  return {
    method: 'totp',
    algorithm: 'SHA1',
    digits: 6,
    periodSeconds: 30,
    enabledAt: null,
    updatedAt: pendingIssuedAt,
    sessionBoundaryAt: null,
    secretCiphertext: null,
    secretIv: null,
    secretAuthTag: null,
    pendingSecretCiphertext: 'pending-ciphertext',
    pendingSecretIv: 'pending-iv',
    pendingSecretAuthTag: 'pending-auth-tag',
    pendingIssuedAt,
    recoveryCodes: [],
    recoveryCodesIssuedAt: null,
    lastVerifiedAt: null,
    lastAcceptedStep: null,
  };
}

async function main(): Promise<void> {
  const previous = {
    ATTESTOR_ACCOUNT_USER_STORE_PATH: process.env.ATTESTOR_ACCOUNT_USER_STORE_PATH,
  };
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-account-mfa-replay-'));

  try {
    process.env.ATTESTOR_ACCOUNT_USER_STORE_PATH = join(workspace, 'account-users.json');
    resetAccountUserStoreForTests();

    const secretBase32 = generateTotpSecretBase32();
    const nowMs = 1_800_000;
    const code = generateCurrentTotpCode(secretBase32, nowMs);
    const first = verifyTotpCodeWithStep({ secretBase32, code, nowMs });
    ok(first.ok === true && first.acceptedStep !== null, 'TOTP replay guard: first code returns accepted step');

    const replay = verifyTotpCodeWithStep({
      secretBase32,
      code,
      nowMs,
      lastAcceptedStep: first.acceptedStep,
    });
    ok(replay.ok === false, 'TOTP replay guard: same step is rejected after successful validation');

    const user = createAccountUser({
      accountId: 'acct_totp_replay',
      email: 'totp-replay@example.test',
      displayName: 'TOTP Replay',
      password: 'TotpReplayPassword123!',
      role: 'account_admin',
    }).record;
    const consumed = recordAccountUserTotpVerificationStep(user.id, first.acceptedStep!, '2026-05-06T00:00:00.000Z');
    ok(consumed.accepted === true, 'TOTP replay guard: accepted step is persisted once');
    const duplicate = recordAccountUserTotpVerificationStep(user.id, first.acceptedStep!, '2026-05-06T00:00:01.000Z');
    ok(duplicate.accepted === false, 'TOTP replay guard: persisted step cannot be consumed twice');

    const recovery = generateRecoveryCodes(2);
    ok(recovery.codes.length === 2, 'Recovery codes: requested count returned');
    ok(
      recovery.codes.every((entry) => /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/.test(entry)),
      'Recovery codes: generated codes carry 80 bits as 16 base32 symbols',
    );

    const pendingNowMs = Date.parse('2026-05-06T00:10:00.000Z');
    ok(
      isPendingTotpEnrollmentFresh(
        pendingTotpState('2026-05-06T00:01:00.000Z'),
        pendingNowMs,
      ),
      'TOTP enrollment freshness: pending secret inside TTL is accepted',
    );
    ok(
      !isPendingTotpEnrollmentFresh(
        pendingTotpState('2026-05-05T23:59:59.999Z'),
        pendingNowMs,
        TOTP_PENDING_ENROLLMENT_TTL_MS,
      ),
      'TOTP enrollment freshness: pending secret outside TTL is rejected',
    );
    ok(
      !isPendingTotpEnrollmentFresh(pendingTotpState(null), pendingNowMs),
      'TOTP enrollment freshness: missing pendingIssuedAt is rejected',
    );
    ok(
      !isPendingTotpEnrollmentFresh(
        pendingTotpState('2026-05-06T00:10:00.001Z'),
        pendingNowMs,
      ),
      'TOTP enrollment freshness: future pendingIssuedAt is rejected',
    );

    console.log(`\nAccount MFA replay tests: ${passed} passed, 0 failed`);
  } finally {
    resetAccountUserStoreForTests();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nAccount MFA replay tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
