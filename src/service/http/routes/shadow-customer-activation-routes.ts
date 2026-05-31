import type { Context, Hono } from 'hono';
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
  CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
  SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  SHADOW_CUSTOMER_ACTIVATION_REF_KINDS,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES,
  SHADOW_POLICY_PROMOTION_SOURCE_STATUSES,
  type ConsequenceAdmissionDownstreamBoundaryKind,
  type ShadowCustomerActivationControlRef,
  type ShadowCustomerActivationReceiptKillSwitchStatus,
  type ShadowCustomerActivationReceiptMonitoringStatus,
  type ShadowCustomerActivationReceiptRollbackStatus,
  type ShadowCustomerActivationReceiptStatus,
  type ShadowCustomerActivationRefKind,
  type ShadowCustomerActivationRolloutStrategy,
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
  assertTenantBoundRecord,
  assertTenantBoundRecords,
  boundedErrorDetail,
  caughtErrorStatus,
  isRecord,
  problem,
  shadowListPage,
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

function parseCustomerActivationRefKind(
  value: string | null | undefined,
): ShadowCustomerActivationRefKind | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.includes(
    normalized as ShadowCustomerActivationRefKind,
  )
    ? normalized as ShadowCustomerActivationRefKind
    : null;
}

function parseCustomerActivationRolloutStrategy(
  value: string | null | undefined,
): ShadowCustomerActivationRolloutStrategy | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.includes(
    normalized as ShadowCustomerActivationRolloutStrategy,
  )
    ? normalized as ShadowCustomerActivationRolloutStrategy
    : null;
}

