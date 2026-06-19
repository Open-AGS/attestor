import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SERVICE_ROOT = join(process.cwd(), 'src', 'service');

let passed = 0;

function listFiles(...segments: string[]): readonly string[] {
  return readdirSync(join(SERVICE_ROOT, ...segments))
    .filter((entry) => statSync(join(SERVICE_ROOT, ...segments, entry)).isFile())
    .sort();
}

function listDirectories(...segments: string[]): readonly string[] {
  return readdirSync(join(SERVICE_ROOT, ...segments))
    .filter((entry) => statSync(join(SERVICE_ROOT, ...segments, entry)).isDirectory())
    .sort();
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testServiceDirectoriesAreResponsibilityNamed(): void {
  equal(
    listDirectories(),
    [
      'account',
      'api-types',
      'application',
      'async',
      'billing',
      'bootstrap',
      'control-plane-store',
      'hosted',
      'http',
      'pipeline',
      'policy-foundry',
      'release',
      'runtime',
      'shadow',
    ],
    'Service organization map: top-level service directories stay responsibility-named',
  );
}

function testRootKeepsOnlyCrossCuttingFiles(): void {
  equal(
    listFiles(),
    [
      'admin-audit-log.ts',
      'admin-idempotency-store.ts',
      'agent-loop-abuse-guard.ts',
      'api-server.ts',
      'api-types.ts',
      'consequence-shared-atomic-stores.ts',
      'consequence-shared-history-outbox-store-types.ts',
      'consequence-shared-history-outbox-store.ts',
      'control-plane-backup.ts',
      'control-plane-store.ts',
      'deployment-safety.ts',
      'distributed-types.ts',
      'file-store.ts',
      'generic-admission-protected-route.ts',
      'high-availability.ts',
      'hono-context.d.ts',
      'http-production-edge-contract.ts',
      'json-stable.ts',
      'mailgun-email-webhook.ts',
      'observability-types.ts',
      'observability.ts',
      'plan-catalog.ts',
      'public-route-rate-limit.ts',
      'rate-limit.ts',
      'redis-auto.ts',
      'redis-production.ts',
      'request-context.ts',
      'request-observability-middleware.ts',
      'secret-derivation.ts',
      'secret-envelope.ts',
      'sendgrid-email-webhook.ts',
      'site-hosted-return-page.ts',
      'site-support.ts',
      'site.ts',
      'tenant-admin.ts',
      'tenant-isolation.ts',
      'tenant-key-store.ts',
      'tenant-rls.ts',
      'trusted-proxy.ts',
      'usage-meter.ts',
      'version.ts',
      'webhook-rate-limit.ts',
      'workflow-entitlement-catalog.ts',
      'workflow-entitlement-store.ts',
      'workflow-entitlement.ts',
    ],
    'Service organization map: root files stay limited to cross-cutting service support',
  );
}

function testMovedFamiliesDoNotRegressToRoot(): void {
  const rootFiles = listFiles();
  const forbiddenRootPatterns = [
    /^account-/u,
    /^auth-abuse-guard\.ts$/u,
    /^async-/u,
    /^billing-/u,
    /^email-delivery/u,
    /^finance-release-route-support\.ts$/u,
    /^hosted-/u,
    /^pipeline-/u,
    /^policy-foundry-/u,
    /^release-/u,
    /^shadow-persistence-store\.ts$/u,
    /^stripe-/u,
  ];
  const offenders = rootFiles.filter((fileName) =>
    forbiddenRootPatterns.some((pattern) => pattern.test(fileName)),
  );

  equal(offenders, [], 'Service organization map: moved service families do not regress to root');
}

function testResponsibilityDirectoryCountsMatchCloseoutMap(): void {
  const expectedCounts: Readonly<Record<string, number>> = {
    account: 13,
    'api-types': 7,
    application: 18,
    async: 7,
    billing: 13,
    bootstrap: 21,
    'control-plane-store': 24,
    hosted: 11,
    http: 2,
    pipeline: 2,
    'policy-foundry': 3,
    release: 16,
    runtime: 2,
    shadow: 11,
  };

  for (const [directory, expectedCount] of Object.entries(expectedCounts)) {
    equal(
      listFiles(directory).length,
      expectedCount,
      `Service organization map: ${directory} file count matches closeout map`,
    );
  }

  equal(listFiles().length, 45, 'Service organization map: root file count matches closeout map');
}

function testNestedBillingStripeBoundaryIsPreserved(): void {
  equal(
    listDirectories('billing'),
    ['stripe'],
    'Service organization map: billing keeps Stripe provider support in a nested provider boundary',
  );
  ok(
    listFiles('billing', 'stripe').length >= 4,
    'Service organization map: billing/stripe has provider-specific support files',
  );
}

testServiceDirectoriesAreResponsibilityNamed();
testRootKeepsOnlyCrossCuttingFiles();
testMovedFamiliesDoNotRegressToRoot();
testResponsibilityDirectoryCountsMatchCloseoutMap();
testNestedBillingStripeBoundaryIsPreserved();

console.log(`Service organization map tests: ${passed} passed, 0 failed`);
