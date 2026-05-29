export type HostedApiRouteMethod = 'GET' | 'POST' | 'PATCH';

export type HostedApiAuthBoundary =
  | 'none'
  | 'credential_challenge'
  | 'account_session'
  | 'account_session_or_tenant_api_key'
  | 'tenant_context'
  | 'tenant_context_and_release_token'
  | 'admin_api_key'
  | 'admin_api_key_or_role_scoped_admin_key'
  | 'metrics_api_key_or_admin_api_key'
  | 'stripe_signature'
  | 'email_provider_signature';

export type HostedApiTenantBoundary =
  | 'none'
  | 'tenant_middleware'
  | 'tenant_middleware_and_job_owner'
  | 'account_session_account_scope'
  | 'account_or_tenant_context'
  | 'admin_operator_explicit_lookup'
  | 'provider_event_to_account'
  | 'release_token_target_binding';

export type HostedApiObjectBoundary =
  | 'none'
  | 'path_id_service_scoped'
  | 'account_id_from_session'
  | 'account_id_or_tenant_id_from_context'
  | 'tenant_scoped_path_id'
  | 'admin_authorized_path_id'
  | 'provider_payload_reference'
  | 'release_token_audience';

export type HostedApiMutationSafety =
  | 'read_only'
  | 'public_metadata_read'
  | 'credential_challenge'
  | 'credential_challenge_with_federated_callback_rate_limit'
  | 'role_gated_service_mutation'
  | 'role_gated_service_mutation_with_account_session_audit'
  | 'tenant_quota_rate_limited'
  | 'tenant_scoped_shadow_write'
  | 'admin_idempotent_audited'
  | 'signature_deduped'
  | 'release_token_consuming';

export type HostedApiIdempotencyBoundary =
  | 'not_applicable'
  | 'required_header'
  | 'admin_mutation_service'
  | 'tenant_shadow_idempotency_service'
  | 'provider_event_dedupe'
  | 'release_token_consume'
  | 'action_token_or_challenge'
  | 'service_defined';

export interface HostedApiAuthorizationRule {
  readonly id: string;
  readonly methods: readonly HostedApiRouteMethod[];
  readonly pathPattern: RegExp;
  readonly surface:
    | 'public_metadata'
    | 'customer_auth'
    | 'account_plane'
    | 'tenant_runtime'
    | 'billing_webhook'
    | 'email_webhook'
    | 'operator_admin'
    | 'shadow_control';
  readonly authBoundary: HostedApiAuthBoundary;
  readonly tenantBoundary: HostedApiTenantBoundary;
  readonly objectBoundary: HostedApiObjectBoundary;
  readonly mutationSafety: HostedApiMutationSafety;
  readonly idempotencyBoundary: HostedApiIdempotencyBoundary;
  readonly privacyBoundary: string;
  readonly evidence: readonly string[];
  readonly standards: readonly string[];
}

export interface HostedApiRouteDescriptor {
  readonly method: HostedApiRouteMethod;
  readonly path: string;
}

export const HOSTED_API_AUTHORIZATION_MATRIX_VERSION =
  'attestor.hosted-api-authorization-matrix.v1';

