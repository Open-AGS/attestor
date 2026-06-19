import { randomUUID } from 'node:crypto';
import type {
  BillingAccountStatus,
  BillingEventClaim,
  BillingEventListFilters,
  BillingEventOutcome,
  BillingEventRecord,
  BillingInvoiceStatus,
  BillingSubscriptionStatus,
} from './billing-event-ledger-types.js';
import {
  ensureSchema,
  getPool,
  isBillingEventLedgerConfigured,
} from './billing-event-ledger-storage.js';
import { payloadHash, rowToRecord } from './billing-event-ledger-mappers.js';

async function findExistingStripeEvent(providerEventId: string): Promise<BillingEventRecord | null> {
  await ensureSchema();
  const pool = await getPool();
  const result = await pool.query(
    `SELECT * FROM attestor_control_plane.billing_event_ledger
      WHERE provider = 'stripe' AND provider_event_id = $1
      LIMIT 1`,
    [providerEventId],
  );
  if (result.rows.length === 0) return null;
  return rowToRecord(result.rows[0]);
}

export async function claimStripeBillingEvent(input: {
  providerEventId: string;
  eventType: string;
  rawPayload: string;
}): Promise<BillingEventClaim> {
  await ensureSchema();
  const pool = await getPool();
  const requestPayloadHash = payloadHash(input.rawPayload);
  const claimId = `bill_evt_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const inserted = await pool.query(
    `INSERT INTO attestor_control_plane.billing_event_ledger (
      id,
      provider,
      source,
      provider_event_id,
      event_type,
      payload_hash,
      outcome,
      reason,
      account_id,
      tenant_id,
      stripe_checkout_session_id,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      stripe_invoice_id,
      stripe_invoice_status,
      stripe_invoice_currency,
      stripe_invoice_amount_paid,
      stripe_invoice_amount_due,
      account_status_before,
      account_status_after,
      billing_status_before,
      billing_status_after,
      mapped_plan_id,
      received_at,
      processed_at,
      metadata
    ) VALUES (
      $1,
      'stripe',
      'stripe_webhook',
      $2,
      $3,
      $4,
      'pending',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NOW(),
      NULL,
      '{}'::jsonb
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING *`,
    [claimId, input.providerEventId, input.eventType, requestPayloadHash],
  );
  if (inserted.rows.length > 0) {
    const record = rowToRecord(inserted.rows[0]);
    return { kind: 'claimed', payloadHash: requestPayloadHash, record };
  }

  const existing = await findExistingStripeEvent(input.providerEventId);
  if (!existing) {
    throw new Error(`Stripe billing ledger failed to read back event '${input.providerEventId}'.`);
  }
  if (existing.payloadHash !== requestPayloadHash) {
    return { kind: 'conflict', payloadHash: requestPayloadHash, record: existing };
  }
  return { kind: 'duplicate', payloadHash: requestPayloadHash, record: existing };
}

export async function finalizeStripeBillingEvent(input: {
  providerEventId: string;
  outcome: Exclude<BillingEventOutcome, 'pending'>;
  reason?: string | null;
  accountId?: string | null;
  tenantId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeInvoiceId?: string | null;
  stripeInvoiceStatus?: BillingInvoiceStatus;
  stripeInvoiceCurrency?: string | null;
  stripeInvoiceAmountPaid?: number | null;
  stripeInvoiceAmountDue?: number | null;
  accountStatusBefore?: BillingAccountStatus;
  accountStatusAfter?: BillingAccountStatus;
  billingStatusBefore?: BillingSubscriptionStatus;
  billingStatusAfter?: BillingSubscriptionStatus;
  mappedPlanId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<BillingEventRecord> {
  await ensureSchema();
  const pool = await getPool();
  const updated = await pool.query(
    `UPDATE attestor_control_plane.billing_event_ledger
        SET outcome = $2,
            reason = $3,
            account_id = $4,
            tenant_id = $5,
            stripe_checkout_session_id = $6,
            stripe_customer_id = $7,
            stripe_subscription_id = $8,
            stripe_price_id = $9,
            stripe_invoice_id = $10,
            stripe_invoice_status = $11,
            stripe_invoice_currency = $12,
            stripe_invoice_amount_paid = $13,
            stripe_invoice_amount_due = $14,
            account_status_before = $15,
            account_status_after = $16,
            billing_status_before = $17,
            billing_status_after = $18,
            mapped_plan_id = $19,
            processed_at = NOW(),
            metadata = $20::jsonb
      WHERE provider = 'stripe' AND provider_event_id = $1
      RETURNING *`,
    [
      input.providerEventId,
      input.outcome,
      input.reason ?? null,
      input.accountId ?? null,
      input.tenantId ?? null,
      input.stripeCheckoutSessionId ?? null,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.stripePriceId ?? null,
      input.stripeInvoiceId ?? null,
      input.stripeInvoiceStatus ?? null,
      input.stripeInvoiceCurrency ?? null,
      input.stripeInvoiceAmountPaid ?? null,
      input.stripeInvoiceAmountDue ?? null,
      input.accountStatusBefore ?? null,
      input.accountStatusAfter ?? null,
      input.billingStatusBefore ?? null,
      input.billingStatusAfter ?? null,
      input.mappedPlanId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  if (updated.rows.length === 0) {
    throw new Error(`Stripe billing ledger event '${input.providerEventId}' was not claimed before finalize.`);
  }
  return rowToRecord(updated.rows[0]);
}

export async function releaseStripeBillingEventClaim(providerEventId: string): Promise<void> {
  if (!isBillingEventLedgerConfigured()) return;
  await ensureSchema();
  const pool = await getPool();
  await pool.query(
    `DELETE FROM attestor_control_plane.billing_event_ledger
      WHERE provider = 'stripe' AND provider_event_id = $1 AND outcome = 'pending'`,
    [providerEventId],
  );
}

export async function listBillingEvents(filters: BillingEventListFilters = {}): Promise<BillingEventRecord[]> {
  await ensureSchema();
  const pool = await getPool();
  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.accountId) {
    where.push(`account_id = $${idx++}`);
    params.push(filters.accountId);
  }
  if (filters.tenantId) {
    where.push(`tenant_id = $${idx++}`);
    params.push(filters.tenantId);
  }
  if (filters.provider) {
    where.push(`provider = $${idx++}`);
    params.push(filters.provider);
  }
  if (filters.eventType) {
    where.push(`event_type = $${idx++}`);
    params.push(filters.eventType);
  }
  if (filters.outcome) {
    where.push(`outcome = $${idx++}`);
    params.push(filters.outcome);
  }

  const limit = Math.max(1, Math.min(500, filters.limit ?? 100));
  params.push(limit);
  const sql = `
    SELECT *
      FROM attestor_control_plane.billing_event_ledger
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY received_at DESC
      LIMIT $${idx}
  `;
  const result = await pool.query(sql, params);
  return result.rows.map(rowToRecord);
}
