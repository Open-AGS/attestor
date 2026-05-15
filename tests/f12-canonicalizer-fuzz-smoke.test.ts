import assert from 'node:assert/strict';
import {
  canonicalize,
  signPayload,
  verifySignature,
  type SigningCanonicalJsonValue,
} from '../src/signing/sign.js';
import { generateKeyPair } from '../src/signing/keys.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, maxExclusive: number): number {
  return Math.floor(random() * maxExclusive);
}

function randomString(random: () => number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789_-"\\';
  const length = randomInt(random, 12);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(random, alphabet.length)] ?? 'a';
  }
  return value;
}

function randomCanonicalJson(random: () => number, depth = 0): SigningCanonicalJsonValue {
  const terminalPick = randomInt(random, 4);
  if (depth >= 3 || terminalPick === 0) {
    const leafPick = randomInt(random, 4);
    if (leafPick === 0) return null;
    if (leafPick === 1) return random() > 0.5;
    if (leafPick === 2) return Number((random() * 2000 - 1000).toFixed(4));
    return randomString(random);
  }

  if (terminalPick === 1) {
    const length = randomInt(random, 5);
    return Array.from({ length }, () => randomCanonicalJson(random, depth + 1));
  }

  const entries = randomInt(random, 5);
  const output: Record<string, SigningCanonicalJsonValue> = {};
  for (let index = 0; index < entries; index += 1) {
    output[`k${randomInt(random, 20)}_${randomString(random)}`] =
      randomCanonicalJson(random, depth + 1);
  }
  return output;
}

const keyPair = generateKeyPair();
const random = mulberry32(0xf12);

for (let index = 0; index < 128; index += 1) {
  const value = randomCanonicalJson(random);
  const canonical = canonicalize(value);
  const reparsed = JSON.parse(canonical) as unknown;
  const canonicalAgain = canonicalize(reparsed);
  const signature = signPayload(canonical, keyPair.privateKeyPem);

  equal(canonicalAgain, canonical, `F12 canonicalizer fuzz smoke: case ${index} is stable after parse/re-canonicalize`);
  ok(
    verifySignature(canonicalAgain, signature, keyPair.publicKeyPem),
    `F12 canonicalizer fuzz smoke: case ${index} verifies after re-canonicalization`,
  );
  ok(
    !verifySignature(`${canonicalAgain} `, signature, keyPair.publicKeyPem),
    `F12 canonicalizer fuzz smoke: case ${index} rejects changed signed bytes`,
  );
}

for (const [label, value, expected] of [
  ['NaN', { bad: Number.NaN }, /finite/],
  ['Infinity', { bad: Number.POSITIVE_INFINITY }, /finite/],
  ['undefined object value', { bad: undefined }, /undefined/],
  ['undefined array value', [undefined], /undefined/],
  ['function', { bad: () => true }, /function/],
  ['symbol', { bad: Symbol('bad') }, /symbol/],
  ['bigint', { bad: BigInt(1) }, /bigint/],
  ['date', { bad: new Date('2026-05-15T00:00:00.000Z') }, /plain objects/],
  ['map', { bad: new Map() }, /plain objects/],
] as const) {
  rejects(
    () => canonicalize(value),
    expected,
    `F12 canonicalizer fuzz smoke: ${label} is rejected before signing`,
  );
}

console.log(`f12-canonicalizer-fuzz-smoke.test.ts: ${passed} assertions passed`);
