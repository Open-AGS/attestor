import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ActionSurfaceOnboardingPacket,
} from './action-surface-onboarding-packet.js';
import type {
  PolicyFoundryActiveQuestionPacket,
} from './policy-foundry-active-questions.js';
import type {
  PolicyFoundryNoGoReason,
  PolicyFoundryReadinessEvaluation,
} from './policy-foundry-readiness.js';
import type {
  PolicyFoundryRedTeamReplayResult,
} from './policy-foundry-red-team-replay.js';
import type {
  AttestorIntegrationModeReadiness,
  AttestorIntegrationNoGoReason,
} from './integration-mode-readiness.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION =
  'attestor.policy-foundry-onboarding-session.v1';

export const POLICY_FOUNDRY_ONBOARDING_SESSION_STAGES = [
  'intake',
  'surface-map',
  'requirements',
  'active-questions',
  'review-packet',
  'customer-review',
  'scoped-rollout-ready',
] as const;
export type PolicyFoundryOnboardingSessionStage =
  typeof POLICY_FOUNDRY_ONBOARDING_SESSION_STAGES[number];

export const POLICY_FOUNDRY_ONBOARDING_SESSION_STATUSES = [
  'no-input',
  'collecting-evidence',
  'questions-required',
  'blocked',
  'ready-for-customer-review',
  'scoped-rollout-review-ready',
] as const;
export type PolicyFoundryOnboardingSessionStatus =
  typeof POLICY_FOUNDRY_ONBOARDING_SESSION_STATUSES[number];

export const POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_STATUSES = [
  'currently-due',
  'eventually-due',
  'satisfied',
] as const;
export type PolicyFoundryOnboardingRequirementStatus =
  typeof POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_STATUSES[number];

export const POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_KINDS = [
  'provide-action-surface-inventory',
  'send-shadow-traffic',
  'run-policy-twin',
  'answer-active-questions',
  'choose-policy-template',
  'bind-evidence',
  'bind-authority',
  'prepare-verifier-or-gateway',
  'review-credential-isolation',
  'review-generated-artifacts',
  'run-red-team-replay',
  'resolve-counterexamples',
  'prove-tenant-boundary',
  'approve-candidate',
] as const;
export type PolicyFoundryOnboardingRequirementKind =
  typeof POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_KINDS[number];

export interface CreatePolicyFoundryOnboardingSessionInput {
  readonly sessionId?: string | null;
  readonly tenantId?: string | null;
  readonly generatedAt?: string | null;
  readonly onboardingPacket?: ActionSurfaceOnboardingPacket | null;
  readonly readiness?: PolicyFoundryReadinessEvaluation | null;
  readonly activeQuestionPacket?: PolicyFoundryActiveQuestionPacket | null;
  readonly redTeamReplay?: PolicyFoundryRedTeamReplayResult | null;
  readonly integrationReadiness?: readonly AttestorIntegrationModeReadiness[] | null;
}

export interface PolicyFoundryOnboardingSessionRequirement {
  readonly kind: PolicyFoundryOnboardingRequirementKind;
  readonly status: PolicyFoundryOnboardingRequirementStatus;
  readonly priority: number;
  readonly source: 'action-surface' | 'policy-foundry' | 'integration-mode' | 'customer-review';
  readonly reasonCodes: readonly string[];
  readonly prompt: string;
}

export interface PolicyFoundryOnboardingSessionSourceDigests {
  readonly onboardingPacketDigest: string | null;
  readonly readinessDigest: string | null;
  readonly activeQuestionPacketDigest: string | null;
  readonly redTeamReplayDigest: string | null;
  readonly integrationReadinessDigests: readonly string[];
}

