import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceIntegrationKitArtifactEntry,
  ActionSurfaceIntegrationKitNoBypassProbeCase,
  ActionSurfaceIntegrationKitPacket,
  ActionSurfaceIntegrationKitProbeKind,
} from './action-surface-integration-kit-packet.js';
import type {
  AttestorIntegrationMode,
} from './integration-mode-readiness.js';

export const ACTION_SURFACE_INTEGRATION_KIT_NO_BYPASS_PROBE_BUNDLE_VERSION =
  'attestor.action-surface-integration-kit-no-bypass-probe-bundle.v1';

export const ACTION_SURFACE_INTEGRATION_KIT_PROBE_METHODS = [
  'black-box-direct-call-deny',
  'replay-or-stale-presentation-deny',
  'scope-narrowing-deny',
  'held-decision-deny',
  'verifier-outage-fail-closed',
  'observe-mode-record-only',
] as const;
export type ActionSurfaceIntegrationKitProbeMethod =
  typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_METHODS[number];

export const ACTION_SURFACE_INTEGRATION_KIT_PROBE_TARGET_BOUNDARIES = [
  'customer-sdk-protected-adapter',
  'customer-gateway-or-sidecar-pep',
  'customer-owned-mcp-tool-gateway',
  'provider-native-customer-delegation',
  'shadow-or-advisory-observation-only',
] as const;
export type ActionSurfaceIntegrationKitProbeTargetBoundary =
  typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_TARGET_BOUNDARIES[number];

export const ACTION_SURFACE_INTEGRATION_KIT_PROBE_EVIDENCE_FIELDS = [
  'packet-digest',
  'probe-plan-digest',
  'artifact-digest',
  'request-digest',
  'attestor-presentation-digest',
  'customer-stop-point-decision-digest',
  'downstream-receipt-or-denial-digest',
  'operator-review-record-digest',
] as const;
export type ActionSurfaceIntegrationKitProbeEvidenceField =
  typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_EVIDENCE_FIELDS[number];

