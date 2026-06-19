import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const note = readProjectFile('docs', 'audit', 'f2-agent-payment-settlement-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const adapter = [
    readProjectFile('src', 'crypto-authorization-core', 'x402-agentic-payment-adapter.ts'),
    readProjectFile('src', 'crypto-authorization-core', 'x402-agentic-payment-adapter-observations.ts'),
    readProjectFile('src', 'crypto-authorization-core', 'x402-agentic-payment-adapter-types.ts'),
  ].join('\n');
  const resourceServer = [
    readProjectFile('src', 'crypto-execution-admission', 'x402-resource-server.ts'),
    readProjectFile('src', 'crypto-execution-admission', 'x402-resource-server-types.ts'),
    readProjectFile('src', 'crypto-execution-admission', 'x402-resource-server-evaluation.ts'),
  ].join('\n');
  const receipt = readProjectFile(
    'src',
    'consequence-admission',
    'downstream-execution-receipt.ts',
  );

  includes(note, 'Status: `partial`.', 'Validation note: status is partial');
  includes(
    note,
    'The original finding is stale if it claims Attestor has no settlement gate.',
    'Validation note: stale original wording is explicit',
  );
  includes(
    note,
    'Current repo evidence supports `partial`, not `fixed`.',
    'Validation note: partial-not-fixed conclusion is explicit',
  );
  includes(
    note,
    'https://docs.x402.org/core-concepts/facilitator',
    'Validation note: official x402 source is recorded',
  );
  includes(
    tracker,
    'F2-AG-2 agent-payment settlement post-condition | `partial`',
    'Tracker: settlement finding is partial',
  );
  includes(
    packageJson,
    '"test:f2-agent-payment-settlement-validation"',
    'Package: focused settlement validation test script exists',
  );

  for (const expected of [
    'x402-settlement-posture',
    'settleResponseSuccess',
    'input.facilitator.settlementAmount === input.requirements.amount',
  ]) {
    includes(adapter, expected, `Adapter evidence: ${expected} is present`);
  }

  for (const expected of [
    'requiresSettlementSuccess: true',
    'requiresPaymentResponseHeader: true',
    'fulfill-resource',
  ]) {
    includes(resourceServer, expected, `Resource-server evidence: ${expected} is present`);
  }

  includes(
    receipt,
    'externalReceiptDigest',
    'Downstream receipt evidence: external receipt digest is modelled',
  );

  console.log(`F2 agent-payment settlement validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 agent-payment settlement validation tests failed:', error);
  process.exitCode = 1;
}
