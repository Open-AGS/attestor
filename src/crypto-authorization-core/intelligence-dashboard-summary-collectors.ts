import type {
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import type {
  CryptoNarrowingCandidateKind,
  CryptoPolicyGapClass,
  CryptoPolicyGapNarrowingAssessment,
  CryptoPolicyIntelligenceRoutingProfile,
} from './policy-gap-narrowing.js';
import type {
  CryptoOperatorRiskInputBundle,
  CryptoOperatorRiskInputClass,
  CryptoOperatorRiskMissingEvidenceClass,
} from './operator-risk-input-contract.js';
import type { CryptoIntelligenceDashboardReadinessEntry } from './intelligence-dashboard-summary-types.js';
import {
  addEvidence,
  addReason,
  addSurface,
  type CountedEvidence,
  type CountedReason,
  type CountedSource,
} from './intelligence-dashboard-summary-counts.js';
import { sourceKindSeverity } from './intelligence-dashboard-summary-utils.js';

export function collectFromRiskSignals(
  signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const assessment of signalAssessments) {
    addSurface(surfaces, {
      surface: assessment.consequenceKind,
      sourceKind: 'risk-signal',
      severity: assessment.overallSeverity,
      disposition: assessment.recommendedDisposition,
      missingEvidenceClasses: assessment.missingEvidenceClasses,
      sourceDigest: assessment.digest,
    });
    for (const signal of assessment.signals) {
      addSurface(surfaces, {
        surface: signal.category,
        sourceKind: 'risk-signal',
        severity: signal.severity,
        disposition: signal.disposition,
        missingEvidenceClasses: signal.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      if (signal.disposition !== 'admit' || signal.missingEvidenceClasses.length > 0) {
        addReason(reasons, {
          reasonCode: signal.code,
          sourceKind: 'risk-signal',
          severity: signal.severity,
          disposition: signal.disposition,
          missingEvidenceClasses: signal.missingEvidenceClasses,
          sourceDigest: assessment.digest,
        });
      }
      for (const evidenceClass of signal.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass,
          sourceKind: 'risk-signal',
          sourceDigest: assessment.digest,
        });
      }
    }
  }
}

