import type { Context, Hono } from 'hono';
import {
  createShadowCustomerActivationReceipt,
  createShadowPolicyDiscoveryCandidates,
  type GenericAdmissionMode,
  type ShadowAdmissionEvent,
  type ShadowCustomerActivationReceiptStatus,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundleSigningPayload,
  type ShadowPolicySimulationReport,
} from '../../../consequence-admission/index.js';
import {
  type AppendShadowCustomerActivationReceiptResult,
  type AppendShadowPolicySimulationReportResult,
  type ShadowCustomerActivationReceiptStoreRecord,
  type ShadowPolicyCandidateStatus,
  type ShadowPolicyCandidateStoreRecord,
  type ShadowPolicySimulationReportStoreRecord,
  type UpsertShadowPolicyCandidateBundleResult,
} from '../../shadow/shadow-persistence-store.js';
import type { PipelineIdempotencyService } from '../../application/pipeline-idempotency-service.js';
import type { TenantContext } from '../../tenant-isolation.js';
import { type ShadowMutationAuditInput } from './shadow-mutation-route-helpers.js';
import { registerShadowCustomerActivationRoutes } from './shadow-customer-activation-routes.js';
import { registerShadowDownstreamActivationRoutes } from './shadow-downstream-activation-routes.js';
import { registerShadowPolicyFoundryPromotionRoutes } from './shadow-policy-foundry-promotion-routes.js';
import { registerShadowSimulationHistoryRoutes } from './shadow-simulation-history-routes.js';
import { registerShadowSummaryDashboardRoutes } from './shadow-summary-dashboard-routes.js';
export { resetShadowMutationRateLimiterForTests } from './shadow-mutation-route-helpers.js';
export type { ShadowMutationAuditInput } from './shadow-mutation-route-helpers.js';

export interface ShadowRouteDeps {
  currentTenant(context: Context): TenantContext;
  listShadowEvents(input: { readonly tenant: TenantContext }): readonly ShadowAdmissionEvent[];
  recordShadowMutationAudit?(input: ShadowMutationAuditInput): Promise<void>;
  pipelineIdempotencyService?: PipelineIdempotencyService;
  listShadowSimulations?(
    input: { readonly tenant: TenantContext },
  ): readonly ShadowPolicySimulationReport[];
  recordShadowPolicySimulationReport?(input: {
    readonly tenant: TenantContext;
    readonly report: ShadowPolicySimulationReport;
  }): AppendShadowPolicySimulationReportResult;
  listShadowPolicySimulationReports?(input: {
    readonly tenant: TenantContext;
    readonly proposedMode: GenericAdmissionMode | null;
  }): readonly ShadowPolicySimulationReportStoreRecord[];
  findShadowPolicySimulationReport?(input: {
    readonly tenant: TenantContext;
    readonly reportId: string;
  }): ShadowPolicySimulationReportStoreRecord | null;
  materializeShadowPolicyCandidates?(input: {
    readonly tenant: TenantContext;
    readonly bundle: ReturnType<typeof createShadowPolicyDiscoveryCandidates>;
  }): UpsertShadowPolicyCandidateBundleResult;
  listShadowPolicyCandidateRecords?(input: {
    readonly tenant: TenantContext;
    readonly status: ShadowPolicyCandidateStatus | null;
  }): readonly ShadowPolicyCandidateStoreRecord[];
  transitionShadowPolicyCandidateStatus?(input: {
    readonly tenant: TenantContext;
    readonly candidateId: string;
    readonly status: ShadowPolicyCandidateStatus;
    readonly actorRef: string;
    readonly reason: string;
  }): ShadowPolicyCandidateStoreRecord;
  recordShadowCustomerActivationReceipt?(input: {
    readonly tenant: TenantContext;
    readonly receipt: ReturnType<typeof createShadowCustomerActivationReceipt>;
  }): AppendShadowCustomerActivationReceiptResult;
  listShadowCustomerActivationReceiptRecords?(input: {
    readonly tenant: TenantContext;
    readonly activationStatus: ShadowCustomerActivationReceiptStatus | null;
    readonly receiptReady: boolean | null;
    readonly sourceHandoffDigest: string | null;
  }): readonly ShadowCustomerActivationReceiptStoreRecord[];
  findShadowCustomerActivationReceipt?(input: {
    readonly tenant: TenantContext;
    readonly receiptId: string;
  }): ShadowCustomerActivationReceiptStoreRecord | null;
  signShadowPolicyBundlePublication?(input: {
    readonly tenant: TenantContext;
    readonly payload: ShadowPolicyBundleSigningPayload;
  }): ShadowPolicyBundlePublicationSignature;
  now?(): string;
}

export function registerShadowRoutes(app: Hono, deps: ShadowRouteDeps): void {
  registerShadowSummaryDashboardRoutes(app, deps);
  registerShadowSimulationHistoryRoutes(app, deps);
  registerShadowPolicyFoundryPromotionRoutes(app, deps);
  registerShadowDownstreamActivationRoutes(app, deps);
  registerShadowCustomerActivationRoutes(app, deps);
}
