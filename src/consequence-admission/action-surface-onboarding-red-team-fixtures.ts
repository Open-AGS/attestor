import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceOnboardingPacket,
  ActionSurfaceOnboardingPacketStatus,
  ActionSurfaceOnboardingSurfacePlan,
} from './action-surface-onboarding-packet.js';

export const ACTION_SURFACE_ONBOARDING_RED_TEAM_FIXTURES_VERSION =
  'attestor.action-surface-onboarding-red-team-fixtures.v1';

export const ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_KINDS = [
  'unknown-actor',
  'missing-evidence',
  'missing-authority',
  'duplicate-request',
  'actor-burst',
  'foreign-tenant-record',
  'unsafe-proof-uri',
  'malicious-summary',
  'high-risk-auto-admit',
  'review-required-auto-promote',
  'direct-credential-bypass',
  'missing-verifier',
] as const;
export type ActionSurfaceOnboardingRedTeamCaseKind =
  typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_KINDS[number];

export const ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_SEVERITIES = [
  'medium',
  'high',
  'blocker',
] as const;
export type ActionSurfaceOnboardingRedTeamCaseSeverity =
  typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_SEVERITIES[number];

export const ACTION_SURFACE_ONBOARDING_RED_TEAM_EXPECTED_OUTCOMES = [
  'block',
  'review-required',
  'hold',
] as const;
export type ActionSurfaceOnboardingRedTeamExpectedOutcome =
  typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_EXPECTED_OUTCOMES[number];

export interface ActionSurfaceOnboardingRedTeamFixtureCase {
  readonly caseId: string;
  readonly kind: ActionSurfaceOnboardingRedTeamCaseKind;
  readonly actionSurface: string;
  readonly surfaceId: string;
  readonly recommendedIntegrationMode: ActionSurfaceOnboardingSurfacePlan['recommendedIntegrationMode'];
  readonly severity: ActionSurfaceOnboardingRedTeamCaseSeverity;
  readonly expectedOutcome: ActionSurfaceOnboardingRedTeamExpectedOutcome;
  readonly mappedPrinciples: readonly string[];
  readonly requiredControls: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly sourceReadinessDigest: string;
  readonly syntheticOnly: true;
  readonly rawPayloadStored: false;
  readonly executionAllowed: false;
  readonly digest: string;
}

