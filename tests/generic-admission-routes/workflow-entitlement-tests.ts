import {
  Hono,
  equal,
  ok,
  registerGenericAdmissionRoutes,
  validAdmissionPayload,
} from './helpers.js';
import type { StoredWorkflowEntitlementRecord } from '../../src/service/workflow-entitlement-store.js';

function storedWorkflowEntitlement(
  overrides: Partial<StoredWorkflowEntitlementRecord> = {},
): StoredWorkflowEntitlementRecord {
  return {
    id: 'went_route',
    schemaVersion: 'attestor.workflow-entitlement.v1',
    workflowId: 'wf_refunds',
    accountId: 'acct_route',
    tenantId: 'tenant_route',
    tier: 'starter-workflow',
    status: 'active',
    stripeCustomerId: 'cus_route',
    stripeSubscriptionId: 'sub_route',
    stripeSubscriptionItemId: 'si_route',
    stripePriceId: 'price_starter_workflow_live',
    stripeOveragePriceId: 'price_starter_workflow_overage_live',
    consequencePack: 'money-movement',
    downstreamSystemRefDigest: 'sha256:downstream',
    policyGatePathRefDigest: 'sha256:gate',
    includedAdmissionsMonthly: 25_000,
    monthlyAdmissionsUsed: 9,
    admissionPeriod: '2026-05',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    customerGateProofPresent: true,
    lastCheckoutAction: 'create',
    lastCheckoutSessionId: 'cs_route',
    lastCheckoutCompletedAt: null,
    lastEventId: null,
    lastEventType: null,
    lastEventAt: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function workflowApp(options: {
  entitlement: StoredWorkflowEntitlementRecord | null;
  allowUsage?: boolean;
}): Hono {
  const app = new Hono();
  const entitlement = options.entitlement;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'trial',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: () => {},
    resolveWorkflowEntitlement: () => entitlement,
    consumeWorkflowAdmission: () => ({
      decision: entitlement
        ? {
            allowed: options.allowUsage !== false,
            entitlement,
            usage: {
              workflowId: entitlement.workflowId,
              accountId: entitlement.accountId,
              tenantId: entitlement.tenantId,
              tier: entitlement.tier,
              meter: 'workflow_monthly_admissions',
              period: entitlement.admissionPeriod,
              used: entitlement.monthlyAdmissionsUsed + 1,
              quota: entitlement.includedAdmissionsMonthly,
              remaining: Math.max(0, entitlement.includedAdmissionsMonthly - entitlement.monthlyAdmissionsUsed - 1),
              hardLimit: false,
              overage: false,
              overageUnits: 0,
            },
          }
        : null,
      billingMetering: null,
    }),
  });
  return app;
}

async function testWorkflowAdmissionBlocksMissingEntitlement(): Promise<void> {
  const app = workflowApp({ entitlement: null });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validAdmissionPayload({
      workflowId: 'wf_refunds',
      requestedCapability: 'customer-gated-enforce-mode',
      consequencePack: 'money-movement',
      customerGateProofPresent: true,
    })),
  });
  const body = await response.json() as { reasonCodes: readonly string[] };

  equal(response.status, 403, 'Generic admission route: missing workflow entitlement returns 403');
  ok(
    body.reasonCodes.includes('workflow-entitlement-missing'),
    'Generic admission route: missing workflow entitlement reason is surfaced',
  );
}

async function testWorkflowAdmissionAllowsAndConsumesUsage(): Promise<void> {
  const entitlement = storedWorkflowEntitlement();
  const app = workflowApp({ entitlement });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validAdmissionPayload({
      workflowId: 'wf_refunds',
      requestedCapability: 'customer-gated-enforce-mode',
      consequencePack: 'money-movement',
      customerGateProofPresent: true,
    })),
  });
  const body = await response.json() as {
    workflowEntitlementAccess: { allowed: boolean; tier: string };
    workflowUsage: { used: number; meter: string };
  };

  equal(response.status, 200, 'Generic admission route: workflow entitlement allows matching admission');
  equal(body.workflowEntitlementAccess.allowed, true, 'Generic admission route: workflow access decision is returned');
  equal(body.workflowEntitlementAccess.tier, 'starter-workflow', 'Generic admission route: workflow tier is surfaced');
  equal(body.workflowUsage.used, 10, 'Generic admission route: workflow admission usage is consumed');
  equal(body.workflowUsage.meter, 'workflow_monthly_admissions', 'Generic admission route: workflow usage meter is explicit');
}

async function testWorkflowAdmissionIgnoresCallerGateProofFlags(): Promise<void> {
  const entitlement = storedWorkflowEntitlement({ customerGateProofPresent: false });
  const app = workflowApp({ entitlement });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validAdmissionPayload({
      workflowId: 'wf_refunds',
      requestedCapability: 'customer-gated-enforce-mode',
      consequencePack: 'money-movement',
      customerGateProofPresent: true,
      workflow: {
        customerGateProofPresent: true,
      },
    })),
  });
  const body = await response.json() as { reasonCodes: readonly string[] };

  equal(response.status, 403, 'Generic admission route: caller gate proof flag cannot unlock workflow enforce');
  ok(
    body.reasonCodes.includes('caller-asserted-gate-proof-ignored'),
    'Generic admission route: caller asserted gate proof is ignored explicitly',
  );
  ok(
    body.reasonCodes.includes('customer-gate-proof-required'),
    'Generic admission route: stored customer gate proof remains required',
  );
}

async function testWorkflowAdmissionBlocksHardQuotaDecision(): Promise<void> {
  const entitlement = storedWorkflowEntitlement();
  const app = workflowApp({ entitlement, allowUsage: false });
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validAdmissionPayload({
      workflowId: 'wf_refunds',
      requestedCapability: 'customer-gated-enforce-mode',
      consequencePack: 'money-movement',
      customerGateProofPresent: true,
    })),
  });
  const body = await response.json() as { reasonCodes: readonly string[] };

  equal(response.status, 429, 'Generic admission route: workflow quota denial returns 429');
  ok(
    body.reasonCodes.includes('workflow-admission-quota-exhausted'),
    'Generic admission route: workflow quota denial reason is explicit',
  );
}

export async function runWorkflowEntitlementRouteTests(): Promise<void> {
  await testWorkflowAdmissionBlocksMissingEntitlement();
  await testWorkflowAdmissionAllowsAndConsumesUsage();
  await testWorkflowAdmissionIgnoresCallerGateProofFlags();
  await testWorkflowAdmissionBlocksHardQuotaDecision();
}
