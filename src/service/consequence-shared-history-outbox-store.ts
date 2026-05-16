import { createHash, randomUUID } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-layer/index.js';
import {
  RELEASE_AUTHORITY_SCHEMA,
  ensureReleaseAuthorityStore,
  resetReleaseAuthorityStoreForTests,
  type ReleaseAuthorityPgClient,
  withReleaseAuthorityTransaction,
} from './release-authority-store.js';

export const CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION =
  'attestor.consequence-shared-history-outbox-store.v1';
export const CONSEQUENCE_SHARED_HISTORY_OUTBOX_SCHEMA_VERSION = 1;

export const CONSEQUENCE_SHARED_HISTORY_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.consequence_shared_history_records`;
export const CONSEQUENCE_SHARED_OUTBOX_TABLE =
  `${RELEASE_AUTHORITY_SCHEMA}.consequence_shared_outbox_messages`;

export const CONSEQUENCE_SHARED_HISTORY_SOURCE_KINDS = Object.freeze([
  'shadow-admission-event',
  'shadow-policy-simulation',
  'shadow-policy-candidate',
  'shadow-activation-receipt',
  'audit-evidence-export',
  'business-risk-dashboard',
  'dashboard-api-summary',
  'downstream-execution-receipt',
  'tamper-evident-history',
] as const);

export type ConsequenceSharedHistorySourceKind =
  typeof CONSEQUENCE_SHARED_HISTORY_SOURCE_KINDS[number];

export type ConsequenceSharedHistoryOutboxComponent =
  | 'shadow-admission-events'
  | 'shadow-policy-simulations'
  | 'shadow-policy-candidates'
  | 'shadow-activation-receipts'
  | 'audit-evidence-export'
  | 'business-risk-dashboard'
  | 'dashboard-api-summary'
  | 'downstream-execution-receipt'
  | 'tamper-evident-history';

export type ConsequenceSharedOutboxStatus =
  | 'pending'
  | 'claimed'
  | 'published'
  | 'failed';

export type AppendSharedConsequenceHistoryOutcome =
  | 'recorded'
  | 'duplicate'
  | 'source-conflict';

export type PublishSharedConsequenceOutboxOutcome =
  | 'published'
  | 'not-claimed';

export interface ConsequenceSharedHistoryArtifactRef {
  readonly kind: string;
  readonly digest: string;
}

export interface ConsequenceSharedHistoryRecord {
  readonly version: typeof CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION;
  readonly historyId: string;
  readonly tenantScopeDigest: string;
  readonly sourceKind: ConsequenceSharedHistorySourceKind;
  readonly sourceKeyDigest: string;
  readonly sourceDigest: string;
  readonly payloadDigest: string;
  readonly payloadSchema: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly artifactRefs: readonly ConsequenceSharedHistoryArtifactRef[];
  readonly recordDigest: string;
  readonly rawPayloadStored: false;
  readonly rawTenantIdStored: false;
}

export interface ConsequenceSharedOutboxMessage {
  readonly version: typeof CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION;
  readonly outboxId: string;
  readonly historyId: string;
  readonly tenantScopeDigest: string;
  readonly sourceKind: ConsequenceSharedHistorySourceKind;
  readonly sourceKeyDigest: string;
  readonly eventType: string;
  readonly partitionKeyDigest: string;
  readonly payloadDigest: string;
  readonly recordDigest: string;
  readonly status: ConsequenceSharedOutboxStatus;
  readonly claimToken: string | null;
  readonly claimWorkerDigest: string | null;
  readonly claimedAt: string | null;
  readonly claimExpiresAt: string | null;
  readonly publishedAt: string | null;
  readonly attemptCount: number;
  readonly rawPayloadStored: false;
}

export interface ConsequenceSharedHistoryOutboxOperationalEvidence {
  readonly component: ConsequenceSharedHistoryOutboxComponent;
  readonly schemaDigest: string;
  readonly tenantScopeDigest: string;
  readonly outboxContractDigest: string;
  readonly workerClaimQueryDigest: string;
  readonly advisoryLockKeyspaceDigest: string;
  readonly rawPayloadStored: false;
  readonly rawTenantIdStored: false;
  readonly exposesConnectionStrings: false;
}

export interface ConsequenceSharedHistoryOutboxSummary {
  readonly version: typeof CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION;
  readonly schemaVersion: typeof CONSEQUENCE_SHARED_HISTORY_OUTBOX_SCHEMA_VERSION;
  readonly schema: typeof RELEASE_AUTHORITY_SCHEMA;
  readonly historyTable: typeof CONSEQUENCE_SHARED_HISTORY_TABLE;
  readonly outboxTable: typeof CONSEQUENCE_SHARED_OUTBOX_TABLE;
  readonly historyRecords: number;
  readonly outboxMessages: number;
  readonly pendingOutboxMessages: number;
  readonly claimedOutboxMessages: number;
  readonly publishedOutboxMessages: number;
  readonly operationalEvidence: readonly ConsequenceSharedHistoryOutboxOperationalEvidence[];
  readonly rawPayloadStored: false;
  readonly rawTenantIdStored: false;
  readonly rlsPolicyInstalled: true;
  readonly rlsForced: false;
  readonly debeziumConnectorWired: false;
  readonly productionSharedRuntimeWired: false;
  readonly limitation: string;
}

export interface AppendSharedConsequenceHistoryInput {
  readonly tenantId: string | null;
  readonly environment?: string | null;
  readonly sourceKind: ConsequenceSharedHistorySourceKind;
  readonly sourceKeyDigest: string;
  readonly sourceDigest: string;
  readonly payloadDigest: string;
  readonly payloadSchema: string;
  readonly occurredAt: string;
  readonly recordedAt?: string | null;
  readonly artifactRefs?: readonly ConsequenceSharedHistoryArtifactRef[];
  readonly outboxEventType?: string | null;
  readonly outboxPartitionKeyDigest?: string | null;
}

export interface AppendSharedConsequenceHistoryResult {
  readonly outcome: AppendSharedConsequenceHistoryOutcome;
  readonly record: ConsequenceSharedHistoryRecord | null;
  readonly outboxMessage: ConsequenceSharedOutboxMessage | null;
  readonly rawPayloadStored: false;
  readonly rawTenantIdStored: false;
}

export interface ClaimSharedConsequenceOutboxMessagesInput {
  readonly tenantId: string | null;
  readonly environment?: string | null;
  readonly workerId: string;
  readonly limit?: number | null;
  readonly leaseSeconds?: number | null;
  readonly now?: string | null;
}

export interface PublishSharedConsequenceOutboxMessageInput {
  readonly tenantId: string | null;
  readonly environment?: string | null;
  readonly outboxId: string;
  readonly claimToken: string;
  readonly publishedAt?: string | null;
}

export interface PublishSharedConsequenceOutboxMessageResult {
  readonly outcome: PublishSharedConsequenceOutboxOutcome;
  readonly message: ConsequenceSharedOutboxMessage | null;
}

type PgQueryResultRow = Record<string, unknown>;

const SCHEMA_CONTRACT = `
${CONSEQUENCE_SHARED_HISTORY_TABLE}:
  primary key history_id
  unique tenant_scope_digest + source_kind + source_key_digest
  unique tenant_scope_digest + sequence
  source keys, payloads, tenants, and artifacts are digest-only
