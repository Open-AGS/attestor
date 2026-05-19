import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseContract,
  type AssuranceCaseContract,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  DECISION_LINEAGE_GRAPH_VERSION,
  createDecisionLineageGraph,
  type DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';
import {
  OUTCOME_FEEDBACK_COE_WIRING_VERSION,
  createOutcomeFeedbackCoeWiring,
  type OutcomeFeedbackCoeReferenceInput,
  type OutcomeFeedbackCoeWiringRecord,
} from './outcome-feedback-coe-wiring.js';
import {
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  type OutcomeIncidentFeedbackContract,
} from './outcome-incident-feedback-contract.js';
import {
  SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
  type ShadowRuntimeObservabilityHooksResult,
} from './shadow-runtime-observability-hooks.js';

export const SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION =
  'attestor.shadow-runtime-outcome-feedback-hook.v1';

export const SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_SOURCE_ANCHORS = [
  'aws-correction-of-error-systemic-action-items',
  'google-sre-blameless-postmortem-action-items',
  'w3c-prov-outcome-feedback-lineage',
  'nist-ai-rmf-manage-feedback-loop',
  'assurance-2-rebutting-defeater-for-contradictory-outcome',
] as const;
export type ShadowRuntimeOutcomeFeedbackHookSourceAnchor =
  typeof SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_SOURCE_ANCHORS[number];

