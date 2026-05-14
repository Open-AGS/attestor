import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowActivationReadinessGate,
} from './shadow-activation-readiness-gate.js';

export const SHADOW_CUSTOMER_ACTIVATION_HANDOFF_VERSION =
  'attestor.shadow-customer-activation-handoff.v1';
export const SHADOW_CUSTOMER_ACTIVATION_BREAK_GLASS_MAX_WINDOW_MS =
  4 * 60 * 60 * 1000;

export const SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES = [
  'manual',
  'canary',
  'phased',
  'break-glass',
] as const;
export type ShadowCustomerActivationRolloutStrategy =
  typeof SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES[number];

export const SHADOW_CUSTOMER_ACTIVATION_CONTROL_KINDS = [
  'operator-approval',
  'rollback-plan',
  'kill-switch',
  'monitoring-alarm',
] as const;
export type ShadowCustomerActivationControlKind =
  typeof SHADOW_CUSTOMER_ACTIVATION_CONTROL_KINDS[number];

export const SHADOW_CUSTOMER_ACTIVATION_REF_KINDS = [
  'change-ticket',
  'deployment-rollback',
  'feature-flag-disable',
  'emergency-deny-policy',
  'gateway-disable',
  'slo-alarm',
  'incident-channel',
  'manual-runbook',
  'custom',
] as const;
export type ShadowCustomerActivationRefKind =
  typeof SHADOW_CUSTOMER_ACTIVATION_REF_KINDS[number];

export interface ShadowCustomerActivationControlRef {
  readonly id: string;
  readonly kind: ShadowCustomerActivationRefKind;
  readonly digest: string;
  readonly uri: string | null;
}

export interface ShadowCustomerActivationControl {
  readonly control: ShadowCustomerActivationControlKind;
  readonly required: true;
  readonly present: boolean;
  readonly ref: ShadowCustomerActivationControlRef | null;
  readonly blocker: string;
}

