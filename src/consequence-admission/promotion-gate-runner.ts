import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
} from './assurance-case-contract.js';
import {
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  type CandidateInvariantSynthesizerRecord,
} from './candidate-invariant-synthesizer.js';
import {
  INVARIANT_PROMOTION_GATE_VERSION,
} from './invariant-promotion-gate.js';
import {
  REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
  type ReviewerOpenDefeaterViewRecord,
} from './reviewer-open-defeater-view.js';

export const PROMOTION_GATE_RUNNER_VERSION =
  'attestor.promotion-gate-runner.v1';

export const PROMOTION_GATE_RUNNER_SOURCE_ANCHORS = [
  'assurance-2-indefeasibility-explicit-defeaters',
  'cmu-sei-eliminative-argumentation-confidence',
  'omg-sacm-argumentation-assets',
  'gsn-community-standard-v3-goal-strategy-solution',
  'cisa-ssvc-evidence-to-action-decision-tree',
  'github-code-scanning-dismissal-audit-separation',
] as const;
export type PromotionGateRunnerSourceAnchor =
  typeof PROMOTION_GATE_RUNNER_SOURCE_ANCHORS[number];

export const PROMOTION_GATE_RUNNER_REQUESTED_ACTIONS = [
  'open-review-only-patch-handoff',
  'record-review-decision',
  'close-defeaters',
  'activate-policy',
  'activate-live-enforcement',
] as const;
export type PromotionGateRunnerRequestedAction =
  typeof PROMOTION_GATE_RUNNER_REQUESTED_ACTIONS[number];

export const PROMOTION_GATE_RUNNER_OUTCOMES = [
  'promotion-gate-ready-for-review-only-patch-handoff',
  'promotion-gate-held-for-open-defeaters',
  'promotion-gate-held-for-assurance-case',
  'promotion-gate-held-for-claim-readiness',
  'promotion-gate-held-for-reviewer-view',
  'promotion-gate-rejected-boundary',
] as const;
export type PromotionGateRunnerOutcome =
  typeof PROMOTION_GATE_RUNNER_OUTCOMES[number];

