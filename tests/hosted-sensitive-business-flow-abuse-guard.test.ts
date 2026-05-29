import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  requireHostedApiAuthorizationRule,
} from '../src/service/hosted/hosted-api-authorization-matrix.js';
import {
  HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARD_VERSION,
  HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS,
  findHostedSensitiveBusinessFlowAbuseGuardsForRoute,
  hostedSensitiveBusinessFlowAbuseGuardProfile,
  requireHostedSensitiveBusinessFlowAbuseGuard,
  type HostedSensitiveBusinessFlowControl,
  type HostedSensitiveBusinessFlowRoute,
} from '../src/service/hosted/hosted-sensitive-business-flow-abuse-guard.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readAccountRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^account.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function readAdminRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^admin.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function fileExists(projectPath: string): boolean {
  return existsSync(join(process.cwd(), projectPath.split('#')[0]));
}

function routeKey(route: HostedSensitiveBusinessFlowRoute): string {
  return `${route.method} ${route.path}`;
}

function hasControl(
  guardId: string,
  control: HostedSensitiveBusinessFlowControl,
): void {
  const guard = requireHostedSensitiveBusinessFlowAbuseGuard(guardId);
  ok(
    guard.requiredControls.includes(control),
    `Hosted sensitive flow guard: ${guardId} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedSensitiveBusinessFlowAbuseGuardProfile();

  equal(
    profile.version,
    HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARD_VERSION,
    'Hosted sensitive flow guard: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS.length,
    'Hosted sensitive flow guard: profile exports all guards',
  );
  includes(
    profile.posture,
    'role, replay, cost, duplicate, and privacy controls',
    'Hosted sensitive flow guard: posture describes abuse-control scope',
  );
  includes(
    profile.unresolvedProductionDependency,
    'Stripe readiness probe',
    'Hosted sensitive flow guard: production dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();
  const routeKeys = new Set<string>();

  for (const guard of HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS) {
    ok(!ids.has(guard.id), `Hosted sensitive flow guard: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.routes.length > 0, `Hosted sensitive flow guard: ${guard.id} declares routes`);
    ok(guard.automationRisks.length > 0, `Hosted sensitive flow guard: ${guard.id} declares automation risks`);
    ok(guard.requiredControls.length > 0, `Hosted sensitive flow guard: ${guard.id} declares required controls`);
    ok(
      guard.requiredControls.includes('privacy_minimized_response'),
      `Hosted sensitive flow guard: ${guard.id} includes privacy-minimized response control`,
    );
    ok(guard.replayBoundary.length > 40, `Hosted sensitive flow guard: ${guard.id} declares replay boundary`);
    ok(guard.costBoundary.length > 30, `Hosted sensitive flow guard: ${guard.id} declares cost boundary`);
    ok(guard.privacyBoundary.length > 40, `Hosted sensitive flow guard: ${guard.id} declares privacy boundary`);
    ok(guard.implementationEvidence.every(fileExists), `Hosted sensitive flow guard: ${guard.id} evidence files exist`);
    ok(guard.validation.every(fileExists), `Hosted sensitive flow guard: ${guard.id} validation files exist`);
    ok(
      guard.standards.some((standard) => standard.includes('OWASP API')),
      `Hosted sensitive flow guard: ${guard.id} is anchored to OWASP API guidance`,
    );

    for (const route of guard.routes) {
      const key = routeKey(route);
      ok(!routeKeys.has(key), `Hosted sensitive flow guard: ${key} is owned by one guard`);
      routeKeys.add(key);
    }
  }

  excludes(
    JSON.stringify(HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/u,
    'Hosted sensitive flow guard: contract does not contain live secrets',
  );
}

function testRoutesStayConsistentWithAuthorizationMatrix(): void {
  for (const guard of HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS) {
    for (const route of guard.routes) {
      const rule = requireHostedApiAuthorizationRule(route);
      equal(
        rule.id,
        route.authorizationRuleId,
        `Hosted sensitive flow guard: ${routeKey(route)} maps to authorization rule ${route.authorizationRuleId}`,
      );
    }
  }

  const checkoutGuards = findHostedSensitiveBusinessFlowAbuseGuardsForRoute({
    method: 'POST',
    path: '/api/v1/account/billing/checkout',
  });
  equal(checkoutGuards.length, 1, 'Hosted sensitive flow guard: checkout route has one abuse guard');
  equal(checkoutGuards[0].id, 'billing.checkout-upgrade', 'Hosted sensitive flow guard: checkout route resolves');
}

