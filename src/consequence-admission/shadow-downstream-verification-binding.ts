import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowPolicyPromotionSimulation,
  ShadowPolicyPromotionRuleSimulation,
} from './shadow-policy-promotion-simulation.js';

export const SHADOW_DOWNSTREAM_VERIFICATION_BINDING_VERSION =
  'attestor.shadow-downstream-verification-binding.v1';
export const SHADOW_DOWNSTREAM_VERIFICATION_BINDING_MAX_RULES = 1_000;

export const SHADOW_DOWNSTREAM_VERIFICATION_CHECKS = [
  'verify-artifact-signature',
  'verify-source-digests',
  'verify-tenant-scope',
  'verify-rule-binding',
  'verify-admission-digest',
  'verify-downstream-scope',
  'verify-replay-protection',
  'verify-freshness',
  'hold-on-mismatch',
] as const;
export type ShadowDownstreamVerificationCheckKind =
  typeof SHADOW_DOWNSTREAM_VERIFICATION_CHECKS[number];

export const SHADOW_DOWNSTREAM_REQUIRED_CLAIMS = [
  'tenantId',
  'sourcePacketDigest',
  'sourceBundleDraftDigest',
  'sourceSimulationDigest',
  'ruleId',
  'candidateDigest',
  'targetMode',
  'admissionDigest',
  'downstreamSystem',
  'audience',
  'expiresAt',
  'replayNonce',
] as const;
export type ShadowDownstreamRequiredClaim =
  typeof SHADOW_DOWNSTREAM_REQUIRED_CLAIMS[number];

export interface ShadowDownstreamVerificationCheck {
  readonly check: ShadowDownstreamVerificationCheckKind;
  readonly required: true;
  readonly failClosed: true;
  readonly summary: string;
  readonly bindingFields: readonly string[];
}

export interface ShadowDownstreamRuleVerificationBinding {
  readonly ruleId: string;
  readonly sourceRuleDigest: string;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly sourceReportDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly targetMode: ShadowPolicyPromotionRuleSimulation['targetMode'];
  readonly matchedEventCount: number;
  readonly matchedEventSetDigest: string;
  readonly suggestedValidationActions: ShadowPolicyPromotionRuleSimulation['suggestedValidationActions'];
  readonly requiredControls: ShadowPolicyPromotionRuleSimulation['requiredControls'];
  readonly requiredClaims: typeof SHADOW_DOWNSTREAM_REQUIRED_CLAIMS;
  readonly failClosedOnMismatch: true;
}

