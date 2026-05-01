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
  consequenceAdmissionDomainProfile,
  type ConsequenceAdmissionDomain,
  type ConsequenceAdmissionKnownConsequenceKind,
} from './taxonomy.js';
import {
  CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS,
  CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS,
} from './policy-limits.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS,
} from './presentation-binding.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS,
} from './presentation-replay-ledger.js';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES,
} from './downstream-execution-receipt.js';

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

export const GENERIC_ADMISSION_MODES = [
  'observe',
  'warn',
  'review',
  'enforce',
] as const;
export type GenericAdmissionMode =
  typeof GENERIC_ADMISSION_MODES[number];

export const GENERIC_ADMISSION_SHADOW_DECISIONS = [
  'would_admit',
  'would_narrow',
  'would_review',
  'would_block',
] as const;
export type GenericAdmissionShadowDecision =
  typeof GENERIC_ADMISSION_SHADOW_DECISIONS[number];

export const GENERIC_ADMISSION_DOWNSTREAM_POSTURES = [
  'observe-only',
  'warn-only',
  'hold-for-review',
  'enforce-decision',
] as const;
export type GenericAdmissionDownstreamPosture =
  typeof GENERIC_ADMISSION_DOWNSTREAM_POSTURES[number];

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
  readonly genericAdmissionModes: typeof GENERIC_ADMISSION_MODES;
  readonly genericAdmissionShadowDecisions: typeof GENERIC_ADMISSION_SHADOW_DECISIONS;
  readonly genericAdmissionDownstreamPostures: typeof GENERIC_ADMISSION_DOWNSTREAM_POSTURES;
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
  readonly policyLimitKinds: typeof CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS;
  readonly policyLimitBreachActions: typeof CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS;
  readonly presentationBindingFields: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS;
  readonly presentationReplayLedgerFailureReasons: typeof CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS;
  readonly downstreamExecutionStatuses: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES;
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

export type GenericAdmissionFeatureValue = string | number | boolean | null;

export interface GenericAdmissionAmount {
  readonly value: string | number;
  readonly currency: string | null;
  readonly asset: string | null;
  readonly chain: string | null;
}

export interface GenericAdmissionDataScope {
  readonly records: number | null;
  readonly classification: string | null;
  readonly fields: readonly string[];
}

export interface CreateGenericAdmissionInput {
  readonly mode: GenericAdmissionMode;
  readonly actor: string;
  readonly action: string;
  readonly domain: ConsequenceAdmissionDomain;
  readonly downstreamSystem: string;
  readonly requestedAt?: string | null;
  readonly decidedAt?: string | null;
  readonly requestId?: string | null;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly policyRef?: string | null;
  readonly actorRef?: string | null;
  readonly reviewerRef?: string | null;
  readonly signerRef?: string | null;
  readonly delegationRef?: string | null;
  readonly authorityMode?: string | null;
  readonly amount?: GenericAdmissionAmount | null;
  readonly recipient?: string | null;
  readonly dataScope?: GenericAdmissionDataScope | null;
  readonly evidenceRefs?: readonly string[];
  readonly nativeInputRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, GenericAdmissionFeatureValue>>;
  readonly summary?: string | null;
}

export interface GenericAdmissionModeEvaluation {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly effectiveDecision: ConsequenceAdmissionDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly reasonCodes: readonly string[];
}

export interface GenericAdmissionEnvelope {
  readonly mode: GenericAdmissionMode;
  readonly shadowDecision: GenericAdmissionShadowDecision;
  readonly downstreamPosture: GenericAdmissionDownstreamPosture;
  readonly enforcementActive: boolean;
  readonly admission: ConsequenceAdmissionResponse;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string {
  const value = record[fieldName];
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  return normalizeIdentifier(value, fieldName);
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = record[fieldName];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} must be a string when provided.`);
  }
  return normalizeOptionalIdentifier(value, fieldName);
}

function readOptionalTimestamp(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = readOptionalString(record, fieldName);
  return value === null ? null : normalizeIsoTimestamp(value, fieldName);
}

function normalizeStringArray(value: unknown, fieldName: string): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array when provided.`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (typeof entry !== 'string') {
        throw new Error(
          `Consequence admission ${fieldName}[${index}] must be a string.`,
        );
      }
      return normalizeIdentifier(entry, `${fieldName}[${index}]`);
    }),
  );
}

