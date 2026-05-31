/**
 * Account authentication control-plane state.
 *
 * Keeps account users, sessions, action tokens, and hosted SAML replay behind
 * the control-plane-store facade while isolating the auth persistence family.
 */

import { trimAndStripTrailingSlashes } from '../../platform/string-normalization.js';
import {
  AccountUserStoreError,
  buildAccountUserRecord,
  createPasswordHashState,
  createAccountUser as createAccountUserFile,
  findAccountUserByEmail as findAccountUserByEmailFile,
  findAccountUserById as findAccountUserByIdFile,
  findAccountUserByOidcIdentity as findAccountUserByOidcIdentityFile,
  findAccountUserBySamlIdentity as findAccountUserBySamlIdentityFile,
  findAccountUserByPasskeyCredentialId as findAccountUserByPasskeyCredentialIdFile,
  listAccountUsersByAccountId as listAccountUsersByAccountIdFile,
  listAllAccountUsers as listAllAccountUsersFile,
  normalizeAccountUserEmail,
  recordAccountUserLogin as recordAccountUserLoginFile,
  recordAccountUserTotpVerificationStep as recordAccountUserTotpVerificationStepFile,
  saveAccountUserRecord as saveAccountUserRecordFile,
  setAccountUserPassword as setAccountUserPasswordFile,
  setAccountUserStatus as setAccountUserStatusFile,
  countAccountUsersForAccount as countAccountUsersForAccountFile,
  type AccountUserRecord,
  type AccountUserStatus,
  type CreateAccountUserInput,
} from '../account/account-user-store.js';
import {
  buildAccountSessionRecord,
  accountSessionTokenHashCandidates,
  findAccountSessionByToken as findAccountSessionByTokenFile,
  isAccountSessionRecordExpired,
  issueAccountSession as issueAccountSessionFile,
  listAccountSessions as listAccountSessionsFile,
  revokeAccountSession as revokeAccountSessionFile,
  revokeAccountSessionByToken as revokeAccountSessionByTokenFile,
  revokeAccountSessionsForAccount as revokeAccountSessionsForAccountFile,
  revokeAccountSessionsForUser as revokeAccountSessionsForUserFile,
  type AccountSessionRecord,
  type IssueAccountSessionInput,
} from '../account/account-session-store.js';
import {
  buildAccountMfaLoginTokenRecord,
  buildAccountPasskeyChallengeTokenRecord,
  buildAccountInviteTokenRecord,
  buildPasswordResetTokenRecord,
  consumeAccountUserActionToken as consumeAccountUserActionTokenFile,
  findAccountUserActionTokenByToken as findAccountUserActionTokenByTokenFile,
  hashAccountUserActionToken,
  issueAccountPasskeyChallengeToken as issueAccountPasskeyChallengeTokenFile,
  issueAccountMfaLoginToken as issueAccountMfaLoginTokenFile,
  issueAccountInviteToken as issueAccountInviteTokenFile,
  issuePasswordResetToken as issuePasswordResetTokenFile,
  listAccountUserActionTokensByAccountId as listAccountUserActionTokensByAccountIdFile,
  listAllAccountUserActionTokens as listAllAccountUserActionTokensFile,
  revokeAccountUserActionToken as revokeAccountUserActionTokenFile,
  revokeAccountUserActionTokensForUser as revokeAccountUserActionTokensForUserFile,
  saveAccountUserActionTokenRecord as saveAccountUserActionTokenRecordFile,
  type AccountUserActionTokenPurpose,
  type AccountUserActionTokenRecord,
  type IssueAccountMfaLoginTokenInput,
  type IssueAccountPasskeyChallengeTokenInput,
  type IssueAccountInviteTokenInput,
  type IssuePasswordResetTokenInput,
} from '../account/account-user-token-store.js';
import {
  listHostedSamlReplays as listHostedSamlReplaysFile,
  recordHostedSamlReplay as recordHostedSamlReplayFile,
} from '../account/account-saml-replay-store.js';
import type { HostedSamlReplayRecord } from '../account/account-saml.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
  isSharedControlPlaneConfigured,
  type PgClient,
  type PgPool,
  withControlPlanePgTransaction as withPgTransaction,
} from './pg.js';
import {
  coerceAccountUserActionTokenRecord,
  coerceAccountUserRecord,
  coerceHostedSamlReplayRecord,
  mapPgErrorToAccountUserStoreError,
  rowToAccountSession,
  rowToAccountUser,
  rowToAccountUserActionToken,
  rowToHostedSamlReplay,
} from './mappers.js';

