import { existsSync } from 'node:fs';
import {
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
} from '../src/financial/fixtures/scenarios.js';
import { generateCurrentTotpCode } from '../src/service/account/account-mfa.js';
import {
  claimProcessedStripeWebhookState,
  finalizeProcessedStripeWebhookState,
  releaseProcessedStripeWebhookClaimState,
} from '../src/service/control-plane-store.js';
import {
  accountMutationHeaders,
  cleanupLiveControlPlanePgHarness,
  currentTotpStepIndex,
  ok,
  passedCount,
  startLiveControlPlanePgHarness,
  stripe,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeSubscriptionItemId,
  waitForJobStatus,
  waitForTotpStepAfter,
  workflowConsequencePack,
  workflowId,
  workflowPriceId,
  workflowStripeMetadata,
  workflowTier,
} from './live-control-plane-pg-fixtures.js';
import { runSharedPgAccountAuthScenario } from './live-control-plane-pg-account-auth-scenario.js';

async function run(): Promise<void> {
  const harness = await startLiveControlPlanePgHarness();
  const { base, paths } = harness;
  const {
    accountStorePath,
    tenantKeyStorePath,
    usageLedgerPath,
    accountUserStorePath,
    accountUserTokenStorePath,
    accountSessionStorePath,
    adminAuditPath,
    adminIdempotencyPath,
    asyncDlqPath,
    stripeWebhookPath,
    billingEntitlementPath,
    workflowEntitlementPath,
  } = paths;

  try {
    console.log('\n[Live shared control-plane PG]');

    const createAccountRes = await fetch(`${base}/api/v1/admin/accounts`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-account-1',
      },
      body: JSON.stringify({
        accountName: 'PG Hosted Co',
        contactEmail: 'ops@pg-hosted.example',
        tenantId: 'tenant-pg-live',
        tenantName: 'PG Live Tenant',
        planId: 'trial',
      }),
    });
    ok(createAccountRes.status === 201, 'Admin account create: 201');
    const createAccountBody = await createAccountRes.json() as any;
    ok(createAccountBody.account.primaryTenantId === 'tenant-pg-live', 'Admin account create: tenant stored');
    ok(createAccountBody.initialKey.apiKey.startsWith('atk_'), 'Admin account create: API key issued');
    ok(!existsSync(accountStorePath), 'Shared PG: no local account store file created');
    ok(!existsSync(accountUserStorePath), 'Shared PG: no local account user store file created');
    ok(!existsSync(accountUserTokenStorePath), 'Shared PG: no local account user token store file created');
    ok(!existsSync(accountSessionStorePath), 'Shared PG: no local account session store file created');
    ok(!existsSync(tenantKeyStorePath), 'Shared PG: no local tenant key store file created');
    ok(!existsSync(usageLedgerPath), 'Shared PG: no local usage ledger file created');
    ok(!existsSync(billingEntitlementPath), 'Shared PG: no local billing entitlement file created');
    ok(!existsSync(workflowEntitlementPath), 'Shared PG: no local workflow entitlement file created');
    ok(!existsSync(adminAuditPath), 'Shared PG: no local admin audit file created');
    ok(!existsSync(adminIdempotencyPath), 'Shared PG: no local admin idempotency file created');
    ok(!existsSync(asyncDlqPath), 'Shared PG: no local async DLQ file created');

    const createAccountReplayRes = await fetch(`${base}/api/v1/admin/accounts`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-account-1',
      },
      body: JSON.stringify({
        accountName: 'PG Hosted Co',
        contactEmail: 'ops@pg-hosted.example',
        tenantId: 'tenant-pg-live',
        tenantName: 'PG Live Tenant',
        planId: 'trial',
      }),
    });
    ok(createAccountReplayRes.status === 201, 'Admin account replay: 201');
    ok(createAccountReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin account replay: replay header set');
    ok(!existsSync(adminIdempotencyPath), 'Shared PG: no local admin idempotency file after replay');

    const tenantAuth = { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` };

    const authScenario = await runSharedPgAccountAuthScenario({
      base,
      tenantAuth,
      accountUserStorePath,
      accountUserTokenStorePath,
      accountSessionStorePath,
    });
    let { accountSessionCookie, lastOwnerTotpStep, mfaSecretBase32 } = authScenario;

    const pipelineRes = await fetch(`${base}/api/v1/pipeline/run`, {
      method: 'POST',
      headers: {
        ...tenantAuth,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-pipeline-run-1',
      },
      body: JSON.stringify({
        candidateSql: COUNTERPARTY_SQL,
        intent: COUNTERPARTY_INTENT,
        fixtures: [COUNTERPARTY_FIXTURE],
        generatedReport: COUNTERPARTY_REPORT,
        reportContract: COUNTERPARTY_REPORT_CONTRACT,
      }),
    });
    ok(pipelineRes.status === 200, 'Pipeline run via shared PG tenant: 200');
    const pipelineBody = await pipelineRes.json() as any;
    ok(pipelineBody.tenantContext.tenantId === 'tenant-pg-live', 'Pipeline run: tenant context preserved');
    ok(pipelineBody.usage.used === 1, 'Pipeline run: usage increments to 1');

    const usageRes = await fetch(`${base}/api/v1/account/usage`, { headers: tenantAuth });
    ok(usageRes.status === 200, 'Tenant usage summary: 200');
    const usageBody = await usageRes.json() as any;
    ok(usageBody.usage.used === 1, 'Tenant usage summary: PG-backed usage persisted');

    const adminUsageRes = await fetch(`${base}/api/v1/admin/usage?tenantId=tenant-pg-live`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminUsageRes.status === 200, 'Admin usage: 200');
    const adminUsageBody = await adminUsageRes.json() as any;
    ok(adminUsageBody.records.length === 1, 'Admin usage: one tenant usage record');
    ok(adminUsageBody.records[0].accountName === 'PG Hosted Co', 'Admin usage: account enrichment resolved');

    const rotateRes = await fetch(`${base}/api/v1/admin/tenant-keys/${createAccountBody.initialKey.id}/rotate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-rotate-1',
      },
      body: JSON.stringify({ planId: 'trial' }),
    });
    ok(rotateRes.status === 201, 'Tenant key rotate: 201');
    const rotateBody = await rotateRes.json() as any;
    const replacementAuth = { Authorization: `Bearer ${rotateBody.newKey.apiKey}` };

    const overlapOldRes = await fetch(`${base}/api/v1/account/usage`, { headers: tenantAuth });
    const overlapNewRes = await fetch(`${base}/api/v1/account/usage`, { headers: replacementAuth });
    ok(overlapOldRes.status === 200, 'Old key still works during overlap');
    ok(overlapNewRes.status === 200, 'Replacement key works during overlap');

    const sessionAccountAfterRotateRes = await fetch(`${base}/api/v1/account`, {
      headers: { Cookie: accountSessionCookie! },
    });
    ok(sessionAccountAfterRotateRes.status === 200, 'Account summary reflects rotated tenant key plan');
    const sessionAccountAfterRotateBody = await sessionAccountAfterRotateRes.json() as any;
    ok(sessionAccountAfterRotateBody.tenantContext.planId === 'trial', 'Account summary picks up rotated tenant plan');
    ok(sessionAccountAfterRotateBody.entitlement.effectivePlanId === 'trial', 'Entitlement sync follows rotated tenant trial access');

    const deactivateRes = await fetch(`${base}/api/v1/admin/tenant-keys/${createAccountBody.initialKey.id}/deactivate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Idempotency-Key': 'shared-control-plane-deactivate-1',
      },
    });
    ok(deactivateRes.status === 200, 'Tenant key deactivate: 200');

    const deactivatedOldRes = await fetch(`${base}/api/v1/account/usage`, { headers: tenantAuth });
    ok(deactivatedOldRes.status === 401, 'Old key blocked after deactivate');

    const suspendRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/suspend`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-suspend-1',
      },
      body: JSON.stringify({ reason: 'delinquent' }),
    });
    ok(suspendRes.status === 200, 'Suspend account: 200');

    const suspendedUsageRes = await fetch(`${base}/api/v1/account/usage`, { headers: replacementAuth });
    ok(suspendedUsageRes.status === 403, 'Suspended account blocked on tenant usage route');

    const reactivateRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/reactivate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-reactivate-1',
      },
      body: JSON.stringify({ reason: 'paid' }),
    });
    ok(reactivateRes.status === 200, 'Reactivate account: 200');

    const reactivatedUsageRes = await fetch(`${base}/api/v1/account/usage`, { headers: replacementAuth });
    ok(reactivatedUsageRes.status === 200, 'Reactivated account usable again');

    const staleSessionAfterSuspendRes = await fetch(`${base}/api/v1/auth/me`, {
      headers: { Cookie: accountSessionCookie! },
    });
    ok(staleSessionAfterSuspendRes.status === 401, 'Suspended account invalidates existing shared PG session');

    const reLoginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pg-hosted.example',
        password: 'RiverQuartz91!',
      }),
    });
    ok(reLoginRes.status === 200, 'Shared PG account can re-login after reactivate');
    const reLoginBody = await reLoginRes.json() as any;
    ok(reLoginBody.mfaRequired === true, 'Shared PG re-login still enforces MFA');

    await waitForTotpStepAfter(lastOwnerTotpStep);
    lastOwnerTotpStep = currentTotpStepIndex();
    const reLoginVerifyRes = await fetch(`${base}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: reLoginBody.challengeToken,
        code: generateCurrentTotpCode(mfaSecretBase32),
      }),
    });
    ok(reLoginVerifyRes.status === 200, 'Shared PG re-login MFA verify: 200');
    accountSessionCookie = reLoginVerifyRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
    ok(Boolean(accountSessionCookie), 'Shared PG re-login returns fresh session cookie after MFA verify');

    const failedAsyncRes = await fetch(`${base}/api/v1/pipeline/run-async`, {
      method: 'POST',
      headers: {
        ...replacementAuth,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-failed-async',
      },
      body: JSON.stringify({
        candidateSql: 123,
        intent: 'bad-intent',
      }),
    });
    ok(failedAsyncRes.status === 202, 'Shared PG async failure proof: queued for worker validation');
    const failedAsyncBody = await failedAsyncRes.json() as any;
    const failedAsyncStatus = await waitForJobStatus(
      base,
      failedAsyncBody.jobId,
      'failed',
      6000,
      replacementAuth,
    );
    ok(failedAsyncStatus.tenantContext?.tenantId === 'tenant-pg-live', 'Shared PG async failure proof: tenant context preserved');
    const sharedDlqRes = await fetch(`${base}/api/v1/admin/queue/dlq?tenantId=tenant-pg-live&limit=10`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(sharedDlqRes.status === 200, 'Shared PG async DLQ: admin route readable');
    const sharedDlqBody = await sharedDlqRes.json() as any;
    const sharedDlqRecord = sharedDlqBody.records.find((record: any) => record.jobId === failedAsyncBody.jobId);
    ok(Boolean(sharedDlqRecord), 'Shared PG async DLQ: failed job persisted');
    ok(sharedDlqRecord.backendMode === 'bullmq', 'Shared PG async DLQ: backend mode truthful');
    ok(!existsSync(asyncDlqPath), 'Shared PG async DLQ: no local file created after failure');

    const retiredCheckoutRes = await fetch(`${base}/api/v1/account/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...accountMutationHeaders(accountSessionCookie!),
        'Idempotency-Key': 'shared-control-plane-checkout-1',
      },
      body: JSON.stringify({ planId: 'trial' }),
    });
    ok(retiredCheckoutRes.status === 410, 'Retired account-plan checkout via shared PG session: 410');
    const retiredCheckoutBody = await retiredCheckoutRes.json() as any;
    ok(retiredCheckoutBody.replacementRoute === '/api/v1/account/billing/workflows/checkout', 'Retired checkout via shared PG points to workflow checkout');

    const workflowCheckoutRes = await fetch(`${base}/api/v1/account/billing/workflows/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...accountMutationHeaders(accountSessionCookie!),
        'Idempotency-Key': 'shared-control-plane-workflow-checkout-1',
      },
      body: JSON.stringify({
        workflowAction: 'create',
        workflowId,
        tier: workflowTier,
        consequencePack: workflowConsequencePack,
        downstreamSystemRef: 'customer_reporting_store.write',
        policyGatePathRef: 'customer_gate:finance-reporting',
      }),
    });
    ok(workflowCheckoutRes.status === 200, 'Workflow billing checkout via shared PG session: 200');
    const workflowCheckoutBody = await workflowCheckoutRes.json() as any;
    ok(workflowCheckoutBody.workflowId === workflowId, 'Workflow billing checkout via shared PG: workflow id echoed');
    ok(workflowCheckoutBody.tier === workflowTier, 'Workflow billing checkout via shared PG: tier echoed');
    ok(workflowCheckoutBody.stripePriceId === workflowPriceId, 'Workflow billing checkout via shared PG: workflow price used');
    const downstreamSystemRefDigest = workflowCheckoutBody.entitlement.downstreamSystemRefDigest as string;
    const policyGatePathRefDigest = workflowCheckoutBody.entitlement.policyGatePathRefDigest as string;
    ok(downstreamSystemRefDigest.startsWith('sha256:'), 'Workflow billing checkout via shared PG: downstream ref digest stored');
    ok(policyGatePathRefDigest.startsWith('sha256:'), 'Workflow billing checkout via shared PG: policy gate digest stored');
    ok(!existsSync(workflowEntitlementPath), 'Shared PG: workflow checkout avoids local workflow entitlement file');

    const listAccountsRes = await fetch(`${base}/api/v1/admin/accounts`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    const listKeysRes = await fetch(`${base}/api/v1/admin/tenant-keys`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(listAccountsRes.status === 200, 'Admin accounts list: 200');
    ok(listKeysRes.status === 200, 'Admin tenant keys list: 200');
    const listAccountsBody = await listAccountsRes.json() as any;
    const listKeysBody = await listKeysRes.json() as any;
    ok(listAccountsBody.accounts.length === 1, 'Admin accounts list: shared PG account visible');
    ok(listKeysBody.keys.length === 2, 'Admin tenant keys list: overlap lifecycle preserved');

    const attachBillingRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/stripe`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-shared-control-plane',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'shared-control-plane-attach-billing-1',
      },
      body: JSON.stringify({
        stripeCustomerId,
      }),
    });
    ok(attachBillingRes.status === 200, 'Attach Stripe customer for workflow billing: 200');
    const attachBillingBody = await attachBillingRes.json() as any;
    ok(attachBillingBody.account.billing.stripeCustomerId === stripeCustomerId, 'Attach Stripe customer for workflow billing: customer persisted');
    ok(attachBillingBody.account.billing.stripeSubscriptionId === null, 'Attach Stripe customer for workflow billing: no account-plan subscription persisted');

    const sharedClaimPayload = '{"id":"evt_pg_live_claim_1"}';
    const firstClaim = await claimProcessedStripeWebhookState({
      eventId: 'evt_pg_live_claim_1',
      eventType: 'invoice.paid',
      rawPayload: sharedClaimPayload,
    });
    ok(firstClaim.kind === 'claimed', 'Shared PG webhook claim: first claim created pending row');
    if (firstClaim.kind !== 'claimed') throw new Error('Expected first Stripe webhook claim to succeed.');
    const secondClaimPromise = claimProcessedStripeWebhookState({
      eventId: 'evt_pg_live_claim_1',
      eventType: 'invoice.paid',
      rawPayload: sharedClaimPayload,
    });
    const secondClaimWhileHeld = await Promise.race([
      secondClaimPromise.then(() => 'resolved'),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 75)),
    ]);
    ok(secondClaimWhileHeld === 'pending', 'Shared PG webhook claim: second claim waits while advisory lock is held');
    const finalizedClaim = await finalizeProcessedStripeWebhookState({
      claimId: firstClaim.claimId,
      eventId: 'evt_pg_live_claim_1',
      eventType: 'invoice.paid',
      accountId: createAccountBody.account.id,
      stripeCustomerId,
      stripeSubscriptionId,
      outcome: 'applied',
      reason: null,
      rawPayload: sharedClaimPayload,
    });
    ok(finalizedClaim.record.outcome === 'applied', 'Shared PG webhook claim: finalize persists final outcome');
    const secondClaim = await secondClaimPromise;
    ok(secondClaim.kind === 'duplicate', 'Shared PG webhook claim: duplicate sees finalized row after lock release');

    const releasedClaim = await claimProcessedStripeWebhookState({
      eventId: 'evt_pg_live_claim_release',
      eventType: 'invoice.payment_failed',
      rawPayload: '{"id":"evt_pg_live_claim_release"}',
    });
    ok(releasedClaim.kind === 'claimed', 'Shared PG webhook claim: second pending claim created');
    if (releasedClaim.kind !== 'claimed') throw new Error('Expected releasable Stripe webhook claim to succeed.');
    await releaseProcessedStripeWebhookClaimState('evt_pg_live_claim_release', releasedClaim.claimId);
    const reclaimedClaim = await claimProcessedStripeWebhookState({
      eventId: 'evt_pg_live_claim_release',
      eventType: 'invoice.payment_failed',
      rawPayload: '{"id":"evt_pg_live_claim_release"}',
    });
    ok(reclaimedClaim.kind === 'claimed', 'Shared PG webhook claim: released pending row can be claimed again');
    if (reclaimedClaim.kind !== 'claimed') throw new Error('Expected reclaimed Stripe webhook claim to succeed.');
    await finalizeProcessedStripeWebhookState({
      claimId: reclaimedClaim.claimId,
      eventId: 'evt_pg_live_claim_release',
      eventType: 'invoice.payment_failed',
      accountId: createAccountBody.account.id,
      stripeCustomerId,
      stripeSubscriptionId,
      outcome: 'ignored',
      reason: 'manual_release_test',
      rawPayload: '{"id":"evt_pg_live_claim_release"}',
    });

    const subscriptionPayload = JSON.stringify({
      id: 'evt_pg_live_sub_1',
      object: 'event',
      type: 'customer.subscription.updated',
      created: 1712553600,
      data: {
        object: {
          id: stripeSubscriptionId,
          object: 'subscription',
          customer: stripeCustomerId,
          status: 'past_due',
          metadata: workflowStripeMetadata({
            accountId: createAccountBody.account.id,
            tenantId: createAccountBody.account.primaryTenantId,
            downstreamSystemRefDigest,
            policyGatePathRefDigest,
          }),
          items: {
            data: [
              {
                id: stripeSubscriptionItemId,
                price: {
                  id: workflowPriceId,
                },
              },
            ],
          },
        },
      },
    });
    const subscriptionSignature = stripe.webhooks.generateTestHeaderString({
      payload: subscriptionPayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const webhookRes = await fetch(`${base}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': subscriptionSignature,
      },
      body: subscriptionPayload,
    });
    ok(webhookRes.status === 200, 'Shared PG webhook: first delivery accepted');
    const webhookBody = await webhookRes.json() as any;
    ok(webhookBody.accountStatus === 'active', 'Shared PG webhook: workflow past_due leaves account active');
    ok(webhookBody.workflowEntitlementStatus === 'past_due', 'Shared PG webhook: workflow entitlement marked past_due');
    const webhookReplayRes = await fetch(`${base}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': subscriptionSignature,
      },
      body: subscriptionPayload,
    });
    ok(webhookReplayRes.status === 200, 'Shared PG webhook: duplicate delivery preserved');
    ok(webhookReplayRes.headers.get('x-attestor-stripe-replay') === 'true', 'Shared PG webhook: duplicate replay header set');
    ok(!existsSync(stripeWebhookPath), 'Shared PG: no local Stripe webhook dedupe file created');
    ok(!existsSync(billingEntitlementPath), 'Shared PG: webhook lifecycle still avoids local entitlement file');
    ok(!existsSync(workflowEntitlementPath), 'Shared PG: webhook lifecycle still avoids local workflow entitlement file');

    const entitlementAfterWebhookRes = await fetch(`${base}/api/v1/account/entitlement`, {
      headers: { Authorization: `Bearer ${rotateBody.newKey.apiKey}` },
    });
    ok(entitlementAfterWebhookRes.status === 200, 'Shared PG entitlement route remains available after workflow past_due');

    const workflowAfterPastDueRes = await fetch(`${base}/api/v1/account/billing/workflows`, {
      headers: { Cookie: accountSessionCookie! },
    });
    ok(workflowAfterPastDueRes.status === 200, 'Shared PG workflow entitlements: readable after workflow past_due');
    const workflowAfterPastDueBody = await workflowAfterPastDueRes.json() as any;
    const workflowAfterPastDue = workflowAfterPastDueBody.workflows.find((entry: any) => entry.workflowId === workflowId);
    ok(workflowAfterPastDue.status === 'past_due', 'Shared PG workflow entitlements: workflow status is past_due');

    const adminEntitlementsRes = await fetch(`${base}/api/v1/admin/billing/entitlements?accountId=${createAccountBody.account.id}`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminEntitlementsRes.status === 200, 'Admin billing entitlements via shared PG: 200');
    const adminEntitlementsBody = await adminEntitlementsRes.json() as any;
    ok(adminEntitlementsBody.summary.recordCount === 1, 'Admin billing entitlements via shared PG: one record');
    ok(adminEntitlementsBody.records[0].status === 'provisioned', 'Admin billing entitlements via shared PG: account-level entitlement remains provisioned');
    ok(adminEntitlementsBody.records[0].provider === 'stripe', 'Admin billing entitlements via shared PG: Stripe customer binding reflected');

    const invoicePaidPayload = JSON.stringify({
      id: 'evt_pg_live_invoice_paid_1',
      object: 'event',
      type: 'invoice.paid',
      created: 1712555400,
      data: {
        object: {
          id: 'in_pg_live_001',
          object: 'invoice',
          customer: stripeCustomerId,
          subscription: stripeSubscriptionId,
          status: 'paid',
          currency: 'usd',
          amount_paid: 99900,
          amount_due: 99900,
          billing_reason: 'subscription_cycle',
          metadata: workflowStripeMetadata({
            accountId: createAccountBody.account.id,
            tenantId: createAccountBody.account.primaryTenantId,
            downstreamSystemRefDigest,
            policyGatePathRefDigest,
          }),
          subscription_details: {
            metadata: workflowStripeMetadata({
              accountId: createAccountBody.account.id,
              tenantId: createAccountBody.account.primaryTenantId,
              downstreamSystemRefDigest,
              policyGatePathRefDigest,
            }),
          },
          status_transitions: {
            paid_at: 1712555400,
          },
          lines: {
            object: 'list',
            has_more: false,
            data: [{
              id: 'il_pg_live_001_1',
              object: 'line_item',
              invoice: 'in_pg_live_001',
              amount: 99900,
              subtotal: 99900,
              currency: 'usd',
              description: 'Attestor Pro Workflow Monthly',
              quantity: 1,
              subscription: stripeSubscriptionId,
              pricing: {
                type: 'price_details',
                price_details: {
                  price: workflowPriceId,
                },
                unit_amount_decimal: '99900',
              },
              period: {
                start: 1712551800,
                end: 1712555400,
              },
              parent: {
                type: 'subscription_item_details',
                invoice_item_details: null,
                subscription_item_details: {
                  subscription_item: stripeSubscriptionItemId,
                  proration: false,
                },
              },
            }],
          },
        },
      },
    });
    const invoicePaidSignature = stripe.webhooks.generateTestHeaderString({
      payload: invoicePaidPayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const invoicePaidRes = await fetch(`${base}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': invoicePaidSignature,
      },
      body: invoicePaidPayload,
    });
    ok(invoicePaidRes.status === 200, 'Shared PG invoice paid webhook: accepted');
    const invoicePaidBody = await invoicePaidRes.json() as any;
    ok(invoicePaidBody.workflowEntitlementStatus === 'active', 'Shared PG invoice paid webhook: workflow entitlement restored active');

    const chargePayload = JSON.stringify({
      id: 'evt_pg_live_charge_1',
      object: 'event',
      type: 'charge.succeeded',
      created: 1712557200,
      data: {
        object: {
          id: 'ch_pg_live_001',
          object: 'charge',
          customer: stripeCustomerId,
          invoice: 'in_pg_live_001',
          payment_intent: 'pi_pg_live_001',
          amount: 99900,
          amount_refunded: 0,
          currency: 'usd',
          status: 'succeeded',
          paid: true,
          refunded: false,
          failure_code: null,
          failure_message: null,
          metadata: {
            attestorAccountId: createAccountBody.account.id,
          },
        },
      },
    });
    const chargeSignature = stripe.webhooks.generateTestHeaderString({
      payload: chargePayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    const chargeRes = await fetch(`${base}/api/v1/billing/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': chargeSignature,
      },
      body: chargePayload,
    });
    ok(chargeRes.status === 200, 'Shared PG charge webhook: accepted');

    const adminEntitlementsAfterWorkflowRes = await fetch(`${base}/api/v1/admin/billing/entitlements?accountId=${createAccountBody.account.id}`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminEntitlementsAfterWorkflowRes.status === 200, 'Admin billing entitlements via shared PG after workflow invoice: 200');
    const adminEntitlementsAfterWorkflowBody = await adminEntitlementsAfterWorkflowRes.json() as any;
    ok(adminEntitlementsAfterWorkflowBody.records[0].effectivePlanId === 'trial', 'Admin billing entitlements via shared PG: account quota compatibility plan remains trial');

    const postInvoiceLoginRes = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pg-hosted.example',
        password: 'RiverQuartz91!',
      }),
    });
    ok(postInvoiceLoginRes.status === 200, 'Shared PG post-invoice login: challenge response');
    const postInvoiceLoginBody = await postInvoiceLoginRes.json() as any;
    ok(postInvoiceLoginBody.mfaRequired === true, 'Shared PG post-invoice login still enforces MFA');

    await waitForTotpStepAfter(lastOwnerTotpStep);
    lastOwnerTotpStep = currentTotpStepIndex();
    const postInvoiceVerifyRes = await fetch(`${base}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: postInvoiceLoginBody.challengeToken,
        code: generateCurrentTotpCode(mfaSecretBase32),
      }),
    });
    ok(postInvoiceVerifyRes.status === 200, 'Shared PG post-invoice MFA verify: 200');
    accountSessionCookie = postInvoiceVerifyRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
    ok(Boolean(accountSessionCookie), 'Shared PG post-invoice MFA verify: fresh session cookie returned');

    const accountFeaturesRes = await fetch(`${base}/api/v1/account/features`, {
      headers: { Cookie: accountSessionCookie! },
    });
    ok(accountFeaturesRes.status === 200, 'Account features via shared PG: 200');
    const accountFeaturesBody = await accountFeaturesRes.json() as any;
    ok(accountFeaturesBody.summary.stripeSummaryPresent === false, 'Account features via shared PG: account-level Stripe entitlement summary stays absent');
    ok(accountFeaturesBody.features.some((entry: any) => entry.key === 'api.access' && entry.grantSource === 'plan_default'), 'Account features via shared PG: api feature remains account-plan compatibility default');

    const adminFeaturesRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/features`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminFeaturesRes.status === 200, 'Admin account features via shared PG: 200');
    const adminFeaturesBody = await adminFeaturesRes.json() as any;
    ok(adminFeaturesBody.summary.grantedCount >= 1, 'Admin account features via shared PG: granted feature count reported');

    const adminBillingExportRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/export?limit=5`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminBillingExportRes.status === 200, 'Admin account billing export via shared PG: 200');
    const adminBillingExportBody = await adminBillingExportRes.json() as any;
    const exportedCharge = adminBillingExportBody.charges.find((entry: any) => entry.chargeId === 'ch_pg_live_001');
    ok(Boolean(exportedCharge), 'Admin account billing export via shared PG: charge ledger exported');
    ok(adminBillingExportBody.entitlementFeatures.lookupKeys.length === 0, 'Admin account billing export via shared PG: no legacy account-plan entitlement lookup keys exported');
    ok(adminBillingExportBody.reconciliation.summary.status === 'partial', 'Admin account billing export via shared PG: reconciliation is partial without captured line items');
    const reconciledInvoice = adminBillingExportBody.reconciliation.invoices.find((entry: any) => entry.invoiceId === 'in_pg_live_001');
    ok(Boolean(reconciledInvoice), 'Admin account billing export via shared PG: reconciliation includes paid invoice');
    ok(reconciledInvoice.checks.lineItemsVsInvoice.status === 'unavailable', 'Admin account billing export via shared PG: line items unavailable without live Stripe fetch');
    ok(reconciledInvoice.checks.chargesVsInvoicePaid.status === 'match', 'Admin account billing export via shared PG: charges match invoice payment');

    const adminBillingReconciliationRes = await fetch(`${base}/api/v1/admin/accounts/${createAccountBody.account.id}/billing/reconciliation?limit=5`, {
      headers: { Authorization: 'Bearer admin-shared-control-plane' },
    });
    ok(adminBillingReconciliationRes.status === 200, 'Admin account billing reconciliation via shared PG: 200');
    const adminBillingReconciliationBody = await adminBillingReconciliationRes.json() as any;
    ok(adminBillingReconciliationBody.reconciliation.summary.partialCount >= 1, 'Admin account billing reconciliation via shared PG: partial invoice counted');
    ok(adminBillingReconciliationBody.reconciliation.summary.attentionCount === 0, 'Admin account billing reconciliation via shared PG: no reconciliation drift');

    console.log(`  Shared control-plane PG tests: ${passedCount()} passed, 0 failed\n`);
  } finally {
    await cleanupLiveControlPlanePgHarness(harness);
  }
}

run().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Live shared control-plane PG test failed:', err);
  process.exit(1);
});
