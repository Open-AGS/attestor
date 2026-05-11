import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoSimulationObservation,
  CryptoSimulationReadiness,
} from './authorization-simulation.js';
import type {
  CryptoConsequenceRiskAssessment,
  CryptoConsequenceRiskFinding,
} from './consequence-risk-mapping.js';
import {
  CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS,
  type CryptoAuthorizationPolicyDimension,
  type CryptoAuthorizationRiskClass,
  type CryptoChainReference,
  type CryptoExecutionAdapterKind,
} from './types.js';

/**
 * Deterministic crypto intelligence signal layer.
 *
 * This interprets existing crypto risk assessments and optional preflight
 * posture into model-safe risk signals. It does not replace the consequence
 * risk mapper and does not add an execution path.
 */

export const CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION =
  'attestor.crypto-intelligence-risk-signals.v1';

export const CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES = [
  'account',
  'chain',
  'asset',
  'amount',
  'counterparty',
  'route',
  'allowance',
  'delegation',
  'custody',
  'x402',
  'solver',
  'freshness',
  'velocity',
  'readiness',
] as const;
export type CryptoIntelligenceSignalCategory =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES[number];

export const CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES = [
  'info',
  'warning',
  'critical',
] as const;
export type CryptoIntelligenceSignalSeverity =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES[number];

export const CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS = [
  'admit',
  'review',
  'block',
] as const;
export type CryptoIntelligenceSignalDisposition =
  typeof CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS[number];

export const CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES = [
  'amount',
  'counterparty',
  'policy-dimension',
  'route-commitment',
  'revocation-path',
  'delegation-authorization',
  'delegation-nonce',
  'custody-policy-decision',
  'custody-quorum',
  'x402-payment-requirement',
  'x402-payment-signature',
  'x402-payment-response',
  'solver-settlement-preflight',
  'freshness-window',
  'adapter-preflight',
] as const;
export type CryptoIntelligenceMissingEvidenceClass =
  typeof CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES[number];

export const CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS = Object.freeze({
  operationReview: 5,
  operationCritical: 20,
  amountReviewUsd: '50000',
  amountCriticalUsd: '250000',
  counterpartyReview: 3,
  counterpartyCritical: 10,
});

export interface CryptoIntelligenceEvidenceRef {
  readonly kind: 'digest' | 'scoped-ref' | 'reason-code';
  readonly value: string;
}

export interface CryptoIntelligenceRiskSignal {
  readonly code: string;
  readonly category: CryptoIntelligenceSignalCategory;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly message: string;
  readonly sourceRiskClass: CryptoAuthorizationRiskClass | null;
  readonly requiredPolicyDimensions: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs: readonly CryptoIntelligenceEvidenceRef[];
}

export interface CryptoIntelligenceRouteContext {
  readonly isCrossChain?: boolean | null;
  readonly usesBridge?: boolean | null;
  readonly routeCommitmentDigest?: string | null;
  readonly settlementDeadlineIso?: string | null;
  readonly refundPathBound?: boolean | null;
}

export interface CryptoIntelligenceAllowanceContext {
  readonly isUnlimitedApproval?: boolean | null;
  readonly hasRevocationPath?: boolean | null;
  readonly hasExpiry?: boolean | null;
  readonly spenderKnown?: boolean | null;
}

export interface CryptoIntelligenceDelegationContext {
  readonly authorizationTupleDigest?: string | null;
  readonly nonceFresh?: boolean | null;
  readonly delegateRevocationPath?: boolean | null;
  readonly delegateCodeDigest?: string | null;
}

export interface CryptoIntelligenceCustodyContext {
  readonly requiresPolicy?: boolean | null;
  readonly policyDecisionDigest?: string | null;
  readonly quorumMet?: boolean | null;
  readonly providerTerminalStatus?: 'allow' | 'deny' | 'hold' | 'error' | null;
}

export interface CryptoIntelligenceX402Context {
  readonly paymentRequirementDigest?: string | null;
  readonly paymentSignatureDigest?: string | null;
  readonly paymentResponseDigest?: string | null;
  readonly idempotencyKeyDigest?: string | null;
}