function normalizeGenericAmount(value: unknown): GenericAdmissionAmount | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission amount must be an object when provided.');
  }
  const rawAmount = value.value;
  if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
    throw new Error('Consequence admission amount.value must be a string or number.');
  }
  if (typeof rawAmount === 'number' && !Number.isFinite(rawAmount)) {
    throw new Error('Consequence admission amount.value must be finite.');
  }
  const amountValue =
    typeof rawAmount === 'string'
      ? normalizeIdentifier(rawAmount, 'amount.value')
      : rawAmount;

  return Object.freeze({
    value: amountValue,
    currency: readOptionalString(value, 'currency'),
    asset: readOptionalString(value, 'asset'),
    chain: readOptionalString(value, 'chain'),
  });
}

function normalizeGenericDataScope(value: unknown): GenericAdmissionDataScope | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission dataScope must be an object when provided.');
  }
  const rawRecords = value.records;
  if (
    rawRecords !== undefined &&
    rawRecords !== null &&
    (typeof rawRecords !== 'number' || !Number.isFinite(rawRecords) || rawRecords < 0)
  ) {
    throw new Error('Consequence admission dataScope.records must be a non-negative number.');
  }
  return Object.freeze({
    records: typeof rawRecords === 'number' ? rawRecords : null,
    classification: readOptionalString(value, 'classification'),
    fields: normalizeStringArray(value.fields, 'dataScope.fields'),
  });
}

function normalizeGenericObservedFeatures(
  value: unknown,
): Readonly<Record<string, GenericAdmissionFeatureValue>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatures must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionFeatureValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatures key');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'number' &&
      typeof entry !== 'boolean'
    ) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be scalar or null.`,
      );
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be finite.`,
      );
    }
    normalized[normalizedKey] = entry;
  }
  return Object.freeze(normalized);
}

function normalizeCreateGenericAdmissionInput(input: unknown): CreateGenericAdmissionInput {
  if (!isRecord(input)) {
    throw new Error('Consequence admission input must be a JSON object.');
  }
  const mode = normalizeEnumValue(
    readRequiredString(input, 'mode'),
    GENERIC_ADMISSION_MODES,
    'mode',
  );
  const domain = normalizeEnumValue(
    readRequiredString(input, 'domain'),
    CONSEQUENCE_ADMISSION_DOMAINS,
    'domain',
  );

  return Object.freeze({
    mode,
    actor: readRequiredString(input, 'actor'),
    action: readRequiredString(input, 'action'),
    domain,
    downstreamSystem: readRequiredString(input, 'downstreamSystem'),
    requestedAt: readOptionalTimestamp(input, 'requestedAt'),
    decidedAt: readOptionalTimestamp(input, 'decidedAt'),
    requestId: readOptionalString(input, 'requestId'),
    tenantId: readOptionalString(input, 'tenantId'),
    environment: readOptionalString(input, 'environment'),
    policyRef: readOptionalString(input, 'policyRef'),
    actorRef: readOptionalString(input, 'actorRef'),
    reviewerRef: readOptionalString(input, 'reviewerRef'),
    signerRef: readOptionalString(input, 'signerRef'),
    delegationRef: readOptionalString(input, 'delegationRef'),
    authorityMode: readOptionalString(input, 'authorityMode'),
    amount: normalizeGenericAmount(input.amount),
    recipient: readOptionalString(input, 'recipient'),
    dataScope: normalizeGenericDataScope(input.dataScope),
    evidenceRefs: normalizeStringArray(input.evidenceRefs, 'evidenceRefs'),
    nativeInputRefs: normalizeStringArray(input.nativeInputRefs, 'nativeInputRefs'),
    observedFeatures: normalizeGenericObservedFeatures(input.observedFeatures),
    summary: readOptionalString(input, 'summary'),
  });
}

function observedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return input.observedFeatures?.[key] === true;
}

function genericAdmissionReviewReasons(
  input: CreateGenericAdmissionInput,
): readonly string[] {
  const reasons: string[] = [];
  const profile = consequenceAdmissionDomainProfile(input.domain);

  if (!input.policyRef) reasons.push('policy-ref-missing');
  if ((input.evidenceRefs ?? []).length === 0) reasons.push('evidence-ref-missing');

  if (
    input.domain === 'money-movement' ||
    input.domain === 'programmable-money'
  ) {
    if (!input.amount) reasons.push('amount-scope-missing');
    if (!input.recipient) reasons.push('recipient-scope-missing');
  }

  if (input.domain === 'data-disclosure' && !input.dataScope) {
    reasons.push('data-scope-missing');
  }

  if (input.domain === 'authority-change' && !input.authorityMode) {
    reasons.push('authority-mode-missing');
  }

  if (
    profile.requiredChecks.includes('adapter-readiness') &&
    !observedFeatureTrue(input, 'adapterReady')
  ) {
    reasons.push('adapter-readiness-missing');
  }

  if (input.domain === 'custom') {
    reasons.push('custom-domain-review-required');
  }

  return Object.freeze(reasons);
}

function genericAdmissionShadowDecisionFor(
  input: CreateGenericAdmissionInput,
  reviewReasons: readonly string[],
): GenericAdmissionShadowDecision {
  if (
    observedFeatureTrue(input, 'policyBlocked') ||
    observedFeatureTrue(input, 'blocked') ||
    observedFeatureTrue(input, 'unsafe')
  ) {
    return 'would_block';
  }
  if (reviewReasons.length > 0) return 'would_review';
  if (observedFeatureTrue(input, 'narrowRequired')) return 'would_narrow';
  return 'would_admit';
}

function effectiveDecisionForGenericMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') {
    return shadowDecision === 'would_admit' ? 'admit' : 'review';
  }
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}

function downstreamPostureForGenericMode(
  mode: GenericAdmissionMode,
  effectiveDecision: ConsequenceAdmissionDecision,
): GenericAdmissionDownstreamPosture {
  if (mode === 'observe') return 'observe-only';
  if (mode === 'warn') return 'warn-only';
  if (effectiveDecision === 'review') return 'hold-for-review';
  return 'enforce-decision';
}

function genericReasonCodes(
  input: CreateGenericAdmissionInput,
  shadowDecision: GenericAdmissionShadowDecision,
  reviewReasons: readonly string[],
): readonly string[] {
  const reasons = [
    `mode-${input.mode}`,
    `shadow-${shadowDecision}`,
    ...reviewReasons,
  ];
  if (input.mode === 'observe' || input.mode === 'warn') {
    reasons.push('non-enforcing-mode');
  }
  if (observedFeatureTrue(input, 'policyBlocked')) reasons.push('policy-blocked');
  if (observedFeatureTrue(input, 'blocked')) reasons.push('feature-blocked');
  if (observedFeatureTrue(input, 'unsafe')) reasons.push('feature-unsafe');
  if (observedFeatureTrue(input, 'narrowRequired')) reasons.push('narrow-required');
  return Object.freeze([...new Set(reasons)]);
}

function createGenericAdmissionEvaluation(
  input: CreateGenericAdmissionInput,
): GenericAdmissionModeEvaluation {
  const reviewReasons = genericAdmissionReviewReasons(input);
  const shadowDecision = genericAdmissionShadowDecisionFor(input, reviewReasons);
  const effectiveDecision = effectiveDecisionForGenericMode(input.mode, shadowDecision);
  const downstreamPosture = downstreamPostureForGenericMode(input.mode, effectiveDecision);

  return Object.freeze({
    mode: input.mode,
    shadowDecision,
    effectiveDecision,
    downstreamPosture,
    enforcementActive: input.mode === 'review' || input.mode === 'enforce',
    reasonCodes: genericReasonCodes(input, shadowDecision, reviewReasons),
  });
}

