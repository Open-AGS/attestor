import {
  evaluateProductionStoragePath,
  type EvaluateProductionStoragePathInput,
  type ProductionStoragePathBlocker,
  type ProductionStoragePathComponent,
  type ProductionStoragePathComponentId,
  type ProductionStoragePathEvaluation,
} from './production-storage-path.js';

export const CONSEQUENCE_SHARED_STORE_PROFILE_SPEC_VERSION =
  'attestor.consequence-shared-store-profile.v1';

export const CONSEQUENCE_SHARED_STORE_COMPONENTS = Object.freeze([
  'shadow-admission-events',
  'shadow-policy-simulations',
  'shadow-policy-candidates',
  'shadow-activation-receipts',
  'generic-admission-access-requests',
  'policy-foundry-hosted-wizard-state',
  'retry-attempt-ledger',
  'presentation-replay-ledger',
  'agent-loop-abuse-guard',
  'audit-evidence-export',
  'business-risk-dashboard',
] as const satisfies readonly ProductionStoragePathComponentId[]);

export const CONSEQUENCE_SHARED_STORE_AUTHORITY_COMPONENTS = Object.freeze([
  'control-plane-state',
  'release-authority-state',
] as const satisfies readonly ProductionStoragePathComponentId[]);

export type ConsequenceSharedStoreComponentId =
  typeof CONSEQUENCE_SHARED_STORE_COMPONENTS[number];

export type ConsequenceSharedStoreEvidenceRole =
  | 'consequence-history'
  | 'hosted-session-state'
  | 'atomic-ledger'
  | 'shared-counter'
  | 'read-model-source';

export type ConsequenceSharedStoreRequiredPrimitive =
  | 'tenant-scoped-append-only-history'
  | 'tenant-scoped-ttl-session-state'
  | 'atomic-record-if-absent'
  | 'atomic-set-if-absent'
  | 'atomic-counter-and-signature-set'
  | 'shared-source-history';

export type ConsequenceSharedStoreOperationalProofKind =
  | 'schema-digest'
  | 'tenant-scope-digest'
  | 'idempotency-constraint-digest'
  | 'outbox-contract-digest'
  | 'worker-claim-query-digest'
  | 'advisory-lock-keyspace-digest';

export type ConsequenceSharedStoreOperationalBlockerCode =
  | 'shared-store-schema-digest-required'
  | 'shared-store-tenant-scope-digest-required'
  | 'shared-store-idempotency-constraint-digest-required'
  | 'shared-store-outbox-contract-digest-required'
  | 'shared-store-worker-claim-query-digest-required'
  | 'shared-store-advisory-lock-keyspace-digest-required'
  | 'shared-store-raw-payload-storage-risk'
  | 'shared-store-connection-string-exposure-risk';

export type ConsequenceSharedStoreNoGoCondition =
  | 'shared-authority-substrate-missing'
  | 'file-backed-evaluation-history'
  | 'in-memory-reference-ledger'
  | 'derived-evaluation-read-model'
  | 'shared-durable-backend-not-proven'
  | 'shared-store-operational-evidence-not-proven'
  | 'shared-store-raw-payload-storage-risk'
  | 'shared-store-connection-string-exposure-risk';

export type ConsequenceSharedStoreProfileState =
  | 'evaluation-shared-store-backlog-accepted'
  | 'production-shared-consequence-blocked'
  | 'production-shared-consequence-ready';

interface ConsequenceSharedStoreRequirement {
  readonly evidenceRole: ConsequenceSharedStoreEvidenceRole;
  readonly requiredStorePrimitive: ConsequenceSharedStoreRequiredPrimitive;
}

export interface ConsequenceSharedStoreOperationalEvidence {
  readonly component: ConsequenceSharedStoreComponentId;
  readonly schemaDigest?: string | null;
  readonly tenantScopeDigest?: string | null;
  readonly idempotencyConstraintDigest?: string | null;
  readonly outboxContractDigest?: string | null;
  readonly workerClaimQueryDigest?: string | null;
  readonly advisoryLockKeyspaceDigest?: string | null;
  readonly rawPayloadStored?: boolean | null;
  readonly exposesConnectionStrings?: boolean | null;
}

export interface ConsequenceSharedStoreOperationalBlocker {
  readonly code: ConsequenceSharedStoreOperationalBlockerCode;
  readonly component: ConsequenceSharedStoreComponentId;
  readonly proof: ConsequenceSharedStoreOperationalProofKind | null;
  readonly message: string;
}

