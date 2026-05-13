import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION =
  'attestor.consequence-recipient-tenant-boundary-replay.v1';

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS = [
  'tenant',
  'recipient',
  'data-minimization',
] as const;
export type ConsequenceRecipientTenantBoundaryKind =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES = [
  'shadow-summary',
  'audit-evidence-export',
  'business-risk-dashboard',
  'dashboard-api-summary',
  'external-review-packet',
  'support-communication',
  'downstream-send',
] as const;
export type ConsequenceRecipientTenantBoundarySurface =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES = [
  'public',
  'customer-visible',
  'internal',
  'confidential',
  'regulated',
  'credential',
  'unknown',
] as const;
export type ConsequenceRecipientTenantBoundaryDataClass =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceRecipientTenantBoundaryOutcome =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RESULT_STATUSES = [
  'passed',
  'failed',
] as const;
export type ConsequenceRecipientTenantBoundaryResultStatus =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RESULT_STATUSES[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_STATUSES = [
  'passed',
  'review',
  'failed',
] as const;
export type ConsequenceRecipientTenantBoundaryReplayStatus =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_STATUSES[number];

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REASON_CODES = [
  'case-matrix-missing',
  'current-tenant-missing',
  'record-tenant-missing',
  'foreign-tenant-record',
  'recipient-identity-missing',
  'approved-recipient-scope-missing',
  'recipient-out-of-scope',
  'communication-context-missing',
  'data-classification-missing',
  'recipient-data-class-disallowed',
  'redaction-policy-missing',
  'redaction-policy-failed',
  'raw-recipient-exposed',
  'raw-payload-stored',
  'expected-boundary-decision-mismatch',
  'boundary-pass',
  'boundary-review',
  'boundary-block',
] as const;
export type ConsequenceRecipientTenantBoundaryReasonCode =
  typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REASON_CODES[number];

export type ConsequenceRecipientTenantBoundaryFailureModeId =
  | 'cross-tenant-leakage'
  | 'wrong-recipient-disclosure'
  | 'sensitive-data-disclosure';

export interface ConsequenceRecipientTenantBoundaryReplayCaseInput {
  readonly caseId: string;
  readonly surface: ConsequenceRecipientTenantBoundarySurface;
  readonly boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[];
  readonly expectedOutcome: ConsequenceRecipientTenantBoundaryOutcome;
  readonly currentTenantId?: string | null;
  readonly recordTenantIds?: readonly (string | null | undefined)[] | null;
  readonly targetRecipientId?: string | null;
  readonly approvedRecipientIds?: readonly string[] | null;
  readonly contentDataClass?: ConsequenceRecipientTenantBoundaryDataClass | null;
  readonly allowedRecipientDataClasses?:
    readonly ConsequenceRecipientTenantBoundaryDataClass[] | null;
  readonly communicationContext?: string | null;
  readonly redactionPolicyPassed?: boolean | null;
  readonly rawRecipientExposed?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
}

export interface EvaluateConsequenceRecipientTenantBoundaryReplayInput {
  readonly generatedAt?: string | null;
  readonly cases?: readonly ConsequenceRecipientTenantBoundaryReplayCaseInput[] | null;
}

export interface ConsequenceRecipientTenantBoundaryReplayCaseResult {
  readonly caseId: string;
  readonly surface: ConsequenceRecipientTenantBoundarySurface;
  readonly boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[];
  readonly expectedOutcome: ConsequenceRecipientTenantBoundaryOutcome;
  readonly outcome: ConsequenceRecipientTenantBoundaryOutcome;
  readonly status: ConsequenceRecipientTenantBoundaryResultStatus;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceRecipientTenantBoundaryReasonCode[];
  readonly failureModeIds: readonly ConsequenceRecipientTenantBoundaryFailureModeId[];
  readonly invariantIds: readonly string[];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly observed: {
    readonly currentTenantDigest: string | null;
    readonly recordTenantDigests: readonly string[];
    readonly foreignRecordTenantDigests: readonly string[];
    readonly missingRecordTenantCount: number;
    readonly targetRecipientDigest: string | null;
    readonly approvedRecipientScopeDigest: string | null;
    readonly contentDataClass: ConsequenceRecipientTenantBoundaryDataClass | null;
    readonly allowedRecipientDataClasses: readonly ConsequenceRecipientTenantBoundaryDataClass[];
    readonly communicationContextDigest: string | null;
    readonly redactionPolicyPassed: boolean | null;
    readonly rawRecipientExposed: boolean;
    readonly rawPayloadStored: boolean;
  };
}

export interface ConsequenceRecipientTenantBoundaryReplayReport {
  readonly version: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION;
  readonly generatedAt: string;
  readonly status: ConsequenceRecipientTenantBoundaryReplayStatus;
  readonly caseCount: number;
  readonly passedCaseCount: number;
  readonly failedCaseCount: number;
  readonly blockOutcomeCount: number;
  readonly reviewOutcomeCount: number;
  readonly reasonCodes: readonly ConsequenceRecipientTenantBoundaryReasonCode[];
  readonly results: readonly ConsequenceRecipientTenantBoundaryReplayCaseResult[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly syntheticOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly digestOnly: true;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceRecipientTenantBoundaryReplayDescriptor {
  readonly version: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION;
  readonly boundaryKinds: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS;
  readonly surfaces: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES;
  readonly dataClasses: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES;
  readonly outcomes: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES;
  readonly statuses: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_STATUSES;
  readonly failureModeIds: readonly [
    'cross-tenant-leakage',
    'wrong-recipient-disclosure',
    'sensitive-data-disclosure',
  ];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly syntheticOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly digestOnly: true;
}

const FAILURE_MODE_BY_BOUNDARY_KIND: Readonly<
  Record<
    ConsequenceRecipientTenantBoundaryKind,
    ConsequenceRecipientTenantBoundaryFailureModeId
  >
> = Object.freeze({
  tenant: 'cross-tenant-leakage',
  recipient: 'wrong-recipient-disclosure',
  'data-minimization': 'sensitive-data-disclosure',
});

const BLOCK_REASONS = new Set<ConsequenceRecipientTenantBoundaryReasonCode>([
  'current-tenant-missing',
  'foreign-tenant-record',
  'recipient-out-of-scope',
  'recipient-data-class-disallowed',
  'redaction-policy-failed',
  'raw-recipient-exposed',
  'raw-payload-stored',
]);

const REVIEW_REASONS = new Set<ConsequenceRecipientTenantBoundaryReasonCode>([
  'record-tenant-missing',
  'recipient-identity-missing',
  'approved-recipient-scope-missing',
  'communication-context-missing',
  'data-classification-missing',
  'redaction-policy-missing',
]);

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

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function normalizeIsoTimestamp(value: string | null | undefined, fallback: string): string {
  const timestamp = new Date(value ?? fallback);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Recipient/tenant boundary replay generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function safeCaseId(value: string): string {
  const trimmed = value.trim();
  if (/^[a-z0-9:._-]{1,96}$/iu.test(trimmed)) return trimmed;
  return digestText(trimmed);
}

function uniqueSorted<T extends string>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)].sort());
}