${CONSEQUENCE_SHARED_OUTBOX_TABLE}:
  primary key outbox_id
  one outbox message per history_id
  event_json carries digest-only source, payload, and record references
`;

const TENANT_SCOPE_CONTRACT = `
tenant_scope_digest = sha256({version, tenantId|null, environment|null});
RLS policies compare tenant_scope_digest to current_setting('attestor.tenant_scope_digest', true).
Raw tenant ids and raw environment labels are not stored in history or outbox rows.
`;

const OUTBOX_CONTRACT = `
appendSharedConsequenceHistory:
  one transaction
  tenant-scope advisory lock
  append-only source history row
  exactly one pending outbox message for the history row
  no connector, Debezium, or event-bus delivery claim
`;

const WORKER_CLAIM_QUERY_CONTRACT = `
claimSharedConsequenceOutboxMessages:
  WITH candidates AS (
    SELECT outbox_id
      FROM consequence_shared_outbox_messages
     WHERE tenant_scope_digest = $scope
       AND status in pending/failed or expired claimed lease
     ORDER BY created_at ASC, outbox_id ASC
     FOR UPDATE SKIP LOCKED
     LIMIT $limit
  )
  UPDATE selected rows to claimed with a lease token and attempt_count increment.
`;

const ADVISORY_LOCK_KEYSPACE_CONTRACT = `
pg_advisory_xact_lock(sha256("consequence-shared-history:" + tenant_scope_digest)[0..8])
serializes per-tenant append sequence allocation without storing raw tenant ids.
`;

const COMPONENTS = Object.freeze([
  'shadow-admission-events',
  'shadow-policy-simulations',
  'shadow-policy-candidates',
  'shadow-activation-receipts',
  'audit-evidence-export',
  'business-risk-dashboard',
  'dashboard-api-summary',
  'downstream-execution-receipt',
  'tamper-evident-history',
] as const satisfies readonly ConsequenceSharedHistoryOutboxComponent[]);

let initPromise: Promise<void> | null = null;

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function digestValue(value: CanonicalReleaseJsonValue): string {
  return digestText(canonicalizeReleaseJson(value));
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence shared history outbox ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence shared history outbox ${fieldName} requires a non-empty value.`,
    );
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
    throw new Error(`Consequence shared history outbox ${fieldName} must be a sha256 digest.`);
  }
  return digest;
}

