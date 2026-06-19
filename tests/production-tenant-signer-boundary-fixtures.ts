import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

export function passedCount(): number {
  return passed;
}

export function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

export function excludes(value: string, unexpected: string, message: string): void {
  assert.ok(!value.includes(unexpected), message);
  passed += 1;
}

export function throws(
  fn: () => unknown,
  expected: RegExp | ErrorConstructor | ((error: unknown) => boolean),
  message?: string,
): void {
  assert.throws(fn, expected, message);
  passed += 1;
}