export interface CryptoIntelligenceSolverContext {
  readonly routeCommitmentDigest?: string | null;
  readonly settlementPreflightDigest?: string | null;
  readonly refundPathBound?: boolean | null;
}

export interface CryptoIntelligenceFreshnessContext {
  readonly evaluatedAt: string;
  readonly evidenceCreatedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly maxAgeSeconds?: number | null;
}

export interface CryptoIntelligenceVelocityContext {
  readonly windowSeconds?: number | null;
  readonly operationCount?: number | null;
  readonly normalizedUsd?: string | null;
  readonly distinctCounterparties?: number | null;
}

export interface CryptoIntelligenceRiskSignalContext {
  readonly chain?: CryptoChainReference | null;
  readonly executionAdapterKind?: CryptoExecutionAdapterKind | null;
  readonly route?: CryptoIntelligenceRouteContext | null;
  readonly allowance?: CryptoIntelligenceAllowanceContext | null;
  readonly delegation?: CryptoIntelligenceDelegationContext | null;
  readonly custody?: CryptoIntelligenceCustodyContext | null;
  readonly x402?: CryptoIntelligenceX402Context | null;
  readonly solver?: CryptoIntelligenceSolverContext | null;
  readonly freshness?: CryptoIntelligenceFreshnessContext | null;
  readonly velocity?: CryptoIntelligenceVelocityContext | null;
}

export interface CreateCryptoIntelligenceRiskSignalAssessmentInput {
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly readiness?: CryptoSimulationReadiness | null;
  readonly observations?: readonly CryptoSimulationObservation[] | null;
  readonly context?: CryptoIntelligenceRiskSignalContext | null;
}