function normalizeIso(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Consequence shared history outbox ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeSourceKind(value: ConsequenceSharedHistorySourceKind):
ConsequenceSharedHistorySourceKind {
  if (!CONSEQUENCE_SHARED_HISTORY_SOURCE_KINDS.includes(value)) {
    throw new Error(`Unsupported consequence shared history source kind '${value}'.`);
  }
  return value;
}

function normalizeArtifacts(
  artifacts: readonly ConsequenceSharedHistoryArtifactRef[] | null | undefined,
): readonly ConsequenceSharedHistoryArtifactRef[] {
  return Object.freeze((artifacts ?? []).map((artifact, index) =>
    Object.freeze({
      kind: normalizeIdentifier(artifact.kind, `artifactRefs[${index}].kind`),
      digest: normalizeDigest(artifact.digest, `artifactRefs[${index}].digest`),
    })
  ));
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
  fallback: number,
): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Consequence shared history outbox ${fieldName} must be a positive integer.`);
  }
  return value;
}

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value === 'string' && /^-?\d+$/u.test(value)) {
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Consequence shared history outbox row has invalid ${fieldName}.`);
  }
  return value;
}

function rowJsonObject<T>(value: unknown, fieldName: string): T {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Consequence shared history outbox row has invalid ${fieldName}.`);
  }
  return Object.freeze(parsed as T);
}

function rowTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return new Date(String(value)).toISOString();
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
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
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

function defaultOutboxEventType(sourceKind: ConsequenceSharedHistorySourceKind): string {
  return `attestor.consequence.${sourceKind}.recorded.v1`;
}

function historyIdFor(input: {
  readonly tenantScopeDigest: string;
  readonly sourceKind: ConsequenceSharedHistorySourceKind;
  readonly sourceKeyDigest: string;
}): string {
  return digestValue({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    purpose: 'history-id',
    tenantScopeDigest: input.tenantScopeDigest,
    sourceKind: input.sourceKind,
    sourceKeyDigest: input.sourceKeyDigest,
  } as CanonicalReleaseJsonValue);
}

function outboxIdFor(input: {
  readonly historyId: string;
  readonly eventType: string;
  readonly recordDigest: string;
}): string {
  return digestValue({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    purpose: 'outbox-id',
    historyId: input.historyId,
    eventType: input.eventType,
    recordDigest: input.recordDigest,
  } as CanonicalReleaseJsonValue);
}

function recordDigestFor(input: Omit<ConsequenceSharedHistoryRecord, 'recordDigest'>): string {
  return digestValue(input as unknown as CanonicalReleaseJsonValue);
}

function normalizeHistoryRecord(
  record: ConsequenceSharedHistoryRecord,
): ConsequenceSharedHistoryRecord {
  if (record.version !== CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION) {
    throw new Error('Consequence shared history record version mismatch.');
  }
  normalizeDigest(record.historyId, 'record.historyId');
  normalizeDigest(record.tenantScopeDigest, 'record.tenantScopeDigest');
  normalizeSourceKind(record.sourceKind);
  normalizeDigest(record.sourceKeyDigest, 'record.sourceKeyDigest');
  normalizeDigest(record.sourceDigest, 'record.sourceDigest');
  normalizeDigest(record.payloadDigest, 'record.payloadDigest');
  normalizeIdentifier(record.payloadSchema, 'record.payloadSchema');
  requireInteger(record.sequence, 'record.sequence');
  normalizeIso(record.occurredAt, 'record.occurredAt');
  normalizeIso(record.recordedAt, 'record.recordedAt');
  normalizeArtifacts(record.artifactRefs);
  normalizeDigest(record.recordDigest, 'record.recordDigest');
  if (record.rawPayloadStored !== false || record.rawTenantIdStored !== false) {
    throw new Error('Consequence shared history records must be raw-payload and raw-tenant-id free.');
  }
  return Object.freeze(record);
}

function recordFromRow(row: PgQueryResultRow): ConsequenceSharedHistoryRecord {
  return normalizeHistoryRecord(
    rowJsonObject<ConsequenceSharedHistoryRecord>(row.record_json, 'record_json'),
  );
}

function messageFromRow(row: PgQueryResultRow): ConsequenceSharedOutboxMessage {
  return Object.freeze({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    outboxId: normalizeDigest(String(row.outbox_id ?? ''), 'outbox_id'),
    historyId: normalizeDigest(String(row.history_id ?? ''), 'history_id'),
    tenantScopeDigest: normalizeDigest(
      String(row.tenant_scope_digest ?? ''),
      'tenant_scope_digest',
    ),
    sourceKind: normalizeSourceKind(
      String(row.source_kind ?? '') as ConsequenceSharedHistorySourceKind,
    ),
    sourceKeyDigest: normalizeDigest(String(row.source_key_digest ?? ''), 'source_key_digest'),
    eventType: normalizeIdentifier(String(row.event_type ?? ''), 'event_type'),
    partitionKeyDigest: normalizeDigest(
      String(row.partition_key_digest ?? ''),
      'partition_key_digest',
    ),
    payloadDigest: normalizeDigest(String(row.payload_digest ?? ''), 'payload_digest'),
    recordDigest: normalizeDigest(String(row.record_digest ?? ''), 'record_digest'),
    status: String(row.status ?? '') as ConsequenceSharedOutboxStatus,
    claimToken: row.claim_token === null ? null : normalizeDigest(String(row.claim_token), 'claim_token'),
    claimWorkerDigest:
      row.claim_worker_digest === null
        ? null
        : normalizeDigest(String(row.claim_worker_digest), 'claim_worker_digest'),
    claimedAt: rowTimestamp(row.claimed_at),
    claimExpiresAt: rowTimestamp(row.claim_expires_at),
    publishedAt: rowTimestamp(row.published_at),
    attemptCount: requireInteger(row.attempt_count ?? 0, 'attempt_count'),
    rawPayloadStored: false,
  });
}

function operationalEvidence():
readonly ConsequenceSharedHistoryOutboxOperationalEvidence[] {
  const schemaDigest = digestText(SCHEMA_CONTRACT);
  const tenantDigest = digestText(TENANT_SCOPE_CONTRACT);
  const outboxDigest = digestText(OUTBOX_CONTRACT);
  const workerDigest = digestText(WORKER_CLAIM_QUERY_CONTRACT);
  const advisoryDigest = digestText(ADVISORY_LOCK_KEYSPACE_CONTRACT);
  return Object.freeze(COMPONENTS.map((component) =>
    Object.freeze({
      component,
      schemaDigest,
      tenantScopeDigest: tenantDigest,
      outboxContractDigest: outboxDigest,
      workerClaimQueryDigest: workerDigest,
      advisoryLockKeyspaceDigest: advisoryDigest,
      rawPayloadStored: false,
      rawTenantIdStored: false,
      exposesConnectionStrings: false,
    })
  ));
}

async function ensureTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureReleaseAuthorityStore();
      await withReleaseAuthorityTransaction(async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${CONSEQUENCE_SHARED_HISTORY_TABLE} (
            history_id TEXT PRIMARY KEY,
            tenant_scope_digest TEXT NOT NULL,
            source_kind TEXT NOT NULL,
            source_key_digest TEXT NOT NULL,
            source_digest TEXT NOT NULL,
            payload_digest TEXT NOT NULL,
            payload_schema TEXT NOT NULL,
            sequence BIGINT NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL,
            recorded_at TIMESTAMPTZ NOT NULL,
            artifact_refs_json JSONB NOT NULL,
            record_digest TEXT NOT NULL,
            record_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK ((record_json->>'rawPayloadStored') = 'false'),
            CHECK ((record_json->>'rawTenantIdStored') = 'false')
          );

          CREATE UNIQUE INDEX IF NOT EXISTS consequence_shared_history_source_idx
            ON ${CONSEQUENCE_SHARED_HISTORY_TABLE} (
              tenant_scope_digest,
              source_kind,
              source_key_digest
            );

          CREATE UNIQUE INDEX IF NOT EXISTS consequence_shared_history_sequence_idx
            ON ${CONSEQUENCE_SHARED_HISTORY_TABLE} (
              tenant_scope_digest,
              sequence
            );

          CREATE INDEX IF NOT EXISTS consequence_shared_history_recorded_idx
            ON ${CONSEQUENCE_SHARED_HISTORY_TABLE} (
              tenant_scope_digest,
              recorded_at ASC,
              history_id ASC
            );

          CREATE TABLE IF NOT EXISTS ${CONSEQUENCE_SHARED_OUTBOX_TABLE} (
            outbox_id TEXT PRIMARY KEY,
            history_id TEXT NOT NULL UNIQUE REFERENCES ${CONSEQUENCE_SHARED_HISTORY_TABLE}(history_id),
            tenant_scope_digest TEXT NOT NULL,
            source_kind TEXT NOT NULL,
            source_key_digest TEXT NOT NULL,
            event_type TEXT NOT NULL,
            partition_key_digest TEXT NOT NULL,
            payload_digest TEXT NOT NULL,
            record_digest TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'claimed', 'published', 'failed')),
            claim_token TEXT NULL,
            claim_worker_digest TEXT NULL,
            claimed_at TIMESTAMPTZ NULL,
            claim_expires_at TIMESTAMPTZ NULL,
            published_at TIMESTAMPTZ NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
            event_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK ((event_json->>'rawPayloadStored') = 'false')
          );

          CREATE INDEX IF NOT EXISTS consequence_shared_outbox_claim_idx
            ON ${CONSEQUENCE_SHARED_OUTBOX_TABLE} (
              tenant_scope_digest,
              status,
              created_at ASC,
              outbox_id ASC
            );

          ALTER TABLE ${CONSEQUENCE_SHARED_HISTORY_TABLE}
            ENABLE ROW LEVEL SECURITY;
          ALTER TABLE ${CONSEQUENCE_SHARED_OUTBOX_TABLE}
            ENABLE ROW LEVEL SECURITY;

          DROP POLICY IF EXISTS consequence_shared_history_tenant_scope
            ON ${CONSEQUENCE_SHARED_HISTORY_TABLE};
          CREATE POLICY consequence_shared_history_tenant_scope
            ON ${CONSEQUENCE_SHARED_HISTORY_TABLE}
            USING (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            )
            WITH CHECK (
              tenant_scope_digest = current_setting('attestor.tenant_scope_digest', true)
            );

          DROP POLICY IF EXISTS consequence_shared_outbox_tenant_scope
            ON ${CONSEQUENCE_SHARED_OUTBOX_TABLE};
          CREATE POLICY consequence_shared_outbox_tenant_scope
            ON ${CONSEQUENCE_SHARED_OUTBOX_TABLE}
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

function buildHistoryRecord(input: {
  readonly scopeDigest: string;
  readonly sourceKind: ConsequenceSharedHistorySourceKind;
  readonly sourceKeyDigest: string;
  readonly sourceDigest: string;
  readonly payloadDigest: string;
  readonly payloadSchema: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly artifactRefs: readonly ConsequenceSharedHistoryArtifactRef[];
}): ConsequenceSharedHistoryRecord {
  const historyId = historyIdFor({
    tenantScopeDigest: input.scopeDigest,
    sourceKind: input.sourceKind,
    sourceKeyDigest: input.sourceKeyDigest,
  });
  const withoutDigest = Object.freeze({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    historyId,
    tenantScopeDigest: input.scopeDigest,
    sourceKind: input.sourceKind,
    sourceKeyDigest: input.sourceKeyDigest,
    sourceDigest: input.sourceDigest,
    payloadDigest: input.payloadDigest,
    payloadSchema: input.payloadSchema,
    sequence: input.sequence,
    occurredAt: input.occurredAt,
    recordedAt: input.recordedAt,
    artifactRefs: input.artifactRefs,
    rawPayloadStored: false,
    rawTenantIdStored: false,
  });
  return normalizeHistoryRecord(Object.freeze({
    ...withoutDigest,
    recordDigest: recordDigestFor(withoutDigest),
  }));
}

function buildEventJson(input: {
  readonly outboxId: string;
  readonly record: ConsequenceSharedHistoryRecord;
  readonly eventType: string;
  readonly partitionKeyDigest: string;
}): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    outboxId: input.outboxId,
    aggregateType: 'consequence-shared-history',
    aggregateId: input.record.historyId,
    type: input.eventType,
    tenantScopeDigest: input.record.tenantScopeDigest,
    sourceKind: input.record.sourceKind,
    sourceKeyDigest: input.record.sourceKeyDigest,
    partitionKeyDigest: input.partitionKeyDigest,
    payloadDigest: input.record.payloadDigest,
    recordDigest: input.record.recordDigest,
    rawPayloadStored: false,
  });
}

async function summary(): Promise<ConsequenceSharedHistoryOutboxSummary> {
  await ensureTables();
  return withReleaseAuthorityTransaction(async (client) => {
    const [history, outbox] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS record_count
           FROM ${CONSEQUENCE_SHARED_HISTORY_TABLE}`,
      ),
      client.query(
        `SELECT COUNT(*)::int AS message_count,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
                COUNT(*) FILTER (WHERE status = 'claimed')::int AS claimed_count,
                COUNT(*) FILTER (WHERE status = 'published')::int AS published_count
           FROM ${CONSEQUENCE_SHARED_OUTBOX_TABLE}`,
      ),
    ]);
    const outboxRow = outbox.rows[0] ?? {};
    return Object.freeze({
      version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
      schemaVersion: CONSEQUENCE_SHARED_HISTORY_OUTBOX_SCHEMA_VERSION,
      schema: RELEASE_AUTHORITY_SCHEMA,
      historyTable: CONSEQUENCE_SHARED_HISTORY_TABLE,
      outboxTable: CONSEQUENCE_SHARED_OUTBOX_TABLE,
      historyRecords: requireInteger(history.rows[0]?.record_count ?? 0, 'record_count'),
      outboxMessages: requireInteger(outboxRow.message_count ?? 0, 'message_count'),
      pendingOutboxMessages: requireInteger(outboxRow.pending_count ?? 0, 'pending_count'),
      claimedOutboxMessages: requireInteger(outboxRow.claimed_count ?? 0, 'claimed_count'),
      publishedOutboxMessages: requireInteger(outboxRow.published_count ?? 0, 'published_count'),
      operationalEvidence: operationalEvidence(),
      rawPayloadStored: false,
      rawTenantIdStored: false,
      rlsPolicyInstalled: true,
      rlsForced: false,
      debeziumConnectorWired: false,
      productionSharedRuntimeWired: false,
      limitation:
        'Repository-side shared source-history and outbox primitive only: runtime shadow stores, read-model workers, Debezium/event-bus delivery, migration jobs, deployment probes, and production readiness remain unclaimed.',
    });
  });
}