function testCriticalSensitiveRoutesAreCovered(): void {
  const routes = new Set(
    HOSTED_SENSITIVE_BUSINESS_FLOW_ABUSE_GUARDS.flatMap((guard) => guard.routes.map(routeKey)),
  );

  for (const expected of [
    'POST /api/v1/auth/signup',
    'POST /api/v1/auth/saml/login',
    'POST /api/v1/auth/oidc/login',
    'POST /api/v1/account/users/bootstrap',
    'POST /api/v1/account/api-keys',
    'POST /api/v1/account/api-keys/:id/rotate',
    'POST /api/v1/account/billing/checkout',
    'POST /api/v1/account/billing/portal',
    'POST /api/v1/admissions',
    'POST /api/v1/pipeline/run',
    'POST /api/v1/pipeline/run-async',
    'POST /api/v1/admin/accounts',
    'POST /api/v1/admin/tenant-keys/:id/rotate',
    'POST /api/v1/billing/stripe/webhook',
    'POST /api/v1/email/sendgrid/webhook',
    'POST /api/v1/filing/export',
  ]) {
    ok(routes.has(expected), `Hosted sensitive flow guard: ${expected} is covered`);
  }
}

function testControlContractsForHighRiskFlows(): void {
  hasControl('auth.credential-challenges', 'shared_auth_abuse_budget');
  hasControl('auth.credential-challenges', 'action_token_or_provider_state');
  hasControl('account.api-key-lifecycle', 'account_admin_role_gate');
  hasControl('account.api-key-lifecycle', 'active_key_limit');
  hasControl('account.api-key-lifecycle', 'one_time_plaintext_secret_delivery');
  hasControl('billing.checkout-upgrade', 'required_idempotency_key');
  hasControl('billing.checkout-upgrade', 'stripe_sdk_idempotency_key');
  hasControl('billing.portal-handoff', 'stripe_hosted_handoff');
  hasControl('tenant.expensive-runtime-execution', 'tenant_quota_check');
  hasControl('tenant.expensive-runtime-execution', 'tenant_rate_limit_reservation');
  hasControl('admin.operator-mutations', 'admin_mutation_idempotency');
  hasControl('admin.operator-mutations', 'admin_audit_hash_chain');
  hasControl('webhook.provider-convergence', 'provider_signature_verification');
  hasControl('webhook.provider-convergence', 'provider_event_dedupe');
  hasControl('release.filing-export', 'release_token_consume');
}