export interface AccountUserStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserRecord[];
}

export interface AccountSessionStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountSessionRecord[];
}

export interface AccountUserActionTokenStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserActionTokenRecord[];
}

async function listAccountUsersByAccountIdPg(accountId: string): Promise<AccountUserRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE account_id = $1
      ORDER BY updated_at DESC, account_user_id ASC`,
    [accountId],
  );
  return result.rows.map(rowToAccountUser);
}

async function listAllAccountUsersPg(): Promise<AccountUserRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.account_users
      ORDER BY updated_at DESC, account_user_id ASC
  `);
  return result.rows.map(rowToAccountUser);
}

async function findAccountUserByIdPg(id: string): Promise<AccountUserRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE account_user_id = $1
      LIMIT 1`,
    [id],
  );
  return result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
}

async function findAccountUserByEmailPg(email: string): Promise<AccountUserRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_users
      WHERE email = $1
      LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  return result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
}

async function countAccountUsersByAccountIdPg(accountId: string): Promise<number> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM attestor_control_plane.account_users
      WHERE account_id = $1`,
    [accountId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function upsertAccountUserPg(record: AccountUserRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  try {
    await target.query(
      `INSERT INTO attestor_control_plane.account_users (
        account_user_id, account_id, email, role_id, user_status, updated_at, last_login_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::jsonb
      )
      ON CONFLICT (account_user_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        email = EXCLUDED.email,
        role_id = EXCLUDED.role_id,
        user_status = EXCLUDED.user_status,
        updated_at = EXCLUDED.updated_at,
        last_login_at = EXCLUDED.last_login_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.accountId,
        record.email,
        record.role,
        record.status,
        record.updatedAt,
        record.lastLoginAt,
        JSON.stringify(record),
      ],
    );
  } catch (err) {
    const mapped = mapPgErrorToAccountUserStoreError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

async function listAccountSessionsPg(filters?: {
  accountId?: string | null;
  accountUserId?: string | null;
}): Promise<AccountSessionRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.accountId) {
    where.push(`account_id = $${idx++}`);
    params.push(filters.accountId);
  }
  if (filters?.accountUserId) {
    where.push(`account_user_id = $${idx++}`);
    params.push(filters.accountUserId);
  }
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_sessions
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY last_seen_at DESC, session_id ASC`,
    params,
  );
  return result.rows.map(rowToAccountSession);
}

async function upsertAccountSessionPg(record: AccountSessionRecord, executor?: PgPool | PgClient): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.account_sessions (
      session_id, account_id, account_user_id, role_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::jsonb
    )
    ON CONFLICT (session_id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      account_user_id = EXCLUDED.account_user_id,
      role_id = EXCLUDED.role_id,
      token_hash = EXCLUDED.token_hash,
      created_at = EXCLUDED.created_at,
      last_seen_at = EXCLUDED.last_seen_at,
      expires_at = EXCLUDED.expires_at,
      revoked_at = EXCLUDED.revoked_at,
      record_json = EXCLUDED.record_json`,
    [
      record.id,
      record.accountId,
      record.accountUserId,
      record.role,
      record.tokenHash,
      record.createdAt,
      record.lastSeenAt,
      record.expiresAt,
      record.revokedAt,
      JSON.stringify(record),
    ],
  );
}

async function listAccountUserActionTokensPg(filters?: {
  accountId?: string | null;
  accountUserId?: string | null;
  purpose?: AccountUserActionTokenPurpose | null;
}): Promise<AccountUserActionTokenRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (filters?.accountId) {
    where.push(`account_id = $${idx++}`);
    params.push(filters.accountId);
  }
  if (filters?.accountUserId) {
    where.push(`account_user_id = $${idx++}`);
    params.push(filters.accountUserId);
  }
  if (filters?.purpose) {
    where.push(`purpose = $${idx++}`);
    params.push(filters.purpose);
  }
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_user_action_tokens
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, token_id ASC`,
    params,
  );
  return result.rows.map(rowToAccountUserActionToken);
}

async function upsertAccountUserActionTokenPg(
  record: AccountUserActionTokenRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureSchema();
  const target = executor ?? await getPool();
  await target.query(
    `INSERT INTO attestor_control_plane.account_user_action_tokens (
      token_id, purpose, account_id, account_user_id, email, role_id, token_hash,
      updated_at, expires_at, consumed_at, revoked_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::timestamptz, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12::jsonb
    )
    ON CONFLICT (token_id) DO UPDATE SET
      purpose = EXCLUDED.purpose,
      account_id = EXCLUDED.account_id,
      account_user_id = EXCLUDED.account_user_id,
      email = EXCLUDED.email,
      role_id = EXCLUDED.role_id,
      token_hash = EXCLUDED.token_hash,
      updated_at = EXCLUDED.updated_at,
      expires_at = EXCLUDED.expires_at,
      consumed_at = EXCLUDED.consumed_at,
      revoked_at = EXCLUDED.revoked_at,
      record_json = EXCLUDED.record_json`,
    [
      record.id,
      record.purpose,
      record.accountId,
      record.accountUserId,
      record.email,
      record.role,
      record.tokenHash,
      record.updatedAt,
      record.expiresAt,
      record.consumedAt,
      record.revokedAt,
      JSON.stringify(record),
    ],
  );
}

async function findAccountSessionByTokenPg(token: string, options?: { touch?: boolean }): Promise<AccountSessionRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const tokenHashes = accountSessionTokenHashCandidates(token);
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_sessions
      WHERE token_hash = ANY($1::text[])
      LIMIT 1`,
    [tokenHashes],
  );
  if (!result.rows[0]) return null;
  const record = rowToAccountSession(result.rows[0]);
  const now = new Date();
  if (record.revokedAt || isAccountSessionRecordExpired(record, now.getTime())) {
    return null;
  }
  if (options?.touch) {
    record.lastSeenAt = now.toISOString();
    await upsertAccountSessionPg(record);
  }
  return record;
}

async function findAccountUserActionTokenByTokenPg(token: string): Promise<AccountUserActionTokenRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_user_action_tokens
      WHERE token_hash = $1
      LIMIT 1`,
    [hashAccountUserActionToken(token)],
  );
  if (!result.rows[0]) return null;
  const record = rowToAccountUserActionToken(result.rows[0]);
  if (record.revokedAt || record.consumedAt || Date.parse(record.expiresAt) <= Date.now()) {
    return null;
  }
  if (record.maxAttempts !== null && record.attemptCount >= record.maxAttempts) {
    return null;
  }
  return record;
}

