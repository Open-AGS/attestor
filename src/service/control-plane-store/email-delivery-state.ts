import { randomUUID } from 'node:crypto';
import {
  buildHostedEmailDispatchEventRecord,
  buildHostedEmailProviderEventRecord,
  exportHostedEmailDeliveryEventStoreSnapshot as exportHostedEmailDeliveryEventStoreSnapshotFile,
  filterHostedEmailDeliverySummaries,
  hostedEmailProviderReplayDigest,
  listHostedEmailDeliveries as listHostedEmailDeliveriesFile,
  normalizeStatus as normalizeHostedEmailDeliveryStatus,
  recordHostedEmailDispatchEvent as recordHostedEmailDispatchEventFile,
  recordHostedEmailProviderEvent as recordHostedEmailProviderEventFile,
  restoreHostedEmailDeliveryEventStoreSnapshot as restoreHostedEmailDeliveryEventStoreSnapshotFile,
  summarizeHostedEmailDeliveryEvents,
  type HostedEmailDeliveryEventRecord,
  type HostedEmailDeliveryProvider,
  type HostedEmailDeliveryEventStoreSnapshot,
  type HostedEmailDeliverySummaryRecord,
  type ListHostedEmailDeliveryFilters,
  type RecordHostedEmailDispatchEventInput,
  type RecordHostedEmailProviderEventInput,
} from '../async/email-delivery-event-store.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema,
  getControlPlanePgPool,
  isSharedControlPlaneConfigured,
  type PgClient,
  type PgPool,
  withControlPlanePgTransaction,
} from './pg.js';
import {
  advisoryLockKey,
  coerceHostedEmailDeliveryEventRecord,
  compareIso,
  rowToHostedEmailDeliveryEventRecord,
} from './mappers.js';

export interface EmailDeliveryEventStoreSnapshot extends HostedEmailDeliveryEventStoreSnapshot {}

async function listHostedEmailDeliveryEventRecordsPg(filters?: {
  deliveryId?: string | null;
  accountId?: string | null;
  accountUserId?: string | null;
  provider?: HostedEmailDeliveryProvider | null;
  rawLimit?: number | null;
}): Promise<HostedEmailDeliveryEventRecord[]> {
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters?.deliveryId) {
    params.push(filters.deliveryId);
    clauses.push(`delivery_id = $${params.length}`);
  }
  if (filters?.accountId) {
    params.push(filters.accountId);
    clauses.push(`account_id = $${params.length}`);
  }
  if (filters?.accountUserId) {
    params.push(filters.accountUserId);
    clauses.push(`account_user_id = $${params.length}`);
  }
  if (filters?.provider) {
    params.push(filters.provider);
    clauses.push(`provider = $${params.length}`);
  }
  const rawLimit = Math.max(100, Math.min(5000, filters?.rawLimit ?? 2000));
  params.push(rawLimit);
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.email_delivery_events
      ${clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC, email_event_id DESC
      LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(rowToHostedEmailDeliveryEventRecord);
}

async function insertHostedEmailDeliveryEventPg(
  record: HostedEmailDeliveryEventRecord,
  executor?: PgPool | PgClient,
): Promise<void> {
  await ensureControlPlanePgSchema();
  const target = executor ?? await getControlPlanePgPool();
  await target.query(
    `INSERT INTO attestor_control_plane.email_delivery_events (
      email_event_id, delivery_id, account_id, account_user_id, purpose, provider, channel,
      recipient, message_id, provider_message_id, provider_event_id, event_type, status_hint,
      occurred_at, recorded_at, payload_hash, record_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14::timestamptz, $15::timestamptz, $16, $17::jsonb
    )`,
    [
      record.id,
      record.deliveryId,
      record.accountId,
      record.accountUserId,
      record.purpose,
      record.provider,
      record.channel,
      record.recipient,
      record.messageId,
      record.providerMessageId,
      record.providerEventId,
      record.eventType,
      normalizeHostedEmailDeliveryStatus(record.statusHint),
      record.occurredAt,
      record.recordedAt,
      record.payloadHash,
      JSON.stringify(record),
    ],
  );
}

