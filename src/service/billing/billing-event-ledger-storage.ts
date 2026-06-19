type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

let poolPromise: Promise<PgPool> | null = null;
let initPromise: Promise<void> | null = null;

function connectionString(): string | null {
  const direct = process.env.ATTESTOR_BILLING_LEDGER_PG_URL?.trim();
  if (direct) return direct;
  return null;
}

export function billingEventLedgerMode(): 'postgres' | 'disabled' {
  return connectionString() ? 'postgres' : 'disabled';
}

export function isBillingEventLedgerConfigured(): boolean {
  return billingEventLedgerMode() === 'postgres';
}

export async function getPool(): Promise<PgPool> {
  const connectionUrl = connectionString();
  if (!connectionUrl) {
    throw new Error('Billing event ledger is disabled. Set ATTESTOR_BILLING_LEDGER_PG_URL.');
  }
  if (!poolPromise) {
    poolPromise = (async () => {
      const pg = await (Function('return import("pg")')() as Promise<any>);
      const Pool = pg.Pool ?? pg.default?.Pool;
      if (!Pool) {
        throw new Error('pg.Pool is not available for the billing event ledger.');
      }
      return new Pool({ connectionString: connectionUrl }) as PgPool;
    })();
  }
  return poolPromise;
}

export async function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const pool = await getPool();
      await pool.query(`
        CREATE SCHEMA IF NOT EXISTS attestor_control_plane;

        CREATE TABLE IF NOT EXISTS attestor_control_plane.billing_event_ledger (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          source TEXT NOT NULL,
          provider_event_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'applied', 'ignored')),
          reason TEXT NULL,
          account_id TEXT NULL,
          tenant_id TEXT NULL,
          stripe_checkout_session_id TEXT NULL,
          stripe_customer_id TEXT NULL,
          stripe_subscription_id TEXT NULL,
          stripe_price_id TEXT NULL,
          stripe_invoice_id TEXT NULL,
          stripe_invoice_status TEXT NULL,
          stripe_invoice_currency TEXT NULL,
          stripe_invoice_amount_paid BIGINT NULL,
          stripe_invoice_amount_due BIGINT NULL,
          account_status_before TEXT NULL,
          account_status_after TEXT NULL,
          billing_status_before TEXT NULL,
          billing_status_after TEXT NULL,
          mapped_plan_id TEXT NULL,
          received_at TIMESTAMPTZ NOT NULL,
          processed_at TIMESTAMPTZ NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE UNIQUE INDEX IF NOT EXISTS billing_event_ledger_provider_event_idx
          ON attestor_control_plane.billing_event_ledger (provider, provider_event_id);

        CREATE INDEX IF NOT EXISTS billing_event_ledger_account_idx
          ON attestor_control_plane.billing_event_ledger (account_id, received_at DESC);

        CREATE INDEX IF NOT EXISTS billing_event_ledger_tenant_idx
          ON attestor_control_plane.billing_event_ledger (tenant_id, received_at DESC);

        CREATE INDEX IF NOT EXISTS billing_event_ledger_received_idx
          ON attestor_control_plane.billing_event_ledger (received_at DESC);

        ALTER TABLE attestor_control_plane.billing_event_ledger
          ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT NULL,
          ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT NULL,
          ADD COLUMN IF NOT EXISTS stripe_invoice_status TEXT NULL,
          ADD COLUMN IF NOT EXISTS stripe_invoice_currency TEXT NULL,
          ADD COLUMN IF NOT EXISTS stripe_invoice_amount_paid BIGINT NULL,
          ADD COLUMN IF NOT EXISTS stripe_invoice_amount_due BIGINT NULL;

        CREATE TABLE IF NOT EXISTS attestor_control_plane.billing_invoice_line_items (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          account_id TEXT NULL,
          tenant_id TEXT NULL,
          stripe_customer_id TEXT NULL,
          stripe_subscription_id TEXT NULL,
          stripe_invoice_id TEXT NOT NULL,
          stripe_invoice_line_item_id TEXT NOT NULL,
          stripe_price_id TEXT NULL,
          description TEXT NULL,
          currency TEXT NULL,
          amount BIGINT NULL,
          subtotal BIGINT NULL,
          quantity BIGINT NULL,
          period_start TIMESTAMPTZ NULL,
          period_end TIMESTAMPTZ NULL,
          proration BOOLEAN NULL,
          source TEXT NOT NULL CHECK (source IN ('stripe_webhook', 'stripe_live_fetch')),
          capture_mode TEXT NOT NULL CHECK (capture_mode IN ('full', 'partial')),
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS billing_invoice_line_items_provider_line_idx
          ON attestor_control_plane.billing_invoice_line_items (provider, stripe_invoice_line_item_id);

        CREATE INDEX IF NOT EXISTS billing_invoice_line_items_invoice_idx
          ON attestor_control_plane.billing_invoice_line_items (stripe_invoice_id, updated_at DESC);

        CREATE INDEX IF NOT EXISTS billing_invoice_line_items_account_idx
          ON attestor_control_plane.billing_invoice_line_items (account_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.billing_charges (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          account_id TEXT NULL,
          tenant_id TEXT NULL,
          stripe_customer_id TEXT NULL,
          stripe_subscription_id TEXT NULL,
          stripe_invoice_id TEXT NULL,
          stripe_charge_id TEXT NOT NULL,
          stripe_payment_intent_id TEXT NULL,
          amount BIGINT NULL,
          amount_refunded BIGINT NULL,
          currency TEXT NULL,
          status TEXT NULL,
          paid BOOLEAN NULL,
          refunded BOOLEAN NULL,
          failure_code TEXT NULL,
          failure_message TEXT NULL,
          source TEXT NOT NULL CHECK (source IN ('stripe_webhook', 'stripe_live_fetch')),
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS billing_charges_provider_charge_idx
          ON attestor_control_plane.billing_charges (provider, stripe_charge_id);

        CREATE INDEX IF NOT EXISTS billing_charges_account_idx
          ON attestor_control_plane.billing_charges (account_id, updated_at DESC);

        CREATE INDEX IF NOT EXISTS billing_charges_invoice_idx
          ON attestor_control_plane.billing_charges (stripe_invoice_id, updated_at DESC);
      `);
    })();
  }
  await initPromise;
}

export async function resetBillingEventLedgerForTests(): Promise<void> {
  if (!isBillingEventLedgerConfigured()) {
    if (poolPromise) {
      const pool = await poolPromise;
      await pool.end();
    }
    poolPromise = null;
    initPromise = null;
    return;
  }

  const pool = await getPool();
  await pool.query('DROP SCHEMA IF EXISTS attestor_control_plane CASCADE');
  await pool.end();
  poolPromise = null;
  initPromise = null;
}
