import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  type AssuranceCaseContract,
} from './assurance-case-contract.js';

export const DECISION_LINEAGE_GRAPH_VERSION =
  'attestor.decision-lineage-graph.v1';

export const DECISION_LINEAGE_SOURCE_ANCHORS = [
  'w3c-prov-entity-activity-agent',
  'openlineage-run-job-dataset-facets',
  'in-toto-statement-subject-predicate',
  'dsse-envelope-payloadtype-signatures',
  'w3c-trace-context-correlation-not-sensitive-data',
  'omg-sacm-assurance-case-package-and-artifacts',
] as const;
export type DecisionLineageSourceAnchor =
  typeof DECISION_LINEAGE_SOURCE_ANCHORS[number];

export const DECISION_LINEAGE_NODE_KINDS = [
  'case',
  'claim',
  'strategy',
  'evidence',
  'context',
  'assumption',
  'justification',
  'module',
  'away-claim',
  'defeater',
  'transition',
  'artifact',
  'signature',
] as const;
export type DecisionLineageNodeKind =
  typeof DECISION_LINEAGE_NODE_KINDS[number];

export const DECISION_LINEAGE_EDGE_KINDS = [
  'contains',
  'attacks',
  'created-by-transition',
  'opened-by-transition',
  'closed-by-transition',
  'residual-accepted-by-transition',
  'reopened-by-transition',
  'supports',
  'derived-from',
  'signature-covers',
] as const;
export type DecisionLineageEdgeKind =
  typeof DECISION_LINEAGE_EDGE_KINDS[number];

export const DECISION_LINEAGE_ARTIFACT_KINDS = [
  'assurance-case',
  'shadow-quality-record',
  'baseline-cohort-record',
  'candidate-claim-record',
  'counterexample-record',
  'calibration-record',
  'reviewer-view-record',
  'promotion-gate-record',
  'tla-trace-validator-record',
  'runtime-monitor-record',
  'measurement-plane-record',
  'outcome-feedback-record',
] as const;
export type DecisionLineageArtifactKind =
  typeof DECISION_LINEAGE_ARTIFACT_KINDS[number];

export const DECISION_LINEAGE_SIGNATURE_ENVELOPE_KINDS = [
  'dsse',
  'in-toto-statement',
  'jws',
  'internal-digest-ref',
] as const;
export type DecisionLineageSignatureEnvelopeKind =
  typeof DECISION_LINEAGE_SIGNATURE_ENVELOPE_KINDS[number];

export const DECISION_LINEAGE_OUTCOMES = [
  'decision-lineage-graph-ready',
  'decision-lineage-held-for-case-binding',
  'decision-lineage-held-for-signature-coverage',
  'decision-lineage-rejected-boundary',
] as const;
export type DecisionLineageOutcome =
  typeof DECISION_LINEAGE_OUTCOMES[number];

