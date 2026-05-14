import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION =
  'attestor.shadow-readiness-claim-alignment.v1';

export const CONSEQUENCE_SHADOW_READINESS_STAGE_IDS = [
  'shadow-admission-events',
  'shadow-policy-simulation',
  'policy-discovery-candidates',
  'shadow-policy-promotion-draft',
  'shadow-policy-promotion-packet',
  'shadow-policy-bundle-publication',
  'shadow-downstream-verification-binding',
  'shadow-downstream-integration-proof',
  'shadow-activation-readiness-gate',
  'shadow-customer-activation-handoff',
  'shadow-customer-activation-receipt',
  'shadow-production-storage-path',
] as const;
export type ConsequenceShadowReadinessStageId =
  typeof CONSEQUENCE_SHADOW_READINESS_STAGE_IDS[number];

export const CONSEQUENCE_SHADOW_READINESS_CRITERION_IDS = [
  'descriptor-exported',
  'approval-required',
  'auto-enforce-disabled',
  'raw-payload-storage-disabled',
  'production-ready-not-claimed',
  'origin-redaction-witness-bound',
  'server-owned-simulation-floor',
  'promotion-approval-trail-bound',
  'production-signing-boundary-split',
  'downstream-verification-bound',
  'break-glass-extra-gated',
  'high-risk-two-person-approval',
  'customer-activation-receipt-loop',
  'selected-profile-storage-ready',
] as const;
export type ConsequenceShadowReadinessCriterionId =
  typeof CONSEQUENCE_SHADOW_READINESS_CRITERION_IDS[number];

export const CONSEQUENCE_SHADOW_READINESS_CRITERION_STATUSES = [
  'pass',
  'blocked',
] as const;
export type ConsequenceShadowReadinessCriterionStatus =
  typeof CONSEQUENCE_SHADOW_READINESS_CRITERION_STATUSES[number];

export const CONSEQUENCE_SHADOW_READINESS_STATES = [
  'evaluation-shadow-accepted',
  'production-shared-shadow-blocked',
  'production-shared-shadow-ready',
] as const;
export type ConsequenceShadowReadinessState =
  typeof CONSEQUENCE_SHADOW_READINESS_STATES[number];

export interface ConsequenceShadowReadinessCriterionDefinition {
  readonly id: ConsequenceShadowReadinessCriterionId;
  readonly summary: string;
  readonly evidenceKind: 'code' | 'test' | 'runtime' | 'documentation';
  readonly requiredForClaimAlignment: true;
}

export interface ConsequenceShadowReadinessStageProfile {
  readonly stageId: ConsequenceShadowReadinessStageId;
  readonly sourceFile: string;
  readonly testFile: string;
  readonly evidenceRefs: readonly string[];
  readonly requiredCriteria: readonly ConsequenceShadowReadinessCriterionId[];
  readonly staticPassedCriteria: readonly ConsequenceShadowReadinessCriterionId[];
}

export interface ConsequenceShadowReadinessCriterionResult {
  readonly criterionId: ConsequenceShadowReadinessCriterionId;
  readonly status: ConsequenceShadowReadinessCriterionStatus;
  readonly evidenceRefs: readonly string[];
  readonly limitation: string;
}

export interface ConsequenceShadowReadinessStageResult {
  readonly stageId: ConsequenceShadowReadinessStageId;
  readonly sourceFile: string;
  readonly testFile: string;
  readonly claimAligned: boolean;
  readonly criteria: readonly ConsequenceShadowReadinessCriterionResult[];
  readonly blockers: readonly string[];
}

export interface ShadowProductionStoragePathSnapshot {
  readonly version?: string | null;
  readonly state?: string | null;
  readonly readyForSelectedProfile: boolean;
  readonly productionReady?: boolean | null;
  readonly blockers?: readonly {
    readonly code?: string | null;
    readonly component?: string | null;
    readonly message?: string | null;
  }[] | null;
}

