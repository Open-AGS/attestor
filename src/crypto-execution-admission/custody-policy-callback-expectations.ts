import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type {
  CustodyAccountEvidence,
  CustodyApprovalEvidence,
  CustodyCosignerCallbackEvidence,
  CustodyCosignerPolicyPreflight,
  CustodyKeyPostureEvidence,
  CustodyPolicyDecisionEvidence,
  CustodyPostExecutionEvidence,
  CustodyScreeningEvidence,
  CustodyTransactionEvidence,
} from '../crypto-authorization-core/custody-cosigner-policy-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';
import type {
  CustodyPolicyAdmissionExpectation,
  CustodyPolicyAdmissionExpectationStatus,
  CustodyPolicyCallbackProviderProfile,
  CustodyPolicyCallbackProtocol,
} from './custody-policy-callback-types.js';
import {
  expectation,
  normalizeIdentifier,
  normalizeNonNegativeNumber,
  parseAtomicUnits,
  sameIdentifier,
  signedResponseRequired,
} from './custody-policy-callback-utils.js';

function adapterPreflightExpectation(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
}): CustodyPolicyAdmissionExpectation {
  const status: CustodyPolicyAdmissionExpectationStatus =
    input.plan.outcome === 'deny' || input.preflight.outcome === 'block'
      ? 'failed'
      : input.plan.outcome === 'admit' && input.preflight.outcome === 'allow'
        ? 'satisfied'
        : 'pending';
  return expectation({
    kind: 'adapter-preflight',
    status,
    reasonCode:
      status === 'failed'
        ? 'custody-adapter-preflight-blocked'
        : status === 'pending'
          ? 'custody-adapter-preflight-needs-review'
          : 'custody-adapter-preflight-ready',
    evidence: {
      planOutcome: input.plan.outcome,
      preflightOutcome: input.preflight.outcome,
      preflightDigest: input.preflight.digest,
    },
  });
}

function planSurfaceExpectation(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly account: CustodyAccountEvidence;
}): CustodyPolicyAdmissionExpectation {
  const sourceMatches =
    input.account.sourceAddress === undefined ||
    input.account.sourceAddress === null ||
    sameIdentifier(input.plan.accountAddress, input.account.sourceAddress);
  const ready =
    input.plan.surface === 'custody-policy-engine' &&
    input.plan.adapterKind === 'custody-cosigner' &&
    input.preflight.adapterKind === 'custody-cosigner' &&
    sameIdentifier(input.plan.chainId, input.preflight.chain) &&
    sameIdentifier(input.preflight.accountRef, input.account.accountRef) &&
    sourceMatches;
  return expectation({
    kind: 'plan-surface',
    status: ready ? 'satisfied' : 'unsupported',
    reasonCode: ready
      ? 'custody-admission-plan-surface-ready'
      : 'custody-admission-plan-surface-mismatch',
    evidence: {
      planSurface: input.plan.surface,
      planAdapterKind: input.plan.adapterKind ?? 'adapter-neutral',
      preflightAdapterKind: input.preflight.adapterKind,
      planChainId: input.plan.chainId,
      preflightChain: input.preflight.chain,
      planAccountAddress: input.plan.accountAddress,
      custodySourceAddress: input.account.sourceAddress ?? null,
      accountRef: input.account.accountRef,
    },
  });
}

function providerBindingExpectation(input: {
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly account: CustodyAccountEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
}): CustodyPolicyAdmissionExpectation {
  const ready =
    sameIdentifier(input.preflight.provider, input.account.provider) &&
    sameIdentifier(input.policyDecision.provider, input.account.provider) &&
    sameIdentifier(input.preflight.organizationId, input.account.organizationId) &&
    sameIdentifier(input.preflight.accountRef, input.account.accountRef);
  return expectation({
    kind: 'provider-binding',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-provider-binding-ready'
      : 'custody-provider-binding-mismatch',
    evidence: {
      provider: input.account.provider,
      preflightProvider: input.preflight.provider,
      policyDecisionProvider: input.policyDecision.provider,
      organizationId: input.account.organizationId,
      accountRef: input.account.accountRef,
    },
  });
}

