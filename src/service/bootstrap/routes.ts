import type { Hono } from 'hono';
import {
  createShadowAdmissionEvent,
} from '../../consequence-admission/index.js';
import { createServiceAgentLoopAbuseGuard } from '../agent-loop-abuse-guard.js';
import {
  projectHostedBillingEntitlement,
} from '../billing-entitlement-store.js';
import {
  findHostedAccountByTenantIdState,
  findHostedBillingEntitlementByAccountIdState,
  findTenantRecordByTenantIdState,
} from '../control-plane-store.js';
import { registerAccountRoutes } from '../http/routes/account-routes.js';
import { registerAdminRoutes } from '../http/routes/admin-routes.js';
import { registerCoreRoutes } from '../http/routes/core-routes.js';
import {
  registerActionSurfaceOnboardingRoutes,
  type ActionSurfaceOnboardingRouteDeps,
} from '../http/routes/action-surface-onboarding-routes.js';
import {
  registerGenericAdmissionRoutes,
  type GenericAdmissionRouteDeps,
} from '../http/routes/generic-admission-routes.js';
import { registerPipelineRoutes } from '../http/routes/pipeline-routes.js';
import {
  registerPolicyFoundryHostedOnboardingRoutes,
  type PolicyFoundryHostedOnboardingRouteDeps,
} from '../http/routes/policy-foundry-hosted-onboarding-routes.js';
import { registerPublicSiteRoutes } from '../http/routes/public-site-routes.js';
import { registerReleasePolicyControlRoutes } from '../http/routes/release-policy-control-routes.js';
import { registerReleaseReviewRoutes } from '../http/routes/release-review-routes.js';
import {
  registerShadowRoutes,
  type ShadowRouteDeps,
} from '../http/routes/shadow-routes.js';
import { registerWebhookRoutes } from '../http/routes/webhook-routes.js';
import {
  createFileBackedShadowAdmissionEventStore,
  createFileBackedShadowCustomerActivationReceiptStore,
  createFileBackedShadowPolicyCandidateStore,
  createFileBackedShadowPolicySimulationReportStore,
} from '../shadow-persistence-store.js';
import { createFileBackedPolicyFoundryHostedWizardStateStore } from '../policy-foundry-hosted-wizard-state.js';
import {
  GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION,
  evaluateGenericAdmissionProtectedRoute,
  type GenericAdmissionProtectedRouteEvaluation,
} from '../generic-admission-protected-route.js';
import { installProductionSharedRequestGuard } from './production-shared-request-guard.js';
import type { AppRuntime } from './runtime.js';

export function createPublicSiteRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.publicSite;
}

export function createCoreRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.core;
}

export function createAccountRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.account;
}

export function createAdminRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.admin;
}

export function createPipelineRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.pipeline;
}

interface RuntimeSecurityWithGenericAdmissionProtectedRoute {
  readonly genericAdmissionProtectedRoute?: GenericAdmissionProtectedRouteEvaluation;
}

function genericAdmissionProtectedRouteFor<Packet>(
  runtime: AppRuntime<Packet>,
): GenericAdmissionProtectedRouteEvaluation {
  const security =
    runtime.infra.security as RuntimeSecurityWithGenericAdmissionProtectedRoute | undefined;
  const configured = security?.genericAdmissionProtectedRoute;
  if (configured?.version === GENERIC_ADMISSION_PROTECTED_ROUTE_SPEC_VERSION) {
    return configured;
  }

  return evaluateGenericAdmissionProtectedRoute({
    runtimeProfileId: null,
    requireProtectedReleaseTokenForHighRisk: true,
    issuerConfigured: false,
    senderConfirmationSource: 'none',
    failClosedOnMissingIssuer: true,
    shadowRecordsRawToken: false,
    admissionOrShadowStoresRawToken: false,
    rawTokenReturnedOnlyToCaller: true,
  });
}

export function createGenericAdmissionRouteDeps<Packet>(
  runtime: AppRuntime<Packet>,
): GenericAdmissionRouteDeps {
  const shadowEventStore = createFileBackedShadowAdmissionEventStore();
  const agentLoopAbuseGuard = createServiceAgentLoopAbuseGuard();
  const genericAdmissionProtectedRoute =
    genericAdmissionProtectedRouteFor(runtime);
  return {
    currentTenant: runtime.services.httpRoutes.pipeline.currentTenant,
    evaluateAgentLoopAbuse: async ({ tenant, envelope, receivedAt }) =>
      agentLoopAbuseGuard.evaluate({
        tenantId: tenant.tenantId,
        envelope,
        receivedAt,
      }),
    recordShadowAdmission: ({ tenant, envelope }) => {
      shadowEventStore.append({
        tenantId: tenant.tenantId,
        event: createShadowAdmissionEvent({
          admission: envelope,
        }),
      });
    },
    requireProtectedReleaseTokenForHighRisk:
      genericAdmissionProtectedRoute.requireProtectedReleaseTokenForHighRisk,
  };
}