export interface EvaluateConsequenceShadowReadinessClaimAlignmentInput {
  readonly generatedAt?: string | null;
  readonly runtimeProfileId?: string | null;
  readonly productionStoragePath?: ShadowProductionStoragePathSnapshot | null;
}

export interface ConsequenceShadowReadinessClaimAlignment {
  readonly version: typeof CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION;
  readonly generatedAt: string;
  readonly runtimeProfileId: string | null;
  readonly state: ConsequenceShadowReadinessState;
  readonly stageCount: number;
  readonly claimAlignmentReady: boolean;
  readonly readyForSelectedProfile: boolean;
  readonly productionReady: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly readinessOnly: true;
  readonly selectedProfileStorageReady: boolean;
  readonly storageBlockerRefs: readonly string[];
  readonly stages: readonly ConsequenceShadowReadinessStageResult[];
  readonly blockerCount: number;
  readonly blockerCodes: readonly string[];
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceShadowReadinessClaimAlignmentDescriptor {
  readonly version: typeof CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION;
  readonly stageIds: typeof CONSEQUENCE_SHADOW_READINESS_STAGE_IDS;
  readonly criterionIds: typeof CONSEQUENCE_SHADOW_READINESS_CRITERION_IDS;
  readonly criterionStatuses: typeof CONSEQUENCE_SHADOW_READINESS_CRITERION_STATUSES;
  readonly readinessStates: typeof CONSEQUENCE_SHADOW_READINESS_STATES;
  readonly criteria: readonly ConsequenceShadowReadinessCriterionDefinition[];
  readonly stageProfiles: readonly ConsequenceShadowReadinessStageProfile[];
  readonly purpose: 'shadow-readiness-claim-alignment';
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly readinessOnly: true;
}

const COMMON_STATIC_CRITERIA = [
  'descriptor-exported',
  'approval-required',
  'auto-enforce-disabled',
  'raw-payload-storage-disabled',
  'production-ready-not-claimed',
] as const satisfies readonly ConsequenceShadowReadinessCriterionId[];

const CRITERIA: readonly ConsequenceShadowReadinessCriterionDefinition[] = Object.freeze([
  {
    id: 'descriptor-exported',
    summary: 'The shadow stage has a versioned contract exported through the consequence-admission package.',
    evidenceKind: 'code',
    requiredForClaimAlignment: true,
  },
  {
    id: 'approval-required',
    summary: 'The stage keeps customer or operator approval explicit and does not treat generated artifacts as approval.',
    evidenceKind: 'code',
    requiredForClaimAlignment: true,
  },
  {
    id: 'auto-enforce-disabled',
    summary: 'The stage cannot activate enforcement by itself.',
    evidenceKind: 'code',
    requiredForClaimAlignment: true,
  },
  {
    id: 'raw-payload-storage-disabled',
    summary: 'The stage is digest-first and does not store raw prompts, payloads, credentials, or provider bodies.',
    evidenceKind: 'code',
    requiredForClaimAlignment: true,
  },
  {
    id: 'production-ready-not-claimed',
    summary: 'The stage explicitly avoids claiming live production readiness.',
    evidenceKind: 'documentation',
    requiredForClaimAlignment: true,
  },
  {
    id: 'origin-redaction-witness-bound',
    summary: 'Shadow admission events bind origin and redaction witnesses before policy discovery can rely on them.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'server-owned-simulation-floor',
    summary: 'Promotion simulations use server-owned tenant event history and a server-owned promotion event floor.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'promotion-approval-trail-bound',
    summary: 'Promotion drafts and packets keep approval trail digests separate from enforcement activation.',
    evidenceKind: 'code',
    requiredForClaimAlignment: true,
  },
  {
    id: 'production-signing-boundary-split',
    summary: 'Shadow bundle publication separates evaluation signatures from production-boundary signatures.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'downstream-verification-bound',
    summary: 'Downstream verification binding and integration proof must match the publication chain before activation.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'break-glass-extra-gated',
    summary: 'Break-glass activation requires independent approval, bounded expiry, justification, and reconciliation.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'high-risk-two-person-approval',
    summary: 'High-risk activation boundaries require an independent second approver.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'customer-activation-receipt-loop',
    summary: 'Customer activation must close through a receipt that records activation, rollback, kill-switch, and monitoring posture.',
    evidenceKind: 'test',
    requiredForClaimAlignment: true,
  },
  {
    id: 'selected-profile-storage-ready',
    summary: 'The selected runtime profile has storage readiness evidence for shadow state before shared production claims.',
    evidenceKind: 'runtime',
    requiredForClaimAlignment: true,
  },
]);

const STAGE_PROFILES: readonly ConsequenceShadowReadinessStageProfile[] = Object.freeze([
  stageProfile({
    stageId: 'shadow-admission-events',
    sourceFile: 'src/consequence-admission/shadow-events.ts',
    testFile: 'tests/shadow-admission-events.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'origin-redaction-witness-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'origin-redaction-witness-bound',
    ],
    evidenceRefs: [
      'docs/audit/f7-shadow-origin-redaction-witness-validation.md',
      'npm run test:shadow-admission-events',
    ],
  }),
  stageProfile({
    stageId: 'shadow-policy-simulation',
    sourceFile: 'src/consequence-admission/shadow-simulation.ts',
    testFile: 'tests/shadow-policy-simulation.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'server-owned-simulation-floor',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'server-owned-simulation-floor',
    ],
    evidenceRefs: [
      'docs/audit/f7-shadow-simulation-floor-validation.md',
      'npm run test:shadow-policy-simulation',
    ],
  }),
  stageProfile({
    stageId: 'policy-discovery-candidates',
    sourceFile: 'src/consequence-admission/policy-discovery-candidates.ts',
    testFile: 'tests/policy-discovery-candidates.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    evidenceRefs: [
      'npm run test:policy-discovery-candidates',
    ],
  }),
  stageProfile({
    stageId: 'shadow-policy-promotion-draft',
    sourceFile: 'src/consequence-admission/shadow-policy-promotion-draft.ts',
    testFile: 'tests/shadow-policy-promotion-draft.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    evidenceRefs: [
      'npm run test:shadow-policy-promotion-draft',
    ],
  }),
  stageProfile({
    stageId: 'shadow-policy-promotion-packet',
    sourceFile: 'src/consequence-admission/shadow-policy-promotion-packet.ts',
    testFile: 'tests/shadow-policy-promotion-packet.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'promotion-approval-trail-bound',
    ],
    evidenceRefs: [
      'npm run test:shadow-policy-promotion-packet',
    ],
  }),
  stageProfile({
    stageId: 'shadow-policy-bundle-publication',
    sourceFile: 'src/consequence-admission/shadow-policy-bundle-publication.ts',
    testFile: 'tests/shadow-policy-bundle-publication.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'production-signing-boundary-split',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'production-signing-boundary-split',
    ],
    evidenceRefs: [
      'docs/audit/f7-shadow-bundle-signing-boundary-validation.md',
      'npm run test:shadow-policy-bundle-publication',
    ],
  }),
  stageProfile({
    stageId: 'shadow-downstream-verification-binding',
    sourceFile: 'src/consequence-admission/shadow-downstream-verification-binding.ts',
    testFile: 'tests/shadow-downstream-verification-binding.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
    ],
    evidenceRefs: [
      'npm run test:shadow-downstream-verification-binding',
    ],
  }),
  stageProfile({
    stageId: 'shadow-downstream-integration-proof',
    sourceFile: 'src/consequence-admission/shadow-downstream-integration-proof.ts',
    testFile: 'tests/shadow-downstream-integration-proof.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
    ],
    evidenceRefs: [
      'npm run test:shadow-downstream-integration-proof',
    ],
  }),
  stageProfile({
    stageId: 'shadow-activation-readiness-gate',
    sourceFile: 'src/consequence-admission/shadow-activation-readiness-gate.ts',
    testFile: 'tests/shadow-activation-readiness-gate.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
      'production-signing-boundary-split',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'downstream-verification-bound',
      'production-signing-boundary-split',
    ],
    evidenceRefs: [
      'npm run test:shadow-activation-readiness-gate',
    ],
  }),
  stageProfile({
    stageId: 'shadow-customer-activation-handoff',
    sourceFile: 'src/consequence-admission/shadow-customer-activation-handoff.ts',
    testFile: 'tests/shadow-customer-activation-handoff.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'break-glass-extra-gated',
      'high-risk-two-person-approval',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'break-glass-extra-gated',
      'high-risk-two-person-approval',
    ],
    evidenceRefs: [
      'docs/audit/f7-break-glass-hardening-validation.md',
      'docs/audit/f7-high-risk-two-person-activation-validation.md',
      'npm run test:shadow-customer-activation-handoff',
    ],
  }),
  stageProfile({
    stageId: 'shadow-customer-activation-receipt',
    sourceFile: 'src/consequence-admission/shadow-customer-activation-receipt.ts',
    testFile: 'tests/shadow-customer-activation-receipt.test.ts',
    requiredCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'customer-activation-receipt-loop',
    ],
    staticPassedCriteria: [
      ...COMMON_STATIC_CRITERIA,
      'customer-activation-receipt-loop',
    ],
    evidenceRefs: [
      'npm run test:shadow-customer-activation-receipt',
    ],
  }),
  stageProfile({
    stageId: 'shadow-production-storage-path',
    sourceFile: 'src/service/bootstrap/production-storage-path.ts',
    testFile: 'tests/production-storage-path.test.ts',
    requiredCriteria: [
      'selected-profile-storage-ready',
    ],
    staticPassedCriteria: [],
    evidenceRefs: [
      'npm run test:production-storage-path',
      'GET /api/v1/ready',
    ],
  }),
]);