function transactionBindingExpectation(input: {
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
}): CustodyPolicyAdmissionExpectation {
  const ready =
    sameIdentifier(input.preflight.requestId, input.transaction.requestId) &&
    sameIdentifier(input.preflight.idempotencyKey, input.transaction.idempotencyKey) &&
    sameIdentifier(input.preflight.chain, input.transaction.chain) &&
    sameIdentifier(input.preflight.chain, input.account.chain) &&
    sameIdentifier(input.preflight.asset, input.transaction.asset) &&
    sameIdentifier(input.preflight.asset, input.account.asset) &&
    sameIdentifier(input.preflight.amount, input.transaction.amount) &&
    sameIdentifier(input.preflight.destinationAddress, input.transaction.destinationAddress) &&
    sameIdentifier(input.transaction.sourceAccountRef, input.account.accountRef) &&
    input.transaction.simulationPassed === true &&
    input.transaction.duplicateRequestDetected !== true &&
    input.transaction.idempotencyFresh === true;
  return expectation({
    kind: 'transaction-binding',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-transaction-binding-ready'
      : 'custody-transaction-binding-mismatch',
    evidence: {
      requestId: input.transaction.requestId,
      idempotencyKey: input.transaction.idempotencyKey,
      idempotencyFresh: input.transaction.idempotencyFresh,
      duplicateRequestDetected: input.transaction.duplicateRequestDetected,
      chain: input.transaction.chain,
      asset: input.transaction.asset,
      amount: input.transaction.amount,
      sourceAccountRef: input.transaction.sourceAccountRef,
      destinationAddress: input.transaction.destinationAddress,
      simulationPassed: input.transaction.simulationPassed,
    },
  });
}

function policyDecisionExpectation(
  policyDecision: CustodyPolicyDecisionEvidence,
): CustodyPolicyAdmissionExpectation {
  const activeHashMatches =
    policyDecision.activePolicyHash === null ||
    policyDecision.activePolicyHash === undefined ||
    sameIdentifier(policyDecision.activePolicyHash, policyDecision.policyHash);
  const conditionsReady =
    policyDecision.conditions.chainBound &&
    policyDecision.conditions.accountBound &&
    policyDecision.conditions.assetBound &&
    policyDecision.conditions.destinationBound &&
    policyDecision.conditions.amountBound &&
    policyDecision.conditions.operationBound &&
    policyDecision.conditions.budgetBound &&
    policyDecision.conditions.velocityBound;
  const status = normalizeIdentifier(policyDecision.status, 'policyDecision.status');
  const effect = normalizeIdentifier(policyDecision.effect, 'policyDecision.effect');
  let expectationStatus: CustodyPolicyAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'custody-policy-decision-ready';
  if (
    effect === 'deny' ||
    status === 'denied' ||
    status === 'failed' ||
    status === 'timed-out' ||
    policyDecision.explicitDeny ||
    policyDecision.implicitDeny
  ) {
    expectationStatus = 'failed';
    reasonCode = 'custody-policy-decision-denied';
  } else if (effect === 'review-required' || status === 'pending') {
    expectationStatus = 'pending';
    reasonCode = 'custody-policy-decision-needs-review';
  } else if (
    effect !== 'allow' ||
    status !== 'approved' ||
    !policyDecision.matched ||
    !policyDecision.policyActivated ||
    !activeHashMatches ||
    !conditionsReady
  ) {
    expectationStatus = 'failed';
    reasonCode = 'custody-policy-decision-not-bound';
  }
  return expectation({
    kind: 'policy-decision',
    status: expectationStatus,
    reasonCode,
    evidence: {
      decisionId: policyDecision.decisionId,
      policyId: policyDecision.policyId,
      policyVersion: policyDecision.policyVersion,
      policyHash: policyDecision.policyHash,
      activePolicyHash: policyDecision.activePolicyHash ?? null,
      effect,
      status,
      matched: policyDecision.matched,
      explicitDeny: policyDecision.explicitDeny,
      implicitDeny: policyDecision.implicitDeny,
      policyActivated: policyDecision.policyActivated,
      conditionsReady,
    },
  });
}

