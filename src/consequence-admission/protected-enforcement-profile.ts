import type {
  ReleasePresentationMode,
} from '../release-enforcement-plane/types.js';
import type {
  ConsequenceAdmissionConsequenceKind,
  ConsequenceAdmissionProposedConsequence,
} from './index.js';
import type {
  ConsequenceAdmissionDomain,
} from './taxonomy.js';
import type {
  ConsequenceAdmissionDownstreamBoundaryKind,
} from './downstream-enforcement-contract.js';

export const CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION =
  'attestor.consequence-admission-protected-enforcement-profile.v1';

export const CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PATHS = [
  'customer-gate',
  'downstream-contract',
  'release-enforcement-plane',
] as const;
export type ConsequenceAdmissionProtectedEnforcementPath =
  typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PATHS[number];

export const CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_REASON_CODES = [
  'protected-enforcement-low-risk-customer-gate-compatible',
  'protected-enforcement-downstream-contract-required',
  'protected-enforcement-production-sensitive-release-enforcement-plane-required',
  'protected-enforcement-high-risk-release-enforcement-plane-required',
  'protected-enforcement-sender-constraint-required',
  'protected-enforcement-online-introspection-required',
  'protected-enforcement-replay-consume-required',
  'protected-enforcement-bearer-only-forbidden',
] as const;
export type ConsequenceAdmissionProtectedEnforcementReasonCode =
  typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_REASON_CODES[number];

const LOW_RISK_CLASSES = new Set(['R0', 'R1']);
const DOWNSTREAM_CONTRACT_RISK_CLASSES = new Set(['R2']);
const HIGH_RISK_CLASSES = new Set(['R3', 'R4']);

const LOW_RISK_PRESENTATION_MODES = Object.freeze([
  'bearer-release-token',
  'dpop-bound-token',
] as const satisfies readonly ReleasePresentationMode[]);

const DOWNSTREAM_CONTRACT_PRESENTATION_MODES = Object.freeze([
  'bearer-release-token',
  'dpop-bound-token',
  'http-message-signature',
] as const satisfies readonly ReleasePresentationMode[]);

const PROTECTED_PRESENTATION_MODES = Object.freeze([
  'dpop-bound-token',
  'mtls-bound-token',
  'spiffe-bound-token',
  'http-message-signature',
  'signed-json-envelope',
] as const satisfies readonly ReleasePresentationMode[]);

export interface ResolveConsequenceAdmissionProtectedEnforcementProfileInput {
  readonly riskClass: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly consequenceDomain?: ConsequenceAdmissionDomain | null;
  readonly consequenceKind?: ConsequenceAdmissionConsequenceKind | null;
  readonly productionSensitive?: boolean | null;
}

export interface ConsequenceAdmissionProtectedEnforcementProfile {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION;
  readonly riskClass: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly consequenceDomain: ConsequenceAdmissionDomain | null;
  readonly consequenceKind: ConsequenceAdmissionConsequenceKind | null;
  readonly minimumPath: ConsequenceAdmissionProtectedEnforcementPath;
  readonly allowedPresentationModes: readonly ReleasePresentationMode[];
  readonly senderConstraintRequired: boolean;
  readonly onlineIntrospectionRequired: boolean;
  readonly replayConsumeRequired: boolean;
  readonly bearerOnlyAllowed: boolean;
  readonly productionSensitive: boolean;
  readonly failClosed: boolean;
  readonly cryptographicTokenVerification: false;
  readonly activatesEnforcement: false;
  readonly protectedPrinciples: readonly [
    'fail-closed boundary',
    'customer authority',
    'replay and idempotency safety',
  ];
  readonly reasonCodes: readonly ConsequenceAdmissionProtectedEnforcementReasonCode[];
  readonly limitation: string;
}

export interface ConsequenceAdmissionProtectedEnforcementProfileDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION;
  readonly paths: typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PATHS;
  readonly reasonCodes: typeof CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_REASON_CODES;
  readonly highRiskRequiresReleaseEnforcementPlane: true;
  readonly productionSensitiveRequiresReleaseEnforcementPlane: true;
  readonly bearerOnlyForbiddenForProtectedExecution: true;
  readonly cryptographicTokenVerification: false;
  readonly activatesEnforcement: false;
  readonly failClosed: true;
}

function assertRiskClass(
  riskClass: ConsequenceAdmissionProposedConsequence['riskClass'],
): void {
  if (
    !LOW_RISK_CLASSES.has(riskClass) &&
    !DOWNSTREAM_CONTRACT_RISK_CLASSES.has(riskClass) &&
    !HIGH_RISK_CLASSES.has(riskClass)
  ) {
    throw new Error(
      'Consequence admission protected enforcement profile riskClass must be one of: R0, R1, R2, R3, R4.',
    );
  }
}

