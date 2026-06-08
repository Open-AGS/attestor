import { createHash, randomUUID } from 'node:crypto';
import type { Context, Hono } from 'hono';
import type {
  ConnectorExecutionResult,
  ConnectorRegistry,
} from '../../../connectors/connector-interface.js';
import type { SchemaAttestation } from '../../../connectors/schema-attestation.js';
import type { DecisionEnvelope, FilingAdapterRegistry } from '../../../filing/filing-adapter.js';
import type { FinancialPipelineInput } from '../../../financial/pipeline.js';
import type {
  ExecutionEvidence,
  FinancialRunReport,
  ReviewerIdentity,
} from '../../../financial/types.js';
import type {
  IdentitySource,
  OidcConfig,
  OidcVerificationResult,
} from '../../../identity/oidc-identity.js';
import type { VerificationKit } from '../../../signing/bundle.js';
import type { KeylessSigner } from '../../../signing/keyless-signer.js';
import type {
  FinanceActionReleaseCandidate,
  FinanceActionReleaseMaterial,
  FinanceCommunicationReleaseCandidate,
  FinanceCommunicationReleaseMaterial,
  FinanceFilingReleaseCandidate,
  FinanceFilingReleaseMaterial,
} from '../../../release-layer/finance.js';
import type {
  CapabilityBoundaryDescriptor,
  DeterministicCheckObservation,
  ReleaseActorReference,
  ReleaseDecision,
  ReleaseDecisionLogEntry,
  ReleaseEvaluationRequest,
  ReleaseEvaluationScopeContext,
  ReleaseEvidencePackIssuer,
  ReleaseReviewerQueueRecord,
  ReleaseTargetKind,
  ReleaseTokenConfirmationClaim,
  ReleaseTokenIssuer,
  ShadowModeReleaseEvaluator,
  OutputContractDescriptor,
} from '../../../release-layer/index.js';
import type { TenantRateLimitContext, TenantRateLimitDecision } from '../../rate-limit.js';
import type { TenantContext } from '../../tenant-isolation.js';
import type { PipelineIdempotencyService } from '../../application/pipeline-idempotency-service.js';
import type { PipelineUsageService } from '../../application/pipeline-usage-service.js';
import { acceptsJsonRequestBody, opaqueRouteRunId } from '../route-response-helpers.js';
import type {
  RequestPathReleaseDecisionEngine,
  RequestPathReleaseDecisionLogWriter,
  RequestPathReleaseEvidencePackStore,
  RequestPathReleaseReviewerQueueStore,
  RequestPathReleaseShadowEvaluator,
  RequestPathReleaseTokenIntrospectionStore,
} from '../../release/release-authority-request-path.js';

type ConnectorSchemaAttestation = NonNullable<ConnectorExecutionResult['schemaAttestation']>;

type PipelineConnectorExecution = ExecutionEvidence & {
  schemaAttestation?: ConnectorSchemaAttestation | SchemaAttestation | null;
};

interface RequestSignerPair {
  signer: KeylessSigner;
  reviewer: KeylessSigner;
}

interface ReleaseMaterialShape {
  readonly target: {
    readonly kind: ReleaseTargetKind;
    readonly id: string;
    readonly displayName?: string;
  };
  readonly outputContract: OutputContractDescriptor;
  readonly capabilityBoundary: CapabilityBoundaryDescriptor;
  readonly hashBundle: {
    readonly outputHash: string;
    readonly consequenceHash: string;
  };
}

interface ReleaseShadowSummary {
  readonly targetId: string;
  readonly decisionId: string;
  readonly decisionStatus: string;
  readonly policyVersion: string;
  readonly policyRolloutMode: string | null;
  readonly policyEvaluationMode: string | null;
  readonly wouldBlockIfEnforced: boolean;
  readonly wouldRequireReview: boolean;
  readonly wouldRequireToken: boolean;
  readonly outputHash: string;
  readonly consequenceHash: string;
}

interface FinanceCommunicationReleaseSummary extends ReleaseShadowSummary {
  readonly preview: {
    readonly recipientId: string;
    readonly channelId: string;
    readonly subject: string;
  };
}

interface FinanceActionReleaseSummary extends ReleaseShadowSummary {
  readonly preview: {
    readonly workflowId: string;
    readonly actionType: string;
    readonly requestedTransition: string;
  };
}