function approvalQuorumExpectation(approvals: CustodyApprovalEvidence): CustodyPolicyAdmissionExpectation {
  const enoughApprovals =
    approvals.quorumSatisfied &&
    approvals.collectedApprovals >= approvals.requiredApprovals &&
    approvals.requiredApprovals > 0;
  return expectation({
    kind: 'approval-quorum',
    status: enoughApprovals ? 'satisfied' : 'pending',
    reasonCode: enoughApprovals
      ? 'custody-approval-quorum-ready'
      : 'custody-approval-quorum-needs-review',
    evidence: {
      requiredApprovals: approvals.requiredApprovals,
      collectedApprovals: approvals.collectedApprovals,
      quorumSatisfied: approvals.quorumSatisfied,
      approverIds: approvals.approverIds as unknown as CanonicalReleaseJsonValue,
      requiredRoles: approvals.requiredRoles as unknown as CanonicalReleaseJsonValue,
      collectedRoles: approvals.collectedRoles as unknown as CanonicalReleaseJsonValue,
    },
  });
}

function dutySeparationExpectation(approvals: CustodyApprovalEvidence): CustodyPolicyAdmissionExpectation {
  const ready =
    approvals.dutySeparationSatisfied &&
    !approvals.requesterApproved &&
    !approvals.policyAdminApprovedOwnChange;
  return expectation({
    kind: 'duty-separation',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-duty-separation-ready'
      : 'custody-duty-separation-failed',
    evidence: {
      requesterId: approvals.requesterId,
      requesterApproved: approvals.requesterApproved,
      dutySeparationSatisfied: approvals.dutySeparationSatisfied,
      policyAdminApprovedOwnChange: approvals.policyAdminApprovedOwnChange,
    },
  });
}

function breakGlassExpectation(approvals: CustodyApprovalEvidence): CustodyPolicyAdmissionExpectation {
  const status: CustodyPolicyAdmissionExpectationStatus = !approvals.breakGlassUsed
    ? 'satisfied'
    : approvals.breakGlassAuthorized
      ? 'pending'
      : 'failed';
  return expectation({
    kind: 'break-glass-control',
    status,
    reasonCode: !approvals.breakGlassUsed
      ? 'custody-break-glass-not-used'
      : approvals.breakGlassAuthorized
        ? 'custody-break-glass-needs-review'
        : 'custody-break-glass-unauthorized',
    evidence: {
      breakGlassUsed: approvals.breakGlassUsed,
      breakGlassAuthorized: approvals.breakGlassAuthorized,
    },
  });
}

function callbackConfigurationExpectation(
  callback: CustodyCosignerCallbackEvidence,
): CustodyPolicyAdmissionExpectation {
  return expectation({
    kind: 'callback-configuration',
    status: callback.configured ? 'satisfied' : 'failed',
    reasonCode: callback.configured
      ? 'custody-callback-configured'
      : 'custody-callback-not-configured',
    evidence: {
      callbackId: callback.callbackId,
      configured: callback.configured,
      authMethod: callback.authMethod,
    },
  });
}

function callbackAuthenticationExpectation(input: {
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly protocol: CustodyPolicyCallbackProtocol;
}): CustodyPolicyAdmissionExpectation {
  const signedRequired = signedResponseRequired(input.protocol);
  const signatureReady = signedRequired
    ? input.callback.signatureValid && input.callback.responseSigned
    : true;
  const tlsReady = input.protocol === 'tls-pinned-json' ? input.callback.tlsPinned : true;
  const senderReady =
    input.protocol === 'sender-constrained-json'
      ? input.callback.senderConstrained || input.callback.sourceIpAllowlisted
      : true;
  const ready =
    input.callback.authenticated &&
    signatureReady &&
    tlsReady &&
    senderReady &&
    input.callback.sourceIpAllowlisted;
  return expectation({
    kind: 'callback-authentication',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-callback-authentication-ready'
      : 'custody-callback-authentication-failed',
    evidence: {
      protocol: input.protocol,
      authMethod: input.callback.authMethod,
      authenticated: input.callback.authenticated,
      signatureValid: input.callback.signatureValid,
      responseSigned: input.callback.responseSigned,
      tlsPinned: input.callback.tlsPinned,
      senderConstrained: input.callback.senderConstrained,
      sourceIpAllowlisted: input.callback.sourceIpAllowlisted,
      signedResponseRequired: signedRequired,
    },
  });
}