export interface CryptoIntelligenceRiskSignalAssessment {
  readonly version: typeof CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION;
  readonly riskAssessmentDigest: string;
  readonly consequenceKind: CryptoConsequenceRiskAssessment['consequenceKind'];
  readonly riskClass: CryptoAuthorizationRiskClass;
  readonly overallSeverity: CryptoIntelligenceSignalSeverity;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly signalCount: number;
  readonly criticalSignalCount: number;
  readonly reviewSignalCount: number;
  readonly blockSignalCount: number;
  readonly signals: readonly CryptoIntelligenceRiskSignal[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligenceRiskSignalsDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION;
  readonly categories: typeof CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES;
  readonly severities: typeof CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES;
  readonly dispositions: typeof CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS;
  readonly missingEvidenceClasses: typeof CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES;
  readonly velocityThresholds: typeof CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS;
}

const SEVERITY_RANK: Record<CryptoIntelligenceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const DISPOSITION_RANK: Record<CryptoIntelligenceSignalDisposition, number> = {
  admit: 0,
  review: 1,
  block: 2,
};

const USD_SCALE = 6;

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence risk signals ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto intelligence risk signals ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function parseDecimalToScaledUnits(value: string, fieldName: string): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error(`Crypto intelligence risk signals ${fieldName} must be a non-negative decimal with up to 6 fractional digits.`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 10n ** BigInt(USD_SCALE) + BigInt(fraction.padEnd(USD_SCALE, '0'));
}

function decimalAtLeast(value: string, threshold: string): boolean {
  return (
    parseDecimalToScaledUnits(value, 'normalizedUsd') >=
    parseDecimalToScaledUnits(threshold, 'threshold')
  );
}

function maxSeverity(
  left: CryptoIntelligenceSignalSeverity,
  right: CryptoIntelligenceSignalSeverity,
): CryptoIntelligenceSignalSeverity {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}

function maxDisposition(
  left: CryptoIntelligenceSignalDisposition,
  right: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalDisposition {
  return DISPOSITION_RANK[left] >= DISPOSITION_RANK[right] ? left : right;
}

function unique<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function uniqueEvidenceRefs(
  refs: readonly CryptoIntelligenceEvidenceRef[],
): readonly CryptoIntelligenceEvidenceRef[] {
  const seen = new Set<string>();
  const output: CryptoIntelligenceEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(Object.freeze(ref));
    }
  }
  return Object.freeze(output);
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function riskClassSeverity(
  riskClass: CryptoAuthorizationRiskClass,
): CryptoIntelligenceSignalSeverity {
  switch (riskClass) {
    case 'R0':
    case 'R1':
      return 'info';
    case 'R2':
    case 'R3':
      return 'warning';
    case 'R4':
      return 'critical';
  }
}

function categoryForFinding(
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

function missingClassesForFinding(
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

function dispositionForFinding(
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

function signal(input: {
  readonly code: string;
  readonly category: CryptoIntelligenceSignalCategory;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly message: string;
  readonly sourceRiskClass?: CryptoAuthorizationRiskClass | null;
  readonly requiredPolicyDimensions?: readonly CryptoAuthorizationPolicyDimension[];
  readonly missingEvidenceClasses?: readonly CryptoIntelligenceMissingEvidenceClass[];
  readonly evidenceRefs?: readonly CryptoIntelligenceEvidenceRef[];
}): CryptoIntelligenceRiskSignal {
  for (const dimension of input.requiredPolicyDimensions ?? []) {
    if (!CRYPTO_AUTHORIZATION_POLICY_DIMENSIONS.includes(dimension)) {
      throw new Error(`Crypto intelligence risk signals do not support policy dimension ${dimension}.`);
    }
  }

  return Object.freeze({
    code: normalizeIdentifier(input.code, 'signal.code'),
    category: input.category,
    severity: input.severity,
    disposition: input.disposition,
    message: normalizeIdentifier(input.message, 'signal.message'),
    sourceRiskClass: input.sourceRiskClass ?? null,
    requiredPolicyDimensions: Object.freeze([...(input.requiredPolicyDimensions ?? [])]),
    missingEvidenceClasses: Object.freeze([...(input.missingEvidenceClasses ?? [])]),
    evidenceRefs: uniqueEvidenceRefs(input.evidenceRefs ?? []),
  });
}

function findingSignals(
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

function chainSignals(
  chain: CryptoChainReference | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!chain) return Object.freeze([]);

  const signals: CryptoIntelligenceRiskSignal[] = [];
  if (chain.namespace === 'other' || chain.runtimeFamily === 'non-evm') {
    signals.push(
      signal({
        code: 'non-standard-chain-runtime',
        category: 'chain',
        severity: 'warning',
        disposition: 'review',
        message: 'Non-standard chain runtime requires operator review before execution intelligence is trusted.',
        requiredPolicyDimensions: ['chain', 'runtime-context'],
      }),
    );
  }

  return Object.freeze(signals);
}

function readinessSignals(
  readiness: CryptoSimulationReadiness | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!readiness) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const entries = [
    ['release-binding', readiness.releaseBinding],
    ['policy-binding', readiness.policyBinding],
    ['enforcement-binding', readiness.enforcementBinding],
    ['adapter-preflight', readiness.adapterPreflight],
  ] as const;

  for (const [kind, status] of entries) {
    if (status === 'ready') continue;
    output.push(
      signal({
        code: `${kind}-${status}`,
        category: 'readiness',
        severity: status === 'blocked' ? 'critical' : 'warning',
        disposition: status === 'blocked' || status === 'missing' ? 'block' : 'review',
        message: `Crypto execution readiness is ${status} for ${kind}.`,
        missingEvidenceClasses: kind === 'adapter-preflight'
          ? ['adapter-preflight']
          : ['policy-dimension'],
        evidenceRefs: [
          {
            kind: 'reason-code',
            value: `${kind}-${status}`,
          },
        ],
      }),
    );
  }

  return Object.freeze(output);
}

function observationSignals(
  observations: readonly CryptoSimulationObservation[] | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!observations) return Object.freeze([]);

  return Object.freeze(
    observations
      .filter((observation) => observation.status !== 'pass' && observation.status !== 'not-applicable')
      .map((observation) =>
        signal({
          code: `preflight-${observation.code}`,
          category: 'readiness',
          severity: observation.status === 'fail' ? 'critical' : 'warning',
          disposition: observation.status === 'fail' || (observation.required && observation.status === 'not-run')
            ? 'block'
            : 'review',
          message: observation.message,
          missingEvidenceClasses: observation.check === 'adapter-preflight-readiness'
            ? ['adapter-preflight']
            : ['policy-dimension'],
          evidenceRefs: [
            {
              kind: 'reason-code',
              value: observation.code,
            },
          ],
        }),
      ),
  );
}

function routeSignals(
  route: CryptoIntelligenceRouteContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!route) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const routeCommitmentDigest = normalizeOptionalIdentifier(
    route.routeCommitmentDigest,
    'route.routeCommitmentDigest',
  );

  if (route.isCrossChain === true || route.usesBridge === true) {
    output.push(
      signal({
        code: 'cross-chain-route',
        category: 'route',
        severity: 'critical',
        disposition: routeCommitmentDigest ? 'review' : 'block',
        message: 'Cross-chain or bridge routes require committed route evidence before execution.',
        requiredPolicyDimensions: ['chain', 'protocol', 'counterparty'],
        missingEvidenceClasses: routeCommitmentDigest ? [] : ['route-commitment'],
        evidenceRefs: routeCommitmentDigest
          ? [{ kind: 'digest', value: routeCommitmentDigest }]
          : [{ kind: 'reason-code', value: 'route-commitment-missing' }],
      }),
    );
  }

  if (route.refundPathBound === false) {
    output.push(
      signal({
        code: 'route-refund-path-missing',
        category: 'route',
        severity: 'critical',
        disposition: 'block',
        message: 'Route execution cannot proceed without a bound refund or failure path.',
        missingEvidenceClasses: ['route-commitment'],
      }),
    );
  }

  if (route.settlementDeadlineIso) {
    normalizeIsoTimestamp(route.settlementDeadlineIso, 'route.settlementDeadlineIso');
  }

  return Object.freeze(output);
}

function allowanceSignals(
  allowance: CryptoIntelligenceAllowanceContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!allowance) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  if (allowance.isUnlimitedApproval === true) {
    output.push(
      signal({
        code: 'allowance-unlimited',
        category: 'allowance',
        severity: 'critical',
        disposition: 'review',
        message: 'Unlimited allowance requires explicit review and scoped revocation evidence.',
        requiredPolicyDimensions: ['spender', 'amount', 'validity-window'],
      }),
    );
  }
  if (allowance.hasRevocationPath === false) {
    output.push(
      signal({
        code: 'allowance-revocation-missing',
        category: 'allowance',
        severity: 'critical',
        disposition: 'block',
        message: 'Allowance changes must include a revocation path before execution.',
        requiredPolicyDimensions: ['validity-window'],
        missingEvidenceClasses: ['revocation-path'],
      }),
    );
  }
  if (allowance.hasExpiry === false) {
    output.push(
      signal({
        code: 'allowance-expiry-missing',
        category: 'allowance',
        severity: 'warning',
        disposition: 'review',
        message: 'Allowance changes without expiry require review.',
        requiredPolicyDimensions: ['validity-window'],
      }),
    );
  }
  if (allowance.spenderKnown === false) {
    output.push(
      signal({
        code: 'allowance-spender-unknown',
        category: 'allowance',
        severity: 'critical',
        disposition: 'block',
        message: 'Allowance spender must be identified before execution.',
        requiredPolicyDimensions: ['spender'],
        missingEvidenceClasses: ['counterparty'],
      }),
    );
  }

