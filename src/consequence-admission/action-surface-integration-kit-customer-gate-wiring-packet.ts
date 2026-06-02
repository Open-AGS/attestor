import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  type ActionSurfaceIntegrationKitArtifactEntry,
  type ActionSurfaceIntegrationKitPacket,
} from './action-surface-integration-kit-packet.js';
import type {
  ActionSurfaceIntegrationKitProbeTargetBoundary,
} from './action-surface-integration-kit-no-bypass-probe-bundle.js';
import {
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_RELEASE_ENFORCEMENT_VERSION,
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
} from './customer-gate.js';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
  type ConsequenceAdmissionDownstreamBoundaryKind,
} from './downstream-enforcement-contract.js';
import {
  CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS,
  CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
  type CustomerPepAdoptionPackageEvidenceKind,
} from './customer-pep-adoption-package.js';
import {
  CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
  CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS,
  type CustomerPepRuntimeEvidenceKind,
  type CustomerPepRuntimeKind,
} from './customer-pep-runtime-adoption.js';
import type {
  AttestorIntegrationMode,
} from './integration-mode-readiness.js';

export const ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PACKET_VERSION =
  'attestor.action-surface-integration-kit-customer-gate-wiring-packet.v1';

export const ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_STATUSES = [
  'no-surfaces',
  'review-required',
] as const;
export type ActionSurfaceIntegrationKitCustomerGateWiringStatus =
  typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_STATUSES[number];

export const ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PLAN_STATUSES = [
  'observe-only-not-enforcement',
  'customer-gate-review-required',
] as const;
export type ActionSurfaceIntegrationKitCustomerGateWiringPlanStatus =
  typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PLAN_STATUSES[number];

export const ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_EVIDENCE_FIELDS = [
  'source-kit-digest',
  'source-packet-digest',
  'surface-readiness-digest',
  'artifact-digest',
  'route-or-tool-ref',
  'downstream-contract-review',
  'customer-pep-runtime-adoption-proof',
  'protected-admission-e2e-proof-plan',
  'no-bypass-probe-result',
  'customer-approval-record',
  'activation-handoff-record',
  'downstream-receipt-or-denial-digest',
] as const;
export type ActionSurfaceIntegrationKitCustomerGateWiringEvidenceField =
  typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_EVIDENCE_FIELDS[number];

