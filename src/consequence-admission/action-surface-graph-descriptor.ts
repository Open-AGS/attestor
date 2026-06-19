import {
  ACTION_SURFACE_GRAPH_COVERAGE_STATUSES,
  ACTION_SURFACE_GRAPH_EDGE_KINDS,
  ACTION_SURFACE_GRAPH_GAP_REASONS,
  ACTION_SURFACE_GRAPH_NEXT_STEPS,
  ACTION_SURFACE_GRAPH_NODE_KINDS,
  ACTION_SURFACE_GRAPH_ROUTE_COVERAGE_FIELDS,
  ACTION_SURFACE_GRAPH_VERSION,
  type ActionSurfaceGraphDescriptor,
} from './action-surface-graph-types.js';

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