  return Object.freeze(output);
}

function delegationSignals(
  delegation: CryptoIntelligenceDelegationContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!delegation) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const tupleDigest = normalizeOptionalIdentifier(
    delegation.authorizationTupleDigest,
    'delegation.authorizationTupleDigest',
  );
  const delegateCodeDigest = normalizeOptionalIdentifier(
    delegation.delegateCodeDigest,
    'delegation.delegateCodeDigest',
  );

  if (!tupleDigest) {
    output.push(
      signal({
        code: 'delegation-authorization-missing',
        category: 'delegation',
        severity: 'critical',
        disposition: 'block',
        message: 'Delegated EOA execution requires an authorization tuple digest.',
        requiredPolicyDimensions: ['actor', 'runtime-context'],
        missingEvidenceClasses: ['delegation-authorization'],
      }),
    );
  }
  if (delegation.nonceFresh !== true) {
    output.push(
      signal({
        code: 'delegation-nonce-not-fresh',
        category: 'delegation',
        severity: 'critical',
        disposition: 'block',
        message: 'Delegated EOA execution requires fresh nonce evidence.',
        requiredPolicyDimensions: ['validity-window'],
        missingEvidenceClasses: ['delegation-nonce', 'freshness-window'],
      }),
    );
  }
  if (delegation.delegateRevocationPath !== true) {
    output.push(
      signal({
        code: 'delegation-revocation-missing',
        category: 'delegation',
        severity: 'critical',
        disposition: 'block',
        message: 'Delegated EOA execution requires a revocation or reset path.',
        requiredPolicyDimensions: ['validity-window', 'runtime-context'],
        missingEvidenceClasses: ['revocation-path'],
      }),
    );
  }
  if (tupleDigest && delegateCodeDigest) {
    output.push(
      signal({
        code: 'delegation-bound',
        category: 'delegation',
        severity: 'warning',
        disposition: 'review',
        message: 'Delegated EOA execution remains review-grade even when authorization and delegate code are digest-bound.',
        requiredPolicyDimensions: ['actor', 'runtime-context'],
        evidenceRefs: [
          { kind: 'digest', value: tupleDigest },
          { kind: 'digest', value: delegateCodeDigest },
        ],
      }),
    );
  }

  return Object.freeze(output);
}

