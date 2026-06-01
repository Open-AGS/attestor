import {
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  mapFinancePipelineDecisionToAdmission,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionCheckOutcome,
  type ConsequenceAdmissionConstraint,
  type ConsequenceAdmissionDecision,
  type ConsequenceAdmissionEvidenceRef,
  type ConsequenceAdmissionNativeDecision,
  type ConsequenceAdmissionProofRef,
  type ConsequenceAdmissionProposedConsequence,
  type ConsequenceAdmissionRequest,
  type ConsequenceAdmissionResponse,
} from './index.js';
import {
  evaluateConsequenceApprovalProvenance,
  type ConsequenceApprovalProvenanceClaim,
  type ConsequenceApprovalProvenanceDecision,
} from './approval-provenance-guard.js';
import {
  evaluateConsequenceToolResultPoisoning,
  type ConsequenceToolResultClaim,
  type ConsequenceToolResultEvidenceClass,
  type ConsequenceToolResultPoisoningDecision,
} from './tool-result-poisoning-guard.js';
import {
  evaluateConsequenceUntrustedContentAuthority,
  type ConsequenceUntrustedContentAuthorityDecision,
  type ConsequenceUntrustedContentAuthoritySource,
} from './untrusted-content-authority-guard.js';

export const FINANCE_PIPELINE_ADMISSION_ROUTE = '/api/v1/pipeline/run';
export const FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID = 'finance-pipeline-run';
export const FINANCE_PIPELINE_ADMISSION_SOURCE_REF =
  'src/service/http/routes/pipeline-execution-routes.ts';

type OperationalPrimitive = string | number | boolean | null;

export interface FinancePipelineAdmissionTrustGuardInput {
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
  readonly approvals?: readonly ConsequenceApprovalProvenanceClaim[];
  readonly allowedToolResultEvidenceClasses?:
    readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly ConsequenceToolResultClaim[] | null;
}

export interface FinancePipelineAdmissionRequestInput
  extends FinancePipelineAdmissionTrustGuardInput {
  readonly requestedAt: string;
  readonly requestId?: string | null;
  readonly runId?: string | null;
  readonly actor?: string | null;
  readonly action?: string | null;
  readonly downstreamSystem?: string | null;
  readonly consequenceKind?: ConsequenceAdmissionProposedConsequence['consequenceKind'];
  readonly riskClass?: ConsequenceAdmissionProposedConsequence['riskClass'];
  readonly summary?: string | null;
  readonly policyRef?: string | null;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly dimensions?: Readonly<Record<string, OperationalPrimitive>>;
  readonly actorRef?: string | null;
  readonly reviewerRef?: string | null;
  readonly signerRef?: string | null;
  readonly delegationRef?: string | null;
  readonly authorityMode?: string | null;
  readonly evidence?: readonly ConsequenceAdmissionEvidenceRef[];
  readonly nativeInputRefs?: readonly string[];
}

export interface FinanceFilingReleaseAdmissionSummary {
  readonly targetId?: string | null;
  readonly decisionId?: string | null;
  readonly decisionStatus?: string | null;
  readonly policyVersion?: string | null;
  readonly introspectionRequired?: boolean | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
  readonly tokenId?: string | null;
  readonly token?: string | null;
  readonly expiresAt?: string | null;
  readonly evidencePackId?: string | null;
  readonly evidencePackPath?: string | null;
  readonly evidencePackDigest?: string | null;
  readonly reviewQueueId?: string | null;
  readonly reviewQueuePath?: string | null;
}

export interface FinanceShadowReleaseAdmissionSummary {
  readonly targetId?: string | null;
  readonly decisionId?: string | null;
  readonly decisionStatus?: string | null;
  readonly policyVersion?: string | null;
  readonly policyRolloutMode?: string | null;
  readonly policyEvaluationMode?: string | null;
  readonly wouldBlockIfEnforced?: boolean | null;
  readonly wouldRequireReview?: boolean | null;
  readonly wouldRequireToken?: boolean | null;
  readonly outputHash?: string | null;
  readonly consequenceHash?: string | null;
}

