import { createHash } from 'node:crypto';
import {
  RELEASE_PRESENTATION_MODES,
  type ReleasePresentationMode,
} from '../release-enforcement-plane/types.js';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
  type ConsequenceAdmissionDownstreamBoundaryKind,
} from './downstream-enforcement-contract.js';
import type {
  ConsequenceAdmissionProtectedEnforcementPath,
  ConsequenceAdmissionProtectedEnforcementProfile,
} from './protected-enforcement-profile.js';

export const CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION =
  'attestor.customer-pep-runtime-adoption.v1';

export const CUSTOMER_PEP_RUNTIME_KINDS = [
  'envoy-ext-authz',
  'istio-custom-authz',
  'opa-envoy-sidecar',
  'hono-middleware',
  'node-middleware',
  'action-dispatcher',
  'record-writer',
  'communication-sender',
  'custom-pep',
] as const;
export type CustomerPepRuntimeKind = typeof CUSTOMER_PEP_RUNTIME_KINDS[number];

export const CUSTOMER_PEP_RUNTIME_ROUTE_COVERAGE_STATUSES = [
  'all-protected-routes',
  'partial',
  'none',
] as const;
export type CustomerPepRuntimeRouteCoverageStatus =
  typeof CUSTOMER_PEP_RUNTIME_ROUTE_COVERAGE_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_STORE_KINDS = [
  'shared-durable',
  'provider-durable',
  'file-backed-evaluation',
  'memory-reference',
  'none',
] as const;
export type CustomerPepRuntimeStoreKind = typeof CUSTOMER_PEP_RUNTIME_STORE_KINDS[number];

export const CUSTOMER_PEP_RUNTIME_HEALTH_STATUSES = [
  'verified',
  'missing',
  'failing',
] as const;
export type CustomerPepRuntimeHealthStatus =
  typeof CUSTOMER_PEP_RUNTIME_HEALTH_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES = [
  'verified',
  'missing',
] as const;
export type CustomerPepRuntimeControlStatus =
  typeof CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_MONITORING_STATUSES = [
  'healthy',
  'degraded',
  'missing',
] as const;
export type CustomerPepRuntimeMonitoringStatus =
  typeof CUSTOMER_PEP_RUNTIME_MONITORING_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_AUDIT_STATUSES = [
  'recorded',
  'missing',
] as const;
export type CustomerPepRuntimeAuditStatus =
  typeof CUSTOMER_PEP_RUNTIME_AUDIT_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_APPROVAL_STATUSES = [
  'approved',
  'missing',
] as const;
export type CustomerPepRuntimeApprovalStatus =
  typeof CUSTOMER_PEP_RUNTIME_APPROVAL_STATUSES[number];

export const CUSTOMER_PEP_RUNTIME_EVIDENCE_KINDS = [
  'gateway-config',
  'middleware-config',
  'verifier-result',
  'sender-proof-verifier',
  'token-introspection-store',
  'replay-store',
  'route-coverage',
  'runtime-health',
  'rollback-plan',
  'kill-switch',
  'monitoring-slo',
  'audit-receipt',
  'customer-approval',
  'activation-handoff',
  'activation-receipt',
  'custom',
] as const;
export type CustomerPepRuntimeEvidenceKind =
  typeof CUSTOMER_PEP_RUNTIME_EVIDENCE_KINDS[number];

export const CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS = [
  'gateway-config',
  'verifier-result',
  'sender-proof-verifier',
  'token-introspection-store',
  'replay-store',
  'route-coverage',
  'runtime-health',
  'rollback-plan',
  'kill-switch',
  'monitoring-slo',
  'audit-receipt',
  'customer-approval',
] as const satisfies readonly CustomerPepRuntimeEvidenceKind[];

