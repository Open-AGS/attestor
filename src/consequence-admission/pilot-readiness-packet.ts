import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';

export const PILOT_READINESS_PACKET_VERSION =
  'attestor.pilot-readiness-packet.v1';

export const PILOT_READINESS_STAGES = [
  'shadow-entry',
  'scoped-enforcement-entry',
] as const;
export type PilotReadinessStage = typeof PILOT_READINESS_STAGES[number];

export const PILOT_READINESS_ROLLOUT_MODES = [
  'shadow-only',
  'review-required',
  'canary-enforce',
] as const;
export type PilotReadinessRolloutMode =
  typeof PILOT_READINESS_ROLLOUT_MODES[number];

export const PILOT_READINESS_VERDICTS = [
  'ready-for-shadow-pilot',
  'ready-for-scoped-pilot',
  'not-ready',
] as const;
export type PilotReadinessVerdict = typeof PILOT_READINESS_VERDICTS[number];

export const PILOT_READINESS_GATE_IDS = [
  'integration-prerequisites',
  'shadow-observation-window',
  'event-quality',
  'evidence-coverage',
  'active-question-resolution',
  'approval-path',
  'rollout-mode',
  'rollback-plan',
  'receipt-and-audit-trail',
  'non-claim-boundary',
] as const;
export type PilotReadinessGateId = typeof PILOT_READINESS_GATE_IDS[number];

export type PilotReadinessGateStatus = 'pass' | 'fail' | 'not-applicable';

export interface PilotReadinessThresholds {
  readonly minimumShadowObservationDays: number;
  readonly minimumShadowEventCount: number;
  readonly minimumEventSchemaCoveragePercent: number;
  readonly minimumTenantBindingPercent: number;
  readonly minimumReceiptBindingPercent: number;
  readonly minimumEvidenceCoveragePercent: number;
  readonly minimumDownstreamReceiptCoveragePercent: number;
  readonly maximumUnresolvedCriticalQuestions: number;
  readonly maximumUnresolvedHighQuestions: number;
}

export interface CreatePilotReadinessPacketInput {
  readonly generatedAt?: string | null;
  readonly pilotRefDigest: string;
  readonly tenantRefDigest: string;
  readonly requesterRefDigest: string;
  readonly targetSystemRefDigest: string;
  readonly integrationOwnerRefDigest: string;
  readonly systemOfRecordOwnerRefDigest: string;
  readonly targetRecipeRefs: readonly string[];
  readonly stage: PilotReadinessStage;
  readonly rolloutMode: PilotReadinessRolloutMode;
  readonly shadowObservationDays?: number | null;
  readonly shadowEventCount?: number | null;
  readonly eventSchemaCoveragePercent?: number | null;
  readonly eventTenantBindingPercent?: number | null;
  readonly eventReceiptBindingPercent?: number | null;
  readonly evidenceCoveragePercent?: number | null;
  readonly downstreamReceiptCoveragePercent?: number | null;
  readonly activeQuestionCount?: number | null;
  readonly unresolvedCriticalQuestionCount?: number | null;
  readonly unresolvedHighQuestionCount?: number | null;
  readonly approvalPathDigest?: string | null;
  readonly reviewerQueueDigest?: string | null;
  readonly rollbackPlanDigest?: string | null;
  readonly customerPepProofDigest?: string | null;
  readonly decisionLogDigest?: string | null;
  readonly runbookDigest?: string | null;
  readonly nonClaimsAccepted?: boolean | null;
}

export interface PilotReadinessGate {
  readonly id: PilotReadinessGateId;
  readonly status: PilotReadinessGateStatus;
  readonly required: boolean;
  readonly summary: string;
  readonly protectedPrinciples: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly blockers: readonly string[];
}