export interface FinancePipelineAdmissionRun {
  readonly runId: string;
  readonly decision: string;
  readonly proofMode?: string | null;
  readonly warrant?: string | null;
  readonly escrow?: string | null;
  readonly receipt?: string | null;
  readonly capsule?: string | null;
  readonly auditChainIntact?: boolean | null;
  readonly certificate?: Record<string, unknown> | null;
  readonly verification?: Record<string, unknown> | null;
  readonly signingMode?: string | null;
  readonly identitySource?: string | null;
  readonly reviewerName?: string | null;
  readonly tenantContext?: {
    readonly tenantId?: string | null;
    readonly source?: string | null;
    readonly planId?: string | null;
  } | null;
  readonly usage?: {
    readonly used?: number | null;
    readonly remaining?: number | null;
    readonly quota?: number | null;
    readonly enforced?: boolean | null;
  } | null;
  readonly rateLimit?: {
    readonly remaining?: number | null;
    readonly resetAt?: string | null;
    readonly enforced?: boolean | null;
  } | null;
  readonly release?: {
    readonly filingExport?: FinanceFilingReleaseAdmissionSummary | null;
    readonly communication?: FinanceShadowReleaseAdmissionSummary | null;
    readonly action?: FinanceShadowReleaseAdmissionSummary | null;
  } | null;
  readonly filingExport?: {
    readonly adapterId?: string | null;
    readonly coveragePercent?: number | null;
    readonly mappedCount?: number | null;
  } | null;
  readonly filingPackage?: {
    readonly adapterId?: string | null;
    readonly coveragePercent?: number | null;
    readonly mappedCount?: number | null;
    readonly issuedPackage?: Record<string, unknown> | null;
  } | null;
}

export interface CreateFinancePipelineAdmissionResponseInput
  extends FinancePipelineAdmissionTrustGuardInput {
  readonly run: FinancePipelineAdmissionRun;
  readonly decidedAt: string;
  readonly request?: ConsequenceAdmissionRequest | null;
  readonly constraints?: readonly ConsequenceAdmissionConstraint[];
  readonly operationalContext?: Readonly<Record<string, OperationalPrimitive>>;
}

