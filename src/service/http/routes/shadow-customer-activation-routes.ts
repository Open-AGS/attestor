import type { Hono } from 'hono';
import {
  createShadowActivationReadinessGate,
  createShadowCustomerActivationHandoff,
  createShadowCustomerActivationReceipt,
  createShadowDownstreamIntegrationProof,
  createShadowDownstreamVerificationBinding,
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
} from '../../../consequence-admission/index.js';
import {
  beginShadowMutationIdempotency,
  finalizeShadowMutationIdempotency,
  recordShadowMutationAudit,
} from './shadow-mutation-route-helpers.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  assertTenantBoundRecord,
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  problem,
  shadowListPage,
  tenantSummary,
} from './shadow-route-helpers.js';
import {
  parseBooleanQuery,
  parseCustomerActivationReceiptStatus,
  parsePromotionSourceStatus,
  readCustomerActivationHandoffBody,
  readCustomerActivationReceiptBody,
} from './shadow-customer-activation-route-body.js';

export function registerShadowCustomerActivationRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.post('/api/v1/shadow/customer-activation-handoff', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readCustomerActivationHandoffBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Customer activation handoff generation is not configured for this runtime.',
        reasonCodes: ['policy-candidate-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('status');
    const sourceStatus = parsePromotionSourceStatus(statusQuery);
    if (!sourceStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-source-status-invalid',
        title: 'Invalid policy promotion source status',
        status: 400,
        detail:
          `Customer activation handoffs can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.customer_activation_handoff.create';
    const requestPayload = {
      sourceStatus,
      integration: body.integration,
      activationRef: body.activationRef,
      operatorRef: body.operatorRef,
      secondaryApproverRef: body.secondaryApproverRef,
      rolloutStrategy: body.rolloutStrategy,
      rollbackRef: body.rollbackRef,
      killSwitchRef: body.killSwitchRef,
      monitoringRef: body.monitoringRef,
      breakGlassJustificationRef: body.breakGlassJustificationRef,
      breakGlassReconciliationRef: body.breakGlassReconciliationRef,
      expiresAt: body.expiresAt,
    };

    try {
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowPolicyCandidateRecords({
          tenant,
          status: sourceStatus,
        }),
        'shadow policy candidate',
      );
      const draft = createShadowPolicyPromotionDraft({
        tenantId: tenant.tenantId,
        records,
        sourceStatus,
        generatedAt: deps.now?.() ?? null,
      });
      const packet = createShadowPolicyPromotionPacket({
        draft,
        generatedAt: deps.now?.() ?? null,
      });
      const simulation = createShadowPolicyPromotionSimulation({
        packet,
        events: assertTenantBoundRecords(
          tenant,
          deps.listShadowEvents({ tenant }),
          'shadow admission event',
          { allowNullTenantId: true },
        ),
        generatedAt: deps.now?.() ?? null,
      });
      const signingPayload = createShadowPolicyBundleSigningPayload(simulation);
      const signature = deps.signShadowPolicyBundlePublication?.({
        tenant,
        payload: signingPayload,
      }) ?? null;
      const publication = createShadowPolicyBundlePublication({
        simulation,
        signature,
        generatedAt: deps.now?.() ?? null,
      });
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      const integrationProof = createShadowDownstreamIntegrationProof({
        publication,
        binding,
        enforcementPointId: body.integration.enforcementPointId,
        boundaryKind: body.integration.boundaryKind,
        verifierRef: body.integration.verifierRef,
        evidenceRefs: body.integration.evidenceRefs,
        observedVerificationChecks: body.integration.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      const activationReadiness = createShadowActivationReadinessGate({
        sourceStatus,
        publication,
        binding,
        integrationProof,
        generatedAt: deps.now?.() ?? null,
      });
      const handoff = createShadowCustomerActivationHandoff({
        activationReadiness,
        activationRef: body.activationRef,
        operatorRef: body.operatorRef,
        secondaryApproverRef: body.secondaryApproverRef,
        activationBoundaryKind: body.integration.boundaryKind,
        rolloutStrategy: body.rolloutStrategy,
        rollbackRef: body.rollbackRef,
        killSwitchRef: body.killSwitchRef,
        monitoringRef: body.monitoringRef,
        breakGlassJustificationRef: body.breakGlassJustificationRef,
        breakGlassReconciliationRef: body.breakGlassReconciliationRef,
        expiresAt: body.expiresAt,
        generatedAt: deps.now?.() ?? null,
      });
      const persistedHandoff = deps.recordShadowCustomerActivationHandoff?.({
        tenant,
        handoff,
      }) ?? null;
      const persistedHandoffRecord = persistedHandoff
        ? assertTenantBoundRecord(tenant, persistedHandoff.record, 'shadow customer activation handoff')
        : null;
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.customer_activation_handoff.generated',
        tenant,
        requestPayload: {
          sourceStatus,
          enforcementPointId: body.integration.enforcementPointId,
          boundaryKind: body.integration.boundaryKind,
          verifierRef: body.integration.verifierRef,
          evidenceRefCount: body.integration.evidenceRefs.length,
          observedVerificationChecks: body.integration.observedVerificationChecks,
          rolloutStrategy: body.rolloutStrategy,
          hasSecondaryApprover: body.secondaryApproverRef !== null,
        },
        statusCode: 200,
        metadata: {
          handoffId: handoff.handoffId,
          handoffDigest: handoff.digest,
          sourceActivationReadinessDigest: handoff.sourceActivationReadinessDigest,
          handoffReady: handoff.handoffReady,
          persistenceKind: persistedHandoff?.kind ?? null,
          persistedHandoffId: persistedHandoffRecord?.handoffId ?? null,
        },
      });
      const responseBody = await finalizeShadowMutationIdempotency(
        deps,
        tenant,
        routeId,
        requestPayload,
        idempotency.ready,
        200,
        {
          tenant: tenantSummary(tenant),
          storageMode: persistedHandoff ? 'file-backed-evaluation' : 'stateless-handoff',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          handoff,
          persisted: persistedHandoff
            ? {
              kind: persistedHandoff.kind,
              record: persistedHandoffRecord,
            }
            : null,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'Shadow activation readiness gate', status: 400 },
          { marker: 'Shadow customer activation handoff', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-failed',
        title: 'Customer activation handoff failed',
        status,
        detail: boundedErrorDetail(error, 'Customer activation handoff could not be generated.', {
          safeMarkers: [
            'Shadow downstream integration proof',
            'Shadow activation readiness gate',
            'Shadow customer activation handoff',
            'exceeds maximum',
          ],
          safeDetail: 'The customer activation handoff input did not satisfy the shadow activation contract.',
        }),
        reasonCodes: ['customer-activation-handoff-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/customer-activation-receipt', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readCustomerActivationReceiptBody(c);
    if (body instanceof Response) return body;
    if (!deps.findShadowCustomerActivationHandoff) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-store-unavailable',
        title: 'Customer activation handoff store unavailable',
        status: 503,
        detail: 'Customer activation receipts require server-side handoff lookup for this runtime.',
        reasonCodes: ['customer-activation-handoff-store-unavailable'],
      });
    }
    if (!deps.recordShadowCustomerActivationReceipt) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-store-unavailable',
        title: 'Customer activation receipt store unavailable',
        status: 503,
        detail: 'Customer activation receipt persistence is required for this runtime.',
        reasonCodes: ['customer-activation-receipt-store-unavailable'],
      });
    }

    try {
      const routeId = 'shadow.customer_activation_receipt.create';
      const requestPayload = {
        sourceHandoffId: body.handoffId,
        sourceHandoffDigest: body.handoffDigest,
        activationStatus: body.activationStatus,
        attemptedAt: body.attemptedAt,
        observedAt: body.observedAt,
        completedAt: body.completedAt,
        activationDigest: body.activationDigest,
        externalReceiptDigest: body.externalReceiptDigest,
        rollbackStatus: body.rollbackStatus,
        rollbackDigest: body.rollbackDigest,
        killSwitchStatus: body.killSwitchStatus,
        monitoringStatus: body.monitoringStatus,
        errorDigest: body.errorDigest,
        skipReasonCode: body.skipReasonCode,
      };
      const idempotency = await beginShadowMutationIdempotency(c, deps, routeId, requestPayload);
      if (idempotency.kind === 'response') return idempotency.response;
      const { tenant } = idempotency;
      const storedHandoffRecord = deps.findShadowCustomerActivationHandoff({
        tenant,
        handoffId: body.handoffId,
      });
      if (!storedHandoffRecord) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-handoff-not-found',
          title: 'Customer activation handoff not found',
          status: 404,
          detail: 'No customer activation handoff was found for this tenant and handoff id.',
          reasonCodes: ['customer-activation-handoff-not-found'],
        });
      }
      const tenantHandoffRecord = assertTenantBoundRecord(
        tenant,
        storedHandoffRecord,
        'shadow customer activation handoff',
      );
      if (tenantHandoffRecord.handoffDigest !== body.handoffDigest) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-handoff-digest-mismatch',
          title: 'Customer activation handoff digest mismatch',
          status: 409,
          detail: 'The supplied handoff digest does not match the server-side handoff record.',
          reasonCodes: ['customer-activation-handoff-digest-mismatch'],
        });
      }
      const receipt = createShadowCustomerActivationReceipt({
        handoff: tenantHandoffRecord.handoff,
        activationStatus: body.activationStatus,
        attemptedAt: body.attemptedAt,
        observedAt: body.observedAt,
        completedAt: body.completedAt,
        activationDigest: body.activationDigest,
        externalReceiptDigest: body.externalReceiptDigest,
        rollbackStatus: body.rollbackStatus,
        rollbackDigest: body.rollbackDigest,
        killSwitchStatus: body.killSwitchStatus,
        monitoringStatus: body.monitoringStatus,
        errorDigest: body.errorDigest,
        skipReasonCode: body.skipReasonCode,
        generatedAt: deps.now?.() ?? null,
      });
      if (receipt.tenantId !== tenant.tenantId) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-receipt-tenant-mismatch',
          title: 'Customer activation receipt tenant mismatch',
          status: 400,
          detail: 'The handoff tenant does not match the authenticated tenant.',
          reasonCodes: ['customer-activation-receipt-tenant-mismatch'],
        });
      }
      const persisted = deps.recordShadowCustomerActivationReceipt({
        tenant,
        receipt,
      });
      const persistedRecord = assertTenantBoundRecord(
        tenant,
        persisted.record,
        'shadow customer activation receipt',
      );
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.customer_activation_receipt.recorded',
        tenant,
        requestPayload: {
          sourceHandoffId: receipt.sourceHandoffId,
          sourceHandoffDigest: receipt.sourceHandoffDigest,
          activationStatus: body.activationStatus,
          rollbackStatus: body.rollbackStatus,
          killSwitchStatus: body.killSwitchStatus,
          monitoringStatus: body.monitoringStatus,
          persisted: true,
        },
        statusCode: 200,
        metadata: {
          storageMode: 'file-backed-evaluation',
          receiptId: receipt.receiptId,
          receiptDigest: receipt.digest,
          persistenceKind: persisted.kind,
          persistedReceiptId: persistedRecord.receiptId,
        },
      });
      const responseBody = await finalizeShadowMutationIdempotency(
        deps,
        tenant,
        routeId,
        requestPayload,
        idempotency.ready,
        200,
        {
          tenant: tenantSummary(tenant),
          storageMode: 'file-backed-evaluation',
          productionReady: false,
          approvalRequired: true,
          autoEnforce: false,
          rawPayloadStored: false,
          receipt,
          persisted: {
            kind: persisted.kind,
            record: persistedRecord,
          },
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'Shadow customer activation receipt', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-failed',
        title: 'Customer activation receipt failed',
        status,
        detail: boundedErrorDetail(error, 'Customer activation receipt could not be generated.', {
          safeMarkers: ['Shadow customer activation receipt'],
          safeDetail: 'The customer activation receipt input did not satisfy the shadow receipt contract.',
        }),
        reasonCodes: ['customer-activation-receipt-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/customer-activation-receipts', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowCustomerActivationReceiptRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-store-unavailable',
        title: 'Customer activation receipt store unavailable',
        status: 503,
        detail: 'Customer activation receipt history is not configured for this runtime.',
        reasonCodes: ['customer-activation-receipt-store-unavailable'],
      });
    }
    const statusQuery = c.req.query('activationStatus');
    const activationStatus = statusQuery
      ? parseCustomerActivationReceiptStatus(statusQuery)
      : null;
    if (statusQuery && !activationStatus) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-status-invalid',
        title: 'Invalid customer activation receipt status',
        status: 400,
        detail:
          `activationStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-receipt-status'],
      });
    }
    const receiptReadyQuery = c.req.query('receiptReady');
    const receiptReady = parseBooleanQuery(receiptReadyQuery);
    if (receiptReadyQuery && receiptReady === null) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-ready-invalid',
        title: 'Invalid customer activation receipt ready filter',
        status: 400,
        detail: 'receiptReady must be true or false when provided.',
        reasonCodes: ['invalid-customer-activation-receipt-ready'],
      });
    }
    const sourceHandoffDigest = c.req.query('sourceHandoffDigest')?.trim() || null;

    try {
      const tenant = deps.currentTenant(c);
      const records = assertTenantBoundRecords(
        tenant,
        deps.listShadowCustomerActivationReceiptRecords({
          tenant,
          activationStatus,
          receiptReady,
          sourceHandoffDigest,
        }),
        'shadow customer activation receipt',
      );
      const page = shadowListPage(c, records, 'Shadow customer activation receipt');
      if (page instanceof Response) return page;
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        rawPayloadStored: false,
        recordCount: page.records.length,
        pageInfo: page.pageInfo,
        records: page.records,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-list-failed',
        title: 'Customer activation receipt list failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Customer activation receipt history could not be listed.'),
        reasonCodes: ['customer-activation-receipt-list-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/customer-activation-receipts/:receiptId', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.findShadowCustomerActivationReceipt) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-store-unavailable',
        title: 'Customer activation receipt store unavailable',
        status: 503,
        detail: 'Customer activation receipt lookup is not configured for this runtime.',
        reasonCodes: ['customer-activation-receipt-store-unavailable'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
      const record = deps.findShadowCustomerActivationReceipt({
        tenant,
        receiptId: c.req.param('receiptId'),
      });
      if (!record) {
        return problem(c, {
          type: 'https://attestor.dev/problems/customer-activation-receipt-not-found',
          title: 'Customer activation receipt not found',
          status: 404,
          detail: 'No customer activation receipt was found for this tenant and receipt id.',
          reasonCodes: ['customer-activation-receipt-not-found'],
        });
      }
      const tenantRecord = assertTenantBoundRecord(
        tenant,
        record,
        'shadow customer activation receipt',
      );
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        rawPayloadStored: false,
        record: tenantRecord,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-receipt-lookup-failed',
        title: 'Customer activation receipt lookup failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Customer activation receipt lookup failed.'),
        reasonCodes: ['customer-activation-receipt-lookup-failed'],
      });
    }
  });
}