function custodySignals(
  custody: CryptoIntelligenceCustodyContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!custody) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const policyDecisionDigest = normalizeOptionalIdentifier(
    custody.policyDecisionDigest,
    'custody.policyDecisionDigest',
  );

  if (custody.requiresPolicy === true && !policyDecisionDigest) {
    output.push(
      signal({
        code: 'custody-policy-decision-missing',
        category: 'custody',
        severity: 'critical',
        disposition: 'block',
        message: 'Custody execution requires a custody policy decision digest.',
        requiredPolicyDimensions: ['approval-quorum'],
        missingEvidenceClasses: ['custody-policy-decision'],
      }),
    );
  }
  if (custody.quorumMet === false) {
    output.push(
      signal({
        code: 'custody-quorum-missing',
        category: 'custody',
        severity: 'critical',
        disposition: 'block',
        message: 'Custody execution requires quorum evidence before allow.',
        requiredPolicyDimensions: ['approval-quorum'],
        missingEvidenceClasses: ['custody-quorum'],
      }),
    );
  }
  if (custody.providerTerminalStatus === 'deny' || custody.providerTerminalStatus === 'error') {
    output.push(
      signal({
        code: `custody-provider-${custody.providerTerminalStatus}`,
        category: 'custody',
        severity: 'critical',
        disposition: 'block',
        message: 'Custody provider terminal status blocks execution.',
        evidenceRefs: [
          {
            kind: 'reason-code',
            value: `custody-provider-${custody.providerTerminalStatus}`,
          },
        ],
      }),
    );
  }
  if (custody.providerTerminalStatus === 'hold') {
    output.push(
      signal({
        code: 'custody-provider-hold',
        category: 'custody',
        severity: 'warning',
        disposition: 'review',
        message: 'Custody provider hold status requires operator review.',
        evidenceRefs: [{ kind: 'reason-code', value: 'custody-provider-hold' }],
      }),
    );
  }

  return Object.freeze(output);
}

function x402Signals(
  x402: CryptoIntelligenceX402Context | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!x402) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const paymentRequirementDigest = normalizeOptionalIdentifier(
    x402.paymentRequirementDigest,
    'x402.paymentRequirementDigest',
  );
  const paymentSignatureDigest = normalizeOptionalIdentifier(
    x402.paymentSignatureDigest,
    'x402.paymentSignatureDigest',
  );
  const paymentResponseDigest = normalizeOptionalIdentifier(
    x402.paymentResponseDigest,
    'x402.paymentResponseDigest',
  );

  if (!paymentRequirementDigest) {
    output.push(
      signal({
        code: 'x402-payment-requirement-missing',
        category: 'x402',
        severity: 'critical',
        disposition: 'block',
        message: 'x402 execution requires a digest-bound payment requirement.',
        missingEvidenceClasses: ['x402-payment-requirement'],
      }),
    );
  }
  if (!paymentSignatureDigest) {
    output.push(
      signal({
        code: 'x402-payment-signature-missing',
        category: 'x402',
        severity: 'critical',
        disposition: 'block',
        message: 'x402 execution requires a digest-bound payment signature.',
        missingEvidenceClasses: ['x402-payment-signature'],
      }),
    );
  }
  if (!paymentResponseDigest) {
    output.push(
      signal({
        code: 'x402-payment-response-missing',
        category: 'x402',
        severity: 'warning',
        disposition: 'review',
        message: 'x402 execution should bind the payment response before completing the receipt.',
        missingEvidenceClasses: ['x402-payment-response'],
      }),
    );
  }
  if (x402.idempotencyKeyDigest === null) {
    output.push(
      signal({
        code: 'x402-idempotency-digest-missing',
        category: 'x402',
        severity: 'warning',
        disposition: 'review',
        message: 'x402 execution should reference idempotency by digest when retries are possible.',
      }),
    );
  }

  return Object.freeze(output);
}