function reasonCodesForCheck(
  kind: ConsequenceAdmissionCheckKind,
  reasonCodes: readonly string[],
): readonly string[] {
  const matches = reasonCodes.filter((reason) => {
    if (kind === 'policy') return reason.startsWith('policy-');
    if (kind === 'authority') return reason.startsWith('authority-');
    if (kind === 'evidence') return reason.startsWith('evidence-');
    if (kind === 'enforcement') return reason === 'non-enforcing-mode';
    if (kind === 'adapter-readiness') return reason.startsWith('adapter-');
    if (kind === 'freshness') return reason.startsWith('freshness-');
    return false;
  });
  return Object.freeze(matches);
}

function checkOutcomeForGenericMode(
  mode: GenericAdmissionMode,
  checkReasons: readonly string[],
): ConsequenceAdmissionCheckOutcome {
  if (checkReasons.length === 0) return 'pass';
  return mode === 'observe' || mode === 'warn' ? 'warn' : 'fail';
}

function createGenericAdmissionChecks(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionCheck[] {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  return Object.freeze(
    profile.requiredChecks.map((kind) => {
      const checkReasons = reasonCodesForCheck(kind, evaluation.reasonCodes);
      const outcome = checkOutcomeForGenericMode(input.mode, checkReasons);
      return createConsequenceAdmissionCheck({
        kind,
        label: `${kind} check`,
        outcome,
        required: input.mode === 'review' || input.mode === 'enforce',
        summary:
          outcome === 'pass'
            ? `${kind} closure is present for the proposed consequence.`
            : `${kind} closure is incomplete for the proposed consequence.`,
        reasonCodes: checkReasons,
        evidenceRefs: [...(input.evidenceRefs ?? [])],
      });
    }),
  );
}

function genericAdmissionReason(
  evaluation: GenericAdmissionModeEvaluation,
): string {
  if (evaluation.mode === 'observe') {
    return 'Observe mode recorded the shadow admission decision without blocking downstream execution.';
  }
  if (evaluation.mode === 'warn') {
    return 'Warn mode allowed the request while returning the shadow admission decision and warning checks.';
  }
  if (evaluation.effectiveDecision === 'review') {
    return 'The proposed consequence is held for review before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'block') {
    return 'The proposed consequence is blocked before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'narrow') {
    return 'The proposed consequence may proceed only through the returned constraints.';
  }
  return 'The proposed consequence passed the generic admission mode ladder.';
}

function genericAdmissionConstraints(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionConstraint[] {
  if (evaluation.effectiveDecision !== 'narrow') return Object.freeze([]);
  return Object.freeze([
    {
      id: `constraint:${input.domain}:generic-narrow`,
      summary: 'Proceed only with the customer-approved narrowed scope.',
      enforcedBy: input.downstreamSystem,
    },
  ]);
}

function genericAdmissionProof(
  request: ConsequenceAdmissionRequest,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionProofRef[] {
  if (evaluation.effectiveDecision !== 'admit' && evaluation.effectiveDecision !== 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      kind: 'admission-receipt',
      id: `generic-admission:${request.requestId}`,
      digest: request.requestId,
      uri: null,
      verifyHint:
        evaluation.mode === 'observe' || evaluation.mode === 'warn'
          ? 'Observe and warn modes are adoption modes; inspect shadowDecision before promoting to review or enforce.'
          : 'Verify the admission digest and downstream enforcement contract before execution.',
    },
  ]);
}

function genericAdmissionSummary(input: CreateGenericAdmissionInput): string {
  return input.summary ?? `${input.actor} proposes ${input.action} on ${input.downstreamSystem}.`;
}

function genericAdmissionDimensions(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({
    domain: input.domain,
    mode: input.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    hasAmount: input.amount !== null && input.amount !== undefined,
    hasRecipient: input.recipient !== null && input.recipient !== undefined,
    hasDataScope: input.dataScope !== null && input.dataScope !== undefined,
    adapterReady: observedFeatureTrue(input, 'adapterReady'),
  });
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

export function createGenericAdmissionEnvelope(input: unknown): GenericAdmissionEnvelope {
  const normalized = normalizeCreateGenericAdmissionInput(input);
  const evaluation = createGenericAdmissionEvaluation(normalized);
  const profile = consequenceAdmissionDomainProfile(normalized.domain);
  const requestedAt = normalized.requestedAt ?? new Date().toISOString();
  const decidedAt = normalized.decidedAt ?? requestedAt;
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    requestId: normalized.requestId,
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'generic-admission-api',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: normalized.actor,
      action: normalized.action,
      downstreamSystem: normalized.downstreamSystem,
      consequenceKind: profile.defaultConsequenceKinds[0] ?? 'custom',
      riskClass: profile.minimumRiskClass,
      summary: genericAdmissionSummary(normalized),
    },
    policyScope: {
      policyRef: normalized.policyRef,
      tenantId: normalized.tenantId,
      environment: normalized.environment,
      dimensions: genericAdmissionDimensions(normalized, evaluation),
    },
    authority: {
      actorRef: normalized.actorRef ?? normalized.actor,
      reviewerRef: normalized.reviewerRef,
      signerRef: normalized.signerRef,
      delegationRef: normalized.delegationRef,
      authorityMode: normalized.authorityMode,
    },
    evidence: (normalized.evidenceRefs ?? []).map((ref) => ({
      id: ref,
      kind: 'reference',
      digest: null,
      uri: null,
    })),
    nativeInputRefs: normalized.nativeInputRefs,
  });
  const response = createConsequenceAdmissionResponse({
    request,
    decidedAt,
    decision: evaluation.effectiveDecision,
    reason: genericAdmissionReason(evaluation),
    reasonCodes: evaluation.reasonCodes,
    checks: createGenericAdmissionChecks(normalized, evaluation),
    constraints: genericAdmissionConstraints(normalized, evaluation),
    proof: genericAdmissionProof(request, evaluation),
    operationalContext: {
      mode: evaluation.mode,
      shadowDecision: evaluation.shadowDecision,
      downstreamPosture: evaluation.downstreamPosture,
      enforcementActive: evaluation.enforcementActive,
      modeBlocksDownstream:
        evaluation.downstreamPosture === 'hold-for-review' ||
        evaluation.effectiveDecision === 'block',
      consequenceDomain: normalized.domain,
      taxonomyRiskClass: profile.minimumRiskClass,
      nonEnforcingMode: normalized.mode === 'observe' || normalized.mode === 'warn',
    },
  });

  return Object.freeze({
    mode: evaluation.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    enforcementActive: evaluation.enforcementActive,
    admission: response,
  });
}

