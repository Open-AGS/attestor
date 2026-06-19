import type { CryptoIntelligenceRiskSignalAssessment } from './intelligence-risk-signals.js';
import type { CryptoOperatorRiskInputBundle } from './operator-risk-input-contract.js';
import type {
  CryptoPolicyGapNarrowingAssessment,
  CryptoPolicyIntelligenceRoutingProfile,
} from './policy-gap-narrowing.js';
import type {
  CryptoIntelligenceDashboardAttentionItem,
  CryptoIntelligenceDashboardFailureReasonRow,
  CryptoIntelligenceDashboardMissingEvidenceRow,
  CryptoIntelligenceDashboardOverview,
  CryptoIntelligenceDashboardPosture,
  CryptoIntelligenceDashboardProofLink,
  CryptoIntelligenceDashboardReadinessCoverage,
  CryptoIntelligenceDashboardTile,
  CryptoIntelligenceDashboardTopBlocker,
} from './intelligence-dashboard-summary-types.js';
import {
  DISPOSITION_RANK,
  MAX_TOP_ROWS,
  SEVERITY_RANK,
  priorityTierForDisposition,
  uniqueSorted,
} from './intelligence-dashboard-summary-utils.js';

export function dashboardOverview(input: {
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
  readonly policyGapAssessments: readonly CryptoPolicyGapNarrowingAssessment[];
  readonly policyIntelligenceRoutingProfiles:
    readonly CryptoPolicyIntelligenceRoutingProfile[];
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly proofLinks: readonly CryptoIntelligenceDashboardProofLink[];
}): CryptoIntelligenceDashboardOverview {
  return Object.freeze({
    signalAssessmentCount: input.signalAssessments.length,
    riskSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.signalCount, 0),
    criticalSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.criticalSignalCount, 0),
    reviewSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.reviewSignalCount, 0),
    blockSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.blockSignalCount, 0),
    policyGapAssessmentCount: input.policyGapAssessments.length,
    policyGapCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.gapCount, 0),
    blockedPolicyGapCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.blockedGapCount, 0),
    narrowingCandidateCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.candidateCount, 0),
    policyRoutingProfileCount: input.policyIntelligenceRoutingProfiles.length,
    blockedPolicyRoutingCount: input.policyIntelligenceRoutingProfiles.filter(
      (profile) => profile.recommendedDisposition === 'block',
    ).length,
    reviewPolicyRoutingCount: input.policyIntelligenceRoutingProfiles.filter(
      (profile) => profile.recommendedDisposition === 'review',
    ).length,
    operatorRiskInputBundleCount: input.operatorRiskInputBundles.length,
    operatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.inputCount, 0),
    acceptedOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.acceptedCount, 0),
    staleOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.staleCount, 0),
    rejectedOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.rejectedCount, 0),
    readinessEntryCount: input.readiness.totalEntries,
    readyReadinessCount: input.readiness.readyCount,
    blockedReadinessCount: input.readiness.blockedCount,
    proofLinkCount: input.proofLinks.length,
  });
}

export function dashboardPosture(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
}): CryptoIntelligenceDashboardPosture {
  if (
    input.overview.blockSignalCount > 0 ||
    input.overview.blockedPolicyGapCount > 0 ||
    input.overview.blockedPolicyRoutingCount > 0 ||
    input.readiness.blockedCount > 0 ||
    input.operatorRiskInputBundles.some((bundle) => bundle.recommendedDisposition === 'block')
  ) {
    return 'blocked-for-review';
  }
  if (
    input.signalAssessments.length === 0 ||
    input.overview.reviewSignalCount > 0 ||
    input.overview.policyGapCount > 0 ||
    input.overview.reviewPolicyRoutingCount > 0 ||
    input.readiness.needsEvidenceCount > 0 ||
    input.readiness.notObservedCount > 0 ||
    input.operatorRiskInputBundles.some((bundle) => bundle.recommendedDisposition !== 'admit')
  ) {
    return 'attention-needed';
  }
  return 'ready-for-review';
}

export function headlineForPosture(posture: CryptoIntelligenceDashboardPosture): string {
  if (posture === 'blocked-for-review') {
    return 'Crypto intelligence found blockers that require operator review before downstream execution.';
  }
  if (posture === 'attention-needed') {
    return 'Crypto intelligence needs more evidence or review before this path is ready.';
  }
  return 'Crypto intelligence inputs are present and ready for operator review.';
}