export const HOSTED_API_AUTHORIZATION_RULES = [
  {
    id: 'core.public-metadata.read',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/(?:startup|health|ready|domains|connectors|release-token\/jwks|pki\/ca)$/u,
    surface: 'public_metadata',
    authBoundary: 'none',
    tenantBoundary: 'none',
    objectBoundary: 'none',
    mutationSafety: 'public_metadata_read',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'public readiness and registry metadata only; no tenant payloads or secrets',
    evidence: [
      'src/service/http/routes/core-routes.ts',
      'src/service/bootstrap/production-shared-request-guard.ts',
    ],
    standards: ['OWASP API2:2023', 'OWASP API5:2023'],
  },
  {
    id: 'core.metrics.operator-read',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/(?:admin\/metrics|metrics|admin\/telemetry)$/u,
    surface: 'operator_admin',
    authBoundary: 'metrics_api_key_or_admin_api_key',
    tenantBoundary: 'none',
    objectBoundary: 'none',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'low-cardinality operational metadata only',
    evidence: [
      'src/service/request-context.ts#currentMetricsAuthorized',
      'src/service/http/routes/admin-routes.ts',
    ],
    standards: ['OWASP API3:2023', 'OWASP API5:2023'],
  },
  {
    id: 'auth.public-credential-challenge',
    methods: ['GET', 'POST'],
    pathPattern:
      /^\/api\/v1\/(?:auth\/(?:signup|login|passkeys\/(?:options|verify)|saml\/(?:metadata|login|acs)|oidc\/(?:login|callback)|mfa\/verify|password\/reset)|account\/users\/invites\/accept)$/u,
    surface: 'customer_auth',
    authBoundary: 'credential_challenge',
    tenantBoundary: 'none',
    objectBoundary: 'path_id_service_scoped',
    mutationSafety: 'credential_challenge_with_federated_callback_rate_limit',
    idempotencyBoundary: 'action_token_or_challenge',
    privacyBoundary: 'credential and action-token material is consumed through service boundaries, not emitted as telemetry',
    evidence: [
      'src/service/http/routes/account-routes.ts',
      'src/service/http/routes/account-public-auth-routes.ts',
      'src/service/http/routes/account-federated-auth-routes.ts',
      'src/service/http/routes/account-mfa-passkey-routes.ts',
      'src/service/http/routes/account-admin-user-routes.ts',
      'src/service/account/auth-abuse-guard.ts',
      'src/service/application/account-auth-service.ts',
      'tests/service-account-routes-authorization.test.ts#federated-callback-rate-limit',
    ],
    standards: ['OWASP API2:2023', 'OWASP API4:2023'],
  },
  {
    id: 'auth.account-session.self-service',
    methods: ['GET', 'POST'],
    pathPattern:
      /^\/api\/v1\/(?:auth\/(?:logout|password\/change|me)|account\/(?:mfa|oidc|saml|passkeys)(?:\/.*)?)$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'role_gated_service_mutation',
    idempotencyBoundary: 'action_token_or_challenge',
    privacyBoundary: 'account identity settings stay scoped to the authenticated account session',
    evidence: [
      'src/service/http/routes/account-public-auth-routes.ts#requireAccountSession',
      'src/service/http/routes/account-mfa-passkey-routes.ts#requireAccountSession',
      'src/service/tenant-isolation.ts#resolveAccountSessionContext',
      'src/service/bootstrap/http-route-builders.ts#recordAccountMutationAudit',
    ],
    standards: ['OWASP API1:2023', 'OWASP API2:2023', 'OWASP API5:2023'],
  },
  {
    id: 'account.users.bootstrap',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/account\/users\/bootstrap$/u,
    surface: 'account_plane',
    authBoundary: 'account_session_or_tenant_api_key',
    tenantBoundary: 'account_or_tenant_context',
    objectBoundary: 'account_id_or_tenant_id_from_context',
    mutationSafety: 'role_gated_service_mutation',
    idempotencyBoundary: 'service_defined',
    privacyBoundary: 'first-user bootstrap is bound to resolved hosted account context',
    evidence: [
      'src/service/http/routes/account-public-auth-routes.ts#currentHostedAccount',
      'src/service/application/account-auth-service.ts#bootstrapFirstUser',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023'],
  },
  {
    id: 'account.context.read',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/account(?:\/(?:usage|entitlement|features|billing\/export))?$/u,
    surface: 'account_plane',
    authBoundary: 'account_session_or_tenant_api_key',
    tenantBoundary: 'account_or_tenant_context',
    objectBoundary: 'account_id_or_tenant_id_from_context',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'account, usage, entitlement, and billing export are resolved from current account or tenant context',
    evidence: [
      'src/service/http/routes/account-billing-routes.ts#currentHostedAccount',
      'src/service/hosted/hosted-journey-contract.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023'],
  },
  {
    id: 'account.role-gated.read',
    methods: ['GET'],
    pathPattern:
      /^\/api\/v1\/account\/(?:api-keys|users|users\/invites|email\/deliveries|billing\/reconciliation)$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'role-gated account reads avoid historical plaintext secrets',
    evidence: [
      'src/service/http/routes/account-billing-routes.ts#requireAccountSession',
      'src/service/http/routes/account-admin-user-routes.ts#requireAccountSession',
      'src/service/application/account-api-key-service.ts',
      'src/service/application/account-user-management-service.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023', 'OWASP API5:2023'],
  },
  {
    id: 'account.billing.checkout',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/account\/billing\/checkout$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'role_gated_service_mutation_with_account_session_audit',
    idempotencyBoundary: 'required_header',
    privacyBoundary: 'Stripe checkout session ids are handoff references; secret keys are never emitted',
    evidence: [
      'src/service/http/routes/account-billing-routes.ts#Idempotency-Key',
      'src/service/billing/stripe/stripe-billing.ts#createHostedCheckoutSession',
      'src/service/bootstrap/http-route-builders.ts#recordAccountMutationAudit',
    ],
    standards: ['OWASP API1:2023', 'OWASP API4:2023', 'Stripe idempotency'],
  },
  {
    id: 'account.billing.portal',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/account\/billing\/portal$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'role_gated_service_mutation_with_account_session_audit',
    idempotencyBoundary: 'service_defined',
    privacyBoundary: 'portal response is a short-lived Stripe-hosted handoff reference',
    evidence: [
      'src/service/http/routes/account-billing-routes.ts#requireAccountSession',
      'src/service/billing/stripe/stripe-billing.ts#createHostedBillingPortalSession',
      'src/service/bootstrap/http-route-builders.ts#recordAccountMutationAudit',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023'],
  },
  {
    id: 'account.api-key.lifecycle',
    methods: ['POST'],
    pathPattern:
      /^\/api\/v1\/account\/api-keys(?:\/[^/]+\/(?:rotate|deactivate|reactivate|revoke))?$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'role_gated_service_mutation_with_account_session_audit',
    idempotencyBoundary: 'service_defined',
    privacyBoundary: 'plaintext tenant API keys are returned only on issue or rotate responses',
    evidence: [
      'src/service/http/routes/account-admin-user-routes.ts#apiKeyService',
      'src/service/application/account-api-key-service.ts',
      'src/service/bootstrap/http-route-builders.ts#recordAccountMutationAudit',
      'tests/service-account-routes-authorization.test.ts#account-api-key-audit',
    ],
    standards: ['OWASP API1:2023', 'OWASP API2:2023', 'OWASP API3:2023'],
  },
  {
    id: 'account.user.lifecycle',
    methods: ['POST'],
    pathPattern:
      /^\/api\/v1\/account\/users(?!(?:\/bootstrap|\/invites\/accept)$)(?:\/.*)?$/u,
    surface: 'account_plane',
    authBoundary: 'account_session',
    tenantBoundary: 'account_session_account_scope',
    objectBoundary: 'account_id_from_session',
    mutationSafety: 'role_gated_service_mutation_with_account_session_audit',
    idempotencyBoundary: 'action_token_or_challenge',
    privacyBoundary: 'invite and reset tokens are returned only when delivery policy allows it',
    evidence: [
      'src/service/http/routes/account-admin-user-routes.ts#userManagementService',
      'src/service/application/account-user-management-service.ts',
      'src/service/bootstrap/http-route-builders.ts#recordAccountMutationAudit',
    ],
    standards: ['OWASP API1:2023', 'OWASP API2:2023', 'OWASP API5:2023'],
  },
  {
    id: 'tenant.admission.action-authorization',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/admissions$/u,
    surface: 'tenant_runtime',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware',
    objectBoundary: 'account_id_or_tenant_id_from_context',
    mutationSafety: 'tenant_quota_rate_limited',
    idempotencyBoundary: 'service_defined',
    privacyBoundary: 'admission evidence is projected into envelope form; raw customer payloads must not become telemetry',
    evidence: [
      'src/service/http/routes/generic-admission-routes.ts',
      'src/service/tenant-isolation.ts#tenantMiddleware',
    ],
    standards: ['OWASP API1:2023', 'OWASP LLM01:2025', 'OWASP LLM06:2025'],
  },
  {
    id: 'tenant.pipeline.execution',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/pipeline\/(?:run|run-async)$/u,
    surface: 'tenant_runtime',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware',
    objectBoundary: 'account_id_or_tenant_id_from_context',
    mutationSafety: 'tenant_quota_rate_limited',
    idempotencyBoundary: 'service_defined',
    privacyBoundary: 'runtime responses expose proof and usage summaries, not provider credentials',
    evidence: [
      'src/service/http/routes/pipeline-execution-routes.ts',
      'src/service/http/routes/pipeline-async-routes.ts',
      'src/service/application/pipeline-usage-service.ts',
      'src/service/rate-limit.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API4:2023', 'OWASP API6:2023'],
  },
  {
    id: 'tenant.pipeline.status',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/pipeline\/status\/:jobId$/u,
    surface: 'tenant_runtime',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware_and_job_owner',
    objectBoundary: 'tenant_scoped_path_id',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'job ids are not sufficient authority; returned status must belong to the current tenant',
    evidence: [
      'src/service/http/routes/pipeline-async-routes.ts#currentTenant',
      'tests/hosted-api-authorization-matrix.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023'],
  },
  {
    id: 'tenant.proof.verify',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/verify$/u,
    surface: 'tenant_runtime',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware',
    objectBoundary: 'account_id_or_tenant_id_from_context',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'certificate verification returns trust result summaries only',
    evidence: [
      'src/service/http/routes/pipeline-verification-routes.ts',
      'src/service/tenant-isolation.ts#tenantMiddleware',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023'],
  },
  {
    id: 'tenant.filing.release-bound-export',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/filing\/export$/u,
    surface: 'tenant_runtime',
    authBoundary: 'tenant_context_and_release_token',
    tenantBoundary: 'release_token_target_binding',
    objectBoundary: 'release_token_audience',
    mutationSafety: 'release_token_consuming',
    idempotencyBoundary: 'release_token_consume',
    privacyBoundary: 'filing export is release-token bound before package generation',
    evidence: [
      'src/service/http/routes/pipeline-filing-routes.ts#verifyReleaseAuthorization',
      'src/service/tenant-isolation.ts#tenantMiddleware',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023'],
  },
  {
    id: 'shadow.tenant.read',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/shadow\/.+$/u,
    surface: 'shadow_control',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware',
    objectBoundary: 'tenant_scoped_path_id',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'shadow reads are tenant-bound and decision-support-only',
    evidence: [
      'src/service/http/routes/shadow-routes.ts#assertTenantBoundRecord',
      'tests/shadow-route-tenant-boundary.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023', 'OWASP LLM02:2025'],
  },
  {
    id: 'shadow.tenant.mutation',
    methods: ['POST', 'PATCH'],
    pathPattern: /^\/api\/v1\/shadow\/.+$/u,
    surface: 'shadow_control',
    authBoundary: 'tenant_context',
    tenantBoundary: 'tenant_middleware',
    objectBoundary: 'tenant_scoped_path_id',
    mutationSafety: 'tenant_scoped_shadow_write',
    idempotencyBoundary: 'tenant_shadow_idempotency_service',
    privacyBoundary: 'shadow write paths persist tenant-scoped digests, receipts, or candidates, not raw private payloads',
    evidence: [
      'src/service/http/routes/shadow-routes.ts#assertTenantBoundRecord',
      'src/service/http/routes/shadow-routes.ts#recordShadowMutationAudit',
      'src/service/http/routes/shadow-routes.ts#beginShadowMutationIdempotency',
      'src/service/bootstrap/routes.ts#createShadowRouteDeps',
      'tests/shadow-route-tenant-boundary.test.ts',
      'tests/service-shadow-routes-http.test.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API3:2023', 'OWASP LLM02:2025', 'IETF HTTPAPI Idempotency-Key draft'],
  },
  {
    id: 'webhook.stripe.billing',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/billing\/stripe\/webhook$/u,
    surface: 'billing_webhook',
    authBoundary: 'stripe_signature',
    tenantBoundary: 'provider_event_to_account',
    objectBoundary: 'provider_payload_reference',
    mutationSafety: 'signature_deduped',
    idempotencyBoundary: 'provider_event_dedupe',
    privacyBoundary: 'raw payload is verified and hashed before billing convergence; webhook secret is never emitted',
    evidence: [
      'src/service/http/routes/stripe-webhook-routes.ts',
      'src/service/application/stripe-webhook-service.ts',
      'src/service/application/stripe-webhook-billing-processor.ts',
    ],
    standards: ['OWASP API2:2023', 'OWASP API3:2023', 'Stripe webhook signatures'],
  },
  {
    id: 'webhook.email.provider',
    methods: ['POST'],
    pathPattern: /^\/api\/v1\/email\/(?:sendgrid|mailgun)\/webhook$/u,
    surface: 'email_webhook',
    authBoundary: 'email_provider_signature',
    tenantBoundary: 'provider_event_to_account',
    objectBoundary: 'provider_payload_reference',
    mutationSafety: 'signature_deduped',
    idempotencyBoundary: 'provider_event_dedupe',
    privacyBoundary: 'email provider events are normalized through the webhook service before persistence',
    evidence: [
      'src/service/http/routes/email-webhook-routes.ts',
      'src/service/application/email-webhook-service.ts',
    ],
    standards: ['OWASP API2:2023', 'OWASP API3:2023'],
  },
  {
    id: 'admin.operator.read',
    methods: ['GET'],
    pathPattern: /^\/api\/v1\/admin\/(?!metrics$|telemetry$).+$/u,
    surface: 'operator_admin',
    authBoundary: 'admin_api_key_or_role_scoped_admin_key',
    tenantBoundary: 'admin_operator_explicit_lookup',
    objectBoundary: 'admin_authorized_path_id',
    mutationSafety: 'read_only',
    idempotencyBoundary: 'not_applicable',
    privacyBoundary: 'operator reads are admin-key and credential-role gated and should expose scoped references, digests, or summaries',
    evidence: [
      'src/service/request-context.ts#currentAdminAuthorized',
      'src/service/http/routes/admin-routes.ts',
      'src/service/http/release-admin-authorization.ts',
      'tests/service-admin-routes-http.test.ts',
      'tests/release-review-admin-routes.test.ts',
      'tests/release-policy-control-plane-admin-routes.test.ts',
      'src/service/http/routes/release-review-routes.ts',
      'src/service/http/routes/release-policy-control-routes.ts',
    ],
    standards: ['OWASP API1:2023', 'OWASP API5:2023'],
  },
  {
    id: 'admin.operator.mutation',
    methods: ['POST', 'PATCH'],
    pathPattern: /^\/api\/v1\/admin\/.+$/u,
    surface: 'operator_admin',
    authBoundary: 'admin_api_key_or_role_scoped_admin_key',
    tenantBoundary: 'admin_operator_explicit_lookup',
    objectBoundary: 'admin_authorized_path_id',
    mutationSafety: 'admin_idempotent_audited',
    idempotencyBoundary: 'admin_mutation_service',
    privacyBoundary: 'admin mutations pass through credential-role gating, idempotency, and audit services with hashed request material; account/key issuance responses may contain one-time API key material and require response-log redaction',
    evidence: [
      'src/service/request-context.ts#configuredAdminRoleKeys',
      'src/service/http/release-admin-authorization.ts#authorizeReleaseAdminRoute',
      'src/service/http/routes/admin-account-mutation-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-tenant-key-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-queue-routes.ts#beginAdminMutation',
      'src/service/http/routes/admin-release-enforcement-routes.ts#beginAdminMutation',
      'src/service/bootstrap/http-route-builders.ts#adminMutationRequest',
      'tests/service-admin-routes-http.test.ts',
      'tests/release-review-admin-routes.test.ts',
      'tests/release-policy-control-plane-admin-routes.test.ts',
      'src/service/http/routes/release-policy-control-routes.ts#beginMutation',
      'src/service/http/routes/release-review-routes.ts#adminMutationRequest',
    ],
    standards: ['OWASP API5:2023', 'OWASP API6:2023', 'NIST SSDF PW.8'],
  },
] as const satisfies readonly HostedApiAuthorizationRule[];

export function findHostedApiAuthorizationRules(
  route: HostedApiRouteDescriptor,
): readonly HostedApiAuthorizationRule[] {
  const rules: readonly HostedApiAuthorizationRule[] = HOSTED_API_AUTHORIZATION_RULES;
  return rules.filter(
    (rule) => rule.methods.includes(route.method) && rule.pathPattern.test(route.path),
  );
}

export function requireHostedApiAuthorizationRule(
  route: HostedApiRouteDescriptor,
): HostedApiAuthorizationRule {
  const matches = findHostedApiAuthorizationRules(route);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one hosted API authorization rule for ${route.method} ${route.path}; found ${matches.length}.`,
    );
  }
  return matches[0];
}

export function hostedApiAuthorizationMatrix() {
  return {
    version: HOSTED_API_AUTHORIZATION_MATRIX_VERSION,
    rules: HOSTED_API_AUTHORIZATION_RULES,
    posture:
      'Route authorization is explicit by surface: public metadata, credential challenge, account plane, tenant runtime, signed webhook, shadow control, and operator admin.',
    unresolvedProductionDependency:
      'Final live rollout still requires operator-managed deployment env, restart, readiness probe, and smoke tests on a working deployment target.',
  } as const;
}
