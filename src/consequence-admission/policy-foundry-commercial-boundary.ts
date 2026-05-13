import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_VERSION =
  'attestor.policy-foundry-commercial-boundary.v1';

export const POLICY_FOUNDRY_COMMERCIAL_PLANS = [
  'developer',
  'trial',
  'starter',
  'pro',
  'scale',
  'enterprise',
] as const;
export type PolicyFoundryCommercialPlan =
  typeof POLICY_FOUNDRY_COMMERCIAL_PLANS[number];

export const POLICY_FOUNDRY_COMMERCIAL_POSTURES = [
  'evaluation-only',
  'trial-shadow-discovery',
  'single-workflow-production',
  'growth-production',
  'high-volume-production',
  'customer-operated-enterprise',
] as const;
export type PolicyFoundryCommercialPosture =
  typeof POLICY_FOUNDRY_COMMERCIAL_POSTURES[number];

export const POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES = [
  'basic-shadow-summary',
  'action-risk-inventory',
  'limited-policy-candidate-preview',
  'policy-twin-preview',
  'readiness-no-go-scoring-preview',
  'active-questions',
  'review-enforce-ladder',
  'short-retention-audit-export',
  'advanced-confidence-scoring',
  'candidate-red-team-replay',
  'multiple-workflows',
  'rbac-sso',
  'dual-approval',
  'longer-retention',
  'custom-templates',
  'drift-policy-debt-detection',
  'customer-operated-deployment',
  'regulated-deployment-boundary',
  'custom-pack-boundary',
] as const;
export type PolicyFoundryCommercialCapability =
  typeof POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES[number];

export const POLICY_FOUNDRY_SAFETY_MINIMUMS = [
  'redaction',
  'proof-verification',
  'tenant-isolation',
  'fail-closed-semantics',
  'shadow-never-auto-enforces',
  'approval-required-promotion',
  'deterministic-controls',
  'offline-verifier-access',
  'replay-idempotency-safety',
] as const;
export type PolicyFoundrySafetyMinimum =
  typeof POLICY_FOUNDRY_SAFETY_MINIMUMS[number];

export const POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_NO_GO_REASONS = [
  'unsupported-plan',
  'requested-capability-not-in-plan',
  'production-enforcement-not-in-plan',
  'customer-operated-deployment-not-in-plan',
  'safety-minimum-paywalled',
  'shadow-auto-enforce-requested',
] as const;
export type PolicyFoundryCommercialBoundaryNoGoReason =
  typeof POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_NO_GO_REASONS[number];

export interface PolicyFoundryCommercialPlanBoundary {
  readonly plan: PolicyFoundryCommercialPlan;
  readonly posture: PolicyFoundryCommercialPosture;
  readonly paidPlan: boolean;
  readonly hostedProductionAllowed: boolean;
  readonly customerOperatedAllowed: boolean;
  readonly maxProductionWorkflows: number | null;
  readonly auditRetentionDays: number | null;
  readonly includedCapabilities: readonly PolicyFoundryCommercialCapability[];
  readonly safetyMinimums: typeof POLICY_FOUNDRY_SAFETY_MINIMUMS;
}

export interface CreatePolicyFoundryCommercialBoundaryInput {
  readonly generatedAt?: string | null;
  readonly plan?: PolicyFoundryCommercialPlan | string | null;
  readonly requestedCapabilities?: readonly string[] | null;
  readonly blockedSafetyMinimums?: readonly string[] | null;
  readonly requestedProductionWorkflowCount?: number | null;
  readonly requestedHostedProduction?: boolean | null;
  readonly requestedCustomerOperatedDeployment?: boolean | null;
  readonly shadowAutoEnforceRequested?: boolean | null;
}

