import type { Context } from 'hono';
import type { AdminAuditRecord } from '../../admin-audit-log.js';
import type * as AsyncPipeline from '../../async/async-pipeline.js';
import type {
  AdminControlService,
} from '../../application/admin-control-service.js';
import type {
  AdminMutationReadyResult,
  AdminMutationService,
} from '../../application/admin-mutation-service.js';
import type { AdminQueryService } from '../../application/admin-query-service.js';
import type { HostedAccountRecord } from '../../account/account-store.js';
import type * as BillingEventLedger from '../../billing/billing-event-ledger.js';
import type { HostedBillingEntitlementRecord } from '../../billing/billing-entitlement-store.js';
import type * as BillingExport from '../../billing/billing-export.js';
import type * as BillingFeatureService from '../../billing/billing-feature-service.js';
import type * as BillingReconciliation from '../../billing/billing-reconciliation.js';
import type * as EmailDelivery from '../../async/email-delivery.js';
import type * as Observability from '../../observability.js';
import type * as PlanCatalog from '../../plan-catalog.js';
import type { TenantKeyRecord } from '../../tenant-key-store.js';
import type { UsageContext } from '../../usage-meter.js';
import type { InProcessAsyncJob, TenantAsyncBackendMode } from '../../runtime/tenant-runtime.js';
import type * as TenantRuntime from '../../runtime/tenant-runtime.js';
import type {
  RequestPathDegradedModeGrantStore,
  RequestPathReleaseTokenIntrospectionStore,
} from '../../release/release-authority-request-path.js';
import {
  adminActorForMutation,
  type AdminRouteActor,
} from './admin-route-helpers.js';

export type { AsyncDeadLetterRecord } from '../../async/async-dead-letter-store.js';
export type {
  EnforcementBreakGlassReason,
  EnforcementFailureReason,
} from '../../../release-enforcement-plane/types.js';
export {
  createDegradedModeGrant,
  degradedModeGrantStatus,
  degradedModeGrantView,
} from '../../../release-enforcement-plane/degraded-mode.js';
export type {
  DegradedModeGrantState,
  ListDegradedModeGrantOptions,
} from '../../../release-enforcement-plane/degraded-mode.js';
export {
  ADMIN_ACCOUNT_READ_ROLES,
  ADMIN_ACCOUNT_ROLES,
  ADMIN_AUDIT_READ_ROLES,
  ADMIN_BILLING_READ_ROLES,
  ADMIN_BILLING_ROLES,
  ADMIN_KEY_READ_ROLES,
  ADMIN_KEY_ROLES,
  ADMIN_OPS_READ_ROLES,
  ADMIN_OPS_ROLES,
  ADMIN_READ_ROLES,
  ADMIN_RELEASE_READ_ROLES,
  ADMIN_RELEASE_ROLES,
  adminAuditActionFilter,
  adminControlBillingEvent,
  adminControlServiceErrorResponse,
  adminDegradedModeActor,
  adminDegradedModeError,
  adminDegradedModeScope,
  adminDegradedModeStringArray,
  adminDegradedModeText,
  adminRouteErrorMessage,
  authorizeAdminRoute,
  billingEntitlementStatusFilter,
  billingEventOutcomeFilter,
  billingEventProviderFilter,
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  parseAdminJsonBody,
  parseAdminListLimit,
} from './admin-route-helpers.js';

export { resetAdminRouteAuthLimiterForTests } from './admin-route-helpers.js';

export type AdminRouteResponseBody = Record<string, unknown>;
export type AdminAsyncQueue = Parameters<typeof AsyncPipeline.getAsyncQueueSummary>[0];

export type AdminMutationReadyResultWithActor = AdminMutationReadyResult & {
  adminActor: AdminRouteActor;
};