export interface FinancePipelineAdmissionDescriptor {
  readonly packFamily: 'finance';
  readonly nativeSurface: 'finance-pipeline';
  readonly route: typeof FINANCE_PIPELINE_ADMISSION_ROUTE;
  readonly entryPointId: typeof FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID;
  readonly sourceRef: typeof FINANCE_PIPELINE_ADMISSION_SOURCE_REF;
  readonly nativeDecisionOrder: readonly [
    'release.filingExport.decisionStatus',
    'decision',
  ];
  readonly hostedRouteBehavior: 'unchanged';
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function statusOrNull(value: string | null | undefined): string | null {
  return textOrNull(value)?.toLowerCase() ?? null;
}

function hasClosedAuthorityChain(run: FinancePipelineAdmissionRun): boolean {
  const warrantStatus = statusOrNull(run.warrant);
  const escrowStatus = statusOrNull(run.escrow);
  const receiptStatus = statusOrNull(run.receipt);
  const capsuleStatus = statusOrNull(run.capsule);
  return (
    (warrantStatus === 'issued' || warrantStatus === 'fulfilled') &&
    escrowStatus === 'released' &&
    receiptStatus === 'issued' &&
    (capsuleStatus === 'closed' || capsuleStatus === 'authorized')
  );
}

function hasValidProofMode(run: FinancePipelineAdmissionRun): boolean {
  const proofMode = statusOrNull(run.proofMode);
  return (
    proofMode !== null &&
    !['missing', 'missing-evidence', 'missing_evidence', 'none', 'unavailable', 'unknown'].includes(proofMode)
  );
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringField(record: Record<string, unknown> | null | undefined, key: string): string | null {
  return textOrNull(record?.[key]);
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function boolOrNull(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function contextWithoutUndefined(
  input: Readonly<Record<string, OperationalPrimitive | undefined>>,
): Readonly<Record<string, OperationalPrimitive>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Record<string, OperationalPrimitive>,
  );
}

function evidenceIds(
  request: ConsequenceAdmissionRequest,
  proof: readonly ConsequenceAdmissionProofRef[],
): readonly string[] {
  return Object.freeze([
    ...request.evidence.map((entry) => entry.id),
    ...proof.map((entry) => entry.id),
  ]);
}

function normalizeReleaseStatus(run: FinancePipelineAdmissionRun): {
  readonly value: string;
  readonly source: 'release.filingExport.decisionStatus' | 'decision';
  readonly filingRelease: FinanceFilingReleaseAdmissionSummary | null;
} {
  const filingRelease = run.release?.filingExport ?? null;
  const releaseStatus = textOrNull(filingRelease?.decisionStatus);
  if (releaseStatus) {
    return Object.freeze({
      value: releaseStatus,
      source: 'release.filingExport.decisionStatus',
      filingRelease,
    });
  }
  return Object.freeze({
    value: run.decision,
    source: 'decision',
    filingRelease,
  });
}

function certificateIdFor(run: FinancePipelineAdmissionRun): string | null {
  return stringField(run.certificate, 'certificateId');
}

function certificateFingerprintFor(run: FinancePipelineAdmissionRun): string | null {
  const signing = recordOrNull(run.certificate?.signing);
  return stringField(signing, 'fingerprint');
}

function buildProofRefs(run: FinancePipelineAdmissionRun): readonly ConsequenceAdmissionProofRef[] {
  const proof: ConsequenceAdmissionProofRef[] = [];
  const certificateId = certificateIdFor(run);
  const certificateFingerprint = certificateFingerprintFor(run);
  const filingRelease = run.release?.filingExport ?? null;

  if (certificateId) {
    proof.push({
      kind: 'certificate',
      id: certificateId,
      digest: certificateFingerprint ? `fingerprint:${certificateFingerprint}` : null,
      uri: null,
      verifyHint: 'Verify the signed Attestor certificate with the returned public key material.',
    });
  }

  if (run.verification) {
    proof.push({
      kind: 'verification-kit',
      id: `verification:${run.runId}`,
      digest: stringField(run.verification, 'digest'),
      uri: stringField(run.verification, 'path'),
      verifyHint: 'Use the verification object returned by the finance pipeline response.',
    });
  }

  if (textOrNull(filingRelease?.tokenId)) {
    const tokenId = textOrNull(filingRelease?.tokenId);
    proof.push({
      kind: 'release-token',
      id: tokenId!,
      digest: null,
      uri: null,
      verifyHint: 'Verify the release token before allowing the downstream filing consequence.',
    });
  }

  const evidencePackId = textOrNull(filingRelease?.evidencePackId);
  if (evidencePackId) {
    proof.push({
      kind: 'release-evidence-pack',
      id: evidencePackId,
      digest: textOrNull(filingRelease?.evidencePackDigest),
      uri: textOrNull(filingRelease?.evidencePackPath),
      verifyHint: 'Fetch and verify the release evidence pack for the filing decision.',
    });
  }

  const reviewQueueId = textOrNull(filingRelease?.reviewQueueId);
  if (reviewQueueId) {
    proof.push({
      kind: 'local-artifact',
      id: reviewQueueId,
      digest: null,
      uri: textOrNull(filingRelease?.reviewQueuePath),
      verifyHint: 'Review queue material must be resolved before automatic consequence.',
    });
  }

  return Object.freeze(proof);
}

function tokenFreshnessOutcome(
  filingRelease: FinanceFilingReleaseAdmissionSummary | null,
  decidedAt: string,
): ConsequenceAdmissionCheckOutcome {
  const expiresAt = textOrNull(filingRelease?.expiresAt);
  if (!expiresAt) return 'not-applicable';
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'fail';
  return expiry.getTime() > new Date(decidedAt).getTime() ? 'pass' : 'fail';
}

function financeAuthorityGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
}): ConsequenceUntrustedContentAuthorityDecision | null {
  const authoritySources = input.authoritySources ?? [];
  if (authoritySources.length === 0) return null;
  return evaluateConsequenceUntrustedContentAuthority({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    requiredAuthority: true,
    sources: authoritySources,
  });
}

function financeApprovalGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly authoritySources?: readonly ConsequenceUntrustedContentAuthoritySource[];
  readonly approvals?: readonly ConsequenceApprovalProvenanceClaim[];
}): ConsequenceApprovalProvenanceDecision | null {
  const approvals = input.approvals ?? [];
  const approvalClaimPresent = (input.authoritySources ?? [])
    .some((source) => source.claimKind === 'approval');
  if (approvals.length === 0 && !approvalClaimPresent) return null;
  return evaluateConsequenceApprovalProvenance({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    approvals,
  });
}

function financeToolResultGuardDecisionFor(input: {
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly allowedToolResultEvidenceClasses?:
    readonly ConsequenceToolResultEvidenceClass[] | null;
  readonly toolResults?: readonly ConsequenceToolResultClaim[] | null;
}): ConsequenceToolResultPoisoningDecision | null {
  const hasInput =
    (input.allowedToolResultEvidenceClasses !== null &&
      input.allowedToolResultEvidenceClasses !== undefined) ||
    (input.toolResults !== null &&
      input.toolResults !== undefined);
  if (!hasInput) return null;
  return evaluateConsequenceToolResultPoisoning({
    generatedAt: input.decidedAt,
    actionSurface: 'finance-pipeline',
    action: input.request.proposedConsequence.action,
    allowedEvidenceClasses: input.allowedToolResultEvidenceClasses ?? null,
    toolResults: input.toolResults ?? null,
  });
}

function financeGuardOutcome(
  outcome: 'pass' | 'review' | 'block',
): ConsequenceAdmissionCheckOutcome {
  if (outcome === 'pass') return 'pass';
  return outcome === 'review' ? 'warn' : 'fail';
}

function buildFinanceTrustGuardChecks(input: {
  readonly authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null;
  readonly approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null;
  readonly toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null;
}): readonly ConsequenceAdmissionCheck[] {
  const checks: ConsequenceAdmissionCheck[] = [];

  if (input.authorityGuardDecision !== null) {
    checks.push(createConsequenceAdmissionCheck({
      kind: 'authority',
      label: 'Finance authority-source guard',
      outcome: financeGuardOutcome(input.authorityGuardDecision.outcome),
      required: true,
      summary:
        input.authorityGuardDecision.outcome === 'pass'
          ? 'Structured finance authority sources passed the untrusted-content guard.'
          : 'Structured finance authority sources require review before downstream consequence.',
      reasonCodes: input.authorityGuardDecision.reasonCodes,
      evidenceRefs: [input.authorityGuardDecision.digest],
    }));
  }

  if (input.approvalGuardDecision !== null) {
    checks.push(createConsequenceAdmissionCheck({
      kind: 'authority',
      label: 'Finance approval provenance guard',
      outcome: financeGuardOutcome(input.approvalGuardDecision.outcome),
      required: true,
      summary:
        input.approvalGuardDecision.outcome === 'pass'
          ? 'Structured finance approvals passed provenance checks.'
          : 'Structured finance approvals require review before downstream consequence.',
      reasonCodes: input.approvalGuardDecision.reasonCodes,
      evidenceRefs: [input.approvalGuardDecision.digest],
    }));
  }

  if (input.toolResultGuardDecision !== null) {
    checks.push(createConsequenceAdmissionCheck({
      kind: 'evidence',
      label: 'Finance tool-result guard',
      outcome: financeGuardOutcome(input.toolResultGuardDecision.outcome),
      required: true,
      summary:
        input.toolResultGuardDecision.outcome === 'pass'
          ? 'Structured finance tool-result evidence passed poisoning checks.'
          : 'Structured finance tool-result evidence requires review before downstream consequence.',
      reasonCodes: input.toolResultGuardDecision.reasonCodes,
      evidenceRefs: [input.toolResultGuardDecision.digest],
    }));
  }

  return Object.freeze(checks);
}

