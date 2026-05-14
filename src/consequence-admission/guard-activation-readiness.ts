import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { ConsequenceFailureModeId } from './failure-mode-registry.js';

export const CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION =
  'attestor.consequence-guard-activation-readiness.v1';

export const CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS = [
  'agent-loop-abuse-guard',
  'untrusted-content-authority-guard',
  'tool-result-poisoning-guard',
  'approval-provenance-guard',
  'stale-authority-policy-guard',
  'scope-explosion-guard',
  'human-review-fatigue-guard',
  'agentic-supply-chain-guard',
  'multi-agent-delegation-guard',
] as const;
export type ConsequenceGuardActivationGuardId =
  typeof CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS[number];

export const CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS = [
  'guard-descriptor-exported',
  'fail-closed-decision-output',
  'raw-payload-storage-disabled',
  'production-shared-state-proven',
  'signed-decision-binding',
  'route-or-pep-enforcement-integrated',
  'downstream-verifier-integrated',
  'replay-fixture-covered',
  'audit-record-emitted',
  'operator-runbook-documented',
  'customer-activation-approved',
] as const;
export type ConsequenceGuardActivationCriterionId =
  typeof CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS[number];

export const CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES = [
  'pass',
  'blocked',
  'not-applicable',
] as const;
export type ConsequenceGuardActivationCriterionStatus =
  typeof CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES[number];

export const CONSEQUENCE_GUARD_ACTIVATION_STATES = [
  'decision-only',
  'production-enforcement-blocked',
  'production-enforcement-ready',
] as const;
export type ConsequenceGuardActivationState =
  typeof CONSEQUENCE_GUARD_ACTIVATION_STATES[number];

export interface ConsequenceGuardActivationCriterionDefinition {
  readonly id: ConsequenceGuardActivationCriterionId;
  readonly summary: string;
  readonly requiredForProductionEnforcement: boolean;
  readonly evidenceKind:
    | 'code'
    | 'test'
    | 'runtime'
    | 'documentation'
    | 'customer-approval';
}

export interface ConsequenceGuardActivationCriterionEvidence {
  readonly guardId: ConsequenceGuardActivationGuardId;
  readonly criterionId: ConsequenceGuardActivationCriterionId;
  readonly status: ConsequenceGuardActivationCriterionStatus;
  readonly evidenceRefs?: readonly string[] | null;
  readonly limitation?: string | null;
}

export interface EvaluateConsequenceGuardActivationReadinessInput {
  readonly generatedAt?: string | null;
  readonly evidence?: readonly ConsequenceGuardActivationCriterionEvidence[] | null;
}

export interface ConsequenceGuardActivationGuardProfile {
  readonly guardId: ConsequenceGuardActivationGuardId;
  readonly sourceFile: string;
  readonly docFile: string;
  readonly testFile: string;
  readonly failureModeIds: readonly ConsequenceFailureModeId[];
  readonly requiredCriteria: readonly ConsequenceGuardActivationCriterionId[];
  readonly staticPassedCriteria: readonly ConsequenceGuardActivationCriterionId[];
}

export interface ConsequenceGuardActivationCriterionResult {
  readonly criterionId: ConsequenceGuardActivationCriterionId;
  readonly status: ConsequenceGuardActivationCriterionStatus;
  readonly requiredForProductionEnforcement: boolean;
  readonly evidenceRefs: readonly string[];
  readonly limitation: string;
}

export interface ConsequenceGuardActivationGuardReadiness {
  readonly guardId: ConsequenceGuardActivationGuardId;
  readonly failureModeIds: readonly ConsequenceFailureModeId[];
  readonly state: ConsequenceGuardActivationState;
  readonly activationReady: boolean;
  readonly decisionOnly: boolean;
  readonly sourceFile: string;
  readonly docFile: string;
  readonly testFile: string;
  readonly criteria: readonly ConsequenceGuardActivationCriterionResult[];
  readonly missingCriteria: readonly ConsequenceGuardActivationCriterionId[];
  readonly blockers: readonly string[];
}

