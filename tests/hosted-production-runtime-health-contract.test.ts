import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_PRODUCTION_RUNTIME_HEALTH_CONTRACT_VERSION,
  HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS,
  hostedProductionRuntimeHealthContractProfile,
  requireHostedProductionRuntimeHealthGuard,
  type HostedProductionRuntimeHealthControl,
} from '../src/service/hosted-production-runtime-health-contract.js';

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

function fileExists(projectPath: string): boolean {
  return existsSync(join(process.cwd(), projectPath.split('#')[0]));
}

function hasControl(id: string, control: HostedProductionRuntimeHealthControl): void {
  const guard = requireHostedProductionRuntimeHealthGuard(id);
  ok(
    guard.requiredControls.includes(control),
    `Hosted runtime health: ${id} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedProductionRuntimeHealthContractProfile();

  equal(
    profile.version,
    HOSTED_PRODUCTION_RUNTIME_HEALTH_CONTRACT_VERSION,
    'Hosted runtime health: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS.length,
    'Hosted runtime health: profile exports every guard',
  );
  includes(
    profile.posture,
    'process liveness, dependency readiness',
    'Hosted runtime health: posture separates liveness and readiness',
  );
  includes(
    profile.unresolvedProductionDependency,
    'worker probes',
    'Hosted runtime health: production dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();

  for (const guard of HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS) {
    ok(!ids.has(guard.id), `Hosted runtime health: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.probes.length > 0, `Hosted runtime health: ${guard.id} declares probes`);
    ok(guard.runtimeRisks.length > 0, `Hosted runtime health: ${guard.id} declares runtime risks`);
    ok(guard.requiredControls.length > 0, `Hosted runtime health: ${guard.id} declares controls`);
    ok(
      guard.requiredControls.includes('privacy_minimized_diagnostics'),
      `Hosted runtime health: ${guard.id} requires privacy-minimized diagnostics`,
    );
    ok(
      guard.requiredControls.includes('no_secret_output'),
      `Hosted runtime health: ${guard.id} forbids secret output`,
    );
    ok(guard.livenessBoundary.length > 80, `Hosted runtime health: ${guard.id} declares liveness boundary`);
    ok(guard.readinessBoundary.length > 80, `Hosted runtime health: ${guard.id} declares readiness boundary`);
    ok(guard.startupBoundary.length > 80, `Hosted runtime health: ${guard.id} declares startup boundary`);
    ok(guard.privacyBoundary.length > 80, `Hosted runtime health: ${guard.id} declares privacy boundary`);
    ok(
      guard.implementationEvidence.every(fileExists),
      `Hosted runtime health: ${guard.id} evidence files exist`,
    );
    ok(
      guard.validation.every(fileExists),
      `Hosted runtime health: ${guard.id} validation files exist`,
    );
    ok(
      guard.standards.some((standard) =>
        standard.includes('Kubernetes') ||
        standard.includes('SRE') ||
        standard.includes('OWASP') ||
        standard.includes('Stripe') ||
        standard.includes('BullMQ') ||
        standard.includes('NIST'),
      ),
      `Hosted runtime health: ${guard.id} is anchored to external engineering guidance`,
    );
  }

  excludes(
    JSON.stringify(HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres:\/\/[^"'\s]+|redis:\/\/[^"'\s]+/u,
    'Hosted runtime health: contract does not contain live secrets or connection strings',
  );
}

function testControlContractsForCriticalBoundaries(): void {
  hasControl('api.process-health', 'liveness_process_only');
  hasControl('api.process-health', 'startup_bootstrap_separate_from_readiness');
  hasControl('api.dependency-readiness', 'readiness_dependency_gate');
  hasControl('api.dependency-readiness', 'ready_returns_503_on_blockers');
  hasControl('api.dependency-readiness', 'release_runtime_durability_gate');
  hasControl('api.dependency-readiness', 'production_storage_path_gate');
  hasControl('api.dependency-readiness', 'shared_authority_runtime_gate');
  hasControl('api.dependency-readiness', 'ha_shared_control_plane_gate');
  hasControl('worker.health-readiness', 'worker_shutdown_not_ready');
  hasControl('worker.health-readiness', 'worker_redis_readiness_gate');
  hasControl('async.queue-runtime', 'queue_retry_backoff_policy');
  hasControl('async.queue-runtime', 'tenant_queue_capacity_guard');
  hasControl('async.queue-runtime', 'dead_letter_recovery_visible');
  hasControl('storage.authority-readiness', 'runtime_profile_explicit_in_production_like_env');
  hasControl('storage.authority-readiness', 'degraded_grant_store_visible');
  hasControl('webhook.ingress-runtime', 'webhook_signature_secret_required');
  hasControl('webhook.ingress-runtime', 'webhook_provider_signature_verification');
  hasControl('webhook.ingress-runtime', 'webhook_dedupe_store_gate');
}

function testImplementationEvidenceMatchesSource(): void {
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');
  const worker = readProjectFile('src', 'service', 'worker.ts');
  const asyncPipeline = readProjectFile('src', 'service', 'async-pipeline.ts');
  const runtimeProfile = readProjectFile('src', 'service', 'bootstrap', 'runtime-profile.ts');
  const sharedAuthority = readProjectFile('src', 'service', 'bootstrap', 'shared-authority-readiness.ts');
  const storagePath = readProjectFile('src', 'service', 'bootstrap', 'production-storage-path.ts');
  const highAvailability = readProjectFile('src', 'service', 'high-availability.ts');
  const stripeWebhookService = readProjectFile('src', 'service', 'application', 'stripe-webhook-service.ts');
  const emailWebhookService = readProjectFile('src', 'service', 'application', 'email-webhook-service.ts');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(coreRoutes, "app.get('/api/v1/health'", 'Hosted runtime health evidence: API health route exists');
  includes(coreRoutes, "c.header('cache-control', 'no-store')", 'Hosted runtime health evidence: API probes are no-store');
  includes(coreRoutes, "app.get('/api/v1/ready'", 'Hosted runtime health evidence: API ready route exists');
  includes(coreRoutes, 'checks.releaseRuntime', 'Hosted runtime health evidence: readiness checks release runtime durability');
  includes(coreRoutes, 'checks.productionStoragePath', 'Hosted runtime health evidence: readiness checks production storage path');
  includes(coreRoutes, 'checks.sharedAuthorityRuntime', 'Hosted runtime health evidence: readiness checks shared authority runtime');
  includes(coreRoutes, 'checks.releaseSigningProvider', 'Hosted runtime health evidence: readiness checks release signing provider');
  includes(coreRoutes, 'checks.highAvailability', 'Hosted runtime health evidence: readiness checks HA posture');
  includes(coreRoutes, 'const status = ready ? 200 : 503', 'Hosted runtime health evidence: readiness returns 503 on blockers');
  includes(coreRoutes, 'evaluateSharedAuthorityRuntimeReadiness', 'Hosted runtime health evidence: shared authority probe is called');
  includes(coreRoutes, 'evaluateProductionStoragePath', 'Hosted runtime health evidence: production storage path probe is called');
  includes(worker, "path !== '/health' && path !== '/ready'", 'Hosted runtime health evidence: worker exposes health and ready routes only');
  includes(worker, "res.setHeader('cache-control', 'no-store')", 'Hosted runtime health evidence: worker probes are no-store');
  includes(worker, 'checkRedisHealth', 'Hosted runtime health evidence: worker readiness checks Redis');
  includes(worker, 'shuttingDown', 'Hosted runtime health evidence: worker shutdown state gates readiness');
  includes(worker, 'ready ? 200 : 503', 'Hosted runtime health evidence: worker readiness returns 503 on blockers');
  includes(worker, 'ATTESTOR_WORKER_HEALTH_PORT', 'Hosted runtime health evidence: worker health port is explicit');
  includes(asyncPipeline, 'attempts', 'Hosted runtime health evidence: async queue attempts are configured');
  includes(asyncPipeline, 'backoff', 'Hosted runtime health evidence: async queue backoff is configured');
  includes(asyncPipeline, 'maxStalledCount', 'Hosted runtime health evidence: stalled-job limit is configured');
  includes(asyncPipeline, 'enableOfflineQueue: false', 'Hosted runtime health evidence: queue client avoids offline buffering');
  includes(asyncPipeline, 'getTenantAsyncQueueSnapshot', 'Hosted runtime health evidence: tenant queue snapshot exists');
  includes(asyncPipeline, 'canEnqueueTenantAsyncJob', 'Hosted runtime health evidence: tenant queue capacity guard exists');
  includes(asyncPipeline, 'persistTerminalDeadLetterJob', 'Hosted runtime health evidence: terminal DLQ persistence exists');
  includes(asyncPipeline, 'checkRedisHealth', 'Hosted runtime health evidence: Redis health probe exists');
  includes(runtimeProfile, 'ATTESTOR_RUNTIME_PROFILE_ENV', 'Hosted runtime health evidence: runtime profile env is explicit');
  includes(runtimeProfile, 'isProductionLikeRuntimeEnv', 'Hosted runtime health evidence: production-like runtime requires explicit profile');
  includes(runtimeProfile, 'RuntimeProfileDurabilityError', 'Hosted runtime health evidence: durability can fail closed');
  includes(sharedAuthority, 'requestPathUsesSharedStores', 'Hosted runtime health evidence: shared request path readiness is explicit');
  includes(storagePath, 'readyForSelectedProfile', 'Hosted runtime health evidence: storage path readiness is explicit');
  includes(storagePath, 'exposesConnectionStrings: false', 'Hosted runtime health evidence: storage diagnostics avoid connection strings');
  includes(highAvailability, 'REDIS_URL-backed external Redis', 'Hosted runtime health evidence: HA requires external Redis');
  includes(highAvailability, 'ATTESTOR_CONTROL_PLANE_PG_URL', 'Hosted runtime health evidence: HA requires shared control plane');
  includes(highAvailability, 'ATTESTOR_BILLING_LEDGER_PG_URL', 'Hosted runtime health evidence: public hosted requires shared billing ledger');
  includes(stripeWebhookService, 'webhookSecret', 'Hosted runtime health evidence: Stripe webhook secret is required by service');
  includes(stripeWebhookService, 'webhooks.constructEvent', 'Hosted runtime health evidence: Stripe signature verification uses SDK');
  includes(stripeWebhookService, 'claimStripeBillingEvent', 'Hosted runtime health evidence: Stripe webhook dedupe claim exists');
  includes(emailWebhookService, 'verifySignedSendGridWebhook', 'Hosted runtime health evidence: SendGrid webhook signatures are verified');
  includes(emailWebhookService, 'verifySignedMailgunWebhook', 'Hosted runtime health evidence: Mailgun webhook signatures are verified');
  includes(emailWebhookService, 'recordEmailProviderEvent', 'Hosted runtime health evidence: email provider events are deduped');
  equal(
    packageJson.scripts['test:hosted-production-runtime-health-contract'],
    'tsx tests/hosted-production-runtime-health-contract.test.ts',
    'Hosted runtime health: package script is exposed',
  );
}

function testDocsAndRunnerExposeContract(): void {
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');
  const hostedTracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');

  includes(
    packageRunner,
    'test:hosted-production-runtime-health-contract',
    'Hosted runtime health: package runner includes contract test',
  );
  includes(
    hostedTracker,
    'Production Runtime Health Contract',
    'Hosted runtime health: tracker records Step 05',
  );
  includes(
    hostedTracker,
    'src/service/hosted-production-runtime-health-contract.ts',
    'Hosted runtime health: tracker points to source',
  );
  includes(
    hostedContract,
    'machine-readable production runtime health contract',
    'Hosted runtime health: hosted contract links machine-readable profile',
  );
  includes(
    productionReadiness,
    'Production runtime health contract',
    'Hosted runtime health: production readiness guide names the contract',
  );
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testControlContractsForCriticalBoundaries();
testImplementationEvidenceMatchesSource();
testDocsAndRunnerExposeContract();

console.log(`Hosted production runtime health contract tests: ${passed} passed, 0 failed`);