function tileStatus(value: number, postureWhenNonZero: CryptoIntelligenceDashboardPosture):
CryptoIntelligenceDashboardPosture {
  return value > 0 ? postureWhenNonZero : 'ready-for-review';
}

export function dashboardTiles(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
}): readonly CryptoIntelligenceDashboardTile[] {
  return Object.freeze([
    Object.freeze({
      kind: 'signals',
      label: 'risk signals',
      value: input.overview.riskSignalCount,
      status: input.overview.riskSignalCount === 0 ? 'attention-needed' : 'ready-for-review',
    }),
    Object.freeze({
      kind: 'critical-signals',
      label: 'critical signals',
      value: input.overview.criticalSignalCount,
      status: tileStatus(input.overview.criticalSignalCount, 'blocked-for-review'),
    }),
    Object.freeze({
      kind: 'review-signals',
      label: 'review signals',
      value: input.overview.reviewSignalCount,
      status: tileStatus(input.overview.reviewSignalCount, 'attention-needed'),
    }),
    Object.freeze({
      kind: 'block-signals',
      label: 'block signals',
      value: input.overview.blockSignalCount,
      status: tileStatus(input.overview.blockSignalCount, 'blocked-for-review'),
    }),
    Object.freeze({
      kind: 'policy-gaps',
      label: 'policy gaps',
      value: input.overview.policyGapCount + input.overview.policyRoutingProfileCount,
      status:
        input.overview.blockedPolicyGapCount + input.overview.blockedPolicyRoutingCount > 0
          ? 'blocked-for-review'
          : tileStatus(
              input.overview.policyGapCount + input.overview.policyRoutingProfileCount,
              'attention-needed',
            ),
    }),
    Object.freeze({
      kind: 'readiness-coverage',
      label: 'readiness coverage',
      value: input.readiness.readyCoveragePercent,
      status: input.readiness.blockedCount > 0
        ? 'blocked-for-review'
        : tileStatus(input.readiness.needsEvidenceCount + input.readiness.notObservedCount, 'attention-needed'),
    }),
    Object.freeze({
      kind: 'operator-risk-inputs',
      label: 'operator risk inputs',
      value: input.overview.operatorRiskInputCount,
      status: tileStatus(
        input.overview.staleOperatorRiskInputCount + input.overview.rejectedOperatorRiskInputCount,
        'blocked-for-review',
      ),
    }),
    Object.freeze({
      kind: 'proof-links',
      label: 'proof links',
      value: input.overview.proofLinkCount,
      status: 'ready-for-review',
    }),
  ]);
}