export interface ShadowCustomerActivationHandoff {
  readonly version: typeof SHADOW_CUSTOMER_ACTIVATION_HANDOFF_VERSION;
  readonly handoffId: string;
  readonly generatedAt: string;
  readonly tenantId: string;
  readonly sourceActivationReadinessDigest: string;
  readonly sourceIntegrationProofDigest: string;
  readonly sourcePublicationDigest: string;
  readonly sourceBindingDigest: string;
  readonly sourceSimulationDigest: string;
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly secondaryApproverRef: string | null;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly expiresAt: string | null;
  readonly breakGlassWindowSeconds: number | null;
  readonly breakGlassJustificationRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassReconciliationRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassControlsReady: boolean;
  readonly controlRefs: readonly ShadowCustomerActivationControl[];
  readonly controlDigest: string;
  readonly customerControlsReady: boolean;
  readonly activationReadinessReady: boolean;
  readonly handoffReady: boolean;
  readonly handoffInstruction: string;
  readonly remainingActivationBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowCustomerActivationHandoffInput {
  readonly activationReadiness: ShadowActivationReadinessGate;
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly secondaryApproverRef?: string | null;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly rollbackRef?: ShadowCustomerActivationControlRef | null;
  readonly killSwitchRef?: ShadowCustomerActivationControlRef | null;
  readonly monitoringRef?: ShadowCustomerActivationControlRef | null;
  readonly breakGlassJustificationRef?: ShadowCustomerActivationControlRef | null;
  readonly breakGlassReconciliationRef?: ShadowCustomerActivationControlRef | null;
  readonly expiresAt?: string | null;
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

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow customer activation handoff ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIsoTimestamp(value, value, fieldName);
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow customer activation handoff ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow customer activation handoff ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`Shadow customer activation handoff ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeRolloutStrategy(
  value: ShadowCustomerActivationRolloutStrategy,
): ShadowCustomerActivationRolloutStrategy {
  if (!SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.includes(value)) {
    throw new Error(
      `Shadow customer activation handoff rolloutStrategy must be one of: ${SHADOW_CUSTOMER_ACTIVATION_ROLLOUT_STRATEGIES.join(', ')}.`,
    );
  }
  return value;
}

function normalizeRefKind(value: ShadowCustomerActivationRefKind): ShadowCustomerActivationRefKind {
  if (!SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.includes(value)) {
    throw new Error(
      `Shadow customer activation handoff control ref kind must be one of: ${SHADOW_CUSTOMER_ACTIVATION_REF_KINDS.join(', ')}.`,
    );
  }
  return value;
}

function normalizeControlRef(
  value: ShadowCustomerActivationControlRef | null | undefined,
  fieldName: string,
): ShadowCustomerActivationControlRef | null {
  if (!value) return null;
  return Object.freeze({
    id: normalizeIdentifier(value.id, `${fieldName}.id`),
    kind: normalizeRefKind(value.kind),
    digest: normalizeDigest(value.digest, `${fieldName}.digest`),
    uri: normalizeOptionalIdentifier(value.uri, `${fieldName}.uri`),
  });
}

function createControl(
  control: ShadowCustomerActivationControlKind,
  ref: ShadowCustomerActivationControlRef | null,
  blocker: string,
): ShadowCustomerActivationControl {
  return Object.freeze({
    control,
    required: true,
    present: ref !== null,
    ref,
    blocker,
  });
}

function createControls(input: {
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly rollbackRef: ShadowCustomerActivationControlRef | null;
  readonly killSwitchRef: ShadowCustomerActivationControlRef | null;
  readonly monitoringRef: ShadowCustomerActivationControlRef | null;
}): readonly ShadowCustomerActivationControl[] {
  return Object.freeze([
    createControl(
      'operator-approval',
      {
        id: input.activationRef,
        kind: 'change-ticket',
        digest: hashCanonical({
          activationRef: input.activationRef,
          operatorRef: input.operatorRef,
        } as unknown as CanonicalReleaseJsonValue),
        uri: null,
      },
      'operator-activation-reference-required',
    ),
    createControl('rollback-plan', input.rollbackRef, 'rollback-plan-required'),
    createControl('kill-switch', input.killSwitchRef, 'kill-switch-required'),
    createControl('monitoring-alarm', input.monitoringRef, 'monitoring-reference-required'),
  ]);
}

function controlDigestFor(
  controlRefs: readonly ShadowCustomerActivationControl[],
): string {
  return hashCanonical(controlRefs as unknown as CanonicalReleaseJsonValue);
}

function remainingBlockers(input: {
  readonly activationReadiness: ShadowActivationReadinessGate;
  readonly controlRefs: readonly ShadowCustomerActivationControl[];
  readonly expiresAt: string | null;
  readonly generatedAt: string;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly operatorRef: string;
  readonly secondaryApproverRef: string | null;
  readonly breakGlassJustificationRef: ShadowCustomerActivationControlRef | null;
  readonly breakGlassReconciliationRef: ShadowCustomerActivationControlRef | null;
}): readonly string[] {
  const blockers = new Set(input.activationReadiness.remainingActivationBlockers);
  if (!input.activationReadiness.activationReady) {
    blockers.add('activation-readiness-required');
  }
  for (const control of input.controlRefs) {
    if (!control.present) blockers.add(control.blocker);
  }
  if (input.expiresAt !== null && Date.parse(input.expiresAt) <= Date.parse(input.generatedAt)) {
    blockers.add('activation-window-expired');
  }
  if (input.rolloutStrategy === 'break-glass') {
    if (input.secondaryApproverRef === null) {
      blockers.add('break-glass-secondary-approver-required');
    } else if (input.secondaryApproverRef === input.operatorRef) {
      blockers.add('break-glass-secondary-approver-must-differ');
    }
    if (input.expiresAt === null) {
      blockers.add('break-glass-expiry-required');
    } else {
      const windowMs = Date.parse(input.expiresAt) - Date.parse(input.generatedAt);
      if (windowMs > SHADOW_CUSTOMER_ACTIVATION_BREAK_GLASS_MAX_WINDOW_MS) {
        blockers.add('break-glass-window-too-long');
      }
    }
    if (input.breakGlassJustificationRef === null) {
      blockers.add('break-glass-justification-required');
    }
    if (input.breakGlassReconciliationRef === null) {
      blockers.add('break-glass-reconciliation-required');
    }
  }
  return Object.freeze([...blockers].sort());
}

function breakGlassWindowSeconds(input: {
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly generatedAt: string;
  readonly expiresAt: string | null;
}): number | null {
  if (input.rolloutStrategy !== 'break-glass' || input.expiresAt === null) return null;
  return Math.floor((Date.parse(input.expiresAt) - Date.parse(input.generatedAt)) / 1000);
}

function handoffIdFor(input: {
  readonly tenantId: string;
  readonly sourceActivationReadinessDigest: string;
  readonly activationRef: string;
  readonly operatorRef: string;
  readonly secondaryApproverRef: string | null;
  readonly rolloutStrategy: ShadowCustomerActivationRolloutStrategy;
  readonly controlDigest: string;
  readonly expiresAt: string | null;
  readonly breakGlassWindowSeconds: number | null;
  readonly breakGlassJustificationDigest: string | null;
  readonly breakGlassReconciliationDigest: string | null;
}): string {
  return `customer-activation-handoff:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function instruction(handoffReady: boolean): string {
  return handoffReady
    ? 'Customer system may begin its controlled activation process. Attestor does not execute the activation.'
    : 'Do not activate enforcement. Resolve readiness and customer rollback/kill-switch blockers first.';
}

export function createShadowCustomerActivationHandoff(
  input: CreateShadowCustomerActivationHandoffInput,
): ShadowCustomerActivationHandoff {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const activationRef = normalizeIdentifier(input.activationRef, 'activationRef');
  const operatorRef = normalizeIdentifier(input.operatorRef, 'operatorRef');
  const secondaryApproverRef = normalizeOptionalIdentifier(
    input.secondaryApproverRef,
    'secondaryApproverRef',
  );
  const rolloutStrategy = normalizeRolloutStrategy(input.rolloutStrategy);
  const rollbackRef = normalizeControlRef(input.rollbackRef, 'rollbackRef');
  const killSwitchRef = normalizeControlRef(input.killSwitchRef, 'killSwitchRef');
  const monitoringRef = normalizeControlRef(input.monitoringRef, 'monitoringRef');
  const breakGlassJustificationRef = normalizeControlRef(
    input.breakGlassJustificationRef,
    'breakGlassJustificationRef',
  );
  const breakGlassReconciliationRef = normalizeControlRef(
    input.breakGlassReconciliationRef,
    'breakGlassReconciliationRef',
  );
  const expiresAt = normalizeOptionalIsoTimestamp(input.expiresAt, 'expiresAt');
  const breakGlassWindow = breakGlassWindowSeconds({
    rolloutStrategy,
    generatedAt,
    expiresAt,
  });
  const controlRefs = createControls({
    activationRef,
    operatorRef,
    rollbackRef,
    killSwitchRef,
    monitoringRef,
  });
  const controlDigest = controlDigestFor(controlRefs);
  const customerControlsReady = controlRefs.every((control) => control.present);
  const blockers = remainingBlockers({
    activationReadiness: input.activationReadiness,
    controlRefs,
    expiresAt,
    generatedAt,
    rolloutStrategy,
    operatorRef,
    secondaryApproverRef,
    breakGlassJustificationRef,
    breakGlassReconciliationRef,
  });
  const handoffReady = input.activationReadiness.activationReady && customerControlsReady && blockers.length === 0;
  const breakGlassControlsReady = rolloutStrategy !== 'break-glass' ||
    !blockers.some((blocker) => blocker.startsWith('break-glass-'));
  const payload = {
    version: SHADOW_CUSTOMER_ACTIVATION_HANDOFF_VERSION,
    handoffId: handoffIdFor({
      tenantId: input.activationReadiness.tenantId,
      sourceActivationReadinessDigest: input.activationReadiness.digest,
      activationRef,
      operatorRef,
      secondaryApproverRef,
      rolloutStrategy,
      controlDigest,
      expiresAt,
      breakGlassWindowSeconds: breakGlassWindow,
      breakGlassJustificationDigest: breakGlassJustificationRef?.digest ?? null,
      breakGlassReconciliationDigest: breakGlassReconciliationRef?.digest ?? null,
    }),
    generatedAt,
    tenantId: input.activationReadiness.tenantId,
    sourceActivationReadinessDigest: input.activationReadiness.digest,
    sourceIntegrationProofDigest: input.activationReadiness.sourceIntegrationProofDigest,
    sourcePublicationDigest: input.activationReadiness.sourcePublicationDigest,
    sourceBindingDigest: input.activationReadiness.sourceBindingDigest,
    sourceSimulationDigest: input.activationReadiness.sourceSimulationDigest,
    activationRef,
    operatorRef,
    secondaryApproverRef,
    rolloutStrategy,
    expiresAt,
    breakGlassWindowSeconds: breakGlassWindow,
    breakGlassJustificationRef,
    breakGlassReconciliationRef,
    breakGlassControlsReady,
    controlRefs,
    controlDigest,
    customerControlsReady,
    activationReadinessReady: input.activationReadiness.activationReady,
    handoffReady,
    handoffInstruction: instruction(handoffReady),
    remainingActivationBlockers: blockers,
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