export interface RunShadowRuntimeOutcomeFeedbackHookInput {
  readonly observability: ShadowRuntimeObservabilityHooksResult;
  readonly feedback: OutcomeIncidentFeedbackContract;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly wiringId?: string | null;
  readonly lineageId?: string | null;
  readonly coe?: OutcomeFeedbackCoeReferenceInput | null;
  readonly minimumActionItemCount?: number | null;
  readonly targetClaimNodeId?: string | null;
  readonly builderRefDigest?: string | null;
  readonly rawFeedbackRequested?: boolean | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface ShadowRuntimeOutcomeFeedbackHookResult {
  readonly version: typeof SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION;
  readonly shadowRuntimeObservabilityHooksVersion:
    typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly outcomeIncidentFeedbackContractVersion:
    typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly outcomeFeedbackCoeWiringVersion:
    typeof OUTCOME_FEEDBACK_COE_WIRING_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly hookStatus: 'outcome-feedback-bound';
  readonly executionMode: 'shadow-only';
  readonly observabilityDigest: string;
  readonly activationDigest: string;
  readonly pipelineDigest: string;
  readonly envelopeRefDigest: string;
  readonly tenantRefDigest: string;
  readonly inputAssuranceCaseDigest: string;
  readonly feedbackDigest: string;
  readonly feedbackAssurancePacketDigest: string;
  readonly coeWiringDigest: string;
  readonly feedbackBoundAssuranceCaseDigest: string;
  readonly lineageGraphDigest: string;
  readonly evaluatedAt: string;
  readonly outcome: OutcomeFeedbackCoeWiringRecord['outcome'];
  readonly feedbackStatus: OutcomeIncidentFeedbackContract['status'];
  readonly coeRequired: boolean;
  readonly coeComplete: boolean;
  readonly opensRebuttingDefeater: boolean;
  readonly feedbackAppliedAsEvidence: boolean;
  readonly feedbackOpenedDefeater: boolean;
  readonly coeWiring: OutcomeFeedbackCoeWiringRecord;
  readonly feedbackBoundAssuranceCase: AssuranceCaseContract;
  readonly lineageGraph: DecisionLineageGraphRecord;
  readonly reasonCodes: readonly string[];
  readonly feedbackHooked: true;
  readonly lineageHooked: true;
  readonly feedbackReadOnly: true;
  readonly assuranceCaseInputReadOnly: true;
  readonly writesAuditPlane: false;
  readonly writesExternalLineageBackend: false;
  readonly closesDefeaters: false;
  readonly mutatesPolicy: false;
  readonly mutatesScore: false;
  readonly mutatesCalibration: false;
  readonly activatesLearning: false;
  readonly activatesTraining: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawFeedbackRead: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowRuntimeOutcomeFeedbackHookDescriptor {
  readonly version: typeof SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION;
  readonly shadowRuntimeObservabilityHooksVersion:
    typeof SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION;
  readonly outcomeIncidentFeedbackContractVersion:
    typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly outcomeFeedbackCoeWiringVersion:
    typeof OUTCOME_FEEDBACK_COE_WIRING_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly sourceAnchors: readonly ShadowRuntimeOutcomeFeedbackHookSourceAnchor[];
  readonly requiresR06Observability: true;
  readonly requiresPacketDigestBinding: true;
  readonly producesDerivedAssuranceCaseValue: true;
  readonly writesAuditPlane: false;
  readonly writesExternalLineageBackend: false;
  readonly closesDefeaters: false;
  readonly mutatesPolicy: false;
  readonly mutatesScore: false;
  readonly mutatesCalibration: false;
  readonly activatesLearning: false;
  readonly activatesTraining: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawFeedbackRead: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Shadow runtime outcome feedback hook ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 768 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Shadow runtime outcome feedback hook ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Shadow runtime outcome feedback hook ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Shadow runtime outcome feedback hook ${fieldName} must be an ISO timestamp.`);
  }
  return parsed.toISOString();
}

function assertFalse(value: boolean, fieldName: string): void {
  if (value !== false) {
    throw new Error(`Shadow runtime outcome feedback hook ${fieldName} must be false.`);
  }
}

function shortDigest(digest: string): string {
  return digest.replace(/^sha256:/u, '').slice(0, 16);
}

function assertObservability(input: ShadowRuntimeObservabilityHooksResult): void {
  if (input.version !== SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION) {
    throw new Error(
      `Shadow runtime outcome feedback hook observability.version must be ${SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION}.`,
    );
  }
  if (input.assuranceCaseDigest !== input.assuranceCase.digest) {
    throw new Error('Shadow runtime outcome feedback hook observability assurance case digest mismatch.');
  }
  if (input.lineageGraph.caseDigest !== input.assuranceCase.digest) {
    throw new Error('Shadow runtime outcome feedback hook observability lineage case digest mismatch.');
  }
  if (input.runtimeMonitor.packetDigest !== input.runtimeMonitor.packetDigest.trim()) {
    throw new Error('Shadow runtime outcome feedback hook observability packet digest must be normalized.');
  }
  assertFalse(input.writesAuditPlane, 'observability.writesAuditPlane');
  assertFalse(input.writesExternalTraceBackend, 'observability.writesExternalTraceBackend');
  assertFalse(input.externalLineageExportIncluded, 'observability.externalLineageExportIncluded');
  assertFalse(input.measurementAuthorityIncluded, 'observability.measurementAuthorityIncluded');
  assertFalse(input.grantsAuthority, 'observability.grantsAuthority');
  assertFalse(input.canAdmit, 'observability.canAdmit');
  assertFalse(input.activatesEnforcement, 'observability.activatesEnforcement');
  assertFalse(input.autoEnforce, 'observability.autoEnforce');
  assertFalse(input.rawPayloadRead, 'observability.rawPayloadRead');
  assertFalse(input.rawPayloadStored, 'observability.rawPayloadStored');
  assertFalse(input.learnsFromTraffic, 'observability.learnsFromTraffic');
  assertFalse(input.crossTenantAggregation, 'observability.crossTenantAggregation');
  assertFalse(input.productionReady, 'observability.productionReady');
}

function assertFeedbackBinding(input: {
  readonly observability: ShadowRuntimeObservabilityHooksResult;
  readonly feedback: OutcomeIncidentFeedbackContract;
}): void {
  if (input.feedback.version !== OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION) {
    throw new Error(
      `Shadow runtime outcome feedback hook feedback.version must be ${OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION}.`,
    );
  }
  if (input.feedback.assurancePacketDigest !== input.observability.runtimeMonitor.packetDigest) {
    throw new Error(
      'Shadow runtime outcome feedback hook feedback assurance packet digest must match the observed runtime packet.',
    );
  }
  assertFalse(input.feedback.grantsAuthority, 'feedback.grantsAuthority');
  assertFalse(input.feedback.canAdmit, 'feedback.canAdmit');
  assertFalse(input.feedback.activatesEnforcement, 'feedback.activatesEnforcement');
  assertFalse(input.feedback.autoEnforce, 'feedback.autoEnforce');
  assertFalse(input.feedback.rawPayloadStored, 'feedback.rawPayloadStored');
  assertFalse(input.feedback.productionReady, 'feedback.productionReady');
}

function appendIfPresent<T>(items: readonly T[], item: T | null): readonly T[] {
  return Object.freeze(item === null ? [...items] : [...items, item]);
}

function derivedAssuranceCase(input: {
  readonly observability: ShadowRuntimeObservabilityHooksResult;
  readonly coeWiring: OutcomeFeedbackCoeWiringRecord;
}): AssuranceCaseContract {
  const source = input.observability.assuranceCase;
  const nodes: readonly AssuranceCaseNode[] = appendIfPresent(
    source.nodes,
    input.coeWiring.evidenceNode,
  );
  const defeaters: readonly AssuranceCaseDefeater[] = appendIfPresent(
    source.defeaters,
    input.coeWiring.openDefeater,
  );
  const transitionsWithEvidence: readonly AssuranceCaseTransition[] = appendIfPresent(
    source.transitions,
    input.coeWiring.evidenceTransition,
  );
  const transitions = appendIfPresent(
    transitionsWithEvidence,
    input.coeWiring.defeaterTransition,
  );
  const moduleRefDigests = Object.freeze([
    ...new Set([
      ...source.moduleRefDigests,
      input.observability.digest,
      input.observability.runtimeMonitor.digest,
      input.observability.lineageGraph.digest,
      input.coeWiring.feedbackDigest,
      input.coeWiring.digest,
    ]),
  ].sort());

  return createAssuranceCaseContract({
    caseId: `${source.caseId}:r07:${shortDigest(input.coeWiring.digest)}`,
    tenantRefDigest: source.tenantRefDigest,
    rootClaimId: source.rootClaimId,
    createdAt: source.createdAt,
    lastReviewedAt: source.lastReviewedAt,
    nodes,
    defeaters,
    transitions,
    moduleRefDigests,
  });
}

export function runShadowRuntimeOutcomeFeedbackHook(
  input: RunShadowRuntimeOutcomeFeedbackHookInput,
): ShadowRuntimeOutcomeFeedbackHookResult {
  const observability = input.observability;
  const feedback = input.feedback;
  assertObservability(observability);
  assertFeedbackBinding({ observability, feedback });

  const evaluatedAt = normalizeTimestamp(input.evaluatedAt, 'evaluatedAt');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const targetClaimNodeId = normalizeIdentifier(
    input.targetClaimNodeId ?? observability.assuranceCase.rootClaimId,
    'targetClaimNodeId',
  );
  const wiringId = normalizeIdentifier(
    input.wiringId ?? `r07:${shortDigest(observability.digest)}:${shortDigest(feedback.digest)}`,
    'wiringId',
  );
  const builderRefDigest = normalizeDigest(
    input.builderRefDigest ?? evaluatorRefDigest,
    'builderRefDigest',
  );

  const coeWiring = createOutcomeFeedbackCoeWiring({
    assuranceCase: observability.assuranceCase,
    feedback,
    wiringId,
    evaluatedAt,
    evaluatorRefDigest,
    targetClaimNodeId,
    coe: input.coe,
    minimumActionItemCount: input.minimumActionItemCount,
    rawFeedbackRequested: input.rawFeedbackRequested,
    rawPayloadRequested: input.rawPayloadRequested,
    auditWriteRequested: input.auditWriteRequested,
    policyActivationRequested: input.policyActivationRequested,
    liveEnforcementRequested: input.liveEnforcementRequested,
    authorityActionRequested: input.authorityActionRequested,
  });
  const feedbackBoundAssuranceCase = derivedAssuranceCase({
    observability,
    coeWiring,
  });
  const lineageId = normalizeIdentifier(
    input.lineageId ?? `lineage:r07:${shortDigest(feedbackBoundAssuranceCase.digest)}`,
    'lineageId',
  );
  const lineageGraph = createDecisionLineageGraph({
    assuranceCase: feedbackBoundAssuranceCase,
    lineageId,
    generatedAt: evaluatedAt,
    builderRefDigest,
    artifactRefs: [
      {
        artifactId: 'artifact:r07:runtime-observability',
        artifactKind: 'runtime-monitor-record',
        artifactDigest: observability.runtimeMonitor.digest,
        sourceVersion: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
        producedAt: observability.observedAt,
        producerRefDigest: evaluatorRefDigest,
        targetNodeId: feedbackBoundAssuranceCase.rootClaimId,
      },
      {
        artifactId: 'artifact:r07:outcome-feedback',
        artifactKind: 'outcome-feedback-record',
        artifactDigest: feedback.digest,
        sourceVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
        producedAt: feedback.generatedAt,
        producerRefDigest: evaluatorRefDigest,
        targetNodeId: feedbackBoundAssuranceCase.rootClaimId,
      },
      {
        artifactId: 'artifact:r07:outcome-feedback-coe-wiring',
        artifactKind: 'outcome-feedback-record',
        artifactDigest: coeWiring.digest,
        sourceVersion: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
        producedAt: evaluatedAt,
        producerRefDigest: evaluatorRefDigest,
        targetNodeId: coeWiring.evidenceNode?.nodeId ??
          coeWiring.openDefeater?.attacksNodeId ??
          feedbackBoundAssuranceCase.rootClaimId,
      },
    ],
  });
  const reasonCodes = Object.freeze([
    'outcome-feedback:runtime-hook-bound',
    `outcome-feedback:${coeWiring.outcome}`,
    `outcome-feedback-status:${feedback.status}`,
    `coe-required:${coeWiring.coeRequired}`,
    `coe-complete:${coeWiring.coeComplete}`,
    coeWiring.opensRebuttingDefeater
      ? 'assurance-case:rebutting-defeater-opened'
      : 'assurance-case:no-rebutting-defeater-opened',
    `lineage:${lineageGraph.outcome}`,
    'authority:outcome-feedback-no-admit',
  ]);
  const material = {
    version: SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
    shadowRuntimeObservabilityHooksVersion: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    outcomeIncidentFeedbackContractVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    outcomeFeedbackCoeWiringVersion: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    hookStatus: 'outcome-feedback-bound' as const,
    executionMode: 'shadow-only' as const,
    observabilityDigest: observability.digest,
    activationDigest: observability.activationDigest,
    pipelineDigest: observability.pipelineDigest,
    envelopeRefDigest: observability.envelopeRefDigest,
    tenantRefDigest: observability.tenantRefDigest,
    inputAssuranceCaseDigest: observability.assuranceCase.digest,
    feedbackDigest: feedback.digest,
    feedbackAssurancePacketDigest: feedback.assurancePacketDigest,
    coeWiringDigest: coeWiring.digest,
    feedbackBoundAssuranceCaseDigest: feedbackBoundAssuranceCase.digest,
    lineageGraphDigest: lineageGraph.digest,
    evaluatedAt,
    outcome: coeWiring.outcome,
    feedbackStatus: feedback.status,
    coeRequired: coeWiring.coeRequired,
    coeComplete: coeWiring.coeComplete,
    opensRebuttingDefeater: coeWiring.opensRebuttingDefeater,
    feedbackAppliedAsEvidence: coeWiring.evidenceNode !== null,
    feedbackOpenedDefeater: coeWiring.openDefeater !== null,
    coeWiring,
    feedbackBoundAssuranceCase,
    lineageGraph,
    reasonCodes,
    feedbackHooked: true as const,
    lineageHooked: true as const,
    feedbackReadOnly: true as const,
    assuranceCaseInputReadOnly: true as const,
    writesAuditPlane: false as const,
    writesExternalLineageBackend: false as const,
    closesDefeaters: false as const,
    mutatesPolicy: false as const,
    mutatesScore: false as const,
    mutatesCalibration: false as const,
    activatesLearning: false as const,
    activatesTraining: false as const,
    grantsAuthority: false as const,
    canAdmit: false as const,
    activatesEnforcement: false as const,
    autoEnforce: false as const,
    rawFeedbackRead: false as const,
    rawPayloadRead: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  } satisfies Omit<ShadowRuntimeOutcomeFeedbackHookResult, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(
    material as unknown as CanonicalReleaseJsonValue,
  );
  return Object.freeze({
    ...material,
    canonical,
    digest,
  });
}

export function shadowRuntimeOutcomeFeedbackHookDescriptor():
ShadowRuntimeOutcomeFeedbackHookDescriptor {
  return Object.freeze({
    version: SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_VERSION,
    shadowRuntimeObservabilityHooksVersion: SHADOW_RUNTIME_OBSERVABILITY_HOOKS_VERSION,
    outcomeIncidentFeedbackContractVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    outcomeFeedbackCoeWiringVersion: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    sourceAnchors: SHADOW_RUNTIME_OUTCOME_FEEDBACK_HOOK_SOURCE_ANCHORS,
    requiresR06Observability: true,
    requiresPacketDigestBinding: true,
    producesDerivedAssuranceCaseValue: true,
    writesAuditPlane: false,
    writesExternalLineageBackend: false,
    closesDefeaters: false,
    mutatesPolicy: false,
    mutatesScore: false,
    mutatesCalibration: false,
    activatesLearning: false,
    activatesTraining: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawFeedbackRead: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-audit-plane-write',
      'not-external-lineage-export',
      'not-policy-activation',
      'not-score-mutation',
      'not-calibration-mutation',
      'not-learning-activation',
      'not-training-activation',
      'not-live-enforcement',
      'not-production-readiness',
    ]),
  });
}
