import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-layer/index.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
  type ConsequenceAdmissionPresentationReplayLedgerEntry,
} from '../consequence-admission/presentation-replay-ledger.js';
import {
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION,
  type ConsequenceAdmissionRetryAttemptLedgerRecord,
  type ConsequenceAdmissionRetryAttemptLedgerStoreRecordOutcome,
} from '../consequence-admission/retry-attempt-ledger.js';
import {
  RELEASE_AUTHORITY_SCHEMA,
  ensureReleaseAuthorityStore,
  resetReleaseAuthorityStoreForTests,
  type ReleaseAuthorityPgClient,
  withReleaseAuthorityTransaction,
} from './release/release-authority-store.js';

export const CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION =
  'attestor.consequence-shared-atomic-stores.v1';
export const CONSEQUENCE_SHARED_ATOMIC_STORES_SCHEMA_VERSION = 1;

export const CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.consequence_retry_attempt_records`;
export const CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.consequence_presentation_replay_consumptions`;

export type ConsequenceSharedAtomicStoresComponent =
  | 'retry-attempt-ledger'
  | 'presentation-replay-ledger';

export type SharedConsequencePresentationReplayOutcome =
  | 'consumed'
  | 'duplicate';

export interface ConsequenceSharedAtomicStoresOperationalEvidence {
  readonly component: ConsequenceSharedAtomicStoresComponent;
  readonly schemaDigest: string;
  readonly tenantScopeDigest: string;
  readonly idempotencyConstraintDigest: string;
  readonly rawPayloadStored: false;
  readonly exposesConnectionStrings: false;
}

export interface ConsequenceSharedAtomicStoresSummary {
  readonly version: typeof CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION;
  readonly schemaVersion: typeof CONSEQUENCE_SHARED_ATOMIC_STORES_SCHEMA_VERSION;
  readonly schema: typeof RELEASE_AUTHORITY_SCHEMA;
  readonly retryAttemptTable: typeof CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE;
  readonly presentationReplayTable: typeof CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE;
  readonly retryAttemptRecords: number;
  readonly presentationReplayRecords: number;
  readonly operationalEvidence: readonly ConsequenceSharedAtomicStoresOperationalEvidence[];
  readonly rawPayloadStored: false;
  readonly rawIdempotencyKeyStored: false;
  readonly rawReplayKeyStored: false;
  readonly rlsPolicyInstalled: true;
  readonly rlsForced: true;
  readonly productionSharedRuntimeWired: false;
  readonly limitation: string;
}

export interface RecordSharedConsequenceRetryAttemptInput {
  readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord;
  readonly idempotencyScope: string | null;
  readonly maxRecords?: number | null;
}

export interface RecordSharedConsequenceRetryAttemptResult {
  readonly outcome: ConsequenceAdmissionRetryAttemptLedgerStoreRecordOutcome;
  readonly record: ConsequenceAdmissionRetryAttemptLedgerRecord | null;
  readonly rawPayloadStored: false;
  readonly rawIdempotencyKeyStored: false;
}

export interface ConsumeSharedConsequencePresentationReplayInput {
  readonly tenantId: string | null;
  readonly environment?: string | null;
  readonly entry: ConsequenceAdmissionPresentationReplayLedgerEntry;
}

export interface ConsumeSharedConsequencePresentationReplayResult {
  readonly outcome: SharedConsequencePresentationReplayOutcome;
  readonly consumed: boolean;
  readonly entry: ConsequenceAdmissionPresentationReplayLedgerEntry | null;
  readonly rawReplayKeyStored: false;
}

type PgQueryResultRow = Record<string, unknown>;

const RETRY_SCHEMA_CONTRACT = `
${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}:
  primary key record_id
  unique tenant_scope_digest + retry_attempt_id
  partial unique tenant_scope_digest + idempotency_scope_digest when idempotency_scope_digest is not null
  record_json contains digest-only retry record and rawPayloadStored=false
`;

const REPLAY_SCHEMA_CONTRACT = `
${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}:
  primary key entry_digest
  unique tenant_scope_digest + replay_key_digest
  entry_json contains digest-only replay consumption entry
`;

const TENANT_SCOPE_CONTRACT = `
tenant_scope_digest = sha256({version, tenantId|null, environment|null});
RLS policies compare tenant_scope_digest to current_setting('attestor.tenant_scope_digest', true).
RLS is enabled and forced for table owners; superusers and BYPASSRLS roles still bypass PostgreSQL RLS.
`;