function resolveMinimumPath(input: {
  readonly riskClass: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly productionSensitive: boolean;
}): ConsequenceAdmissionProtectedEnforcementPath {
  if (HIGH_RISK_CLASSES.has(input.riskClass) || input.productionSensitive) {
    return 'release-enforcement-plane';
  }
  if (DOWNSTREAM_CONTRACT_RISK_CLASSES.has(input.riskClass)) {
    return 'downstream-contract';
  }
  return 'customer-gate';
}

function reasonCodesFor(input: {
  readonly riskClass: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly minimumPath: ConsequenceAdmissionProtectedEnforcementPath;
  readonly productionSensitive: boolean;
}): readonly ConsequenceAdmissionProtectedEnforcementReasonCode[] {
  const reasonCodes: ConsequenceAdmissionProtectedEnforcementReasonCode[] = [];
  if (input.minimumPath === 'customer-gate') {
    reasonCodes.push('protected-enforcement-low-risk-customer-gate-compatible');
  }
  if (input.minimumPath === 'downstream-contract') {
    reasonCodes.push('protected-enforcement-downstream-contract-required');
  }
  if (input.productionSensitive) {
    reasonCodes.push(
      'protected-enforcement-production-sensitive-release-enforcement-plane-required',
    );
  }
  if (HIGH_RISK_CLASSES.has(input.riskClass)) {
    reasonCodes.push(
      'protected-enforcement-high-risk-release-enforcement-plane-required',
    );
  }
  if (input.minimumPath === 'release-enforcement-plane') {
    reasonCodes.push(
      'protected-enforcement-sender-constraint-required',
      'protected-enforcement-online-introspection-required',
      'protected-enforcement-replay-consume-required',
      'protected-enforcement-bearer-only-forbidden',
    );
  }
  return Object.freeze(Array.from(new Set(reasonCodes)));
}

export function consequenceAdmissionProtectedEnforcementProfileDescriptor():
ConsequenceAdmissionProtectedEnforcementProfileDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
    paths: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PATHS,
    reasonCodes: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_REASON_CODES,
    highRiskRequiresReleaseEnforcementPlane: true,
    productionSensitiveRequiresReleaseEnforcementPlane: true,
    bearerOnlyForbiddenForProtectedExecution: true,
    cryptographicTokenVerification: false,
    activatesEnforcement: false,
    failClosed: true,
  });
}

export function resolveConsequenceAdmissionProtectedEnforcementProfile(
  input: ResolveConsequenceAdmissionProtectedEnforcementProfileInput,
): ConsequenceAdmissionProtectedEnforcementProfile {
  assertRiskClass(input.riskClass);
  const productionSensitive =
    input.productionSensitive ?? HIGH_RISK_CLASSES.has(input.riskClass);
  const minimumPath = resolveMinimumPath({
    riskClass: input.riskClass,
    productionSensitive,
  });
  const releaseEnforcementRequired = minimumPath === 'release-enforcement-plane';
  const allowedPresentationModes = releaseEnforcementRequired
    ? PROTECTED_PRESENTATION_MODES
    : minimumPath === 'downstream-contract'
      ? DOWNSTREAM_CONTRACT_PRESENTATION_MODES
      : LOW_RISK_PRESENTATION_MODES;

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
    riskClass: input.riskClass,
    boundaryKind: input.boundaryKind,
    consequenceDomain: input.consequenceDomain ?? null,
    consequenceKind: input.consequenceKind ?? null,
    minimumPath,
    allowedPresentationModes,
    senderConstraintRequired: releaseEnforcementRequired,
    onlineIntrospectionRequired:
      releaseEnforcementRequired || input.riskClass === 'R2',
    replayConsumeRequired:
      releaseEnforcementRequired || input.riskClass === 'R1' || input.riskClass === 'R2',
    bearerOnlyAllowed:
      minimumPath === 'customer-gate' && !productionSensitive && input.riskClass !== 'R2',
    productionSensitive,
    failClosed: input.riskClass !== 'R0',
    cryptographicTokenVerification: false,
    activatesEnforcement: false,
    protectedPrinciples: [
      'fail-closed boundary',
      'customer authority',
      'replay and idempotency safety',
    ] as const,
    reasonCodes: reasonCodesFor({
      riskClass: input.riskClass,
      minimumPath,
      productionSensitive,
    }),
    limitation:
      'This profile selects the minimum customer enforcement path. It does not issue release tokens, verify sender-constrained presentations, consume replay keys, or activate a customer runtime by itself.',
  });
}
