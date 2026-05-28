export const HOSTED_WEBHOOK_ASYNC_RECONCILIATION_HARDENING_VERSION =
  'attestor.hosted-webhook-async-reconciliation-hardening.v1';

export type HostedWebhookAsyncReconciliationDomain =
  | 'stripe_webhook_ingress'
  | 'stripe_billing_convergence'
  | 'email_provider_webhook'
  | 'tenant_async_execution'
  | 'dead_letter_recovery';

export type HostedWebhookAsyncReconciliationControl =
  | 'raw_body_signature_verification'
  | 'supported_event_allowlist'
  | 'provider_event_dedupe'
  | 'payload_hash_conflict_rejection'
  | 'shared_store_required_in_ha'
  | 'provider_event_order_guard'
  | 'idempotent_finalization'
  | 'claim_release_on_failure'
  | 'entitlement_read_model_convergence'
  | 'privacy_minimized_observability'
  | 'tenant_quota_and_rate_limit'
  | 'tenant_queue_capacity_guard'
  | 'worker_retry_backoff_policy'
  | 'worker_stalled_job_limit'
  | 'tenant_execution_lease'
  | 'terminal_failure_dead_letter'
  | 'operator_retry_recovery';

export type HostedWebhookAsyncReconciliationRisk =
  | 'duplicate_delivery'
  | 'payload_replay'
  | 'payload_conflict'
  | 'delayed_delivery'
  | 'out_of_order_delivery'
  | 'partial_convergence'
  | 'worker_crash'
  | 'tenant_starvation'
  | 'unbounded_cost'
  | 'private_data_exposure';

export interface HostedWebhookAsyncReconciliationGuard {
  id: string;
  title: string;
  domain: HostedWebhookAsyncReconciliationDomain;
  surfaces: readonly string[];
  reconciliationRisks: readonly HostedWebhookAsyncReconciliationRisk[];
  requiredControls: readonly HostedWebhookAsyncReconciliationControl[];
  orderingBoundary: string;
  duplicateBoundary: string;
  failureBoundary: string;
  recoveryBoundary: string;
  privacyBoundary: string;
  implementationEvidence: readonly string[];
  validation: readonly string[];
  standards: readonly string[];
}

