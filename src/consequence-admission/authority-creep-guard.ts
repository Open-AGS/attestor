import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
  ASSURANCE_MEASUREMENT_PLANE_VERSION,
  type AssuranceMeasurementMetricUse,
  type AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  DECISION_LINEAGE_GRAPH_VERSION,
  type DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';

export const AUTHORITY_CREEP_GUARD_VERSION =
  'attestor.authority-creep-guard.v1';

export const AUTHORITY_CREEP_SOURCE_ANCHORS = [
  'goodhart-law-measure-target-boundary',
  'nist-ai-rmf-measure-is-risk-input-not-authority',
  'google-sre-error-budget-policy-separation',
  'cisa-ssvc-decision-tree-separates-evidence-from-decision',
  'assurance-2-undercutting-defeater-for-inference-attack',
  'decision-lineage-digest-bound-provenance-not-authority',
] as const;
export type AuthorityCreepSourceAnchor =
  typeof AUTHORITY_CREEP_SOURCE_ANCHORS[number];

export const AUTHORITY_CREEP_FINDINGS = [
  'measurement-artifact-targets-claim',
  'measurement-artifact-targets-strategy',
  'measurement-blocked-metric-use-requested',
  'measurement-policy-relaxation-requested',
  'measurement-score-calibration-requested',
  'measurement-model-training-requested',
  'measurement-enforcement-activation-requested',
  'lineage-policy-activation-requested',
  'lineage-live-enforcement-requested',
  'lineage-authority-action-requested',
  'lineage-audit-write-requested',
  'lineage-rejected-boundary',
  'lineage-signature-coverage-missing',
  'raw-payload-requested',
  'raw-evidence-requested',
  'audit-write-requested',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type AuthorityCreepFinding = typeof AUTHORITY_CREEP_FINDINGS[number];

export const AUTHORITY_CREEP_OUTCOMES = [
  'authority-creep-evidence-ready',
  'authority-creep-open-undercutting-defeater',
  'authority-creep-held-for-lineage-binding',
  'authority-creep-rejected-boundary',
] as const;
export type AuthorityCreepOutcome = typeof AUTHORITY_CREEP_OUTCOMES[number];

export const AUTHORITY_CREEP_BLOCKED_METRIC_USES = [
  'policy-relaxation',
  'score-calibration',
  'model-training',
  'enforcement-activation',
] as const satisfies readonly AssuranceMeasurementMetricUse[];
export type AuthorityCreepBlockedMetricUse =
  typeof AUTHORITY_CREEP_BLOCKED_METRIC_USES[number];

export interface CreateAuthorityCreepGuardInput {
  readonly lineageGraph: DecisionLineageGraphRecord;
  readonly guardId: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly targetClaimNodeId?: string | null;
  readonly measurementPlane?: AssuranceMeasurementPlane | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly rawEvidenceRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface AuthorityCreepArtifactFinding {
  readonly artifactId: string;
  readonly artifactDigest: string;
  readonly targetNodeId: string;
  readonly targetNodeKind: 'claim' | 'strategy';
  readonly finding: 'measurement-artifact-targets-claim' |
    'measurement-artifact-targets-strategy';
}

export interface AuthorityCreepGuardRecord {
  readonly version: typeof AUTHORITY_CREEP_GUARD_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly guardId: string;
  readonly guardRefDigest: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly lineageRefDigest: string;
  readonly lineageDigest: string;
  readonly lineageOutcome: DecisionLineageGraphRecord['outcome'];
  readonly measurementPlaneDigest: string | null;
  readonly measurementStatus: AssuranceMeasurementPlane['status'] | null;
  readonly requestedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly artifactFindings: readonly AuthorityCreepArtifactFinding[];
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly openDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly openDefeaterDigest: string | null;
  readonly outcome: AuthorityCreepOutcome;
  readonly findings: readonly AuthorityCreepFinding[];
  readonly reasonCodes: readonly string[];
  readonly opensUndercuttingDefeater: boolean;
  readonly lineageReadOnly: true;
  readonly measurementReadOnly: true;
  readonly digestOnly: true;
  readonly noRawPayload: true;
  readonly noRawEvidence: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noAuthorityAction: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface AuthorityCreepGuardDescriptor {
  readonly version: typeof AUTHORITY_CREEP_GUARD_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionLineageGraphVersion: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceMeasurementPlaneVersion:
    typeof ASSURANCE_MEASUREMENT_PLANE_VERSION;
  readonly sourceAnchors: readonly AuthorityCreepSourceAnchor[];
  readonly outcomes: readonly AuthorityCreepOutcome[];
  readonly findings: readonly AuthorityCreepFinding[];
  readonly blockedMetricUses: readonly AuthorityCreepBlockedMetricUse[];
  readonly allowedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly detectsMeasurementAsAuthority: true;
  readonly opensUndercuttingDefeater: true;
  readonly doesNotMutateLineageGraph: true;
  readonly doesNotCloseDefeaters: true;
  readonly measurementIsNotAuthority: true;
  readonly readOnly: true;
  readonly digestOnly: true;
  readonly noRawPayload: true;
  readonly noRawEvidence: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noAuthorityAction: true;
  readonly noLearning: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Authority creep guard ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Authority creep guard ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Authority creep guard ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Authority creep guard ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: AUTHORITY_CREEP_GUARD_VERSION,
    value,
  }).digest;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function measurementUseFinding(
  use: AssuranceMeasurementMetricUse,
): AuthorityCreepFinding {
  if (use === 'policy-relaxation') return 'measurement-policy-relaxation-requested';
  if (use === 'score-calibration') return 'measurement-score-calibration-requested';
  if (use === 'model-training') return 'measurement-model-training-requested';
  if (use === 'enforcement-activation') {
    return 'measurement-enforcement-activation-requested';
  }
  return 'measurement-blocked-metric-use-requested';
}

function blockedUsesFor(
  measurementPlane: AssuranceMeasurementPlane | null,
): readonly AssuranceMeasurementMetricUse[] {
  if (!measurementPlane) return Object.freeze([]);
  const blocked = measurementPlane.blockedMetricUses.length > 0
    ? measurementPlane.blockedMetricUses
    : measurementPlane.requestedMetricUses.filter((use) =>
        !(ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES as readonly string[]).includes(use));
  return uniqueSorted(blocked);
}

function findMeasurementArtifactSupport(
  lineageGraph: DecisionLineageGraphRecord,
): readonly AuthorityCreepArtifactFinding[] {
  const sourceNodeKindById = new Map(
    lineageGraph.graphNodes.map((node) => [node.sourceId, node.kind] as const),
  );
  const findings: AuthorityCreepArtifactFinding[] = [];
  for (const artifact of lineageGraph.artifactRefs) {
    if (artifact.artifactKind !== 'measurement-plane-record') continue;
    const targetNodeId = artifact.targetNodeId;
    if (!targetNodeId) continue;
    const targetNodeKind = sourceNodeKindById.get(targetNodeId);
    if (targetNodeKind !== 'claim' && targetNodeKind !== 'strategy') continue;
    findings.push({
      artifactId: artifact.artifactId,
      artifactDigest: artifact.artifactDigest,
      targetNodeId,
      targetNodeKind,
      finding: targetNodeKind === 'claim'
        ? 'measurement-artifact-targets-claim'
        : 'measurement-artifact-targets-strategy',
    });
  }
  return Object.freeze(findings.sort((a, b) =>
    `${a.targetNodeId}:${a.artifactId}`.localeCompare(`${b.targetNodeId}:${b.artifactId}`)));
}

function findingsFor(input: {
  readonly lineageGraph: DecisionLineageGraphRecord;
  readonly measurementPlane: AssuranceMeasurementPlane | null;
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly artifactFindings: readonly AuthorityCreepArtifactFinding[];
  readonly rawPayloadRequested: boolean;
  readonly rawEvidenceRequested: boolean;
  readonly auditWriteRequested: boolean;
  readonly policyActivationRequested: boolean;
  readonly liveEnforcementRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly AuthorityCreepFinding[] {
  const findings = new Set<AuthorityCreepFinding>();
  for (const artifactFinding of input.artifactFindings) {
    findings.add(artifactFinding.finding);
  }
  for (const use of input.blockedMetricUses) {
    findings.add(measurementUseFinding(use));
    findings.add('measurement-blocked-metric-use-requested');
  }
  if (input.lineageGraph.outcome === 'decision-lineage-rejected-boundary') {
    findings.add('lineage-rejected-boundary');
  }
  if (input.lineageGraph.findings.includes('policy-activation-requested')) {
    findings.add('lineage-policy-activation-requested');
  }
  if (input.lineageGraph.findings.includes('live-enforcement-requested')) {
    findings.add('lineage-live-enforcement-requested');
  }
  if (input.lineageGraph.findings.includes('authority-action-requested')) {
    findings.add('lineage-authority-action-requested');
  }
  if (input.lineageGraph.findings.includes('audit-write-requested')) {
    findings.add('lineage-audit-write-requested');
  }
  if (
    input.lineageGraph.outcome === 'decision-lineage-held-for-signature-coverage' ||
    input.lineageGraph.findings.includes('signature-coverage-missing')
  ) {
    findings.add('lineage-signature-coverage-missing');
  }
  if (input.measurementPlane?.noGoReasons.includes('blocked-metric-use-requested')) {
    findings.add('measurement-blocked-metric-use-requested');
  }
  if (input.rawPayloadRequested) findings.add('raw-payload-requested');
  if (input.rawEvidenceRequested) findings.add('raw-evidence-requested');
  if (input.auditWriteRequested) findings.add('audit-write-requested');
  if (input.policyActivationRequested) findings.add('policy-activation-requested');
  if (input.liveEnforcementRequested) findings.add('live-enforcement-requested');
  if (input.authorityActionRequested) findings.add('authority-action-requested');
  return uniqueSorted([...findings]);
}

function isBoundaryFinding(finding: AuthorityCreepFinding): boolean {
  return finding === 'raw-payload-requested' ||
    finding === 'raw-evidence-requested' ||
    finding === 'audit-write-requested' ||
    finding === 'policy-activation-requested' ||
    finding === 'live-enforcement-requested' ||
    finding === 'authority-action-requested';
}

function outcomeFor(findings: readonly AuthorityCreepFinding[]):
AuthorityCreepOutcome {
  if (findings.some(isBoundaryFinding)) return 'authority-creep-rejected-boundary';
  if (findings.includes('lineage-signature-coverage-missing')) {
    return 'authority-creep-held-for-lineage-binding';
  }
  if (findings.length > 0) return 'authority-creep-open-undercutting-defeater';
  return 'authority-creep-evidence-ready';
}

function reasonCodesFor(input: {
  readonly outcome: AuthorityCreepOutcome;
  readonly findings: readonly AuthorityCreepFinding[];
  readonly blockedMetricUses: readonly AssuranceMeasurementMetricUse[];
  readonly artifactFindings: readonly AuthorityCreepArtifactFinding[];
}): readonly string[] {
  const reasons = new Set<string>([
    `authority-creep-outcome:${input.outcome}`,
    `authority-creep-blocked-metric-uses:${input.blockedMetricUses.length}`,
    `authority-creep-artifact-findings:${input.artifactFindings.length}`,
    ...input.findings.map((finding) => `authority-creep-finding:${finding}`),
    ...input.blockedMetricUses.map((use) => `authority-creep-blocked-metric-use:${use}`),
  ]);
  if (input.findings.length === 0) reasons.add('authority-creep-no-finding');
  return uniqueSorted([...reasons]);
}

function assertLineageGraph(input: DecisionLineageGraphRecord): void {
  if (input.version !== DECISION_LINEAGE_GRAPH_VERSION) {
    throw new Error('Authority creep guard lineage graph version mismatch.');
  }
  if (
    input.noRawPayload !== true ||
    input.noRawEvidence !== true ||
    input.noAuditWrite !== true ||
    input.noPolicyActivation !== true ||
    input.noLiveEnforcement !== true ||
    input.noAuthorityAction !== true ||
    input.grantsAuthority ||
    input.canAdmit ||
    input.activatesEnforcement
  ) {
    throw new Error('Authority creep guard requires a no-authority lineage graph.');
  }
}

function assertMeasurementPlane(input: AssuranceMeasurementPlane | null): void {
  if (!input) return;
  if (input.version !== ASSURANCE_MEASUREMENT_PLANE_VERSION) {
    throw new Error('Authority creep guard measurement plane version mismatch.');
  }
  if (
    input.writesAuditPlane ||
    input.directGradientSourceAllowed ||
    input.policyRelaxationAllowed ||
    input.automaticPolicyMutationAllowed ||
    input.automaticScoreMutationAllowed ||
    input.automaticCalibrationMutationAllowed ||
    input.llmTrainingAllowed ||
    input.grantsAuthority ||
    input.canAdmit ||
    input.activatesEnforcement ||
    input.autoEnforce
  ) {
    throw new Error('Authority creep guard requires a no-authority measurement plane.');
  }
}

export function createAuthorityCreepGuard(
  input: CreateAuthorityCreepGuardInput,
): AuthorityCreepGuardRecord {
  assertLineageGraph(input.lineageGraph);
  assertMeasurementPlane(input.measurementPlane ?? null);

  const lineageGraph = input.lineageGraph;
  const measurementPlane = input.measurementPlane ?? null;
  const guardId = normalizeIdentifier(input.guardId, 'guardId');
  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const targetClaimNodeId = normalizeIdentifier(
    input.targetClaimNodeId ?? lineageGraph.rootClaimId,
    'targetClaimNodeId',
  );
  const targetClaimNode = lineageGraph.graphNodes.find((node) =>
    node.sourceId === targetClaimNodeId && node.kind === 'claim');
  if (!targetClaimNode) {
    throw new Error('Authority creep guard target claim node must exist in the lineage graph.');
  }

  const blockedMetricUses = blockedUsesFor(measurementPlane);
  const artifactFindings = findMeasurementArtifactSupport(lineageGraph);
  const findings = findingsFor({
    lineageGraph,
    measurementPlane,
    blockedMetricUses,
    artifactFindings,
    rawPayloadRequested: input.rawPayloadRequested === true,
    rawEvidenceRequested: input.rawEvidenceRequested === true,
    auditWriteRequested: input.auditWriteRequested === true,
    policyActivationRequested: input.policyActivationRequested === true,
    liveEnforcementRequested: input.liveEnforcementRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const outcome = outcomeFor(findings);
  const reasonCodes = reasonCodesFor({
    outcome,
    findings,
    blockedMetricUses,
    artifactFindings,
  });
  const evidenceBodyDigest = bodyDigest('authority-creep-guard:evidence', {
    guardId,
    lineageRefDigest: lineageGraph.lineageRefDigest,
    lineageDigest: lineageGraph.digest,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    blockedMetricUses,
    artifactFindings: artifactFindings as unknown as CanonicalReleaseJsonValue,
    findings,
    outcome,
  });
  const transitionReasonDigest = bodyDigest('authority-creep-guard:transition', {
    guardId,
    reasonCodes,
  });
  const rejected = outcome === 'authority-creep-rejected-boundary';
  const opensUndercuttingDefeater =
    outcome === 'authority-creep-open-undercutting-defeater' ||
    outcome === 'authority-creep-held-for-lineage-binding';

  const evidenceNode = rejected || opensUndercuttingDefeater
    ? null
    : createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ?? `evidence:${guardId}:authority-creep`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'Authority creep guard found no measurement authority path',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest: lineageGraph.tenantRefDigest,
        scopeDigest: lineageGraph.rootScopeDigest,
        createdByRefDigest: evaluatorRefDigest,
        createdAt: evaluatedAt,
      });
  const openDefeater = rejected || !opensUndercuttingDefeater
    ? null
    : createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ?? `defeater:${guardId}:authority-creep`,
          'defeaterId',
        ),
        kind: 'undercutting',
        state: 'open',
        attacksNodeId: targetClaimNodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest: lineageGraph.tenantRefDigest,
        openedByRefDigest: evaluatorRefDigest,
        openedAt: evaluatedAt,
      });
  const evidenceTransition = evidenceNode
    ? createAssuranceCaseTransition({
        transitionId: `transition:${guardId}:authority-creep-evidence`,
        transitionKind: 'create-node',
        actorRefDigest: evaluatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: evidenceNode.digest,
      })
    : null;
  const defeaterTransition = openDefeater
    ? createAssuranceCaseTransition({
        transitionId: `transition:${guardId}:authority-creep-defeater`,
        transitionKind: 'open-defeater',
        actorRefDigest: evaluatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: openDefeater.defeaterId,
        toState: 'open',
        evidenceRefDigest: evidenceBodyDigest,
      })
    : null;

  const guardRefDigest = bodyDigest('authority-creep-guard:ref', {
    guardId,
    lineageRefDigest: lineageGraph.lineageRefDigest,
    evaluatedAt,
  });
  const core: Omit<AuthorityCreepGuardRecord, 'canonical' | 'digest'> = {
    version: AUTHORITY_CREEP_GUARD_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    guardId,
    guardRefDigest,
    evaluatedAt,
    evaluatorRefDigest,
    tenantRefDigest: lineageGraph.tenantRefDigest,
    scopeDigest: lineageGraph.rootScopeDigest,
    targetClaimNodeId,
    lineageRefDigest: lineageGraph.lineageRefDigest,
    lineageDigest: lineageGraph.digest,
    lineageOutcome: lineageGraph.outcome,
    measurementPlaneDigest: measurementPlane?.digest ?? null,
    measurementStatus: measurementPlane?.status ?? null,
    requestedMetricUses: Object.freeze([...(measurementPlane?.requestedMetricUses ?? [])]),
    blockedMetricUses,
    artifactFindings,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    openDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    openDefeaterDigest: openDefeater?.digest ?? null,
    outcome,
    findings,
    reasonCodes,
    opensUndercuttingDefeater,
    lineageReadOnly: true,
    measurementReadOnly: true,
    digestOnly: true,
    noRawPayload: true,
    noRawEvidence: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noAuthorityAction: true,
    noLearning: true,
    noTraining: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function authorityCreepGuardDescriptor(): AuthorityCreepGuardDescriptor {
  return Object.freeze({
    version: AUTHORITY_CREEP_GUARD_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionLineageGraphVersion: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceMeasurementPlaneVersion: ASSURANCE_MEASUREMENT_PLANE_VERSION,
    sourceAnchors: AUTHORITY_CREEP_SOURCE_ANCHORS,
    outcomes: AUTHORITY_CREEP_OUTCOMES,
    findings: AUTHORITY_CREEP_FINDINGS,
    blockedMetricUses: AUTHORITY_CREEP_BLOCKED_METRIC_USES,
    allowedMetricUses: ASSURANCE_MEASUREMENT_ALLOWED_METRIC_USES,
    detectsMeasurementAsAuthority: true,
    opensUndercuttingDefeater: true,
    doesNotMutateLineageGraph: true,
    doesNotCloseDefeaters: true,
    measurementIsNotAuthority: true,
    readOnly: true,
    digestOnly: true,
    noRawPayload: true,
    noRawEvidence: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noAuthorityAction: true,
    noLearning: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-policy-activation',
      'not-live-enforcement',
      'not-measurement-authority',
      'not-lineage-mutation',
      'not-defeater-closure',
      'not-review-decision',
      'not-learning',
      'not-training',
      'not-production-readiness',
    ]),
  });
}
