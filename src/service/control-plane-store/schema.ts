export const CONTROL_PLANE_SCHEMA_SQL = `
        CREATE SCHEMA IF NOT EXISTS attestor_control_plane;

        CREATE TABLE IF NOT EXISTS attestor_control_plane.hosted_accounts (
          account_id TEXT PRIMARY KEY,
          primary_tenant_id TEXT NOT NULL UNIQUE,
          account_status TEXT NOT NULL CHECK (account_status IN ('active', 'suspended', 'archived')),
          stripe_customer_id TEXT NULL,
          stripe_subscription_id TEXT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS hosted_accounts_stripe_customer_uidx
          ON attestor_control_plane.hosted_accounts (stripe_customer_id)
          WHERE stripe_customer_id IS NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS hosted_accounts_stripe_subscription_uidx
          ON attestor_control_plane.hosted_accounts (stripe_subscription_id)
          WHERE stripe_subscription_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS hosted_accounts_updated_idx
          ON attestor_control_plane.hosted_accounts (updated_at DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.tenant_api_keys (
          key_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          tenant_name TEXT NOT NULL,
          plan_id TEXT NULL,
          monthly_run_quota INTEGER NULL,
          api_key_hash TEXT NOT NULL UNIQUE,
          api_key_preview TEXT NOT NULL,
          key_status TEXT NOT NULL CHECK (key_status IN ('active', 'inactive', 'revoked')),
          created_at TIMESTAMPTZ NOT NULL,
          last_used_at TIMESTAMPTZ NULL,
          deactivated_at TIMESTAMPTZ NULL,
          revoked_at TIMESTAMPTZ NULL,
          rotated_from_key_id TEXT NULL,
          superseded_by_key_id TEXT NULL,
          superseded_at TIMESTAMPTZ NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_status_created_idx
          ON attestor_control_plane.tenant_api_keys (tenant_id, key_status, created_at DESC);

        CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_created_idx
          ON attestor_control_plane.tenant_api_keys (tenant_id, created_at ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.usage_ledger (
          tenant_id TEXT NOT NULL,
          period TEXT NOT NULL,
          used INTEGER NOT NULL CHECK (used >= 0),
          updated_at TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (tenant_id, period)
        );

        CREATE INDEX IF NOT EXISTS usage_ledger_period_used_idx
          ON attestor_control_plane.usage_ledger (period DESC, used DESC, tenant_id ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.account_users (
          account_user_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES attestor_control_plane.hosted_accounts(account_id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          role_id TEXT NOT NULL CHECK (role_id IN ('account_admin', 'billing_admin', 'read_only')),
          user_status TEXT NOT NULL CHECK (user_status IN ('active', 'inactive')),
          updated_at TIMESTAMPTZ NOT NULL,
          last_login_at TIMESTAMPTZ NULL,
          record_json JSONB NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS account_users_email_uidx
          ON attestor_control_plane.account_users (email);

        CREATE INDEX IF NOT EXISTS account_users_account_updated_idx
          ON attestor_control_plane.account_users (account_id, updated_at DESC, account_user_id ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.account_sessions (
          session_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES attestor_control_plane.hosted_accounts(account_id) ON DELETE CASCADE,
          account_user_id TEXT NOT NULL REFERENCES attestor_control_plane.account_users(account_user_id) ON DELETE CASCADE,
          role_id TEXT NOT NULL CHECK (role_id IN ('account_admin', 'billing_admin', 'read_only')),
          token_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ NULL,
          record_json JSONB NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS account_sessions_token_hash_uidx
          ON attestor_control_plane.account_sessions (token_hash);

        CREATE INDEX IF NOT EXISTS account_sessions_account_seen_idx
          ON attestor_control_plane.account_sessions (account_id, last_seen_at DESC, session_id ASC);

        CREATE INDEX IF NOT EXISTS account_sessions_user_seen_idx
          ON attestor_control_plane.account_sessions (account_user_id, last_seen_at DESC, session_id ASC);

        CREATE INDEX IF NOT EXISTS account_sessions_expiry_idx
          ON attestor_control_plane.account_sessions (expires_at ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.account_user_action_tokens (
          token_id TEXT PRIMARY KEY,
          purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'password_reset', 'mfa_login', 'passkey_registration', 'passkey_authentication')),
          account_id TEXT NOT NULL REFERENCES attestor_control_plane.hosted_accounts(account_id) ON DELETE CASCADE,
          account_user_id TEXT NULL REFERENCES attestor_control_plane.account_users(account_user_id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          role_id TEXT NULL CHECK (role_id IN ('account_admin', 'billing_admin', 'read_only')),
          token_hash TEXT NOT NULL UNIQUE,
          updated_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          consumed_at TIMESTAMPTZ NULL,
          revoked_at TIMESTAMPTZ NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS account_user_action_tokens_account_purpose_updated_idx
          ON attestor_control_plane.account_user_action_tokens (account_id, purpose, updated_at DESC, token_id ASC);

        CREATE INDEX IF NOT EXISTS account_user_action_tokens_user_purpose_updated_idx
          ON attestor_control_plane.account_user_action_tokens (account_user_id, purpose, updated_at DESC, token_id ASC);

        CREATE INDEX IF NOT EXISTS account_user_action_tokens_email_purpose_updated_idx
          ON attestor_control_plane.account_user_action_tokens (email, purpose, updated_at DESC, token_id ASC);

        ALTER TABLE attestor_control_plane.account_user_action_tokens
          DROP CONSTRAINT IF EXISTS account_user_action_tokens_purpose_check;

        ALTER TABLE attestor_control_plane.account_user_action_tokens
          ADD CONSTRAINT account_user_action_tokens_purpose_check
          CHECK (purpose IN ('invite', 'password_reset', 'mfa_login', 'passkey_registration', 'passkey_authentication'));

        CREATE TABLE IF NOT EXISTS attestor_control_plane.account_saml_replays (
          request_id TEXT PRIMARY KEY,
          response_id TEXT NULL,
          issuer TEXT NOT NULL,
          subject TEXT NOT NULL,
          consumed_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS account_saml_replays_expiry_idx
          ON attestor_control_plane.account_saml_replays (expires_at ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.billing_entitlements (
          account_id TEXT PRIMARY KEY REFERENCES attestor_control_plane.hosted_accounts(account_id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL,
          provider TEXT NOT NULL CHECK (provider IN ('manual', 'stripe')),
          entitlement_status TEXT NOT NULL CHECK (
            entitlement_status IN (
              'provisioned',
              'checkout_completed',
              'active',
              'trialing',
              'delinquent',
              'suspended',
              'archived'
            )
          ),
          access_enabled BOOLEAN NOT NULL,
          effective_plan_id TEXT NULL,
          last_event_id TEXT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS billing_entitlements_tenant_updated_idx
          ON attestor_control_plane.billing_entitlements (tenant_id, updated_at DESC, account_id ASC);

        CREATE INDEX IF NOT EXISTS billing_entitlements_status_updated_idx
          ON attestor_control_plane.billing_entitlements (entitlement_status, updated_at DESC, account_id ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.workflow_entitlements (
          workflow_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES attestor_control_plane.hosted_accounts(account_id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL,
          tier_id TEXT NOT NULL CHECK (tier_id IN ('pilot-workflow', 'starter-workflow', 'pro-workflow')),
          entitlement_status TEXT NOT NULL CHECK (
            entitlement_status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')
          ),
          stripe_subscription_id TEXT NULL,
          stripe_subscription_item_id TEXT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS workflow_entitlements_stripe_item_uidx
          ON attestor_control_plane.workflow_entitlements (stripe_subscription_item_id)
          WHERE stripe_subscription_item_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS workflow_entitlements_account_updated_idx
          ON attestor_control_plane.workflow_entitlements (account_id, updated_at DESC, workflow_id ASC);

        CREATE INDEX IF NOT EXISTS workflow_entitlements_tenant_updated_idx
          ON attestor_control_plane.workflow_entitlements (tenant_id, updated_at DESC, workflow_id ASC);

        CREATE INDEX IF NOT EXISTS workflow_entitlements_status_updated_idx
          ON attestor_control_plane.workflow_entitlements (entitlement_status, updated_at DESC, workflow_id ASC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.admin_audit_log (
          audit_id TEXT PRIMARY KEY,
          occurred_at TIMESTAMPTZ NOT NULL,
          actor_type TEXT NOT NULL,
          action TEXT NOT NULL,
          account_id TEXT NULL,
          tenant_id TEXT NULL,
          previous_hash TEXT NULL,
          event_hash TEXT NOT NULL UNIQUE,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS admin_audit_log_occurred_idx
          ON attestor_control_plane.admin_audit_log (occurred_at DESC, audit_id DESC);

        CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
          ON attestor_control_plane.admin_audit_log (action, occurred_at DESC);

        CREATE INDEX IF NOT EXISTS admin_audit_log_account_idx
          ON attestor_control_plane.admin_audit_log (account_id, occurred_at DESC);

        CREATE INDEX IF NOT EXISTS admin_audit_log_tenant_idx
          ON attestor_control_plane.admin_audit_log (tenant_id, occurred_at DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.admin_idempotency (
          idempotency_id TEXT PRIMARY KEY,
          idempotency_key TEXT NOT NULL UNIQUE,
          route_id TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_ciphertext TEXT NOT NULL,
          response_iv TEXT NOT NULL,
          response_auth_tag TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          last_replayed_at TIMESTAMPTZ NULL,
          replay_count INTEGER NOT NULL CHECK (replay_count >= 0),
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS admin_idempotency_created_idx
          ON attestor_control_plane.admin_idempotency (created_at DESC);

        CREATE INDEX IF NOT EXISTS admin_idempotency_route_idx
          ON attestor_control_plane.admin_idempotency (route_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.pipeline_idempotency (
          idempotency_id TEXT PRIMARY KEY,
          idempotency_key_digest TEXT NOT NULL UNIQUE,
          tenant_id TEXT NOT NULL,
          route_id TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_ciphertext TEXT NOT NULL,
          response_iv TEXT NOT NULL,
          response_auth_tag TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          last_replayed_at TIMESTAMPTZ NULL,
          replay_count INTEGER NOT NULL CHECK (replay_count >= 0),
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS pipeline_idempotency_created_idx
          ON attestor_control_plane.pipeline_idempotency (created_at DESC);

        CREATE INDEX IF NOT EXISTS pipeline_idempotency_tenant_route_idx
          ON attestor_control_plane.pipeline_idempotency (tenant_id, route_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.stripe_webhook_dedupe (
          webhook_record_id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL UNIQUE,
          event_type TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          account_id TEXT NULL,
          stripe_customer_id TEXT NULL,
          stripe_subscription_id TEXT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'applied', 'ignored')),
          reason TEXT NULL,
          received_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS stripe_webhook_dedupe_received_idx
          ON attestor_control_plane.stripe_webhook_dedupe (received_at DESC, webhook_record_id DESC);

        CREATE INDEX IF NOT EXISTS stripe_webhook_dedupe_account_idx
          ON attestor_control_plane.stripe_webhook_dedupe (account_id, received_at DESC);

        ALTER TABLE attestor_control_plane.stripe_webhook_dedupe
          DROP CONSTRAINT IF EXISTS stripe_webhook_dedupe_outcome_check;

        ALTER TABLE attestor_control_plane.stripe_webhook_dedupe
          ADD CONSTRAINT stripe_webhook_dedupe_outcome_check
          CHECK (outcome IN ('pending', 'applied', 'ignored'));

        CREATE TABLE IF NOT EXISTS attestor_control_plane.email_delivery_events (
          email_event_id TEXT PRIMARY KEY,
          delivery_id TEXT NOT NULL,
          account_id TEXT NULL,
          account_user_id TEXT NULL,
          purpose TEXT NULL,
          provider TEXT NOT NULL,
          channel TEXT NOT NULL,
          recipient TEXT NOT NULL,
          message_id TEXT NULL,
          provider_message_id TEXT NULL,
          provider_event_id TEXT NULL,
          event_type TEXT NOT NULL,
          status_hint TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          recorded_at TIMESTAMPTZ NOT NULL,
          payload_hash TEXT NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_events_provider_event_uidx
          ON attestor_control_plane.email_delivery_events (provider, provider_event_id)
          WHERE provider_event_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS email_delivery_events_delivery_idx
          ON attestor_control_plane.email_delivery_events (delivery_id, occurred_at DESC, email_event_id DESC);

        CREATE INDEX IF NOT EXISTS email_delivery_events_account_idx
          ON attestor_control_plane.email_delivery_events (account_id, recorded_at DESC, email_event_id DESC);

        CREATE INDEX IF NOT EXISTS email_delivery_events_account_user_idx
          ON attestor_control_plane.email_delivery_events (account_user_id, recorded_at DESC, email_event_id DESC);

        CREATE TABLE IF NOT EXISTS attestor_control_plane.async_dead_letter_jobs (
          job_id TEXT PRIMARY KEY,
          backend_mode TEXT NOT NULL CHECK (backend_mode IN ('bullmq', 'in_process')),
          tenant_id TEXT NULL,
          plan_id TEXT NULL,
          state TEXT NOT NULL,
          failed_reason TEXT NULL,
          attempts_made INTEGER NOT NULL CHECK (attempts_made >= 0),
          max_attempts INTEGER NOT NULL CHECK (max_attempts >= 1),
          requested_at TIMESTAMPTZ NULL,
          submitted_at TIMESTAMPTZ NULL,
          processed_at TIMESTAMPTZ NULL,
          failed_at TIMESTAMPTZ NULL,
          recorded_at TIMESTAMPTZ NOT NULL,
          record_json JSONB NOT NULL
        );

        CREATE INDEX IF NOT EXISTS async_dead_letter_jobs_failed_idx
          ON attestor_control_plane.async_dead_letter_jobs (failed_at DESC NULLS LAST, recorded_at DESC, job_id ASC);

        CREATE INDEX IF NOT EXISTS async_dead_letter_jobs_tenant_idx
          ON attestor_control_plane.async_dead_letter_jobs (tenant_id, failed_at DESC NULLS LAST, recorded_at DESC);

        CREATE INDEX IF NOT EXISTS async_dead_letter_jobs_backend_idx
          ON attestor_control_plane.async_dead_letter_jobs (backend_mode, failed_at DESC NULLS LAST, recorded_at DESC);` as const;