export async function ensureConsequenceSharedHistoryOutboxStore():
Promise<ConsequenceSharedHistoryOutboxSummary> {
  return summary();
}

export async function appendSharedConsequenceHistory(
  input: AppendSharedConsequenceHistoryInput,
): Promise<AppendSharedConsequenceHistoryResult> {
  const tenantId = normalizeOptionalIdentifier(input.tenantId, 'tenantId');
  const environment = normalizeOptionalIdentifier(input.environment, 'environment');
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const sourceKeyDigest = normalizeDigest(input.sourceKeyDigest, 'sourceKeyDigest');
  const sourceDigest = normalizeDigest(input.sourceDigest, 'sourceDigest');
  const payloadDigest = normalizeDigest(input.payloadDigest, 'payloadDigest');
  const payloadSchema = normalizeIdentifier(input.payloadSchema, 'payloadSchema');
  const occurredAt = normalizeIso(input.occurredAt, 'occurredAt');
  const recordedAt = normalizeIso(input.recordedAt ?? new Date().toISOString(), 'recordedAt');
  const artifactRefs = normalizeArtifacts(input.artifactRefs);
  const eventType = normalizeOptionalIdentifier(input.outboxEventType, 'outboxEventType') ??
    defaultOutboxEventType(sourceKind);
  const scopeDigest = tenantScopeDigest({ tenantId, environment });
  const partitionKeyDigest = input.outboxPartitionKeyDigest === null ||
    input.outboxPartitionKeyDigest === undefined
    ? digestValue({
      version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
      purpose: 'outbox-partition',
      tenantScopeDigest: scopeDigest,
      sourceKind,
    } as CanonicalReleaseJsonValue)
    : normalizeDigest(input.outboxPartitionKeyDigest, 'outboxPartitionKeyDigest');

  await ensureTables();
  return withReleaseAuthorityTransaction(async (client) => {
    await setTenantScope(client, scopeDigest);
    await lockTenantScope(client, `consequence-shared-history:${scopeDigest}`);

    const existing = await client.query(
      `SELECT record_json
         FROM ${CONSEQUENCE_SHARED_HISTORY_TABLE}
        WHERE tenant_scope_digest = $1
          AND source_kind = $2
          AND source_key_digest = $3
        LIMIT 1`,
      [scopeDigest, sourceKind, sourceKeyDigest],
    );
    if (existing.rows[0]) {
      const record = recordFromRow(existing.rows[0]);
      return Object.freeze({
        outcome: record.sourceDigest === sourceDigest &&
          record.payloadDigest === payloadDigest
          ? 'duplicate'
          : 'source-conflict',
        record: record.sourceDigest === sourceDigest &&
          record.payloadDigest === payloadDigest
          ? record
          : null,
        outboxMessage: null,
        rawPayloadStored: false,
        rawTenantIdStored: false,
      });
    }

    const sequenceResult = await client.query(
      `SELECT COALESCE(MAX(sequence), 0)::bigint + 1 AS next_sequence
         FROM ${CONSEQUENCE_SHARED_HISTORY_TABLE}
        WHERE tenant_scope_digest = $1`,
      [scopeDigest],
    );
    const sequence = requireInteger(
      sequenceResult.rows[0]?.next_sequence ?? 1,
      'next_sequence',
    );
    const record = buildHistoryRecord({
      scopeDigest,
      sourceKind,
      sourceKeyDigest,
      sourceDigest,
      payloadDigest,
      payloadSchema,
      sequence,
      occurredAt,
      recordedAt,
      artifactRefs,
    });
    const outboxId = outboxIdFor({
      historyId: record.historyId,
      eventType,
      recordDigest: record.recordDigest,
    });
    const eventJson = buildEventJson({
      outboxId,
      record,
      eventType,
      partitionKeyDigest,
    });

    await client.query(
      `INSERT INTO ${CONSEQUENCE_SHARED_HISTORY_TABLE} (
        history_id,
        tenant_scope_digest,
        source_kind,
        source_key_digest,
        source_digest,
        payload_digest,
        payload_schema,
        sequence,
        occurred_at,
        recorded_at,
        artifact_refs_json,
        record_digest,
        record_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11::jsonb, $12, $13::jsonb
      )`,
      [
        record.historyId,
        scopeDigest,
        sourceKind,
        sourceKeyDigest,
        sourceDigest,
        payloadDigest,
        payloadSchema,
        record.sequence,
        record.occurredAt,
        record.recordedAt,
        JSON.stringify(record.artifactRefs),
        record.recordDigest,
        JSON.stringify(record),
      ],
    );

    const outbox = await client.query(
      `INSERT INTO ${CONSEQUENCE_SHARED_OUTBOX_TABLE} (
        outbox_id,
        history_id,
        tenant_scope_digest,
        source_kind,
        source_key_digest,
        event_type,
        partition_key_digest,
        payload_digest,
        record_digest,
        status,
        claim_token,
        claim_worker_digest,
        claimed_at,
        claim_expires_at,
        published_at,
        attempt_count,
        event_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NULL, NULL, NULL, NULL, NULL, 0, $10::jsonb
      )
      RETURNING *`,
      [
        outboxId,
        record.historyId,
        scopeDigest,
        sourceKind,
        sourceKeyDigest,
        eventType,
        partitionKeyDigest,
        payloadDigest,
        record.recordDigest,
        JSON.stringify(eventJson),
      ],
    );

    return Object.freeze({
      outcome: 'recorded',
      record,
      outboxMessage: messageFromRow(outbox.rows[0]!),
      rawPayloadStored: false,
      rawTenantIdStored: false,
    });
  });
}