export interface CreateActionSurfaceIntegrationKitNoBypassProbeBundleInput {
  readonly kit: ActionSurfaceIntegrationKitPacket;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceIntegrationKitNoBypassProbeBundleCase {
  readonly probeId: string;
  readonly kind: ActionSurfaceIntegrationKitProbeKind;
  readonly actionSurface: string;
  readonly mode: AttestorIntegrationMode;
  readonly targetBoundary: ActionSurfaceIntegrationKitProbeTargetBoundary;
  readonly probeMethod: ActionSurfaceIntegrationKitProbeMethod;
  readonly expectedResult:
    ActionSurfaceIntegrationKitNoBypassProbeCase['expectedResult'];
  readonly passCondition: string;
  readonly sourceProbePlanDigest: string;
  readonly sourceArtifactDigests: readonly string[];
  readonly routeOrToolRefs: readonly string[];
  readonly requiredEvidence: readonly ActionSurfaceIntegrationKitProbeEvidenceField[];
  readonly resultStatus: 'not-run';
  readonly customerOwnedExecutionRequired: true;
  readonly requiresCustomerStopPoint: true;
  readonly safeToAutoRun: false;
  readonly executesProbe: false;
  readonly proofResultRecorded: false;
  readonly authority: 'probe-definition-only';
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableClaimAllowed: false;
}

export interface ActionSurfaceIntegrationKitNoBypassProbeBundle {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_NO_BYPASS_PROBE_BUNDLE_VERSION;
  readonly generatedAt: string;
  readonly sourceKitDigest: string;
  readonly sourceProbePlanDigest: string;
  readonly liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS';
  readonly surfaceCount: number;
  readonly probeCaseCount: number;
  readonly modes: readonly AttestorIntegrationMode[];
  readonly probeCases:
    readonly ActionSurfaceIntegrationKitNoBypassProbeBundleCase[];
  readonly reviewChecklist: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProbes: false;
  readonly proofResultRecorded: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitNoBypassProbeBundleDescriptor {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_NO_BYPASS_PROBE_BUNDLE_VERSION;
  readonly probeMethods: typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_METHODS;
  readonly targetBoundaries:
    typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_TARGET_BOUNDARIES;
  readonly evidenceFields:
    typeof ACTION_SURFACE_INTEGRATION_KIT_PROBE_EVIDENCE_FIELDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly executesProbes: false;
  readonly nonBypassableClaimAllowed: false;
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

function withCanonical<T extends object>(
  body: T,
): T & {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Action surface integration kit no-bypass probe bundle ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function targetBoundaryForMode(
  mode: AttestorIntegrationMode,
): ActionSurfaceIntegrationKitProbeTargetBoundary {
  switch (mode) {
    case 'sdk-gate':
      return 'customer-sdk-protected-adapter';
    case 'gateway-proxy':
    case 'sidecar-ext-authz':
      return 'customer-gateway-or-sidecar-pep';
    case 'mcp-tool-gateway':
      return 'customer-owned-mcp-tool-gateway';
    case 'provider-native-connector':
      return 'provider-native-customer-delegation';
    case 'advisory-api':
    case 'shadow-capture-sdk':
      return 'shadow-or-advisory-observation-only';
  }
}

function probeMethodForKind(
  kind: ActionSurfaceIntegrationKitProbeKind,
): ActionSurfaceIntegrationKitProbeMethod {
  switch (kind) {
    case 'direct-downstream-without-attestor-presentation':
      return 'black-box-direct-call-deny';
    case 'stale-or-replayed-presentation':
      return 'replay-or-stale-presentation-deny';
    case 'narrow-decision-with-original-wide-request':
      return 'scope-narrowing-deny';
    case 'review-or-block-reaches-downstream-execution':
      return 'held-decision-deny';
    case 'verifier-unavailable-in-enforcement-mode':
      return 'verifier-outage-fail-closed';
    case 'observe-mode-would-block-recorded-only':
      return 'observe-mode-record-only';
  }
}

function passConditionForKind(kind: ActionSurfaceIntegrationKitProbeKind): string {
  switch (kind) {
    case 'direct-downstream-without-attestor-presentation':
      return 'A request without an Attestor presentation is denied at the customer stop point.';
    case 'stale-or-replayed-presentation':
      return 'A stale or replayed presentation is denied before downstream execution.';
    case 'narrow-decision-with-original-wide-request':
      return 'A narrowed decision cannot execute the original wider request.';
    case 'review-or-block-reaches-downstream-execution':
      return 'A review or block decision does not reach downstream execution.';
    case 'verifier-unavailable-in-enforcement-mode':
      return 'Verifier outage fails closed or enters a bounded degraded hold state.';
    case 'observe-mode-would-block-recorded-only':
      return 'Observe-mode would-block traffic is recorded only and does not activate enforcement.';
  }
}

function artifactsBySurface(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): ReadonlyMap<string, readonly ActionSurfaceIntegrationKitArtifactEntry[]> {
  const grouped = new Map<string, ActionSurfaceIntegrationKitArtifactEntry[]>();
  for (const artifact of artifacts) {
    const current = grouped.get(artifact.actionSurface) ?? [];
    current.push(artifact);
    grouped.set(artifact.actionSurface, current);
  }
  return new Map(
    [...grouped.entries()].map(([surface, entries]) => [
      surface,
      Object.freeze([...entries].sort((left, right) =>
        left.artifactId.localeCompare(right.artifactId)
      )),
    ]),
  );
}

function operationRefsForMode(input: {
  readonly mode: AttestorIntegrationMode;
  readonly artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[];
}): readonly string[] {
  const refs = new Set<string>();
  for (const artifact of input.artifacts) {
    for (const ref of artifact.operationRefs) {
      if (input.mode === 'mcp-tool-gateway' && ref.startsWith('tool:')) {
        refs.add(ref);
        continue;
      }
      if (input.mode !== 'mcp-tool-gateway' && !ref.startsWith('tool:')) {
        refs.add(ref);
      }
    }
  }
  return Object.freeze([...refs].sort());
}

function artifactDigests(
  artifacts: readonly ActionSurfaceIntegrationKitArtifactEntry[],
): readonly string[] {
  return Object.freeze(
    [...new Set(artifacts.map((artifact) => artifact.digest))].sort(),
  );
}

function requiredEvidenceForKind(
  kind: ActionSurfaceIntegrationKitProbeKind,
): readonly ActionSurfaceIntegrationKitProbeEvidenceField[] {
  const common: ActionSurfaceIntegrationKitProbeEvidenceField[] = [
    'packet-digest',
    'probe-plan-digest',
    'artifact-digest',
    'request-digest',
    'customer-stop-point-decision-digest',
    'operator-review-record-digest',
  ];
  if (kind === 'direct-downstream-without-attestor-presentation') {
    return Object.freeze(common);
  }
  return Object.freeze([
    ...common,
    'attestor-presentation-digest',
    'downstream-receipt-or-denial-digest',
  ]);
}

function createProbeCases(
  kit: ActionSurfaceIntegrationKitPacket,
): readonly ActionSurfaceIntegrationKitNoBypassProbeBundleCase[] {
  const artifacts = artifactsBySurface(kit.artifactManifest.artifacts);
  return Object.freeze(
    kit.noBypassProbePlan.probeCases.map((probe) => {
      const surfaceArtifacts = artifacts.get(probe.actionSurface) ?? [];
      return Object.freeze({
        probeId: probe.probeId,
        kind: probe.kind,
        actionSurface: probe.actionSurface,
        mode: probe.mode,
        targetBoundary: targetBoundaryForMode(probe.mode),
        probeMethod: probeMethodForKind(probe.kind),
        expectedResult: probe.expectedResult,
        passCondition: passConditionForKind(probe.kind),
        sourceProbePlanDigest: kit.noBypassProbePlan.digest,
        sourceArtifactDigests: artifactDigests(surfaceArtifacts),
        routeOrToolRefs: operationRefsForMode({
          mode: probe.mode,
          artifacts: surfaceArtifacts,
        }),
        requiredEvidence: requiredEvidenceForKind(probe.kind),
        resultStatus: 'not-run' as const,
        customerOwnedExecutionRequired: true as const,
        requiresCustomerStopPoint: true as const,
        safeToAutoRun: false as const,
        executesProbe: false as const,
        proofResultRecorded: false as const,
        authority: 'probe-definition-only' as const,
        rawPayloadStored: false as const,
        productionReady: false as const,
        nonBypassableClaimAllowed: false as const,
      });
    }).sort((left, right) =>
      left.actionSurface.localeCompare(right.actionSurface) ||
      left.probeId.localeCompare(right.probeId)
    ),
  );
}

function reviewChecklist(): readonly string[] {
  return Object.freeze([
    'Confirm the customer stop point covers each listed route or tool.',
    'Confirm direct downstream paths cannot use agent-held credentials.',
    'Run probes only in a customer-approved sandbox or live-like stop point.',
    'Bind probe results back to packet, probe-plan, and artifact digests.',
    'Do not claim no-bypass until LP-CUSTOMER-PEP-NO-BYPASS evidence exists.',
  ]);
}

export function createActionSurfaceIntegrationKitNoBypassProbeBundle(
  input: CreateActionSurfaceIntegrationKitNoBypassProbeBundleInput,
): ActionSurfaceIntegrationKitNoBypassProbeBundle {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.kit.generatedAt,
    'generatedAt',
  );
  const probeCases = createProbeCases(input.kit);
  const modes = Object.freeze([
    ...new Set(probeCases.map((probe) => probe.mode)),
  ].sort());
  const body = {
    version: ACTION_SURFACE_INTEGRATION_KIT_NO_BYPASS_PROBE_BUNDLE_VERSION,
    generatedAt,
    sourceKitDigest: input.kit.digest,
    sourceProbePlanDigest: input.kit.noBypassProbePlan.digest,
    liveProofRegisterRef: input.kit.noBypassProbePlan.liveProofRegisterRef,
    surfaceCount: new Set(probeCases.map((probe) => probe.actionSurface)).size,
    probeCaseCount: probeCases.length,
    modes,
    probeCases,
    reviewChecklist: reviewChecklist(),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProbes: false,
    proofResultRecorded: false,
    nonBypassableClaimAllowed: false,
    limitations: Object.freeze([
      'This bundle defines probes; it does not run them.',
      'Probe execution must happen at a reviewed customer-owned stop point.',
      'No-bypass remains unproven until signed customer probe evidence exists.',
    ]),
  } as const;
  return withCanonical(body);
}

export function actionSurfaceIntegrationKitNoBypassProbeBundleDescriptor():
  ActionSurfaceIntegrationKitNoBypassProbeBundleDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_INTEGRATION_KIT_NO_BYPASS_PROBE_BUNDLE_VERSION,
    probeMethods: ACTION_SURFACE_INTEGRATION_KIT_PROBE_METHODS,
    targetBoundaries: ACTION_SURFACE_INTEGRATION_KIT_PROBE_TARGET_BOUNDARIES,
    evidenceFields: ACTION_SURFACE_INTEGRATION_KIT_PROBE_EVIDENCE_FIELDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    executesProbes: false,
    nonBypassableClaimAllowed: false,
  });
}
