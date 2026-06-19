import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  type CustodyAccountEvidence,
  type CustodyApprovalEvidence,
  type CustodyCosignerCallbackEvidence,
  type CustodyCosignerObservation,
  type CustodyCosignerOutcome,
  type CustodyKeyPostureEvidence,
  type CustodyPolicyDecisionEvidence,
  type CustodyTransactionEvidence,
} from './custody-cosigner-policy-adapter-types.js';

export function outcomeFromObservations(
  observations: readonly CustodyCosignerObservation[],
): CustodyCosignerOutcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(
  outcome: CustodyCosignerOutcome,
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

function nonPassingReasonCodes(
  observations: readonly CustodyCosignerObservation[],
): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

export function signalFor(input: {
  readonly outcome: CustodyCosignerOutcome;
  readonly preflightId: string;
  readonly account: CustodyAccountEvidence;
  readonly transaction: CustodyTransactionEvidence;
  readonly policyDecision: CustodyPolicyDecisionEvidence;
  readonly approvals: CustodyApprovalEvidence;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly keyPosture: CustodyKeyPostureEvidence;
  readonly observations: readonly CustodyCosignerObservation[];
}): CryptoSimulationPreflightSignal {
  return Object.freeze({
    source: 'custody-policy',
    status: signalStatusFor(input.outcome),
    code: input.outcome === 'allow'
      ? 'custody-cosigner-policy-adapter-allow'
      : input.outcome === 'review-required'
        ? 'custody-cosigner-policy-adapter-review-required'
        : 'custody-cosigner-policy-adapter-block',
    message: input.outcome === 'allow'
      ? 'Custody co-signer policy adapter accepted the Attestor-bound custody preflight.'
      : input.outcome === 'review-required'
        ? 'Custody co-signer policy adapter needs reviewer or provider evidence before signing.'
        : 'Custody co-signer policy adapter would block custody signing fail-closed.',
    required: true,
    evidence: Object.freeze({
      adapterVersion: CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
      preflightId: input.preflightId,
      provider: input.account.provider,
      organizationId: input.account.organizationId,
      accountRef: input.account.accountRef,
      requestId: input.transaction.requestId,
      idempotencyKey: input.transaction.idempotencyKey,
      chain: input.transaction.chain,
      asset: input.transaction.asset,
      amount: input.transaction.amount,
      destinationAddress: input.transaction.destinationAddress,
      policyDecisionId: input.policyDecision.decisionId,
      policyId: input.policyDecision.policyId,
      policyVersion: input.policyDecision.policyVersion,
      approvalQuorum: `${input.approvals.collectedApprovals}/${input.approvals.requiredApprovals}`,
      callbackId: input.callback.callbackId,
      keyId: input.keyPosture.keyId,
      reasonCodes: nonPassingReasonCodes(input.observations),
    }),
  });
}
