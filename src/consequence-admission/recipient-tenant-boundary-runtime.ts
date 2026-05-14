import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES,
  CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS,
  CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES,
  CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION,
  CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES,
  evaluateConsequenceRecipientTenantBoundaryReplay,
  type ConsequenceRecipientTenantBoundaryDataClass,
  type ConsequenceRecipientTenantBoundaryFailureModeId,
  type ConsequenceRecipientTenantBoundaryKind,
  type ConsequenceRecipientTenantBoundaryOutcome,
  type ConsequenceRecipientTenantBoundaryReasonCode,
  type ConsequenceRecipientTenantBoundarySurface,
} from './recipient-tenant-boundary-replay.js';

export const CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION =
  'attestor.consequence-recipient-tenant-boundary-runtime.v1';

export interface EvaluateConsequenceRecipientTenantRuntimeBoundaryInput {
  readonly generatedAt?: string | null;
  readonly surface: ConsequenceRecipientTenantBoundarySurface;
  readonly boundaryKinds?: readonly ConsequenceRecipientTenantBoundaryKind[] | null;
  readonly currentTenantId?: string | null;
  readonly recordTenantIds?: readonly (string | null | undefined)[] | null;
  readonly targetRecipientId?: string | null;
  readonly approvedRecipientIds?: readonly string[] | null;
  readonly contentDataClass?: ConsequenceRecipientTenantBoundaryDataClass | null;
  readonly allowedRecipientDataClasses?:
    readonly ConsequenceRecipientTenantBoundaryDataClass[] | null;
  readonly communicationContext?: string | null;
  readonly redactionPolicyPassed?: boolean | null;
  readonly rawRecipientExposed?: boolean | null;
  readonly rawPayloadStored?: boolean | null;
  readonly runtimeSurfaceRef?: string | null;
}