export async function recordHostedEmailDispatchEventState(
  input: RecordHostedEmailDispatchEventInput,
): Promise<{ record: HostedEmailDeliveryEventRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordHostedEmailDispatchEventFile(input);
  const fileRecord = buildHostedEmailDispatchEventRecord(input);
  const record = {
    ...fileRecord,
    id: `email_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
  };
  await insertHostedEmailDeliveryEventPg(record);
  return { record, path: controlPlaneStoreSource() };
}

export async function recordHostedEmailProviderEventState(
  input: RecordHostedEmailProviderEventInput,
): Promise<{
  kind: 'recorded' | 'duplicate' | 'conflict';
  record: HostedEmailDeliveryEventRecord;
  path: string | null;
}> {
  if (!isSharedControlPlaneConfigured()) {
    const result = recordHostedEmailProviderEventFile(input);
    return { ...result, path: result.path };
  }
  const builtRecord = buildHostedEmailProviderEventRecord(input);
  if (!builtRecord.providerEventId) {
    throw new Error('Hosted email provider events require a providerEventId for replay-safe idempotency.');
  }
  const replayDigest = hostedEmailProviderReplayDigest(builtRecord);

  return withControlPlanePgTransaction(async (client) => {
    const lockKeys = [
      `attestor_control_plane:email_delivery:${builtRecord.provider}:${builtRecord.providerEventId}`,
      replayDigest
        ? `attestor_control_plane:email_delivery_replay:${builtRecord.provider}:${replayDigest}`
        : null,
    ].filter((value): value is string => value !== null).sort();
    for (const lockKey of lockKeys) {
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [advisoryLockKey(lockKey)]);
    }
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.email_delivery_events
        WHERE provider = $1
          AND (
            provider_event_id = $2
            OR ($3::text IS NOT NULL AND record_json->'metadata'->>'mailgunSignatureTokenDigest' = $3)
          )
        LIMIT 1`,
      [builtRecord.provider, builtRecord.providerEventId, replayDigest],
    );
    const existing = existingResult.rows[0] ? rowToHostedEmailDeliveryEventRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== builtRecord.payloadHash) {
        return { kind: 'conflict', record: existing, path: controlPlaneStoreSource() } as const;
      }
      return { kind: 'duplicate', record: existing, path: controlPlaneStoreSource() } as const;
    }
    const record = {
      ...builtRecord,
      id: `email_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    };
    await insertHostedEmailDeliveryEventPg(record, client);
    return { kind: 'recorded', record, path: controlPlaneStoreSource() } as const;
  });
}

export async function listHostedEmailDeliveriesState(
  filters?: ListHostedEmailDeliveryFilters,
): Promise<{ records: HostedEmailDeliverySummaryRecord[]; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    const result = listHostedEmailDeliveriesFile(filters);
    return { records: result.records, path: result.path };
  }
  const raw = await listHostedEmailDeliveryEventRecordsPg({
    deliveryId: filters?.deliveryId ?? null,
    accountId: filters?.accountId ?? null,
    accountUserId: filters?.accountUserId ?? null,
    provider: filters?.provider ?? null,
    rawLimit: Math.max(500, Math.min(5000, (filters?.limit ?? 100) * 20)),
  });
  return {
    records: filterHostedEmailDeliverySummaries(summarizeHostedEmailDeliveryEvents(raw), filters),
    path: controlPlaneStoreSource(),
  };
}

export async function exportHostedEmailDeliveryEventStoreSnapshot(): Promise<EmailDeliveryEventStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    return exportHostedEmailDeliveryEventStoreSnapshotFile();
  }
  const records = await listHostedEmailDeliveryEventRecordsPg({ rawLimit: 5000 });
  const chronological = [...records].sort((left, right) => {
    const byOccurred = compareIso(left.occurredAt, right.occurredAt);
    if (byOccurred !== 0) return byOccurred;
    return left.id > right.id ? 1 : -1;
  });
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: chronological.length,
    records: chronological,
  };
}

export async function restoreHostedEmailDeliveryEventStoreSnapshot(
  snapshot: EmailDeliveryEventStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    const restored = restoreHostedEmailDeliveryEventStoreSnapshotFile(snapshot);
    return { recordCount: restored.recordCount };
  }
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.email_delivery_events');
  }
  for (const record of snapshot.records) {
    await insertHostedEmailDeliveryEventPg(coerceHostedEmailDeliveryEventRecord(record));
  }
  return { recordCount: snapshot.records.length };
}
