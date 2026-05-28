import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  accountSessionTokenHashCandidates,
  findAccountSessionByToken,
  hashAccountSessionToken,
  issueAccountSession,
  resetAccountSessionStoreForTests,
} from '../src/service/account/account-session-store.js';
import { accountMfaEncryptionKeySource } from '../src/service/account/account-mfa.js';
import { hostedOidcStateKeySource } from '../src/service/account/account-oidc.js';
import {
  hostedSamlRelayStateKeySource,
  loadHostedSamlSummary,
} from '../src/service/account/account-saml.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const envKeys = [
  'ATTESTOR_ACCOUNT_SESSION_STORE_PATH',
  'ATTESTOR_SESSION_TOKEN_HASH_KEY',
  'ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY',
  'ATTESTOR_HOSTED_OIDC_STATE_KEY',
  'ATTESTOR_HOSTED_SAML_RELAY_STATE_KEY',
  'ATTESTOR_HOSTED_SAML_IDP_METADATA_XML',
  'ATTESTOR_HOSTED_SAML_REQUIRE_MESSAGE_SIGNATURE',
  'ATTESTOR_ADMIN_API_KEY',
  'NODE_ENV',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv(): void {
  for (const key of envKeys) delete process.env[key];
}

function assertProductionDedicatedKey(
  label: string,
  source: () => string,
  dedicatedEnv: typeof envKeys[number],
): void {
  clearEnv();
  process.env.ATTESTOR_ADMIN_API_KEY = `${label}-admin`;
  ok(source() === 'local-admin-fallback', `${label}: local/dev may use admin-key fallback`);

  process.env.NODE_ENV = 'production';
  assert.throws(
    source,
    /must be set/u,
    `${label}: production-like runtime rejects admin-key fallback`,
  );

  process.env[dedicatedEnv] = `${label}-dedicated`;
  ok(source() === 'dedicated', `${label}: production-like runtime accepts dedicated key`);
}

async function main(): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-account-auth-key-boundaries-'));

  try {
    clearEnv();
    process.env.ATTESTOR_ACCOUNT_SESSION_STORE_PATH = join(workspace, 'account-sessions.json');
    process.env.ATTESTOR_SESSION_TOKEN_HASH_KEY = 'session-hash-secret';
    const token = 'atsess_test_token';
    const keyedHash = hashAccountSessionToken(token);
    const legacyHash = createHash('sha256').update(token).digest('hex');
    ok(keyedHash !== legacyHash, 'Session token hash: dedicated key uses HMAC rather than bare SHA-256');
    ok(accountSessionTokenHashCandidates(token).includes(legacyHash), 'Session token hash: legacy hash remains a lookup candidate');

    delete process.env.ATTESTOR_SESSION_TOKEN_HASH_KEY;
    resetAccountSessionStoreForTests();
    const issued = issueAccountSession({
      accountId: 'acct_legacy_session',
      accountUserId: 'ausr_legacy_session',
      role: 'account_admin',
    });
    process.env.ATTESTOR_SESSION_TOKEN_HASH_KEY = 'rotated-session-hash-secret';
    ok(
      findAccountSessionByToken(issued.sessionToken)?.id === issued.record.id,
      'Session token hash: keyed deployments can still find legacy file-backed sessions',
    );

    clearEnv();
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => hashAccountSessionToken(token),
      /ATTESTOR_SESSION_TOKEN_HASH_KEY/u,
      'Session token hash: production-like sessions require a dedicated hash key',
    );

    assertProductionDedicatedKey(
      'MFA encryption key',
      accountMfaEncryptionKeySource,
      'ATTESTOR_ACCOUNT_MFA_ENCRYPTION_KEY',
    );
    assertProductionDedicatedKey(
      'OIDC state key',
      hostedOidcStateKeySource,
      'ATTESTOR_HOSTED_OIDC_STATE_KEY',
    );
    assertProductionDedicatedKey(
      'SAML relay key',
      hostedSamlRelayStateKeySource,
      'ATTESTOR_HOSTED_SAML_RELAY_STATE_KEY',
    );

    clearEnv();
    process.env.ATTESTOR_HOSTED_SAML_IDP_METADATA_XML = '<EntityDescriptor />';
    ok(
      loadHostedSamlSummary('https://attestor.example.invalid').messageSignatureRequired === true,
      'SAML signature policy: message signatures remain required by default',
    );
    process.env.ATTESTOR_HOSTED_SAML_REQUIRE_MESSAGE_SIGNATURE = 'false';
    ok(
      loadHostedSamlSummary('https://attestor.example.invalid').messageSignatureRequired === false,
      'SAML signature policy: assertion-only IdP compatibility can be explicitly configured',
    );

    console.log(`Account auth key boundary tests: ${passed} passed, 0 failed`);
  } finally {
    resetAccountSessionStoreForTests();
    restoreEnv();
    rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nAccount auth key boundary tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
