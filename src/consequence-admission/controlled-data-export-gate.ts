import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createConsequenceAdmissionDownstreamContract,
  evaluateConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionDownstreamDecision,
} from './downstream-enforcement-contract.js';
import type {
  ConsequenceAdmissionResponse,
} from './contracts.js';
import type {
  ConsequenceAdmissionCustomerGateReleaseEnforcementDecision,
} from './customer-gate.js';

export const CONTROLLED_DATA_EXPORT_GATE_VERSION =
  'attestor.controlled-data-export-gate.v1';
export const CONTROLLED_DATA_EXPORT_PROOF_PACKET_VERSION =
  'attestor.controlled-data-export-proof-packet.v1';

export const CONTROLLED_DATA_EXPORT_OUTCOMES = [
  'executed',
  'narrowed',
  'held-for-review',
  'blocked',
] as const;
export type ControlledDataExportOutcome = typeof CONTROLLED_DATA_EXPORT_OUTCOMES[number];

export const CONTROLLED_DATA_EXPORT_FAILURE_REASONS = [
  'customer-gate-held',
  'release-enforcement-proof-invalid',
  'release-proof-ref-missing',
  'export-intent-proof-missing',
  'tenant-mismatch',
  'target-mismatch',
  'action-mismatch',
  'idempotency-key-missing',
  'classification-mismatch',
  'recipient-mismatch',
  'purpose-mismatch',
  'no-approved-fields',
  'downstream-contract-held',
] as const;
export type ControlledDataExportFailureReason =
  typeof CONTROLLED_DATA_EXPORT_FAILURE_REASONS[number];

export interface ControlledDataExportIntent {
  readonly tenantId: string;
  readonly targetId: string;
  readonly action: string;
  readonly classification: string;
  readonly fields: readonly string[];
  readonly recordCount: number;
  readonly recipientRef: string | null;
  readonly purposeRef: string | null;
  readonly idempotencyKey: string | null;
}

export interface ControlledDataExportAllowedScope {
  readonly classification: string;
  readonly fields: readonly string[];
  readonly maxRecordCount: number;
  readonly recipientRef: string | null;
  readonly purposeRef: string | null;
}

export interface EvaluateControlledDataExportGateInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly customerGate: ConsequenceAdmissionCustomerGateReleaseEnforcementDecision;
  readonly exportIntent: ControlledDataExportIntent;
  readonly allowedScope: ControlledDataExportAllowedScope;
  readonly acceptedConstraintIds?: readonly string[] | null;
  readonly generatedAt?: string | null;
  readonly enforcementPointId?: string | null;
}

export interface ControlledDataExportScopeSummary {
  readonly classificationDigest: string;
  readonly fieldCount: number;
  readonly fieldDigests: readonly string[];
  readonly recordCount: number;
  readonly recipientRefDigest: string | null;
  readonly purposeRefDigest: string | null;
  readonly scopeDigest: string;
}

export interface ControlledDataExportReceipt {
  readonly receiptId: string | null;
  readonly outcome: ControlledDataExportOutcome;
  readonly requestedScopeDigest: string;
  readonly executedScopeDigest: string | null;
  readonly executedFieldCount: number;
  readonly executedRecordCount: number;
  readonly rawRowsStored: false;
  readonly rawPayloadStored: false;
}

