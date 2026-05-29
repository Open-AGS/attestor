import { randomUUID } from 'node:crypto';
import {
  lookupProcessedStripeWebhook as lookupProcessedStripeWebhookFile,
  recordProcessedStripeWebhook as recordProcessedStripeWebhookFile,
  readStripeWebhookStoreSnapshot,
  type StripeWebhookLookup,
  type StripeWebhookRecord,
} from '../billing/stripe/stripe-webhook-store.js';
import { hashJsonValue } from '../json-stable.js';
import {
  controlPlaneStoreSource,
  ensureControlPlanePgSchema,
  getControlPlanePgPool,
  isSharedControlPlaneConfigured,
  type PgClient,
  withControlPlanePgTransaction,
} from './pg.js';
import { advisoryLockKey, rowToStripeWebhookRecord } from './mappers.js';

export interface StripeWebhookStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: StripeWebhookRecord[];
}

type StripeWebhookClaimLease = {
  client: PgClient;
  advisoryLockKey: string;
  eventId: string;
};

const stripeWebhookClaimLeases = new Map<string, StripeWebhookClaimLease>();

export type StripeWebhookClaimState =
  | { kind: 'claimed'; payloadHash: string; record: StripeWebhookRecord; claimId: string }
  | { kind: 'duplicate'; payloadHash: string; record: StripeWebhookRecord }
  | { kind: 'conflict'; payloadHash: string; record: StripeWebhookRecord };

async function releaseStripeWebhookPgClaimLease(claimId: string): Promise<void> {
  const lease = stripeWebhookClaimLeases.get(claimId);
  if (!lease) return;
  stripeWebhookClaimLeases.delete(claimId);
  try {
    await lease.client.query('SELECT pg_advisory_unlock($1::bigint)', [lease.advisoryLockKey]);
  } finally {
    lease.client.release();
  }
}

export async function lookupProcessedStripeWebhookState(
  eventId: string,
  rawPayload: string,
): Promise<StripeWebhookLookup> {
  if (!isSharedControlPlaneConfigured()) return lookupProcessedStripeWebhookFile(eventId, rawPayload);
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const requestHash = hashJsonValue({ payload: rawPayload });
  const result = await pool.query(
    `SELECT record_json
       FROM attestor_control_plane.stripe_webhook_dedupe
      WHERE event_id = $1
      LIMIT 1`,
    [eventId],
  );
  const existing = result.rows[0] ? rowToStripeWebhookRecord(result.rows[0]) : null;
  if (!existing) return { kind: 'miss', payloadHash: requestHash };
  if (existing.payloadHash !== requestHash) {
    return { kind: 'conflict', payloadHash: requestHash, record: existing };
  }
  return { kind: 'duplicate', payloadHash: requestHash, record: existing };
}

