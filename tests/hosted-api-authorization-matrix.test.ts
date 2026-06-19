import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  HOSTED_API_AUTHORIZATION_MATRIX_VERSION,
  HOSTED_API_AUTHORIZATION_RULES,
  findHostedApiAuthorizationRules,
  hostedApiAuthorizationMatrix,
  requireHostedApiAuthorizationRule,
  type HostedApiRouteDescriptor,
} from '../src/service/hosted/hosted-api-authorization-matrix.js';
import { registerPipelineAsyncRoutes } from '../src/service/http/routes/pipeline-async-routes.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import type { InProcessAsyncJob } from '../src/service/runtime/tenant-runtime.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readAccountRouteSources(): string {
  return routeFiles
    .filter((file) => file[file.length - 1].startsWith('account'))
    .map((file) => readProjectFile(...file))
    .join('\n');
}

function readReleasePolicyControlRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^release-policy-control.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

function readAdminRouteSources(): string {
  const routeDir = join(process.cwd(), 'src', 'service', 'http', 'routes');
  return readdirSync(routeDir)
    .filter((file) => /^admin(?:-|$).*\.ts$/u.test(file))
    .map((file) => readFileSync(join(routeDir, file), 'utf8'))
    .join('\n');
}

const routeFiles = [
  ['src', 'service', 'http', 'routes', 'core-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-public-auth-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-federated-auth-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-mfa-passkey-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-admin-user-routes.ts'],
  ['src', 'service', 'http', 'routes', 'account-billing-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-read-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-queue-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-account-mutation-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-tenant-key-routes.ts'],
  ['src', 'service', 'http', 'routes', 'admin-release-enforcement-routes.ts'],
  ['src', 'service', 'http', 'routes', 'action-surface-onboarding-routes.ts'],
  ['src', 'service', 'http', 'routes', 'policy-foundry-hosted-onboarding-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-review-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-route-context.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-read-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-pack-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-activation-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-emergency-routes.ts'],
  ['src', 'service', 'http', 'routes', 'release-policy-control-simulation-routes.ts'],
  ['src', 'service', 'http', 'routes', 'generic-admission-routes.ts'],
  ['src', 'service', 'http', 'routes', 'shadow-routes.ts'],
  ['src', 'service', 'http', 'routes', 'pipeline-execution-routes.ts'],
  ['src', 'service', 'http', 'routes', 'pipeline-async-routes.ts'],
  ['src', 'service', 'http', 'routes', 'pipeline-verification-routes.ts'],
  ['src', 'service', 'http', 'routes', 'pipeline-filing-routes.ts'],
  ['src', 'service', 'http', 'routes', 'stripe-webhook-routes.ts'],
  ['src', 'service', 'http', 'routes', 'email-webhook-routes.ts'],
] as const;

