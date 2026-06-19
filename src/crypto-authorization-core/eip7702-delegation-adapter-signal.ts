import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  EIP7702_AUTHORIZATION_MAGIC,
  EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
  EIP7702_SET_CODE_TX_TYPE,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702Observation,
  type Eip7702Outcome,
} from './eip7702-delegation-adapter-types.js';

export function outcomeFromObservations(observations: readonly Eip7702Observation[]): Eip7702Outcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(outcome: Eip7702Outcome): CryptoSimulationPreflightSignal['status'] {
  switch (outcome) {
    case 'allow':
      return 'pass';
    case 'review-required':
      return 'warn';
    case 'block':
      return 'fail';
  }
}

function failingReasonCodes(observations: readonly Eip7702Observation[]): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

export function signalFor(input: {
  readonly outcome: Eip7702Outcome;
  readonly preflightId: string;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly observations: readonly Eip7702Observation[];
}): CryptoSimulationPreflightSignal {
  return Object.freeze({
    source: 'eip-7702-authorization',
    status: signalStatusFor(input.outcome),
    code: input.outcome === 'allow'
      ? 'eip7702-delegation-adapter-allow'
      : input.outcome === 'review-required'
        ? 'eip7702-delegation-adapter-review-required'
        : 'eip7702-delegation-adapter-block',
    message: input.outcome === 'allow'
      ? 'EIP-7702 delegation adapter accepted the Attestor-bound authorization-list preflight.'
      : input.outcome === 'review-required'
        ? 'EIP-7702 delegation adapter needs additional evidence before execution.'
        : 'EIP-7702 delegation adapter would block delegated EOA execution fail-closed.',
    required: true,
    evidence: Object.freeze({
      adapterVersion: EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
      preflightId: input.preflightId,
      transactionType: EIP7702_SET_CODE_TX_TYPE,
      authorizationMagic: EIP7702_AUTHORIZATION_MAGIC,
      authorityAddress: input.authorization.authorityAddress,
      delegationAddress: input.authorization.delegationAddress,
      authorizationNonce: input.authorization.nonce,
      chainId: input.accountState.chainId,
      executionPath: input.execution.executionPath,
      target: input.execution.target,
      delegateCodeHash: input.delegateCode.delegateCodeHash,
      reasonCodes: failingReasonCodes(input.observations),
    }),
  });
}