function buildFinanceChecks(input: {
  readonly run: FinancePipelineAdmissionRun;
  readonly request: ConsequenceAdmissionRequest;
  readonly decidedAt: string;
  readonly proof: readonly ConsequenceAdmissionProofRef[];
  readonly nativeDecisionSource: 'release.filingExport.decisionStatus' | 'decision';
  readonly filingRelease: FinanceFilingReleaseAdmissionSummary | null;
}): readonly ConsequenceAdmissionCheck[] {
  const { run, request, decidedAt, proof, nativeDecisionSource, filingRelease } = input;
  const proofEvidenceRefs = evidenceIds(request, proof);
  const status = textOrNull(filingRelease?.decisionStatus)?.toLowerCase() ?? run.decision.toLowerCase();
  const hasHardReleaseToken = Boolean(textOrNull(filingRelease?.tokenId));
  const hasReviewQueue = Boolean(textOrNull(filingRelease?.reviewQueueId));
  const hasAuthorityMaterial = hasClosedAuthorityChain(run);
  const hasProofMaterial = proof.length > 0 || run.auditChainIntact === true || hasValidProofMode(run);
  const allowStatuses = ['pass', 'accepted', 'allow', 'allowed', 'narrow', 'constrained', 'scope-reduced', 'limited'];
  const reviewStatuses = ['hold', 'review', 'review-required', 'needs-review', 'pending-review'];
  const denyStatuses = ['denied', 'fail', 'block', 'blocked', 'deny', 'revoked', 'expired'];
  const policyOutcome: ConsequenceAdmissionCheckOutcome =
    denyStatuses.includes(status)
      ? 'fail'
      : reviewStatuses.includes(status)
        ? 'warn'
        : allowStatuses.includes(status)
          ? 'pass'
          : 'fail';
  const authorityOutcome: ConsequenceAdmissionCheckOutcome =
    policyOutcome === 'fail'
      ? 'fail'
      : hasAuthorityMaterial || hasHardReleaseToken
        ? 'pass'
        : policyOutcome === 'pass'
          ? 'fail'
          : 'warn';
  const evidenceOutcome: ConsequenceAdmissionCheckOutcome =
    hasProofMaterial
      ? 'pass'
      : policyOutcome === 'fail' || policyOutcome === 'pass'
        ? 'fail'
        : 'warn';
  const freshnessOutcome = tokenFreshnessOutcome(filingRelease, decidedAt);
  const enforcementOutcome: ConsequenceAdmissionCheckOutcome =
    hasHardReleaseToken
      ? 'pass'
      : hasReviewQueue
        ? 'warn'
        : policyOutcome === 'fail'
          ? 'fail'
          : 'warn';

  return Object.freeze([
    createConsequenceAdmissionCheck({
      kind: 'policy',
      label: 'Finance policy decision',
      outcome: policyOutcome,
      required: true,
      summary:
        nativeDecisionSource === 'release.filingExport.decisionStatus'
          ? 'Finance filing release decision was projected into the canonical admission vocabulary.'
          : 'Finance pipeline decision was projected into the canonical admission vocabulary.',
      reasonCodes: [`finance-policy-${policyOutcome}`, `finance-native-${status}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'authority',
      label: 'Finance authority closure',
      outcome: authorityOutcome,
      required: true,
      summary: hasAuthorityMaterial
        ? 'Finance warrant, escrow, receipt, and capsule are closed in valid authority states.'
        : hasHardReleaseToken
          ? 'A finance release token is present for downstream authority closure.'
          : 'Finance authority material is missing or not in closed valid states.',
      reasonCodes: [`finance-authority-${authorityOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'evidence',
      label: 'Finance proof material',
      outcome: evidenceOutcome,
      required: true,
      summary: hasProofMaterial
        ? 'Finance proof material is present for independent inspection.'
        : 'Finance proof material is missing from the native response.',
      reasonCodes: [`finance-evidence-${evidenceOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'freshness',
      label: 'Finance token freshness',
      outcome: freshnessOutcome,
      required: freshnessOutcome !== 'not-applicable',
      summary: textOrNull(filingRelease?.expiresAt)
        ? 'Finance release token expiry was checked against the admission decision time.'
        : 'No finance release token expiry is present on this native response.',
      reasonCodes: [`finance-freshness-${freshnessOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'enforcement',
      label: 'Finance downstream enforcement',
      outcome: enforcementOutcome,
      required: true,
      summary: hasHardReleaseToken
        ? 'A finance release token is present for downstream enforcement.'
        : hasReviewQueue
          ? 'A finance review queue item is present, so automatic downstream consequence must hold.'
          : 'No finance release token is present; the customer system must enforce the canonical decision itself.',
      reasonCodes: [`finance-enforcement-${enforcementOutcome}`],
      evidenceRefs: proofEvidenceRefs,
    }),
    createConsequenceAdmissionCheck({
      kind: 'adapter-readiness',
      label: 'Finance hosted route adapter',
      outcome: 'pass',
      required: true,
      summary: 'The existing finance hosted proof route is wrapped without changing route behavior.',
      reasonCodes: ['finance-adapter-ready'],
      evidenceRefs: [FINANCE_PIPELINE_ADMISSION_SOURCE_REF],
    }),
  ]);
}

function failedRequiredChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) => check.required && check.outcome === 'fail'),
  );
}

