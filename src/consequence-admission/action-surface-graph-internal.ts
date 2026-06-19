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
import {
  ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS,
  type ActionSurfaceGraphEdgeKind,
  type ActionSurfaceGraphNodeKind,
  type ActionSurfaceGraphRouteCoverageField,
} from './action-surface-graph-types.js';

export interface MutableNode {
  kind: ActionSurfaceGraphNodeKind;
  label: string;
  refDigest: string | null;
  eventDigests: Set<string>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface MutableEdge {
  kind: ActionSurfaceGraphEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  eventDigests: Set<string>;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface MutableSurface {
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

export function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

export function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

export function normalizeIsoTimestamp(
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

export function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value.trim())) {
    throw new Error(`Action surface graph ${fieldName} must be a sha256 digest reference.`);
  }
  return value.trim();
}

export function optionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function shortDigest(value: string): string {
  return value.replace(/^sha256:/u, '').slice(0, 12);
}

export function nodeKey(
  kind: ActionSurfaceGraphNodeKind,
  label: string,
  refDigest: string | null,
): string {
  return `${kind}\n${refDigest ?? label}`;
}

export function nodeIdFor(
  kind: ActionSurfaceGraphNodeKind,
  label: string,
  refDigest: string | null,
): string {
  return `${kind}:${hashCanonical({ kind, label, refDigest } as unknown as CanonicalReleaseJsonValue)}`;
}

export function edgeKey(
  kind: ActionSurfaceGraphEdgeKind,
  fromNodeId: string,
  toNodeId: string,
): string {
  return `${kind}\n${fromNodeId}\n${toNodeId}`;
}

export function seenAt(target: { firstSeenAt: string | null; lastSeenAt: string | null }, occurredAt: string): void {
  target.firstSeenAt =
    target.firstSeenAt === null || occurredAt < target.firstSeenAt
      ? occurredAt
      : target.firstSeenAt;
  target.lastSeenAt =
    target.lastSeenAt === null || occurredAt > target.lastSeenAt
      ? occurredAt
      : target.lastSeenAt;
}

export function increment<K extends string>(counts: Record<K, number>, key: K): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function emptyCoverage(): Record<ActionSurfaceGraphRouteCoverageField, number> {
  return Object.fromEntries(
    ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS.map((field) => [field, 0]),
  ) as Record<ActionSurfaceGraphRouteCoverageField, number>;
}

export function surfaceNameFor(event: CanonicalShadowEvent): string {
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

export function createMutableSurface(
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

export function addNode(
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

export function addEdge(
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

export function addRefEdge(
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