export interface ControlledDataExportProofPacket {
  readonly version: typeof CONTROLLED_DATA_EXPORT_PROOF_PACKET_VERSION;
  readonly packetId: string;
  readonly generatedAt: string;
  readonly outcome: ControlledDataExportOutcome;
  readonly admissionRef: {
    readonly admissionId: string;
    readonly admissionDigest: string;
    readonly decision: ConsequenceAdmissionResponse['decision'];
    readonly tenantDigest: string | null;
    readonly policyRefDigest: string | null;
    readonly targetId: string;
    readonly action: string;
  };
  readonly customerGateRef: {
    readonly version: typeof CONTROLLED_DATA_EXPORT_GATE_VERSION;
    readonly customerGateVersion: ConsequenceAdmissionCustomerGateReleaseEnforcementDecision['version'];
    readonly outcome: ConsequenceAdmissionCustomerGateReleaseEnforcementDecision['outcome'];
    readonly failClosed: boolean;
    readonly releaseEnforcement: {
      readonly valid: boolean;
      readonly tokenId: string | null;
      readonly tokenDigest: string | null;
      readonly audience: string;
      readonly onlineChecked: boolean;
      readonly replayConsumed: boolean;
      readonly senderConstrained: boolean | null;
      readonly presentationMode: string | null;
      readonly proofRefMatched: boolean;
      readonly rawReleaseTokenStored: false;
    };
  };
  readonly downstreamContractRef: {
    readonly contractId: string;
    readonly enforcementPointId: string;
    readonly outcome: ConsequenceAdmissionDownstreamDecision['outcome'];
    readonly allowed: boolean;
    readonly failClosed: boolean;
    readonly failureReasons: readonly string[];
  };
  readonly exportIntentRef: ControlledDataExportScopeSummary;
  readonly executedScopeRef: ControlledDataExportScopeSummary | null;
  readonly receipt: ControlledDataExportReceipt;
  readonly failureReasons: readonly ControlledDataExportFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly noClaims: readonly string[];
  readonly liveProviderCalled: false;
  readonly customerPepNoBypassProven: false;
  readonly productionReady: false;
  readonly rawReleaseTokenStored: false;
  readonly rawSenderProofStored: false;
  readonly rawPayloadStored: false;
  readonly rawRowsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ControlledDataExportGateResult {
  readonly version: typeof CONTROLLED_DATA_EXPORT_GATE_VERSION;
  readonly outcome: ControlledDataExportOutcome;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly requestedScope: ControlledDataExportScopeSummary;
  readonly executedScope: ControlledDataExportScopeSummary | null;
  readonly receipt: ControlledDataExportReceipt;
  readonly proofPacket: ControlledDataExportProofPacket;
  readonly failureReasons: readonly ControlledDataExportFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly rawReleaseTokenStored: false;
  readonly rawSenderProofStored: false;
  readonly rawPayloadStored: false;
  readonly rawRowsStored: false;
}

function canonicalDigest(value: CanonicalReleaseJsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalizeReleaseJson(value)).digest('hex')}`;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeIdentifier(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Controlled data export gate ${field} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Controlled data export gate ${field} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFields(fields: readonly string[], field: string): readonly string[] {
  if (fields.length === 0) {
    throw new Error(`Controlled data export gate ${field} requires at least one field.`);
  }
  return Object.freeze(
    Array.from(new Set(fields.map((item) => normalizeIdentifier(item, field)))).sort(),
  );
}

function normalizeRecordCount(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Controlled data export gate ${field} requires a non-negative integer.`);
  }
  return value;
}

function normalizeIntent(intent: ControlledDataExportIntent): ControlledDataExportIntent {
  return Object.freeze({
    tenantId: normalizeIdentifier(intent.tenantId, 'exportIntent.tenantId'),
    targetId: normalizeIdentifier(intent.targetId, 'exportIntent.targetId'),
    action: normalizeIdentifier(intent.action, 'exportIntent.action'),
    classification: normalizeIdentifier(intent.classification, 'exportIntent.classification'),
    fields: normalizeFields(intent.fields, 'exportIntent.fields[]'),
    recordCount: normalizeRecordCount(intent.recordCount, 'exportIntent.recordCount'),
    recipientRef: normalizeOptionalIdentifier(intent.recipientRef),
    purposeRef: normalizeOptionalIdentifier(intent.purposeRef),
    idempotencyKey: normalizeOptionalIdentifier(intent.idempotencyKey),
  });
}

function normalizeAllowedScope(scope: ControlledDataExportAllowedScope):
ControlledDataExportAllowedScope {
  return Object.freeze({
    classification: normalizeIdentifier(scope.classification, 'allowedScope.classification'),
    fields: normalizeFields(scope.fields, 'allowedScope.fields[]'),
    maxRecordCount: normalizeRecordCount(scope.maxRecordCount, 'allowedScope.maxRecordCount'),
    recipientRef: normalizeOptionalIdentifier(scope.recipientRef),
    purposeRef: normalizeOptionalIdentifier(scope.purposeRef),
  });
}

