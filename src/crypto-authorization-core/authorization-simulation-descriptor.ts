import {
  CRYPTO_AUTHORIZATION_SIMULATION_OUTCOMES,
  CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION,
  CRYPTO_SIMULATION_ADAPTER_PREFLIGHT_PROFILES,
  CRYPTO_SIMULATION_CHECKS,
  CRYPTO_SIMULATION_OBSERVATION_STATUSES,
  CRYPTO_SIMULATION_PREFLIGHT_SOURCES,
  CRYPTO_SIMULATION_PREVIEW_CONFIDENCE,
  type CryptoAuthorizationSimulationDescriptor,
  type CryptoAuthorizationSimulationResult,
  type CryptoSimulationAdapterPreflightProfile,
} from './authorization-simulation-types.js';
import type { CryptoExecutionAdapterKind } from './types.js';

export function cryptoSimulationAdapterPreflightProfile(
  adapterKind: CryptoExecutionAdapterKind | null,
): CryptoSimulationAdapterPreflightProfile {
  return CRYPTO_SIMULATION_ADAPTER_PREFLIGHT_PROFILES[adapterKind ?? 'adapter-neutral'];
}

export function cryptoAuthorizationSimulationLabel(
  simulation: CryptoAuthorizationSimulationResult,
): string {
  return [
    `crypto-simulation:${simulation.intentId}`,
    `outcome:${simulation.outcome}`,
    `risk:${simulation.riskClass}`,
    `adapter:${simulation.adapterKind ?? 'adapter-neutral'}`,
  ].join(' / ');
}

export function cryptoAuthorizationSimulationDescriptor():
CryptoAuthorizationSimulationDescriptor {
  return Object.freeze({
    version: CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION,
    outcomes: CRYPTO_AUTHORIZATION_SIMULATION_OUTCOMES,
    confidenceLevels: CRYPTO_SIMULATION_PREVIEW_CONFIDENCE,
    observationStatuses: CRYPTO_SIMULATION_OBSERVATION_STATUSES,
    preflightSources: CRYPTO_SIMULATION_PREFLIGHT_SOURCES,
    checks: CRYPTO_SIMULATION_CHECKS,
    standards: Object.freeze([
      'release-layer',
      'release-policy-control-plane',
      'release-enforcement-plane',
      'EIP-5792',
      'ERC-7836',
      'ERC-7902-ready',
      'ERC-4337',
      'ERC-7562',
      'ERC-7715',
      'EIP-7702',
      'ERC-7579',
      'ERC-6900',
      'Safe-guards',
      'x402-ready',
      'custody-policy-ready',
    ]),
  });
}