async function listHostedSamlReplaysPg(): Promise<HostedSamlReplayRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `DELETE FROM attestor_control_plane.account_saml_replays
      WHERE expires_at <= $1::timestamptz`,
    [new Date().toISOString()],
  );
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_saml_replays
      ORDER BY consumed_at DESC, request_id ASC`,
  );
  return result.rows.map(rowToHostedSamlReplay);
}

async function recordHostedSamlReplayPg(
  record: HostedSamlReplayRecord,
): Promise<{ duplicate: boolean; record: HostedSamlReplayRecord; existing: HostedSamlReplayRecord | null }> {
  await ensureSchema();
  const pool = await getPool();
  const normalized = coerceHostedSamlReplayRecord(record);
  await pool.query(
    `DELETE FROM attestor_control_plane.account_saml_replays
      WHERE expires_at <= $1::timestamptz`,
    [new Date().toISOString()],
  );
  const insert = await pool.query(
    `INSERT INTO attestor_control_plane.account_saml_replays (
      request_id, response_id, issuer, subject, consumed_at, expires_at, record_json
    ) VALUES (
      $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::jsonb
    )
    ON CONFLICT (request_id) DO NOTHING
    RETURNING record_json`,
    [
      normalized.requestId,
      normalized.responseId,
      normalized.issuer,
      normalized.subject,
      normalized.consumedAt,
      normalized.expiresAt,
      JSON.stringify(normalized),
    ],
  );
  if (insert.rows[0]) {
    return {
      duplicate: false,
      record: normalized,
      existing: null,
    };
  }
  const existing = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.account_saml_replays
      WHERE request_id = $1
      LIMIT 1`,
    [normalized.requestId],
  );
  return {
    duplicate: true,
    record: normalized,
    existing: existing.rows[0] ? rowToHostedSamlReplay(existing.rows[0]) : null,
  };
}