const RETRY_IDEMPOTENCY_CONTRACT = `
recordSharedConsequenceRetryAttemptIfAbsent:
  one transaction
  tenant-scope advisory lock
  unique tenant_scope_digest + retry_attempt_id
  partial unique tenant_scope_digest + idempotency_scope_digest
  INSERT ... ON CONFLICT DO NOTHING
`;

const REPLAY_IDEMPOTENCY_CONTRACT = `
consumeSharedConsequencePresentationReplayIfAbsent:
  one transaction
  delete expired retained_until rows in tenant scope
  unique tenant_scope_digest + replay_key_digest
  INSERT ... ON CONFLICT (tenant_scope_digest, replay_key_digest) DO NOTHING
`;

let initPromise: Promise<void> | null = null;

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  const canonical = canonicalizeReleaseJson(value);
  return digestText(canonical);
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence shared atomic store ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence shared atomic store ${fieldName} requires a non-empty value.`);
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
  const digest = normalizeIdentifier(value, fieldName);
  if (!/^sha256:[a-f0-9]{64}$/u.test(digest)) {
    throw new Error(`Consequence shared atomic store ${fieldName} must be a sha256 digest.`);
  }
  return digest;
}

function normalizeIso(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Consequence shared atomic store ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Consequence shared atomic store ${fieldName} must be a positive integer.`);
  }
  return value;
}

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) {
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Consequence shared atomic store row has invalid ${fieldName}.`);
  }
  return value;
}

function rowJsonObject<T>(value: unknown, fieldName: string): T {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Consequence shared atomic store row has invalid ${fieldName}.`);
  }
  return Object.freeze(parsed as T);
}