export const PROMOTION_GATE_RUNNER_DANGER_FLAGS = [
  'synthesized-claim-not-ready',
  'reviewer-view-not-ready',
  'open-defeaters-present',
  'assurance-case-unbound',
  'claim-node-missing',
  'strategy-node-missing',
  'synthesized-claim-mismatch',
  'tenant-mismatch',
  'cohort-ref-mismatch',
  'invariant-ref-mismatch',
  'raw-evidence-requested',
  'reviewer-decision-requested',
  'defeater-closure-requested',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type PromotionGateRunnerDangerFlag =
  typeof PROMOTION_GATE_RUNNER_DANGER_FLAGS[number];

export interface CreatePromotionGateRunnerInput {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly reviewerView: ReviewerOpenDefeaterViewRecord;
  readonly gateId: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly requestedAction?: PromotionGateRunnerRequestedAction | null;
  readonly rawEvidenceRequested?: boolean | null;
  readonly reviewerDecisionRequested?: boolean | null;
  readonly defeaterClosureRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface PromotionGateRunnerRecord {
  readonly version: typeof PROMOTION_GATE_RUNNER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly reviewerOpenDefeaterViewVersion:
    typeof REVIEWER_OPEN_DEFEATER_VIEW_VERSION;
  readonly invariantPromotionGateVersion: typeof INVARIANT_PROMOTION_GATE_VERSION;
  readonly gateId: string;
  readonly gateRefDigest: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly requestedAction: PromotionGateRunnerRequestedAction;
  readonly synthesizedClaimDigest: string;
  readonly reviewerViewDigest: string;
  readonly candidateInvariantDigest: string;
  readonly invariantRefDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly claimNodeDigest: string | null;
  readonly strategyNodeDigest: string | null;
  readonly openDefeaterCount: number;
  readonly sourceRecordDigests: readonly string[];
  readonly boundedIndefeasibilityPredicateSatisfied: boolean;
  readonly predicateScope: 'reviewer-open-defeater-view';
  readonly outcome: PromotionGateRunnerOutcome;
  readonly readyForReviewOnlyPatchHandoff: boolean;
  readonly reviewOnlyPatchHandoffAllowed: boolean;
  readonly failClosed: boolean;
  readonly dangerFlags: readonly PromotionGateRunnerDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly digestOnly: true;
  readonly noRawEvidence: true;
  readonly noReviewerDecision: true;
  readonly noDefeaterClosure: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noPatchGeneration: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface PromotionGateRunnerDescriptor {
  readonly version: typeof PROMOTION_GATE_RUNNER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly reviewerOpenDefeaterViewVersion:
    typeof REVIEWER_OPEN_DEFEATER_VIEW_VERSION;
  readonly invariantPromotionGateVersion: typeof INVARIANT_PROMOTION_GATE_VERSION;
  readonly sourceAnchors: readonly PromotionGateRunnerSourceAnchor[];
  readonly requestedActions: readonly PromotionGateRunnerRequestedAction[];
  readonly outcomes: readonly PromotionGateRunnerOutcome[];
  readonly dangerFlags: readonly PromotionGateRunnerDangerFlag[];
  readonly predicateScope: 'reviewer-open-defeater-view';
  readonly requiresNoOpenDefeaters: true;
  readonly requiresAssuranceCaseBinding: true;
  readonly requiresClaimAndStrategyNodes: true;
  readonly handoffOnly: true;
  readonly digestOnly: true;
  readonly noRawEvidence: true;
  readonly noReviewerDecision: true;
  readonly noDefeaterClosure: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noPatchGeneration: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Promotion gate runner ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Promotion gate runner ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Promotion gate runner ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Promotion gate runner ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeRequestedAction(
  value: PromotionGateRunnerRequestedAction | null | undefined,
): PromotionGateRunnerRequestedAction {
  const action = value ?? 'open-review-only-patch-handoff';
  if (!PROMOTION_GATE_RUNNER_REQUESTED_ACTIONS.includes(action)) {
    throw new Error('Promotion gate runner requestedAction is not supported.');
  }
  return action;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: PROMOTION_GATE_RUNNER_VERSION,
    value,
  }).digest;
}

function assertSourceBindings(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly reviewerView: ReviewerOpenDefeaterViewRecord;
}): void {
  if (input.synthesizedClaim.version !== CANDIDATE_INVARIANT_SYNTHESIZER_VERSION) {
    throw new Error('Promotion gate runner synthesized claim version mismatch.');
  }
  if (input.reviewerView.version !== REVIEWER_OPEN_DEFEATER_VIEW_VERSION) {
    throw new Error('Promotion gate runner reviewer view version mismatch.');
  }
  if (input.reviewerView.synthesizedClaimDigest !== input.synthesizedClaim.digest) {
    throw new Error('Promotion gate runner synthesized claim mismatch.');
  }
  if (input.reviewerView.tenantRefDigest !== input.synthesizedClaim.tenantRefDigest) {
    throw new Error('Promotion gate runner tenant mismatch.');
  }
  if (input.reviewerView.cohortRefDigest !== input.synthesizedClaim.cohortRefDigest) {
    throw new Error('Promotion gate runner cohort ref mismatch.');
  }
  if (
    input.reviewerView.invariantRefDigest !== input.synthesizedClaim.invariantRefDigest
  ) {
    throw new Error('Promotion gate runner invariant ref mismatch.');
  }
  if (
    input.reviewerView.candidateInvariantDigest !==
      input.synthesizedClaim.candidateInvariantDigest
  ) {
    throw new Error('Promotion gate runner candidate invariant mismatch.');
  }
}

function flagsFor(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly reviewerView: ReviewerOpenDefeaterViewRecord;
  readonly requestedAction: PromotionGateRunnerRequestedAction;
  readonly rawEvidenceRequested: boolean;
  readonly reviewerDecisionRequested: boolean;
  readonly defeaterClosureRequested: boolean;
  readonly policyActivationRequested: boolean;
  readonly liveEnforcementRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly PromotionGateRunnerDangerFlag[] {
  const flags = new Set<PromotionGateRunnerDangerFlag>();
  if (!input.synthesizedClaim.readyForOpenDefeaterReview) {
    flags.add('synthesized-claim-not-ready');
  }
  if (!input.reviewerView.readyForReviewer || !input.reviewerView.readyForPromotionGateInput) {
    flags.add('reviewer-view-not-ready');
  }
  if (input.reviewerView.openDefeaterCount > 0) {
    flags.add('open-defeaters-present');
  }
  if (input.synthesizedClaim.assuranceCaseRefDigest === null ||
      input.reviewerView.assuranceCaseRefDigest === null) {
    flags.add('assurance-case-unbound');
  }
  if (input.synthesizedClaim.claimNodeDigest === null ||
      input.reviewerView.claimNodeDigest === null) {
    flags.add('claim-node-missing');
  }
  if (input.synthesizedClaim.strategyNodeDigest === null ||
      input.reviewerView.strategyNodeDigest === null) {
    flags.add('strategy-node-missing');
  }
  if (
    input.requestedAction === 'record-review-decision' ||
    input.reviewerDecisionRequested
  ) {
    flags.add('reviewer-decision-requested');
  }
  if (
    input.requestedAction === 'close-defeaters' ||
    input.defeaterClosureRequested
  ) {
    flags.add('defeater-closure-requested');
  }
  if (
    input.requestedAction === 'activate-policy' ||
    input.policyActivationRequested
  ) {
    flags.add('policy-activation-requested');
  }
  if (
    input.requestedAction === 'activate-live-enforcement' ||
    input.liveEnforcementRequested
  ) {
    flags.add('live-enforcement-requested');
  }
  if (input.rawEvidenceRequested) {
    flags.add('raw-evidence-requested');
  }
  if (input.authorityActionRequested) {
    flags.add('authority-action-requested');
  }
  return uniqueSorted([...flags]);
}

function outcomeFor(
  flags: readonly PromotionGateRunnerDangerFlag[],
): PromotionGateRunnerOutcome {
  if (
    flags.includes('raw-evidence-requested') ||
    flags.includes('reviewer-decision-requested') ||
    flags.includes('defeater-closure-requested') ||
    flags.includes('policy-activation-requested') ||
    flags.includes('live-enforcement-requested') ||
    flags.includes('authority-action-requested')
  ) {
    return 'promotion-gate-rejected-boundary';
  }
  if (
    flags.includes('assurance-case-unbound') ||
    flags.includes('claim-node-missing') ||
    flags.includes('strategy-node-missing')
  ) {
    return 'promotion-gate-held-for-assurance-case';
  }
  if (flags.includes('synthesized-claim-not-ready')) {
    return 'promotion-gate-held-for-claim-readiness';
  }
  if (flags.includes('open-defeaters-present')) {
    return 'promotion-gate-held-for-open-defeaters';
  }
  if (flags.includes('reviewer-view-not-ready')) {
    return 'promotion-gate-held-for-reviewer-view';
  }
  return 'promotion-gate-ready-for-review-only-patch-handoff';
}

function reasonCodesFor(input: {
  readonly outcome: PromotionGateRunnerOutcome;
  readonly flags: readonly PromotionGateRunnerDangerFlag[];
  readonly requestedAction: PromotionGateRunnerRequestedAction;
  readonly openDefeaterCount: number;
}): readonly string[] {
  const reasons = new Set<string>([
    `promotion-gate-outcome:${input.outcome}`,
    `promotion-gate-requested-action:${input.requestedAction}`,
    `promotion-gate-open-defeater-count:${input.openDefeaterCount}`,
    ...input.flags.map((flag) => `promotion-gate-flag:${flag}`),
  ]);
  if (input.flags.length === 0) {
    reasons.add('promotion-gate-indefeasibility-predicate-satisfied');
  }
  return uniqueSorted([...reasons]);
}

export function createPromotionGateRunner(
  input: CreatePromotionGateRunnerInput,
): PromotionGateRunnerRecord {
  const gateId = normalizeIdentifier(input.gateId, 'gateId');
  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const requestedAction = normalizeRequestedAction(input.requestedAction);
  assertSourceBindings({
    synthesizedClaim: input.synthesizedClaim,
    reviewerView: input.reviewerView,
  });
  const flags = flagsFor({
    synthesizedClaim: input.synthesizedClaim,
    reviewerView: input.reviewerView,
    requestedAction,
    rawEvidenceRequested: input.rawEvidenceRequested === true,
    reviewerDecisionRequested: input.reviewerDecisionRequested === true,
    defeaterClosureRequested: input.defeaterClosureRequested === true,
    policyActivationRequested: input.policyActivationRequested === true,
    liveEnforcementRequested: input.liveEnforcementRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const outcome = outcomeFor(flags);
  const readyForReviewOnlyPatchHandoff =
    outcome === 'promotion-gate-ready-for-review-only-patch-handoff';
  const reasonCodes = reasonCodesFor({
    outcome,
    flags,
    requestedAction,
    openDefeaterCount: input.reviewerView.openDefeaterCount,
  });
  const gateRefDigest = bodyDigest('promotion-gate-runner-ref', {
    gateId,
    evaluatedAt,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    reviewerViewDigest: input.reviewerView.digest,
    requestedAction,
  } as CanonicalReleaseJsonValue);
  const core: Omit<PromotionGateRunnerRecord, 'canonical' | 'digest'> = {
    version: PROMOTION_GATE_RUNNER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    reviewerOpenDefeaterViewVersion: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    invariantPromotionGateVersion: INVARIANT_PROMOTION_GATE_VERSION,
    gateId,
    gateRefDigest,
    evaluatedAt,
    evaluatorRefDigest,
    requestedAction,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    reviewerViewDigest: input.reviewerView.digest,
    candidateInvariantDigest: input.synthesizedClaim.candidateInvariantDigest,
    invariantRefDigest: input.synthesizedClaim.invariantRefDigest,
    tenantRefDigest: input.synthesizedClaim.tenantRefDigest,
    cohortRefDigest: input.synthesizedClaim.cohortRefDigest,
    assuranceCaseRefDigest: input.synthesizedClaim.assuranceCaseRefDigest,
    claimNodeDigest: input.synthesizedClaim.claimNodeDigest,
    strategyNodeDigest: input.synthesizedClaim.strategyNodeDigest,
    openDefeaterCount: input.reviewerView.openDefeaterCount,
    sourceRecordDigests: input.reviewerView.sourceRecordDigests,
    boundedIndefeasibilityPredicateSatisfied: readyForReviewOnlyPatchHandoff,
    predicateScope: 'reviewer-open-defeater-view',
    outcome,
    readyForReviewOnlyPatchHandoff,
    reviewOnlyPatchHandoffAllowed: readyForReviewOnlyPatchHandoff,
    failClosed: !readyForReviewOnlyPatchHandoff,
    dangerFlags: flags,
    reasonCodes,
    digestOnly: true,
    noRawEvidence: true,
    noReviewerDecision: true,
    noDefeaterClosure: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noPatchGeneration: true,
    noLearning: true,
    noTraining: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function promotionGateRunnerDescriptor(): PromotionGateRunnerDescriptor {
  return Object.freeze({
    version: PROMOTION_GATE_RUNNER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    reviewerOpenDefeaterViewVersion: REVIEWER_OPEN_DEFEATER_VIEW_VERSION,
    invariantPromotionGateVersion: INVARIANT_PROMOTION_GATE_VERSION,
    sourceAnchors: PROMOTION_GATE_RUNNER_SOURCE_ANCHORS,
    requestedActions: PROMOTION_GATE_RUNNER_REQUESTED_ACTIONS,
    outcomes: PROMOTION_GATE_RUNNER_OUTCOMES,
    dangerFlags: PROMOTION_GATE_RUNNER_DANGER_FLAGS,
    predicateScope: 'reviewer-open-defeater-view',
    requiresNoOpenDefeaters: true,
    requiresAssuranceCaseBinding: true,
    requiresClaimAndStrategyNodes: true,
    handoffOnly: true,
    digestOnly: true,
    noRawEvidence: true,
    noReviewerDecision: true,
    noDefeaterClosure: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noPatchGeneration: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-review-decision',
      'not-defeater-closure',
      'not-policy-patch-generator',
      'not-policy-activation',
      'not-live-enforcement',
      'not-authority-granting',
      'not-production-ready',
    ]),
  });
}
