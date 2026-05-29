import type { Context, Hono } from 'hono';
import {
  createShadowActivationReadinessGate,
  createShadowDownstreamIntegrationProof,
  createShadowDownstreamVerificationBinding,
  createShadowPolicyBundlePublication,
  createShadowPolicyBundleSigningPayload,
  createShadowPolicyPromotionDraft,
  createShadowPolicyPromotionPacket,
  createShadowPolicyPromotionSimulation,
  CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
  SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type ConsequenceAdmissionDownstreamBoundaryKind,
  type ShadowDownstreamIntegrationEvidenceKind,
  type ShadowDownstreamVerificationCheckKind,
  type ShadowPolicyPromotionSourceStatus,
} from '../../../consequence-admission/index.js';
import { acceptsJsonRequestBody } from '../route-response-helpers.js';
import {
  beginShadowMutationIdempotency,
  finalizeShadowMutationIdempotency,
  recordShadowMutationAudit,
} from './shadow-mutation-route-helpers.js';
import type { ShadowRouteDeps } from './shadow-routes.js';
import {
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  isRecord,
  problem,
  tenantSummary,
} from './shadow-route-helpers.js';

type DownstreamIntegrationProofRouteBody = {
  readonly enforcementPointId: string;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly verifierRef: string;
  readonly evidenceRefs: readonly {
    readonly id: string;
    readonly kind: ShadowDownstreamIntegrationEvidenceKind;
    readonly digest: string;
    readonly uri: string | null;
  }[];
  readonly observedVerificationChecks: readonly ShadowDownstreamVerificationCheckKind[];
};

function parsePromotionSourceStatus(
  value: string | null | undefined,
): ShadowPolicyPromotionSourceStatus | null {
  if (value === undefined || value === null || value.trim() === '') return 'approved';
  const normalized = value.trim();
  return SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.includes(normalized as ShadowPolicyPromotionSourceStatus)
    ? normalized as ShadowPolicyPromotionSourceStatus
    : null;
}

function parseDownstreamBoundaryKind(
  value: string | null | undefined,
): ConsequenceAdmissionDownstreamBoundaryKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS.includes(
    normalized as ConsequenceAdmissionDownstreamBoundaryKind,
  )
    ? normalized as ConsequenceAdmissionDownstreamBoundaryKind
    : null;
}

function parseIntegrationEvidenceKind(
  value: string | null | undefined,
): ShadowDownstreamIntegrationEvidenceKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.includes(
    normalized as ShadowDownstreamIntegrationEvidenceKind,
  )
    ? normalized as ShadowDownstreamIntegrationEvidenceKind
    : null;
}

function parseDownstreamVerificationCheck(
  value: string | null | undefined,
): ShadowDownstreamVerificationCheckKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.includes(
    normalized as ShadowDownstreamVerificationCheckKind,
  )
    ? normalized as ShadowDownstreamVerificationCheckKind
    : null;
}

