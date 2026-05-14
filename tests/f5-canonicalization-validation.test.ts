import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION,
  canonicalize,
  signPayload,
  verifySignature,
} from '../src/signing/sign.js';
import { generateKeyPair } from '../src/signing/keys.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function rejects(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const canonicalA = canonicalize({
  z: 2,
  a: {
    beta: [true, null, 'x'],
    alpha: 1,
  },
});
const canonicalB = canonicalize({
  a: {
    alpha: 1,
    beta: [true, null, 'x'],
  },
  z: 2,
});

equal(
  ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION,
  'attestor.signing-canonical-json.v1',
  'F5 canonicalization: signing canonicalization has a stable spec version',
);
equal(
  canonicalA,
  canonicalB,
  'F5 canonicalization: object key order does not change signed bytes',
);
equal(
  canonicalA,
  '{"a":{"alpha":1,"beta":[true,null,"x"]},"z":2}',
  'F5 canonicalization: signed bytes are compact, sorted JSON',
);
rejects(
  () => canonicalize({ bad: Number.NaN }),
  /number must be finite/,
  'F5-A8: NaN is rejected instead of becoming null',
);
rejects(
  () => canonicalize({ bad: Number.POSITIVE_INFINITY }),
  /number must be finite/,
  'F5-A8: Infinity is rejected instead of becoming null',
);
rejects(
  () => canonicalize({ bad: undefined }),
  /undefined/,
  'F5 canonicalization: undefined object values are rejected instead of being dropped',
);
rejects(
  () => canonicalize([undefined]),
  /undefined/,
  'F5 canonicalization: undefined array values are rejected instead of becoming null',
);
rejects(
  () => canonicalize({ bad: BigInt(1) }),
  /bigint/,
  'F5 canonicalization: bigint values are rejected instead of throwing from JSON.stringify later',
);
rejects(
  () => canonicalize({ bad: new Date('2026-05-14T00:00:00.000Z') }),
  /plain objects/,
  'F5 canonicalization: custom objects are rejected instead of being implicitly coerced',
);

const keyPair = generateKeyPair();
const signatureA = signPayload(canonicalA, keyPair.privateKeyPem);
const signatureB = signPayload(canonicalB, keyPair.privateKeyPem);
ok(
  verifySignature(canonicalB, signatureA, keyPair.publicKeyPem),
  'F5 canonicalization: signatures verify across semantically identical key orderings',
);
ok(
  verifySignature(canonicalA, signatureB, keyPair.publicKeyPem),
  'F5 canonicalization: inverse key-order signature verification is stable',
);

const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const validationDoc = readProjectFile('docs', 'audit', 'f5-canonicalization-validation.md');
const packageJson = readProjectFile('package.json');

includes(
  tracker,
  'F5-A4 homegrown canonicalization / RFC 8785 interop | `accepted-limitation`',
  'Tracker: F5-A4 is resolved as an explicit interoperability limitation',
);
includes(
  tracker,
  'F5-A8 numeric canonicalization edge cases | `fixed`',
  'Tracker: F5-A8 is marked fixed',
);
includes(
  validationDoc,
  'Status: F5-A8 fixed; F5-A4 accepted limitation.',
  'F5 canonicalization validation doc: status is explicit',
);
includes(
  packageJson,
  '"test:f5-canonicalization-validation"',
  'Package: F5 canonicalization validation script is exposed',
);

console.log(`f5-canonicalization-validation.test.ts: ${passed} assertions passed`);
