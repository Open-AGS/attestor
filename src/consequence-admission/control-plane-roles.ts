export const ATTESTOR_CONTROL_PLANE_ROLE_VERSION =
  'attestor.control-plane-roles.v1';

export const ATTESTOR_CONTROL_PLANE_ROLES = [
  'pdp',
  'pep',
  'pip',
  'pap',
  'audit-proof',
  'replay',
  'pack',
  'hosted-service',
] as const;

export type AttestorControlPlaneRole =
  typeof ATTESTOR_CONTROL_PLANE_ROLES[number];

export interface AttestorControlPlaneRoleDescriptor {
  readonly role: AttestorControlPlaneRole;
  readonly name: string;
  readonly responsibility: string;
  readonly currentSurfaces: readonly string[];
  readonly mayApproveActionByItself: boolean;
  readonly mustNot: readonly string[];
}

export const ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS = [
  {
    role: 'pdp',
    name: 'Policy Decision Point',
    responsibility:
      'Produces admit, narrow, review, or block from structured action intent, policy, evidence, authority, scope, and failure-mode controls.',
    currentSurfaces: [
      'src/consequence-admission',
      'src/release-kernel',
      'src/release-layer',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'call a concrete downstream executor',
      'treat model confidence as business authority',
      'infer tenant or recipient boundaries from natural language',
    ],
  },
  {
    role: 'pep',
    name: 'Policy Enforcement Point',
    responsibility:
      'Catches an intended action before downstream execution and fails closed when decision, proof, binding, replay, or freshness checks fail.',
    currentSurfaces: [
      'src/release-enforcement-plane',
      'src/consequence-admission/verifier-helper.ts',
      'src/consequence-admission/adapter-framework.ts',
      'customer gateways',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'execute when the Attestor admission is missing or stale',
      'reuse an admission against a different target, body, or replay key',
      'treat review-required as allow',
    ],
  },
  {
    role: 'pip',
    name: 'Policy Information Point',
    responsibility:
      'Supplies evidence, authority, tenant, recipient, no-go, freshness, policy-version, and runtime context facts.',
    currentSurfaces: [
      'evidence sources',
      'authority sources',
      'tenant and recipient context',
      'runtime readiness contracts',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'silently approve an action',
      'launder untrusted content into authority',
      'expose raw customer payloads in proof or dashboard surfaces',
    ],
  },
  {
    role: 'pap',
    name: 'Policy Administration Point',
    responsibility:
      'Owns policy lifecycle, simulation, rollout, candidate review, drift handling, and activation.',
    currentSurfaces: [
      'src/release-policy-control-plane',
      'Policy Foundry surfaces',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'auto-enforce a policy candidate',
      'let LLM-generated text become policy authority',
      'activate without verified approval and rollout evidence',
    ],
  },
  {
    role: 'audit-proof',
    name: 'Audit Proof',
    responsibility:
      'Records why a decision happened, which evidence was used, which limitations remain, and what was presented downstream.',
    currentSurfaces: [
      'audit evidence export',
      'tamper-evident history',
      'downstream execution receipt',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'claim certification',
      'store raw prompts, credentials, payment data, wallet material, or downstream error bodies',
      'replace customer approval provenance',
    ],
  },
  {
    role: 'replay',
    name: 'Replay',
    responsibility:
      'Tests whether dangerous action patterns are detected before business consequence and records single-use presentation consumption where applicable.',
    currentSurfaces: [
      'failure-mode replay fixtures',
      'presentation replay ledger',
      'Policy Foundry red-team replay',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'treat fixture coverage as production proof',
      'reuse raw replay keys in exported proof material',
      'skip idempotency for irreversible or non-idempotent actions',
    ],
  },
  {
    role: 'pack',
    name: 'Domain Pack',
    responsibility:
      'Adds domain defaults, evidence shapes, policy templates, adapters, and replay examples without owning a separate decision engine.',
    currentSurfaces: [
      'finance pack',
      'crypto pack',
      'filing pack',
      'future consequence packs',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'fork the admit, narrow, review, block vocabulary',
      'become a separate product identity by default',
      'bypass shared failure-mode controls',
    ],
  },
  {
    role: 'hosted-service',
    name: 'Hosted Service Composition Root',
    responsibility:
      'Composes routes, account state, billing, storage, and runtime wiring around the shared control-plane contracts.',
    currentSurfaces: [
      'src/service',
      'hosted routes',
      'account and billing surfaces',
    ],
    mayApproveActionByItself: false,
    mustNot: [
      'become the authority model',
      'let route wiring bypass PDP/PEP/PIP/PAP contracts',
      'turn hosted readiness into production readiness without real environment evidence',
    ],
  },
] as const satisfies readonly AttestorControlPlaneRoleDescriptor[];

export function attestorControlPlaneRoleDescriptor(
  role: AttestorControlPlaneRole,
): AttestorControlPlaneRoleDescriptor {
  const descriptor = ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS.find((entry) => entry.role === role);
  if (!descriptor) {
    throw new Error(`Unknown Attestor control-plane role: ${role}`);
  }
  return descriptor;
}

export function attestorControlPlaneRolesDescriptor(): {
  readonly version: typeof ATTESTOR_CONTROL_PLANE_ROLE_VERSION;
  readonly roles: typeof ATTESTOR_CONTROL_PLANE_ROLES;
  readonly descriptors: typeof ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS;
} {
  return Object.freeze({
    version: ATTESTOR_CONTROL_PLANE_ROLE_VERSION,
    roles: ATTESTOR_CONTROL_PLANE_ROLES,
    descriptors: ATTESTOR_CONTROL_PLANE_ROLE_DESCRIPTORS,
  });
}
