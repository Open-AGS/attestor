import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(haystack: string, needle: string, message: string): void {
  ok(haystack.includes(needle), message);
}

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

const indexSource = readProjectFile('src/consequence-admission/index.ts');
const contractTest = readProjectFile('tests/consequence-admission-contract.test.ts');
const genericModeTest = readProjectFile('tests/generic-admission-mode-ladder.test.ts');
const retryLedgerTest = readProjectFile('tests/retry-attempt-ledger.test.ts');
const sharedAtomicStoreTest = readProjectFile('tests/consequence-shared-atomic-stores.test.ts');
const subSweepReport = readProjectFile('docs/audit/ops-170-consequence-admission-index-focused-sub-sweep.md');
const findingIndex = readProjectFile('docs/audit/finding-index.md');
const reportIndex = readProjectFile('docs/audit/report-index.md');

const indexLineCount = indexSource.split(/\r?\n/).length;
const exportCount = [...indexSource.matchAll(/^export\s/gm)].length;

ok(indexLineCount >= 2000, 'OPS-170: index surface remains large enough to require focused sub-sweep evidence');
ok(exportCount >= 200, 'OPS-170: index surface remains a broad barrel export surface');
ok(
  /export function createConsequenceAdmissionResponse\s*\(/.test(indexSource),
  'OPS-170: response builder export is present',
);
ok(
  /export function createGenericAdmissionEnvelope\s*\(/.test(indexSource),
  'OPS-170: generic admission envelope export is present',
);
ok(
  /export function evaluateConsequenceAdmissionRetryBudget\s*\(/.test(indexSource),
  'OPS-170: retry-budget evaluator export is present',
);
ok(/function retryBudgetInstruction\s*\(/.test(indexSource), 'OPS-170: retry-budget instruction helper is present');

includes(
  contractTest,
  'Admission contract: admitted response is not fail-closed',
  'OPS-170: admitted response path is locked',
);
includes(
  contractTest,
  'Admission contract: narrow without constraints is rejected',
  'OPS-170: narrow-without-constraints rejection is locked',
);
includes(
  contractTest,
  'Admission contract: allowed retry budget is not fail-closed',
  'OPS-170: allowed retry-budget path is locked',
);
includes(
  contractTest,
  'Admission contract: invalid retry budget fails closed',
  'OPS-170: invalid retry-budget path is locked',
);

includes(
  genericModeTest,
  'Generic admission: observe mode does not enforce',
  'OPS-170: observe mode non-enforcement is locked',
);
includes(
  genericModeTest,
  'Generic admission: programmable money needs adapter readiness',
  'OPS-170: programmable-money adapter readiness is locked',
);
includes(
  genericModeTest,
  'Generic admission: policyBlocked feature shadows block',
  'OPS-170: policyBlocked signal handling is locked',
);
includes(
  genericModeTest,
  'Generic admission: invalid modes fail closed',
  'OPS-170: invalid generic admission mode fail-closed behavior is locked',
);
includes(
  retryLedgerTest,
  'Retry attempt ledger: detects retry budget attempt mismatch',
  'OPS-170: retry attempt mismatch is locked',
);
includes(sharedAtomicStoreTest, 'retryBudget', 'OPS-170: shared atomic store test carries retry-budget evidence');

includes(subSweepReport, '## Recent Fixes Chain-Effect Check', 'OPS-170: report includes chain-effect check');
includes(subSweepReport, '## Validation Frame', 'OPS-170: report includes validation frame');
includes(subSweepReport, '## Skipped Files', 'OPS-170: report discloses skipped files');
includes(subSweepReport, 'does not split', 'OPS-170: report avoids claiming a split');
includes(
  subSweepReport,
  'does not change internal decision math',
  'OPS-170: report avoids decision-math overclaim',
);
includes(subSweepReport, 'OPS-171 remains open', 'OPS-170: report keeps OPS-171 open');
includes(findingIndex, 'OPS-170 consequence-admission `index.ts` size and barrel surface | `closed`', 'OPS-170: finding index closes OPS-170');
includes(reportIndex, 'OPS-170-FOCUSED-SUB-SWEEP', 'OPS-170: report index tracks the focused sub-sweep');

console.log(`consequence admission index surface tests passed (${passed} assertions)`);
