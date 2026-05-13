import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_TOOL_RESULT_POISONING_GUARD_VERSION =
  'attestor.consequence-tool-result-poisoning-guard.v1';

export const CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES = [
  'untrusted-external',
  'model-generated',
  'customer-controlled',
  'provider-authoritative',
  'system-authoritative',
  'signed-attestation',
] as const;
export type ConsequenceToolResultSourceTrustClass =
  typeof CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES[number];

export const CONSEQUENCE_TOOL_RESULT_USE_KINDS = [
  'authority',
  'policy',
  'evidence',
  'instruction',
  'context',
  'review-summary',
] as const;
export type ConsequenceToolResultUseKind =
  typeof CONSEQUENCE_TOOL_RESULT_USE_KINDS[number];

export const CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES = [
  'payment-record',
  'identity-record',
  'policy-record',
  'approval-record',
  'ticket-record',
  'document-record',
  'telemetry-record',
  'security-state',
  'unknown',
] as const;
export type ConsequenceToolResultEvidenceClass =
  typeof CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES[number];

export const CONSEQUENCE_TOOL_RESULT_TOOL_KINDS = [
  'web-search',
  'file-search',
  'mcp-tool',
  'database-query',
  'provider-api',
  'browser',
  'email-parser',
  'ticketing-system',
  'custom',
] as const;
export type ConsequenceToolResultToolKind =
  typeof CONSEQUENCE_TOOL_RESULT_TOOL_KINDS[number];

export const CONSEQUENCE_TOOL_RESULT_RISK_LEVELS = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type ConsequenceToolResultRiskLevel =
  typeof CONSEQUENCE_TOOL_RESULT_RISK_LEVELS[number];

export const CONSEQUENCE_TOOL_RESULT_GUARD_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceToolResultGuardOutcome =
  typeof CONSEQUENCE_TOOL_RESULT_GUARD_OUTCOMES[number];

export const CONSEQUENCE_TOOL_RESULT_GUARD_REASON_CODES = [
  'tool-result-missing',
  'tool-result-source-missing',
  'tool-result-timestamp-missing',
  'tool-result-timestamp-invalid',
  'tool-result-integrity-missing',
  'tool-result-evidence-digest-missing',
  'tool-result-evidence-class-missing',
  'tool-result-evidence-class-not-allowed',
  'tool-result-untrusted-source',
  'tool-result-model-generated-source',
  'tool-result-customer-controlled-review',
  'tool-result-authority-or-instruction',
  'tool-result-high-risk-review',
  'tool-result-trusted-evidence-pass',
  'tool-result-review',
  'tool-result-block',
] as const;
export type ConsequenceToolResultGuardReasonCode =
  typeof CONSEQUENCE_TOOL_RESULT_GUARD_REASON_CODES[number];

export interface ConsequenceToolResultClaim {
  readonly toolResultRef: string;
  readonly toolKind: ConsequenceToolResultToolKind;
  readonly sourceTrustClass: ConsequenceToolResultSourceTrustClass;
  readonly resultUse: ConsequenceToolResultUseKind;
  readonly sourceRef?: string | null;
  readonly sourceTimestamp?: string | null;
  readonly integrityDigest?: string | null;
  readonly evidenceDigest?: string | null;
  readonly evidenceClass?: ConsequenceToolResultEvidenceClass | null;
  readonly allowedEvidenceClasses?: readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly signatureVerified?: boolean | null;
  readonly toolRisk?: ConsequenceToolResultRiskLevel | null;
}

export interface EvaluateConsequenceToolResultPoisoningInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly allowedEvidenceClasses?: readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly ConsequenceToolResultClaim[] | null;
}