function callbackFreshnessExpectation(input: {
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly profile: CustodyPolicyCallbackProviderProfile;
}): CustodyPolicyAdmissionExpectation {
  const responseWithinSeconds = normalizeNonNegativeNumber(
    input.callback.responseWithinSeconds,
    'callback.responseWithinSeconds',
  );
  const deadline = input.profile.responseDeadlineSeconds;
  const withinDeadline = deadline === null || responseWithinSeconds <= deadline;
  const ready =
    input.callback.nonceFresh &&
    input.callback.bodyHash !== null &&
    input.callback.bodyHash !== undefined &&
    input.callback.bodyHashMatches &&
    withinDeadline;
  return expectation({
    kind: 'callback-freshness',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-callback-fresh'
      : 'custody-callback-stale-or-unbound',
    evidence: {
      timestamp: input.callback.timestamp,
      nonce: input.callback.nonce,
      nonceFresh: input.callback.nonceFresh,
      bodyHash: input.callback.bodyHash ?? null,
      bodyHashMatches: input.callback.bodyHashMatches,
      responseWithinSeconds,
      responseDeadlineSeconds: deadline,
    },
  });
}

function attestorTokenExpectation(input: {
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
}): CustodyPolicyAdmissionExpectation {
  const required = input.policyDecision.conditions.attestorReceiptRequired;
  const ready =
    !required ||
    (input.policyDecision.conditions.attestorReceiptMatched &&
      input.callback.attestorReleaseTokenVerified);
  return expectation({
    kind: 'attestor-token-binding',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-attestor-token-binding-ready'
      : 'custody-attestor-token-binding-missing',
    evidence: {
      attestorReceiptRequired: required,
      attestorReceiptMatched: input.policyDecision.conditions.attestorReceiptMatched,
      attestorReleaseTokenVerified: input.callback.attestorReleaseTokenVerified,
    },
  });
}

function screeningExpectation(screening: CustodyScreeningEvidence): CustodyPolicyAdmissionExpectation {
  let status: CustodyPolicyAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'custody-screening-ready';
  if (!screening.sanctionsScreened) {
    status = 'missing';
    reasonCode = 'custody-screening-not-run';
  } else if (
    screening.sanctionsHit ||
    !screening.destinationAllowlisted ||
    !screening.counterpartyKnown ||
    !screening.riskTierAllowed ||
    screening.riskScore > screening.riskScoreMax
  ) {
    status = 'failed';
    reasonCode = 'custody-screening-risk-blocked';
  } else if (screening.travelRuleRequired && !screening.travelRuleCompleted) {
    status = 'pending';
    reasonCode = 'custody-travel-rule-needs-review';
  }
  return expectation({
    kind: 'screening',
    status,
    reasonCode,
    evidence: {
      destinationAllowlisted: screening.destinationAllowlisted,
      counterpartyKnown: screening.counterpartyKnown,
      sanctionsScreened: screening.sanctionsScreened,
      sanctionsHit: screening.sanctionsHit,
      riskScore: screening.riskScore,
      riskScoreMax: screening.riskScoreMax,
      riskTierAllowed: screening.riskTierAllowed,
      travelRuleRequired: screening.travelRuleRequired,
      travelRuleCompleted: screening.travelRuleCompleted,
    },
  });
}

function velocityLimitExpectation(input: {
  readonly transaction: CustodyTransactionEvidence;
  readonly screening: CustodyScreeningEvidence;
}): CustodyPolicyAdmissionExpectation {
  const amount = parseAtomicUnits(input.transaction.amount, 'transaction.amount');
  const remaining = parseAtomicUnits(
    input.screening.velocityLimitRemainingAtomic,
    'screening.velocityLimitRemainingAtomic',
  );
  const maxAmount = parseAtomicUnits(input.screening.maxAmountAtomic, 'screening.maxAmountAtomic');
  let status: CustodyPolicyAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'custody-velocity-and-limit-ready';
  if (!input.screening.velocityLimitChecked) {
    status = 'missing';
    reasonCode = 'custody-velocity-limit-not-checked';
  } else if (amount > remaining || amount > maxAmount) {
    status = 'failed';
    reasonCode = 'custody-velocity-or-limit-exceeded';
  }
  return expectation({
    kind: 'velocity-limit',
    status,
    reasonCode,
    evidence: {
      amount: input.transaction.amount,
      velocityLimitChecked: input.screening.velocityLimitChecked,
      velocityLimitRemainingAtomic: input.screening.velocityLimitRemainingAtomic,
      maxAmountAtomic: input.screening.maxAmountAtomic,
    },
  });
}

