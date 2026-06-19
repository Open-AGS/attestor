import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createCryptoAuthorizationSimulation,
} from './authorization-simulation.js';
import {
  MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION,
  type ModularAccountAdapterKind,
  type ModularAccountExecutionContext,
  type ModularAccountModuleState,
  type CreateModularAccountAdapterPreflightInput,
  type ModularAccountAdapterPreflight,
  type ModularAccountAdapterSimulationResult,
} from './modular-account-adapters-types.js';
import {
  adapterKindFromIntent,
  assertAdapterConsistency,
  normalizedExecution,
  normalizedHooks,
  normalizedModuleState,
  normalizedPluginManifest,
  normalizedValidation,
  normalizeOptionalIdentifier,
} from './modular-account-adapters-normalize.js';
import {
  buildObservations,
} from './modular-account-adapters-observations.js';
import {
  outcomeFromObservations,
  signalFor,
} from './modular-account-adapters-signal.js';

export * from './modular-account-adapters-types.js';
export { modularAccountAdaptersDescriptor } from './modular-account-adapters-descriptor.js';

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
  readonly adapterKind: ModularAccountAdapterKind;
  readonly moduleState: ModularAccountModuleState;
  readonly execution: ModularAccountExecutionContext;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION,
    adapterKind: input.adapterKind,
    observedAt: input.moduleState.observedAt,
    accountAddress: input.moduleState.accountAddress,
    moduleAddress: input.moduleState.moduleAddress,
    moduleKind: input.moduleState.moduleKind,
    moduleAllowlistDigest: input.moduleState.moduleAllowlistDigest ?? null,
    moduleAuditEvidenceRef: input.moduleState.moduleAuditEvidenceRef ?? null,
    operationHash: input.execution.operationHash,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function createModularAccountAdapterPreflight(
  input: CreateModularAccountAdapterPreflightInput,
): ModularAccountAdapterPreflight {
  assertAdapterConsistency(input);
  const adapterKind = adapterKindFromIntent(input.intent);
  const moduleState = normalizedModuleState(input.moduleState);
  const validation = normalizedValidation(input.validation);
  const execution = normalizedExecution(input.execution);
  const hooks = normalizedHooks(input.hooks);
  const pluginManifest = normalizedPluginManifest(input.pluginManifest);
  const observations = buildObservations({
    adapterKind,
    intent: input.intent,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    moduleState,
    validation,
    execution,
    hooks,
    pluginManifest,
  });
  const outcome = outcomeFromObservations(observations);
  const preflightId =
    normalizeOptionalIdentifier(input.preflightId, 'preflightId') ??
    preflightIdFor({
      adapterKind,
      moduleState,
      execution,
      releaseBindingDigest: input.releaseBinding.digest,
      policyScopeDigest: input.policyScopeBinding.digest,
      enforcementBindingDigest: input.enforcementBinding.digest,
    });
  const signal = signalFor({
    adapterKind,
    outcome,
    preflightId,
    moduleState,
    validation,
    execution,
    hooks,
    pluginManifest,
    observations,
  });
  const canonicalPayload = {
    version: MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION,
    preflightId,
    adapterKind,
    moduleStandard: moduleState.moduleStandard,
    checkedAt: moduleState.observedAt,
    accountAddress: moduleState.accountAddress,
    moduleAddress: moduleState.moduleAddress,
    moduleKind: moduleState.moduleKind,
    moduleAllowlistDigest: moduleState.moduleAllowlistDigest ?? null,
    moduleAuditEvidenceRef: moduleState.moduleAuditEvidenceRef ?? null,
    operationHash: execution.operationHash,
    executionFunction: execution.executionFunction,
    validationFunction: validation.validationFunction,
    chainId: moduleState.chainId,
    target: execution.target,
    functionSelector: execution.functionSelector ?? null,
    nonce: execution.nonce,
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

export function simulateModularAccountAdapterAuthorization(
  input: CreateModularAccountAdapterPreflightInput,
): ModularAccountAdapterSimulationResult {
  const preflight = createModularAccountAdapterPreflight(input);
  const simulation = createCryptoAuthorizationSimulation({
    intent: input.intent,
    riskAssessment: input.riskAssessment,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    simulatedAt: preflight.checkedAt,
    preflightSignals: [preflight.signal],
    operatorNote: `Modular account ${preflight.adapterKind} ${preflight.operationHash} preflight ${preflight.outcome}.`,
  });

  return Object.freeze({
    preflight,
    simulation,
  });
}

export function modularAccountAdapterPreflightLabel(
  preflight: ModularAccountAdapterPreflight,
): string {
  return [
    `modular-account:${preflight.operationHash}`,
    `adapter:${preflight.adapterKind}`,
    `outcome:${preflight.outcome}`,
    `module:${preflight.moduleAddress}`,
  ].join(' / ');
}