function solverSignals(
  solver: CryptoIntelligenceSolverContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!solver) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];
  const routeCommitmentDigest = normalizeOptionalIdentifier(
    solver.routeCommitmentDigest,
    'solver.routeCommitmentDigest',
  );
  const settlementPreflightDigest = normalizeOptionalIdentifier(
    solver.settlementPreflightDigest,
    'solver.settlementPreflightDigest',
  );

  if (!routeCommitmentDigest) {
    output.push(
      signal({
        code: 'solver-route-commitment-missing',
        category: 'solver',
        severity: 'critical',
        disposition: 'block',
        message: 'Intent-solver execution requires a digest-bound route commitment.',
        requiredPolicyDimensions: ['protocol', 'counterparty'],
        missingEvidenceClasses: ['route-commitment'],
      }),
    );
  }
  if (!settlementPreflightDigest) {
    output.push(
      signal({
        code: 'solver-settlement-preflight-missing',
        category: 'solver',
        severity: 'critical',
        disposition: 'block',
        message: 'Intent-solver execution requires settlement preflight evidence.',
        missingEvidenceClasses: ['solver-settlement-preflight'],
      }),
    );
  }
  if (solver.refundPathBound === false) {
    output.push(
      signal({
        code: 'solver-refund-path-missing',
        category: 'solver',
        severity: 'critical',
        disposition: 'block',
        message: 'Intent-solver execution requires refund or failed-settlement recovery evidence.',
        missingEvidenceClasses: ['route-commitment'],
      }),
    );
  }

  return Object.freeze(output);
}

function freshnessSignals(
  freshness: CryptoIntelligenceFreshnessContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!freshness) return Object.freeze([]);

  const evaluatedAt = new Date(normalizeIsoTimestamp(freshness.evaluatedAt, 'freshness.evaluatedAt'));
  const createdAt = freshness.evidenceCreatedAt
    ? new Date(normalizeIsoTimestamp(freshness.evidenceCreatedAt, 'freshness.evidenceCreatedAt'))
    : null;
  const expiresAt = freshness.expiresAt
    ? new Date(normalizeIsoTimestamp(freshness.expiresAt, 'freshness.expiresAt'))
    : null;
  const output: CryptoIntelligenceRiskSignal[] = [];

  if (!createdAt) {
    output.push(
      signal({
        code: 'freshness-created-at-missing',
        category: 'freshness',
        severity: 'critical',
        disposition: 'block',
        message: 'Crypto intelligence requires evidence creation time before execution.',
        missingEvidenceClasses: ['freshness-window'],
      }),
    );
  }

  if (createdAt && freshness.maxAgeSeconds != null) {
    if (!Number.isInteger(freshness.maxAgeSeconds) || freshness.maxAgeSeconds <= 0) {
      throw new Error('Crypto intelligence risk signals freshness.maxAgeSeconds must be a positive integer.');
    }
    const ageMs = evaluatedAt.getTime() - createdAt.getTime();
    if (ageMs < 0) {
      output.push(
        signal({
          code: 'freshness-created-in-future',
          category: 'freshness',
          severity: 'critical',
          disposition: 'block',
          message: 'Crypto intelligence evidence cannot be created after evaluation time.',
          missingEvidenceClasses: ['freshness-window'],
        }),
      );
    } else if (ageMs > freshness.maxAgeSeconds * 1000) {
      output.push(
        signal({
          code: 'freshness-window-stale',
          category: 'freshness',
          severity: 'critical',
          disposition: 'block',
          message: 'Crypto intelligence evidence is stale for the configured freshness window.',
          missingEvidenceClasses: ['freshness-window'],
        }),
      );
    }
  }

  if (expiresAt && expiresAt.getTime() <= evaluatedAt.getTime()) {
    output.push(
      signal({
        code: 'freshness-expired',
        category: 'freshness',
        severity: 'critical',
        disposition: 'block',
        message: 'Crypto intelligence evidence has expired.',
        missingEvidenceClasses: ['freshness-window'],
      }),
    );
  }

  return Object.freeze(output);
}

