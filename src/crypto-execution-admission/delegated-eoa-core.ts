import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  EIP7702_AUTHORIZATION_MAGIC,
  EIP7702_DELEGATION_INDICATOR_PREFIX,
  EIP7702_SET_CODE_TX_TYPE,
  type Eip7702DelegationPreflight,
} from '../crypto-authorization-core/eip7702-delegation-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';
import {
  blockingReasonsFor,
  expectationsFor,
  outcomeFor,
} from './delegated-eoa-expectations.js';
import {
  canonicalObject,
  chainIdHexFromCaip2,
  normalizeAccountState,
  normalizeAddress,
  normalizeAuthorization,
  normalizeCaip2ChainId,
  normalizeDecimalInteger,
  normalizeDelegateCode,
  normalizeExecution,
  normalizeInitialization,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
  normalizeRecovery,
  normalizeRuntimeObservation,
  normalizeSelector,
  normalizeSponsor,
} from './delegated-eoa-normalize.js';
import {
  nextActionsFor,
  runtimeChecksFor,
  walletCapabilityStatus,
} from './delegated-eoa-runtime.js';
import {
  DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION,
  type CreateDelegatedEoaAdmissionHandoffInput,
  type DelegatedEoaAdmissionHandoff,
} from './delegated-eoa-types.js';

function handoffIdFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly createdAt: string;
}): string {
  return canonicalObject({
    version: DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    createdAt: input.createdAt,
  }).digest;
}

export function createDelegatedEoaAdmissionHandoff(
  input: CreateDelegatedEoaAdmissionHandoffInput,
): DelegatedEoaAdmissionHandoff {
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const authorization = normalizeAuthorization(input.authorization);
  const accountState = normalizeAccountState(input.accountState);
  const delegateCode = normalizeDelegateCode(input.delegateCode);
  const execution = normalizeExecution(input.execution);
  const initialization = normalizeInitialization(input.initialization);
  const sponsor = normalizeSponsor(input.sponsor);
  const recovery = normalizeRecovery(input.recovery);
  const runtimeObservation = normalizeRuntimeObservation(input.runtimeObservation);
  const chainId = normalizeCaip2ChainId(input.preflight.chainId, 'preflight.chainId');
  const chainIdHex = chainIdHexFromCaip2(chainId);
  const authorityAddress = normalizeAddress(
    input.preflight.authorityAddress,
    'preflight.authorityAddress',
  );
  const delegationAddress = normalizeAddress(
    input.preflight.delegationAddress,
    'preflight.delegationAddress',
  );
  const authorizationNonce = normalizeDecimalInteger(
    input.preflight.authorizationNonce,
    'preflight.authorizationNonce',
  );
  const target = normalizeAddress(input.preflight.target, 'preflight.target');
  const functionSelector = normalizeSelector(
    input.preflight.functionSelector,
    'preflight.functionSelector',
  );
  const expectations = expectationsFor({
    plan: input.plan,
    preflight: input.preflight,
    authorization,
    accountState,
    delegateCode,
    execution,
    initialization,
    sponsor,
    recovery,
    runtimeObservation,
  });
  const blockingReasons = blockingReasonsFor({
    plan: input.plan,
    expectations,
  });
  const outcome = outcomeFor({
    plan: input.plan,
    preflight: input.preflight,
    expectations,
    blockingReasons,
  });
  const walletCapability = walletCapabilityStatus(execution);
  const handoffId =
    normalizeOptionalIdentifier(input.handoffId, 'handoffId') ??
    handoffIdFor({
      plan: input.plan,
      preflight: input.preflight,
      createdAt,
    });
  const runtimeId = normalizeOptionalIdentifier(input.runtimeId, 'runtimeId');
  const walletProviderId = normalizeOptionalIdentifier(
    input.walletProviderId,
    'walletProviderId',
  );
  const runtimeChecks = runtimeChecksFor(execution.executionPath);
  const walletCapabilitySidecar = walletCapability === null
    ? null
    : Object.freeze({
        required: walletCapability.required,
        observed: walletCapability.observed,
        supported: walletCapability.supported,
        requested: walletCapability.requested,
        atomicRequired: walletCapability.atomicRequired,
      });
  const attestorSidecar = Object.freeze({
    attestorPlanId: input.plan.planId,
    attestorPlanDigest: input.plan.digest,
    attestorPreflightId: input.preflight.preflightId,
    attestorPreflightDigest: input.preflight.digest,
    executionPath: execution.executionPath,
    authorizationTupleHash: authorization.tupleHash ?? null,
    delegateImplementationId: delegateCode.delegateImplementationId,
    walletCapability: walletCapabilitySidecar,
    runtimeId,
    walletProviderId,
  });
  const canonicalPayload = {
    version: DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION,
    handoffId,
    createdAt,
    outcome,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    simulationId: input.plan.simulationId,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    authorityAddress,
    delegationAddress,
    chainId,
    chainIdHex,
    authorizationNonce,
    executionPath: execution.executionPath,
    target,
    functionSelector,
    setCodeTransactionType: EIP7702_SET_CODE_TX_TYPE,
    authorizationMagic: EIP7702_AUTHORIZATION_MAGIC,
    delegationIndicatorPrefix: EIP7702_DELEGATION_INDICATOR_PREFIX,
    runtimeId,
    walletProviderId,
    authorization,
    accountState,
    delegateCode,
    execution,
    walletCapability,
    initialization,
    sponsor,
    recovery,
    runtimeChecks,
    runtimeObservation,
    attestorSidecar,
    expectations,
    blockingReasons,
    nextActions: nextActionsFor(outcome),
    operatorNote: normalizeOptionalIdentifier(input.operatorNote, 'operatorNote'),
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function delegatedEoaAdmissionHandoffLabel(
  handoff: DelegatedEoaAdmissionHandoff,
): string {
  return [
    `delegated-eoa:${handoff.authorityAddress}`,
    `delegate:${handoff.delegationAddress}`,
    `path:${handoff.executionPath}`,
    `outcome:${handoff.outcome}`,
  ].join(' / ');
}
