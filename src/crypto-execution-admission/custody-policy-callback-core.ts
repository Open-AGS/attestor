import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
  type CreateCustodyPolicyAdmissionCallbackContractInput,
  type CustodyPolicyAdmissionCallbackContract,
  type CustodyPolicyAdmissionProviderResponse,
} from './custody-policy-callback-types.js';
import {
  actionFor,
  blockingReasonsFor,
  contractIdFor,
  nextActionsFor,
  normalizedCallbackActionFor,
  outcomeFor,
} from './custody-policy-callback-decision.js';
import {
  expectationsFor,
} from './custody-policy-callback-expectations.js';
import {
  canonicalObject,
  normalizeAtomicUnits,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
  normalizeOptionalUrl,
  protocolFor,
  providerProfileFor,
  signedResponseRequired,
} from './custody-policy-callback-utils.js';

export function createCustodyPolicyAdmissionCallbackContract(
  input: CreateCustodyPolicyAdmissionCallbackContractInput,
): CustodyPolicyAdmissionCallbackContract {
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const provider = normalizeIdentifier(input.account.provider, 'account.provider');
  const profile = providerProfileFor(provider);
  const protocol = protocolFor(input.callback.authMethod);
  const expectations = expectationsFor({
    ...input,
    profile,
    protocol,
  });
  const blockingReasons = blockingReasonsFor({
    plan: input.plan,
    preflight: input.preflight,
    expectations,
  });
  const outcome = outcomeFor({
    plan: input.plan,
    preflight: input.preflight,
    expectations,
    blockingReasons,
  });
  const action = actionFor(outcome);
  const contractId =
    normalizeOptionalIdentifier(input.contractId, 'contractId') ??
    contractIdFor({
      plan: input.plan,
      preflight: input.preflight,
      callback: input.callback,
      createdAt,
    });
  const callbackUrl = normalizeOptionalUrl(input.callbackUrl, 'callbackUrl');
  const providerResponse: CustodyPolicyAdmissionProviderResponse = Object.freeze({
    integrationMode: profile.integrationMode,
    protocol,
    responseDeadlineSeconds: profile.responseDeadlineSeconds,
    authenticatedChannelRequired: true,
    signedResponseRequired: signedResponseRequired(protocol),
    failClosed: true,
    observedCallbackAction: input.callback.responseAction,
    normalizedCallbackAction: normalizedCallbackActionFor(action),
  });
  const approvalQuorum = `${input.approvals.collectedApprovals}/${input.approvals.requiredApprovals}`;
  const attestorSidecar = Object.freeze({
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    releaseBindingDigest: input.preflight.releaseBindingDigest,
    policyScopeDigest: input.preflight.policyScopeDigest,
    enforcementBindingDigest: input.preflight.enforcementBindingDigest,
    provider,
    requestId: input.transaction.requestId,
    policyDecisionId: input.policyDecision.decisionId,
    callbackId: input.callback.callbackId,
    callbackNonce: input.callback.nonce,
    outcome,
    action,
  });
  const canonicalPayload = {
    version: CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
    contractId,
    createdAt,
    provider,
    integrationMode: profile.integrationMode,
    protocol,
    outcome,
    action,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    simulationId: input.plan.simulationId,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    organizationId: normalizeIdentifier(input.account.organizationId, 'account.organizationId'),
    accountRef: normalizeIdentifier(input.account.accountRef, 'account.accountRef'),
    requestId: normalizeIdentifier(input.transaction.requestId, 'transaction.requestId'),
    idempotencyKey: normalizeIdentifier(
      input.transaction.idempotencyKey,
      'transaction.idempotencyKey',
    ),
    chain: normalizeIdentifier(input.transaction.chain, 'transaction.chain'),
    asset: normalizeIdentifier(input.transaction.asset, 'transaction.asset'),
    amount: normalizeAtomicUnits(input.transaction.amount, 'transaction.amount'),
    sourceAddress: normalizeOptionalIdentifier(
      input.transaction.sourceAddress,
      'transaction.sourceAddress',
    ),
    destinationAddress: normalizeIdentifier(
      input.transaction.destinationAddress,
      'transaction.destinationAddress',
    ),
    policyId: normalizeIdentifier(input.policyDecision.policyId, 'policyDecision.policyId'),
    policyVersion: normalizeIdentifier(
      input.policyDecision.policyVersion,
      'policyDecision.policyVersion',
    ),
    policyDecisionId: normalizeIdentifier(
      input.policyDecision.decisionId,
      'policyDecision.decisionId',
    ),
    approvalQuorum,
    keyId: normalizeIdentifier(input.keyPosture.keyId, 'keyPosture.keyId'),
    callbackId: normalizeIdentifier(input.callback.callbackId, 'callback.callbackId'),
    callbackUrl,
    providerResponse,
    attestorSidecar,
    expectations,
    blockingReasons,
    nextActions: nextActionsFor({ outcome, action }),
    operatorNote: normalizeOptionalIdentifier(input.operatorNote, 'operatorNote'),
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function custodyPolicyAdmissionCallbackLabel(
  contract: CustodyPolicyAdmissionCallbackContract,
): string {
  return [
    `custody-callback:${contract.provider}`,
    `request:${contract.requestId}`,
    `policy:${contract.policyDecisionId}`,
    `outcome:${contract.outcome}`,
  ].join(' / ');
}
