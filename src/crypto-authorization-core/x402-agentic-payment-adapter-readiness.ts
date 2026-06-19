import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import {
  X402_EXACT_AUTHORIZATION_MODES,
  type X402AgentBudgetEvidence,
  type X402ExactAuthorizationEvidence,
  type X402PaymentRequirementsEvidence,
  type X402PrivacyMetadataEvidence,
} from './x402-agentic-payment-adapter-types.js';
import {
  includesValue,
  namespaceForNetwork,
  parseAtomicUnits,
} from './x402-agentic-payment-adapter-normalize.js';

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function samePaymentAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  if (left.startsWith('0x') || right.startsWith('0x')) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

export function sameString(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return left.toLowerCase() === right.toLowerCase();
}

export function resourceOrigin(resourceUrl: string): string {
  const url = new URL(resourceUrl);
  return url.origin;
}

export function intentMaxAmountReady(intent: CryptoAuthorizationIntent, amount: string): boolean {
  if (!intent.constraints.maxAmount) {
    return true;
  }
  return parseAtomicUnits(amount, 'amount') <= parseAtomicUnits(intent.constraints.maxAmount, 'intent.maxAmount');
}

export function selectedAcceptReady(requirements: X402PaymentRequirementsEvidence): boolean {
  return (
    requirements.acceptsCount > 0 &&
    requirements.selectedAcceptIndex >= 0 &&
    requirements.selectedAcceptIndex < requirements.acceptsCount
  );
}

export function expectedAuthorizationModeReady(
  mode: string,
  network: string,
  asset: string,
): boolean {
  const namespace = namespaceForNetwork(network);
  if (!includesValue(X402_EXACT_AUTHORIZATION_MODES, mode)) {
    return false;
  }
  if (namespace === 'eip155') {
    return (
      mode === 'eip-3009-transfer-with-authorization' ||
      mode === 'permit2-transfer'
    );
  }
  if (namespace === 'solana') {
    return mode === 'svm-transfer-checked' && asset.length > 0;
  }
  return false;
}

export function authorizationWindowSeconds(authorization: X402ExactAuthorizationEvidence): bigint {
  return (
    BigInt(authorization.validBeforeEpochSeconds) -
    BigInt(authorization.validAfterEpochSeconds)
  );
}

export function authorizationWithinIntentWindow(
  authorization: X402ExactAuthorizationEvidence,
  intent: CryptoAuthorizationIntent,
): boolean {
  const validAfter = Number(authorization.validAfterEpochSeconds) * 1000;
  const validBefore = Number(authorization.validBeforeEpochSeconds) * 1000;
  const intentValidAfter = new Date(intent.constraints.validAfter).getTime();
  const intentValidUntil = new Date(intent.constraints.validUntil).getTime();
  return (
    Number.isFinite(validAfter) &&
    Number.isFinite(validBefore) &&
    validAfter >= intentValidAfter &&
    validBefore <= intentValidUntil
  );
}

export function budgetWithinLimit(input: {
  readonly budget: X402AgentBudgetEvidence;
  readonly requirements: X402PaymentRequirementsEvidence;
  readonly intent: CryptoAuthorizationIntent;
}): boolean {
  const spendUsed = parseAtomicUnits(input.budget.spendUsedAtomic, 'budget.spendUsedAtomic');
  const proposed = parseAtomicUnits(input.budget.proposedSpendAtomic, 'budget.proposedSpendAtomic');
  const limit = parseAtomicUnits(input.budget.spendLimitAtomic, 'budget.spendLimitAtomic');
  return (
    input.budget.budgetId === input.intent.constraints.budgetId &&
    input.budget.proposedSpendAtomic === input.requirements.amount &&
    intentMaxAmountReady(input.intent, input.requirements.amount) &&
    spendUsed + proposed <= limit &&
    input.budget.requestsUsedInWindow + 1 <= input.budget.maxRequestsInWindow &&
    input.budget.cadence === input.intent.constraints.cadence
  );
}

export function privacyReady(privacy: X402PrivacyMetadataEvidence): boolean {
  const piiSafe = !privacy.piiDetected || privacy.piiRedacted;
  const querySafe = !privacy.sensitiveQueryDetected || privacy.sensitiveQueryRedacted;
  return (
    privacy.metadataScanned &&
    piiSafe &&
    querySafe &&
    privacy.metadataMinimized &&
    privacy.facilitatorDataMinimized &&
    !privacy.reasonStringPiiDetected
  );
}

export function releaseReady(releaseBinding: CryptoReleaseDecisionBinding): boolean {
  return (
    releaseBinding.status === 'bound' &&
    releaseBinding.releaseDecision.status === 'accepted'
  );
}

export function enforcementReady(enforcementBinding: CryptoEnforcementVerificationBinding): boolean {
  return (
    enforcementBinding.adapterKind === 'x402-payment' &&
    enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind === 'action-dispatch' &&
    enforcementBinding.verificationProfile.failClosed
  );
}
