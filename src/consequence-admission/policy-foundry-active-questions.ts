import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  PolicyFoundryActiveQuestion,
  PolicyFoundryActiveQuestionKind,
  PolicyFoundryNoGoReason,
  PolicyFoundryReadinessEvaluation,
  PolicyFoundryRolloutStep,
} from './policy-foundry-readiness.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION =
  'attestor.policy-foundry-active-question-packet.v1';

export const POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_STATUSES = [
  'questions-required',
  'no-active-questions',
] as const;
export type PolicyFoundryActiveQuestionPacketStatus =
  typeof POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_STATUSES[number];

export const POLICY_FOUNDRY_ACTIVE_QUESTION_ANSWER_KINDS = [
  'continue-shadow-window',
  'policy-template-ref',
  'evidence-source-ref',
  'authority-source-ref',
  'adapter-readiness-ref',
  'review-disposition',
  'yes-no',
  'replay-result',
  'approval-decision',
] as const;
export type PolicyFoundryActiveQuestionAnswerKind =
  typeof POLICY_FOUNDRY_ACTIVE_QUESTION_ANSWER_KINDS[number];

export interface CreatePolicyFoundryActiveQuestionPacketInput {
  readonly readiness: PolicyFoundryReadinessEvaluation;
  readonly generatedAt?: string | null;
  readonly maxQuestions?: number | null;
}

export interface PolicyFoundryActiveQuestionPacketItem {
  readonly questionId: string;
  readonly kind: PolicyFoundryActiveQuestionKind;
  readonly priority: number;
  readonly prompt: string;
  readonly expectedAnswerKind: PolicyFoundryActiveQuestionAnswerKind;
  readonly blocksReasonCodes: readonly PolicyFoundryNoGoReason[];
}

export interface PolicyFoundryActiveQuestionPacket {
  readonly version: typeof POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION;
  readonly generatedAt: string;
  readonly readinessDigest: string;
  readonly readinessStatus: PolicyFoundryReadinessEvaluation['status'];
  readonly candidateId: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly status: PolicyFoundryActiveQuestionPacketStatus;
  readonly nextSafeStep: PolicyFoundryRolloutStep;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly llmAuthorityAllowed: false;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-active-questions';
  readonly questionCount: number;
  readonly omittedQuestionCount: number;
  readonly blockingReasonCount: number;
  readonly questions: readonly PolicyFoundryActiveQuestionPacketItem[];
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryActiveQuestionPacketDescriptor {
  readonly version: typeof POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-active-questions';
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly llmAuthorityAllowed: false;
  readonly rawPayloadStored: false;
  readonly decisionSupportOnly: true;
  readonly defaultMaxQuestions: number;
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
    throw new Error(`Policy Foundry active question packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function positiveInteger(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  const raw = value ?? fallback;
  if (!Number.isInteger(raw) || raw < 1) {
    throw new Error(`Policy Foundry active question packet ${fieldName} must be a positive integer.`);
  }
  return raw;
}

function expectedAnswerKind(
  kind: PolicyFoundryActiveQuestionKind,
): PolicyFoundryActiveQuestionAnswerKind {
  switch (kind) {
    case 'continue-shadow':
      return 'continue-shadow-window';
    case 'choose-policy-template':
      return 'policy-template-ref';
    case 'bind-evidence':
      return 'evidence-source-ref';
    case 'bind-authority':
      return 'authority-source-ref';
    case 'prepare-adapter':
      return 'adapter-readiness-ref';
    case 'review-counterexamples':
      return 'review-disposition';
    case 'confirm-representative-sample':
      return 'yes-no';
    case 'run-red-team-replay':
      return 'replay-result';
    case 'approve-candidate':
      return 'approval-decision';
  }
}

function reasonCodesForQuestion(
  kind: PolicyFoundryActiveQuestionKind,
  reasons: readonly PolicyFoundryNoGoReason[],
): readonly PolicyFoundryNoGoReason[] {
  const mapped: Record<PolicyFoundryActiveQuestionKind, readonly PolicyFoundryNoGoReason[]> = {
    'continue-shadow': ['sample-size-too-small', 'no-simulation-report', 'candidate-missing'],
    'choose-policy-template': ['missing-policy-schema'],
    'bind-evidence': ['missing-evidence-coverage'],
    'bind-authority': ['missing-authority-binding', 'llm-authority-source'],
    'prepare-adapter': ['adapter-readiness-missing'],
    'review-counterexamples': [
      'counterexamples-present',
      'high-risk-auto-admit',
      'replay-duplicate-pressure',
      'tenant-boundary-not-proven',
    ],
    'confirm-representative-sample': ['single-actor-concentration'],
    'run-red-team-replay': ['red-team-replay-not-run', 'red-team-replay-failed'],
    'approve-candidate': ['customer-approval-required'],
  };
  return Object.freeze(mapped[kind].filter((reason) => reasons.includes(reason)));
}

function packetItem(
  question: PolicyFoundryActiveQuestion,
  reasons: readonly PolicyFoundryNoGoReason[],
): PolicyFoundryActiveQuestionPacketItem {
  return Object.freeze({
    questionId: question.questionId,
    kind: question.kind,
    priority: question.priority,
    prompt: question.prompt,
    expectedAnswerKind: expectedAnswerKind(question.kind),
    blocksReasonCodes: reasonCodesForQuestion(question.kind, reasons),
  });
}

export function createPolicyFoundryActiveQuestionPacket(
  input: CreatePolicyFoundryActiveQuestionPacketInput,
): PolicyFoundryActiveQuestionPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const maxQuestions = positiveInteger(input.maxQuestions, 3, 'maxQuestions');
  const sortedQuestions = [...input.readiness.activeQuestions]
    .sort((left, right) => right.priority - left.priority || left.kind.localeCompare(right.kind));
  const selectedQuestions = sortedQuestions.slice(0, maxQuestions).map((question) =>
    packetItem(question, input.readiness.noGoReasons)
  );
  const payload = {
    version: POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION as typeof POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION,
    generatedAt,
    readinessDigest: input.readiness.digest,
    readinessStatus: input.readiness.status,
    candidateId: input.readiness.candidateId,
    actionSurface: input.readiness.actionSurface,
    domain: input.readiness.domain,
    status: selectedQuestions.length > 0
      ? 'questions-required' as const
      : 'no-active-questions' as const,
    nextSafeStep: input.readiness.recommendedRolloutStep,
    approvalRequired: true as const,
    autoEnforce: false as const,
    llmAuthorityAllowed: false as const,
    rawPayloadStored: false as const,
    decisionSupportOnly: true as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-active-questions' as const,
    questionCount: selectedQuestions.length,
    omittedQuestionCount: Math.max(0, sortedQuestions.length - selectedQuestions.length),
    blockingReasonCount: input.readiness.noGoReasons.length,
    questions: Object.freeze(selectedQuestions),
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryActiveQuestionPacketDescriptor(): PolicyFoundryActiveQuestionPacketDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_ACTIVE_QUESTION_PACKET_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-active-questions',
    approvalRequired: true,
    autoEnforce: false,
    llmAuthorityAllowed: false,
    rawPayloadStored: false,
    decisionSupportOnly: true,
    defaultMaxQuestions: 3,
  });
}
