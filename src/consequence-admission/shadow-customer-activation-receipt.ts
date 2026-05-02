import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowCustomerActivationHandoff,
} from './shadow-customer-activation-handoff.js';

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_VERSION =
  'attestor.shadow-customer-activation-receipt.v1';

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES = [
  'activated',
  'rolled-back',
  'failed',
  'aborted',
] as const;
export type ShadowCustomerActivationReceiptStatus =
  typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES[number];

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES = [
  'not-triggered',
  'triggered',
  'completed',
  'failed',
] as const;
export type ShadowCustomerActivationReceiptRollbackStatus =
  typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES[number];

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES = [
  'verified',
  'not-tested',
  'failed',
] as const;
export type ShadowCustomerActivationReceiptKillSwitchStatus =
  typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES[number];

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES = [
  'healthy',
  'degraded',
  'alarm',
  'unknown',
] as const;
export type ShadowCustomerActivationReceiptMonitoringStatus =
  typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES[number];

export const SHADOW_CUSTOMER_ACTIVATION_RECEIPT_FAILURE_REASONS = [
  'handoff-digest-mismatch',
  'handoff-not-ready',
  'attempt-before-handoff',
  'observed-before-attempt',
  'completed-before-attempt',
  'activation-result-digest-required',
  'activation-error-digest-required',
  'rollback-digest-required',
  'rollback-not-completed',
  'rollback-failed',
  'abort-reason-required',
  'kill-switch-not-verified',
  'monitoring-not-healthy',
] as const;
export type ShadowCustomerActivationReceiptFailureReason =
  typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_FAILURE_REASONS[number];

