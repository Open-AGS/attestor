import type { ConsequenceAdmissionCheckOutcome, ConsequenceAdmissionProofRef } from './index.js';
import type { FinanceFilingReleaseAdmissionSummary, FinancePipelineAdmissionRun } from './finance-types.js';
import { recordOrNull, statusOrNull, stringField, textOrNull } from './finance-utils.js';

export function hasClosedAuthorityChain(run: FinancePipelineAdmissionRun): boolean {
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

export function hasValidProofMode(run: FinancePipelineAdmissionRun): boolean {
  const proofMode = statusOrNull(run.proofMode);
  return (
    proofMode !== null &&
    !['missing', 'missing-evidence', 'missing_evidence', 'none', 'unavailable', 'unknown'].includes(proofMode)
  );
}

export function normalizeReleaseStatus(run: FinancePipelineAdmissionRun): {
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

export function certificateIdFor(run: FinancePipelineAdmissionRun): string | null {
  return stringField(run.certificate, 'certificateId');
}

export function certificateFingerprintFor(run: FinancePipelineAdmissionRun): string | null {
  const signing = recordOrNull(run.certificate?.signing);
  return stringField(signing, 'fingerprint');
}

export function buildProofRefs(run: FinancePipelineAdmissionRun): readonly ConsequenceAdmissionProofRef[] {
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

export function tokenFreshnessOutcome(
  filingRelease: FinanceFilingReleaseAdmissionSummary | null,
  decidedAt: string,
): ConsequenceAdmissionCheckOutcome {
  const expiresAt = textOrNull(filingRelease?.expiresAt);
  if (!expiresAt) return 'not-applicable';
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'fail';
  return expiry.getTime() > new Date(decidedAt).getTime() ? 'pass' : 'fail';
}
