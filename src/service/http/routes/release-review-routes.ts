import type { Context, Hono } from 'hono';
import {
  review,
  type IssuedReleaseEvidencePack,
  type IssuedReleaseToken,
  type ReleaseDecision,
  type ReleaseEvidencePackIssuer,
  type ReleaseEvidencePolicyContext,
  type ReleaseEvidenceTokenPolicyContext,
  type ReleaseReviewerQueueDetail,
  type ReleaseReviewerQueueListResult,
  type ReleaseReviewerQueueRecord,
  type ReleaseTokenConfirmationClaim,
  type ReleaseTokenIssuer,
} from '../../../release-layer/index.js';
import type {
  RequestPathReleaseDecisionLogWriter,
  RequestPathReleaseEvidencePackStore,
  RequestPathReleaseReviewerQueueStore,
  RequestPathReleaseTokenIntrospectionStore,
} from '../../release/release-authority-request-path.js';
import {
  RELEASE_ADMIN_BREAK_GLASS_ROLES,
  RELEASE_ADMIN_MUTATION_ROLES,
  RELEASE_ADMIN_READ_ROLES,
  authorizeReleaseAdminRoute,
} from '../release-admin-authorization.js';
import { secureHtmlResponseHeaders } from '../route-response-helpers.js';
import {
  actorDisplayName,
  actorPolicyRole,
  parsePositiveLimit,
  parseReviewActionBody,
  readReviewField,
  readReviewListOptions,
} from './release-review-route-request.js';
import {
  appendReviewerTimelineToDecisionLog,
  appendReviewerTimelineToDecisionLogOnce,
  releaseReviewClosureId,
  releaseReviewClosureNeedsRepair,
  releaseReviewTenantId,
  releaseReviewTerminalOccurredAt,
} from './release-review-route-closure-helpers.js';
import { buildReviewActionResponse } from './release-review-route-responses.js';
import type {
  AdminMutationFinalizationInput,
  AdminMutationRequestResult,
  IssuedReleaseTokenResponse,
} from './release-review-route-types.js';

const {
  ReleaseReviewerQueueError,
  applyBreakGlassOverride,
  applyReviewerDecision,
  attachIssuedTokenToReviewerQueueRecord,
} = review;


