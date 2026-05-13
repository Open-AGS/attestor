import {
  ATTESTOR_CONTROL_PLANE_ROLES,
  type AttestorControlPlaneRole,
} from './control-plane-roles.js';
import {
  CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
} from './presentation-replay-ledger.js';
import {
  CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
} from './failure-mode-replay-fixtures.js';
import {
  POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION,
} from './policy-foundry-adversarial-replay-executor.js';
import {
  POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION,
} from './policy-foundry-live-downstream-replay.js';

export const CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION =
  'attestor.consequence-replay-layer-placement.v1';

export const CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS = [
  'synthetic-failure-mode-replay',
  'presentation-replay-consumption',
  'local-adversarial-replay',
  'sandbox-downstream-replay',
] as const;
export type ConsequenceReplayLayerPlacementKind =
  typeof CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS[number];

export type ConsequenceReplayLayerOwningRole =
  Extract<AttestorControlPlaneRole, 'replay'>;

export interface ConsequenceReplayLayerPlacementSurface {
  readonly kind: ConsequenceReplayLayerPlacementKind;
  readonly version: string;
  readonly sourceFile: string;
  readonly purpose: string;
  readonly executionBoundary:
    | 'synthetic-review-material'
    | 'customer-enforcement-boundary'
    | 'local-non-mutating-harness'
    | 'sandbox-or-staging-dry-run';
  readonly rawPayloadStored: false;
  readonly downstreamMutationAllowed: false;
  readonly productionTrafficAllowed: false;
  readonly productionReady: false;
  readonly requiredProof: readonly string[];
  readonly limitation: string;
}

export interface ConsequenceReplayLayerPlacementDescriptor {
  readonly version: typeof CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION;
  readonly owningLayer: 'shared-control-layer';
  readonly primaryRole: ConsequenceReplayLayerOwningRole;
  readonly supportingRoles: readonly AttestorControlPlaneRole[];
  readonly consumerRoles: readonly AttestorControlPlaneRole[];
  readonly nonOwningRoles: readonly AttestorControlPlaneRole[];
  readonly publicPackageSurface: 'attestor/consequence-admission';
  readonly placementKinds: typeof CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS;
  readonly surfaces: readonly ConsequenceReplayLayerPlacementSurface[];
  readonly placementInvariants: readonly string[];
  readonly packExtensionBoundary: string;
  readonly hostedServiceBoundary: string;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
}

const CONSEQUENCE_REPLAY_LAYER_SUPPORTING_ROLES =
  ['pdp', 'pep', 'audit-proof'] as const satisfies readonly AttestorControlPlaneRole[];

const CONSEQUENCE_REPLAY_LAYER_CONSUMER_ROLES =
  ['pip', 'pap', 'pack', 'hosted-service'] as const satisfies readonly AttestorControlPlaneRole[];

const CONSEQUENCE_REPLAY_LAYER_NON_OWNING_ROLES =
  ['pack', 'hosted-service'] as const satisfies readonly AttestorControlPlaneRole[];

function assertKnownControlPlaneRoles(
  roles: readonly AttestorControlPlaneRole[],
  label: string,
): void {
  const knownRoles = new Set(ATTESTOR_CONTROL_PLANE_ROLES);
  for (const role of roles) {
    if (!knownRoles.has(role)) {
      throw new Error(`Replay layer placement ${label} references unknown role: ${role}`);
    }
  }
}