async function readCustomerActivationHandoffBody(c: Context): Promise<{
  readonly integration: DownstreamIntegrationProofRouteBody;
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly secondaryApproverRef: string | null;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly rollbackRef: ShadowCustomerActivationControlRef | null;
  readonly killSwitchRef: ShadowCustomerActivationControlRef | null;
  readonly monitoringRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassJustificationRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassReconciliationRef: ShadowCustomerActivationControlRef | null;
  readonly expiresAt: string | null;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-json-required',
      title: 'Customer activation handoff JSON required',
      status: 415,
      detail: 'The customer activation handoff route requires Content-Type: application/json.',
      reasonCodes: ['customer-activation-handoff-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-json-invalid',
      title: 'Invalid customer activation handoff JSON',
      status: 400,
      detail: 'The customer activation handoff route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-input-invalid',
      title: 'Invalid customer activation handoff input',
      status: 400,
      detail: 'The customer activation handoff route requires an object body.',
      reasonCodes: ['invalid-customer-activation-handoff-input'],
    });
  }
  const bodyRecord = body;

  const enforcementPointId = typeof bodyRecord.enforcementPointId === 'string'
    ? bodyRecord.enforcementPointId.trim()
    : '';
  const boundaryKind = typeof bodyRecord.boundaryKind === 'string'
    ? parseDownstreamBoundaryKind(bodyRecord.boundaryKind)
    : null;
  const verifierRef = typeof bodyRecord.verifierRef === 'string'
    ? bodyRecord.verifierRef.trim()
    : '';
  const activationRef = typeof bodyRecord.activationRef === 'string' ? bodyRecord.activationRef.trim() : '';
  const operatorRef = typeof bodyRecord.operatorRef === 'string' ? bodyRecord.operatorRef.trim() : '';
  const secondaryApproverRef = bodyRecord.secondaryApproverRef === undefined || bodyRecord.secondaryApproverRef === null
    ? null
    : typeof bodyRecord.secondaryApproverRef === 'string'
      ? bodyRecord.secondaryApproverRef.trim()
      : '';
  const rolloutStrategy = typeof bodyRecord.rolloutStrategy === 'string'
    ? parseCustomerActivationRolloutStrategy(bodyRecord.rolloutStrategy)
    : null;
  const expiresAt = bodyRecord.expiresAt === undefined || bodyRecord.expiresAt === null
    ? null
    : typeof bodyRecord.expiresAt === 'string'
      ? bodyRecord.expiresAt.trim()
      : '';
  if (!enforcementPointId || !boundaryKind || !verifierRef || !activationRef || !operatorRef || secondaryApproverRef === '' || !rolloutStrategy || expiresAt === '') {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-input-invalid',
      title: 'Invalid customer activation handoff input',
      status: 400,
      detail:
        `The customer activation handoff route requires enforcementPointId, verifierRef, boundaryKind, activationRef, operatorRef, and rolloutStrategy. Rollout strategy must be one of: ${SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.join(', ')}.`,
      reasonCodes: ['invalid-customer-activation-handoff-input'],
    });
  }

  const evidenceInput = bodyRecord.evidenceRefs ?? [];
  if (!Array.isArray(evidenceInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
      title: 'Invalid customer activation handoff evidence',
      status: 400,
      detail: 'evidenceRefs must be an array when provided.',
      reasonCodes: ['invalid-customer-activation-handoff-evidence'],
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
        type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
        title: 'Invalid customer activation handoff evidence',
        status: 400,
        detail: 'Every evidenceRef must be an object with id, kind, digest, and optional uri.',
        reasonCodes: ['invalid-customer-activation-handoff-evidence'],
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
        type: 'https://attestor.dev/problems/customer-activation-handoff-evidence-invalid',
        title: 'Invalid customer activation handoff evidence',
        status: 400,
        detail:
          `Every evidenceRef requires id, kind, and digest. Evidence kind must be one of: ${SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-evidence'],
      });
    }
    evidenceRefs.push(Object.freeze({ id, kind, digest, uri }));
  }

  const checkInput = bodyRecord.observedVerificationChecks ?? bodyRecord.observedChecks ?? [];
  if (!Array.isArray(checkInput)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-handoff-checks-invalid',
      title: 'Invalid customer activation handoff checks',
      status: 400,
      detail: 'observedVerificationChecks must be an array when provided.',
      reasonCodes: ['invalid-customer-activation-handoff-checks'],
    });
  }
  const observedVerificationChecks: ShadowDownstreamVerificationCheckKind[] = [];
  for (const entry of checkInput) {
    const check = typeof entry === 'string'
      ? parseDownstreamVerificationCheck(entry)
      : null;
    if (!check) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-checks-invalid',
        title: 'Invalid customer activation handoff checks',
        status: 400,
        detail:
          `observedVerificationChecks entries must be one of: ${SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-checks'],
      });
    }
    observedVerificationChecks.push(check);
  }

  function readControlRef(fieldName: string): ShadowCustomerActivationControlRef | Response | null {
    const value = bodyRecord[fieldName];
    if (value === undefined || value === null) return null;
    if (!isRecord(value)) {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-control-invalid',
        title: 'Invalid customer activation handoff control',
        status: 400,
        detail: `${fieldName} must be an object with id, kind, digest, and optional uri when provided.`,
        reasonCodes: ['invalid-customer-activation-handoff-control'],
      });
    }
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const kind = typeof value.kind === 'string'
      ? parseCustomerActivationRefKind(value.kind)
      : null;
    const digest = typeof value.digest === 'string' ? value.digest.trim() : '';
    const uri = value.uri === undefined || value.uri === null
      ? null
      : typeof value.uri === 'string'
        ? value.uri.trim()
        : '';
    if (!id || !kind || !digest || uri === '') {
      return problem(c, {
        type: 'https://attestor.dev/problems/customer-activation-handoff-control-invalid',
        title: 'Invalid customer activation handoff control',
        status: 400,
        detail:
          `${fieldName} requires id, kind, and digest. Control ref kind must be one of: ${SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.join(', ')}.`,
        reasonCodes: ['invalid-customer-activation-handoff-control'],
      });
    }
    return Object.freeze({ id, kind, digest, uri });
  }

  const rollbackRef = readControlRef('rollbackRef');
  if (rollbackRef instanceof Response) return rollbackRef;
  const killSwitchRef = readControlRef('killSwitchRef');
  if (killSwitchRef instanceof Response) return killSwitchRef;
  const monitoringRef = readControlRef('monitoringRef');
  if (monitoringRef instanceof Response) return monitoringRef;
  const breakGlassJustificationRef = readControlRef('breakGlassJustificationRef');
  if (breakGlassJustificationRef instanceof Response) return breakGlassJustificationRef;
  const breakGlassReconciliationRef = readControlRef('breakGlassReconciliationRef');
  if (breakGlassReconciliationRef instanceof Response) return breakGlassReconciliationRef;

  return {
    integration: {
      enforcementPointId,
      boundaryKind,
      verifierRef,
      evidenceRefs: Object.freeze(evidenceRefs),
      observedVerificationChecks: Object.freeze(observedVerificationChecks),
    },
    activationRef,
    operatorRef,
    secondaryApproverRef,
    rolloutStrategy,
    rollbackRef,
    killSwitchRef,
    monitoringRef,
    breakGlassJustificationRef,
    breakGlassReconciliationRef,
    expiresAt,
  };
}

function parseCustomerActivationReceiptStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptStatus
    : null;
}

function parseBooleanQuery(value: string | null | undefined): boolean | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function parseCustomerActivationReceiptRollbackStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptRollbackStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptRollbackStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptRollbackStatus
    : null;
}

function parseCustomerActivationReceiptKillSwitchStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptKillSwitchStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptKillSwitchStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptKillSwitchStatus
    : null;
}

function parseCustomerActivationReceiptMonitoringStatus(
  value: string | null | undefined,
): ShadowCustomerActivationReceiptMonitoringStatus | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const normalized = value.trim();
  return SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES.includes(
    normalized as ShadowCustomerActivationReceiptMonitoringStatus,
  )
    ? normalized as ShadowCustomerActivationReceiptMonitoringStatus
    : null;
}

async function readCustomerActivationReceiptBody(c: Context): Promise<{
  readonly handoffId: string;
  readonly handoffDigest: string;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt: string | null;
  readonly activationDigest: string | null;
  readonly externalReceiptDigest: string | null;
  readonly rollbackStatus: ShadowCustomerActivationReceiptRollbackStatus | null;
  readonly rollbackDigest: string | null;
  readonly killSwitchStatus: ShadowCustomerActivationReceiptKillSwitchStatus | null;
  readonly monitoringStatus: ShadowCustomerActivationReceiptMonitoringStatus | null;
  readonly errorDigest: string | null;
  readonly skipReasonCode: string | null;
} | Response> {
  if (!acceptsJsonRequestBody(c)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-json-required',
      title: 'Customer activation receipt JSON required',
      status: 415,
      detail: 'The customer activation receipt route requires Content-Type: application/json.',
      reasonCodes: ['customer-activation-receipt-json-required'],
    });
  }

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-json-invalid',
      title: 'Invalid customer activation receipt JSON',
      status: 400,
      detail: 'The customer activation receipt route requires a valid JSON object body.',
      reasonCodes: ['invalid-json'],
    });
  }
  if (!isRecord(body)) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail: 'The customer activation receipt route requires an object body.',
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }
  const bodyRecord = body;
  if (bodyRecord.handoff !== undefined) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-handoff-reference-required',
      title: 'Customer activation receipt handoff reference required',
      status: 400,
      detail:
        'The customer activation receipt route accepts handoffId and handoffDigest only; the handoff body must come from the server-side handoff store.',
      reasonCodes: ['customer-activation-receipt-handoff-reference-required'],
    });
  }
  const handoffId = typeof bodyRecord.handoffId === 'string' ? bodyRecord.handoffId.trim() : '';
  const handoffDigest = typeof bodyRecord.handoffDigest === 'string'
    ? bodyRecord.handoffDigest.trim()
    : '';
  const activationStatus = typeof bodyRecord.activationStatus === 'string'
    ? parseCustomerActivationReceiptStatus(bodyRecord.activationStatus)
    : null;
  const attemptedAt = typeof bodyRecord.attemptedAt === 'string' ? bodyRecord.attemptedAt.trim() : '';
  const observedAt = typeof bodyRecord.observedAt === 'string' ? bodyRecord.observedAt.trim() : '';
  const completedAt = bodyRecord.completedAt === undefined || bodyRecord.completedAt === null
    ? null
    : typeof bodyRecord.completedAt === 'string'
      ? bodyRecord.completedAt.trim()
      : '';
  if (!handoffId || !handoffDigest || !activationStatus || !attemptedAt || !observedAt || completedAt === '') {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail:
        `The customer activation receipt route requires handoffId, handoffDigest, activationStatus, attemptedAt, and observedAt. Activation status must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.join(', ')}.`,
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }

  const rollbackStatus = bodyRecord.rollbackStatus === undefined || bodyRecord.rollbackStatus === null
    ? null
    : typeof bodyRecord.rollbackStatus === 'string'
      ? parseCustomerActivationReceiptRollbackStatus(bodyRecord.rollbackStatus)
      : null;
  const killSwitchStatus = bodyRecord.killSwitchStatus === undefined || bodyRecord.killSwitchStatus === null
    ? null
    : typeof bodyRecord.killSwitchStatus === 'string'
      ? parseCustomerActivationReceiptKillSwitchStatus(bodyRecord.killSwitchStatus)
      : null;
  const monitoringStatus = bodyRecord.monitoringStatus === undefined || bodyRecord.monitoringStatus === null
    ? null
    : typeof bodyRecord.monitoringStatus === 'string'
      ? parseCustomerActivationReceiptMonitoringStatus(bodyRecord.monitoringStatus)
      : null;
  if (
    (bodyRecord.rollbackStatus !== undefined && bodyRecord.rollbackStatus !== null && !rollbackStatus) ||
    (bodyRecord.killSwitchStatus !== undefined && bodyRecord.killSwitchStatus !== null && !killSwitchStatus) ||
    (bodyRecord.monitoringStatus !== undefined && bodyRecord.monitoringStatus !== null && !monitoringStatus)
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-status-invalid',
      title: 'Invalid customer activation receipt status',
      status: 400,
      detail:
        'rollbackStatus, killSwitchStatus, or monitoringStatus is outside the supported receipt vocabulary.',
      reasonCodes: ['invalid-customer-activation-receipt-status'],
    });
  }

  function optionalString(fieldName: string): string | null {
    const value = bodyRecord[fieldName];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value.trim() : '';
  }

  const activationDigest = optionalString('activationDigest');
  const externalReceiptDigest = optionalString('externalReceiptDigest');
  const rollbackDigest = optionalString('rollbackDigest');
  const errorDigest = optionalString('errorDigest');
  const skipReasonCode = optionalString('skipReasonCode');
  if (
    activationDigest === '' ||
    externalReceiptDigest === '' ||
    rollbackDigest === '' ||
    errorDigest === '' ||
    skipReasonCode === ''
  ) {
    return problem(c, {
      type: 'https://attestor.dev/problems/customer-activation-receipt-input-invalid',
      title: 'Invalid customer activation receipt input',
      status: 400,
      detail: 'Optional customer activation receipt digest and reason fields must be strings when provided.',
      reasonCodes: ['invalid-customer-activation-receipt-input'],
    });
  }

  return {
    handoffId,
    handoffDigest,
    activationStatus,
    attemptedAt,
    observedAt,
    completedAt,
    activationDigest,
    externalReceiptDigest,
    rollbackStatus,
    rollbackDigest,
    killSwitchStatus,
    monitoringStatus,
    errorDigest,
    skipReasonCode,
  };
}

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
