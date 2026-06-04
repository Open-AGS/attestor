import {
  createHash,
} from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_VERSION,
  GENERIC_ADMISSION_TRUSTED_GUARD_INPUT_SOURCE_CLASSES,
  type GenericAdmissionGuardInputKind,
  type GenericAdmissionGuardInputProvenanceDecision,
  type GenericAdmissionGuardInputProvenanceObservedRecord,
  type GenericAdmissionGuardInputProvenanceReasonCode,
  type GenericAdmissionGuardInputProvenanceRecord,
} from './contracts.js';

export interface EvaluateGenericAdmissionGuardInputProvenanceInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly records?: readonly GenericAdmissionGuardInputProvenanceRecord[] | null;
  readonly requiredGuardKinds?: readonly GenericAdmissionGuardInputKind[] | null;
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

function digestRawRef(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueReasonCodes(
  items: readonly GenericAdmissionGuardInputProvenanceReasonCode[],
): readonly GenericAdmissionGuardInputProvenanceReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

function isTrustedSource(record: GenericAdmissionGuardInputProvenanceRecord): boolean {
  return GENERIC_ADMISSION_TRUSTED_GUARD_INPUT_SOURCE_CLASSES.has(record.sourceClass) &&
    record.trustedBoundary !== false;
}

function missingDigest(record: GenericAdmissionGuardInputProvenanceRecord): boolean {
  return !record.sourceDigest && !record.evidenceDigest;
}

function recordReasonCodes(
  record: GenericAdmissionGuardInputProvenanceRecord,
): readonly GenericAdmissionGuardInputProvenanceReasonCode[] {
  const reasonCodes: GenericAdmissionGuardInputProvenanceReasonCode[] = [];
  const trusted = isTrustedSource(record);

  if (!trusted) {
    reasonCodes.push('guard-input-source-untrusted');
    if (record.guardKind === 'authority' || record.assertionKinds.includes('authority')) {
      reasonCodes.push('guard-input-authority-untrusted');
    }
    if (record.guardKind === 'policy' || record.assertionKinds.includes('policy')) {
      reasonCodes.push('guard-input-policy-untrusted');
    }
    if (record.guardKind === 'evidence' || record.assertionKinds.includes('evidence')) {
      reasonCodes.push('guard-input-evidence-untrusted');
    }
  }
  if (missingDigest(record)) {
    reasonCodes.push('guard-input-digest-missing');
  }
  if (!record.recordedAt) {
    reasonCodes.push('guard-input-timestamp-missing');
  }
  if (!record.tenantId) {
    reasonCodes.push('guard-input-tenant-missing');
  }

  return uniqueReasonCodes(reasonCodes);
}

function observedRecordFor(
  record: GenericAdmissionGuardInputProvenanceRecord,
): GenericAdmissionGuardInputProvenanceObservedRecord {
  const reasonCodes = recordReasonCodes(record);
  const blocks = reasonCodes.includes('guard-input-authority-untrusted') ||
    reasonCodes.includes('guard-input-policy-untrusted');
  return Object.freeze({
    guardKind: record.guardKind,
    sourceClass: record.sourceClass,
    assertionKinds: readonlyCopy(record.assertionKinds),
    ...(record.sourceRef ? { sourceRefDigest: digestRawRef(record.sourceRef) } : {}),
    ...(record.sourceDigest ? { sourceDigest: record.sourceDigest } : {}),
    ...(record.evidenceDigest ? { evidenceDigest: record.evidenceDigest } : {}),
    ...(record.tenantId ? { tenantIdDigest: digestRawRef(record.tenantId) } : {}),
    ...(record.recordedAt ? { recordedAt: record.recordedAt } : {}),
    trustedBoundary: record.trustedBoundary !== false,
    outcome: blocks ? 'block' : reasonCodes.length > 0 ? 'review' : 'pass',
    reasonCodes,
  });
}

export function evaluateGenericAdmissionGuardInputProvenance(
  input: EvaluateGenericAdmissionGuardInputProvenanceInput,
): GenericAdmissionGuardInputProvenanceDecision {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const records = readonlyCopy(input.records ?? []);
  const requiredGuardKinds = readonlyCopy(input.requiredGuardKinds ?? []);
  const providedGuardKinds = new Set(records.map((record) => record.guardKind));
  const missingRequiredGuardKinds = readonlyCopy(
    requiredGuardKinds.filter((kind) => !providedGuardKinds.has(kind)),
  );
  const observedRecords = readonlyCopy(records.map(observedRecordFor));
  const observedReasonCodes = observedRecords.flatMap((record) => [...record.reasonCodes]);
  const missingRequiredReasons: GenericAdmissionGuardInputProvenanceReasonCode[] =
    missingRequiredGuardKinds.length > 0 ? ['guard-input-provenance-missing'] : [];
  const blockReasons = observedReasonCodes.filter((reason) =>
    reason === 'guard-input-authority-untrusted' ||
    reason === 'guard-input-policy-untrusted'
  );
  const outcome = blockReasons.length > 0
    ? 'block'
    : observedReasonCodes.length > 0 || missingRequiredReasons.length > 0
      ? 'review'
      : 'pass';
  const reasonCodes = uniqueReasonCodes([
    ...observedReasonCodes,
    ...missingRequiredReasons,
    ...(outcome === 'block' ? ['guard-input-block' as const] : []),
    ...(outcome === 'review' ? ['guard-input-review' as const] : []),
  ]);
  const trustedSourceCount = observedRecords.filter((record) =>
    GENERIC_ADMISSION_TRUSTED_GUARD_INPUT_SOURCE_CLASSES.has(record.sourceClass) &&
    record.trustedBoundary
  ).length;
  const missingDigestCount = records.filter(missingDigest).length;
  const payload = {
    version: GENERIC_ADMISSION_GUARD_INPUT_PROVENANCE_VERSION,
    generatedAt,
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes,
    failureModeId: 'guard-input-provenance',
    protectedPrinciples: [
      'proof integrity',
      'customer authority',
      'auditability',
    ],
    counts: {
      recordCount: records.length,
      requiredKindCount: requiredGuardKinds.length,
      missingRequiredKindCount: missingRequiredGuardKinds.length,
      trustedSourceCount,
      untrustedSourceCount: observedRecords.length - trustedSourceCount,
      missingDigestCount,
      missingTimestampCount: records.filter((record) => !record.recordedAt).length,
      missingTenantCount: records.filter((record) => !record.tenantId).length,
    },
    missingRequiredGuardKinds,
    observedRecords,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'Guard-input provenance validates declared metadata origin, freshness, digest, and tenant binding only; live source-system truth and customer PEP no-bypass remain external proof.',
  } satisfies Omit<GenericAdmissionGuardInputProvenanceDecision, 'canonical' | 'digest'>;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