export interface ReleaseReviewRouteDeps {
  currentAdminAuthorized(c: Context): Response | null;
  apiReleaseReviewerQueueStore: RequestPathReleaseReviewerQueueStore;
  renderReleaseReviewerQueueInboxPage(result: ReleaseReviewerQueueListResult): string;
  renderReleaseReviewerQueueDetailPage(detail: ReleaseReviewerQueueDetail): string;
  financeReleaseDecisionLog: RequestPathReleaseDecisionLogWriter;
  apiReleaseTokenIssuer: ReleaseTokenIssuer;
  apiReleaseEvidencePackStore: RequestPathReleaseEvidencePackStore;
  apiReleaseEvidencePackIssuer: ReleaseEvidencePackIssuer;
  apiReleaseIntrospectionStore: RequestPathReleaseTokenIntrospectionStore;
  resolveReleaseReviewTokenConfirmation?(input: {
    context: Context;
    decision: ReleaseDecision;
    issuedAt: string;
    override: boolean;
  }): Promise<ReleaseTokenConfirmationClaim | null> | ReleaseTokenConfirmationClaim | null;
  adminMutationRequest(
    c: Context,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AdminMutationRequestResult | Response>;
  finalizeAdminMutation(input: AdminMutationFinalizationInput): Promise<Record<string, unknown>>;
}


export interface IssuedEvidencePackResponse extends Record<string, unknown> {
  evidencePackId: string;
  exportPath: string;
  bundleDigest: string;
  predicateType: string;
  retentionClass: string;
  subjectCount: number;
  policyContext: ReleaseEvidencePolicyContext;
}


function buildIssuedReleaseTokenResponse(
  issuedToken: IssuedReleaseToken,
): IssuedReleaseTokenResponse {
  const policyContext: ReleaseEvidenceTokenPolicyContext = {
    policyVersion: issuedToken.claims.policy_version ?? null,
    policyHash: issuedToken.claims.policy_hash,
    policyIrHash: issuedToken.claims.policy_ir_hash ?? null,
    policyProvenanceSource: issuedToken.claims.policy_provenance_source ?? null,
    compiledPolicyIndexVersion: issuedToken.claims.compiled_policy_index_version ?? null,
    compiledPolicyIrVersion: issuedToken.claims.compiled_policy_ir_version ?? null,
  };

  return {
    tokenId: issuedToken.tokenId,
    token: issuedToken.token,
    expiresAt: issuedToken.expiresAt,
    targetId: issuedToken.claims.aud,
    decisionId: issuedToken.claims.decision_id,
    ttlSeconds: issuedToken.claims.exp - issuedToken.claims.iat,
    override: issuedToken.claims.override,
    tenantId: issuedToken.claims.tenant_id ?? null,
    senderConstrained: Boolean(issuedToken.claims.cnf?.jkt),
    presentationRequired: 'sender-constrained',
    policyVersion: policyContext.policyVersion,
    policyHash: policyContext.policyHash,
    policyIrHash: policyContext.policyIrHash,
    policyProvenanceSource: policyContext.policyProvenanceSource,
    compiledPolicyIndexVersion: policyContext.compiledPolicyIndexVersion,
    compiledPolicyIrVersion: policyContext.compiledPolicyIrVersion,
    policyContext,
  };
}


function buildIssuedEvidencePackResponse(
  issuedEvidencePack: IssuedReleaseEvidencePack,
): IssuedEvidencePackResponse {
  return {
    evidencePackId: issuedEvidencePack.evidencePack.id,
    exportPath: `/api/v1/admin/release-evidence/${issuedEvidencePack.evidencePack.id}`,
    bundleDigest: issuedEvidencePack.bundleDigest,
    predicateType: issuedEvidencePack.statement.predicateType,
    retentionClass: issuedEvidencePack.evidencePack.retentionClass,
    subjectCount: issuedEvidencePack.statement.subject.length,
    policyContext: issuedEvidencePack.evidencePack.policyContext,
  };
}


async function completeReleaseReviewAuthorityClosure(input: {
  readonly record: ReleaseReviewerQueueRecord;
  readonly issuedAt: string;
  readonly override: boolean;
  readonly senderConfirmation: ReleaseTokenConfirmationClaim;
  readonly queueStore: RequestPathReleaseReviewerQueueStore;
  readonly decisionLog: RequestPathReleaseDecisionLogWriter;
  readonly tokenIssuer: ReleaseTokenIssuer;
  readonly introspectionStore: RequestPathReleaseTokenIntrospectionStore;
  readonly evidencePackIssuer: ReleaseEvidencePackIssuer;
  readonly evidencePackStore: RequestPathReleaseEvidencePackStore;
}): Promise<{
  readonly stored: ReleaseReviewerQueueDetail;
  readonly responseToken: IssuedReleaseTokenResponse;
  readonly responseEvidencePack: IssuedEvidencePackResponse;
}> {
  const actionPhase = input.override ? 'override' : 'review';
  const actionRequestSuffix = input.override ? 'override' : 'approve';
  const reviewId = input.record.detail.id;

  await appendReviewerTimelineToDecisionLogOnce(
    input.decisionLog,
    input.record.releaseDecision,
    input.issuedAt,
    `review:${reviewId}:${actionRequestSuffix}`,
    actionPhase,
  );
  await appendReviewerTimelineToDecisionLogOnce(
    input.decisionLog,
    input.record.releaseDecision,
    input.issuedAt,
    `review:${reviewId}:terminal-accept`,
    'terminal-accept',
  );

  const tokenId =
    input.record.detail.issuedReleaseToken?.tokenId ??
    input.record.releaseDecision.releaseTokenId ??
    releaseReviewClosureId('rt', input.record);
  const issuedToken = await input.tokenIssuer.issue({
    decision: input.record.releaseDecision,
    issuedAt: input.issuedAt,
    tokenId,
    ttlSeconds: input.override ? 60 : undefined,
    tenantId: releaseReviewTenantId(input.record),
    audience: input.record.releaseDecision.target.id,
    resource: input.record.releaseDecision.target.id,
    scope: 'financial-reporting:filing-export',
    tokenUse: 'release',
    confirmation: input.senderConfirmation,
  });
  await input.introspectionStore.registerIssuedToken({
    issuedToken,
    decision: input.record.releaseDecision,
  });

  const tokenRecord = attachIssuedTokenToReviewerQueueRecord({
    record: input.record,
    issuedToken,
  });
  const evidencePackId =
    tokenRecord.detail.evidencePackId ??
    tokenRecord.releaseDecision.evidencePackId ??
    releaseReviewClosureId('ep', input.record);
  const releaseDecisionWithEvidence: ReleaseDecision = {
    ...tokenRecord.releaseDecision,
    evidencePackId,
  };
  await appendReviewerTimelineToDecisionLogOnce(
    input.decisionLog,
    releaseDecisionWithEvidence,
    input.issuedAt,
    `review:${reviewId}:evidence-pack`,
    'evidence-pack',
  );
  const issuedEvidencePack = await input.evidencePackIssuer.issue({
    decision: releaseDecisionWithEvidence,
    evidencePackId,
    issuedAt: input.issuedAt,
    decisionLogEntries: (await input.decisionLog.entries())
      .filter((entry) => entry.decisionId === releaseDecisionWithEvidence.id),
    decisionLogChainIntact: (await input.decisionLog.verify()).valid,
    review: tokenRecord.detail,
    releaseToken: issuedToken,
  });
  await input.evidencePackStore.upsert(issuedEvidencePack);

  const finalRecord: ReleaseReviewerQueueRecord = {
    detail: {
      ...tokenRecord.detail,
      updatedAt: input.issuedAt,
      evidencePackId,
      timeline: [
        ...tokenRecord.detail.timeline,
        {
          occurredAt: input.issuedAt,
          phase: 'evidence-pack' as const,
          decisionStatus: tokenRecord.releaseDecision.status,
          requiresReview: false,
          deterministicChecksCompleted: true,
          reviewerLabel: 'Attestor release evidence issuer',
        },
      ],
    },
    releaseDecision: releaseDecisionWithEvidence,
  };

  return {
    stored: await input.queueStore.upsert(finalRecord),
    responseToken: buildIssuedReleaseTokenResponse(issuedToken),
    responseEvidencePack: buildIssuedEvidencePackResponse(issuedEvidencePack),
  };
}

export function registerReleaseReviewRoutes(app: Hono, deps: ReleaseReviewRouteDeps): void {
  const {
    currentAdminAuthorized,
    apiReleaseReviewerQueueStore,
    renderReleaseReviewerQueueInboxPage,
    renderReleaseReviewerQueueDetailPage,
    financeReleaseDecisionLog,
    apiReleaseTokenIssuer,
    apiReleaseEvidencePackStore,
    apiReleaseEvidencePackIssuer,
    apiReleaseIntrospectionStore,
    resolveReleaseReviewTokenConfirmation,
    adminMutationRequest,
    finalizeAdminMutation,
  } = deps;

  app.get('/api/v1/admin/release-evidence/:id', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const pack = await apiReleaseEvidencePackStore.get(c.req.param('id'));
    if (!pack) {
      return c.json({ error: `Release evidence pack '${c.req.param('id')}' not found.` }, 404);
    }

    c.header('cache-control', 'no-store');
    return c.json({ evidencePack: pack });
  });