export interface AdminRouteDeps {
  currentAdminAuthorized(context: Context): Response | null;
  adminMutationService: AdminMutationService;
  adminControlService: AdminControlService;
  adminQueryService: AdminQueryService;
  adminTenantKeyView(record: TenantKeyRecord): AdminRouteResponseBody;
  tenantKeyStorePolicy(): { maxActiveKeysPerTenant: number };
  adminAccountView(record: HostedAccountRecord): AdminRouteResponseBody;
  readHostedBillingEntitlement(account: HostedAccountRecord): Promise<HostedBillingEntitlementRecord>;
  buildHostedBillingExport: typeof BillingExport.buildHostedBillingExport;
  buildHostedBillingReconciliation: typeof BillingReconciliation.buildHostedBillingReconciliation;
  renderHostedBillingExportCsv: typeof BillingExport.renderHostedBillingExportCsv;
  billingEntitlementView(record: HostedBillingEntitlementRecord): AdminRouteResponseBody;
  getUsageContext(tenantId: string, planId: string | null, quota: number | null): Promise<UsageContext>;
  buildHostedFeatureServiceView: typeof BillingFeatureService.buildHostedFeatureServiceView;
  getTenantAsyncExecutionCoordinatorStatus(): { shared: boolean; backend: 'memory' | 'redis' };
  getTenantAsyncWeightedDispatchCoordinatorStatus(): { shared: boolean; backend: 'memory' | 'redis' };
  adminPlanView(): AdminRouteResponseBody[];
  DEFAULT_HOSTED_PLAN_ID: typeof PlanCatalog.DEFAULT_HOSTED_PLAN_ID;
  defaultRateLimitWindowSeconds: typeof PlanCatalog.defaultRateLimitWindowSeconds;
  adminAuditView(record: AdminAuditRecord): AdminRouteResponseBody;
  isBillingEventLedgerConfigured: typeof BillingEventLedger.isBillingEventLedgerConfigured;
  listBillingEvents: typeof BillingEventLedger.listBillingEvents;
  billingEventView(record: BillingEventLedger.BillingEventRecord): AdminRouteResponseBody;
  renderPrometheusMetrics: typeof Observability.renderPrometheusMetrics;
  currentMetricsAuthorized(context: Context): Response | null;
  getTelemetryStatus: typeof Observability.getTelemetryStatus;
  getHostedEmailDeliveryStatus: typeof EmailDelivery.getHostedEmailDeliveryStatus;
  getSecretEnvelopeStatus(): unknown;
  asyncBackendMode: TenantAsyncBackendMode;
  bullmqQueue: AdminAsyncQueue | null;
  getAsyncQueueSummary: typeof AsyncPipeline.getAsyncQueueSummary;
  getAsyncRetryPolicy: typeof AsyncPipeline.getAsyncRetryPolicy;
  inProcessJobs: Map<string, InProcessAsyncJob>;
  inProcessTenantQueueSnapshot: typeof TenantRuntime.inProcessTenantQueueSnapshot;
  listFailedPipelineJobs: typeof AsyncPipeline.listFailedPipelineJobs;
  retryFailedPipelineJob: typeof AsyncPipeline.retryFailedPipelineJob;
  apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  releaseDegradedModeGrantStore: RequestPathDegradedModeGrantStore;
}

export async function beginAdminRouteMutation(
  adminMutationService: AdminMutationService,
  context: Context,
  routeId: string,
  requestPayload: unknown,
): Promise<AdminMutationReadyResultWithActor | Response> {
  const adminActor = adminActorForMutation(context);
  const mutation = await adminMutationService.begin({
    idempotencyKey: context.req.header('Idempotency-Key')?.trim() ?? null,
    routeId,
    requestPayload,
  });
  if (mutation.kind === 'ready') {
    return {
      ...mutation,
      adminActor,
    };
  }
  if (mutation.kind === 'conflict') {
    return context.json(mutation.responseBody, mutation.statusCode);
  }
  return new Response(JSON.stringify(mutation.responseBody), {
    status: mutation.statusCode,
    headers: mutation.headers,
  });
}
