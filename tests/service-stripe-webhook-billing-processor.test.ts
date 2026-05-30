import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { AccountStoreError, type HostedAccountRecord } from '../src/service/account/account-store.js';
import {
  createStripeWebhookBillingProcessor,
  type StripeWebhookBillingProcessorDeps,
} from '../src/service/application/stripe-webhook-billing-processor.js';
import type {
  StripeWebhookDedupeFinalizationInput,
  StripeWebhookProcessingHandle,
  StripeWebhookSharedFinalizationInput,
} from '../src/service/application/stripe-webhook-service.js';

function stripeEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
  return {
    id: 'evt_123',
    object: 'event',
    api_version: null,
    created: 1_776_768_000,
    data: {
      object: {},
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'invoice.paid',
    ...overrides,
  } as Stripe.Event;
}

function createWebhook(
  event: Stripe.Event,
  overrides: Partial<StripeWebhookProcessingHandle> = {},
): StripeWebhookProcessingHandle {
  return {
    event,
    rawPayload: '{"id":"evt_123"}',
    payloadHash: 'payload-hash',
    sharedBillingLedger: false,
    sharedControlPlaneWebhookState: false,
    controlPlaneClaimId: null,
    finalizedSharedEvent: false,
    finalizedControlPlaneEvent: false,
    async finalizeSharedEvent() {},
    async finalizeDedupe() {},
    async releaseClaim() {},
    ...overrides,
  };
}

function createDeps(
  overrides: Partial<StripeWebhookBillingProcessorDeps> = {},
): StripeWebhookBillingProcessorDeps {
  const deps: StripeWebhookBillingProcessorDeps = {
    observeBillingWebhookEvent: () => {},
    isSupportedStripeWebhookEvent: () => false,
    stripeReferenceId: (value) => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
        return (value as { id: string }).id;
      }
      return null;
    },
    parseStripeInvoiceStatus: () => null,
    stripeInvoicePriceId: () => null,
    metadataStringValue: () => null,
    applyStripeSubscriptionStateState: async () => {
      throw new Error('unused applyStripeSubscriptionStateState');
    },
    applyStripeInvoiceStateState: async () => {
      throw new Error('unused applyStripeInvoiceStateState');
    },
    applyStripeCheckoutCompletionState: async () => {
      throw new Error('unused applyStripeCheckoutCompletionState');
    },
    upsertWorkflowEntitlementFromStripeState: async () => {
      throw new Error('unused upsertWorkflowEntitlementFromStripeState');
    },
    findHostedAccountByStripeRefs: async () => ({
      record: null,
      matchReason: 'none',
    }),
    findHostedPlanByStripePriceId: () => null,
    resolvePlanSpec: (() => {
      throw new Error('unused resolvePlanSpec');
    }) as StripeWebhookBillingProcessorDeps['resolvePlanSpec'],
    DEFAULT_HOSTED_PLAN_ID: 'starter',
    syncTenantPlanByTenantIdState: async () => ({
      record: null,
      path: null,
    }),
    syncHostedBillingEntitlement: async () => {
      throw new Error('unused syncHostedBillingEntitlement');
    },
    revokeAccountSessionsForLifecycleChange: async () => 0,
    appendAdminAuditRecordState: async () => {
      throw new Error('unused appendAdminAuditRecordState');
    },
    billingEntitlementView: () => ({}),
    extractInvoiceLineItemSnapshotsFromInvoice: () => ({
      lineItems: [],
      hasMore: false,
    }),
    listHostedStripeActiveEntitlements: async () => [],
    extractActiveEntitlementsFromSummary: () => [],
    listHostedStripeInvoiceLineItems: async () => [],
    upsertStripeInvoiceLineItems: async () => ({
      recordCount: 0,
      records: [],
    }),
    parseStripeChargeStatus: () => null,
    getHostedPlan: () => null,
    upsertStripeCharges: async () => ({
      recordCount: 0,
      records: [],
    }),
    unixSecondsToIso: () => '2026-04-21T10:00:00.000Z',
    resolvePlanStripePrice: (() => {
      throw new Error('unused resolvePlanStripePrice');
    }) as StripeWebhookBillingProcessorDeps['resolvePlanStripePrice'],
  };
  return {
    ...deps,
    ...overrides,
  };
}

