import assert from 'node:assert/strict';
import type {
  ModularAccountAdapterKind,
  ModularAccountModuleState,
} from '../src/crypto-authorization-core/modular-account-adapters.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
  type CryptoAccountKind,
} from '../src/crypto-authorization-core/types.js';

let passed = 0;

export const ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
export const TARGET_ADDRESS = '0x2222222222222222222222222222222222222222';
export const MODULE_ADDRESS = '0x3333333333333333333333333333333333333333';
export const PLUGIN_ADDRESS = '0x4444444444444444444444444444444444444444';
export const HOOK_ADDRESS = '0x5555555555555555555555555555555555555555';
export const OTHER_ADDRESS = '0x6666666666666666666666666666666666666666';
export const VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
export const SIGNATURE = `0x${'11'.repeat(65)}`;
export const OPERATION_HASH = `0x${'aa'.repeat(32)}`;
export const MANIFEST_HASH = `0x${'bb'.repeat(32)}`;
export const HOOK_DATA_HASH = `0x${'cc'.repeat(32)}`;
export const INIT_DATA_HASH = `0x${'dd'.repeat(32)}`;
export const MODULE_ALLOWLIST_DIGEST = `0x${'ee'.repeat(32)}`;
export const SPIFFE_ID = 'spiffe://attestor.test/ns/crypto/sa/modular-account';
export const VALIDATED_AT_EPOCH_SECONDS = 1776762050;
export const SIMULATED_AT_EPOCH_SECONDS = 1776762120;
export const FRESH_REVOCATION_CHECKED_AT_EPOCH_SECONDS = 1776762110;

export function passedCount(): number {
  return passed;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp | ErrorConstructor, message?: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

export function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

function accountKindFor(adapterKind: ModularAccountAdapterKind): CryptoAccountKind {
  return adapterKind === 'erc-7579-module'
    ? 'erc-7579-modular-account'
    : 'erc-6900-modular-account';
}

export function fixtureAccount(adapterKind: ModularAccountAdapterKind) {
  return createCryptoAccountReference({
    accountKind: accountKindFor(adapterKind),
    chain: fixtureChain(),
    address: ACCOUNT_ADDRESS,
    accountLabel: 'Treasury modular account',
  });
}

export function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  });
}

export function moduleState(
  adapterKind: ModularAccountAdapterKind,
  overrides: Partial<ModularAccountModuleState> = {},
): ModularAccountModuleState {
  return {
    moduleStandard: adapterKind === 'erc-6900-plugin' ? 'erc-6900' : 'erc-7579',
    observedAt: '2026-04-21T09:02:00.000Z',
    accountAddress: ACCOUNT_ADDRESS,
    chainId: 'eip155:1',
    accountImplementationId:
      adapterKind === 'erc-6900-plugin' ? 'account-impl:6900:v1' : 'account-impl:7579:v1',
    moduleAddress: adapterKind === 'erc-6900-plugin' ? PLUGIN_ADDRESS : MODULE_ADDRESS,
    moduleKind: adapterKind === 'erc-6900-plugin' ? 'plugin' : 'executor',
    moduleTypeId: adapterKind === 'erc-6900-plugin' ? null : '2',
    moduleId: adapterKind === 'erc-6900-plugin' ? 'plugin:limit-order' : 'module:executor',
    moduleVersion: '1.0.0',
    moduleInstalled: true,
    moduleAllowlisted: true,
    moduleAllowlistDigest: MODULE_ALLOWLIST_DIGEST,
    moduleAuditEvidenceRef: 'evidence:module-audit:attestor-reviewed:v1',
    accountSupportsExecutionMode: true,
    accountSupportsModuleType: true,
    moduleTypeMatches: true,
    installAuthorization: {
      authorized: true,
      eventObserved: true,
      installedBy: ACCOUNT_ADDRESS,
      installedAt: '2026-04-21T08:55:00.000Z',
      initDataHash: INIT_DATA_HASH,
    },
    recovery: {
      moduleCanBeUninstalled: true,
      hookCanBeDisabled: true,
      emergencyExecutionPrepared: true,
      recoveryAuthorityRef: 'authority:treasury-recovery',
      recoveryDelaySeconds: 3600,
    },
    ...overrides,
  };
}