export function consequenceAdmissionDescriptor():
ConsequenceAdmissionDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    decisions: CONSEQUENCE_ADMISSION_DECISIONS,
    genericAdmissionModes: GENERIC_ADMISSION_MODES,
    genericAdmissionShadowDecisions: GENERIC_ADMISSION_SHADOW_DECISIONS,
    genericAdmissionDownstreamPostures: GENERIC_ADMISSION_DOWNSTREAM_POSTURES,
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
    policyLimitKinds: CONSEQUENCE_ADMISSION_POLICY_LIMIT_KINDS,
    policyLimitBreachActions: CONSEQUENCE_ADMISSION_POLICY_LIMIT_BREACH_ACTIONS,
    presentationBindingFields: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS,
    presentationReplayLedgerFailureReasons: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_FAILURE_REASONS,
    downstreamExecutionStatuses: CONSEQUENCE_ADMISSION_DOWNSTREAM_EXECUTION_STATUSES,
  });
}

export * from './taxonomy.js';
export * from './policy-limits.js';
export * from './presentation-binding.js';
export * from './presentation-replay-ledger.js';
export * from './downstream-execution-receipt.js';
export * from './downstream-enforcement-contract.js';
export * from './verifier-helper.js';
export * from './shadow-events.js';
export * from './shadow-simulation.js';
export * from './money-movement-shadow.js';
export * from './shadow-summary.js';
export * from './finance.js';
export * from './crypto.js';
export * from './facade.js';
export * from './customer-gate.js';