function hostedAccount(overrides: Partial<HostedAccountRecord> = {}): HostedAccountRecord {
  const record: HostedAccountRecord = {
    id: 'acct_123',
    accountName: 'Acme',
    contactEmail: 'owner@example.test',
    primaryTenantId: 'tenant_123',
    status: 'active',
    createdAt: '2026-04-21T09:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    suspendedAt: null,
    archivedAt: null,
    billing: {
      provider: 'stripe',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripeSubscriptionStatus: 'active',
      stripePriceId: 'price_123',
      lastCheckoutSessionId: null,
      lastCheckoutCompletedAt: null,
      lastCheckoutPlanId: null,
      lastSubscriptionEventId: 'evt_new_subscription',
      lastSubscriptionEventType: 'customer.subscription.updated',
      lastSubscriptionEventCreatedAt: '2026-04-21T11:00:00.000Z',
      lastInvoiceId: 'in_123',
      lastInvoiceStatus: 'paid',
      lastInvoiceCurrency: 'usd',
      lastInvoiceAmountPaid: 149900,
      lastInvoiceAmountDue: 149900,
      lastInvoiceEventId: 'evt_new_invoice',
      lastInvoiceEventType: 'invoice.paid',
      lastInvoiceEventCreatedAt: '2026-04-21T11:00:00.000Z',
      lastInvoiceProcessedAt: '2026-04-21T11:00:01.000Z',
      lastInvoicePaidAt: '2026-04-21T11:00:00.000Z',
      delinquentSince: null,
      lastWebhookEventId: 'evt_new_invoice',
      lastWebhookEventType: 'invoice.paid',
      lastWebhookEventCreatedAt: '2026-04-21T11:00:00.000Z',
      lastWebhookProcessedAt: '2026-04-21T11:00:01.000Z',
    },
  };
  return {
    ...record,
    ...overrides,
    billing: {
      ...record.billing,
      ...(overrides.billing ?? {}),
    },
  };
}

async function testUnsupportedEventFinalizesFileDedupe(): Promise<void> {
  const observed: Array<[string, string]> = [];
  let dedupeFinalization: StripeWebhookDedupeFinalizationInput | null = null;
  const processor = createStripeWebhookBillingProcessor(createDeps({
    observeBillingWebhookEvent: (eventType, outcome) => {
      observed.push([eventType, outcome]);
    },
  }));
  const webhook = createWebhook(stripeEvent({
    type: 'customer.created',
  }), {
    finalizeDedupe: async (input) => {
      dedupeFinalization = input;
    },
  });

  const result = await processor.process(webhook);

  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.ignored, true);
  assert.equal(result.responseBody.reason, 'unsupported_event_type');
  assert.deepEqual(observed, [['customer.created', 'ignored']]);
  assert.deepEqual(dedupeFinalization, {
    eventType: 'customer.created',
    accountId: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    outcome: 'ignored',
    reason: 'unsupported_event_type',
  });
}

async function testUnsupportedEventFinalizesSharedLedger(): Promise<void> {
  let sharedFinalization: StripeWebhookSharedFinalizationInput | null = null;
  const processor = createStripeWebhookBillingProcessor(createDeps());
  const webhook = createWebhook(stripeEvent({
    type: 'customer.created',
  }), {
    sharedBillingLedger: true,
    finalizeSharedEvent: async (input) => {
      sharedFinalization = input;
    },
  });

  const result = await processor.process(webhook);

  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.ignored, true);
  assert.equal(sharedFinalization?.providerEventId, 'evt_123');
  assert.equal(sharedFinalization?.outcome, 'ignored');
  assert.equal(sharedFinalization?.reason, 'unsupported_event_type');
}

async function testAccountStoreErrorReleasesClaimAndMapsConflict(): Promise<void> {
  let releaseCount = 0;
  const processor = createStripeWebhookBillingProcessor(createDeps({
    isSupportedStripeWebhookEvent: () => true,
    applyStripeSubscriptionStateState: async () => {
      throw new AccountStoreError('INVALID_STATE', 'account state is locked');
    },
  }));
  const webhook = createWebhook(stripeEvent({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: {
          data: [{
            price: {
              id: 'price_123',
            },
          }],
        },
        metadata: {
          attestorAccountId: 'acct_123',
        },
      },
    },
  }), {
    releaseClaim: async () => {
      releaseCount += 1;
    },
  });

  const result = await processor.process(webhook);

  assert.equal(releaseCount, 1);
  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.responseBody, {
    error: 'account state is locked',
  });
}

