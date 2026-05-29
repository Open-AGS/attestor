import { randomUUID } from 'node:crypto';
import {
  buildPipelineIdempotencyKeyDigest,
  buildPipelineIdempotencyRequestHash,
  decryptPipelineIdempotencyResponse,
  encryptPipelineIdempotencyResponse,
  ensurePipelineIdempotencyStorageReady,
  lookupPipelineIdempotency as lookupPipelineIdempotencyFile,
  pipelineIdempotencyCutoffIso,
  recordPipelineIdempotency as recordPipelineIdempotencyFile,
  type PipelineIdempotencyLookup,
  type PipelineIdempotencyRecord,
} from '../pipeline/pipeline-idempotency-store.js';
import {
  controlPlaneStoreSource,
  isSharedControlPlaneConfigured,
  withControlPlanePgTransaction,
} from './pg.js';
import {
  advisoryLockKey,
  rowToPipelineIdempotencyRecord,
} from './mappers.js';

export function ensurePipelineIdempotencyStateReady(): void {
  ensurePipelineIdempotencyStorageReady();
}

export async function lookupPipelineIdempotencyState(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
}): Promise<PipelineIdempotencyLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupPipelineIdempotencyFile(options);
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  return withControlPlanePgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.pipeline_idempotency
        WHERE created_at < $1::timestamptz`,
      [pipelineIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:pipeline_idempotency:${options.tenantId}:${idempotencyKeyDigest}`),
    ]);
    const result = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.pipeline_idempotency
        WHERE idempotency_key_digest = $1
        LIMIT 1`,
      [idempotencyKeyDigest],
    );
    const existing = result.rows[0] ? rowToPipelineIdempotencyRecord(result.rows[0]) : null;
    if (!existing) return { kind: 'miss', requestHash };
    if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
      return { kind: 'conflict', requestHash, record: existing };
    }
    const replayedRecord: PipelineIdempotencyRecord = {
      ...existing,
      lastReplayedAt: new Date().toISOString(),
      replayCount: existing.replayCount + 1,
    };
    await client.query(
      `UPDATE attestor_control_plane.pipeline_idempotency
          SET last_replayed_at = $2::timestamptz,
              replay_count = $3,
              record_json = $4::jsonb
        WHERE idempotency_key_digest = $1`,
      [
        idempotencyKeyDigest,
        replayedRecord.lastReplayedAt,
        replayedRecord.replayCount,
        JSON.stringify(replayedRecord),
      ],
    );
    return {
      kind: 'replay',
      requestHash,
      record: replayedRecord,
      response: decryptPipelineIdempotencyResponse(replayedRecord),
    };
  });
}

export async function recordPipelineIdempotencyState(options: {
  idempotencyKey: string;
  tenantId: string;
  routeId: string;
  requestPayload: unknown;
  statusCode: number;
  response: unknown;
}): Promise<{ record: PipelineIdempotencyRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordPipelineIdempotencyFile(options);
  const idempotencyKeyDigest = buildPipelineIdempotencyKeyDigest(options);
  const requestHash = buildPipelineIdempotencyRequestHash({
    tenantId: options.tenantId,
    routeId: options.routeId,
    payload: options.requestPayload,
  });
  const record = await withControlPlanePgTransaction(async (client) => {
    await client.query(
      `DELETE FROM attestor_control_plane.pipeline_idempotency
        WHERE created_at < $1::timestamptz`,
      [pipelineIdempotencyCutoffIso()],
    );
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:pipeline_idempotency:${options.tenantId}:${idempotencyKeyDigest}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.pipeline_idempotency
        WHERE idempotency_key_digest = $1
        LIMIT 1`,
      [idempotencyKeyDigest],
    );
    const existing = existingResult.rows[0] ? rowToPipelineIdempotencyRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.tenantId !== options.tenantId || existing.routeId !== options.routeId || existing.requestHash !== requestHash) {
        throw new Error('Idempotency-Key already exists for a different pipeline request');
      }
      return existing;
    }
    const encrypted = encryptPipelineIdempotencyResponse(options.response);
    const recordToInsert: PipelineIdempotencyRecord = {
      id: `pipe_idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      idempotencyKeyDigest,
      tenantId: options.tenantId,
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
      `INSERT INTO attestor_control_plane.pipeline_idempotency (
        idempotency_id, idempotency_key_digest, tenant_id, route_id, request_hash, status_code,
        response_ciphertext, response_iv, response_auth_tag,
        created_at, last_replayed_at, replay_count, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10::timestamptz, $11::timestamptz, $12, $13::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.idempotencyKeyDigest,
        recordToInsert.tenantId,
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
