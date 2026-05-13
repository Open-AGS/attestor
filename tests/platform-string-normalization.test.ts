import assert from 'node:assert/strict';

import {
  stripTrailingSlashes,
  trimAndStripTrailingSlashes,
} from '../src/platform/string-normalization.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function testStripTrailingSlashes(): void {
  equal(stripTrailingSlashes(''), '', 'String normalization: empty string stays empty');
  equal(stripTrailingSlashes('https://attestor.example'), 'https://attestor.example', 'String normalization: slashless value is unchanged');
  equal(stripTrailingSlashes('https://attestor.example/'), 'https://attestor.example', 'String normalization: one trailing slash is stripped');
  equal(stripTrailingSlashes('https://attestor.example///'), 'https://attestor.example', 'String normalization: repeated trailing slashes are stripped');
  equal(stripTrailingSlashes('https://attestor.example/a//b///'), 'https://attestor.example/a//b', 'String normalization: internal slashes are preserved');
  equal(stripTrailingSlashes('/'), '', 'String normalization: slash-only input normalizes to empty for callers to handle explicitly');
  equal(stripTrailingSlashes('////'), '', 'String normalization: repeated slash-only input normalizes to empty');
}

function testTrimAndStripTrailingSlashes(): void {
  equal(trimAndStripTrailingSlashes('  https://issuer.example/// \t'), 'https://issuer.example', 'String normalization: whitespace is trimmed before trailing slash stripping');
  equal(trimAndStripTrailingSlashes('  ////  '), '', 'String normalization: trimmed slash-only input normalizes to empty');
  equal(trimAndStripTrailingSlashes('  https://issuer.example/a//b  '), 'https://issuer.example/a//b', 'String normalization: trim wrapper preserves internal slashes');
}

function testLongTrailingSlashInput(): void {
  const value = `https://attestor.example${'/'.repeat(100_000)}`;
  equal(stripTrailingSlashes(value), 'https://attestor.example', 'String normalization: long trailing slash runs deterministically');
  equal(trimAndStripTrailingSlashes(`  ${value}  `), 'https://attestor.example', 'String normalization: long trimmed trailing slash runs deterministically');
}

testStripTrailingSlashes();
testTrimAndStripTrailingSlashes();
testLongTrailingSlashInput();

console.log(`Platform string normalization tests: ${passed} passed, 0 failed`);