async function testStaleSubscriptionEventFinalizesIgnoredWithoutStateConvergence(): Promise<void> {
  const account = hostedAccount();
  let dedupeFinalization: StripeWebhookDedupeFinalizationInput | null = null;
  let receivedEventCreatedAt: string | null | undefined;
  const processor = createStripeWebhookBillingProcessor(createDeps({
    isSupportedStripeWebhookEvent: () => true,
    applyStripeSubscriptionStateState: async (input) => {
      receivedEventCreatedAt = input.eventCreatedAt;
      return {
        record: account,
        previousStatus: account.status,
        nextStatus: account.status,
        previousBillingStatus: account.billing.stripeSubscriptionStatus,
        nextBillingStatus: account.billing.stripeSubscriptionStatus,
        path: null,
        matchReason: 'subscription_id',
        stale: true,
      };
    },
    syncTenantPlanByTenantIdState: async () => {
      throw new Error('stale subscription event must not sync tenant plan');
    },
    syncHostedBillingEntitlement: async () => {
      throw new Error('stale subscription event must not sync entitlement');
    },
    appendAdminAuditRecordState: async () => {
      throw new Error('stale subscription event must not append applied audit record');
    },
    unixSecondsToIso: () => '2026-04-21T10:00:00.000Z',
  }));
  const webhook = createWebhook(stripeEvent({
    id: 'evt_old_subscription',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'past_due',
        items: {
          data: [{
            price: {
              id: 'price_123',
            },
          }],
        },
        metadata: {},
      },
    },
  }), {
    finalizeDedupe: async (input) => {
      dedupeFinalization = input;
    },
  });

  const result = await processor.process(webhook);

  assert.equal(receivedEventCreatedAt, '2026-04-21T10:00:00.000Z');
  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.ignored, true);
  assert.equal(result.responseBody.reason, 'stale_subscription_event');
  assert.deepEqual(dedupeFinalization, {
    eventType: 'customer.subscription.updated',
    accountId: 'acct_123',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    outcome: 'ignored',
    reason: 'stale_subscription_event',
  });
}

async function testStaleInvoiceEventFinalizesSharedLedgerAsIgnored(): Promise<void> {
  const account = hostedAccount();
  let sharedFinalization: StripeWebhookSharedFinalizationInput | null = null;
  const processor = createStripeWebhookBillingProcessor(createDeps({
    isSupportedStripeWebhookEvent: () => true,
    parseStripeInvoiceStatus: () => 'open',
    stripeInvoicePriceId: () => 'price_123',
    applyStripeInvoiceStateState: async () => ({
      record: account,
      previousStatus: account.status,
      nextStatus: account.status,
      previousBillingStatus: account.billing.stripeSubscriptionStatus,
      nextBillingStatus: account.billing.stripeSubscriptionStatus,
      path: null,
      matchReason: 'subscription_id',
      stale: true,
    }),
    extractInvoiceLineItemSnapshotsFromInvoice: () => {
      throw new Error('stale invoice event must not extract line items');
    },
    syncTenantPlanByTenantIdState: async () => {
      throw new Error('stale invoice event must not sync tenant plan');
    },
    syncHostedBillingEntitlement: async () => {
      throw new Error('stale invoice event must not sync entitlement');
    },
    appendAdminAuditRecordState: async () => {
      throw new Error('stale invoice event must not append applied audit record');
    },
    unixSecondsToIso: () => '2026-04-21T10:00:00.000Z',
  }));
  const webhook = createWebhook(stripeEvent({
    id: 'evt_old_invoice',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_old',
        customer: 'cus_123',
        subscription: 'sub_123',
        status: 'open',
        currency: 'usd',
        amount_paid: 0,
        amount_due: 149900,
        billing_reason: 'subscription_cycle',
        metadata: {},
      },
    },
  }), {
    sharedBillingLedger: true,
    finalizeSharedEvent: async (input) => {
      sharedFinalization = input;
    },
  });

  const result = await processor.process(webhook);

  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.ignored, true);
  assert.equal(result.responseBody.reason, 'stale_invoice_event');
  assert.equal(sharedFinalization?.providerEventId, 'evt_old_invoice');
  assert.equal(sharedFinalization?.outcome, 'ignored');
  assert.equal(sharedFinalization?.reason, 'stale_invoice_event');
  assert.equal(sharedFinalization?.accountId, 'acct_123');
  assert.equal(sharedFinalization?.tenantId, 'tenant_123');
}

