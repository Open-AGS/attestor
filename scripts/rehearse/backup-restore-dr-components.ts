export const COMPONENT_TABLES: Readonly<Record<string, string>> = Object.freeze({
  account_store: 'hosted_accounts',
  account_user_store: 'account_users',
  account_session_store: 'account_sessions',
  account_user_action_token_store: 'account_user_action_tokens',
  tenant_key_store: 'tenant_api_keys',
  usage_ledger: 'usage_ledger',
  billing_entitlement_store: 'billing_entitlements',
  async_dead_letter_store: 'async_dead_letter_jobs',
  admin_audit_log: 'admin_audit_log',
  admin_idempotency_store: 'admin_idempotency',
  stripe_webhook_store: 'stripe_webhook_dedupe',
});