function effectiveFinanceDecision(
  nativeDecision: ConsequenceAdmissionNativeDecision,
  failedChecks: readonly ConsequenceAdmissionCheck[],
  trustGuardHolds: readonly ConsequenceAdmissionCheck[],
): ConsequenceAdmissionDecision {
  if (
    (failedChecks.length > 0 || trustGuardHolds.length > 0) &&
    (nativeDecision.mappedDecision === 'admit' || nativeDecision.mappedDecision === 'narrow')
  ) {
    return 'review';
  }

  return nativeDecision.mappedDecision;
}

function nativeDecisionForEffectiveDecision(input: {
  readonly nativeDecision: ConsequenceAdmissionNativeDecision;
  readonly decision: ConsequenceAdmissionDecision;
  readonly holdChecks: readonly ConsequenceAdmissionCheck[];
}): ConsequenceAdmissionNativeDecision {
  const { nativeDecision, decision, holdChecks } = input;
  if (nativeDecision.mappedDecision === decision) {
    return nativeDecision;
  }

  const heldLabels = holdChecks.map((check) => check.label).join(', ');
  return Object.freeze({
    ...nativeDecision,
    mappedDecision: decision,
    mappingReason:
      `${nativeDecision.mappingReason} Effective canonical admission is held at review because required checks require review: ${heldLabels}.`,
  });
}

function financeTrustGuardHoldChecks(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze(
    checks.filter((check) => check.outcome === 'warn' || check.outcome === 'fail'),
  );
}

