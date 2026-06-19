import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  type AssuranceCaseContract,
  type AssuranceCaseNodeKind,
} from './assurance-case-contract.js';
import {
  DECISION_LINEAGE_ARTIFACT_KINDS,
  DECISION_LINEAGE_EDGE_KINDS,
  DECISION_LINEAGE_FINDINGS,
  DECISION_LINEAGE_GRAPH_VERSION,
  DECISION_LINEAGE_NODE_KINDS,
  DECISION_LINEAGE_OUTCOMES,
  DECISION_LINEAGE_SIGNATURE_ENVELOPE_KINDS,
  DECISION_LINEAGE_SOURCE_ANCHORS,
  type CreateDecisionLineageGraphInput,
  type DecisionLineageArtifactRef,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageEdgeKind,
  type DecisionLineageFinding,
  type DecisionLineageGraphDescriptor,
  type DecisionLineageGraphEdge,
  type DecisionLineageGraphNode,
  type DecisionLineageGraphRecord,
  type DecisionLineageNodeKind,
  type DecisionLineageOutcome,
  type DecisionLineageSignatureRef,
  type DecisionLineageSignatureRefInput,
} from './decision-lineage-graph-types.js';

export * from './decision-lineage-graph-types.js';

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ASSURANCE_NODE_KIND_SET = new Set<AssuranceCaseNodeKind>([
  'claim',
  'strategy',
  'evidence',
  'context',
  'assumption',
  'justification',
  'module',
  'away-claim',
]);

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
    throw new Error(`Decision lineage graph ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Decision lineage graph ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Decision lineage graph ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Decision lineage graph ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnum<T extends string>(
  value: T | string | null | undefined,
  allowed: readonly T[],
  fieldName: string,
): T {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowed.includes(normalized as T)) {
    throw new Error(`Decision lineage graph ${fieldName} is not supported.`);
  }
  return normalized as T;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: DECISION_LINEAGE_GRAPH_VERSION,
    value,
  }).digest;
}

function normalizeArtifactRef(
  input: DecisionLineageArtifactRefInput,
  index: number,
): DecisionLineageArtifactRef {
  const artifact: Omit<DecisionLineageArtifactRef, 'canonical' | 'digest'> = {
    artifactId: normalizeIdentifier(input.artifactId, `artifactRefs[${index}].artifactId`),
    artifactKind: normalizeEnum(
      input.artifactKind,
      DECISION_LINEAGE_ARTIFACT_KINDS,
      `artifactRefs[${index}].artifactKind`,
    ),
    artifactDigest: normalizeDigest(
      input.artifactDigest,
      `artifactRefs[${index}].artifactDigest`,
    ),
    sourceVersion: normalizeIdentifier(
      input.sourceVersion,
      `artifactRefs[${index}].sourceVersion`,
    ),
    producedAt: normalizeIsoTimestamp(input.producedAt, `artifactRefs[${index}].producedAt`),
    producerRefDigest: normalizeDigest(
      input.producerRefDigest,
      `artifactRefs[${index}].producerRefDigest`,
    ),
    targetNodeId: normalizeOptionalIdentifier(
      input.targetNodeId,
      `artifactRefs[${index}].targetNodeId`,
    ),
    targetTransitionId: normalizeOptionalIdentifier(
      input.targetTransitionId,
      `artifactRefs[${index}].targetTransitionId`,
    ),
  };
  const canonical = canonicalObject(artifact as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...artifact, ...canonical });
}

function normalizeSignatureRef(
  input: DecisionLineageSignatureRefInput,
  index: number,
): DecisionLineageSignatureRef {
  const signature: Omit<DecisionLineageSignatureRef, 'canonical' | 'digest'> = {
    signatureId: normalizeIdentifier(input.signatureId, `signatureRefs[${index}].signatureId`),
    envelopeKind: normalizeEnum(
      input.envelopeKind,
      DECISION_LINEAGE_SIGNATURE_ENVELOPE_KINDS,
      `signatureRefs[${index}].envelopeKind`,
    ),
    signatureRefDigest: normalizeDigest(
      input.signatureRefDigest,
      `signatureRefs[${index}].signatureRefDigest`,
    ),
    signerRefDigest: normalizeDigest(
      input.signerRefDigest,
      `signatureRefs[${index}].signerRefDigest`,
    ),
    signedSubjectDigest: normalizeDigest(
      input.signedSubjectDigest,
      `signatureRefs[${index}].signedSubjectDigest`,
    ),
    signedAt: normalizeIsoTimestamp(input.signedAt, `signatureRefs[${index}].signedAt`),
  };
  const canonical = canonicalObject(signature as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...signature, ...canonical });
}

function graphNode(input: {
  readonly nodeId: string;
  readonly kind: DecisionLineageNodeKind;
  readonly sourceId: string;
  readonly sourceDigest: string;
  readonly sourceVersion: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly signedSubject: boolean;
}): DecisionLineageGraphNode {
  const core: Omit<DecisionLineageGraphNode, 'canonical' | 'digest'> = {
    version: DECISION_LINEAGE_GRAPH_VERSION,
    nodeId: normalizeIdentifier(input.nodeId, 'graph nodeId'),
    kind: normalizeEnum(input.kind, DECISION_LINEAGE_NODE_KINDS, 'graph node kind'),
    sourceId: normalizeIdentifier(input.sourceId, 'graph node sourceId'),
    sourceDigest: normalizeDigest(input.sourceDigest, 'graph node sourceDigest'),
    sourceVersion: normalizeIdentifier(input.sourceVersion, 'graph node sourceVersion'),
    tenantRefDigest: normalizeDigest(input.tenantRefDigest, 'graph node tenantRefDigest'),
    scopeDigest: normalizeDigest(input.scopeDigest, 'graph node scopeDigest'),
    signedSubject: input.signedSubject === true,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

function graphEdge(input: {
  readonly edgeId: string;
  readonly kind: DecisionLineageEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly evidenceRefDigest?: string | null;
  readonly reasonCodes?: readonly string[] | null;
}): DecisionLineageGraphEdge {
  const core: Omit<DecisionLineageGraphEdge, 'canonical' | 'digest'> = {
    version: DECISION_LINEAGE_GRAPH_VERSION,
    edgeId: normalizeIdentifier(input.edgeId, 'graph edgeId'),
    kind: normalizeEnum(input.kind, DECISION_LINEAGE_EDGE_KINDS, 'graph edge kind'),
    fromNodeId: normalizeIdentifier(input.fromNodeId, 'graph edge fromNodeId'),
    toNodeId: normalizeIdentifier(input.toNodeId, 'graph edge toNodeId'),
    evidenceRefDigest: input.evidenceRefDigest === null ||
      input.evidenceRefDigest === undefined
      ? null
      : normalizeDigest(input.evidenceRefDigest, 'graph edge evidenceRefDigest'),
    reasonCodes: Object.freeze(
      (input.reasonCodes ?? []).map((reason, index) =>
        normalizeIdentifier(reason, `graph edge reasonCodes[${index}]`)),
    ),
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

function edgeKindForTransition(
  transitionKind: AssuranceCaseContract['transitions'][number]['transitionKind'],
): DecisionLineageEdgeKind {
  if (transitionKind === 'create-node') return 'created-by-transition';
  if (transitionKind === 'open-defeater') return 'opened-by-transition';
  if (transitionKind === 'accept-residual-defeater') {
    return 'residual-accepted-by-transition';
  }
  if (transitionKind === 'reopen-defeater-by-new-evidence') {
    return 'reopened-by-transition';
  }
  return 'closed-by-transition';
}

function outcomeFor(findings: readonly DecisionLineageFinding[]): DecisionLineageOutcome {
  if (findings.some((finding) =>
    finding === 'raw-payload-requested' ||
    finding === 'raw-evidence-requested' ||
    finding === 'external-lineage-export-requested' ||
    finding === 'signature-creation-requested' ||
    finding === 'audit-write-requested' ||
    finding === 'policy-activation-requested' ||
    finding === 'live-enforcement-requested' ||
    finding === 'authority-action-requested'
  )) {
    return 'decision-lineage-rejected-boundary';
  }
  if (findings.some((finding) =>
    finding === 'root-claim-missing' ||
    finding === 'transition-target-missing' ||
    finding === 'artifact-target-missing' ||
    finding === 'signature-subject-unmatched'
  )) {
    return 'decision-lineage-held-for-case-binding';
  }
  if (findings.includes('signature-coverage-missing')) {
    return 'decision-lineage-held-for-signature-coverage';
  }
  return 'decision-lineage-graph-ready';
}

function reasonCodesFor(input: {
  readonly outcome: DecisionLineageOutcome;
  readonly findings: readonly DecisionLineageFinding[];
  readonly openDefeaterCount: number;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly requireSignatureCoverage: boolean;
}): readonly string[] {
  const reasons = new Set<string>([
    `decision-lineage-outcome:${input.outcome}`,
    `decision-lineage-open-defeaters:${input.openDefeaterCount}`,
    `decision-lineage-graph-nodes:${input.graphNodeCount}`,
    `decision-lineage-graph-edges:${input.graphEdgeCount}`,
    `decision-lineage-requires-signature-coverage:${input.requireSignatureCoverage}`,
    ...input.findings.map((finding) => `decision-lineage-finding:${finding}`),
  ]);
  if (input.findings.length === 0) {
    reasons.add('decision-lineage-graph-ready');
  }
  return uniqueSorted([...reasons]);
}

export function createDecisionLineageGraph(
  input: CreateDecisionLineageGraphInput,
): DecisionLineageGraphRecord {
  if (input.assuranceCase.version !== ASSURANCE_CASE_CONTRACT_VERSION) {
    throw new Error('Decision lineage graph assurance case version mismatch.');
  }
  if (
    input.assuranceCase.noRawPayloadStorage !== true ||
    input.assuranceCase.grantsAuthority ||
    input.assuranceCase.canAdmit ||
    input.assuranceCase.activatesEnforcement ||
    input.assuranceCase.autoEnforce
  ) {
    throw new Error('Decision lineage graph requires a no-authority assurance case.');
  }

  const lineageId = normalizeIdentifier(input.lineageId, 'lineageId');
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const builderRefDigest = normalizeDigest(input.builderRefDigest, 'builderRefDigest');
  const artifactRefs = Object.freeze(
    (input.artifactRefs ?? []).map((artifact, index) =>
      normalizeArtifactRef(artifact, index)),
  );
  const signatureRefs = Object.freeze(
    (input.signatureRefs ?? []).map((signature, index) =>
      normalizeSignatureRef(signature, index)),
  );
  const requireSignatureCoverage = input.requireSignatureCoverage === true;
  const signedSubjectDigests = uniqueSorted(
    signatureRefs.map((signature) => signature.signedSubjectDigest),
  );
  const signedSubjectSet = new Set<string>(signedSubjectDigests);
  const rootClaim = input.assuranceCase.nodes.find(
    (node) => node.nodeId === input.assuranceCase.rootClaimId && node.kind === 'claim',
  );
  const rootScopeDigest = rootClaim?.scopeDigest ?? input.assuranceCase.tenantRefDigest;

  const findings = new Set<DecisionLineageFinding>();
  if (rootClaim === undefined) findings.add('root-claim-missing');
  if (input.rawPayloadRequested === true) findings.add('raw-payload-requested');
  if (input.rawEvidenceRequested === true) findings.add('raw-evidence-requested');
  if (input.externalLineageExportRequested === true) {
    findings.add('external-lineage-export-requested');
  }
  if (input.signatureCreationRequested === true) {
    findings.add('signature-creation-requested');
  }
  if (input.auditWriteRequested === true) findings.add('audit-write-requested');
  if (input.policyActivationRequested === true) {
    findings.add('policy-activation-requested');
  }
  if (input.liveEnforcementRequested === true) {
    findings.add('live-enforcement-requested');
  }
  if (input.authorityActionRequested === true) {
    findings.add('authority-action-requested');
  }

  const graphNodes: DecisionLineageGraphNode[] = [];
  const graphEdges: DecisionLineageGraphEdge[] = [];
  const sourceDigestToGraphNodeId = new Map<string, string>();
  const assuranceNodeIds = new Set(input.assuranceCase.nodes.map((node) => node.nodeId));
  const transitionIds = new Set(
    input.assuranceCase.transitions.map((transition) => transition.transitionId),
  );
  const defeaterIds = new Set(
    input.assuranceCase.defeaters.map((defeater) => defeater.defeaterId),
  );
  const nodeScopeById = new Map(
    input.assuranceCase.nodes.map((node) => [node.nodeId, node.scopeDigest] as const),
  );
  const caseGraphNode = graphNode({
    nodeId: `lineage:case:${lineageId}`,
    kind: 'case',
    sourceId: input.assuranceCase.caseId,
    sourceDigest: input.assuranceCase.digest,
    sourceVersion: input.assuranceCase.version,
    tenantRefDigest: input.assuranceCase.tenantRefDigest,
    scopeDigest: rootScopeDigest,
    signedSubject: signedSubjectSet.has(input.assuranceCase.digest),
  });
  graphNodes.push(caseGraphNode);
  sourceDigestToGraphNodeId.set(input.assuranceCase.digest, caseGraphNode.nodeId);

  for (const node of input.assuranceCase.nodes) {
    if (!ASSURANCE_NODE_KIND_SET.has(node.kind)) {
      throw new Error('Decision lineage graph encountered unsupported assurance node kind.');
    }
    const nodeGraph = graphNode({
      nodeId: `lineage:node:${node.nodeId}`,
      kind: node.kind,
      sourceId: node.nodeId,
      sourceDigest: node.digest,
      sourceVersion: node.version,
      tenantRefDigest: node.tenantRefDigest,
      scopeDigest: node.scopeDigest,
      signedSubject: signedSubjectSet.has(node.digest),
    });
    graphNodes.push(nodeGraph);
    sourceDigestToGraphNodeId.set(node.digest, nodeGraph.nodeId);
    graphEdges.push(graphEdge({
      edgeId: `edge:case-contains-node:${node.nodeId}`,
      kind: 'contains',
      fromNodeId: caseGraphNode.nodeId,
      toNodeId: nodeGraph.nodeId,
      reasonCodes: ['assurance-case-node-contained'],
    }));
  }

  for (const defeater of input.assuranceCase.defeaters) {
    const scopeDigest = nodeScopeById.get(defeater.attacksNodeId) ?? rootScopeDigest;
    const defeaterGraph = graphNode({
      nodeId: `lineage:defeater:${defeater.defeaterId}`,
      kind: 'defeater',
      sourceId: defeater.defeaterId,
      sourceDigest: defeater.digest,
      sourceVersion: defeater.version,
      tenantRefDigest: defeater.tenantRefDigest,
      scopeDigest,
      signedSubject: signedSubjectSet.has(defeater.digest),
    });
    graphNodes.push(defeaterGraph);
    sourceDigestToGraphNodeId.set(defeater.digest, defeaterGraph.nodeId);
    graphEdges.push(graphEdge({
      edgeId: `edge:case-contains-defeater:${defeater.defeaterId}`,
      kind: 'contains',
      fromNodeId: caseGraphNode.nodeId,
      toNodeId: defeaterGraph.nodeId,
      reasonCodes: ['assurance-case-defeater-contained'],
    }));
    graphEdges.push(graphEdge({
      edgeId: `edge:defeater-attacks:${defeater.defeaterId}`,
      kind: 'attacks',
      fromNodeId: defeaterGraph.nodeId,
      toNodeId: `lineage:node:${defeater.attacksNodeId}`,
      evidenceRefDigest: defeater.reasonDigest,
      reasonCodes: [`defeater-kind:${defeater.kind}`, `defeater-state:${defeater.state}`],
    }));
  }

  for (const transition of input.assuranceCase.transitions) {
    const targetNodeId = transition.nodeId ?? null;
    const targetDefeaterId = transition.defeaterId ?? null;
    const targetScopeDigest = targetNodeId === null
      ? rootScopeDigest
      : nodeScopeById.get(targetNodeId) ?? rootScopeDigest;
    const transitionGraph = graphNode({
      nodeId: `lineage:transition:${transition.transitionId}`,
      kind: 'transition',
      sourceId: transition.transitionId,
      sourceDigest: transition.digest,
      sourceVersion: transition.version,
      tenantRefDigest: input.assuranceCase.tenantRefDigest,
      scopeDigest: targetScopeDigest,
      signedSubject: signedSubjectSet.has(transition.digest),
    });
    graphNodes.push(transitionGraph);
    sourceDigestToGraphNodeId.set(transition.digest, transitionGraph.nodeId);
    graphEdges.push(graphEdge({
      edgeId: `edge:case-contains-transition:${transition.transitionId}`,
      kind: 'contains',
      fromNodeId: caseGraphNode.nodeId,
      toNodeId: transitionGraph.nodeId,
      reasonCodes: [`transition-kind:${transition.transitionKind}`],
    }));
    const targetGraphNodeId = targetNodeId === null
      ? targetDefeaterId === null
        ? null
        : `lineage:defeater:${targetDefeaterId}`
      : `lineage:node:${targetNodeId}`;
    const targetKnown = targetNodeId === null
      ? targetDefeaterId !== null && defeaterIds.has(targetDefeaterId)
      : assuranceNodeIds.has(targetNodeId);
    if (targetGraphNodeId === null || !targetKnown) {
      findings.add('transition-target-missing');
    } else {
      graphEdges.push(graphEdge({
        edgeId: `edge:transition-target:${transition.transitionId}`,
        kind: edgeKindForTransition(transition.transitionKind),
        fromNodeId: transitionGraph.nodeId,
        toNodeId: targetGraphNodeId,
        evidenceRefDigest: transition.evidenceRefDigest,
        reasonCodes: [`transition-kind:${transition.transitionKind}`],
      }));
    }
  }

  for (const artifact of artifactRefs) {
    const artifactGraph = graphNode({
      nodeId: `lineage:artifact:${artifact.artifactId}`,
      kind: 'artifact',
      sourceId: artifact.artifactId,
      sourceDigest: artifact.artifactDigest,
      sourceVersion: artifact.sourceVersion,
      tenantRefDigest: input.assuranceCase.tenantRefDigest,
      scopeDigest: rootScopeDigest,
      signedSubject: signedSubjectSet.has(artifact.artifactDigest),
    });
    graphNodes.push(artifactGraph);
    sourceDigestToGraphNodeId.set(artifact.artifactDigest, artifactGraph.nodeId);
    graphEdges.push(graphEdge({
      edgeId: `edge:case-derived-from-artifact:${artifact.artifactId}`,
      kind: 'derived-from',
      fromNodeId: caseGraphNode.nodeId,
      toNodeId: artifactGraph.nodeId,
      evidenceRefDigest: artifact.digest,
      reasonCodes: [`artifact-kind:${artifact.artifactKind}`],
    }));
    if (artifact.targetNodeId !== null) {
      if (!assuranceNodeIds.has(artifact.targetNodeId)) {
        findings.add('artifact-target-missing');
      } else {
        graphEdges.push(graphEdge({
          edgeId: `edge:artifact-supports-node:${artifact.artifactId}`,
          kind: 'supports',
          fromNodeId: artifactGraph.nodeId,
          toNodeId: `lineage:node:${artifact.targetNodeId}`,
          evidenceRefDigest: artifact.artifactDigest,
          reasonCodes: [`artifact-kind:${artifact.artifactKind}`],
        }));
      }
    }
    if (artifact.targetTransitionId !== null) {
      if (!transitionIds.has(artifact.targetTransitionId)) {
        findings.add('artifact-target-missing');
      } else {
        graphEdges.push(graphEdge({
          edgeId: `edge:artifact-supports-transition:${artifact.artifactId}`,
          kind: 'supports',
          fromNodeId: artifactGraph.nodeId,
          toNodeId: `lineage:transition:${artifact.targetTransitionId}`,
          evidenceRefDigest: artifact.artifactDigest,
          reasonCodes: [`artifact-kind:${artifact.artifactKind}`],
        }));
      }
    }
  }

  for (const signature of signatureRefs) {
    const signatureGraph = graphNode({
      nodeId: `lineage:signature:${signature.signatureId}`,
      kind: 'signature',
      sourceId: signature.signatureId,
      sourceDigest: signature.signatureRefDigest,
      sourceVersion: signature.envelopeKind,
      tenantRefDigest: input.assuranceCase.tenantRefDigest,
      scopeDigest: rootScopeDigest,
      signedSubject: false,
    });
    graphNodes.push(signatureGraph);
    sourceDigestToGraphNodeId.set(signature.signatureRefDigest, signatureGraph.nodeId);
    const coveredNodeId = sourceDigestToGraphNodeId.get(signature.signedSubjectDigest);
    if (coveredNodeId === undefined) {
      findings.add('signature-subject-unmatched');
    } else {
      graphEdges.push(graphEdge({
        edgeId: `edge:signature-covers:${signature.signatureId}`,
        kind: 'signature-covers',
        fromNodeId: signatureGraph.nodeId,
        toNodeId: coveredNodeId,
        evidenceRefDigest: signature.signatureRefDigest,
        reasonCodes: [`signature-envelope:${signature.envelopeKind}`],
      }));
    }
  }

  const requiredSubjectDigests = uniqueSorted([
    input.assuranceCase.digest,
    ...input.assuranceCase.nodes.map((node) => node.digest),
    ...input.assuranceCase.defeaters.map((defeater) => defeater.digest),
    ...input.assuranceCase.transitions.map((transition) => transition.digest),
    ...artifactRefs.map((artifact) => artifact.artifactDigest),
  ]);
  const missingSignatureCoverageDigests = Object.freeze(
    requireSignatureCoverage
      ? requiredSubjectDigests.filter((digest) => !signedSubjectSet.has(digest))
      : [],
  );
  if (missingSignatureCoverageDigests.length > 0) {
    findings.add('signature-coverage-missing');
  }

  const sortedNodes = Object.freeze([...graphNodes].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId)));
  const sortedEdges = Object.freeze([...graphEdges].sort((a, b) =>
    a.edgeId.localeCompare(b.edgeId)));
  const sortedFindings = uniqueSorted([...findings]);
  const outcome = outcomeFor(sortedFindings);
  const reasonCodes = reasonCodesFor({
    outcome,
    findings: sortedFindings,
    openDefeaterCount: input.assuranceCase.openDefeaterCount,
    graphNodeCount: sortedNodes.length,
    graphEdgeCount: sortedEdges.length,
    requireSignatureCoverage,
  });
  const lineageRefDigest = bodyDigest('decision-lineage-ref', {
    lineageId,
    caseDigest: input.assuranceCase.digest,
    generatedAt,
    builderRefDigest,
  } as CanonicalReleaseJsonValue);
  const core: Omit<DecisionLineageGraphRecord, 'canonical' | 'digest'> = {
    version: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    lineageId,
    lineageRefDigest,
    generatedAt,
    builderRefDigest,
    tenantRefDigest: input.assuranceCase.tenantRefDigest,
    rootClaimId: input.assuranceCase.rootClaimId,
    rootClaimDigest: rootClaim?.digest ?? null,
    rootScopeDigest,
    caseId: input.assuranceCase.caseId,
    caseRefDigest: input.assuranceCase.caseRefDigest,
    caseDigest: input.assuranceCase.digest,
    artifactRefs,
    signatureRefs,
    graphNodes: sortedNodes,
    graphEdges: sortedEdges,
    graphNodeCount: sortedNodes.length,
    graphEdgeCount: sortedEdges.length,
    artifactCount: artifactRefs.length,
    signatureCount: signatureRefs.length,
    openDefeaterCount: input.assuranceCase.openDefeaterCount,
    signedSubjectDigests,
    requiredSubjectDigests,
    missingSignatureCoverageDigests,
    requireSignatureCoverage,
    outcome,
    findings: sortedFindings,
    reasonCodes,
    digestOnly: true,
    readOnly: true,
    noRawPayload: true,
    noRawEvidence: true,
    noExternalLineageExport: true,
    noSignatureCreation: true,
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

export function decisionLineageGraphDescriptor(): DecisionLineageGraphDescriptor {
  return Object.freeze({
    version: DECISION_LINEAGE_GRAPH_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    sourceAnchors: DECISION_LINEAGE_SOURCE_ANCHORS,
    nodeKinds: DECISION_LINEAGE_NODE_KINDS,
    edgeKinds: DECISION_LINEAGE_EDGE_KINDS,
    artifactKinds: DECISION_LINEAGE_ARTIFACT_KINDS,
    signatureEnvelopeKinds: DECISION_LINEAGE_SIGNATURE_ENVELOPE_KINDS,
    outcomes: DECISION_LINEAGE_OUTCOMES,
    findings: DECISION_LINEAGE_FINDINGS,
    buildsDigestBoundDag: true,
    tracksSignedSubjectsOnly: true,
    doesNotCreateSignatures: true,
    noExternalLineageExport: true,
    digestOnly: true,
    readOnly: true,
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
      'not-openlineage-export',
      'not-prov-or-sacm-conformance',
      'not-dsse-or-in-toto-signer',
      'not-transparency-log',
      'not-audit-plane-writer',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-readiness',
    ]),
  });
}
