import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createCryptoAuthorizationSimulation,
} from './authorization-simulation.js';
import {
  CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  type CreateCustodyCosignerPolicyPreflightInput,
  type CustodyAccountEvidence,
  type CustodyCosignerCallbackEvidence,
  type CustodyCosignerPolicyPreflight,
  type CustodyCosignerPolicySimulationResult,
  type CustodyKeyPostureEvidence,
  type CustodyPolicyDecisionEvidence,
  type CustodyTransactionEvidence,
} from './custody-cosigner-policy-adapter-types.js';
import {
  assertAdapterConsistency,
  normalizeAccount,
  normalizeApprovals,
  normalizeCallback,
  normalizeKeyPosture,
  normalizeOptionalIdentifier,
  normalizePolicyDecision,
  normalizePostExecution,
  normalizeScreening,
  normalizeTransaction,
} from './custody-cosigner-policy-adapter-normalize.js';
import { buildObservations } from './custody-cosigner-policy-adapter-observations.js';
import {
  outcomeFromObservations,
  signalFor,
} from './custody-cosigner-policy-adapter-signal.js';

export * from './custody-cosigner-policy-adapter-types.js';
export { custodyCosignerPolicyAdapterDescriptor } from './custody-cosigner-policy-adapter-descriptor.js';

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: 'sha256:' + createHash('sha256').update(canonical).digest('hex'),
  });
}

function preflightIdFor(input: {
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
    provider: input.account.provider,
    organizationId: input.account.organizationId,
    accountRef: input.account.accountRef,
    requestId: input.transaction.requestId,
    idempotencyKey: input.transaction.idempotencyKey,
    requestHash: input.transaction.requestHash ?? null,
    chain: input.transaction.chain,
    asset: input.transaction.asset,
    amount: input.transaction.amount,
    destinationAddress: input.transaction.destinationAddress,
    policyDecisionId: input.policyDecision.decisionId,
    policyHash: input.policyDecision.policyHash,
    callbackId: input.callback.callbackId,
    nonce: input.callback.nonce,
    keyId: input.keyPosture.keyId,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function createCustodyCosignerPolicyPreflight(
  input: CreateCustodyCosignerPolicyPreflightInput,
): CustodyCosignerPolicyPreflight {
  assertAdapterConsistency(input);
  const account = normalizeAccount(input.account);
  const transaction = normalizeTransaction(input.transaction);
  const policyDecision = normalizePolicyDecision(input.policyDecision);
  const approvals = normalizeApprovals(input.approvals);
  const callback = normalizeCallback(input.callback);
  const screening = normalizeScreening(input.screening);
  const keyPosture = normalizeKeyPosture(input.keyPosture);
  const postExecution = normalizePostExecution(input.postExecution);
  const observations = buildObservations({
    intent: input.intent,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    account,
    transaction,
    policyDecision,
    approvals,
    callback,
    screening,
    keyPosture,
    postExecution,
  });
  const outcome = outcomeFromObservations(observations);
  const preflightId =
    normalizeOptionalIdentifier(input.preflightId, 'preflightId') ??
    preflightIdFor({
      account,
      transaction,
      policyDecision,
      callback,
      keyPosture,
      releaseBindingDigest: input.releaseBinding.digest,
      policyScopeDigest: input.policyScopeBinding.digest,
      enforcementBindingDigest: input.enforcementBinding.digest,
    });
  const signal = signalFor({
    outcome,
    preflightId,
    account,
    transaction,
    policyDecision,
    approvals,
    callback,
    keyPosture,
    observations,
  });
  const canonicalPayload = {
    version: CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
    preflightId,
    adapterKind: 'custody-cosigner' as const,
    checkedAt: policyDecision.evaluatedAt,
    provider: account.provider,
    organizationId: account.organizationId,
    accountRef: account.accountRef,
    requestId: transaction.requestId,
    idempotencyKey: transaction.idempotencyKey,
    chain: transaction.chain,
    asset: transaction.asset,
    amount: transaction.amount,
    destinationAddress: transaction.destinationAddress,
    policyId: policyDecision.policyId,
    policyVersion: policyDecision.policyVersion,
    policyDecisionId: policyDecision.decisionId,
    approvalQuorum: `${approvals.collectedApprovals}/${approvals.requiredApprovals}`,
    keyId: keyPosture.keyId,
    callbackId: callback.callbackId,
    outcome,
    signal,
    observations,
    releaseBindingDigest: input.releaseBinding.digest,
    policyScopeDigest: input.policyScopeBinding.digest,
    enforcementBindingDigest: input.enforcementBinding.digest,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function simulateCustodyCosignerPolicyAuthorization(
  input: CreateCustodyCosignerPolicyPreflightInput,
): CustodyCosignerPolicySimulationResult {
  const preflight = createCustodyCosignerPolicyPreflight(input);
  const simulation = createCryptoAuthorizationSimulation({
    intent: input.intent,
    riskAssessment: input.riskAssessment,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    simulatedAt: preflight.checkedAt,
    preflightSignals: [preflight.signal],
    operatorNote: `custody withdrawal ${preflight.accountRef} -> ${preflight.destinationAddress} ${preflight.amount} ${preflight.asset} preflight ${preflight.outcome}.`,
  });

  return Object.freeze({
    preflight,
    simulation,
  });
}

export function custodyCosignerPolicyPreflightLabel(
  preflight: CustodyCosignerPolicyPreflight,
): string {
  return [
    `custody:${preflight.provider}`,
    `account:${preflight.accountRef}`,
    `request:${preflight.requestId}`,
    `amount:${preflight.amount}`,
    `outcome:${preflight.outcome}`,
  ].join(' / ');
}