export interface PilotReadinessPacket {
  readonly version: typeof PILOT_READINESS_PACKET_VERSION;
  readonly generatedAt: string;
  readonly pilotRefDigest: string;
  readonly tenantRefDigest: string;
  readonly requesterRefDigest: string;
  readonly targetSystemRefDigest: string;
  readonly integrationOwnerRefDigest: string;
  readonly systemOfRecordOwnerRefDigest: string;
  readonly targetRecipeRefs: readonly string[];
  readonly stage: PilotReadinessStage;
  readonly rolloutMode: PilotReadinessRolloutMode;
  readonly thresholds: PilotReadinessThresholds;
  readonly gates: readonly PilotReadinessGate[];
  readonly decision: {
    readonly verdict: PilotReadinessVerdict;
    readonly blockers: readonly string[];
  };
  readonly sourceBacked: true;
  readonly reviewByException: true;
  readonly customerOwnsSystemOfRecord: true;
  readonly customerDeploymentRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly recordsSystem: false;
  readonly workflowWorkspace: false;
  readonly complianceCertification: false;
  readonly clinicalAuthority: false;
  readonly insuranceSystemOfRecord: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface PilotReadinessPacketDescriptor {
  readonly version: typeof PILOT_READINESS_PACKET_VERSION;
  readonly stages: typeof PILOT_READINESS_STAGES;
  readonly rolloutModes: typeof PILOT_READINESS_ROLLOUT_MODES;
  readonly verdicts: typeof PILOT_READINESS_VERDICTS;
  readonly gateIds: typeof PILOT_READINESS_GATE_IDS;
  readonly thresholds: PilotReadinessThresholds;
  readonly sourceBacked: true;
  readonly reviewByException: true;
  readonly customerOwnsSystemOfRecord: true;
  readonly customerDeploymentRequired: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly nativeConnectorCoverage: false;
  readonly customerDeploymentProven: false;
  readonly recordsSystem: false;
  readonly workflowWorkspace: false;
  readonly complianceCertification: false;
  readonly clinicalAuthority: false;
  readonly insuranceSystemOfRecord: false;
  readonly productionReady: false;
}

const DEFAULT_THRESHOLDS: PilotReadinessThresholds = Object.freeze({
  minimumShadowObservationDays: 14,
  minimumShadowEventCount: 100,
  minimumEventSchemaCoveragePercent: 95,
  minimumTenantBindingPercent: 100,
  minimumReceiptBindingPercent: 80,
  minimumEvidenceCoveragePercent: 80,
  minimumDownstreamReceiptCoveragePercent: 70,
  maximumUnresolvedCriticalQuestions: 0,
  maximumUnresolvedHighQuestions: 2,
});

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
    throw new Error(`Pilot readiness packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function assertDigest(value: string | null | undefined, fieldName: string): string {
  if (!value || !/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`Pilot readiness packet ${fieldName} must be a sha256 digest.`);
  }
  return value;
}

function optionalDigest(value: string | null | undefined, fieldName: string): string | null {
  if (value == null) return null;
  return assertDigest(value, fieldName);
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function percentOrZero(value: number | null | undefined, fieldName: string): number {
  const normalized = numberOrZero(value);
  if (normalized < 0 || normalized > 100) {
    throw new Error(`Pilot readiness packet ${fieldName} must be between 0 and 100.`);
  }
  return normalized;
}

function assertNonEmptyStrings(values: readonly string[], fieldName: string):
readonly string[] {
  if (values.length === 0) {
    throw new Error(`Pilot readiness packet ${fieldName} must not be empty.`);
  }
  for (const value of values) {
    if (!value.trim()) {
      throw new Error(`Pilot readiness packet ${fieldName} must not contain blanks.`);
    }
  }
  return Object.freeze([...values]);
}

function gate(input: PilotReadinessGate): PilotReadinessGate {
  return Object.freeze({
    ...input,
    protectedPrinciples: Object.freeze([...input.protectedPrinciples]),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    blockers: Object.freeze([...input.blockers]),
  });
}

function pass(input: Omit<PilotReadinessGate, 'status' | 'blockers'>): PilotReadinessGate {
  return gate({ ...input, status: 'pass', blockers: [] });
}

function fail(input: Omit<PilotReadinessGate, 'status'>): PilotReadinessGate {
  return gate({ ...input, status: 'fail' });
}

function notApplicable(input: Omit<PilotReadinessGate, 'status' | 'required' | 'blockers'>):
PilotReadinessGate {
  return gate({
    ...input,
    status: 'not-applicable',
    required: false,
    blockers: [],
  });
}

function integrationGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  const blockers: string[] = [];
  if (input.targetRecipeRefs.length === 0) blockers.push('target-recipe-ref-required');
  if (!PILOT_READINESS_STAGES.includes(input.stage)) blockers.push('unknown-stage');
  if (!PILOT_READINESS_ROLLOUT_MODES.includes(input.rolloutMode)) {
    blockers.push('unknown-rollout-mode');
  }

  const evidenceRefs = [
    input.pilotRefDigest,
    input.tenantRefDigest,
    input.targetSystemRefDigest,
    input.integrationOwnerRefDigest,
    input.systemOfRecordOwnerRefDigest,
    ...input.targetRecipeRefs,
  ];

  if (blockers.length > 0) {
    return fail({
      id: 'integration-prerequisites',
      required: true,
      summary: 'Target recipe and ownership prerequisites are incomplete.',
      protectedPrinciples: ['tenant isolation', 'customer authority', 'no overclaim'],
      evidenceRefs,
      blockers,
    });
  }

  return pass({
    id: 'integration-prerequisites',
    required: true,
    summary: 'Pilot, tenant, target system, integration owner, system-of-record owner, and recipe refs are bound.',
    protectedPrinciples: ['tenant isolation', 'customer authority', 'no overclaim'],
    evidenceRefs,
  });
}

function shadowObservationGate(
  input: CreatePilotReadinessPacketInput,
  thresholds: PilotReadinessThresholds,
): PilotReadinessGate {
  if (input.stage === 'shadow-entry') {
    return notApplicable({
      id: 'shadow-observation-window',
      summary: 'Shadow observation is the purpose of this entry packet; no historical traffic is required before starting shadow.',
      protectedPrinciples: ['auditability', 'operational boundedness', 'no overclaim'],
      evidenceRefs: ['shadow-observation:starts-after-entry'],
    });
  }

  const days = numberOrZero(input.shadowObservationDays);
  const eventCount = numberOrZero(input.shadowEventCount);
  const blockers: string[] = [];
  if (days < thresholds.minimumShadowObservationDays) {
    blockers.push('shadow-observation-window-too-short');
  }
  if (eventCount < thresholds.minimumShadowEventCount) {
    blockers.push('shadow-event-count-too-low');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'shadow-observation-window',
      required: true,
      summary: 'Scoped pilot promotion requires enough shadow traffic to make the packet meaningful.',
      protectedPrinciples: ['auditability', 'operational boundedness', 'no overclaim'],
      evidenceRefs: [`days:${days}`, `events:${eventCount}`],
      blockers,
    });
  }

  return pass({
    id: 'shadow-observation-window',
    required: true,
    summary: 'Shadow observation duration and event count meet the scoped-pilot threshold.',
    protectedPrinciples: ['auditability', 'operational boundedness', 'no overclaim'],
    evidenceRefs: [`days:${days}`, `events:${eventCount}`],
  });
}

function eventQualityGate(
  input: CreatePilotReadinessPacketInput,
  thresholds: PilotReadinessThresholds,
): PilotReadinessGate {
  if (input.stage === 'shadow-entry') {
    return notApplicable({
      id: 'event-quality',
      summary: 'Event quality is measured during shadow observation before scoped pilot promotion.',
      protectedPrinciples: ['proof integrity', 'tenant isolation', 'data minimization and redaction'],
      evidenceRefs: ['event-quality:measured-during-shadow'],
    });
  }

  const schema = percentOrZero(input.eventSchemaCoveragePercent, 'eventSchemaCoveragePercent');
  const tenant = percentOrZero(input.eventTenantBindingPercent, 'eventTenantBindingPercent');
  const receipt = percentOrZero(input.eventReceiptBindingPercent, 'eventReceiptBindingPercent');
  const blockers: string[] = [];
  if (schema < thresholds.minimumEventSchemaCoveragePercent) {
    blockers.push('event-schema-coverage-too-low');
  }
  if (tenant < thresholds.minimumTenantBindingPercent) {
    blockers.push('tenant-binding-coverage-too-low');
  }
  if (receipt < thresholds.minimumReceiptBindingPercent) {
    blockers.push('receipt-binding-coverage-too-low');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'event-quality',
      required: true,
      summary: 'Shadow events do not yet meet schema, tenant-binding, and receipt-binding thresholds.',
      protectedPrinciples: ['proof integrity', 'tenant isolation', 'data minimization and redaction'],
      evidenceRefs: [`schema:${schema}`, `tenant:${tenant}`, `receipt:${receipt}`],
      blockers,
    });
  }

  return pass({
    id: 'event-quality',
    required: true,
    summary: 'Shadow events meet schema, tenant-binding, and receipt-binding thresholds.',
    protectedPrinciples: ['proof integrity', 'tenant isolation', 'data minimization and redaction'],
    evidenceRefs: [`schema:${schema}`, `tenant:${tenant}`, `receipt:${receipt}`],
  });
}

function evidenceCoverageGate(
  input: CreatePilotReadinessPacketInput,
  thresholds: PilotReadinessThresholds,
): PilotReadinessGate {
  if (input.stage === 'shadow-entry') {
    return notApplicable({
      id: 'evidence-coverage',
      summary: 'Evidence and downstream receipt coverage are measured during shadow observation.',
      protectedPrinciples: ['proof integrity', 'auditability', 'replay and idempotency safety'],
      evidenceRefs: ['evidence-coverage:measured-during-shadow'],
    });
  }

  const evidence = percentOrZero(input.evidenceCoveragePercent, 'evidenceCoveragePercent');
  const receipts = percentOrZero(
    input.downstreamReceiptCoveragePercent,
    'downstreamReceiptCoveragePercent',
  );
  const blockers: string[] = [];
  if (evidence < thresholds.minimumEvidenceCoveragePercent) {
    blockers.push('evidence-coverage-too-low');
  }
  if (receipts < thresholds.minimumDownstreamReceiptCoveragePercent) {
    blockers.push('downstream-receipt-coverage-too-low');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'evidence-coverage',
      required: true,
      summary: 'Evidence or downstream receipt coverage is too low for scoped pilot promotion.',
      protectedPrinciples: ['proof integrity', 'auditability', 'replay and idempotency safety'],
      evidenceRefs: [`evidence:${evidence}`, `receipts:${receipts}`],
      blockers,
    });
  }

  return pass({
    id: 'evidence-coverage',
    required: true,
    summary: 'Evidence and downstream receipt coverage meet scoped-pilot thresholds.',
    protectedPrinciples: ['proof integrity', 'auditability', 'replay and idempotency safety'],
    evidenceRefs: [`evidence:${evidence}`, `receipts:${receipts}`],
  });
}

function activeQuestionGate(
  input: CreatePilotReadinessPacketInput,
  thresholds: PilotReadinessThresholds,
): PilotReadinessGate {
  if (input.stage === 'shadow-entry') {
    return notApplicable({
      id: 'active-question-resolution',
      summary: 'Active questions are generated and resolved during shadow before scoped pilot promotion.',
      protectedPrinciples: ['customer authority', 'operational boundedness', 'no overclaim'],
      evidenceRefs: ['active-questions:generated-during-shadow'],
    });
  }

  const total = numberOrZero(input.activeQuestionCount);
  const critical = numberOrZero(input.unresolvedCriticalQuestionCount);
  const high = numberOrZero(input.unresolvedHighQuestionCount);
  const blockers: string[] = [];
  if (critical > thresholds.maximumUnresolvedCriticalQuestions) {
    blockers.push('unresolved-critical-questions');
  }
  if (high > thresholds.maximumUnresolvedHighQuestions) {
    blockers.push('too-many-unresolved-high-questions');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'active-question-resolution',
      required: true,
      summary: 'Critical or high-impact reviewer questions remain unresolved.',
      protectedPrinciples: ['customer authority', 'operational boundedness', 'no overclaim'],
      evidenceRefs: [`questions:${total}`, `critical:${critical}`, `high:${high}`],
      blockers,
    });
  }

  return pass({
    id: 'active-question-resolution',
    required: true,
    summary: 'Critical and high-impact reviewer questions are within scoped-pilot limits.',
    protectedPrinciples: ['customer authority', 'operational boundedness', 'no overclaim'],
    evidenceRefs: [`questions:${total}`, `critical:${critical}`, `high:${high}`],
  });
}

function approvalPathGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  const approvalPathDigest = optionalDigest(input.approvalPathDigest, 'approvalPathDigest');
  const reviewerQueueDigest = optionalDigest(input.reviewerQueueDigest, 'reviewerQueueDigest');
  const blockers: string[] = [];
  if (!approvalPathDigest) blockers.push('approval-path-digest-required');
  if (!reviewerQueueDigest) blockers.push('reviewer-queue-digest-required');

  if (blockers.length > 0) {
    return fail({
      id: 'approval-path',
      required: true,
      summary: 'A pilot requires a digest-bound approval path and reviewer queue before any customer action.',
      protectedPrinciples: ['customer authority', 'auditability', 'operational boundedness'],
      evidenceRefs: [approvalPathDigest, reviewerQueueDigest].filter((ref): ref is string => Boolean(ref)),
      blockers,
    });
  }

  return pass({
    id: 'approval-path',
    required: true,
    summary: 'Approval path and reviewer queue are digest-bound.',
    protectedPrinciples: ['customer authority', 'auditability', 'operational boundedness'],
    evidenceRefs: [approvalPathDigest, reviewerQueueDigest].filter((ref): ref is string =>
      Boolean(ref),
    ),
  });
}

function rolloutGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  const customerPepProofDigest = optionalDigest(input.customerPepProofDigest, 'customerPepProofDigest');
  const blockers: string[] = [];
  if (input.stage === 'shadow-entry' && input.rolloutMode !== 'shadow-only') {
    blockers.push('shadow-entry-must-use-shadow-only');
  }
  if (input.stage === 'scoped-enforcement-entry' && input.rolloutMode === 'shadow-only') {
    blockers.push('scoped-entry-cannot-remain-shadow-only');
  }
  if (input.rolloutMode === 'canary-enforce' && !customerPepProofDigest) {
    blockers.push('canary-enforce-requires-customer-pep-proof');
  }

  if (blockers.length > 0) {
    return fail({
      id: 'rollout-mode',
      required: true,
      summary: 'Rollout mode does not match the requested pilot stage.',
      protectedPrinciples: ['fail-closed boundary', 'customer authority', 'no overclaim'],
      evidenceRefs: [input.rolloutMode, customerPepProofDigest].filter((ref): ref is string => Boolean(ref)),
      blockers,
    });
  }

  return pass({
    id: 'rollout-mode',
    required: true,
    summary: 'Rollout mode is bounded for the requested pilot stage.',
    protectedPrinciples: ['fail-closed boundary', 'customer authority', 'no overclaim'],
    evidenceRefs: [input.rolloutMode, customerPepProofDigest].filter((ref): ref is string => Boolean(ref)),
  });
}

function rollbackGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  const rollbackPlanDigest = optionalDigest(input.rollbackPlanDigest, 'rollbackPlanDigest');
  const runbookDigest = optionalDigest(input.runbookDigest, 'runbookDigest');
  const blockers: string[] = [];
  if (!rollbackPlanDigest) blockers.push('rollback-plan-digest-required');
  if (!runbookDigest) blockers.push('operator-runbook-digest-required');

  if (blockers.length > 0) {
    return fail({
      id: 'rollback-plan',
      required: true,
      summary: 'Pilot entry requires rollback and operator runbook digests.',
      protectedPrinciples: ['operational boundedness', 'runtime readiness', 'no overclaim'],
      evidenceRefs: [rollbackPlanDigest, runbookDigest].filter((ref): ref is string => Boolean(ref)),
      blockers,
    });
  }

  return pass({
    id: 'rollback-plan',
    required: true,
    summary: 'Rollback plan and operator runbook are digest-bound.',
    protectedPrinciples: ['operational boundedness', 'runtime readiness', 'no overclaim'],
    evidenceRefs: [rollbackPlanDigest, runbookDigest].filter((ref): ref is string =>
      Boolean(ref),
    ),
  });
}

function receiptAuditGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  const decisionLogDigest = optionalDigest(input.decisionLogDigest, 'decisionLogDigest');
  if (!decisionLogDigest) {
    return fail({
      id: 'receipt-and-audit-trail',
      required: true,
      summary: 'Pilot entry requires a digest-bound decision-log or audit-trail destination.',
      protectedPrinciples: ['auditability', 'proof integrity', 'data minimization and redaction'],
      evidenceRefs: [],
      blockers: ['decision-log-digest-required'],
    });
  }

  return pass({
    id: 'receipt-and-audit-trail',
    required: true,
    summary: 'Decision-log or audit-trail destination is digest-bound.',
    protectedPrinciples: ['auditability', 'proof integrity', 'data minimization and redaction'],
    evidenceRefs: [decisionLogDigest],
  });
}

function nonClaimGate(input: CreatePilotReadinessPacketInput): PilotReadinessGate {
  if (input.nonClaimsAccepted !== true) {
    return fail({
      id: 'non-claim-boundary',
      required: true,
      summary: 'Pilot users must acknowledge that the packet is not production, compliance, connector, or deployment proof.',
      protectedPrinciples: ['no overclaim', 'customer authority', 'operational boundedness'],
      evidenceRefs: [],
      blockers: ['pilot-non-claims-not-accepted'],
    });
  }

  return pass({
    id: 'non-claim-boundary',
    required: true,
    summary: 'Pilot non-claims are explicitly acknowledged.',
    protectedPrinciples: ['no overclaim', 'customer authority', 'operational boundedness'],
    evidenceRefs: ['non-claims:accepted'],
  });
}

export function createPilotReadinessPacket(
  input: CreatePilotReadinessPacketInput,
): PilotReadinessPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const normalizedInput: CreatePilotReadinessPacketInput = Object.freeze({
    ...input,
    generatedAt,
    pilotRefDigest: assertDigest(input.pilotRefDigest, 'pilotRefDigest'),
    tenantRefDigest: assertDigest(input.tenantRefDigest, 'tenantRefDigest'),
    requesterRefDigest: assertDigest(input.requesterRefDigest, 'requesterRefDigest'),
    targetSystemRefDigest: assertDigest(input.targetSystemRefDigest, 'targetSystemRefDigest'),
    integrationOwnerRefDigest: assertDigest(
      input.integrationOwnerRefDigest,
      'integrationOwnerRefDigest',
    ),
    systemOfRecordOwnerRefDigest: assertDigest(
      input.systemOfRecordOwnerRefDigest,
      'systemOfRecordOwnerRefDigest',
    ),
    targetRecipeRefs: assertNonEmptyStrings(input.targetRecipeRefs, 'targetRecipeRefs'),
    eventSchemaCoveragePercent: input.eventSchemaCoveragePercent == null
      ? input.eventSchemaCoveragePercent
      : percentOrZero(input.eventSchemaCoveragePercent, 'eventSchemaCoveragePercent'),
    eventTenantBindingPercent: input.eventTenantBindingPercent == null
      ? input.eventTenantBindingPercent
      : percentOrZero(input.eventTenantBindingPercent, 'eventTenantBindingPercent'),
    eventReceiptBindingPercent: input.eventReceiptBindingPercent == null
      ? input.eventReceiptBindingPercent
      : percentOrZero(input.eventReceiptBindingPercent, 'eventReceiptBindingPercent'),
    evidenceCoveragePercent: input.evidenceCoveragePercent == null
      ? input.evidenceCoveragePercent
      : percentOrZero(input.evidenceCoveragePercent, 'evidenceCoveragePercent'),
    downstreamReceiptCoveragePercent: input.downstreamReceiptCoveragePercent == null
      ? input.downstreamReceiptCoveragePercent
      : percentOrZero(
        input.downstreamReceiptCoveragePercent,
        'downstreamReceiptCoveragePercent',
      ),
  });
  const thresholds = DEFAULT_THRESHOLDS;
  const gates = Object.freeze([
    integrationGate(normalizedInput),
    shadowObservationGate(normalizedInput, thresholds),
    eventQualityGate(normalizedInput, thresholds),
    evidenceCoverageGate(normalizedInput, thresholds),
    activeQuestionGate(normalizedInput, thresholds),
    approvalPathGate(normalizedInput),
    rolloutGate(normalizedInput),
    rollbackGate(normalizedInput),
    receiptAuditGate(normalizedInput),
    nonClaimGate(normalizedInput),
  ]);
  const blockers = Object.freeze(
    gates
      .filter((entry) => entry.required && entry.status !== 'pass')
      .flatMap((entry) => entry.blockers.map((blocker) => `${entry.id}:${blocker}`)),
  );
  const verdict: PilotReadinessVerdict = blockers.length > 0
    ? 'not-ready'
    : normalizedInput.stage === 'shadow-entry'
      ? 'ready-for-shadow-pilot'
      : 'ready-for-scoped-pilot';
  const canonical = canonicalObject({
    version: PILOT_READINESS_PACKET_VERSION,
    generatedAt,
    pilotRefDigest: normalizedInput.pilotRefDigest,
    tenantRefDigest: normalizedInput.tenantRefDigest,
    requesterRefDigest: normalizedInput.requesterRefDigest,
    targetSystemRefDigest: normalizedInput.targetSystemRefDigest,
    integrationOwnerRefDigest: normalizedInput.integrationOwnerRefDigest,
    systemOfRecordOwnerRefDigest: normalizedInput.systemOfRecordOwnerRefDigest,
    targetRecipeRefs: normalizedInput.targetRecipeRefs,
    stage: normalizedInput.stage,
    rolloutMode: normalizedInput.rolloutMode,
    thresholds,
    gates,
    decision: {
      verdict,
      blockers,
    },
    sourceBacked: true,
    reviewByException: true,
    customerOwnsSystemOfRecord: true,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    recordsSystem: false,
    workflowWorkspace: false,
    complianceCertification: false,
    clinicalAuthority: false,
    insuranceSystemOfRecord: false,
    productionReady: false,
  } as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: PILOT_READINESS_PACKET_VERSION,
    generatedAt,
    pilotRefDigest: normalizedInput.pilotRefDigest,
    tenantRefDigest: normalizedInput.tenantRefDigest,
    requesterRefDigest: normalizedInput.requesterRefDigest,
    targetSystemRefDigest: normalizedInput.targetSystemRefDigest,
    integrationOwnerRefDigest: normalizedInput.integrationOwnerRefDigest,
    systemOfRecordOwnerRefDigest: normalizedInput.systemOfRecordOwnerRefDigest,
    targetRecipeRefs: normalizedInput.targetRecipeRefs,
    stage: normalizedInput.stage,
    rolloutMode: normalizedInput.rolloutMode,
    thresholds,
    gates,
    decision: Object.freeze({
      verdict,
      blockers,
    }),
    sourceBacked: true,
    reviewByException: true,
    customerOwnsSystemOfRecord: true,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    recordsSystem: false,
    workflowWorkspace: false,
    complianceCertification: false,
    clinicalAuthority: false,
    insuranceSystemOfRecord: false,
    productionReady: false,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function pilotReadinessPacketDescriptor(): PilotReadinessPacketDescriptor {
  return Object.freeze({
    version: PILOT_READINESS_PACKET_VERSION,
    stages: PILOT_READINESS_STAGES,
    rolloutModes: PILOT_READINESS_ROLLOUT_MODES,
    verdicts: PILOT_READINESS_VERDICTS,
    gateIds: PILOT_READINESS_GATE_IDS,
    thresholds: DEFAULT_THRESHOLDS,
    sourceBacked: true,
    reviewByException: true,
    customerOwnsSystemOfRecord: true,
    customerDeploymentRequired: true,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    nativeConnectorCoverage: false,
    customerDeploymentProven: false,
    recordsSystem: false,
    workflowWorkspace: false,
    complianceCertification: false,
    clinicalAuthority: false,
    insuranceSystemOfRecord: false,
    productionReady: false,
  });
}
