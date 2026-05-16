import {
  CONSEQUENCE_SHARED_STORE_COMPONENTS,
  type ConsequenceSharedStoreComponentId,
  type ConsequenceSharedStoreEvidenceRole,
  type ConsequenceSharedStoreOperationalProofKind,
  type ConsequenceSharedStoreRequiredPrimitive,
} from './consequence-shared-store-profile.js';
import type { ProductionStorageMode } from './production-storage-path.js';

export const CONSEQUENCE_SHARED_STORE_INVENTORY_VERSION =
  'attestor.consequence-shared-store-inventory.v1';

export type ConsequenceSharedStoreInventorySurfaceId =
  | ConsequenceSharedStoreComponentId
  | 'dashboard-api-summary'
  | 'downstream-execution-receipt'
  | 'tamper-evident-history'
  | 'crypto-execution-admission-telemetry-receipts';

export type ConsequenceSharedStoreInventoryPlane =
  | 'consequence-admission-plane'
  | 'policy-foundry-plane'
  | 'audit-read-model'
  | 'domain-adapter-projection';

export type ConsequenceSharedStoreInventoryMode =
  | ProductionStorageMode
  | 'contract-only'
  | 'derived-view'
  | 'local-ephemeral-sink';

export type ConsequenceSharedStoreInventoryPrimitive =
  | ConsequenceSharedStoreRequiredPrimitive
  | 'tenant-scoped-receipt-history'
  | 'tenant-scoped-tamper-evident-history'
  | 'domain-adapter-event-history';

export type ConsequenceSharedStoreInventorySlice =
  | '08-atomic-replay-idempotency'
  | '09-append-only-history-outbox'
  | '09-read-model-source-history'
  | '13-plus-domain-adapter-projection'
  | 'profile-only-existing-shared-path';

export type ConsequenceSharedStoreInventoryBlockerCode =
  | 'file-backed-evaluation-history'
  | 'in-memory-reference-ledger'
  | 'derived-evaluation-read-model'
  | 'contract-only-receipt-history'
  | 'local-ephemeral-domain-events'
  | 'shared-operational-proof-missing';

export type ConsequenceSharedStoreInventoryNoGo =
  | 'do-not-clear-production-shared-before-profile-components-are-shared'
  | 'do-not-store-raw-payloads-or-provider-bodies'
  | 'do-not-split-crypto-into-a-separate-store-engine'
  | 'do-not-claim-outbox-delivery-without-a-wired-connector'
  | 'do-not-use-shared-database-without-tenant-and-idempotency-proof';

export interface ConsequenceSharedStoreInventoryItem {
  readonly id: ConsequenceSharedStoreInventorySurfaceId;
  readonly label: string;
  readonly plane: ConsequenceSharedStoreInventoryPlane;
  readonly evidenceRole: ConsequenceSharedStoreEvidenceRole | 'receipt-history' | 'domain-event-history';
  readonly currentMode: ConsequenceSharedStoreInventoryMode;
  readonly requiredPrimitive: ConsequenceSharedStoreInventoryPrimitive;
  readonly requiredOperationalProofs: readonly ConsequenceSharedStoreOperationalProofKind[];
  readonly profileComponent: ConsequenceSharedStoreComponentId | null;
  readonly migrationSlice: ConsequenceSharedStoreInventorySlice;
  readonly blocksProductionShared: boolean;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly cryptoCompatible: boolean;
  readonly repositoryEvidence: readonly string[];
  readonly blockerCodes: readonly ConsequenceSharedStoreInventoryBlockerCode[];
  readonly nextContract: string;
}

type ConsequenceSharedStoreInventoryItemInput = Omit<
  ConsequenceSharedStoreInventoryItem,
  'productionReady' | 'rawPayloadStored'
>;

