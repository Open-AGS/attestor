import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  RISK_CLASSES,
  RiskClass,
} from '../release-kernel/types.js';
import type {
  CryptoExecutionAdmissionOutcome,
} from '../crypto-execution-admission/index.js';
import {
  CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
  CONSEQUENCE_ADMISSION_DOMAINS,
  CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS,
  CONSEQUENCE_ADMISSION_TAXONOMY,
  type ConsequenceAdmissionKnownConsequenceKind,
} from './taxonomy.js';

export const CONSEQUENCE_ADMISSION_CONTRACT_VERSION =
  'attestor.consequence-admission.v1';

export const CONSEQUENCE_ADMISSION_DECISIONS = [
  'admit',
  'narrow',
  'review',
  'block',
] as const;
export type ConsequenceAdmissionDecision =
  typeof CONSEQUENCE_ADMISSION_DECISIONS[number];

export const CONSEQUENCE_ADMISSION_PACK_FAMILIES = [
  'finance',
  'crypto',
  'general',
  'future',
] as const;
export type ConsequenceAdmissionPackFamily =
  typeof CONSEQUENCE_ADMISSION_PACK_FAMILIES[number];

export const CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS = [
  'hosted-route',
  'package-boundary',
  'local-command',
  'internal-service',
] as const;
export type ConsequenceAdmissionEntryPointKind =
  typeof CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS[number];

export const CONSEQUENCE_ADMISSION_CHECK_KINDS = [
  'policy',
  'authority',
  'evidence',
  'freshness',
  'enforcement',
  'adapter-readiness',
] as const;
export type ConsequenceAdmissionCheckKind =
  typeof CONSEQUENCE_ADMISSION_CHECK_KINDS[number];

export const CONSEQUENCE_ADMISSION_CHECK_OUTCOMES = [
  'pass',
  'warn',
  'fail',
  'not-applicable',
] as const;
export type ConsequenceAdmissionCheckOutcome =
  typeof CONSEQUENCE_ADMISSION_CHECK_OUTCOMES[number];

export const CONSEQUENCE_ADMISSION_NATIVE_SURFACES = [
  'finance-pipeline',
  'crypto-execution-admission',
  'proof-surface',
  'release-layer',
  'custom',
] as const;
export type ConsequenceAdmissionNativeSurface =
  typeof CONSEQUENCE_ADMISSION_NATIVE_SURFACES[number];

export const CONSEQUENCE_ADMISSION_PROOF_KINDS = [
  'release-token',
  'release-evidence-pack',
  'certificate',
  'verification-kit',
  'admission-plan',
  'admission-receipt',
  'conformance-fixture',
  'local-artifact',
  'source-module',
  'external-reference',
] as const;
export type ConsequenceAdmissionProofKind =
  typeof CONSEQUENCE_ADMISSION_PROOF_KINDS[number];

export type ConsequenceAdmissionConsequenceKind =
  ConsequenceAdmissionKnownConsequenceKind;

export const CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS =
  CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS;

const CONSEQUENCE_ADMISSION_RISK_CLASSES = Object.freeze([
  ...RISK_CLASSES,
  'custom',
] as const);

export interface ConsequenceAdmissionEntryPoint {
  readonly kind: ConsequenceAdmissionEntryPointKind;
  readonly id: string;
  readonly route: string | null;
  readonly packageSubpath: string | null;
  readonly sourceRef: string | null;
}

export interface ConsequenceAdmissionProposedConsequence {
  readonly actor: string;
  readonly action: string;
  readonly downstreamSystem: string;
  readonly consequenceKind: ConsequenceAdmissionConsequenceKind;
  readonly riskClass: RiskClass | 'custom';
  readonly summary: string;
}