async function readDownstreamIntegrationProofBody(c: Context): Promise<DownstreamIntegrationProofRouteBody | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-json-required',
      title: 'Downstream integration proof JSON required',
      status: 415,
      detail: 'The downstream integration proof route requires Content-Type: application/json.',
      reasonCodes: ['downstream-integration-proof-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-json-invalid',
      title: 'Invalid downstream integration proof JSON',
      status: 400,
      detail: 'The downstream integration proof route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-input-invalid',
      title: 'Invalid downstream integration proof input',
      status: 400,
      detail: 'The downstream integration proof route requires an object body.',
      reasonCodes: ['invalid-downstream-integration-proof-input'],
    });
  }

  const enforcementPointId = typeof body.enforcementPointId === 'string'
    ? body.enforcementPointId.trim()
    : '';
  const boundaryKind = typeof body.boundaryKind === 'string'
    ? parseDownstreamBoundaryKind(body.boundaryKind)
    : null;
  const verifierRef = typeof body.verifierRef === 'string'
    ? body.verifierRef.trim()
    : '';
  if (!enforcementPointId || !boundaryKind || !verifierRef) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-input-invalid',
      title: 'Invalid downstream integration proof input',
      status: 400,
      detail:
        `The downstream integration proof route requires enforcementPointId, verifierRef, and boundaryKind. Boundary kind must be one of: ${CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS.join(', ')}.`,
      reasonCodes: ['invalid-downstream-integration-proof-input'],
    });
  }

  const evidenceInput = body.evidenceRefs ?? [];
  if (!Array.isArray(evidenceInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
      title: 'Invalid downstream integration proof evidence',
      status: 400,
      detail: 'evidenceRefs must be an array when provided.',
      reasonCodes: ['invalid-downstream-integration-proof-evidence'],
    });
  }
  const evidenceRefs: {
    readonly id: string;
    readonly kind: ShadowDownstreamIntegrationEvidenceKind;
    readonly digest: string;
    readonly uri: string | null;
  }[] = [];
  for (const entry of evidenceInput) {
    if (!isRecord(entry)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
        title: 'Invalid downstream integration proof evidence',
        status: 400,
        detail: 'Every evidenceRef must be an object with id, kind, digest, and optional uri.',
        reasonCodes: ['invalid-downstream-integration-proof-evidence'],
      });
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const kind = typeof entry.kind === 'string'
      ? parseIntegrationEvidenceKind(entry.kind)
      : null;
    const digest = typeof entry.digest === 'string' ? entry.digest.trim() : '';
    const uri = entry.uri === undefined || entry.uri === null
      ? null
      : typeof entry.uri === 'string'
        ? entry.uri.trim()
        : '';
    if (!id || !kind || !digest || uri === '') {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-evidence-invalid',
        title: 'Invalid downstream integration proof evidence',
        status: 400,
        detail:
          `Every evidenceRef requires id, kind, and digest. Evidence kind must be one of: ${SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-downstream-integration-proof-evidence'],
      });
    }
    evidenceRefs.push(Object.freeze({
      id,
      kind,
      digest,
      uri,
    }));
  }

  const checkInput = body.observedVerificationChecks ?? body.observedChecks ?? [];
  if (!Array.isArray(checkInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/downstream-integration-proof-checks-invalid',
      title: 'Invalid downstream integration proof checks',
      status: 400,
      detail: 'observedVerificationChecks must be an array when provided.',
      reasonCodes: ['invalid-downstream-integration-proof-checks'],
    });
  }
  const observedVerificationChecks: ShadowDownstreamVerificationCheckKind[] = [];
  for (const entry of checkInput) {
    const check = typeof entry === 'string'
      ? parseDownstreamVerificationCheck(entry)
      : null;
    if (!check) {
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-checks-invalid',
        title: 'Invalid downstream integration proof checks',
        status: 400,
        detail:
          `observedVerificationChecks entries must be one of: ${SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.join(', ')}.`,
        reasonCodes: ['invalid-downstream-integration-proof-checks'],
      });
    }
    observedVerificationChecks.push(check);
  }

  return {
    enforcementPointId,
    boundaryKind,
    verifierRef,
    evidenceRefs: Object.freeze(evidenceRefs),
    observedVerificationChecks: Object.freeze(observedVerificationChecks),
  };
}

export function registerShadowDownstreamActivationRoutes(app: Hono, deps: ShadowRouteDeps): void {
  app.get('/api/v1/shadow/downstream-verification-binding', (c) => {
    c.header('cache-control', 'no-store');
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Downstream verification binding generation is not configured for this runtime.',
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
          `Downstream verification bindings can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
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
      const binding = createShadowDownstreamVerificationBinding({
        simulation,
        generatedAt: deps.now?.() ?? null,
      });
      return c.json({
        tenant: tenantSummary(tenant),
        storageMode: 'file-backed-evaluation',
        productionReady: false,
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        binding,
      });
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [{ marker: 'exceeds maximum', status: 400 }],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-verification-binding-failed',
        title: 'Downstream verification binding failed',
        status,
        detail: boundedErrorDetail(error, 'Downstream verification binding could not be generated.', {
          safeMarkers: ['exceeds maximum'],
          safeDetail: 'The downstream verification binding exceeds the supported event bound.',
        }),
        reasonCodes: ['downstream-verification-binding-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/downstream-integration-proof', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readDownstreamIntegrationProofBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Downstream integration proof generation is not configured for this runtime.',
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
          `Downstream integration proofs can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.downstream_integration_proof.create';
    const requestPayload = {
      sourceStatus,
      enforcementPointId: body.enforcementPointId,
      boundaryKind: body.boundaryKind,
      verifierRef: body.verifierRef,
      evidenceRefs: body.evidenceRefs,
      observedVerificationChecks: body.observedVerificationChecks,
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
      const proof = createShadowDownstreamIntegrationProof({
        publication,
        binding,
        enforcementPointId: body.enforcementPointId,
        boundaryKind: body.boundaryKind,
        verifierRef: body.verifierRef,
        evidenceRefs: body.evidenceRefs,
        observedVerificationChecks: body.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.downstream_integration_proof.generated',
        tenant,
        requestPayload: {
          ...requestPayload,
          evidenceRefCount: body.evidenceRefs.length,
        },
        statusCode: 200,
        metadata: {
          integrationProofDigest: proof.digest,
          integrationProofReady: proof.integrationProofReady,
          activationReady: proof.activationReady,
          observedCheckCount: proof.observedCheckCount,
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
          proof,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/downstream-integration-proof-failed',
        title: 'Downstream integration proof failed',
        status,
        detail: boundedErrorDetail(error, 'Downstream integration proof could not be generated.', {
          safeMarkers: ['Shadow downstream integration proof', 'exceeds maximum'],
          safeDetail: 'The downstream integration proof input did not satisfy the shadow proof contract.',
        }),
        reasonCodes: ['downstream-integration-proof-failed'],
      });
    }
  });

  app.post('/api/v1/shadow/activation-readiness', async (c) => {
    c.header('cache-control', 'no-store');
    const body = await readDownstreamIntegrationProofBody(c);
    if (body instanceof Response) return body;
    if (!deps.listShadowPolicyCandidateRecords) {
      return problem(c, {
        type: 'https://attestor.dev/problems/policy-candidate-store-unavailable',
        title: 'Policy candidate store unavailable',
        status: 503,
        detail: 'Activation readiness evaluation is not configured for this runtime.',
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
          `Activation readiness can only be generated from: ${SHADOW_POLICY_PROMOTION_SOURCE_STATUSES.join(', ')}.`,
        reasonCodes: ['invalid-policy-promotion-source-status'],
      });
    }
    const routeId = 'shadow.activation_readiness.create';
    const requestPayload = {
      sourceStatus,
      enforcementPointId: body.enforcementPointId,
      boundaryKind: body.boundaryKind,
      verifierRef: body.verifierRef,
      evidenceRefs: body.evidenceRefs,
      observedVerificationChecks: body.observedVerificationChecks,
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
        enforcementPointId: body.enforcementPointId,
        boundaryKind: body.boundaryKind,
        verifierRef: body.verifierRef,
        evidenceRefs: body.evidenceRefs,
        observedVerificationChecks: body.observedVerificationChecks,
        generatedAt: deps.now?.() ?? null,
      });
      const activationReadiness = createShadowActivationReadinessGate({
        sourceStatus,
        publication,
        binding,
        integrationProof,
        generatedAt: deps.now?.() ?? null,
      });
      await recordShadowMutationAudit(deps, {
        routeId,
        action: 'shadow.activation_readiness.generated',
        tenant,
        requestPayload: {
          ...requestPayload,
          evidenceRefCount: body.evidenceRefs.length,
        },
        statusCode: 200,
        metadata: {
          readinessDigest: activationReadiness.digest,
          activationReady: activationReadiness.activationReady,
          remainingBlockerCount: activationReadiness.remainingActivationBlockers.length,
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
          activationReadiness,
        },
      );
      return c.json(responseBody);
    } catch (error) {
      const status = caughtErrorStatus(error, {
        statusMarkers: [
          { marker: 'Shadow downstream integration proof', status: 400 },
          { marker: 'Shadow activation readiness gate', status: 400 },
          { marker: 'exceeds maximum', status: 400 },
        ],
        defaultStatus: 503,
      });
      return problem(c, {
        type: 'https://attestor.dev/problems/activation-readiness-failed',
        title: 'Activation readiness failed',
        status,
        detail: boundedErrorDetail(error, 'Activation readiness could not be generated.', {
          safeMarkers: [
            'Shadow downstream integration proof',
            'Shadow activation readiness gate',
            'exceeds maximum',
          ],
          safeDetail: 'The activation readiness input did not satisfy the shadow activation contract.',
        }),
        reasonCodes: ['activation-readiness-failed'],
      });
    }
  });
}