export interface PolicyFoundryCommercialBoundary {
  readonly version: typeof POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_VERSION;
  readonly generatedAt: string;
  readonly plan: PolicyFoundryCommercialPlan | 'unsupported';
  readonly planSupported: boolean;
  readonly posture: PolicyFoundryCommercialPosture | 'unsupported';
  readonly paidPlan: boolean;
  readonly hostedProductionAllowed: boolean;
  readonly customerOperatedAllowed: boolean;
  readonly maxProductionWorkflows: number | null;
  readonly auditRetentionDays: number | null;
  readonly requestedProductionWorkflowCount: number;
  readonly productionWorkflowRequestAllowed: boolean;
  readonly requestedHostedProduction: boolean;
  readonly requestedCustomerOperatedDeployment: boolean;
  readonly requestedCapabilities: readonly string[];
  readonly allowedCapabilities: readonly PolicyFoundryCommercialCapability[];
  readonly unavailableCapabilities: readonly string[];
  readonly safetyMinimums: typeof POLICY_FOUNDRY_SAFETY_MINIMUMS;
  readonly blockedSafetyMinimums: readonly string[];
  readonly safetyFloorViolationCount: number;
  readonly noGoReasons: readonly PolicyFoundryCommercialBoundaryNoGoReason[];
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly commercialBoundaryOnly: true;
  readonly safetyMinimumsPaidOnlyAllowed: false;
  readonly entitlementDecisionAuthority: false;
  readonly billingStateRequiredForSafetyMinimums: false;
  readonly deploymentEntitlementEnforcementImplemented: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-commercial-boundary';
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryCommercialBoundaryDescriptor {
  readonly version: typeof POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_VERSION;
  readonly plans: typeof POLICY_FOUNDRY_COMMERCIAL_PLANS;
  readonly postures: typeof POLICY_FOUNDRY_COMMERCIAL_POSTURES;
  readonly capabilities: typeof POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES;
  readonly safetyMinimums: typeof POLICY_FOUNDRY_SAFETY_MINIMUMS;
  readonly noGoReasons: typeof POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_NO_GO_REASONS;
  readonly planBoundaries: readonly PolicyFoundryCommercialPlanBoundary[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly commercialBoundaryOnly: true;
  readonly safetyMinimumsPaidOnlyAllowed: false;
  readonly entitlementDecisionAuthority: false;
  readonly billingStateRequiredForSafetyMinimums: false;
  readonly deploymentEntitlementEnforcementImplemented: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-commercial-boundary';
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
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Policy Foundry commercial boundary generatedAt must be an ISO timestamp.');
  }
  return timestamp.toISOString();
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-z0-9._-]{1,96}$/u.test(value)))].sort());
}

function isPlan(value: string): value is PolicyFoundryCommercialPlan {
  return (POLICY_FOUNDRY_COMMERCIAL_PLANS as readonly string[]).includes(value);
}

function isCapability(value: string): value is PolicyFoundryCommercialCapability {
  return (POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES as readonly string[]).includes(value);
}

function isSafetyMinimum(value: string): value is PolicyFoundrySafetyMinimum {
  return (POLICY_FOUNDRY_SAFETY_MINIMUMS as readonly string[]).includes(value);
}

const baseCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  'basic-shadow-summary',
  'action-risk-inventory',
  'limited-policy-candidate-preview',
]);

const trialCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  ...baseCapabilities,
  'policy-twin-preview',
  'readiness-no-go-scoring-preview',
  'active-questions',
]);

const starterCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  ...trialCapabilities,
  'review-enforce-ladder',
  'short-retention-audit-export',
]);

const proCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  ...starterCapabilities,
  'advanced-confidence-scoring',
  'candidate-red-team-replay',
  'multiple-workflows',
  'rbac-sso',
  'dual-approval',
  'longer-retention',
]);

const scaleCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  ...proCapabilities,
  'custom-templates',
  'drift-policy-debt-detection',
]);

const enterpriseCapabilities: readonly PolicyFoundryCommercialCapability[] = Object.freeze([
  ...scaleCapabilities,
  'customer-operated-deployment',
  'regulated-deployment-boundary',
  'custom-pack-boundary',
]);

