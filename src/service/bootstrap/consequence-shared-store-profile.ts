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

export type ConsequenceSharedStoreNoGoCondition =
  | 'shared-authority-substrate-missing'
  | 'file-backed-evaluation-history'
  | 'in-memory-reference-ledger'
  | 'derived-evaluation-read-model'
  | 'shared-durable-backend-not-proven';

export type ConsequenceSharedStoreProfileState =
  | 'evaluation-shared-store-backlog-accepted'
  | 'production-shared-consequence-blocked'
  | 'production-shared-consequence-ready';

interface ConsequenceSharedStoreRequirement {
  readonly evidenceRole: ConsequenceSharedStoreEvidenceRole;
  readonly requiredStorePrimitive: ConsequenceSharedStoreRequiredPrimitive;
}

export interface ConsequenceSharedStoreProfileComponent
  extends ProductionStoragePathComponent {
  readonly evidenceRole: ConsequenceSharedStoreEvidenceRole;
  readonly requiredStorePrimitive: ConsequenceSharedStoreRequiredPrimitive;
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
  readonly rawPayloadStored: false;
  readonly exposesConnectionStrings: false;
  readonly activatesStorageMigration: false;
  readonly authorityComponents: readonly ProductionStoragePathComponent[];
  readonly components: readonly ConsequenceSharedStoreProfileComponent[];
  readonly backlogComponentIds: readonly ProductionStoragePathComponentId[];
  readonly blockingComponentIds: readonly ProductionStoragePathComponentId[];
  readonly blockers: readonly ProductionStoragePathBlocker[];
  readonly noGoConditions: readonly ConsequenceSharedStoreNoGoCondition[];
  readonly requiredProofs: readonly string[];
  readonly limitation: string;
}

export interface EvaluateConsequenceSharedStoreProfileInput
  extends EvaluateProductionStoragePathInput {
  readonly productionStoragePath?: ProductionStoragePathEvaluation | null;
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

function profileComponent(
  component: ProductionStoragePathComponent,
): ConsequenceSharedStoreProfileComponent {
  const requirement = COMPONENT_REQUIREMENTS[component.component as ConsequenceSharedStoreComponentId];
  if (!requirement) {
    throw new Error(
      `Consequence shared-store profile has no requirement mapping for ${component.component}.`,
    );
  }
  return Object.freeze({
    ...component,
    evidenceRole: requirement.evidenceRole,
    requiredStorePrimitive: requirement.requiredStorePrimitive,
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

export function evaluateConsequenceSharedStoreProfile(
  input: EvaluateConsequenceSharedStoreProfileInput = {},
): ConsequenceSharedStoreProfile {
  const storagePath = input.productionStoragePath ?? evaluateProductionStoragePath(input);
  const authorityComponents = Object.freeze(
    CONSEQUENCE_SHARED_STORE_AUTHORITY_COMPONENTS.map((id) =>
      componentById(storagePath, id)
    ),
  );
  const components = Object.freeze(
    CONSEQUENCE_SHARED_STORE_COMPONENTS.map((id) =>
      profileComponent(componentById(storagePath, id))
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
  const productionReady = authorityStoreReady && consequenceStoreReady;
  const readyForSelectedProfile = productionProfileSelected ? productionReady : true;
  const blockers = productionProfileSelected
    ? Object.freeze(storagePath.blockers.filter((blocker) => relevantBlocker(blocker, relevantIds)))
    : Object.freeze([]);
  const noGoConditions = unique(
    relevantComponents
      .map(noGoFor)
      .filter((condition): condition is ConsequenceSharedStoreNoGoCondition =>
        condition !== null
      ),
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
    rawPayloadStored: false,
    exposesConnectionStrings: false,
    activatesStorageMigration: false,
    authorityComponents,
    components,
    backlogComponentIds,
    blockingComponentIds: productionProfileSelected ? backlogComponentIds : Object.freeze([]),
    blockers,
    noGoConditions,
    requiredProofs: REQUIRED_PROOFS,
    limitation:
      'Repository-side profile only: it does not create PostgreSQL tables, migrate file histories, configure Redis, or prove an external production deployment.',
  });
}