interface FinanceFilingReleaseSummary {
  readonly targetId: string;
  readonly decisionId: string;
  readonly decisionStatus: string;
  readonly policyVersion: string;
  readonly introspectionRequired: boolean;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly tokenId: string | null;
  readonly token: string | null;
  readonly expiresAt: string | null;
  readonly evidencePackId: string | null;
  readonly evidencePackPath: string | null;
  readonly evidencePackDigest: string | null;
  readonly reviewQueueId: string | null;
  readonly reviewQueuePath: string | null;
  readonly tenantId: string;
  readonly senderConstrained: boolean;
  readonly presentationRequired: 'sender-constrained' | null;
  readonly tokenIssueStatus: 'not-required' | 'issued' | 'blocked';
  readonly reasonCodes: readonly string[];
  readonly candidate: FinanceFilingReleaseCandidate;
}

export interface PipelineExecutionRoutesDeps {
  currentTenant(context: Context): TenantContext;
  pipelineUsageService: PipelineUsageService;
  pipelineIdempotencyService: PipelineIdempotencyService;
  reserveTenantPipelineRequest(
    tenantId: string,
    planId: string | null | undefined,
  ): Promise<TenantRateLimitDecision>;
  applyRateLimitHeaders(
    context: Context,
    rateLimit: TenantRateLimitContext,
    options?: { includeRetryAfter?: boolean },
  ): void;
  connectorRegistry: Pick<ConnectorRegistry, 'get' | 'listIds'>;
  verifyOidcToken(token: string, config: OidcConfig): Promise<OidcVerificationResult>;
  classifyIdentitySource(oidcVerified: boolean, pkiBound: boolean): IdentitySource;
  createRequestSigners(identitySource: string, reviewerName?: string): RequestSignerPair;
  runFinancialPipeline(input: FinancialPipelineInput): FinancialRunReport;
  buildVerificationKit(
    report: FinancialRunReport,
    publicKeyPem: string,
    reviewerPublicKeyPem?: string | null,
    trustChain?: KeylessSigner['trustChain'] | null,
    caPublicKeyPem?: string | null,
  ): VerificationKit | null;
  createFinanceCommunicationReleaseCandidateFromReport(
    report: FinancialRunReport,
  ): FinanceCommunicationReleaseCandidate | null;
  buildFinanceCommunicationReleaseMaterial(
    candidate: FinanceCommunicationReleaseCandidate,
  ): FinanceCommunicationReleaseMaterial;
  buildFinanceCommunicationReleaseObservation(
    material: FinanceCommunicationReleaseMaterial,
    report: FinancialRunReport,
  ): DeterministicCheckObservation;
  financeCommunicationReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
  createFinanceActionReleaseCandidateFromReport(
    report: FinancialRunReport,
  ): FinanceActionReleaseCandidate | null;
  buildFinanceActionReleaseMaterial(candidate: FinanceActionReleaseCandidate): FinanceActionReleaseMaterial;
  buildFinanceActionReleaseObservation(
    material: FinanceActionReleaseMaterial,
    report: FinancialRunReport,
  ): DeterministicCheckObservation;
  financeActionReleaseShadowEvaluator: RequestPathReleaseShadowEvaluator<
    ReturnType<ShadowModeReleaseEvaluator['evaluate']>
  >;
  createFinanceFilingReleaseCandidateFromReport(
    report: FinancialRunReport,
  ): FinanceFilingReleaseCandidate | null;
  FINANCE_FILING_ADAPTER_ID: string;
  buildFinanceFilingReleaseMaterial(candidate: FinanceFilingReleaseCandidate): FinanceFilingReleaseMaterial;
  financeReleaseDecisionEngine: RequestPathReleaseDecisionEngine;
  financeReleaseDecisionLog: RequestPathReleaseDecisionLogWriter;
  buildFinanceFilingReleaseObservation(
    material: FinanceFilingReleaseMaterial,
    report: FinancialRunReport,
  ): DeterministicCheckObservation;
  currentReleaseRequester(context: Context, reviewerIdentity?: ReviewerIdentity): ReleaseActorReference;
  currentReleaseEvaluationContext(context: Context): ReleaseEvaluationScopeContext;
  finalizeFinanceFilingReleaseDecision(
    decision: ReleaseDecision,
    report: FinancialRunReport,
  ): ReleaseDecision;
  resolveFinanceFilingReleaseTokenConfirmation?(input: {
    context: Context;
    tenant: TenantContext;
    releaseDecision: ReleaseDecision;
    report: FinancialRunReport;
  }): Promise<ReleaseTokenConfirmationClaim | null> | ReleaseTokenConfirmationClaim | null;
  createFinanceReviewerQueueItem(input: {
    decision: ReleaseDecision;
    candidate: FinanceFilingReleaseCandidate;
    report: FinancialRunReport;
    logEntries: readonly ReleaseDecisionLogEntry[];
    tenantId?: string | null;
  }): ReleaseReviewerQueueRecord;
  apiReleaseReviewerQueueStore: RequestPathReleaseReviewerQueueStore;
  apiReleaseTokenIssuer: ReleaseTokenIssuer;
  apiReleaseEvidencePackStore: RequestPathReleaseEvidencePackStore;
  apiReleaseEvidencePackIssuer: ReleaseEvidencePackIssuer;
  apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  schemaAttestationSummaryFromFull(attestation: SchemaAttestation): unknown;
  schemaAttestationSummaryFromConnector(
    connectorExecution: PipelineConnectorExecution | null,
    connectorProvider: string | null,
  ): unknown;
  filingRegistry: Pick<FilingAdapterRegistry, 'get'>;
  buildCounterpartyEnvelope(
    runId: string,
    decision: string,
    certificateId: string | null,
    evidenceChainTerminal: string,
    rows: readonly Record<string, unknown>[],
    proofMode: string,
  ): DecisionEnvelope;
}

