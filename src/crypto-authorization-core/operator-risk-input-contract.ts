import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  evaluateCryptoIntelligencePrivacyMinimizationArtifact,
} from './intelligence-privacy-minimization.js';
import type {
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import {
  CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS,
  CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS,
  CRYPTO_OPERATOR_RISK_INPUT_CLASSES,
  CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
  CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES,
  CRYPTO_OPERATOR_RISK_SCOPE_KINDS,
  CRYPTO_OPERATOR_RISK_SOURCE_KINDS,
  CRYPTO_OPERATOR_RISK_TIERS,
  type CreateCryptoOperatorRiskInputBundleInput,
  type CryptoOperatorRiskEvidenceRef,
  type CryptoOperatorRiskInput,
  type CryptoOperatorRiskInputBundle,
  type CryptoOperatorRiskInputClass,
  type CryptoOperatorRiskInputContractDescriptor,
  type CryptoOperatorRiskInputEntry,
  type CryptoOperatorRiskInputFreshness,
  type CryptoOperatorRiskInputProvenance,
  type CryptoOperatorRiskInputScope,
  type CryptoOperatorRiskInputStatus,
  type CryptoOperatorRiskMissingEvidenceClass,
  type CryptoOperatorRiskTier,
} from './operator-risk-input-contract-types.js';

export {
  CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS,
  CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS,
  CRYPTO_OPERATOR_RISK_INPUT_CLASSES,
  CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
  CRYPTO_OPERATOR_RISK_INPUT_STATUSES,
  CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES,
  CRYPTO_OPERATOR_RISK_SCOPE_KINDS,
  CRYPTO_OPERATOR_RISK_SOURCE_KINDS,
  CRYPTO_OPERATOR_RISK_TIERS,
} from './operator-risk-input-contract-types.js';
export type {
  CreateCryptoOperatorRiskInputBundleInput,
  CryptoOperatorRiskEvidenceRef,
  CryptoOperatorRiskEvidenceRefKind,
  CryptoOperatorRiskGovernanceRef,
  CryptoOperatorRiskInput,
  CryptoOperatorRiskInputBundle,
  CryptoOperatorRiskInputClass,
  CryptoOperatorRiskInputContractDescriptor,
  CryptoOperatorRiskInputEntry,
  CryptoOperatorRiskInputFreshness,
  CryptoOperatorRiskInputProvenance,
  CryptoOperatorRiskInputScope,
  CryptoOperatorRiskInputStatus,
  CryptoOperatorRiskMissingEvidenceClass,
  CryptoOperatorRiskScopeKind,
  CryptoOperatorRiskSourceKind,
  CryptoOperatorRiskTier,
} from './operator-risk-input-contract-types.js';

/**
 * Operator-supplied crypto risk input contract.
 *
 * This binds customer-owned or third-party risk evidence by provenance, scope,
 * freshness, and digest. It never turns Attestor into a sanctions, screening,
 * market-data, liquidity, route, bridge, or counterparty oracle.
 */

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_INPUT_AGE_SECONDS = 24 * 60 * 60;

const RISK_TIER_RANK: Record<CryptoOperatorRiskTier, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const STATUS_RANK: Record<CryptoOperatorRiskInputStatus, number> = {
  accepted: 0,
  'needs-evidence': 1,
  stale: 2,
  rejected: 3,
};

const CLASS_SCOPE_REQUIREMENTS: Record<
  CryptoOperatorRiskInputClass,
  readonly (keyof CryptoOperatorRiskInputScope)[]
> = {
  'sanctions-screening': ['counterpartyDigest', 'accountDigest'],
  'counterparty-screening': ['counterpartyDigest', 'accountDigest'],
  'counterparty-risk': ['counterpartyDigest', 'accountDigest'],
  'route-risk': ['routeDigest'],
  'liquidity-risk': ['routeDigest', 'assetDigest'],
  'bridge-risk': ['routeDigest', 'counterpartyDigest'],
  'custody-risk': ['accountDigest', 'counterpartyDigest'],
  'market-risk': ['assetDigest'],
  'fraud-risk': ['operationDigest', 'accountDigest', 'counterpartyDigest'],
};

function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(`Crypto operator risk input ${fieldName} requires a non-empty value.`);
  }
  if (/\s/u.test(normalized)) {
    throw new Error(`Crypto operator risk input ${fieldName} must be a compact reference.`);
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

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Crypto operator risk input ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const normalized = value.trim();
  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto operator risk input ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIsoTimestamp(value, fieldName);
}