function collectRegisteredRoutes(): readonly HostedApiRouteDescriptor[] {
  const routes: HostedApiRouteDescriptor[] = [];
  const routePattern = /app\.(get|post|patch)\('([^']+)'/gu;

  for (const file of routeFiles) {
    const content = readProjectFile(...file);
    for (const match of content.matchAll(routePattern)) {
      routes.push({
        method: match[1].toUpperCase() as HostedApiRouteDescriptor['method'],
        path: match[2],
      });
    }
  }

  return routes.sort((left, right) =>
    `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
  );
}

function tenant(tenantId: string): TenantContext {
  return {
    tenantId,
    tenantName: tenantId,
    authenticatedAt: '2026-05-11T00:00:00.000Z',
    source: 'api_key',
    planId: 'trial',
    monthlyRunQuota: 10,
  };
}

function createAsyncJob(jobId: string, tenantId: string): InProcessAsyncJob {
  return {
    id: jobId,
    status: 'completed',
    submittedAt: '2026-05-11T00:00:00.000Z',
    completedAt: '2026-05-11T00:00:01.000Z',
    tenantId,
    planId: 'trial',
    result: {
      runId: 'run_matrix',
      decision: 'approve',
      proofMode: 'fixture',
      certificateId: null,
      certificate: null,
      verification: null,
      publicKeyPem: null,
      trustChain: null,
      caPublicKeyPem: null,
    },
    error: null,
  };
}

function createAsyncRouteApp(options: {
  readonly currentTenant: TenantContext;
  readonly backendMode?: 'in_process' | 'bullmq';
  readonly inProcessJobs?: Map<string, InProcessAsyncJob>;
}) {
  const app = new Hono();
  registerPipelineAsyncRoutes(app, {
    currentTenant: () => options.currentTenant,
    pipelineUsageService: {} as never,
    pipelineIdempotencyService: {
      begin: async () => ({ kind: 'ready', idempotencyKey: null, requestHash: 'hash' }),
      finalize: async (input) => input.responseBody,
    },
    reserveTenantPipelineRequest: async () => ({ allowed: true, rateLimit: {} }) as never,
    applyRateLimitHeaders: () => {},
    createRequestSigners: () => ({}) as never,
    runFinancialPipeline: () => ({}) as never,
    buildVerificationKit: () => null,
    asyncBackendMode: options.backendMode ?? 'in_process',
    bullmqQueue: (options.backendMode === 'bullmq' ? {} : null) as never,
    canEnqueueTenantAsyncJob: async () => ({}) as never,
    currentAsyncSubmissionReservations: () => 0,
    reserveAsyncSubmission: () => {},
    releaseAsyncSubmission: () => {},
    getAsyncRetryPolicy: () => ({}) as never,
    getAsyncQueueSummary: async () => ({}) as never,
    submitPipelineJob: async () => ({ jobId: 'unused' }),
    getTenantPipelineRateLimit: async () => ({}) as never,
    inProcessTenantQueueSnapshot: () => ({}) as never,
    inProcessJobs: options.inProcessJobs ?? new Map(),
    pki: {} as never,
    pipelineDeadLetterService: {} as never,
    getJobStatus: async () => ({
      status: 'completed',
      result: {
        runId: 'run_bullmq',
        decision: 'approve',
        proofMode: 'fixture',
        certificateId: null,
        completedAt: '2026-05-11T00:00:01.000Z',
        durationMs: 1,
      },
      error: null,
      submittedAt: '2026-05-11T00:00:00.000Z',
      attemptsMade: 1,
      maxAttempts: 1,
      tenant: {
        tenantId: 'tenant_a',
        planId: 'trial',
        source: 'api_key',
      },
      failedAt: null,
    }),
  });
  return app;
}

function testMatrixDescriptor(): void {
  const matrix = hostedApiAuthorizationMatrix();

  equal(matrix.version, HOSTED_API_AUTHORIZATION_MATRIX_VERSION, 'Hosted auth matrix: version is exported');
  equal(matrix.rules.length, HOSTED_API_AUTHORIZATION_RULES.length, 'Hosted auth matrix: rules are exported');
  ok(matrix.posture.includes('Route authorization is explicit'), 'Hosted auth matrix: posture is explicit');
  ok(
    matrix.unresolvedProductionDependency.includes('deployment env'),
    'Hosted auth matrix: production dependency remains explicit',
  );
}

function testAllHostedRoutesResolveToExactlyOneRule(): void {
  const routes = collectRegisteredRoutes();
  ok(routes.length > 80, 'Hosted auth matrix: route inventory is non-trivial');

  for (const route of routes) {
    const matches = findHostedApiAuthorizationRules(route);
    equal(
      matches.length,
      1,
      `Hosted auth matrix: ${route.method} ${route.path} resolves to exactly one authorization rule`,
    );
  }
}

function testSensitiveBoundariesAreClassified(): void {
  const expected = [
    {
      route: { method: 'POST', path: '/api/v1/account/billing/checkout' } as const,
      id: 'account.billing.checkout',
      authBoundary: 'account_session',
      idempotencyBoundary: 'not_applicable',
    },
    {
      route: { method: 'POST', path: '/api/v1/account/billing/workflows/checkout' } as const,
      id: 'account.billing.workflow-checkout',
      authBoundary: 'account_session',
      idempotencyBoundary: 'required_header',
    },
    {
      route: { method: 'POST', path: '/api/v1/billing/stripe/webhook' } as const,
      id: 'webhook.stripe.billing',
      authBoundary: 'stripe_signature',
      idempotencyBoundary: 'provider_event_dedupe',
    },
    {
      route: { method: 'GET', path: '/api/v1/pipeline/status/:jobId' } as const,
      id: 'tenant.pipeline.status',
      authBoundary: 'tenant_context',
      idempotencyBoundary: 'not_applicable',
    },
    {
      route: { method: 'POST', path: '/api/v1/admin/accounts/:id/suspend' } as const,
      id: 'admin.operator.mutation',
      authBoundary: 'admin_api_key_or_role_scoped_admin_key',
      idempotencyBoundary: 'admin_mutation_service',
    },
    {
      route: { method: 'POST', path: '/api/v1/filing/export' } as const,
      id: 'tenant.filing.release-bound-export',
      authBoundary: 'tenant_context_and_release_token',
      idempotencyBoundary: 'release_token_consume',
    },
    {
      route: { method: 'POST', path: '/api/v1/shadow/simulations' } as const,
      id: 'shadow.tenant.mutation',
      authBoundary: 'tenant_context',
      idempotencyBoundary: 'optional_header_plus_rate_limit',
    },
  ];

  for (const item of expected) {
    const rule = requireHostedApiAuthorizationRule(item.route);
    equal(rule.id, item.id, `Hosted auth matrix: ${item.id} resolves for route`);
    equal(rule.authBoundary, item.authBoundary, `Hosted auth matrix: ${item.id} auth boundary`);
    equal(rule.idempotencyBoundary, item.idempotencyBoundary, `Hosted auth matrix: ${item.id} idempotency`);
  }
}

function testEveryRuleCarriesEvidenceAndStandards(): void {
  const ruleIds = new Set<string>();

  for (const rule of HOSTED_API_AUTHORIZATION_RULES) {
    ok(!ruleIds.has(rule.id), `Hosted auth matrix: ${rule.id} is unique`);
    ruleIds.add(rule.id);
    ok(rule.evidence.length > 0, `Hosted auth matrix: ${rule.id} declares source evidence`);
    ok(rule.standards.length > 0, `Hosted auth matrix: ${rule.id} declares standards anchors`);
    ok(rule.privacyBoundary.length > 20, `Hosted auth matrix: ${rule.id} declares privacy boundary`);
    ok(
      rule.objectBoundary !== 'none' ||
        rule.surface === 'public_metadata' ||
        rule.id === 'core.metrics.operator-read',
      `Hosted auth matrix: ${rule.id} has an object boundary or is public metadata`,
    );
  }
}

function testImplementationEvidenceMatchesMatrix(): void {
  const requestContext = readProjectFile('src', 'service', 'request-context.ts');
  const tenantIsolation = readProjectFile('src', 'service', 'tenant-isolation.ts');
  const accountRoutes = readAccountRouteSources();
  const adminRoutes = readAdminRouteSources();
  const releaseAdminAuthorization = readProjectFile('src', 'service', 'http', 'release-admin-authorization.ts');
  const releasePolicyRoutes = readReleasePolicyControlRouteSources();
  const releaseReviewRoutes = readProjectFile('src', 'service', 'http', 'routes', 'release-review-routes.ts');
  const stripeWebhookRoutes = readProjectFile('src', 'service', 'http', 'routes', 'stripe-webhook-routes.ts');
  const pipelineAsyncRoutes = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-async-routes.ts');
  const shadowRoutes = [
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-summary-dashboard-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-simulation-history-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-policy-foundry-promotion-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-downstream-activation-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-customer-activation-routes.ts'),
    readProjectFile('src', 'service', 'http', 'routes', 'shadow-mutation-route-helpers.ts'),
  ].join('\n');

  ok(requestContext.includes('currentAdminAuthorized'), 'Hosted auth evidence: admin auth helper exists');
  ok(requestContext.includes('currentMetricsAuthorized'), 'Hosted auth evidence: metrics auth helper exists');
  ok(tenantIsolation.includes('tenantMiddleware'), 'Hosted auth evidence: tenant middleware exists');
  ok(accountRoutes.includes("c.req.header('Idempotency-Key')"), 'Hosted auth evidence: checkout requires Idempotency-Key');
  ok(adminRoutes.includes('beginAdminMutation'), 'Hosted auth evidence: admin route has mutation idempotency boundary');
  ok(releaseAdminAuthorization.includes('authorizeReleaseAdminRoute'), 'Hosted auth evidence: release routes have credential-role helper');
  ok(releasePolicyRoutes.includes('RELEASE_ADMIN_BREAK_GLASS_ROLES'), 'Hosted auth evidence: release policy break-glass routes are role-scoped');
  ok(releaseReviewRoutes.includes('RELEASE_ADMIN_BREAK_GLASS_ROLES'), 'Hosted auth evidence: release review override is role-scoped');
  ok(releasePolicyRoutes.includes('adminMutationRequest'), 'Hosted auth evidence: release policy routes use admin mutation bridge');
  ok(releaseReviewRoutes.includes('adminMutationRequest'), 'Hosted auth evidence: release review routes use admin mutation bridge');
  ok(stripeWebhookRoutes.includes('stripeWebhookService.begin'), 'Hosted auth evidence: Stripe webhook begins with service verifier');
  ok(stripeWebhookRoutes.includes("c.req.header('stripe-signature')"), 'Hosted auth evidence: Stripe signature header is read');
  ok(pipelineAsyncRoutes.includes('bmStatus.tenant.tenantId !== tenant.tenantId'), 'Hosted auth evidence: BullMQ status is tenant-bound');
  ok(pipelineAsyncRoutes.includes('job.tenantId !== tenant.tenantId'), 'Hosted auth evidence: in-process status is tenant-bound');
  ok(shadowRoutes.includes('assertTenantBoundRecord'), 'Hosted auth evidence: shadow route tenant assertion exists');
  ok(
    shadowRoutes.includes('beginShadowMutationIdempotency') &&
      shadowRoutes.includes('shadow-mutation-rate-limit-exceeded'),
    'Hosted auth evidence: shadow mutation boundary is optional idempotency plus route rate limit',
  );
}

async function testInProcessPipelineStatusRejectsCrossTenantJobId(): Promise<void> {
  const jobs = new Map<string, InProcessAsyncJob>([
    ['job_a', createAsyncJob('job_a', 'tenant_a')],
  ]);
  const tenantAApp = createAsyncRouteApp({ currentTenant: tenant('tenant_a'), inProcessJobs: jobs });
  const tenantBApp = createAsyncRouteApp({ currentTenant: tenant('tenant_b'), inProcessJobs: jobs });

  const allowed = await tenantAApp.request('/api/v1/pipeline/status/job_a');
  const denied = await tenantBApp.request('/api/v1/pipeline/status/job_a');
  const deniedBody = await denied.json() as { readonly error?: string };

  equal(allowed.status, 200, 'Hosted auth behavior: same tenant can read its in-process job status');
  equal(denied.status, 404, 'Hosted auth behavior: cross-tenant in-process job status is hidden');
  equal(deniedBody.error, 'Job not found', 'Hosted auth behavior: cross-tenant in-process lookup does not disclose ownership');
}

async function testBullMqPipelineStatusRejectsCrossTenantJobId(): Promise<void> {
  const tenantAApp = createAsyncRouteApp({ currentTenant: tenant('tenant_a'), backendMode: 'bullmq' });
  const tenantBApp = createAsyncRouteApp({ currentTenant: tenant('tenant_b'), backendMode: 'bullmq' });

  const allowed = await tenantAApp.request('/api/v1/pipeline/status/job_a');
  const denied = await tenantBApp.request('/api/v1/pipeline/status/job_a');
  const allowedBody = await allowed.json() as {
    readonly tenantContext?: { readonly tenantId?: string };
  };
  const deniedBody = await denied.json() as { readonly error?: string };

  equal(allowed.status, 200, 'Hosted auth behavior: same tenant can read its BullMQ job status');
  equal(allowedBody.tenantContext?.tenantId, 'tenant_a', 'Hosted auth behavior: BullMQ response keeps tenant owner');
  equal(denied.status, 404, 'Hosted auth behavior: cross-tenant BullMQ job status is hidden');
  equal(deniedBody.error, 'Job not found', 'Hosted auth behavior: cross-tenant BullMQ lookup does not disclose ownership');
}

function testDocsAndRunnerExposeMatrix(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const hostedTracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');

  equal(
    packageJson.scripts['test:hosted-api-authorization-matrix'],
    'tsx tests/hosted-api-authorization-matrix.test.ts',
    'Hosted auth matrix: package script is exposed',
  );
  ok(
    hostedTracker.includes('Hosted API Authorization Matrix'),
    'Hosted auth matrix: production trust tracker records Step 01',
  );
  ok(
    hostedContract.includes('src/service/hosted/hosted-api-authorization-matrix.ts'),
    'Hosted auth matrix: hosted contract points to matrix source',
  );
  ok(
    packageRunner.includes('test:hosted-api-authorization-matrix'),
    'Hosted auth matrix: package runner guard includes matrix test',
  );
}

async function main(): Promise<void> {
  testMatrixDescriptor();
  testAllHostedRoutesResolveToExactlyOneRule();
  testSensitiveBoundariesAreClassified();
  testEveryRuleCarriesEvidenceAndStandards();
  testImplementationEvidenceMatchesMatrix();
  await testInProcessPipelineStatusRejectsCrossTenantJobId();
  await testBullMqPipelineStatusRejectsCrossTenantJobId();
  testDocsAndRunnerExposeMatrix();
  deepEqual(
    [...new Set(HOSTED_API_AUTHORIZATION_RULES.map((rule) => rule.surface))].sort(),
    [
      'account_plane',
      'billing_webhook',
      'customer_auth',
      'email_webhook',
      'operator_admin',
      'public_metadata',
      'shadow_control',
      'tenant_runtime',
    ],
    'Hosted auth matrix: all expected route surfaces are represented',
  );

  ok(passed > 0, 'Hosted auth matrix: tests executed');
  console.log(`\nHosted API authorization matrix tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nHosted API authorization matrix tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
