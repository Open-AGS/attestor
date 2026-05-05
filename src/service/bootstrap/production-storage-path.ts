import { controlPlaneStoreMode } from '../control-plane-store.js';
import { releaseAuthorityStoreMode } from '../release-authority-store.js';
import type { AttestorRuntimeProfileId } from './runtime-profile.js';

export const PRODUCTION_STORAGE_PATH_SPEC_VERSION =
  'attestor.production-storage-path.v1';

export type ProductionStoragePathComponentId =
  | 'control-plane-state'
  | 'release-authority-state'
  | 'shadow-admission-events'
  | 'shadow-policy-simulations'
  | 'shadow-policy-candidates'
  | 'shadow-activation-receipts'
  | 'retry-attempt-ledger'
  | 'presentation-replay-ledger'
  | 'agent-loop-abuse-guard'
  | 'audit-evidence-export'
  | 'business-risk-dashboard';

export type ProductionStoragePlane =
  | 'hosted-control-plane'
  | 'release-authority-plane'
  | 'consequence-admission-plane'
  | 'audit-read-model';

export type ProductionStorageMode =
  | 'disabled'
  | 'file-backed-durable'
  | 'file-backed-evaluation'
  | 'in-memory-reference'
  | 'derived-evaluation'
  | 'shared-postgres'
  | 'shared-durable';

export type ProductionStoragePathBlockerCode =
  | 'shared-control-plane-required'
  | 'shared-release-authority-required'
  | 'evaluation-store-not-shared'
  | 'in-memory-reference-not-shared'
  | 'derived-view-source-not-shared';

export interface ProductionStoragePathComponent {
  readonly component: ProductionStoragePathComponentId;
  readonly plane: ProductionStoragePlane;
  readonly label: string;
  readonly currentMode: ProductionStorageMode;
  readonly requiredModeForProduction: 'shared-postgres' | 'shared-durable';
  readonly satisfiesProductionShared: boolean;
  readonly tenantScoped: boolean;
  readonly rawPayloadStored: false;
  readonly exposesStorageSecret: false;
  readonly productionReady: boolean;
  readonly migrationTarget: 'shared-authority-control-plane' | 'shared-control-plane';
  readonly note: string;
}

export interface ProductionStoragePathBlocker {
  readonly code: ProductionStoragePathBlockerCode;
  readonly component: ProductionStoragePathComponentId;
  readonly message: string;
}

export interface ProductionStoragePathEvaluation {
  readonly version: typeof PRODUCTION_STORAGE_PATH_SPEC_VERSION;
  readonly evaluatedAt: string;
  readonly runtimeProfileId: AttestorRuntimeProfileId | null;
  readonly state:
    | 'evaluation-storage-accepted'
    | 'production-shared-blocked'
    | 'production-shared-ready';
  readonly readyForSelectedProfile: boolean;
  readonly productionReady: boolean;
  readonly rawPayloadStored: false;
  readonly exposesConnectionStrings: false;
  readonly components: readonly ProductionStoragePathComponent[];
  readonly blockers: readonly ProductionStoragePathBlocker[];
  readonly requiredProofs: readonly string[];
}

export interface EvaluateProductionStoragePathInput {
  readonly runtimeProfileId?: AttestorRuntimeProfileId | null;
  readonly controlPlaneMode?: 'postgres' | 'file';
  readonly releaseAuthorityMode?: 'postgres' | 'disabled';
  readonly componentModes?: Partial<
    Readonly<Record<ProductionStoragePathComponentId, ProductionStorageMode>>
  >;
  readonly evaluatedAt?: string | null;
}

const REQUIRED_PROOFS = Object.freeze([
  'npm run test:production-storage-path',
  'GET /api/v1/ready',
] as const);

function modeForControlPlane(input?: 'postgres' | 'file'): ProductionStorageMode {
  return (input ?? controlPlaneStoreMode()) === 'postgres'
    ? 'shared-postgres'
    : 'file-backed-durable';
}