export type ConsequenceSharedStoreProfileBlocker =
  | ProductionStoragePathBlocker
  | ConsequenceSharedStoreOperationalBlocker;

export interface ConsequenceSharedStoreProfileComponent
  extends ProductionStoragePathComponent {
  readonly evidenceRole: ConsequenceSharedStoreEvidenceRole;
  readonly requiredStorePrimitive: ConsequenceSharedStoreRequiredPrimitive;
  readonly requiredOperationalProofs: readonly ConsequenceSharedStoreOperationalProofKind[];
  readonly operationalEvidenceReady: boolean;
  readonly operationalBlockers: readonly ConsequenceSharedStoreOperationalBlocker[];
  readonly noGoCondition: ConsequenceSharedStoreNoGoCondition | null;
}

export interface ConsequenceSharedStoreProfile {
  readonly version: typeof CONSEQUENCE_SHARED_STORE_PROFILE_SPEC_VERSION;
  readonly productionStoragePathVersion: ProductionStoragePathEvaluation['version'];
  readonly evaluatedAt: string;
  readonly runtimeProfileId: ProductionStoragePathEvaluation['runtimeProfileId'];
  readonly state: ConsequenceSharedStoreProfileState;
  readonly storagePathState: ProductionStoragePathEvaluation['state'];
  readonly readyForSelectedProfile: boolean;
  readonly productionReady: boolean;
  readonly authorityStoreReady: boolean;
  readonly consequenceStoreReady: boolean;
  readonly operationalEvidenceReady: boolean;
  readonly rawPayloadStored: false;
  readonly exposesConnectionStrings: false;
  readonly activatesStorageMigration: false;
  readonly authorityComponents: readonly ProductionStoragePathComponent[];
  readonly components: readonly ConsequenceSharedStoreProfileComponent[];
  readonly backlogComponentIds: readonly ProductionStoragePathComponentId[];
  readonly operationalBlockingComponentIds: readonly ConsequenceSharedStoreComponentId[];
  readonly blockingComponentIds: readonly ProductionStoragePathComponentId[];
  readonly blockers: readonly ConsequenceSharedStoreProfileBlocker[];
  readonly storageBlockers: readonly ProductionStoragePathBlocker[];
  readonly operationalBlockers: readonly ConsequenceSharedStoreOperationalBlocker[];
  readonly noGoConditions: readonly ConsequenceSharedStoreNoGoCondition[];
  readonly requiredProofs: readonly string[];
  readonly limitation: string;
}

export interface EvaluateConsequenceSharedStoreProfileInput
  extends EvaluateProductionStoragePathInput {
  readonly productionStoragePath?: ProductionStoragePathEvaluation | null;
  readonly operationalEvidence?: readonly ConsequenceSharedStoreOperationalEvidence[] | null;
}

const REQUIRED_PROOFS = Object.freeze([
  'npm run test:consequence-shared-store-profile',
  'npm run test:production-storage-path',
  'npm run test:retry-attempt-ledger',
  'npm run test:presentation-replay-ledger',
  'npm run test:agent-loop-abuse-guard-shared',
  'GET /api/v1/ready',
] as const);

const COMPONENT_REQUIREMENTS: Readonly<
  Record<ConsequenceSharedStoreComponentId, ConsequenceSharedStoreRequirement>
> = Object.freeze({
  'shadow-admission-events': Object.freeze({
    evidenceRole: 'consequence-history',
    requiredStorePrimitive: 'tenant-scoped-append-only-history',
  }),
  'shadow-policy-simulations': Object.freeze({
    evidenceRole: 'consequence-history',
    requiredStorePrimitive: 'tenant-scoped-append-only-history',
  }),
  'shadow-policy-candidates': Object.freeze({
    evidenceRole: 'consequence-history',
    requiredStorePrimitive: 'tenant-scoped-append-only-history',
  }),
  'shadow-activation-receipts': Object.freeze({
    evidenceRole: 'consequence-history',
    requiredStorePrimitive: 'tenant-scoped-append-only-history',
  }),
  'generic-admission-access-requests': Object.freeze({
    evidenceRole: 'hosted-session-state',
    requiredStorePrimitive: 'tenant-scoped-ttl-session-state',
  }),
  'policy-foundry-hosted-wizard-state': Object.freeze({
    evidenceRole: 'hosted-session-state',
    requiredStorePrimitive: 'tenant-scoped-ttl-session-state',
  }),
  'retry-attempt-ledger': Object.freeze({
    evidenceRole: 'atomic-ledger',
    requiredStorePrimitive: 'atomic-record-if-absent',
  }),
  'presentation-replay-ledger': Object.freeze({
    evidenceRole: 'atomic-ledger',
    requiredStorePrimitive: 'atomic-set-if-absent',
  }),
  'agent-loop-abuse-guard': Object.freeze({
    evidenceRole: 'shared-counter',
    requiredStorePrimitive: 'atomic-counter-and-signature-set',
  }),
  'audit-evidence-export': Object.freeze({
    evidenceRole: 'read-model-source',
    requiredStorePrimitive: 'shared-source-history',
  }),
  'business-risk-dashboard': Object.freeze({
    evidenceRole: 'read-model-source',
    requiredStorePrimitive: 'shared-source-history',
  }),
});

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

