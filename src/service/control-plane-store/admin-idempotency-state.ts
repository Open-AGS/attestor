import { randomUUID } from 'node:crypto';
import {
  adminIdempotencyCutoffIso,
  advisoryLockKey,
  rowToAdminIdempotencyRecord,
} from './mappers.js';
import {
  buildAdminIdempotencyRequestHash,
  decryptAdminIdempotencyResponse,
  encryptAdminIdempotencyResponse,
  lookupAdminIdempotency as lookupAdminIdempotencyFile,
  recordAdminIdempotency as recordAdminIdempotencyFile,
  type AdminIdempotencyLookup,
  type AdminIdempotencyRecord,
} from '../admin-idempotency-store.js';
import {
  controlPlaneStoreSource,
  isSharedControlPlaneConfigured,
  withControlPlanePgTransaction,
} from './pg.js';

export async function lookupAdminIdempotencyState(options: {
  idempotencyKey: string;
  routeId: string;
  requestPayload: unknown;
}): Promise<AdminIdempotencyLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupAdminIdempotencyFile(options);
  const requestHash = buildAdminIdempotencyRequestHash(options.routeId, options.requestPayload);
  return withControlPlanePgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.admin_idempotency
        WHERE created_at < $1::timestamptz`,
      [adminIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:admin_idempotency:${options.idempotencyKey}`),
    ]);
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_idempotency
        WHERE idempotency_key = $1
        LIMIT 1`,
      [options.idempotencyKey],
    );
    const existing = result.rows[0] ? rowToAdminIdempotencyRecord(result.rows[0]) : null;
    if (!existing) return { kind: 'miss', requestHash };
    if (existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
      return { kind: 'conflict', requestHash, record: existing };
    }
    const replayedRecord: AdminIdempotencyRecord = {
      ...existing,
      lastReplayedAt: new Date().toISOString(),
      replayCount: existing.replayCount + 1,
    };
    await client.query(
      `UPDATE attestor_control_plane.admin_idempotency
          SET last_replayed_at = $2::timestamptz,
              replay_count = $3,
              record_json = $4::jsonb
        WHERE idempotency_key = $1`,
      [
        options.idempotencyKey,
        replayedRecord.lastReplayedAt,
        replayedRecord.replayCount,
        JSON.stringify(replayedRecord),
      ],
    );
    return {
      kind: 'replay',
      requestHash,
      record: replayedRecord,
      response: decryptAdminIdempotencyResponse(replayedRecord),
    };
  });
}

export async function recordAdminIdempotencyState(options: {
  idempotencyKey: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  response: unknown;
}): Promise<{ record: AdminIdempotencyRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordAdminIdempotencyFile(options);
  const requestHash = buildAdminIdempotencyRequestHash(options.routeId, options.requestPayload);
  const record = await withControlPlanePgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.admin_idempotency
        WHERE created_at < $1::timestamptz`,
      [adminIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:admin_idempotency:${options.idempotencyKey}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.admin_idempotency
        WHERE idempotency_key = $1
        LIMIT 1`,
      [options.idempotencyKey],
    );
    const existing = existingResult.rows[0] ? rowToAdminIdempotencyRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
        throw new Error(`Idempotency-Key '${options.idempotencyKey}' already exists for a different request`);
      }
      return existing;
    }
    const encrypted = encryptAdminIdempotencyResponse(options.response);
    const recordToInsert: AdminIdempotencyRecord = {
      id: `idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      idempotencyKey: options.idempotencyKey,
      routeId: options.routeId,
      requestHash,
      statusCode: options.statusCode,
      responseCiphertext: encrypted.ciphertext,
      responseIv: encrypted.iv,
      responseAuthTag: encrypted.authTag,
      createdAt: new Date().toISOString(),
      lastReplayedAt: null,
      replayCount: 0,
    };
    await client.query(
      `INSERT INTO attestor_control_plane.admin_idempotency (
        idempotency_id, idempotency_key, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11, $12::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.idempotencyKey,
        recordToInsert.routeId,
        recordToInsert.requestHash,
        recordToInsert.statusCode,
        recordToInsert.responseCiphertext,
        recordToInsert.responseIv,
        recordToInsert.responseAuthTag,
        recordToInsert.createdAt,
        recordToInsert.lastReplayedAt,
        recordToInsert.replayCount,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}
