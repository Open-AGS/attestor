import assert from 'node:assert/strict';
import {
  createCryptoPolicyGapNarrowingAssessment,
} from '../src/crypto-authorization-core/policy-gap-narrowing.js';
import {
  createCryptoCanonicalCounterpartyReference,
} from '../src/crypto-authorization-core/canonical-references.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';

let passed = 0;

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

function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

export function fixtureAccount(accountKind: Parameters<typeof createCryptoAccountReference>[0]['accountKind'] = 'eoa') {
  return createCryptoAccountReference({
    accountKind,
    chain: fixtureChain(),
    address: '0x1111111111111111111111111111111111111111',
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

export function fixtureCounterparty(
  counterpartyKind: Parameters<typeof createCryptoCanonicalCounterpartyReference>[0]['counterpartyKind'] = 'account',
) {
  return createCryptoCanonicalCounterpartyReference({
    counterpartyKind,
    counterpartyId: `${counterpartyKind}:main`,
    chain: fixtureChain(),
  });
}

export function candidateKinds(
  assessment: ReturnType<typeof createCryptoPolicyGapNarrowingAssessment>,
): readonly string[] {
  return assessment.candidates.map((candidate) => candidate.kind);
}

export function gapClasses(
  assessment: ReturnType<typeof createCryptoPolicyGapNarrowingAssessment>,
): readonly string[] {
  return assessment.gaps.map((gap) => gap.gapClass);
}