function normalizePositiveSeconds(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Crypto operator risk input ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeEvidenceRef(
  ref: CryptoOperatorRiskEvidenceRef,
  index: number,
): CryptoOperatorRiskEvidenceRef {
  if (!includesValue(CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS, ref.kind)) {
    throw new Error(`Crypto operator risk input evidenceRefs[${index}].kind is unsupported.`);
  }
  const value =
    ref.kind === 'digest'
      ? normalizeDigest(ref.value, `evidenceRefs[${index}].value`)
      : normalizeIdentifier(ref.value, `evidenceRefs[${index}].value`);
  return Object.freeze({ kind: ref.kind, value });
}

function normalizeEvidenceRefs(
  refs: readonly CryptoOperatorRiskEvidenceRef[],
): readonly CryptoOperatorRiskEvidenceRef[] {
  return Object.freeze(refs.map(normalizeEvidenceRef));
}

function normalizeSource(
  source: CryptoOperatorRiskInputProvenance,
): CryptoOperatorRiskInputProvenance {
  if (!includesValue(CRYPTO_OPERATOR_RISK_SOURCE_KINDS, source.sourceKind)) {
    throw new Error(`Crypto operator risk input sourceKind is unsupported: ${source.sourceKind}.`);
  }
  return Object.freeze({
    sourceKind: source.sourceKind,
    providerRef: normalizeIdentifier(source.providerRef, 'source.providerRef'),
    datasetRef: normalizeIdentifier(source.datasetRef, 'source.datasetRef'),
    datasetVersionRef: normalizeIdentifier(
      source.datasetVersionRef,
      'source.datasetVersionRef',
    ),
    methodRef: normalizeIdentifier(source.methodRef, 'source.methodRef'),
    retrievedAt: normalizeIsoTimestamp(source.retrievedAt, 'source.retrievedAt'),
    evidenceDigest: normalizeDigest(source.evidenceDigest, 'source.evidenceDigest'),
    providerRunDigest: normalizeOptionalDigest(
      source.providerRunDigest,
      'source.providerRunDigest',
    ),
  });
}

function normalizeFreshness(
  freshness: CryptoOperatorRiskInputFreshness,
): CryptoOperatorRiskInputFreshness {
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(freshness.observedAt, 'freshness.observedAt'),
    expiresAt: normalizeOptionalIsoTimestamp(freshness.expiresAt, 'freshness.expiresAt'),
    maxAgeSeconds: normalizePositiveSeconds(
      freshness.maxAgeSeconds,
      'freshness.maxAgeSeconds',
    ),
  });
}

function normalizeScope(scope: CryptoOperatorRiskInputScope): CryptoOperatorRiskInputScope {
  if (!includesValue(CRYPTO_OPERATOR_RISK_SCOPE_KINDS, scope.scopeKind)) {
    throw new Error(`Crypto operator risk input scopeKind is unsupported: ${scope.scopeKind}.`);
  }
  return Object.freeze({
    scopeKind: scope.scopeKind,
    consequenceKind: scope.consequenceKind ?? null,
    chainRef: normalizeOptionalIdentifier(scope.chainRef, 'scope.chainRef'),
    accountDigest: normalizeOptionalDigest(scope.accountDigest, 'scope.accountDigest'),
    assetDigest: normalizeOptionalDigest(scope.assetDigest, 'scope.assetDigest'),
    counterpartyDigest: normalizeOptionalDigest(
      scope.counterpartyDigest,
      'scope.counterpartyDigest',
    ),
    routeDigest: normalizeOptionalDigest(scope.routeDigest, 'scope.routeDigest'),
    operationDigest: normalizeOptionalDigest(scope.operationDigest, 'scope.operationDigest'),
    adapterKind: scope.adapterKind ?? null,
    policyRef: normalizeOptionalIdentifier(scope.policyRef, 'scope.policyRef'),
  });
}

function scopeDigest(scope: CryptoOperatorRiskInputScope): string {
  return canonicalObject(scope as unknown as CanonicalReleaseJsonValue).digest;
}

function pushFinding(
  reasonCodes: string[],
  missingEvidenceClasses: CryptoOperatorRiskMissingEvidenceClass[],
  reasonCode: string,
  missingEvidenceClass: CryptoOperatorRiskMissingEvidenceClass,
): void {
  reasonCodes.push(reasonCode);
  missingEvidenceClasses.push(missingEvidenceClass);
}

