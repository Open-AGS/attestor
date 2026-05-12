import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  type ConsequenceAdmissionDomain,
} from './taxonomy.js';
import {
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceProfile,
  createActionSurfaceProfilerReport,
} from './action-surface-profiler.js';
import {
  type ActionSurfaceManifestIntakeOptions,
  type ActionSurfaceManifestIntakeResult,
  ingestActionSurfaceManifestText,
} from './action-surface-manifest-intake.js';
import {
  type ActionSurfaceIntegrationArtifactBundle,
  createActionSurfaceIntegrationArtifactBundle,
} from './action-surface-integration-artifacts.js';
import {
  type AttestorCredentialIsolationPosture,
  type AttestorIntegrationModeReadiness,
  type AttestorIntegrationModeSignals,
  evaluateAttestorIntegrationModeReadiness,
} from './integration-mode-readiness.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';

export const ACTION_SURFACE_ONBOARDING_PACKET_VERSION =
  'attestor.action-surface-onboarding-packet.v1';

export const ACTION_SURFACE_ONBOARDING_PACKET_STATUSES = [
  'no-surfaces',
  'requires-review',
] as const;
export type ActionSurfaceOnboardingPacketStatus =
  typeof ACTION_SURFACE_ONBOARDING_PACKET_STATUSES[number];

export interface ActionSurfaceOnboardingManifestInput
  extends ActionSurfaceManifestIntakeOptions {
  readonly text: string;
}

export interface ActionSurfaceOnboardingReadinessOverride {
  readonly actionSurface: string;
  readonly workflowId?: string | null;
  readonly credentialIsolation?: AttestorCredentialIsolationPosture | null;
  readonly signals?: AttestorIntegrationModeSignals | null;
}

export interface CreateActionSurfaceOnboardingPacketInput {
  readonly generatedAt?: string | null;
  readonly attestorBaseUrl?: string | null;
  readonly manifests?: readonly ActionSurfaceOnboardingManifestInput[] | null;
  readonly declarations?: readonly ActionSurfaceDeclaration[] | null;
  readonly events?: readonly ShadowAdmissionEvent[] | null;
  readonly readinessOverrides?: readonly ActionSurfaceOnboardingReadinessOverride[] | null;
}