function advisoryLockKeys(lockName: string): [number, number] {
  const digest = createHash('sha256').update(lockName).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

async function lockTenantScope(
  client: ReleaseAuthorityPgClient,
  lockName: string,
): Promise<void> {
  const [key1, key2] = advisoryLockKeys(lockName);
  await client.query(
    'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
    [key1, key2],
  );
}

function tenantScopeDigest(input: {
  readonly tenantId: string | null;
  readonly environment: string | null;
}): string {
  return digestValue({
    version: CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION,
    tenantId: input.tenantId ?? 'tenant:null',
    environment: input.environment ?? 'environment:null',
  } as CanonicalReleaseJsonValue);
}

async function setTenantScope(
  client: ReleaseAuthorityPgClient,
  scopeDigest: string,
): Promise<void> {
  await client.query(
    "SELECT set_config('attestor.tenant_scope_digest', $1, true)",
    [scopeDigest],
  );
}

function normalizeRetryRecord(
  record: ConsequenceAdmissionRetryAttemptLedgerRecord,
): ConsequenceAdmissionRetryAttemptLedgerRecord {
  if (record.version !== CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_LEDGER_VERSION) {
    throw new Error('Consequence shared atomic store retry record version mismatch.');
  }
  normalizeIdentifier(record.recordId, 'record.recordId');
  normalizeIdentifier(record.ledgerId, 'record.ledgerId');
  normalizeIdentifier(record.retryAttemptId, 'record.retryAttemptId');
  normalizeDigest(record.recordDigest, 'record.recordDigest');
  normalizeDigest(record.retryBudgetDigest, 'record.retryBudgetDigest');
  normalizeIso(record.recordedAt, 'record.recordedAt');
  if (record.idempotencyKeyDigest !== null) {
    normalizeDigest(record.idempotencyKeyDigest, 'record.idempotencyKeyDigest');
  }
  if (record.rawPayloadStored !== false) {
    throw new Error('Consequence shared atomic store retry records must not store raw payloads.');
  }
  return record;
}

function normalizePresentationEntry(
  entry: ConsequenceAdmissionPresentationReplayLedgerEntry,
): ConsequenceAdmissionPresentationReplayLedgerEntry {
  if (entry.version !== CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION) {
    throw new Error('Consequence shared atomic store presentation entry version mismatch.');
  }
  normalizeIdentifier(entry.ledgerId, 'entry.ledgerId');
  normalizeDigest(entry.replayKeyDigest, 'entry.replayKeyDigest');
  normalizeDigest(entry.entryDigest, 'entry.entryDigest');
  normalizeIso(entry.consumedAt, 'entry.consumedAt');
  normalizeIso(entry.retainedUntil, 'entry.retainedUntil');
  return entry;
}

function retryRecordFromRow(row: PgQueryResultRow): ConsequenceAdmissionRetryAttemptLedgerRecord {
  return normalizeRetryRecord(
    rowJsonObject<ConsequenceAdmissionRetryAttemptLedgerRecord>(
      row.record_json,
      'record_json',
    ),
  );
}

function replayEntryFromRow(
  row: PgQueryResultRow,
): ConsequenceAdmissionPresentationReplayLedgerEntry {
  return normalizePresentationEntry(
    rowJsonObject<ConsequenceAdmissionPresentationReplayLedgerEntry>(
      row.entry_json,
      'entry_json',
    ),
  );
}

function operationalEvidence():
readonly ConsequenceSharedAtomicStoresOperationalEvidence[] {
  const schemaDigest = digestText(`${RETRY_SCHEMA_CONTRACT}\n${REPLAY_SCHEMA_CONTRACT}`);
  const tenantDigest = digestText(TENANT_SCOPE_CONTRACT);
  return Object.freeze([
    Object.freeze({
      component: 'retry-attempt-ledger',
      schemaDigest,
      tenantScopeDigest: tenantDigest,
      idempotencyConstraintDigest: digestText(RETRY_IDEMPOTENCY_CONTRACT),
      rawPayloadStored: false,
      exposesConnectionStrings: false,
    }),
    Object.freeze({
      component: 'presentation-replay-ledger',
      schemaDigest,
      tenantScopeDigest: tenantDigest,
      idempotencyConstraintDigest: digestText(REPLAY_IDEMPOTENCY_CONTRACT),
      rawPayloadStored: false,
      exposesConnectionStrings: false,
    }),
  ] as const);
}

async function ensureAtomicTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureReleaseAuthorityStore();
      await withReleaseAuthorityTransaction(async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE} (
            record_id TEXT PRIMARY KEY,
            tenant_scope_digest TEXT NOT NULL,
            tenant_id TEXT NULL,
            environment_name TEXT NULL,
            ledger_id TEXT NOT NULL,
            retry_attempt_id TEXT NOT NULL,
            previous_admission_id TEXT NOT NULL,
            previous_admission_digest TEXT NOT NULL,
            idempotency_scope_digest TEXT NULL,
            idempotency_key_digest TEXT NULL,
            retry_budget_digest TEXT NOT NULL,
            record_digest TEXT NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL,
            record_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK ((record_json->>'rawPayloadStored') = 'false')
          );

          CREATE UNIQUE INDEX IF NOT EXISTS consequence_retry_attempt_records_attempt_idx
            ON ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE} (
              tenant_scope_digest,
              retry_attempt_id
            );

          CREATE UNIQUE INDEX IF NOT EXISTS consequence_retry_attempt_records_idempotency_idx
            ON ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE} (
              tenant_scope_digest,
              idempotency_scope_digest
            )
            WHERE idempotency_scope_digest IS NOT NULL;

          CREATE INDEX IF NOT EXISTS consequence_retry_attempt_records_previous_idx
            ON ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE} (
              tenant_scope_digest,
              previous_admission_id,
              recorded_at ASC
            );

          CREATE TABLE IF NOT EXISTS ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE} (
            entry_digest TEXT PRIMARY KEY,
            tenant_scope_digest TEXT NOT NULL,
            tenant_id TEXT NULL,
            environment_name TEXT NULL,
            ledger_id TEXT NOT NULL,
            replay_key_digest TEXT NOT NULL,
            binding_id TEXT NOT NULL,
            admission_id TEXT NOT NULL,
            contract_id TEXT NOT NULL,
            enforcement_point_id TEXT NOT NULL,
            consumed_at TIMESTAMPTZ NOT NULL,
            retained_until TIMESTAMPTZ NOT NULL,
            entry_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (retained_until >= consumed_at)
          );

          CREATE UNIQUE INDEX IF NOT EXISTS consequence_presentation_replay_consumptions_key_idx
            ON ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE} (
              tenant_scope_digest,
              replay_key_digest
            );

          CREATE INDEX IF NOT EXISTS consequence_presentation_replay_consumptions_retention_idx
            ON ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE} (
              tenant_scope_digest,
              retained_until ASC
            );

          ALTER TABLE ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
            ENABLE ROW LEVEL SECURITY;
          ALTER TABLE ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
            FORCE ROW LEVEL SECURITY;
          ALTER TABLE ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}
            ENABLE ROW LEVEL SECURITY;
          ALTER TABLE ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}
            FORCE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS consequence_retry_attempt_tenant_scope
            ON ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE};
          CREATE POLICY consequence_retry_attempt_tenant_scope
            ON ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
            USING (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            )
            WITH CHECK (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            );

          DROP POLICY IF EXISTS consequence_presentation_replay_tenant_scope
            ON ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE};
          CREATE POLICY consequence_presentation_replay_tenant_scope
            ON ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}
            USING (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            )
            WITH CHECK (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            );
        `);
      });
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function summary(): Promise<ConsequenceSharedAtomicStoresSummary> {
  await ensureAtomicTables();
  return withReleaseAuthorityTransaction(async (client) => {
    const retry = await client.query(
      `SELECT COUNT(*)::int AS record_count
         FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}`,
    );
    const replay = await client.query(
      `SELECT COUNT(*)::int AS record_count
         FROM ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}`,
    );
    return Object.freeze({
      version: CONSEQUENCE_SHARED_ATOMIC_STORES_VERSION,
      schemaVersion: CONSEQUENCE_SHARED_ATOMIC_STORES_SCHEMA_VERSION,
      schema: RELEASE_AUTHORITY_SCHEMA,
      retryAttemptTable: CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE,
      presentationReplayTable: CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE,
      retryAttemptRecords: requireInteger(
        retry.rows[0]?.record_count ?? 0,
        'retry.record_count',
      ),
      presentationReplayRecords: requireInteger(
        replay.rows[0]?.record_count ?? 0,
        'replay.record_count',
      ),
      operationalEvidence: operationalEvidence(),
      rawPayloadStored: false,
      rawIdempotencyKeyStored: false,
      rawReplayKeyStored: false,
      rlsPolicyInstalled: true,
      rlsForced: true,
      productionSharedRuntimeWired: false,
      limitation:
        'Repository-side atomic shared stores only: runtime consequence ledgers still default to in-memory reference stores, and external deployment probes remain required. PostgreSQL superuser and BYPASSRLS roles remain outside the FORCE RLS table-owner guard.',
    });
  });
}

export async function ensureConsequenceSharedAtomicStores():
Promise<ConsequenceSharedAtomicStoresSummary> {
  return summary();
}

export async function recordSharedConsequenceRetryAttemptIfAbsent(
  input: RecordSharedConsequenceRetryAttemptInput,
): Promise<RecordSharedConsequenceRetryAttemptResult> {
  const record = normalizeRetryRecord(input.record);
  const maxRecords = normalizePositiveInteger(input.maxRecords, 'maxRecords', 1000);
  const scopeDigest = tenantScopeDigest({
    tenantId: normalizeOptionalIdentifier(record.tenantId, 'record.tenantId'),
    environment: normalizeOptionalIdentifier(record.environment, 'record.environment'),
  });
  const idempotencyScopeDigest = input.idempotencyScope === null
    ? null
    : digestText(normalizeIdentifier(input.idempotencyScope, 'idempotencyScope'));

  await ensureAtomicTables();
  return withReleaseAuthorityTransaction(async (client) => {
    await setTenantScope(client, scopeDigest);
    await lockTenantScope(client, `consequence-retry-attempt:${scopeDigest}`);

    const existingAttempt = await client.query(
      `SELECT record_json
         FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
        WHERE tenant_scope_digest = $1
          AND retry_attempt_id = $2
        LIMIT 1`,
      [scopeDigest, record.retryAttemptId],
    );
    if (existingAttempt.rows[0]) {
      return Object.freeze({
        outcome: 'duplicate',
        record: retryRecordFromRow(existingAttempt.rows[0]),
        rawPayloadStored: false,
        rawIdempotencyKeyStored: false,
      });
    }

    if (idempotencyScopeDigest !== null) {
      const existingIdempotency = await client.query(
        `SELECT record_json, retry_attempt_id
           FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
          WHERE tenant_scope_digest = $1
            AND idempotency_scope_digest = $2
          LIMIT 1`,
        [scopeDigest, idempotencyScopeDigest],
      );
      if (existingIdempotency.rows[0]) {
        const existingAttemptId = normalizeIdentifier(
          String(existingIdempotency.rows[0].retry_attempt_id ?? ''),
          'retry_attempt_id',
        );
        return Object.freeze({
          outcome: existingAttemptId === record.retryAttemptId
            ? 'duplicate'
            : 'idempotency-key-conflict',
          record: existingAttemptId === record.retryAttemptId
            ? retryRecordFromRow(existingIdempotency.rows[0])
            : null,
          rawPayloadStored: false,
          rawIdempotencyKeyStored: false,
        });
      }
    }

    const count = await client.query(
      `SELECT COUNT(*)::int AS record_count
         FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
        WHERE tenant_scope_digest = $1`,
      [scopeDigest],
    );
    if (requireInteger(count.rows[0]?.record_count ?? 0, 'record_count') >= maxRecords) {
      return Object.freeze({
        outcome: 'ledger-capacity-exhausted',
        record: null,
        rawPayloadStored: false,
        rawIdempotencyKeyStored: false,
      });
    }

    const inserted = await client.query(
      `INSERT INTO ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE} (
        record_id,
        tenant_scope_digest,
        tenant_id,
        environment_name,
        ledger_id,
        retry_attempt_id,
        previous_admission_id,
        previous_admission_digest,
        idempotency_scope_digest,
        idempotency_key_digest,
        retry_budget_digest,
        record_digest,
        recorded_at,
        record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::jsonb
      )
      ON CONFLICT DO NOTHING
      RETURNING record_json`,
      [
        record.recordId,
        scopeDigest,
        record.tenantId,
        record.environment,
        record.ledgerId,
        record.retryAttemptId,
        record.previousAdmissionId,
        record.previousAdmissionDigest,
        idempotencyScopeDigest,
        record.idempotencyKeyDigest,
        record.retryBudgetDigest,
        record.recordDigest,
        record.recordedAt,
        JSON.stringify(record),
      ],
    );
    if (inserted.rows[0]) {
      return Object.freeze({
        outcome: 'recorded',
        record: retryRecordFromRow(inserted.rows[0]),
        rawPayloadStored: false,
        rawIdempotencyKeyStored: false,
      });
    }

    const racedAttempt = await client.query(
      `SELECT record_json
         FROM ${CONSEQUENCE_SHARED_RETRY_ATTEMPT_LEDGER_TABLE}
        WHERE tenant_scope_digest = $1
          AND retry_attempt_id = $2
        LIMIT 1`,
      [scopeDigest, record.retryAttemptId],
    );
    if (racedAttempt.rows[0]) {
      return Object.freeze({
        outcome: 'duplicate',
        record: retryRecordFromRow(racedAttempt.rows[0]),
        rawPayloadStored: false,
        rawIdempotencyKeyStored: false,
      });
    }

    return Object.freeze({
      outcome: 'idempotency-key-conflict',
      record: null,
      rawPayloadStored: false,
      rawIdempotencyKeyStored: false,
    });
  });
}

export async function consumeSharedConsequencePresentationReplayIfAbsent(
  input: ConsumeSharedConsequencePresentationReplayInput,
): Promise<ConsumeSharedConsequencePresentationReplayResult> {
  const entry = normalizePresentationEntry(input.entry);
  const tenantId = normalizeOptionalIdentifier(input.tenantId, 'tenantId');
  const environment = normalizeOptionalIdentifier(input.environment, 'environment');
  const scopeDigest = tenantScopeDigest({ tenantId, environment });

  await ensureAtomicTables();
  return withReleaseAuthorityTransaction(async (client) => {
    await setTenantScope(client, scopeDigest);
    await lockTenantScope(client, `consequence-presentation-replay:${scopeDigest}`);
    await client.query(
      `DELETE FROM ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}
        WHERE tenant_scope_digest = $1
          AND retained_until < $2::timestamptz`,
      [scopeDigest, entry.consumedAt],
    );

    const inserted = await client.query(
      `INSERT INTO ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE} (
        entry_digest,
        tenant_scope_digest,
        tenant_id,
        environment_name,
        ledger_id,
        replay_key_digest,
        binding_id,
        admission_id,
        contract_id,
        enforcement_point_id,
        consumed_at,
        retained_until,
        entry_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::jsonb
      )
      ON CONFLICT (tenant_scope_digest, replay_key_digest) DO NOTHING
      RETURNING entry_json`,
      [
        entry.entryDigest,
        scopeDigest,
        tenantId,
        environment,
        entry.ledgerId,
        entry.replayKeyDigest,
        entry.bindingId,
        entry.admissionId,
        entry.contractId,
        entry.enforcementPointId,
        entry.consumedAt,
        entry.retainedUntil,
        JSON.stringify(entry),
      ],
    );
    if (inserted.rows[0]) {
      return Object.freeze({
        outcome: 'consumed',
        consumed: true,
        entry: replayEntryFromRow(inserted.rows[0]),
        rawReplayKeyStored: false,
      });
    }

    const existing = await client.query(
      `SELECT entry_json
         FROM ${CONSEQUENCE_SHARED_PRESENTATION_REPLAY_LEDGER_TABLE}
        WHERE tenant_scope_digest = $1
          AND replay_key_digest = $2
        LIMIT 1`,
      [scopeDigest, entry.replayKeyDigest],
    );
    return Object.freeze({
      outcome: 'duplicate',
      consumed: false,
      entry: existing.rows[0] ? replayEntryFromRow(existing.rows[0]) : null,
      rawReplayKeyStored: false,
    });
  });
}

export async function resetConsequenceSharedAtomicStoresForTests(): Promise<void> {
  initPromise = null;
  await resetReleaseAuthorityStoreForTests();
}