function connectorSchemaHash(result: ConnectorExecutionResult): string {
  return createHash('sha256')
    .update(JSON.stringify({ columns: result.columns, columnTypes: result.columnTypes }))
    .digest('hex')
    .slice(0, 16);
}

const STRICT_SHA256_ARTIFACT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

function financeEvidenceChainArtifactDigest(runId: string, terminalHash: string): string {
  const normalized = terminalHash.trim();
  if (STRICT_SHA256_ARTIFACT_DIGEST.test(normalized)) {
    return normalized;
  }
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ runId, terminalHash: normalized }))
    .digest('hex')}`;
}

function supportedExecutionProvider(provider: string): ExecutionEvidence['provider'] {
  return provider === 'fixture' || provider === 'sqlite' || provider === 'postgres'
    ? provider
    : undefined;
}

function connectorExecutionEvidenceFromResult(
  result: ConnectorExecutionResult,
): PipelineConnectorExecution {
  return {
    success: result.success,
    durationMs: result.durationMs,
    rowCount: result.rowCount,
    columns: result.columns,
    columnTypes: result.columnTypes,
    rows: result.rows,
    error: result.error,
    schemaHash: connectorSchemaHash(result),
    provider: supportedExecutionProvider(result.provider),
    executionContextHash: result.executionContextHash,
    schemaAttestation: result.schemaAttestation ?? null,
  };
}

function releaseEvaluationRequest(input: {
  id: string;
  createdAt: string;
  material: ReleaseMaterialShape;
  requester: ReleaseActorReference;
  context: ReleaseEvaluationScopeContext;
}): ReleaseEvaluationRequest {
  return {
    id: input.id,
    createdAt: input.createdAt,
    outputHash: input.material.hashBundle.outputHash,
    consequenceHash: input.material.hashBundle.consequenceHash,
    outputContract: input.material.outputContract,
    capabilityBoundary: input.material.capabilityBoundary,
    requester: input.requester,
    context: input.context,
    target: input.material.target,
  };
}

export function registerPipelineExecutionRoutes(app: Hono, deps: PipelineExecutionRoutesDeps): void {
  const {
    currentTenant,
    pipelineUsageService,
    pipelineIdempotencyService,
    reserveTenantPipelineRequest,
    applyRateLimitHeaders,
    connectorRegistry,
    verifyOidcToken,
    classifyIdentitySource,
    createRequestSigners,
    runFinancialPipeline,
    buildVerificationKit,
    createFinanceCommunicationReleaseCandidateFromReport,
    buildFinanceCommunicationReleaseMaterial,
    buildFinanceCommunicationReleaseObservation,
    financeCommunicationReleaseShadowEvaluator,
    createFinanceActionReleaseCandidateFromReport,
    buildFinanceActionReleaseMaterial,
    buildFinanceActionReleaseObservation,
    financeActionReleaseShadowEvaluator,
    createFinanceFilingReleaseCandidateFromReport,
    FINANCE_FILING_ADAPTER_ID,
    buildFinanceFilingReleaseMaterial,
    financeReleaseDecisionEngine,
    financeReleaseDecisionLog,
    buildFinanceFilingReleaseObservation,
    currentReleaseRequester,
    currentReleaseEvaluationContext,
    finalizeFinanceFilingReleaseDecision,
    resolveFinanceFilingReleaseTokenConfirmation,
    createFinanceReviewerQueueItem,
    apiReleaseReviewerQueueStore,
    apiReleaseTokenIssuer,
    apiReleaseEvidencePackStore,
    apiReleaseEvidencePackIssuer,
    apiReleaseIntrospectionStore,
    schemaAttestationSummaryFromFull,
    schemaAttestationSummaryFromConnector,
    filingRegistry,
    buildCounterpartyEnvelope,
  } = deps;

  async function evaluateFinanceFilingReleaseTarget(
    context: Context,
    tenant: TenantContext,
    report: FinancialRunReport,
    reviewerIdentity: ReviewerIdentity | undefined,
    shouldSign: boolean,
  ): Promise<FinanceFilingReleaseSummary | null> {
    if (!shouldSign || !report.certificate) return null;
    const filingCandidate = createFinanceFilingReleaseCandidateFromReport(report);
    if (filingCandidate?.adapterId !== FINANCE_FILING_ADAPTER_ID) return null;

    const material = buildFinanceFilingReleaseMaterial(filingCandidate);
    const evaluation = await financeReleaseDecisionEngine.evaluateWithDeterministicChecks(
      releaseEvaluationRequest({
        id: `release_${randomUUID()}`,
        createdAt: report.timestamp,
        material,
        requester: currentReleaseRequester(context, reviewerIdentity),
        context: currentReleaseEvaluationContext(context),
      }),
      buildFinanceFilingReleaseObservation(material, report),
    );
    const releaseDecision = finalizeFinanceFilingReleaseDecision(
      evaluation.decision,
      report,
    );
    const reviewQueueItem =
      releaseDecision.reviewAuthority.minimumReviewerCount > 0 &&
      (releaseDecision.status === 'review-required' || releaseDecision.status === 'hold')
        ? await apiReleaseReviewerQueueStore.upsert(
            createFinanceReviewerQueueItem({
              decision: releaseDecision,
              candidate: filingCandidate,
              report,
              logEntries: await financeReleaseDecisionLog.entries(),
              tenantId: tenant.tenantId,
            }),
          )
        : null;
    const senderConfirmation =
      releaseDecision.status === 'accepted'
        ? await resolveFinanceFilingReleaseTokenConfirmation?.({
            context,
            tenant,
            releaseDecision,
            report,
          }) ?? null
        : null;
    const tokenIssueBlockedReasonCodes =
      releaseDecision.status === 'accepted' && senderConfirmation === null
        ? Object.freeze(['finance-filing-release-sender-confirmation-required'])
        : Object.freeze([]);
    const issuedReleaseToken =
      releaseDecision.status === 'accepted' && senderConfirmation !== null
        ? await apiReleaseTokenIssuer.issue({
            decision: releaseDecision,
            issuedAt: report.timestamp,
            tenantId: tenant.tenantId,
            audience: material.target.id,
            resource: material.target.id,
            scope: 'financial-reporting:filing-export',
            tokenUse: 'release',
            confirmation: senderConfirmation,
          })
        : null;
    const decisionForEvidence = issuedReleaseToken
      ? {
          ...releaseDecision,
          releaseTokenId: issuedReleaseToken.tokenId,
        }
      : releaseDecision;
    if (issuedReleaseToken) {
      await apiReleaseIntrospectionStore.registerIssuedToken({
        issuedToken: issuedReleaseToken,
        decision: releaseDecision,
      });
    }
    const issuedEvidencePack =
      issuedReleaseToken
        ? await apiReleaseEvidencePackIssuer.issue({
            decision: decisionForEvidence,
            issuedAt: report.timestamp,
            decisionLogEntries: (await financeReleaseDecisionLog.entries())
              .filter((entry) => entry.decisionId === releaseDecision.id),
            decisionLogChainIntact: (await financeReleaseDecisionLog.verify()).valid,
            releaseToken: issuedReleaseToken,
            artifactReferences: Object.freeze(
              report.evidenceChain?.terminalHash
                ? [
                    {
                      kind: 'provenance',
                      path: `finance-evidence-chain://${report.runId}`,
                      digest: financeEvidenceChainArtifactDigest(report.runId, report.evidenceChain.terminalHash),
                    },
                  ]
                : [],
            ),
          })
        : null;
    if (issuedEvidencePack) {
      await apiReleaseEvidencePackStore.upsert(issuedEvidencePack);
    }

    return {
      targetId: material.target.id,
      decisionId: releaseDecision.id,
      decisionStatus: releaseDecision.status,
      policyVersion: releaseDecision.policyVersion,
      introspectionRequired:
        issuedReleaseToken?.claims.introspection_required ??
        releaseDecision.releaseConditions.items.some(
          (item) => item.kind === 'introspection' && item.required,
        ),
      outputHash: material.hashBundle.outputHash,
      consequenceHash: material.hashBundle.consequenceHash,
      tokenId: issuedReleaseToken?.tokenId ?? null,
      token: issuedReleaseToken?.token ?? null,
      expiresAt: issuedReleaseToken?.expiresAt ?? null,
      evidencePackId: issuedEvidencePack?.evidencePack.id ?? null,
      evidencePackPath: issuedEvidencePack
        ? `/api/v1/admin/release-evidence/${issuedEvidencePack.evidencePack.id}`
        : null,
      evidencePackDigest: issuedEvidencePack?.bundleDigest ?? null,
      reviewQueueId: reviewQueueItem?.id ?? null,
      reviewQueuePath: reviewQueueItem
        ? `/api/v1/admin/release-reviews/${reviewQueueItem.id}`
        : null,
      tenantId: tenant.tenantId,
      senderConstrained: Boolean(issuedReleaseToken?.claims.cnf?.jkt),
      presentationRequired: issuedReleaseToken ? 'sender-constrained' : null,
      tokenIssueStatus:
        issuedReleaseToken
          ? 'issued'
          : releaseDecision.status === 'accepted'
            ? 'blocked'
            : 'not-required',
      reasonCodes: tokenIssueBlockedReasonCodes,
      candidate: filingCandidate,
    };
  }

  async function evaluateFinanceCommunicationReleaseTarget(
    context: Context,
    report: FinancialRunReport,
    reviewerIdentity: ReviewerIdentity | undefined,
  ): Promise<FinanceCommunicationReleaseSummary | null> {
    const communicationCandidate = createFinanceCommunicationReleaseCandidateFromReport(report);
    if (!communicationCandidate) return null;

    const communicationMaterial = buildFinanceCommunicationReleaseMaterial(communicationCandidate);
    const communicationShadow = await financeCommunicationReleaseShadowEvaluator.evaluate(
      releaseEvaluationRequest({
        id: `release_comm_${randomUUID()}`,
        createdAt: report.timestamp,
        material: communicationMaterial,
        requester: currentReleaseRequester(context, reviewerIdentity),
        context: currentReleaseEvaluationContext(context),
      }),
      buildFinanceCommunicationReleaseObservation(communicationMaterial, report),
    );

    return {
      targetId: communicationMaterial.target.id,
      decisionId: communicationShadow.evaluation.decision.id,
      decisionStatus: communicationShadow.evaluation.decision.status,
      policyVersion: communicationShadow.evaluation.decision.policyVersion,
      policyRolloutMode: communicationShadow.policyRolloutMode,
      policyEvaluationMode: communicationShadow.policyEvaluationMode,
      wouldBlockIfEnforced: communicationShadow.wouldBlockIfEnforced,
      wouldRequireReview: communicationShadow.wouldRequireReview,
      wouldRequireToken: communicationShadow.wouldRequireToken,
      outputHash: communicationMaterial.hashBundle.outputHash,
      consequenceHash: communicationMaterial.hashBundle.consequenceHash,
      preview: {
        recipientId: communicationCandidate.recipientId,
        channelId: communicationCandidate.channelId,
        subject: communicationCandidate.subject,
      },
    };
  }

  async function evaluateFinanceActionReleaseTarget(
    context: Context,
    report: FinancialRunReport,
    reviewerIdentity: ReviewerIdentity | undefined,
  ): Promise<FinanceActionReleaseSummary | null> {
    const actionCandidate = createFinanceActionReleaseCandidateFromReport(report);
    if (!actionCandidate) return null;

    const actionMaterial = buildFinanceActionReleaseMaterial(actionCandidate);
    const actionShadow = await financeActionReleaseShadowEvaluator.evaluate(
      releaseEvaluationRequest({
        id: `release_action_${randomUUID()}`,
        createdAt: report.timestamp,
        material: actionMaterial,
        requester: currentReleaseRequester(context, reviewerIdentity),
        context: currentReleaseEvaluationContext(context),
      }),
      buildFinanceActionReleaseObservation(actionMaterial, report),
    );

    return {
      targetId: actionMaterial.target.id,
      decisionId: actionShadow.evaluation.decision.id,
      decisionStatus: actionShadow.evaluation.decision.status,
      policyVersion: actionShadow.evaluation.decision.policyVersion,
      policyRolloutMode: actionShadow.policyRolloutMode,
      policyEvaluationMode: actionShadow.policyEvaluationMode,
      wouldBlockIfEnforced: actionShadow.wouldBlockIfEnforced,
      wouldRequireReview: actionShadow.wouldRequireReview,
      wouldRequireToken: actionShadow.wouldRequireToken,
      outputHash: actionMaterial.hashBundle.outputHash,
      consequenceHash: actionMaterial.hashBundle.consequenceHash,
      preview: {
        workflowId: actionCandidate.workflowId,
        actionType: actionCandidate.actionType,
        requestedTransition: actionCandidate.requestedTransition,
      },
    };
  }

  async function buildPipelineRunAutoFilingArtifacts(
    report: FinancialRunReport,
    shouldSign: boolean,
  ) {
    if (!shouldSign || !report.certificate) {
      return { filingExport: null, filingPackage: null };
    }
    try {
      const adapter = filingRegistry.get('xbrl-us-gaap-2024');
      if (!adapter) return { filingExport: null, filingPackage: null };
      const { issueFilingPackage } = await import('../../../filing/report-package.js');
      const envelope = buildCounterpartyEnvelope(
        report.runId, report.decision, report.certificate?.certificateId ?? null,
        report.evidenceChain?.terminalHash ?? '', report.execution?.rows ?? [], report.liveProof.mode,
      );
      const mapping = adapter.mapToTaxonomy(envelope);
      const pkg = adapter.generatePackage(mapping);
      pkg.evidenceLink = {
        runId: report.runId,
        certificateId: report.certificate?.certificateId ?? null,
        evidenceChainTerminal: report.evidenceChain?.terminalHash ?? '',
      };
      pkg.issuedPackage = await issueFilingPackage(pkg);
      return {
        filingExport: { adapterId: adapter.id, coveragePercent: mapping.coveragePercent, mappedCount: mapping.mapped.length },
        filingPackage: {
          adapterId: adapter.id,
          coveragePercent: mapping.coveragePercent,
          mappedCount: mapping.mapped.length,
          issuedPackage: pkg.issuedPackage,
        },
      };
    } catch {
      return {
        filingExport: null,
        filingPackage: null,
        filingPackageError: 'Filing package generation failed.',
      };
    }
  }


