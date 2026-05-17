import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CanonicalShadowEvent,
  CanonicalShadowEventConsequenceClass,
  CanonicalShadowEventReference,
  CanonicalShadowEventSourceKind,
} from './canonical-shadow-event-schema.js';

export const ACTION_SURFACE_GRAPH_VERSION =
  'attestor.action-surface-graph.v1';

export const ACTION_SURFACE_GRAPH_NODE_KINDS = [
  'tenant',
  'actor',
  'producer',
  'source-kind',
  'target-system',
  'action-surface',
  'action-kind',
  'consequence-class',
  'resource',
  'target-account',
  'data-class',
  'authority',
  'evidence',
  'policy',
  'approval',
  'receipt',
  'simulation',
] as const;
export type ActionSurfaceGraphNodeKind =
  typeof ACTION_SURFACE_GRAPH_NODE_KINDS[number];

export const ACTION_SURFACE_GRAPH_EDGE_KINDS = [
  'tenant-owns-surface',
  'actor-invoked-surface',
  'producer-emitted-surface',
  'surface-observed-from-source-kind',
  'surface-targets-system',
  'surface-has-action-kind',
  'surface-has-consequence-class',
  'surface-touches-resource',
  'surface-uses-target-account',
  'surface-carries-data-class',
  'surface-has-authority-delta',
  'surface-has-evidence',
  'surface-has-policy',
  'surface-has-approval',
  'surface-has-receipt',
  'surface-has-simulation',
] as const;
export type ActionSurfaceGraphEdgeKind =
  typeof ACTION_SURFACE_GRAPH_EDGE_KINDS[number];

export const ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS = [
  'canonicalEventCount',
  'admissionShadowEventCount',
  'targetSystemShadowEventCount',
  'integrationDeclarationEventCount',
  'cryptoExecutionAdmissionEventCount',
  'manualImportEventCount',
  'policyRefCount',
  'evidenceRefCount',
  'approvalRefCount',
  'receiptRefCount',
  'simulationRefCount',
  'replayRefCount',
  'traceRefCount',
  'resourceRefCount',
  'targetAccountRefCount',
  'authorityDeltaCount',
  'observedConsequenceClassCount',
  'inferredConsequenceClassCount',
] as const;
export type ActionSurfaceGraphRouteCoverageField =
  typeof ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS[number];

export const ACTION_SURFACE_GRAPH_COVERAGE_STATUSES = [
  'declared-only',
  'shadow-observed',
  'policy-and-evidence-linked',
  'approval-linked',
  'receipt-linked',
  'manual-review-required',
] as const;
export type ActionSurfaceGraphCoverageStatus =
  typeof ACTION_SURFACE_GRAPH_COVERAGE_STATUSES[number];

export const ACTION_SURFACE_GRAPH_GAP_REASONS = [
  'missing-shadow-observation',
  'missing-integration-declaration',
  'missing-target-system-shadow',
  'missing-policy-ref',
  'missing-evidence-ref',
  'missing-approval-ref',
  'missing-receipt-ref',
  'missing-resource-ref',
  'inferred-consequence-class-only',
  'manual-import-only',
] as const;
export type ActionSurfaceGraphGapReason =
  typeof ACTION_SURFACE_GRAPH_GAP_REASONS[number];

export const ACTION_SURFACE_GRAPH_NEXT_STEPS = [
  'add-shadow-capture',
  'add-integration-declaration',
  'bind-policy',
  'bind-evidence',
  'bind-resource',
  'route-for-review',
  'collect-receipt',
  'review-route-coverage',
] as const;
export type ActionSurfaceGraphNextStep =
  typeof ACTION_SURFACE_GRAPH_NEXT_STEPS[number];

export interface ActionSurfaceGraphNode {
  readonly nodeId: string;
  readonly kind: ActionSurfaceGraphNodeKind;
  readonly label: string;
  readonly refDigest: string | null;
  readonly eventCount: number;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly rawPayloadStored: false;
  readonly digest: string;
}

export interface ActionSurfaceGraphEdge {
  readonly edgeId: string;
  readonly kind: ActionSurfaceGraphEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly eventCount: number;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly eventDigests: readonly string[];
  readonly rawPayloadStored: false;
  readonly digest: string;
}

export type ActionSurfaceGraphRouteCoverage = Readonly<
  Record<ActionSurfaceGraphRouteCoverageField, number>
>;

