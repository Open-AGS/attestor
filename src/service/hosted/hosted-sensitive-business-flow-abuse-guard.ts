import type {
  HostedApiRouteDescriptor,
} from './hosted-api-authorization-matrix.js';

export type HostedSensitiveBusinessFlowControl =
  | 'account_or_tenant_context'
  | 'account_session_role_gate'
  | 'account_admin_role_gate'
  | 'billing_admin_role_gate'
  | 'shared_auth_abuse_budget'
  | 'action_token_or_provider_state'
  | 'required_idempotency_key'
  | 'stripe_sdk_idempotency_key'
  | 'stripe_hosted_handoff'
  | 'tenant_quota_check'
  | 'tenant_rate_limit_reservation'
  | 'active_key_limit'
  | 'one_time_plaintext_secret_delivery'
  | 'admin_mutation_idempotency'
  | 'admin_audit_hash_chain'
  | 'provider_signature_verification'
  | 'provider_event_dedupe'
  | 'release_token_consume'
  | 'privacy_minimized_response';

export type HostedSensitiveBusinessFlowRisk =
  | 'credential_stuffing'
  | 'challenge_flooding'
  | 'bootstrap_race'
  | 'role_confusion'
  | 'secret_sprawl'
  | 'checkout_replay'
  | 'portal_session_farming'
  | 'cost_exhaustion'
  | 'admin_retry_replay'
  | 'provider_event_replay'
  | 'release_token_replay';

export interface HostedSensitiveBusinessFlowRoute extends HostedApiRouteDescriptor {
  readonly authorizationRuleId: string;
}

export interface HostedSensitiveBusinessFlowAbuseGuard {
  readonly id: string;
  readonly title: string;
  readonly routes: readonly HostedSensitiveBusinessFlowRoute[];
  readonly automationRisks: readonly HostedSensitiveBusinessFlowRisk[];
  readonly requiredControls: readonly HostedSensitiveBusinessFlowControl[];
  readonly replayBoundary: string;
  readonly costBoundary: string;
  readonly privacyBoundary: string;
  readonly implementationEvidence: readonly string[];
  readonly validation: readonly string[];
  readonly standards: readonly string[];
}

export const HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARD_VERSION =
  'attestor.hosted-sensitive-business-flow-abuse-guard.v1';

