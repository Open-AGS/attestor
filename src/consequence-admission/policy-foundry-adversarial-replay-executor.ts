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

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION =
  'attestor.policy-foundry-adversarial-replay-executor.v1';

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_STATUSES = [
  'not-run',
  'passed',
  'failed',
] as const;
export type PolicyFoundryAdversarialReplayExecutorStatus =
  typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_STATUSES[number];

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES = [
  'synthetic-local',
  'sdk-verifier-local',
  'gateway-proxy-local',
  'mcp-tool-gateway-local',
  'sidecar-ext-authz-local',
  'provider-connector-local',
] as const;
export type PolicyFoundryAdversarialReplayExecutionMode =
  typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES[number];

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES = [
  'block',
  'review-required',
  'hold',
  'admit',
  'narrow',
  'proceed',
  'error',
  'not-run',
] as const;
export type PolicyFoundryAdversarialReplayObservedOutcome =
  typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES[number];

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_RESULT_STATUSES = [
  'passed',
  'failed',
  'missing',
] as const;
export type PolicyFoundryAdversarialReplayResultStatus =
  typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_RESULT_STATUSES[number];

export const POLICY_FOUNDRY_ADVERSARIAL_REPLAY_NO_GO_REASONS = [
  'fixture-bundle-missing',
  'missing-case-result',
  'unexpected-allow',
  'raw-payload-stored',
  'downstream-mutation-attempted',
  'credential-material-used',
  'invalid-evidence-digest',
] as const;
export type PolicyFoundryAdversarialReplayNoGoReason =
  typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_NO_GO_REASONS[number];

export interface PolicyFoundryAdversarialReplayObservation {
  readonly caseId: string;
  readonly observedOutcome: PolicyFoundryAdversarialReplayObservedOutcome;
  readonly observedAt?: string | null;
  readonly executionMode?: PolicyFoundryAdversarialReplayExecutionMode | null;
  readonly evidenceDigest?: string | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly rawPayloadStored?: boolean | null;
  readonly downstreamMutationAttempted?: boolean | null;
  readonly credentialMaterialUsed?: boolean | null;
}

export interface CreatePolicyFoundryAdversarialReplayExecutorInput {
  readonly generatedAt?: string | null;
  readonly fixtureBundle?: ActionSurfaceOnboardingRedTeamFixtureBundle | null;
  readonly observations?: readonly PolicyFoundryAdversarialReplayObservation[] | null;
}

export interface PolicyFoundryAdversarialReplayCaseResult {
  readonly caseId: string;
  readonly kind: ActionSurfaceOnboardingRedTeamFixtureCase['kind'];
  readonly actionSurface: string;
  readonly severity: ActionSurfaceOnboardingRedTeamFixtureCase['severity'];
  readonly expectedOutcome: ActionSurfaceOnboardingRedTeamExpectedOutcome;
  readonly observedOutcome: PolicyFoundryAdversarialReplayObservedOutcome | null;
  readonly status: PolicyFoundryAdversarialReplayResultStatus;
  readonly executionMode: PolicyFoundryAdversarialReplayExecutionMode | null;
  readonly evidenceDigest: string | null;
  readonly reasonCodes: readonly string[];
  readonly noGoReasons: readonly PolicyFoundryAdversarialReplayNoGoReason[];
}