export async function claimProcessedStripeWebhookState(input: {
  eventId: string;
  eventType: string;
  rawPayload: string;
}): Promise<StripeWebhookClaimState> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook claims.');
  }
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const client = await pool.connect();
  const requestHash = hashJsonValue({ payload: input.rawPayload });
  const lockKey = advisoryLockKey(`attestor_control_plane:stripe_webhook:${input.eventId}`);
  let keepLease = false;
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [lockKey]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== requestHash) {
        return { kind: 'conflict', payloadHash: requestHash, record: existing };
      }
      if (existing.outcome !== 'pending') {
        return { kind: 'duplicate', payloadHash: requestHash, record: existing };
      }
      await client.query(
        `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
          WHERE event_id = $1 AND outcome = 'pending'`,
        [input.eventId],
      );
    }

    const record: StripeWebhookRecord = {
      id: `stripe_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: requestHash,
      accountId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      outcome: 'pending',
      reason: null,
      receivedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )`,
      [
        record.id,
        record.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        record.receivedAt,
        JSON.stringify(record),
      ],
    );

    const claimId = `stripe_claim_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    stripeWebhookClaimLeases.set(claimId, {
      client,
      advisoryLockKey: lockKey,
      eventId: input.eventId,
    });
    keepLease = true;
    return { kind: 'claimed', payloadHash: requestHash, record, claimId };
  } finally {
    if (!keepLease) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [lockKey]);
      } catch {
        // best-effort unlock before connection release
      }
      client.release();
    }
  }
}

export async function finalizeProcessedStripeWebhookState(input: {
  claimId: string;
  eventId: string;
  eventType: string;
  accountId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  outcome: Exclude<StripeWebhookRecord['outcome'], 'pending'>;
  reason: string | null;
  rawPayload: string;
}): Promise<{ record: StripeWebhookRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook finalize.');
  }
  const lease = stripeWebhookClaimLeases.get(input.claimId);
  if (!lease || lease.eventId !== input.eventId) {
    throw new Error(`Stripe webhook claim '${input.claimId}' is missing or does not match event '${input.eventId}'.`);
  }

  const requestHash = hashJsonValue({ payload: input.rawPayload });
  let finalized = false;
  try {
    const existingResult = await lease.client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (!existing) {
      throw new Error(`Stripe webhook event '${input.eventId}' was not claimed before finalize.`);
    }
    if (existing.payloadHash !== requestHash) {
      throw new Error(`Stripe event '${input.eventId}' was claimed with a different payload hash.`);
    }

    const record: StripeWebhookRecord = {
      ...existing,
      eventType: input.eventType,
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      outcome: input.outcome,
      reason: input.reason,
    };
    await lease.client.query(
      `UPDATE attestor_control_plane.stripe_webhook_dedupe
          SET event_type = $2,
              payload_hash = $3,
              account_id = $4,
              stripe_customer_id = $5,
              stripe_subscription_id = $6,
              outcome = $7,
              reason = $8,
              record_json = $9::jsonb
        WHERE event_id = $1`,
      [
        input.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        JSON.stringify(record),
      ],
    );
    finalized = true;
    return { record, path: controlPlaneStoreSource() };
  } finally {
    if (!finalized) {
      try {
        await lease.client.query(
          `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
            WHERE event_id = $1 AND outcome = 'pending'`,
          [input.eventId],
        );
      } catch {
        // best-effort cleanup before releasing the advisory lock
      }
    }
    await releaseStripeWebhookPgClaimLease(input.claimId);
  }
}

export async function releaseProcessedStripeWebhookClaimState(
  eventId: string,
  claimId: string,
): Promise<void> {
  if (!isSharedControlPlaneConfigured()) return;
  const lease = stripeWebhookClaimLeases.get(claimId);
  if (!lease) return;
  try {
    await lease.client.query(
      `DELETE FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1 AND outcome = 'pending'`,
      [eventId],
    );
  } finally {
    await releaseStripeWebhookPgClaimLease(claimId);
  }
}

export async function recordProcessedStripeWebhookState(
  input: Omit<StripeWebhookRecord, 'id' | 'receivedAt' | 'payloadHash'> & { rawPayload: string },
): Promise<{ record: StripeWebhookRecord; path: string | null }> {
  if (!isSharedControlPlaneConfigured()) return recordProcessedStripeWebhookFile(input);
  const requestHash = hashJsonValue({ payload: input.rawPayload });
  const record = await withControlPlanePgTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      advisoryLockKey(`attestor_control_plane:stripe_webhook:${input.eventId}`),
    ]);
    const existingResult = await client.query(
      `SELECT record_json
         FROM attestor_control_plane.stripe_webhook_dedupe
        WHERE event_id = $1
        LIMIT 1`,
      [input.eventId],
    );
    const existing = existingResult.rows[0] ? rowToStripeWebhookRecord(existingResult.rows[0]) : null;
    if (existing) {
      if (existing.payloadHash !== requestHash) {
        throw new Error(`Stripe event '${input.eventId}' was already recorded with a different payload hash.`);
      }
      return existing;
    }
    const recordToInsert: StripeWebhookRecord = {
      id: `stripe_evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: requestHash,
      accountId: input.accountId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      outcome: input.outcome,
      reason: input.reason,
      receivedAt: new Date().toISOString(),
    };
    await client.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )`,
      [
        recordToInsert.id,
        recordToInsert.eventId,
        recordToInsert.eventType,
        recordToInsert.payloadHash,
        recordToInsert.accountId,
        recordToInsert.stripeCustomerId,
        recordToInsert.stripeSubscriptionId,
        recordToInsert.outcome,
        recordToInsert.reason,
        recordToInsert.receivedAt,
        JSON.stringify(recordToInsert),
      ],
    );
    return recordToInsert;
  });
  return { record, path: controlPlaneStoreSource() };
}

export async function exportStripeWebhookStoreSnapshot(): Promise<StripeWebhookStoreSnapshot> {
  if (!isSharedControlPlaneConfigured()) {
    const { records } = readStripeWebhookStoreSnapshot();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    };
  }
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  const result = await pool.query(`
    SELECT record_json
      FROM attestor_control_plane.stripe_webhook_dedupe
      ORDER BY received_at ASC, webhook_record_id ASC
  `);
  const records = result.rows.map(rowToStripeWebhookRecord);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
  };
}

export async function restoreStripeWebhookStoreSnapshot(
  snapshot: StripeWebhookStoreSnapshot,
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  if (!isSharedControlPlaneConfigured()) {
    throw new Error('Shared control-plane PostgreSQL is not configured for Stripe webhook dedupe restore.');
  }
  await ensureControlPlanePgSchema();
  const pool = await getControlPlanePgPool();
  if (options?.replaceExisting) {
    await pool.query('TRUNCATE TABLE attestor_control_plane.stripe_webhook_dedupe');
  }
  for (const record of snapshot.records) {
    await pool.query(
      `INSERT INTO attestor_control_plane.stripe_webhook_dedupe (
        webhook_record_id, event_id, event_type, payload_hash, account_id, stripe_customer_id,
        stripe_subscription_id, outcome, reason, received_at, record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10::timestamptz, $11::jsonb
      )
      ON CONFLICT (webhook_record_id) DO UPDATE SET
        event_id = EXCLUDED.event_id,
        event_type = EXCLUDED.event_type,
        payload_hash = EXCLUDED.payload_hash,
        account_id = EXCLUDED.account_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        outcome = EXCLUDED.outcome,
        reason = EXCLUDED.reason,
        received_at = EXCLUDED.received_at,
        record_json = EXCLUDED.record_json`,
      [
        record.id,
        record.eventId,
        record.eventType,
        record.payloadHash,
        record.accountId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.outcome,
        record.reason,
        record.receivedAt,
        JSON.stringify(record),
      ],
    );
  }
  return { recordCount: snapshot.records.length };
}

export async function releaseAllStripeWebhookClaimLeasesForTests(): Promise<void> {
  if (stripeWebhookClaimLeases.size === 0) return;
  await Promise.all([...stripeWebhookClaimLeases.keys()].map((claimId) => releaseStripeWebhookPgClaimLease(claimId)));
}
