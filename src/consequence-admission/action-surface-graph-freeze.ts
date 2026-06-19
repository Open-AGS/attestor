import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CanonicalShadowEvent } from './canonical-shadow-event-schema.js';
import {
  ACTION_SURFACE_GRAPH_GAP_REASONS,
  type ActionSurfaceGraphCoverageStatus,
  type ActionSurfaceGraphEdge,
  type ActionSurfaceGraphGapReason,
  type ActionSurfaceGraphNextStep,
  type ActionSurfaceGraphNode,
  type ActionSurfaceGraphRouteCoverage,
  type ActionSurfaceGraphSurface,
} from './action-surface-graph-types.js';
import {
  hashCanonical,
  nodeIdFor,
  normalizeDigest,
  type MutableEdge,
  type MutableNode,
  type MutableSurface,
} from './action-surface-graph-internal.js';

export function hasObservation(coverage: ActionSurfaceGraphRouteCoverage): boolean {
  return coverage.admissionShadowEventCount > 0 ||
    coverage.targetSystemShadowEventCount > 0 ||
    coverage.cryptoExecutionAdmissionEventCount > 0;
}

export function coverageGaps(surface: MutableSurface): readonly ActionSurfaceGraphGapReason[] {
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

export function coverageStatus(
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

export function nextStep(gaps: readonly ActionSurfaceGraphGapReason[]): ActionSurfaceGraphNextStep {
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

export function freezeCounts<K extends string>(counts: Record<K, number>): Readonly<Record<K, number>> {
  return Object.freeze({ ...counts });
}

export function freezeStringSet(values: Set<string>): readonly string[] {
  return Object.freeze([...values].sort());
}

export function freezeSurface(surface: MutableSurface): ActionSurfaceGraphSurface {
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

export function freezeNode(node: MutableNode): ActionSurfaceGraphNode {
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

export function freezeEdge(edge: MutableEdge): ActionSurfaceGraphEdge {
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

export function graphTenantRefDigest(
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

export function gapCounts(
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

export function recommendedNextSteps(
  surfaces: readonly ActionSurfaceGraphSurface[],
): readonly ActionSurfaceGraphNextStep[] {
  return Object.freeze([...new Set(surfaces.map((surface) => surface.nextStep))].sort());
}