function testImplementationEvidenceMatchesContract(): void {
  const accountRoutes = readAccountRouteSources();
  const authAbuseGuard = readProjectFile('src', 'service', 'account', 'auth-abuse-guard.ts');
  const apiKeyService = readProjectFile('src', 'service', 'application', 'account-api-key-service.ts');
  const stripeBilling = readProjectFile('src', 'service', 'billing', 'stripe', 'stripe-billing.ts');
  const adminRoutes = readAdminRouteSources();
  const adminMutationService = readProjectFile('src', 'service', 'application', 'admin-mutation-service.ts');
  const pipelineRoutes = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-execution-routes.ts');
  const pipelineAsyncRoutes = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-async-routes.ts');
  const stripeWebhookRoutes = readProjectFile('src', 'service', 'http', 'routes', 'stripe-webhook-routes.ts');
  const stripeWebhookService = readProjectFile('src', 'service', 'application', 'stripe-webhook-service.ts');
  const emailWebhookRoutes = readProjectFile('src', 'service', 'http', 'routes', 'email-webhook-routes.ts');
  const filingRoutes = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-filing-routes.ts');

  includes(authAbuseGuard, 'ATTESTOR_AUTH_RATE_LIMIT_REQUIRE_SHARED', 'Hosted sensitive flow evidence: auth guard supports shared fail-closed mode');
  includes(accountRoutes, 'const samlLoginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);', 'Hosted sensitive flow evidence: SAML login initiation is abuse guarded');
  includes(accountRoutes, 'const oidcLoginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);', 'Hosted sensitive flow evidence: OIDC login initiation is abuse guarded');
  includes(accountRoutes, 'await recordAuthAttemptUse(authAttempt);', 'Hosted sensitive flow evidence: auth challenge issuance consumes abuse budget');
  includes(accountRoutes, "c.req.header('Idempotency-Key')", 'Hosted sensitive flow evidence: checkout reads Idempotency-Key header');
  includes(stripeBilling, 'stripeClient().checkout.sessions.create', 'Hosted sensitive flow evidence: Stripe Checkout is SDK-created');
  includes(stripeBilling, 'idempotencyKey,', 'Hosted sensitive flow evidence: Stripe Checkout receives idempotency key');
  includes(stripeBilling, 'billingPortal.sessions.create', 'Hosted sensitive flow evidence: Stripe portal session is hosted handoff');
  includes(accountRoutes, "roles: ['account_admin']", 'Hosted sensitive flow evidence: API-key lifecycle is account-admin gated');
  includes(apiKeyService, 'tenantKeyStorePolicy().maxActiveKeysPerTenant', 'Hosted sensitive flow evidence: API-key lifecycle exposes active key policy');
  includes(apiKeyService, 'rotateTenantApiKeyState', 'Hosted sensitive flow evidence: API-key rotation is service-scoped');
  includes(adminRoutes, 'beginAdminMutation', 'Hosted sensitive flow evidence: admin routes enter mutation service');
  includes(adminMutationService, 'lookupAdminIdempotencyState', 'Hosted sensitive flow evidence: admin mutations lookup idempotency state');
  includes(adminMutationService, 'appendAdminAuditRecordState', 'Hosted sensitive flow evidence: admin mutations append audit state');
  includes(pipelineRoutes, 'pipelineUsageService.check', 'Hosted sensitive flow evidence: synchronous pipeline checks quota');
  includes(pipelineRoutes, 'reserveTenantPipelineRequest', 'Hosted sensitive flow evidence: synchronous pipeline reserves rate budget');
  includes(pipelineAsyncRoutes, 'pipelineUsageService.check', 'Hosted sensitive flow evidence: async pipeline checks quota');
  includes(pipelineAsyncRoutes, 'reserveTenantPipelineRequest', 'Hosted sensitive flow evidence: async pipeline reserves rate budget');
  includes(stripeWebhookRoutes, "c.req.header('stripe-signature')", 'Hosted sensitive flow evidence: Stripe webhook reads signature');
  includes(stripeWebhookRoutes, 'stripeWebhookService.begin', 'Hosted sensitive flow evidence: Stripe webhook enters verifier/dedupe service');
  includes(stripeWebhookService, 'payloadHash', 'Hosted sensitive flow evidence: Stripe webhook stores payload hash');
  includes(emailWebhookRoutes, 'emailWebhookService.handleSendGrid', 'Hosted sensitive flow evidence: SendGrid webhook enters verifier/dedupe service');
  includes(emailWebhookRoutes, 'emailWebhookService.handleMailgun', 'Hosted sensitive flow evidence: Mailgun webhook enters verifier/dedupe service');
  includes(filingRoutes, 'verifyReleaseAuthorization', 'Hosted sensitive flow evidence: filing export verifies release token');
  includes(filingRoutes, 'consumeOnSuccess: true', 'Hosted sensitive flow evidence: filing export consumes release token on success');
}

function testDocsAndRunnerExposeGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');
  const hostedTracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');

  equal(
    packageJson.scripts['test:hosted-sensitive-business-flow-abuse-guard'],
    'tsx tests/hosted-sensitive-business-flow-abuse-guard.test.ts',
    'Hosted sensitive flow guard: package script is exposed',
  );
  includes(
    packageRunner,
    'test:hosted-sensitive-business-flow-abuse-guard',
    'Hosted sensitive flow guard: package runner includes guard test',
  );
  includes(
    hostedTracker,
    'Sensitive Business Flow Abuse Guard',
    'Hosted sensitive flow guard: tracker records Step 02',
  );
  includes(
    hostedTracker,
    'src/service/hosted/hosted-sensitive-business-flow-abuse-guard.ts',
    'Hosted sensitive flow guard: tracker points to source',
  );
  includes(
    hostedContract,
    'src/service/hosted/hosted-sensitive-business-flow-abuse-guard.ts',
    'Hosted sensitive flow guard: hosted contract points to source',
  );
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testRoutesStayConsistentWithAuthorizationMatrix();
testCriticalSensitiveRoutesAreCovered();
testControlContractsForHighRiskFlows();
testImplementationEvidenceMatchesContract();
testDocsAndRunnerExposeGuard();

ok(passed > 0, 'Hosted sensitive flow guard: tests executed');
console.log(`\nHosted sensitive business flow abuse guard tests: ${passed} passed, 0 failed`);