function keyPostureExpectation(
  keyPosture: CustodyKeyPostureEvidence,
): CustodyPolicyAdmissionExpectation {
  const ready =
    keyPosture.cosignerPaired &&
    keyPosture.cosignerHealthy &&
    keyPosture.enclaveBacked &&
    keyPosture.keyShareHealthy &&
    keyPosture.signingPolicyBound &&
    !keyPosture.keyExportable &&
    keyPosture.signerRoleBound &&
    keyPosture.haSignerAvailable &&
    keyPosture.recoveryReady;
  return expectation({
    kind: 'key-posture',
    status: ready ? 'satisfied' : 'failed',
    reasonCode: ready
      ? 'custody-key-posture-ready'
      : 'custody-key-posture-unsafe',
    evidence: {
      keyId: keyPosture.keyId,
      keyType: keyPosture.keyType,
      cosignerId: keyPosture.cosignerId,
      cosignerPaired: keyPosture.cosignerPaired,
      cosignerHealthy: keyPosture.cosignerHealthy,
      enclaveBacked: keyPosture.enclaveBacked,
      keyShareHealthy: keyPosture.keyShareHealthy,
      signingPolicyBound: keyPosture.signingPolicyBound,
      keyExportable: keyPosture.keyExportable,
      signerRoleBound: keyPosture.signerRoleBound,
      haSignerAvailable: keyPosture.haSignerAvailable,
      recoveryReady: keyPosture.recoveryReady,
    },
  });
}

function callbackResponseExpectation(
  callback: CustodyCosignerCallbackEvidence,
): CustodyPolicyAdmissionExpectation {
  const action = normalizeIdentifier(callback.responseAction, 'callback.responseAction');
  let status: CustodyPolicyAdmissionExpectationStatus = 'unsupported';
  let reasonCode = 'custody-callback-response-unsupported';
  if (action === 'approve') {
    status = 'satisfied';
    reasonCode = 'custody-callback-response-approved';
  } else if (action === 'pending-review') {
    status = 'pending';
    reasonCode = 'custody-callback-response-needs-review';
  } else if (action === 'retry') {
    status = 'pending';
    reasonCode = 'custody-callback-response-retry';
  } else if (action === 'reject') {
    status = 'failed';
    reasonCode = 'custody-callback-response-rejected';
  }
  return expectation({
    kind: 'callback-response',
    status,
    reasonCode,
    evidence: {
      responseAction: action,
      responseSigned: callback.responseSigned,
      responseWithinSeconds: callback.responseWithinSeconds,
    },
  });
}

function postExecutionExpectation(
  postExecution: CustodyPostExecutionEvidence,
): CustodyPolicyAdmissionExpectation {
  const status = normalizeIdentifier(postExecution.status, 'postExecution.status');
  const failed = status === 'failed' || status === 'cancelled';
  return expectation({
    kind: 'post-execution',
    status: failed ? 'failed' : 'satisfied',
    reasonCode: failed
      ? 'custody-post-execution-status-failed'
      : 'custody-post-execution-status-compatible',
    evidence: {
      activityId: postExecution.activityId ?? null,
      status,
      signatureHash: postExecution.signatureHash ?? null,
      transactionHash: postExecution.transactionHash ?? null,
      providerStatus: postExecution.providerStatus ?? null,
      failureReason: postExecution.failureReason ?? null,
    },
  });
}

export function expectationsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly approvals: CustodyApprovalEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly screening: CustodyScreeningEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly postExecution: CustodyPostExecutionEvidence;
  readonly profile: CustodyPolicyCallbackProviderProfile;
  readonly protocol: CustodyPolicyCallbackProtocol;
}): readonly CustodyPolicyAdmissionExpectation[] {
  return Object.freeze([
    planSurfaceExpectation(input),
    adapterPreflightExpectation(input),
    providerBindingExpectation(input),
    transactionBindingExpectation(input),
    policyDecisionExpectation(input.policyDecision),
    approvalQuorumExpectation(input.approvals),
    dutySeparationExpectation(input.approvals),
    breakGlassExpectation(input.approvals),
    callbackConfigurationExpectation(input.callback),
    callbackAuthenticationExpectation(input),
    callbackFreshnessExpectation(input),
    attestorTokenExpectation(input),
    screeningExpectation(input.screening),
    velocityLimitExpectation(input),
    keyPostureExpectation(input.keyPosture),
    callbackResponseExpectation(input.callback),
    postExecutionExpectation(input.postExecution),
  ]);
}