function stageProfile(
  input: ConsequenceShadowReadinessStageProfile,
): ConsequenceShadowReadinessStageProfile {
  return Object.freeze({
    ...input,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    requiredCriteria: Object.freeze([...input.requiredCriteria]),
    staticPassedCriteria: Object.freeze([...input.staticPassedCriteria]),
  });
}

function hashCanonical(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function storageReadyForSelectedProfile(
  runtimeProfileId: string | null,
  productionStoragePath: ShadowProductionStoragePathSnapshot | null | undefined,
): boolean {
  if (runtimeProfileId !== 'production-shared') return true;
  return productionStoragePath?.readyForSelectedProfile === true;
}

function storageBlockerRefs(
  productionStoragePath: ShadowProductionStoragePathSnapshot | null | undefined,
): readonly string[] {
  return Object.freeze(
    (productionStoragePath?.blockers ?? []).map((blocker) => {
      const code = blocker.code?.trim() || 'storage-blocker';
      const component = blocker.component?.trim() || 'unknown-component';
      return `${component}:${code}`;
    }),
  );
}

function criterionResult(input: {
  readonly profile: ConsequenceShadowReadinessStageProfile;
  readonly criterionId: ConsequenceShadowReadinessCriterionId;
  readonly selectedProfileStorageReady: boolean;
  readonly storageRefs: readonly string[];
}): ConsequenceShadowReadinessCriterionResult {
  const isStorageCriterion = input.criterionId === 'selected-profile-storage-ready';
  const passed = isStorageCriterion
    ? input.selectedProfileStorageReady
    : input.profile.staticPassedCriteria.includes(input.criterionId);
  const evidenceRefs = isStorageCriterion
    ? Object.freeze([...input.profile.evidenceRefs, ...input.storageRefs])
    : input.profile.evidenceRefs;

  return Object.freeze({
    criterionId: input.criterionId,
    status: passed ? 'pass' : 'blocked',
    evidenceRefs,
    limitation: passed
      ? 'Criterion is satisfied for repository-side claim alignment only; this does not certify live production readiness.'
      : 'Criterion is required before selected-profile shadow readiness can be claimed.',
  });
}

function evaluateStage(input: {
  readonly profile: ConsequenceShadowReadinessStageProfile;
  readonly selectedProfileStorageReady: boolean;
  readonly storageRefs: readonly string[];
}): ConsequenceShadowReadinessStageResult {
  const criteria = Object.freeze(input.profile.requiredCriteria.map((criterionId) =>
    criterionResult({
      profile: input.profile,
      criterionId,
      selectedProfileStorageReady: input.selectedProfileStorageReady,
      storageRefs: input.storageRefs,
    })
  ));
  const blockers = Object.freeze(criteria
    .filter((criterion) => criterion.status !== 'pass')
    .map((criterion) => `${input.profile.stageId}:${criterion.criterionId}`));

  return Object.freeze({
    stageId: input.profile.stageId,
    sourceFile: input.profile.sourceFile,
    testFile: input.profile.testFile,
    claimAligned: blockers.length === 0,
    criteria,
    blockers,
  });
}

function readinessState(input: {
  readonly runtimeProfileId: string | null;
  readonly blockerCount: number;
}): ConsequenceShadowReadinessState {
  if (input.runtimeProfileId !== 'production-shared') return 'evaluation-shadow-accepted';
  return input.blockerCount === 0
    ? 'production-shared-shadow-ready'
    : 'production-shared-shadow-blocked';
}

export function consequenceShadowReadinessClaimAlignmentDescriptor():
ConsequenceShadowReadinessClaimAlignmentDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION,
    stageIds: CONSEQUENCE_SHADOW_READINESS_STAGE_IDS,
    criterionIds: CONSEQUENCE_SHADOW_READINESS_CRITERION_IDS,
    criterionStatuses: CONSEQUENCE_SHADOW_READINESS_CRITERION_STATUSES,
    readinessStates: CONSEQUENCE_SHADOW_READINESS_STATES,
    criteria: CRITERIA,
    stageProfiles: STAGE_PROFILES,
    purpose: 'shadow-readiness-claim-alignment',
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    readinessOnly: true,
  });
}