export interface ConsequenceToolResultObservedClaim {
  readonly toolResultRefDigest: string;
  readonly toolKind: ConsequenceToolResultToolKind;
  readonly sourceTrustClass: ConsequenceToolResultSourceTrustClass;
  readonly resultUse: ConsequenceToolResultUseKind;
  readonly sourceRefDigest?: string;
  readonly sourceTimestamp?: string;
  readonly integrityDigest?: string;
  readonly evidenceDigest?: string;
  readonly evidenceClass?: ConsequenceToolResultEvidenceClass;
  readonly allowedEvidenceClasses: readonly ConsequenceToolResultEvidenceClass[];
  readonly signatureVerified: boolean;
  readonly toolRisk: ConsequenceToolResultRiskLevel;
  readonly outcome: ConsequenceToolResultGuardOutcome;
  readonly reasonCodes: readonly ConsequenceToolResultGuardReasonCode[];
}

export interface ConsequenceToolResultPoisoningDecision {
  readonly version: typeof CONSEQUENCE_TOOL_RESULT_POISONING_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly outcome: ConsequenceToolResultGuardOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceToolResultGuardReasonCode[];
  readonly failureModeId: 'tool-result-poisoning';
  readonly invariantIds: readonly [
    'trusted-evidence-required',
    'untrusted-content-cannot-authorize-action',
    'decision-context-version-must-be-bound',
  ];
  readonly protectedPrinciples: readonly [
    'proof integrity',
    'customer authority',
    'auditability',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly counts: {
    readonly toolResultCount: number;
    readonly trustedEvidenceCount: number;
    readonly reviewCount: number;
    readonly blockCount: number;
    readonly untrustedSourceCount: number;
    readonly modelGeneratedSourceCount: number;
    readonly missingIntegrityCount: number;
    readonly missingTimestampCount: number;
    readonly evidenceClassMismatchCount: number;
  };
  readonly observedResults: readonly ConsequenceToolResultObservedClaim[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceToolResultPoisoningGuardDescriptor {
  readonly version: typeof CONSEQUENCE_TOOL_RESULT_POISONING_GUARD_VERSION;
  readonly failureModeId: 'tool-result-poisoning';
  readonly sourceTrustClasses: typeof CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES;
  readonly resultUseKinds: typeof CONSEQUENCE_TOOL_RESULT_USE_KINDS;
  readonly evidenceClasses: typeof CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES;
  readonly toolKinds: typeof CONSEQUENCE_TOOL_RESULT_TOOL_KINDS;
  readonly outcomes: typeof CONSEQUENCE_TOOL_RESULT_GUARD_OUTCOMES;
  readonly requiresSource: true;
  readonly requiresTimestamp: true;
  readonly requiresIntegrityDigest: true;
  readonly requiresEvidenceDigest: true;
  readonly requiresAllowedEvidenceClass: true;
  readonly storesRawToolOutput: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const TRUSTED_SOURCE_CLASSES = new Set<ConsequenceToolResultSourceTrustClass>([
  'provider-authoritative',
  'system-authoritative',
  'signed-attestation',
]);

const UNTRUSTED_SOURCE_CLASSES = new Set<ConsequenceToolResultSourceTrustClass>([
  'untrusted-external',
  'model-generated',
]);

const UNSAFE_RESULT_USES = new Set<ConsequenceToolResultUseKind>([
  'authority',
  'instruction',
]);

const HIGH_RISK_LEVELS = new Set<ConsequenceToolResultRiskLevel>(['high', 'critical']);

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

function digestRawRef(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueReasonCodes(
  items: readonly ConsequenceToolResultGuardReasonCode[],
): readonly ConsequenceToolResultGuardReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

function isSha256Digest(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/iu.test(value);
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function binding(): ConsequenceFailureControlBinding {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find(
    (item) => item.failureModeId === 'tool-result-poisoning',
  );
  if (!found) {
    throw new Error('Missing control binding for tool-result-poisoning.');
  }
  return found;
}

function evaluateClaim(
  claim: ConsequenceToolResultClaim,
  inputAllowedEvidenceClasses: readonly ConsequenceToolResultEvidenceClass[],
): ConsequenceToolResultObservedClaim {
  const allowedEvidenceClasses = readonlyCopy(
    claim.allowedEvidenceClasses ?? inputAllowedEvidenceClasses,
  );
  const sourceTimestamp = normalizeTimestamp(claim.sourceTimestamp ?? null);
  const toolRisk = claim.toolRisk ?? 'medium';
  const reasonCodes: ConsequenceToolResultGuardReasonCode[] = [];
  const hasSource = typeof claim.sourceRef === 'string' && claim.sourceRef.trim().length > 0;
  const hasValidIntegrity = isSha256Digest(claim.integrityDigest);
  const hasValidEvidenceDigest = isSha256Digest(claim.evidenceDigest);
  const hasEvidenceClass = Boolean(claim.evidenceClass);
  const evidenceClassAllowed = Boolean(
    claim.evidenceClass && allowedEvidenceClasses.includes(claim.evidenceClass),
  );
  const unsafeSource = UNTRUSTED_SOURCE_CLASSES.has(claim.sourceTrustClass);
  const trustedSource = TRUSTED_SOURCE_CLASSES.has(claim.sourceTrustClass);
  const unsafeUse = UNSAFE_RESULT_USES.has(claim.resultUse);

  if (!hasSource) reasonCodes.push('tool-result-source-missing');
  if (!claim.sourceTimestamp) reasonCodes.push('tool-result-timestamp-missing');
  if (claim.sourceTimestamp && !sourceTimestamp) reasonCodes.push('tool-result-timestamp-invalid');
  if (!hasValidIntegrity) reasonCodes.push('tool-result-integrity-missing');
  if (!hasValidEvidenceDigest) reasonCodes.push('tool-result-evidence-digest-missing');
  if (!hasEvidenceClass) reasonCodes.push('tool-result-evidence-class-missing');
  if (hasEvidenceClass && !evidenceClassAllowed) {
    reasonCodes.push('tool-result-evidence-class-not-allowed');
  }
  if (claim.sourceTrustClass === 'untrusted-external') {
    reasonCodes.push('tool-result-untrusted-source');
  }
  if (claim.sourceTrustClass === 'model-generated') {
    reasonCodes.push('tool-result-model-generated-source');
  }
  if (claim.sourceTrustClass === 'customer-controlled') {
    reasonCodes.push('tool-result-customer-controlled-review');
  }
  if (unsafeUse) {
    reasonCodes.push('tool-result-authority-or-instruction');
  }
  if (HIGH_RISK_LEVELS.has(toolRisk) && claim.sourceTrustClass !== 'signed-attestation') {
    reasonCodes.push('tool-result-high-risk-review');
  }

  let outcome: ConsequenceToolResultGuardOutcome = 'pass';
  if (unsafeSource && unsafeUse) {
    outcome = 'block';
    reasonCodes.push('tool-result-block');
  } else if (
    reasonCodes.length > 0 ||
    !trustedSource ||
    !hasSource ||
    !sourceTimestamp ||
    !hasValidIntegrity ||
    !hasValidEvidenceDigest ||
    !evidenceClassAllowed
  ) {
    outcome = 'review';
    reasonCodes.push('tool-result-review');
  } else {
    reasonCodes.push('tool-result-trusted-evidence-pass');
  }

  const observed: ConsequenceToolResultObservedClaim = {
    toolResultRefDigest: digestRawRef(claim.toolResultRef),
    toolKind: claim.toolKind,
    sourceTrustClass: claim.sourceTrustClass,
    resultUse: claim.resultUse,
    ...(hasSource && claim.sourceRef ? { sourceRefDigest: digestRawRef(claim.sourceRef) } : {}),
    ...(sourceTimestamp ? { sourceTimestamp } : {}),
    ...(hasValidIntegrity ? { integrityDigest: claim.integrityDigest as string } : {}),
    ...(hasValidEvidenceDigest ? { evidenceDigest: claim.evidenceDigest as string } : {}),
    ...(claim.evidenceClass ? { evidenceClass: claim.evidenceClass } : {}),
    allowedEvidenceClasses,
    signatureVerified: claim.signatureVerified ?? false,
    toolRisk,
    outcome,
    reasonCodes: uniqueReasonCodes(reasonCodes),
  };
  return Object.freeze(observed);
}

function aggregateOutcome(
  results: readonly ConsequenceToolResultObservedClaim[],
): ConsequenceToolResultGuardOutcome {
  if (results.length === 0) return 'review';
  if (results.some((result) => result.outcome === 'block')) return 'block';
  if (results.some((result) => result.outcome === 'review')) return 'review';
  return 'pass';
}

export function evaluateConsequenceToolResultPoisoning(
  input: EvaluateConsequenceToolResultPoisoningInput,
): ConsequenceToolResultPoisoningDecision {
  const inputAllowedEvidenceClasses = readonlyCopy(input.allowedEvidenceClasses ?? []);
  const observedResults = readonlyCopy(
    (input.toolResults ?? []).map((claim) => evaluateClaim(claim, inputAllowedEvidenceClasses)),
  );
  const outcome = aggregateOutcome(observedResults);
  const resultReasonCodes = observedResults.flatMap((result) => result.reasonCodes);
  const reasonCodes = uniqueReasonCodes([
    ...(observedResults.length === 0 ? ['tool-result-missing' as const] : []),
    ...resultReasonCodes,
    ...(outcome === 'block'
      ? ['tool-result-block' as const]
      : outcome === 'review'
        ? ['tool-result-review' as const]
        : ['tool-result-trusted-evidence-pass' as const]),
  ]);
  const controlBinding = binding();
  const payload = {
    version: CONSEQUENCE_TOOL_RESULT_POISONING_GUARD_VERSION,
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes,
    failureModeId: 'tool-result-poisoning',
    invariantIds: [
      'trusted-evidence-required',
      'untrusted-content-cannot-authorize-action',
      'decision-context-version-must-be-bound',
    ] as const,
    protectedPrinciples: [
      'proof integrity',
      'customer authority',
      'auditability',
    ] as const,
    requiredControls: controlBinding.controlIds,
    requiredEvidence: controlBinding.requiredEvidence,
    requiredAuthoritySources: controlBinding.requiredAuthority,
    requiredAuditRecords: controlBinding.requiredAuditRecords,
    counts: {
      toolResultCount: observedResults.length,
      trustedEvidenceCount: observedResults.filter((result) => result.outcome === 'pass').length,
      reviewCount: observedResults.filter((result) => result.outcome === 'review').length,
      blockCount: observedResults.filter((result) => result.outcome === 'block').length,
      untrustedSourceCount: observedResults.filter(
        (result) => result.sourceTrustClass === 'untrusted-external',
      ).length,
      modelGeneratedSourceCount: observedResults.filter(
        (result) => result.sourceTrustClass === 'model-generated',
      ).length,
      missingIntegrityCount: observedResults.filter((result) =>
        result.reasonCodes.includes('tool-result-integrity-missing'),
      ).length,
      missingTimestampCount: observedResults.filter((result) =>
        result.reasonCodes.includes('tool-result-timestamp-missing') ||
        result.reasonCodes.includes('tool-result-timestamp-invalid'),
      ).length,
      evidenceClassMismatchCount: observedResults.filter((result) =>
        result.reasonCodes.includes('tool-result-evidence-class-not-allowed'),
      ).length,
    },
    observedResults,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'This guard classifies tool result trust and provenance. It does not prove every tool adapter emits source, timestamp, integrity, and evidence class metadata.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceToolResultPoisoningGuardDescriptor(): ConsequenceToolResultPoisoningGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_TOOL_RESULT_POISONING_GUARD_VERSION,
    failureModeId: 'tool-result-poisoning',
    sourceTrustClasses: CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
    resultUseKinds: CONSEQUENCE_TOOL_RESULT_USE_KINDS,
    evidenceClasses: CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
    toolKinds: CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
    outcomes: CONSEQUENCE_TOOL_RESULT_GUARD_OUTCOMES,
    requiresSource: true,
    requiresTimestamp: true,
    requiresIntegrityDigest: true,
    requiresEvidenceDigest: true,
    requiresAllowedEvidenceClass: true,
    storesRawToolOutput: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
