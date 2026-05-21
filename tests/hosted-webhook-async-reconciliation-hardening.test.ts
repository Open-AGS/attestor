import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS,
  HOSTED_WEBHOOK_ASYNC_RECONCILIATION_HARDENING_VERSION,
  hostedWebhookAsyncReconciliationHardeningProfile,
  requireHostedWebhookAsyncReconciliationGuard,
  type HostedWebhookAsyncReconciliationControl,
} from '../src/service/hosted-webhook-async-reconciliation-hardening.js';

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

function hasControl(id: string, control: HostedWebhookAsyncReconciliationControl): void {
  const guard = requireHostedWebhookAsyncReconciliationGuard(id);
  ok(
    guard.requiredControls.includes(control),
    `Hosted webhook/async reconciliation: ${id} requires ${control}`,
  );
}

function testProfileDescriptor(): void {
  const profile = hostedWebhookAsyncReconciliationHardeningProfile();

  equal(
    profile.version,
    HOSTED_WEBHOOK_ASYNC_RECONCILIATION_HARDENING_VERSION,
    'Hosted webhook/async reconciliation: version is exported',
  );
  equal(
    profile.guards.length,
    HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS.length,
    'Hosted webhook/async reconciliation: profile exports every guard',
  );
  includes(
    profile.posture,
    'provider event ordering',
    'Hosted webhook/async reconciliation: posture includes provider ordering',
  );
  includes(
    profile.unresolvedProductionDependency,
    'webhook smoke test',
    'Hosted webhook/async reconciliation: production dependency remains explicit',
  );
}

function testEveryGuardIsCompleteAndSecretSafe(): void {
  const ids = new Set<string>();

  for (const guard of HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS) {
    ok(!ids.has(guard.id), `Hosted webhook/async reconciliation: ${guard.id} is unique`);
    ids.add(guard.id);
    ok(guard.surfaces.length > 0, `Hosted webhook/async reconciliation: ${guard.id} declares surfaces`);
    ok(guard.reconciliationRisks.length > 0, `Hosted webhook/async reconciliation: ${guard.id} declares risks`);
    ok(guard.requiredControls.length > 0, `Hosted webhook/async reconciliation: ${guard.id} declares controls`);
    ok(
      guard.requiredControls.includes('privacy_minimized_observability'),
      `Hosted webhook/async reconciliation: ${guard.id} includes privacy-minimized observability`,
    );
    ok(guard.orderingBoundary.length > 40, `Hosted webhook/async reconciliation: ${guard.id} declares ordering boundary`);
    ok(guard.duplicateBoundary.length > 40, `Hosted webhook/async reconciliation: ${guard.id} declares duplicate boundary`);
    ok(guard.failureBoundary.length > 40, `Hosted webhook/async reconciliation: ${guard.id} declares failure boundary`);
    ok(guard.recoveryBoundary.length > 40, `Hosted webhook/async reconciliation: ${guard.id} declares recovery boundary`);
    ok(guard.privacyBoundary.length > 40, `Hosted webhook/async reconciliation: ${guard.id} declares privacy boundary`);
    ok(guard.implementationEvidence.every(fileExists), `Hosted webhook/async reconciliation: ${guard.id} evidence files exist`);
    ok(guard.validation.every(fileExists), `Hosted webhook/async reconciliation: ${guard.id} validation files exist`);
    ok(
      guard.standards.some((standard) => standard.includes('Stripe') || standard.includes('BullMQ') || standard.includes('OWASP')),
      `Hosted webhook/async reconciliation: ${guard.id} is anchored to external engineering guidance`,
    );
  }

  excludes(
    JSON.stringify(HOSTED_WEBHOOK_ASYNC_RECONCILIATION_GUARDS),
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/u,
    'Hosted webhook/async reconciliation: contract does not contain live secrets',
  );
}