const CONSEQUENCE_REPLAY_LAYER_PLACEMENT_SURFACES =
  Object.freeze([
    {
      kind: 'synthetic-failure-mode-replay',
      version: CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
      sourceFile: 'src/consequence-admission/failure-mode-replay-fixtures.ts',
      purpose:
        'Defines adversarial scenario targets for every registered AI-action failure mode.',
      executionBoundary: 'synthetic-review-material',
      rawPayloadStored: false,
      downstreamMutationAllowed: false,
      productionTrafficAllowed: false,
      productionReady: false,
      requiredProof: Object.freeze([
        'failure-mode-registry-version',
        'control-binding-version',
        'fixture-digest',
      ]),
      limitation:
        'Synthetic fixtures define what must be caught; they do not execute customer infrastructure.',
    },
    {
      kind: 'presentation-replay-consumption',
      version: CONSEQUENCE_ADMISSION_PRESENTATION_REPLAY_LEDGER_VERSION,
      sourceFile: 'src/consequence-admission/presentation-replay-ledger.ts',
      purpose:
        'Consumes a presentation replay key once before a customer enforcement point calls a downstream system.',
      executionBoundary: 'customer-enforcement-boundary',
      rawPayloadStored: false,
      downstreamMutationAllowed: false,
      productionTrafficAllowed: false,
      productionReady: false,
      requiredProof: Object.freeze([
        'presentation-binding-decision',
        'replay-key-digest',
        'atomic-consume-result',
      ]),
      limitation:
        'The included ledger is an in-memory reference implementation; production needs a shared atomic store at the enforcement boundary.',
    },
    {
      kind: 'local-adversarial-replay',
      version: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION,
      sourceFile: 'src/consequence-admission/policy-foundry-adversarial-replay-executor.ts',
      purpose:
        'Normalizes local synthetic replay observations for Policy Foundry review.',
      executionBoundary: 'local-non-mutating-harness',
      rawPayloadStored: false,
      downstreamMutationAllowed: false,
      productionTrafficAllowed: false,
      productionReady: false,
      requiredProof: Object.freeze([
        'fixture-bundle-digest',
        'observation-evidence-digest',
        'no-go-reason-summary',
      ]),
      limitation:
        'Local adversarial replay is review material only and must not use credentials or mutate downstream systems.',
    },
    {
      kind: 'sandbox-downstream-replay',
      version: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION,
      sourceFile: 'src/consequence-admission/policy-foundry-live-downstream-replay.ts',
      purpose:
        'Normalizes sandbox, staging, or ephemeral-preview downstream dry-run replay evidence.',
      executionBoundary: 'sandbox-or-staging-dry-run',
      rawPayloadStored: false,
      downstreamMutationAllowed: false,
      productionTrafficAllowed: false,
      productionReady: false,
      requiredProof: Object.freeze([
        'sandbox-boundary-proof',
        'dry-run-proof-digest',
        'downstream-receipt-digest',
      ]),
      limitation:
        'Sandbox downstream replay is not production traffic and does not activate rollout by itself.',
    },
  ] as const satisfies readonly ConsequenceReplayLayerPlacementSurface[]);

export function consequenceReplayLayerPlacementDescriptor():
ConsequenceReplayLayerPlacementDescriptor {
  const descriptor = Object.freeze({
    version: CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
    owningLayer: 'shared-control-layer',
    primaryRole: 'replay',
    supportingRoles: CONSEQUENCE_REPLAY_LAYER_SUPPORTING_ROLES,
    consumerRoles: CONSEQUENCE_REPLAY_LAYER_CONSUMER_ROLES,
    nonOwningRoles: CONSEQUENCE_REPLAY_LAYER_NON_OWNING_ROLES,
    publicPackageSurface: 'attestor/consequence-admission',
    placementKinds: CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS,
    surfaces: CONSEQUENCE_REPLAY_LAYER_PLACEMENT_SURFACES,
    placementInvariants: Object.freeze([
      'Replay fixtures define expected negative cases before implementation claims coverage.',
      'Replay consumption must happen before downstream execution for non-idempotent or irreversible consequences.',
      'Replay evidence must use digests or references rather than raw payloads, raw replay keys, credentials, or customer bodies.',
      'Local and sandbox replay reports are review evidence only and cannot activate enforcement by themselves.',
      'Packs may contribute replay examples, but the replay layer owns the shared replay vocabulary and safety defaults.',
    ]),
    packExtensionBoundary:
      'Packs may add domain replay examples and evidence defaults, but they must not fork replay outcomes, replay safety defaults, or failure-mode replay contracts.',
    hostedServiceBoundary:
      'Hosted routes may compose replay reports and ledgers, but they must not treat route-local replay as production proof without customer enforcement evidence.',
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'Replay layer placement records ownership and safety boundaries. It does not execute customer infrastructure, activate enforcement, prove customer workflow coverage, or certify production readiness.',
  } as const);

  assertKnownControlPlaneRoles([descriptor.primaryRole], 'primaryRole');
  assertKnownControlPlaneRoles(descriptor.supportingRoles, 'supportingRoles');
  assertKnownControlPlaneRoles(descriptor.consumerRoles, 'consumerRoles');
  assertKnownControlPlaneRoles(descriptor.nonOwningRoles, 'nonOwningRoles');

  return descriptor;
}
