import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  ActionSurfaceOnboardingPacket,
  ActionSurfaceOnboardingSurfacePlan,
} from './action-surface-onboarding-packet.js';
import type {
  AttestorIntegrationModeReadiness,
  AttestorIntegrationNoGoReason,
} from './integration-mode-readiness.js';
import type {
  PolicyFoundryOnboardingSession,
} from './policy-foundry-onboarding-session.js';
import type {
  PolicyFoundryNoGoReason,
  PolicyFoundryReadinessEvaluation,
} from './policy-foundry-readiness.js';
import type {
  PolicyFoundryRedTeamReplayResult,
} from './policy-foundry-red-team-replay.js';

export const POLICY_FOUNDRY_COVERAGE_SCORE_VERSION =
  'attestor.policy-foundry-coverage-score.v1';

export const POLICY_FOUNDRY_COVERAGE_DIMENSIONS = [
  'action-surface-inventory',
  'shadow-traffic',
  'policy-twin',
  'policy-schema',
  'evidence-binding',
  'authority-binding',
  'verifier-or-gateway',
  'credential-isolation',
  'tenant-boundary',
  'replay-idempotency',
  'red-team-replay',
  'customer-approval',
  'generated-artifact-review',
] as const;
export type PolicyFoundryCoverageDimension =
  typeof POLICY_FOUNDRY_COVERAGE_DIMENSIONS[number];

export const POLICY_FOUNDRY_COVERAGE_DIMENSION_STATUSES = [
  'missing',
  'partial',
  'covered',
] as const;
export type PolicyFoundryCoverageDimensionStatus =
  typeof POLICY_FOUNDRY_COVERAGE_DIMENSION_STATUSES[number];

export const POLICY_FOUNDRY_COVERAGE_STATUSES = [
  'no-coverage',
  'needs-shadow-traffic',
  'needs-controls',
  'review-ready',
  'scoped-rollout-coverage-ready',
] as const;
export type PolicyFoundryCoverageStatus =
  typeof POLICY_FOUNDRY_COVERAGE_STATUSES[number];

export interface CreatePolicyFoundryCoverageScoreInput {
  readonly generatedAt?: string | null;
  readonly session: PolicyFoundryOnboardingSession;
  readonly onboardingPacket?: ActionSurfaceOnboardingPacket | null;
  readonly readiness?: PolicyFoundryReadinessEvaluation | null;
  readonly redTeamReplay?: PolicyFoundryRedTeamReplayResult | null;
  readonly integrationReadiness?: readonly AttestorIntegrationModeReadiness[] | null;
}

export interface PolicyFoundryCoverageDimensionScore {
  readonly dimension: PolicyFoundryCoverageDimension;
  readonly status: PolicyFoundryCoverageDimensionStatus;
  readonly score: number;
  readonly required: boolean;
  readonly reasonCodes: readonly string[];
}

export interface PolicyFoundrySurfaceCoverageScore {
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly score: number;
  readonly status: PolicyFoundryCoverageStatus;
  readonly eventCount: number;
  readonly declarationCount: number;
  readonly integrationMode: string | null;
  readonly bypassRisk: string | null;
  readonly nonBypassableClaimAllowed: false;
  readonly dimensions: readonly PolicyFoundryCoverageDimensionScore[];
  readonly missingDimensions: readonly PolicyFoundryCoverageDimension[];
  readonly partialDimensions: readonly PolicyFoundryCoverageDimension[];
  readonly nextCoverageStep: string;
}

