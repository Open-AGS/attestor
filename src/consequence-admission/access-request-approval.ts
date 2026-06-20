import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionResponse,
} from './contracts.js';

export const CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION =
  'attestor.consequence-admission-access-request-approval.v1';

export const CONSEQUENCE_ADMISSION_REQUESTABLE_DENIAL_REASONS = [
  'approval-required',
  'authority-freshness-required',
  'delegated-authority-required',
  'step-up-required',
  'risk-review-required',
] as const;
export type ConsequenceAdmissionRequestableDenialReason =
  typeof CONSEQUENCE_ADMISSION_REQUESTABLE_DENIAL_REASONS[number];

export const CONSEQUENCE_ADMISSION_ACCESS_REQUEST_AUTHORITY_KINDS = [
  'approval',
  'delegated-authority',
  'step-up',
  'risk-review',
  'attestation',
] as const;
export type ConsequenceAdmissionAccessRequestAuthorityKind =
  typeof CONSEQUENCE_ADMISSION_ACCESS_REQUEST_AUTHORITY_KINDS[number];

export const CONSEQUENCE_ADMISSION_ACCESS_REQUEST_TASK_STATUSES = [
  'pending',
  'approved',
  'denied',
  'expired',
  'canceled',
] as const;
export type ConsequenceAdmissionAccessRequestTaskStatus =
  typeof CONSEQUENCE_ADMISSION_ACCESS_REQUEST_TASK_STATUSES[number];

export interface ConsequenceAdmissionRequestableDenialBinding {
  readonly originalAdmissionId: string;
  readonly originalAdmissionDigest: string;
  readonly originalRequestId: string;
  readonly tenantDigest: string | null;
  readonly actorDigest: string;
  readonly actionDigest: string;
  readonly downstreamSystemDigest: string;
  readonly policyRefDigest: string | null;
  readonly scopeDigest: string;
  readonly decision: Extract<ConsequenceAdmissionDecision, 'review' | 'block'>;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdmissionRequestableDenial {
  readonly version: typeof CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION;
  readonly requestable: true;
  readonly reason: ConsequenceAdmissionRequestableDenialReason;
  readonly template: string;
  readonly evaluatedAt: string;
  readonly expiresAt: string;
  readonly requiredAuthorityKinds: readonly ConsequenceAdmissionAccessRequestAuthorityKind[];
  readonly catalogRefs: readonly string[];
  readonly binding: ConsequenceAdmissionRequestableDenialBinding;
  readonly approvalDoesNotPermitAccess: true;
  readonly releaseTokenMayBeIssued: false;
  readonly requiresReevaluation: true;
  readonly rawPayloadStored: false;
}

export interface ConsequenceAdmissionAccessRequestApproval {
  readonly id: string;
  readonly approvalRefDigest: string;
  readonly approvedAt: string;
  readonly approvedUntil: string;
  readonly authorityKind: ConsequenceAdmissionAccessRequestAuthorityKind;
  readonly scopeDigest: string | null;
  readonly approvalStateDigest: string | null;
  readonly rawApprovalStored: false;
}

export interface ConsequenceAdmissionAccessRequestResult {
  readonly mode: 'reevaluate';
  readonly approval: ConsequenceAdmissionAccessRequestApproval;
  readonly accessPermitted: false;
  readonly releaseTokenMayBeIssued: false;
  readonly reevaluationRequired: true;
}

export interface ConsequenceAdmissionAccessRequestTask {
  readonly version: typeof CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION;
  readonly id: string;
  readonly status: ConsequenceAdmissionAccessRequestTaskStatus;
  readonly statusEndpoint: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
  readonly denial: ConsequenceAdmissionRequestableDenial;
  readonly result: ConsequenceAdmissionAccessRequestResult | null;
  readonly accessPermitted: false;
  readonly releaseTokenMayBeIssued: false;
  readonly rawPayloadStored: false;
}

export interface ConsequenceAdmissionAccessRequestReevaluationContext {
  readonly version: typeof CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION;
  readonly taskId: string;
  readonly approvalId: string;
  readonly originalAdmissionId: string;
  readonly originalAdmissionDigest: string;
  readonly originalRequestId: string;
  readonly bindingDigest: string;
  readonly scopeDigest: string;
  readonly approvalRefDigest: string;
  readonly approvedUntil: string;
  readonly reevaluateAt: string;
  readonly releaseTokenMayBeIssuedBeforeReevaluation: false;
  readonly rawPayloadStored: false;
}

export interface CreateConsequenceAdmissionRequestableDenialInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly reason: ConsequenceAdmissionRequestableDenialReason;
  readonly template: string;
  readonly expiresAt: string;
  readonly requiredAuthorityKinds?: readonly ConsequenceAdmissionAccessRequestAuthorityKind[];
  readonly catalogRefs?: readonly string[];
}

