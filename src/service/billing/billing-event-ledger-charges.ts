import { randomUUID } from 'node:crypto';
import type {
  BillingChargeInput,
  BillingChargeListFilters,
  BillingChargeRecord,
  BillingChargeSource,
} from './billing-event-ledger-types.js';
import { ensureSchema, getPool } from './billing-event-ledger-storage.js';
import { rowToChargeRecord } from './billing-event-ledger-mappers.js';

export async function upsertStripeCharges(input: {
  accountId: string | null;
  tenantId: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  charges: BillingChargeInput[];
  source: BillingChargeSource;
}): Promise<{ recordCount: number }> {
  await ensureSchema();
  const pool = await getPool();
  let recordCount = 0;

  for (const charge of input.charges) {
    if (!charge.stripeChargeId?.trim()) continue;
    const now = new Date().toISOString();
    const createdAt = charge.createdAt ?? now;
    const chargeId = `bill_charge_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await pool.query(
      `INSERT INTO attestor_control_plane.billing_charges (
        id, provider, account_id, tenant_id, stripe_customer_id, stripe_subscription_id,
        stripe_invoice_id, stripe_charge_id, stripe_payment_intent_id, amount, amount_refunded,
        currency, status, paid, refunded, failure_code, failure_message, source, metadata,
        created_at, updated_at
      ) VALUES (
        $1, 'stripe', $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18::jsonb,
        $19::timestamptz, $20::timestamptz
      )
      ON CONFLICT (provider, stripe_charge_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        tenant_id = EXCLUDED.tenant_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_invoice_id = EXCLUDED.stripe_invoice_id,
        stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
        amount = EXCLUDED.amount,
        amount_refunded = EXCLUDED.amount_refunded,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        paid = EXCLUDED.paid,
        refunded = EXCLUDED.refunded,
        failure_code = EXCLUDED.failure_code,
        failure_message = EXCLUDED.failure_message,
        source = EXCLUDED.source,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at`,
      [
        chargeId,
        input.accountId,
        input.tenantId,
        input.stripeCustomerId ?? null,
        input.stripeSubscriptionId ?? null,
        charge.stripeInvoiceId ?? null,
        charge.stripeChargeId,
        charge.stripePaymentIntentId ?? null,
        charge.amount ?? null,
        charge.amountRefunded ?? null,
        charge.currency ?? null,
        charge.status ?? null,
        charge.paid ?? null,
        charge.refunded ?? null,
        charge.failureCode ?? null,
        charge.failureMessage ?? null,
        input.source,
        JSON.stringify(charge.metadata ?? {}),
        createdAt,
        now,
      ],
    );
    recordCount += 1;
  }

  return { recordCount };
}

export async function listBillingCharges(
  filters: BillingChargeListFilters = {},
): Promise<BillingChargeRecord[]> {
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
  if (filters.stripeInvoiceId) {
    where.push(`stripe_invoice_id = $${idx++}`);
    params.push(filters.stripeInvoiceId);
  }

  const limit = Math.max(1, Math.min(5_000, filters.limit ?? 500));
  params.push(limit);
  const sql = `
    SELECT *
      FROM attestor_control_plane.billing_charges
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, stripe_charge_id ASC
      LIMIT $${idx}
  `;
  const result = await pool.query(sql, params);
  return result.rows.map(rowToChargeRecord);
}
