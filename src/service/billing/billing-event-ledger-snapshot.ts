import type {
  BillingEventLedgerSnapshot,
  BillingEventRecord,
  BillingInvoiceLineItemRecord,
} from './billing-event-ledger-types.js';
import { ensureSchema, getPool } from './billing-event-ledger-storage.js';
import {
  rowToChargeRecord,
  rowToLineItemRecord,
  rowToRecord,
} from './billing-event-ledger-mappers.js';

export async function exportBillingEventLedgerSnapshot(): Promise<BillingEventLedgerSnapshot> {
  await ensureSchema();
  const pool = await getPool();
  const [eventResult, lineItemResult, chargeResult] = await Promise.all([
    pool.query(`
      SELECT *
        FROM attestor_control_plane.billing_event_ledger
        ORDER BY received_at ASC, provider_event_id ASC
    `),
    pool.query(`
      SELECT *
        FROM attestor_control_plane.billing_invoice_line_items
        ORDER BY updated_at ASC, stripe_invoice_id ASC, stripe_invoice_line_item_id ASC
    `),
    pool.query(`
      SELECT *
        FROM attestor_control_plane.billing_charges
        ORDER BY updated_at ASC, stripe_invoice_id ASC NULLS FIRST, stripe_charge_id ASC
    `),
  ]);
  const records = eventResult.rows.map(rowToRecord);
  const lineItems = lineItemResult.rows.map(rowToLineItemRecord);
  const charges = chargeResult.rows.map(rowToChargeRecord);
  return {
    version: 3,
    provider: 'stripe',
    exportedAt: new Date().toISOString(),
    eventRecordCount: records.length,
    lineItemRecordCount: lineItems.length,
    chargeRecordCount: charges.length,
    recordCount: records.length + lineItems.length + charges.length,
    records,
    lineItems,
    charges,
  };
}

