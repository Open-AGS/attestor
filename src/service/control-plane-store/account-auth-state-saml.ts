import type { HostedSamlReplayRecord } from '../account/account-saml.js';
import {
  ensureControlPlanePgSchema as ensureSchema,
  getControlPlanePgPool as getPool,
} from './pg.js';
import {
  coerceHostedSamlReplayRecord,
  rowToHostedSamlReplay,
} from './mappers.js';

export async function listHostedSamlReplaysPg(): Promise<HostedSamlReplayRecord[]> {
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

export async function recordHostedSamlReplayPg(
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