export interface ConsequenceSharedStoreInventoryEvaluation {
  readonly version: typeof CONSEQUENCE_SHARED_STORE_INVENTORY_VERSION;
  readonly evaluatedAt: string;
  readonly productionReady: false;
  readonly activatesStorageMigration: false;
  readonly rawPayloadStored: false;
  readonly profileCoverageComplete: boolean;
  readonly totalItems: number;
  readonly profileComponentCount: number;
  readonly productionBlockingItemIds: readonly ConsequenceSharedStoreInventorySurfaceId[];
  readonly firstPrItemIds: readonly ConsequenceSharedStoreInventorySurfaceId[];
  readonly secondPrItemIds: readonly ConsequenceSharedStoreInventorySurfaceId[];
  readonly domainProjectionItemIds: readonly ConsequenceSharedStoreInventorySurfaceId[];
  readonly missingProfileComponentIds: readonly ConsequenceSharedStoreComponentId[];
  readonly items: readonly ConsequenceSharedStoreInventoryItem[];
  readonly noGoConditions: readonly ConsequenceSharedStoreInventoryNoGo[];
  readonly recommendedNextPr: '08-atomic-replay-idempotency';
  readonly limitation: string;
}

const BASE_PROOFS = Object.freeze([
  'schema-digest',
  'tenant-scope-digest',
] as const satisfies readonly ConsequenceSharedStoreOperationalProofKind[]);

function proofs(
  extra: readonly ConsequenceSharedStoreOperationalProofKind[],
): readonly ConsequenceSharedStoreOperationalProofKind[] {
  return Object.freeze([...BASE_PROOFS, ...extra]);
}

const APPEND_ONLY_PROOFS = proofs(['outbox-contract-digest']);
const ATOMIC_PROOFS = proofs(['idempotency-constraint-digest']);
const TTL_SESSION_PROOFS = proofs(['advisory-lock-keyspace-digest']);
const COUNTER_PROOFS = proofs([
  'idempotency-constraint-digest',
  'advisory-lock-keyspace-digest',
]);
const READ_MODEL_PROOFS = proofs([
  'outbox-contract-digest',
  'worker-claim-query-digest',
]);

function item(input: ConsequenceSharedStoreInventoryItemInput):
ConsequenceSharedStoreInventoryItem {
  return Object.freeze({
    ...input,
    productionReady: false,
    rawPayloadStored: false,
  });
}

