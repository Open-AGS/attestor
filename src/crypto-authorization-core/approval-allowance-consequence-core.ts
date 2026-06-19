import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  createCryptoCanonicalCounterpartyReference,
  type CryptoCanonicalCounterpartyReference,
} from './canonical-references.js';
import {
  createCryptoConsequenceRiskAssessment,
  type CryptoConsequenceRiskAssessment,
} from './consequence-risk-mapping.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
  type CreateCryptoApprovalAllowanceConsequenceInput,
  type CryptoAllowanceAmountPosture,
  type CryptoAllowanceDurationPosture,
  type CryptoApprovalAllowanceConsequence,
  type CryptoApprovalAllowanceMechanism,
  type CryptoApprovalAllowanceObservation,
  type CryptoApprovalAllowanceOutcome,
  type CryptoApprovalAllowanceRevocationPosture,
} from './approval-allowance-consequence-types.js';
import {
  amountPostureFrom,
  caip2ChainId,
  canonicalObject,
  durationPostureFrom,
  mechanismFrom,
  normalizeAddress,
  normalizeIsoTimestamp,
  normalizeOptionalAddress,
  normalizeOptionalAmount,
  normalizeOptionalIdentifier,
  normalizeAmount,
  resultingAllowanceFor,
  revocationFrom,
} from './approval-allowance-consequence-utils.js';
import { buildObservations } from './approval-allowance-consequence-observations.js';

function createRiskAssessment(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly requestedAmount: string;
  readonly normalizedUsd: string | null;
  readonly counterparty: CryptoCanonicalCounterpartyReference;
  readonly durationPosture: CryptoAllowanceDurationPosture;
  readonly budgetId: string | null;
  readonly revocation: CryptoApprovalAllowanceRevocationPosture;
  readonly isKnownSpender: boolean | null;
}): CryptoConsequenceRiskAssessment {
  return createCryptoConsequenceRiskAssessment({
    consequenceKind: input.intent.consequenceKind,
    account: input.intent.account,
    asset: input.intent.asset,
    amount: {
      assetAmount: input.requestedAmount,
      normalizedUsd: input.normalizedUsd,
      isUnlimitedApproval: input.amountPosture === 'unlimited',
    },
    counterparty: input.counterparty,
    context: {
      executionAdapterKind: input.intent.executionAdapterKind,
      hasExpiry:
        input.durationPosture === 'transaction-scoped' ||
        input.durationPosture === 'revoked' ||
        input.durationPosture === 'time-bound',
      hasBudget: input.budgetId !== null,
      hasRevocationPath:
        input.durationPosture === 'transaction-scoped' ||
        input.durationPosture === 'revoked' ||
        input.revocation.revocable,
      isKnownCounterparty: input.isKnownSpender,
      signals: input.intent.consequenceKind === 'permission-grant'
        ? ['wallet-permission']
        : [],
    },
  });
}

function outcomeFromObservations(
  observations: readonly CryptoApprovalAllowanceObservation[],
): CryptoApprovalAllowanceOutcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(
  outcome: CryptoApprovalAllowanceOutcome,
): CryptoSimulationPreflightSignal['status'] {
  switch (outcome) {
    case 'allow':
      return 'pass';
    case 'review-required':
      return 'warn';
    case 'block':
      return 'fail';
  }
}

function failingReasonCodes(
  observations: readonly CryptoApprovalAllowanceObservation[],
): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

function signalFor(input: {
  readonly consequenceId: string;
  readonly outcome: CryptoApprovalAllowanceOutcome;
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly durationPosture: CryptoAllowanceDurationPosture;
  readonly tokenAddress: string | null;
  readonly spenderAddress: string;
  readonly requestedAmount: string;
  readonly resultingAllowance: string;
  readonly budgetId: string | null;
  readonly observations: readonly CryptoApprovalAllowanceObservation[];
}): CryptoSimulationPreflightSignal {
  const status = signalStatusFor(input.outcome);
  return Object.freeze({
    source: 'erc-7715-permission',
    status,
    code: input.outcome === 'allow'
      ? 'approval-allowance-preflight-pass'
      : input.outcome === 'review-required'
        ? 'approval-allowance-preflight-review-required'
        : 'approval-allowance-preflight-block',
    message: input.outcome === 'allow'
      ? 'Approval allowance consequence is bounded enough for downstream authorization simulation.'
      : input.outcome === 'review-required'
        ? 'Approval allowance consequence needs additional policy evidence before execution.'
        : 'Approval allowance consequence must fail closed before execution.',
    required: true,
    evidence: Object.freeze({
      consequenceId: input.consequenceId,
      mechanism: input.mechanism,
      amountPosture: input.amountPosture,
      durationPosture: input.durationPosture,
      tokenAddress: input.tokenAddress,
      spenderAddress: input.spenderAddress,
      requestedAmount: input.requestedAmount,
      resultingAllowance: input.resultingAllowance,
      budgetId: input.budgetId,
      reasonCodes: failingReasonCodes(input.observations),
    }),
  });
}

function consequenceIdFor(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly spenderAddress: string;
  readonly tokenAddress: string | null;
  readonly requestedAmount: string;
  readonly resultingAllowance: string;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly durationPosture: CryptoAllowanceDurationPosture;
}): string {
  return canonicalObject({
    version: CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
    intentId: input.intent.intentId,
    mechanism: input.mechanism,
    spenderAddress: input.spenderAddress,
    tokenAddress: input.tokenAddress,
    requestedAmount: input.requestedAmount,
    resultingAllowance: input.resultingAllowance,
    amountPosture: input.amountPosture,
    durationPosture: input.durationPosture,
  }).digest;
}