function classScopeIsBound(
  inputClass: CryptoOperatorRiskInputClass,
  scope: CryptoOperatorRiskInputScope,
): boolean {
  return CLASS_SCOPE_REQUIREMENTS[inputClass].some((fieldName) => {
    const value = scope[fieldName];
    return typeof value === 'string' && value.length > 0;
  });
}

function sourceHasDatasetVersion(
  inputClass: CryptoOperatorRiskInputClass,
  source: CryptoOperatorRiskInputProvenance,
): boolean {
  if (inputClass === 'sanctions-screening' || inputClass === 'counterparty-screening') {
    return source.datasetVersionRef.length > 0 && source.evidenceDigest.length > 0;
  }
  return true;
}

function statusFromReasonCodes(reasonCodes: readonly string[]): CryptoOperatorRiskInputStatus {
  if (
    reasonCodes.some((code) =>
      [
        'privacy-minimization-failed',
        'attestor-native-oracle-claim',
        'operator-risk-input-scope-missing',
        'operator-risk-input-provenance-missing',
      ].includes(code),
    )
  ) {
    return 'rejected';
  }
  if (
    reasonCodes.some((code) =>
      [
        'operator-risk-input-stale',
        'operator-risk-input-expired',
        'operator-risk-input-future-dated',
      ].includes(code),
    )
  ) {
    return 'stale';
  }
  if (reasonCodes.length > 0) return 'needs-evidence';
  return 'accepted';
}

function severityForRiskTier(riskTier: CryptoOperatorRiskTier): CryptoIntelligenceSignalSeverity {
  if (riskTier === 'critical') return 'critical';
  if (riskTier === 'high' || riskTier === 'medium' || riskTier === 'unknown') return 'warning';
  return 'info';
}

function dispositionForRiskTier(
  riskTier: CryptoOperatorRiskTier,
): CryptoIntelligenceSignalDisposition {
  if (riskTier === 'critical') return 'block';
  if (riskTier === 'high' || riskTier === 'medium' || riskTier === 'unknown') return 'review';
  return 'admit';
}

function dispositionForStatus(
  status: CryptoOperatorRiskInputStatus,
  riskTier: CryptoOperatorRiskTier,
): CryptoIntelligenceSignalDisposition {
  if (status === 'rejected' || status === 'stale') return 'block';
  if (status === 'needs-evidence') return 'review';
  return dispositionForRiskTier(riskTier);
}

function inputModelSafeSummary(input: {
  readonly status: CryptoOperatorRiskInputStatus;
  readonly inputClass: CryptoOperatorRiskInputClass;
  readonly riskTier: CryptoOperatorRiskTier;
}): string {
  if (input.status === 'accepted') {
    return `Operator-supplied ${input.inputClass} input is digest-bound with ${input.riskTier} risk tier.`;
  }
  if (input.status === 'stale') {
    return `Operator-supplied ${input.inputClass} input is stale or expired; collect fresh digest-bound evidence.`;
  }
  if (input.status === 'rejected') {
    return `Operator-supplied ${input.inputClass} input was rejected by the contract.`;
  }
  return `Operator-supplied ${input.inputClass} input needs additional digest-bound evidence.`;
}