export function attentionItems(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly topFailureReasons: readonly CryptoIntelligenceDashboardFailureReasonRow[];
  readonly missingEvidence: readonly CryptoIntelligenceDashboardMissingEvidenceRow[];
}): readonly CryptoIntelligenceDashboardAttentionItem[] {
  const items: CryptoIntelligenceDashboardAttentionItem[] = [];

  if (input.overview.signalAssessmentCount === 0) {
    items.push({
      kind: 'risk-signal-assessment-missing',
      severity: 'warning',
      disposition: 'review',
      count: 1,
      title: 'Risk signal assessment is missing.',
      nextStep: 'Run crypto intelligence risk-signal assessment before relying on this dashboard.',
      reasonCodes: ['risk-signal-assessment-missing'],
      missingEvidenceClasses: [],
      sourceDigests: [],
    });
  }
  if (input.overview.blockSignalCount > 0) {
    items.push({
      kind: 'risk-signal-blocker',
      severity: 'critical',
      disposition: 'block',
      count: input.overview.blockSignalCount,
      title: 'Risk signals contain blockers.',
      nextStep: 'Resolve or route block-grade risk signals to operator review before downstream execution.',
      reasonCodes: input.topFailureReasons
        .filter((reason) => reason.sourceKind === 'risk-signal' && reason.disposition === 'block')
        .map((reason) => reason.reasonCode),
      missingEvidenceClasses: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'risk-signal')
          .flatMap((reason) => reason.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'risk-signal')
          .flatMap((reason) => reason.sourceDigests),
      ),
    });
  }
  if (input.overview.blockedPolicyGapCount > 0) {
    items.push({
      kind: 'policy-gap-blocker',
      severity: 'critical',
      disposition: 'block',
      count: input.overview.blockedPolicyGapCount,
      title: 'Policy gaps block admission.',
      nextStep: 'Bind missing policy dimensions or approval-required narrowing candidates.',
      reasonCodes: input.topFailureReasons
        .filter((reason) => reason.sourceKind === 'policy-gap')
        .map((reason) => reason.reasonCode),
      missingEvidenceClasses: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-gap')
          .flatMap((reason) => reason.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-gap')
          .flatMap((reason) => reason.sourceDigests),
      ),
    });
  }
  if (input.overview.blockedPolicyRoutingCount > 0) {
    items.push({
      kind: 'policy-routing-blocker',
      severity: 'critical',
      disposition: 'block',
      count: input.overview.blockedPolicyRoutingCount,
      title: 'Policy routing blocks admission.',
      nextStep: 'Resolve explicit deny, implicit deny, stale-policy, or conflict routes before retry.',
      reasonCodes: input.topFailureReasons
        .filter((reason) => reason.sourceKind === 'policy-routing')
        .map((reason) => reason.reasonCode),
      missingEvidenceClasses: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-routing')
          .flatMap((reason) => reason.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-routing')
          .flatMap((reason) => reason.sourceDigests),
      ),
    });
  }
  if (input.readiness.blockedCount + input.readiness.needsEvidenceCount + input.readiness.notObservedCount > 0) {
    items.push({
      kind: 'adapter-readiness-gap',
      severity: input.readiness.blockedCount > 0 ? 'critical' : 'warning',
      disposition: input.readiness.blockedCount > 0 ? 'block' : 'review',
      count: input.readiness.blockedCount + input.readiness.needsEvidenceCount + input.readiness.notObservedCount,
      title: 'Adapter readiness is incomplete.',
      nextStep: 'Run adapter readiness checks and attach digest-only evidence for incomplete surfaces.',
      reasonCodes: uniqueSorted(input.readiness.entries.flatMap((entry) => entry.reasonCodes)),
      missingEvidenceClasses: uniqueSorted(
        input.readiness.entries.flatMap((entry) => entry.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.readiness.entries.flatMap((entry) => entry.sourceDigest === null ? [] : [entry.sourceDigest]),
      ),
    });
  }
  if (input.missingEvidence.length > 0) {
    items.push({
      kind: 'missing-evidence',
      severity: 'warning',
      disposition: 'review',
      count: input.missingEvidence.reduce((sum, entry) => sum + entry.count, 0),
      title: 'Evidence classes are missing.',
      nextStep: 'Collect the named evidence classes by digest or scoped reference; do not attach raw payload material.',
      reasonCodes: [],
      missingEvidenceClasses: input.missingEvidence.map((entry) => entry.evidenceClass),
      sourceDigests: uniqueSorted(input.missingEvidence.flatMap((entry) => entry.sourceDigests)),
    });
  }

  return Object.freeze(items.slice(0, MAX_TOP_ROWS).map((item) => Object.freeze(item)));
}

export function topBlockers(
  attention: readonly CryptoIntelligenceDashboardAttentionItem[],
): readonly CryptoIntelligenceDashboardTopBlocker[] {
  return Object.freeze(
    attention
      .filter((item) => item.disposition === 'block' || item.disposition === 'review')
      .sort((left, right) => {
        const dispositionDelta =
          DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
        if (dispositionDelta !== 0) return dispositionDelta;
        const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
        if (severityDelta !== 0) return severityDelta;
        if (right.count !== left.count) return right.count - left.count;
        return left.kind.localeCompare(right.kind);
      })
      .slice(0, MAX_TOP_ROWS)
      .map((item, index) =>
        Object.freeze({
          rank: index + 1,
          kind: item.kind,
          priorityTier: priorityTierForDisposition(item.disposition),
          severity: item.severity,
          disposition: item.disposition,
          count: item.count,
          title: item.title,
          nextStep: item.nextStep,
          reasonCodes: item.reasonCodes,
          missingEvidenceClasses: item.missingEvidenceClasses,
          sourceDigests: item.sourceDigests,
          rawPayloadDrilldownEnabled: false,
        }),
      ),
  );
}