export const CUSTOMER_PEP_RUNTIME_ADOPTION_FAILURE_REASONS = [
  'protected-profile-not-release-enforcement-plane',
  'release-enforcement-plane-version-missing',
  'route-coverage-incomplete',
  'fail-closed-not-configured',
  'bypass-routes-present',
  'verifier-not-integrated',
  'presentation-mode-missing',
  'presentation-mode-not-profile-compatible',
  'bearer-only-mode-present',
  'sender-constraint-not-required',
  'sender-constrained-mode-missing',
  'online-introspection-not-required',
  'replay-consume-not-required',
  'proof-ref-binding-not-required',
  'audience-binding-not-required',
  'tenant-binding-not-required',
  'token-introspection-store-not-durable',
  'replay-store-not-durable',
  'health-probe-not-verified',
  'rollback-plan-missing',
  'kill-switch-missing',
  'monitoring-not-healthy',
  'audit-receipt-missing',
  'customer-approval-missing',
  'activation-handoff-digest-missing',
  'activation-receipt-digest-missing',
  'runtime-evidence-incomplete',
  'raw-token-storage-enabled',
  'raw-payload-storage-enabled',
  'provider-body-storage-enabled',
] as const;
export type CustomerPepRuntimeAdoptionFailureReason =
  typeof CUSTOMER_PEP_RUNTIME_ADOPTION_FAILURE_REASONS[number];

export interface CustomerPepRuntimeAdoptionEvidenceRef {
  readonly id: string;
  readonly kind: CustomerPepRuntimeEvidenceKind;
  readonly digest: string;
  readonly uri: string | null;
}

export interface EvaluateCustomerPepRuntimeAdoptionInput {
  readonly runtimeId: string;
  readonly tenantId: string;
  readonly environment: string;
  readonly runtimeKind: CustomerPepRuntimeKind;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly downstreamSystem: string;
  readonly protectedProfile: ConsequenceAdmissionProtectedEnforcementProfile;
  readonly releaseEnforcementPlaneVersion?: string | null;
  readonly routeCoverage: CustomerPepRuntimeRouteCoverageStatus;
  readonly bypassRoutes?: readonly string[] | null;
  readonly failClosed: boolean;
  readonly verifierIntegrated: boolean;
  readonly allowedPresentationModes: readonly ReleasePresentationMode[];
  readonly senderConstraintRequired?: boolean | null;
  readonly onlineIntrospectionRequired?: boolean | null;
  readonly replayConsumeRequired?: boolean | null;
  readonly proofRefBindingRequired?: boolean | null;
  readonly audienceBindingRequired?: boolean | null;
  readonly tenantBindingRequired?: boolean | null;
  readonly tokenIntrospectionStore: CustomerPepRuntimeStoreKind;
  readonly replayStore: CustomerPepRuntimeStoreKind;
  readonly healthProbeStatus: CustomerPepRuntimeHealthStatus;
  readonly rollbackPlanStatus: CustomerPepRuntimeControlStatus;
  readonly killSwitchStatus: CustomerPepRuntimeControlStatus;
  readonly monitoringStatus: CustomerPepRuntimeMonitoringStatus;
  readonly auditReceiptStatus: CustomerPepRuntimeAuditStatus;
  readonly customerApprovalStatus: CustomerPepRuntimeApprovalStatus;
  readonly sourceActivationHandoffDigest?: string | null;
  readonly sourceActivationReceiptDigest?: string | null;
  readonly evidenceRefs?: readonly CustomerPepRuntimeAdoptionEvidenceRef[] | null;
  readonly rawTokenStored?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
  readonly providerBodyStored?: boolean | null;
  readonly lastVerifiedAt?: string | null;
  readonly generatedAt?: string | null;
}