export const HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS: readonly HostedWebhookAsyncReconciliationGuard[] = [
  {
    id: 'stripe.webhook-ingress',
    title: 'Stripe Webhook Ingress',
    domain: 'stripe_webhook_ingress',
    surfaces: [
      'POST /api/v1/billing/stripe/webhook',
      'Stripe-Signature',
      'STRIPE_WEBHOOK_SECRET',
      'billing webhook dedupe store',
    ],
    reconciliationRisks: [
      'duplicate_delivery',
      'payload_replay',
      'payload_conflict',
      'delayed_delivery',
      'private_data_exposure',
    ],
    requiredControls: [
      'raw_body_signature_verification',
      'supported_event_allowlist',
      'provider_event_dedupe',
      'payload_hash_conflict_rejection',
      'shared_store_required_in_ha',
      'idempotent_finalization',
      'claim_release_on_failure',
      'privacy_minimized_observability',
    ],
    orderingBoundary:
      'Ingress authenticates the exact raw Stripe payload first, then hands a verified event to deterministic claim and finalization logic.',
    duplicateBoundary:
      'The same provider event id with the same payload hash returns a replay-safe 200; the same provider event id with a different payload hash returns conflict.',
    failureBoundary:
      'If downstream account or ledger mutation fails after claim acquisition, the claim is released so the event can be retried instead of being stranded.',
    recoveryBoundary:
      'Production HA uses shared billing ledger or shared control-plane webhook state; local file fallback remains single-node evaluation posture.',
    privacyBoundary:
      'Webhook observability records event id, event type, account/tenant refs, and outcome without raw payload bodies, payment details, keys, or webhook secrets.',
    implementationEvidence: [
      'src/service/http/routes/stripe-webhook-routes.ts',
      'src/service/application/stripe-webhook-service.ts',
      'src/service/application/stripe-webhook-billing-processor.ts',
      'src/service/billing/stripe/stripe-webhook-events.ts',
      'src/service/billing/billing-event-ledger.ts',
      'src/service/control-plane-store.ts',
    ],
    validation: [
      'tests/service-stripe-webhook-service.test.ts',
      'tests/service-stripe-webhook-billing-processor.test.ts',
      'tests/stripe-webhook-events.test.ts',
      'tests/stripe-webhook-support-hardening.test.ts',
      'tests/hosted-stripe-billing-convergence-flow.test.ts',
    ],
    standards: [
      'Stripe webhooks: verify signatures, handle duplicate events, and return 2xx only after accepting work.',
      'Stripe webhook signatures: use raw request body and protect against replay by verifying signed payloads.',
      'OWASP API4:2023 Unrestricted Resource Consumption: provider callbacks must be bounded and idempotent.',
    ],
  },
  {
    id: 'stripe.billing-convergence',
    title: 'Stripe Billing Convergence',
    domain: 'stripe_billing_convergence',
    surfaces: [
      'checkout.session.completed',
      'customer.subscription.*',
      'invoice.paid',
      'invoice.payment_failed',
      'charge.*',
      'entitlements.active_entitlement_summary.updated',
    ],
    reconciliationRisks: [
      'delayed_delivery',
      'out_of_order_delivery',
      'partial_convergence',
      'duplicate_delivery',
      'private_data_exposure',
    ],
    requiredControls: [
      'supported_event_allowlist',
      'provider_event_order_guard',
      'idempotent_finalization',
      'entitlement_read_model_convergence',
      'claim_release_on_failure',
      'privacy_minimized_observability',
    ],
    orderingBoundary:
      'Subscription and invoice projections store provider event creation time; older events in the same projection lane are finalized as ignored instead of overwriting fresher account state.',
    duplicateBoundary:
      'Distinct billing event ids may be processed once each, but stale provider-created timestamps cannot regress subscription, invoice, account, or entitlement state.',
    failureBoundary:
      'Account-store conflicts return deterministic conflict responses and release provider claims so retriable failures remain recoverable.',
    recoveryBoundary:
      'Billing ledger, entitlement read model, tenant plan sync, and audit records converge from signed provider events; unsupported or unmatched events finalize as ignored.',
    privacyBoundary:
      'Convergence evidence stores normalized status, amounts, ids, and low-cardinality metadata, not raw customer payloads or live secret material.',
    implementationEvidence: [
      'src/service/application/stripe-webhook-billing-processor.ts',
      'src/service/account/account-store.ts',
      'src/service/control-plane-store.ts',
      'src/service/billing/billing-entitlement-store.ts',
      'src/service/billing/billing-event-ledger.ts',
      'src/service/billing/billing-export.ts',
      'src/service/billing/billing-reconciliation.ts',
    ],
    validation: [
      'tests/service-stripe-webhook-billing-processor.test.ts',
      'tests/hosted-stripe-billing-convergence-flow.test.ts',
      'tests/billing-export-usage-summary.test.ts',
      'tests/service-admin-query-service.test.ts',
    ],
    standards: [
      'Stripe Billing: subscription state should be driven by Billing objects and signed webhook convergence.',
      'Stripe webhooks: event delivery can be retried and reordered, so handlers must be idempotent.',
      'OWASP API4:2023 Unrestricted Resource Consumption: repeated provider delivery must not multiply costly work.',
    ],
  },
  {
    id: 'email.provider-webhooks',
    title: 'Email Provider Webhooks',
    domain: 'email_provider_webhook',
    surfaces: [
      'POST /api/v1/email/sendgrid/webhook',
      'POST /api/v1/email/mailgun/webhook',
      'SendGrid signature headers',
      'Mailgun timestamp/token/signature',
    ],
    reconciliationRisks: [
      'duplicate_delivery',
      'payload_replay',
      'payload_conflict',
      'delayed_delivery',
      'private_data_exposure',
    ],
    requiredControls: [
      'raw_body_signature_verification',
      'provider_event_dedupe',
      'payload_hash_conflict_rejection',
      'shared_store_required_in_ha',
      'idempotent_finalization',
      'privacy_minimized_observability',
    ],
    orderingBoundary:
      'Email event state records provider event ids and occurrence timestamps as delivery evidence; it does not authorize customer account state changes.',
    duplicateBoundary:
      'SendGrid event ids and Mailgun event-data ids are mandatory; duplicate ids are counted deterministically and conflicting payload hashes are rejected.',
    failureBoundary:
      'Provider webhook ingest requires shared storage by default; local-only duplicate state is available only through an explicit single-node evaluation override.',
    recoveryBoundary:
      'Delivery summaries can be rebuilt from provider delivery event records while preserving provider event ids and low-cardinality outcomes.',
    privacyBoundary:
      'Provider bodies, recipient content, tokens, and raw signatures are not exposed; Mailgun replay tokens are stored as digests.',
    implementationEvidence: [
      'src/service/http/routes/email-webhook-routes.ts',
      'src/service/application/email-webhook-service.ts',
      'src/service/sendgrid-email-webhook.ts',
      'src/service/mailgun-email-webhook.ts',
      'src/service/webhook-rate-limit.ts',
      'src/service/async/email-delivery-event-store.ts',
      'src/service/control-plane-store.ts',
    ],
    validation: [
      'tests/service-email-webhook-service.test.ts',
      'tests/service-email-webhook-signature-verifiers.test.ts',
      'tests/service-webhook-route-rate-limit.test.ts',
      'tests/email-delivery-event-store-hardening.test.ts',
      'tests/service-route-boundary.test.ts',
    ],
    standards: [
      'Stripe webhooks: preserve raw request bodies, verify signatures, and reject replayed payloads outside the freshness window.',
      'Twilio SendGrid signed event webhooks: verify ECDSA signatures over timestamp plus raw payload bytes.',
      'Mailgun webhooks: verify timestamp plus token using the account HTTP webhook signing key and SHA-256 HMAC.',
      'OWASP API4:2023 Unrestricted Resource Consumption: external callbacks must be deduped, rate-limited, and bounded.',
      'OWASP API6:2023 Sensitive Business Flows: provider delivery automation cannot bypass replay and duplicate controls.',
    ],
  },
  {
    id: 'async.tenant-execution',
    title: 'Tenant Async Execution',
    domain: 'tenant_async_execution',
    surfaces: [
      'POST /api/v1/pipeline/run-async',
      'GET /api/v1/pipeline/jobs/:jobId',
      'BullMQ pipeline worker',
      'tenant async runtime',
    ],
    reconciliationRisks: [
      'worker_crash',
      'tenant_starvation',
      'unbounded_cost',
      'partial_convergence',
      'private_data_exposure',
    ],
    requiredControls: [
      'tenant_quota_and_rate_limit',
      'tenant_queue_capacity_guard',
      'worker_retry_backoff_policy',
      'worker_stalled_job_limit',
      'tenant_execution_lease',
      'privacy_minimized_observability',
    ],
    orderingBoundary:
      'Async jobs are tenant-scoped by job id, queue snapshot, status lookup, active-execution lease, and weighted dispatch permit.',
    duplicateBoundary:
      'Tenant quota and rate reservations happen before queue admission; async status reads require the job tenant to match the current tenant.',
    failureBoundary:
      'BullMQ attempts, backoff, stalled-job limit, Redis readiness, and graceful worker drain make worker retries explicit instead of accidental.',
    recoveryBoundary:
      'Failed or exhausted jobs are surfaced through terminal dead-letter records and can be retried through controlled admin recovery.',
    privacyBoundary:
      'Queue, worker, and status evidence uses tenant ids, job ids, status, attempts, and error class without raw prompts or private payload bodies.',
    implementationEvidence: [
      'src/service/http/routes/pipeline-async-routes.ts',
      'src/service/async/async-pipeline.ts',
      'src/service/async/worker.ts',
      'src/service/application/pipeline-usage-service.ts',
      'src/service/rate-limit.ts',
    ],
    validation: [
      'tests/service-pipeline-usage-service.test.ts',
      'tests/service-route-boundary.test.ts',
      'tests/hosted-api-authorization-matrix.test.ts',
    ],
    standards: [
      'BullMQ retry guidance: failed jobs should use explicit attempts and backoff.',
      'BullMQ stalled job guidance: crashed or stalled workers need bounded recovery behavior.',
      'OWASP API4:2023 Unrestricted Resource Consumption: async admission must be quota and rate bounded.',
    ],
  },
  {
    id: 'async.dead-letter-recovery',
    title: 'Dead Letter Recovery',
    domain: 'dead_letter_recovery',
    surfaces: [
      'async dead-letter store',
      'admin dead-letter list',
      'admin dead-letter retry',
      'pipeline worker failed handler',
    ],
    reconciliationRisks: [
      'worker_crash',
      'partial_convergence',
      'delayed_delivery',
      'duplicate_delivery',
      'private_data_exposure',
    ],
    requiredControls: [
      'terminal_failure_dead_letter',
      'operator_retry_recovery',
      'idempotent_finalization',
      'tenant_execution_lease',
      'privacy_minimized_observability',
    ],
    orderingBoundary:
      'Dead-letter records are terminal evidence of failed async work, not a second execution lane; retry re-enters the normal queue policy.',
    duplicateBoundary:
      'Retry removes the dead-letter record only after BullMQ accepts the retry path, preventing silent duplicate or lost recovery state.',
    failureBoundary:
      'Worker failed handlers persist terminal failure records with attempt counts, timestamps, and error summaries.',
    recoveryBoundary:
      'Operator recovery has explicit list, filter, and retry semantics so failed async work is visible and bounded.',
    privacyBoundary:
      'Dead-letter records keep operational failure context and avoid storing raw customer prompts, provider payloads, credentials, or private thresholds.',
    implementationEvidence: [
      'src/service/async/async-dead-letter-store.ts',
      'src/service/application/pipeline-dead-letter-service.ts',
      'src/service/http/routes/pipeline-async-routes.ts',
      'src/service/http/routes/admin-routes.ts',
      'src/service/async/async-pipeline.ts',
      'src/service/control-plane-store.ts',
    ],
    validation: [
      'tests/service-pipeline-dead-letter-service.test.ts',
      'tests/production-rehearsal-async-recovery.test.ts',
      'tests/service-route-boundary.test.ts',
    ],
    standards: [
      'BullMQ retry guidance: failed job recovery should re-enter explicit retry controls.',
      'OWASP API4:2023 Unrestricted Resource Consumption: recovery paths must not multiply execution cost silently.',
    ],
  },
] as const;

export function hostedWebhookAsyncReconciliationHardeningProfile(): {
  version: string;
  posture: string;
  unresolvedProductionDependency: string;
  guards: readonly HostedWebhookAsyncReconciliationGuard[];
} {
  return {
    version: HOSTED_WEBHOOK_ASYNC_RECONCILIATION_HARDENING_VERSION,
    posture:
      'Webhook and async reconciliation is explicit across signature verification, duplicate handling, provider event ordering, idempotent finalization, claim release, retry policy, DLQ recovery, and privacy-minimized evidence.',
    unresolvedProductionDependency:
      'Final production rollout still requires deployment env, restart, Stripe readiness probe, webhook smoke test, and hosted product smoke test on a working deployment target.',
    guards: HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS,
  };
}

export function requireHostedWebhookAsyncReconciliationGuard(
  id: string,
): HostedWebhookAsyncReconciliationGuard {
  const guard = HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS.find((entry) => entry.id === id);
  if (!guard) {
    throw new Error(`Hosted webhook/async reconciliation guard '${id}' was not found.`);
  }
  return guard;
}
