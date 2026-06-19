import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createCryptoAuthorizationSimulation,
} from './authorization-simulation.js';
import {
  ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
  type CreateErc4337UserOperationPreflightInput,
  type Erc4337BundlerValidation,
  type Erc4337UserOperation,
  type Erc4337UserOperationPreflight,
  type Erc4337UserOperationSimulationResult,
} from './erc4337-user-operation-adapter-types.js';
import {
  assertAdapterConsistency,
  normalizedBundlerValidation,
  normalizedUserOperation,
  normalizeOptionalIdentifier,
} from './erc4337-user-operation-adapter-normalize.js';
import { buildObservations } from './erc4337-user-operation-adapter-observations.js';
import {
  outcomeFromObservations,
  signalsFor,
} from './erc4337-user-operation-adapter-signal.js';

export * from './erc4337-user-operation-adapter-types.js';
export { computeErc4337UserOperationHash } from './erc4337-user-operation-adapter-normalize.js';
export { erc4337UserOperationAdapterDescriptor } from './erc4337-user-operation-adapter-descriptor.js';

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
  readonly userOperation: Erc4337UserOperation;
  readonly bundlerValidation: Erc4337BundlerValidation;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    validatedAt: input.bundlerValidation.validatedAt,
    bundlerId: input.bundlerValidation.bundlerId,
    entryPoint: input.userOperation.entryPoint,
    sender: input.userOperation.sender,
    nonce: input.userOperation.nonce,
    userOpHash: input.userOperation.userOpHash,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function createErc4337UserOperationPreflight(
  input: CreateErc4337UserOperationPreflightInput,
): Erc4337UserOperationPreflight {
  assertAdapterConsistency(input);
  const userOperation = normalizedUserOperation(input.userOperation);
  const bundlerValidation = normalizedBundlerValidation(input.bundlerValidation, userOperation);
  const observations = buildObservations({
    intent: input.intent,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    userOperation,
    bundlerValidation,
  });
  const outcome = outcomeFromObservations(observations);
  const preflightId =
    normalizeOptionalIdentifier(input.preflightId, 'preflightId') ??
    preflightIdFor({
      userOperation,
      bundlerValidation,
      releaseBindingDigest: input.releaseBinding.digest,
      policyScopeDigest: input.policyScopeBinding.digest,
      enforcementBindingDigest: input.enforcementBinding.digest,
    });
  const signals = signalsFor({
    outcome,
    preflightId,
    userOperation,
    bundlerValidation,
    observations,
  });
  const canonicalPayload = {
    version: ERC4337_USER_OPERATION_ADAPTER_SPEC_VERSION,
    preflightId,
    adapterKind: 'erc-4337-user-operation',
    checkedAt: bundlerValidation.validatedAt,
    bundlerId: bundlerValidation.bundlerId,
    entryPoint: userOperation.entryPoint,
    entryPointVersion: userOperation.entryPointVersion,
    sender: userOperation.sender,
    userOpHash: userOperation.userOpHash,
    nonce: userOperation.nonce,
    chainId: userOperation.chainId,
    callTarget: userOperation.callTarget ?? null,
    callFunctionSelector: userOperation.callFunctionSelector ?? null,
    callDataClass: userOperation.callDataClass ?? null,
    paymaster: userOperation.paymaster ?? null,
    factory: userOperation.factory ?? null,
    outcome,
    signals,
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

export function simulateErc4337UserOperationAuthorization(
  input: CreateErc4337UserOperationPreflightInput,
): Erc4337UserOperationSimulationResult {
  const preflight = createErc4337UserOperationPreflight(input);
  const simulation = createCryptoAuthorizationSimulation({
    intent: input.intent,
    riskAssessment: input.riskAssessment,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    simulatedAt: preflight.checkedAt,
    preflightSignals: preflight.signals,
    operatorNote: `ERC-4337 UserOperation ${preflight.userOpHash} preflight ${preflight.outcome}.`,
  });

  return Object.freeze({
    preflight,
    simulation,
  });
}

export function erc4337UserOperationPreflightLabel(
  preflight: Erc4337UserOperationPreflight,
): string {
  return [
    `erc4337-userop:${preflight.userOpHash}`,
    `outcome:${preflight.outcome}`,
    `sender:${preflight.sender}`,
    `entrypoint:${preflight.entryPointVersion}`,
  ].join(' / ');
}