export async function listAccountUsersByAccountIdState(accountId: string): Promise<{
  records: AccountUserRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAccountUsersByAccountIdFile(accountId);
  return {
    records: await listAccountUsersByAccountIdPg(accountId),
    path: controlPlaneStoreSource(),
  };
}

export async function listAllAccountUsersState(): Promise<{
  records: AccountUserRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAllAccountUsersFile();
  return {
    records: await listAllAccountUsersPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function countAccountUsersForAccountState(accountId: string): Promise<number> {
  if (!isSharedControlPlaneConfigured()) return countAccountUsersForAccountFile(accountId);
  return countAccountUsersByAccountIdPg(accountId);
}

export async function findAccountUserByIdState(id: string): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByIdFile(id);
  return findAccountUserByIdPg(id);
}

export async function findAccountUserByEmailState(email: string): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByEmailFile(email);
  return findAccountUserByEmailPg(normalizeAccountUserEmail(email));
}

export async function findAccountUserByOidcIdentityState(
  issuer: string,
  subject: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByOidcIdentityFile(issuer, subject);
  const records = await listAllAccountUsersPg();
  const normalizedIssuer = trimAndStripTrailingSlashes(issuer);
  const normalizedSubject = subject.trim();
  return records.find((record) =>
    record.federation?.oidc?.identities?.some((identity) =>
      trimAndStripTrailingSlashes(identity.issuer) === normalizedIssuer
      && identity.subject.trim() === normalizedSubject)) ?? null;
}

export async function findAccountUserBySamlIdentityState(
  issuer: string,
  subject: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserBySamlIdentityFile(issuer, subject);
  const records = await listAllAccountUsersPg();
  const normalizedIssuer = trimAndStripTrailingSlashes(issuer);
  const normalizedSubject = subject.trim();
  return records.find((record) =>
    record.federation?.saml?.identities?.some((identity) =>
      trimAndStripTrailingSlashes(identity.issuer) === normalizedIssuer
      && identity.subject.trim() === normalizedSubject)) ?? null;
}

export async function findAccountUserByPasskeyCredentialIdState(
  credentialId: string,
): Promise<AccountUserRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserByPasskeyCredentialIdFile(credentialId);
  const normalizedCredentialId = credentialId.trim();
  if (!normalizedCredentialId) return null;
  const records = await listAllAccountUsersPg();
  return records.find((record) =>
    record.passkeys?.credentials?.some((credential) => credential.credentialId === normalizedCredentialId)) ?? null;
}

export async function createAccountUserState(input: CreateAccountUserInput): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return createAccountUserFile(input);
  const record = buildAccountUserRecord(input);
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function saveAccountUserRecordState(record: AccountUserRecord): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return saveAccountUserRecordFile(record);
  const normalized = coerceAccountUserRecord(record);
  await upsertAccountUserPg(normalized);
  return { record: normalized, path: controlPlaneStoreSource() };
}