export function collectFromPolicyGaps(
  assessments: readonly CryptoPolicyGapNarrowingAssessment[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const assessment of assessments) {
    for (const gap of assessment.gaps) {
      addSurface(surfaces, {
        surface: gap.gapClass satisfies CryptoPolicyGapClass,
        sourceKind: 'policy-gap',
        severity: gap.severity,
        disposition: gap.disposition,
        missingEvidenceClasses: gap.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      addReason(reasons, {
        reasonCode: gap.gapClass,
        sourceKind: 'policy-gap',
        severity: gap.severity,
        disposition: gap.disposition,
        missingEvidenceClasses: gap.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      for (const code of gap.sourceSignalCodes) {
        addReason(reasons, {
          reasonCode: code,
          sourceKind: 'policy-gap',
          severity: gap.severity,
          disposition: gap.disposition,
          missingEvidenceClasses: gap.missingEvidenceClasses,
          sourceDigest: assessment.digest,
        });
      }
      for (const evidenceClass of gap.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass,
          sourceKind: 'policy-gap',
          sourceDigest: assessment.digest,
        });
      }
    }
    for (const candidate of assessment.candidates) {
      addSurface(surfaces, {
        surface: candidate.kind satisfies CryptoNarrowingCandidateKind,
        sourceKind: 'policy-gap',
        missingEvidenceClasses: candidate.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
    }
  }
}

export function collectFromPolicyRouting(
  profiles: readonly CryptoPolicyIntelligenceRoutingProfile[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
): void {
  for (const profile of profiles) {
    const severity = sourceKindSeverity(profile.recommendedDisposition);
    addSurface(surfaces, {
      surface: profile.dominantRouteKind,
      sourceKind: 'policy-routing',
      severity,
      disposition: profile.recommendedDisposition,
      sourceDigest: profile.digest,
    });
    addReason(reasons, {
      reasonCode: profile.dominantRouteKind,
      sourceKind: 'policy-routing',
      severity,
      disposition: profile.recommendedDisposition,
      sourceDigest: profile.digest,
    });
    for (const blocker of profile.topBlockers) {
      addSurface(surfaces, {
        surface: blocker.routeKind,
        sourceKind: 'policy-routing',
        severity: 'critical',
        disposition: 'block',
        sourceDigest: profile.digest,
      });
      addReason(reasons, {
        reasonCode: blocker.routeKind,
        sourceKind: 'policy-routing',
        severity: 'critical',
        disposition: 'block',
        sourceDigest: profile.digest,
      });
      for (const reasonCode of blocker.reasonCodes) {
        addReason(reasons, {
          reasonCode,
          sourceKind: 'policy-routing',
          severity: 'critical',
          disposition: 'block',
          sourceDigest: profile.digest,
        });
      }
    }
  }
}

export function collectFromOperatorRiskInputs(
  bundles: readonly CryptoOperatorRiskInputBundle[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const bundle of bundles) {
    for (const entry of bundle.entries) {
      addSurface(surfaces, {
        surface: entry.inputClass satisfies CryptoOperatorRiskInputClass,
        sourceKind: 'operator-risk-input',
        severity: entry.severity,
        disposition: entry.disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: bundle.digest,
      });
      for (const reasonCode of entry.reasonCodes) {
        addReason(reasons, {
          reasonCode,
          sourceKind: 'operator-risk-input',
          severity: entry.severity,
          disposition: entry.disposition,
          missingEvidenceClasses: entry.missingEvidenceClasses,
          sourceDigest: bundle.digest,
        });
      }
      for (const evidenceClass of entry.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass: evidenceClass satisfies CryptoOperatorRiskMissingEvidenceClass,
          sourceKind: 'operator-risk-input',
          sourceDigest: bundle.digest,
        });
      }
    }
    if (bundle.entries.length === 0) {
      for (const reasonCode of bundle.reasonCodes) {
        addReason(reasons, {
          reasonCode,
          sourceKind: 'operator-risk-input',
          severity: 'warning',
          disposition: bundle.recommendedDisposition,
          missingEvidenceClasses: bundle.missingEvidenceClasses,
          sourceDigest: bundle.digest,
        });
      }
    }
  }
}

export function collectFromReadiness(
  entries: readonly CryptoIntelligenceDashboardReadinessEntry[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const entry of entries) {
    const disposition: CryptoIntelligenceSignalDisposition =
      entry.status === 'blocked' ? 'block' : entry.status === 'ready' ? 'admit' : 'review';
    const severity: CryptoIntelligenceSignalSeverity =
      entry.status === 'blocked' ? 'critical' : entry.status === 'ready' ? 'info' : 'warning';

    addSurface(surfaces, {
      surface: entry.surface,
      sourceKind: 'adapter-readiness',
      severity,
      disposition,
      missingEvidenceClasses: entry.missingEvidenceClasses,
      sourceDigest: entry.sourceDigest,
    });
    if (entry.adapterKind !== null) {
      addSurface(surfaces, {
        surface: entry.adapterKind,
        sourceKind: 'adapter-readiness',
        severity,
        disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: entry.sourceDigest,
      });
    }
    for (const reasonCode of entry.reasonCodes) {
      addReason(reasons, {
        reasonCode,
        sourceKind: 'adapter-readiness',
        severity,
        disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: entry.sourceDigest,
      });
    }
    for (const evidenceClass of entry.missingEvidenceClasses) {
      addEvidence(evidence, {
        evidenceClass,
        sourceKind: 'adapter-readiness',
        sourceDigest: entry.sourceDigest,
      });
    }
  }
}
