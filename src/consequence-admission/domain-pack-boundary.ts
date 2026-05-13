import {
  ATTESTOR_CONTROL_PLANE_ROLES,
  type AttestorControlPlaneRole,
} from './control-plane-roles.js';
import {
  CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION,
} from './failure-mode-registry.js';
import {
  CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
} from './pack-decision-profile.js';
import {
  CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
} from './replay-layer-placement.js';

export const CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION =
  'attestor.consequence-domain-pack-boundary.v1';

export const CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES = [
  'finance',
  'crypto',
  'general',
  'future',
] as const;
export type ConsequenceDomainPackBoundaryPackFamily =
  typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES[number];

export const CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS = [
  'finance-admission-projection',
  'crypto-admission-projection',
  'generic-admission-projection',
  'domain-registry-pack',
  'filing-adapter-pack',
  'future-pack-extension',
] as const;
export type ConsequenceDomainPackBoundarySurfaceKind =
  typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS[number];

export const CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES = [
  'domain-defaults',
  'evidence-shapes',
  'policy-templates',
  'adapter-projections',
  'readiness-signals',
  'replay-examples',
] as const;
export type ConsequenceDomainPackAllowedResponsibility =
  typeof CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES[number];

export const CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES = [
  'own-admit-narrow-review-block-vocabulary',
  'fork-failure-mode-registry',
  'fork-control-binding-contract',
  'fork-replay-layer',
  'self-activate-enforcement',
  'claim-production-readiness',
  'become-separate-product-identity',
] as const;
export type ConsequenceDomainPackForbiddenResponsibility =
  typeof CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES[number];

export interface ConsequenceDomainPackBoundarySurface {
  readonly kind: ConsequenceDomainPackBoundarySurfaceKind;
  readonly packFamily: ConsequenceDomainPackBoundaryPackFamily;
  readonly sourceFiles: readonly string[];
  readonly allowedResponsibilities: readonly ConsequenceDomainPackAllowedResponsibility[];
  readonly forbiddenResponsibilities: readonly ConsequenceDomainPackForbiddenResponsibility[];
  readonly ownsDecisionVocabulary: false;
  readonly ownsFailureRegistry: false;
  readonly ownsReplayLayer: false;
  readonly mayApproveActionByItself: false;
  readonly productionReady: false;
  readonly limitation: string;
}

export interface ConsequenceDomainPackBoundaryDescriptor {
  readonly version: typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION;
  readonly owningLayer: 'domain-extension-layer';
  readonly primaryRole: Extract<AttestorControlPlaneRole, 'pack'>;
  readonly supportingRoles: readonly AttestorControlPlaneRole[];
  readonly consumerRoles: readonly AttestorControlPlaneRole[];
  readonly nonOwningSharedControlRoles: readonly AttestorControlPlaneRole[];
  readonly publicPackageSurface: 'attestor/consequence-admission';
  readonly packFamilies: typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES;
  readonly surfaceKinds: typeof CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS;
  readonly allowedResponsibilities: typeof CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES;
  readonly forbiddenResponsibilities: typeof CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES;
  readonly sharedContractsRequired: readonly string[];
  readonly surfaces: readonly ConsequenceDomainPackBoundarySurface[];
  readonly boundaryInvariants: readonly string[];
  readonly automaticPackDetection: false;
  readonly separateProductIdentityAllowed: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
}

const CONSEQUENCE_DOMAIN_PACK_SUPPORTING_ROLES =
  ['pdp', 'pip', 'pap', 'pep', 'audit-proof', 'replay'] as const satisfies readonly AttestorControlPlaneRole[];

const CONSEQUENCE_DOMAIN_PACK_CONSUMER_ROLES =
  ['pdp', 'pep', 'pap', 'hosted-service'] as const satisfies readonly AttestorControlPlaneRole[];

const CONSEQUENCE_DOMAIN_PACK_NON_OWNING_SHARED_CONTROL_ROLES =
  ['pack', 'hosted-service'] as const satisfies readonly AttestorControlPlaneRole[];

function assertKnownControlPlaneRoles(
  roles: readonly AttestorControlPlaneRole[],
  label: string,
): void {
  const knownRoles = new Set(ATTESTOR_CONTROL_PLANE_ROLES);
  for (const role of roles) {
    if (!knownRoles.has(role)) {
      throw new Error(`Domain pack boundary ${label} references unknown role: ${role}`);
    }
  }
}

const SHARED_FORBIDDEN_RESPONSIBILITIES =
  CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES;

const CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACES =
  Object.freeze([
    {
      kind: 'finance-admission-projection',
      packFamily: 'finance',
      sourceFiles: Object.freeze([
        'src/consequence-admission/finance.ts',
        'src/release-layer/finance.ts',
        'src/service/http/routes/pipeline-execution-routes.ts',
      ]),
      allowedResponsibilities: Object.freeze([
        'domain-defaults',
        'evidence-shapes',
        'adapter-projections',
        'readiness-signals',
      ]),
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'Finance projection maps native finance proof posture into shared consequence admission; it does not become a separate finance product or bypass downstream enforcement.',
    },
    {
      kind: 'crypto-admission-projection',
      packFamily: 'crypto',
      sourceFiles: Object.freeze([
        'src/consequence-admission/crypto.ts',
        'src/crypto-authorization-core/index.ts',
        'src/crypto-execution-admission/index.ts',
        'src/crypto-intelligence/index.ts',
      ]),
      allowedResponsibilities: Object.freeze([
        'domain-defaults',
        'evidence-shapes',
        'adapter-projections',
        'readiness-signals',
        'replay-examples',
      ]),
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'Crypto projection packages programmable-money evidence and adapter readiness without claiming a hosted crypto execution route or independent custody/execution product.',
    },
    {
      kind: 'generic-admission-projection',
      packFamily: 'general',
      sourceFiles: Object.freeze([
        'src/consequence-admission/index.ts',
        'src/service/http/routes/generic-admission-routes.ts',
      ]),
      allowedResponsibilities: Object.freeze([
        'domain-defaults',
        'policy-templates',
        'readiness-signals',
      ]),
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'General admission projection covers unknown or emerging consequence classes through shared controls; it must not guess a stronger domain posture automatically.',
    },
    {
      kind: 'domain-registry-pack',
      packFamily: 'future',
      sourceFiles: Object.freeze([
        'src/domains/domain-pack.ts',
        'src/domains/finance-pack.ts',
        'src/domains/healthcare-pack.ts',
      ]),
      allowedResponsibilities: Object.freeze([
        'domain-defaults',
        'evidence-shapes',
        'policy-templates',
      ]),
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'Domain registry packs may describe domain defaults and policy templates, but shared admission remains the decision vocabulary and control owner.',
    },
    {
      kind: 'filing-adapter-pack',
      packFamily: 'future',
      sourceFiles: Object.freeze([
        'src/filing/filing-adapter.ts',
        'src/filing/xbrl-adapter.ts',
        'src/filing/xbrl-csv-adapter.ts',
      ]),
      allowedResponsibilities: Object.freeze([
        'evidence-shapes',
        'adapter-projections',
        'readiness-signals',
      ]),
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'Filing adapters shape regulated filing evidence and exports; they do not approve filings or replace policy, authority, proof, and downstream enforcement checks.',
    },
    {
      kind: 'future-pack-extension',
      packFamily: 'future',
      sourceFiles: Object.freeze([
        'docs/02-architecture/ai-action-control-plane-architecture.md',
        'docs/02-architecture/system-overview.md',
      ]),
      allowedResponsibilities: CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES,
      forbiddenResponsibilities: SHARED_FORBIDDEN_RESPONSIBILITIES,
      ownsDecisionVocabulary: false,
      ownsFailureRegistry: false,
      ownsReplayLayer: false,
      mayApproveActionByItself: false,
      productionReady: false,
      limitation:
        'Future packs start as domain extensions over shared contracts; a new pack cannot become a new product identity or production claim without separate evidence.',
    },
  ] as const satisfies readonly ConsequenceDomainPackBoundarySurface[]);

export function consequenceDomainPackBoundaryDescriptor():
ConsequenceDomainPackBoundaryDescriptor {
  const descriptor = Object.freeze({
    version: CONSEQUENCE_DOMAIN_PACK_BOUNDARY_VERSION,
    owningLayer: 'domain-extension-layer',
    primaryRole: 'pack',
    supportingRoles: CONSEQUENCE_DOMAIN_PACK_SUPPORTING_ROLES,
    consumerRoles: CONSEQUENCE_DOMAIN_PACK_CONSUMER_ROLES,
    nonOwningSharedControlRoles: CONSEQUENCE_DOMAIN_PACK_NON_OWNING_SHARED_CONTROL_ROLES,
    publicPackageSurface: 'attestor/consequence-admission',
    packFamilies: CONSEQUENCE_DOMAIN_PACK_BOUNDARY_PACK_FAMILIES,
    surfaceKinds: CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACE_KINDS,
    allowedResponsibilities: CONSEQUENCE_DOMAIN_PACK_ALLOWED_RESPONSIBILITIES,
    forbiddenResponsibilities: CONSEQUENCE_DOMAIN_PACK_FORBIDDEN_RESPONSIBILITIES,
    sharedContractsRequired: Object.freeze([
      CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
      CONSEQUENCE_FAILURE_MODE_REGISTRY_PLACEMENT_VERSION,
      CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
      'admit/narrow/review/block',
    ]),
    surfaces: CONSEQUENCE_DOMAIN_PACK_BOUNDARY_SURFACES,
    boundaryInvariants: Object.freeze([
      'Packs extend consequence domains; they do not own the core admission vocabulary.',
      'Packs may contribute domain templates, evidence defaults, adapters, readiness signals, and replay examples.',
      'Packs must consume the shared failure-mode registry, control bindings, replay layer, and pack decision profile.',
      'A pack cannot activate enforcement, approve an action by itself, or claim production readiness.',
      'Finance and crypto are modular packs inside one Attestor platform, not separate product identities.',
    ]),
    automaticPackDetection: false,
    separateProductIdentityAllowed: false,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'Domain pack boundary records where pack-specific defaults and adapters belong. It does not activate enforcement, prove customer workflow coverage, or make any pack production-ready.',
  } as const);

  assertKnownControlPlaneRoles([descriptor.primaryRole], 'primaryRole');
  assertKnownControlPlaneRoles(descriptor.supportingRoles, 'supportingRoles');
  assertKnownControlPlaneRoles(descriptor.consumerRoles, 'consumerRoles');
  assertKnownControlPlaneRoles(
    descriptor.nonOwningSharedControlRoles,
    'nonOwningSharedControlRoles',
  );

  return descriptor;
}