function scopeSummary(input: {
  readonly classification: string;
  readonly fields: readonly string[];
  readonly recordCount: number;
  readonly recipientRef: string | null;
  readonly purposeRef: string | null;
}): ControlledDataExportScopeSummary {
  const fieldDigests = Object.freeze(input.fields.map(digestText).sort());
  const material = {
    version: CONTROLLED_DATA_EXPORT_GATE_VERSION,
    classificationDigest: digestText(input.classification),
    fieldDigests,
    recordCount: input.recordCount,
    recipientRefDigest: input.recipientRef ? digestText(input.recipientRef) : null,
    purposeRefDigest: input.purposeRef ? digestText(input.purposeRef) : null,
  } as const;
  return Object.freeze({
    classificationDigest: material.classificationDigest,
    fieldCount: input.fields.length,
    fieldDigests,
    recordCount: input.recordCount,
    recipientRefDigest: material.recipientRefDigest,
    purposeRefDigest: material.purposeRefDigest,
    scopeDigest: canonicalDigest(material as unknown as CanonicalReleaseJsonValue),
  });
}

export function controlledDataExportIntentDigest(intent: ControlledDataExportIntent): string {
  const normalized = normalizeIntent(intent);
  return scopeSummary(normalized).scopeDigest;
}

function exportedScope(input: {
  readonly intent: ControlledDataExportIntent;
  readonly allowedScope: ControlledDataExportAllowedScope;
}): {
  readonly scope: ControlledDataExportScopeSummary | null;
  readonly narrowed: boolean;
  readonly failures: readonly ControlledDataExportFailureReason[];
} {
  const failures: ControlledDataExportFailureReason[] = [];
  if (input.intent.classification !== input.allowedScope.classification) {
    failures.push('classification-mismatch');
  }
  if (input.intent.recipientRef !== input.allowedScope.recipientRef) {
    failures.push('recipient-mismatch');
  }
  if (input.intent.purposeRef !== input.allowedScope.purposeRef) {
    failures.push('purpose-mismatch');
  }

  const allowedFields = new Set(input.allowedScope.fields);
  const executedFields = input.intent.fields.filter((field) => allowedFields.has(field));
  if (executedFields.length === 0) {
    failures.push('no-approved-fields');
  }
  if (failures.length > 0) {
    return Object.freeze({
      scope: null,
      narrowed: false,
      failures: Object.freeze(failures),
    });
  }

  const executedRecordCount = Math.min(input.intent.recordCount, input.allowedScope.maxRecordCount);
  const narrowed =
    executedFields.length !== input.intent.fields.length ||
    executedRecordCount !== input.intent.recordCount;
  return Object.freeze({
    scope: scopeSummary({
      classification: input.intent.classification,
      fields: executedFields,
      recordCount: executedRecordCount,
      recipientRef: input.intent.recipientRef,
      purposeRef: input.intent.purposeRef,
    }),
    narrowed,
    failures: Object.freeze([]),
  });
}

function uniqueFailureReasons(
  reasons: readonly ControlledDataExportFailureReason[],
): readonly ControlledDataExportFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONTROLLED_DATA_EXPORT_FAILURE_REASONS.filter((reason) => present.has(reason)),
  );
}

function reasonCodesFor(input: {
  readonly outcome: ControlledDataExportOutcome;
  readonly failures: readonly ControlledDataExportFailureReason[];
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly customerGate: ConsequenceAdmissionCustomerGateReleaseEnforcementDecision;
}): readonly string[] {
  return Object.freeze([
    ...input.customerGate.reasonCodes,
    ...input.downstreamDecision.reasonCodes,
    ...input.failures.map((failure) => `controlled-data-export-${failure}`),
    `controlled-data-export-${input.outcome}`,
  ]);
}

function outcomeFor(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly failures: readonly ControlledDataExportFailureReason[];
  readonly narrowed: boolean;
}): ControlledDataExportOutcome {
  if (input.failures.length > 0) {
    return input.admission.decision === 'review' ? 'held-for-review' : 'blocked';
  }
  return input.narrowed || input.admission.decision === 'narrow' ? 'narrowed' : 'executed';
}

function receiptFor(input: {
  readonly outcome: ControlledDataExportOutcome;
  readonly admission: ConsequenceAdmissionResponse;
  readonly requestedScope: ControlledDataExportScopeSummary;
  readonly executedScope: ControlledDataExportScopeSummary | null;
}): ControlledDataExportReceipt {
  const executable = input.outcome === 'executed' || input.outcome === 'narrowed';
  const receiptId = executable
    ? canonicalDigest({
        version: CONTROLLED_DATA_EXPORT_GATE_VERSION,
        admissionDigest: input.admission.digest,
        outcome: input.outcome,
        requestedScopeDigest: input.requestedScope.scopeDigest,
        executedScopeDigest: input.executedScope?.scopeDigest ?? null,
      } as unknown as CanonicalReleaseJsonValue)
    : null;
  return Object.freeze({
    receiptId,
    outcome: input.outcome,
    requestedScopeDigest: input.requestedScope.scopeDigest,
    executedScopeDigest: input.executedScope?.scopeDigest ?? null,
    executedFieldCount: executable ? input.executedScope?.fieldCount ?? 0 : 0,
    executedRecordCount: executable ? input.executedScope?.recordCount ?? 0 : 0,
    rawRowsStored: false,
    rawPayloadStored: false,
  });
}

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-live-provider-call',
    'not-customer-pep-no-bypass-proof',
    'not-production-readiness',
    'not-enterprise-readiness',
    'not-raw-data-export-proof',
  ]);
}

