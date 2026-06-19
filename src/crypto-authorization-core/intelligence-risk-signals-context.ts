import type {
  CryptoSimulationObservation,
  CryptoSimulationReadiness,
} from './authorization-simulation.js';
import type { CryptoChainReference } from './types.js';
import {
  CRYPTO_INTELLIGENCE_VELOCITY_THRESHOLDS,
  type CryptoIntelligenceAllowanceContext,
  type CryptoIntelligenceCustodyContext,
  type CryptoIntelligenceDelegationContext,
  type CryptoIntelligenceFreshnessContext,
  type CryptoIntelligenceRiskSignal,
  type CryptoIntelligenceRiskSignalContext,
  type CryptoIntelligenceRouteContext,
  type CryptoIntelligenceSolverContext,
  type CryptoIntelligenceVelocityContext,
  type CryptoIntelligenceX402Context,
} from './intelligence-risk-signals-types.js';
import {
  decimalAtLeast,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
  signal,
} from './intelligence-risk-signals-utils.js';

export function chainSignals(
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

export function readinessSignals(
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

export function observationSignals(
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

export function routeSignals(
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

export function allowanceSignals(
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

export function delegationSignals(
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

export function custodySignals(
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

export function x402Signals(
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

export function solverSignals(
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

export function freshnessSignals(
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

export function velocitySignals(
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

export function contextSignals(
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