export const CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS = Object.freeze([
  item({
    id: 'shadow-admission-events',
    label: 'Shadow admission event history',
    plane: 'consequence-admission-plane',
    evidenceRole: 'consequence-history',
    currentMode: 'file-backed-evaluation',
    requiredPrimitive: 'tenant-scoped-append-only-history',
    requiredOperationalProofs: APPEND_ONLY_PROOFS,
    profileComponent: 'shadow-admission-events',
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/service/shadow-persistence-store.ts',
      'tests/shadow-persistence-store.test.ts',
      'docs/02-architecture/shadow-persistence-stores.md',
    ]),
    blockerCodes: Object.freeze([
      'file-backed-evaluation-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Shared append-only table keyed by tenant, event digest, and sequence with outbox export digest.',
  }),
  item({
    id: 'shadow-policy-simulations',
    label: 'Shadow policy simulation reports',
    plane: 'consequence-admission-plane',
    evidenceRole: 'consequence-history',
    currentMode: 'file-backed-evaluation',
    requiredPrimitive: 'tenant-scoped-append-only-history',
    requiredOperationalProofs: APPEND_ONLY_PROOFS,
    profileComponent: 'shadow-policy-simulations',
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/service/shadow-persistence-store.ts',
      'tests/shadow-policy-simulation.test.ts',
      'docs/02-architecture/shadow-policy-simulation.md',
    ]),
    blockerCodes: Object.freeze([
      'file-backed-evaluation-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Append-only simulation report history with source-event digest set and replay window digest.',
  }),
  item({
    id: 'shadow-policy-candidates',
    label: 'Policy discovery candidate lifecycle',
    plane: 'policy-foundry-plane',
    evidenceRole: 'consequence-history',
    currentMode: 'file-backed-evaluation',
    requiredPrimitive: 'tenant-scoped-append-only-history',
    requiredOperationalProofs: APPEND_ONLY_PROOFS,
    profileComponent: 'shadow-policy-candidates',
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/service/shadow-persistence-store.ts',
      'src/consequence-admission/policy-discovery-candidates.ts',
      'src/consequence-admission/policy-foundry-candidate-registry.ts',
      'tests/policy-discovery-candidates.test.ts',
      'tests/policy-foundry-candidate-registry.test.ts',
    ]),
    blockerCodes: Object.freeze([
      'file-backed-evaluation-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Approval-gated candidate lifecycle table with immutable generated evidence and status-change history.',
  }),
  item({
    id: 'shadow-activation-receipts',
    label: 'Customer activation receipt history',
    plane: 'consequence-admission-plane',
    evidenceRole: 'consequence-history',
    currentMode: 'file-backed-evaluation',
    requiredPrimitive: 'tenant-scoped-append-only-history',
    requiredOperationalProofs: APPEND_ONLY_PROOFS,
    profileComponent: 'shadow-activation-receipts',
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/service/shadow-persistence-store.ts',
      'src/consequence-admission/shadow-customer-activation-receipt.ts',
      'tests/shadow-customer-activation-receipt.test.ts',
    ]),
    blockerCodes: Object.freeze([
      'file-backed-evaluation-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Receipt append table bound to tenant, source handoff digest, activation status, and rollback status.',
  }),
  item({
    id: 'policy-foundry-hosted-wizard-state',
    label: 'Policy Foundry hosted wizard resume state',
    plane: 'policy-foundry-plane',
    evidenceRole: 'hosted-session-state',
    currentMode: 'file-backed-evaluation',
    requiredPrimitive: 'tenant-scoped-ttl-session-state',
    requiredOperationalProofs: TTL_SESSION_PROOFS,
    profileComponent: 'policy-foundry-hosted-wizard-state',
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/service/policy-foundry-hosted-wizard-state.ts',
      'tests/policy-foundry-hosted-wizard-state.test.ts',
    ]),
    blockerCodes: Object.freeze([
      'file-backed-evaluation-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Shared TTL session store with tenant-bound lookup, digest-only review state, and lock keyspace proof.',
  }),
  item({
    id: 'retry-attempt-ledger',
    label: 'Safe retry attempt ledger',
    plane: 'consequence-admission-plane',
    evidenceRole: 'atomic-ledger',
    currentMode: 'in-memory-reference',
    requiredPrimitive: 'atomic-record-if-absent',
    requiredOperationalProofs: ATOMIC_PROOFS,
    profileComponent: 'retry-attempt-ledger',
    migrationSlice: '08-atomic-replay-idempotency',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/retry-attempt-ledger.ts',
      'tests/retry-attempt-ledger.test.ts',
      'docs/02-architecture/retry-attempt-ledger.md',
    ]),
    blockerCodes: Object.freeze([
      'in-memory-reference-ledger',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'First-writer-wins insert for retryAttemptId plus idempotency-key digest within tenant/admission scope.',
  }),
  item({
    id: 'presentation-replay-ledger',
    label: 'Single-use downstream presentation replay ledger',
    plane: 'consequence-admission-plane',
    evidenceRole: 'atomic-ledger',
    currentMode: 'in-memory-reference',
    requiredPrimitive: 'atomic-set-if-absent',
    requiredOperationalProofs: ATOMIC_PROOFS,
    profileComponent: 'presentation-replay-ledger',
    migrationSlice: '08-atomic-replay-idempotency',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/presentation-replay-ledger.ts',
      'tests/presentation-replay-ledger.test.ts',
      'docs/02-architecture/presentation-replay-ledger.md',
    ]),
    blockerCodes: Object.freeze([
      'in-memory-reference-ledger',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Atomic consume table keyed by tenant and replay-key digest with retention and duplicate-consume proof.',
  }),
  item({
    id: 'agent-loop-abuse-guard',
    label: 'Agent retry-loop abuse guard',
    plane: 'consequence-admission-plane',
    evidenceRole: 'shared-counter',
    currentMode: 'in-memory-reference',
    requiredPrimitive: 'atomic-counter-and-signature-set',
    requiredOperationalProofs: COUNTER_PROOFS,
    profileComponent: 'agent-loop-abuse-guard',
    migrationSlice: 'profile-only-existing-shared-path',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/agent-loop-abuse-guard.ts',
      'src/service/agent-loop-abuse-guard.ts',
      'tests/consequence-admission-agent-loop-abuse-guard-shared.test.ts',
    ]),
    blockerCodes: Object.freeze([
      'in-memory-reference-ledger',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Keep Redis/shared-counter path but require schema, tenant scope, idempotency, and lock/keyspace proof in production-shared.',
  }),
  item({
    id: 'audit-evidence-export',
    label: 'Audit evidence export source set',
    plane: 'audit-read-model',
    evidenceRole: 'read-model-source',
    currentMode: 'derived-evaluation',
    requiredPrimitive: 'shared-source-history',
    requiredOperationalProofs: READ_MODEL_PROOFS,
    profileComponent: 'audit-evidence-export',
    migrationSlice: '09-read-model-source-history',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/audit-evidence-export.ts',
      'tests/consequence-audit-evidence-export.test.ts',
      'docs/02-architecture/audit-evidence-export.md',
    ]),
    blockerCodes: Object.freeze([
      'derived-evaluation-read-model',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Read model must derive from shared append-only source history, not local evaluation objects.',
  }),
  item({
    id: 'business-risk-dashboard',
    label: 'Business risk dashboard source set',
    plane: 'audit-read-model',
    evidenceRole: 'read-model-source',
    currentMode: 'derived-evaluation',
    requiredPrimitive: 'shared-source-history',
    requiredOperationalProofs: READ_MODEL_PROOFS,
    profileComponent: 'business-risk-dashboard',
    migrationSlice: '09-read-model-source-history',
    blocksProductionShared: true,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/business-risk-dashboard.ts',
      'tests/consequence-business-risk-dashboard.test.ts',
      'docs/02-architecture/business-risk-dashboard.md',
    ]),
    blockerCodes: Object.freeze([
      'derived-evaluation-read-model',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Dashboard must read from shared source history with worker claim/query proof before it supports production-shared claims.',
  }),
  item({
    id: 'dashboard-api-summary',
    label: 'Dashboard API summary projection',
    plane: 'audit-read-model',
    evidenceRole: 'read-model-source',
    currentMode: 'derived-view',
    requiredPrimitive: 'shared-source-history',
    requiredOperationalProofs: READ_MODEL_PROOFS,
    profileComponent: null,
    migrationSlice: '09-read-model-source-history',
    blocksProductionShared: false,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/dashboard-api-summary.ts',
      'tests/consequence-dashboard-api-summary.test.ts',
      'docs/02-architecture/dashboard-api-summary.md',
    ]),
    blockerCodes: Object.freeze([
      'derived-evaluation-read-model',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Projection stays non-authoritative and must cite shared source histories for every count and recommendation.',
  }),
  item({
    id: 'downstream-execution-receipt',
    label: 'Downstream execution receipt',
    plane: 'consequence-admission-plane',
    evidenceRole: 'receipt-history',
    currentMode: 'contract-only',
    requiredPrimitive: 'tenant-scoped-receipt-history',
    requiredOperationalProofs: proofs([
      'idempotency-constraint-digest',
      'outbox-contract-digest',
    ]),
    profileComponent: null,
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: false,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/downstream-execution-receipt.ts',
      'tests/downstream-execution-receipt.test.ts',
      'docs/02-architecture/downstream-execution-receipt.md',
    ]),
    blockerCodes: Object.freeze([
      'contract-only-receipt-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Persist consequence result receipts once replay consumption closes, using digest-only external result refs.',
  }),
  item({
    id: 'tamper-evident-history',
    label: 'Tamper-evident consequence history',
    plane: 'consequence-admission-plane',
    evidenceRole: 'consequence-history',
    currentMode: 'contract-only',
    requiredPrimitive: 'tenant-scoped-tamper-evident-history',
    requiredOperationalProofs: APPEND_ONLY_PROOFS,
    profileComponent: null,
    migrationSlice: '09-append-only-history-outbox',
    blocksProductionShared: false,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/consequence-admission/tamper-evident-history.ts',
      'tests/consequence-tamper-evident-history.test.ts',
      'docs/02-architecture/tamper-evident-history.md',
    ]),
    blockerCodes: Object.freeze([
      'contract-only-receipt-history',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Digest-chain table that links source event, receipt, and read-model artifact roots per tenant.',
  }),
  item({
    id: 'crypto-execution-admission-telemetry-receipts',
    label: 'Crypto execution-admission telemetry and receipts',
    plane: 'domain-adapter-projection',
    evidenceRole: 'domain-event-history',
    currentMode: 'local-ephemeral-sink',
    requiredPrimitive: 'domain-adapter-event-history',
    requiredOperationalProofs: READ_MODEL_PROOFS,
    profileComponent: null,
    migrationSlice: '13-plus-domain-adapter-projection',
    blocksProductionShared: false,
    cryptoCompatible: true,
    repositoryEvidence: Object.freeze([
      'src/crypto-execution-admission/telemetry-receipts.ts',
      'tests/crypto-execution-admission-telemetry-receipts.test.ts',
      'docs/02-architecture/crypto-execution-admission-buildout.md',
    ]),
    blockerCodes: Object.freeze([
      'local-ephemeral-domain-events',
      'shared-operational-proof-missing',
    ]),
    nextContract:
      'Crypto remains a domain adapter: route telemetry and receipts into the same shared event/receipt history, not a separate store engine.',
  }),
] as const);

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

