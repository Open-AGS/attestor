import { strict as assert } from 'node:assert';
import {
  ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION,
  canonicalize as canonicalizeSigningJson,
} from '../src/signing/sign.js';
import {
  canonicalizeReleaseJson,
  RELEASE_CANONICALIZATION_SPEC_VERSION,
  type CanonicalReleaseJsonValue,
} from '../src/release-kernel/release-canonicalization.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function throws(fn: () => unknown, message: string): void {
  assert.throws(fn, message);
  passed += 1;
}

function releaseValue(value: unknown): CanonicalReleaseJsonValue {
  return value as CanonicalReleaseJsonValue;
}

function assertParity(value: unknown, expected: string, message: string): void {
  equal(canonicalizeSigningJson(value), expected, `${message}: signing canonical JSON matches fixture`);
  equal(canonicalizeReleaseJson(releaseValue(value)), expected, `${message}: release canonical JSON matches fixture`);
  equal(
    canonicalizeSigningJson(value),
    canonicalizeReleaseJson(releaseValue(value)),
    `${message}: signing and release canonical JSON stay byte-identical`,
  );
}

async function main(): Promise<void> {
  ok(
    ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION !== RELEASE_CANONICALIZATION_SPEC_VERSION,
    'Canonicalization parity: distinct spec ids remain explicit even when behavior is byte-compatible',
  );

  assertParity(
    {
      z: 2,
      a: {
        beta: [true, null, 'x'],
        alpha: 1,
      },
    },
    '{"a":{"alpha":1,"beta":[true,null,"x"]},"z":2}',
    'Canonicalization parity: nested objects sort keys recursively and preserve array order',
  );
  assertParity(
    {
      string: 'line\nquote"',
      number: 4.5,
      falseValue: false,
      trueValue: true,
      nullValue: null,
    },
    '{"falseValue":false,"nullValue":null,"number":4.5,"string":"line\\nquote\\"","trueValue":true}',
    'Canonicalization parity: primitives serialize through the same compact JSON representation',
  );
  assertParity(
    [
      { b: 'second', a: 'first' },
      ['nested', { y: 2, x: 1 }],
    ],
    '[{"a":"first","b":"second"},["nested",{"x":1,"y":2}]]',
    'Canonicalization parity: arrays retain element order while nested objects sort keys',
  );

  for (const invalid of [
    { label: 'undefined', value: { bad: undefined } },
    { label: 'NaN', value: { bad: Number.NaN } },
    { label: 'Infinity', value: { bad: Number.POSITIVE_INFINITY } },
    { label: 'function', value: { bad: () => 'not-json' } },
    { label: 'symbol', value: { bad: Symbol('not-json') } },
    { label: 'bigint', value: { bad: BigInt(1) } },
    { label: 'custom object', value: { bad: new Date('2026-04-17T00:00:00.000Z') } },
  ]) {
    throws(
      () => canonicalizeSigningJson(invalid.value),
      `Canonicalization parity: signing rejects ${invalid.label}`,
    );
    throws(
      () => canonicalizeReleaseJson(releaseValue(invalid.value)),
      `Canonicalization parity: release rejects ${invalid.label}`,
    );
  }

  console.log(`\nRelease kernel canonicalization parity tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel canonicalization parity tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
