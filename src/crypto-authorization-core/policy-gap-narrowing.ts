import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS,
  type CryptoAuthorizationPolicyDimension,
} from './types.js';
import type {
  CryptoIntelligenceEvidenceRef,
  CryptoIntelligenceMissingEvidenceClass,
  CryptoIntelligenceRiskSignal,
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';

/**
 * Crypto policy-gap and safe-narrowing candidate generation.
 *
 * This turns Step 02 risk signals into operator-facing control work. It does
 * not activate policy, write a wallet rule, or reveal private policy limits.
 */

export const CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION =
  'attestor.crypto-policy-gap-narrowing.v1';

export const CRYPTO_POLICY_GAP_CLASSES = [
  'policy-dimension-missing',
  'policy-explicit-deny',
  'policy-implicit-deny',
  'policy-conflict',
  'policy-evidence-stale',
  'evidence-missing',
  'adapter-readiness-missing',
  'freshness-window-missing',
  'authority-review-required',
  'amount-boundary-unsafe',
  'counterparty-boundary-unsafe',
  'route-boundary-unsafe',
  'allowance-boundary-unsafe',
  'delegation-boundary-unsafe',
  'custody-control-missing',
  'payment-binding-missing',
  'solver-settlement-missing',
  'velocity-boundary-unsafe',
] as const;
export type CryptoPolicyGapClass = typeof CRYPTO_POLICY_GAP_CLASSES[number];

export const CRYPTO_NARROWING_CANDIDATE_KINDS = [
  'collect-evidence',
  'bind-policy-dimension',
  'lower-amount-band',
  'shorten-validity-window',
  'reduce-operation-count',
  'bind-counterparty-scope',
  'bind-route-commitment',
  'bind-revocation-path',
  'bind-custody-quorum',
  'bind-payment-proof',
  'bind-settlement-proof',
  'run-adapter-preflight',
  'route-to-review',
  'block-until-policy',
] as const;
export type CryptoNarrowingCandidateKind =
  typeof CRYPTO_NARROWING_CANDIDATE_KINDS[number];

export const CRYPTO_NARROWING_SCOPE_KINDS = [
  'amount',
  'validity-window',
  'operation-count',
  'counterparty',
  'route',
  'revocation',
  'custody',
  'payment',
  'settlement',
  'adapter-preflight',
  'review-only',
  'policy',
] as const;
export type CryptoNarrowingScopeKind =
  typeof CRYPTO_NARROWING_SCOPE_KINDS[number];

export const CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES = [
  'covered',
  'missing',
  'stale',
  'conflicting',
  'explicit-deny',
  'implicit-deny',
  'review-required',
] as const;
export type CryptoPolicyDimensionCoverageStatus =
  typeof CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES[number];

export const CRYPTO_POLICY_COVERAGE_SOURCE_KINDS = [
  'policy-rule',
  'scope-binding',
  'operator-risk-input',
  'adapter-readiness',
  'simulation',
  'external-review',
] as const;
export type CryptoPolicyCoverageSourceKind =
  typeof CRYPTO_POLICY_COVERAGE_SOURCE_KINDS[number];

export const CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION =
  'attestor.crypto-policy-intelligence-routing.v1';

export const CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS = [
  'admit-ready',
  'review-required',
  'block-missing-policy',
  'block-stale-policy',
  'block-policy-conflict',
  'block-implicit-deny',
  'block-explicit-deny',
] as const;
export type CryptoPolicyIntelligenceRouteKind =
  typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS[number];

export const CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS = [
  'admit-with-policy-evidence',
  'send-to-human-review',
  'bind-policy-dimension',
  'refresh-policy-evidence',
  'resolve-policy-conflict',
  'block-implicit-deny',
  'block-explicit-deny',
] as const;
export type CryptoPolicyIntelligenceOperatorAction =
  typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS[number];

export interface CryptoPolicyGap {
  readonly gapId: string;
  readonly gapClass: CryptoPolicyGapClass;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly modelSafeSummary: string;
  readonly blocksAdmission: boolean;
}

export interface CryptoNarrowingCandidate {
  readonly candidateId: string;
  readonly kind: CryptoNarrowingCandidateKind;
  readonly scopeKind: CryptoNarrowingScopeKind;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly sourceGapIds: readonly string[];
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly safeInstruction: string;
  readonly operatorAction: string;
  readonly modelFeedback: {
    readonly reasonCodes: readonly string[];
    readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
    readonly safeInstruction: string;
  };
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadRequired: false;
}

export interface CryptoPolicyDimensionCoverageInput {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly status: CryptoPolicyDimensionCoverageStatus;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef?: string | null;
  readonly evidenceRefs?: readonly CryptoIntelligenceEvidenceRef[] | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly observedAt?: string | null;
  readonly maxAgeSeconds?: number | null;
}

export interface CryptoPolicyDimensionCoverage {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly status: CryptoPolicyDimensionCoverageStatus;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef: string | null;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
  readonly reasonCodes: readonly string[];
  readonly observedAt: string | null;
  readonly maxAgeSeconds: number | null;
  readonly stale: boolean;
  readonly rawPolicyThresholdExposed: false;
}

export interface CreateCryptoPolicyCoverageProfileInput {
  readonly generatedAt: string;
  readonly scopeRef?: string | null;
  readonly entries: readonly CryptoPolicyDimensionCoverageInput[];
}

export interface CryptoPolicyCoverageProfile {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly entryCount: number;
  readonly coveredCount: number;
  readonly reviewCount: number;
  readonly blockCount: number;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly blockedPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly reasonCodes: readonly string[];
  readonly entries: readonly CryptoPolicyDimensionCoverage[];
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPolicyGapNarrowingAssessmentInput {
  readonly signalAssessment: CryptoIntelligenceRiskSignalAssessment;
  readonly generatedAt: string;
  readonly policyRef?: string | null;
  readonly operatorContextRef?: string | null;
  readonly allowedCandidateKinds?: readonly CryptoNarrowingCandidateKind[] | null;
  readonly policyCoverageProfile?: CryptoPolicyCoverageProfile | null;
}

export interface CryptoPolicyGapNarrowingAssessment {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly sourceSignalAssessmentDigest: string;
  readonly riskAssessmentDigest: string;
  readonly policyRef: string | null;
  readonly operatorContextRef: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly policyCoverageProfileDigest: string | null;
  readonly gapCount: number;
  readonly candidateCount: number;
  readonly blockedGapCount: number;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly gaps: readonly CryptoPolicyGap[];
  readonly candidates: readonly CryptoNarrowingCandidate[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateCryptoPolicyIntelligenceRoutingProfileInput {
  readonly coverageProfile: CryptoPolicyCoverageProfile;
  readonly policyGapAssessment?: CryptoPolicyGapNarrowingAssessment | null;
  readonly generatedAt?: string | null;
  readonly scopeRef?: string | null;
}

export interface CryptoPolicyIntelligenceRoutingEntry {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly coverageStatus: CryptoPolicyDimensionCoverageStatus;
  readonly routeKind: CryptoPolicyIntelligenceRouteKind;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly precedence: number;
  readonly sourceKind: CryptoPolicyCoverageSourceKind;
  readonly sourceRef: string | null;
  readonly operatorAction: CryptoPolicyIntelligenceOperatorAction;
  readonly modelSafeInstruction: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefCount: number;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
}

export interface CryptoPolicyIntelligenceRoutingBlocker {
  readonly dimension: CryptoAuthorizationPolicyDimension;
  readonly routeKind: CryptoPolicyIntelligenceRouteKind;
  readonly operatorAction: CryptoPolicyIntelligenceOperatorAction;
  readonly reasonCodes: readonly string[];
}

export interface CryptoPolicyIntelligenceRoutingProfile {
  readonly version: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly coverageProfileDigest: string;
  readonly policyGapAssessmentDigest: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly routeCounts: Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>>;
  readonly admitRouteCount: number;
  readonly reviewRouteCount: number;
  readonly blockRouteCount: number;
  readonly entries: readonly CryptoPolicyIntelligenceRoutingEntry[];
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly modelSafeSummary: string;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoPolicyGapNarrowingDescriptor {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly gapClasses: typeof CRYPTO_POLICY_GAP_CLASSES;
  readonly candidateKinds: typeof CRYPTO_NARROWING_CANDIDATE_KINDS;
  readonly scopeKinds: typeof CRYPTO_NARROWING_SCOPE_KINDS;
  readonly policyCoverageStatuses: typeof CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES;
  readonly policyCoverageSourceKinds: typeof CRYPTO_POLICY_COVERAGE_SOURCE_KINDS;
  readonly policyIntelligenceRoutingVersion:
    typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly policyIntelligenceRouteKinds: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS;
  readonly policyIntelligenceOperatorActions:
    typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS;
  readonly approvalRequired: true;
  readonly autoApply: false;
  readonly rawPolicyThresholdExposed: false;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
}

export interface CryptoPolicyIntelligenceRoutingDescriptor {
  readonly version: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION;
  readonly routeKinds: typeof CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS;
  readonly operatorActions: typeof CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS;
  readonly explicitDenyWins: true;
  readonly implicitDenyFailsClosed: true;
  readonly conflictResolutionRequired: true;
  readonly stalePolicyMustRefresh: true;
  readonly rawPolicyThresholdExposed: false;
  readonly rawPayloadStored: false;
}

const SEVERITY_RANK: Record<CryptoIntelligenceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const DISPOSITION_RANK: Record<CryptoIntelligenceSignalDisposition, number> = {
  admit: 0,
  review: 1,
  block: 2,
};

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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalRef(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, fieldName);
  if (/\s/.test(normalized)) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be a compact scoped reference.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function strongerSeverity(
  left: CryptoIntelligenceSignalSeverity,
  right: CryptoIntelligenceSignalSeverity,
): CryptoIntelligenceSignalSeverity {
  return SEVERITY_RANK[right] > SEVERITY_RANK[left] ? right : left;
}

function strongerDisposition(
  left: CryptoIntelligenceSignalDisposition,
  right: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalDisposition {
  return DISPOSITION_RANK[right] > DISPOSITION_RANK[left] ? right : left;
}

function safeEvidenceRefs(
  refs: readonly CryptoIntelligenceEvidenceRef[],
): readonly CryptoIntelligenceEvidenceRef[] {
  const output: CryptoIntelligenceEvidenceRef[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const value = normalizeIdentifier(ref.value, 'evidenceRef.value');
    if (ref.kind === 'digest' && !value.startsWith('sha256:')) {
      throw new Error('Crypto policy gap narrowing digest evidence refs must use sha256 digests.');
    }
    if ((ref.kind === 'reason-code' || ref.kind === 'scoped-ref') && /\s/.test(value)) {
      throw new Error('Crypto policy gap narrowing reason-code and scoped-ref evidence refs must be compact.');
    }
    const key = `${ref.kind}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(Object.freeze({ kind: ref.kind, value }));
    }
  }

  return Object.freeze(output);
}

function safeReasonCodes(codes: readonly string[] | null | undefined): readonly string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const code of codes ?? []) {
    const normalized = normalizeIdentifier(code, 'reasonCode');
    if (/\s/.test(normalized)) {
      throw new Error('Crypto policy gap narrowing reason codes must be compact.');
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      output.push(normalized);
    }
  }
  return Object.freeze(output.sort());
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Crypto policy gap narrowing ${fieldName} must be a positive integer.`);
  }
  return value;
}

function dispositionForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoIntelligenceSignalDisposition {
  switch (status) {
    case 'covered':
      return 'admit';
    case 'review-required':
      return 'review';
    case 'missing':
    case 'stale':
    case 'conflicting':
    case 'explicit-deny':
    case 'implicit-deny':
      return 'block';
  }
}

function shouldTreatCoverageAsStale(input: {
  readonly generatedAt: string;
  readonly observedAt: string | null;
  readonly maxAgeSeconds: number | null;
  readonly status: CryptoPolicyDimensionCoverageStatus;
}): boolean {
  if (
    input.observedAt === null ||
    input.maxAgeSeconds === null ||
    input.status === 'explicit-deny' ||
    input.status === 'implicit-deny'
  ) {
    return false;
  }
  const generatedAtMs = Date.parse(input.generatedAt);
  const observedAtMs = Date.parse(input.observedAt);
  if (observedAtMs > generatedAtMs) {
    throw new Error('Crypto policy gap narrowing policy coverage observedAt cannot be after generatedAt.');
  }
  return generatedAtMs - observedAtMs > input.maxAgeSeconds * 1000;
}

function coverageEntry(
  input: CryptoPolicyDimensionCoverageInput,
  generatedAt: string,
): CryptoPolicyDimensionCoverage {
  if (!CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS.includes(input.dimension)) {
    throw new Error(`Crypto policy gap narrowing does not support policy dimension ${input.dimension}.`);
  }
  if (!includesValue(CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES, input.status)) {
    throw new Error(`Crypto policy gap narrowing does not support coverage status ${input.status}.`);
  }
  if (!includesValue(CRYPTO_POLICY_COVERAGE_SOURCE_KINDS, input.sourceKind)) {
    throw new Error(`Crypto policy gap narrowing does not support coverage source kind ${input.sourceKind}.`);
  }

  const observedAt = input.observedAt
    ? normalizeIsoTimestamp(input.observedAt, 'policyCoverage.observedAt')
    : null;
  const maxAgeSeconds = normalizePositiveInteger(
    input.maxAgeSeconds,
    'policyCoverage.maxAgeSeconds',
  );
  const stale = shouldTreatCoverageAsStale({
    generatedAt,
    observedAt,
    maxAgeSeconds,
    status: input.status,
  });
  const status = stale ? 'stale' : input.status;
  const baseReasonCodes = [
    `policy-coverage-${status}`,
    `policy-dimension-${input.dimension}`,
    ...safeReasonCodes(input.reasonCodes),
  ];

  return Object.freeze({
    dimension: input.dimension,
    status,
    sourceKind: input.sourceKind,
    sourceRef: normalizeOptionalRef(input.sourceRef, 'policyCoverage.sourceRef'),
    disposition: dispositionForCoverageStatus(status),
    evidenceRefs: safeEvidenceRefs(input.evidenceRefs ?? []),
    reasonCodes: safeReasonCodes(baseReasonCodes),
    observedAt,
    maxAgeSeconds,
    stale,
    rawPolicyThresholdExposed: false,
  });
}

function coverageProfilePayload(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly entries: readonly CryptoPolicyDimensionCoverage[];
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly blockedPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly reasonCodes: readonly string[];
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    entries: input.entries as unknown as CanonicalReleaseJsonValue,
    recommendedDisposition: input.recommendedDisposition,
    missingPolicyDimensions: input.missingPolicyDimensions,
    blockedPolicyDimensions: input.blockedPolicyDimensions,
    reasonCodes: input.reasonCodes,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyCoverageProfile(
  input: CreateCryptoPolicyCoverageProfileInput,
): CryptoPolicyCoverageProfile {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeOptionalRef(input.scopeRef, 'scopeRef');
  const entries = Object.freeze(
    input.entries.map((entry) => coverageEntry(entry, generatedAt)),
  );
  const recommendedDisposition = entries.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => strongerDisposition(current, entry.disposition),
    'admit',
  );
  const missingPolicyDimensions = unique(
    entries
      .filter((entry) => entry.status === 'missing')
      .map((entry) => entry.dimension),
  );
  const blockedPolicyDimensions = unique(
    entries
      .filter((entry) => entry.disposition === 'block')
      .map((entry) => entry.dimension),
  );
  const reasonCodes = safeReasonCodes(entries.flatMap((entry) => entry.reasonCodes));
  const payload = coverageProfilePayload({
    generatedAt,
    scopeRef,
    entries,
    recommendedDisposition,
    missingPolicyDimensions,
    blockedPolicyDimensions,
    reasonCodes,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    scopeRef,
    entryCount: entries.length,
    coveredCount: entries.filter((entry) => entry.status === 'covered').length,
    reviewCount: entries.filter((entry) => entry.disposition === 'review').length,
    blockCount: entries.filter((entry) => entry.disposition === 'block').length,
    recommendedDisposition,
    missingPolicyDimensions,
    blockedPolicyDimensions,
    reasonCodes,
    entries,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function gapClassForSignal(signal: CryptoIntelligenceRiskSignal): CryptoPolicyGapClass {
  if (signal.missingEvidenceClasses.includes('adapter-preflight')) {
    return 'adapter-readiness-missing';
  }
  if (signal.missingEvidenceClasses.includes('freshness-window')) {
    return 'freshness-window-missing';
  }
  if (
    signal.missingEvidenceClasses.includes('delegation-authorization') ||
    signal.missingEvidenceClasses.includes('delegation-nonce')
  ) {
    return 'delegation-boundary-unsafe';
  }
  if (
    signal.missingEvidenceClasses.includes('custody-policy-decision') ||
    signal.missingEvidenceClasses.includes('custody-quorum')
  ) {
    return 'custody-control-missing';
  }
  if (
    signal.missingEvidenceClasses.includes('x402-payment-requirement') ||
    signal.missingEvidenceClasses.includes('x402-payment-signature') ||
    signal.missingEvidenceClasses.includes('x402-payment-response')
  ) {
    return 'payment-binding-missing';
  }
  if (signal.missingEvidenceClasses.includes('solver-settlement-preflight')) {
    return 'solver-settlement-missing';
  }
  if (signal.missingEvidenceClasses.includes('route-commitment')) {
    return 'route-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('revocation-path')) {
    return signal.category === 'delegation'
      ? 'delegation-boundary-unsafe'
      : 'allowance-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('counterparty')) {
    return 'counterparty-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('amount')) {
    return 'amount-boundary-unsafe';
  }
  if (signal.missingEvidenceClasses.includes('policy-dimension')) {
    return 'policy-dimension-missing';
  }

  if (signal.category === 'amount') return 'amount-boundary-unsafe';
  if (signal.category === 'counterparty') return 'counterparty-boundary-unsafe';
  if (signal.category === 'route') return 'route-boundary-unsafe';
  if (signal.category === 'allowance') return 'allowance-boundary-unsafe';
  if (signal.category === 'delegation') return 'delegation-boundary-unsafe';
  if (signal.category === 'custody') return 'custody-control-missing';
  if (signal.category === 'x402') return 'payment-binding-missing';
  if (signal.category === 'solver') return 'solver-settlement-missing';
  if (signal.category === 'freshness') return 'freshness-window-missing';
  if (signal.category === 'velocity') return 'velocity-boundary-unsafe';
  if (signal.disposition === 'review') return 'authority-review-required';

  return 'evidence-missing';
}

function summaryForGapClass(gapClass: CryptoPolicyGapClass): string {
  switch (gapClass) {
    case 'policy-dimension-missing':
      return 'Policy dimensions are missing; bind the required dimensions before enforcement.';
    case 'policy-explicit-deny':
      return 'Policy explicitly denies this consequence; block until customer-approved policy coverage changes.';
    case 'policy-implicit-deny':
      return 'Policy falls through implicit deny; block until an explicit allow policy matches the scoped consequence.';
    case 'policy-conflict':
      return 'Policy evidence is conflicting; resolve the customer-controlled policy conflict before enforcement.';
    case 'policy-evidence-stale':
      return 'Policy coverage evidence is stale; collect fresh digest-bound policy evidence before enforcement.';
    case 'evidence-missing':
      return 'Required evidence is missing; collect digest-bound evidence before execution.';
    case 'adapter-readiness-missing':
      return 'Adapter readiness is missing; run the required preflight before handoff.';
    case 'freshness-window-missing':
      return 'Freshness evidence is missing or stale; bind a valid freshness window.';
    case 'authority-review-required':
      return 'Review authority is required before this consequence can proceed.';
    case 'amount-boundary-unsafe':
      return 'Amount scope is unsafe or insufficiently bounded; narrow the amount band or hold for review.';
    case 'counterparty-boundary-unsafe':
      return 'Counterparty scope is unsafe or missing; bind an approved counterparty scope.';
    case 'route-boundary-unsafe':
      return 'Route scope is unsafe or missing; bind route, refund, and settlement evidence.';
    case 'allowance-boundary-unsafe':
      return 'Allowance scope is unsafe; bind spender, expiry, and revocation controls.';
    case 'delegation-boundary-unsafe':
      return 'Delegation scope is unsafe; bind authorization, nonce, delegate code, and revocation evidence.';
    case 'custody-control-missing':
      return 'Custody controls are missing; bind policy decision and quorum evidence.';
    case 'payment-binding-missing':
      return 'Payment binding is missing; bind x402 requirement, signature, and response evidence.';
    case 'solver-settlement-missing':
      return 'Solver settlement evidence is missing; bind route and settlement preflight evidence.';
    case 'velocity-boundary-unsafe':
      return 'Velocity scope is unsafe; reduce cadence or route the consequence to review.';
  }
}

function gapIdFor(input: {
  readonly sourceSignalAssessmentDigest: string;
  readonly gapClass: CryptoPolicyGapClass;
  readonly sourceSignalCodes: readonly string[];
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
}): string {
  return `crypto-policy-gap:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

interface MutableGap {
  gapClass: CryptoPolicyGapClass;
  severity: CryptoIntelligenceSignalSeverity;
  disposition: CryptoIntelligenceSignalDisposition;
  sourceSignalCodes: Set<string>;
  requiredPolicyDimensions: Set<CryptoAuthorizationPolicyDimension>;
  missingEvidenceClasses: Set<CryptoIntelligenceMissingEvidenceClass>;
  evidenceRefs: CryptoIntelligenceEvidenceRef[];
}

function mutableGapFromSignal(signal: CryptoIntelligenceRiskSignal): MutableGap {
  return {
    gapClass: gapClassForSignal(signal),
    severity: signal.severity,
    disposition: signal.disposition,
    sourceSignalCodes: new Set([signal.code]),
    requiredPolicyDimensions: new Set(signal.requiredPolicyDimensions),
    missingEvidenceClasses: new Set(signal.missingEvidenceClasses),
    evidenceRefs: [...safeEvidenceRefs(signal.evidenceRefs)],
  };
}

function gapKey(gap: MutableGap): string {
  return [
    gap.gapClass,
    [...gap.requiredPolicyDimensions].sort().join(','),
    [...gap.missingEvidenceClasses].sort().join(','),
  ].join('|');
}

function addSignalGap(
  gaps: Map<string, MutableGap>,
  signal: CryptoIntelligenceRiskSignal,
): void {
  const next = mutableGapFromSignal(signal);
  const key = gapKey(next);
  const current = gaps.get(key);
  if (!current) {
    gaps.set(key, next);
    return;
  }

  current.severity = strongerSeverity(current.severity, next.severity);
  current.disposition = strongerDisposition(current.disposition, next.disposition);
  current.sourceSignalCodes.add(signal.code);
  for (const dimension of signal.requiredPolicyDimensions) {
    current.requiredPolicyDimensions.add(dimension);
  }
  for (const evidenceClass of signal.missingEvidenceClasses) {
    current.missingEvidenceClasses.add(evidenceClass);
  }
  current.evidenceRefs.push(...safeEvidenceRefs(signal.evidenceRefs));
}

function freezeGap(
  sourceSignalAssessmentDigest: string,
  gap: MutableGap,
): CryptoPolicyGap {
  const sourceSignalCodes = unique([...gap.sourceSignalCodes]);
  const requiredPolicyDimensions = unique([...gap.requiredPolicyDimensions]);
  const missingEvidenceClasses = unique([...gap.missingEvidenceClasses]);
  const frozen = Object.freeze({
    gapId: gapIdFor({
      sourceSignalAssessmentDigest,
      gapClass: gap.gapClass,
      sourceSignalCodes,
      requiredPolicyDimensions,
      missingEvidenceClasses,
    }),
    gapClass: gap.gapClass,
    severity: gap.severity,
    disposition: gap.disposition,
    sourceSignalCodes,
    requiredPolicyDimensions,
    missingEvidenceClasses,
    evidenceRefs: safeEvidenceRefs(gap.evidenceRefs),
    modelSafeSummary: summaryForGapClass(gap.gapClass),
    blocksAdmission: gap.disposition === 'block',
  });

  return frozen;
}

function gapsFromSignals(
  sourceSignalAssessmentDigest: string,
  signals: readonly CryptoIntelligenceRiskSignal[],
): readonly CryptoPolicyGap[] {
  const gaps = new Map<string, MutableGap>();
  for (const signal of signals) {
    if (
      signal.disposition === 'admit' &&
      signal.missingEvidenceClasses.length === 0 &&
      signal.requiredPolicyDimensions.length === 0
    ) {
      continue;
    }
    addSignalGap(gaps, signal);
  }

  return Object.freeze(
    [...gaps.values()]
      .map((gap) => freezeGap(sourceSignalAssessmentDigest, gap))
      .sort((left, right) => {
        const dispositionDelta =
          DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
        if (dispositionDelta !== 0) return dispositionDelta;
        const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
        if (severityDelta !== 0) return severityDelta;
        return left.gapClass.localeCompare(right.gapClass);
      }),
  );
}

function gapClassForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoPolicyGapClass | null {
  switch (status) {
    case 'covered':
      return null;
    case 'missing':
      return 'policy-dimension-missing';
    case 'stale':
      return 'policy-evidence-stale';
    case 'conflicting':
      return 'policy-conflict';
    case 'explicit-deny':
      return 'policy-explicit-deny';
    case 'implicit-deny':
      return 'policy-implicit-deny';
    case 'review-required':
      return 'authority-review-required';
  }
}

function missingEvidenceForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): readonly CryptoIntelligenceMissingEvidenceClass[] {
  switch (status) {
    case 'missing':
      return Object.freeze(['policy-dimension'] as const);
    case 'stale':
      return Object.freeze(['freshness-window'] as const);
    case 'covered':
    case 'conflicting':
    case 'explicit-deny':
    case 'implicit-deny':
    case 'review-required':
      return Object.freeze([]);
  }
}

function gapFromCoverageEntry(
  profileDigest: string,
  entry: CryptoPolicyDimensionCoverage,
): CryptoPolicyGap | null {
  const gapClass = gapClassForCoverageStatus(entry.status);
  if (gapClass === null) return null;
  const sourceSignalCodes = safeReasonCodes(entry.reasonCodes);
  const missingEvidenceClasses = missingEvidenceForCoverageStatus(entry.status);
  const evidenceRefs = safeEvidenceRefs([
    ...entry.evidenceRefs,
    {
      kind: 'digest',
      value: profileDigest,
    },
  ]);

  return Object.freeze({
    gapId: gapIdFor({
      sourceSignalAssessmentDigest: profileDigest,
      gapClass,
      sourceSignalCodes,
      requiredPolicyDimensions: [entry.dimension],
      missingEvidenceClasses,
    }),
    gapClass,
    severity: entry.disposition === 'block' ? 'critical' : 'warning',
    disposition: entry.disposition,
    sourceSignalCodes,
    requiredPolicyDimensions: Object.freeze([entry.dimension]),
    missingEvidenceClasses,
    evidenceRefs,
    modelSafeSummary: summaryForGapClass(gapClass),
    blocksAdmission: entry.disposition === 'block',
  });
}

function gapsFromPolicyCoverageProfile(
  profile: CryptoPolicyCoverageProfile | null,
): readonly CryptoPolicyGap[] {
  if (profile === null) return Object.freeze([]);
  return Object.freeze(
    profile.entries
      .map((entry) => gapFromCoverageEntry(profile.digest, entry))
      .filter((entry): entry is CryptoPolicyGap => entry !== null),
  );
}

function sortGaps(gaps: readonly CryptoPolicyGap[]): readonly CryptoPolicyGap[] {
  return Object.freeze(
    [...gaps].sort((left, right) => {
      const dispositionDelta =
        DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
      if (dispositionDelta !== 0) return dispositionDelta;
      const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
      if (severityDelta !== 0) return severityDelta;
      return left.gapClass.localeCompare(right.gapClass);
    }),
  );
}

function candidateKindForGap(gap: CryptoPolicyGap): CryptoNarrowingCandidateKind {
  switch (gap.gapClass) {
    case 'policy-dimension-missing':
      return 'bind-policy-dimension';
    case 'policy-explicit-deny':
    case 'policy-implicit-deny':
    case 'policy-conflict':
      return 'block-until-policy';
    case 'policy-evidence-stale':
      return 'collect-evidence';
    case 'evidence-missing':
      return 'collect-evidence';
    case 'adapter-readiness-missing':
      return 'run-adapter-preflight';
    case 'freshness-window-missing':
      return 'shorten-validity-window';
    case 'authority-review-required':
      return 'route-to-review';
    case 'amount-boundary-unsafe':
      return 'lower-amount-band';
    case 'counterparty-boundary-unsafe':
      return 'bind-counterparty-scope';
    case 'route-boundary-unsafe':
      return 'bind-route-commitment';
    case 'allowance-boundary-unsafe':
      return gap.missingEvidenceClasses.includes('revocation-path')
        ? 'bind-revocation-path'
        : 'shorten-validity-window';
    case 'delegation-boundary-unsafe':
      return gap.missingEvidenceClasses.includes('revocation-path')
        ? 'bind-revocation-path'
        : 'collect-evidence';
    case 'custody-control-missing':
      return 'bind-custody-quorum';
    case 'payment-binding-missing':
      return 'bind-payment-proof';
    case 'solver-settlement-missing':
      return 'bind-settlement-proof';
    case 'velocity-boundary-unsafe':
      return 'reduce-operation-count';
  }
}

function scopeKindForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): CryptoNarrowingScopeKind {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'policy';
    case 'bind-policy-dimension':
      return 'policy';
    case 'lower-amount-band':
      return 'amount';
    case 'shorten-validity-window':
      return 'validity-window';
    case 'reduce-operation-count':
      return 'operation-count';
    case 'bind-counterparty-scope':
      return 'counterparty';
    case 'bind-route-commitment':
      return 'route';
    case 'bind-revocation-path':
      return 'revocation';
    case 'bind-custody-quorum':
      return 'custody';
    case 'bind-payment-proof':
      return 'payment';
    case 'bind-settlement-proof':
      return 'settlement';
    case 'run-adapter-preflight':
      return 'adapter-preflight';
    case 'route-to-review':
      return 'review-only';
    case 'block-until-policy':
      return 'policy';
  }
}

function safeInstructionForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): string {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'Collect the named evidence class by digest or scoped reference before retrying.';
    case 'bind-policy-dimension':
      return 'Bind the missing policy dimension through the customer-controlled policy workflow.';
    case 'lower-amount-band':
      return 'Retry only with a lower operator-approved amount band; do not infer the private limit.';
    case 'shorten-validity-window':
      return 'Retry only with a shorter operator-approved validity window and fresh evidence.';
    case 'reduce-operation-count':
      return 'Retry only with fewer operations or lower cadence, then route to review if still uncertain.';
    case 'bind-counterparty-scope':
      return 'Bind the counterparty to an approved scoped reference before retrying.';
    case 'bind-route-commitment':
      return 'Bind route, refund, and settlement commitments by digest before retrying.';
    case 'bind-revocation-path':
      return 'Bind revocation or reset evidence before any allowance or delegation execution.';
    case 'bind-custody-quorum':
      return 'Bind custody policy decision and quorum evidence before retrying.';
    case 'bind-payment-proof':
      return 'Bind payment requirement, signature, response, and idempotency evidence by digest.';
    case 'bind-settlement-proof':
      return 'Bind solver route and settlement preflight evidence by digest.';
    case 'run-adapter-preflight':
      return 'Run the required adapter preflight and attach only digest or reason-code evidence.';
    case 'route-to-review':
      return 'Route this consequence to human review; do not ask the model to search for a passing variant.';
    case 'block-until-policy':
      return 'Block this consequence until customer-approved policy coverage exists.';
  }
}

function operatorActionForCandidate(
  candidateKind: CryptoNarrowingCandidateKind,
): string {
  switch (candidateKind) {
    case 'collect-evidence':
      return 'collect-digest-bound-evidence';
    case 'bind-policy-dimension':
      return 'draft-or-activate-policy-dimension';
    case 'lower-amount-band':
      return 'approve-lower-amount-scope';
    case 'shorten-validity-window':
      return 'approve-shorter-validity-window';
    case 'reduce-operation-count':
      return 'approve-lower-cadence-or-batch-size';
    case 'bind-counterparty-scope':
      return 'approve-counterparty-scope';
    case 'bind-route-commitment':
      return 'approve-route-and-refund-scope';
    case 'bind-revocation-path':
      return 'approve-revocation-or-reset-path';
    case 'bind-custody-quorum':
      return 'approve-custody-policy-and-quorum';
    case 'bind-payment-proof':
      return 'approve-payment-evidence-binding';
    case 'bind-settlement-proof':
      return 'approve-settlement-evidence-binding';
    case 'run-adapter-preflight':
      return 'run-adapter-preflight';
    case 'route-to-review':
      return 'send-to-human-review';
    case 'block-until-policy':
      return 'block-until-policy-approved';
  }
}

function candidateIdFor(input: {
  readonly sourceSignalAssessmentDigest: string;
  readonly kind: CryptoNarrowingCandidateKind;
  readonly scopeKind: CryptoNarrowingScopeKind;
  readonly sourceGapIds: readonly string[];
  readonly sourceSignalCodes: readonly string[];
}): string {
  return `crypto-narrowing-candidate:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

function candidateFromGap(gap: CryptoPolicyGap): CryptoNarrowingCandidate {
  const kind = gap.gapClass === 'policy-dimension-missing' &&
    gap.disposition === 'block' &&
    gap.requiredPolicyDimensions.length > 0 &&
    gap.missingEvidenceClasses.length === 0
    ? 'block-until-policy'
    : candidateKindForGap(gap);
  const scopeKind = scopeKindForCandidate(kind);
  const safeInstruction = safeInstructionForCandidate(kind);
  const candidate = Object.freeze({
    candidateId: candidateIdFor({
      sourceSignalAssessmentDigest: gap.evidenceRefs[0]?.value ?? gap.gapId,
      kind,
      scopeKind,
      sourceGapIds: [gap.gapId],
      sourceSignalCodes: gap.sourceSignalCodes,
    }),
    kind,
    scopeKind,
    approvalRequired: true,
    autoApply: false,
    sourceGapIds: Object.freeze([gap.gapId]),
    sourceSignalCodes: gap.sourceSignalCodes,
    requiredPolicyDimensions: gap.requiredPolicyDimensions,
    missingEvidenceClasses: gap.missingEvidenceClasses,
    safeInstruction,
    operatorAction: operatorActionForCandidate(kind),
    modelFeedback: Object.freeze({
      reasonCodes: gap.sourceSignalCodes,
      missingEvidenceClasses: gap.missingEvidenceClasses,
      safeInstruction,
    }),
    evidenceRefs: gap.evidenceRefs,
    rawPolicyThresholdExposed: false,
    rawPayloadRequired: false,
  } satisfies CryptoNarrowingCandidate);

  return candidate;
}

function allowedCandidateSet(
  allowed: readonly CryptoNarrowingCandidateKind[] | null | undefined,
): Set<CryptoNarrowingCandidateKind> | null {
  if (allowed === undefined || allowed === null) return null;
  const output = new Set<CryptoNarrowingCandidateKind>();
  for (const candidateKind of allowed) {
    if (!includesValue(CRYPTO_NARROWING_CANDIDATE_KINDS, candidateKind)) {
      throw new Error(`Crypto policy gap narrowing does not support candidate kind ${candidateKind}.`);
    }
    output.add(candidateKind);
  }
  return output;
}

function candidatesFromGaps(
  gaps: readonly CryptoPolicyGap[],
  allowed: Set<CryptoNarrowingCandidateKind> | null,
): readonly CryptoNarrowingCandidate[] {
  const candidates = gaps
    .map(candidateFromGap)
    .filter((candidate) => allowed === null || allowed.has(candidate.kind));

  return Object.freeze(
    candidates.sort((left, right) => {
      const leftBlock = left.kind === 'block-until-policy' ? 1 : 0;
      const rightBlock = right.kind === 'block-until-policy' ? 1 : 0;
      if (leftBlock !== rightBlock) return rightBlock - leftBlock;
      return left.kind.localeCompare(right.kind);
    }),
  );
}

function overallDisposition(
  signalAssessment: CryptoIntelligenceRiskSignalAssessment,
  gaps: readonly CryptoPolicyGap[],
): CryptoIntelligenceSignalDisposition {
  return gaps.reduce(
    (current, gap) => strongerDisposition(current, gap.disposition),
    signalAssessment.recommendedDisposition,
  );
}

function assessmentPayload(input: {
  readonly version: typeof CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION;
  readonly generatedAt: string;
  readonly sourceSignalAssessmentDigest: string;
  readonly riskAssessmentDigest: string;
  readonly policyRef: string | null;
  readonly operatorContextRef: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly policyCoverageProfileDigest: string | null;
  readonly gaps: readonly CryptoPolicyGap[];
  readonly candidates: readonly CryptoNarrowingCandidate[];
}): CanonicalReleaseJsonValue {
  return {
    version: input.version,
    generatedAt: input.generatedAt,
    sourceSignalAssessmentDigest: input.sourceSignalAssessmentDigest,
    riskAssessmentDigest: input.riskAssessmentDigest,
    policyRef: input.policyRef,
    operatorContextRef: input.operatorContextRef,
    recommendedDisposition: input.recommendedDisposition,
    policyCoverageProfileDigest: input.policyCoverageProfileDigest,
    gaps: input.gaps as unknown as CanonicalReleaseJsonValue,
    candidates: input.candidates as unknown as CanonicalReleaseJsonValue,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyGapNarrowingAssessment(
  input: CreateCryptoPolicyGapNarrowingAssessmentInput,
): CryptoPolicyGapNarrowingAssessment {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const policyRef = normalizeOptionalRef(input.policyRef, 'policyRef');
  const operatorContextRef = normalizeOptionalRef(
    input.operatorContextRef,
    'operatorContextRef',
  );
  const policyCoverageProfile = input.policyCoverageProfile ?? null;
  const gaps = sortGaps([
    ...gapsFromSignals(
      input.signalAssessment.digest,
      input.signalAssessment.signals,
    ),
    ...gapsFromPolicyCoverageProfile(policyCoverageProfile),
  ]);
  const candidates = candidatesFromGaps(
    gaps,
    allowedCandidateSet(input.allowedCandidateKinds),
  );
  const recommendedDisposition = overallDisposition(input.signalAssessment, gaps);
  const payload = assessmentPayload({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    sourceSignalAssessmentDigest: input.signalAssessment.digest,
    riskAssessmentDigest: input.signalAssessment.riskAssessmentDigest,
    policyRef,
    operatorContextRef,
    recommendedDisposition,
    policyCoverageProfileDigest: policyCoverageProfile?.digest ?? null,
    gaps,
    candidates,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    generatedAt,
    sourceSignalAssessmentDigest: input.signalAssessment.digest,
    riskAssessmentDigest: input.signalAssessment.riskAssessmentDigest,
    policyRef,
    operatorContextRef,
    recommendedDisposition,
    policyCoverageProfileDigest: policyCoverageProfile?.digest ?? null,
    gapCount: gaps.length,
    candidateCount: candidates.length,
    blockedGapCount: gaps.filter((gap) => gap.blocksAdmission).length,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    gaps,
    candidates,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

const POLICY_INTELLIGENCE_ROUTE_PRECEDENCE: Readonly<
Record<CryptoPolicyIntelligenceRouteKind, number>
> = Object.freeze({
  'admit-ready': 0,
  'review-required': 10,
  'block-missing-policy': 20,
  'block-stale-policy': 30,
  'block-implicit-deny': 40,
  'block-policy-conflict': 50,
  'block-explicit-deny': 60,
});

function routeKindForCoverageStatus(
  status: CryptoPolicyDimensionCoverageStatus,
): CryptoPolicyIntelligenceRouteKind {
  switch (status) {
    case 'covered':
      return 'admit-ready';
    case 'review-required':
      return 'review-required';
    case 'missing':
      return 'block-missing-policy';
    case 'stale':
      return 'block-stale-policy';
    case 'conflicting':
      return 'block-policy-conflict';
    case 'implicit-deny':
      return 'block-implicit-deny';
    case 'explicit-deny':
      return 'block-explicit-deny';
  }
}

function operatorActionForRoute(
  routeKind: CryptoPolicyIntelligenceRouteKind,
): CryptoPolicyIntelligenceOperatorAction {
  switch (routeKind) {
    case 'admit-ready':
      return 'admit-with-policy-evidence';
    case 'review-required':
      return 'send-to-human-review';
    case 'block-missing-policy':
      return 'bind-policy-dimension';
    case 'block-stale-policy':
      return 'refresh-policy-evidence';
    case 'block-policy-conflict':
      return 'resolve-policy-conflict';
    case 'block-implicit-deny':
      return 'block-implicit-deny';
    case 'block-explicit-deny':
      return 'block-explicit-deny';
  }
}

function modelSafeInstructionForRoute(
  routeKind: CryptoPolicyIntelligenceRouteKind,
): string {
  switch (routeKind) {
    case 'admit-ready':
      return 'Proceed only with the bound policy evidence already represented by digest or scoped reference.';
    case 'review-required':
      return 'Route to human review; do not ask the model to infer a passing policy variant.';
    case 'block-missing-policy':
      return 'Block until a customer-controlled policy dimension is bound; do not infer private policy limits.';
    case 'block-stale-policy':
      return 'Block until policy evidence is refreshed by digest or scoped reference.';
    case 'block-policy-conflict':
      return 'Block until the conflicting policy sources are resolved by an operator-controlled workflow.';
    case 'block-implicit-deny':
      return 'Block because no sufficient allow path is bound; retry only after customer-approved policy coverage exists.';
    case 'block-explicit-deny':
      return 'Respect the explicit deny; do not search for a bypass or alternate passing variant.';
  }
}

function routeCounts(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>> {
  const counts = Object.fromEntries(
    CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS.map((routeKind) => [routeKind, 0]),
  ) as Record<CryptoPolicyIntelligenceRouteKind, number>;

  for (const entry of entries) {
    counts[entry.routeKind] += 1;
  }

  return Object.freeze(counts);
}

function routingEntryFromCoverage(
  entry: CryptoPolicyDimensionCoverage,
): CryptoPolicyIntelligenceRoutingEntry {
  const routeKind = routeKindForCoverageStatus(entry.status);
  return Object.freeze({
    dimension: entry.dimension,
    coverageStatus: entry.status,
    routeKind,
    disposition: entry.disposition,
    precedence: POLICY_INTELLIGENCE_ROUTE_PRECEDENCE[routeKind],
    sourceKind: entry.sourceKind,
    sourceRef: entry.sourceRef,
    operatorAction: operatorActionForRoute(routeKind),
    modelSafeInstruction: modelSafeInstructionForRoute(routeKind),
    reasonCodes: entry.reasonCodes,
    evidenceRefCount: entry.evidenceRefs.length,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  } satisfies CryptoPolicyIntelligenceRoutingEntry);
}

function dominantRoutingEntry(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): CryptoPolicyIntelligenceRoutingEntry | null {
  return [...entries].sort((left, right) => {
    const precedenceDelta = right.precedence - left.precedence;
    if (precedenceDelta !== 0) return precedenceDelta;
    return left.dimension.localeCompare(right.dimension);
  })[0] ?? null;
}

function routingBlockers(
  entries: readonly CryptoPolicyIntelligenceRoutingEntry[],
): readonly CryptoPolicyIntelligenceRoutingBlocker[] {
  return Object.freeze(
    entries
      .filter((entry) => entry.disposition === 'block')
      .sort((left, right) => {
        const precedenceDelta = right.precedence - left.precedence;
        if (precedenceDelta !== 0) return precedenceDelta;
        return left.dimension.localeCompare(right.dimension);
      })
      .slice(0, 5)
      .map((entry) =>
        Object.freeze({
          dimension: entry.dimension,
          routeKind: entry.routeKind,
          operatorAction: entry.operatorAction,
          reasonCodes: entry.reasonCodes,
        }),
      ),
  );
}

function routingModelSafeSummary(input: {
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
}): string {
  if (input.recommendedDisposition === 'block') {
    const blocker = input.topBlockers[0];
    const dimension = blocker ? ` dimension:${blocker.dimension}` : '';
    return `Policy intelligence blocks via ${input.dominantRouteKind}${dimension}; use ${operatorActionForRoute(input.dominantRouteKind)} before retry.`;
  }
  if (input.recommendedDisposition === 'review') {
    const dimensions = input.reviewDimensions.join(',') || 'policy';
    return `Policy intelligence routes to review for ${dimensions}; model feedback remains safe-only.`;
  }
  return 'Policy intelligence is admit-ready with digest-bound policy coverage.';
}

function routingProfilePayload(input: {
  readonly generatedAt: string;
  readonly scopeRef: string | null;
  readonly coverageProfileDigest: string;
  readonly policyGapAssessmentDigest: string | null;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly dominantRouteKind: CryptoPolicyIntelligenceRouteKind;
  readonly routeCounts: Readonly<Record<CryptoPolicyIntelligenceRouteKind, number>>;
  readonly entries: readonly CryptoPolicyIntelligenceRoutingEntry[];
  readonly topBlockers: readonly CryptoPolicyIntelligenceRoutingBlocker[];
  readonly reviewDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly modelSafeSummary: string;
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    generatedAt: input.generatedAt,
    scopeRef: input.scopeRef,
    coverageProfileDigest: input.coverageProfileDigest,
    policyGapAssessmentDigest: input.policyGapAssessmentDigest,
    recommendedDisposition: input.recommendedDisposition,
    dominantRouteKind: input.dominantRouteKind,
    routeCounts: input.routeCounts as unknown as CanonicalReleaseJsonValue,
    entries: input.entries as unknown as CanonicalReleaseJsonValue,
    topBlockers: input.topBlockers as unknown as CanonicalReleaseJsonValue,
    reviewDimensions: input.reviewDimensions,
    modelSafeSummary: input.modelSafeSummary,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  };
}

export function createCryptoPolicyIntelligenceRoutingProfile(
  input: CreateCryptoPolicyIntelligenceRoutingProfileInput,
): CryptoPolicyIntelligenceRoutingProfile {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? input.coverageProfile.generatedAt,
    'routingProfile.generatedAt',
  );
  const scopeRef = normalizeOptionalRef(
    input.scopeRef ?? input.coverageProfile.scopeRef,
    'routingProfile.scopeRef',
  );
  const policyGapAssessment = input.policyGapAssessment ?? null;
  if (
    policyGapAssessment !== null &&
    policyGapAssessment.policyCoverageProfileDigest !== input.coverageProfile.digest
  ) {
    throw new Error(
      'Crypto policy intelligence routing requires the policy gap assessment to bind the same coverage profile digest.',
    );
  }

  const entries = Object.freeze(
    input.coverageProfile.entries.map((entry) => routingEntryFromCoverage(entry)),
  );
  const counts = routeCounts(entries);
  const dominantEntry = dominantRoutingEntry(entries);
  const dominantRouteKind = dominantEntry?.routeKind ?? 'admit-ready';
  const recommendedDisposition = entries.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => strongerDisposition(current, entry.disposition),
    'admit',
  );
  const topBlockers = routingBlockers(entries);
  const reviewDimensions = unique(
    entries
      .filter((entry) => entry.disposition === 'review')
      .map((entry) => entry.dimension),
  );
  const modelSafeSummary = routingModelSafeSummary({
    recommendedDisposition,
    dominantRouteKind,
    topBlockers,
    reviewDimensions,
  });
  const payload = routingProfilePayload({
    generatedAt,
    scopeRef,
    coverageProfileDigest: input.coverageProfile.digest,
    policyGapAssessmentDigest: policyGapAssessment?.digest ?? null,
    recommendedDisposition,
    dominantRouteKind,
    routeCounts: counts,
    entries,
    topBlockers,
    reviewDimensions,
    modelSafeSummary,
  });
  const canonical = canonicalObject(payload);

  return Object.freeze({
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    generatedAt,
    scopeRef,
    coverageProfileDigest: input.coverageProfile.digest,
    policyGapAssessmentDigest: policyGapAssessment?.digest ?? null,
    recommendedDisposition,
    dominantRouteKind,
    routeCounts: counts,
    admitRouteCount: counts['admit-ready'],
    reviewRouteCount: counts['review-required'],
    blockRouteCount:
      counts['block-missing-policy'] +
      counts['block-stale-policy'] +
      counts['block-policy-conflict'] +
      counts['block-implicit-deny'] +
      counts['block-explicit-deny'],
    entries,
    topBlockers,
    reviewDimensions,
    modelSafeSummary,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoPolicyIntelligenceRoutingDescriptor():
CryptoPolicyIntelligenceRoutingDescriptor {
  return Object.freeze({
    version: CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    routeKinds: CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
    operatorActions: CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
    rawPolicyThresholdExposed: false,
    rawPayloadStored: false,
  });
}

export function cryptoPolicyGapNarrowingDescriptor():
CryptoPolicyGapNarrowingDescriptor {
  return Object.freeze({
    version: CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
    gapClasses: CRYPTO_POLICY_GAP_CLASSES,
    candidateKinds: CRYPTO_NARROWING_CANDIDATE_KINDS,
    scopeKinds: CRYPTO_NARROWING_SCOPE_KINDS,
    policyCoverageStatuses: CRYPTO_POLICY_DIMENSION_COVERAGE_STATUSES,
    policyCoverageSourceKinds: CRYPTO_POLICY_COVERAGE_SOURCE_KINDS,
    policyIntelligenceRoutingVersion:
      CRYPTO_POLICY_INTELLIGENCE_ROUTING_SPEC_VERSION,
    policyIntelligenceRouteKinds: CRYPTO_POLICY_INTELLIGENCE_ROUTE_KINDS,
    policyIntelligenceOperatorActions:
      CRYPTO_POLICY_INTELLIGENCE_OPERATOR_ACTIONS,
    approvalRequired: true,
    autoApply: false,
    rawPolicyThresholdExposed: false,
    explicitDenyWins: true,
    implicitDenyFailsClosed: true,
    conflictResolutionRequired: true,
    stalePolicyMustRefresh: true,
  });
}

export function cryptoPolicyGapNarrowingLabel(
  assessment: CryptoPolicyGapNarrowingAssessment,
): string {
  return [
    'crypto-policy-gap-narrowing',
    `disposition:${assessment.recommendedDisposition}`,
    `gaps:${assessment.gapCount}`,
    `candidates:${assessment.candidateCount}`,
  ].join(' / ');
}
