import type {
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';
import { canonicalObject } from './safe-module-guard-adapter-canonical.js';
import {
  SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION,
} from './safe-module-guard-adapter-types.js';
import type {
  SafeModuleGuardHookContext,
  SafeModuleGuardObservation,
  SafeModuleGuardOutcome,
  SafeModuleGuardTransaction,
} from './safe-module-guard-adapter-types.js';

export function outcomeFromObservations(
  observations: readonly SafeModuleGuardObservation[],
): SafeModuleGuardOutcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(
  outcome: SafeModuleGuardOutcome,
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

function signalCodeFor(
  source: 'safe-guard' | 'module-hook',
  outcome: SafeModuleGuardOutcome,
): string {
  const prefix = source === 'safe-guard'
    ? 'safe-module-guard'
    : 'safe-module-hook';
  switch (outcome) {
    case 'allow':
      return `${prefix}-adapter-allow`;
    case 'review-required':
      return `${prefix}-adapter-review-required`;
    case 'block':
      return `${prefix}-adapter-block`;
  }
}

function signalMessageFor(
  source: 'safe-guard' | 'module-hook',
  outcome: SafeModuleGuardOutcome,
): string {
  const surface = source === 'safe-guard' ? 'Safe module guard' : 'Safe module hook';
  switch (outcome) {
    case 'allow':
      return `${surface} adapter accepted the Attestor-bound module transaction preflight.`;
    case 'review-required':
      return `${surface} adapter needs additional Attestor evidence before module execution.`;
    case 'block':
      return `${surface} adapter would block the module transaction fail-closed.`;
  }
}

function failingReasonCodes(
  observations: readonly SafeModuleGuardObservation[],
): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

export function preflightIdFor(input: {
  readonly hook: SafeModuleGuardHookContext;
  readonly transaction: SafeModuleGuardTransaction;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION,
    phase: input.hook.phase,
    checkedAt: input.hook.checkedAt,
    moduleGuardAddress: input.hook.moduleGuardAddress,
    moduleAddress: input.transaction.moduleAddress,
    moduleTxHash: input.transaction.moduleTxHash,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function signalsFor(input: {
  readonly outcome: SafeModuleGuardOutcome;
  readonly preflightId: string;
  readonly hook: SafeModuleGuardHookContext;
  readonly transaction: SafeModuleGuardTransaction;
  readonly functionSelector: string | null;
  readonly observations: readonly SafeModuleGuardObservation[];
}): readonly CryptoSimulationPreflightSignal[] {
  const evidence = Object.freeze({
    adapterVersion: SAFE_MODULE_GUARD_ADAPTER_SPEC_VERSION,
    preflightId: input.preflightId,
    outcome: input.outcome,
    hookPhase: input.hook.phase,
    moduleGuardAddress: input.hook.moduleGuardAddress,
    safeAddress: input.transaction.safeAddress,
    moduleAddress: input.transaction.moduleAddress,
    moduleEnabled: input.transaction.moduleEnabled,
    moduleGuardInstalled: input.transaction.moduleGuardInstalled,
    moduleTxHash: input.transaction.moduleTxHash,
    operation: input.transaction.operation,
    to: input.transaction.to,
    value: input.transaction.value,
    functionSelector: input.functionSelector,
    moduleNonce: input.transaction.moduleNonce,
    reasonCodes: failingReasonCodes(input.observations),
  });
  const status = signalStatusFor(input.outcome);

  return Object.freeze([
    Object.freeze({
      source: 'safe-guard',
      status,
      code: signalCodeFor('safe-guard', input.outcome),
      message: signalMessageFor('safe-guard', input.outcome),
      required: true,
      evidence,
    }),
    Object.freeze({
      source: 'module-hook',
      status,
      code: signalCodeFor('module-hook', input.outcome),
      message: signalMessageFor('module-hook', input.outcome),
      required: true,
      evidence,
    }),
  ]);
}