export async function recordAccountUserLoginState(id: string): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return recordAccountUserLoginFile(id);
  const record = await findAccountUserByIdPg(id);
  if (!record) {
    throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
  }
  record.lastLoginAt = new Date().toISOString();
  record.updatedAt = record.lastLoginAt;
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function recordAccountUserTotpVerificationStepState(
  id: string,
  acceptedStep: string,
  verifiedAt = new Date().toISOString(),
): Promise<{
  record: AccountUserRecord;
  path: string | null;
  accepted: boolean;
}> {
  if (!/^\d+$/.test(acceptedStep)) {
    throw new AccountUserStoreError('INVALID_STATE', 'Accepted TOTP step must be a non-negative integer string.');
  }
  if (!isSharedControlPlaneConfigured()) {
    return recordAccountUserTotpVerificationStepFile(id, acceptedStep, verifiedAt);
  }
  const nextStep = BigInt(acceptedStep);
  return withPgTransaction(async (client) => {
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.account_users
        WHERE account_user_id = $1
        FOR UPDATE`,
      [id],
    );
    const record = result.rows[0] ? rowToAccountUser(result.rows[0]) : null;
    if (!record) {
      throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
    }
    const lastStep = record.mfa.totp.lastAcceptedStep;
    if (lastStep && /^\d+$/.test(lastStep) && nextStep <= BigInt(lastStep)) {
      return { record, path: controlPlaneStoreSource(), accepted: false };
    }
    record.mfa.totp.lastAcceptedStep = acceptedStep;
    record.mfa.totp.lastVerifiedAt = verifiedAt;
    record.mfa.totp.updatedAt = verifiedAt;
    record.updatedAt = verifiedAt;
    await upsertAccountUserPg(record, client);
    return { record, path: controlPlaneStoreSource(), accepted: true };
  });
}

export async function setAccountUserStatusState(
  id: string,
  nextStatus: AccountUserStatus,
): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setAccountUserStatusFile(id, nextStatus);
  return withPgTransaction(async (client) => {
    const record = await findAccountUserByIdPg(id);
    if (!record) {
      throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
    }
    if (record.status === nextStatus) {
      return { record, path: controlPlaneStoreSource() };
    }
    if (nextStatus === 'inactive' && record.role === 'account_admin') {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count
           FROM attestor_control_plane.account_users
          WHERE account_id = $1
            AND role_id = 'account_admin'
            AND user_status = 'active'`,
        [record.accountId],
      );
      const activeAdmins = Number(result.rows[0]?.count ?? 0);
      if (activeAdmins <= 1) {
        throw new AccountUserStoreError(
          'INVALID_STATE',
          `Account '${record.accountId}' must retain at least one active account_admin user.`,
        );
      }
    }
    record.status = nextStatus;
    record.updatedAt = new Date().toISOString();
    record.deactivatedAt = nextStatus === 'inactive' ? record.updatedAt : null;
    await upsertAccountUserPg(record, client);
    return { record, path: controlPlaneStoreSource() };
  });
}

export async function setAccountUserPasswordState(
  id: string,
  nextPassword: string,
): Promise<{
  record: AccountUserRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return setAccountUserPasswordFile(id, nextPassword);
  const record = await findAccountUserByIdPg(id);
  if (!record) {
    throw new AccountUserStoreError('NOT_FOUND', `Account user '${id}' was not found.`);
  }
  const now = new Date().toISOString();
  record.password = createPasswordHashState(nextPassword);
  record.passwordUpdatedAt = now;
  record.updatedAt = now;
  await upsertAccountUserPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function issueAccountSessionState(input: IssueAccountSessionInput): Promise<{
  sessionToken: string;
  record: AccountSessionRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return issueAccountSessionFile(input);
  const issued = buildAccountSessionRecord(input);
  await upsertAccountSessionPg(issued.record);
  return { ...issued, path: controlPlaneStoreSource() };
}

export async function findAccountSessionByTokenState(
  token: string,
  options?: { touch?: boolean },
): Promise<AccountSessionRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountSessionByTokenFile(token, options);
  return findAccountSessionByTokenPg(token, options);
}