export interface CreateActionSurfaceIntegrationKitCustomerGateWiringPacketInput {
  readonly kit: ActionSurfaceIntegrationKitPacket;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceIntegrationKitCustomerGateWiringEvidenceBinding {
  readonly sourceKitDigest: string;
  readonly sourcePacketDigest: string;
  readonly sourceArtifactDigests: readonly string[];
  readonly surfaceReadinessDigest: string | null;
  readonly liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS';
  readonly generatedPacketMayCloseLiveProof: false;
}

export interface ActionSurfaceIntegrationKitCustomerGateWiringPlan {
  readonly wiringId: string;
  readonly actionSurface: string;
  readonly mode: AttestorIntegrationMode;
  readonly planStatus: ActionSurfaceIntegrationKitCustomerGateWiringPlanStatus;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly targetBoundary: ActionSurfaceIntegrationKitProbeTargetBoundary;
  readonly recommendedGatePlacement: string;
  readonly runtimeKind: CustomerPepRuntimeKind;
  readonly downstreamBoundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly routeOrToolRefs: readonly string[];
  readonly sourceArtifactDigests: readonly string[];
  readonly sourceReadinessDigest: string | null;
  readonly enforcementCandidate: boolean;
  readonly customerOwnedGateRequired: true;
  readonly downstreamContractRequired: true;
  readonly runtimeAdoptionProofRequired: true;
  readonly adoptionPackageRequired: true;
  readonly releaseEnforcementReviewRequired: boolean;
  readonly requiredRuntimeEvidenceKinds:
    readonly CustomerPepRuntimeEvidenceKind[];
  readonly requiredAdoptionEvidenceKinds:
    readonly CustomerPepAdoptionPackageEvidenceKind[];
  readonly requiredEvidenceFields:
    readonly ActionSurfaceIntegrationKitCustomerGateWiringEvidenceField[];
  readonly missingProofs: readonly string[];
  readonly nextReviewerAction: string;
  readonly evidenceBinding: ActionSurfaceIntegrationKitCustomerGateWiringEvidenceBinding;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly authority: 'wiring-review-only';
}

export interface ActionSurfaceIntegrationKitCustomerGateWiringPacket {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PACKET_VERSION;
  readonly generatedAt: string;
  readonly status: ActionSurfaceIntegrationKitCustomerGateWiringStatus;
  readonly sourceKitDigest: string;
  readonly sourcePacketDigest: string;
  readonly liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS';
  readonly customerGateContractVersion: typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION;
  readonly customerGateReleaseEnforcementVersion:
    typeof CONSEQUENCE_ADMISSION_CUSTOMER_GATE_RELEASE_ENFORCEMENT_VERSION;
  readonly downstreamContractVersion:
    typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION;
  readonly runtimeAdoptionContractVersion:
    typeof CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION;
  readonly adoptionPackageContractVersion:
    typeof CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION;
  readonly surfaceCount: number;
  readonly wiringPlanCount: number;
  readonly enforcementCandidateCount: number;
  readonly modes: readonly AttestorIntegrationMode[];
  readonly wiringPlans:
    readonly ActionSurfaceIntegrationKitCustomerGateWiringPlan[];
  readonly reviewChecklist: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceIntegrationKitCustomerGateWiringPacketDescriptor {
  readonly version: typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PACKET_VERSION;
  readonly statuses: typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_STATUSES;
  readonly planStatuses:
    typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PLAN_STATUSES;
  readonly evidenceFields:
    typeof ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_EVIDENCE_FIELDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
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
      `Action surface integration kit customer gate wiring packet ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
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

function runtimeKindForMode(mode: AttestorIntegrationMode): CustomerPepRuntimeKind {
  switch (mode) {
    case 'gateway-proxy':
      return 'envoy-ext-authz';
    case 'sidecar-ext-authz':
      return 'opa-envoy-sidecar';
    case 'sdk-gate':
      return 'node-middleware';
    case 'mcp-tool-gateway':
      return 'action-dispatcher';
    case 'provider-native-connector':
      return 'custom-pep';
    case 'advisory-api':
    case 'shadow-capture-sdk':
      return 'custom-pep';
  }
}

function downstreamBoundaryKindForMode(
  mode: AttestorIntegrationMode,
): ConsequenceAdmissionDownstreamBoundaryKind {
  switch (mode) {
    case 'gateway-proxy':
    case 'sidecar-ext-authz':
      return 'http-handler';
    case 'sdk-gate':
    case 'mcp-tool-gateway':
    case 'provider-native-connector':
      return 'action-dispatcher';
    case 'advisory-api':
    case 'shadow-capture-sdk':
      return 'custom';
  }
}

function recommendedGatePlacement(
  mode: AttestorIntegrationMode,
): string {
  switch (mode) {
    case 'gateway-proxy':
      return 'Place the customer-owned gate at the HTTP gateway before the downstream route executes.';
    case 'sidecar-ext-authz':
      return 'Place the customer-owned gate in the sidecar or mesh authorization path before the workload handles the request.';
    case 'sdk-gate':
      return 'Place the customer-owned gate inside the protected adapter before the SDK calls the downstream action.';
    case 'mcp-tool-gateway':
      return 'Place the customer-owned gate at the MCP tool gateway before the tool dispatches.';
    case 'provider-native-connector':
      return 'Place the customer-owned gate at the provider connector before delegated downstream execution.';
    case 'advisory-api':
      return 'Keep this path advisory until a customer-owned stop point is selected and reviewed.';
    case 'shadow-capture-sdk':
      return 'Keep this path in shadow capture until a customer-owned stop point is selected and reviewed.';
  }
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

function requiredEvidenceFields(
  enforcementCandidate: boolean,
): readonly ActionSurfaceIntegrationKitCustomerGateWiringEvidenceField[] {
  const common: ActionSurfaceIntegrationKitCustomerGateWiringEvidenceField[] = [
    'source-kit-digest',
    'source-packet-digest',
    'surface-readiness-digest',
    'artifact-digest',
    'route-or-tool-ref',
    'downstream-contract-review',
    'customer-pep-runtime-adoption-proof',
    'protected-admission-e2e-proof-plan',
    'customer-approval-record',
  ];
  if (!enforcementCandidate) return Object.freeze(common);
  return Object.freeze([
    ...common,
    'no-bypass-probe-result',
    'activation-handoff-record',
    'downstream-receipt-or-denial-digest',
  ]);
}

function missingProofs(enforcementCandidate: boolean): readonly string[] {
  const common = [
    'customer-pep-runtime-adoption-proof-missing',
    'protected-admission-e2e-proof-plan-missing',
    'downstream-contract-review-missing',
    'customer-approval-record-missing',
  ];
  if (!enforcementCandidate) {
    return Object.freeze([
      ...common,
      'customer-stop-point-not-selected-for-enforcement',
    ]);
  }
  return Object.freeze([
    ...common,
    'customer-stop-point-proof-missing',
    'no-bypass-probe-result-missing',
    'activation-handoff-record-missing',
    'downstream-receipt-or-denial-digest-missing',
  ]);
}

function nextReviewerAction(input: {
  readonly mode: AttestorIntegrationMode;
  readonly routeOrToolRefs: readonly string[];
  readonly enforcementCandidate: boolean;
}): string {
  if (!input.enforcementCandidate) {
    return 'Use this surface for shadow or advisory review until a customer-owned stop point is selected.';
  }
  if (input.routeOrToolRefs.length === 0) {
    return 'Select the customer-owned route, tool, or dispatcher boundary before preparing runtime adoption evidence.';
  }
  return 'Review the listed route or tool refs, then collect runtime adoption and no-bypass probe evidence at the customer stop point.';
}

function createWiringPlans(
  kit: ActionSurfaceIntegrationKitPacket,
): readonly ActionSurfaceIntegrationKitCustomerGateWiringPlan[] {
  const artifacts = artifactsBySurface(kit.artifactManifest.artifacts);
  return Object.freeze(
    kit.artifactManifest.artifacts
      .map((artifact) => artifact.actionSurface)
      .filter((surface, index, surfaces) => surfaces.indexOf(surface) === index)
      .map((actionSurface) => {
        const surfaceArtifacts = artifacts.get(actionSurface) ?? [];
        const firstArtifact = surfaceArtifacts[0];
        const mode = firstArtifact?.mode ?? 'advisory-api';
        const routeOrToolRefs = operationRefsForMode({
          mode,
          artifacts: surfaceArtifacts,
        });
        const sourceArtifactDigests = artifactDigests(surfaceArtifacts);
        const sourceReadinessDigest = firstArtifact?.readinessDigest ?? null;
        const enforcementCandidate =
          mode !== 'advisory-api' && mode !== 'shadow-capture-sdk';
        const evidenceFields = requiredEvidenceFields(enforcementCandidate);
        return Object.freeze({
          wiringId: `customer-gate-wiring:${actionSurface}`,
          actionSurface,
          mode,
          planStatus: enforcementCandidate
            ? 'customer-gate-review-required' as const
            : 'observe-only-not-enforcement' as const,
          domain: firstArtifact?.domain ?? null,
          downstreamSystem: firstArtifact?.downstreamSystem ?? null,
          targetBoundary: targetBoundaryForMode(mode),
          recommendedGatePlacement: recommendedGatePlacement(mode),
          runtimeKind: runtimeKindForMode(mode),
          downstreamBoundaryKind: downstreamBoundaryKindForMode(mode),
          routeOrToolRefs,
          sourceArtifactDigests,
          sourceReadinessDigest,
          enforcementCandidate,
          customerOwnedGateRequired: true as const,
          downstreamContractRequired: true as const,
          runtimeAdoptionProofRequired: true as const,
          adoptionPackageRequired: true as const,
          releaseEnforcementReviewRequired: enforcementCandidate,
          requiredRuntimeEvidenceKinds: CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS,
          requiredAdoptionEvidenceKinds:
            CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS,
          requiredEvidenceFields: evidenceFields,
          missingProofs: missingProofs(enforcementCandidate),
          nextReviewerAction: nextReviewerAction({
            mode,
            routeOrToolRefs,
            enforcementCandidate,
          }),
          evidenceBinding: Object.freeze({
            sourceKitDigest: kit.digest,
            sourcePacketDigest: kit.sourcePacketDigest,
            sourceArtifactDigests,
            surfaceReadinessDigest: sourceReadinessDigest,
            liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS' as const,
            generatedPacketMayCloseLiveProof: false as const,
          }),
          approvalRequired: true as const,
          autoEnforce: false as const,
          rawPayloadStored: false as const,
          productionReady: false as const,
          deploysInfrastructure: false as const,
          issuesCredentials: false as const,
          activatesEnforcement: false as const,
          nonBypassableClaimAllowed: false as const,
          authority: 'wiring-review-only' as const,
        });
      })
      .sort((left, right) =>
        left.actionSurface.localeCompare(right.actionSurface)
      ),
  );
}

function reviewChecklist(): readonly string[] {
  return Object.freeze([
    'Confirm each route or tool has a customer-owned stop point before downstream execution.',
    'Confirm the stop point can deny by default when Attestor evidence is missing or stale.',
    'Confirm runtime adoption evidence exists before requesting a stronger no-bypass claim.',
    'Bind customer probe results back to kit, artifact, and runtime adoption digests.',
    'Do not treat this generated packet as deployment, credential, or live proof evidence.',
  ]);
}

export function createActionSurfaceIntegrationKitCustomerGateWiringPacket(
  input: CreateActionSurfaceIntegrationKitCustomerGateWiringPacketInput,
): ActionSurfaceIntegrationKitCustomerGateWiringPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.kit.generatedAt,
    'generatedAt',
  );
  const wiringPlans = createWiringPlans(input.kit);
  const modes = Object.freeze([
    ...new Set(wiringPlans.map((plan) => plan.mode)),
  ].sort());
  const body = {
    version: ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PACKET_VERSION,
    generatedAt,
    status: wiringPlans.length === 0 ? 'no-surfaces' as const : 'review-required' as const,
    sourceKitDigest: input.kit.digest,
    sourcePacketDigest: input.kit.sourcePacketDigest,
    liveProofRegisterRef: 'LP-CUSTOMER-PEP-NO-BYPASS' as const,
    customerGateContractVersion: CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
    customerGateReleaseEnforcementVersion:
      CONSEQUENCE_ADMISSION_CUSTOMER_GATE_RELEASE_ENFORCEMENT_VERSION,
    downstreamContractVersion: CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
    runtimeAdoptionContractVersion: CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
    adoptionPackageContractVersion: CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
    surfaceCount: new Set(wiringPlans.map((plan) => plan.actionSurface)).size,
    wiringPlanCount: wiringPlans.length,
    enforcementCandidateCount:
      wiringPlans.filter((plan) => plan.enforcementCandidate).length,
    modes,
    wiringPlans,
    reviewChecklist: reviewChecklist(),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    deploysInfrastructure: false as const,
    issuesCredentials: false as const,
    activatesEnforcement: false as const,
    nonBypassableClaimAllowed: false as const,
    limitations: Object.freeze([
      'This packet is a customer gate wiring review plan, not an apply step.',
      'It does not deploy a PEP, issue credentials, activate enforcement, or run probes.',
      'Customer PEP no-bypass remains unproven until LP-CUSTOMER-PEP-NO-BYPASS evidence exists.',
    ]),
  } as const;
  return withCanonical(body);
}

export function actionSurfaceIntegrationKitCustomerGateWiringPacketDescriptor():
  ActionSurfaceIntegrationKitCustomerGateWiringPacketDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PACKET_VERSION,
    statuses: ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_STATUSES,
    planStatuses: ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_PLAN_STATUSES,
    evidenceFields: ACTION_SURFACE_INTEGRATION_KIT_CUSTOMER_GATE_WIRING_EVIDENCE_FIELDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
  });
}