export interface PolicyFoundryOnboardingSession {
  readonly version: typeof POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION;
  readonly generatedAt: string;
  readonly sessionId: string;
  readonly tenantDigest: string | null;
  readonly stage: PolicyFoundryOnboardingSessionStage;
  readonly status: PolicyFoundryOnboardingSessionStatus;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
  readonly surfaceCount: number;
  readonly shadowEventCount: number;
  readonly activeQuestionCount: number;
  readonly currentlyDueCount: number;
  readonly eventuallyDueCount: number;
  readonly satisfiedCount: number;
  readonly currentlyDue: readonly PolicyFoundryOnboardingRequirementKind[];
  readonly eventuallyDue: readonly PolicyFoundryOnboardingRequirementKind[];
  readonly satisfied: readonly PolicyFoundryOnboardingRequirementKind[];
  readonly requirements: readonly PolicyFoundryOnboardingSessionRequirement[];
  readonly sourceDigests: PolicyFoundryOnboardingSessionSourceDigests;
  readonly nextSafeStep: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-onboarding-session';
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryOnboardingSessionDescriptor {
  readonly version: typeof POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION;
  readonly stages: typeof POLICY_FOUNDRY_ONBOARDING_SESSION_STAGES;
  readonly statuses: typeof POLICY_FOUNDRY_ONBOARDING_SESSION_STATUSES;
  readonly requirementKinds: typeof POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_KINDS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly deploysInfrastructure: false;
  readonly issuesCredentials: false;
  readonly activatesEnforcement: false;
  readonly nonBypassableClaimAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-onboarding-session';
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
    throw new Error(`Policy Foundry onboarding session ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function sessionId(input: CreatePolicyFoundryOnboardingSessionInput): string {
  const explicit = normalizeOptionalString(input.sessionId);
  if (explicit) return explicit;
  const seed = [
    input.onboardingPacket?.digest ?? 'no-packet',
    input.readiness?.digest ?? 'no-readiness',
    input.activeQuestionPacket?.digest ?? 'no-questions',
    input.redTeamReplay?.digest ?? 'no-red-team',
    ...(input.integrationReadiness ?? []).map((item) => item.digest).sort(),
  ].join('\n');
  return `session_${createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

function requirementPrompt(kind: PolicyFoundryOnboardingRequirementKind): string {
  switch (kind) {
    case 'provide-action-surface-inventory':
      return 'Provide at least one manifest, declaration, or observed action surface before Policy Foundry can build an onboarding map.';
    case 'send-shadow-traffic':
      return 'Send shadow traffic so Attestor can measure real action coverage before suggesting policy changes.';
    case 'run-policy-twin':
      return 'Run a Policy Twin simulation before moving any candidate toward review or enforcement.';
    case 'answer-active-questions':
      return 'Answer the currently due active questions before the session can advance.';
    case 'choose-policy-template':
      return 'Choose or bind a schema-backed policy template for the candidate.';
    case 'bind-evidence':
      return 'Bind evidence coverage for the candidate action surface.';
    case 'bind-authority':
      return 'Bind the authority source for the candidate without using LLM text as authority.';
    case 'prepare-verifier-or-gateway':
      return 'Prepare the verifier, adapter, gateway, MCP gateway, or sidecar control that prevents downstream bypass.';
    case 'review-credential-isolation':
      return 'Review credential isolation so the agent cannot bypass Attestor with direct downstream credentials.';
    case 'review-generated-artifacts':
      return 'Review generated integration artifacts before they become implementation work.';
    case 'run-red-team-replay':
      return 'Run candidate-specific red-team replay before any scoped enforcement review.';
    case 'resolve-counterexamples':
      return 'Resolve counterexamples, high-risk auto-admits, replay pressure, or concentration issues before promotion.';
    case 'prove-tenant-boundary':
      return 'Prove tenant boundary coverage for the candidate action surface.';
    case 'approve-candidate':
      return 'Record customer approval after blockers are closed; approval is not a substitute for evidence.';
  }
}

const REQUIREMENT_PRIORITY: Record<PolicyFoundryOnboardingRequirementKind, number> = {
  'provide-action-surface-inventory': 100,
  'send-shadow-traffic': 95,
  'run-policy-twin': 90,
  'answer-active-questions': 88,
  'choose-policy-template': 86,
  'bind-evidence': 84,
  'bind-authority': 82,
  'prepare-verifier-or-gateway': 80,
  'review-credential-isolation': 78,
  'review-generated-artifacts': 76,
  'run-red-team-replay': 74,
  'resolve-counterexamples': 72,
  'prove-tenant-boundary': 70,
  'approve-candidate': 50,
};

const STATUS_RANK: Record<PolicyFoundryOnboardingRequirementStatus, number> = {
  'currently-due': 3,
  'eventually-due': 2,
  satisfied: 1,
};

function policyNoGoToRequirement(
  reason: PolicyFoundryNoGoReason,
): PolicyFoundryOnboardingRequirementKind {
  switch (reason) {
    case 'candidate-missing':
      return 'provide-action-surface-inventory';
    case 'no-simulation-report':
      return 'run-policy-twin';
    case 'customer-approval-required':
      return 'approve-candidate';
    case 'missing-policy-schema':
      return 'choose-policy-template';
    case 'missing-evidence-coverage':
      return 'bind-evidence';
    case 'missing-authority-binding':
    case 'llm-authority-source':
      return 'bind-authority';
    case 'adapter-readiness-missing':
      return 'prepare-verifier-or-gateway';
    case 'tenant-boundary-not-proven':
      return 'prove-tenant-boundary';
    case 'red-team-replay-not-run':
    case 'red-team-replay-failed':
      return 'run-red-team-replay';
    case 'sample-size-too-small':
      return 'send-shadow-traffic';
    case 'single-actor-concentration':
    case 'high-risk-auto-admit':
    case 'counterexamples-present':
    case 'replay-duplicate-pressure':
      return 'resolve-counterexamples';
  }
}

function integrationNoGoToRequirement(
  reason: AttestorIntegrationNoGoReason,
): PolicyFoundryOnboardingRequirementKind {
  switch (reason) {
    case 'missing-admission-call':
    case 'missing-shadow-capture':
      return 'send-shadow-traffic';
    case 'missing-downstream-contract':
    case 'missing-verifier':
    case 'missing-adapter-or-proxy':
    case 'missing-presentation-binding':
    case 'missing-replay-protection':
    case 'missing-idempotency-key':
      return 'prepare-verifier-or-gateway';
    case 'agent-direct-credential-exposed':
    case 'missing-credential-isolation':
      return 'review-credential-isolation';
    case 'missing-tenant-boundary':
      return 'prove-tenant-boundary';
    case 'missing-policy-simulation':
      return 'run-policy-twin';
    case 'missing-customer-approval':
      return 'approve-candidate';
    case 'missing-red-team-replay':
      return 'run-red-team-replay';
    case 'generated-artifacts-unreviewed':
      return 'review-generated-artifacts';
  }
}

function mergeRequirement(
  requirements: Map<PolicyFoundryOnboardingRequirementKind, PolicyFoundryOnboardingSessionRequirement>,
  input: {
    readonly kind: PolicyFoundryOnboardingRequirementKind;
    readonly status: PolicyFoundryOnboardingRequirementStatus;
    readonly source: PolicyFoundryOnboardingSessionRequirement['source'];
    readonly reasonCodes?: readonly string[];
  },
): void {
  const existing = requirements.get(input.kind);
  const reasonCodes = [...new Set([...(existing?.reasonCodes ?? []), ...(input.reasonCodes ?? [])])]
    .sort();
  const status = existing && STATUS_RANK[existing.status] >= STATUS_RANK[input.status]
    ? existing.status
    : input.status;
  const source = existing?.source ?? input.source;
  requirements.set(input.kind, Object.freeze({
    kind: input.kind,
    status,
    priority: REQUIREMENT_PRIORITY[input.kind],
    source,
    reasonCodes: Object.freeze(reasonCodes),
    prompt: requirementPrompt(input.kind),
  }));
}

function allRequirements(
  input: CreatePolicyFoundryOnboardingSessionInput,
): readonly PolicyFoundryOnboardingSessionRequirement[] {
  const requirements = new Map<PolicyFoundryOnboardingRequirementKind, PolicyFoundryOnboardingSessionRequirement>();
  const packet = input.onboardingPacket ?? null;
  const readiness = input.readiness ?? null;
  const questions = input.activeQuestionPacket ?? null;
  const integrations = input.integrationReadiness ?? [];

  if (packet === null || packet.profileCount === 0) {
    mergeRequirement(requirements, {
      kind: 'provide-action-surface-inventory',
      status: 'currently-due',
      source: 'action-surface',
      reasonCodes: ['action-surface-inventory-missing'],
    });
  } else {
    mergeRequirement(requirements, {
      kind: 'provide-action-surface-inventory',
      status: 'satisfied',
      source: 'action-surface',
    });
  }

  if (packet === null || packet.eventCount === 0) {
    mergeRequirement(requirements, {
      kind: 'send-shadow-traffic',
      status: 'currently-due',
      source: 'action-surface',
      reasonCodes: ['shadow-traffic-missing'],
    });
  } else {
    mergeRequirement(requirements, {
      kind: 'send-shadow-traffic',
      status: 'satisfied',
      source: 'action-surface',
    });
  }

  if (readiness === null) {
    mergeRequirement(requirements, {
      kind: 'run-policy-twin',
      status: packet === null || packet.profileCount === 0 ? 'eventually-due' : 'currently-due',
      source: 'policy-foundry',
      reasonCodes: ['readiness-missing'],
    });
  } else {
    const nonApprovalBlockers = readiness.noGoReasons.filter((reason) =>
      reason !== 'customer-approval-required'
    );
    mergeRequirement(requirements, {
      kind: 'run-policy-twin',
      status: readiness.noGoReasons.includes('no-simulation-report') ? 'currently-due' : 'satisfied',
      source: 'policy-foundry',
      reasonCodes: readiness.noGoReasons.includes('no-simulation-report')
        ? ['no-simulation-report']
        : [],
    });
    for (const reason of readiness.noGoReasons) {
      const kind = policyNoGoToRequirement(reason);
      mergeRequirement(requirements, {
        kind,
        status: kind === 'approve-candidate' && nonApprovalBlockers.length > 0
          ? 'eventually-due'
          : 'currently-due',
        source: kind === 'approve-candidate' ? 'customer-review' : 'policy-foundry',
        reasonCodes: [reason],
      });
    }
  }

  if (questions !== null && questions.questionCount > 0) {
    mergeRequirement(requirements, {
      kind: 'answer-active-questions',
      status: 'currently-due',
      source: 'policy-foundry',
      reasonCodes: questions.questions.flatMap((question) => question.blocksReasonCodes),
    });
  } else if (questions !== null) {
    mergeRequirement(requirements, {
      kind: 'answer-active-questions',
      status: 'satisfied',
      source: 'policy-foundry',
    });
  }

  if (input.redTeamReplay !== null && input.redTeamReplay !== undefined) {
    mergeRequirement(requirements, {
      kind: 'run-red-team-replay',
      status: input.redTeamReplay.status === 'passed' ? 'satisfied' : 'currently-due',
      source: 'policy-foundry',
      reasonCodes: input.redTeamReplay.status === 'passed' ? [] : ['red-team-replay-failed'],
    });
  }

  for (const integration of integrations) {
    for (const reason of integration.noGoReasons) {
      const kind = integrationNoGoToRequirement(reason);
      mergeRequirement(requirements, {
        kind,
        status: kind === 'approve-candidate' && integration.noGoReasons.length > 1
          ? 'eventually-due'
          : 'currently-due',
        source: kind === 'approve-candidate' ? 'customer-review' : 'integration-mode',
        reasonCodes: [reason],
      });
    }
    if (integration.noGoReasons.length === 0) {
      for (const kind of [
        'prepare-verifier-or-gateway',
        'review-credential-isolation',
        'review-generated-artifacts',
      ] as const) {
        mergeRequirement(requirements, {
          kind,
          status: 'satisfied',
          source: 'integration-mode',
        });
      }
    }
  }

  return Object.freeze(
    [...requirements.values()].sort((left, right) =>
      STATUS_RANK[right.status] - STATUS_RANK[left.status] ||
      right.priority - left.priority ||
      left.kind.localeCompare(right.kind)
    ),
  );
}

function firstSurface(packet: ActionSurfaceOnboardingPacket | null): {
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly downstreamSystem: string | null;
} {
  const plan = packet?.surfacePlans[0] ?? null;
  return Object.freeze({
    actionSurface: plan?.actionSurface ?? null,
    domain: plan?.domain ?? null,
    downstreamSystem: plan?.downstreamSystem ?? null,
  });
}

function stageAndStatus(input: {
  readonly hasInput: boolean;
  readonly packet: ActionSurfaceOnboardingPacket | null;
  readonly readiness: PolicyFoundryReadinessEvaluation | null;
  readonly questionCount: number;
  readonly currentlyDue: readonly PolicyFoundryOnboardingRequirementKind[];
  readonly integrations: readonly AttestorIntegrationModeReadiness[];
}): {
  readonly stage: PolicyFoundryOnboardingSessionStage;
  readonly status: PolicyFoundryOnboardingSessionStatus;
} {
  if (!input.hasInput) return { stage: 'intake', status: 'no-input' };
  if (input.questionCount > 0 && input.currentlyDue.includes('answer-active-questions')) {
    return { stage: 'active-questions', status: 'questions-required' };
  }
  if (input.currentlyDue.length > 0) return { stage: 'requirements', status: 'blocked' };
  const scopedIntegrationReady = input.integrations.some((integration) =>
    integration.status === 'scoped-enforce-eligible'
  );
  if (input.readiness?.status === 'enforce-eligible' && scopedIntegrationReady) {
    return { stage: 'scoped-rollout-ready', status: 'scoped-rollout-review-ready' };
  }
  if (input.readiness?.status === 'review-ready' || input.readiness?.status === 'enforce-eligible') {
    return { stage: 'customer-review', status: 'ready-for-customer-review' };
  }
  if (input.packet !== null && input.packet.profileCount > 0) {
    return { stage: 'review-packet', status: 'collecting-evidence' };
  }
  return { stage: 'surface-map', status: 'collecting-evidence' };
}

function nextSafeStep(
  currentlyDue: readonly PolicyFoundryOnboardingRequirementKind[],
  status: PolicyFoundryOnboardingSessionStatus,
): string {
  if (currentlyDue.length > 0) return requirementPrompt(currentlyDue[0]!);
  if (status === 'scoped-rollout-review-ready') {
    return 'Prepare a scoped rollout review; the session itself still does not activate enforcement.';
  }
  if (status === 'ready-for-customer-review') {
    return 'Review the candidate packet and record customer approval only after evidence is accepted.';
  }
  return 'Continue collecting evidence before making any enforcement claim.';
}

export function createPolicyFoundryOnboardingSession(
  input: CreatePolicyFoundryOnboardingSessionInput,
): PolicyFoundryOnboardingSession {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const packet = input.onboardingPacket ?? null;
  const readiness = input.readiness ?? null;
  const activeQuestionPacket = input.activeQuestionPacket ?? null;
  const integrations = Object.freeze([...(input.integrationReadiness ?? [])]);
  const requirements = allRequirements(input);
  const currentlyDue = Object.freeze(requirements
    .filter((requirement) => requirement.status === 'currently-due')
    .map((requirement) => requirement.kind));
  const eventuallyDue = Object.freeze(requirements
    .filter((requirement) => requirement.status === 'eventually-due')
    .map((requirement) => requirement.kind));
  const satisfied = Object.freeze(requirements
    .filter((requirement) => requirement.status === 'satisfied')
    .map((requirement) => requirement.kind));
  const surface = firstSurface(packet);
  const stageStatus = stageAndStatus({
    hasInput: Boolean(packet || readiness || activeQuestionPacket || input.redTeamReplay || integrations.length),
    packet,
    readiness,
    questionCount: activeQuestionPacket?.questionCount ?? 0,
    currentlyDue,
    integrations,
  });
  const sourceDigests = Object.freeze({
    onboardingPacketDigest: packet?.digest ?? null,
    readinessDigest: readiness?.digest ?? null,
    activeQuestionPacketDigest: activeQuestionPacket?.digest ?? null,
    redTeamReplayDigest: input.redTeamReplay?.digest ?? null,
    integrationReadinessDigests: Object.freeze(integrations.map((item) => item.digest).sort()),
  });
  const payload = {
    version: POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION as typeof POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION,
    generatedAt,
    sessionId: sessionId(input),
    tenantDigest: input.tenantId ? digestText(input.tenantId) : null,
    stage: stageStatus.stage,
    status: stageStatus.status,
    actionSurface: readiness?.actionSurface ?? surface.actionSurface,
    domain: readiness?.domain ?? surface.domain,
    downstreamSystem: surface.downstreamSystem,
    surfaceCount: packet?.profileCount ?? 0,
    shadowEventCount: packet?.eventCount ?? 0,
    activeQuestionCount: activeQuestionPacket?.questionCount ?? 0,
    currentlyDueCount: currentlyDue.length,
    eventuallyDueCount: eventuallyDue.length,
    satisfiedCount: satisfied.length,
    currentlyDue,
    eventuallyDue,
    satisfied,
    requirements,
    sourceDigests,
    nextSafeStep: nextSafeStep(currentlyDue, stageStatus.status),
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    deploysInfrastructure: false as const,
    issuesCredentials: false as const,
    activatesEnforcement: false as const,
    nonBypassableClaimAllowed: false as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-onboarding-session' as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryOnboardingSessionDescriptor(): PolicyFoundryOnboardingSessionDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_ONBOARDING_SESSION_VERSION,
    stages: POLICY_FOUNDRY_ONBOARDING_SESSION_STAGES,
    statuses: POLICY_FOUNDRY_ONBOARDING_SESSION_STATUSES,
    requirementKinds: POLICY_FOUNDRY_ONBOARDING_REQUIREMENT_KINDS,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    deploysInfrastructure: false,
    issuesCredentials: false,
    activatesEnforcement: false,
    nonBypassableClaimAllowed: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-onboarding-session',
  });
}