async function testWorkflowSubscriptionEventUpdatesWorkflowEntitlementOnly(): Promise<void> {
  const previous = {
    ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW: process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW,
    ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW: process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW,
  };
  process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_live';
  process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = 'price_starter_workflow_overage_live';
  try {
    const account = hostedAccount({
      primaryTenantId: 'tenant_123',
      billing: {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_account_plan',
      },
    });
    let workflowInput: Parameters<StripeWebhookBillingProcessorDeps['upsertWorkflowEntitlementFromStripeState']>[0] | null = null;
    let appliedAccountSubscription = false;
    let dedupeFinalization: StripeWebhookDedupeFinalizationInput | null = null;
    const processor = createStripeWebhookBillingProcessor(createDeps({
      isSupportedStripeWebhookEvent: () => true,
      findHostedAccountByStripeRefs: async () => ({
        record: account,
        matchReason: 'account_id',
      }),
      applyStripeSubscriptionStateState: async () => {
        appliedAccountSubscription = true;
        throw new Error('workflow subscription must not update account plan subscription state');
      },
      upsertWorkflowEntitlementFromStripeState: async (input) => {
        workflowInput = input;
        return {
          record: {
            id: 'went_123',
            schemaVersion: 'attestor.workflow-entitlement.v1',
            accountId: input.accountId,
            tenantId: input.tenantId,
            workflowId: input.workflowId,
            tier: input.tier,
            status: input.status,
            stripeCustomerId: input.stripeCustomerId ?? null,
            stripeSubscriptionId: input.stripeSubscriptionId ?? null,
            stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
            stripePriceId: input.stripePriceId ?? null,
            stripeOveragePriceId: input.stripeOveragePriceId ?? null,
            consequencePack: input.consequencePack,
            downstreamSystemRefDigest: input.downstreamSystemRefDigest ?? null,
            policyGatePathRefDigest: input.policyGatePathRefDigest ?? null,
            includedAdmissionsMonthly: 25_000,
            monthlyAdmissionsUsed: 0,
            admissionPeriod: '2026-05',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            customerGateProofPresent: false,
            lastCheckoutAction: null,
            lastCheckoutSessionId: null,
            lastCheckoutCompletedAt: null,
            lastEventId: input.eventId ?? null,
            lastEventType: input.eventType ?? null,
            lastEventAt: input.eventAt ?? null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
          path: null,
        };
      },
      appendAdminAuditRecordState: async () => {},
      unixSecondsToIso: () => '2026-05-01T10:00:00.000Z',
    }));
    const webhook = createWebhook(stripeEvent({
      id: 'evt_workflow_subscription',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_workflow_123',
          customer: 'cus_123',
          status: 'active',
          items: {
            data: [{
              id: 'si_workflow_base',
              price: {
                id: 'price_starter_workflow_live',
              },
            }],
          },
          metadata: {
            attestor_account_id: 'acct_123',
            attestor_tenant_digest: 'sha256:6f56f5748cf7fad57e8abd656a123c63c7f37a3836bb09a016879f9d76031113',
            attestor_workflow_id: 'wf_refunds',
            attestor_workflow_tier: 'starter-workflow',
            attestor_consequence_pack: 'money-movement',
            attestor_downstream_ref_digest: 'sha256:downstream',
            attestor_policy_gate_digest: 'sha256:gate',
          },
        },
      },
    }), {
      finalizeDedupe: async (input) => {
        dedupeFinalization = input;
      },
    });

    const result = await processor.process(webhook);

    assert.equal(result.statusCode, 200);
    assert.equal(result.responseBody.workflowId, 'wf_refunds');
    assert.equal(result.responseBody.workflowEntitlementStatus, 'active');
    assert.equal(appliedAccountSubscription, false);
    assert.equal(workflowInput?.stripeSubscriptionItemId, 'si_workflow_base');
    assert.equal(workflowInput?.stripePriceId, 'price_starter_workflow_live');
    assert.deepEqual(dedupeFinalization, {
      eventType: 'customer.subscription.updated',
      accountId: 'acct_123',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_workflow_123',
      outcome: 'applied',
      reason: null,
    });
  } finally {
    if (previous.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW === undefined) delete process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW;
    else process.env.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW = previous.ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW;
    if (previous.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW === undefined) delete process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW;
    else process.env.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW = previous.ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW;
  }
}

await testUnsupportedEventFinalizesFileDedupe();
await testUnsupportedEventFinalizesSharedLedger();
await testAccountStoreErrorReleasesClaimAndMapsConflict();
await testStaleSubscriptionEventFinalizesIgnoredWithoutStateConvergence();
await testStaleInvoiceEventFinalizesSharedLedgerAsIgnored();
await testWorkflowSubscriptionEventUpdatesWorkflowEntitlementOnly();

console.log('Service stripe webhook billing processor tests: 6 passed, 0 failed');
