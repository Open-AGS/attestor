import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceGraph,
  ActionSurfaceGraphRouteCoverage,
  ActionSurfaceGraphSurface,
} from './action-surface-graph.js';

export const EVIDENCE_STATE_MODEL_VERSION =
  'attestor.evidence-state-model.v1';

export const EVIDENCE_STATE_KINDS = [
  'observed',
  'inferred',
  'missing',
  'conflicting',
  'stale',
  'untrusted',
  'approved',
  'enforceable',
] as const;
export type EvidenceStateKind = typeof EVIDENCE_STATE_KINDS[number];

export const EVIDENCE_STATE_FIELDS = [
  'shadow-observation',
  'target-system-shadow',
  'integration-declaration',
  'policy-ref',
  'evidence-ref',
  'approval-ref',
  'receipt-ref',
  'resource-ref',
  'consequence-class',
  'producer-trust',
  'freshness',
  'enforceability',
] as const;
export type EvidenceStateField = typeof EVIDENCE_STATE_FIELDS[number];

export const EVIDENCE_STATE_SOURCES = [
  'action-surface-graph-route-coverage',
  'action-surface-graph-gap',
  'operator-approval-input',
  'producer-trust-input',
  'freshness-policy',
  'enforceability-input',
] as const;
export type EvidenceStateSource = typeof EVIDENCE_STATE_SOURCES[number];

export const EVIDENCE_STATE_BLOCKING_KINDS = [
  'inferred',
  'missing',
  'conflicting',
  'stale',
  'untrusted',
] as const satisfies readonly EvidenceStateKind[];

export type EvidenceStateBlockingKind =
  typeof EVIDENCE_STATE_BLOCKING_KINDS[number];

export interface EvidenceStateAssignment {
  readonly field: EvidenceStateField;
  readonly state: EvidenceStateKind;
  readonly source: EvidenceStateSource;
  readonly observedCount: number;
  readonly inferredCount: number;
  readonly refCount: number;
  readonly reasonCodes: readonly string[];
  readonly rawPayloadStored: false;
}

export interface EvidenceStateBlocker {
  readonly field: EvidenceStateField;
  readonly state: EvidenceStateBlockingKind;
  readonly reasonCodes: readonly string[];
  readonly nextStep: string;
}

export interface EvidenceStateModelSurface {
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly tenantRefDigest: string;
  readonly coverageStatus: string;
  readonly graphNextStep: string;
  readonly states: readonly EvidenceStateAssignment[];
  readonly stateCounts: Readonly<Record<EvidenceStateKind, number>>;
  readonly promotionBlockers: readonly EvidenceStateBlocker[];
  readonly blockingStates: readonly EvidenceStateBlockingKind[];
  readonly readyForPolicyCandidate: boolean;
  readonly readyForEnforcement: boolean;
  readonly rawPayloadStored: false;
  readonly autoEnforce: false;
  readonly approvalRequiredForPromotion: true;
  readonly digest: string;
}

export interface CreateEvidenceStateModelInput {
  readonly graph: ActionSurfaceGraph;
  readonly generatedAt?: string | null;
  readonly maxEvidenceAgeMs?: number | null;
  readonly trustedProducers?: readonly string[] | null;
  readonly approvedSurfaceIds?: readonly string[] | null;
  readonly enforceableSurfaceIds?: readonly string[] | null;
}

