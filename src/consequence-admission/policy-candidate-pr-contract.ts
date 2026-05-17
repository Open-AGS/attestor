import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  EvidenceStateField,
  EvidenceStateModel,
  EvidenceStateModelSurface,
} from './evidence-state-model.js';

export const POLICY_CANDIDATE_PR_CONTRACT_VERSION =
  'attestor.policy-candidate-pr-contract.v1';

export const POLICY_CANDIDATE_PR_DIFF_KINDS = [
  'add-policy-candidate',
  'add-evidence-requirement',
  'add-review-gate',
  'keep-shadow',
] as const;
export type PolicyCandidatePrDiffKind =
  typeof POLICY_CANDIDATE_PR_DIFF_KINDS[number];

export const POLICY_CANDIDATE_PR_APPROVAL_STATES = [
  'draft',
  'blocked',
  'needs-answer',
  'approval-ready',
  'approved',
] as const;
export type PolicyCandidatePrApprovalState =
  typeof POLICY_CANDIDATE_PR_APPROVAL_STATES[number];

export const POLICY_CANDIDATE_PR_RISK_BANDS = [
  'low',
  'medium',
  'high',
  'blocker',
] as const;
export type PolicyCandidatePrRiskBand =
  typeof POLICY_CANDIDATE_PR_RISK_BANDS[number];

export interface PolicyCandidatePrOperation {
  readonly op: 'add';
  readonly path: string;
  readonly valueDigest: string;
  readonly reasonCodes: readonly string[];
}

export interface PolicyCandidatePrPatch {
  readonly targetPath: string;
  readonly beforeDigest: string | null;
  readonly afterDigest: string;
  readonly operations: readonly PolicyCandidatePrOperation[];
  readonly summary: string;
}

export interface PolicyCandidatePrCandidate {
  readonly candidateId: string;
  readonly surfaceId: string;
  readonly actionSurface: string;
  readonly tenantRefDigest: string;
  readonly sourceEvidenceStateDigest: string;
  readonly sourceEvidenceModelDigest: string;
  readonly sourceGraphDigest: string;
  readonly sourceEventDigests: readonly string[];
  readonly schemaDigest: string;
  readonly basePolicyBundleDigest: string | null;
  readonly diffKind: PolicyCandidatePrDiffKind;
  readonly approvalState: PolicyCandidatePrApprovalState;
  readonly riskScore: number;
  readonly riskBand: PolicyCandidatePrRiskBand;
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
  readonly inferredFields: readonly EvidenceStateField[];
  readonly missingEvidenceFields: readonly EvidenceStateField[];
  readonly blockerReasonCodes: readonly string[];
  readonly proposedPolicyDigest: string;
  readonly proposedPolicyPatch: PolicyCandidatePrPatch;
  readonly reviewChecklist: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly digest: string;
}

export interface CreatePolicyCandidatePrContractInput {
  readonly evidenceStateModel: EvidenceStateModel;
  readonly generatedAt?: string | null;
  readonly schemaDigest: string;
  readonly basePolicyBundleDigest?: string | null;
  readonly replayDigestBySurfaceId?: Readonly<Record<string, string | null>> | null;
  readonly questionDigestsBySurfaceId?:
    Readonly<Record<string, readonly string[] | null>> | null;
  readonly approvalStateBySurfaceId?:
    Readonly<Record<string, PolicyCandidatePrApprovalState | null>> | null;
  readonly riskScoreBySurfaceId?: Readonly<Record<string, number | null>> | null;
}