export function evaluateConsequenceShadowReadinessClaimAlignment(
  input: EvaluateConsequenceShadowReadinessClaimAlignmentInput = {},
): ConsequenceShadowReadinessClaimAlignment {
  const runtimeProfileId = input.runtimeProfileId?.trim() || null;
  const selectedProfileStorageReady = storageReadyForSelectedProfile(
    runtimeProfileId,
    input.productionStoragePath,
  );
  const storageRefs = storageBlockerRefs(input.productionStoragePath);
  const stages = Object.freeze(STAGE_PROFILES.map((profile) =>
    evaluateStage({
      profile,
      selectedProfileStorageReady,
      storageRefs,
    })
  ));
  const blockerCodes = Object.freeze(stages.flatMap((stage) => stage.blockers));
  const state = readinessState({
    runtimeProfileId,
    blockerCount: blockerCodes.length,
  });
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const payload = {
    version: CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION,
    generatedAt,
    runtimeProfileId,
    state,
    stageCount: stages.length,
    claimAlignmentReady: blockerCodes.length === 0,
    readyForSelectedProfile: blockerCodes.length === 0,
    productionReady: false,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    readinessOnly: true,
    selectedProfileStorageReady,
    storageBlockerRefs: storageRefs,
    stages,
    blockerCount: blockerCodes.length,
    blockerCodes,
    limitation:
      'Shadow readiness claim alignment is repository-side readiness evidence only; it does not certify live production readiness, customer activation, or external audit status.',
  } as const;
  const { canonical, digest } = hashCanonical(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}