export interface ShadowDownstreamVerificationBinding {
  readonly version: typeof SHADOW_DOWNSTREAM_VERIFICATION_BINDING_VERSION;
  readonly bindingId: string;
  readonly generatedAt: string;
  readonly tenantId: string;
  readonly sourceSimulationId: string;
  readonly sourceSimulationDigest: string;
  readonly sourcePacketId: string;
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
  readonly eventCount: number;
  readonly matchedEventCount: number;
  readonly ruleCount: number;
  readonly ruleBindings: readonly ShadowDownstreamRuleVerificationBinding[];
  readonly requiredVerificationChecks: readonly ShadowDownstreamVerificationCheck[];
  readonly downstreamVerificationDraftReady: boolean;
  readonly activationReady: false;
  readonly remainingActivationBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowDownstreamVerificationBindingInput {
  readonly simulation: ShadowPolicyPromotionSimulation;
  readonly generatedAt?: string | null;
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
    throw new Error(`Shadow downstream verification binding ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function createCheck(
  check: ShadowDownstreamVerificationCheckKind,
  summary: string,
  bindingFields: readonly string[],
): ShadowDownstreamVerificationCheck {
  return Object.freeze({
    check,
    required: true,
    failClosed: true,
    summary,
    bindingFields: Object.freeze([...bindingFields].sort()),
  });
}

function requiredVerificationChecks(): readonly ShadowDownstreamVerificationCheck[] {
  return Object.freeze([
    createCheck(
      'verify-artifact-signature',
      'Verify the Attestor-signed artifact chain before trusting any promotion output.',
      ['sourcePacketDigest', 'sourceBundleDraftDigest', 'sourceSimulationDigest'],
    ),
    createCheck(
      'verify-source-digests',
      'Require the packet, bundle draft, simulation, rule, and candidate digests to match the binding.',
      ['candidateDigest', 'sourceBundleDraftDigest', 'sourcePacketDigest', 'sourceRuleDigest', 'sourceSimulationDigest'],
    ),
    createCheck(
      'verify-tenant-scope',
      'Require the downstream request tenant to match the binding tenant.',
      ['tenantId'],
    ),
    createCheck(
      'verify-rule-binding',
      'Require the downstream action to match an approved rule binding before execution.',
      ['actionSurface', 'domain', 'ruleId', 'targetMode'],
    ),
    createCheck(
      'verify-admission-digest',
      'Require the runtime admission digest to be presented and matched before the consequence executes.',
      ['admissionDigest'],
    ),
    createCheck(
      'verify-downstream-scope',
      'Require the downstream enforcement point to verify its own system/scope binding.',
      ['downstreamSystem'],
    ),
    createCheck(
      'verify-replay-protection',
      'Require a fresh replay nonce or idempotency key so a prior admission cannot be reused.',
      ['replayNonce'],
    ),
    createCheck(
      'verify-freshness',
      'Require an expiry or freshness window for the admission and binding material.',
      ['expiresAt'],
    ),
    createCheck(
      'hold-on-mismatch',
      'Hold the consequence if any required binding check cannot close.',
      ['failClosedOnMismatch'],
    ),
  ]);
}

function ruleDigest(rule: ShadowPolicyPromotionRuleSimulation): string {
  return hashCanonical({
    ruleId: rule.ruleId,
    candidateDigest: rule.candidateDigest,
    sourceReportDigest: rule.sourceReportDigest,
    actionSurface: rule.actionSurface,
    domain: rule.domain,
    targetMode: rule.targetMode,
    suggestedValidationActions: rule.suggestedValidationActions,
    requiredControls: rule.requiredControls,
  } as unknown as CanonicalReleaseJsonValue);
}

function matchedEventSetDigest(rule: ShadowPolicyPromotionRuleSimulation): string {
  return hashCanonical({
    ruleId: rule.ruleId,
    matchedEventDigests: rule.matchedEventDigests,
  } as unknown as CanonicalReleaseJsonValue);
}

function createRuleBinding(
  rule: ShadowPolicyPromotionRuleSimulation,
): ShadowDownstreamRuleVerificationBinding {
  return Object.freeze({
    ruleId: rule.ruleId,
    sourceRuleDigest: ruleDigest(rule),
    candidateId: rule.candidateId,
    candidateDigest: rule.candidateDigest,
    sourceReportDigest: rule.sourceReportDigest,
    actionSurface: rule.actionSurface,
    domain: rule.domain,
    targetMode: rule.targetMode,
    matchedEventCount: rule.eventCount,
    matchedEventSetDigest: matchedEventSetDigest(rule),
    suggestedValidationActions: rule.suggestedValidationActions,
    requiredControls: rule.requiredControls,
    requiredClaims: SHADOW_DOWNSTREAM_REQUIRED_CLAIMS,
    failClosedOnMismatch: true,
  });
}

function bindingIdFor(input: {
  readonly tenantId: string;
  readonly sourceSimulationDigest: string;
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
}): string {
  return `downstream-verification-binding:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function remainingActivationBlockers(input: {
  readonly simulation: ShadowPolicyPromotionSimulation;
  readonly draftReady: boolean;
}): readonly string[] {
  const blockers = new Set(input.simulation.remainingActivationBlockers);
  if (input.draftReady) {
    blockers.delete('downstream-verification-required');
    blockers.add('downstream-integration-proof-required');
  } else {
    blockers.add('downstream-verification-required');
  }
  return Object.freeze([...blockers].sort());
}

export function createShadowDownstreamVerificationBinding(
  input: CreateShadowDownstreamVerificationBindingInput,
): ShadowDownstreamVerificationBinding {
  const simulation = input.simulation;
  if (simulation.ruleSimulations.length > SHADOW_DOWNSTREAM_VERIFICATION_BINDING_MAX_RULES) {
    throw new Error(
      `Shadow downstream verification binding rule count exceeds maximum: ${simulation.ruleSimulations.length} > ${SHADOW_DOWNSTREAM_VERIFICATION_BINDING_MAX_RULES}.`,
    );
  }
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const ruleBindings = Object.freeze(
    simulation.ruleSimulations
      .map(createRuleBinding)
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
  const downstreamVerificationDraftReady = simulation.simulationReady && ruleBindings.length > 0;
  const payload = {
    version: SHADOW_DOWNSTREAM_VERIFICATION_BINDING_VERSION,
    bindingId: bindingIdFor({
      tenantId: simulation.tenantId,
      sourceSimulationDigest: simulation.digest,
      sourcePacketDigest: simulation.sourcePacketDigest,
      sourceBundleDraftDigest: simulation.sourceBundleDraftDigest,
    }),
    generatedAt,
    tenantId: simulation.tenantId,
    sourceSimulationId: simulation.simulationId,
    sourceSimulationDigest: simulation.digest,
    sourcePacketId: simulation.sourcePacketId,
    sourcePacketDigest: simulation.sourcePacketDigest,
    sourceBundleDraftDigest: simulation.sourceBundleDraftDigest,
    eventCount: simulation.eventCount,
    matchedEventCount: simulation.matchedEventCount,
    ruleCount: ruleBindings.length,
    ruleBindings,
    requiredVerificationChecks: requiredVerificationChecks(),
    downstreamVerificationDraftReady,
    activationReady: false,
    remainingActivationBlockers: remainingActivationBlockers({
      simulation,
      draftReady: downstreamVerificationDraftReady,
    }),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