export interface CustomerPepRuntimeAdoptionProof {
  readonly version: typeof CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION;
  readonly proofId: string;
  readonly generatedAt: string;
  readonly runtimeId: string;
  readonly tenantId: string;
  readonly environment: string;
  readonly runtimeKind: CustomerPepRuntimeKind;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly downstreamSystem: string;
  readonly protectedProfileVersion: ConsequenceAdmissionProtectedEnforcementProfile['version'];
  readonly protectedProfileMinimumPath: ConsequenceAdmissionProtectedEnforcementPath;
  readonly releaseEnforcementPlaneVersion: string | null;
  readonly routeCoverage: CustomerPepRuntimeRouteCoverageStatus;
  readonly bypassRoutes: readonly string[];
  readonly failClosed: boolean;
  readonly verifierIntegrated: boolean;
  readonly allowedPresentationModes: readonly ReleasePresentationMode[];
  readonly senderConstraintRequired: boolean;
  readonly onlineIntrospectionRequired: boolean;
  readonly replayConsumeRequired: boolean;
  readonly proofRefBindingRequired: boolean;
  readonly audienceBindingRequired: boolean;
  readonly tenantBindingRequired: boolean;
  readonly tokenIntrospectionStore: CustomerPepRuntimeStoreKind;
  readonly replayStore: CustomerPepRuntimeStoreKind;
  readonly healthProbeStatus: CustomerPepRuntimeHealthStatus;
  readonly rollbackPlanStatus: CustomerPepRuntimeControlStatus;
  readonly killSwitchStatus: CustomerPepRuntimeControlStatus;
  readonly monitoringStatus: CustomerPepRuntimeMonitoringStatus;
  readonly auditReceiptStatus: CustomerPepRuntimeAuditStatus;
  readonly customerApprovalStatus: CustomerPepRuntimeApprovalStatus;
  readonly sourceActivationHandoffDigest: string | null;
  readonly sourceActivationReceiptDigest: string | null;
  readonly evidenceRefs: readonly CustomerPepRuntimeAdoptionEvidenceRef[];
  readonly missingEvidenceKinds: readonly CustomerPepRuntimeEvidenceKind[];
  readonly pepRuntimeAdoptionReady: boolean;
  readonly nonBypassableRuntimeClaimAllowed: boolean;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawTokenStored: boolean;
  readonly rawPayloadStored: boolean;
  readonly providerBodyStored: boolean;
  readonly dataMinimized: boolean;
  readonly failureReasons: readonly CustomerPepRuntimeAdoptionFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly protectedPrinciples: readonly [
    'fail-closed boundary',
    'customer authority',
    'proof integrity',
    'replay and idempotency safety',
    'data minimization and redaction',
    'runtime readiness',
    'no overclaim',
  ];
  readonly instruction: string;
  readonly limitation: string;
  readonly lastVerifiedAt: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface CustomerPepRuntimeAdoptionDescriptor {
  readonly version: typeof CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION;
  readonly runtimeKinds: typeof CUSTOMER_PEP_RUNTIME_KINDS;
  readonly routeCoverageStatuses: typeof CUSTOMER_PEP_RUNTIME_ROUTE_COVERAGE_STATUSES;
  readonly storeKinds: typeof CUSTOMER_PEP_RUNTIME_STORE_KINDS;
  readonly healthStatuses: typeof CUSTOMER_PEP_RUNTIME_HEALTH_STATUSES;
  readonly controlStatuses: typeof CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES;
  readonly monitoringStatuses: typeof CUSTOMER_PEP_RUNTIME_MONITORING_STATUSES;
  readonly auditStatuses: typeof CUSTOMER_PEP_RUNTIME_AUDIT_STATUSES;
  readonly approvalStatuses: typeof CUSTOMER_PEP_RUNTIME_APPROVAL_STATUSES;
  readonly evidenceKinds: typeof CUSTOMER_PEP_RUNTIME_EVIDENCE_KINDS;
  readonly requiredEvidenceKinds: typeof CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS;
  readonly failureReasons: typeof CUSTOMER_PEP_RUNTIME_ADOPTION_FAILURE_REASONS;
  readonly requiresReleaseEnforcementPlaneProfile: true;
  readonly requiresFailClosedRouteCoverage: true;
  readonly requiresSenderConstrainedPresentation: true;
  readonly requiresOnlineIntrospection: true;
  readonly requiresReplayConsumption: true;
  readonly requiresSharedDurableStores: true;
  readonly requiresCustomerApproval: true;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly storesRawTokens: false;
  readonly storesRawPayloads: false;
}

export class CustomerPepRuntimeAdoptionError extends Error {
  readonly proof: CustomerPepRuntimeAdoptionProof;
  readonly failureReasons: readonly CustomerPepRuntimeAdoptionFailureReason[];

