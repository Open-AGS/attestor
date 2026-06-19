import {
  RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
  type ReleaseDecisionRevocationRecord,
  type RevokeReleaseTokensForDecisionInput,
} from './release-introspection-types.js';

export function normalizeReleaseLifecycleText(
  value: string | undefined,
  fieldName: string,
): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Release token lifecycle ${fieldName} must be non-empty when provided.`);
  }
  return normalized;
}

export function freezeReleaseDecisionRevocation(
  record: ReleaseDecisionRevocationRecord,
  timestampNormalizer: (timestamp: string) => string,
): ReleaseDecisionRevocationRecord {
  return Object.freeze({
    version: RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
    decisionId: normalizeReleaseLifecycleText(record.decisionId, 'decisionId') ??
      record.decisionId,
    revokedAt: timestampNormalizer(record.revokedAt),
    reason: record.reason === null || record.reason === undefined
      ? null
      : normalizeReleaseLifecycleText(record.reason, 'reason'),
    revokedBy: record.revokedBy === null || record.revokedBy === undefined
      ? null
      : normalizeReleaseLifecycleText(record.revokedBy, 'revokedBy'),
    rawPayloadStored: false,
  });
}

export function releaseDecisionRevocationRecordFor(
  input: RevokeReleaseTokensForDecisionInput,
  timestampNormalizer: (label: string, timestamp?: string) => string,
): ReleaseDecisionRevocationRecord {
  const decisionId = normalizeReleaseLifecycleText(input.decisionId, 'decisionId') ??
    input.decisionId;
  return Object.freeze({
    version: RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
    decisionId,
    revokedAt: timestampNormalizer('revokedAt', input.revokedAt),
    reason: normalizeReleaseLifecycleText(input.reason, 'reason'),
    revokedBy: normalizeReleaseLifecycleText(input.revokedBy, 'revokedBy'),
    rawPayloadStored: false,
  });
}