function selectedFailureModeIds(
  boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[],
): readonly ConsequenceRecipientTenantBoundaryFailureModeId[] {
  return uniqueSorted(boundaryKinds.map((kind) => FAILURE_MODE_BY_BOUNDARY_KIND[kind]));
}

function selectedBindings(
  failureModeIds: readonly ConsequenceRecipientTenantBoundaryFailureModeId[],
): readonly ConsequenceFailureControlBinding[] {
  return Object.freeze(failureModeIds.map((failureModeId) => {
    const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
      item.failureModeId === failureModeId
    );
    if (!binding) {
      throw new Error(`Missing control binding for ${failureModeId}.`);
    }
    return binding;
  }));
}

function includesBoundary(
  boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[],
  kind: ConsequenceRecipientTenantBoundaryKind,
): boolean {
  return boundaryKinds.includes(kind);
}

function evaluateCase(
  input: ConsequenceRecipientTenantBoundaryReplayCaseInput,
): ConsequenceRecipientTenantBoundaryReplayCaseResult {
  const boundaryKinds = uniqueSorted(input.boundaryKinds);
  const reasonCodes: ConsequenceRecipientTenantBoundaryReasonCode[] = [];
  const currentTenantId = input.currentTenantId?.trim() || null;
  const recordTenantIds = readonlyCopy((input.recordTenantIds ?? [])
    .map((tenantId) => tenantId?.trim() || null));
  const targetRecipientId = input.targetRecipientId?.trim() || null;
  const approvedRecipientIds = readonlyCopy((input.approvedRecipientIds ?? [])
    .map((recipientId) => recipientId.trim())
    .filter((recipientId) => recipientId.length > 0)
    .sort());
  const contentDataClass = input.contentDataClass ?? null;
  const allowedRecipientDataClasses = uniqueSorted(input.allowedRecipientDataClasses ?? []);
  const communicationContext = input.communicationContext?.trim() || null;
  const redactionPolicyPassed = input.redactionPolicyPassed ?? null;
  const rawRecipientExposed = input.rawRecipientExposed === true;
  const rawPayloadStored = input.rawPayloadStored === true;

  if (includesBoundary(boundaryKinds, 'tenant')) {
    if (!currentTenantId) reasonCodes.push('current-tenant-missing');
    if (recordTenantIds.some((tenantId) => tenantId === null)) {
      reasonCodes.push('record-tenant-missing');
    }
    if (currentTenantId && recordTenantIds.some((tenantId) => tenantId !== null && tenantId !== currentTenantId)) {
      reasonCodes.push('foreign-tenant-record');
    }
  }

  if (includesBoundary(boundaryKinds, 'recipient')) {
    if (!targetRecipientId) reasonCodes.push('recipient-identity-missing');
    if (approvedRecipientIds.length === 0) {
      reasonCodes.push('approved-recipient-scope-missing');
    }
    if (targetRecipientId && approvedRecipientIds.length > 0 && !approvedRecipientIds.includes(targetRecipientId)) {
      reasonCodes.push('recipient-out-of-scope');
    }
    if (!communicationContext) reasonCodes.push('communication-context-missing');
    if (!contentDataClass) reasonCodes.push('data-classification-missing');
    if (
      contentDataClass &&
      allowedRecipientDataClasses.length > 0 &&
      !allowedRecipientDataClasses.includes(contentDataClass)
    ) {
      reasonCodes.push('recipient-data-class-disallowed');
    }
  }

  if (includesBoundary(boundaryKinds, 'data-minimization')) {
    if (redactionPolicyPassed === null) reasonCodes.push('redaction-policy-missing');
    if (redactionPolicyPassed === false) reasonCodes.push('redaction-policy-failed');
    if (rawRecipientExposed) reasonCodes.push('raw-recipient-exposed');
    if (rawPayloadStored) reasonCodes.push('raw-payload-stored');
  }

  const uniqueReasons = uniqueSorted(reasonCodes);
  const hasBlock = uniqueReasons.some((reason) => BLOCK_REASONS.has(reason));
  const hasReview = uniqueReasons.some((reason) => REVIEW_REASONS.has(reason));
  const outcome: ConsequenceRecipientTenantBoundaryOutcome = hasBlock
    ? 'block'
    : hasReview
      ? 'review'
      : 'pass';
  const status: ConsequenceRecipientTenantBoundaryResultStatus =
    outcome === input.expectedOutcome ? 'passed' : 'failed';
  const failureModeIds = selectedFailureModeIds(boundaryKinds);
  const bindings = selectedBindings(failureModeIds);
  const finalReasonCodes = uniqueSorted([
    ...uniqueReasons,
    status === 'failed' ? 'expected-boundary-decision-mismatch' : null,
    outcome === 'block'
      ? 'boundary-block'
      : outcome === 'review'
        ? 'boundary-review'
        : 'boundary-pass',
  ].filter((reason): reason is ConsequenceRecipientTenantBoundaryReasonCode => reason !== null));
  const foreignRecordTenantIds = currentTenantId
    ? recordTenantIds.filter((tenantId) => tenantId !== null && tenantId !== currentTenantId)
    : [];

  return Object.freeze({
    caseId: safeCaseId(input.caseId),
    surface: input.surface,
    boundaryKinds,
    expectedOutcome: input.expectedOutcome,
    outcome,
    status,
    failClosed: outcome !== 'pass',
    reasonCodes: finalReasonCodes,
    failureModeIds,
    invariantIds: uniqueSorted(bindings.flatMap((binding) => binding.invariantIds)),
    requiredControls: uniqueSorted(bindings.flatMap((binding) => binding.controlIds)),
    requiredEvidence: uniqueSorted(bindings.flatMap((binding) => binding.requiredEvidence)),
    requiredAuthoritySources: uniqueSorted(bindings.flatMap((binding) => binding.requiredAuthority)),
    requiredAuditRecords: uniqueSorted(bindings.flatMap((binding) => binding.requiredAuditRecords)),
    observed: {
      currentTenantDigest: currentTenantId ? digestText(currentTenantId) : null,
      recordTenantDigests: readonlyCopy(recordTenantIds
        .filter((tenantId): tenantId is string => tenantId !== null)
        .map((tenantId) => digestText(tenantId))),
      foreignRecordTenantDigests: readonlyCopy(foreignRecordTenantIds
        .filter((tenantId): tenantId is string => tenantId !== null)
        .map((tenantId) => digestText(tenantId))),
      missingRecordTenantCount: recordTenantIds.filter((tenantId) => tenantId === null).length,
      targetRecipientDigest: targetRecipientId ? digestText(targetRecipientId) : null,
      approvedRecipientScopeDigest: approvedRecipientIds.length > 0
        ? digestText(approvedRecipientIds.join('\n'))
        : null,
      contentDataClass,
      allowedRecipientDataClasses,
      communicationContextDigest: communicationContext ? digestText(communicationContext) : null,
      redactionPolicyPassed,
      rawRecipientExposed,
      rawPayloadStored,
    },
  });
}

