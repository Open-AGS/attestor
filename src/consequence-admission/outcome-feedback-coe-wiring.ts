import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseContract,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
  type OutcomeIncidentConsequenceEffect,
  type OutcomeIncidentFeedbackContract,
  type OutcomeIncidentFeedbackStatus,
  type OutcomeIncidentNoGoReason,
  type OutcomeIncidentReplayTriggerReason,
} from './outcome-incident-feedback-contract.js';

export const OUTCOME_FEEDBACK_COE_WIRING_VERSION =
  'attestor.outcome-feedback-coe-wiring.v1';

export const OUTCOME_FEEDBACK_COE_SOURCE_ANCHORS = [
  'aws-correction-of-error-systemic-action-items',
  'google-sre-blameless-postmortem-action-items',
  'nist-sp800-61r3-lessons-learned-lifecycle',
  'nist-ai-rmf-manage-feedback-loop',
  'mit-stpa-unsafe-control-action-feedback',
  'assurance-2-rebutting-defeater-for-contradictory-outcome',
] as const;
export type OutcomeFeedbackCoeSourceAnchor =
  typeof OUTCOME_FEEDBACK_COE_SOURCE_ANCHORS[number];

export const OUTCOME_FEEDBACK_COE_FINDINGS = [
  'no-feedback-events',
  'only-inferred-feedback',
  'assurance-packet-not-ready',
  'feedback-no-go-reasons-open',
  'failed-outcome-observed',
  'contested-outcome-observed',
  'reversed-outcome-observed',
  'near-miss-outcome-observed',
  'confirmed-incident-observed',
  'customer-impact-observed',
  'tenant-impact-observed',
  'systemic-impact-observed',
  'replay-regression-required',
  'blocked-mutation-requested',
  'coe-reference-missing',
  'coe-impact-missing',
  'coe-timeline-missing',
  'coe-five-whys-missing',
  'coe-action-items-missing',
  'raw-feedback-requested',
  'raw-payload-requested',
  'audit-write-requested',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type OutcomeFeedbackCoeFinding =
  typeof OUTCOME_FEEDBACK_COE_FINDINGS[number];

export const OUTCOME_FEEDBACK_COE_OUTCOMES = [
  'outcome-feedback-coe-evidence-ready',
  'outcome-feedback-coe-open-rebutting-defeater',
  'outcome-feedback-coe-held-for-feedback-binding',
  'outcome-feedback-coe-rejected-boundary',
] as const;
export type OutcomeFeedbackCoeOutcome =
  typeof OUTCOME_FEEDBACK_COE_OUTCOMES[number];

export interface OutcomeFeedbackCoeReferenceInput {
  readonly coeRefDigest?: string | null;
  readonly impactRefDigest?: string | null;
  readonly timelineRefDigest?: string | null;
  readonly fiveWhysRefDigest?: string | null;
  readonly actionItemDigests?: readonly string[] | null;
}

export interface OutcomeFeedbackCoeReferences {
  readonly coeRefDigest: string | null;
  readonly impactRefDigest: string | null;
  readonly timelineRefDigest: string | null;
  readonly fiveWhysRefDigest: string | null;
  readonly actionItemDigests: readonly string[];
  readonly actionItemCount: number;
}

export interface CreateOutcomeFeedbackCoeWiringInput {
  readonly assuranceCase: AssuranceCaseContract;
  readonly feedback: OutcomeIncidentFeedbackContract;
  readonly wiringId: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly targetClaimNodeId?: string | null;
  readonly coe?: OutcomeFeedbackCoeReferenceInput | null;
  readonly minimumActionItemCount?: number | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly rawFeedbackRequested?: boolean | null;
  readonly rawPayloadRequested?: boolean | null;
  readonly auditWriteRequested?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface OutcomeFeedbackCoeWiringRecord {
  readonly version: typeof OUTCOME_FEEDBACK_COE_WIRING_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly outcomeIncidentFeedbackContractVersion:
    typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly wiringId: string;
  readonly wiringRefDigest: string;
  readonly evaluatedAt: string;
  readonly evaluatorRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly feedbackDigest: string;
  readonly feedbackStatus: OutcomeIncidentFeedbackStatus;
  readonly feedbackNoGoReasons: readonly OutcomeIncidentNoGoReason[];
  readonly replayTriggerReasons: readonly OutcomeIncidentReplayTriggerReason[];
  readonly highestConsequenceEffect: OutcomeIncidentConsequenceEffect;
  readonly coeReferences: OutcomeFeedbackCoeReferences;
  readonly coeRequired: boolean;
  readonly coeComplete: boolean;
  readonly minimumActionItemCount: number;
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly openDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly openDefeaterDigest: string | null;
  readonly outcome: OutcomeFeedbackCoeOutcome;
  readonly findings: readonly OutcomeFeedbackCoeFinding[];
  readonly reasonCodes: readonly string[];
  readonly opensRebuttingDefeater: boolean;
  readonly feedbackReadOnly: true;
  readonly assuranceCaseReadOnly: true;
  readonly digestOnly: true;
  readonly noRawFeedback: true;
  readonly noRawPayload: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noAuthorityAction: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface OutcomeFeedbackCoeWiringDescriptor {
  readonly version: typeof OUTCOME_FEEDBACK_COE_WIRING_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly outcomeIncidentFeedbackContractVersion:
    typeof OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION;
  readonly sourceAnchors: readonly OutcomeFeedbackCoeSourceAnchor[];
  readonly outcomes: readonly OutcomeFeedbackCoeOutcome[];
  readonly findings: readonly OutcomeFeedbackCoeFinding[];
  readonly mapsOutcomeToRebuttingDefeater: true;
  readonly requiresCoeForNegativeOutcome: true;
  readonly requiresActionItemsForIncidentLearning: true;
  readonly doesNotMutateAssuranceCase: true;
  readonly doesNotCloseDefeaters: true;
  readonly feedbackIsNotAuthority: true;
  readonly readOnly: true;
  readonly digestOnly: true;
  readonly noRawFeedback: true;
  readonly noRawPayload: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly noAuthorityAction: true;
  readonly noLearning: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DEFAULT_MINIMUM_ACTION_ITEM_COUNT = 1;

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
    throw new Error(`Outcome feedback COE wiring ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Outcome feedback COE wiring ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Outcome feedback COE wiring ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  return normalizeDigest(value, fieldName);
}

function normalizeDigestList(
  values: readonly string[] | null | undefined,
  fieldName: string,
): readonly string[] {
  if (!values) return Object.freeze([]);
  return Object.freeze([...new Set(values.map((value) =>
    normalizeDigest(value, fieldName)
  ))].sort());
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Outcome feedback COE wiring ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
): number {
  const raw = value ?? DEFAULT_MINIMUM_ACTION_ITEM_COUNT;
  if (!Number.isInteger(raw) || raw <= 0 || raw > 100) {
    throw new Error(`Outcome feedback COE wiring ${fieldName} must be a bounded positive integer.`);
  }
  return raw;
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
    value,
  }).digest;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function coeReferencesFor(
  input: OutcomeFeedbackCoeReferenceInput | null | undefined,
): OutcomeFeedbackCoeReferences {
  const actionItemDigests = normalizeDigestList(
    input?.actionItemDigests,
    'coe.actionItemDigests',
  );
  return Object.freeze({
    coeRefDigest: normalizeOptionalDigest(input?.coeRefDigest, 'coe.coeRefDigest'),
    impactRefDigest: normalizeOptionalDigest(input?.impactRefDigest, 'coe.impactRefDigest'),
    timelineRefDigest: normalizeOptionalDigest(input?.timelineRefDigest, 'coe.timelineRefDigest'),
    fiveWhysRefDigest: normalizeOptionalDigest(
      input?.fiveWhysRefDigest,
      'coe.fiveWhysRefDigest',
    ),
    actionItemDigests,
    actionItemCount: actionItemDigests.length,
  });
}

function assertAssuranceCase(input: AssuranceCaseContract): void {
  if (input.version !== ASSURANCE_CASE_CONTRACT_VERSION) {
    throw new Error('Outcome feedback COE wiring assurance case version mismatch.');
  }
  if (
    input.grantsAuthority ||
    input.canAdmit ||
    input.activatesEnforcement ||
    input.autoEnforce ||
    input.productionReady ||
    input.noRawPayloadStorage !== true
  ) {
    throw new Error('Outcome feedback COE wiring requires a no-authority assurance case.');
  }
}

function assertFeedback(input: OutcomeIncidentFeedbackContract): void {
  if (input.version !== OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION) {
    throw new Error('Outcome feedback COE wiring feedback version mismatch.');
  }
  if (
    input.grantsAuthority ||
    input.canAdmit ||
    input.activatesEnforcement ||
    input.autoEnforce ||
    input.productionReady ||
    input.rawPayloadStored ||
    input.feedbackInputOnly !== true
  ) {
    throw new Error('Outcome feedback COE wiring requires no-authority feedback input.');
  }
}

function feedbackHasNegativeOutcome(input: OutcomeIncidentFeedbackContract): boolean {
  return input.summary.failedCount > 0 ||
    input.summary.contestedCount > 0 ||
    input.summary.reversedCount > 0 ||
    input.summary.nearMissCount > 0 ||
    input.replayRegressionRequired ||
    input.incidentReviewRequired ||
    input.summary.sourceCounts.confirmedIncident > 0 ||
    input.summary.highestConsequenceEffect === 'customer-impact' ||
    input.summary.highestConsequenceEffect === 'tenant-impact' ||
    input.summary.highestConsequenceEffect === 'systemic-impact';
}

function coeRequiredFor(input: OutcomeIncidentFeedbackContract): boolean {
  return feedbackHasNegativeOutcome(input);
}

function coeCompleteFor(input: {
  readonly coeRequired: boolean;
  readonly coeReferences: OutcomeFeedbackCoeReferences;
  readonly feedbackActionItemCount: number;
  readonly minimumActionItemCount: number;
}): boolean {
  if (!input.coeRequired) return true;
  return input.coeReferences.coeRefDigest !== null &&
    input.coeReferences.impactRefDigest !== null &&
    input.coeReferences.timelineRefDigest !== null &&
    input.coeReferences.fiveWhysRefDigest !== null &&
    input.feedbackActionItemCount + input.coeReferences.actionItemCount >=
      input.minimumActionItemCount;
}

function findingsFor(input: {
  readonly feedback: OutcomeIncidentFeedbackContract;
  readonly coeRequired: boolean;
  readonly coeReferences: OutcomeFeedbackCoeReferences;
  readonly minimumActionItemCount: number;
  readonly rawFeedbackRequested: boolean;
  readonly rawPayloadRequested: boolean;
  readonly auditWriteRequested: boolean;
  readonly policyActivationRequested: boolean;
  readonly liveEnforcementRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly OutcomeFeedbackCoeFinding[] {
  const findings = new Set<OutcomeFeedbackCoeFinding>();
  if (input.feedback.noGoReasons.length > 0) {
    findings.add('feedback-no-go-reasons-open');
  }
  if (input.feedback.noGoReasons.includes('no-feedback-events')) {
    findings.add('no-feedback-events');
  }
  if (input.feedback.noGoReasons.includes('only-inferred-feedback')) {
    findings.add('only-inferred-feedback');
  }
  if (input.feedback.noGoReasons.includes('assurance-packet-not-ready')) {
    findings.add('assurance-packet-not-ready');
  }
  if (input.feedback.summary.failedCount > 0) findings.add('failed-outcome-observed');
  if (input.feedback.summary.contestedCount > 0) findings.add('contested-outcome-observed');
  if (input.feedback.summary.reversedCount > 0) findings.add('reversed-outcome-observed');
  if (input.feedback.summary.nearMissCount > 0) findings.add('near-miss-outcome-observed');
  if (input.feedback.summary.sourceCounts.confirmedIncident > 0) {
    findings.add('confirmed-incident-observed');
  }
  if (input.feedback.summary.highestConsequenceEffect === 'customer-impact') {
    findings.add('customer-impact-observed');
  }
  if (input.feedback.summary.highestConsequenceEffect === 'tenant-impact') {
    findings.add('tenant-impact-observed');
  }
  if (input.feedback.summary.highestConsequenceEffect === 'systemic-impact') {
    findings.add('systemic-impact-observed');
  }
  if (input.feedback.replayRegressionRequired) {
    findings.add('replay-regression-required');
  }
  if (input.feedback.blockedMutationRequests.length > 0) {
    findings.add('blocked-mutation-requested');
  }
  if (input.coeRequired && input.coeReferences.coeRefDigest === null) {
    findings.add('coe-reference-missing');
  }
  if (input.coeRequired && input.coeReferences.impactRefDigest === null) {
    findings.add('coe-impact-missing');
  }
  if (input.coeRequired && input.coeReferences.timelineRefDigest === null) {
    findings.add('coe-timeline-missing');
  }
  if (input.coeRequired && input.coeReferences.fiveWhysRefDigest === null) {
    findings.add('coe-five-whys-missing');
  }
  if (
    input.coeRequired &&
    input.feedback.summary.actionItemCount + input.coeReferences.actionItemCount <
      input.minimumActionItemCount
  ) {
    findings.add('coe-action-items-missing');
  }
  if (input.rawFeedbackRequested) findings.add('raw-feedback-requested');
  if (input.rawPayloadRequested) findings.add('raw-payload-requested');
  if (input.auditWriteRequested) findings.add('audit-write-requested');
  if (input.policyActivationRequested) findings.add('policy-activation-requested');
  if (input.liveEnforcementRequested) findings.add('live-enforcement-requested');
  if (input.authorityActionRequested) findings.add('authority-action-requested');
  return uniqueSorted([...findings]);
}

function hasBoundaryFinding(findings: readonly OutcomeFeedbackCoeFinding[]): boolean {
  return findings.some((finding) =>
    finding === 'raw-feedback-requested' ||
    finding === 'raw-payload-requested' ||
    finding === 'audit-write-requested' ||
    finding === 'policy-activation-requested' ||
    finding === 'live-enforcement-requested' ||
    finding === 'authority-action-requested'
  );
}

function hasRebuttingFinding(findings: readonly OutcomeFeedbackCoeFinding[]): boolean {
  return findings.some((finding) =>
    finding === 'failed-outcome-observed' ||
    finding === 'contested-outcome-observed' ||
    finding === 'reversed-outcome-observed' ||
    finding === 'near-miss-outcome-observed' ||
    finding === 'confirmed-incident-observed' ||
    finding === 'customer-impact-observed' ||
    finding === 'tenant-impact-observed' ||
    finding === 'systemic-impact-observed' ||
    finding === 'replay-regression-required'
  );
}

function outcomeFor(findings: readonly OutcomeFeedbackCoeFinding[]):
OutcomeFeedbackCoeOutcome {
  if (hasBoundaryFinding(findings)) return 'outcome-feedback-coe-rejected-boundary';
  if (hasRebuttingFinding(findings)) {
    return 'outcome-feedback-coe-open-rebutting-defeater';
  }
  if (findings.length > 0) return 'outcome-feedback-coe-held-for-feedback-binding';
  return 'outcome-feedback-coe-evidence-ready';
}

function reasonCodesFor(input: {
  readonly outcome: OutcomeFeedbackCoeOutcome;
  readonly findings: readonly OutcomeFeedbackCoeFinding[];
  readonly coeRequired: boolean;
  readonly coeComplete: boolean;
}): readonly string[] {
  const reasons = new Set<string>([
    `outcome-feedback-coe-outcome:${input.outcome}`,
    `outcome-feedback-coe-required:${input.coeRequired}`,
    `outcome-feedback-coe-complete:${input.coeComplete}`,
    ...input.findings.map((finding) => `outcome-feedback-coe-finding:${finding}`),
  ]);
  if (input.findings.length === 0) reasons.add('outcome-feedback-coe-no-finding');
  return uniqueSorted([...reasons]);
}

export function createOutcomeFeedbackCoeWiring(
  input: CreateOutcomeFeedbackCoeWiringInput,
): OutcomeFeedbackCoeWiringRecord {
  assertAssuranceCase(input.assuranceCase);
  assertFeedback(input.feedback);

  const assuranceCase = input.assuranceCase;
  const feedback = input.feedback;
  const wiringId = normalizeIdentifier(input.wiringId, 'wiringId');
  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const evaluatorRefDigest = normalizeDigest(input.evaluatorRefDigest, 'evaluatorRefDigest');
  const targetClaimNodeId = normalizeIdentifier(
    input.targetClaimNodeId ?? assuranceCase.rootClaimId,
    'targetClaimNodeId',
  );
  const targetClaimNode = assuranceCase.nodes.find((node) =>
    node.nodeId === targetClaimNodeId && node.kind === 'claim');
  if (!targetClaimNode) {
    throw new Error('Outcome feedback COE wiring target claim node must exist in the assurance case.');
  }
  const coeReferences = coeReferencesFor(input.coe);
  const minimumActionItemCount = normalizePositiveInteger(
    input.minimumActionItemCount,
    'minimumActionItemCount',
  );
  const coeRequired = coeRequiredFor(feedback);
  const coeComplete = coeCompleteFor({
    coeRequired,
    coeReferences,
    feedbackActionItemCount: feedback.summary.actionItemCount,
    minimumActionItemCount,
  });
  const findings = findingsFor({
    feedback,
    coeRequired,
    coeReferences,
    minimumActionItemCount,
    rawFeedbackRequested: input.rawFeedbackRequested === true,
    rawPayloadRequested: input.rawPayloadRequested === true,
    auditWriteRequested: input.auditWriteRequested === true,
    policyActivationRequested: input.policyActivationRequested === true,
    liveEnforcementRequested: input.liveEnforcementRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const outcome = outcomeFor(findings);
  const reasonCodes = reasonCodesFor({ outcome, findings, coeRequired, coeComplete });
  const evidenceBodyDigest = bodyDigest('outcome-feedback-coe:evidence', {
    wiringId,
    assuranceCaseDigest: assuranceCase.digest,
    feedbackDigest: feedback.digest,
    feedbackStatus: feedback.status,
    feedbackNoGoReasons: feedback.noGoReasons,
    replayTriggerReasons: feedback.replayTriggerReasons,
    highestConsequenceEffect: feedback.summary.highestConsequenceEffect,
    coeReferences: coeReferences as unknown as CanonicalReleaseJsonValue,
    coeRequired,
    coeComplete,
    findings,
    outcome,
  });
  const transitionReasonDigest = bodyDigest('outcome-feedback-coe:transition', {
    wiringId,
    reasonCodes,
  });
  const rejected = outcome === 'outcome-feedback-coe-rejected-boundary';
  const opensRebuttingDefeater =
    outcome === 'outcome-feedback-coe-open-rebutting-defeater';

  const evidenceNode = rejected || opensRebuttingDefeater ||
    outcome === 'outcome-feedback-coe-held-for-feedback-binding'
    ? null
    : createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ?? `evidence:${wiringId}:outcome-feedback-coe`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'Outcome feedback supports the claim without open COE findings',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest: assuranceCase.tenantRefDigest,
        scopeDigest: targetClaimNode.scopeDigest,
        createdByRefDigest: evaluatorRefDigest,
        createdAt: evaluatedAt,
      });
  const openDefeater = rejected || !opensRebuttingDefeater
    ? null
    : createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ?? `defeater:${wiringId}:outcome-feedback-coe`,
          'defeaterId',
        ),
        kind: 'rebutting',
        state: 'open',
        attacksNodeId: targetClaimNodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest: assuranceCase.tenantRefDigest,
        openedByRefDigest: evaluatorRefDigest,
        openedAt: evaluatedAt,
      });
  const evidenceTransition = evidenceNode
    ? createAssuranceCaseTransition({
        transitionId: `transition:${wiringId}:outcome-feedback-coe-evidence`,
        transitionKind: 'create-node',
        actorRefDigest: evaluatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: evidenceNode.digest,
      })
    : null;
  const defeaterTransition = openDefeater
    ? createAssuranceCaseTransition({
        transitionId: `transition:${wiringId}:outcome-feedback-coe-defeater`,
        transitionKind: 'open-defeater',
        actorRefDigest: evaluatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: openDefeater.defeaterId,
        toState: 'open',
        evidenceRefDigest: evidenceBodyDigest,
      })
    : null;
  const wiringRefDigest = bodyDigest('outcome-feedback-coe:ref', {
    wiringId,
    assuranceCaseDigest: assuranceCase.digest,
    feedbackDigest: feedback.digest,
    evaluatedAt,
  });
  const core: Omit<OutcomeFeedbackCoeWiringRecord, 'canonical' | 'digest'> = {
    version: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    outcomeIncidentFeedbackContractVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    wiringId,
    wiringRefDigest,
    evaluatedAt,
    evaluatorRefDigest,
    tenantRefDigest: assuranceCase.tenantRefDigest,
    scopeDigest: targetClaimNode.scopeDigest,
    targetClaimNodeId,
    feedbackDigest: feedback.digest,
    feedbackStatus: feedback.status,
    feedbackNoGoReasons: Object.freeze([...feedback.noGoReasons]),
    replayTriggerReasons: Object.freeze([...feedback.replayTriggerReasons]),
    highestConsequenceEffect: feedback.summary.highestConsequenceEffect,
    coeReferences,
    coeRequired,
    coeComplete,
    minimumActionItemCount,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    openDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    openDefeaterDigest: openDefeater?.digest ?? null,
    outcome,
    findings,
    reasonCodes,
    opensRebuttingDefeater,
    feedbackReadOnly: true,
    assuranceCaseReadOnly: true,
    digestOnly: true,
    noRawFeedback: true,
    noRawPayload: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noAuthorityAction: true,
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

export function outcomeFeedbackCoeWiringDescriptor():
OutcomeFeedbackCoeWiringDescriptor {
  return Object.freeze({
    version: OUTCOME_FEEDBACK_COE_WIRING_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    outcomeIncidentFeedbackContractVersion: OUTCOME_INCIDENT_FEEDBACK_CONTRACT_VERSION,
    sourceAnchors: OUTCOME_FEEDBACK_COE_SOURCE_ANCHORS,
    outcomes: OUTCOME_FEEDBACK_COE_OUTCOMES,
    findings: OUTCOME_FEEDBACK_COE_FINDINGS,
    mapsOutcomeToRebuttingDefeater: true,
    requiresCoeForNegativeOutcome: true,
    requiresActionItemsForIncidentLearning: true,
    doesNotMutateAssuranceCase: true,
    doesNotCloseDefeaters: true,
    feedbackIsNotAuthority: true,
    readOnly: true,
    digestOnly: true,
    noRawFeedback: true,
    noRawPayload: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    noAuthorityAction: true,
    noLearning: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-policy-activation',
      'not-live-enforcement',
      'not-feedback-authority',
      'not-assurance-case-mutation',
      'not-defeater-closure',
      'not-review-decision',
      'not-learning',
      'not-training',
      'not-production-readiness',
      'not-coe-conformance',
    ]),
  });
}
