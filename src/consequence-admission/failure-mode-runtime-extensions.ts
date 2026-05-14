import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES,
  CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS,
  type ConsequenceFailureControlEnforcementPhase,
  type ConsequenceFailureControlInvariantId,
} from './failure-mode-control-bindings.js';
import {
  CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS,
  CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS,
  CONSEQUENCE_FAILURE_MODE_IDS,
  CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
  CONSEQUENCE_FAILURE_MODE_SEVERITIES,
  consequenceFailureModeRegistry,
  type ConsequenceFailureModeClassification,
  type ConsequenceFailureModeDefaultDecision,
  type ConsequenceFailureModeProtectedPrinciple,
  type ConsequenceFailureModeSeverity,
} from './failure-mode-registry.js';

export const CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION =
  'attestor.consequence-failure-mode-runtime-extension.v1';

export const CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_SCOPES = [
  'tenant',
  'workspace',
  'domain-pack',
  'customer-environment',
] as const;
export type ConsequenceFailureModeRuntimeExtensionScope =
  typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_SCOPES[number];

export const CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceFailureModeRuntimeExtensionOutcome =
  typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES[number];

export const CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES = [
  'runtime-extension-missing',
  'runtime-extension-id-missing',
  'runtime-extension-id-collides-with-core-registry',
  'runtime-extension-scope-missing',
  'runtime-extension-owner-authority-missing',
  'runtime-extension-approval-missing',
  'runtime-extension-source-record-missing',
  'runtime-extension-classification-missing',
  'runtime-extension-protected-principle-missing',
  'runtime-extension-required-controls-missing',
  'runtime-extension-invariants-missing',
  'runtime-extension-enforcement-phases-missing',
  'runtime-extension-required-evidence-missing',
  'runtime-extension-required-authority-missing',
  'runtime-extension-required-audit-records-missing',
  'runtime-extension-replay-missing',
  'runtime-extension-expired',
  'runtime-extension-pass',
  'runtime-extension-review',
  'runtime-extension-block',
] as const;
export type ConsequenceFailureModeRuntimeExtensionReasonCode =
  typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES[number];

export interface ConsequenceFailureModeRuntimeExtensionManifest {
  readonly extensionId?: string | null;
  readonly scopeKind?: ConsequenceFailureModeRuntimeExtensionScope | null;
  readonly scopeDigest?: string | null;
  readonly name?: string | null;
  readonly summary?: string | null;
  readonly classifications?: readonly ConsequenceFailureModeClassification[] | null;
  readonly severity?: ConsequenceFailureModeSeverity | null;
  readonly protectedPrinciples?: readonly ConsequenceFailureModeProtectedPrinciple[] | null;
  readonly requiredControls?: readonly string[] | null;
  readonly defaultDecision?: ConsequenceFailureModeDefaultDecision | null;
  readonly invariantIds?: readonly ConsequenceFailureControlInvariantId[] | null;
  readonly enforcementPhases?: readonly ConsequenceFailureControlEnforcementPhase[] | null;
  readonly requiredEvidence?: readonly string[] | null;
  readonly requiredAuthority?: readonly string[] | null;
  readonly requiredAuditRecords?: readonly string[] | null;
  readonly replayRequired?: boolean | null;
  readonly ownerAuthorityDigest?: string | null;
  readonly approvalDigest?: string | null;
  readonly sourceRecordDigest?: string | null;
  readonly expiresAt?: string | null;
}

export interface EvaluateConsequenceFailureModeRuntimeExtensionsInput {
  readonly generatedAt?: string | null;
  readonly extensions?: readonly ConsequenceFailureModeRuntimeExtensionManifest[] | null;
}

export interface ConsequenceFailureModeRuntimeExtensionObservedEntry {
  readonly extensionIdDigest: string | null;
  readonly scopeKind: ConsequenceFailureModeRuntimeExtensionScope | null;
  readonly scopeDigest: string | null;
  readonly nameDigest: string | null;
  readonly summaryDigest: string | null;
  readonly classificationDigests: readonly string[];
  readonly severity: ConsequenceFailureModeSeverity | null;
  readonly protectedPrincipleDigests: readonly string[];
  readonly requiredControlDigests: readonly string[];
  readonly defaultDecision: ConsequenceFailureModeDefaultDecision | null;
  readonly invariantIdDigests: readonly string[];
  readonly enforcementPhaseDigests: readonly string[];
  readonly requiredEvidenceDigests: readonly string[];
  readonly requiredAuthorityDigests: readonly string[];
  readonly requiredAuditRecordDigests: readonly string[];
  readonly ownerAuthorityDigest: string | null;
  readonly approvalDigest: string | null;
  readonly sourceRecordDigest: string | null;
  readonly replayRequired: boolean;
  readonly expired: boolean;
  readonly outcome: ConsequenceFailureModeRuntimeExtensionOutcome;
  readonly reasonCodes: readonly ConsequenceFailureModeRuntimeExtensionReasonCode[];
}

