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
  const serviceGuard = readProjectFile('src', 'service', 'agent-loop-abuse-guard.ts');
  const packageGuard = readProjectFile('src', 'consequence-admission', 'agent-loop-abuse-guard.ts');
  const policyLimits = readProjectFile('src', 'consequence-admission', 'policy-limits.ts');
  const retryLedger = readProjectFile('src', 'consequence-admission', 'retry-attempt-ledger.ts');
  const sharedAtomicStores = readProjectFile('src', 'service', 'consequence-shared-atomic-stores.ts');
  const sharedGuardTest = readProjectFile(
    'tests',
    'consequence-admission-agent-loop-abuse-guard-shared.test.ts',
  );
  const policyTest = readProjectFile('tests', 'policy-limit-model.test.ts');
  const retryTest = readProjectFile('tests', 'retry-attempt-ledger.test.ts');
  const audit = readProjectFile('docs', 'audit', 'f4-shared-velocity-retry-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(
    serviceGuard,
    'REDIS_GUARD_SCRIPT',
    'F4 shared velocity/retry: service agent-loop guard has Redis script path',
  );
  includes(
    serviceGuard,
    'redisSharedPathVerified = true',
    'F4 shared velocity/retry: shared guard reports shared only after script execution',
  );
  includes(
    packageGuard,
    'productionSharedStoreIncluded: false',
    'F4 shared velocity/retry: package guard remains honest as in-memory reference',
  );
  includes(
    sharedGuardTest,
    'testSharedRequiredFailsClosedWithoutRedis',
    'F4 shared velocity/retry: HA mode fail-closed behavior is tested',
  );
  includes(
    sharedGuardTest,
    'testSharedActorWindowCoordinatesAcrossInstances',
    'F4 shared velocity/retry: shared actor window is tested across guard instances',
  );
  includes(
    policyLimits,
    'requireSharedCounter',
    'F4 shared velocity/retry: velocity limit can require a shared counter',
  );
  includes(
    policyLimits,
    'policy-limit-velocity-source-not-shared',
    'F4 shared velocity/retry: non-shared velocity source reason is explicit',
  );
  includes(
    policyTest,
    'testVelocityCanRequireSharedDurableSource',
    'F4 shared velocity/retry: shared velocity source requirement is tested',
  );
  includes(
    retryLedger,
    'ConsequenceAdmissionRetryAttemptLedgerStore',
    'F4 shared velocity/retry: retry ledger shared-store contract exists',
  );
  includes(
    retryLedger,
    'recordIfAbsent',
    'F4 shared velocity/retry: retry ledger requires atomic record-if-absent semantics',
  );
  includes(
    retryLedger,
    'productionSharedStoreIncluded: true',
    'F4 shared velocity/retry: retry ledger descriptor exposes the shared atomic store slice',
  );
  includes(
    retryLedger,
    'productionSharedStoreRuntimeWired: false',
    'F4 shared velocity/retry: retry ledger descriptor preserves runtime cutover non-claim',
  );
  includes(
    sharedAtomicStores,
    'recordSharedConsequenceRetryAttemptIfAbsent',
    'F4 shared velocity/retry: PostgreSQL retry atomic store exists',
  );
  includes(
    retryTest,
    'testSharedStoreContractCoordinatesAcrossLedgerInstances',
    'F4 shared velocity/retry: retry ledger cross-instance shared-store behavior is tested',
  );
  includes(
    audit,
    'Status: partial.',
    'F4 shared velocity/retry: audit doc marks repository slice partial',
  );
  includes(
    tracker,
    'F4-LLM06-B agent-loop budget per process | `partial`',
    'F4 shared velocity/retry: tracker marks F4-LLM06-B partial',
  );
  includes(
    tracker,
    'F4-LLM10-A velocity limits depend on shared counter enforcement | `partial`',
    'F4 shared velocity/retry: tracker marks F4-LLM10-A partial',
  );
  includes(
    tracker,
    'F4-LLM10-B retry-attempt ledger storage claim | `partial`',
    'F4 shared velocity/retry: tracker marks F4-LLM10-B partial',
  );
  includes(
    packageJson,
    '"test:f4-shared-velocity-retry-validation"',
    'F4 shared velocity/retry: package exposes focused validation script',
  );
  excludes(
    audit,
    /production ready|fully fixed|certified/iu,
    'F4 shared velocity/retry: audit doc avoids overclaim wording',
  );

  console.log(`F4 shared velocity/retry validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F4 shared velocity/retry validation tests failed:', error);
  process.exitCode = 1;
}