export interface PolicyCandidatePrContract {
  readonly version: typeof POLICY_CANDIDATE_PR_CONTRACT_VERSION;
  readonly generatedAt: string;
  readonly evidenceStateModelDigest: string;
  readonly evidenceStateModelVersion: EvidenceStateModel['version'];
  readonly graphDigest: string;
  readonly tenantRefDigest: string;
  readonly schemaDigest: string;
  readonly basePolicyBundleDigest: string | null;
  readonly candidateCount: number;
  readonly approvalReadyCount: number;
  readonly blockedCount: number;
  readonly needsAnswerCount: number;
  readonly approvedCount: number;
  readonly candidates: readonly PolicyCandidatePrCandidate[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyCandidatePrContractDescriptor {
  readonly version: typeof POLICY_CANDIDATE_PR_CONTRACT_VERSION;
  readonly diffKinds: typeof POLICY_CANDIDATE_PR_DIFF_KINDS;
  readonly approvalStates: typeof POLICY_CANDIDATE_PR_APPROVAL_STATES;
  readonly riskBands: typeof POLICY_CANDIDATE_PR_RISK_BANDS;
  readonly tenantBound: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly reviewMaterialOnly: true;
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
    throw new Error(`Policy candidate PR contract ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeDigest(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Policy candidate PR contract ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null || value.trim().length === 0) {
    return null;
  }
  return normalizeDigest(value, fieldName);
}

function normalizeQuestionDigests(
  values: readonly string[] | null | undefined,
  surfaceId: string,
): readonly string[] {
  return Object.freeze(
    [...new Set((values ?? []).map((value, index) =>
      normalizeDigest(value, `questionDigestsBySurfaceId.${surfaceId}[${index}]`),
    ))].sort(),
  );
}

function normalizeRiskScore(value: number | null | undefined, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`Policy candidate PR contract ${fieldName} must be an integer from 0 to 100.`);
  }
  return value;
}

function normalizeApprovalState(
  value: PolicyCandidatePrApprovalState | null | undefined,
  surfaceId: string,
): PolicyCandidatePrApprovalState | null {
  if (value === undefined || value === null) return null;
  if (
    !(POLICY_CANDIDATE_PR_APPROVAL_STATES as readonly string[]).includes(value)
  ) {
    throw new Error(
      `Policy candidate PR contract approvalStateBySurfaceId.${surfaceId} is not supported.`,
    );
  }
  return value;
}

function fieldsWithState(
  surface: EvidenceStateModelSurface,
  state: string,
): readonly EvidenceStateField[] {
  return Object.freeze(
    surface.states
      .filter((entry) => entry.state === state && entry.field !== 'enforceability')
      .map((entry) => entry.field)
      .sort(),
  );
}

function blockerReasonCodes(surface: EvidenceStateModelSurface): readonly string[] {
  return Object.freeze(
    [...new Set(
      surface.promotionBlockers
        .filter((blocker) => blocker.field !== 'enforceability')
        .flatMap((blocker) => blocker.reasonCodes),
    )]
      .sort(),
  );
}

function defaultRiskScore(input: {
  readonly surface: EvidenceStateModelSurface;
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
}): number {
  let score = 10;
  for (const blocker of input.surface.promotionBlockers.filter((entry) =>
    entry.field !== 'enforceability'
  )) {
    switch (blocker.state) {
      case 'conflicting':
        score += 20;
        break;
      case 'untrusted':
        score += 15;
        break;
      case 'missing':
      case 'stale':
        score += 12;
        break;
      case 'inferred':
        score += 8;
        break;
      default:
        score += 5;
        break;
    }
  }
  if (!input.surface.readyForPolicyCandidate) score += 10;
  if (input.replayDigest === null) score += 8;
  if (input.questionDigests.length > 0) score += 5;
  return Math.min(100, score);
}

function riskBandFor(score: number): PolicyCandidatePrRiskBand {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'blocker';
}

function diffKindFor(input: {
  readonly missingFields: readonly EvidenceStateField[];
  readonly blockerCodes: readonly string[];
  readonly questionDigests: readonly string[];
  readonly replayDigest: string | null;
}): PolicyCandidatePrDiffKind {
  if (input.missingFields.length > 0) return 'add-evidence-requirement';
  if (input.blockerCodes.length > 0) return 'keep-shadow';
  if (input.questionDigests.length > 0) return 'add-review-gate';
  if (input.replayDigest !== null) return 'add-policy-candidate';
  return 'keep-shadow';
}

function defaultApprovalState(input: {
  readonly blockerCodes: readonly string[];
  readonly questionDigests: readonly string[];
  readonly replayDigest: string | null;
}): PolicyCandidatePrApprovalState {
  if (input.blockerCodes.length > 0) return 'blocked';
  if (input.questionDigests.length > 0) return 'needs-answer';
  if (input.replayDigest === null) return 'draft';
  return 'approval-ready';
}

function validateApprovalState(input: {
  readonly surfaceId: string;
  readonly approvalState: PolicyCandidatePrApprovalState;
  readonly blockerCodes: readonly string[];
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
}): void {
  if (input.blockerCodes.length > 0 && input.approvalState !== 'blocked') {
    throw new Error(
      `Policy candidate PR contract cannot mark blocked candidate ${input.surfaceId} as reviewable or approved.`,
    );
  }
  if (
    input.replayDigest === null &&
    (input.approvalState === 'approval-ready' || input.approvalState === 'approved')
  ) {
    throw new Error(
      `Policy candidate PR contract approval-ready and approved states require replay digest evidence for ${input.surfaceId}.`,
    );
  }
  if (input.questionDigests.length > 0 && input.approvalState === 'approved') {
    throw new Error(
      `Policy candidate PR contract cannot approve candidate ${input.surfaceId} with unanswered question digests.`,
    );
  }
}

function reviewChecklist(input: {
  readonly missingFields: readonly EvidenceStateField[];
  readonly inferredFields: readonly EvidenceStateField[];
  readonly blockerCodes: readonly string[];
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
  readonly approvalState: PolicyCandidatePrApprovalState;
}): readonly string[] {
  const checklist: string[] = [];
  if (input.missingFields.length > 0) {
    checklist.push(`bind digest-only evidence for ${input.missingFields.join(', ')}`);
  }
  if (input.inferredFields.length > 0) {
    checklist.push(`confirm inferred fields ${input.inferredFields.join(', ')}`);
  }
  if (input.blockerCodes.some((code) => code.includes('conflict'))) {
    checklist.push('resolve conflicting evidence before promotion');
  }
  if (input.blockerCodes.some((code) => code.includes('stale'))) {
    checklist.push('refresh stale evidence before promotion');
  }
  if (input.blockerCodes.some((code) => code.includes('untrusted'))) {
    checklist.push('approve or replace untrusted producer before promotion');
  }
  if (input.questionDigests.length > 0) {
    checklist.push('answer active questions before approval');
  }
  if (input.replayDigest === null) {
    checklist.push('attach replay digest before approval-ready state');
  }
  if (input.approvalState === 'approval-ready') {
    checklist.push('human reviewer may approve or dismiss the candidate');
  } else if (input.approvalState === 'blocked') {
    checklist.push('keep candidate in shadow until blockers are closed');
  } else {
    checklist.push('human approval remains required before enforcement activation');
  }
  return Object.freeze([...new Set(checklist)]);
}

function proposedPolicyDraft(input: {
  readonly surface: EvidenceStateModelSurface;
  readonly schemaDigest: string;
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
  readonly inferredFields: readonly EvidenceStateField[];
  readonly missingFields: readonly EvidenceStateField[];
  readonly blockerCodes: readonly string[];
}): CanonicalReleaseJsonValue {
  return {
    surfaceId: input.surface.surfaceId,
    actionSurface: input.surface.actionSurface,
    tenantRefDigest: input.surface.tenantRefDigest,
    schemaDigest: input.schemaDigest,
    sourceEvidenceStateDigest: input.surface.digest,
    sourceEventDigests: input.surface.sourceEventDigests,
    defaultMode: input.blockerCodes.length === 0 ? 'review' : 'observe',
    inferredFields: input.inferredFields,
    missingEvidenceFields: input.missingFields,
    blockerReasonCodes: input.blockerCodes,
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
    approvalRequired: true,
    autoEnforce: false,
  } as unknown as CanonicalReleaseJsonValue;
}

function createCandidate(input: {
  readonly surface: EvidenceStateModelSurface;
  readonly evidenceStateModel: EvidenceStateModel;
  readonly schemaDigest: string;
  readonly basePolicyBundleDigest: string | null;
  readonly replayDigest: string | null;
  readonly questionDigests: readonly string[];
  readonly approvalStateOverride: PolicyCandidatePrApprovalState | null;
  readonly riskScoreOverride: number | null;
}): PolicyCandidatePrCandidate {
  const inferredFields = fieldsWithState(input.surface, 'inferred');
  const missingFields = fieldsWithState(input.surface, 'missing');
  const blockerCodes = blockerReasonCodes(input.surface);
  const approvalState = input.approvalStateOverride ?? defaultApprovalState({
    blockerCodes,
    questionDigests: input.questionDigests,
    replayDigest: input.replayDigest,
  });
  validateApprovalState({
    surfaceId: input.surface.surfaceId,
    approvalState,
    blockerCodes,
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
  });
  const riskScore = input.riskScoreOverride ?? defaultRiskScore({
    surface: input.surface,
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
  });
  const policyDraft = proposedPolicyDraft({
    surface: input.surface,
    schemaDigest: input.schemaDigest,
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
    inferredFields,
    missingFields,
    blockerCodes,
  });
  const proposedPolicyDigest = hashCanonical(policyDraft);
  const patch: PolicyCandidatePrPatch = Object.freeze({
    targetPath: `policy-candidates/${input.surface.surfaceId}.json`,
    beforeDigest: input.basePolicyBundleDigest,
    afterDigest: proposedPolicyDigest,
    operations: Object.freeze([
      Object.freeze({
        op: 'add' as const,
        path: `/policyCandidates/${input.surface.surfaceId}`,
        valueDigest: proposedPolicyDigest,
        reasonCodes: Object.freeze(
          blockerCodes.length > 0 ? blockerCodes : ['policy-candidate-review-required'],
        ),
      }),
    ]),
    summary: 'review-only policy candidate patch; no enforcement activation',
  });
  const candidateIdentity = hashCanonical({
    version: POLICY_CANDIDATE_PR_CONTRACT_VERSION,
    surfaceId: input.surface.surfaceId,
    sourceEvidenceStateDigest: input.surface.digest,
    schemaDigest: input.schemaDigest,
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
  } as unknown as CanonicalReleaseJsonValue);
  const payload = {
    candidateId: `policy-candidate-pr:${candidateIdentity.slice('sha256:'.length, 23)}`,
    surfaceId: input.surface.surfaceId,
    actionSurface: input.surface.actionSurface,
    tenantRefDigest: input.surface.tenantRefDigest,
    sourceEvidenceStateDigest: input.surface.digest,
    sourceEvidenceModelDigest: input.evidenceStateModel.digest,
    sourceGraphDigest: input.evidenceStateModel.graphDigest,
    sourceEventDigests: input.surface.sourceEventDigests,
    schemaDigest: input.schemaDigest,
    basePolicyBundleDigest: input.basePolicyBundleDigest,
    diffKind: diffKindFor({
      missingFields,
      blockerCodes,
      questionDigests: input.questionDigests,
      replayDigest: input.replayDigest,
    }),
    approvalState,
    riskScore,
    riskBand: riskBandFor(riskScore),
    replayDigest: input.replayDigest,
    questionDigests: input.questionDigests,
    inferredFields,
    missingEvidenceFields: missingFields,
    blockerReasonCodes: blockerCodes,
    proposedPolicyDigest,
    proposedPolicyPatch: patch,
    reviewChecklist: reviewChecklist({
      missingFields,
      inferredFields,
      blockerCodes,
      replayDigest: input.replayDigest,
      questionDigests: input.questionDigests,
      approvalState,
    }),
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
  };
  return Object.freeze({
    ...payload,
    digest: hashCanonical(payload as unknown as CanonicalReleaseJsonValue),
  });
}

export function createPolicyCandidatePrContract(
  input: CreatePolicyCandidatePrContractInput,
): PolicyCandidatePrContract {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    input.evidenceStateModel.generatedAt,
    'generatedAt',
  );
  const schemaDigest = normalizeDigest(input.schemaDigest, 'schemaDigest');
  const basePolicyBundleDigest = normalizeOptionalDigest(
    input.basePolicyBundleDigest,
    'basePolicyBundleDigest',
  );
  const candidates = Object.freeze(
    input.evidenceStateModel.surfaces
      .map((surface) => {
        const replayDigest = normalizeOptionalDigest(
          input.replayDigestBySurfaceId?.[surface.surfaceId],
          `replayDigestBySurfaceId.${surface.surfaceId}`,
        );
        return createCandidate({
          surface,
          evidenceStateModel: input.evidenceStateModel,
          schemaDigest,
          basePolicyBundleDigest,
          replayDigest,
          questionDigests: normalizeQuestionDigests(
            input.questionDigestsBySurfaceId?.[surface.surfaceId],
            surface.surfaceId,
          ),
          approvalStateOverride: normalizeApprovalState(
            input.approvalStateBySurfaceId?.[surface.surfaceId],
            surface.surfaceId,
          ),
          riskScoreOverride: normalizeRiskScore(
            input.riskScoreBySurfaceId?.[surface.surfaceId],
            `riskScoreBySurfaceId.${surface.surfaceId}`,
          ),
        });
      })
      .sort((left, right) =>
        left.actionSurface.localeCompare(right.actionSurface) ||
        left.surfaceId.localeCompare(right.surfaceId)
      ),
  );
  const payload = {
    version: POLICY_CANDIDATE_PR_CONTRACT_VERSION as typeof POLICY_CANDIDATE_PR_CONTRACT_VERSION,
    generatedAt,
    evidenceStateModelDigest: input.evidenceStateModel.digest,
    evidenceStateModelVersion: input.evidenceStateModel.version,
    graphDigest: input.evidenceStateModel.graphDigest,
    tenantRefDigest: input.evidenceStateModel.tenantRefDigest,
    schemaDigest,
    basePolicyBundleDigest,
    candidateCount: candidates.length,
    approvalReadyCount: candidates.filter((candidate) =>
      candidate.approvalState === 'approval-ready'
    ).length,
    blockedCount: candidates.filter((candidate) =>
      candidate.approvalState === 'blocked'
    ).length,
    needsAnswerCount: candidates.filter((candidate) =>
      candidate.approvalState === 'needs-answer'
    ).length,
    approvedCount: candidates.filter((candidate) =>
      candidate.approvalState === 'approved'
    ).length,
    candidates,
    approvalRequired: true as const,
    autoEnforce: false as const,
    activatesEnforcement: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    reviewMaterialOnly: true as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyCandidatePrContractDescriptor():
PolicyCandidatePrContractDescriptor {
  return Object.freeze({
    version: POLICY_CANDIDATE_PR_CONTRACT_VERSION,
    diffKinds: POLICY_CANDIDATE_PR_DIFF_KINDS,
    approvalStates: POLICY_CANDIDATE_PR_APPROVAL_STATES,
    riskBands: POLICY_CANDIDATE_PR_RISK_BANDS,
    tenantBound: true,
    approvalRequired: true,
    autoEnforce: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    productionReady: false,
    reviewMaterialOnly: true,
  });
}