export interface PolicyFoundryAdversarialReplayExecutor {
  readonly version: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION;
  readonly generatedAt: string;
  readonly status: PolicyFoundryAdversarialReplayExecutorStatus;
  readonly fixtureBundleDigest: string | null;
  readonly fixtureCaseCount: number;
  readonly observedCaseCount: number;
  readonly passedCaseCount: number;
  readonly failedCaseCount: number;
  readonly missingCaseCount: number;
  readonly blockerCaseCount: number;
  readonly noGoReasons: readonly PolicyFoundryAdversarialReplayNoGoReason[];
  readonly results: readonly PolicyFoundryAdversarialReplayCaseResult[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly syntheticOnly: true;
  readonly localExecutionOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-adversarial-replay-executor';
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryAdversarialReplayExecutorDescriptor {
  readonly version: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION;
  readonly statuses: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_STATUSES;
  readonly executionModes: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES;
  readonly observedOutcomes: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES;
  readonly resultStatuses: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_RESULT_STATUSES;
  readonly noGoReasons: typeof POLICY_FOUNDRY_ADVERSARIAL_REPLAY_NO_GO_REASONS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly syntheticOnly: true;
  readonly localExecutionOnly: true;
  readonly executesProductionTraffic: false;
  readonly downstreamMutationAllowed: false;
  readonly credentialUseAllowed: false;
  readonly reviewMaterialOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-adversarial-replay-executor';
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
    throw new Error(`Policy Foundry adversarial replay executor ${fieldName} must be an ISO timestamp.`);
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
  observations: readonly PolicyFoundryAdversarialReplayObservation[],
): ReadonlyMap<string, PolicyFoundryAdversarialReplayObservation> {
  const map = new Map<string, PolicyFoundryAdversarialReplayObservation>();
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

function caseNoGoReasons(input: {
  readonly fixture: ActionSurfaceOnboardingRedTeamFixtureCase;
  readonly observation: PolicyFoundryAdversarialReplayObservation | null;
}): readonly PolicyFoundryAdversarialReplayNoGoReason[] {
  const reasons = new Set<PolicyFoundryAdversarialReplayNoGoReason>();
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
  const evidence = input.observation.evidenceDigest?.trim();
  if (evidence && !isDigest(evidence)) reasons.add('invalid-evidence-digest');
  return Object.freeze([...reasons].sort());
}

function caseResult(input: {
  readonly fixture: ActionSurfaceOnboardingRedTeamFixtureCase;
  readonly observation: PolicyFoundryAdversarialReplayObservation | null;
}): PolicyFoundryAdversarialReplayCaseResult {
  const noGoReasons = caseNoGoReasons(input);
  const status: PolicyFoundryAdversarialReplayResultStatus = input.observation === null
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
    evidenceDigest: normalizeDigest(input.observation?.evidenceDigest),
    reasonCodes: safeReasonCodes(input.observation?.reasonCodes),
    noGoReasons,
  });
}

function nextSafeStep(input: {
  readonly status: PolicyFoundryAdversarialReplayExecutorStatus;
  readonly noGoReasons: readonly PolicyFoundryAdversarialReplayNoGoReason[];
}): string {
  if (input.noGoReasons.includes('fixture-bundle-missing')) {
    return 'Generate a synthetic red-team fixture bundle before running adversarial replay.';
  }
  if (input.noGoReasons.includes('downstream-mutation-attempted')) {
    return 'Stop replay and move the harness back to local synthetic mode before continuing.';
  }
  if (input.noGoReasons.includes('credential-material-used')) {
    return 'Remove credential material from the replay harness and rerun with synthetic/local inputs only.';
  }
  if (input.noGoReasons.includes('raw-payload-stored')) {
    return 'Remove raw payload capture from the replay result and rerun with digest-only evidence.';
  }
  if (input.noGoReasons.includes('unexpected-allow')) {
    return 'Keep the candidate blocked and fix the verifier/gateway behavior that allowed a negative case.';
  }
  if (input.noGoReasons.includes('missing-case-result')) {
    return 'Run all generated adversarial cases before using the replay report for customer review.';
  }
  if (input.status === 'not-run') return 'Run the generated adversarial cases in local synthetic mode.';
  return 'Use the passing replay report as review material only; production rollout still requires customer approval, verifier evidence, and deployment smoke tests.';
}

export function createPolicyFoundryAdversarialReplayExecutor(
  input: CreatePolicyFoundryAdversarialReplayExecutorInput = {},
): PolicyFoundryAdversarialReplayExecutor {
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
  const noGoReasons = new Set<PolicyFoundryAdversarialReplayNoGoReason>();
  if (fixtureBundle === null) noGoReasons.add('fixture-bundle-missing');
  for (const result of results) {
    for (const reason of result.noGoReasons) noGoReasons.add(reason);
  }
  const sortedNoGoReasons = Object.freeze([...noGoReasons].sort());
  const passedCaseCount = results.filter((result) => result.status === 'passed').length;
  const failedCaseCount = results.filter((result) => result.status === 'failed').length;
  const missingCaseCount = results.filter((result) => result.status === 'missing').length;
  const status: PolicyFoundryAdversarialReplayExecutorStatus = fixtureBundle === null || results.length === 0
    ? 'not-run'
    : failedCaseCount === 0 && missingCaseCount === 0
      ? 'passed'
      : 'failed';
  const payload: Omit<PolicyFoundryAdversarialReplayExecutor, 'canonical' | 'digest'> = {
    version: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION,
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
    noGoReasons: sortedNoGoReasons,
    results: Object.freeze(results),
    nextSafeStep: nextSafeStep({ status, noGoReasons: sortedNoGoReasons }),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    syntheticOnly: true,
    localExecutionOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    reviewMaterialOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-adversarial-replay-executor',
    limitation:
      'This executor normalizes local synthetic adversarial replay results. It does not call customer infrastructure, use credentials, mutate downstream systems, activate enforcement, or prove production readiness.',
  };
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function policyFoundryAdversarialReplayExecutorDescriptor():
PolicyFoundryAdversarialReplayExecutorDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_VERSION,
    statuses: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTOR_STATUSES,
    executionModes: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_EXECUTION_MODES,
    observedOutcomes: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_OBSERVED_OUTCOMES,
    resultStatuses: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_RESULT_STATUSES,
    noGoReasons: POLICY_FOUNDRY_ADVERSARIAL_REPLAY_NO_GO_REASONS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    syntheticOnly: true,
    localExecutionOnly: true,
    executesProductionTraffic: false,
    downstreamMutationAllowed: false,
    credentialUseAllowed: false,
    reviewMaterialOnly: true,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-adversarial-replay-executor',
  });
}
