import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  ACTION_SURFACE_GRAPH_VERSION,
  type ActionSurfaceGraph,
  type CreateActionSurfaceGraphInput,
} from './action-surface-graph-types.js';
import {
  canonicalObject,
  createMutableSurface,
  normalizeIsoTimestamp,
  surfaceNameFor,
  type MutableEdge,
  type MutableNode,
  type MutableSurface,
} from './action-surface-graph-internal.js';
import {
  addEventGraphEdges,
  addEventToSurface,
} from './action-surface-graph-record.js';
import {
  freezeEdge,
  freezeNode,
  freezeSurface,
  gapCounts,
  graphTenantRefDigest,
  recommendedNextSteps,
} from './action-surface-graph-freeze.js';

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