function financeTrustGuardReasonCodes(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly string[] {
  return Object.freeze(
    [...new Set(checks.flatMap((check) => check.reasonCodes))],
  );
}

function uniqueChecksByLabel(
  checks: readonly ConsequenceAdmissionCheck[],
): readonly ConsequenceAdmissionCheck[] {
  return Object.freeze([...new Map(checks.map((check) => [check.label, check])).values()]);
}

function defaultNarrowConstraints(): readonly ConsequenceAdmissionConstraint[] {
  return Object.freeze([
    {
      id: 'finance-native-constraint',
      kind: 'customer-approved-scope',
      summary: 'Proceed only under the constraints returned by the finance native surface.',
      enforcedBy: 'customer downstream system',
      parameterDigest: null,
    },
  ]);
}

export function createFinancePipelineAdmissionRequest(
  input: FinancePipelineAdmissionRequestInput,
): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: input.requestedAt,
    requestId: input.requestId,
    packFamily: 'finance',
    entryPoint: {
      kind: 'hosted-route',
      id: FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID,
      route: FINANCE_PIPELINE_ADMISSION_ROUTE,
      packageSubpath: null,
      sourceRef: FINANCE_PIPELINE_ADMISSION_SOURCE_REF,
    },
    proposedConsequence: {
      actor: textOrNull(input.actor) ?? 'AI-assisted finance workflow',
      action: textOrNull(input.action) ?? 'evaluate a finance consequence before release',
      downstreamSystem: textOrNull(input.downstreamSystem) ?? 'customer finance workflow',
      consequenceKind: input.consequenceKind ?? 'record',
      riskClass: input.riskClass ?? 'R4',
      summary:
        textOrNull(input.summary) ??
        'Finance workflow asks Attestor whether a proposed record, filing, communication, or action may proceed.',
    },
    policyScope: {
      policyRef: input.policyRef ?? 'policy:finance:hosted-proof-wedge',
      tenantId: input.tenantId ?? null,
      environment: input.environment ?? null,
      dimensions: {
        domain: 'finance',
        route: FINANCE_PIPELINE_ADMISSION_ROUTE,
        ...(input.runId ? { runId: input.runId } : {}),
        ...(input.dimensions ?? {}),
      },
    },
    authority: {
      actorRef: input.actorRef ?? null,
      reviewerRef: input.reviewerRef ?? null,
      signerRef: input.signerRef ?? null,
      delegationRef: input.delegationRef ?? null,
      authorityMode: input.authorityMode ?? null,
    },
    evidence: input.evidence,
    nativeInputRefs: input.nativeInputRefs ?? ['candidateSql', 'intent', 'fixtures', 'sign'],
  });
}