  app.get('/api/v1/admin/release-reviews', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const limit = parsePositiveLimit(c.req.query('limit'));
    if (c.req.query('limit') !== undefined && limit === null) {
      return c.json({ error: 'limit must be a positive integer.' }, 400);
    }

    const result = await apiReleaseReviewerQueueStore.listPending(readReviewListOptions(c));

    c.header('cache-control', 'no-store');
    return c.json({
      generatedAt: result.generatedAt,
      totalPending: result.totalPending,
      countsByRiskClass: result.countsByRiskClass,
      items: result.items,
    });
  });

  app.get('/api/v1/admin/release-reviews/inbox', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const limit = parsePositiveLimit(c.req.query('limit'));
    if (c.req.query('limit') !== undefined && limit === null) {
      return c.json({ error: 'limit must be a positive integer.' }, 400);
    }

    const result = await apiReleaseReviewerQueueStore.listPending(readReviewListOptions(c));

    return c.body(renderReleaseReviewerQueueInboxPage(result), 200, secureHtmlResponseHeaders());
  });

  app.get('/api/v1/admin/release-reviews/:id', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const item = await apiReleaseReviewerQueueStore.get(c.req.param('id'));
    if (!item) {
      return c.json({ error: `Release review '${c.req.param('id')}' not found.` }, 404);
    }

    c.header('cache-control', 'no-store');
    return c.json({ review: item });
  });

  app.get('/api/v1/admin/release-reviews/:id/view', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_READ_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const item = await apiReleaseReviewerQueueStore.get(c.req.param('id'));
    if (!item) {
      return c.json({ error: `Release review '${c.req.param('id')}' not found.` }, 404);
    }

    return c.body(renderReleaseReviewerQueueDetailPage(item), 200, secureHtmlResponseHeaders());
  });

  app.post('/api/v1/admin/release-reviews/:id/approve', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseReviewActionBody(c);
    const routeId = 'admin.release_review.approve';
    const mutation = await adminMutationRequest(c, routeId, body);
    if (mutation instanceof Response) {
      return mutation;
    }

    const record = await apiReleaseReviewerQueueStore.getRecord(c.req.param('id'));
    if (!record) {
      return c.json({ error: `Release review '${c.req.param('id')}' not found.` }, 404);
    }

    try {
      if (releaseReviewClosureNeedsRepair(record, 'approved')) {
        const issuedAt = releaseReviewTerminalOccurredAt(record, new Date().toISOString());
        const senderConfirmation =
          await resolveReleaseReviewTokenConfirmation?.({
            context: c,
            decision: record.releaseDecision,
            issuedAt,
            override: false,
          }) ?? null;
        if (senderConfirmation === null) {
          return c.json({
            error: 'release_token_sender_confirmation_required',
            error_description:
              'A valid DPoP proof is required before repairing a sender-constrained release token closure.',
          }, 400);
        }
        const closure = await completeReleaseReviewAuthorityClosure({
          record,
          issuedAt,
          override: false,
          senderConfirmation,
          queueStore: apiReleaseReviewerQueueStore,
          decisionLog: financeReleaseDecisionLog,
          tokenIssuer: apiReleaseTokenIssuer,
          introspectionStore: apiReleaseIntrospectionStore,
          evidencePackIssuer: apiReleaseEvidencePackIssuer,
          evidencePackStore: apiReleaseEvidencePackStore,
        });
        c.header('cache-control', 'no-store');
        return c.json(
          await finalizeAdminMutation({
            idempotencyKey: mutation.idempotencyKey,
            routeId,
            requestPayload: body,
            statusCode: 200,
            responseBody: buildReviewActionResponse(
              closure.stored,
              closure.responseToken,
              closure.responseEvidencePack,
            ),
            audit: {
              action: 'release_review.approved',
              requestHash: mutation.requestHash,
              metadata: {
                reviewId: closure.stored.id,
                decisionId: closure.stored.decisionId,
                reviewerId: authorized.releaseActor.id,
                reviewerRole: actorPolicyRole(authorized),
                authorityState: closure.stored.authorityState,
                closureRepaired: true,
              },
            },
          }),
        );
      }

      const decidedAt = new Date().toISOString();
      const expectedAuthorityState = record.detail.authorityState;
      const expectedReviewerDecisionCount = record.detail.reviewerDecisions.length;
      const finalApprovalWouldIssueToken = record.detail.approvalsRemaining <= 1;
      const senderConfirmation =
        finalApprovalWouldIssueToken
          ? await resolveReleaseReviewTokenConfirmation?.({
              context: c,
              decision: record.releaseDecision,
              issuedAt: decidedAt,
              override: false,
            }) ?? null
          : null;
      if (finalApprovalWouldIssueToken && senderConfirmation === null) {
        return c.json({
          error: 'release_token_sender_confirmation_required',
          error_description:
            'A valid DPoP proof is required before issuing a sender-constrained release token.',
        }, 400);
      }
      const transition = applyReviewerDecision({
        record,
        outcome: 'approved',
        reviewerId: authorized.releaseActor.id,
        reviewerName: actorDisplayName(authorized.releaseActor),
        reviewerRole: actorPolicyRole(authorized),
        note: readReviewField(body, 'note'),
        decidedAt,
      });

      let stored = await apiReleaseReviewerQueueStore.commitPendingTransition({
        record: transition.record,
        expectedAuthorityState,
        expectedReviewerDecisionCount,
      });

      let responseToken: IssuedReleaseTokenResponse | null = null;
      let responseEvidencePack: IssuedEvidencePackResponse | null = null;
      if (transition.record.detail.authorityState === 'approved') {
        if (senderConfirmation === null) {
          throw new Error('release token sender confirmation was not resolved for final approval');
        }
        const closure = await completeReleaseReviewAuthorityClosure({
          record: transition.record,
          issuedAt: decidedAt,
          override: false,
          senderConfirmation,
          queueStore: apiReleaseReviewerQueueStore,
          decisionLog: financeReleaseDecisionLog,
          tokenIssuer: apiReleaseTokenIssuer,
          introspectionStore: apiReleaseIntrospectionStore,
          evidencePackIssuer: apiReleaseEvidencePackIssuer,
          evidencePackStore: apiReleaseEvidencePackStore,
        });
        stored = closure.stored;
        responseToken = closure.responseToken;
        responseEvidencePack = closure.responseEvidencePack;
      } else {
        await appendReviewerTimelineToDecisionLog(
          financeReleaseDecisionLog,
          transition.record.releaseDecision,
          decidedAt,
          `review:${transition.record.detail.id}:approve`,
          'review',
        );
      }
      c.header('cache-control', 'no-store');
      return c.json(
        await finalizeAdminMutation({
          idempotencyKey: mutation.idempotencyKey,
          routeId,
          requestPayload: body,
          statusCode: 200,
          responseBody: buildReviewActionResponse(stored, responseToken, responseEvidencePack),
          audit: {
            action: 'release_review.approved',
            requestHash: mutation.requestHash,
            metadata: {
              reviewId: stored.id,
              decisionId: stored.decisionId,
              reviewerId: authorized.releaseActor.id,
              reviewerRole: actorPolicyRole(authorized),
              authorityState: stored.authorityState,
              approvalsRecorded: stored.approvalsRecorded,
              releaseTokenId: responseToken?.tokenId ?? null,
              evidencePackId: responseEvidencePack?.evidencePackId ?? null,
            },
          },
        }),
      );
    } catch (error) {
      if (error instanceof ReleaseReviewerQueueError) {
        const status =
          error.code === 'already_finalized'
            ? 409
            : error.code === 'duplicate_reviewer'
              ? 409
              : error.code === 'reviewer_not_allowed' || error.code === 'reviewer_role_not_allowed'
                ? 403
                : 400;
        return c.json({ error: error.message, code: error.code }, status);
      }

      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  });

  app.post('/api/v1/admin/release-reviews/:id/reject', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_MUTATION_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseReviewActionBody(c);
    const routeId = 'admin.release_review.reject';
    const mutation = await adminMutationRequest(c, routeId, body);
    if (mutation instanceof Response) {
      return mutation;
    }

    const record = await apiReleaseReviewerQueueStore.getRecord(c.req.param('id'));
    if (!record) {
      return c.json({ error: `Release review '${c.req.param('id')}' not found.` }, 404);
    }

    try {
      if (releaseReviewClosureNeedsRepair(record, 'overridden')) {
        const issuedAt = releaseReviewTerminalOccurredAt(record, new Date().toISOString());
        const senderConfirmation =
          await resolveReleaseReviewTokenConfirmation?.({
            context: c,
            decision: record.releaseDecision,
            issuedAt,
            override: true,
          }) ?? null;
        if (senderConfirmation === null) {
          return c.json({
            error: 'release_token_sender_confirmation_required',
            error_description:
              'A valid DPoP proof is required before repairing a sender-constrained release token closure.',
          }, 400);
        }
        const closure = await completeReleaseReviewAuthorityClosure({
          record,
          issuedAt,
          override: true,
          senderConfirmation,
          queueStore: apiReleaseReviewerQueueStore,
          decisionLog: financeReleaseDecisionLog,
          tokenIssuer: apiReleaseTokenIssuer,
          introspectionStore: apiReleaseIntrospectionStore,
          evidencePackIssuer: apiReleaseEvidencePackIssuer,
          evidencePackStore: apiReleaseEvidencePackStore,
        });
        c.header('cache-control', 'no-store');
        return c.json(
          await finalizeAdminMutation({
            idempotencyKey: mutation.idempotencyKey,
            routeId,
            requestPayload: body,
            statusCode: 200,
            responseBody: buildReviewActionResponse(
              closure.stored,
              closure.responseToken,
              closure.responseEvidencePack,
            ),
            audit: {
              action: 'release_break_glass.issued',
              requestHash: mutation.requestHash,
              metadata: {
                reviewId: closure.stored.id,
                decisionId: closure.stored.decisionId,
                reasonCode: closure.stored.overrideGrant?.reasonCode ?? null,
                ticketId: closure.stored.overrideGrant?.ticketId ?? null,
                requestedById: closure.stored.overrideGrant?.requestedById ?? null,
                requestedByRole: closure.stored.overrideGrant?.requestedByRole ?? null,
                authorityState: closure.stored.authorityState,
                releaseTokenId: closure.responseToken.tokenId,
                evidencePackId: closure.responseEvidencePack.evidencePackId,
                ttlSeconds: closure.responseToken.ttlSeconds,
                closureRepaired: true,
              },
            },
          }),
        );
      }

      const decidedAt = new Date().toISOString();
      const expectedAuthorityState = record.detail.authorityState;
      const expectedReviewerDecisionCount = record.detail.reviewerDecisions.length;
      const transition = applyReviewerDecision({
        record,
        outcome: 'rejected',
        reviewerId: authorized.releaseActor.id,
        reviewerName: actorDisplayName(authorized.releaseActor),
        reviewerRole: actorPolicyRole(authorized),
        note: readReviewField(body, 'note'),
        decidedAt,
      });

      const stored = await apiReleaseReviewerQueueStore.commitPendingTransition({
        record: transition.record,
        expectedAuthorityState,
        expectedReviewerDecisionCount,
      });

      await appendReviewerTimelineToDecisionLog(
        financeReleaseDecisionLog,
        transition.record.releaseDecision,
        decidedAt,
        `review:${transition.record.detail.id}:reject`,
        'review',
      );
      await appendReviewerTimelineToDecisionLog(
        financeReleaseDecisionLog,
        transition.record.releaseDecision,
        decidedAt,
        `review:${transition.record.detail.id}:terminal-deny`,
        'terminal-deny',
      );

      c.header('cache-control', 'no-store');
      return c.json(
        await finalizeAdminMutation({
          idempotencyKey: mutation.idempotencyKey,
          routeId,
          requestPayload: body,
          statusCode: 200,
          responseBody: buildReviewActionResponse(stored, null, null),
          audit: {
            action: 'release_review.rejected',
            requestHash: mutation.requestHash,
            metadata: {
              reviewId: stored.id,
              decisionId: stored.decisionId,
              reviewerId: authorized.releaseActor.id,
              reviewerRole: actorPolicyRole(authorized),
              authorityState: stored.authorityState,
            },
          },
        }),
      );
    } catch (error) {
      if (error instanceof ReleaseReviewerQueueError) {
        const status =
          error.code === 'already_finalized'
            ? 409
            : error.code === 'duplicate_reviewer'
              ? 409
              : error.code === 'reviewer_not_allowed' || error.code === 'reviewer_role_not_allowed'
                ? 403
                : 400;
        return c.json({ error: error.message, code: error.code }, status);
      }

      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  });

  app.post('/api/v1/admin/release-reviews/:id/override', async (c) => {
    const authorized = authorizeReleaseAdminRoute(c, RELEASE_ADMIN_BREAK_GLASS_ROLES, currentAdminAuthorized);
    if (authorized instanceof Response) return authorized;

    const body = await parseReviewActionBody(c);
    const routeId = 'admin.release_review.override';
    const mutation = await adminMutationRequest(c, routeId, body);
    if (mutation instanceof Response) {
      return mutation;
    }

    const record = await apiReleaseReviewerQueueStore.getRecord(c.req.param('id'));
    if (!record) {
      return c.json({ error: `Release review '${c.req.param('id')}' not found.` }, 404);
    }

    try {
      const decidedAt = new Date().toISOString();
      const expectedAuthorityState = record.detail.authorityState;
      const expectedReviewerDecisionCount = record.detail.reviewerDecisions.length;
      const senderConfirmation =
        await resolveReleaseReviewTokenConfirmation?.({
          context: c,
          decision: record.releaseDecision,
          issuedAt: decidedAt,
          override: true,
        }) ?? null;
      if (senderConfirmation === null) {
        return c.json({
          error: 'release_token_sender_confirmation_required',
          error_description:
            'A valid DPoP proof is required before issuing a sender-constrained release token.',
        }, 400);
      }
      const overriddenRecord = applyBreakGlassOverride({
        record,
        reasonCode: readReviewField(body, 'reasonCode') ?? '',
        ticketId: readReviewField(body, 'ticketId'),
        requestedById: authorized.releaseActor.id,
        requestedByName: actorDisplayName(authorized.releaseActor),
        requestedByRole: actorPolicyRole(authorized),
        requestedByType: authorized.releaseActor.type,
        note: readReviewField(body, 'note'),
        decidedAt,
      });

      await apiReleaseReviewerQueueStore.commitPendingTransition({
        record: overriddenRecord,
        expectedAuthorityState,
        expectedReviewerDecisionCount,
      });

      const closure = await completeReleaseReviewAuthorityClosure({
        record: overriddenRecord,
        issuedAt: decidedAt,
        override: true,
        senderConfirmation,
        queueStore: apiReleaseReviewerQueueStore,
        decisionLog: financeReleaseDecisionLog,
        tokenIssuer: apiReleaseTokenIssuer,
        introspectionStore: apiReleaseIntrospectionStore,
        evidencePackIssuer: apiReleaseEvidencePackIssuer,
        evidencePackStore: apiReleaseEvidencePackStore,
      });
      c.header('cache-control', 'no-store');
      return c.json(
        await finalizeAdminMutation({
          idempotencyKey: mutation.idempotencyKey,
          routeId,
          requestPayload: body,
          statusCode: 200,
          responseBody: buildReviewActionResponse(
            closure.stored,
            closure.responseToken,
            closure.responseEvidencePack,
          ),
          audit: {
            action: 'release_break_glass.issued',
            requestHash: mutation.requestHash,
            metadata: {
              reviewId: closure.stored.id,
              decisionId: closure.stored.decisionId,
              reasonCode: closure.stored.overrideGrant?.reasonCode ?? null,
              ticketId: closure.stored.overrideGrant?.ticketId ?? null,
              requestedById: closure.stored.overrideGrant?.requestedById ?? null,
              requestedByRole: closure.stored.overrideGrant?.requestedByRole ?? null,
              authorityState: closure.stored.authorityState,
              releaseTokenId: closure.responseToken.tokenId,
              evidencePackId: closure.responseEvidencePack.evidencePackId,
              ttlSeconds: closure.responseToken.ttlSeconds,
            },
          },
        }),
      );
    } catch (error) {
      if (error instanceof ReleaseReviewerQueueError) {
        const status =
          error.code === 'already_finalized'
            ? 409
            : error.code === 'missing_override_reason' || error.code === 'missing_override_requester'
              ? 400
              : 409;
        return c.json({ error: error.message, code: error.code }, status);
      }

      return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  });
}
