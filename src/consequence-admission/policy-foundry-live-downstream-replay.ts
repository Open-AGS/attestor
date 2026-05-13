import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceOnboardingRedTeamExpectedOutcome,
  ActionSurfaceOnboardingRedTeamFixtureBundle,
  ActionSurfaceOnboardingRedTeamFixtureCase,
} from './action-surface-onboarding-red-team-fixtures.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyFoundryAdversarialReplayObservedOutcome,
} from './policy-foundry-adversarial-replay-executor.js';

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION =
  'attestor.policy-foundry-live-downstream-replay.v1';

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_STATUSES = [
  'not-run',
  'passed',
  'failed',
] as const;
export type PolicyFoundryLiveDownstreamReplayStatus =
  typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_STATUSES[number];

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES = [
  'gateway-proxy-sandbox',
  'sdk-verifier-sandbox',
  'mcp-tool-gateway-sandbox',
  'sidecar-ext-authz-sandbox',
  'provider-connector-sandbox',
  'customer-staging-dry-run',
] as const;
export type PolicyFoundryLiveDownstreamReplayExecutionMode =
  typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES[number];

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS = [
  'sandbox',
  'staging',
  'ephemeral-preview',
] as const;
export type PolicyFoundryLiveDownstreamReplayEnvironment =
  typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS[number];

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_RESULT_STATUSES = [
  'passed',
  'failed',
  'missing',
] as const;
export type PolicyFoundryLiveDownstreamReplayResultStatus =
  typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_RESULT_STATUSES[number];

export const POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_NO_GO_REASONS = [
  'fixture-bundle-missing',
  'missing-case-result',
  'unexpected-allow',
  'raw-payload-stored',
  'downstream-mutation-attempted',
  'credential-material-used',
  'production-traffic-attempted',
  'dry-run-proof-missing',
  'sandbox-boundary-unverified',
  'unapproved-network-egress',
  'invalid-evidence-digest',
  'invalid-dry-run-proof-digest',
] as const;
export type PolicyFoundryLiveDownstreamReplayNoGoReason =
  typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_NO_GO_REASONS[number];

export interface PolicyFoundryLiveDownstreamReplayObservation {
  readonly caseId: string;
  readonly observedOutcome: PolicyFoundryAdversarialReplayObservedOutcome;
  readonly observedAt?: string | null;
  readonly executionMode?: PolicyFoundryLiveDownstreamReplayExecutionMode | null;
  readonly environment?: PolicyFoundryLiveDownstreamReplayEnvironment | null;
  readonly evidenceDigest?: string | null;
  readonly dryRunProofDigest?: string | null;
  readonly downstreamReceiptDigest?: string | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly rawPayloadStored?: boolean | null;
  readonly downstreamMutationAttempted?: boolean | null;
  readonly credentialMaterialUsed?: boolean | null;
  readonly productionTrafficAttempted?: boolean | null;
  readonly dryRunConfirmed?: boolean | null;
  readonly sandboxBoundaryVerified?: boolean | null;
  readonly unapprovedNetworkEgress?: boolean | null;
}

export interface CreatePolicyFoundryLiveDownstreamReplayInput {
  readonly generatedAt?: string | null;
  readonly fixtureBundle?: ActionSurfaceOnboardingRedTeamFixtureBundle | null;
  readonly observations?: readonly PolicyFoundryLiveDownstreamReplayObservation[] | null;
}

