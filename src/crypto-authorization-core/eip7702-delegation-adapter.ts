import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import { createCryptoAuthorizationSimulation } from './authorization-simulation.js';
import {
  EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
  type CreateEip7702DelegationPreflightInput,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702DelegationPreflight,
  type Eip7702DelegationSimulationResult,
  type Eip7702ExecutionEvidence,
} from './eip7702-delegation-adapter-types.js';
import { buildEip7702Observations } from './eip7702-delegation-adapter-observations.js';
import {
  canonicalObject,
  normalizeAccountState,
  normalizeAuthorization,
  normalizeDelegateCode,
  normalizeExecution,
  normalizeInitialization,
  normalizeOptionalIdentifier,
  normalizeRecovery,
  normalizeSponsor,
} from './eip7702-delegation-adapter-normalize.js';
import {
  outcomeFromObservations,
  signalFor,
} from './eip7702-delegation-adapter-signal.js';

export * from './eip7702-delegation-adapter-types.js';
export { eip7702DelegationAdapterDescriptor } from './eip7702-delegation-adapter-descriptor.js';

function assertAdapterConsistency(input: CreateEip7702DelegationPreflightInput): void {
  if (input.intent.executionAdapterKind !== 'eip-7702-delegation') {
    throw new Error('EIP-7702 delegation adapter requires intent execution adapter eip-7702-delegation.');
  }
  if (input.riskAssessment.consequenceKind !== input.intent.consequenceKind) {
    throw new Error('EIP-7702 delegation adapter risk consequence does not match intent.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.policyScopeBinding.cryptoDecisionId) {
    throw new Error('EIP-7702 delegation adapter policy binding does not match release binding.');
  }
  if (input.releaseBinding.cryptoDecisionId !== input.enforcementBinding.cryptoDecisionId) {
    throw new Error('EIP-7702 delegation adapter enforcement binding does not match release binding.');
  }
  if (input.enforcementBinding.adapterKind !== 'eip-7702-delegation') {
    throw new Error('EIP-7702 delegation adapter requires eip-7702-delegation enforcement binding.');
  }
  if (input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind !== 'action-dispatch') {
    throw new Error('EIP-7702 delegation adapter requires action-dispatch enforcement.');
  }
  if (!input.enforcementBinding.verificationProfile.failClosed) {
    throw new Error('EIP-7702 delegation adapter requires fail-closed enforcement verification.');
  }
}

function preflightIdFor(input: {
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
    authorityAddress: input.authorization.authorityAddress,
    delegationAddress: input.authorization.delegationAddress,
    authorizationNonce: input.authorization.nonce,
    observedAt: input.accountState.observedAt,
    delegateCodeHash: input.delegateCode.delegateCodeHash,
    executionPath: input.execution.executionPath,
    target: input.execution.target,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function createEip7702DelegationPreflight(
  input: CreateEip7702DelegationPreflightInput,
): Eip7702DelegationPreflight {
  assertAdapterConsistency(input);
  const authorization = normalizeAuthorization(input.authorization);
  const accountState = normalizeAccountState(input.accountState);
  const delegateCode = normalizeDelegateCode(input.delegateCode);
  const execution = normalizeExecution(input.execution);
  const initialization = normalizeInitialization(input.initialization);
  const sponsor = normalizeSponsor(input.sponsor);
  const recovery = normalizeRecovery(input.recovery);
  const observations = buildEip7702Observations({
    intent: input.intent,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    authorization,
    accountState,
    delegateCode,
    execution,
    initialization,
    sponsor,
    recovery,
  });
  const outcome = outcomeFromObservations(observations);
  const preflightId =
    normalizeOptionalIdentifier(input.preflightId, 'preflightId') ??
    preflightIdFor({
      authorization,
      accountState,
      delegateCode,
      execution,
      releaseBindingDigest: input.releaseBinding.digest,
      policyScopeDigest: input.policyScopeBinding.digest,
      enforcementBindingDigest: input.enforcementBinding.digest,
    });
  const signal = signalFor({
    outcome,
    preflightId,
    authorization,
    accountState,
    delegateCode,
    execution,
    observations,
  });
  const canonicalPayload = {
    version: EIP7702_DELEGATION_ADAPTER_SPEC_VERSION,
    preflightId,
    adapterKind: 'eip-7702-delegation' as const,
    checkedAt: accountState.observedAt,
    authorityAddress: authorization.authorityAddress,
    delegationAddress: authorization.delegationAddress,
    chainId: accountState.chainId,
    authorizationNonce: authorization.nonce,
    executionPath: execution.executionPath,
    target: execution.target,
    functionSelector: execution.functionSelector ?? null,
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

export function simulateEip7702DelegationAuthorization(
  input: CreateEip7702DelegationPreflightInput,
): Eip7702DelegationSimulationResult {
  const preflight = createEip7702DelegationPreflight(input);
  const simulation = createCryptoAuthorizationSimulation({
    intent: input.intent,
    riskAssessment: input.riskAssessment,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    simulatedAt: preflight.checkedAt,
    preflightSignals: [preflight.signal],
    operatorNote: `EIP-7702 delegation ${preflight.authorityAddress} -> ${preflight.delegationAddress} preflight ${preflight.outcome}.`,
  });

  return Object.freeze({
    preflight,
    simulation,
  });
}

export function eip7702DelegationPreflightLabel(
  preflight: Eip7702DelegationPreflight,
): string {
  return [
    `eip7702:${preflight.authorityAddress}`,
    `delegate:${preflight.delegationAddress}`,
    `nonce:${preflight.authorizationNonce}`,
    `outcome:${preflight.outcome}`,
  ].join(' / ');
}