export const HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS = [
  {
    id: 'auth.credential-challenges',
    title: 'Customer auth and provider-login challenge issuance',
    routes: [
      { method: 'POST', path: '/api/v1/auth/signup', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/login', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/passkeys/options', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/passkeys/verify', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/saml/login', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/saml/acs', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/oidc/login', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'GET', path: '/api/v1/auth/oidc/callback', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/mfa/verify', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/auth/password/reset', authorizationRuleId: 'auth.public-credential-challenge' },
      { method: 'POST', path: '/api/v1/account/users/invites/accept', authorizationRuleId: 'auth.public-credential-challenge' },
    ],
    automationRisks: ['credential_stuffing', 'challenge_flooding'],
    requiredControls: [
      'shared_auth_abuse_budget',
      'action_token_or_provider_state',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Password reset, invite, MFA, SAML, OIDC, and passkey callbacks consume action-token, provider-state, replay, or challenge material instead of trusting repeated client retries.',
    costBoundary:
      'Challenge issuance and credential attempts share email/source abuse budgets; HA runtimes require a shared Redis auth-abuse backend.',
    privacyBoundary:
      'Credential input, provider assertions, action tokens, and passkey material stay inside service boundaries and are never emitted as telemetry or public proof.',
    implementationEvidence: [
      'src/service/account/auth-abuse-guard.ts',
      'src/service/http/routes/account-federated-auth-routes.ts#maybeRateLimitAuthAttempt',
      'src/service/http/routes/account-federated-auth-routes.ts#recordHostedSamlReplay',
      'src/service/http/routes/account-mfa-passkey-routes.ts#maybeRateLimitAuthAttempt',
      'src/service/account/account-oidc.ts',
      'src/service/account/account-saml.ts',
    ],
    validation: [
      'tests/account-auth-abuse-guard.test.ts',
      'tests/account-auth-abuse-guard-shared.test.ts',
      'tests/account-mfa-replay.test.ts',
    ],
    standards: ['OWASP API2:2023', 'OWASP API4:2023', 'OWASP API6:2023'],
  },
  {
    id: 'account.first-user-bootstrap',
    title: 'First hosted account user bootstrap',
    routes: [
      { method: 'POST', path: '/api/v1/account/users/bootstrap', authorizationRuleId: 'account.users.bootstrap' },
    ],
    automationRisks: ['bootstrap_race', 'role_confusion'],
    requiredControls: [
      'account_or_tenant_context',
      'account_admin_role_gate',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Bootstrap is not an anonymous account creation path; it is bound to the resolved hosted account or tenant context and the service enforces the first-user boundary.',
    costBoundary:
      'Bootstrap does not create billable provider work and stays limited to account control-plane state.',
    privacyBoundary:
      'The response returns the created account user view, not password material or tenant credentials.',
    implementationEvidence: [
      'src/service/http/routes/account-public-auth-routes.ts#currentHostedAccount',
      'src/service/application/account-auth-service.ts#bootstrapFirstUser',
    ],
    validation: [
      'tests/hosted-signup-first-api-key-flow.test.ts',
      'tests/service-account-auth-service.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023', 'OWASP API6:2023'],
  },
  {
    id: 'account.api-key-lifecycle',
    title: 'Hosted tenant API-key issue, rotate, status, and revoke',
    routes: [
      { method: 'POST', path: '/api/v1/account/api-keys', authorizationRuleId: 'account.api-key.lifecycle' },
      { method: 'POST', path: '/api/v1/account/api-keys/:id/rotate', authorizationRuleId: 'account.api-key.lifecycle' },
      { method: 'POST', path: '/api/v1/account/api-keys/:id/deactivate', authorizationRuleId: 'account.api-key.lifecycle' },
      { method: 'POST', path: '/api/v1/account/api-keys/:id/reactivate', authorizationRuleId: 'account.api-key.lifecycle' },
      { method: 'POST', path: '/api/v1/account/api-keys/:id/revoke', authorizationRuleId: 'account.api-key.lifecycle' },
    ],
    automationRisks: ['secret_sprawl', 'role_confusion'],
    requiredControls: [
      'account_session_role_gate',
      'account_admin_role_gate',
      'active_key_limit',
      'one_time_plaintext_secret_delivery',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'The service scopes each path id to the current account tenant key set; repeated issue/rotate attempts are bounded by the tenant key store policy and conflict behavior.',
    costBoundary:
      'API-key lifecycle changes sync entitlement state but do not create direct provider billing events.',
    privacyBoundary:
      'Plaintext tenant API keys are returned only on issue or rotate responses; historical reads use redacted key views.',
    implementationEvidence: [
      'src/service/http/routes/account-admin-user-routes.ts#apiKeyService',
      'src/service/application/account-api-key-service.ts#tenantKeyStorePolicy',
      'src/service/tenant-key-store.ts',
    ],
    validation: [
      'tests/account-auth-key-boundaries.test.ts',
      'tests/service-account-api-key-service.test.ts',
      'tests/tenant-admin-secret-output.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023', 'OWASP API5:2023'],
  },
  {
    id: 'billing.workflow-checkout',
    title: 'Stripe Checkout workflow entitlement upgrade',
    routes: [
      { method: 'POST', path: '/api/v1/account/billing/workflows/checkout', authorizationRuleId: 'account.billing.workflow-checkout' },
    ],
    automationRisks: ['checkout_replay', 'role_confusion'],
    requiredControls: [
      'account_session_role_gate',
      'billing_admin_role_gate',
      'required_idempotency_key',
      'stripe_sdk_idempotency_key',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'The workflow checkout route requires Idempotency-Key and passes it to Stripe Checkout session creation so customer retry semantics do not mint divergent paid workflow sessions.',
    costBoundary:
      'Checkout can only target catalog-backed workflow tiers and does not become entitlement truth until signed Stripe webhooks converge workflow state.',
    privacyBoundary:
      'The response exposes hosted Stripe handoff references, workflow ids, tier ids, and digests only; secret keys, payment details, raw downstream system refs, and webhook secrets stay out of responses.',
    implementationEvidence: [
      'src/service/http/routes/account-billing-routes.ts#workflow_checkout',
      'src/service/billing/stripe/stripe-billing.ts#createHostedWorkflowCheckoutSession',
    ],
    validation: [
      'tests/hosted-stripe-billing-convergence-flow.test.ts',
      'tests/stripe-commercial-config.test.ts',
    ],
    standards: ['OWASP API4:2023', 'OWASP API6:2023', 'Stripe idempotent requests'],
  },
  {
    id: 'billing.portal-handoff',
    title: 'Stripe Customer Portal handoff',
    routes: [
      { method: 'POST', path: '/api/v1/account/billing/portal', authorizationRuleId: 'account.billing.portal' },
    ],
    automationRisks: ['portal_session_farming', 'role_confusion'],
    requiredControls: [
      'account_session_role_gate',
      'billing_admin_role_gate',
      'stripe_hosted_handoff',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Portal sessions are short-lived Stripe-hosted handoff references for accounts that already have a Stripe customer id; portal mutations converge through Stripe webhooks.',
    costBoundary:
      'Portal creation does not directly change plan state inside Attestor; subscription effects are accepted only from signed Stripe events.',
    privacyBoundary:
      'The route returns the portal URL and session id only, not invoices, payment methods, or raw Stripe customer details.',
    implementationEvidence: [
      'src/service/http/routes/account-billing-routes.ts#createHostedBillingPortalSession',
      'src/service/billing/stripe/stripe-billing.ts#createHostedBillingPortalSession',
    ],
    validation: [
      'tests/hosted-stripe-billing-convergence-flow.test.ts',
      'tests/stripe-commercial-config.test.ts',
    ],
    standards: ['OWASP API5:2023', 'OWASP API6:2023', 'Stripe Customer Portal'],
  },
  {
    id: 'tenant.expensive-runtime-execution',
    title: 'Tenant pipeline, admission, and async execution',
    routes: [
      { method: 'POST', path: '/api/v1/admissions', authorizationRuleId: 'tenant.admission.action-authorization' },
      { method: 'POST', path: '/api/v1/pipeline/run', authorizationRuleId: 'tenant.pipeline.execution' },
      { method: 'POST', path: '/api/v1/pipeline/run-async', authorizationRuleId: 'tenant.pipeline.execution' },
    ],
    automationRisks: ['cost_exhaustion', 'role_confusion'],
    requiredControls: [
      'account_or_tenant_context',
      'tenant_quota_check',
      'tenant_rate_limit_reservation',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Execution is bound to tenant context; async status is separately job-owner checked by the hosted authorization matrix.',
    costBoundary:
      'Monthly quota and rate-limit reservation are checked before expensive synchronous or async pipeline work is accepted.',
    privacyBoundary:
      'Runtime responses expose decision/proof summaries and usage context rather than provider credentials or raw private payloads.',
    implementationEvidence: [
      'src/service/http/routes/generic-admission-routes.ts',
      'src/service/http/routes/pipeline-execution-routes.ts#reserveTenantPipelineRequest',
      'src/service/http/routes/pipeline-async-routes.ts#pipelineUsageService',
      'src/service/rate-limit.ts',
    ],
    validation: [
      'tests/generic-admission-routes.test.ts',
      'tests/service-pipeline-usage-service.test.ts',
      'tests/hosted-api-authorization-matrix.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API4:2023', 'OWASP API6:2023'],
  },
  {
    id: 'admin.operator-mutations',
    title: 'Operator admin mutation surface',
    routes: [
      { method: 'POST', path: '/api/v1/admin/accounts', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/accounts/:id/suspend', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/tenant-keys', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/tenant-keys/:id/rotate', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/queue/jobs/:id/retry', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/release-reviews/:id/approve', authorizationRuleId: 'admin.operator.mutation' },
      { method: 'POST', path: '/api/v1/admin/release-policy/activations', authorizationRuleId: 'admin.operator.mutation' },
    ],
    automationRisks: ['admin_retry_replay', 'role_confusion', 'secret_sprawl'],
    requiredControls: [
      'admin_mutation_idempotency',
      'admin_audit_hash_chain',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Admin mutation services hash request payloads, replay matching idempotency keys, reject conflicting reuse, and append an audited mutation record.',
    costBoundary:
      'Operator-triggered retries and lifecycle changes are explicit admin actions, not anonymous or account-plane automation.',
    privacyBoundary:
      'Admin audit stores hashed request material and scoped identifiers instead of raw secrets or customer payloads.',
    implementationEvidence: [
      'src/service/http/routes/admin-account-mutation-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-tenant-key-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-queue-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-release-enforcement-routes.ts#beginAdminMutation',
      'src/service/bootstrap/http-route-builders.ts#adminMutationRequest',
      'src/service/application/admin-mutation-service.ts',
      'src/service/admin-audit-log.ts',
    ],
    validation: [
      'tests/service-admin-mutation-service.test.ts',
      'tests/service-route-boundary.test.ts',
      'tests/hosted-api-authorization-matrix.test.ts',
    ],
    standards: ['OWASP API5:2023', 'OWASP API6:2023', 'NIST SSDF PW.8'],
  },
  {
    id: 'webhook.provider-convergence',
    title: 'Signed provider event convergence',
    routes: [
      { method: 'POST', path: '/api/v1/billing/stripe/webhook', authorizationRuleId: 'webhook.stripe.billing' },
      { method: 'POST', path: '/api/v1/email/sendgrid/webhook', authorizationRuleId: 'webhook.email.provider' },
      { method: 'POST', path: '/api/v1/email/mailgun/webhook', authorizationRuleId: 'webhook.email.provider' },
    ],
    automationRisks: ['provider_event_replay'],
    requiredControls: [
      'provider_signature_verification',
      'provider_event_dedupe',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Provider events are signature-verified, payload-hashed, and deduped before billing or email-delivery state is converged.',
    costBoundary:
      'Provider webhooks are reconciliation inputs, not customer-triggered billing or delivery commands.',
    privacyBoundary:
      'Webhook secrets are never emitted and provider bodies are normalized before persistence or customer-visible export.',
    implementationEvidence: [
      'src/service/http/routes/stripe-webhook-routes.ts',
      'src/service/application/stripe-webhook-service.ts',
      'src/service/http/routes/email-webhook-routes.ts',
      'src/service/application/email-webhook-service.ts',
    ],
    validation: [
      'tests/service-stripe-webhook-service.test.ts',
      'tests/service-email-webhook-service.test.ts',
      'tests/stripe-webhook-events.test.ts',
    ],
    standards: ['OWASP API2:2023', 'OWASP API3:2023', 'OWASP API6:2023'],
  },
  {
    id: 'release.filing-export',
    title: 'Release-bound filing export',
    routes: [
      { method: 'POST', path: '/api/v1/filing/export', authorizationRuleId: 'tenant.filing.release-bound-export' },
    ],
    automationRisks: ['release_token_replay', 'role_confusion'],
    requiredControls: [
      'account_or_tenant_context',
      'release_token_consume',
      'privacy_minimized_response',
    ],
    replayBoundary:
      'Filing export verifies a release token with target binding and consumes it on successful use before package generation.',
    costBoundary:
      'Filing export is release-gated work and cannot be triggered by tenant API key alone.',
    privacyBoundary:
      'The release response references package and decision material, not unrestricted private source payloads.',
    implementationEvidence: [
      'src/service/http/routes/pipeline-filing-routes.ts#verifyReleaseAuthorization',
      'src/service/http/routes/pipeline-filing-routes.ts#consumeOnSuccess',
    ],
    validation: [
      'tests/pipeline-filing-default-secure.test.ts',
      'tests/filing-security-boundaries.test.ts',
      'tests/hosted-api-authorization-matrix.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023', 'OWASP API6:2023'],
  },
] as const satisfies readonly HostedSensitiveBusinessFlowAbuseGuard[];

export function findHostedSensitiveBusinessFlowAbuseGuardsForRoute(
  route: HostedApiRouteDescriptor,
): readonly HostedSensitiveBusinessFlowAbuseGuard[] {
  return HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS.filter((guard) =>
    guard.routes.some((item) => item.method === route.method && item.path === route.path),
  );
}

export function requireHostedSensitiveBusinessFlowAbuseGuard(
  id: string,
): HostedSensitiveBusinessFlowAbuseGuard {
  const guard = HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS.find((entry) => entry.id === id);
  if (!guard) {
    throw new Error(`Expected hosted sensitive business flow abuse guard '${id}' to exist.`);
  }
  return guard;
}

export function hostedSensitiveBusinessFlowAbuseGuardProfile() {
  return {
    version: HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARD_VERSION,
    guards: HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS,
    posture:
      'Sensitive hosted business flows are explicitly bound to role, replay, cost, duplicate, and privacy controls before automation can scale them.',
    unresolvedProductionDependency:
      'Repo-side flow guards do not replace live deployment env, service restart, Stripe readiness probe, or webhook smoke testing.',
  } as const;
}
