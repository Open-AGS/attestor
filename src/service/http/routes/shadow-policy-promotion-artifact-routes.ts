import type { Hono } from 'hono';
import {
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type ShadowPolicyPromotionSourceStatus,
} from '../../../consequence-admission/index.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  problem,
  tenantSummary,
} from './shadow-route-helpers.js';

function parsePromotionSourceStatus(
  value: string | null | undefined,
): ShadowPolicyPromotionSourceStatus | null {
  if (value === undefined || value === null || value.trim() === '') return 'approved';
  const normalized = value.trim();
  return SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.includes(normalized as ShadowPolicyPromotionSourceStatus)
    ? normalized as ShadowPolicyPromotionSourceStatus
    : null;
}

export function registerShadowPolicyPromotionArtifactRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.get('/api/v1/shadow/policy-promotion-draft', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion draft generation is not configured for this runtime.',
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
          `Policy promotion drafts can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
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
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        draft,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-draft-failed',
        title: 'Policy promotion draft failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy promotion draft could not be generated.'),
        reasonCodes: ['policy-promotion-draft-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-promotion-packet', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion packet generation is not configured for this runtime.',
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
          `Policy promotion packets can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
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
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        packet,
      });
    } catch (error) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-packet-failed',
        title: 'Policy promotion packet failed',
        status: 503,
        detail: boundedErrorDetail(error, 'Policy promotion packet could not be generated.'),
        reasonCodes: ['policy-promotion-packet-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-promotion-simulation', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy promotion simulation is not configured for this runtime.',
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
          `Policy promotion simulations can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
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
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        simulation,
      });
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-promotion-simulation-failed',
        title: 'Policy promotion simulation failed',
        status,
        detail: boundedErrorDetail(error, 'Policy promotion simulation could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The policy promotion simulation exceeds the supported event bound.',
        }),
        reasonCodes: ['policy-promotion-simulation-failed'],
      });
    }
  });

  app.get('/api/v1/shadow/policy-bundle-publication', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Policy bundle publication is not configured for this runtime.',
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
          `Policy bundle publications can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }

    try {
      const tenant = deps.currentTenant(c);
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
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        publication,
      });
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-bundle-publication-failed',
        title: 'Policy bundle publication failed',
        status,
        detail: boundedErrorDetail(error, 'Policy bundle publication could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The policy bundle publication exceeds the supported event bound.',
        }),
        reasonCodes: ['policy-bundle-publication-failed'],
      });
    }
  });
}
