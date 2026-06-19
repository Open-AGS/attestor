import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CustodyAccountEvidence,
  CustodyApprovalEvidence,
  CustodyCosignerCallbackEvidence,
  CustodyCosignerCheck,
  CustodyCosignerObservation,
  CustodyKeyPostureEvidence,
  CustodyObservationStatus,
  CustodyPolicyDecisionEvidence,
  CustodyPostExecutionEvidence,
  CustodyScreeningEvidence,
  CustodyTransactionEvidence,
} from './custody-cosigner-policy-adapter-types.js';
import {
  caip2ChainId,
  canonicalAddress,
  normalizeIdentifier,
  parseAtomicUnits,
  sameIdentifier,
} from './custody-cosigner-policy-adapter-normalize.js';
import {
  callbackAuthenticated,
  callbackFresh,
  collectedRequiredRoles,
  enforcementReady,
  keyPostureReady,
  policyBindingReady,
  policyConditionsReady,
  policyDecisionAllows,
  policyDecisionPending,
  postExecutionReady,
  releaseReady,
  responseAllows,
  responseNeedsReview,
  screeningReady,
  velocityReady,
} from './custody-cosigner-policy-adapter-readiness.js';

function observation(input: {
  readonly check: CustodyCosignerCheck;
  readonly status: CustodyObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): CustodyCosignerObservation {
  return Object.freeze({
    check: input.check,
    status: input.status,
    code: normalizeIdentifier(input.code, 'observation.code'),
    message: normalizeIdentifier(input.message, 'observation.message'),
    required: input.required ?? true,
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

export function buildObservations(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly approvals: CustodyApprovalEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly screening: CustodyScreeningEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly postExecution: CustodyPostExecutionEvidence;
}): readonly CustodyCosignerObservation[] {
  const observations: CustodyCosignerObservation[] = [];
  const intentChainId = caip2ChainId(input.intent);
  const intentAsset = input.intent.asset?.assetId ?? null;
  const targetAddress = input.intent.target.address ?? input.intent.target.counterparty;
  const sourceAddressReady =
    !input.account.sourceAddress ||
    !input.transaction.sourceAddress ||
    sameIdentifier(input.account.sourceAddress, input.transaction.sourceAddress);
  const providerMatches = sameIdentifier(input.account.provider, input.policyDecision.provider);
  const accountReady =
    input.intent.account.accountKind === 'custody-account' &&
    input.account.chain === intentChainId &&
    sameIdentifier(input.account.asset, intentAsset) &&
    sameIdentifier(input.account.accountRef, input.transaction.sourceAccountRef) &&
    sourceAddressReady;
  const transactionBound =
    input.transaction.chain === intentChainId &&
    sameIdentifier(input.transaction.asset, intentAsset) &&
    input.transaction.simulationPassed;
  const destinationBound =
    sameIdentifier(input.transaction.destinationAddress, targetAddress) &&
    (!input.transaction.targetId || sameIdentifier(input.transaction.targetId, input.intent.target.targetId));
  const amountBound =
    input.intent.constraints.maxAmount === null ||
    parseAtomicUnits(input.transaction.amount, 'transaction.amount') <=
      parseAtomicUnits(input.intent.constraints.maxAmount, 'intent.constraints.maxAmount');
  const replayReady =
    input.transaction.idempotencyFresh && !input.transaction.duplicateRequestDetected;
  const policyActive =
    input.policyDecision.policyActivated &&
    (input.policyDecision.activePolicyHash === null ||
      input.policyDecision.activePolicyHash === input.policyDecision.policyHash);
  const quorumReady =
    input.approvals.quorumSatisfied &&
    input.approvals.collectedApprovals >= input.approvals.requiredApprovals &&
    input.approvals.approverIds.length >= input.approvals.requiredApprovals &&
    collectedRequiredRoles(input.approvals);
  const dutySeparationReady =
    input.approvals.dutySeparationSatisfied &&
    !input.approvals.requesterApproved &&
    !input.approvals.policyAdminApprovedOwnChange;
  const breakGlassReady =
    !input.approvals.breakGlassUsed || input.approvals.breakGlassAuthorized;
  const screeningIsReady = screeningReady(input.screening);
  const velocityIsReady = velocityReady({
    screening: input.screening,
    transaction: input.transaction,
    intent: input.intent,
  });

  observations.push(
    observation({
      check: 'custody-adapter-kind',
      status: input.intent.executionAdapterKind === 'custody-cosigner' ? 'pass' : 'fail',
      code:
        input.intent.executionAdapterKind === 'custody-cosigner'
          ? 'custody-adapter-kind-ready'
          : 'custody-adapter-kind-mismatch',
      message: 'Custody policy evidence is bound to the custody co-signer adapter.',
      evidence: {
        adapterKind: input.intent.executionAdapterKind ?? null,
      },
    }),
    observation({
      check: 'custody-withdrawal-intent',
      status:
        input.intent.consequenceKind === 'custody-withdrawal' &&
        input.intent.account.accountKind === 'custody-account'
          ? 'pass'
          : 'fail',
      code:
        input.intent.consequenceKind === 'custody-withdrawal' &&
        input.intent.account.accountKind === 'custody-account'
          ? 'custody-withdrawal-intent-ready'
          : 'custody-withdrawal-intent-invalid',
      message: 'Intent is a custody-account withdrawal consequence.',
      evidence: {
        consequenceKind: input.intent.consequenceKind,
        accountKind: input.intent.account.accountKind,
      },
    }),
    observation({
      check: 'custody-account-bound',
      status: accountReady && providerMatches ? 'pass' : 'fail',
      code: accountReady && providerMatches
        ? 'custody-account-bound'
        : 'custody-account-binding-mismatch',
      message: 'Custody account, provider, chain, asset, and source references match the intent.',
      evidence: {
        provider: input.account.provider,
        policyProvider: input.policyDecision.provider,
        accountRef: input.account.accountRef,
        chain: input.account.chain,
        asset: input.account.asset,
        sourceAddress: input.account.sourceAddress ?? null,
      },
    }),
    observation({
      check: 'custody-transaction-request-bound',
      status: input.transaction.simulationPassed ? 'pass' : 'fail',
      code: input.transaction.simulationPassed
        ? 'custody-transaction-request-ready'
        : 'custody-transaction-simulation-failed',
      message: 'Custody transaction request has a provider request id, hash, and simulation result.',
      evidence: {
        requestId: input.transaction.requestId,
        requestHash: input.transaction.requestHash ?? null,
        operation: input.transaction.operation,
        requestedAt: input.transaction.requestedAt,
      },
    }),
    observation({
      check: 'custody-chain-asset-amount-bound',
      status: transactionBound && amountBound ? 'pass' : 'fail',
      code: transactionBound && amountBound
        ? 'custody-chain-asset-amount-bound'
        : 'custody-chain-asset-amount-mismatch',
      message: 'Custody request chain, asset, and amount stay inside the Attestor intent.',
      evidence: {
        intentChainId,
        transactionChain: input.transaction.chain,
        intentAsset,
        transactionAsset: input.transaction.asset,
        amount: input.transaction.amount,
        maxAmount: input.intent.constraints.maxAmount,
      },
    }),
    observation({
      check: 'custody-destination-bound',
      status: destinationBound ? 'pass' : 'fail',
      code: destinationBound
        ? 'custody-destination-bound'
        : 'custody-destination-mismatch',
      message: 'Custody destination address and target bind to the intended counterparty.',
      evidence: {
        targetAddress: targetAddress ?? null,
        destinationAddress: canonicalAddress(input.transaction.destinationAddress),
        destinationRef: input.transaction.destinationRef ?? null,
        targetId: input.transaction.targetId ?? null,
      },
    }),
    observation({
      check: 'custody-idempotency-replay',
      status: replayReady ? 'pass' : 'fail',
      code: replayReady
        ? 'custody-idempotency-fresh'
        : 'custody-idempotency-replay-risk',
      message: 'Custody request idempotency key is fresh and no duplicate provider request is known.',
      evidence: {
        idempotencyKey: input.transaction.idempotencyKey,
        idempotencyFresh: input.transaction.idempotencyFresh,
        duplicateRequestDetected: input.transaction.duplicateRequestDetected,
      },
    }),
    observation({
      check: 'custody-policy-engine-enabled',
      status: input.account.policyEngineEnabled ? 'pass' : 'fail',
      code: input.account.policyEngineEnabled
        ? 'custody-policy-engine-enabled'
        : 'custody-policy-engine-disabled',
      message: 'Custody platform policy engine is enabled for the source account.',
      evidence: {
        provider: input.account.provider,
        accountRef: input.account.accountRef,
      },
    }),
  );

  if (policyDecisionAllows(input.policyDecision)) {
    observations.push(
      observation({
        check: 'custody-policy-explicit-decision',
        status: 'pass',
        code: 'custody-policy-explicit-allow',
        message: 'Custody policy engine produced an explicit allow decision.',
        evidence: {
          decisionId: input.policyDecision.decisionId,
          policyId: input.policyDecision.policyId,
          ruleId: input.policyDecision.ruleId ?? null,
          effect: input.policyDecision.effect,
          status: input.policyDecision.status,
        },
      }),
    );
  } else if (policyDecisionPending(input.policyDecision)) {
    observations.push(
      observation({
        check: 'custody-policy-explicit-decision',
        status: 'warn',
        code: 'custody-policy-decision-pending-review',
        message: 'Custody policy engine has not produced a final explicit allow decision yet.',
        evidence: {
          decisionId: input.policyDecision.decisionId,
          effect: input.policyDecision.effect,
          status: input.policyDecision.status,
        },
      }),
    );
  } else {
    observations.push(
      observation({
        check: 'custody-policy-explicit-decision',
        status: 'fail',
        code: input.policyDecision.explicitDeny || input.policyDecision.status === 'denied'
          ? 'custody-policy-explicit-deny'
          : 'custody-policy-decision-not-allow',
        message: 'Custody policy engine did not produce an explicit allow decision.',
        evidence: {
          decisionId: input.policyDecision.decisionId,
          effect: input.policyDecision.effect,
          status: input.policyDecision.status,
          explicitDeny: input.policyDecision.explicitDeny,
        },
      }),
    );
  }

  observations.push(
    observation({
      check: 'custody-policy-implicit-deny',
      status:
        input.policyDecision.matched &&
        !input.policyDecision.implicitDeny &&
        !input.policyDecision.explicitDeny
          ? 'pass'
          : 'fail',
      code:
        input.policyDecision.matched &&
        !input.policyDecision.implicitDeny &&
        !input.policyDecision.explicitDeny
          ? 'custody-policy-no-implicit-deny'
          : 'custody-policy-implicit-deny',
      message: 'Custody policy must match a rule explicitly and must not fall through implicit deny.',
      evidence: {
        matched: input.policyDecision.matched,
        explicitDeny: input.policyDecision.explicitDeny,
        implicitDeny: input.policyDecision.implicitDeny,
      },
    }),
    observation({
      check: 'custody-policy-scope-bound',
      status: policyConditionsReady(input.policyDecision.conditions) ? 'pass' : 'fail',
      code: policyConditionsReady(input.policyDecision.conditions)
        ? 'custody-policy-scope-bound'
        : 'custody-policy-scope-incomplete',
      message: 'Custody policy conditions bind chain, account, asset, destination, amount, operation, budget, velocity, and Attestor receipt.',
      evidence: {
        chainBound: input.policyDecision.conditions.chainBound,
        accountBound: input.policyDecision.conditions.accountBound,
        assetBound: input.policyDecision.conditions.assetBound,
        destinationBound: input.policyDecision.conditions.destinationBound,
        amountBound: input.policyDecision.conditions.amountBound,
        operationBound: input.policyDecision.conditions.operationBound,
        budgetBound: input.policyDecision.conditions.budgetBound,
        velocityBound: input.policyDecision.conditions.velocityBound,
        attestorReceiptRequired: input.policyDecision.conditions.attestorReceiptRequired,
        attestorReceiptMatched: input.policyDecision.conditions.attestorReceiptMatched,
      },
    }),
    observation({
      check: 'custody-policy-version-active',
      status: policyActive ? 'pass' : 'fail',
      code: policyActive
        ? 'custody-policy-version-active'
        : 'custody-policy-version-inactive',
      message: 'Custody policy decision came from the active policy version and hash.',
      evidence: {
        policyId: input.policyDecision.policyId,
        policyVersion: input.policyDecision.policyVersion,
        policyHash: input.policyDecision.policyHash,
        activePolicyHash: input.policyDecision.activePolicyHash ?? null,
        evaluatedAt: input.policyDecision.evaluatedAt,
      },
    }),
    observation({
      check: 'custody-approval-quorum',
      status: quorumReady ? 'pass' : 'fail',
      code: quorumReady
        ? 'custody-approval-quorum-satisfied'
        : 'custody-approval-quorum-pending',
      message: 'Custody approval quorum and required roles are satisfied before co-signing.',
      evidence: {
        requiredApprovals: input.approvals.requiredApprovals,
        collectedApprovals: input.approvals.collectedApprovals,
        requiredRoles: input.approvals.requiredRoles,
        collectedRoles: input.approvals.collectedRoles,
      },
    }),
    observation({
      check: 'custody-duty-separation',
      status: dutySeparationReady ? 'pass' : 'fail',
      code: dutySeparationReady
        ? 'custody-duty-separation-satisfied'
        : 'custody-duty-separation-violated',
      message: 'Requester, approver, and policy-admin roles remain separated.',
      evidence: {
        requesterId: input.approvals.requesterId,
        requesterApproved: input.approvals.requesterApproved,
        policyAdminApprovedOwnChange: input.approvals.policyAdminApprovedOwnChange,
        dutySeparationSatisfied: input.approvals.dutySeparationSatisfied,
      },
    }),
    observation({
      check: 'custody-break-glass-control',
      status: breakGlassReady
        ? input.approvals.breakGlassUsed
          ? 'warn'
          : 'pass'
        : 'fail',
      code: breakGlassReady
        ? input.approvals.breakGlassUsed
          ? 'custody-break-glass-authorized-review'
          : 'custody-break-glass-not-used'
        : 'custody-break-glass-unauthorized',
      message: 'Break-glass custody approval is either unused or explicitly authorized.',
      evidence: {
        breakGlassUsed: input.approvals.breakGlassUsed,
        breakGlassAuthorized: input.approvals.breakGlassAuthorized,
      },
    }),
    observation({
      check: 'custody-cosigner-callback-configured',
      status: input.callback.configured ? 'pass' : 'fail',
      code: input.callback.configured
        ? 'custody-cosigner-callback-configured'
        : 'custody-cosigner-callback-missing',
      message: 'Custody co-signer callback is configured as the authorization chokepoint.',
      evidence: {
        callbackId: input.callback.callbackId,
        authMethod: input.callback.authMethod,
      },
    }),
    observation({
      check: 'custody-cosigner-callback-authenticated',
      status: callbackAuthenticated(input.callback) ? 'pass' : 'fail',
      code: callbackAuthenticated(input.callback)
        ? 'custody-cosigner-callback-authenticated'
        : 'custody-cosigner-callback-authentication-failed',
      message: 'Co-signer callback is authenticated, signed, sender-constrained, TLS-pinned, and source constrained.',
      evidence: {
        authenticated: input.callback.authenticated,
        signatureValid: input.callback.signatureValid,
        tlsPinned: input.callback.tlsPinned,
        senderConstrained: input.callback.senderConstrained,
        sourceIpAllowlisted: input.callback.sourceIpAllowlisted,
      },
    }),
    observation({
      check: 'custody-cosigner-callback-fresh',
      status: callbackFresh(input.callback) ? 'pass' : 'fail',
      code: callbackFresh(input.callback)
        ? 'custody-cosigner-callback-fresh'
        : 'custody-cosigner-callback-replay-risk',
      message: 'Co-signer callback nonce, body hash, and response latency are fresh.',
      evidence: {
        timestamp: input.callback.timestamp,
        nonce: input.callback.nonce,
        nonceFresh: input.callback.nonceFresh,
        bodyHash: input.callback.bodyHash ?? null,
        bodyHashMatches: input.callback.bodyHashMatches,
        responseWithinSeconds: input.callback.responseWithinSeconds,
      },
    }),
  );

  if (responseAllows(input.callback)) {
    observations.push(
      observation({
        check: 'custody-cosigner-response-bound',
        status: 'pass',
        code: 'custody-cosigner-response-approved',
        message: 'Co-signer response approves the request and verifies the Attestor release token.',
        evidence: {
          responseAction: input.callback.responseAction,
          responseSigned: input.callback.responseSigned,
          attestorReleaseTokenVerified: input.callback.attestorReleaseTokenVerified,
        },
      }),
    );
  } else if (responseNeedsReview(input.callback)) {
    observations.push(
      observation({
        check: 'custody-cosigner-response-bound',
        status: 'warn',
        code: 'custody-cosigner-response-review-required',
        message: 'Co-signer response needs reviewer evidence before signing can proceed.',
        evidence: {
          responseAction: input.callback.responseAction,
          responseSigned: input.callback.responseSigned,
          attestorReleaseTokenVerified: input.callback.attestorReleaseTokenVerified,
        },
      }),
    );
  } else {
    observations.push(
      observation({
        check: 'custody-cosigner-response-bound',
        status: 'fail',
        code: 'custody-cosigner-response-rejected',
        message: 'Co-signer response did not approve the Attestor-bound custody request.',
        evidence: {
          responseAction: input.callback.responseAction,
          responseSigned: input.callback.responseSigned,
          attestorReleaseTokenVerified: input.callback.attestorReleaseTokenVerified,
        },
      }),
    );
  }

  observations.push(
    observation({
      check: 'custody-screening-risk',
      status: screeningIsReady ? 'pass' : 'fail',
      code: screeningIsReady
        ? 'custody-screening-risk-ready'
        : 'custody-screening-risk-blocked',
      message: 'Destination allowlist, counterparty, sanctions, risk-tier, and travel-rule screening are ready.',
      evidence: {
        destinationAllowlisted: input.screening.destinationAllowlisted,
        counterpartyKnown: input.screening.counterpartyKnown,
        sanctionsScreened: input.screening.sanctionsScreened,
        sanctionsHit: input.screening.sanctionsHit,
        riskScore: input.screening.riskScore,
        riskScoreMax: input.screening.riskScoreMax,
        riskTierAllowed: input.screening.riskTierAllowed,
        travelRuleRequired: input.screening.travelRuleRequired,
        travelRuleCompleted: input.screening.travelRuleCompleted,
      },
    }),
    observation({
      check: 'custody-velocity-and-limit',
      status: velocityIsReady ? 'pass' : 'fail',
      code: velocityIsReady
        ? 'custody-velocity-and-limit-ready'
        : 'custody-velocity-or-limit-exceeded',
      message: 'Custody amount stays within Attestor, policy, and velocity limits.',
      evidence: {
        amount: input.transaction.amount,
        maxAmountAtomic: input.screening.maxAmountAtomic,
        velocityLimitRemainingAtomic: input.screening.velocityLimitRemainingAtomic,
        intentMaxAmount: input.intent.constraints.maxAmount,
      },
    }),
    observation({
      check: 'custody-key-posture',
      status: keyPostureReady(input.keyPosture) ? 'pass' : 'fail',
      code: keyPostureReady(input.keyPosture)
        ? 'custody-key-posture-ready'
        : 'custody-key-posture-unsafe',
      message: 'Custody signing key, co-signer, key-share, signer role, HA, and recovery posture are ready.',
      evidence: {
        keyId: input.keyPosture.keyId,
        keyType: input.keyPosture.keyType,
        cosignerId: input.keyPosture.cosignerId,
        cosignerPaired: input.keyPosture.cosignerPaired,
        cosignerHealthy: input.keyPosture.cosignerHealthy,
        enclaveBacked: input.keyPosture.enclaveBacked,
        keyShareHealthy: input.keyPosture.keyShareHealthy,
        signingPolicyBound: input.keyPosture.signingPolicyBound,
        keyExportable: input.keyPosture.keyExportable,
        signerRoleBound: input.keyPosture.signerRoleBound,
        haSignerAvailable: input.keyPosture.haSignerAvailable,
        recoveryReady: input.keyPosture.recoveryReady,
      },
    }),
    observation({
      check: 'custody-release-binding-ready',
      status: releaseReady(input.releaseBinding) ? 'pass' : 'fail',
      code: releaseReady(input.releaseBinding)
        ? 'custody-release-binding-ready'
        : 'custody-release-binding-blocked',
      message: 'Attestor release binding is accepted and token-eligible before custody signing.',
      evidence: {
        releaseDecisionId: input.releaseBinding.releaseDecisionId,
        releaseStatus: input.releaseBinding.releaseDecision.status,
        bindingStatus: input.releaseBinding.status,
      },
    }),
    observation({
      check: 'custody-policy-binding-ready',
      status: policyBindingReady(input.policyScopeBinding) ? 'pass' : 'fail',
      code: policyBindingReady(input.policyScopeBinding)
        ? 'custody-policy-binding-ready'
        : 'custody-policy-binding-blocked',
      message: 'Attestor policy-control-plane activation and bundle references are bound.',
      evidence: {
        activationId: input.policyScopeBinding.activationId,
        bundleId: input.policyScopeBinding.bundleId,
        policyPackId: input.policyScopeBinding.policyPackId,
        activationStatus: input.policyScopeBinding.activationRecord.state,
      },
    }),
    observation({
      check: 'custody-enforcement-binding-ready',
      status: enforcementReady(input.enforcementBinding) ? 'pass' : 'fail',
      code: enforcementReady(input.enforcementBinding)
        ? 'custody-enforcement-binding-ready'
        : 'custody-enforcement-binding-blocked',
      message: 'Attestor enforcement binding is fail-closed at the custody action-dispatch boundary.',
      evidence: {
        adapterKind: input.enforcementBinding.adapterKind ?? null,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
        profileId: input.enforcementBinding.verificationProfile.id,
        failClosed: input.enforcementBinding.verificationProfile.failClosed,
      },
    }),
    observation({
      check: 'custody-post-execution-status',
      status: postExecutionReady(input.postExecution) ? 'pass' : 'fail',
      code: postExecutionReady(input.postExecution)
        ? 'custody-post-execution-status-ready'
        : 'custody-post-execution-status-failed',
      message: 'Custody provider activity has no failed or cancelled terminal status.',
      evidence: {
        activityId: input.postExecution.activityId ?? null,
        status: input.postExecution.status,
        providerStatus: input.postExecution.providerStatus ?? null,
        transactionHash: input.postExecution.transactionHash ?? null,
        failureReason: input.postExecution.failureReason ?? null,
      },
    }),
  );

  return Object.freeze(observations);
}
