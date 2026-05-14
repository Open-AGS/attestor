import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_SIGNING_FINGERPRINT_HEX_LENGTH,
  ATTESTOR_SIGNING_FINGERPRINT_SECURITY_BITS,
  derivePublicKeyIdentity,
  generateKeyPair,
} from '../src/signing/keys.js';

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

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const keyPair = generateKeyPair();
const derived = derivePublicKeyIdentity(keyPair.publicKeyPem);
const keysSource = readProjectFile('src', 'signing', 'keys.ts');
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const validationDoc = readProjectFile('docs', 'audit', 'f5-fingerprint-width-validation.md');
const packageJson = readProjectFile('package.json');

equal(
  ATTESTOR_SIGNING_FINGERPRINT_HEX_LENGTH,
  32,
  'F5-A3: signing key fingerprint length constant is 32 hex chars',
);
equal(
  ATTESTOR_SIGNING_FINGERPRINT_SECURITY_BITS,
  128,
  'F5-A3: signing key fingerprint identity is 128-bit truncated SHA-256',
);
equal(keyPair.fingerprint.length, 32, 'F5-A3: generated signing key fingerprint is 32 hex chars');
ok(/^[a-f0-9]{32}$/u.test(keyPair.fingerprint), 'F5-A3: generated fingerprint is lowercase hex');
equal(
  derived.fingerprint,
  keyPair.fingerprint,
  'F5-A3: derived public-key identity uses the same widened fingerprint',
);
excludes(
  keysSource,
  /\.slice\(0,\s*16\)/u,
  'F5-A3: signing key identity derivation no longer truncates to 16 hex chars',
);
includes(
  keysSource,
  'ATTESTOR_SIGNING_FINGERPRINT_HEX_LENGTH = 32',
  'F5-A3: signing fingerprint width is centralized in a named constant',
);
includes(
  tracker,
  'F5-A3 truncated fingerprint width | `fixed`',
  'Tracker: F5-A3 is marked fixed',
);
includes(
  tracker,
  'F5 Fingerprint Width Validation',
  'Tracker: F5 fingerprint width validation evidence is linked',
);
includes(
  validationDoc,
  'Status: fixed',
  'F5 fingerprint validation doc: fixed status is explicit',
);
includes(
  validationDoc,
  '128-bit truncated SHA-256',
  'F5 fingerprint validation doc: new fingerprint width is explicit',
);
includes(
  packageJson,
  '"test:f5-fingerprint-width-validation"',
  'Package: F5 fingerprint width validation script is exposed',
);

console.log(`f5-fingerprint-width-validation.test.ts: ${passed} assertions passed`);
