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
  'Grafana dashboard guidance',
  'crypto engine hardening II docs: dashboard research anchor is present',
);
includes(
  text,
  'OpenTelemetry attribute limits',
  'crypto engine hardening II docs: telemetry cardinality research anchor is present',
);
includes(
  text,
  '| 04 | complete | Proof console and dashboard hardening |',
  'crypto engine hardening II docs: step 04 is complete',
);
includes(
  text,
  'Node.js `perf_hooks`',
  'crypto engine hardening II docs: Node performance research anchor is present',
);
includes(
  text,
  '| 05 | complete | Runtime performance and efficiency |',
  'crypto engine hardening II docs: step 05 is complete',
);
includes(
  text,
  'Node.js package `exports`',
  'crypto engine hardening II docs: package exports research anchor is present',
);
includes(
  text,
  '| 06 | complete | Package surface consistency |',
  'crypto engine hardening II docs: step 06 is complete',
);
includes(
  text,
  'NIST Privacy Framework data-processing practices',
  'crypto engine hardening II docs: privacy enforcement research anchor is present',
);
includes(
  text,
  '| 07 | complete | Privacy and data-minimization enforcement II |',
  'crypto engine hardening II docs: step 07 is complete',
);
includes(
  text,
  '@noble/hashes',
  'crypto engine hardening II docs: noble hashes dependency research anchor is present',
);
includes(
  text,
  '| 08 | complete | Dependency risk cleanup |',
  'crypto engine hardening II docs: step 08 is complete',
);
includes(
  text,
  'Node.js 26 is `Current`',
  'crypto engine hardening II docs: Node 26 release-status research anchor is present',
);
includes(
  text,
  '`node:alpine` uses musl libc',
  'crypto engine hardening II docs: Node Docker Alpine research anchor is present',
);
includes(
  text,
  '| 09 | complete | Node 26 runtime validation |',
  'crypto engine hardening II docs: step 09 is complete',
);
includes(
  text,
  '| 10 | blocked | Production rollout readiness |',
  'crypto engine hardening II docs: production rollout remains honestly blocked',
);
equal(stepRows.length, 10, 'crypto engine hardening II docs: tracker has 10 steps');

console.log(`crypto-engine-hardening-ii-docs: ${passed} assertions passed`);