// Pipeline Run

app.post('/api/v1/pipeline/run', async (c) => {
  try {
    if (!acceptsJsonRequestBody(c)) {
      return c.json({ error: 'Pipeline route requires Content-Type: application/json.' }, 415);
    }
    const body = await c.req.json();
    const { candidateSql, intent, sign } = body;

    if (!candidateSql || !intent) {
      return c.json({ error: 'candidateSql and intent are required' }, 400);
    }

    const tenant = currentTenant(c);
    const routeId = 'POST /api/v1/pipeline/run';
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim() || null;
    if (!idempotencyKey) {
      return c.json({
        error: 'Pipeline route requires Idempotency-Key before execution.',
        detail: 'Retry-safe pipeline runs must bind a tenant-scoped idempotency key before quota, rate-limit, connector, signing, or pipeline work can start.',
      }, 428);
    }
    const idempotency = await pipelineIdempotencyService.begin({
      idempotencyKey,
      tenantId: tenant.tenantId,
      routeId,
      requestPayload: body,
    });
    if (idempotency.kind === 'conflict') {
      return c.json(idempotency.responseBody, idempotency.statusCode);
    }
    if (idempotency.kind === 'unavailable') {
      return c.json(idempotency.responseBody, idempotency.statusCode);
    }
    if (idempotency.kind === 'replay') {
      return new Response(JSON.stringify(idempotency.responseBody), {
        status: idempotency.statusCode,
        headers: idempotency.headers,
      });
    }

    const quotaCheck = await pipelineUsageService.check(tenant);
    if (!quotaCheck.allowed) {
      return c.json({
        error: 'Monthly pipeline run quota exceeded for this tenant plan.',
        tenantContext: { tenantId: tenant.tenantId, source: tenant.source, planId: tenant.planId },
        usage: quotaCheck.usage,
      }, 429);
    }
    const rateReservation = await reserveTenantPipelineRequest(tenant.tenantId, tenant.planId);
    if (!rateReservation.allowed) {
      applyRateLimitHeaders(c, rateReservation.rateLimit, { includeRetryAfter: true });
      return c.json({
        error: 'Pipeline request rate limit exceeded for this tenant plan.',
        tenantContext: { tenantId: tenant.tenantId, source: tenant.source, planId: tenant.planId },
        usage: quotaCheck.usage,
        rateLimit: rateReservation.rateLimit,
      }, 429);
    }
    const rateLimit = rateReservation.rateLimit;
    applyRateLimitHeaders(c, rateLimit);

    // Optional connector-backed execution
    let connectorExecution: PipelineConnectorExecution | null = null;
    let connectorProvider: string | null = null;
    let fullSchemaAttestation: SchemaAttestation | null = null;

    // Special case: 'postgres-prove' uses the full postgres-prove path with schema attestation
    if (body.connector === 'postgres-prove') {
      try {
        const { isPostgresConfigured } = await import('../../../connectors/postgres.js');
        const { runPostgresProve } = await import('../../../connectors/postgres-prove.js');
        if (!isPostgresConfigured()) {
          return c.json({ error: "Connector 'postgres-prove' not configured (env vars missing)" }, 400);
        }
        const pgResult = await runPostgresProve(candidateSql);
        if (!pgResult.execution?.success) {
          return c.json({
            error: "Connector 'postgres-prove' execution failed.",
            connector: 'postgres-prove',
            proofMode: 'unavailable',
          }, 502);
        }
        connectorExecution = {
          ...pgResult.execution,
          schemaAttestation: pgResult.schemaAttestation,
        };
        connectorProvider = 'postgres';
        fullSchemaAttestation = pgResult.schemaAttestation;
      } catch {
        return c.json({
          error: "Connector 'postgres-prove' execution failed.",
          connector: 'postgres-prove',
          detail: 'Connector execution failed before proof evidence could be collected.',
          proofMode: 'unavailable',
        }, 502);
      }
    } else if (body.connector) {
      const connector = connectorRegistry.get(body.connector);
      if (!connector) {
        return c.json({ error: `Connector '${body.connector}' not registered. Available: ${connectorRegistry.listIds().join(', ')}` }, 404);
      }
      const connConfig = connector.loadConfig();
      if (!connConfig) {
        return c.json({ error: `Connector '${body.connector}' not configured (env vars missing)` }, 400);
      }
      try {
        const result = await connector.execute(candidateSql, connConfig);
        if (!result.success) {
          return c.json({
            error: `Connector '${body.connector}' execution failed.`,
            connector: body.connector,
            detail: 'Connector returned an unsuccessful execution result.',
            proofMode: 'unavailable',
          }, 502);
        }
        connectorExecution = connectorExecutionEvidenceFromResult(result);
        connectorProvider = result.provider;
      } catch {
        return c.json({
          error: `Connector '${body.connector}' execution failed.`,
          connector: body.connector,
          detail: 'Connector execution failed before proof evidence could be collected.',
          proofMode: 'unavailable',
        }, 502);
      }
    }

    // Keyless signer created after identity resolution (below)

    // OIDC-backed reviewer identity. Body reviewer fields are display/request
    // metadata only; they cannot satisfy financial review authority.
    let reviewerIdentity: ReviewerIdentity | undefined;
    let oidcVerified = false;
    const requestedReviewerName =
      typeof body.reviewerName === 'string' && body.reviewerName.trim().length > 0
        ? body.reviewerName.trim()
        : null;

    if (body.reviewerOidcToken && body.oidcIssuer) {
      const oidcResult = await verifyOidcToken(body.reviewerOidcToken, {
        issuer: body.oidcIssuer,
        audience: body.oidcAudience,
      });
      if (oidcResult.verified && oidcResult.identity) {
        reviewerIdentity = oidcResult.identity;
        oidcVerified = true;
      } else {
        return c.json({ error: `OIDC token verification failed: ${oidcResult.error}`, identitySource: 'rejected' }, 401);
      }
    }

    const identitySource = classifyIdentitySource(oidcVerified, false);

    // Keyless-first: per-request ephemeral keys with CA-issued short-lived certs
    const keylessPair = sign ? createRequestSigners(identitySource, reviewerIdentity?.name) : null;
    const keyPair = keylessPair?.signer.signingKeyPair;
    const reviewerKeyPair =
      sign && oidcVerified && reviewerIdentity && keylessPair
        ? keylessPair.reviewer.signingKeyPair
        : undefined;

    const input: FinancialPipelineInput = {
      runId: opaqueRouteRunId('api'),
      intent,
      candidateSql,
      fixtures: body.fixtures ?? [],
      generatedReport: body.generatedReport,
      reportContract: body.reportContract,
      signingKeyPair: keyPair,
      // Connector-backed execution evidence
      ...(connectorExecution ? {
        externalExecution: connectorExecution,
        liveProof: {
          collectedAt: new Date().toISOString(),
          execution: { live: true, provider: connectorProvider!, mode: 'live_db' as const, latencyMs: connectorExecution.durationMs ?? null },
        },
      } : {}),
      ...(reviewerIdentity && reviewerKeyPair ? {
        approval: {
          status: 'approved' as const,
          reviewerRole: reviewerIdentity.role,
          reviewNote: `API reviewer (${identitySource})`,
          reviewerIdentity,
          reviewerKeyPair,
        },
      } : {}),
    };

    const report = runFinancialPipeline(input);

    let kit = null;
    if (keyPair && report.certificate) {
      kit = buildVerificationKit(
        report, keyPair.publicKeyPem, undefined,
        keylessPair?.signer.trustChain ?? null,
        keylessPair?.signer.caPublicKeyPem ?? null,
      );
    }

    const financeFilingRelease = await evaluateFinanceFilingReleaseTarget(
      c,
      tenant,
      report,
      reviewerIdentity,
      Boolean(sign),
    );
    const financeCommunicationRelease = await evaluateFinanceCommunicationReleaseTarget(
      c,
      report,
      reviewerIdentity,
    );
    const financeActionRelease = await evaluateFinanceActionReleaseTarget(
      c,
      report,
      reviewerIdentity,
    );

    const usageConsumption = await pipelineUsageService.consume(tenant);
    const { usage, billingMetering } = usageConsumption;

    const filingAuto = await buildPipelineRunAutoFilingArtifacts(report, Boolean(sign));

    const responseBody = {
      runId: report.runId,
      decision: report.decision,
      scoring: {
        scorersRun: report.scoring.scorersRun,
        decision: report.scoring.decision,
      },
      warrant: report.warrant.status,
      escrow: report.escrow.state,
      receipt: report.receipt?.receiptStatus ?? null,
      capsule: report.capsule?.authorityState ?? null,
      proofMode: report.liveProof.mode,
      auditEntries: report.audit.entries.length,
      auditChainIntact: report.audit.chainIntact,
      // Full certificate for independent verification
      certificate: report.certificate ?? null,
      verification: kit?.verification ?? null,
      publicKeyPem: keyPair?.publicKeyPem ?? null,
      trustChain: keylessPair?.signer.trustChain ?? null,
      caPublicKeyPem: keylessPair?.signer.caPublicKeyPem ?? null,
      signingMode: sign ? 'keyless' : null,
      connectorUsed: connectorProvider,
      // Schema/data-state attestation
      schemaAttestation: fullSchemaAttestation
        ? schemaAttestationSummaryFromFull(fullSchemaAttestation)
        : schemaAttestationSummaryFromConnector(connectorExecution, connectorProvider),
      // Tenant context (from middleware)
      tenantContext: (() => {
        return { tenantId: tenant.tenantId, source: tenant.source, planId: tenant.planId };
      })(),
      usage,
      billingMetering,
      rateLimit,
      identitySource,
      reviewerName: reviewerIdentity?.name ?? null,
      reviewerRequest: requestedReviewerName
        ? {
            name: requestedReviewerName,
            authorityBearing: false,
            reasonCodes: ['reviewer-identity-not-verified'],
          }
        : null,
      release: {
        filingExport: financeFilingRelease,
        communication: financeCommunicationRelease,
        action: financeActionRelease,
      },
      // Auto-filing: when sign=true and filing adapter is available, include XBRL summary + issued report package
      ...filingAuto,
    };
    const finalized = await pipelineIdempotencyService.finalize({
      idempotencyKey: idempotency.idempotencyKey,
      tenantId: tenant.tenantId,
      routeId,
      requestPayload: body,
      statusCode: 200,
      responseBody,
    });
    return c.json(finalized);
  } catch {
    return c.json({ error: 'Pipeline route failed.' }, 500);
  }
});
}
