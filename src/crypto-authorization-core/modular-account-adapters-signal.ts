import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION,
  type ModularAccountAdapterKind,
  type ModularAccountExecutionContext,
  type ModularAccountHookContext,
  type ModularAccountModuleState,
  type ModularAccountObservation,
  type ModularAccountOutcome,
  type ModularAccountPluginManifest,
  type ModularAccountValidationContext,
} from './modular-account-adapters-types.js';

export function outcomeFromObservations(
  observations: readonly ModularAccountObservation[],
): ModularAccountOutcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(outcome: ModularAccountOutcome): CryptoSimulationPreflightSignal['status'] {
  switch (outcome) {
    case 'allow':
      return 'pass';
    case 'review-required':
      return 'warn';
    case 'block':
      return 'fail';
  }
}

function failingReasonCodes(
  observations: readonly ModularAccountObservation[],
): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

export function signalFor(input: {
  readonly adapterKind: ModularAccountAdapterKind;
  readonly outcome: ModularAccountOutcome;
  readonly preflightId: string;
  readonly moduleState: ModularAccountModuleState;
  readonly validation: ModularAccountValidationContext;
  readonly execution: ModularAccountExecutionContext;
  readonly hooks: ModularAccountHookContext;
  readonly pluginManifest: ModularAccountPluginManifest | null;
  readonly observations: readonly ModularAccountObservation[];
}): CryptoSimulationPreflightSignal {
  const status = signalStatusFor(input.outcome);
  return Object.freeze({
    source: 'module-hook',
    status,
    code: input.outcome === 'allow'
      ? 'modular-account-adapter-allow'
      : input.outcome === 'review-required'
        ? 'modular-account-adapter-review-required'
        : 'modular-account-adapter-block',
    message: input.outcome === 'allow'
      ? 'Modular account adapter accepted the Attestor-bound module/plugin preflight.'
      : input.outcome === 'review-required'
        ? 'Modular account adapter needs additional evidence before execution.'
        : 'Modular account adapter would block module/plugin execution fail-closed.',
    required: true,
    evidence: Object.freeze({
      adapterVersion: MODULAR_ACCOUNT_ADAPTER_SPEC_VERSION,
      preflightId: input.preflightId,
      adapterKind: input.adapterKind,
      moduleStandard: input.moduleState.moduleStandard,
      accountAddress: input.moduleState.accountAddress,
      moduleAddress: input.moduleState.moduleAddress,
      moduleKind: input.moduleState.moduleKind,
      moduleAllowlistDigest: input.moduleState.moduleAllowlistDigest ?? null,
      moduleAuditEvidenceRef: input.moduleState.moduleAuditEvidenceRef ?? null,
      operationHash: input.execution.operationHash,
      executionFunction: input.execution.executionFunction,
      validationFunction: input.validation.validationFunction,
      hookAddress: input.hooks.hookAddress ?? null,
      pluginManifestHash: input.pluginManifest?.manifestHash ?? null,
      reasonCodes: failingReasonCodes(input.observations),
    }),
  });
}
