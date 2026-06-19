import { RELEASE_AUTHORITY_SCHEMA } from './release/release-authority-store.js';

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
  readonly rlsForced: true;
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

export const SCHEMA_CONTRACT = `
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

export const TENANT_SCOPE_CONTRACT = `
tenant_scope_digest = sha256({version, tenantId|null, environment|null});
RLS policies compare tenant_scope_digest to current_setting('attestor.tenant_scope_digest', true).
RLS is enabled and forced for table owners; superusers and BYPASSRLS roles still bypass PostgreSQL RLS.
Raw tenant ids and raw environment labels are not stored in history or outbox rows.
`;

export const OUTBOX_CONTRACT = `
appendSharedConsequenceHistory:
  one transaction
  tenant-scope advisory lock
  append-only source history row
  exactly one pending outbox message for the history row
  no connector, Debezium, or event-bus delivery claim
`;

export const WORKER_CLAIM_QUERY_CONTRACT = `
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

export const ADVISORY_LOCK_KEYSPACE_CONTRACT = `
pg_advisory_xact_lock(sha256("consequence-shared-history:" + tenant_scope_digest)[0..8])
serializes per-tenant append sequence allocation without storing raw tenant ids.
`;

export const COMPONENTS = Object.freeze([
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