export async function restoreBillingEventLedgerSnapshot(
  snapshot: BillingEventLedgerSnapshot | {
    version: 1;
    provider: 'stripe';
    exportedAt: string;
    recordCount: number;
    records: BillingEventRecord[];
  } | {
    version: 2;
    provider: 'stripe';
    exportedAt: string;
    eventRecordCount: number;
    lineItemRecordCount: number;
    recordCount: number;
    records: BillingEventRecord[];
    lineItems: BillingInvoiceLineItemRecord[];
  },
  options?: { replaceExisting?: boolean },
): Promise<{ recordCount: number }> {
  await ensureSchema();
  const pool = await getPool();
  if (options?.replaceExisting) {
    await pool.query(`
      TRUNCATE TABLE
        attestor_control_plane.billing_charges,
        attestor_control_plane.billing_invoice_line_items,
        attestor_control_plane.billing_event_ledger
    `);
  }

  for (const record of snapshot.records) {
    await pool.query(
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25::timestamptz, $26::timestamptz, $27::jsonb
      )
      ON CONFLICT (provider, provider_event_id) DO UPDATE SET
        id = EXCLUDED.id,
        source = EXCLUDED.source,
        event_type = EXCLUDED.event_type,
        payload_hash = EXCLUDED.payload_hash,
        outcome = EXCLUDED.outcome,
        reason = EXCLUDED.reason,
        account_id = EXCLUDED.account_id,
        tenant_id = EXCLUDED.tenant_id,
        stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_price_id = EXCLUDED.stripe_price_id,
        stripe_invoice_id = EXCLUDED.stripe_invoice_id,
        stripe_invoice_status = EXCLUDED.stripe_invoice_status,
        stripe_invoice_currency = EXCLUDED.stripe_invoice_currency,
        stripe_invoice_amount_paid = EXCLUDED.stripe_invoice_amount_paid,
        stripe_invoice_amount_due = EXCLUDED.stripe_invoice_amount_due,
        account_status_before = EXCLUDED.account_status_before,
        account_status_after = EXCLUDED.account_status_after,
        billing_status_before = EXCLUDED.billing_status_before,
        billing_status_after = EXCLUDED.billing_status_after,
        mapped_plan_id = EXCLUDED.mapped_plan_id,
        received_at = EXCLUDED.received_at,
        processed_at = EXCLUDED.processed_at,
        metadata = EXCLUDED.metadata`,
      [
        record.id,
        record.provider,
        record.source,
        record.providerEventId,
        record.eventType,
        record.payloadHash,
        record.outcome,
        record.reason,
        record.accountId,
        record.tenantId,
        record.stripeCheckoutSessionId,
        record.stripeCustomerId,
        record.stripeSubscriptionId,
        record.stripePriceId,
        record.stripeInvoiceId,
        record.stripeInvoiceStatus,
        record.stripeInvoiceCurrency,
        record.stripeInvoiceAmountPaid,
        record.stripeInvoiceAmountDue,
        record.accountStatusBefore,
        record.accountStatusAfter,
        record.billingStatusBefore,
        record.billingStatusAfter,
        record.mappedPlanId,
        record.receivedAt,
        record.processedAt,
        JSON.stringify(record.metadata ?? {}),
      ],
    );
  }

  const snapshotLineItems = 'lineItems' in snapshot ? snapshot.lineItems : [];
  for (const lineItem of snapshotLineItems) {
    await pool.query(
      `INSERT INTO attestor_control_plane.billing_invoice_line_items (
        id, provider, account_id, tenant_id, stripe_customer_id, stripe_subscription_id,
        stripe_invoice_id, stripe_invoice_line_item_id, stripe_price_id, description, currency,
        amount, subtotal, quantity, period_start, period_end, proration, source, capture_mode,
        metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15::timestamptz, $16::timestamptz, $17, $18, $19,
        $20::jsonb, $21::timestamptz, $22::timestamptz
      )
      ON CONFLICT (provider, stripe_invoice_line_item_id) DO UPDATE SET
        id = EXCLUDED.id,
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
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at`,
      [
        lineItem.id,
        lineItem.provider,
        lineItem.accountId,
        lineItem.tenantId,
        lineItem.stripeCustomerId,
        lineItem.stripeSubscriptionId,
        lineItem.stripeInvoiceId,
        lineItem.stripeInvoiceLineItemId,
        lineItem.stripePriceId,
        lineItem.description,
        lineItem.currency,
        lineItem.amount,
        lineItem.subtotal,
        lineItem.quantity,
        lineItem.periodStart,
        lineItem.periodEnd,
        lineItem.proration,
        lineItem.source,
        lineItem.captureMode,
        JSON.stringify(lineItem.metadata ?? {}),
        lineItem.createdAt,
        lineItem.updatedAt,
      ],
    );
  }

  const snapshotCharges = 'charges' in snapshot ? snapshot.charges : [];
  for (const charge of snapshotCharges) {
    await pool.query(
      `INSERT INTO attestor_control_plane.billing_charges (
        id, provider, account_id, tenant_id, stripe_customer_id, stripe_subscription_id,
        stripe_invoice_id, stripe_charge_id, stripe_payment_intent_id, amount, amount_refunded,
        currency, status, paid, refunded, failure_code, failure_message, source, metadata,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19::jsonb,
        $20::timestamptz, $21::timestamptz
      )
      ON CONFLICT (provider, stripe_charge_id) DO UPDATE SET
        id = EXCLUDED.id,
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
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at`,
      [
        charge.id,
        charge.provider,
        charge.accountId,
        charge.tenantId,
        charge.stripeCustomerId,
        charge.stripeSubscriptionId,
        charge.stripeInvoiceId,
        charge.stripeChargeId,
        charge.stripePaymentIntentId,
        charge.amount,
        charge.amountRefunded,
        charge.currency,
        charge.status,
        charge.paid,
        charge.refunded,
        charge.failureCode,
        charge.failureMessage,
        charge.source,
        JSON.stringify(charge.metadata ?? {}),
        charge.createdAt,
        charge.updatedAt,
      ],
    );
  }

  return { recordCount: snapshot.records.length + snapshotLineItems.length + snapshotCharges.length };
}