export function createCryptoApprovalAllowanceConsequence(
  input: CreateCryptoApprovalAllowanceConsequenceInput,
): CryptoApprovalAllowanceConsequence {
  const mechanism = mechanismFrom(input.mechanism);
  const requestedAmount = normalizeAmount(input.requestedAmount, 'requestedAmount');
  const currentAllowance = normalizeOptionalAmount(input.currentAllowance, 'currentAllowance');
  const explicitResultingAllowance = normalizeOptionalAmount(
    input.resultingAllowance,
    'resultingAllowance',
  );
  const allowanceExpiration = normalizeIsoTimestamp(
    input.allowanceExpiration,
    'allowanceExpiration',
  );
  const permitDeadline = normalizeIsoTimestamp(input.permitDeadline, 'permitDeadline');
  const amountPosture = amountPostureFrom({
    mechanism,
    requestedAmount,
    amountPosture: input.amountPosture,
  });
  const durationPosture = durationPostureFrom({
    mechanism,
    amountPosture,
    allowanceExpiration,
    durationPosture: input.durationPosture,
  });
  const ownerAddress = normalizeAddress(input.ownerAddress ?? input.intent.account.address, 'ownerAddress');
  const tokenAddress = normalizeOptionalAddress(
    input.tokenAddress ?? input.intent.asset?.assetId,
    'tokenAddress',
  );
  const spenderAddress = normalizeAddress(input.spenderAddress, 'spenderAddress');
  const resultingAllowance = resultingAllowanceFor({
    mechanism,
    amountPosture,
    requestedAmount,
    currentAllowance,
    resultingAllowance: explicitResultingAllowance,
  });
  const budgetId = normalizeOptionalIdentifier(
    input.budgetId ?? input.intent.constraints.budgetId,
    'budgetId',
  );
  const revocation = revocationFrom(input.revocation, durationPosture);
  const permitNonce = normalizeOptionalIdentifier(input.permitNonce, 'permitNonce');
  const permitDomainChainId = normalizeOptionalIdentifier(
    input.permitDomainChainId,
    'permitDomainChainId',
  );
  const permitDomainVerifyingContract = normalizeOptionalAddress(
    input.permitDomainVerifyingContract,
    'permitDomainVerifyingContract',
  );
  const counterparty = createCryptoCanonicalCounterpartyReference({
    counterpartyKind: 'contract',
    counterpartyId: spenderAddress,
    chain: input.intent.chain,
    display: input.spenderLabel ?? spenderAddress,
  });
  const normalizedUsd = normalizeOptionalAmount(input.normalizedUsd, 'normalizedUsd');
  const riskAssessment = createRiskAssessment({
    intent: input.intent,
    amountPosture,
    requestedAmount,
    normalizedUsd,
    counterparty,
    durationPosture,
    budgetId,
    revocation,
    isKnownSpender: input.isKnownSpender ?? null,
  });
  const observations = buildObservations({
    intent: input.intent,
    mechanism,
    amountPosture,
    durationPosture,
    ownerAddress,
    tokenAddress,
    spenderAddress,
    requestedAmount,
    currentAllowance,
    resultingAllowance,
    allowanceExpiration,
    permitDeadline,
    permitNonce,
    permitDomainChainId,
    permitDomainVerifyingContract,
    budgetId,
    revocation,
    riskAssessment,
  });
  const outcome = outcomeFromObservations(observations);
  const consequenceId =
    normalizeOptionalIdentifier(input.consequenceId, 'consequenceId') ??
    consequenceIdFor({
      intent: input.intent,
      mechanism,
      spenderAddress,
      tokenAddress,
      requestedAmount,
      resultingAllowance,
      amountPosture,
      durationPosture,
    });
  const signal = signalFor({
    consequenceId,
    outcome,
    mechanism,
    amountPosture,
    durationPosture,
    tokenAddress,
    spenderAddress,
    requestedAmount,
    resultingAllowance,
    budgetId,
    observations,
  });
  const consequenceKind = input.intent.consequenceKind;
  const canonicalPayload = {
    version: CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
    consequenceId,
    intentId: input.intent.intentId,
    consequenceKind,
    mechanism,
    amountPosture,
    durationPosture,
    outcome,
    chainId: caip2ChainId(input.intent),
    ownerAddress,
    tokenAddress,
    spenderAddress,
    requestedAmount,
    currentAllowance,
    resultingAllowance,
    allowanceExpiration,
    permitDeadline,
    permitNonce,
    permitDomainChainId,
    permitDomainVerifyingContract,
    budgetId,
    revocation,
    approvalPolicyRef: normalizeOptionalIdentifier(input.approvalPolicyRef, 'approvalPolicyRef'),
    counterpartyDigest: counterparty.digest,
    riskAssessmentDigest: riskAssessment.digest,
    requiredPolicyDimensions: riskAssessment.review.requiredPolicyDimensions,
    signal,
    observations,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    version: CRYPTO_APPROVAL_ALLOWANCE_CONSEQUENCE_SPEC_VERSION,
    consequenceId,
    intentId: input.intent.intentId,
    consequenceKind,
    mechanism,
    amountPosture,
    durationPosture,
    outcome,
    chainId: caip2ChainId(input.intent),
    ownerAddress,
    tokenAddress,
    spenderAddress,
    requestedAmount,
    currentAllowance,
    resultingAllowance,
    allowanceExpiration,
    permitDeadline,
    permitNonce,
    budgetId,
    revocation,
    counterparty,
    riskAssessment,
    requiredPolicyDimensions: riskAssessment.review.requiredPolicyDimensions,
    signal,
    observations,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
