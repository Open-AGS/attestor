import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

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

try {
  const note = readProjectFile('docs', 'audit', 'f2-eip7702-scope-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const adapter = [
    readProjectFile('src', 'crypto-authorization-core', 'eip7702-delegation-adapter.ts'),
    readProjectFile('src', 'crypto-authorization-core', 'eip7702-delegation-adapter-observations.ts'),
    readProjectFile('src', 'crypto-authorization-core', 'eip7702-delegation-adapter-types.ts'),
  ].join('\n');
  const handoff = [
    readProjectFile('src', 'crypto-execution-admission', 'delegated-eoa.ts'),
    readProjectFile('src', 'crypto-execution-admission', 'delegated-eoa-types.ts'),
    readProjectFile('src', 'crypto-execution-admission', 'delegated-eoa-expectations.ts'),
    readProjectFile('src', 'crypto-execution-admission', 'delegated-eoa-runtime.ts'),
  ].join('\n');
  const adapterTests = readProjectFile(
    'tests',
    'crypto-authorization-core-eip7702-delegation-adapter.test.ts',
  );
  const handoffTests = readProjectFile(
    'tests',
    'crypto-execution-admission-delegated-eoa.test.ts',
  );

  includes(note, 'Status: `partial`.', 'Validation note: status is partial');
  includes(
    note,
    'The original finding is stale if it says Attestor has no EIP-7702 delegation',
    'Validation note: stale original wording is explicit',
  );
  includes(note, 'scope gate.', 'Validation note: stale original scope-gate wording is explicit');
  includes(
    note,
    'Current repo evidence supports `partial`, not `fixed`.',
    'Validation note: partial-not-fixed conclusion is explicit',
  );
  includes(note, 'https://eips.ethereum.org/EIPS/eip-7702', 'Validation note: EIP source is recorded');
  includes(
    tracker,
    'F2-AG-3 account-delegation / EIP-7702 scope | `partial`',
    'Tracker: EIP-7702 finding is partial',
  );
  includes(
    packageJson,
    '"test:f2-eip7702-scope-validation"',
    'Package: focused EIP-7702 validation test script exists',
  );

  for (const expected of [
    'eip7702-authorization-chain-scope',
    'eip7702-call-scope-signed',
    'allowUniversalChainAuthorization',
    'targetCalldataSigned',
    'valueSigned',
    'gasLimitSigned',
    'nonceSigned',
    'expirySigned',
    'runtimeContextBound',
  ]) {
    includes(adapter, expected, `Adapter evidence: ${expected} is present`);
  }

  for (const expected of [
    'authorization-tuple',
    'authority-nonce',
    'delegate-code',
    'post-execution',
    'needs-runtime-evidence',
    'eip7702-post-execution-pending',
  ]) {
    includes(handoff, expected, `Handoff evidence: ${expected} is present`);
  }

  for (const expected of [
    'testUniversalChainAuthorizationRequiresOptIn',
    'testNonceMismatchBlocks',
    'testCallScopeMustBeSigned',
    'testTargetMismatchAndWrongAdapterReject',
  ]) {
    includes(adapterTests, expected, `Adapter test evidence: ${expected} exists`);
  }

  for (const expected of [
    'testRuntimeObservationFailureBlocks',
    'testWalletCapabilityMissing',
    'testDelegateCodePostureBlocks',
  ]) {
    includes(handoffTests, expected, `Handoff test evidence: ${expected} exists`);
  }

  excludes(
    adapter,
    /delegationScope|maxCumulativeValue|maxTransactions|scopeWindowSeconds/u,
    'Adapter evidence: no explicit cumulative delegated-scope contract exists yet',
  );

  console.log(`F2 EIP-7702 scope validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 EIP-7702 scope validation tests failed:', error);
  process.exitCode = 1;
}