export function evaluateConsequenceRecipientTenantBoundaryReplay(
  input: EvaluateConsequenceRecipientTenantBoundaryReplayInput,
): ConsequenceRecipientTenantBoundaryReplayReport {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, new Date(0).toISOString());
  const cases = readonlyCopy(input.cases ?? []);
  const results = readonlyCopy(cases.map((item) => evaluateCase(item)));
  const failedCaseCount = results.filter((result) => result.status === 'failed').length;
  const reviewOutcomeCount = results.filter((result) => result.outcome === 'review').length;
  const blockOutcomeCount = results.filter((result) => result.outcome === 'block').length;
  const reasonCodes = uniqueSorted([
    ...(cases.length === 0 ? ['case-matrix-missing' as const] : []),
    ...results.flatMap((result) => result.reasonCodes),
  ]);
  const status: ConsequenceRecipientTenantBoundaryReplayStatus = cases.length === 0 || failedCaseCount > 0
    ? 'failed'
    : reviewOutcomeCount > 0
      ? 'review'
      : 'passed';
  const payload = {
    version: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION,
    generatedAt,
    status,
    caseCount: cases.length,
    passedCaseCount: results.length - failedCaseCount,
    failedCaseCount,
    blockOutcomeCount,
    reviewOutcomeCount,
    reasonCodes,
    results,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    syntheticOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    digestOnly: true,
    limitation:
      'This replay contract checks supplied tenant, recipient, and redaction metadata. It does not prove every hosted route, downstream sender, dashboard, export, or review packet has integrated the contract.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceRecipientTenantBoundaryReplayDescriptor(): ConsequenceRecipientTenantBoundaryReplayDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION,
    boundaryKinds: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS,
    surfaces: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES,
    dataClasses: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES,
    outcomes: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES,
    statuses: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_STATUSES,
    failureModeIds: [
      'cross-tenant-leakage',
      'wrong-recipient-disclosure',
      'sensitive-data-disclosure',
    ] as const,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    syntheticOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    digestOnly: true,
  });
}