export interface ActionSurfaceGraphSurface {
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly tenantRefDigest: string;
  readonly targetSystems: readonly string[];
  readonly actionNames: readonly string[];
  readonly actionKinds: readonly string[];
  readonly consequenceClasses: readonly CanonicalShadowEventConsequenceClass[];
  readonly consequenceClassOriginCounts: Readonly<Record<'observed' | 'inferred' | 'missing', number>>;
  readonly sourceKinds: readonly CanonicalShadowEventSourceKind[];
  readonly producers: readonly string[];
  readonly actorRefDigests: readonly string[];
  readonly resourceRefDigests: readonly string[];
  readonly targetAccountRefDigests: readonly string[];
  readonly dataClasses: readonly string[];
  readonly authorityKinds: readonly string[];
  readonly decisionCounts: Readonly<Record<string, number>>;
  readonly routeCoverage: ActionSurfaceGraphRouteCoverage;
  readonly coverageStatus: ActionSurfaceGraphCoverageStatus;
  readonly coverageGaps: readonly ActionSurfaceGraphGapReason[];
  readonly nextStep: ActionSurfaceGraphNextStep;
  readonly eventCount: number;
  readonly firstSeenAt: string | null;
  readonly lastSeenAt: string | null;
  readonly eventDigests: readonly string[];
  readonly rawPayloadStored: false;
  readonly autoEnforce: false;
  readonly approvalRequiredForPromotion: true;
  readonly digest: string;
}