export function createFinancePipelineAdmissionResponse(
  input: CreateFinancePipelineAdmissionResponseInput,
): ConsequenceAdmissionResponse {
  const request =
    input.request ??
    createFinancePipelineAdmissionRequest({
      requestedAt: input.decidedAt,
      runId: input.run.runId,
      tenantId: input.run.tenantContext?.tenantId ?? null,
      environment: input.run.tenantContext?.source ?? null,
    });
  const native = normalizeReleaseStatus(input.run);
  const nativeDecision = mapFinancePipelineDecisionToAdmission(native.value);
  const proof = buildProofRefs(input.run);
  const financeChecks = buildFinanceChecks({
    run: input.run,
    request,
    decidedAt: input.decidedAt,
    proof,
    nativeDecisionSource: native.source,
    filingRelease: native.filingRelease,
  });
  const authorityGuardDecision = financeAuthorityGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    authoritySources: input.authoritySources,
  });
  const approvalGuardDecision = financeApprovalGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    authoritySources: input.authoritySources,
    approvals: input.approvals,
  });
  const toolResultGuardDecision = financeToolResultGuardDecisionFor({
    request,
    decidedAt: input.decidedAt,
    allowedToolResultEvidenceClasses: input.allowedToolResultEvidenceClasses,
    toolResults: input.toolResults,
  });
  const guardChecks = buildFinanceTrustGuardChecks({
    authorityGuardDecision,
    approvalGuardDecision,
    toolResultGuardDecision,
  });
  const checks = Object.freeze([...financeChecks, ...guardChecks]);
  const requiredFailures = failedRequiredChecks(checks);
  const trustGuardHolds = financeTrustGuardHoldChecks(guardChecks);
  const trustGuardReasons = financeTrustGuardReasonCodes(trustGuardHolds);
  const holdChecks = uniqueChecksByLabel([...requiredFailures, ...trustGuardHolds]);
  const decision = effectiveFinanceDecision(
    nativeDecision,
    requiredFailures,
    trustGuardHolds,
  );
  const effectiveNativeDecision = nativeDecisionForEffectiveDecision({
    nativeDecision,
    decision,
    holdChecks,
  });
  const constraints =
    decision === 'narrow'
      ? input.constraints?.length
        ? input.constraints
        : defaultNarrowConstraints()
      : input.constraints ?? [];
  const nativeDecisionPhrase =
    native.source === 'release.filingExport.decisionStatus'
      ? `Finance filing release status ${native.value}`
      : `Finance pipeline decision ${native.value}`;
  const reason =
    requiredFailures.length > 0 && decision !== nativeDecision.mappedDecision
      ? `${nativeDecisionPhrase} maps to native ${nativeDecision.mappedDecision}, but required checks failed so canonical admission is review.`
      : `${nativeDecisionPhrase} maps to canonical ${decision}.`;
  const reasonCodes = [
    `finance-${native.source === 'decision' ? 'pipeline' : 'release'}-${decision}`,
    `finance-native-${native.value.toLowerCase()}`,
    ...(requiredFailures.length > 0 ? ['finance-required-check-failed'] : []),
    ...(trustGuardHolds.length > 0 ? ['finance-trust-guard-held'] : []),
    ...trustGuardReasons,
  ];

  return createConsequenceAdmissionResponse({
    request,
    decidedAt: input.decidedAt,
    decision,
    reason,
    reasonCodes,
    checks,
    constraints,
    nativeDecision: effectiveNativeDecision,
    proof,
    operationalContext: contextWithoutUndefined({
      tenantId: input.run.tenantContext?.tenantId ?? null,
      tenantSource: input.run.tenantContext?.source ?? null,
      planId: input.run.tenantContext?.planId ?? null,
      proofMode: input.run.proofMode ?? null,
      signingMode: input.run.signingMode ?? null,
      identitySource: input.run.identitySource ?? null,
      reviewerName: input.run.reviewerName ?? null,
      auditChainIntact: boolOrNull(input.run.auditChainIntact),
      usageUsed: numberOrNull(input.run.usage?.used),
      usageRemaining: numberOrNull(input.run.usage?.remaining),
      usageQuota: numberOrNull(input.run.usage?.quota),
      usageEnforced: boolOrNull(input.run.usage?.enforced),
      rateLimitRemaining: numberOrNull(input.run.rateLimit?.remaining),
      rateLimitEnforced: boolOrNull(input.run.rateLimit?.enforced),
      releaseDecisionId: native.filingRelease?.decisionId ?? null,
      releasePolicyVersion: native.filingRelease?.policyVersion ?? null,
      releaseIntrospectionRequired: boolOrNull(native.filingRelease?.introspectionRequired),
      authorityGuardOutcome: authorityGuardDecision?.outcome ?? null,
      approvalGuardOutcome: approvalGuardDecision?.outcome ?? null,
      toolResultGuardOutcome: toolResultGuardDecision?.outcome ?? null,
      ...(input.operationalContext ?? {}),
    }),
  });
}

export function financePipelineAdmissionDescriptor():
FinancePipelineAdmissionDescriptor {
  return Object.freeze({
    packFamily: 'finance',
    nativeSurface: 'finance-pipeline',
    route: FINANCE_PIPELINE_ADMISSION_ROUTE,
    entryPointId: FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID,
    sourceRef: FINANCE_PIPELINE_ADMISSION_SOURCE_REF,
    nativeDecisionOrder: [
      'release.filingExport.decisionStatus',
      'decision',
    ] as const,
    hostedRouteBehavior: 'unchanged',
  });
}
