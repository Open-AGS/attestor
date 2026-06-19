import type {
  CanonicalShadowEvent,
  CanonicalShadowEventConsequenceClass,
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