const PLAN_BOUNDARIES: readonly PolicyFoundryCommercialPlanBoundary[] = Object.freeze([
  Object.freeze({
    plan: 'developer',
    posture: 'evaluation-only',
    paidPlan: false,
    hostedProductionAllowed: false,
    customerOperatedAllowed: false,
    maxProductionWorkflows: 0,
    auditRetentionDays: 7,
    includedCapabilities: baseCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
  Object.freeze({
    plan: 'trial',
    posture: 'trial-shadow-discovery',
    paidPlan: false,
    hostedProductionAllowed: false,
    customerOperatedAllowed: false,
    maxProductionWorkflows: 0,
    auditRetentionDays: null,
    includedCapabilities: trialCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
  Object.freeze({
    plan: 'starter',
    posture: 'single-workflow-production',
    paidPlan: true,
    hostedProductionAllowed: true,
    customerOperatedAllowed: false,
    maxProductionWorkflows: 1,
    auditRetentionDays: 30,
    includedCapabilities: starterCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
  Object.freeze({
    plan: 'pro',
    posture: 'growth-production',
    paidPlan: true,
    hostedProductionAllowed: true,
    customerOperatedAllowed: false,
    maxProductionWorkflows: 25,
    auditRetentionDays: 365,
    includedCapabilities: proCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
  Object.freeze({
    plan: 'scale',
    posture: 'high-volume-production',
    paidPlan: true,
    hostedProductionAllowed: true,
    customerOperatedAllowed: false,
    maxProductionWorkflows: null,
    auditRetentionDays: 1095,
    includedCapabilities: scaleCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
  Object.freeze({
    plan: 'enterprise',
    posture: 'customer-operated-enterprise',
    paidPlan: true,
    hostedProductionAllowed: true,
    customerOperatedAllowed: true,
    maxProductionWorkflows: null,
    auditRetentionDays: null,
    includedCapabilities: enterpriseCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
  }),
]);

function planBoundaryFor(plan: PolicyFoundryCommercialPlan): PolicyFoundryCommercialPlanBoundary {
  const boundary = PLAN_BOUNDARIES.find((item) => item.plan === plan);
  if (!boundary) {
    throw new Error(`Policy Foundry commercial boundary plan is not configured: ${plan}`);
  }
  return boundary;
}

function normalizedRequestedWorkflowCount(value: number | null | undefined): number {
  const raw = value ?? 0;
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error('Policy Foundry commercial boundary requestedProductionWorkflowCount must be a non-negative integer.');
  }
  return raw;
}

function nextSafeStepFor(input: {
  readonly noGoReasons: readonly PolicyFoundryCommercialBoundaryNoGoReason[];
  readonly plan: PolicyFoundryCommercialPlan | 'unsupported';
}): string {
  if (input.noGoReasons.includes('safety-minimum-paywalled')) {
    return 'Remove the paid-only safety minimum restriction before evaluating any commercial rollout.';
  }
  if (input.noGoReasons.includes('shadow-auto-enforce-requested')) {
    return 'Keep shadow traffic as recommendation material and require explicit approval before any rollout step.';
  }
  if (input.noGoReasons.includes('unsupported-plan')) {
    return 'Select a supported commercial plan before evaluating Policy Foundry capabilities.';
  }
  if (input.noGoReasons.length > 0) {
    return 'Keep the request in review and either reduce scope or upgrade the commercial plan before activation.';
  }
  if (input.plan === 'developer' || input.plan === 'trial') {
    return 'Continue shadow or warn evaluation; do not activate production enforcement from this plan.';
  }
  return 'Use this boundary as commercial context only; production rollout still requires approval, verifier evidence, deployment readiness, and smoke tests.';
}

export function createPolicyFoundryCommercialBoundary(
  input: CreatePolicyFoundryCommercialBoundaryInput = {},
): PolicyFoundryCommercialBoundary {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, new Date(0).toISOString());
  const planText = (input.plan ?? 'developer').trim().toLowerCase();
  const planSupported = isPlan(planText);
  const plan = planSupported ? planText : 'unsupported';
  const boundary = planSupported ? planBoundaryFor(planText) : null;
  const requestedCapabilities = uniqueSorted(input.requestedCapabilities ?? []);
  const blockedSafetyMinimums = uniqueSorted(input.blockedSafetyMinimums ?? []);
  const requestedProductionWorkflowCount =
    normalizedRequestedWorkflowCount(input.requestedProductionWorkflowCount);
  const requestedHostedProduction = input.requestedHostedProduction ?? requestedProductionWorkflowCount > 0;
  const requestedCustomerOperatedDeployment = input.requestedCustomerOperatedDeployment ?? false;
  const shadowAutoEnforceRequested = input.shadowAutoEnforceRequested ?? false;

  const included = new Set(boundary?.includedCapabilities ?? []);
  const unavailableCapabilities = requestedCapabilities
    .filter((capability) => !isCapability(capability) || !included.has(capability));
  const allowedCapabilities = (boundary?.includedCapabilities ?? [])
    .filter((capability) => requestedCapabilities.length === 0 || requestedCapabilities.includes(capability));
  const blockedKnownSafetyMinimums = blockedSafetyMinimums.filter(isSafetyMinimum);
  const noGoReasons = new Set<PolicyFoundryCommercialBoundaryNoGoReason>();

  if (!planSupported) noGoReasons.add('unsupported-plan');
  if (unavailableCapabilities.length > 0) noGoReasons.add('requested-capability-not-in-plan');
  if (requestedHostedProduction && !boundary?.hostedProductionAllowed) {
    noGoReasons.add('production-enforcement-not-in-plan');
  }
  if (requestedCustomerOperatedDeployment && !boundary?.customerOperatedAllowed) {
    noGoReasons.add('customer-operated-deployment-not-in-plan');
  }
  if (
    boundary?.maxProductionWorkflows !== null &&
    requestedProductionWorkflowCount > (boundary?.maxProductionWorkflows ?? 0)
  ) {
    noGoReasons.add('production-enforcement-not-in-plan');
  }
  if (blockedKnownSafetyMinimums.length > 0) noGoReasons.add('safety-minimum-paywalled');
  if (shadowAutoEnforceRequested) noGoReasons.add('shadow-auto-enforce-requested');

  const sortedNoGoReasons = Object.freeze([...noGoReasons].sort());
  const productionWorkflowRequestAllowed =
    planSupported &&
    boundary !== null &&
    requestedProductionWorkflowCount > 0 &&
    boundary.hostedProductionAllowed &&
    (
      boundary.maxProductionWorkflows === null ||
      requestedProductionWorkflowCount <= boundary.maxProductionWorkflows
    ) &&
    !sortedNoGoReasons.includes('safety-minimum-paywalled') &&
    !sortedNoGoReasons.includes('shadow-auto-enforce-requested') &&
    !sortedNoGoReasons.includes('requested-capability-not-in-plan') &&
    !sortedNoGoReasons.includes('customer-operated-deployment-not-in-plan') &&
    !sortedNoGoReasons.includes('production-enforcement-not-in-plan');

  const boundaryPayload: Omit<PolicyFoundryCommercialBoundary, 'canonical' | 'digest'> = {
    version: POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_VERSION,
    generatedAt,
    plan,
    planSupported,
    posture: boundary?.posture ?? 'unsupported',
    paidPlan: boundary?.paidPlan ?? false,
    hostedProductionAllowed: boundary?.hostedProductionAllowed ?? false,
    customerOperatedAllowed: boundary?.customerOperatedAllowed ?? false,
    maxProductionWorkflows: boundary ? boundary.maxProductionWorkflows : null,
    auditRetentionDays: boundary?.auditRetentionDays ?? null,
    requestedProductionWorkflowCount,
    productionWorkflowRequestAllowed,
    requestedHostedProduction,
    requestedCustomerOperatedDeployment,
    requestedCapabilities,
    allowedCapabilities,
    unavailableCapabilities,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
    blockedSafetyMinimums,
    safetyFloorViolationCount: blockedKnownSafetyMinimums.length,
    noGoReasons: sortedNoGoReasons,
    nextSafeStep: nextSafeStepFor({ noGoReasons: sortedNoGoReasons, plan }),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    commercialBoundaryOnly: true,
    safetyMinimumsPaidOnlyAllowed: false,
    entitlementDecisionAuthority: false,
    billingStateRequiredForSafetyMinimums: false,
    deploymentEntitlementEnforcementImplemented: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-commercial-boundary',
    limitation:
      'This contract separates Policy Foundry commercial capabilities from safety minimums. It is not billing-provider state, deployment readiness, or production entitlement enforcement.',
  };
  const { canonical, digest } = canonicalObject(boundaryPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...boundaryPayload,
    canonical,
    digest,
  });
}

export function policyFoundryCommercialBoundaryDescriptor():
PolicyFoundryCommercialBoundaryDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_VERSION,
    plans: POLICY_FOUNDRY_COMMERCIAL_PLANS,
    postures: POLICY_FOUNDRY_COMMERCIAL_POSTURES,
    capabilities: POLICY_FOUNDRY_COMMERCIAL_CAPABILITIES,
    safetyMinimums: POLICY_FOUNDRY_SAFETY_MINIMUMS,
    noGoReasons: POLICY_FOUNDRY_COMMERCIAL_BOUNDARY_NO_GO_REASONS,
    planBoundaries: PLAN_BOUNDARIES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    commercialBoundaryOnly: true,
    safetyMinimumsPaidOnlyAllowed: false,
    entitlementDecisionAuthority: false,
    billingStateRequiredForSafetyMinimums: false,
    deploymentEntitlementEnforcementImplemented: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-commercial-boundary',
  });
}