function proofPacketFor(input: {
  readonly generatedAt: string;
  readonly outcome: ControlledDataExportOutcome;
  readonly admission: ConsequenceAdmissionResponse;
  readonly customerGate: ConsequenceAdmissionCustomerGateReleaseEnforcementDecision;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly requestedScope: ControlledDataExportScopeSummary;
  readonly executedScope: ControlledDataExportScopeSummary | null;
  readonly receipt: ControlledDataExportReceipt;
  readonly failures: readonly ControlledDataExportFailureReason[];
  readonly reasonCodes: readonly string[];
}): ControlledDataExportProofPacket {
  const packetWithoutCanonical = {
    version: CONTROLLED_DATA_EXPORT_PROOF_PACKET_VERSION,
    packetId: '',
    generatedAt: input.generatedAt,
    outcome: input.outcome,
    admissionRef: {
      admissionId: input.admission.admissionId,
      admissionDigest: input.admission.digest,
      decision: input.admission.decision,
      tenantDigest: input.admission.request.policyScope.tenantId
        ? digestText(input.admission.request.policyScope.tenantId)
        : null,
      policyRefDigest: input.admission.request.policyScope.policyRef
        ? digestText(input.admission.request.policyScope.policyRef)
        : null,
      targetId: input.admission.request.proposedConsequence.downstreamSystem,
      action: input.admission.request.proposedConsequence.action,
    },
    customerGateRef: {
      version: CONTROLLED_DATA_EXPORT_GATE_VERSION,
      customerGateVersion: input.customerGate.version,
      outcome: input.customerGate.outcome,
      failClosed: input.customerGate.failClosed,
      releaseEnforcement: {
        valid: input.customerGate.releaseEnforcement.valid,
        tokenId: input.customerGate.releaseEnforcement.tokenId,
        tokenDigest: input.customerGate.releaseEnforcement.tokenDigest,
        audience: input.customerGate.releaseEnforcement.audience,
        onlineChecked: input.customerGate.releaseEnforcement.onlineChecked,
        replayConsumed: input.customerGate.releaseEnforcement.replayConsumed,
        senderConstrained: input.customerGate.releaseEnforcement.senderConstrained,
        presentationMode: input.customerGate.releaseEnforcement.presentationMode,
        proofRefMatched: input.customerGate.releaseEnforcement.proofRefMatched,
        rawReleaseTokenStored: false,
      },
    },
    downstreamContractRef: {
      contractId: input.downstreamDecision.contractId,
      enforcementPointId: input.downstreamDecision.enforcementPointId,
      outcome: input.downstreamDecision.outcome,
      allowed: input.downstreamDecision.allowed,
      failClosed: input.downstreamDecision.failClosed,
      failureReasons: input.downstreamDecision.failureReasons,
    },
    exportIntentRef: input.requestedScope,
    executedScopeRef: input.executedScope,
    receipt: input.receipt,
    failureReasons: input.failures,
    reasonCodes: input.reasonCodes,
    noClaims: noClaims(),
    liveProviderCalled: false,
    customerPepNoBypassProven: false,
    productionReady: false,
    rawReleaseTokenStored: false,
    rawSenderProofStored: false,
    rawPayloadStored: false,
    rawRowsStored: false,
  } as const;
  const packetId = canonicalDigest(packetWithoutCanonical as unknown as CanonicalReleaseJsonValue);
  const canonicalInput = {
    ...packetWithoutCanonical,
    packetId,
  } as const;
  const canonical = canonicalizeReleaseJson(canonicalInput as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...canonicalInput,
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function evaluateControlledDataExportGate(
  input: EvaluateControlledDataExportGateInput,
): ControlledDataExportGateResult {
  const generatedAt = normalizeOptionalIdentifier(input.generatedAt) ?? new Date(0).toISOString();
  const exportIntent = normalizeIntent(input.exportIntent);
  const allowedScope = normalizeAllowedScope(input.allowedScope);
  const requestedScope = scopeSummary(exportIntent);
  const enforcementPointId =
    normalizeOptionalIdentifier(input.enforcementPointId) ?? 'controlled-data-export-gate';
  const downstreamContract = createConsequenceAdmissionDownstreamContract({
    enforcementPointId,
    boundaryKind: 'artifact-exporter',
    consequenceDomain: 'data-disclosure',
    downstreamSystems: [exportIntent.targetId],
    acceptedConsequenceKinds: [input.admission.request.proposedConsequence.consequenceKind],
    acceptedRiskClasses: [input.admission.request.proposedConsequence.riskClass],
    policyRefs: input.admission.request.policyScope.policyRef
      ? [input.admission.request.policyScope.policyRef]
      : [],
    environment: input.admission.request.policyScope.environment,
    requireProof: true,
    requireIdempotencyKey: true,
    requireConstraintAcknowledgement: true,
  });
  const downstreamDecision = evaluateConsequenceAdmissionDownstreamContract({
    admission: input.admission,
    contract: downstreamContract,
    observation: {
      downstreamSystem: exportIntent.targetId,
      consequenceKind: input.admission.request.proposedConsequence.consequenceKind,
      riskClass: input.admission.request.proposedConsequence.riskClass,
      policyRef: input.admission.request.policyScope.policyRef,
      idempotencyKey: exportIntent.idempotencyKey,
      acceptedConstraintIds: input.acceptedConstraintIds ?? [],
    },
  });
  const exported = exportedScope({ intent: exportIntent, allowedScope });

  const failures = uniqueFailureReasons([
    ...(input.customerGate.outcome !== 'proceed' ? ['customer-gate-held' as const] : []),
    ...(!input.customerGate.releaseEnforcement.valid
      ? ['release-enforcement-proof-invalid' as const]
      : []),
    ...(!input.customerGate.releaseEnforcement.proofRefMatched
      ? ['release-proof-ref-missing' as const]
      : []),
    ...(!input.admission.request.nativeInputRefs.includes(requestedScope.scopeDigest)
      ? ['export-intent-proof-missing' as const]
      : []),
    ...(input.admission.request.policyScope.tenantId !== exportIntent.tenantId
      ? ['tenant-mismatch' as const]
      : []),
    ...(input.customerGate.releaseEnforcement.claimsTenantId !== exportIntent.tenantId
      ? ['tenant-mismatch' as const]
      : []),
    ...(input.admission.request.proposedConsequence.downstreamSystem !== exportIntent.targetId
      ? ['target-mismatch' as const]
      : []),
    ...(input.customerGate.releaseEnforcement.audience !== exportIntent.targetId
      ? ['target-mismatch' as const]
      : []),
    ...(input.admission.request.proposedConsequence.action !== exportIntent.action
      ? ['action-mismatch' as const]
      : []),
    ...(exportIntent.idempotencyKey === null ? ['idempotency-key-missing' as const] : []),
    ...exported.failures,
    ...(!downstreamDecision.allowed ? ['downstream-contract-held' as const] : []),
  ]);
  const outcome = outcomeFor({
    admission: input.admission,
    failures,
    narrowed: exported.narrowed,
  });
  const executedScope =
    outcome === 'executed' || outcome === 'narrowed' ? exported.scope : null;
  const receipt = receiptFor({
    outcome,
    admission: input.admission,
    requestedScope,
    executedScope,
  });
  const reasonCodes = reasonCodesFor({
    outcome,
    failures,
    downstreamDecision,
    customerGate: input.customerGate,
  });
  const proofPacket = proofPacketFor({
    generatedAt,
    outcome,
    admission: input.admission,
    customerGate: input.customerGate,
    downstreamDecision,
    requestedScope,
    executedScope,
    receipt,
    failures,
    reasonCodes,
  });

  return Object.freeze({
    version: CONTROLLED_DATA_EXPORT_GATE_VERSION,
    outcome,
    downstreamDecision,
    requestedScope,
    executedScope,
    receipt,
    proofPacket,
    failureReasons: failures,
    reasonCodes,
    rawReleaseTokenStored: false,
    rawSenderProofStored: false,
    rawPayloadStored: false,
    rawRowsStored: false,
  });
}