export interface ActionSurfaceOnboardingSurfacePlan {
  readonly actionSurface: string;
  readonly surfaceId: string;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly eventCount: number;
  readonly declarationCount: number;
  readonly credentialPosture: ActionSurfaceDeclaredCredentialPosture;
  readonly recommendedIntegrationMode: ActionSurfaceProfile['recommendedIntegrationMode'];
  readonly artifactKinds: readonly ActionSurfaceIntegrationArtifactBundle['artifactKinds'][number][];
  readonly artifactDigests: readonly string[];
  readonly readinessStatus: AttestorIntegrationModeReadiness['status'];
  readonly bypassRisk: AttestorIntegrationModeReadiness['bypassRisk'];
  readonly readinessDigest: string;
  readonly missingControls: AttestorIntegrationModeReadiness['missingControls'];
  readonly noGoReasons: AttestorIntegrationModeReadiness['noGoReasons'];
  readonly nextOnboardingSteps: readonly string[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface ActionSurfaceOnboardingPacket {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_PACKET_VERSION;
  readonly generatedAt: string;
  readonly status: ActionSurfaceOnboardingPacketStatus;
  readonly manifestCount: number;
  readonly declarationCount: number;
  readonly eventCount: number;
  readonly profileCount: number;
  readonly artifactCount: number;
  readonly readinessCount: number;
  readonly manifestDigests: readonly string[];
  readonly profilerDigest: string;
  readonly artifactBundleDigest: string;
  readonly readinessDigests: readonly string[];
  readonly surfacePlans: readonly ActionSurfaceOnboardingSurfacePlan[];
  readonly manifestResults: readonly ActionSurfaceManifestIntakeResult[];
  readonly profileReport: ReturnType<typeof createActionSurfaceProfilerReport>;
  readonly artifactBundle: ActionSurfaceIntegrationArtifactBundle;
  readonly readinessResults: readonly AttestorIntegrationModeReadiness[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ActionSurfaceOnboardingPacketDescriptor {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_PACKET_VERSION;
  readonly statuses: typeof ACTION_SURFACE_ONBOARDING_PACKET_STATUSES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
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

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Action surface onboarding packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readinessOverridesBySurface(
  overrides: readonly ActionSurfaceOnboardingReadinessOverride[] | null | undefined,
): ReadonlyMap<string, ActionSurfaceOnboardingReadinessOverride> {
  const entries = new Map<string, ActionSurfaceOnboardingReadinessOverride>();
  for (const override of overrides ?? []) {
    const actionSurface = normalizeOptionalString(override.actionSurface);
    if (!actionSurface) {
      throw new Error('Action surface onboarding packet readiness override actionSurface is required.');
    }
    entries.set(actionSurface, Object.freeze({
      ...override,
      actionSurface,
    }));
  }
  return entries;
}

function readinessCredentialPosture(
  profile: ActionSurfaceProfile,
  override: ActionSurfaceOnboardingReadinessOverride | undefined,
): AttestorCredentialIsolationPosture {
  if (override?.credentialIsolation) return override.credentialIsolation;
  switch (profile.credentialPosture) {
    case 'none':
      return 'not-required';
    case 'agent-held-static-secret':
      return 'agent-held-static-secret';
    case 'agent-held-scoped-secret':
      return 'agent-held-scoped-secret';
    case 'short-lived-downscoped-token':
      return 'short-lived-downscoped-token';
    case 'gateway-held-secret':
      return 'gateway-held-secret';
    case 'provider-native-delegation':
      return 'provider-native-delegation';
    case 'unknown':
      return 'agent-held-static-secret';
  }
}

function defaultSignals(profile: ActionSurfaceProfile): AttestorIntegrationModeSignals {
  return Object.freeze({
    admissionCallObserved: profile.eventCount > 0,
    shadowCaptureObserved: profile.eventCount > 0,
    policySimulationAvailable: false,
    generatedArtifactsReviewed: false,
  });
}

function readinessDomain(value: string | null): ConsequenceAdmissionDomain | null {
  if (value === null) return null;
  return (CONSEQUENCE_ADMISSION_DOMAINS as readonly string[]).includes(value)
    ? value as ConsequenceAdmissionDomain
    : 'custom';
}

function artifactKindsForSurface(
  bundle: ActionSurfaceIntegrationArtifactBundle,
  actionSurface: string,
): readonly ActionSurfaceIntegrationArtifactBundle['artifactKinds'][number][] {
  return Object.freeze(
    [...new Set(
      bundle.artifacts
        .filter((artifact) => artifact.actionSurface === actionSurface)
        .map((artifact) => artifact.kind),
    )].sort(),
  );
}

function artifactDigestsForSurface(
  bundle: ActionSurfaceIntegrationArtifactBundle,
  actionSurface: string,
): readonly string[] {
  return Object.freeze(
    bundle.artifacts
      .filter((artifact) => artifact.actionSurface === actionSurface)
      .map((artifact) => artifact.digest)
      .sort(),
  );
}

function nextOnboardingSteps(input: {
  readonly profile: ActionSurfaceProfile;
  readonly readiness: AttestorIntegrationModeReadiness;
  readonly artifactKinds: readonly string[];
}): readonly string[] {
  const steps: string[] = [];
  if (input.profile.eventCount === 0) steps.push('add-shadow-capture');
  if (
    input.profile.credentialPosture === 'unknown' ||
    input.profile.credentialPosture === 'agent-held-static-secret' ||
    input.profile.credentialPosture === 'agent-held-scoped-secret'
  ) {
    steps.push('isolate-or-prove-credential-boundary');
  }
  if (input.artifactKinds.length > 0) steps.push('review-generated-artifacts');
  if (input.readiness.noGoReasons.includes('missing-policy-simulation')) {
    steps.push('run-policy-twin-backtest');
  }
  if (input.readiness.noGoReasons.includes('missing-red-team-replay')) {
    steps.push('run-red-team-replay-fixture');
  }
  if (input.readiness.noGoReasons.includes('missing-customer-approval')) {
    steps.push('record-customer-approval');
  }
  if (input.readiness.missingControls.length > 0) {
    steps.push('close-readiness-controls');
  }
  if (steps.length === 0) steps.push('prepare-customer-controlled-scoped-enforcement-review');
  return Object.freeze([...new Set(steps)]);
}

function createReadinessResults(input: {
  readonly profiles: readonly ActionSurfaceProfile[];
  readonly artifactBundle: ActionSurfaceIntegrationArtifactBundle;
  readonly generatedAt: string;
  readonly overrides: ReadonlyMap<string, ActionSurfaceOnboardingReadinessOverride>;
}): readonly AttestorIntegrationModeReadiness[] {
  return Object.freeze(
    input.profiles.map((profile) => {
      const override = input.overrides.get(profile.actionSurface);
      const generatedArtifacts = artifactKindsForSurface(input.artifactBundle, profile.actionSurface);
      return evaluateAttestorIntegrationModeReadiness({
        workflowId: normalizeOptionalString(override?.workflowId) ?? profile.surfaceId,
        mode: profile.recommendedIntegrationMode,
        credentialIsolation: readinessCredentialPosture(profile, override),
        actionSurface: profile.actionSurface,
        domain: readinessDomain(profile.domain),
        downstreamSystem: profile.downstreamSystem,
        generatedAt: input.generatedAt,
        generatedArtifacts,
        signals: {
          ...defaultSignals(profile),
          ...(override?.signals ?? {}),
        },
      });
    }),
  );
}

function createSurfacePlans(input: {
  readonly profiles: readonly ActionSurfaceProfile[];
  readonly artifactBundle: ActionSurfaceIntegrationArtifactBundle;
  readonly readinessResults: readonly AttestorIntegrationModeReadiness[];
}): readonly ActionSurfaceOnboardingSurfacePlan[] {
  const readinessBySurface = new Map(
    input.readinessResults.map((readiness) => [readiness.actionSurface, readiness] as const),
  );
  return Object.freeze(
    input.profiles.map((profile) => {
      const readiness = readinessBySurface.get(profile.actionSurface);
      if (!readiness) {
        throw new Error(`Action surface onboarding packet missing readiness for ${profile.actionSurface}.`);
      }
      const artifactKinds = artifactKindsForSurface(input.artifactBundle, profile.actionSurface);
      return Object.freeze({
        actionSurface: profile.actionSurface,
        surfaceId: profile.surfaceId,
        domain: profile.domain,
        downstreamSystem: profile.downstreamSystem,
        eventCount: profile.eventCount,
        declarationCount: profile.declarationCount,
        credentialPosture: profile.credentialPosture,
        recommendedIntegrationMode: profile.recommendedIntegrationMode,
        artifactKinds,
        artifactDigests: artifactDigestsForSurface(input.artifactBundle, profile.actionSurface),
        readinessStatus: readiness.status,
        bypassRisk: readiness.bypassRisk,
        readinessDigest: readiness.digest,
        missingControls: readiness.missingControls,
        noGoReasons: readiness.noGoReasons,
        nextOnboardingSteps: nextOnboardingSteps({
          profile,
          readiness,
          artifactKinds,
        }),
        nextSafeStep: readiness.nextSafeStep,
        approvalRequired: true,
        autoEnforce: false,
        productionReady: false,
      });
    }),
  );
}

export function createActionSurfaceOnboardingPacket(
  input: CreateActionSurfaceOnboardingPacketInput,
): ActionSurfaceOnboardingPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const manifestResults = Object.freeze(
    (input.manifests ?? []).map((manifest) =>
      ingestActionSurfaceManifestText(manifest.text, manifest)
    ),
  );
  const declarations = Object.freeze([
    ...(input.declarations ?? []),
    ...manifestResults.flatMap((manifest) => manifest.declarations),
  ]);
  const profileReport = createActionSurfaceProfilerReport({
    generatedAt,
    events: input.events ?? [],
    declarations,
  });
  const artifactBundle = createActionSurfaceIntegrationArtifactBundle({
    generatedAt,
    attestorBaseUrl: input.attestorBaseUrl,
    profiles: profileReport.profiles,
  });
  const overrides = readinessOverridesBySurface(input.readinessOverrides);
  const readinessResults = createReadinessResults({
    profiles: profileReport.profiles,
    artifactBundle,
    generatedAt,
    overrides,
  });
  const surfacePlans = createSurfacePlans({
    profiles: profileReport.profiles,
    artifactBundle,
    readinessResults,
  });
  const body = {
    version: ACTION_SURFACE_ONBOARDING_PACKET_VERSION,
    generatedAt,
    status: profileReport.surfaceCount === 0 ? 'no-surfaces' : 'requires-review',
    manifestCount: manifestResults.length,
    declarationCount: declarations.length,
    eventCount: input.events?.length ?? 0,
    profileCount: profileReport.surfaceCount,
    artifactCount: artifactBundle.artifactCount,
    readinessCount: readinessResults.length,
    manifestDigests: Object.freeze(manifestResults.map((manifest) => manifest.digest).sort()),
    profilerDigest: profileReport.digest,
    artifactBundleDigest: artifactBundle.digest,
    readinessDigests: Object.freeze(readinessResults.map((readiness) => readiness.digest).sort()),
    surfacePlans,
    manifestResults,
    profileReport,
    artifactBundle,
    readinessResults,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    limitations: Object.freeze([
      'This packet is an onboarding plan, not an apply step.',
      'It does not deploy infrastructure, issue credentials, activate enforcement, or claim production readiness.',
      'Generated artifacts and readiness controls require customer review and downstream evidence before scoped enforcement can be considered.',
    ]),
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceOnboardingPacketDescriptor(): ActionSurfaceOnboardingPacketDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_ONBOARDING_PACKET_VERSION,
    statuses: ACTION_SURFACE_ONBOARDING_PACKET_STATUSES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
  });
}