export interface PolicyFoundryLiveDownstreamReplayCaseResult {
  readonly caseId: string;
  readonly kind: ActionSurfaceOnboardingRedTeamFixtureCase['kind'];
  readonly actionSurface: string;
  readonly severity: ActionSurfaceOnboardingRedTeamFixtureCase['severity'];
  readonly expectedOutcome: ActionSurfaceOnboardingRedTeamExpectedOutcome;
  readonly observedOutcome: PolicyFoundryAdversarialReplayObservedOutcome | null;
  readonly status: PolicyFoundryLiveDownstreamReplayResultStatus;
  readonly executionMode: PolicyFoundryLiveDownstreamReplayExecutionMode | null;
  readonly environment: PolicyFoundryLiveDownstreamReplayEnvironment | null;
  readonly evidenceDigest: string | null;
  readonly dryRunProofDigest: string | null;
  readonly downstreamReceiptDigest: string | null;
  readonly reasonCodes: readonly string[];
  readonly noGoReasons: readonly PolicyFoundryLiveDownstreamReplayNoGoReason[];
}

export interface PolicyFoundryLiveDownstreamReplay {
  readonly version: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION;
  readonly generatedAt: string;
  readonly status: PolicyFoundryLiveDownstreamReplayStatus;
  readonly fixtureBundleDigest: string | null;
  readonly fixtureCaseCount: number;
  readonly observedCaseCount: number;
  readonly passedCaseCount: number;
  readonly failedCaseCount: number;
  readonly missingCaseCount: number;
  readonly blockerCaseCount: number;
  readonly liveDownstreamObservationCount: number;
  readonly noGoReasons: readonly PolicyFoundryLiveDownstreamReplayNoGoReason[];
  readonly results: readonly PolicyFoundryLiveDownstreamReplayCaseResult[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly dryRunRequired: true;
  readonly sandboxOrStagingOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-live-downstream-replay';
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryLiveDownstreamReplayDescriptor {
  readonly version: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_STATUSES;
  readonly executionModes: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES;
  readonly environments: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS;
  readonly resultStatuses: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_RESULT_STATUSES;
  readonly noGoReasons: typeof POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_NO_GO_REASONS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly dryRunRequired: true;
  readonly sandboxOrStagingOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-live-downstream-replay';
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
    throw new Error(`Policy Foundry live downstream replay ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function isDigest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/iu.test(value);
}

function normalizeDigest(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.length === 0) return null;
  return isDigest(normalized) ? normalized : null;
}

function safeReasonCodes(values: readonly string[] | null | undefined): readonly string[] {
  if (!values) return Object.freeze([]);
  return Object.freeze([...new Set(values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-z0-9:._-]{1,96}$/u.test(value)))].sort());
}

function observationMap(
  observations: readonly PolicyFoundryLiveDownstreamReplayObservation[],
): ReadonlyMap<string, PolicyFoundryLiveDownstreamReplayObservation> {
  const map = new Map<string, PolicyFoundryLiveDownstreamReplayObservation>();
  for (const observation of observations) {
    if (observation.caseId.trim().length === 0) continue;
    if (!map.has(observation.caseId)) map.set(observation.caseId, observation);
  }
  return map;
}

function outcomeSatisfiesExpected(
  expected: ActionSurfaceOnboardingRedTeamExpectedOutcome,
  observed: PolicyFoundryAdversarialReplayObservedOutcome,
): boolean {
  if (expected === 'block') return observed === 'block';
  if (expected === 'review-required') {
    return observed === 'review-required' || observed === 'hold' || observed === 'block';
  }
  return observed === 'hold' || observed === 'block';
}

function digestNoGo(
  value: string | null | undefined,
  reason: PolicyFoundryLiveDownstreamReplayNoGoReason,
  reasons: Set<PolicyFoundryLiveDownstreamReplayNoGoReason>,
): void {
  const normalized = value?.trim();
  if (normalized && !isDigest(normalized)) reasons.add(reason);
}

function caseNoGoReasons(input: {
  readonly fixture: ActionSurfaceOnboardingRedTeamFixtureCase;
  readonly observation: PolicyFoundryLiveDownstreamReplayObservation | null;
}): readonly PolicyFoundryLiveDownstreamReplayNoGoReason[] {
  const reasons = new Set<PolicyFoundryLiveDownstreamReplayNoGoReason>();
  if (input.observation === null) {
    reasons.add('missing-case-result');
    return Object.freeze([...reasons].sort());
  }
  const observed = input.observation.observedOutcome;
  if (!outcomeSatisfiesExpected(input.fixture.expectedOutcome, observed)) {
    reasons.add('unexpected-allow');
  }
  if (input.observation.rawPayloadStored === true) reasons.add('raw-payload-stored');
  if (input.observation.downstreamMutationAttempted === true) {
    reasons.add('downstream-mutation-attempted');
  }
  if (input.observation.credentialMaterialUsed === true) reasons.add('credential-material-used');
  if (input.observation.productionTrafficAttempted === true) reasons.add('production-traffic-attempted');
  if (input.observation.unapprovedNetworkEgress === true) reasons.add('unapproved-network-egress');
  if (input.observation.dryRunConfirmed !== true) reasons.add('dry-run-proof-missing');
  if (input.observation.sandboxBoundaryVerified !== true) reasons.add('sandbox-boundary-unverified');
  if (!normalizeDigest(input.observation.dryRunProofDigest)) reasons.add('dry-run-proof-missing');
  digestNoGo(input.observation.evidenceDigest, 'invalid-evidence-digest', reasons);
  digestNoGo(input.observation.downstreamReceiptDigest, 'invalid-evidence-digest', reasons);
  digestNoGo(input.observation.dryRunProofDigest, 'invalid-dry-run-proof-digest', reasons);
  return Object.freeze([...reasons].sort());
}

function caseResult(input: {
  readonly fixture: ActionSurfaceOnboardingRedTeamFixtureCase;
  readonly observation: PolicyFoundryLiveDownstreamReplayObservation | null;
}): PolicyFoundryLiveDownstreamReplayCaseResult {
  const noGoReasons = caseNoGoReasons(input);
  const status: PolicyFoundryLiveDownstreamReplayResultStatus = input.observation === null
    ? 'missing'
    : noGoReasons.length === 0
      ? 'passed'
      : 'failed';
  return Object.freeze({
    caseId: input.fixture.caseId,
    kind: input.fixture.kind,
    actionSurface: input.fixture.actionSurface,
    severity: input.fixture.severity,
    expectedOutcome: input.fixture.expectedOutcome,
    observedOutcome: input.observation?.observedOutcome ?? null,
    status,
    executionMode: input.observation?.executionMode ?? null,
    environment: input.observation?.environment ?? null,
    evidenceDigest: normalizeDigest(input.observation?.evidenceDigest),
    dryRunProofDigest: normalizeDigest(input.observation?.dryRunProofDigest),
    downstreamReceiptDigest: normalizeDigest(input.observation?.downstreamReceiptDigest),
    reasonCodes: safeReasonCodes(input.observation?.reasonCodes),
    noGoReasons,
  });
}

function nextSafeStep(input: {
  readonly status: PolicyFoundryLiveDownstreamReplayStatus;
  readonly noGoReasons: readonly PolicyFoundryLiveDownstreamReplayNoGoReason[];
}): string {
  if (input.noGoReasons.includes('fixture-bundle-missing')) {
    return 'Generate a red-team fixture bundle before live downstream replay.';
  }
  if (input.noGoReasons.includes('production-traffic-attempted')) {
    return 'Stop replay and move the harness to sandbox, staging, or ephemeral preview before continuing.';
  }
  if (input.noGoReasons.includes('downstream-mutation-attempted')) {
    return 'Stop replay and require dry-run or non-mutating verifier mode before continuing.';
  }
  if (input.noGoReasons.includes('credential-material-used')) {
    return 'Remove credential material from the replay harness and rerun with scoped test credentials or redacted proof only.';
  }
  if (input.noGoReasons.includes('dry-run-proof-missing')) {
    return 'Attach digest-bound dry-run proof from the gateway, verifier, or provider before using the report.';
  }
  if (input.noGoReasons.includes('sandbox-boundary-unverified')) {
    return 'Verify the replay target is sandbox, staging, or ephemeral preview before continuing.';
  }
  if (input.noGoReasons.includes('unexpected-allow')) {
    return 'Keep the candidate blocked and fix the downstream verifier/gateway that allowed a negative case.';
  }
  if (input.noGoReasons.includes('missing-case-result')) {
    return 'Run every generated replay case before using the report for rollout review.';
  }
  if (input.status === 'not-run') return 'Run the fixture bundle through a non-mutating sandbox or staging replay harness.';
  return 'Use the passing live downstream replay report as review evidence only; deployment still requires customer approval, rollout wiring, and smoke tests.';
}

export function createPolicyFoundryLiveDownstreamReplay(
  input: CreatePolicyFoundryLiveDownstreamReplayInput = {},
): PolicyFoundryLiveDownstreamReplay {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date(0).toISOString(),
    'generatedAt',
  );
  const fixtureBundle = input.fixtureBundle ?? null;
  const observations = input.observations ?? [];
  const observationsByCase = observationMap(observations);
  const results = fixtureBundle === null
    ? []
    : fixtureBundle.cases.map((fixture) =>
      caseResult({
        fixture,
        observation: observationsByCase.get(fixture.caseId) ?? null,
      })
    );
  const noGoReasons = new Set<PolicyFoundryLiveDownstreamReplayNoGoReason>();
  if (fixtureBundle === null) noGoReasons.add('fixture-bundle-missing');
  for (const result of results) {
    for (const reason of result.noGoReasons) noGoReasons.add(reason);
  }
  const sortedNoGoReasons = Object.freeze([...noGoReasons].sort());
  const passedCaseCount = results.filter((result) => result.status === 'passed').length;
  const failedCaseCount = results.filter((result) => result.status === 'failed').length;
  const missingCaseCount = results.filter((result) => result.status === 'missing').length;
  const status: PolicyFoundryLiveDownstreamReplayStatus = fixtureBundle === null || results.length === 0
    ? 'not-run'
    : failedCaseCount === 0 && missingCaseCount === 0
      ? 'passed'
      : 'failed';
  const payload: Omit<PolicyFoundryLiveDownstreamReplay, 'canonical' | 'digest'> = {
    version: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION,
    generatedAt,
    status,
    fixtureBundleDigest: fixtureBundle?.digest ?? null,
    fixtureCaseCount: fixtureBundle?.caseCount ?? 0,
    observedCaseCount: observationsByCase.size,
    passedCaseCount,
    failedCaseCount,
    missingCaseCount,
    blockerCaseCount: results.filter((result) =>
      result.status !== 'passed' && result.severity === 'blocker'
    ).length,
    liveDownstreamObservationCount: results.filter((result) =>
      result.executionMode !== null && result.environment !== null
    ).length,
    noGoReasons: sortedNoGoReasons,
    results: Object.freeze(results),
    nextSafeStep: nextSafeStep({ status, noGoReasons: sortedNoGoReasons }),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    dryRunRequired: true,
    sandboxOrStagingOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    reviewMaterialOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-live-downstream-replay',
    limitation:
      'This contract normalizes non-mutating sandbox/staging downstream replay evidence. It does not execute production traffic, use live credential material, activate enforcement, or prove production readiness.',
  };
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function policyFoundryLiveDownstreamReplayDescriptor():
PolicyFoundryLiveDownstreamReplayDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_VERSION,
    statuses: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_STATUSES,
    executionModes: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_EXECUTION_MODES,
    environments: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_ENVIRONMENTS,
    resultStatuses: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_RESULT_STATUSES,
    noGoReasons: POLICY_FOUNDRY_LIVE_DOWNSTREAM_REPLAY_NO_GO_REASONS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    dryRunRequired: true,
    sandboxOrStagingOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    reviewMaterialOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-live-downstream-replay',
  });
}