type OperationalEvidenceDigestField =
  | 'schemaDigest'
  | 'tenantScopeDigest'
  | 'idempotencyConstraintDigest'
  | 'outboxContractDigest'
  | 'workerClaimQueryDigest'
  | 'advisoryLockKeyspaceDigest';

const OPERATIONAL_PROOF_FIELDS: Readonly<
  Record<ConsequenceSharedStoreOperationalProofKind, OperationalEvidenceDigestField>
> = Object.freeze({
  'schema-digest': 'schemaDigest',
  'tenant-scope-digest': 'tenantScopeDigest',
  'idempotency-constraint-digest': 'idempotencyConstraintDigest',
  'outbox-contract-digest': 'outboxContractDigest',
  'worker-claim-query-digest': 'workerClaimQueryDigest',
  'advisory-lock-keyspace-digest': 'advisoryLockKeyspaceDigest',
});

const OPERATIONAL_PROOF_BLOCKER_CODES: Readonly<
  Record<
    ConsequenceSharedStoreOperationalProofKind,
    ConsequenceSharedStoreOperationalBlockerCode
  >
> = Object.freeze({
  'schema-digest': 'shared-store-schema-digest-required',
  'tenant-scope-digest': 'shared-store-tenant-scope-digest-required',
  'idempotency-constraint-digest': 'shared-store-idempotency-constraint-digest-required',
  'outbox-contract-digest': 'shared-store-outbox-contract-digest-required',
  'worker-claim-query-digest': 'shared-store-worker-claim-query-digest-required',
  'advisory-lock-keyspace-digest': 'shared-store-advisory-lock-keyspace-digest-required',
});

const OPERATIONAL_PROOF_MESSAGES: Readonly<
  Record<ConsequenceSharedStoreOperationalProofKind, string>
> = Object.freeze({
  'schema-digest':
    'Production-shared needs a digest of the shared schema or migration contract for this consequence store.',
  'tenant-scope-digest':
    'Production-shared needs a digest of the tenant-scope/RLS boundary for this consequence store.',
  'idempotency-constraint-digest':
    'Production-shared needs a digest of the ON CONFLICT or equivalent atomic idempotency constraint.',
  'outbox-contract-digest':
    'Production-shared needs a digest of the append-only outbox/event-export contract.',
  'worker-claim-query-digest':
    'Production-shared needs a digest of the SKIP LOCKED worker-claim query or equivalent multi-worker claim primitive.',
  'advisory-lock-keyspace-digest':
    'Production-shared needs a digest of the advisory-lock keyspace or equivalent shared coordination primitive.',
});

const BASE_OPERATIONAL_PROOFS = Object.freeze([
  'schema-digest',
  'tenant-scope-digest',
] as const satisfies readonly ConsequenceSharedStoreOperationalProofKind[]);

const OPERATIONAL_PROOF_REQUIREMENTS: Readonly<
  Record<
    ConsequenceSharedStoreRequiredPrimitive,
    readonly ConsequenceSharedStoreOperationalProofKind[]
  >
> = Object.freeze({
  'tenant-scoped-append-only-history': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'outbox-contract-digest',
  ] as const),
  'tenant-scoped-ttl-session-state': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'advisory-lock-keyspace-digest',
  ] as const),
  'atomic-record-if-absent': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'idempotency-constraint-digest',
  ] as const),
  'atomic-set-if-absent': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'idempotency-constraint-digest',
  ] as const),
  'atomic-counter-and-signature-set': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'idempotency-constraint-digest',
    'advisory-lock-keyspace-digest',
  ] as const),
  'shared-source-history': Object.freeze([
    ...BASE_OPERATIONAL_PROOFS,
    'outbox-contract-digest',
    'worker-claim-query-digest',
  ] as const),
});