export interface ConsequenceGuardActivationReadiness {
  readonly version: typeof CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION;
  readonly generatedAt: string;
  readonly guardCount: number;
  readonly activationReady: boolean;
  readonly productionReady: false;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly readinessOnly: true;
  readonly guards: readonly ConsequenceGuardActivationGuardReadiness[];
  readonly blockerCount: number;
  readonly blockerCodes: readonly string[];
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceGuardActivationReadinessDescriptor {
  readonly version: typeof CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION;
  readonly guardIds: typeof CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS;
  readonly criterionIds: typeof CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS;
  readonly criterionStatuses: typeof CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES;
  readonly activationStates: typeof CONSEQUENCE_GUARD_ACTIVATION_STATES;
  readonly criteria: readonly ConsequenceGuardActivationCriterionDefinition[];
  readonly guardProfiles: readonly ConsequenceGuardActivationGuardProfile[];
  readonly separatesDecisionRenderingFromEnforcement: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
}

const CRITERION_DEFINITIONS: readonly ConsequenceGuardActivationCriterionDefinition[] =
  Object.freeze([
    {
      id: 'guard-descriptor-exported',
      summary: 'The guard exposes a versioned descriptor through the consequence-admission package.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'code',
    },
    {
      id: 'fail-closed-decision-output',
      summary: 'The guard can render a hold, review, or block decision without falling open.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'code',
    },
    {
      id: 'raw-payload-storage-disabled',
      summary: 'The guard emits digest-first evidence and does not store raw prompts, payloads, credentials, or provider bodies.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'code',
    },
    {
      id: 'production-shared-state-proven',
      summary: 'Any mutable guard state is backed by shared durable runtime storage when production-shared deployment is claimed.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'runtime',
    },
    {
      id: 'signed-decision-binding',
      summary: 'The guard decision can be bound into signed or digest-verified admission proof instead of prose-only output.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'code',
    },
    {
      id: 'route-or-pep-enforcement-integrated',
      summary: 'A route, gateway, verifier, sidecar, MCP gateway, or protected adapter consumes negative guard decisions before action.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'runtime',
    },
    {
      id: 'downstream-verifier-integrated',
      summary: 'The downstream execution edge verifies the admission, binding, replay/idempotency posture, and guard outcome before execution.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'runtime',
    },
    {
      id: 'replay-fixture-covered',
      summary: 'A deterministic replay fixture proves the guard catches the relevant failure mode.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'test',
    },
    {
      id: 'audit-record-emitted',
      summary: 'The guard outcome produces a data-minimized audit record or proof reference.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'test',
    },
    {
      id: 'operator-runbook-documented',
      summary: 'Operators have a documented response path for guard blocks, throttles, reviews, and degraded dependencies.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'documentation',
    },
    {
      id: 'customer-activation-approved',
      summary: 'The customer has explicitly approved activation for the scoped workflow; generated artifacts are not treated as approval.',
      requiredForProductionEnforcement: true,
      evidenceKind: 'customer-approval',
    },
  ]);

const COMMON_STATIC_PASSED_CRITERIA = [
  'guard-descriptor-exported',
  'fail-closed-decision-output',
  'raw-payload-storage-disabled',
] as const satisfies readonly ConsequenceGuardActivationCriterionId[];

const GUARD_PROFILES: readonly ConsequenceGuardActivationGuardProfile[] = Object.freeze([
  profile({
    guardId: 'agent-loop-abuse-guard',
    sourceFile: 'src/consequence-admission/agent-loop-abuse-guard.ts',
    docFile: 'docs/02-architecture/agent-loop-abuse-guard.md',
    testFile: 'tests/consequence-admission-agent-loop-abuse-guard.test.ts',
    failureModeIds: ['tool-misuse-excessive-agency', 'duplicate-execution-replay'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'untrusted-content-authority-guard',
    sourceFile: 'src/consequence-admission/untrusted-content-authority-guard.ts',
    docFile: 'docs/02-architecture/untrusted-content-authority-guard.md',
    testFile: 'tests/untrusted-content-authority-guard.test.ts',
    failureModeIds: ['untrusted-content-authorizes-action', 'indirect-prompt-injection'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'tool-result-poisoning-guard',
    sourceFile: 'src/consequence-admission/tool-result-poisoning-guard.ts',
    docFile: 'docs/02-architecture/tool-result-poisoning-guard.md',
    testFile: 'tests/tool-result-poisoning-guard.test.ts',
    failureModeIds: ['tool-result-poisoning', 'unsupported-confidence-or-hallucinated-evidence'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'approval-provenance-guard',
    sourceFile: 'src/consequence-admission/approval-provenance-guard.ts',
    docFile: 'docs/02-architecture/approval-provenance-guard.md',
    testFile: 'tests/approval-provenance-guard.test.ts',
    failureModeIds: ['fake-approval-laundering', 'untrusted-content-authorizes-action'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'stale-authority-policy-guard',
    sourceFile: 'src/consequence-admission/stale-authority-policy-guard.ts',
    docFile: 'docs/02-architecture/stale-authority-policy-guard.md',
    testFile: 'tests/stale-authority-policy-guard.test.ts',
    failureModeIds: ['stale-authority-or-policy', 'model-tool-config-drift'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'scope-explosion-guard',
    sourceFile: 'src/consequence-admission/scope-explosion-guard.ts',
    docFile: 'docs/02-architecture/scope-explosion-guard.md',
    testFile: 'tests/scope-explosion-guard.test.ts',
    failureModeIds: ['scope-explosion', 'hidden-downstream-side-effect'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'human-review-fatigue-guard',
    sourceFile: 'src/consequence-admission/human-review-fatigue-guard.ts',
    docFile: 'docs/02-architecture/human-review-fatigue-guard.md',
    testFile: 'tests/human-review-fatigue-guard.test.ts',
    failureModeIds: ['human-review-fatigue', 'review-required-auto-promote'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'agentic-supply-chain-guard',
    sourceFile: 'src/consequence-admission/agentic-supply-chain-guard.ts',
    docFile: 'docs/02-architecture/agentic-supply-chain-guard.md',
    testFile: 'tests/agentic-supply-chain-guard.test.ts',
    failureModeIds: ['agentic-supply-chain-compromise'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
  profile({
    guardId: 'multi-agent-delegation-guard',
    sourceFile: 'src/consequence-admission/multi-agent-delegation-guard.ts',
    docFile: 'docs/02-architecture/multi-agent-delegation-guard.md',
    testFile: 'tests/multi-agent-delegation-guard.test.ts',
    failureModeIds: ['multi-agent-delegation-confusion'],
    staticPassedCriteria: COMMON_STATIC_PASSED_CRITERIA,
  }),
]);

function profile(
  input: Omit<ConsequenceGuardActivationGuardProfile, 'requiredCriteria'>,
): ConsequenceGuardActivationGuardProfile {
  return Object.freeze({
    ...input,
    requiredCriteria: CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS,
  });
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function defaultGeneratedAt(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Consequence guard activation readiness generatedAt must be an ISO timestamp.');
  }
  return parsed.toISOString();
}

function criterionDefinition(
  id: ConsequenceGuardActivationCriterionId,
): ConsequenceGuardActivationCriterionDefinition {
  const definition = CRITERION_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) {
    throw new Error(`Consequence guard activation readiness unknown criterion: ${id}`);
  }
  return definition;
}

function evidenceKey(
  guardId: ConsequenceGuardActivationGuardId,
  criterionId: ConsequenceGuardActivationCriterionId,
): string {
  return `${guardId}:${criterionId}`;
}

function buildEvidenceMap(
  evidence: readonly ConsequenceGuardActivationCriterionEvidence[] | null | undefined,
): ReadonlyMap<string, ConsequenceGuardActivationCriterionEvidence> {
  const map = new Map<string, ConsequenceGuardActivationCriterionEvidence>();
  for (const item of evidence ?? []) {
    map.set(evidenceKey(item.guardId, item.criterionId), item);
  }
  return map;
}

function defaultStaticEvidenceRefs(
  profileItem: ConsequenceGuardActivationGuardProfile,
  criterionId: ConsequenceGuardActivationCriterionId,
): readonly string[] {
  if (criterionId === 'guard-descriptor-exported') return Object.freeze([profileItem.sourceFile]);
  if (criterionId === 'fail-closed-decision-output') return Object.freeze([profileItem.sourceFile, profileItem.testFile]);
  if (criterionId === 'raw-payload-storage-disabled') return Object.freeze([profileItem.sourceFile, profileItem.docFile]);
  return Object.freeze([]);
}

function criterionResult(
  profileItem: ConsequenceGuardActivationGuardProfile,
  criterionId: ConsequenceGuardActivationCriterionId,
  evidenceMap: ReadonlyMap<string, ConsequenceGuardActivationCriterionEvidence>,
): ConsequenceGuardActivationCriterionResult {
  const supplied = evidenceMap.get(evidenceKey(profileItem.guardId, criterionId));
  const staticPass = profileItem.staticPassedCriteria.includes(criterionId);
  const definition = criterionDefinition(criterionId);
  const status = supplied?.status ?? (staticPass ? 'pass' : 'blocked');
  const evidenceRefs = supplied?.evidenceRefs ?? defaultStaticEvidenceRefs(profileItem, criterionId);
  const limitation = supplied?.limitation ?? (
    status === 'pass'
      ? 'Recorded evidence satisfies this activation criterion for the scoped guard.'
      : 'Not recorded. This criterion must be proven before production enforcement can be claimed.'
  );

  return Object.freeze({
    criterionId,
    status,
    requiredForProductionEnforcement: definition.requiredForProductionEnforcement,
    evidenceRefs: readonlyCopy(evidenceRefs),
    limitation,
  });
}

function guardReadiness(
  profileItem: ConsequenceGuardActivationGuardProfile,
  evidenceMap: ReadonlyMap<string, ConsequenceGuardActivationCriterionEvidence>,
): ConsequenceGuardActivationGuardReadiness {
  const criteria = profileItem.requiredCriteria.map((criterionId) =>
    criterionResult(profileItem, criterionId, evidenceMap)
  );
  const missingCriteria = criteria
    .filter((criterion) =>
      criterion.requiredForProductionEnforcement &&
      criterion.status !== 'pass'
    )
    .map((criterion) => criterion.criterionId);
  const activationReady = missingCriteria.length === 0;
  const state: ConsequenceGuardActivationState = activationReady
    ? 'production-enforcement-ready'
    : profileItem.staticPassedCriteria.length > 0
      ? 'production-enforcement-blocked'
      : 'decision-only';
  const blockers = missingCriteria.map((criterionId) =>
    `${profileItem.guardId}:${criterionId}`
  );

  return Object.freeze({
    guardId: profileItem.guardId,
    failureModeIds: readonlyCopy(profileItem.failureModeIds),
    state,
    activationReady,
    decisionOnly: !activationReady,
    sourceFile: profileItem.sourceFile,
    docFile: profileItem.docFile,
    testFile: profileItem.testFile,
    criteria: readonlyCopy(criteria),
    missingCriteria: readonlyCopy(missingCriteria),
    blockers: readonlyCopy(blockers),
  });
}

export function evaluateConsequenceGuardActivationReadiness(
  input: EvaluateConsequenceGuardActivationReadinessInput = {},
): ConsequenceGuardActivationReadiness {
  const generatedAt = defaultGeneratedAt(input.generatedAt);
  const evidenceMap = buildEvidenceMap(input.evidence);
  const guards = GUARD_PROFILES.map((profileItem) => guardReadiness(profileItem, evidenceMap));
  const blockerCodes = guards.flatMap((guard) => guard.blockers);
  const activationReady = blockerCodes.length === 0;
  const unsigned = {
    version: CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION,
    generatedAt,
    guardCount: guards.length,
    activationReady,
    productionReady: false,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    readinessOnly: true,
    guards,
    blockerCount: blockerCodes.length,
    blockerCodes: readonlyCopy(blockerCodes),
    limitation:
      'Guard activation readiness is a machine-readable checklist. It does not activate enforcement, issue customer approval, prove live deployment, or certify production readiness.',
  } as const;
  const proof = canonicalObject(unsigned as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...unsigned,
    canonical: proof.canonical,
    digest: proof.digest,
  });
}

export function consequenceGuardActivationReadinessDescriptor():
ConsequenceGuardActivationReadinessDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_GUARD_ACTIVATION_READINESS_VERSION,
    guardIds: CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS,
    criterionIds: CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS,
    criterionStatuses: CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES,
    activationStates: CONSEQUENCE_GUARD_ACTIVATION_STATES,
    criteria: CRITERION_DEFINITIONS,
    guardProfiles: GUARD_PROFILES,
    separatesDecisionRenderingFromEnforcement: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
  });
}
