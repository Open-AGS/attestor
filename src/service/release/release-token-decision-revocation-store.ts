import {
  introspection,
  type ReleaseDecisionRevocationRecord,
  type RevokeReleaseTokensForDecisionInput,
} from '../../release-layer/index.js';
import {
  RELEASE_AUTHORITY_SCHEMA,
  type ReleaseAuthorityPgClient,
} from './release-authority-store.js';

export const RELEASE_TOKEN_DECISION_REVOCATION_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.release_token_decision_revocations`;

export class SharedReleaseTokenDecisionRevocationStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SharedReleaseTokenDecisionRevocationStoreError';
  }
}

type PgQueryResultRow = Record<string, unknown>;

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      `Shared release token decision revocation row has invalid ${fieldName}.`,
    );
  }
  return value;
}

function requireNullableString(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  return requireString(value, fieldName);
}

function normalizeIso(value: unknown, fieldName: string): string {
  const parsed = value instanceof Date ? value : new Date(requireString(value, fieldName));
  if (Number.isNaN(parsed.getTime())) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      `Shared release token decision revocation row has invalid ${fieldName}.`,
    );
  }
  return parsed.toISOString();
}

function normalizeLifecycleTimestamp(label: string, timestamp?: string): string {
  const parsed = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      `Shared release token decision revocation requires a valid ${label} timestamp.`,
    );
  }
  return parsed.toISOString();
}

function normalizeLifecycleText(value: string | undefined, fieldName: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      `Shared release token decision revocation ${fieldName} must be non-empty when provided.`,
    );
  }
  return normalized;
}

function rowJsonObject(row: PgQueryResultRow): Record<string, unknown> {
  const value = row.record_json;
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new SharedReleaseTokenDecisionRevocationStoreError(
    'Shared release token decision revocation row has invalid record_json.',
  );
}

export function releaseDecisionRevocationRecordFor(
  input: RevokeReleaseTokensForDecisionInput,
): ReleaseDecisionRevocationRecord {
  const decisionId = normalizeLifecycleText(input.decisionId, 'decisionId') ??
    input.decisionId;
  return Object.freeze({
    version: introspection.RELEASE_TOKEN_REGISTRY_SPEC_VERSION,
    decisionId,
    revokedAt: normalizeLifecycleTimestamp('revokedAt', input.revokedAt),
    reason: normalizeLifecycleText(input.reason, 'reason'),
    revokedBy: normalizeLifecycleText(input.revokedBy, 'revokedBy'),
    rawPayloadStored: false,
  });
}

export function rowToDecisionRevocation(
  row: PgQueryResultRow,
): ReleaseDecisionRevocationRecord {
  const record = rowJsonObject(row) as unknown as ReleaseDecisionRevocationRecord;
  if (record.version !== introspection.RELEASE_TOKEN_REGISTRY_SPEC_VERSION) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      'Shared release token decision revocation record has an invalid version.',
    );
  }
  if (record.decisionId !== requireString(row.decision_id, 'decision_id')) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      'Shared release token decision revocation row is inconsistent for decision_id.',
    );
  }
  if (record.revokedAt !== normalizeIso(row.revoked_at, 'revoked_at')) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      'Shared release token decision revocation row is inconsistent for revoked_at.',
    );
  }
  if (record.reason !== requireNullableString(row.reason, 'reason')) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      'Shared release token decision revocation row is inconsistent for reason.',
    );
  }
  if (record.revokedBy !== requireNullableString(row.revoked_by, 'revoked_by')) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      'Shared release token decision revocation row is inconsistent for revoked_by.',
    );
  }
  return Object.freeze({
    ...record,
    rawPayloadStored: false,
  });
}

export async function findDecisionRevocationInTransaction(
  client: ReleaseAuthorityPgClient,
  decisionId: string,
): Promise<ReleaseDecisionRevocationRecord | null> {
  const result = await client.query(
    `SELECT decision_id, revoked_at, reason, revoked_by, record_json
       FROM ${RELEASE_TOKEN_DECISION_REVOCATION_TABLE}
      WHERE decision_id = $1
      LIMIT 1`,
    [decisionId],
  );
  return result.rows[0] ? rowToDecisionRevocation(result.rows[0]) : null;
}

export async function insertDecisionRevocation(
  client: ReleaseAuthorityPgClient,
  record: ReleaseDecisionRevocationRecord,
): Promise<ReleaseDecisionRevocationRecord> {
  const existing = await findDecisionRevocationInTransaction(client, record.decisionId);
  if (existing) return existing;
  await client.query(
    `INSERT INTO ${RELEASE_TOKEN_DECISION_REVOCATION_TABLE} (
      decision_id,
      revoked_at,
      reason,
      revoked_by,
      record_json
    ) VALUES (
      $1,
      $2::timestamptz,
      $3,
      $4,
      $5::jsonb
    )
    ON CONFLICT (decision_id) DO NOTHING`,
    [
      record.decisionId,
      record.revokedAt,
      record.reason,
      record.revokedBy,
      JSON.stringify(record),
    ],
  );
  const stored = await findDecisionRevocationInTransaction(client, record.decisionId);
  if (!stored) {
    throw new SharedReleaseTokenDecisionRevocationStoreError(
      `Shared release token decision revocation '${record.decisionId}' could not be stored.`,
    );
  }
  return stored;
}
