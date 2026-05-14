import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION =
  'attestor.consequence-agentic-supply-chain-guard.v1';

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS = [
  'npm-package',
  'container-image',
  'github-action',
  'connector',
  'plugin',
  'mcp-server',
  'workflow',
  'generated-adapter',
  'domain-pack',
  'model-provider-sdk',
  'custom-tool',
] as const;
export type ConsequenceAgenticSupplyChainComponentKind =
  typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS[number];

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES = [
  'repo-internal',
  'first-party',
  'verified-vendor',
  'third-party',
  'community',
  'generated',
  'unknown',
] as const;
export type ConsequenceAgenticSupplyChainTrustClass =
  typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES[number];

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type ConsequenceAgenticSupplyChainCriticality =
  typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY[number];

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceAgenticSupplyChainOutcome =
  typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES[number];

export const CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_REASON_CODES = [
  'supply-chain-component-missing',
  'supply-chain-source-missing',
  'supply-chain-source-unpinned',
  'supply-chain-version-missing',
  'supply-chain-integrity-missing',
  'supply-chain-provenance-missing',
  'supply-chain-provenance-unverified',
  'supply-chain-signature-unverified',
  'supply-chain-sbom-missing',
  'supply-chain-owner-authority-missing',
  'supply-chain-review-missing',
  'supply-chain-permission-scope-missing',
  'supply-chain-permission-overbroad',
  'supply-chain-install-scripts-present',
  'supply-chain-network-egress-unreviewed',
  'supply-chain-generated-artifact-review-missing',
  'supply-chain-domain-pack-boundary-unverified',
  'supply-chain-adapter-readiness-missing',
  'supply-chain-runtime-replay-missing',
  'supply-chain-critical-component-block',
  'supply-chain-untrusted-publisher-block',
  'supply-chain-pass',
  'supply-chain-review',
  'supply-chain-block',
] as const;
export type ConsequenceAgenticSupplyChainReasonCode =
  typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_REASON_CODES[number];

export interface ConsequenceAgenticSupplyChainComponent {
  readonly componentRef: string;
  readonly componentKind: ConsequenceAgenticSupplyChainComponentKind;
  readonly trustClass?: ConsequenceAgenticSupplyChainTrustClass | null;
  readonly criticality?: ConsequenceAgenticSupplyChainCriticality | null;
  readonly sourceRef?: string | null;
  readonly sourcePinned?: boolean | null;
  readonly version?: string | null;
  readonly integrityDigest?: string | null;
  readonly provenanceRef?: string | null;
  readonly provenanceVerified?: boolean | null;
  readonly signatureVerified?: boolean | null;
  readonly sbomRef?: string | null;
  readonly ownerAuthorityDigest?: string | null;
  readonly reviewDigest?: string | null;
  readonly permissionScopeDigest?: string | null;
  readonly declaredPermissions?: readonly string[] | null;
  readonly allowedPermissions?: readonly string[] | null;
  readonly installScriptsPresent?: boolean | null;
  readonly networkEgressDeclared?: boolean | null;
  readonly generatedArtifact?: boolean | null;
  readonly generatedArtifactReviewed?: boolean | null;
  readonly domainPackBoundaryVerified?: boolean | null;
  readonly adapterReadinessDigest?: string | null;
  readonly runtimeReplayTestDigest?: string | null;
}

export interface EvaluateConsequenceAgenticSupplyChainInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly components?: readonly ConsequenceAgenticSupplyChainComponent[] | null;
}

export interface ConsequenceAgenticSupplyChainObservedComponent {
  readonly componentRefDigest: string;
  readonly componentKind: ConsequenceAgenticSupplyChainComponentKind;
  readonly trustClass: ConsequenceAgenticSupplyChainTrustClass;
  readonly criticality: ConsequenceAgenticSupplyChainCriticality;
  readonly sourceRefDigest?: string;
  readonly versionDigest?: string;
  readonly sourcePinned: boolean;
  readonly integrityDigest?: string;
  readonly provenanceRefDigest?: string;
  readonly provenanceVerified: boolean;
  readonly signatureVerified: boolean;
  readonly sbomRefDigest?: string;
  readonly ownerAuthorityDigest?: string;
  readonly reviewDigest?: string;
  readonly permissionScopeDigest?: string;
  readonly declaredPermissionDigests: readonly string[];
  readonly overbroadPermissionDigests: readonly string[];
  readonly installScriptsPresent: boolean;
  readonly networkEgressDeclared: boolean;
  readonly generatedArtifact: boolean;
  readonly generatedArtifactReviewed: boolean;
  readonly domainPackBoundaryVerified: boolean;
  readonly adapterReadinessDigest?: string;
  readonly runtimeReplayTestDigest?: string;
  readonly outcome: ConsequenceAgenticSupplyChainOutcome;
  readonly reasonCodes: readonly ConsequenceAgenticSupplyChainReasonCode[];
}