export async function claimSharedConsequenceOutboxMessages(
  input: ClaimSharedConsequenceOutboxMessagesInput,
): Promise<readonly ConsequenceSharedOutboxMessage[]> {
  const tenantId = normalizeOptionalIdentifier(input.tenantId, 'tenantId');
  const environment = normalizeOptionalIdentifier(input.environment, 'environment');
  const workerId = normalizeIdentifier(input.workerId, 'workerId');
  const limit = normalizePositiveInteger(input.limit, 'limit', 25);
  const leaseSeconds = normalizePositiveInteger(input.leaseSeconds, 'leaseSeconds', 60);
  const now = normalizeIso(input.now ?? new Date().toISOString(), 'now');
  const claimExpiresAt = new Date(new Date(now).getTime() + leaseSeconds * 1000).toISOString();
  const scopeDigest = tenantScopeDigest({ tenantId, environment });
  const workerDigest = digestText(workerId);
  const claimToken = digestValue({
    version: CONSEQUENCE_SHARED_HISTORY_OUTBOX_STORE_VERSION,
    purpose: 'outbox-claim-token',
    workerDigest,
    nonce: randomUUID(),
    claimedAt: now,
  } as CanonicalReleaseJsonValue);

  await ensureTables();
  return withReleaseAuthorityTransaction(async (client) => {
    await setTenantScope(client, scopeDigest);
    const claimed = await client.query(
      `WITH candidates AS (
        SELECT outbox_id
          FROM ${CONSEQUENCE_SHARED_OUTBOX_TABLE}
         WHERE tenant_scope_digest = $1
           AND (
             status IN ('pending', 'failed')
             OR (status = 'claimed' AND claim_expires_at <= $2::timestamptz)
           )
         ORDER BY created_at ASC, outbox_id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $3
      )
      UPDATE ${CONSEQUENCE_SHARED_OUTBOX_TABLE} outbox
         SET status = 'claimed',
             claim_token = $4,
             claim_worker_digest = $5,
             claimed_at = $2::timestamptz,
             claim_expires_at = $6::timestamptz,
             attempt_count = outbox.attempt_count + 1
       WHERE outbox.outbox_id IN (SELECT outbox_id FROM candidates)
      RETURNING outbox.*`,
      [scopeDigest, now, limit, claimToken, workerDigest, claimExpiresAt],
    );
    return Object.freeze(claimed.rows.map(messageFromRow));
  });
}

