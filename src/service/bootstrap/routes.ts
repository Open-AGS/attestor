import type { Hono } from 'hono';
import {
  createShadowAdmissionEvent,
} from '../../consequence-admission/index.js';
import { createServiceAgentLoopAbuseGuard } from '../agent-loop-abuse-guard.js';
import { registerAccountRoutes } from '../http/routes/account-routes.js';
import { registerAdminRoutes } from '../http/routes/admin-routes.js';
import { registerCoreRoutes } from '../http/routes/core-routes.js';
import {
  registerGenericAdmissionRoutes,
  type GenericAdmissionRouteDeps,
} from '../http/routes/generic-admission-routes.js';
import { registerPipelineRoutes } from '../http/routes/pipeline-routes.js';
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

export function createGenericAdmissionRouteDeps<Packet>(
  runtime: AppRuntime<Packet>,
): GenericAdmissionRouteDeps {
  const shadowEventStore = createFileBackedShadowAdmissionEventStore();
  const agentLoopAbuseGuard = createServiceAgentLoopAbuseGuard();
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
  registerReleaseReviewRoutes(app, createReleaseReviewRouteDeps(runtime));
  registerReleasePolicyControlRoutes(app, createReleasePolicyControlRouteDeps(runtime));
  registerWebhookRoutes(app, createWebhookRouteDeps(runtime));
  registerPipelineRoutes(app, createPipelineRouteDeps(runtime));
}