export interface ShadowCustomerActivationReceipt {
  readonly version: typeof SHADOW_CUSTOMER_ACTIVATION_RECEIPT_VERSION;
  readonly receiptId: string;
  readonly generatedAt: string;
  readonly tenantId: string;
  readonly sourceHandoffId: string;
  readonly sourceHandoffDigest: string;
  readonly sourceActivationReadinessDigest: string;
  readonly sourceIntegrationProofDigest: string;
  readonly sourcePublicationDigest: string;
  readonly sourceBindingDigest: string;
  readonly sourceSimulationDigest: string;
  readonly activationRef: string;
  readonly operatorRefDigest: string;
  readonly rolloutStrategy: ShadowCustomerActivationHandoff['rolloutStrategy'];
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt: string;
  readonly activationDigest: string | null;
  readonly externalReceiptDigest: string | null;
  readonly rollbackStatus: ShadowCustomerActivationReceiptRollbackStatus;
  readonly rollbackDigest: string | null;
  readonly killSwitchStatus: ShadowCustomerActivationReceiptKillSwitchStatus;
  readonly monitoringStatus: ShadowCustomerActivationReceiptMonitoringStatus;
  readonly errorDigest: string | null;
  readonly skipReasonCode: string | null;
  readonly receiptReady: boolean;
  readonly activationClosed: boolean;
  readonly failureReasons: readonly ShadowCustomerActivationReceiptFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly instruction: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowCustomerActivationReceiptInput {
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt?: string | null;
  readonly activationDigest?: string | null;
  readonly externalReceiptDigest?: string | null;
  readonly rollbackStatus?: ShadowCustomerActivationReceiptRollbackStatus | null;
  readonly rollbackDigest?: string | null;
  readonly killSwitchStatus?: ShadowCustomerActivationReceiptKillSwitchStatus | null;
  readonly monitoringStatus?: ShadowCustomerActivationReceiptMonitoringStatus | null;
  readonly errorDigest?: string | null;
  readonly skipReasonCode?: string | null;
  readonly generatedAt?: string | null;
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow customer activation receipt ${fieldName} requires an ISO timestamp string.`);
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow customer activation receipt ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  return value === undefined || value === null
    ? fallback
    : normalizeIsoTimestamp(value, fieldName);
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Shadow customer activation receipt ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow customer activation receipt ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  const normalized = normalizeOptionalIdentifier(value, fieldName);
  if (normalized === null) return null;
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`Shadow customer activation receipt ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeStatus(
  value: ShadowCustomerActivationReceiptStatus,
): ShadowCustomerActivationReceiptStatus {
  if (!SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.includes(value)) {
    throw new Error(
      `Shadow customer activation receipt activationStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_STATUSES.join(', ')}.`,
    );
  }
  return value;
}

function normalizeRollbackStatus(
  value: ShadowCustomerActivationReceiptRollbackStatus | null | undefined,
): ShadowCustomerActivationReceiptRollbackStatus {
  const normalized = value ?? 'not-triggered';
  if (!SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES.includes(normalized)) {
    throw new Error(
      `Shadow customer activation receipt rollbackStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_ROLLBACK_STATUSES.join(', ')}.`,
    );
  }
  return normalized;
}

function normalizeKillSwitchStatus(
  value: ShadowCustomerActivationReceiptKillSwitchStatus | null | undefined,
): ShadowCustomerActivationReceiptKillSwitchStatus {
  const normalized = value ?? 'not-tested';
  if (!SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES.includes(normalized)) {
    throw new Error(
      `Shadow customer activation receipt killSwitchStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_KILL_SWITCH_STATUSES.join(', ')}.`,
    );
  }
  return normalized;
}

function normalizeMonitoringStatus(
  value: ShadowCustomerActivationReceiptMonitoringStatus | null | undefined,
): ShadowCustomerActivationReceiptMonitoringStatus {
  const normalized = value ?? 'unknown';
  if (!SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES.includes(normalized)) {
    throw new Error(
      `Shadow customer activation receipt monitoringStatus must be one of: ${SHADOW_CUSTOMER_ACTIVATION_RECEIPT_MONITORING_STATUSES.join(', ')}.`,
    );
  }
  return normalized;
}

function orderedFailureReasons(
  reasons: readonly ShadowCustomerActivationReceiptFailureReason[],
): readonly ShadowCustomerActivationReceiptFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    SHADOW_CUSTOMER_ACTIVATION_RECEIPT_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function handoffIntegrityReasons(
  handoff: ShadowCustomerActivationHandoff,
): readonly ShadowCustomerActivationReceiptFailureReason[] {
  const {
    canonical: claimedCanonical,
    digest: claimedDigest,
    ...payload
  } = handoff;
  const actual = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return claimedCanonical === actual.canonical && claimedDigest === actual.digest
    ? []
    : ['handoff-digest-mismatch'];
}

function statusReasons(input: {
  readonly handoff: ShadowCustomerActivationHandoff;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt: string;
  readonly activationDigest: string | null;
  readonly externalReceiptDigest: string | null;
  readonly rollbackStatus: ShadowCustomerActivationReceiptRollbackStatus;
  readonly rollbackDigest: string | null;
  readonly killSwitchStatus: ShadowCustomerActivationReceiptKillSwitchStatus;
  readonly monitoringStatus: ShadowCustomerActivationReceiptMonitoringStatus;
  readonly errorDigest: string | null;
  readonly skipReasonCode: string | null;
}): readonly ShadowCustomerActivationReceiptFailureReason[] {
  const reasons: ShadowCustomerActivationReceiptFailureReason[] = [
    ...handoffIntegrityReasons(input.handoff),
  ];
  if (!input.handoff.handoffReady) {
    reasons.push('handoff-not-ready');
  }
  const handoffGeneratedAtMs = Date.parse(input.handoff.generatedAt);
  const attemptedAtMs = Date.parse(input.attemptedAt);
  const observedAtMs = Date.parse(input.observedAt);
  const completedAtMs = Date.parse(input.completedAt);
  if (attemptedAtMs < handoffGeneratedAtMs) {
    reasons.push('attempt-before-handoff');
  }
  if (observedAtMs < attemptedAtMs) {
    reasons.push('observed-before-attempt');
  }
  if (completedAtMs < attemptedAtMs) {
    reasons.push('completed-before-attempt');
  }

  if (
    input.activationStatus === 'activated' &&
    input.activationDigest === null &&
    input.externalReceiptDigest === null
  ) {
    reasons.push('activation-result-digest-required');
  }
  if (
    input.activationStatus === 'failed' &&
    input.errorDigest === null &&
    input.externalReceiptDigest === null
  ) {
    reasons.push('activation-error-digest-required');
  }
  if (input.activationStatus === 'aborted' && input.skipReasonCode === null) {
    reasons.push('abort-reason-required');
  }
  if (input.activationStatus === 'rolled-back') {
    if (input.rollbackStatus !== 'completed') {
      reasons.push('rollback-not-completed');
    }
    if (input.rollbackDigest === null && input.externalReceiptDigest === null) {
      reasons.push('rollback-digest-required');
    }
  }
  if (input.rollbackStatus === 'failed') {
    reasons.push('rollback-failed');
  }
  if (input.activationStatus === 'activated' && input.killSwitchStatus !== 'verified') {
    reasons.push('kill-switch-not-verified');
  }
  if (input.activationStatus === 'activated' && input.monitoringStatus !== 'healthy') {
    reasons.push('monitoring-not-healthy');
  }

  return orderedFailureReasons(reasons);
}

function receiptIdFor(input: {
  readonly tenantId: string;
  readonly sourceHandoffDigest: string;
  readonly activationStatus: ShadowCustomerActivationReceiptStatus;
  readonly attemptedAt: string;
  readonly observedAt: string;
  readonly completedAt: string;
  readonly activationDigest: string | null;
  readonly externalReceiptDigest: string | null;
  readonly rollbackStatus: ShadowCustomerActivationReceiptRollbackStatus;
  readonly rollbackDigest: string | null;
  readonly killSwitchStatus: ShadowCustomerActivationReceiptKillSwitchStatus;
  readonly monitoringStatus: ShadowCustomerActivationReceiptMonitoringStatus;
  readonly errorDigest: string | null;
  readonly skipReasonCode: string | null;
}): string {
  return `customer-activation-receipt:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function instruction(receiptReady: boolean): string {
  return receiptReady
    ? 'Keep this customer activation receipt with the activation handoff and downstream proof trail.'
    : 'Do not treat activation as closed by Attestor receipt. Resolve the receipt failure reasons first.';
}

export function createShadowCustomerActivationReceipt(
  input: CreateShadowCustomerActivationReceiptInput,
): ShadowCustomerActivationReceipt {
  const generatedAt = normalizeOptionalIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const activationStatus = normalizeStatus(input.activationStatus);
  const attemptedAt = normalizeIsoTimestamp(input.attemptedAt, 'attemptedAt');
  const observedAt = normalizeIsoTimestamp(input.observedAt, 'observedAt');
  const completedAt = normalizeOptionalIsoTimestamp(input.completedAt, observedAt, 'completedAt');
  const activationDigest = normalizeOptionalDigest(input.activationDigest, 'activationDigest');
  const externalReceiptDigest = normalizeOptionalDigest(input.externalReceiptDigest, 'externalReceiptDigest');
  const rollbackStatus = normalizeRollbackStatus(input.rollbackStatus);
  const rollbackDigest = normalizeOptionalDigest(input.rollbackDigest, 'rollbackDigest');
  const killSwitchStatus = normalizeKillSwitchStatus(input.killSwitchStatus);
  const monitoringStatus = normalizeMonitoringStatus(input.monitoringStatus);
  const errorDigest = normalizeOptionalDigest(input.errorDigest, 'errorDigest');
  const skipReasonCode = normalizeOptionalIdentifier(input.skipReasonCode, 'skipReasonCode');
  const failureReasons = statusReasons({
    handoff: input.handoff,
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
  });
  const receiptReady = failureReasons.length === 0;
  const payload = {
    version: SHADOW_CUSTOMER_ACTIVATION_RECEIPT_VERSION,
    receiptId: receiptIdFor({
      tenantId: input.handoff.tenantId,
      sourceHandoffDigest: input.handoff.digest,
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
    }),
    generatedAt,
    tenantId: input.handoff.tenantId,
    sourceHandoffId: input.handoff.handoffId,
    sourceHandoffDigest: input.handoff.digest,
    sourceActivationReadinessDigest: input.handoff.sourceActivationReadinessDigest,
    sourceIntegrationProofDigest: input.handoff.sourceIntegrationProofDigest,
    sourcePublicationDigest: input.handoff.sourcePublicationDigest,
    sourceBindingDigest: input.handoff.sourceBindingDigest,
    sourceSimulationDigest: input.handoff.sourceSimulationDigest,
    activationRef: input.handoff.activationRef,
    operatorRefDigest: digestText(input.handoff.operatorRef),
    rolloutStrategy: input.handoff.rolloutStrategy,
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
    receiptReady,
    activationClosed: receiptReady,
    failureReasons,
    reasonCodes: Object.freeze([
      ...failureReasons.map((reason) => `customer-activation-receipt-${reason}`),
      `customer-activation-receipt-${receiptReady ? 'recorded' : 'held'}`,
    ]),
    instruction: instruction(receiptReady),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
