import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(
  'docs/02-architecture/crypto-engine-hardening-ii.md',
  'utf8',
);

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(haystack: string, needle: string, message: string): void {
  ok(haystack.includes(needle), message);
}

const stepRows = [...text.matchAll(/^\| (0[1-9]|10) \|/gmu)];

includes(
  text,
  'Keep the core decision vocabulary stable: `admit`, `narrow`, `review`, and `block`.',
  'crypto engine hardening II docs: stable decision vocabulary is explicit',
);
includes(
  text,
  'Keep privacy sacred',
  'crypto engine hardening II docs: privacy guardrail is explicit',
);
includes(
  text,
  'ERC-4337',
  'crypto engine hardening II docs: account abstraction research anchor is present',
);
includes(
  text,
  'EIP-7702',
  'crypto engine hardening II docs: delegated EOA research anchor is present',
);
includes(
  text,
  'x402 specification',
  'crypto engine hardening II docs: x402 research anchor is present',
);
includes(
  text,
  '| 01 | complete | Adapter readiness intelligence profile |',
  'crypto engine hardening II docs: step 01 is complete',
);
includes(
  text,
  '| 02 | complete | Pack-specific decision logic |',
  'crypto engine hardening II docs: step 02 is complete',
);
includes(
  text,
  'Open Policy Agent decision logs',
  'crypto engine hardening II docs: decision-log research anchor is present',
);
includes(
  text,
  'AWS IAM policy evaluation',
  'crypto engine hardening II docs: explicit deny research anchor is present',
);
includes(
  text,
  '| 03 | complete | Policy intelligence deepening II |',
  'crypto engine hardening II docs: step 03 is complete',
);
includes(
  text,
  '| 10 | blocked | Production rollout readiness |',
  'crypto engine hardening II docs: production rollout remains honestly blocked',
);
equal(stepRows.length, 10, 'crypto engine hardening II docs: tracker has 10 steps');

console.log(`crypto-engine-hardening-ii-docs: ${passed} assertions passed`);