function componentById(
  evaluation: ProductionStoragePathEvaluation,
  id: ProductionStoragePathComponentId,
): ProductionStoragePathComponent {
  const component = evaluation.components.find((candidate) => candidate.component === id);
  if (!component) {
    throw new Error(`Consequence shared-store profile requires storage component: ${id}.`);
  }
  return component;
}

function noGoFor(
  component: ProductionStoragePathComponent,
): ConsequenceSharedStoreNoGoCondition | null {
  if (component.satisfiesProductionShared) return null;
  if (
    component.component === 'control-plane-state' ||
    component.component === 'release-authority-state' ||
    component.currentMode === 'disabled'
  ) {
    return 'shared-authority-substrate-missing';
  }
  if (component.currentMode === 'in-memory-reference') {
    return 'in-memory-reference-ledger';
  }
  if (component.currentMode === 'derived-evaluation') {
    return 'derived-evaluation-read-model';
  }
  if (
    component.currentMode === 'file-backed-evaluation' ||
    component.currentMode === 'file-backed-durable'
  ) {
    return 'file-backed-evaluation-history';
  }
  return 'shared-durable-backend-not-proven';
}

function hasDigestProof(value: string | null | undefined): boolean {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

function operationalEvidenceByComponent(
  evidence: readonly ConsequenceSharedStoreOperationalEvidence[] | null | undefined,
): ReadonlyMap<ConsequenceSharedStoreComponentId, ConsequenceSharedStoreOperationalEvidence> {
  const indexed = new Map<
    ConsequenceSharedStoreComponentId,
    ConsequenceSharedStoreOperationalEvidence
  >();
  for (const item of evidence ?? []) {
    indexed.set(item.component, item);
  }
  return indexed;
}

function operationalBlockersFor(
  component: ProductionStoragePathComponent,
  requirement: ConsequenceSharedStoreRequirement,
  evidence: ConsequenceSharedStoreOperationalEvidence | undefined,
): readonly ConsequenceSharedStoreOperationalBlocker[] {
  if (!component.satisfiesProductionShared) return Object.freeze([]);

  const componentId = component.component as ConsequenceSharedStoreComponentId;
  const blockers: ConsequenceSharedStoreOperationalBlocker[] = [];

  if (evidence?.rawPayloadStored === true) {
    blockers.push(Object.freeze({
      code: 'shared-store-raw-payload-storage-risk',
      component: componentId,
      proof: null,
      message:
        'Production-shared consequence stores must stay digest-first and cannot prove readiness while raw payload storage is reported.',
    }));
  }

  if (evidence?.exposesConnectionStrings === true) {
    blockers.push(Object.freeze({
      code: 'shared-store-connection-string-exposure-risk',
      component: componentId,
      proof: null,
      message:
        'Production-shared diagnostics cannot expose database URLs, hostnames, passwords, or provider connection material.',
    }));
  }

  for (const proof of OPERATIONAL_PROOF_REQUIREMENTS[requirement.requiredStorePrimitive]) {
    const field = OPERATIONAL_PROOF_FIELDS[proof];
    if (hasDigestProof(evidence?.[field])) continue;

    blockers.push(Object.freeze({
      code: OPERATIONAL_PROOF_BLOCKER_CODES[proof],
      component: componentId,
      proof,
      message: OPERATIONAL_PROOF_MESSAGES[proof],
    }));
  }

  return Object.freeze(blockers);
}

function profileComponent(
  component: ProductionStoragePathComponent,
  evidence: ConsequenceSharedStoreOperationalEvidence | undefined,
): ConsequenceSharedStoreProfileComponent {
  const requirement = COMPONENT_REQUIREMENTS[component.component as ConsequenceSharedStoreComponentId];
  if (!requirement) {
    throw new Error(
      `Consequence shared-store profile has no requirement mapping for ${component.component}.`,
    );
  }
  const operationalBlockers = operationalBlockersFor(component, requirement, evidence);
  return Object.freeze({
    ...component,
    evidenceRole: requirement.evidenceRole,
    requiredStorePrimitive: requirement.requiredStorePrimitive,
    requiredOperationalProofs:
      OPERATIONAL_PROOF_REQUIREMENTS[requirement.requiredStorePrimitive],
    operationalEvidenceReady:
      component.satisfiesProductionShared && operationalBlockers.length === 0,
    operationalBlockers,
    noGoCondition: noGoFor(component),
  });
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function relevantBlocker(
  blocker: ProductionStoragePathBlocker,
  relevantIds: ReadonlySet<ProductionStoragePathComponentId>,
): boolean {
  return relevantIds.has(blocker.component);
}

function noGoForOperationalBlocker(
  blocker: ConsequenceSharedStoreOperationalBlocker,
): ConsequenceSharedStoreNoGoCondition {
  if (blocker.code === 'shared-store-raw-payload-storage-risk') {
    return 'shared-store-raw-payload-storage-risk';
  }
  if (blocker.code === 'shared-store-connection-string-exposure-risk') {
    return 'shared-store-connection-string-exposure-risk';
  }
  return 'shared-store-operational-evidence-not-proven';
}

export function evaluateConsequenceSharedStoreProfile(
  input: EvaluateConsequenceSharedStoreProfileInput = {},
): ConsequenceSharedStoreProfile {
  const storagePath = input.productionStoragePath ?? evaluateProductionStoragePath(input);
  const operationalEvidence = operationalEvidenceByComponent(input.operationalEvidence);
  const authorityComponents = Object.freeze(
    CONSEQUENCE_SHARED_STORE_AUTHORITY_COMPONENTS.map((id) =>
      componentById(storagePath, id)
    ),
  );
  const components = Object.freeze(
    CONSEQUENCE_SHARED_STORE_COMPONENTS.map((id) =>
      profileComponent(componentById(storagePath, id), operationalEvidence.get(id))
    ),
  );
  const relevantComponents = Object.freeze([...authorityComponents, ...components]);
  const relevantIds = new Set<ProductionStoragePathComponentId>(
    relevantComponents.map((component) => component.component),
  );
  const backlogComponentIds = Object.freeze(
    relevantComponents
      .filter((component) => !component.satisfiesProductionShared)
      .map((component) => component.component),
  );
  const productionProfileSelected = storagePath.runtimeProfileId === 'production-shared';
  const authorityStoreReady = authorityComponents.every(
    (component) => component.satisfiesProductionShared,
  );
  const consequenceStoreReady = components.every(
    (component) => component.satisfiesProductionShared,
  );
  const operationalBlockers = Object.freeze(
    components.flatMap((component) => component.operationalBlockers),
  );
  const operationalBlockingComponentIds = unique(
    operationalBlockers.map((blocker) => blocker.component),
  );
  const operationalEvidenceReady = consequenceStoreReady && operationalBlockers.length === 0;
  const productionReady = authorityStoreReady && consequenceStoreReady && operationalEvidenceReady;
  const readyForSelectedProfile = productionProfileSelected ? productionReady : true;
  const storageBlockers = productionProfileSelected
    ? Object.freeze(storagePath.blockers.filter((blocker) => relevantBlocker(blocker, relevantIds)))
    : Object.freeze([]);
  const blockers = productionProfileSelected
    ? Object.freeze([...storageBlockers, ...operationalBlockers])
    : Object.freeze([]);
  const noGoConditions = unique(
    [
      ...relevantComponents
        .map(noGoFor)
        .filter((condition): condition is ConsequenceSharedStoreNoGoCondition =>
          condition !== null
        ),
      ...operationalBlockers.map(noGoForOperationalBlocker),
    ],
  );
  const blockingComponentIds = unique(
    productionProfileSelected
      ? [...backlogComponentIds, ...operationalBlockingComponentIds]
      : [],
  );

  return Object.freeze({
    version: CONSEQUENCE_SHARED_STORE_PROFILE_SPEC_VERSION,
    productionStoragePathVersion: storagePath.version,
    evaluatedAt: storagePath.evaluatedAt,
    runtimeProfileId: storagePath.runtimeProfileId,
    state: productionProfileSelected
      ? productionReady
        ? 'production-shared-consequence-ready'
        : 'production-shared-consequence-blocked'
      : 'evaluation-shared-store-backlog-accepted',
    storagePathState: storagePath.state,
    readyForSelectedProfile,
    productionReady,
    authorityStoreReady,
    consequenceStoreReady,
    operationalEvidenceReady,
    rawPayloadStored: false,
    exposesConnectionStrings: false,
    activatesStorageMigration: false,
    authorityComponents,
    components,
    backlogComponentIds,
    operationalBlockingComponentIds,
    blockingComponentIds,
    blockers,
    storageBlockers,
    operationalBlockers,
    noGoConditions,
    requiredProofs: REQUIRED_PROOFS,
    limitation:
      'Repository-side profile only: it does not create PostgreSQL tables, migrate file histories, configure Redis, run Debezium, or prove an external production deployment.',
  });
}