export function evaluateConsequenceSharedStoreInventory(input: {
  readonly evaluatedAt?: string | null;
} = {}): ConsequenceSharedStoreInventoryEvaluation {
  const items = CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS;
  const itemIds = new Set<ConsequenceSharedStoreInventorySurfaceId>(
    items.map((candidate) => candidate.id),
  );
  const missingProfileComponentIds = Object.freeze(
    CONSEQUENCE_SHARED_STORE_COMPONENTS.filter((id) => !itemIds.has(id)),
  );
  const profileCoverageComplete = missingProfileComponentIds.length === 0;

  return Object.freeze({
    version: CONSEQUENCE_SHARED_STORE_INVENTORY_VERSION,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    productionReady: false,
    activatesStorageMigration: false,
    rawPayloadStored: false,
    profileCoverageComplete,
    totalItems: items.length,
    profileComponentCount: items.filter((candidate) => candidate.profileComponent !== null).length,
    productionBlockingItemIds: unique(
      items
        .filter((candidate) => candidate.blocksProductionShared)
        .map((candidate) => candidate.id),
    ),
    firstPrItemIds: unique(
      items
        .filter((candidate) => candidate.migrationSlice === '08-atomic-replay-idempotency')
        .map((candidate) => candidate.id),
    ),
    secondPrItemIds: unique(
      items
        .filter((candidate) =>
          candidate.migrationSlice === '09-append-only-history-outbox' ||
          candidate.migrationSlice === '09-read-model-source-history')
        .map((candidate) => candidate.id),
    ),
    domainProjectionItemIds: unique(
      items
        .filter((candidate) => candidate.plane === 'domain-adapter-projection')
        .map((candidate) => candidate.id),
    ),
    missingProfileComponentIds,
    items,
    noGoConditions: Object.freeze([
      'do-not-clear-production-shared-before-profile-components-are-shared',
      'do-not-store-raw-payloads-or-provider-bodies',
      'do-not-split-crypto-into-a-separate-store-engine',
      'do-not-claim-outbox-delivery-without-a-wired-connector',
      'do-not-use-shared-database-without-tenant-and-idempotency-proof',
    ] as const),
    recommendedNextPr: '08-atomic-replay-idempotency',
    limitation:
      'Inventory only: this contract selects the next shared-store slices, but it does not create schemas, migrate file histories, run workers, configure Redis/PostgreSQL, or prove production readiness.',
  });
}