export interface CreateConsequenceAdmissionAccessRequestTaskInput {
  readonly denial: ConsequenceAdmissionRequestableDenial;
  readonly taskId: string;
  readonly createdAt: string;
  readonly expiresAt?: string | null;
  readonly statusEndpoint?: string | null;
}

export interface CompleteConsequenceAdmissionAccessRequestTaskInput {
  readonly task: ConsequenceAdmissionAccessRequestTask;
  readonly status: Exclude<ConsequenceAdmissionAccessRequestTaskStatus, 'pending'>;
  readonly decidedAt: string;
  readonly approval?: {
    readonly id: string;
    readonly approvedAt?: string | null;
    readonly approvedUntil: string;
    readonly authorityKind: ConsequenceAdmissionAccessRequestAuthorityKind;
    readonly approvalRef?: string | null;
    readonly scopeDigest?: string | null;
    readonly approvalState?: string | null;
  } | null;
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

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Consequence admission access request ${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Consequence admission access request ${fieldName} cannot be blank.`);
  }
  return normalized;
}

const SHA_256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = normalizeNonEmptyString(value, fieldName);
  if (!SHA_256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Consequence admission access request ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeApprovalId(value: string): string {
  const normalized = normalizeNonEmptyString(value, 'approval.id');
  if (!/^[A-Za-z0-9._:-]+$/u.test(normalized) || /(?:https?:|\/|\\|\?|#|@)/iu.test(normalized)) {
    throw new Error('Consequence admission access request approval.id must be a stable non-raw identifier.');
  }
  return normalized;
}

function uniqueReadonly<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

function validateRequestableDecision(
  decision: ConsequenceAdmissionDecision,
): asserts decision is Extract<ConsequenceAdmissionDecision, 'review' | 'block'> {
  if (decision !== 'review' && decision !== 'block') {
    throw new Error('Consequence admission requestable denial requires a review or block decision.');
  }
}

function defaultAuthorityKindsFor(
  reason: ConsequenceAdmissionRequestableDenialReason,
): readonly ConsequenceAdmissionAccessRequestAuthorityKind[] {
  switch (reason) {
    case 'delegated-authority-required':
      return ['delegated-authority'];
    case 'step-up-required':
      return ['step-up'];
    case 'risk-review-required':
      return ['risk-review'];
    case 'authority-freshness-required':
      return ['approval', 'attestation'];
    case 'approval-required':
    default:
      return ['approval'];
  }
}

function scopeMaterialFor(admission: ConsequenceAdmissionResponse) {
  return {
    tenantDigest: admission.request.policyScope.tenantId
      ? digestText(admission.request.policyScope.tenantId)
      : null,
    actorDigest: digestText(admission.request.proposedConsequence.actor),
    actionDigest: digestText(admission.request.proposedConsequence.action),
    downstreamSystemDigest: digestText(admission.request.proposedConsequence.downstreamSystem),
    policyRefDigest: admission.request.policyScope.policyRef
      ? digestText(admission.request.policyScope.policyRef)
      : null,
  } as const;
}

export function scopeDigestForConsequenceAdmissionResponse(
  admission: ConsequenceAdmissionResponse,
): string {
  return canonicalObject(
    scopeMaterialFor(admission) as unknown as CanonicalReleaseJsonValue,
  ).digest;
}

function bindingFor(admission: ConsequenceAdmissionResponse): ConsequenceAdmissionRequestableDenialBinding {
  validateRequestableDecision(admission.decision);
  const scopeMaterial = scopeMaterialFor(admission);
  const material = {
    originalAdmissionId: admission.admissionId,
    originalAdmissionDigest: admission.digest,
    originalRequestId: admission.request.requestId,
    ...scopeMaterial,
    scopeDigest: scopeDigestForConsequenceAdmissionResponse(admission),
    decision: admission.decision,
  } as const;
  const { canonical, digest } = canonicalObject(material as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function createConsequenceAdmissionRequestableDenial(
  input: CreateConsequenceAdmissionRequestableDenialInput,
): ConsequenceAdmissionRequestableDenial {
  const { admission } = input;
  validateRequestableDecision(admission.decision);
  if (admission.allowed || !admission.failClosed) {
    throw new Error('Consequence admission requestable denial can only wrap a fail-closed denied admission.');
  }
  const evaluatedAt = normalizeIsoTimestamp(admission.decidedAt, 'evaluatedAt');
  const expiresAt = normalizeIsoTimestamp(input.expiresAt, 'expiresAt');
  if (expiresAt <= evaluatedAt) {
    throw new Error('Consequence admission requestable denial expiresAt must be after evaluatedAt.');
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION,
    requestable: true,
    reason: input.reason,
    template: normalizeNonEmptyString(input.template, 'template'),
    evaluatedAt,
    expiresAt,
    requiredAuthorityKinds: uniqueReadonly(
      input.requiredAuthorityKinds?.length
        ? input.requiredAuthorityKinds
        : defaultAuthorityKindsFor(input.reason),
    ),
    catalogRefs: uniqueReadonly(input.catalogRefs ?? []),
    binding: bindingFor(admission),
    approvalDoesNotPermitAccess: true,
    releaseTokenMayBeIssued: false,
    requiresReevaluation: true,
    rawPayloadStored: false,
  });
}

export function createConsequenceAdmissionAccessRequestTask(
  input: CreateConsequenceAdmissionAccessRequestTaskInput,
): ConsequenceAdmissionAccessRequestTask {
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const expiresAt = input.expiresAt
    ? normalizeIsoTimestamp(input.expiresAt, 'task.expiresAt')
    : input.denial.expiresAt;
  if (expiresAt <= createdAt) {
    throw new Error('Consequence admission access request task expiresAt must be after createdAt.');
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION,
    id: normalizeNonEmptyString(input.taskId, 'taskId'),
    status: 'pending',
    statusEndpoint: input.statusEndpoint?.trim() || null,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    denial: input.denial,
    result: null,
    accessPermitted: false,
    releaseTokenMayBeIssued: false,
    rawPayloadStored: false,
  });
}

export function completeConsequenceAdmissionAccessRequestTask(
  input: CompleteConsequenceAdmissionAccessRequestTaskInput,
): ConsequenceAdmissionAccessRequestTask {
  const { task, status } = input;
  if (task.status !== 'pending') {
    throw new Error('Consequence admission access request task is already terminal.');
  }
  const decidedAt = normalizeIsoTimestamp(input.decidedAt, 'decidedAt');
  const expiresAtBoundary = task.expiresAt <= task.denial.expiresAt
    ? task.expiresAt
    : task.denial.expiresAt;
  if (status !== 'expired' && decidedAt >= expiresAtBoundary) {
    throw new Error('Consequence admission access request task cannot be completed after expiry.');
  }
  if (status !== 'approved') {
    return Object.freeze({
      ...task,
      status,
      updatedAt: decidedAt,
      result: null,
      accessPermitted: false,
      releaseTokenMayBeIssued: false,
      rawPayloadStored: false,
    });
  }
  const approval = input.approval;
  if (!approval) {
    throw new Error('Consequence admission approved access request task requires approval material.');
  }
  const approvedAt = normalizeIsoTimestamp(approval.approvedAt ?? decidedAt, 'approval.approvedAt');
  const approvedUntil = normalizeIsoTimestamp(approval.approvedUntil, 'approval.approvedUntil');
  if (approvedAt < task.createdAt) {
    throw new Error('Consequence admission approval approvedAt cannot be before task creation.');
  }
  if (approvedAt > decidedAt) {
    throw new Error('Consequence admission approval approvedAt cannot be after decidedAt.');
  }
  if (approvedUntil <= approvedAt) {
    throw new Error('Consequence admission approval approvedUntil must be after approvedAt.');
  }
  if (approvedUntil > expiresAtBoundary) {
    throw new Error('Consequence admission approval approvedUntil cannot exceed task expiry.');
  }
  if (!task.denial.requiredAuthorityKinds.includes(approval.authorityKind)) {
    throw new Error('Consequence admission approval authorityKind does not satisfy the access request.');
  }
  const scopeDigest = approval.scopeDigest?.trim()
    ? normalizeDigest(approval.scopeDigest, 'approval.scopeDigest')
    : task.denial.binding.scopeDigest;
  if (scopeDigest !== task.denial.binding.scopeDigest) {
    throw new Error('Consequence admission approval scopeDigest does not match the requestable denial.');
  }
  const approvalRef =
    approval.approvalRef?.trim() ||
    approval.id;
  const completedApproval: ConsequenceAdmissionAccessRequestApproval = Object.freeze({
    id: normalizeApprovalId(approval.id),
    approvalRefDigest: digestText(approvalRef),
    approvedAt,
    approvedUntil,
    authorityKind: approval.authorityKind,
    scopeDigest,
    approvalStateDigest: approval.approvalState ? digestText(approval.approvalState) : null,
    rawApprovalStored: false,
  });

  return Object.freeze({
    ...task,
    status: 'approved',
    updatedAt: decidedAt,
    result: Object.freeze({
      mode: 'reevaluate',
      approval: completedApproval,
      accessPermitted: false,
      releaseTokenMayBeIssued: false,
      reevaluationRequired: true,
    }),
    accessPermitted: false,
    releaseTokenMayBeIssued: false,
    rawPayloadStored: false,
  });
}

export function createConsequenceAdmissionAccessRequestReevaluationContext(
  input: {
    readonly task: ConsequenceAdmissionAccessRequestTask;
    readonly reevaluateAt: string;
    readonly reevaluatedAdmission?: ConsequenceAdmissionResponse | null;
  },
): ConsequenceAdmissionAccessRequestReevaluationContext {
  if (input.task.status !== 'approved' || !input.task.result) {
    throw new Error('Consequence admission re-evaluation context requires an approved access request task.');
  }
  const reevaluateAt = normalizeIsoTimestamp(input.reevaluateAt, 'reevaluateAt');
  if (reevaluateAt < input.task.result.approval.approvedAt) {
    throw new Error('Consequence admission re-evaluation context cannot predate approval.');
  }
  if (reevaluateAt >= input.task.result.approval.approvedUntil) {
    throw new Error('Consequence admission re-evaluation context cannot use an expired approval.');
  }
  if (reevaluateAt >= input.task.expiresAt || reevaluateAt >= input.task.denial.expiresAt) {
    throw new Error('Consequence admission re-evaluation context cannot use an expired access request task.');
  }
  if (
    input.reevaluatedAdmission &&
    scopeDigestForConsequenceAdmissionResponse(input.reevaluatedAdmission) !== input.task.denial.binding.scopeDigest
  ) {
    throw new Error('Consequence admission re-evaluation context scope does not match the access request.');
  }

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_ACCESS_REQUEST_APPROVAL_VERSION,
    taskId: input.task.id,
    approvalId: input.task.result.approval.id,
    originalAdmissionId: input.task.denial.binding.originalAdmissionId,
    originalAdmissionDigest: input.task.denial.binding.originalAdmissionDigest,
    originalRequestId: input.task.denial.binding.originalRequestId,
    bindingDigest: input.task.denial.binding.digest,
    scopeDigest: input.task.denial.binding.scopeDigest,
    approvalRefDigest: input.task.result.approval.approvalRefDigest,
    approvedUntil: input.task.result.approval.approvedUntil,
    reevaluateAt,
    releaseTokenMayBeIssuedBeforeReevaluation: false,
    rawPayloadStored: false,
  });
}