export interface ConsequenceAdmissionPolicyScope {
  readonly policyRef: string | null;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly dimensions: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ConsequenceAdmissionAuthority {
  readonly actorRef: string | null;
  readonly reviewerRef: string | null;
  readonly signerRef: string | null;
  readonly delegationRef: string | null;
  readonly authorityMode: string | null;
}

export interface ConsequenceAdmissionEvidenceRef {
  readonly id: string;
  readonly kind: string;
  readonly digest: string | null;
  readonly uri: string | null;
}

export interface ConsequenceAdmissionRequest {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly requestId: string;
  readonly requestedAt: string;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly entryPoint: ConsequenceAdmissionEntryPoint;
  readonly proposedConsequence: ConsequenceAdmissionProposedConsequence;
  readonly policyScope: ConsequenceAdmissionPolicyScope;
  readonly authority: ConsequenceAdmissionAuthority;
  readonly evidence: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs: readonly string[];
}

export interface ConsequenceAdmissionCheck {
  readonly kind: ConsequenceAdmissionCheckKind;
  readonly label: string;
  readonly outcome: ConsequenceAdmissionCheckOutcome;
  readonly required: boolean;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface ConsequenceAdmissionNativeDecision {
  readonly surface: ConsequenceAdmissionNativeSurface;
  readonly value: string;
  readonly mappedDecision: ConsequenceAdmissionDecision;
  readonly mappingReason: string;
}

export interface ConsequenceAdmissionConstraint {
  readonly id: string;
  readonly summary: string;
  readonly enforcedBy: string;
}

export interface ConsequenceAdmissionProofRef {
  readonly kind: ConsequenceAdmissionProofKind;
  readonly id: string;
  readonly digest: string | null;
  readonly uri: string | null;
  readonly verifyHint: string;
}

export interface ConsequenceAdmissionResponse {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly admissionId: string;
  readonly decidedAt: string;
  readonly request: ConsequenceAdmissionRequest;
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reason: string;
  readonly reasonCodes: readonly string[];
  readonly checks: readonly ConsequenceAdmissionCheck[];
  readonly constraints: readonly ConsequenceAdmissionConstraint[];
  readonly nativeDecision: ConsequenceAdmissionNativeDecision | null;
  readonly proof: readonly ConsequenceAdmissionProofRef[];
  readonly operationalContext: Readonly<Record<string, string | number | boolean | null>>;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdmissionProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string | null;
  readonly decision: 'block';
  readonly failClosed: true;
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceAdmissionDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_CONTRACT_VERSION;
  readonly decisions: typeof CONSEQUENCE_ADMISSION_DECISIONS;
  readonly packFamilies: typeof CONSEQUENCE_ADMISSION_PACK_FAMILIES;
  readonly consequenceKinds: typeof CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS;
  readonly riskClasses: typeof CONSEQUENCE_ADMISSION_RISK_CLASSES;
  readonly entryPointKinds: typeof CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS;
  readonly checkKinds: typeof CONSEQUENCE_ADMISSION_CHECK_KINDS;
  readonly checkOutcomes: typeof CONSEQUENCE_ADMISSION_CHECK_OUTCOMES;
  readonly proofKinds: typeof CONSEQUENCE_ADMISSION_PROOF_KINDS;
  readonly nativeSurfaces: typeof CONSEQUENCE_ADMISSION_NATIVE_SURFACES;
  readonly consequenceDomains: typeof CONSEQUENCE_ADMISSION_DOMAINS;
  readonly controlRequirements: typeof CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS;
  readonly taxonomy: typeof CONSEQUENCE_ADMISSION_TAXONOMY;
}

export interface CreateConsequenceAdmissionRequestInput {
  readonly requestedAt: string;
  readonly requestId?: string | null;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly entryPoint: ConsequenceAdmissionEntryPoint;
  readonly proposedConsequence: ConsequenceAdmissionProposedConsequence;
  readonly policyScope?: Partial<ConsequenceAdmissionPolicyScope> | null;
  readonly authority?: Partial<ConsequenceAdmissionAuthority> | null;
  readonly evidence?: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs?: readonly string[];
}

export interface CreateConsequenceAdmissionResponseInput {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reason: string;
  readonly reasonCodes?: readonly string[];
  readonly checks?: readonly ConsequenceAdmissionCheck[];
  readonly constraints?: readonly ConsequenceAdmissionConstraint[];
  readonly nativeDecision?: ConsequenceAdmissionNativeDecision | null;
  readonly proof?: readonly ConsequenceAdmissionProofRef[];
  readonly operationalContext?: Readonly<Record<string, string | number | boolean | null>>;
  readonly failClosed?: boolean | null;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty value.`);
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

function normalizeEnumValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string,
): T {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(
      `Consequence admission ${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return normalized as T;
}

function normalizeEvidenceRef(
  input: ConsequenceAdmissionEvidenceRef,
): ConsequenceAdmissionEvidenceRef {
  return Object.freeze({
    id: normalizeIdentifier(input.id, 'evidence.id'),
    kind: normalizeIdentifier(input.kind, 'evidence.kind'),
    digest: normalizeOptionalIdentifier(input.digest, 'evidence.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'evidence.uri'),
  });
}

function normalizeProofRef(input: ConsequenceAdmissionProofRef): ConsequenceAdmissionProofRef {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_PROOF_KINDS, 'proof.kind'),
    id: normalizeIdentifier(input.id, 'proof.id'),
    digest: normalizeOptionalIdentifier(input.digest, 'proof.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'proof.uri'),
    verifyHint: normalizeIdentifier(input.verifyHint, 'proof.verifyHint'),
  });
}

function normalizeNativeDecision(
  input: ConsequenceAdmissionNativeDecision | null | undefined,
): ConsequenceAdmissionNativeDecision | null {
  if (!input) return null;
  return Object.freeze({
    surface: normalizeEnumValue(
      input.surface,
      CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
      'nativeDecision.surface',
    ),
    value: normalizeIdentifier(input.value, 'nativeDecision.value'),
    mappedDecision: normalizeEnumValue(
      input.mappedDecision,
      CONSEQUENCE_ADMISSION_DECISIONS,
      'nativeDecision.mappedDecision',
    ),
    mappingReason: normalizeIdentifier(input.mappingReason, 'nativeDecision.mappingReason'),
  });
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Consequence admission ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function requestIdFor(input: Omit<ConsequenceAdmissionRequest, 'requestId'>): string {
  return canonicalObject({
    version: input.version,
    requestedAt: input.requestedAt,
    packFamily: input.packFamily,
    entryPoint: input.entryPoint,
    proposedConsequence: input.proposedConsequence,
    policyScope: input.policyScope,
    authority: input.authority,
    evidence: input.evidence,
    nativeInputRefs: input.nativeInputRefs,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

function admissionIdFor(input: {
  readonly decidedAt: string;
  readonly requestId: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reasonCodes: readonly string[];
  readonly proofDigests: readonly string[];
}): string {
  return canonicalObject({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    decidedAt: input.decidedAt,
    requestId: input.requestId,
    decision: input.decision,
    reasonCodes: input.reasonCodes,
    proofDigests: input.proofDigests,
  }).digest;
}

function readonlyCopy<T>(items: readonly T[] | null | undefined): readonly T[] {
  return Object.freeze([...(items ?? [])]);
}

export function isConsequenceAdmissionDecision(
  value: string,
): value is ConsequenceAdmissionDecision {
  return CONSEQUENCE_ADMISSION_DECISIONS.includes(
    value as ConsequenceAdmissionDecision,
  );
}

export function consequenceAdmissionAllowsConsequence(
  decision: ConsequenceAdmissionDecision,
): boolean {
  return decision === 'admit' || decision === 'narrow';
}

export function mapFinancePipelineDecisionToAdmission(
  value: string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown finance decision values fail closed.';

  if (['pass', 'accepted', 'allow', 'allowed'].includes(normalized)) {
    mappedDecision = 'admit';
    mappingReason = 'Finance allow branch maps to canonical admit.';
  } else if (
    ['narrow', 'constrained', 'scope-reduced', 'limited'].includes(normalized)
  ) {
    mappedDecision = 'narrow';
    mappingReason = 'Finance constrained allow branch maps to canonical narrow.';
  } else if (
    ['hold', 'review', 'review-required', 'needs-review', 'pending-review'].includes(normalized)
  ) {
    mappedDecision = 'review';
    mappingReason = 'Finance hold/review branch maps to canonical review.';
  } else if (
    ['fail', 'block', 'blocked', 'deny', 'denied', 'expired', 'revoked'].includes(normalized)
  ) {
    mappedDecision = 'block';
    mappingReason = 'Finance denial or invalid release state maps to canonical block.';
  }

  return Object.freeze({
    surface: 'finance-pipeline',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function mapCryptoAdmissionOutcomeToAdmission(
  value: CryptoExecutionAdmissionOutcome | string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown crypto admission outcomes fail closed.';

  if (normalized === 'admit') {
    mappedDecision = 'admit';
    mappingReason = 'Crypto execution-admission admit maps to canonical admit.';
  } else if (normalized === 'needs-evidence') {
    mappedDecision = 'review';
    mappingReason = 'Crypto needs-evidence maps to canonical review.';
  } else if (normalized === 'deny') {
    mappedDecision = 'block';
    mappingReason = 'Crypto deny maps to canonical block.';
  }

  return Object.freeze({
    surface: 'crypto-execution-admission',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function createConsequenceAdmissionCheck(
  input: ConsequenceAdmissionCheck,
): ConsequenceAdmissionCheck {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_CHECK_KINDS, 'check.kind'),
    label: normalizeIdentifier(input.label, 'check.label'),
    outcome: normalizeEnumValue(
      input.outcome,
      CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
      'check.outcome',
    ),
    required: input.required,
    summary: normalizeIdentifier(input.summary, 'check.summary'),
    reasonCodes: readonlyCopy(input.reasonCodes),
    evidenceRefs: readonlyCopy(input.evidenceRefs),
  });
}

export function createConsequenceAdmissionRequest(
  input: CreateConsequenceAdmissionRequestInput,
): ConsequenceAdmissionRequest {
  const requestedAt = normalizeIsoTimestamp(input.requestedAt, 'requestedAt');
  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    requestedAt,
    packFamily: normalizeEnumValue(
      input.packFamily,
      CONSEQUENCE_ADMISSION_PACK_FAMILIES,
      'packFamily',
    ),
    entryPoint: Object.freeze({
      kind: normalizeEnumValue(
        input.entryPoint.kind,
        CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
        'entryPoint.kind',
      ),
      id: normalizeIdentifier(input.entryPoint.id, 'entryPoint.id'),
      route: normalizeOptionalIdentifier(input.entryPoint.route, 'entryPoint.route'),
      packageSubpath: normalizeOptionalIdentifier(
        input.entryPoint.packageSubpath,
        'entryPoint.packageSubpath',
      ),
      sourceRef: normalizeOptionalIdentifier(input.entryPoint.sourceRef, 'entryPoint.sourceRef'),
    }),
    proposedConsequence: Object.freeze({
      actor: normalizeIdentifier(input.proposedConsequence.actor, 'proposedConsequence.actor'),
      action: normalizeIdentifier(input.proposedConsequence.action, 'proposedConsequence.action'),
      downstreamSystem: normalizeIdentifier(
        input.proposedConsequence.downstreamSystem,
        'proposedConsequence.downstreamSystem',
      ),
      consequenceKind: normalizeEnumValue(
        input.proposedConsequence.consequenceKind,
        CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
        'proposedConsequence.consequenceKind',
      ),
      riskClass: normalizeEnumValue(
        input.proposedConsequence.riskClass,
        CONSEQUENCE_ADMISSION_RISK_CLASSES,
        'proposedConsequence.riskClass',
      ),
      summary: normalizeIdentifier(
        input.proposedConsequence.summary,
        'proposedConsequence.summary',
      ),
    }),
    policyScope: Object.freeze({
      policyRef: input.policyScope?.policyRef ?? null,
      tenantId: input.policyScope?.tenantId ?? null,
      environment: input.policyScope?.environment ?? null,
      dimensions: Object.freeze(input.policyScope?.dimensions ?? {}),
    }),
    authority: Object.freeze({
      actorRef: input.authority?.actorRef ?? null,
      reviewerRef: input.authority?.reviewerRef ?? null,
      signerRef: input.authority?.signerRef ?? null,
      delegationRef: input.authority?.delegationRef ?? null,
      authorityMode: input.authority?.authorityMode ?? null,
    }),
    evidence: Object.freeze((input.evidence ?? []).map(normalizeEvidenceRef)),
    nativeInputRefs: Object.freeze(
      (input.nativeInputRefs ?? []).map((entry) =>
        normalizeIdentifier(entry, 'nativeInputRefs[]'),
      ),
    ),
  } satisfies Omit<ConsequenceAdmissionRequest, 'requestId'>);

  return Object.freeze({
    ...base,
    requestId: normalizeOptionalIdentifier(input.requestId, 'requestId') ?? requestIdFor(base),
  });
}

export function createConsequenceAdmissionResponse(
  input: CreateConsequenceAdmissionResponseInput,
): ConsequenceAdmissionResponse {
  const decidedAt = normalizeIsoTimestamp(input.decidedAt, 'decidedAt');
  const decision = normalizeEnumValue(input.decision, CONSEQUENCE_ADMISSION_DECISIONS, 'decision');
  const reason = normalizeIdentifier(input.reason, 'reason');
  const reasonCodes = readonlyCopy(input.reasonCodes);
  const constraints = readonlyCopy(input.constraints);

  if (decision === 'narrow' && constraints.length === 0) {
    throw new Error(
      'Consequence admission narrow decisions require at least one explicit constraint.',
    );
  }

  const nativeDecision = normalizeNativeDecision(input.nativeDecision);
  if (nativeDecision && nativeDecision.mappedDecision !== decision) {
    throw new Error(
      'Consequence admission native decision mapping must match the canonical decision.',
    );
  }

  const checks = Object.freeze((input.checks ?? []).map(createConsequenceAdmissionCheck));
  const proof = Object.freeze((input.proof ?? []).map(normalizeProofRef));
  const decisionAllows = consequenceAdmissionAllowsConsequence(decision);
  const requiredChecksSatisfied = !checks.some(
    (check) => check.required && check.outcome === 'fail',
  );
  const proofSatisfied = !decisionAllows || proof.length > 0;
  const decisionFailClosed = decision === 'review' || decision === 'block';
  const requestedFailClosed = input.failClosed ?? false;
  const allowed =
    decisionAllows &&
    proofSatisfied &&
    requiredChecksSatisfied &&
    !requestedFailClosed &&
    !decisionFailClosed;
  const failClosed = decisionFailClosed || requestedFailClosed || (decisionAllows && !allowed);
  const admissionId = admissionIdFor({
    decidedAt,
    requestId: input.request.requestId,
    decision,
    reasonCodes,
    proofDigests: proof.map((entry) => entry.digest ?? entry.id),
  });
  const canonicalPayload = {
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    admissionId,
    decidedAt,
    request: input.request,
    decision,
    allowed,
    failClosed,
    reason,
    reasonCodes,
    checks,
    constraints,
    nativeDecision,
    proof,
    operationalContext: Object.freeze(input.operationalContext ?? {}),
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createConsequenceAdmissionProblem(input: {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string | null;
  readonly reasonCodes?: readonly string[];
}): ConsequenceAdmissionProblem {
  return Object.freeze({
    type: normalizeIdentifier(input.type, 'problem.type'),
    title: normalizeIdentifier(input.title, 'problem.title'),
    status: input.status,
    detail: normalizeIdentifier(input.detail, 'problem.detail'),
    instance: input.instance ?? null,
    decision: 'block',
    failClosed: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
  });
}

export function consequenceAdmissionDescriptor():
ConsequenceAdmissionDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    decisions: CONSEQUENCE_ADMISSION_DECISIONS,
    packFamilies: CONSEQUENCE_ADMISSION_PACK_FAMILIES,
    consequenceKinds: CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
    riskClasses: CONSEQUENCE_ADMISSION_RISK_CLASSES,
    entryPointKinds: CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
    checkKinds: CONSEQUENCE_ADMISSION_CHECK_KINDS,
    checkOutcomes: CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
    proofKinds: CONSEQUENCE_ADMISSION_PROOF_KINDS,
    nativeSurfaces: CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
    consequenceDomains: CONSEQUENCE_ADMISSION_DOMAINS,
    controlRequirements: CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS,
    taxonomy: CONSEQUENCE_ADMISSION_TAXONOMY,
  });
}

export * from './taxonomy.js';
export * from './downstream-enforcement-contract.js';
export * from './verifier-helper.js';
export * from './finance.js';
export * from './crypto.js';
export * from './facade.js';
export * from './customer-gate.js';