export function createShadowRouteDeps<Packet>(
  runtime: AppRuntime<Packet>,
): ShadowRouteDeps {
  const shadowEventStore = createFileBackedShadowAdmissionEventStore();
  const shadowSimulationStore = createFileBackedShadowPolicySimulationReportStore();
  const shadowCandidateStore = createFileBackedShadowPolicyCandidateStore();
  const shadowActivationReceiptStore = createFileBackedShadowCustomerActivationReceiptStore();
  return {
    currentTenant: runtime.services.httpRoutes.pipeline.currentTenant,
    listShadowEvents: ({ tenant }) =>
      shadowEventStore.list({ tenantId: tenant.tenantId }).events,
    listShadowSimulations: ({ tenant }) =>
      shadowSimulationStore.list({ tenantId: tenant.tenantId }).reports,
    recordShadowPolicySimulationReport: ({ tenant, report }) =>
      shadowSimulationStore.append({
        tenantId: tenant.tenantId,
        report,
      }),
    listShadowPolicySimulationReports: ({ tenant, proposedMode }) =>
      shadowSimulationStore.list({
        tenantId: tenant.tenantId,
        proposedMode,
      }).records,
    findShadowPolicySimulationReport: ({ tenant, reportId }) =>
      shadowSimulationStore.find({
        tenantId: tenant.tenantId,
        reportId,
      }).record,
    materializeShadowPolicyCandidates: ({ tenant, bundle }) =>
      shadowCandidateStore.upsertBundle({
        tenantId: tenant.tenantId,
        bundle,
      }),
    listShadowPolicyCandidateRecords: ({ tenant, status }) =>
      shadowCandidateStore.list({
        tenantId: tenant.tenantId,
        status,
      }).records,
    transitionShadowPolicyCandidateStatus: ({ tenant, candidateId, status, actorRef, reason }) =>
      shadowCandidateStore.transitionStatus({
        tenantId: tenant.tenantId,
        candidateId,
        status,
        actorRef,
        reason,
      }).record,
    recordShadowCustomerActivationReceipt: ({ tenant, receipt }) =>
      shadowActivationReceiptStore.append({
        tenantId: tenant.tenantId,
        receipt,
      }),
    listShadowCustomerActivationReceiptRecords: ({ tenant, activationStatus, receiptReady, sourceHandoffDigest }) =>
      shadowActivationReceiptStore.list({
        tenantId: tenant.tenantId,
        activationStatus,
        receiptReady,
        sourceHandoffDigest,
      }).records,
    findShadowCustomerActivationReceipt: ({ tenant, receiptId }) =>
      shadowActivationReceiptStore.find({
        tenantId: tenant.tenantId,
        receiptId,
      }).record,
  };
}

export function createActionSurfaceOnboardingRouteDeps<Packet>(
  runtime: AppRuntime<Packet>,
): ActionSurfaceOnboardingRouteDeps {
  const shadowEventStore = createFileBackedShadowAdmissionEventStore();
  return {
    currentTenant: runtime.services.httpRoutes.pipeline.currentTenant,
    listShadowEvents: ({ tenant }) =>
      shadowEventStore.list({ tenantId: tenant.tenantId }).events,
    now: () => new Date().toISOString(),
  };
}

export function createPolicyFoundryHostedOnboardingRouteDeps<Packet>(
  runtime: AppRuntime<Packet>,
): PolicyFoundryHostedOnboardingRouteDeps {
  const shadowEventStore = createFileBackedShadowAdmissionEventStore();
  const wizardStateStore = createFileBackedPolicyFoundryHostedWizardStateStore();
  return {
    currentTenant: runtime.services.httpRoutes.pipeline.currentTenant,
    listShadowEvents: ({ tenant }) =>
      shadowEventStore.list({ tenantId: tenant.tenantId }).events,
    async resolveBillingEntitlement({ tenant }) {
      const account = await findHostedAccountByTenantIdState(tenant.tenantId);
      if (!account) return null;
      const existing = await findHostedBillingEntitlementByAccountIdState(account.id);
      if (existing) return existing;
      const tenantRecord = await findTenantRecordByTenantIdState(account.primaryTenantId);
      return projectHostedBillingEntitlement(null, {
        account,
        currentPlanId:
          tenantRecord?.planId ??
          account.billing.lastCheckoutPlanId ??
          tenant.planId,
        currentMonthlyRunQuota: tenantRecord?.monthlyRunQuota ?? tenant.monthlyRunQuota,
      });
    },
    wizardStateStore,
    now: () => new Date().toISOString(),
  };
}

export function createWebhookRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.webhook;
}

export function createReleaseReviewRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.releaseReview;
}

export function createReleasePolicyControlRouteDeps<Packet>(runtime: AppRuntime<Packet>) {
  return runtime.services.httpRoutes.releasePolicyControl;
}

export function registerAllRoutes<Packet>(app: Hono, runtime: AppRuntime<Packet>): void {
  installProductionSharedRequestGuard(app, runtime);
  registerPublicSiteRoutes(app, createPublicSiteRouteDeps(runtime));
  registerCoreRoutes(app, createCoreRouteDeps(runtime));
  registerAccountRoutes(app, createAccountRouteDeps(runtime));
  registerAdminRoutes(app, createAdminRouteDeps(runtime));
  registerGenericAdmissionRoutes(app, createGenericAdmissionRouteDeps(runtime));
  registerShadowRoutes(app, createShadowRouteDeps(runtime));
  registerActionSurfaceOnboardingRoutes(app, createActionSurfaceOnboardingRouteDeps(runtime));
  registerPolicyFoundryHostedOnboardingRoutes(app, createPolicyFoundryHostedOnboardingRouteDeps(runtime));
  registerReleaseReviewRoutes(app, createReleaseReviewRouteDeps(runtime));
  registerReleasePolicyControlRoutes(app, createReleasePolicyControlRouteDeps(runtime));
  registerWebhookRoutes(app, createWebhookRouteDeps(runtime));
  registerPipelineRoutes(app, createPipelineRouteDeps(runtime));
}