export async function revokeAccountSessionState(id: string): Promise<{
  record: AccountSessionRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionFile(id);
  const records = await listAccountSessionsPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt) {
    record.revokedAt = new Date().toISOString();
    await upsertAccountSessionPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionByTokenState(token: string): Promise<{
  record: AccountSessionRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionByTokenFile(token);
  const record = await findAccountSessionByTokenPg(token);
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt) {
    record.revokedAt = new Date().toISOString();
    await upsertAccountSessionPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionsForUserState(accountUserId: string): Promise<{
  revokedCount: number;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionsForUserFile(accountUserId);
  const sessions = await listAccountSessionsPg({ accountUserId });
  let revokedCount = 0;
  for (const session of sessions) {
    if (!session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      await upsertAccountSessionPg(session);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function revokeAccountSessionsForAccountState(accountId: string): Promise<{
  revokedCount: number;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountSessionsForAccountFile(accountId);
  const sessions = await listAccountSessionsPg({ accountId });
  let revokedCount = 0;
  for (const session of sessions) {
    if (!session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      await upsertAccountSessionPg(session);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function listAccountUserActionTokensByAccountIdState(
  accountId: string,
  options?: { purpose?: AccountUserActionTokenPurpose | null },
): Promise<{
  records: AccountUserActionTokenRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) return listAccountUserActionTokensByAccountIdFile(accountId, options);
  return {
    records: await listAccountUserActionTokensPg({ accountId, purpose: options?.purpose ?? null }),
    path: controlPlaneStoreSource(),
  };
}

export async function findAccountUserActionTokenByTokenState(
  token: string,
): Promise<AccountUserActionTokenRecord | null> {
  if (!isSharedControlPlaneConfigured()) return findAccountUserActionTokenByTokenFile(token);
  return findAccountUserActionTokenByTokenPg(token);
}

export async function recordHostedSamlReplayState(
  record: HostedSamlReplayRecord,
): Promise<{
  duplicate: boolean;
  record: HostedSamlReplayRecord;
  existing: HostedSamlReplayRecord | null;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = recordHostedSamlReplayFile(record);
    return {
      ...result,
      path: result.path,
    };
  }
  const result = await recordHostedSamlReplayPg(record);
  return {
    ...result,
    path: controlPlaneStoreSource(),
  };
}

export async function listHostedSamlReplaysState(): Promise<{
  records: HostedSamlReplayRecord[];
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = listHostedSamlReplaysFile();
    return {
      records: result.records,
      path: result.path,
    };
  }
  return {
    records: await listHostedSamlReplaysPg(),
    path: controlPlaneStoreSource(),
  };
}

export async function issueAccountInviteTokenState(
  input: IssueAccountInviteTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountInviteTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountId: input.accountId, purpose: 'invite' });
  for (const record of existing) {
    if (record.email === normalizeAccountUserEmail(input.email) && !record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountInviteTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issuePasswordResetTokenState(
  input: IssuePasswordResetTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issuePasswordResetTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: 'password_reset' });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildPasswordResetTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issueAccountMfaLoginTokenState(
  input: IssueAccountMfaLoginTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountMfaLoginTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: 'mfa_login' });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountMfaLoginTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function issueAccountPasskeyChallengeTokenState(
  input: IssueAccountPasskeyChallengeTokenInput,
): Promise<{ token: string; record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return issueAccountPasskeyChallengeTokenFile(input);
  const existing = await listAccountUserActionTokensPg({ accountUserId: input.accountUserId, purpose: input.purpose });
  for (const record of existing) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
    }
  }
  const issued = buildAccountPasskeyChallengeTokenRecord(input);
  await upsertAccountUserActionTokenPg(issued.record);
  return { token: issued.token, record: issued.record, path: controlPlaneStoreSource() };
}

export async function consumeAccountUserActionTokenState(
  id: string,
): Promise<{ record: AccountUserActionTokenRecord | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return consumeAccountUserActionTokenFile(id);
  await ensureSchema();
  const pool = await getPool();
  const consumedAt = new Date().toISOString();
  const result = await pool.query(
    `UPDATE attestor_control_plane.account_user_action_tokens
        SET consumed_at = $2::timestamptz,
            updated_at = $2::timestamptz,
            record_json = jsonb_set(
              jsonb_set(record_json, '{consumedAt}', to_jsonb($2::text), true),
              '{updatedAt}', to_jsonb($2::text), true
            )
      WHERE token_id = $1
        AND consumed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > $2::timestamptz
        AND COALESCE((record_json->>'attemptCount')::int, 0) <
            COALESCE((record_json->>'maxAttempts')::int, 2147483647)
      RETURNING record_json`,
    [id, consumedAt],
  );
  return {
    record: result.rows[0] ? rowToAccountUserActionToken(result.rows[0]) : null,
    path: controlPlaneStoreSource(),
  };
}

export async function revokeAccountUserActionTokenState(
  id: string,
): Promise<{ record: AccountUserActionTokenRecord | null; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountUserActionTokenFile(id);
  const records = await listAccountUserActionTokensPg();
  const record = records.find((entry) => entry.id === id) ?? null;
  if (!record) return { record: null, path: controlPlaneStoreSource() };
  if (!record.revokedAt && !record.consumedAt) {
    record.revokedAt = new Date().toISOString();
    record.updatedAt = record.revokedAt;
    await upsertAccountUserActionTokenPg(record);
  }
  return { record, path: controlPlaneStoreSource() };
}

export async function saveAccountUserActionTokenRecordState(
  record: AccountUserActionTokenRecord,
): Promise<{ record: AccountUserActionTokenRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return saveAccountUserActionTokenRecordFile(record);
  const normalized = coerceAccountUserActionTokenRecord(record);
  await upsertAccountUserActionTokenPg(normalized);
  return { record: normalized, path: controlPlaneStoreSource() };
}

export async function revokeAccountUserActionTokensForUserState(
  accountUserId: string,
  purpose?: AccountUserActionTokenPurpose,
): Promise<{ revokedCount: number; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return revokeAccountUserActionTokensForUserFile(accountUserId, purpose);
  const records = await listAccountUserActionTokensPg({ accountUserId, purpose: purpose ?? null });
  let revokedCount = 0;
  for (const record of records) {
    if (!record.revokedAt && !record.consumedAt && Date.parse(record.expiresAt) > Date.now()) {
      record.revokedAt = new Date().toISOString();
      record.updatedAt = record.revokedAt;
      await upsertAccountUserActionTokenPg(record);
      revokedCount += 1;
    }
  }
  return { revokedCount, path: controlPlaneStoreSource() };
}

export async function exportAccountUserStoreSnapshot(): Promise<AccountUserStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAllAccountUsersPg()
    : listAllAccountUsersFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountUserStoreSnapshot(
  snapshot: AccountUserStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account user restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_users CASCADE');
  }
  for (const record of snapshot.records) {
    await upsertAccountUserPg(record);
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAccountSessionStoreSnapshot(): Promise<AccountSessionStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAccountSessionsPg()
    : listAccountSessionsFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountSessionStoreSnapshot(
  snapshot: AccountSessionStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account session restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_sessions');
  }
  for (const record of snapshot.records) {
    await upsertAccountSessionPg(record);
  }
  return { recordCount: snapshot.records.length };
}

export async function exportAccountUserActionTokenStoreSnapshot(): Promise<AccountUserActionTokenStoreSnapshot> {
  const records = isSharedControlPlaneConfigured()
    ? await listAccountUserActionTokensPg()
    : listAllAccountUserActionTokensFile().records;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreAccountUserActionTokenStoreSnapshot(
  snapshot: AccountUserActionTokenStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for account user action token restore.');
  }
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.account_user_action_tokens');
  }
  for (const record of snapshot.records) {
    await upsertAccountUserActionTokenPg(record);
  }
  return { recordCount: snapshot.records.length };
}