export async function publishSharedConsequenceOutboxMessage(
  input: PublishSharedConsequenceOutboxMessageInput,
): Promise<PublishSharedConsequenceOutboxMessageResult> {
  const tenantId = normalizeOptionalIdentifier(input.tenantId, 'tenantId');
  const environment = normalizeOptionalIdentifier(input.environment, 'environment');
  const outboxId = normalizeDigest(input.outboxId, 'outboxId');
  const claimToken = normalizeDigest(input.claimToken, 'claimToken');
  const publishedAt = normalizeIso(input.publishedAt ?? new Date().toISOString(), 'publishedAt');
  const scopeDigest = tenantScopeDigest({ tenantId, environment });

  await ensureTables();
  return withReleaseAuthorityTransaction(async (client) => {
    await setTenantScope(client, scopeDigest);
    const updated = await client.query(
      `UPDATE ${CONSEQUENCE_SHARED_OUTBOX_TABLE}
          SET status = 'published',
              published_at = $4::timestamptz
        WHERE tenant_scope_digest = $1
          AND outbox_id = $2
          AND claim_token = $3
          AND status = 'claimed'
      RETURNING *`,
      [scopeDigest, outboxId, claimToken, publishedAt],
    );
    if (!updated.rows[0]) {
      return Object.freeze({
        outcome: 'not-claimed',
        message: null,
      });
    }
    return Object.freeze({
      outcome: 'published',
      message: messageFromRow(updated.rows[0]),
    });
  });
}

export async function resetConsequenceSharedHistoryOutboxStoreForTests():
Promise<void> {
  initPromise = null;
  await resetReleaseAuthorityStoreForTests();
}
