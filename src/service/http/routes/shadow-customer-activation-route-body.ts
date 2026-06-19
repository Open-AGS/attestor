import type { Context } from 'hono';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES,
  SHADOW_CUSTOMER_ACTIVATION_REF_KINDS,
  SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES,
  SHADOW_DOWNSTREAM_INTEGRATION_EVIDENCE_KINDS,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
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
  isRecord,
  problem,
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

export function parsePromotionSourceStatus(
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

export async function readCustomerActivationHandoffBody(c: Context): Promise<{
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
export function parseCustomerActivationReceiptStatus(
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

export function parseBooleanQuery(value: string | null | undefined): boolean | null {
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

export async function readCustomerActivationReceiptBody(c: Context): Promise<{
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