function evaluateEntry(input: {
  readonly generatedAt: string;
  readonly maxInputAgeSeconds: number;
  readonly entry: CryptoOperatorRiskInput;
}): CryptoOperatorRiskInputEntry {
  const reasonCodes: string[] = [];
  const missingEvidenceClasses: CryptoOperatorRiskMissingEvidenceClass[] = [];
  const inputId = normalizeIdentifier(input.entry.inputId, 'inputId');
  if (!includesValue(CRYPTO_OPERATOR_RISK_INPUT_CLASSES, input.entry.inputClass)) {
    throw new Error(
      `Crypto operator risk input inputClass is unsupported: ${input.entry.inputClass}.`,
    );
  }
  if (!includesValue(CRYPTO_OPERATOR_RISK_TIERS, input.entry.riskTier)) {
    throw new Error(`Crypto operator risk input riskTier is unsupported: ${input.entry.riskTier}.`);
  }
  const source = normalizeSource(input.entry.source);
  const freshness = normalizeFreshness(input.entry.freshness);
  const scope = normalizeScope(input.entry.scope);
  const evidenceRefs = normalizeEvidenceRefs(input.entry.evidenceRefs);
  const generatedAtMs = new Date(input.generatedAt).getTime();
  const observedAtMs = new Date(freshness.observedAt).getTime();
  const expiresAtMs =
    freshness.expiresAt === undefined || freshness.expiresAt === null
      ? null
      : new Date(freshness.expiresAt).getTime();
  const maxAgeSeconds = freshness.maxAgeSeconds ?? input.maxInputAgeSeconds;
  const privacyEvaluation = evaluateCryptoIntelligencePrivacyMinimizationArtifact({
    surfaceKind: 'intelligence-proof-packet',
    artifact: input.entry,
    rawPayloadStored: input.entry.rawPayloadStored,
    rawProviderResponseStored: input.entry.rawProviderResponseStored,
    customerIdentifiersStored: input.entry.customerIdentifiersStored,
    privatePolicyThresholdsStored: input.entry.privatePolicyThresholdsStored,
    solverRouteSecretsStored: input.entry.solverRouteSecretsStored,
  });

  if (!privacyEvaluation.allowed) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'privacy-minimization-failed',
      'privacy-minimization',
    );
  }
  if (input.entry.claimsAttestorNativeOracle === true) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'attestor-native-oracle-claim',
      'oracle-claim-disclaimer',
    );
  }
  if (!sourceHasDatasetVersion(input.entry.inputClass, source)) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-dataset-version-missing',
      'dataset-version',
    );
  }
  if (!classScopeIsBound(input.entry.inputClass, scope)) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-scope-missing',
      'scope-binding',
    );
  }
  if (evidenceRefs.length === 0) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-evidence-ref-missing',
      'evidence-digest',
    );
  }
  if (!evidenceRefs.some((ref) => ref.kind === 'digest')) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-digest-ref-missing',
      'evidence-digest',
    );
  }
  if (observedAtMs > generatedAtMs + MAX_FUTURE_SKEW_MS) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-future-dated',
      'freshness-window',
    );
  }
  if (generatedAtMs - observedAtMs > maxAgeSeconds * 1000) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-stale',
      'freshness-window',
    );
  }
  if (expiresAtMs !== null && expiresAtMs <= generatedAtMs) {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-input-expired',
      'freshness-window',
    );
  }
  if (input.entry.riskTier === 'unknown') {
    pushFinding(
      reasonCodes,
      missingEvidenceClasses,
      'operator-risk-tier-unknown',
      'source-provenance',
    );
  }

  const uniqueReasonCodes = Object.freeze([...new Set(reasonCodes)].sort());
  const uniqueMissingEvidenceClasses = Object.freeze(
    [...new Set(missingEvidenceClasses)].sort(),
  );
  const status = statusFromReasonCodes(uniqueReasonCodes);
  const disposition = dispositionForStatus(status, input.entry.riskTier);

  return Object.freeze({
    inputId,
    inputClass: input.entry.inputClass,
    status,
    riskTier: input.entry.riskTier,
    severity: severityForRiskTier(input.entry.riskTier),
    disposition,
    sourceKind: source.sourceKind,
    scopeKind: scope.scopeKind,
    providerRef: source.providerRef,
    datasetRef: source.datasetRef,
    datasetVersionRef: source.datasetVersionRef,
    evidenceDigest: source.evidenceDigest,
    scopeDigest: scopeDigest(scope),
    evidenceRefs,
    reasonCodes: uniqueReasonCodes,
    missingEvidenceClasses: uniqueMissingEvidenceClasses,
    modelSafeSummary: inputModelSafeSummary({
      status,
      inputClass: input.entry.inputClass,
      riskTier: input.entry.riskTier,
    }),
  });
}

function strongestStatus(statuses: readonly CryptoOperatorRiskInputStatus[]):
CryptoOperatorRiskInputStatus {
  return statuses.reduce(
    (current, next) => (STATUS_RANK[next] > STATUS_RANK[current] ? next : current),
    'accepted',
  );
}

function highestRiskTier(entries: readonly CryptoOperatorRiskInputEntry[]):
CryptoOperatorRiskTier {
  return entries.reduce<CryptoOperatorRiskTier>(
    (current, entry) =>
      RISK_TIER_RANK[entry.riskTier] > RISK_TIER_RANK[current] ? entry.riskTier : current,
    'unknown',
  );
}

function strongestDisposition(
  entries: readonly CryptoOperatorRiskInputEntry[],
): CryptoIntelligenceSignalDisposition {
  if (entries.some((entry) => entry.disposition === 'block')) return 'block';
  if (entries.some((entry) => entry.disposition === 'review')) return 'review';
  return 'admit';
}