export interface ConsequenceRecipientTenantRuntimeBoundaryDecision {
  readonly version: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION;
  readonly replayVersion: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION;
  readonly generatedAt: string;
  readonly surface: ConsequenceRecipientTenantBoundarySurface;
  readonly boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[];
  readonly outcome: ConsequenceRecipientTenantBoundaryOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceRecipientTenantBoundaryReasonCode[];
  readonly failureModeIds: readonly ConsequenceRecipientTenantBoundaryFailureModeId[];
  readonly invariantIds: readonly string[];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly observed: {
    readonly currentTenantDigest: string | null;
    readonly recordTenantDigests: readonly string[];
    readonly foreignRecordTenantDigests: readonly string[];
    readonly missingRecordTenantCount: number;
    readonly targetRecipientDigest: string | null;
    readonly approvedRecipientScopeDigest: string | null;
    readonly contentDataClass: ConsequenceRecipientTenantBoundaryDataClass | null;
    readonly allowedRecipientDataClasses: readonly ConsequenceRecipientTenantBoundaryDataClass[];
    readonly communicationContextDigest: string | null;
    readonly redactionPolicyPassed: boolean | null;
    readonly rawRecipientExposed: boolean;
    readonly rawPayloadStored: boolean;
    readonly runtimeSurfaceRefDigest: string | null;
  };
  readonly replayDigest: string;
  readonly runtimeBridge: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly customerIntegrationRequired: true;
  readonly syntheticOnly: false;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly digestOnly: true;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceRecipientTenantRuntimeBoundaryDescriptor {
  readonly version: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION;
  readonly replayVersion: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION;
  readonly boundaryKinds: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS;
  readonly surfaces: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES;
  readonly dataClasses: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES;
  readonly outcomes: typeof CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES;
  readonly failureModeIds: readonly [
    'cross-tenant-leakage',
    'wrong-recipient-disclosure',
    'sensitive-data-disclosure',
  ];
  readonly rendersRuntimeDecision: true;
  readonly runtimeBridge: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly customerIntegrationRequired: true;
  readonly syntheticOnly: false;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly digestOnly: true;
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

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function runtimeBoundaryKinds(
  boundaryKinds: readonly ConsequenceRecipientTenantBoundaryKind[] | null | undefined,
): readonly ConsequenceRecipientTenantBoundaryKind[] {
  if (boundaryKinds && boundaryKinds.length > 0) return Object.freeze([...boundaryKinds]);
  return CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS;
}

export function evaluateConsequenceRecipientTenantRuntimeBoundary(
  input: EvaluateConsequenceRecipientTenantRuntimeBoundaryInput,
): ConsequenceRecipientTenantRuntimeBoundaryDecision {
  const generatedAt = new Date(input.generatedAt ?? new Date(0).toISOString()).toISOString();
  const runtimeSurfaceRef = input.runtimeSurfaceRef?.trim() || null;
  const replay = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt,
    cases: [
      {
        caseId: runtimeSurfaceRef ?? `${input.surface}:runtime-boundary`,
        surface: input.surface,
        boundaryKinds: runtimeBoundaryKinds(input.boundaryKinds),
        expectedOutcome: 'pass',
        currentTenantId: input.currentTenantId,
        recordTenantIds: input.recordTenantIds,
        targetRecipientId: input.targetRecipientId,
        approvedRecipientIds: input.approvedRecipientIds,
        contentDataClass: input.contentDataClass,
        allowedRecipientDataClasses: input.allowedRecipientDataClasses,
        communicationContext: input.communicationContext,
        redactionPolicyPassed: input.redactionPolicyPassed,
        rawRecipientExposed: input.rawRecipientExposed,
        rawPayloadStored: input.rawPayloadStored,
      },
    ],
  });
  const result = replay.results[0];
  if (!result) {
    throw new Error('Recipient/tenant runtime boundary replay produced no result.');
  }
  const runtimeReasonCodes = Object.freeze(result.reasonCodes.filter((reason) =>
    reason !== 'expected-boundary-decision-mismatch'
  ));
  const payload = {
    version: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION,
    replayVersion: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION,
    generatedAt,
    surface: input.surface,
    boundaryKinds: result.boundaryKinds,
    outcome: result.outcome,
    allowed: result.outcome === 'pass',
    failClosed: result.outcome !== 'pass',
    reasonCodes: runtimeReasonCodes,
    failureModeIds: result.failureModeIds,
    invariantIds: result.invariantIds,
    requiredControls: result.requiredControls,
    requiredEvidence: result.requiredEvidence,
    requiredAuthoritySources: result.requiredAuthoritySources,
    requiredAuditRecords: result.requiredAuditRecords,
    observed: {
      ...result.observed,
      runtimeSurfaceRefDigest: runtimeSurfaceRef ? digestText(runtimeSurfaceRef) : null,
    },
    replayDigest: replay.digest,
    runtimeBridge: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    customerIntegrationRequired: true,
    syntheticOnly: false,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    digestOnly: true,
    limitation:
      'This runtime bridge renders a fail-closed tenant, recipient, and redaction decision from supplied runtime metadata. It does not prove every route, downstream sender, dashboard, export, or review packet has integrated or enforced the decision.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceRecipientTenantRuntimeBoundaryDescriptor(): ConsequenceRecipientTenantRuntimeBoundaryDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_RUNTIME_VERSION,
    replayVersion: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_REPLAY_VERSION,
    boundaryKinds: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_KINDS,
    surfaces: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_SURFACES,
    dataClasses: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_DATA_CLASSES,
    outcomes: CONSEQUENCE_RECIPIENT_TENANT_BOUNDARY_OUTCOMES,
    failureModeIds: [
      'cross-tenant-leakage',
      'wrong-recipient-disclosure',
      'sensitive-data-disclosure',
    ] as const,
    rendersRuntimeDecision: true,
    runtimeBridge: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    customerIntegrationRequired: true,
    syntheticOnly: false,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    digestOnly: true,
  });
}
