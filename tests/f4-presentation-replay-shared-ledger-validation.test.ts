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
  const source = readProjectFile('src', 'consequence-admission', 'presentation-replay-ledger.ts');
  const sharedAtomicStores = readProjectFile('src', 'service', 'consequence-shared-atomic-stores.ts');
  const unitTest = readProjectFile('tests', 'presentation-replay-ledger.test.ts');
  const doc = readProjectFile('docs', '02-architecture', 'presentation-replay-ledger.md');
  const audit = readProjectFile(
    'docs',
    'audit',
    'f4-presentation-replay-shared-ledger-validation.md',
  );
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(
    source,
    'ConsequenceAdmissionPresentationReplayLedgerStore',
    'F4 replay ledger: shared-store contract is exported',
  );
  includes(
    source,
    'setIfAbsent',
    'F4 replay ledger: store contract uses atomic set-if-absent consume semantics',
  );
  includes(
    source,
    'sharedStoreAtomicConsumeRequired: true',
    'F4 replay ledger: descriptor requires atomic consume for shared stores',
  );
  includes(
    source,
    'productionSharedStoreIncluded: true',
    'F4 replay ledger: source exposes the shared atomic store slice',
  );
  includes(
    source,
    'productionSharedStoreRuntimeWired: false',
    'F4 replay ledger: source preserves runtime cutover non-claim',
  );
  includes(
    sharedAtomicStores,
    'consumeSharedConsequencePresentationReplayIfAbsent',
    'F4 replay ledger: PostgreSQL replay atomic store exists',
  );
  includes(
    unitTest,
    'testSharedStoreContractBlocksReplayAcrossLedgerInstances',
    'F4 replay ledger: cross-instance shared-store behavior is tested',
  );
  includes(
    doc,
    'Shared-Store Contract',
    'F4 replay ledger: architecture doc explains the shared-store contract',
  );
  includes(
    doc,
    '`setIfAbsent(entry)` is the important operation',
    'F4 replay ledger: doc names the required atomic primitive',
  );
  includes(
    audit,
    'Status: partial.',
    'F4 replay ledger: audit doc keeps the remediation status partial',
  );
  includes(
    audit,
    'does not claim runtime cutover',
    'F4 replay ledger: audit doc preserves the production-readiness boundary',
  );
  includes(
    tracker,
    'F4-LLM05-B presentation replay ledger in-memory reference path | `partial`',
    'F4 replay ledger: tracker marks the finding partial after validation',
  );
  includes(
    packageJson,
    '"test:f4-presentation-replay-shared-ledger-validation"',
    'F4 replay ledger: package exposes the focused validation script',
  );
  excludes(
    audit,
    /production ready|fully fixed|certified/iu,
    'F4 replay ledger: audit doc avoids overclaim wording',
  );

  console.log(`F4 presentation replay shared ledger validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F4 presentation replay shared ledger validation tests failed:', error);
  process.exitCode = 1;
}