function velocitySignals(
  velocity: CryptoIntelligenceVelocityContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!velocity) return Object.freeze([]);

  const output: CryptoIntelligenceRiskSignal[] = [];

  if (velocity.windowSeconds != null && (!Number.isInteger(velocity.windowSeconds) || velocity.windowSeconds <= 0)) {
    throw new Error('Crypto intelligence risk signals velocity.windowSeconds must be a positive integer.');
  }

  if (velocity.operationCount != null) {
    if (!Number.isInteger(velocity.operationCount) || velocity.operationCount < 0) {
      throw new Error('Crypto intelligence risk signals velocity.operationCount must be a non-negative integer.');
    }
    if (velocity.operationCount >= CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.operationCritical) {
      output.push(
        signal({
          code: 'velocity-operation-critical',
          category: 'velocity',
          severity: 'critical',
          disposition: 'block',
          message: 'Crypto operation velocity exceeds the critical threshold.',
          requiredPolicyDimensions: ['cadence'],
        }),
      );
    } else if (velocity.operationCount >= CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.operationReview) {
      output.push(
        signal({
          code: 'velocity-operation-review',
          category: 'velocity',
          severity: 'warning',
          disposition: 'review',
          message: 'Crypto operation velocity requires review.',
          requiredPolicyDimensions: ['cadence'],
        }),
      );
    }
  }

  if (velocity.normalizedUsd != null) {
    const normalizedUsd = normalizeIdentifier(velocity.normalizedUsd, 'velocity.normalizedUsd');
    if (decimalAtLeast(normalizedUsd, CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.amountCriticalUsd)) {
      output.push(
        signal({
          code: 'velocity-amount-critical',
          category: 'velocity',
          severity: 'critical',
          disposition: 'block',
          message: 'Crypto value velocity exceeds the critical threshold.',
          requiredPolicyDimensions: ['amount', 'cadence'],
        }),
      );
    } else if (decimalAtLeast(normalizedUsd, CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.amountReviewUsd)) {
      output.push(
        signal({
          code: 'velocity-amount-review',
          category: 'velocity',
          severity: 'warning',
          disposition: 'review',
          message: 'Crypto value velocity requires review.',
          requiredPolicyDimensions: ['amount', 'cadence'],
        }),
      );
    }
  }

  if (velocity.distinctCounterparties != null) {
    if (!Number.isInteger(velocity.distinctCounterparties) || velocity.distinctCounterparties < 0) {
      throw new Error('Crypto intelligence risk signals velocity.distinctCounterparties must be a non-negative integer.');
    }
    if (velocity.distinctCounterparties >= CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.counterpartyCritical) {
      output.push(
        signal({
          code: 'velocity-counterparty-critical',
          category: 'velocity',
          severity: 'critical',
          disposition: 'block',
          message: 'Counterparty velocity exceeds the critical threshold.',
          requiredPolicyDimensions: ['counterparty', 'cadence'],
        }),
      );
    } else if (velocity.distinctCounterparties >= CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS.counterpartyReview) {
      output.push(
        signal({
          code: 'velocity-counterparty-review',
          category: 'velocity',
          severity: 'warning',
          disposition: 'review',
          message: 'Counterparty velocity requires review.',
          requiredPolicyDimensions: ['counterparty', 'cadence'],
        }),
      );
    }
  }

  return Object.freeze(output);
}

