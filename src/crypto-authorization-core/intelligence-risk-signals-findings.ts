import type {
  CryptoConsequenceRiskAssessment,
  CryptoConsequenceRiskFinding,
} from './consequence-risk-mapping.js';
import type {
  CryptoIntelligenceMissingEvidenceClass,
  CryptoIntelligenceRiskSignal,
  CryptoIntelligenceSignalCategory,
  CryptoIntelligenceSignalDisposition,
} from './intelligence-risk-signals-types.js';
import {
  riskClassSeverity,
  signal,
  unique,
} from './intelligence-risk-signals-utils.js';

export function categoryForFinding(
  finding: CryptoConsequenceRiskFinding,
): CryptoIntelligenceSignalCategory {
  switch (finding.code) {
    case 'unlimited-approval':
    case 'missing-revocation':
      return 'allowance';
    case 'eip-7702-delegation':
      return 'delegation';
    case 'custody-cosigner':
    case 'custody-account-value-movement':
    case 'custody-destination-counterparty':
    case 'custody-policy-missing':
      return 'custody';
    case 'intent-solver-counterparty':
    case 'intent-solver-routing':
      return 'solver';
    case 'bridge-counterparty':
    case 'cross-chain':
      return 'route';
    default:
      switch (finding.factorKind) {
        case 'amount':
          return 'amount';
        case 'account':
          return 'account';
        case 'asset':
          return 'asset';
        case 'counterparty':
          return 'counterparty';
        case 'execution-context':
          return 'readiness';
        case 'policy-posture':
          return 'readiness';
        case 'base-consequence':
          return 'readiness';
      }
  }
}

export function missingClassesForFinding(
  finding: CryptoConsequenceRiskFinding,
): readonly CryptoIntelligenceMissingEvidenceClass[] {
  const classes: CryptoIntelligenceMissingEvidenceClass[] = [];

  if (finding.code === 'missing-normalized-amount') classes.push('amount');
  if (finding.code === 'missing-counterparty') classes.push('counterparty');
  if (finding.code === 'missing-revocation') classes.push('revocation-path');
  if (finding.code === 'custody-policy-missing') classes.push('custody-policy-decision');

  if (finding.requiredPolicyDimensions.length > 0) {
    classes.push('policy-dimension');
  }

  return unique(classes);
}

export function dispositionForFinding(
  finding: CryptoConsequenceRiskFinding,
): CryptoIntelligenceSignalDisposition {
  switch (finding.code) {
    case 'missing-normalized-amount':
    case 'missing-counterparty':
    case 'missing-revocation':
    case 'custody-policy-missing':
      return 'block';
    default:
      return finding.riskClass === 'R0' || finding.riskClass === 'R1' ? 'admit' : 'review';
  }
}

export function findingSignals(
  riskAssessment: CryptoConsequenceRiskAssessment,
): readonly CryptoIntelligenceRiskSignal[] {
  return Object.freeze(
    riskAssessment.findings.map((finding) =>
      signal({
        code: finding.code,
        category: categoryForFinding(finding),
        severity: riskClassSeverity(finding.riskClass),
        disposition: dispositionForFinding(finding),
        message: finding.reason,
        sourceRiskClass: finding.riskClass,
        requiredPolicyDimensions: finding.requiredPolicyDimensions,
        missingEvidenceClasses: missingClassesForFinding(finding),
        evidenceRefs: [
          {
            kind: 'digest',
            value: riskAssessment.digest,
          },
        ],
      }),
    ),
  );
}