function safeInstructionForBundle(status: CryptoOperatorRiskInputStatus): string {
  if (status === 'accepted') {
    return 'Use the digest-bound operator risk inputs as scoped evidence only; do not treat them as Attestor-native screening coverage.';
  }
  if (status === 'stale') {
    return 'Collect fresh operator-owned or third-party evidence with provenance, scope, and digest before relying on the risk input.';
  }
  if (status === 'rejected') {
    return 'Reject the operator risk input and request a minimized, provenance-bound replacement.';
  }
  return 'Collect missing provenance, dataset version, scope, freshness, and digest evidence before using the operator risk input.';
}

export function cryptoOperatorRiskInputContractDescriptor():
CryptoOperatorRiskInputContractDescriptor {
  return Object.freeze({
    version: CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
    inputClasses: CRYPTO_OPERATOR_RISK_INPUT_CLASSES,
    sourceKinds: CRYPTO_OPERATOR_RISK_SOURCE_KINDS,
    scopeKinds: CRYPTO_OPERATOR_RISK_SCOPE_KINDS,
    riskTiers: CRYPTO_OPERATOR_RISK_TIERS,
    evidenceRefKinds: CRYPTO_OPERATOR_RISK_EVIDENCE_REF_KINDS,
    missingEvidenceClasses: CRYPTO_OPERATOR_RISK_MISSING_EVIDENCE_CLASSES,
    governanceRefs: CRYPTO_OPERATOR_RISK_GOVERNANCE_REFS,
    attestorNativeOracleClaim: false,
    autoApply: false,
    approvalRequired: true,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function createCryptoOperatorRiskInputBundle(
  input: CreateCryptoOperatorRiskInputBundleInput,
): CryptoOperatorRiskInputBundle {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeIdentifier(input.scopeRef, 'scopeRef');
  const maxInputAgeSeconds =
    normalizePositiveSeconds(input.maxInputAgeSeconds, 'maxInputAgeSeconds') ??
    DEFAULT_MAX_INPUT_AGE_SECONDS;
  const entries = Object.freeze(
    (input.inputs ?? []).map((entry) =>
      evaluateEntry({
        generatedAt,
        maxInputAgeSeconds,
        entry,
      }),
    ),
  );
  const noInputReasonCodes = entries.length === 0 ? ['operator-risk-input-missing'] : [];
  const noInputMissingEvidence: readonly CryptoOperatorRiskMissingEvidenceClass[] =
    entries.length === 0 ? ['source-provenance'] : [];
  const status =
    entries.length === 0 ? 'needs-evidence' : strongestStatus(entries.map((entry) => entry.status));
  const reasonCodes = Object.freeze(
    [
      ...new Set([
        ...noInputReasonCodes,
        ...entries.flatMap((entry) => entry.reasonCodes),
      ]),
    ].sort(),
  );
  const missingEvidenceClasses = Object.freeze(
    [
      ...new Set([
        ...noInputMissingEvidence,
        ...entries.flatMap((entry) => entry.missingEvidenceClasses),
      ]),
    ].sort() as CryptoOperatorRiskMissingEvidenceClass[],
  );
  const payload = {
    version: CRYPTO_OPERATOR_RISK_INPUT_CONTRACT_SPEC_VERSION,
    generatedAt,
    scopeRef,
    status,
    recommendedDisposition: entries.length === 0 ? 'review' : strongestDisposition(entries),
    inputCount: entries.length,
    acceptedCount: entries.filter((entry) => entry.status === 'accepted').length,
    needsEvidenceCount: entries.filter((entry) => entry.status === 'needs-evidence').length,
    staleCount: entries.filter((entry) => entry.status === 'stale').length,
    rejectedCount: entries.filter((entry) => entry.status === 'rejected').length,
    highestRiskTier: highestRiskTier(entries),
    operatorReviewRequired:
      status !== 'accepted' || entries.some((entry) => entry.disposition !== 'admit'),
    attestorNativeOracleClaim: false,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
    reasonCodes,
    missingEvidenceClasses,
    entries,
    modelSafeFeedback: {
      reasonCodes,
      missingEvidenceClasses,
      safeInstruction: safeInstructionForBundle(status),
    },
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoOperatorRiskInputBundleLabel(
  bundle: CryptoOperatorRiskInputBundle,
): string {
  return [
    'crypto-operator-risk-input',
    `status:${bundle.status}`,
    `inputs:${bundle.inputCount}`,
    `risk:${bundle.highestRiskTier}`,
    `disposition:${bundle.recommendedDisposition}`,
  ].join(' / ');
}