function testControlContractsForCriticalFlows(): void {
  hasControl('stripe.webhook-ingress', 'raw_body_signature_verification');
  hasControl('stripe.webhook-ingress', 'payload_hash_conflict_rejection');
  hasControl('stripe.webhook-ingress', 'claim_release_on_failure');
  hasControl('stripe.billing-convergence', 'provider_event_order_guard');
  hasControl('stripe.billing-convergence', 'entitlement_read_model_convergence');
  hasControl('email.provider-webhooks', 'shared_store_required_in_ha');
  hasControl('async.tenant-execution', 'tenant_quota_and_rate_limit');
  hasControl('async.tenant-execution', 'worker_retry_backoff_policy');
  hasControl('async.tenant-execution', 'worker_stalled_job_limit');
  hasControl('async.dead-letter-recovery', 'terminal_failure_dead_letter');
  hasControl('async.dead-letter-recovery', 'operator_retry_recovery');
}

function testImplementationEvidenceMatchesSource(): void {
  const stripeRoutes = readProjectFile('src', 'service', 'http', 'routes', 'stripe-webhook-routes.ts');
  const stripeService = readProjectFile('src', 'service', 'application', 'stripe-webhook-service.ts');
  const stripeProcessor = readProjectFile('src', 'service', 'application', 'stripe-webhook-billing-processor.ts');
  const accountStore = readProjectFile('src', 'service', 'account-store.ts');
  const controlPlaneStore = readProjectFile('src', 'service', 'control-plane-store.ts');
  const emailService = readProjectFile('src', 'service', 'application', 'email-webhook-service.ts');
  const pipelineAsyncRoutes = readProjectFile('src', 'service', 'http', 'routes', 'pipeline-async-routes.ts');
  const asyncPipeline = readProjectFile('src', 'service', 'async-pipeline.ts');
  const deadLetterStore = readProjectFile('src', 'service', 'async-dead-letter-store.ts');

  includes(stripeRoutes, 'const rawPayload = await c.req.text()', 'Hosted webhook/async evidence: Stripe route preserves raw payload');
  includes(stripeRoutes, "c.req.header('stripe-signature')", 'Hosted webhook/async evidence: Stripe route reads signature');
  includes(stripeService, 'webhooks.constructEvent', 'Hosted webhook/async evidence: Stripe service verifies signed payload');
  includes(stripeService, 'payloadHash', 'Hosted webhook/async evidence: Stripe service hashes provider payload');
  includes(stripeService, 'claimStripeBillingEvent', 'Hosted webhook/async evidence: Stripe shared ledger claim exists');
  includes(stripeService, 'x-attestor-stripe-replay', 'Hosted webhook/async evidence: duplicate replay header exists');
  includes(stripeService, 'releaseClaim', 'Hosted webhook/async evidence: claims can be released on failure');
  includes(stripeProcessor, 'stale_subscription_event', 'Hosted webhook/async evidence: stale subscription events are ignored');
  includes(stripeProcessor, 'stale_invoice_event', 'Hosted webhook/async evidence: stale invoice events are ignored');
  includes(stripeProcessor, 'syncHostedBillingEntitlement', 'Hosted webhook/async evidence: billing entitlement convergence exists');
  includes(stripeProcessor, 'upsertStripeInvoiceLineItems', 'Hosted webhook/async evidence: invoice line item ledger persistence exists');
  includes(stripeProcessor, 'upsertStripeCharges', 'Hosted webhook/async evidence: charge ledger persistence exists');
  includes(accountStore, 'lastSubscriptionEventCreatedAt', 'Hosted webhook/async evidence: file store tracks subscription event ordering');
  includes(accountStore, 'lastInvoiceEventCreatedAt', 'Hosted webhook/async evidence: file store tracks invoice event ordering');
  includes(accountStore, 'isIncomingProviderEventOlder', 'Hosted webhook/async evidence: file store rejects stale provider ordering');
  includes(controlPlaneStore, 'lastSubscriptionEventCreatedAt', 'Hosted webhook/async evidence: shared store tracks subscription event ordering');
  includes(controlPlaneStore, 'lastInvoiceEventCreatedAt', 'Hosted webhook/async evidence: shared store tracks invoice event ordering');
  includes(emailService, 'verifySignedSendGridWebhook', 'Hosted webhook/async evidence: SendGrid signatures are verified');
  includes(emailService, 'verifySignedMailgunWebhook', 'Hosted webhook/async evidence: Mailgun signatures are verified');
  includes(emailService, 'mailgunSignatureTokenDigest', 'Hosted webhook/async evidence: Mailgun replay token is digested');
  includes(emailService, 'recordEmailProviderEvent', 'Hosted webhook/async evidence: email provider events are deduped');
  includes(emailService, 'ATTESTOR_EMAIL_WEBHOOK_ALLOW_LOCAL_STORE', 'Hosted webhook/async evidence: local email webhook store fallback is an explicit risk override');
  includes(emailService, 'Email provider webhooks require shared control-plane storage', 'Hosted webhook/async evidence: email webhooks fail closed without shared storage');
  includes(pipelineAsyncRoutes, 'pipelineUsageService.check', 'Hosted webhook/async evidence: async route checks quota');
  includes(pipelineAsyncRoutes, 'reserveTenantPipelineRequest', 'Hosted webhook/async evidence: async route reserves rate budget');
  includes(pipelineAsyncRoutes, 'pipelineDeadLetterService.record', 'Hosted webhook/async evidence: in-process async failures enter DLQ');
  includes(asyncPipeline, 'attempts', 'Hosted webhook/async evidence: BullMQ attempts are configured');
  includes(asyncPipeline, 'backoff', 'Hosted webhook/async evidence: BullMQ backoff is configured');
  includes(asyncPipeline, 'maxStalledCount', 'Hosted webhook/async evidence: stalled-job limit is configured');
  includes(asyncPipeline, 'acquireTenantAsyncExecutionLease', 'Hosted webhook/async evidence: tenant active execution lease exists');
  includes(asyncPipeline, 'acquireTenantAsyncWeightedDispatchPermit', 'Hosted webhook/async evidence: tenant weighted dispatch exists');
  includes(asyncPipeline, "worker.on('failed'", 'Hosted webhook/async evidence: worker failed handler exists');
  includes(asyncPipeline, 'persistTerminalDeadLetterJob', 'Hosted webhook/async evidence: terminal failures persist DLQ records');
  includes(asyncPipeline, 'retryFailedPipelineJob', 'Hosted webhook/async evidence: failed jobs can be retried');
  includes(deadLetterStore, 'normalizeAsyncDeadLetterRecord', 'Hosted webhook/async evidence: DLQ records are normalized');
}

function testDocsAndRunnerExposeGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const packageRunner = readProjectFile('tests', 'package-script-runner.test.ts');
  const hostedTracker = readProjectFile('docs', '02-architecture', 'hosted-production-trust-hardening.md');
  const hostedContract = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');

  equal(
    packageJson.scripts['test:hosted-webhook-async-reconciliation-hardening'],
    'tsx tests/hosted-webhook-async-reconciliation-hardening.test.ts',
    'Hosted webhook/async reconciliation: package script is exposed',
  );
  includes(
    packageRunner,
    'test:hosted-webhook-async-reconciliation-hardening',
    'Hosted webhook/async reconciliation: package runner includes guard test',
  );
  includes(
    hostedTracker,
    'Webhook And Async Reconciliation Hardening',
    'Hosted webhook/async reconciliation: tracker records Step 03',
  );
  includes(
    hostedTracker,
    'src/service/hosted-webhook-async-reconciliation-hardening.ts',
    'Hosted webhook/async reconciliation: tracker points to source',
  );
  includes(
    hostedContract,
    'machine-readable webhook and async reconciliation hardening profile',
    'Hosted webhook/async reconciliation: contract links machine-readable profile',
  );
}

testProfileDescriptor();
testEveryGuardIsCompleteAndSecretSafe();
testControlContractsForCriticalFlows();
testImplementationEvidenceMatchesSource();
testDocsAndRunnerExposeGuard();

console.log(`Hosted webhook/async reconciliation hardening tests: ${passed} passed, 0 failed`);