export const DECISION_LINEAGE_FINDINGS = [
  'root-claim-missing',
  'transition-target-missing',
  'artifact-target-missing',
  'signature-subject-unmatched',
  'signature-coverage-missing',
  'raw-payload-requested',
  'raw-evidence-requested',
  'external-lineage-export-requested',
  'signature-creation-requested',
  'audit-write-requested',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type DecisionLineageFinding =
  typeof DECISION_LINEAGE_FINDINGS[number];

export interface DecisionLineageArtifactRefInput {
  readonly artifactId: string;
  readonly artifactKind: DecisionLineageArtifactKind;
  readonly artifactDigest: string;
  readonly sourceVersion: string;
  readonly producedAt: string;
  readonly producerRefDigest: string;
  readonly targetNodeId?: string | null;
  readonly targetTransitionId?: string | null;
}

export interface DecisionLineageArtifactRef {
  readonly artifactId: string;
  readonly artifactKind: DecisionLineageArtifactKind;
  readonly artifactDigest: string;
  readonly sourceVersion: string;
  readonly producedAt: string;
  readonly producerRefDigest: string;
  readonly targetNodeId: string | null;
  readonly targetTransitionId: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface DecisionLineageSignatureRefInput {
  readonly signatureId: string;
  readonly envelopeKind: DecisionLineageSignatureEnvelopeKind;
  readonly signatureRefDigest: string;
  readonly signerRefDigest: string;
  readonly signedSubjectDigest: string;
  readonly signedAt: string;
}

export interface DecisionLineageSignatureRef {
  readonly signatureId: string;
  readonly envelopeKind: DecisionLineageSignatureEnvelopeKind;
  readonly signatureRefDigest: string;
  readonly signerRefDigest: string;
  readonly signedSubjectDigest: string;
  readonly signedAt: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateDecisionLineageGraphInput {
  readonly assuranceCase: AssuranceCaseContract;
  readonly lineageId: string;
  readonly generatedAt: string;
  readonly builderRefDigest: string;
  readonly artifactRefs?: readonly DecisionLineageArtifactRefInput[] | null;
  readonly signatureRefs?: readonly DecisionLineageSignatureRefInput[] | null;
  readonly requireSignatureCoverage?: boolean | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly rawEvidenceRequested?: boolean | null;
  readonly externalLineageExportRequested?: boolean | null;
  readonly signatureCreationRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface DecisionLineageGraphNode {
  readonly version: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly nodeId: string;
  readonly kind: DecisionLineageNodeKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly sourceVersion: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly signedSubject: boolean;
  readonly canonical: string;
  readonly digest: string;
}

export interface DecisionLineageGraphEdge {
  readonly version: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly edgeId: string;
  readonly kind: DecisionLineageEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly evidenceRefDigest: string | null;
  readonly reasonCodes: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface DecisionLineageGraphRecord {
  readonly version: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly lineageId: string;
  readonly lineageRefDigest: string;
  readonly generatedAt: string;
  readonly builderRefDigest: string;
  readonly tenantRefDigest: string;
  readonly rootClaimId: string;
  readonly rootClaimDigest: string | null;
  readonly rootScopeDigest: string;
  readonly caseId: string;
  readonly caseRefDigest: string;
  readonly caseDigest: string;
  readonly artifactRefs: readonly DecisionLineageArtifactRef[];
  readonly signatureRefs: readonly DecisionLineageSignatureRef[];
  readonly graphNodes: readonly DecisionLineageGraphNode[];
  readonly graphEdges: readonly DecisionLineageGraphEdge[];
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly artifactCount: number;
  readonly signatureCount: number;
  readonly openDefeaterCount: number;
  readonly signedSubjectDigests: readonly string[];
  readonly requiredSubjectDigests: readonly string[];
  readonly missingSignatureCoverageDigests: readonly string[];
  readonly requireSignatureCoverage: boolean;
  readonly outcome: DecisionLineageOutcome;
  readonly findings: readonly DecisionLineageFinding[];
  readonly reasonCodes: readonly string[];
  readonly digestOnly: true;
  readonly readOnly: true;
  readonly noRawPayload: true;
  readonly noRawEvidence: true;
  readonly noExternalLineageExport: true;
  readonly noSignatureCreation: true;
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

export interface DecisionLineageGraphDescriptor {
  readonly version: typeof DECISION_LINEAGE_GRAPH_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly sourceAnchors: readonly DecisionLineageSourceAnchor[];
  readonly nodeKinds: readonly DecisionLineageNodeKind[];
  readonly edgeKinds: readonly DecisionLineageEdgeKind[];
  readonly artifactKinds: readonly DecisionLineageArtifactKind[];
  readonly signatureEnvelopeKinds: readonly DecisionLineageSignatureEnvelopeKind[];
  readonly outcomes: readonly DecisionLineageOutcome[];
  readonly findings: readonly DecisionLineageFinding[];
  readonly buildsDigestBoundDag: true;
  readonly tracksSignedSubjectsOnly: true;
  readonly doesNotCreateSignatures: true;
  readonly noExternalLineageExport: true;
  readonly digestOnly: true;
  readonly readOnly: true;
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
