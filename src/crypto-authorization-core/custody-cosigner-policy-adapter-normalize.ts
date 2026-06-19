import type { CryptoAuthorizationIntent } from './object-model.js';
import type {
  CreateCustodyCosignerPolicyPreflightInput,
  CustodyAccountEvidence,
  CustodyApprovalEvidence,
  CustodyCosignerCallbackEvidence,
  CustodyKeyPostureEvidence,
  CustodyPolicyConditionsEvidence,
  CustodyPolicyDecisionEvidence,
  CustodyPostExecutionEvidence,
  CustodyScreeningEvidence,
  CustodyTransactionEvidence,
} from './custody-cosigner-policy-adapter-types.js';

export function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`custody co-signer policy adapter ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

export function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return normalizeIdentifier(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`custody co-signer policy adapter ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `custody co-signer policy adapter ${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `custody co-signer policy adapter ${fieldName} must be a non-negative number.`,
    );
  }
  return value;
}

function normalizeStringArray(values: readonly string[], fieldName: string): readonly string[] {
  return Object.freeze(values.map((entry, index) => normalizeIdentifier(entry, `${fieldName}[${index}]`)));
}

function normalizeAtomicUnits(value: string, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^(0|[1-9][0-9]*)$/u.test(normalized)) {
    throw new Error(`custody co-signer policy adapter ${fieldName} must be unsigned atomic units.`);
  }
  return normalized;
}

export function parseAtomicUnits(value: string, fieldName: string): bigint {
  return BigInt(normalizeAtomicUnits(value, fieldName));
}

export function caip2ChainId(intent: CryptoAuthorizationIntent): string {
  return `${intent.chain.namespace}:${intent.chain.chainId}`;
}

export function canonicalAddress(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized.toLowerCase() : null;
}

export function sameIdentifier(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left?.trim() ?? '').toLowerCase() === (right?.trim() ?? '').toLowerCase();
}

export function includesString(values: readonly string[], candidate: string): boolean {
  return values.some((entry) => sameIdentifier(entry, candidate));
}

export function normalizeAccount(account: CustodyAccountEvidence): CustodyAccountEvidence {
  return Object.freeze({
    provider: normalizeIdentifier(account.provider, 'account.provider'),
    organizationId: normalizeIdentifier(account.organizationId, 'account.organizationId'),
    workspaceId: normalizeOptionalIdentifier(account.workspaceId, 'account.workspaceId'),
    vaultId: normalizeOptionalIdentifier(account.vaultId, 'account.vaultId'),
    walletId: normalizeOptionalIdentifier(account.walletId, 'account.walletId'),
    accountId: normalizeIdentifier(account.accountId, 'account.accountId'),
    accountRef: normalizeIdentifier(account.accountRef, 'account.accountRef'),
    chain: normalizeIdentifier(account.chain, 'account.chain'),
    asset: normalizeIdentifier(account.asset, 'account.asset'),
    sourceAddress: normalizeOptionalIdentifier(account.sourceAddress, 'account.sourceAddress'),
    policyEngineEnabled: account.policyEngineEnabled === true,
    custodyAccountKind: normalizeOptionalIdentifier(
      account.custodyAccountKind,
      'account.custodyAccountKind',
    ),
  });
}

export function normalizeTransaction(transaction: CustodyTransactionEvidence): CustodyTransactionEvidence {
  return Object.freeze({
    requestId: normalizeIdentifier(transaction.requestId, 'transaction.requestId'),
    idempotencyKey: normalizeIdentifier(transaction.idempotencyKey, 'transaction.idempotencyKey'),
    idempotencyFresh: transaction.idempotencyFresh === true,
    duplicateRequestDetected: transaction.duplicateRequestDetected === true,
    requestHash: normalizeOptionalIdentifier(transaction.requestHash, 'transaction.requestHash'),
    operation: normalizeIdentifier(transaction.operation, 'transaction.operation'),
    chain: normalizeIdentifier(transaction.chain, 'transaction.chain'),
    asset: normalizeIdentifier(transaction.asset, 'transaction.asset'),
    amount: normalizeAtomicUnits(transaction.amount, 'transaction.amount'),
    sourceAccountRef: normalizeIdentifier(transaction.sourceAccountRef, 'transaction.sourceAccountRef'),
    sourceAddress: normalizeOptionalIdentifier(transaction.sourceAddress, 'transaction.sourceAddress'),
    destinationAddress: normalizeIdentifier(
      transaction.destinationAddress,
      'transaction.destinationAddress',
    ),
    destinationRef: normalizeOptionalIdentifier(transaction.destinationRef, 'transaction.destinationRef'),
    destinationMemo: normalizeOptionalIdentifier(transaction.destinationMemo, 'transaction.destinationMemo'),
    targetId: normalizeOptionalIdentifier(transaction.targetId, 'transaction.targetId'),
    requestedAt: normalizeIsoTimestamp(transaction.requestedAt, 'transaction.requestedAt'),
    simulationPassed: transaction.simulationPassed === true,
  });
}

export function normalizeConditions(
  conditions: CustodyPolicyConditionsEvidence,
): CustodyPolicyConditionsEvidence {
  return Object.freeze({
    chainBound: conditions.chainBound === true,
    accountBound: conditions.accountBound === true,
    assetBound: conditions.assetBound === true,
    destinationBound: conditions.destinationBound === true,
    amountBound: conditions.amountBound === true,
    operationBound: conditions.operationBound === true,
    budgetBound: conditions.budgetBound === true,
    velocityBound: conditions.velocityBound === true,
    attestorReceiptRequired: conditions.attestorReceiptRequired === true,
    attestorReceiptMatched: conditions.attestorReceiptMatched === true,
  });
}

export function normalizePolicyDecision(
  decision: CustodyPolicyDecisionEvidence,
): CustodyPolicyDecisionEvidence {
  return Object.freeze({
    provider: normalizeIdentifier(decision.provider, 'policyDecision.provider'),
    decisionId: normalizeIdentifier(decision.decisionId, 'policyDecision.decisionId'),
    policyId: normalizeIdentifier(decision.policyId, 'policyDecision.policyId'),
    policyVersion: normalizeIdentifier(decision.policyVersion, 'policyDecision.policyVersion'),
    policyHash: normalizeIdentifier(decision.policyHash, 'policyDecision.policyHash'),
    activePolicyHash: normalizeOptionalIdentifier(
      decision.activePolicyHash,
      'policyDecision.activePolicyHash',
    ),
    ruleId: normalizeOptionalIdentifier(decision.ruleId, 'policyDecision.ruleId'),
    effect: normalizeIdentifier(decision.effect, 'policyDecision.effect'),
    status: normalizeIdentifier(decision.status, 'policyDecision.status'),
    matched: decision.matched === true,
    explicitDeny: decision.explicitDeny === true,
    implicitDeny: decision.implicitDeny === true,
    evaluatedAt: normalizeIsoTimestamp(decision.evaluatedAt, 'policyDecision.evaluatedAt'),
    environment: normalizeIdentifier(decision.environment, 'policyDecision.environment'),
    tenantId: normalizeIdentifier(decision.tenantId, 'policyDecision.tenantId'),
    policyActivated: decision.policyActivated === true,
    conditions: normalizeConditions(decision.conditions),
  });
}

export function normalizeApprovals(approvals: CustodyApprovalEvidence): CustodyApprovalEvidence {
  return Object.freeze({
    requiredApprovals: normalizeNonNegativeInteger(
      approvals.requiredApprovals,
      'approvals.requiredApprovals',
    ),
    collectedApprovals: normalizeNonNegativeInteger(
      approvals.collectedApprovals,
      'approvals.collectedApprovals',
    ),
    quorumSatisfied: approvals.quorumSatisfied === true,
    approverIds: normalizeStringArray(approvals.approverIds, 'approvals.approverIds'),
    requiredRoles: normalizeStringArray(approvals.requiredRoles, 'approvals.requiredRoles'),
    collectedRoles: normalizeStringArray(approvals.collectedRoles, 'approvals.collectedRoles'),
    requesterId: normalizeIdentifier(approvals.requesterId, 'approvals.requesterId'),
    requesterApproved: approvals.requesterApproved === true,
    dutySeparationSatisfied: approvals.dutySeparationSatisfied === true,
    policyAdminApprovedOwnChange: approvals.policyAdminApprovedOwnChange === true,
    breakGlassUsed: approvals.breakGlassUsed === true,
    breakGlassAuthorized: approvals.breakGlassAuthorized === true,
  });
}

export function normalizeCallback(callback: CustodyCosignerCallbackEvidence): CustodyCosignerCallbackEvidence {
  return Object.freeze({
    callbackId: normalizeIdentifier(callback.callbackId, 'callback.callbackId'),
    configured: callback.configured === true,
    authenticated: callback.authenticated === true,
    authMethod: normalizeIdentifier(callback.authMethod, 'callback.authMethod'),
    signatureValid: callback.signatureValid === true,
    tlsPinned: callback.tlsPinned === true,
    senderConstrained: callback.senderConstrained === true,
    sourceIpAllowlisted: callback.sourceIpAllowlisted === true,
    timestamp: normalizeIsoTimestamp(callback.timestamp, 'callback.timestamp'),
    nonce: normalizeIdentifier(callback.nonce, 'callback.nonce'),
    nonceFresh: callback.nonceFresh === true,
    bodyHash: normalizeOptionalIdentifier(callback.bodyHash, 'callback.bodyHash'),
    bodyHashMatches: callback.bodyHashMatches === true,
    responseAction: normalizeIdentifier(callback.responseAction, 'callback.responseAction'),
    responseSigned: callback.responseSigned === true,
    responseWithinSeconds: normalizeNonNegativeNumber(
      callback.responseWithinSeconds,
      'callback.responseWithinSeconds',
    ),
    attestorReleaseTokenVerified: callback.attestorReleaseTokenVerified === true,
  });
}

export function normalizeScreening(screening: CustodyScreeningEvidence): CustodyScreeningEvidence {
  return Object.freeze({
    destinationAllowlisted: screening.destinationAllowlisted === true,
    counterpartyKnown: screening.counterpartyKnown === true,
    sanctionsScreened: screening.sanctionsScreened === true,
    sanctionsHit: screening.sanctionsHit === true,
    riskScore: normalizeNonNegativeNumber(screening.riskScore, 'screening.riskScore'),
    riskScoreMax: normalizeNonNegativeNumber(screening.riskScoreMax, 'screening.riskScoreMax'),
    riskTierAllowed: screening.riskTierAllowed === true,
    travelRuleRequired: screening.travelRuleRequired === true,
    travelRuleCompleted: screening.travelRuleCompleted === true,
    velocityLimitChecked: screening.velocityLimitChecked === true,
    velocityLimitRemainingAtomic: normalizeAtomicUnits(
      screening.velocityLimitRemainingAtomic,
      'screening.velocityLimitRemainingAtomic',
    ),
    maxAmountAtomic: normalizeAtomicUnits(screening.maxAmountAtomic, 'screening.maxAmountAtomic'),
  });
}

export function normalizeKeyPosture(posture: CustodyKeyPostureEvidence): CustodyKeyPostureEvidence {
  return Object.freeze({
    keyId: normalizeIdentifier(posture.keyId, 'keyPosture.keyId'),
    keyType: normalizeIdentifier(posture.keyType, 'keyPosture.keyType'),
    cosignerId: normalizeIdentifier(posture.cosignerId, 'keyPosture.cosignerId'),
    cosignerPaired: posture.cosignerPaired === true,
    cosignerHealthy: posture.cosignerHealthy === true,
    enclaveBacked: posture.enclaveBacked === true,
    keyShareHealthy: posture.keyShareHealthy === true,
    signingPolicyBound: posture.signingPolicyBound === true,
    keyExportable: posture.keyExportable === true,
    signerRoleBound: posture.signerRoleBound === true,
    haSignerAvailable: posture.haSignerAvailable === true,
    recoveryReady: posture.recoveryReady === true,
  });
}

export function normalizePostExecution(postExecution: CustodyPostExecutionEvidence): CustodyPostExecutionEvidence {
  return Object.freeze({
    activityId: normalizeOptionalIdentifier(postExecution.activityId, 'postExecution.activityId'),
    status: normalizeIdentifier(postExecution.status, 'postExecution.status'),
    signatureHash: normalizeOptionalIdentifier(postExecution.signatureHash, 'postExecution.signatureHash'),
    transactionHash: normalizeOptionalIdentifier(
      postExecution.transactionHash,
      'postExecution.transactionHash',
    ),
    providerStatus: normalizeOptionalIdentifier(postExecution.providerStatus, 'postExecution.providerStatus'),
    failureReason: normalizeOptionalIdentifier(postExecution.failureReason, 'postExecution.failureReason'),
  });
}

export function assertAdapterConsistency(input: CreateCustodyCosignerPolicyPreflightInput): void {
  if (input.intent.executionAdapterKind !== 'custody-cosigner') {
    throw new Error(
      'custody co-signer policy adapter requires intent execution adapter custody-cosigner.',
    );
  }
  if (input.intent.consequenceKind !== 'custody-withdrawal') {
    throw new Error(
      'custody co-signer policy adapter requires custody-withdrawal intent consequence.',
    );
  }
  if (input.intent.account.accountKind !== 'custody-account') {
    throw new Error('custody co-signer policy adapter requires a custody account intent.');
  }
  if (input.riskAssessment.consequenceKind !== input.intent.consequenceKind) {
    throw new Error('custody co-signer policy adapter risk consequence does not match intent.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.policyScopeBinding.cryptoDecisionId) {
    throw new Error('custody co-signer policy adapter policy binding does not match release binding.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.enforcementBinding.cryptoDecisionId) {
    throw new Error(
      'custody co-signer policy adapter enforcement binding does not match release binding.',
    );
  }
  if (input.enforcementBinding.adapterKind !== 'custody-cosigner') {
    throw new Error(
      'custody co-signer policy adapter requires custody-cosigner enforcement binding.',
    );
  }
  if (input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind !== 'action-dispatch') {
    throw new Error('custody co-signer policy adapter requires action-dispatch enforcement.');
  }
  if (!input.enforcementBinding.verificationProfile.failClosed) {
    throw new Error(
      'custody co-signer policy adapter requires fail-closed enforcement verification.',
    );
  }
}