  constructor(proof: CustomerPepRuntimeAdoptionProof) {
    super(`Customer PEP runtime adoption is not ready: ${proof.failureReasons.join(', ')}`);
    this.name = 'CustomerPepRuntimeAdoptionError';
    this.proof = proof;
    this.failureReasons = proof.failureReasons;
  }
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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Customer PEP runtime adoption ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Customer PEP runtime adoption ${fieldName} requires a non-empty value.`);
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

function normalizeDigest(value: string | null | undefined, fieldName: string): string | null {
  const normalized = normalizeOptionalIdentifier(value, fieldName);
  if (normalized === null) return null;
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`Customer PEP runtime adoption ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Customer PEP runtime adoption ${fieldName} must be an ISO timestamp.`);
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

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function normalizeEnumValue<T extends readonly string[]>(
  value: T[number],
  values: T,
  fieldName: string,
): T[number] {
  if (!includesValue(values, String(value))) {
    throw new Error(
      `Customer PEP runtime adoption ${fieldName} must be one of: ${values.join(', ')}.`,
    );
  }
  return value;
}

function normalizePresentationModes(
  values: readonly ReleasePresentationMode[],
): readonly ReleasePresentationMode[] {
  const normalized = values.map((value) =>
    normalizeEnumValue(value, RELEASE_PRESENTATION_MODES, 'allowedPresentationModes[]')
  );
  return Object.freeze(Array.from(new Set(normalized)).sort());
}

function normalizeBypassRoutes(values: readonly string[] | null | undefined): readonly string[] {
  const normalized = (values ?? []).map((value) =>
    normalizeIdentifier(value, 'bypassRoutes[]')
  );
  return Object.freeze(Array.from(new Set(normalized)).sort());
}

function normalizeEvidenceRef(
  value: CustomerPepRuntimeAdoptionEvidenceRef,
): CustomerPepRuntimeAdoptionEvidenceRef {
  return Object.freeze({
    id: normalizeIdentifier(value.id, 'evidenceRefs[].id'),
    kind: normalizeEnumValue(value.kind, CUSTOMER_PEP_RUNTIME_EVIDENCE_KINDS, 'evidenceRefs[].kind'),
    digest: normalizeDigest(value.digest, 'evidenceRefs[].digest') as string,
    uri: normalizeOptionalIdentifier(value.uri, 'evidenceRefs[].uri'),
  });
}

function durableStoreReady(store: CustomerPepRuntimeStoreKind): boolean {
  return store === 'shared-durable' || store === 'provider-durable';
}

function missingEvidenceKinds(
  evidenceRefs: readonly CustomerPepRuntimeAdoptionEvidenceRef[],
): readonly CustomerPepRuntimeEvidenceKind[] {
  const present = new Set(evidenceRefs.map((ref) => ref.kind));
  return Object.freeze(
    CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS.filter((kind) => !present.has(kind)),
  );
}

function compatiblePresentationModes(input: {
  readonly allowedPresentationModes: readonly ReleasePresentationMode[];
  readonly protectedProfile: ConsequenceAdmissionProtectedEnforcementProfile;
}): boolean {
  if (input.allowedPresentationModes.length === 0) return false;
  return input.allowedPresentationModes.every((mode) =>
    input.protectedProfile.allowedPresentationModes.includes(mode),
  );
}

function hasSenderConstrainedMode(
  allowedPresentationModes: readonly ReleasePresentationMode[],
): boolean {
  return allowedPresentationModes.some((mode) => mode !== 'bearer-release-token');
}

function uniqueFailureReasons(
  reasons: readonly CustomerPepRuntimeAdoptionFailureReason[],
): readonly CustomerPepRuntimeAdoptionFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CUSTOMER_PEP_RUNTIME_ADOPTION_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function instruction(ready: boolean): string {
  return ready
    ? 'Customer PEP runtime adoption evidence is ready for the scoped runtime. Keep activation, production, and deployment readiness as separate evidence.'
    : 'Do not claim protected customer PEP runtime adoption. Resolve the runtime adoption failure reasons first.';
}

function proofIdFor(input: {
  readonly runtimeId: string;
  readonly tenantId: string;
  readonly environment: string;
  readonly runtimeKind: CustomerPepRuntimeKind;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly downstreamSystem: string;
  readonly sourceActivationHandoffDigest: string | null;
  readonly sourceActivationReceiptDigest: string | null;
  readonly evidenceDigests: readonly string[];
}): string {
  return `customer-pep-runtime-adoption:${hashCanonical(
    input as unknown as CanonicalReleaseJsonValue,
  )}`;
}

export function evaluateCustomerPepRuntimeAdoption(
  input: EvaluateCustomerPepRuntimeAdoptionInput,
): CustomerPepRuntimeAdoptionProof {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const runtimeId = normalizeIdentifier(input.runtimeId, 'runtimeId');
  const tenantId = normalizeIdentifier(input.tenantId, 'tenantId');
  const environment = normalizeIdentifier(input.environment, 'environment');
  const runtimeKind = normalizeEnumValue(input.runtimeKind, CUSTOMER_PEP_RUNTIME_KINDS, 'runtimeKind');
  const boundaryKind = normalizeEnumValue(
    input.boundaryKind,
    CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
    'boundaryKind',
  );
  const downstreamSystem = normalizeIdentifier(input.downstreamSystem, 'downstreamSystem');
  const releaseEnforcementPlaneVersion = normalizeOptionalIdentifier(
    input.releaseEnforcementPlaneVersion,
    'releaseEnforcementPlaneVersion',
  );
  const routeCoverage = normalizeEnumValue(
    input.routeCoverage,
    CUSTOMER_PEP_RUNTIME_ROUTE_COVERAGE_STATUSES,
    'routeCoverage',
  );
  const bypassRoutes = normalizeBypassRoutes(input.bypassRoutes);
  const allowedPresentationModes = normalizePresentationModes(input.allowedPresentationModes);
  const tokenIntrospectionStore = normalizeEnumValue(
    input.tokenIntrospectionStore,
    CUSTOMER_PEP_RUNTIME_STORE_KINDS,
    'tokenIntrospectionStore',
  );
  const replayStore = normalizeEnumValue(input.replayStore, CUSTOMER_PEP_RUNTIME_STORE_KINDS, 'replayStore');
  const healthProbeStatus = normalizeEnumValue(
    input.healthProbeStatus,
    CUSTOMER_PEP_RUNTIME_HEALTH_STATUSES,
    'healthProbeStatus',
  );
  const rollbackPlanStatus = normalizeEnumValue(
    input.rollbackPlanStatus,
    CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES,
    'rollbackPlanStatus',
  );
  const killSwitchStatus = normalizeEnumValue(
    input.killSwitchStatus,
    CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES,
    'killSwitchStatus',
  );
  const monitoringStatus = normalizeEnumValue(
    input.monitoringStatus,
    CUSTOMER_PEP_RUNTIME_MONITORING_STATUSES,
    'monitoringStatus',
  );
  const auditReceiptStatus = normalizeEnumValue(
    input.auditReceiptStatus,
    CUSTOMER_PEP_RUNTIME_AUDIT_STATUSES,
    'auditReceiptStatus',
  );
  const customerApprovalStatus = normalizeEnumValue(
    input.customerApprovalStatus,
    CUSTOMER_PEP_RUNTIME_APPROVAL_STATUSES,
    'customerApprovalStatus',
  );
  const sourceActivationHandoffDigest = normalizeDigest(
    input.sourceActivationHandoffDigest,
    'sourceActivationHandoffDigest',
  );
  const sourceActivationReceiptDigest = normalizeDigest(
    input.sourceActivationReceiptDigest,
    'sourceActivationReceiptDigest',
  );
  const evidenceRefs = Object.freeze((input.evidenceRefs ?? []).map(normalizeEvidenceRef));
  const missingEvidence = missingEvidenceKinds(evidenceRefs);
  const rawTokenStored = input.rawTokenStored ?? false;
  const rawPayloadStored = input.rawPayloadStored ?? false;
  const providerBodyStored = input.providerBodyStored ?? false;
  const dataMinimized = !rawTokenStored && !rawPayloadStored && !providerBodyStored;
  const lastVerifiedAt = normalizeOptionalIsoTimestamp(input.lastVerifiedAt, 'lastVerifiedAt');
  const senderConstraintRequired =
    input.senderConstraintRequired ?? input.protectedProfile.senderConstraintRequired;
  const onlineIntrospectionRequired =
    input.onlineIntrospectionRequired ?? input.protectedProfile.onlineIntrospectionRequired;
  const replayConsumeRequired =
    input.replayConsumeRequired ?? input.protectedProfile.replayConsumeRequired;
  const proofRefBindingRequired = input.proofRefBindingRequired ?? true;
  const audienceBindingRequired = input.audienceBindingRequired ?? true;
  const tenantBindingRequired = input.tenantBindingRequired ?? true;
  const protectedProfileIsReleaseEnforcement =
    input.protectedProfile.minimumPath === 'release-enforcement-plane';

  const failures = uniqueFailureReasons([
    ...(!protectedProfileIsReleaseEnforcement
      ? ['protected-profile-not-release-enforcement-plane' as const]
      : []),
    ...(releaseEnforcementPlaneVersion === null
      ? ['release-enforcement-plane-version-missing' as const]
      : []),
    ...(routeCoverage !== 'all-protected-routes'
      ? ['route-coverage-incomplete' as const]
      : []),
    ...(!input.failClosed ? ['fail-closed-not-configured' as const] : []),
    ...(bypassRoutes.length > 0 ? ['bypass-routes-present' as const] : []),
    ...(!input.verifierIntegrated ? ['verifier-not-integrated' as const] : []),
    ...(allowedPresentationModes.length === 0 ? ['presentation-mode-missing' as const] : []),
    ...(!compatiblePresentationModes({ allowedPresentationModes, protectedProfile: input.protectedProfile })
      ? ['presentation-mode-not-profile-compatible' as const]
      : []),
    ...(allowedPresentationModes.includes('bearer-release-token')
      ? ['bearer-only-mode-present' as const]
      : []),
    ...(!senderConstraintRequired ? ['sender-constraint-not-required' as const] : []),
    ...(!hasSenderConstrainedMode(allowedPresentationModes)
      ? ['sender-constrained-mode-missing' as const]
      : []),
    ...(!onlineIntrospectionRequired ? ['online-introspection-not-required' as const] : []),
    ...(!replayConsumeRequired ? ['replay-consume-not-required' as const] : []),
    ...(!proofRefBindingRequired ? ['proof-ref-binding-not-required' as const] : []),
    ...(!audienceBindingRequired ? ['audience-binding-not-required' as const] : []),
    ...(!tenantBindingRequired ? ['tenant-binding-not-required' as const] : []),
    ...(!durableStoreReady(tokenIntrospectionStore)
      ? ['token-introspection-store-not-durable' as const]
      : []),
    ...(!durableStoreReady(replayStore) ? ['replay-store-not-durable' as const] : []),
    ...(healthProbeStatus !== 'verified' ? ['health-probe-not-verified' as const] : []),
    ...(rollbackPlanStatus !== 'verified' ? ['rollback-plan-missing' as const] : []),
    ...(killSwitchStatus !== 'verified' ? ['kill-switch-missing' as const] : []),
    ...(monitoringStatus !== 'healthy' ? ['monitoring-not-healthy' as const] : []),
    ...(auditReceiptStatus !== 'recorded' ? ['audit-receipt-missing' as const] : []),
    ...(customerApprovalStatus !== 'approved' ? ['customer-approval-missing' as const] : []),
    ...(sourceActivationHandoffDigest === null ? ['activation-handoff-digest-missing' as const] : []),
    ...(sourceActivationReceiptDigest === null ? ['activation-receipt-digest-missing' as const] : []),
    ...(missingEvidence.length > 0 ? ['runtime-evidence-incomplete' as const] : []),
    ...(rawTokenStored ? ['raw-token-storage-enabled' as const] : []),
    ...(rawPayloadStored ? ['raw-payload-storage-enabled' as const] : []),
    ...(providerBodyStored ? ['provider-body-storage-enabled' as const] : []),
  ]);
  const pepRuntimeAdoptionReady = failures.length === 0;
  const payload = {
    version: CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
    proofId: proofIdFor({
      runtimeId,
      tenantId,
      environment,
      runtimeKind,
      boundaryKind,
      downstreamSystem,
      sourceActivationHandoffDigest,
      sourceActivationReceiptDigest,
      evidenceDigests: evidenceRefs.map((ref) => ref.digest),
    }),
    generatedAt,
    runtimeId,
    tenantId,
    environment,
    runtimeKind,
    boundaryKind,
    downstreamSystem,
    protectedProfileVersion: input.protectedProfile.version,
    protectedProfileMinimumPath: input.protectedProfile.minimumPath,
    releaseEnforcementPlaneVersion,
    routeCoverage,
    bypassRoutes,
    failClosed: input.failClosed,
    verifierIntegrated: input.verifierIntegrated,
    allowedPresentationModes,
    senderConstraintRequired,
    onlineIntrospectionRequired,
    replayConsumeRequired,
    proofRefBindingRequired,
    audienceBindingRequired,
    tenantBindingRequired,
    tokenIntrospectionStore,
    replayStore,
    healthProbeStatus,
    rollbackPlanStatus,
    killSwitchStatus,
    monitoringStatus,
    auditReceiptStatus,
    customerApprovalStatus,
    sourceActivationHandoffDigest,
    sourceActivationReceiptDigest,
    evidenceRefs,
    missingEvidenceKinds: missingEvidence,
    pepRuntimeAdoptionReady,
    nonBypassableRuntimeClaimAllowed: pepRuntimeAdoptionReady,
    productionReady: false,
    activatesEnforcement: false,
    rawTokenStored,
    rawPayloadStored,
    providerBodyStored,
    dataMinimized,
    failureReasons: failures,
    reasonCodes: Object.freeze([
      ...input.protectedProfile.reasonCodes,
      ...failures.map((reason) => `customer-pep-runtime-${reason}`),
      `customer-pep-runtime-${pepRuntimeAdoptionReady ? 'adoption-ready' : 'adoption-held'}`,
    ]),
    protectedPrinciples: [
      'fail-closed boundary',
      'customer authority',
      'proof integrity',
      'replay and idempotency safety',
      'data minimization and redaction',
      'runtime readiness',
      'no overclaim',
    ] as const,
    instruction: instruction(pepRuntimeAdoptionReady),
    limitation:
      'This proof is scoped to a named customer runtime. It does not deploy infrastructure, operate the customer PEP, prove hosted production configuration, or certify live production readiness.',
    lastVerifiedAt,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function assertCustomerPepRuntimeAdoptionReady(
  input: EvaluateCustomerPepRuntimeAdoptionInput,
): CustomerPepRuntimeAdoptionProof {
  const proof = evaluateCustomerPepRuntimeAdoption(input);
  if (!proof.pepRuntimeAdoptionReady) {
    throw new CustomerPepRuntimeAdoptionError(proof);
  }
  return proof;
}

export function customerPepRuntimeAdoptionDescriptor():
CustomerPepRuntimeAdoptionDescriptor {
  return Object.freeze({
    version: CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
    runtimeKinds: CUSTOMER_PEP_RUNTIME_KINDS,
    routeCoverageStatuses: CUSTOMER_PEP_RUNTIME_ROUTE_COVERAGE_STATUSES,
    storeKinds: CUSTOMER_PEP_RUNTIME_STORE_KINDS,
    healthStatuses: CUSTOMER_PEP_RUNTIME_HEALTH_STATUSES,
    controlStatuses: CUSTOMER_PEP_RUNTIME_CONTROL_STATUSES,
    monitoringStatuses: CUSTOMER_PEP_RUNTIME_MONITORING_STATUSES,
    auditStatuses: CUSTOMER_PEP_RUNTIME_AUDIT_STATUSES,
    approvalStatuses: CUSTOMER_PEP_RUNTIME_APPROVAL_STATUSES,
    evidenceKinds: CUSTOMER_PEP_RUNTIME_EVIDENCE_KINDS,
    requiredEvidenceKinds: CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS,
    failureReasons: CUSTOMER_PEP_RUNTIME_ADOPTION_FAILURE_REASONS,
    requiresReleaseEnforcementPlaneProfile: true,
    requiresFailClosedRouteCoverage: true,
    requiresSenderConstrainedPresentation: true,
    requiresOnlineIntrospection: true,
    requiresReplayConsumption: true,
    requiresSharedDurableStores: true,
    requiresCustomerApproval: true,
    productionReady: false,
    activatesEnforcement: false,
    storesRawTokens: false,
    storesRawPayloads: false,
  });
}
