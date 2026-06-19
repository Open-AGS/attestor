import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CustodyApprovalEvidence,
  CustodyCosignerCallbackEvidence,
  CustodyKeyPostureEvidence,
  CustodyPolicyConditionsEvidence,
  CustodyPolicyDecisionEvidence,
  CustodyPostExecutionEvidence,
  CustodyScreeningEvidence,
  CustodyTransactionEvidence,
} from './custody-cosigner-policy-adapter-types.js';
import {
  includesString,
  parseAtomicUnits,
} from './custody-cosigner-policy-adapter-normalize.js';

export function releaseReady(releaseBinding: CryptoReleaseDecisionBinding): boolean {
  return (
    releaseBinding.status === 'bound' &&
    releaseBinding.releaseDecision.status === 'accepted'
  );
}

export function policyBindingReady(policyScopeBinding: CryptoPolicyControlPlaneScopeBinding): boolean {
  return policyScopeBinding.activationRecord.state === 'active';
}

export function enforcementReady(enforcementBinding: CryptoEnforcementVerificationBinding): boolean {
  return (
    enforcementBinding.adapterKind === 'custody-cosigner' &&
    enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind === 'action-dispatch' &&
    enforcementBinding.verificationProfile.failClosed
  );
}

export function policyConditionsReady(conditions: CustodyPolicyConditionsEvidence): boolean {
  return (
    conditions.chainBound &&
    conditions.accountBound &&
    conditions.assetBound &&
    conditions.destinationBound &&
    conditions.amountBound &&
    conditions.operationBound &&
    conditions.budgetBound &&
    conditions.velocityBound &&
    conditions.attestorReceiptRequired &&
    conditions.attestorReceiptMatched
  );
}

export function collectedRequiredRoles(input: CustodyApprovalEvidence): boolean {
  return input.requiredRoles.every((role) => includesString(input.collectedRoles, role));
}

export function policyDecisionAllows(decision: CustodyPolicyDecisionEvidence): boolean {
  return (
    decision.effect === 'allow' &&
    decision.status === 'approved' &&
    decision.matched &&
    !decision.explicitDeny &&
    !decision.implicitDeny
  );
}

export function policyDecisionPending(decision: CustodyPolicyDecisionEvidence): boolean {
  return decision.effect === 'review-required' || decision.status === 'pending';
}

export function callbackAuthenticated(callback: CustodyCosignerCallbackEvidence): boolean {
  return (
    callback.configured &&
    callback.authenticated &&
    callback.signatureValid &&
    callback.tlsPinned &&
    callback.senderConstrained &&
    callback.sourceIpAllowlisted
  );
}

export function callbackFresh(callback: CustodyCosignerCallbackEvidence): boolean {
  return (
    callback.nonceFresh &&
    callback.bodyHashMatches &&
    callback.responseWithinSeconds <= 30
  );
}

export function responseAllows(callback: CustodyCosignerCallbackEvidence): boolean {
  return (
    callback.responseAction === 'approve' &&
    callback.responseSigned &&
    callback.attestorReleaseTokenVerified
  );
}

export function responseNeedsReview(callback: CustodyCosignerCallbackEvidence): boolean {
  return callback.responseAction === 'pending-review' || callback.responseAction === 'retry';
}

export function screeningReady(
  screening: CustodyScreeningEvidence,
): boolean {
  const travelRuleReady =
    !screening.travelRuleRequired || screening.travelRuleCompleted;
  return (
    screening.destinationAllowlisted &&
    screening.counterpartyKnown &&
    screening.sanctionsScreened &&
    !screening.sanctionsHit &&
    screening.riskTierAllowed &&
    screening.riskScore <= screening.riskScoreMax &&
    travelRuleReady
  );
}

export function velocityReady(input: {
  readonly screening: CustodyScreeningEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly intent: CryptoAuthorizationIntent;
}): boolean {
  const amount = parseAtomicUnits(input.transaction.amount, 'transaction.amount');
  const remaining = parseAtomicUnits(
    input.screening.velocityLimitRemainingAtomic,
    'screening.velocityLimitRemainingAtomic',
  );
  const maxAmount = parseAtomicUnits(input.screening.maxAmountAtomic, 'screening.maxAmountAtomic');
  const intentMax = input.intent.constraints.maxAmount
    ? parseAtomicUnits(input.intent.constraints.maxAmount, 'intent.constraints.maxAmount')
    : null;
  return (
    input.screening.velocityLimitChecked &&
    amount <= remaining &&
    amount <= maxAmount &&
    (intentMax === null || amount <= intentMax)
  );
}

export function keyPostureReady(keyPosture: CustodyKeyPostureEvidence): boolean {
  return (
    (keyPosture.keyType === 'mpc' || keyPosture.keyType === 'hsm' || keyPosture.keyType === 'tee-mpc') &&
    keyPosture.cosignerPaired &&
    keyPosture.cosignerHealthy &&
    keyPosture.enclaveBacked &&
    keyPosture.keyShareHealthy &&
    keyPosture.signingPolicyBound &&
    !keyPosture.keyExportable &&
    keyPosture.signerRoleBound &&
    keyPosture.haSignerAvailable &&
    keyPosture.recoveryReady
  );
}

export function postExecutionReady(postExecution: CustodyPostExecutionEvidence): boolean {
  return (
    postExecution.status === 'not-submitted' ||
    postExecution.status === 'submitted' ||
    postExecution.status === 'signed' ||
    postExecution.status === 'broadcast' ||
    postExecution.status === 'confirmed'
  );
}
