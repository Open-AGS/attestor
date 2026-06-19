import { randomUUID } from 'node:crypto';
import type {
  BillingInvoiceLineItemCaptureMode,
  BillingInvoiceLineItemInput,
  BillingInvoiceLineItemListFilters,
  BillingInvoiceLineItemRecord,
  BillingInvoiceLineItemSource,
} from './billing-event-ledger-types.js';
import { ensureSchema, getPool } from './billing-event-ledger-storage.js';
import { rowToLineItemRecord } from './billing-event-ledger-mappers.js';

export async function upsertStripeInvoiceLineItems(input: {
  accountId: string | null;
  tenantId: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId: string;
  lineItems: BillingInvoiceLineItemInput[];
  source: BillingInvoiceLineItemSource;
  captureMode: BillingInvoiceLineItemCaptureMode;
  replaceExisting?: boolean;
}): Promise<{ recordCount: number }> {
  await ensureSchema();
  const pool = await getPool();
  if (input.replaceExisting) {
    await pool.query(
      `DELETE FROM attestor_control_plane.billing_invoice_line_items
        WHERE provider = 'stripe' AND stripe_invoice_id = $1`,
      [input.stripeInvoiceId],
    );
  }

  let recordCount = 0;
  for (const lineItem of input.lineItems) {
    if (!lineItem.stripeInvoiceLineItemId?.trim()) continue;
    const now = new Date().toISOString();
    const lineId = `bill_line_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    await pool.query(
      `INSERT INTO attestor_control_plane.billing_invoice_line_items (
        id, provider, account_id, tenant_id, stripe_customer_id, stripe_subscription_id,
        stripe_invoice_id, stripe_invoice_line_item_id, stripe_price_id, description, currency,
        amount, subtotal, quantity, period_start, period_end, proration, source, capture_mode,
        metadata, created_at, updated_at
      ) VALUES (
        $1, 'stripe', $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14::timestamptz, $15::timestamptz, $16, $17, $18,
        $19::jsonb, $20::timestamptz, $21::timestamptz
      )
      ON CONFLICT (provider, stripe_invoice_line_item_id) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        tenant_id = EXCLUDED.tenant_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_invoice_id = EXCLUDED.stripe_invoice_id,
        stripe_price_id = EXCLUDED.stripe_price_id,
        description = EXCLUDED.description,
        currency = EXCLUDED.currency,
        amount = EXCLUDED.amount,
        subtotal = EXCLUDED.subtotal,
        quantity = EXCLUDED.quantity,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        proration = EXCLUDED.proration,
        source = EXCLUDED.source,
        capture_mode = EXCLUDED.capture_mode,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at`,
      [
        lineId,
        input.accountId,
        input.tenantId,
        input.stripeCustomerId ?? null,
        input.stripeSubscriptionId ?? null,
        input.stripeInvoiceId,
        lineItem.stripeInvoiceLineItemId,
        lineItem.stripePriceId ?? null,
        lineItem.description ?? null,
        lineItem.currency ?? null,
        lineItem.amount ?? null,
        lineItem.subtotal ?? null,
        lineItem.quantity ?? null,
        lineItem.periodStart ?? null,
        lineItem.periodEnd ?? null,
        lineItem.proration ?? null,
        input.source,
        input.captureMode,
        JSON.stringify(lineItem.metadata ?? {}),
        now,
        now,
      ],
    );
    recordCount += 1;
  }

  return { recordCount };
}

export async function listBillingInvoiceLineItems(
  filters: BillingInvoiceLineItemListFilters = {},
): Promise<BillingInvoiceLineItemRecord[]> {
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
      FROM attestor_control_plane.billing_invoice_line_items
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, stripe_invoice_line_item_id ASC
      LIMIT $${idx}
  `;
  const result = await pool.query(sql, params);
  return result.rows.map(rowToLineItemRecord);
}