export interface ActionSurfaceOnboardingRedTeamFixtureBundle {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_FIXTURES_VERSION;
  readonly generatedAt: string;
  readonly packetDigest: string;
  readonly packetStatus: ActionSurfaceOnboardingPacketStatus;
  readonly surfaceCount: number;
  readonly caseCount: number;
  readonly cases: readonly ActionSurfaceOnboardingRedTeamFixtureCase[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly evidenceReplayOnly: true;
  readonly limitations: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateActionSurfaceOnboardingRedTeamFixtureBundleInput {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly generatedAt?: string | null;
}

export interface ActionSurfaceOnboardingRedTeamFixtureDescriptor {
  readonly version: typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_FIXTURES_VERSION;
  readonly caseKinds: typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_KINDS;
  readonly expectedOutcomes: typeof ACTION_SURFACE_ONBOARDING_RED_TEAM_EXPECTED_OUTCOMES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly executionPlanOnly: true;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly evidenceReplayOnly: true;
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
    throw new Error(`Action surface onboarding red-team fixtures ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function directCredentialControl(plan: ActionSurfaceOnboardingSurfacePlan): readonly string[] {
  if (
    plan.credentialPosture === 'agent-held-static-secret' ||
    plan.credentialPosture === 'agent-held-scoped-secret' ||
    plan.credentialPosture === 'unknown'
  ) {
    return Object.freeze(['credential-isolation', 'gateway-held-secret-or-provider-delegation']);
  }
  return Object.freeze(['credential-boundary-regression-test']);
}

function caseSpec(
  kind: ActionSurfaceOnboardingRedTeamCaseKind,
  plan: ActionSurfaceOnboardingSurfacePlan,
): Omit<ActionSurfaceOnboardingRedTeamFixtureCase, 'caseId' | 'digest'> {
  switch (kind) {
    case 'unknown-actor':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'high',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['customer authority', 'tenant isolation']),
        requiredControls: Object.freeze(['actor-allowlist-or-authority-binding', 'tenant-boundary']),
        reasonCodes: Object.freeze(['unknown-actor-must-not-proceed']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'missing-evidence':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['proof integrity']),
        requiredControls: Object.freeze(['evidence-reference', 'proof-verifier']),
        reasonCodes: Object.freeze(['missing-evidence-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'missing-authority':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['customer authority']),
        requiredControls: Object.freeze(['authority-reference', 'approval-binding']),
        reasonCodes: Object.freeze(['missing-authority-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'duplicate-request':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'high',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['replay and idempotency safety']),
        requiredControls: Object.freeze(['presentation-replay-ledger', 'idempotency-key']),
        reasonCodes: Object.freeze(['duplicate-request-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'actor-burst':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'high',
        expectedOutcome: 'hold',
        mappedPrinciples: Object.freeze(['operational boundedness']),
        requiredControls: Object.freeze(['agent-loop-abuse-guard', 'shared-rate-limit-store']),
        reasonCodes: Object.freeze(['single-actor-burst-must-hold']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'foreign-tenant-record':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['tenant isolation']),
        requiredControls: Object.freeze(['tenant-boundary', 'foreign-record-rejection']),
        reasonCodes: Object.freeze(['foreign-tenant-record-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'unsafe-proof-uri':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'high',
        expectedOutcome: 'review-required',
        mappedPrinciples: Object.freeze(['proof integrity', 'data minimization and redaction']),
        requiredControls: Object.freeze(['safe-proof-reference-parser', 'no-raw-uri-replay']),
        reasonCodes: Object.freeze(['unsafe-proof-uri-must-not-auto-admit']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'malicious-summary':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'high',
        expectedOutcome: 'review-required',
        mappedPrinciples: Object.freeze(['customer authority', 'no overclaim']),
        requiredControls: Object.freeze(['reason-code-policy-check', 'prompt-injection-signal-review']),
        reasonCodes: Object.freeze(['malicious-summary-must-not-auto-admit']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'high-risk-auto-admit':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['fail-closed boundary', 'customer authority']),
        requiredControls: Object.freeze(['risk-threshold', 'review-threshold', 'policy-simulation']),
        reasonCodes: Object.freeze(['high-risk-auto-admit-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'review-required-auto-promote':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'hold',
        mappedPrinciples: Object.freeze(['fail-closed boundary', 'no overclaim']),
        requiredControls: Object.freeze(['customer-gate-review-deny-default', 'admit-or-narrow-only-proceed']),
        reasonCodes: Object.freeze(['review-required-must-not-proceed']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'direct-credential-bypass':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['customer authority', 'fail-closed boundary']),
        requiredControls: directCredentialControl(plan),
        reasonCodes: Object.freeze(['agent-direct-credential-bypass-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
    case 'missing-verifier':
      return {
        kind,
        actionSurface: plan.actionSurface,
        surfaceId: plan.surfaceId,
        recommendedIntegrationMode: plan.recommendedIntegrationMode,
        severity: 'blocker',
        expectedOutcome: 'block',
        mappedPrinciples: Object.freeze(['fail-closed boundary']),
        requiredControls: Object.freeze(['downstream-verifier', 'presentation-binding']),
        reasonCodes: Object.freeze(['missing-verifier-must-block']),
        sourceReadinessDigest: plan.readinessDigest,
        syntheticOnly: true,
        rawPayloadStored: false,
        executionAllowed: false,
      };
  }
}

function fixtureCase(
  kind: ActionSurfaceOnboardingRedTeamCaseKind,
  plan: ActionSurfaceOnboardingSurfacePlan,
): ActionSurfaceOnboardingRedTeamFixtureCase {
  const base = caseSpec(kind, plan);
  const digest = hashCanonical(base as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...base,
    caseId: `action-surface-red-team-case:${digest}`,
    digest,
  });
}

function fixtureCasesForPlan(
  plan: ActionSurfaceOnboardingSurfacePlan,
): readonly ActionSurfaceOnboardingRedTeamFixtureCase[] {
  return Object.freeze(
    ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_KINDS.map((kind) => fixtureCase(kind, plan)),
  );
}

export function createActionSurfaceOnboardingRedTeamFixtureBundle(
  input: CreateActionSurfaceOnboardingRedTeamFixtureBundleInput,
): ActionSurfaceOnboardingRedTeamFixtureBundle {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const cases = Object.freeze(
    input.packet.surfacePlans
      .flatMap((plan) => fixtureCasesForPlan(plan))
      .sort((left, right) =>
        left.actionSurface.localeCompare(right.actionSurface) ||
        left.kind.localeCompare(right.kind)
      ),
  );
  const body = {
    version: ACTION_SURFACE_ONBOARDING_RED_TEAM_FIXTURES_VERSION,
    generatedAt,
    packetDigest: input.packet.digest,
    packetStatus: input.packet.status,
    surfaceCount: input.packet.profileCount,
    caseCount: cases.length,
    cases,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    evidenceReplayOnly: true,
    limitations: Object.freeze([
      'Generated red-team fixtures are synthetic review plans only.',
      'They do not execute against customer infrastructure and do not prove production readiness.',
      'Passing these fixtures requires a separate reviewed replay or downstream test result.',
    ]),
  } as const;
  const canonical = canonicalObject(body as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...body,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function actionSurfaceOnboardingRedTeamFixtureDescriptor(): ActionSurfaceOnboardingRedTeamFixtureDescriptor {
  return Object.freeze({
    version: ACTION_SURFACE_ONBOARDING_RED_TEAM_FIXTURES_VERSION,
    caseKinds: ACTION_SURFACE_ONBOARDING_RED_TEAM_CASE_KINDS,
    expectedOutcomes: ACTION_SURFACE_ONBOARDING_RED_TEAM_EXPECTED_OUTCOMES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    executionPlanOnly: true,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    evidenceReplayOnly: true,
  });
}