export interface PolicyFoundryCoverageScore {
  readonly version: typeof POLICY_FOUNDRY_COVERAGE_SCORE_VERSION;
  readonly generatedAt: string;
  readonly sessionDigest: string;
  readonly sourceDigests: {
    readonly onboardingPacketDigest: string | null;
    readonly readinessDigest: string | null;
    readonly redTeamReplayDigest: string | null;
    readonly integrationReadinessDigests: readonly string[];
  };
  readonly status: PolicyFoundryCoverageStatus;
  readonly score: number;
  readonly surfaceCount: number;
  readonly coveredSurfaceCount: number;
  readonly missingDimensionCount: number;
  readonly partialDimensionCount: number;
  readonly surfaces: readonly PolicyFoundrySurfaceCoverageScore[];
  readonly blockedDimensions: readonly PolicyFoundryCoverageDimension[];
  readonly nextCoverageStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-coverage-score';
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryCoverageScoreDescriptor {
  readonly version: typeof POLICY_FOUNDRY_COVERAGE_SCORE_VERSION;
  readonly dimensions: typeof POLICY_FOUNDRY_COVERAGE_DIMENSIONS;
  readonly dimensionStatuses: typeof POLICY_FOUNDRY_COVERAGE_DIMENSION_STATUSES;
  readonly statuses: typeof POLICY_FOUNDRY_COVERAGE_STATUSES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-coverage-score';
}

interface SurfaceCoverageInput {
  readonly plan: ActionSurfaceOnboardingSurfacePlan | null;
  readonly session: PolicyFoundryOnboardingSession;
  readonly readiness: PolicyFoundryReadinessEvaluation | null;
  readonly redTeamReplay: PolicyFoundryRedTeamReplayResult | null;
  readonly integration: AttestorIntegrationModeReadiness | null;
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
    throw new Error(`Policy Foundry coverage score ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function dimensionScore(
  dimension: PolicyFoundryCoverageDimension,
  status: PolicyFoundryCoverageDimensionStatus,
  reasonCodes: readonly string[],
): PolicyFoundryCoverageDimensionScore {
  return Object.freeze({
    dimension,
    status,
    score: status === 'covered' ? 100 : status === 'partial' ? 50 : 0,
    required: true,
    reasonCodes: Object.freeze([...new Set(reasonCodes)].sort()),
  });
}

function hasPolicyNoGo(
  readiness: PolicyFoundryReadinessEvaluation | null,
  reasons: readonly PolicyFoundryNoGoReason[],
): boolean {
  if (readiness === null) return true;
  return reasons.some((reason) => readiness.noGoReasons.includes(reason));
}

function hasIntegrationNoGo(
  integration: AttestorIntegrationModeReadiness | null,
  reasons: readonly AttestorIntegrationNoGoReason[],
): boolean {
  if (integration === null) return true;
  return reasons.some((reason) => integration.noGoReasons.includes(reason));
}

function integrationReasonCodes(
  integration: AttestorIntegrationModeReadiness | null,
  reasons: readonly AttestorIntegrationNoGoReason[],
  fallback: string,
): readonly string[] {
  if (integration === null) return [fallback];
  return integration.noGoReasons.filter((reason) => reasons.includes(reason));
}

function dimensionScores(input: SurfaceCoverageInput): readonly PolicyFoundryCoverageDimensionScore[] {
  const { plan, readiness, redTeamReplay, integration } = input;
  const scores: PolicyFoundryCoverageDimensionScore[] = [];
  const eventCount = plan?.eventCount ?? input.session.shadowEventCount;
  const declarationCount = plan?.declarationCount ?? input.session.surfaceCount;

  scores.push(dimensionScore(
    'action-surface-inventory',
    declarationCount > 0 || plan !== null ? 'covered' : 'missing',
    declarationCount > 0 || plan !== null ? [] : ['action-surface-inventory-missing'],
  ));
  scores.push(dimensionScore(
    'shadow-traffic',
    eventCount > 0 ? 'covered' : 'missing',
    eventCount > 0 ? [] : ['shadow-traffic-missing'],
  ));
  scores.push(dimensionScore(
    'policy-twin',
    readiness !== null && !readiness.noGoReasons.includes('no-simulation-report')
      ? 'covered'
      : 'missing',
    readiness === null ? ['readiness-missing'] : readiness.noGoReasons.filter((reason) =>
      reason === 'no-simulation-report'
    ),
  ));
  scores.push(dimensionScore(
    'policy-schema',
    hasPolicyNoGo(readiness, ['missing-policy-schema']) ? 'missing' : 'covered',
    readiness === null ? ['readiness-missing'] : readiness.noGoReasons.filter((reason) =>
      reason === 'missing-policy-schema'
    ),
  ));
  scores.push(dimensionScore(
    'evidence-binding',
    hasPolicyNoGo(readiness, ['missing-evidence-coverage']) ? 'missing' : 'covered',
    readiness === null ? ['readiness-missing'] : readiness.noGoReasons.filter((reason) =>
      reason === 'missing-evidence-coverage'
    ),
  ));
  scores.push(dimensionScore(
    'authority-binding',
    hasPolicyNoGo(readiness, ['missing-authority-binding', 'llm-authority-source'])
      ? 'missing'
      : 'covered',
    readiness === null ? ['readiness-missing'] : readiness.noGoReasons.filter((reason) =>
      reason === 'missing-authority-binding' || reason === 'llm-authority-source'
    ),
  ));
  const verifierReasons = [
    'missing-downstream-contract',
    'missing-verifier',
    'missing-adapter-or-proxy',
    'missing-presentation-binding',
  ] as const;
  const verifierMissing = hasIntegrationNoGo(integration, verifierReasons);
  scores.push(dimensionScore(
    'verifier-or-gateway',
    verifierMissing ? (integration === null ? 'missing' : 'partial') : 'covered',
    integrationReasonCodes(integration, verifierReasons, 'integration-readiness-missing'),
  ));
  const credentialReasonCodes = integrationReasonCodes(
    integration,
    ['agent-direct-credential-exposed', 'missing-credential-isolation'],
    'integration-readiness-missing',
  );
  const credentialCovered = integration !== null &&
    credentialReasonCodes.length === 0 &&
    integration.credentialIsolation !== 'agent-held-static-secret';
  scores.push(dimensionScore(
    'credential-isolation',
    credentialCovered
      ? 'covered'
      : integration?.credentialIsolation === 'agent-held-scoped-secret'
        ? 'partial'
        : 'missing',
    credentialCovered ? [] : credentialReasonCodes.length > 0
      ? credentialReasonCodes
      : [`credential-isolation-${integration?.credentialIsolation ?? 'missing'}`],
  ));
  scores.push(dimensionScore(
    'tenant-boundary',
    hasPolicyNoGo(readiness, ['tenant-boundary-not-proven']) ||
      hasIntegrationNoGo(integration, ['missing-tenant-boundary'])
      ? 'missing'
      : 'covered',
    [
      ...(readiness?.noGoReasons.filter((reason) => reason === 'tenant-boundary-not-proven') ??
        ['readiness-missing']),
      ...integrationReasonCodes(integration, ['missing-tenant-boundary'], 'integration-readiness-missing'),
    ],
  ));
  const replayReasons = [
    'missing-replay-protection',
    'missing-idempotency-key',
    'missing-presentation-binding',
  ] as const;
  const replayMissing = hasPolicyNoGo(readiness, ['replay-duplicate-pressure']) ||
    hasIntegrationNoGo(integration, replayReasons);
  scores.push(dimensionScore(
    'replay-idempotency',
    replayMissing ? (integration === null ? 'missing' : 'partial') : 'covered',
    [
      ...(readiness?.noGoReasons.filter((reason) => reason === 'replay-duplicate-pressure') ??
        ['readiness-missing']),
      ...integrationReasonCodes(integration, replayReasons, 'integration-readiness-missing'),
    ],
  ));
  const replayStatus = redTeamReplay?.status ?? readiness?.confidence.redTeamReplayStatus ?? 'not-run';
  scores.push(dimensionScore(
    'red-team-replay',
    replayStatus === 'passed' ? 'covered' : 'missing',
    replayStatus === 'passed' ? [] : [`red-team-replay-${replayStatus}`],
  ));
  scores.push(dimensionScore(
    'customer-approval',
    hasPolicyNoGo(readiness, ['customer-approval-required']) ||
      hasIntegrationNoGo(integration, ['missing-customer-approval'])
      ? 'missing'
      : 'covered',
    [
      ...(readiness?.noGoReasons.filter((reason) => reason === 'customer-approval-required') ??
        ['readiness-missing']),
      ...integrationReasonCodes(integration, ['missing-customer-approval'], 'integration-readiness-missing'),
    ],
  ));
  scores.push(dimensionScore(
    'generated-artifact-review',
    hasIntegrationNoGo(integration, ['generated-artifacts-unreviewed'])
      ? integration === null ? 'missing' : 'partial'
      : 'covered',
    integrationReasonCodes(integration, ['generated-artifacts-unreviewed'], 'integration-readiness-missing'),
  ));
  return Object.freeze(scores);
}

function coverageStatus(input: {
  readonly score: number;
  readonly dimensions: readonly PolicyFoundryCoverageDimensionScore[];
  readonly integration: AttestorIntegrationModeReadiness | null;
}): PolicyFoundryCoverageStatus {
  if (input.score === 0) return 'no-coverage';
  if (input.dimensions.some((dimension) =>
    dimension.dimension === 'shadow-traffic' && dimension.status !== 'covered'
  )) {
    return 'needs-shadow-traffic';
  }
  if (input.dimensions.some((dimension) => dimension.status !== 'covered')) {
    return 'needs-controls';
  }
  if (input.integration?.status === 'scoped-enforce-eligible') {
    return 'scoped-rollout-coverage-ready';
  }
  return 'review-ready';
}

function nextCoverageStep(status: PolicyFoundryCoverageStatus): string {
  switch (status) {
    case 'no-coverage':
      return 'Provide action-surface inventory and shadow traffic before scoring rollout coverage.';
    case 'needs-shadow-traffic':
      return 'Send shadow traffic for the action surface before policy mining or rollout review.';
    case 'needs-controls':
      return 'Close missing coverage dimensions before asking for customer approval or scoped rollout review.';
    case 'review-ready':
      return 'Prepare customer review; coverage score does not activate enforcement.';
    case 'scoped-rollout-coverage-ready':
      return 'Prepare scoped rollout review; coverage score still does not prove production readiness.';
  }
}

function surfaceKey(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function surfaceInputs(input: CreatePolicyFoundryCoverageScoreInput): readonly SurfaceCoverageInput[] {
  const plans = input.onboardingPacket?.surfacePlans ?? [];
  const integrations = input.integrationReadiness ?? [];
  const keys = new Set<string>();
  for (const plan of plans) keys.add(surfaceKey(plan.actionSurface, 'session'));
  for (const integration of integrations) keys.add(surfaceKey(integration.actionSurface, integration.workflowId));
  if (input.session.actionSurface !== null) keys.add(input.session.actionSurface);
  if (keys.size === 0) keys.add('session');

  return Object.freeze([...keys].sort().map((key) => {
    const plan = plans.find((item) => item.actionSurface === key) ?? null;
    const integration = integrations.find((item) =>
      item.actionSurface === key || (plan !== null && item.workflowId === plan.surfaceId)
    ) ?? null;
    return Object.freeze({
      plan,
      session: input.session,
      readiness: input.readiness ?? null,
      redTeamReplay: input.redTeamReplay ?? null,
      integration,
    });
  }));
}

function surfaceScore(input: SurfaceCoverageInput): PolicyFoundrySurfaceCoverageScore {
  const dimensions = dimensionScores(input);
  const score = Math.round(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length,
  );
  const status = coverageStatus({
    score,
    dimensions,
    integration: input.integration,
  });
  const plan = input.plan;
  const actionSurface = plan?.actionSurface ?? input.integration?.actionSurface ?? input.session.actionSurface;
  const domain = plan?.domain ?? input.integration?.domain ?? input.session.domain;
  const downstreamSystem = plan?.downstreamSystem ??
    input.integration?.downstreamSystem ??
    input.session.downstreamSystem;
  const missingDimensions = Object.freeze(dimensions
    .filter((dimension) => dimension.status === 'missing')
    .map((dimension) => dimension.dimension));
  const partialDimensions = Object.freeze(dimensions
    .filter((dimension) => dimension.status === 'partial')
    .map((dimension) => dimension.dimension));
  return Object.freeze({
    actionSurface,
    domain,
    downstreamSystem,
    score,
    status,
    eventCount: plan?.eventCount ?? input.session.shadowEventCount,
    declarationCount: plan?.declarationCount ?? input.session.surfaceCount,
    integrationMode: input.integration?.mode ?? null,
    bypassRisk: input.integration?.bypassRisk ?? null,
    nonBypassableClaimAllowed: false,
    dimensions,
    missingDimensions,
    partialDimensions,
    nextCoverageStep: nextCoverageStep(status),
  });
}

export function createPolicyFoundryCoverageScore(
  input: CreatePolicyFoundryCoverageScoreInput,
): PolicyFoundryCoverageScore {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const surfaces = Object.freeze(surfaceInputs(input).map(surfaceScore));
  const score = surfaces.length === 0
    ? 0
    : Math.round(surfaces.reduce((sum, surface) => sum + surface.score, 0) / surfaces.length);
  const blockedDimensions = Object.freeze(
    [...new Set(surfaces.flatMap((surface) => [
      ...surface.missingDimensions,
      ...surface.partialDimensions,
    ]))].sort(),
  );
  const coveredSurfaceCount = surfaces.filter((surface) =>
    surface.status === 'review-ready' || surface.status === 'scoped-rollout-coverage-ready'
  ).length;
  const status: PolicyFoundryCoverageStatus = surfaces.length === 0
    ? 'no-coverage'
    : surfaces.some((surface) => surface.status === 'no-coverage')
      ? 'no-coverage'
      : surfaces.some((surface) => surface.status === 'needs-shadow-traffic')
        ? 'needs-shadow-traffic'
        : surfaces.some((surface) => surface.status === 'needs-controls')
          ? 'needs-controls'
          : surfaces.every((surface) => surface.status === 'scoped-rollout-coverage-ready')
            ? 'scoped-rollout-coverage-ready'
            : 'review-ready';
  const payload = {
    version: POLICY_FOUNDRY_COVERAGE_SCORE_VERSION as typeof POLICY_FOUNDRY_COVERAGE_SCORE_VERSION,
    generatedAt,
    sessionDigest: input.session.digest,
    sourceDigests: {
      onboardingPacketDigest: input.onboardingPacket?.digest ?? input.session.sourceDigests.onboardingPacketDigest,
      readinessDigest: input.readiness?.digest ?? input.session.sourceDigests.readinessDigest,
      redTeamReplayDigest: input.redTeamReplay?.digest ?? input.session.sourceDigests.redTeamReplayDigest,
      integrationReadinessDigests: Object.freeze(
        (input.integrationReadiness ?? [])
          .map((integration) => integration.digest)
          .sort(),
      ),
    },
    status,
    score,
    surfaceCount: surfaces.length,
    coveredSurfaceCount,
    missingDimensionCount: surfaces.reduce((sum, surface) => sum + surface.missingDimensions.length, 0),
    partialDimensionCount: surfaces.reduce((sum, surface) => sum + surface.partialDimensions.length, 0),
    surfaces,
    blockedDimensions,
    nextCoverageStep: nextCoverageStep(status),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    nonBypassableClaimAllowed: false as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-coverage-score' as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryCoverageScoreDescriptor(): PolicyFoundryCoverageScoreDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_COVERAGE_SCORE_VERSION,
    dimensions: POLICY_FOUNDRY_COVERAGE_DIMENSIONS,
    dimensionStatuses: POLICY_FOUNDRY_COVERAGE_DIMENSION_STATUSES,
    statuses: POLICY_FOUNDRY_COVERAGE_STATUSES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-coverage-score',
  });
}