export interface CreateActionSurfaceGraphInput {
  readonly events?: readonly CanonicalShadowEvent[] | null;
  readonly tenantRefDigest?: string | null;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceGraph {
  readonly version: typeof ACTION_SURFACE_GRAPH_VERSION;
  readonly generatedAt: string;
  readonly tenantRefDigest: string;
  readonly surfaceCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly eventCount: number;
  readonly observedSurfaceCount: number;
  readonly declaredOnlySurfaceCount: number;
  readonly receiptLinkedSurfaceCount: number;
  readonly surfaces: readonly ActionSurfaceGraphSurface[];
  readonly nodes: readonly ActionSurfaceGraphNode[];
  readonly edges: readonly ActionSurfaceGraphEdge[];
  readonly gapCounts: Readonly<Record<ActionSurfaceGraphGapReason, number>>;
  readonly recommendedNextSteps: readonly ActionSurfaceGraphNextStep[];
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceGraphDescriptor {
  readonly version: typeof ACTION_SURFACE_GRAPH_VERSION;
  readonly nodeKinds: typeof ACTION_SURFACE_GRAPH_NODE_KINDS;
  readonly edgeKinds: typeof ACTION_SURFACE_GRAPH_EDGE_KINDS;
  readonly routeCoverageFields: typeof ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS;
  readonly coverageStatuses: typeof ACTION_SURFACE_GRAPH_COVERAGE_STATUSES;
  readonly gapReasons: typeof ACTION_SURFACE_GRAPH_GAP_REASONS;
  readonly nextSteps: typeof ACTION_SURFACE_GRAPH_NEXT_STEPS;
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}

interface MutableNode {
  kind: ActionSurfaceGraphNodeKind;
  label: string;
  refDigest: string | null;
  eventDigests: Set<string>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

interface MutableEdge {
  kind: ActionSurfaceGraphEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  eventDigests: Set<string>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

interface MutableSurface {
  actionSurface: string;
  tenantRefDigest: string;
  targetSystems: Set<string>;
  actionNames: Set<string>;
  actionKinds: Set<string>;
  consequenceClasses: Set<CanonicalShadowEventConsequenceClass>;
  consequenceClassOriginCounts: Record<'observed' | 'inferred' | 'missing', number>;
  sourceKinds: Set<CanonicalShadowEventSourceKind>;
  producers: Set<string>;
  actorRefDigests: Set<string>;
  resourceRefDigests: Set<string>;
  targetAccountRefDigests: Set<string>;
  dataClasses: Set<string>;
  authorityKinds: Set<string>;
  decisionCounts: Record<string, number>;
  routeCoverage: Record<ActionSurfaceGraphRouteCoverageField, number>;
  eventDigests: Set<string>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Action surface graph ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value.trim())) {
    throw new Error(`Action surface graph ${fieldName} must be a sha256 digest reference.`);
  }
  return value.trim();
}

function optionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function shortDigest(value: string): string {
  return value.replace(/^sha256:/u, '').slice(0, 12);
}

function nodeKey(
  kind: ActionSurfaceGraphNodeKind,
  label: string,
  refDigest: string | null,
): string {
  return `${kind}\n${refDigest ?? label}`;
}

function nodeIdFor(
  kind: ActionSurfaceGraphNodeKind,
  label: string,
  refDigest: string | null,
): string {
  return `${kind}:${hashCanonical({ kind, label, refDigest } as unknown as CanonicalReleaseJsonValue)}`;
}

function edgeKey(
  kind: ActionSurfaceGraphEdgeKind,
  fromNodeId: string,
  toNodeId: string,
): string {
  return `${kind}\n${fromNodeId}\n${toNodeId}`;
}

function seenAt(target: { firstSeenAt: string | null; lastSeenAt: string | null }, occurredAt: string): void {
  target.firstSeenAt =
    target.firstSeenAt === null || occurredAt < target.firstSeenAt
      ? occurredAt
      : target.firstSeenAt;
  target.lastSeenAt =
    target.lastSeenAt === null || occurredAt > target.lastSeenAt
      ? occurredAt
      : target.lastSeenAt;
}

function increment<K extends string>(counts: Record<K, number>, key: K): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function emptyCoverage(): Record<ActionSurfaceGraphRouteCoverageField, number> {
  return Object.fromEntries(
    ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS.map((field) => [field, 0]),
  ) as Record<ActionSurfaceGraphRouteCoverageField, number>;
}

function surfaceNameFor(event: CanonicalShadowEvent): string {
  const targetSystem = optionalString(event.observed.targetSystem);
  const actionName = optionalString(event.observed.actionName);
  if (targetSystem && actionName) return `${targetSystem}.${actionName}`;
  if (actionName) return actionName;
  const surfaceRef = [
    ...event.evidenceRefs,
    ...event.policyRefs,
    ...event.approvalRefs,
    ...event.receiptRefs,
    ...event.simulationRefs,
  ].find((ref) => ref.kind === 'action-surface');
  if (surfaceRef) return `action-surface:${shortDigest(surfaceRef.digest)}`;
  return `unresolved-action-surface:${shortDigest(event.digest)}`;
}

function createMutableSurface(
  actionSurface: string,
  tenantRefDigest: string,
): MutableSurface {
  return {
    actionSurface,
    tenantRefDigest,
    targetSystems: new Set<string>(),
    actionNames: new Set<string>(),
    actionKinds: new Set<string>(),
    consequenceClasses: new Set<CanonicalShadowEventConsequenceClass>(),
    consequenceClassOriginCounts: { observed: 0, inferred: 0, missing: 0 },
    sourceKinds: new Set<CanonicalShadowEventSourceKind>(),
    producers: new Set<string>(),
    actorRefDigests: new Set<string>(),
    resourceRefDigests: new Set<string>(),
    targetAccountRefDigests: new Set<string>(),
    dataClasses: new Set<string>(),
    authorityKinds: new Set<string>(),
    decisionCounts: {},
    routeCoverage: emptyCoverage(),
    eventDigests: new Set<string>(),
    firstSeenAt: null,
    lastSeenAt: null,
  };
}

function addNode(
  nodes: Map<string, MutableNode>,
  input: {
    readonly kind: ActionSurfaceGraphNodeKind;
    readonly label: string;
    readonly refDigest?: string | null;
    readonly eventDigest: string;
    readonly occurredAt: string;
  },
): string {
  const refDigest = input.refDigest ?? null;
  const key = nodeKey(input.kind, input.label, refDigest);
  const node = nodes.get(key) ?? {
    kind: input.kind,
    label: input.label,
    refDigest,
    eventDigests: new Set<string>(),
    firstSeenAt: null,
    lastSeenAt: null,
  };
  node.eventDigests.add(input.eventDigest);
  seenAt(node, input.occurredAt);
  nodes.set(key, node);
  return nodeIdFor(input.kind, input.label, refDigest);
}

function addEdge(
  edges: Map<string, MutableEdge>,
  input: {
    readonly kind: ActionSurfaceGraphEdgeKind;
    readonly fromNodeId: string;
    readonly toNodeId: string;
    readonly eventDigest: string;
    readonly occurredAt: string;
  },
): void {
  const key = edgeKey(input.kind, input.fromNodeId, input.toNodeId);
  const edge = edges.get(key) ?? {
    kind: input.kind,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    eventDigests: new Set<string>(),
    firstSeenAt: null,
    lastSeenAt: null,
  };
  edge.eventDigests.add(input.eventDigest);
  seenAt(edge, input.occurredAt);
  edges.set(key, edge);
}

function addRefEdge(
  graph: {
    readonly nodes: Map<string, MutableNode>;
    readonly edges: Map<string, MutableEdge>;
  },
  input: {
    readonly surfaceNodeId: string;
    readonly ref: CanonicalShadowEventReference;
    readonly nodeKind: ActionSurfaceGraphNodeKind;
    readonly edgeKind: ActionSurfaceGraphEdgeKind;
    readonly eventDigest: string;
    readonly occurredAt: string;
  },
): void {
  const label = `${input.nodeKind}:${shortDigest(input.ref.digest)}`;
  const nodeId = addNode(graph.nodes, {
    kind: input.nodeKind,
    label,
    refDigest: input.ref.digest,
    eventDigest: input.eventDigest,
    occurredAt: input.occurredAt,
  });
  addEdge(graph.edges, {
    kind: input.edgeKind,
    fromNodeId: input.surfaceNodeId,
    toNodeId: nodeId,
    eventDigest: input.eventDigest,
    occurredAt: input.occurredAt,
  });
}

function recordCoverage(surface: MutableSurface, event: CanonicalShadowEvent): void {
  increment(surface.routeCoverage, 'canonicalEventCount');
  if (event.sourceKind === 'admission-shadow') {
    increment(surface.routeCoverage, 'admissionShadowEventCount');
  }
  if (event.sourceKind === 'target-system-shadow') {
    increment(surface.routeCoverage, 'targetSystemShadowEventCount');
  }
  if (event.sourceKind === 'integration-declaration') {
    increment(surface.routeCoverage, 'integrationDeclarationEventCount');
  }
  if (event.sourceKind === 'crypto-execution-admission') {
    increment(surface.routeCoverage, 'cryptoExecutionAdmissionEventCount');
  }
  if (event.sourceKind === 'manual-import') {
    increment(surface.routeCoverage, 'manualImportEventCount');
  }
  surface.routeCoverage.policyRefCount += event.policyRefs.length;
  surface.routeCoverage.evidenceRefCount += event.evidenceRefs.length;
  surface.routeCoverage.approvalRefCount += event.approvalRefs.length;
  surface.routeCoverage.receiptRefCount += event.receiptRefs.length;
  surface.routeCoverage.simulationRefCount += event.simulationRefs.length;
  if (event.replayRefDigest !== null) increment(surface.routeCoverage, 'replayRefCount');
  if (event.traceRefDigest !== null) increment(surface.routeCoverage, 'traceRefCount');
  if (event.observed.resourceRefDigest !== null || event.inferred.resourceRefDigest !== null) {
    increment(surface.routeCoverage, 'resourceRefCount');
  }
  if (
    event.observed.targetAccountRefDigest !== null ||
    event.inferred.targetAccountRefDigest !== null
  ) {
    increment(surface.routeCoverage, 'targetAccountRefCount');
  }
  if (event.observed.authorityDelta !== null || event.inferred.authorityDelta !== null) {
    increment(surface.routeCoverage, 'authorityDeltaCount');
  }
  if (event.observed.consequenceClass !== null) {
    increment(surface.routeCoverage, 'observedConsequenceClassCount');
    surface.consequenceClassOriginCounts.observed += 1;
  }
  if (event.inferred.consequenceClass !== null) {
    increment(surface.routeCoverage, 'inferredConsequenceClassCount');
    surface.consequenceClassOriginCounts.inferred += 1;
  }
  if (event.observed.consequenceClass === null && event.inferred.consequenceClass === null) {
    surface.consequenceClassOriginCounts.missing += 1;
  }
}

function addEventToSurface(surface: MutableSurface, event: CanonicalShadowEvent): void {
  surface.eventDigests.add(event.digest);
  seenAt(surface, event.occurredAt);
  surface.sourceKinds.add(event.sourceKind);
  surface.producers.add(event.producer);
  surface.actorRefDigests.add(event.actorRefDigest);

  for (const value of [event.observed.targetSystem, event.inferred.targetSystem]) {
    const normalized = optionalString(value);
    if (normalized) surface.targetSystems.add(normalized);
  }
  for (const value of [event.observed.actionName, event.inferred.actionName]) {
    const normalized = optionalString(value);
    if (normalized) surface.actionNames.add(normalized);
  }
  for (const value of [event.observed.actionKind, event.inferred.actionKind]) {
    if (value) surface.actionKinds.add(value);
  }
  for (const value of [event.observed.consequenceClass, event.inferred.consequenceClass]) {
    if (value) surface.consequenceClasses.add(value);
  }
  for (const value of [event.observed.resourceRefDigest, event.inferred.resourceRefDigest]) {
    if (value) surface.resourceRefDigests.add(value);
  }
  for (const value of [
    event.observed.targetAccountRefDigest,
    event.inferred.targetAccountRefDigest,
  ]) {
    if (value) surface.targetAccountRefDigests.add(value);
  }
  for (const value of [event.observed.dataClass, event.inferred.dataClass]) {
    const normalized = optionalString(value);
    if (normalized) surface.dataClasses.add(normalized);
  }
  for (const value of [event.observed.authorityDelta, event.inferred.authorityDelta]) {
    if (value) surface.authorityKinds.add(value.authorityKind);
  }
  increment(surface.decisionCounts, event.decision.effectiveDecision ?? 'none');
  recordCoverage(surface, event);
}

function addEventGraphEdges(
  nodes: Map<string, MutableNode>,
  edges: Map<string, MutableEdge>,
  event: CanonicalShadowEvent,
  actionSurface: string,
): void {
  const occurredAt = event.occurredAt;
  const tenantNodeId = addNode(nodes, {
    kind: 'tenant',
    label: 'tenant',
    refDigest: event.tenantRefDigest,
    eventDigest: event.digest,
    occurredAt,
  });
  const surfaceNodeId = addNode(nodes, {
    kind: 'action-surface',
    label: actionSurface,
    refDigest: hashCanonical({ actionSurface } as unknown as CanonicalReleaseJsonValue),
    eventDigest: event.digest,
    occurredAt,
  });
  addEdge(edges, {
    kind: 'tenant-owns-surface',
    fromNodeId: tenantNodeId,
    toNodeId: surfaceNodeId,
    eventDigest: event.digest,
    occurredAt,
  });

  const actorNodeId = addNode(nodes, {
    kind: 'actor',
    label: 'actor',
    refDigest: event.actorRefDigest,
    eventDigest: event.digest,
    occurredAt,
  });
  addEdge(edges, {
    kind: 'actor-invoked-surface',
    fromNodeId: actorNodeId,
    toNodeId: surfaceNodeId,
    eventDigest: event.digest,
    occurredAt,
  });

  const producerNodeId = addNode(nodes, {
    kind: 'producer',
    label: event.producer,
    eventDigest: event.digest,
    occurredAt,
  });
  addEdge(edges, {
    kind: 'producer-emitted-surface',
    fromNodeId: producerNodeId,
    toNodeId: surfaceNodeId,
    eventDigest: event.digest,
    occurredAt,
  });

  const sourceNodeId = addNode(nodes, {
    kind: 'source-kind',
    label: event.sourceKind,
    eventDigest: event.digest,
    occurredAt,
  });
  addEdge(edges, {
    kind: 'surface-observed-from-source-kind',
    fromNodeId: surfaceNodeId,
    toNodeId: sourceNodeId,
    eventDigest: event.digest,
    occurredAt,
  });

  for (const targetSystem of [event.observed.targetSystem, event.inferred.targetSystem]) {
    const normalized = optionalString(targetSystem);
    if (!normalized) continue;
    const targetNodeId = addNode(nodes, {
      kind: 'target-system',
      label: normalized,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-targets-system',
      fromNodeId: surfaceNodeId,
      toNodeId: targetNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const actionKind of [event.observed.actionKind, event.inferred.actionKind]) {
    if (!actionKind) continue;
    const actionKindNodeId = addNode(nodes, {
      kind: 'action-kind',
      label: actionKind,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-has-action-kind',
      fromNodeId: surfaceNodeId,
      toNodeId: actionKindNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const consequenceClass of [
    event.observed.consequenceClass,
    event.inferred.consequenceClass,
  ]) {
    if (!consequenceClass) continue;
    const classNodeId = addNode(nodes, {
      kind: 'consequence-class',
      label: consequenceClass,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-has-consequence-class',
      fromNodeId: surfaceNodeId,
      toNodeId: classNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const resourceRefDigest of [
    event.observed.resourceRefDigest,
    event.inferred.resourceRefDigest,
  ]) {
    if (!resourceRefDigest) continue;
    const resourceNodeId = addNode(nodes, {
      kind: 'resource',
      label: `resource:${shortDigest(resourceRefDigest)}`,
      refDigest: resourceRefDigest,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-touches-resource',
      fromNodeId: surfaceNodeId,
      toNodeId: resourceNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const targetAccountRefDigest of [
    event.observed.targetAccountRefDigest,
    event.inferred.targetAccountRefDigest,
  ]) {
    if (!targetAccountRefDigest) continue;
    const accountNodeId = addNode(nodes, {
      kind: 'target-account',
      label: `target-account:${shortDigest(targetAccountRefDigest)}`,
      refDigest: targetAccountRefDigest,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-uses-target-account',
      fromNodeId: surfaceNodeId,
      toNodeId: accountNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const dataClass of [event.observed.dataClass, event.inferred.dataClass]) {
    const normalized = optionalString(dataClass);
    if (!normalized) continue;
    const dataClassNodeId = addNode(nodes, {
      kind: 'data-class',
      label: normalized,
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-carries-data-class',
      fromNodeId: surfaceNodeId,
      toNodeId: dataClassNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const authorityDelta of [event.observed.authorityDelta, event.inferred.authorityDelta]) {
    if (!authorityDelta) continue;
    const authorityNodeId = addNode(nodes, {
      kind: 'authority',
      label: authorityDelta.authorityKind,
      refDigest: hashCanonical(authorityDelta as unknown as CanonicalReleaseJsonValue),
      eventDigest: event.digest,
      occurredAt,
    });
    addEdge(edges, {
      kind: 'surface-has-authority-delta',
      fromNodeId: surfaceNodeId,
      toNodeId: authorityNodeId,
      eventDigest: event.digest,
      occurredAt,
    });
  }

  for (const ref of event.evidenceRefs) {
    addRefEdge({ nodes, edges }, {
      surfaceNodeId,
      ref,
      nodeKind: 'evidence',
      edgeKind: 'surface-has-evidence',
      eventDigest: event.digest,
      occurredAt,
    });
  }
  for (const ref of event.policyRefs) {
    addRefEdge({ nodes, edges }, {
      surfaceNodeId,
      ref,
      nodeKind: 'policy',
      edgeKind: 'surface-has-policy',
      eventDigest: event.digest,
      occurredAt,
    });
  }
  for (const ref of event.approvalRefs) {
    addRefEdge({ nodes, edges }, {
      surfaceNodeId,
      ref,
      nodeKind: 'approval',
      edgeKind: 'surface-has-approval',
      eventDigest: event.digest,
      occurredAt,
    });
  }
  for (const ref of event.receiptRefs) {
    addRefEdge({ nodes, edges }, {
      surfaceNodeId,
      ref,
      nodeKind: 'receipt',
      edgeKind: 'surface-has-receipt',
      eventDigest: event.digest,
      occurredAt,
    });
  }
  for (const ref of event.simulationRefs) {
    addRefEdge({ nodes, edges }, {
      surfaceNodeId,
      ref,
      nodeKind: 'simulation',
      edgeKind: 'surface-has-simulation',
      eventDigest: event.digest,
      occurredAt,
    });
  }
}

function hasObservation(coverage: ActionSurfaceGraphRouteCoverage): boolean {
  return coverage.admissionShadowEventCount > 0 ||
    coverage.targetSystemShadowEventCount > 0 ||
    coverage.cryptoExecutionAdmissionEventCount > 0;
}

function coverageGaps(surface: MutableSurface): readonly ActionSurfaceGraphGapReason[] {
  const coverage = surface.routeCoverage;
  const gaps = new Set<ActionSurfaceGraphGapReason>();
  if (!hasObservation(coverage)) gaps.add('missing-shadow-observation');
  if (coverage.integrationDeclarationEventCount === 0) {
    gaps.add('missing-integration-declaration');
  }
  if (
    coverage.targetSystemShadowEventCount === 0 &&
    coverage.cryptoExecutionAdmissionEventCount === 0
  ) {
    gaps.add('missing-target-system-shadow');
  }
  if (coverage.policyRefCount === 0) gaps.add('missing-policy-ref');
  if (coverage.evidenceRefCount === 0) gaps.add('missing-evidence-ref');
  if (coverage.approvalRefCount === 0) gaps.add('missing-approval-ref');
  if (coverage.receiptRefCount === 0) gaps.add('missing-receipt-ref');
  if (coverage.resourceRefCount === 0) gaps.add('missing-resource-ref');
  if (
    coverage.inferredConsequenceClassCount > 0 &&
    coverage.observedConsequenceClassCount === 0
  ) {
    gaps.add('inferred-consequence-class-only');
  }
  if (coverage.manualImportEventCount === coverage.canonicalEventCount) {
    gaps.add('manual-import-only');
  }
  return Object.freeze([...gaps].sort());
}

function coverageStatus(
  surface: MutableSurface,
  gaps: readonly ActionSurfaceGraphGapReason[],
): ActionSurfaceGraphCoverageStatus {
  const coverage = surface.routeCoverage;
  if (coverage.manualImportEventCount === coverage.canonicalEventCount) {
    return 'manual-review-required';
  }
  if (!hasObservation(coverage) && coverage.integrationDeclarationEventCount > 0) {
    return 'declared-only';
  }
  if (coverage.receiptRefCount > 0) return 'receipt-linked';
  if (coverage.approvalRefCount > 0) return 'approval-linked';
  if (
    coverage.policyRefCount > 0 &&
    coverage.evidenceRefCount > 0 &&
    !gaps.includes('missing-shadow-observation')
  ) {
    return 'policy-and-evidence-linked';
  }
  return 'shadow-observed';
}

function nextStep(gaps: readonly ActionSurfaceGraphGapReason[]): ActionSurfaceGraphNextStep {
  if (
    gaps.includes('manual-import-only') ||
    gaps.includes('missing-shadow-observation')
  ) {
    return 'add-shadow-capture';
  }
  if (gaps.includes('missing-integration-declaration')) return 'add-integration-declaration';
  if (gaps.includes('missing-policy-ref')) return 'bind-policy';
  if (gaps.includes('missing-evidence-ref')) return 'bind-evidence';
  if (gaps.includes('missing-resource-ref')) return 'bind-resource';
  if (gaps.includes('missing-approval-ref')) return 'route-for-review';
  if (gaps.includes('missing-receipt-ref')) return 'collect-receipt';
  return 'review-route-coverage';
}

function freezeCounts<K extends string>(counts: Record<K, number>): Readonly<Record<K, number>> {
  return Object.freeze({ ...counts });
}

function freezeStringSet(values: Set<string>): readonly string[] {
  return Object.freeze([...values].sort());
}

function freezeSurface(surface: MutableSurface): ActionSurfaceGraphSurface {
  const gaps = coverageGaps(surface);
  const status = coverageStatus(surface, gaps);
  const payload = {
    surfaceId: `action-surface-graph:${hashCanonical({
      tenantRefDigest: surface.tenantRefDigest,
      actionSurface: surface.actionSurface,
    } as unknown as CanonicalReleaseJsonValue)}`,
    actionSurface: surface.actionSurface,
    tenantRefDigest: surface.tenantRefDigest,
    targetSystems: freezeStringSet(surface.targetSystems),
    actionNames: freezeStringSet(surface.actionNames),
    actionKinds: freezeStringSet(surface.actionKinds),
    consequenceClasses: Object.freeze([...surface.consequenceClasses].sort()),
    consequenceClassOriginCounts: freezeCounts(surface.consequenceClassOriginCounts),
    sourceKinds: Object.freeze([...surface.sourceKinds].sort()),
    producers: freezeStringSet(surface.producers),
    actorRefDigests: freezeStringSet(surface.actorRefDigests),
    resourceRefDigests: freezeStringSet(surface.resourceRefDigests),
    targetAccountRefDigests: freezeStringSet(surface.targetAccountRefDigests),
    dataClasses: freezeStringSet(surface.dataClasses),
    authorityKinds: freezeStringSet(surface.authorityKinds),
    decisionCounts: freezeCounts(surface.decisionCounts),
    routeCoverage: freezeCounts(surface.routeCoverage),
    coverageStatus: status,
    coverageGaps: gaps,
    nextStep: nextStep(gaps),
    eventCount: surface.eventDigests.size,
    firstSeenAt: surface.firstSeenAt,
    lastSeenAt: surface.lastSeenAt,
    eventDigests: freezeStringSet(surface.eventDigests),
    rawPayloadStored: false as const,
    autoEnforce: false as const,
    approvalRequiredForPromotion: true as const,
  };
  return Object.freeze({
    ...payload,
    digest: hashCanonical(payload as unknown as CanonicalReleaseJsonValue),
  });
}

function freezeNode(node: MutableNode): ActionSurfaceGraphNode {
  const payload = {
    nodeId: nodeIdFor(node.kind, node.label, node.refDigest),
    kind: node.kind,
    label: node.label,
    refDigest: node.refDigest,
    eventCount: node.eventDigests.size,
    firstSeenAt: node.firstSeenAt,
    lastSeenAt: node.lastSeenAt,
    rawPayloadStored: false as const,
  };
  return Object.freeze({
    ...payload,
    digest: hashCanonical(payload as unknown as CanonicalReleaseJsonValue),
  });
}

function freezeEdge(edge: MutableEdge): ActionSurfaceGraphEdge {
  const payload = {
    edgeId: `${edge.kind}:${hashCanonical({
      kind: edge.kind,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
    } as unknown as CanonicalReleaseJsonValue)}`,
    kind: edge.kind,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    eventCount: edge.eventDigests.size,
    firstSeenAt: edge.firstSeenAt,
    lastSeenAt: edge.lastSeenAt,
    eventDigests: freezeStringSet(edge.eventDigests),
    rawPayloadStored: false as const,
  };
  return Object.freeze({
    ...payload,
    digest: hashCanonical(payload as unknown as CanonicalReleaseJsonValue),
  });
}

function graphTenantRefDigest(
  events: readonly CanonicalShadowEvent[],
  requestedTenantRefDigest: string | null | undefined,
): string {
  const requested = requestedTenantRefDigest === undefined || requestedTenantRefDigest === null
    ? null
    : normalizeDigest(requestedTenantRefDigest, 'tenantRefDigest');
  const eventTenants = new Set(events.map((event) => event.tenantRefDigest));
  if (requested !== null && eventTenants.size > 0 && !eventTenants.has(requested)) {
    throw new Error('Action surface graph tenantRefDigest must match every event tenantRefDigest.');
  }
  if (eventTenants.size > 1) {
    throw new Error('Action surface graph cannot combine multiple tenantRefDigest values.');
  }
  const tenantFromEvents = [...eventTenants][0] ?? null;
  if (tenantFromEvents !== null) return tenantFromEvents;
  if (requested !== null) return requested;
  throw new Error('Action surface graph requires at least one event or an explicit tenantRefDigest.');
}

function gapCounts(
  surfaces: readonly ActionSurfaceGraphSurface[],
): Readonly<Record<ActionSurfaceGraphGapReason, number>> {
  const counts = Object.fromEntries(
    ACTION_SURFACE_GRAPH_GAP_REASONS.map((reason) => [reason, 0]),
  ) as Record<ActionSurfaceGraphGapReason, number>;
  for (const surface of surfaces) {
    for (const gap of surface.coverageGaps) {
      counts[gap] += 1;
    }
  }
  return Object.freeze(counts);
}

function recommendedNextSteps(
  surfaces: readonly ActionSurfaceGraphSurface[],
): readonly ActionSurfaceGraphNextStep[] {
  return Object.freeze([...new Set(surfaces.map((surface) => surface.nextStep))].sort());
}

export function createActionSurfaceGraph(
  input: CreateActionSurfaceGraphInput,
): ActionSurfaceGraph {
  const events = Object.freeze([...(input.events ?? [])]);
  const tenantRefDigest = graphTenantRefDigest(events, input.tenantRefDigest);
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const surfacesByName = new Map<string, MutableSurface>();
  const nodes = new Map<string, MutableNode>();
  const edges = new Map<string, MutableEdge>();

  for (const event of events) {
    if (event.tenantRefDigest !== tenantRefDigest) {
      throw new Error('Action surface graph event tenantRefDigest mismatch.');
    }
    const actionSurface = surfaceNameFor(event);
    const surface = surfacesByName.get(actionSurface) ??
      createMutableSurface(actionSurface, tenantRefDigest);
    addEventToSurface(surface, event);
    surfacesByName.set(actionSurface, surface);
    addEventGraphEdges(nodes, edges, event, actionSurface);
  }

  const surfaces = Object.freeze(
    [...surfacesByName.values()]
      .map(freezeSurface)
      .sort((left, right) =>
        right.eventCount - left.eventCount ||
        left.actionSurface.localeCompare(right.actionSurface)
      ),
  );
  const frozenNodes = Object.freeze(
    [...nodes.values()]
      .map(freezeNode)
      .sort((left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.label.localeCompare(right.label) ||
        left.nodeId.localeCompare(right.nodeId)
      ),
  );
  const frozenEdges = Object.freeze(
    [...edges.values()]
      .map(freezeEdge)
      .sort((left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.fromNodeId.localeCompare(right.fromNodeId) ||
        left.toNodeId.localeCompare(right.toNodeId)
      ),
  );
  const payload = {
    version: ACTION_SURFACE_GRAPH_VERSION as typeof ACTION_SURFACE_GRAPH_VERSION,
    generatedAt,
    tenantRefDigest,
    surfaceCount: surfaces.length,
    nodeCount: frozenNodes.length,
    edgeCount: frozenEdges.length,
    eventCount: events.length,
    observedSurfaceCount: surfaces.filter((surface) =>
      surface.coverageStatus !== 'declared-only' &&
      surface.coverageStatus !== 'manual-review-required'
    ).length,
    declaredOnlySurfaceCount: surfaces.filter((surface) =>
      surface.coverageStatus === 'declared-only'
    ).length,
    receiptLinkedSurfaceCount: surfaces.filter((surface) =>
      surface.coverageStatus === 'receipt-linked'
    ).length,
    surfaces,
    nodes: frozenNodes,
    edges: frozenEdges,
    gapCounts: gapCounts(surfaces),
    recommendedNextSteps: recommendedNextSteps(surfaces),
    tenantBound: true as const,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceGraphDescriptor(): ActionSurfaceGraphDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_GRAPH_VERSION,
    nodeKinds: ACTION_SURFACE_GRAPH_NODE_KINDS,
    edgeKinds: ACTION_SURFACE_GRAPH_EDGE_KINDS,
    routeCoverageFields: ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS,
    coverageStatuses: ACTION_SURFACE_GRAPH_COVERAGE_STATUSES,
    gapReasons: ACTION_SURFACE_GRAPH_GAP_REASONS,
    nextSteps: ACTION_SURFACE_GRAPH_NEXT_STEPS,
    tenantBound: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  });
}