export interface ConsequenceFailureModeRuntimeExtensionEvaluation {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly registryDigest: string;
  readonly generatedAt: string;
  readonly outcome: ConsequenceFailureModeRuntimeExtensionOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly extensionCount: number;
  readonly blockCount: number;
  readonly reviewCount: number;
  readonly reasonCodes: readonly ConsequenceFailureModeRuntimeExtensionReasonCode[];
  readonly observedExtensions: readonly ConsequenceFailureModeRuntimeExtensionObservedEntry[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly mutatesCanonicalRegistry: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceFailureModeRuntimeExtensionDescriptor {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly allowedScopes: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_SCOPES;
  readonly outcomes: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES;
  readonly reasonCodes: typeof CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES;
  readonly classificationValues: typeof CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS;
  readonly severityValues: typeof CONSEQUENCE_FAILURE_MODE_SEVERITIES;
  readonly defaultDecisionValues: typeof CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS;
  readonly protectedPrinciples: typeof CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES;
  readonly invariantIds: typeof CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS;
  readonly enforcementPhases: typeof CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES;
  readonly mutatesCanonicalRegistry: false;
  readonly requiresScopedOverlay: true;
  readonly requiresOwnerAuthorityDigest: true;
  readonly requiresApprovalDigest: true;
  readonly requiresSourceRecordDigest: true;
  readonly requiresReplayBinding: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
}

const CORE_FAILURE_MODE_IDS = new Set<string>(CONSEQUENCE_FAILURE_MODE_IDS);

const BLOCK_REASON_CODES = new Set<ConsequenceFailureModeRuntimeExtensionReasonCode>([
  'runtime-extension-id-missing',
  'runtime-extension-id-collides-with-core-registry',
  'runtime-extension-scope-missing',
  'runtime-extension-owner-authority-missing',
  'runtime-extension-approval-missing',
  'runtime-extension-required-controls-missing',
  'runtime-extension-invariants-missing',
  'runtime-extension-required-evidence-missing',
  'runtime-extension-required-authority-missing',
  'runtime-extension-required-audit-records-missing',
  'runtime-extension-replay-missing',
  'runtime-extension-expired',
]);

const REVIEW_REASON_CODES = new Set<ConsequenceFailureModeRuntimeExtensionReasonCode>([
  'runtime-extension-missing',
  'runtime-extension-source-record-missing',
  'runtime-extension-classification-missing',
  'runtime-extension-protected-principle-missing',
  'runtime-extension-enforcement-phases-missing',
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

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function digestString(value: string | null | undefined): string | undefined {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

function digestItems(items: readonly string[] | null | undefined): readonly string[] {
  if (!Array.isArray(items)) return Object.freeze([]);
  return Object.freeze(
    [...new Set(items.map((item) => normalizeString(item)).filter((item): item is string => !!item))]
      .sort()
      .map((item) => `sha256:${createHash('sha256').update(item).digest('hex')}`),
  );
}

function hasItems<T>(items: readonly T[] | null | undefined): boolean {
  return Array.isArray(items) && items.length > 0;
}

function isExpired(expiresAt: string | null | undefined, generatedAt: string): boolean {
  const normalized = normalizeString(expiresAt);
  if (!normalized) return false;
  const expiry = Date.parse(normalized);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(now)) return true;
  return expiry <= now;
}

function observeExtension(
  extension: ConsequenceFailureModeRuntimeExtensionManifest,
  generatedAt: string,
): ConsequenceFailureModeRuntimeExtensionObservedEntry {
  const reasonCodes = new Set<ConsequenceFailureModeRuntimeExtensionReasonCode>();
  const extensionId = normalizeString(extension.extensionId);

  if (!extensionId) reasonCodes.add('runtime-extension-id-missing');
  if (extensionId && CORE_FAILURE_MODE_IDS.has(extensionId)) {
    reasonCodes.add('runtime-extension-id-collides-with-core-registry');
  }
  if (!extension.scopeKind || !extension.scopeDigest) reasonCodes.add('runtime-extension-scope-missing');
  if (!extension.ownerAuthorityDigest) reasonCodes.add('runtime-extension-owner-authority-missing');
  if (!extension.approvalDigest) reasonCodes.add('runtime-extension-approval-missing');
  if (!extension.sourceRecordDigest) reasonCodes.add('runtime-extension-source-record-missing');
  if (!hasItems(extension.classifications)) reasonCodes.add('runtime-extension-classification-missing');
  if (!hasItems(extension.protectedPrinciples)) reasonCodes.add('runtime-extension-protected-principle-missing');
  if (!hasItems(extension.requiredControls)) reasonCodes.add('runtime-extension-required-controls-missing');
  if (!hasItems(extension.invariantIds)) reasonCodes.add('runtime-extension-invariants-missing');
  if (!hasItems(extension.enforcementPhases)) reasonCodes.add('runtime-extension-enforcement-phases-missing');
  if (!hasItems(extension.requiredEvidence)) reasonCodes.add('runtime-extension-required-evidence-missing');
  if (!hasItems(extension.requiredAuthority)) reasonCodes.add('runtime-extension-required-authority-missing');
  if (!hasItems(extension.requiredAuditRecords)) reasonCodes.add('runtime-extension-required-audit-records-missing');
  if (extension.replayRequired !== true) reasonCodes.add('runtime-extension-replay-missing');

  const expired = isExpired(extension.expiresAt, generatedAt);
  if (expired) reasonCodes.add('runtime-extension-expired');

  const hasBlock = [...reasonCodes].some((code) => BLOCK_REASON_CODES.has(code));
  const hasReview = [...reasonCodes].some((code) => REVIEW_REASON_CODES.has(code));
  const outcome: ConsequenceFailureModeRuntimeExtensionOutcome =
    hasBlock ? 'block' : hasReview ? 'review' : 'pass';

  reasonCodes.add(
    outcome === 'block'
      ? 'runtime-extension-block'
      : outcome === 'review'
        ? 'runtime-extension-review'
        : 'runtime-extension-pass',
  );

  return Object.freeze({
    extensionIdDigest: digestString(extensionId) ?? null,
    scopeKind: extension.scopeKind ?? null,
    scopeDigest: digestString(extension.scopeDigest) ?? null,
    nameDigest: digestString(extension.name) ?? null,
    summaryDigest: digestString(extension.summary) ?? null,
    classificationDigests: digestItems(extension.classifications),
    severity: extension.severity ?? null,
    protectedPrincipleDigests: digestItems(extension.protectedPrinciples),
    requiredControlDigests: digestItems(extension.requiredControls),
    defaultDecision: extension.defaultDecision ?? null,
    invariantIdDigests: digestItems(extension.invariantIds),
    enforcementPhaseDigests: digestItems(extension.enforcementPhases),
    requiredEvidenceDigests: digestItems(extension.requiredEvidence),
    requiredAuthorityDigests: digestItems(extension.requiredAuthority),
    requiredAuditRecordDigests: digestItems(extension.requiredAuditRecords),
    ownerAuthorityDigest: digestString(extension.ownerAuthorityDigest) ?? null,
    approvalDigest: digestString(extension.approvalDigest) ?? null,
    sourceRecordDigest: digestString(extension.sourceRecordDigest) ?? null,
    replayRequired: extension.replayRequired === true,
    expired,
    outcome,
    reasonCodes: Object.freeze([...reasonCodes].sort()),
  });
}

function observedExtensionToCanonical(
  entry: ConsequenceFailureModeRuntimeExtensionObservedEntry,
): CanonicalReleaseJsonValue {
  return Object.freeze({
    extensionIdDigest: entry.extensionIdDigest,
    scopeKind: entry.scopeKind,
    scopeDigest: entry.scopeDigest,
    nameDigest: entry.nameDigest,
    summaryDigest: entry.summaryDigest,
    classificationDigests: entry.classificationDigests,
    severity: entry.severity,
    protectedPrincipleDigests: entry.protectedPrincipleDigests,
    requiredControlDigests: entry.requiredControlDigests,
    defaultDecision: entry.defaultDecision,
    invariantIdDigests: entry.invariantIdDigests,
    enforcementPhaseDigests: entry.enforcementPhaseDigests,
    requiredEvidenceDigests: entry.requiredEvidenceDigests,
    requiredAuthorityDigests: entry.requiredAuthorityDigests,
    requiredAuditRecordDigests: entry.requiredAuditRecordDigests,
    ownerAuthorityDigest: entry.ownerAuthorityDigest,
    approvalDigest: entry.approvalDigest,
    sourceRecordDigest: entry.sourceRecordDigest,
    replayRequired: entry.replayRequired,
    expired: entry.expired,
    outcome: entry.outcome,
    reasonCodes: entry.reasonCodes,
  });
}

export function evaluateConsequenceFailureModeRuntimeExtensions(
  input: EvaluateConsequenceFailureModeRuntimeExtensionsInput = {},
): ConsequenceFailureModeRuntimeExtensionEvaluation {
  const registry = consequenceFailureModeRegistry();
  const generatedAt =
    normalizeString(input.generatedAt) ?? new Date(0).toISOString();
  const extensions = Array.isArray(input.extensions) ? input.extensions : [];

  const observedExtensions =
    extensions.length > 0
      ? Object.freeze(extensions.map((extension) => observeExtension(extension, generatedAt)))
      : Object.freeze<readonly ConsequenceFailureModeRuntimeExtensionObservedEntry[]>([
          Object.freeze({
            extensionIdDigest: null,
            scopeKind: null,
            scopeDigest: null,
            nameDigest: null,
            summaryDigest: null,
            classificationDigests: Object.freeze([]),
            severity: null,
            protectedPrincipleDigests: Object.freeze([]),
            requiredControlDigests: Object.freeze([]),
            defaultDecision: null,
            invariantIdDigests: Object.freeze([]),
            enforcementPhaseDigests: Object.freeze([]),
            requiredEvidenceDigests: Object.freeze([]),
            requiredAuthorityDigests: Object.freeze([]),
            requiredAuditRecordDigests: Object.freeze([]),
            ownerAuthorityDigest: null,
            approvalDigest: null,
            sourceRecordDigest: null,
            replayRequired: false,
            expired: false,
            outcome: 'review',
            reasonCodes: Object.freeze([
              'runtime-extension-missing',
              'runtime-extension-review',
            ] satisfies ConsequenceFailureModeRuntimeExtensionReasonCode[]),
          }),
        ]);

  const blockCount = observedExtensions.filter((entry) => entry.outcome === 'block').length;
  const reviewCount = observedExtensions.filter((entry) => entry.outcome === 'review').length;
  const outcome: ConsequenceFailureModeRuntimeExtensionOutcome =
    blockCount > 0 ? 'block' : reviewCount > 0 ? 'review' : 'pass';
  const reasonCodes = Object.freeze(
    [...new Set(observedExtensions.flatMap((entry) => entry.reasonCodes))].sort(),
  );

  const canonicalPayload = {
    version: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
    registryVersion: registry.version,
    registryDigest: registry.digest,
    generatedAt,
    outcome,
    extensionCount: extensions.length,
    blockCount,
    reviewCount,
    reasonCodes,
    observedExtensions: observedExtensions.map(observedExtensionToCanonical),
    mutatesCanonicalRegistry: false,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
  } satisfies CanonicalReleaseJsonValue;
  const canonical = canonicalObject(canonicalPayload);

  return Object.freeze({
    version: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
    registryVersion: CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
    registryDigest: registry.digest,
    generatedAt,
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    extensionCount: extensions.length,
    blockCount,
    reviewCount,
    reasonCodes,
    observedExtensions,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    mutatesCanonicalRegistry: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'Runtime failure-mode extensions are scoped overlays. They do not mutate the canonical registry, activate enforcement, prove customer workflow coverage, or certify production readiness.',
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceFailureModeRuntimeExtensionDescriptor():
ConsequenceFailureModeRuntimeExtensionDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
    registryVersion: CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
    allowedScopes: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_SCOPES,
    outcomes: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_OUTCOMES,
    reasonCodes: CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_REASON_CODES,
    classificationValues: CONSEQUENCE_FAILURE_MODE_CLASSIFICATIONS,
    severityValues: CONSEQUENCE_FAILURE_MODE_SEVERITIES,
    defaultDecisionValues: CONSEQUENCE_FAILURE_MODE_DEFAULT_DECISIONS,
    protectedPrinciples: CONSEQUENCE_FAILURE_MODE_PROTECTED_PRINCIPLES,
    invariantIds: CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS,
    enforcementPhases: CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES,
    mutatesCanonicalRegistry: false,
    requiresScopedOverlay: true,
    requiresOwnerAuthorityDigest: true,
    requiresApprovalDigest: true,
    requiresSourceRecordDigest: true,
    requiresReplayBinding: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
  });
}