function contextSignals(
  context: CryptoIntelligenceRiskSignalContext | null | undefined,
): readonly CryptoIntelligenceRiskSignal[] {
  if (!context) return Object.freeze([]);

  return Object.freeze([
    ...chainSignals(context.chain),
    ...routeSignals(context.route),
    ...allowanceSignals(context.allowance),
    ...delegationSignals(context.delegation),
    ...custodySignals(context.custody),
    ...x402Signals(context.x402),
    ...solverSignals(context.solver),
    ...freshnessSignals(context.freshness),
    ...velocitySignals(context.velocity),
  ]);
}

function assessmentCanonicalPayload(input: {
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly signals: readonly CryptoIntelligenceRiskSignal[];
  readonly overallSeverity: CryptoIntelligenceSignalSeverity;
  readonly recommendedDisposition: CryptoIntelligenceSignalDisposition;
  readonly missingEvidenceClasses: readonly CryptoIntelligenceMissingEvidenceClass[];
}): CanonicalReleaseJsonValue {
  return {
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    riskAssessmentDigest: input.riskAssessment.digest,
    consequenceKind: input.riskAssessment.consequenceKind,
    riskClass: input.riskAssessment.riskClass,
    overallSeverity: input.overallSeverity,
    recommendedDisposition: input.recommendedDisposition,
    signals: input.signals as unknown as CanonicalReleaseJsonValue,
    missingEvidenceClasses: input.missingEvidenceClasses,
  };
}

export function createCryptoIntelligenceRiskSignalAssessment(
  input: CreateCryptoIntelligenceRiskSignalAssessmentInput,
): CryptoIntelligenceRiskSignalAssessment {
  const signals = Object.freeze([
    ...findingSignals(input.riskAssessment),
    ...readinessSignals(input.readiness),
    ...observationSignals(input.observations),
    ...contextSignals(input.context),
  ]);
  const overallSeverity = signals.reduce(
    (current, entry) => maxSeverity(current, entry.severity),
    riskClassSeverity(input.riskAssessment.riskClass),
  );
  const initialDisposition: CryptoIntelligenceSignalDisposition =
    input.riskAssessment.riskClass === 'R0' || input.riskAssessment.riskClass === 'R1'
      ? 'admit'
      : 'review';
  const recommendedDisposition = signals.reduce<CryptoIntelligenceSignalDisposition>(
    (current, entry) => maxDisposition(current, entry.disposition),
    initialDisposition,
  );
  const missingEvidenceClasses = unique(
    signals.flatMap((entry) => entry.missingEvidenceClasses),
  );
  const criticalSignalCount = signals.filter((entry) => entry.severity === 'critical').length;
  const reviewSignalCount = signals.filter((entry) => entry.disposition === 'review').length;
  const blockSignalCount = signals.filter((entry) => entry.disposition === 'block').length;
  const canonical = canonicalObject(assessmentCanonicalPayload({
    riskAssessment: input.riskAssessment,
    signals,
    overallSeverity,
    recommendedDisposition,
    missingEvidenceClasses,
  }));

  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    riskAssessmentDigest: input.riskAssessment.digest,
    consequenceKind: input.riskAssessment.consequenceKind,
    riskClass: input.riskAssessment.riskClass,
    overallSeverity,
    recommendedDisposition,
    signalCount: signals.length,
    criticalSignalCount,
    reviewSignalCount,
    blockSignalCount,
    signals,
    missingEvidenceClasses,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoIntelligenceRiskSignalsDescriptor():
CryptoIntelligenceRiskSignalsDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
    categories: CRYPTO_INTELLIGENCE_SIGNAL_CATEGORIES,
    severities: CRYPTO_INTELLIGENCE_SIGNAL_SEVERITIES,
    dispositions: CRYPTO_INTELLIGENCE_SIGNAL_DISPOSITIONS,
    missingEvidenceClasses: CRYPTO_INTELLIGENCE_MISSING_EVIDENCE_CLASSES,
    velocityThresholds: CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS,
  });
}

export function cryptoIntelligenceRiskSignalLabel(
  assessment: CryptoIntelligenceRiskSignalAssessment,
): string {
  return [
    `crypto-intelligence:${assessment.consequenceKind}`,
    `risk:${assessment.riskClass}`,
    `severity:${assessment.overallSeverity}`,
    `disposition:${assessment.recommendedDisposition}`,
    `signals:${assessment.signalCount}`,
  ].join(' / ');
}