function modeForReleaseAuthority(input?: 'postgres' | 'disabled'): ProductionStorageMode {
  return (input ?? releaseAuthorityStoreMode()) === 'postgres'
    ? 'shared-postgres'
    : 'disabled';
}

function component(input: {
  readonly component: ProductionStoragePathComponentId;
  readonly plane: ProductionStoragePlane;
  readonly label: string;
  readonly currentMode: ProductionStorageMode;
  readonly requiredModeForProduction: 'shared-postgres' | 'shared-durable';
  readonly tenantScoped: boolean;
  readonly migrationTarget: 'shared-authority-control-plane' | 'shared-control-plane';
  readonly note: string;
}): ProductionStoragePathComponent {
  const satisfiesProductionShared = input.currentMode === input.requiredModeForProduction;
  return Object.freeze({
    ...input,
    satisfiesProductionShared,
    rawPayloadStored: false,
    exposesStorageSecret: false,
    productionReady: satisfiesProductionShared,
  });
}
function defaultComponents(input: EvaluateProductionStoragePathInput):
readonly ProductionStoragePathComponent[] {
  const overrides = input.componentModes ?? {};
  const current = (
    id: ProductionStoragePathComponentId,
    fallback: ProductionStorageMode,
  ): ProductionStorageMode => overrides[id] ?? fallback;

  return Object.freeze([
    component({
      component: 'control-plane-state',
      plane: 'hosted-control-plane',
      label: 'Hosted accounts, tenant keys, usage, admin audit, idempotency, webhooks',
      currentMode: current('control-plane-state', modeForControlPlane(input.controlPlaneMode)),
      requiredModeForProduction: 'shared-postgres',
      tenantScoped: true,
      migrationTarget: 'shared-control-plane',
      note:
        'Production-shared needs tenant and account control state in shared PostgreSQL, not file fallback.',
    }),
    component({
      component: 'release-authority-state',
      plane: 'release-authority-plane',
      label: 'Release, policy, token, reviewer, evidence, and degraded-mode authority state',
      currentMode: current(
        'release-authority-state',
        modeForReleaseAuthority(input.releaseAuthorityMode),
      ),
      requiredModeForProduction: 'shared-postgres',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Production-shared needs the dedicated release-authority PostgreSQL substrate and shared request path.',
    }),
    component({
      component: 'shadow-admission-events',
      plane: 'consequence-admission-plane',
      label: 'Shadow admission event history',
      currentMode: current('shadow-admission-events', 'file-backed-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Shadow mode can drive policy discovery only after event history has shared durability, retention, and backup.',
    }),
    component({
      component: 'shadow-policy-simulations',
      plane: 'consequence-admission-plane',
      label: 'Shadow policy simulation reports',
      currentMode: current('shadow-policy-simulations', 'file-backed-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Simulation reports are decision-support artifacts; production promotion needs shared provenance and retention.',
    }),
    component({
      component: 'shadow-policy-candidates',
      plane: 'consequence-admission-plane',
      label: 'Policy discovery candidate lifecycle',
      currentMode: current('shadow-policy-candidates', 'file-backed-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Policy candidates remain approval-gated and need shared lifecycle storage before multi-node production.',
    }),
    component({
      component: 'shadow-activation-receipts',
      plane: 'consequence-admission-plane',
      label: 'Customer activation receipt history',
      currentMode: current('shadow-activation-receipts', 'file-backed-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Activation receipts close the customer-side loop and need shared receipt history before production-shared.',
    }),
    component({
      component: 'retry-attempt-ledger',
      plane: 'consequence-admission-plane',
      label: 'Safe retry attempt ledger',
      currentMode: current('retry-attempt-ledger', 'in-memory-reference'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Retry attempts must coordinate across runtime instances or a model can probe each node independently.',
    }),
    component({
      component: 'presentation-replay-ledger',
      plane: 'consequence-admission-plane',
      label: 'Single-use downstream presentation replay ledger',
      currentMode: current('presentation-replay-ledger', 'in-memory-reference'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Replay consumption must be shared before one admission can protect more than one runtime instance.',
    }),
    component({
      component: 'agent-loop-abuse-guard',
      plane: 'consequence-admission-plane',
      label: 'Agent retry-loop abuse guard',
      currentMode: current('agent-loop-abuse-guard', 'in-memory-reference'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Loop throttling needs shared counters and correction signatures before public multi-node exposure.',
    }),
    component({
      component: 'audit-evidence-export',
      plane: 'audit-read-model',
      label: 'Audit evidence export source set',
      currentMode: current('audit-evidence-export', 'derived-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Audit exports can stay digest-first, but production packets need shared source history.',
    }),
    component({
      component: 'business-risk-dashboard',
      plane: 'audit-read-model',
      label: 'Business risk dashboard source set',
      currentMode: current('business-risk-dashboard', 'derived-evaluation'),
      requiredModeForProduction: 'shared-durable',
      tenantScoped: true,
      migrationTarget: 'shared-authority-control-plane',
      note:
        'Dashboard metrics are decision support; production claims require shared source history, not local files.',
    }),
  ]);
}

function blockerFor(
  component: ProductionStoragePathComponent,
): ProductionStoragePathBlocker | null {
  if (component.satisfiesProductionShared) return null;
  if (component.component === 'control-plane-state') {
    return Object.freeze({
      code: 'shared-control-plane-required',
      component: component.component,
      message:
        'Production-shared requires ATTESTOR_CONTROL_PLANE_PG_URL-backed shared control-plane storage.',
    });
  }
  if (component.component === 'release-authority-state') {
    return Object.freeze({
      code: 'shared-release-authority-required',
      component: component.component,
      message:
        'Production-shared requires ATTESTOR_RELEASE_AUTHORITY_PG_URL-backed release-authority storage.',
    });
  }
  if (component.currentMode === 'in-memory-reference') {
    return Object.freeze({
      code: 'in-memory-reference-not-shared',
      component: component.component,
      message: `${component.label} is still an in-memory reference implementation and cannot coordinate multi-node production.`,
    });
  }
  if (component.currentMode === 'derived-evaluation') {
    return Object.freeze({
      code: 'derived-view-source-not-shared',
      component: component.component,
      message: `${component.label} is derived from evaluation sources; production-shared needs shared source history first.`,
    });
  }
  return Object.freeze({
    code: 'evaluation-store-not-shared',
    component: component.component,
    message: `${component.label} is still evaluation storage and must move to shared authority/control-plane storage before production-shared.`,
  });
}

export function evaluateProductionStoragePath(
  input: EvaluateProductionStoragePathInput = {},
): ProductionStoragePathEvaluation {
  const runtimeProfileId = input.runtimeProfileId ?? null;
  const components = defaultComponents(input);
  const productionBlockers = components
    .map(blockerFor)
    .filter((blocker): blocker is ProductionStoragePathBlocker => blocker !== null);
  const productionReady = productionBlockers.length === 0;
  const productionProfileSelected = runtimeProfileId === 'production-shared';
  const readyForSelectedProfile = productionProfileSelected ? productionReady : true;

  return Object.freeze({
    version: PRODUCTION_STORAGE_PATH_SPEC_VERSION,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    runtimeProfileId,
    state: productionProfileSelected
      ? productionReady ? 'production-shared-ready' : 'production-shared-blocked'
      : 'evaluation-storage-accepted',
    readyForSelectedProfile,
    productionReady,
    rawPayloadStored: false,
    exposesConnectionStrings: false,
    components,
    blockers: productionProfileSelected ? Object.freeze(productionBlockers) : Object.freeze([]),
    requiredProofs: REQUIRED_PROOFS,
  });
}