export interface ConsequenceAgenticSupplyChainDecision {
  readonly version: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly outcome: ConsequenceAgenticSupplyChainOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceAgenticSupplyChainReasonCode[];
  readonly failureModeId: 'agentic-supply-chain-compromise';
  readonly invariantIds: readonly [
    'least-privilege-tooling-and-supply-chain-review',
    'decision-context-version-must-be-bound',
    'downstream-side-effects-must-be-declared',
  ];
  readonly protectedPrinciples: readonly [
    'release provenance',
    'customer authority',
    'runtime readiness',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly counts: {
    readonly componentCount: number;
    readonly blockCount: number;
    readonly reviewCount: number;
    readonly unpinnedCount: number;
    readonly missingProvenanceCount: number;
    readonly unverifiedProvenanceCount: number;
    readonly overbroadPermissionCount: number;
    readonly unreviewedGeneratedArtifactCount: number;
  };
  readonly observedComponents: readonly ConsequenceAgenticSupplyChainObservedComponent[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAgenticSupplyChainGuardDescriptor {
  readonly version: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION;
  readonly failureModeId: 'agentic-supply-chain-compromise';
  readonly componentKinds: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS;
  readonly trustClasses: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES;
  readonly criticalityValues: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY;
  readonly outcomes: typeof CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES;
  readonly requiresPinnedSource: true;
  readonly requiresIntegrityDigest: true;
  readonly requiresVerifiedProvenance: true;
  readonly requiresLeastPrivilegeScope: true;
  readonly rejectsOverbroadPermissions: true;
  readonly blocksUnreviewedGeneratedArtifacts: true;
  readonly blocksUnverifiedDomainPackBoundary: true;
  readonly storesRawComponentRefs: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const BLOCK_REASON_CODES = new Set<ConsequenceAgenticSupplyChainReasonCode>([
  'supply-chain-permission-overbroad',
  'supply-chain-domain-pack-boundary-unverified',
  'supply-chain-critical-component-block',
  'supply-chain-untrusted-publisher-block',
]);

const REVIEW_REASON_CODES = new Set<ConsequenceAgenticSupplyChainReasonCode>([
  'supply-chain-component-missing',
  'supply-chain-source-missing',
  'supply-chain-source-unpinned',
  'supply-chain-version-missing',
  'supply-chain-integrity-missing',
  'supply-chain-provenance-missing',
  'supply-chain-provenance-unverified',
  'supply-chain-signature-unverified',
  'supply-chain-sbom-missing',
  'supply-chain-owner-authority-missing',
  'supply-chain-review-missing',
  'supply-chain-permission-scope-missing',
  'supply-chain-install-scripts-present',
  'supply-chain-network-egress-unreviewed',
  'supply-chain-generated-artifact-review-missing',
  'supply-chain-adapter-readiness-missing',
  'supply-chain-runtime-replay-missing',
]);

const HIGH_IMPACT_CRITICALITY = new Set<ConsequenceAgenticSupplyChainCriticality>([
  'high',
  'critical',
]);

const UNTRUSTED_CLASSES = new Set<ConsequenceAgenticSupplyChainTrustClass>([
  'community',
  'unknown',
]);

const THIRD_PARTY_CLASSES = new Set<ConsequenceAgenticSupplyChainTrustClass>([
  'verified-vendor',
  'third-party',
  'community',
  'unknown',
]);

const ADAPTER_COMPONENT_KINDS = new Set<ConsequenceAgenticSupplyChainComponentKind>([
  'connector',
  'plugin',
  'mcp-server',
  'generated-adapter',
  'custom-tool',
]);

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

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueReasonCodes(
  items: readonly ConsequenceAgenticSupplyChainReasonCode[],
): readonly ConsequenceAgenticSupplyChainReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Consequence agentic supply-chain guard generatedAt must be an ISO timestamp.');
  }
  return parsed.toISOString();
}

function isSha256Digest(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/iu.test(value);
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function defaultTrustClass(
  componentKind: ConsequenceAgenticSupplyChainComponentKind,
  supplied: ConsequenceAgenticSupplyChainTrustClass | null | undefined,
): ConsequenceAgenticSupplyChainTrustClass {
  if (supplied) return supplied;
  return componentKind === 'generated-adapter' ? 'generated' : 'unknown';
}

function defaultCriticality(
  componentKind: ConsequenceAgenticSupplyChainComponentKind,
  supplied: ConsequenceAgenticSupplyChainCriticality | null | undefined,
): ConsequenceAgenticSupplyChainCriticality {
  if (supplied) return supplied;
  if (componentKind === 'mcp-server' || componentKind === 'workflow' || componentKind === 'generated-adapter') {
    return 'high';
  }
  return 'medium';
}

function permissionDiff(input: {
  readonly declaredPermissions: readonly string[];
  readonly allowedPermissions: readonly string[];
}): readonly string[] {
  const allowed = new Set(input.allowedPermissions.map((permission) => permission.trim()).filter(Boolean));
  return readonlyCopy(
    input.declaredPermissions
      .map((permission) => permission.trim())
      .filter((permission) => permission && !allowed.has(permission))
      .sort(),
  );
}

function binding(): ConsequenceFailureControlBinding {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find(
    (item) => item.failureModeId === 'agentic-supply-chain-compromise',
  );
  if (!found) {
    throw new Error('Missing control binding for agentic-supply-chain-compromise.');
  }
  return found;
}

function evaluateComponent(
  component: ConsequenceAgenticSupplyChainComponent,
): ConsequenceAgenticSupplyChainObservedComponent {
  const trustClass = defaultTrustClass(component.componentKind, component.trustClass ?? null);
  const criticality = defaultCriticality(component.componentKind, component.criticality ?? null);
  const declaredPermissions = readonlyCopy(component.declaredPermissions ?? []);
  const allowedPermissions = readonlyCopy(component.allowedPermissions ?? []);
  const overbroadPermissions = permissionDiff({ declaredPermissions, allowedPermissions });
  const sourcePinned = component.sourcePinned === true;
  const provenanceVerified = component.provenanceVerified === true;
  const signatureVerified = component.signatureVerified === true;
  const generatedArtifact = component.generatedArtifact === true ||
    component.componentKind === 'generated-adapter';
  const generatedArtifactReviewed = component.generatedArtifactReviewed === true;
  const domainPackBoundaryVerified = component.domainPackBoundaryVerified === true;
  const installScriptsPresent = component.installScriptsPresent === true;
  const networkEgressDeclared = component.networkEgressDeclared === true;
  const reasonCodes: ConsequenceAgenticSupplyChainReasonCode[] = [];

  if (!nonEmpty(component.sourceRef)) reasonCodes.push('supply-chain-source-missing');
  if (!sourcePinned) reasonCodes.push('supply-chain-source-unpinned');
  if (!nonEmpty(component.version)) reasonCodes.push('supply-chain-version-missing');
  if (!isSha256Digest(component.integrityDigest)) reasonCodes.push('supply-chain-integrity-missing');
  if (!nonEmpty(component.provenanceRef)) reasonCodes.push('supply-chain-provenance-missing');
  if (!provenanceVerified) reasonCodes.push('supply-chain-provenance-unverified');
  if (THIRD_PARTY_CLASSES.has(trustClass) && !signatureVerified) {
    reasonCodes.push('supply-chain-signature-unverified');
  }
  if (THIRD_PARTY_CLASSES.has(trustClass) && !nonEmpty(component.sbomRef)) {
    reasonCodes.push('supply-chain-sbom-missing');
  }
  if (!isSha256Digest(component.ownerAuthorityDigest)) {
    reasonCodes.push('supply-chain-owner-authority-missing');
  }
  if (!isSha256Digest(component.reviewDigest)) {
    reasonCodes.push('supply-chain-review-missing');
  }
  if (!isSha256Digest(component.permissionScopeDigest)) {
    reasonCodes.push('supply-chain-permission-scope-missing');
  }
  if (overbroadPermissions.length > 0) {
    reasonCodes.push('supply-chain-permission-overbroad');
  }
  if (installScriptsPresent) {
    reasonCodes.push('supply-chain-install-scripts-present');
  }
  if (networkEgressDeclared && !isSha256Digest(component.reviewDigest)) {
    reasonCodes.push('supply-chain-network-egress-unreviewed');
  }
  if (generatedArtifact && !generatedArtifactReviewed) {
    reasonCodes.push('supply-chain-generated-artifact-review-missing');
  }
  if (component.componentKind === 'domain-pack' && !domainPackBoundaryVerified) {
    reasonCodes.push('supply-chain-domain-pack-boundary-unverified');
  }
  if (ADAPTER_COMPONENT_KINDS.has(component.componentKind) && !isSha256Digest(component.adapterReadinessDigest)) {
    reasonCodes.push('supply-chain-adapter-readiness-missing');
  }
  if (HIGH_IMPACT_CRITICALITY.has(criticality) && !isSha256Digest(component.runtimeReplayTestDigest)) {
    reasonCodes.push('supply-chain-runtime-replay-missing');
  }
  if (
    HIGH_IMPACT_CRITICALITY.has(criticality) &&
    (
      !isSha256Digest(component.integrityDigest) ||
      !nonEmpty(component.provenanceRef) ||
      !provenanceVerified ||
      generatedArtifact && !generatedArtifactReviewed
    )
  ) {
    reasonCodes.push('supply-chain-critical-component-block');
  }
  if (HIGH_IMPACT_CRITICALITY.has(criticality) && UNTRUSTED_CLASSES.has(trustClass)) {
    reasonCodes.push('supply-chain-untrusted-publisher-block');
  }

  const uniqueCodes = uniqueReasonCodes(reasonCodes);
  const hasBlock = uniqueCodes.some((code) => BLOCK_REASON_CODES.has(code));
  const hasReview = uniqueCodes.some((code) => REVIEW_REASON_CODES.has(code));
  const outcome: ConsequenceAgenticSupplyChainOutcome = hasBlock
    ? 'block'
    : hasReview
      ? 'review'
      : 'pass';

  return Object.freeze({
    componentRefDigest: digestText(component.componentRef),
    componentKind: component.componentKind,
    trustClass,
    criticality,
    ...(nonEmpty(component.sourceRef) ? { sourceRefDigest: digestText(component.sourceRef.trim()) } : {}),
    ...(nonEmpty(component.version) ? { versionDigest: digestText(component.version.trim()) } : {}),
    sourcePinned,
    ...(isSha256Digest(component.integrityDigest) ? { integrityDigest: component.integrityDigest } : {}),
    ...(nonEmpty(component.provenanceRef) ? { provenanceRefDigest: digestText(component.provenanceRef.trim()) } : {}),
    provenanceVerified,
    signatureVerified,
    ...(nonEmpty(component.sbomRef) ? { sbomRefDigest: digestText(component.sbomRef.trim()) } : {}),
    ...(isSha256Digest(component.ownerAuthorityDigest)
      ? { ownerAuthorityDigest: component.ownerAuthorityDigest }
      : {}),
    ...(isSha256Digest(component.reviewDigest) ? { reviewDigest: component.reviewDigest } : {}),
    ...(isSha256Digest(component.permissionScopeDigest)
      ? { permissionScopeDigest: component.permissionScopeDigest }
      : {}),
    declaredPermissionDigests: readonlyCopy(declaredPermissions.map((permission) => digestText(permission))),
    overbroadPermissionDigests: readonlyCopy(overbroadPermissions.map((permission) => digestText(permission))),
    installScriptsPresent,
    networkEgressDeclared,
    generatedArtifact,
    generatedArtifactReviewed,
    domainPackBoundaryVerified,
    ...(isSha256Digest(component.adapterReadinessDigest)
      ? { adapterReadinessDigest: component.adapterReadinessDigest }
      : {}),
    ...(isSha256Digest(component.runtimeReplayTestDigest)
      ? { runtimeReplayTestDigest: component.runtimeReplayTestDigest }
      : {}),
    outcome,
    reasonCodes: uniqueReasonCodes([
      ...uniqueCodes,
      outcome === 'block'
        ? 'supply-chain-block'
        : outcome === 'review'
          ? 'supply-chain-review'
          : 'supply-chain-pass',
    ]),
  });
}

function aggregateOutcome(
  components: readonly ConsequenceAgenticSupplyChainObservedComponent[],
): {
  readonly outcome: ConsequenceAgenticSupplyChainOutcome;
  readonly reasonCodes: readonly ConsequenceAgenticSupplyChainReasonCode[];
} {
  if (components.length === 0) {
    return Object.freeze({
      outcome: 'review',
      reasonCodes: uniqueReasonCodes([
        'supply-chain-component-missing',
        'supply-chain-review',
      ]),
    });
  }
  const reasonCodes = uniqueReasonCodes(components.flatMap((component) => component.reasonCodes));
  if (components.some((component) => component.outcome === 'block')) {
    return Object.freeze({
      outcome: 'block',
      reasonCodes: uniqueReasonCodes([...reasonCodes, 'supply-chain-block']),
    });
  }
  if (components.some((component) => component.outcome === 'review')) {
    return Object.freeze({
      outcome: 'review',
      reasonCodes: uniqueReasonCodes([...reasonCodes, 'supply-chain-review']),
    });
  }
  return Object.freeze({
    outcome: 'pass',
    reasonCodes: uniqueReasonCodes([...reasonCodes, 'supply-chain-pass']),
  });
}

export function evaluateConsequenceAgenticSupplyChain(
  input: EvaluateConsequenceAgenticSupplyChainInput,
): ConsequenceAgenticSupplyChainDecision {
  const generatedAt = normalizeTimestamp(input.generatedAt ?? null);
  const observedComponents = readonlyCopy(
    (input.components ?? []).map((component) => evaluateComponent(component)),
  );
  const aggregate = aggregateOutcome(observedComponents);
  const controlBinding = binding();
  const payload = {
    version: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION,
    generatedAt,
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    outcome: aggregate.outcome,
    allowed: aggregate.outcome === 'pass',
    failClosed: aggregate.outcome !== 'pass',
    reasonCodes: aggregate.reasonCodes,
    failureModeId: 'agentic-supply-chain-compromise',
    invariantIds: [
      'least-privilege-tooling-and-supply-chain-review',
      'decision-context-version-must-be-bound',
      'downstream-side-effects-must-be-declared',
    ] as const,
    protectedPrinciples: [
      'release provenance',
      'customer authority',
      'runtime readiness',
    ] as const,
    requiredControls: controlBinding.controlIds,
    requiredEvidence: controlBinding.requiredEvidence,
    requiredAuthoritySources: controlBinding.requiredAuthority,
    requiredAuditRecords: controlBinding.requiredAuditRecords,
    counts: {
      componentCount: observedComponents.length,
      blockCount: observedComponents.filter((component) => component.outcome === 'block').length,
      reviewCount: observedComponents.filter((component) => component.outcome === 'review').length,
      unpinnedCount: observedComponents.filter((component) => !component.sourcePinned).length,
      missingProvenanceCount: observedComponents.filter((component) =>
        component.reasonCodes.includes('supply-chain-provenance-missing')
      ).length,
      unverifiedProvenanceCount: observedComponents.filter((component) =>
        component.reasonCodes.includes('supply-chain-provenance-unverified')
      ).length,
      overbroadPermissionCount: observedComponents.filter((component) =>
        component.reasonCodes.includes('supply-chain-permission-overbroad')
      ).length,
      unreviewedGeneratedArtifactCount: observedComponents.filter((component) =>
        component.reasonCodes.includes('supply-chain-generated-artifact-review-missing')
      ).length,
    },
    observedComponents,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'This guard classifies package, connector, plugin, MCP, workflow, generated-adapter, and domain-pack supply-chain evidence. It does not certify third-party code behavior, deploy infrastructure, or activate enforcement without customer integration and runtime evidence.',
  } as const;
  const proof = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: proof.canonical,
    digest: proof.digest,
  });
}

export function consequenceAgenticSupplyChainGuardDescriptor():
ConsequenceAgenticSupplyChainGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_VERSION,
    failureModeId: 'agentic-supply-chain-compromise',
    componentKinds: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
    trustClasses: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES,
    criticalityValues: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY,
    outcomes: CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_GUARD_OUTCOMES,
    requiresPinnedSource: true,
    requiresIntegrityDigest: true,
    requiresVerifiedProvenance: true,
    requiresLeastPrivilegeScope: true,
    rejectsOverbroadPermissions: true,
    blocksUnreviewedGeneratedArtifacts: true,
    blocksUnverifiedDomainPackBoundary: true,
    storesRawComponentRefs: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