export interface EvidenceStateModel {
  readonly version: typeof EVIDENCE_STATE_MODEL_VERSION;
  readonly generatedAt: string;
  readonly graphDigest: string;
  readonly graphVersion: ActionSurfaceGraph['version'];
  readonly tenantRefDigest: string;
  readonly surfaceCount: number;
  readonly readyForPolicyCandidateCount: number;
  readonly readyForEnforcementCount: number;
  readonly blockedSurfaceCount: number;
  readonly stateCounts: Readonly<Record<EvidenceStateKind, number>>;
  readonly surfaces: readonly EvidenceStateModelSurface[];
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface EvidenceStateModelDescriptor {
  readonly version: typeof EVIDENCE_STATE_MODEL_VERSION;
  readonly stateKinds: typeof EVIDENCE_STATE_KINDS;
  readonly fields: typeof EVIDENCE_STATE_FIELDS;
  readonly sources: typeof EVIDENCE_STATE_SOURCES;
  readonly blockingKinds: typeof EVIDENCE_STATE_BLOCKING_KINDS;
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
}

const DEFAULT_MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
    throw new Error(`Evidence state model ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeStringSet(values: readonly string[] | null | undefined): ReadonlySet<string> {
  return new Set(
    (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function normalizeMaxEvidenceAge(value: number | null | undefined): number {
  if (value === undefined || value === null) return DEFAULT_MAX_EVIDENCE_AGE_MS;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Evidence state model maxEvidenceAgeMs must be a non-negative number.');
  }
  return value;
}

function stateCounts(
  states: readonly EvidenceStateAssignment[],
): Readonly<Record<EvidenceStateKind, number>> {
  const counts = Object.fromEntries(
    EVIDENCE_STATE_KINDS.map((state) => [state, 0]),
  ) as Record<EvidenceStateKind, number>;
  for (const assignment of states) {
    counts[assignment.state] += 1;
  }
  return Object.freeze(counts);
}

function aggregateStateCounts(
  surfaces: readonly EvidenceStateModelSurface[],
): Readonly<Record<EvidenceStateKind, number>> {
  const counts = Object.fromEntries(
    EVIDENCE_STATE_KINDS.map((state) => [state, 0]),
  ) as Record<EvidenceStateKind, number>;
  for (const surface of surfaces) {
    for (const state of EVIDENCE_STATE_KINDS) {
      counts[state] += surface.stateCounts[state];
    }
  }
  return Object.freeze(counts);
}

function assignment(input: {
  readonly field: EvidenceStateField;
  readonly state: EvidenceStateKind;
  readonly source: EvidenceStateSource;
  readonly observedCount?: number;
  readonly inferredCount?: number;
  readonly refCount?: number;
  readonly reasonCodes: readonly string[];
}): EvidenceStateAssignment {
  return Object.freeze({
    field: input.field,
    state: input.state,
    source: input.source,
    observedCount: input.observedCount ?? 0,
    inferredCount: input.inferredCount ?? 0,
    refCount: input.refCount ?? 0,
    reasonCodes: Object.freeze([...input.reasonCodes].sort()),
    rawPayloadStored: false as const,
  });
}

function nextStepFor(field: EvidenceStateField, graphNextStep: string): string {
  switch (field) {
    case 'shadow-observation':
      return 'add-shadow-capture';
    case 'target-system-shadow':
      return 'add-target-system-shadow-capture';
    case 'integration-declaration':
      return 'add-integration-declaration';
    case 'policy-ref':
      return 'bind-policy';
    case 'evidence-ref':
      return 'bind-evidence';
    case 'approval-ref':
      return 'route-for-review';
    case 'receipt-ref':
      return 'collect-receipt';
    case 'resource-ref':
      return 'bind-resource';
    case 'consequence-class':
      return 'confirm-consequence-class';
    case 'producer-trust':
      return 'approve-or-replace-producer';
    case 'freshness':
      return 'refresh-shadow-evidence';
    case 'enforceability':
      return 'keep-shadow-or-submit-approval';
    default:
      return graphNextStep;
  }
}

function isBlockingState(state: EvidenceStateKind): state is EvidenceStateBlockingKind {
  return (EVIDENCE_STATE_BLOCKING_KINDS as readonly EvidenceStateKind[]).includes(state);
}

function blockersFor(
  states: readonly EvidenceStateAssignment[],
  graphNextStep: string,
): readonly EvidenceStateBlocker[] {
  return Object.freeze(
    states
      .filter((state) => isBlockingState(state.state))
      .map((state) => Object.freeze({
        field: state.field,
        state: state.state as EvidenceStateBlockingKind,
        reasonCodes: state.reasonCodes,
        nextStep: nextStepFor(state.field, graphNextStep),
      }))
      .sort((left, right) =>
        left.field.localeCompare(right.field) ||
        left.state.localeCompare(right.state)
      ),
  );
}

function coverageRefState(input: {
  readonly field: EvidenceStateField;
  readonly count: number;
  readonly presentCode: string;
  readonly missingCode: string;
}): EvidenceStateAssignment {
  return assignment({
    field: input.field,
    state: input.count > 0 ? 'observed' : 'missing',
    source: input.count > 0
      ? 'action-surface-graph-route-coverage'
      : 'action-surface-graph-gap',
    observedCount: input.count,
    refCount: input.count,
    reasonCodes: [input.count > 0 ? input.presentCode : input.missingCode],
  });
}

function observationState(coverage: ActionSurfaceGraphRouteCoverage): EvidenceStateAssignment {
  const count =
    coverage.admissionShadowEventCount +
    coverage.targetSystemShadowEventCount +
    coverage.cryptoExecutionAdmissionEventCount;
  return assignment({
    field: 'shadow-observation',
    state: count > 0 ? 'observed' : 'missing',
    source: count > 0
      ? 'action-surface-graph-route-coverage'
      : 'action-surface-graph-gap',
    observedCount: count,
    refCount: count,
    reasonCodes: [count > 0 ? 'shadow-observation-present' : 'shadow-observation-missing'],
  });
}

function targetSystemShadowState(
  coverage: ActionSurfaceGraphRouteCoverage,
): EvidenceStateAssignment {
  const count = coverage.targetSystemShadowEventCount +
    coverage.cryptoExecutionAdmissionEventCount;
  return assignment({
    field: 'target-system-shadow',
    state: count > 0 ? 'observed' : 'missing',
    source: count > 0
      ? 'action-surface-graph-route-coverage'
      : 'action-surface-graph-gap',
    observedCount: count,
    refCount: count,
    reasonCodes: [count > 0
      ? 'target-system-shadow-present'
      : 'target-system-shadow-missing'],
  });
}

function consequenceClassState(surface: ActionSurfaceGraphSurface): EvidenceStateAssignment {
  const observedCount = surface.consequenceClassOriginCounts.observed;
  const inferredCount = surface.consequenceClassOriginCounts.inferred;
  const reasonCodes: string[] = [];
  let state: EvidenceStateKind = 'missing';
  if (
    observedCount > 0 &&
    inferredCount > 0 &&
    surface.consequenceClasses.length > 1
  ) {
    state = 'conflicting';
    reasonCodes.push('consequence-class-conflict');
  } else if (observedCount > 0) {
    state = 'observed';
    reasonCodes.push('consequence-class-observed');
  } else if (inferredCount > 0) {
    state = 'inferred';
    reasonCodes.push('consequence-class-inferred-only');
  } else {
    reasonCodes.push('consequence-class-missing');
  }

  return assignment({
    field: 'consequence-class',
    state,
    source: state === 'observed'
      ? 'action-surface-graph-route-coverage'
      : 'action-surface-graph-gap',
    observedCount,
    inferredCount,
    refCount: surface.consequenceClasses.length,
    reasonCodes,
  });
}

function producerTrustState(
  surface: ActionSurfaceGraphSurface,
  trustedProducers: ReadonlySet<string>,
): EvidenceStateAssignment {
  if (trustedProducers.size === 0) {
    return assignment({
      field: 'producer-trust',
      state: surface.producers.length > 0 ? 'observed' : 'missing',
      source: 'producer-trust-input',
      observedCount: surface.producers.length,
      refCount: surface.producers.length,
      reasonCodes: [
        surface.producers.length > 0
          ? 'producer-observed-trust-not-declared'
          : 'producer-missing',
      ],
    });
  }
  if (surface.producers.length === 0) {
    return assignment({
      field: 'producer-trust',
      state: 'missing',
      source: 'producer-trust-input',
      reasonCodes: ['producer-missing'],
    });
  }
  const untrusted = surface.producers.filter((producer) => !trustedProducers.has(producer));
  return assignment({
    field: 'producer-trust',
    state: untrusted.length === 0 ? 'approved' : 'untrusted',
    source: 'producer-trust-input',
    observedCount: surface.producers.length,
    refCount: surface.producers.length,
    reasonCodes: [
      untrusted.length === 0
        ? 'all-producers-approved'
        : 'untrusted-producer-present',
    ],
  });
}

function freshnessState(input: {
  readonly surface: ActionSurfaceGraphSurface;
  readonly generatedAt: string;
  readonly maxEvidenceAgeMs: number;
}): EvidenceStateAssignment {
  if (input.surface.lastSeenAt === null) {
    return assignment({
      field: 'freshness',
      state: 'missing',
      source: 'freshness-policy',
      reasonCodes: ['last-seen-at-missing'],
    });
  }
  const generatedAtMs = Date.parse(input.generatedAt);
  const lastSeenAtMs = Date.parse(input.surface.lastSeenAt);
  const ageMs = Math.max(0, generatedAtMs - lastSeenAtMs);
  const stale = ageMs > input.maxEvidenceAgeMs;
  return assignment({
    field: 'freshness',
    state: stale ? 'stale' : 'observed',
    source: 'freshness-policy',
    observedCount: input.surface.eventCount,
    refCount: input.surface.eventDigests.length,
    reasonCodes: [stale ? 'evidence-stale' : 'evidence-fresh'],
  });
}

function approvalState(
  surface: ActionSurfaceGraphSurface,
  approvedSurfaceIds: ReadonlySet<string>,
): EvidenceStateAssignment {
  if (approvedSurfaceIds.has(surface.surfaceId)) {
    return assignment({
      field: 'approval-ref',
      state: 'approved',
      source: 'operator-approval-input',
      observedCount: surface.routeCoverage.approvalRefCount,
      refCount: surface.routeCoverage.approvalRefCount,
      reasonCodes: ['surface-approved-for-promotion'],
    });
  }
  return coverageRefState({
    field: 'approval-ref',
    count: surface.routeCoverage.approvalRefCount,
    presentCode: 'approval-ref-observed',
    missingCode: 'approval-ref-missing',
  });
}

function enforceabilityState(input: {
  readonly surface: ActionSurfaceGraphSurface;
  readonly statesBeforeEnforceability: readonly EvidenceStateAssignment[];
  readonly enforceableSurfaceIds: ReadonlySet<string>;
  readonly approvedSurfaceIds: ReadonlySet<string>;
}): EvidenceStateAssignment {
  const requested = input.enforceableSurfaceIds.has(input.surface.surfaceId);
  const blockingBefore = input.statesBeforeEnforceability.some((state) =>
    isBlockingState(state.state),
  );
  const approved = input.approvedSurfaceIds.has(input.surface.surfaceId);
  if (requested && approved && !blockingBefore) {
    return assignment({
      field: 'enforceability',
      state: 'enforceable',
      source: 'enforceability-input',
      observedCount: input.surface.eventCount,
      refCount: input.surface.eventDigests.length,
      reasonCodes: ['surface-explicitly-marked-enforceable'],
    });
  }
  return assignment({
    field: 'enforceability',
    state: requested && blockingBefore ? 'conflicting' : 'missing',
    source: 'enforceability-input',
    observedCount: input.surface.eventCount,
    refCount: input.surface.eventDigests.length,
    reasonCodes: [
      requested && blockingBefore
        ? 'enforceability-request-conflicts-with-blockers'
        : requested && !approved
          ? 'enforceability-request-missing-approval'
          : 'enforceability-not-declared',
    ],
  });
}

function createSurfaceState(input: {
  readonly surface: ActionSurfaceGraphSurface;
  readonly graphTenantRefDigest: string;
  readonly generatedAt: string;
  readonly maxEvidenceAgeMs: number;
  readonly trustedProducers: ReadonlySet<string>;
  readonly approvedSurfaceIds: ReadonlySet<string>;
  readonly enforceableSurfaceIds: ReadonlySet<string>;
}): EvidenceStateModelSurface {
  const { surface } = input;
  if (surface.tenantRefDigest !== input.graphTenantRefDigest) {
    throw new Error('Evidence state model surface tenantRefDigest must match graph tenantRefDigest.');
  }
  const coverage = surface.routeCoverage;
  const statesBeforeEnforceability = Object.freeze([
    observationState(coverage),
    targetSystemShadowState(coverage),
    coverageRefState({
      field: 'integration-declaration',
      count: coverage.integrationDeclarationEventCount,
      presentCode: 'integration-declaration-present',
      missingCode: 'integration-declaration-missing',
    }),
    coverageRefState({
      field: 'policy-ref',
      count: coverage.policyRefCount,
      presentCode: 'policy-ref-observed',
      missingCode: 'policy-ref-missing',
    }),
    coverageRefState({
      field: 'evidence-ref',
      count: coverage.evidenceRefCount,
      presentCode: 'evidence-ref-observed',
      missingCode: 'evidence-ref-missing',
    }),
    approvalState(surface, input.approvedSurfaceIds),
    coverageRefState({
      field: 'receipt-ref',
      count: coverage.receiptRefCount,
      presentCode: 'receipt-ref-observed',
      missingCode: 'receipt-ref-missing',
    }),
    coverageRefState({
      field: 'resource-ref',
      count: coverage.resourceRefCount,
      presentCode: 'resource-ref-observed',
      missingCode: 'resource-ref-missing',
    }),
    consequenceClassState(surface),
    producerTrustState(surface, input.trustedProducers),
    freshnessState({
      surface,
      generatedAt: input.generatedAt,
      maxEvidenceAgeMs: input.maxEvidenceAgeMs,
    }),
  ]);
  const enforceability = enforceabilityState({
    surface,
    statesBeforeEnforceability,
    enforceableSurfaceIds: input.enforceableSurfaceIds,
    approvedSurfaceIds: input.approvedSurfaceIds,
  });
  const states = Object.freeze([...statesBeforeEnforceability, enforceability]);
  const counts = stateCounts(states);
  const blockers = blockersFor(states, surface.nextStep);
  const readyForPolicyCandidate =
    !states.some((state) =>
      state.field !== 'enforceability' &&
      isBlockingState(state.state)
    );
  const readyForEnforcement = enforceability.state === 'enforceable' && blockers.length === 0;
  const payload = {
    surfaceId: surface.surfaceId,
    actionSurface: surface.actionSurface,
    tenantRefDigest: surface.tenantRefDigest,
    coverageStatus: surface.coverageStatus,
    graphNextStep: surface.nextStep,
    states,
    stateCounts: counts,
    promotionBlockers: blockers,
    blockingStates: Object.freeze([...new Set(blockers.map((blocker) => blocker.state))].sort()),
    readyForPolicyCandidate,
    readyForEnforcement,
    rawPayloadStored: false as const,
    autoEnforce: false as const,
    approvalRequiredForPromotion: true as const,
  };
  return Object.freeze({
    ...payload,
    digest: hashCanonical(payload as unknown as CanonicalReleaseJsonValue),
  });
}

export function createEvidenceStateModel(
  input: CreateEvidenceStateModelInput,
): EvidenceStateModel {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.graph.generatedAt,
    'generatedAt',
  );
  const maxEvidenceAgeMs = normalizeMaxEvidenceAge(input.maxEvidenceAgeMs);
  const trustedProducers = normalizeStringSet(input.trustedProducers);
  const approvedSurfaceIds = normalizeStringSet(input.approvedSurfaceIds);
  const enforceableSurfaceIds = normalizeStringSet(input.enforceableSurfaceIds);
  const surfaces = Object.freeze(
    input.graph.surfaces
      .map((surface) =>
        createSurfaceState({
          surface,
          graphTenantRefDigest: input.graph.tenantRefDigest,
          generatedAt,
          maxEvidenceAgeMs,
          trustedProducers,
          approvedSurfaceIds,
          enforceableSurfaceIds,
        }),
      )
      .sort((left, right) =>
        left.actionSurface.localeCompare(right.actionSurface) ||
        left.surfaceId.localeCompare(right.surfaceId)
      ),
  );
  const payload = {
    version: EVIDENCE_STATE_MODEL_VERSION as typeof EVIDENCE_STATE_MODEL_VERSION,
    generatedAt,
    graphDigest: input.graph.digest,
    graphVersion: input.graph.version,
    tenantRefDigest: input.graph.tenantRefDigest,
    surfaceCount: surfaces.length,
    readyForPolicyCandidateCount: surfaces.filter((surface) =>
      surface.readyForPolicyCandidate
    ).length,
    readyForEnforcementCount: surfaces.filter((surface) =>
      surface.readyForEnforcement
    ).length,
    blockedSurfaceCount: surfaces.filter((surface) =>
      surface.promotionBlockers.length > 0
    ).length,
    stateCounts: aggregateStateCounts(surfaces),
    surfaces,
    tenantBound: true as const,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    outputIsDecisionSupportOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function evidenceStateModelDescriptor(): EvidenceStateModelDescriptor {
  return Object.freeze({
    version: EVIDENCE_STATE_MODEL_VERSION,
    stateKinds: EVIDENCE_STATE_KINDS,
    fields: EVIDENCE_STATE_FIELDS,
    sources: EVIDENCE_STATE_SOURCES,
    blockingKinds: EVIDENCE_STATE_BLOCKING_KINDS,
    tenantBound: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  });
}
