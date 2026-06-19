import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CanonicalShadowEvent } from './canonical-shadow-event-schema.js';
import {
  addEdge,
  addNode,
  addRefEdge,
  hashCanonical,
  increment,
  optionalString,
  seenAt,
  shortDigest,
  type MutableEdge,
  type MutableNode,
  type MutableSurface,
} from './action-surface-graph-internal.js';

export function recordCoverage(surface: MutableSurface, event: CanonicalShadowEvent): void {
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

export function addEventToSurface(surface: MutableSurface, event: CanonicalShadowEvent): void {
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

export function addEventGraphEdges(
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
