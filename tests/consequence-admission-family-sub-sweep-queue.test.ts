import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nUnexpected: ${unexpected}`);
  passed += 1;
}

const queueReport = readProjectFile('docs/audit/ops-171-consequence-admission-family-sub-sweep-queue.md');
const findingIndex = readProjectFile('docs/audit/finding-index.md');
const reportIndex = readProjectFile('docs/audit/report-index.md');
const baseline = readProjectFile('docs/audit/current-posture-baseline.md');
const controlMap = readProjectFile('docs/audit/control-map.md');
const sweep22 = readProjectFile('docs/audit/ops-sweep-22-consequence-admission-engine-deep-audit.md');
const ops170 = readProjectFile('docs/audit/ops-170-consequence-admission-index-focused-sub-sweep.md');

for (const section of [
  '## Recent Fixes Chain-Effect Check',
  '## Validation Frame',
  '## Inspected Files',
  '## Skipped Files',
  '## Trust Boundaries And Relevant Surfaces',
  '## Queue',
  '## Findings',
  '## Chain Reactions',
  '## Coverage Delta',
  '## Verdict',
  '## Final Checkpoint',
]) {
  includes(queueReport, section, `OPS-171 queue report includes ${section}`);
}

for (const queueId of [
  'OPS-171-PF',
  'OPS-171-SHADOW',
  'OPS-171-GR',
  'OPS-171-INV',
  'OPS-171-ACTION',
  'OPS-171-CG',
  'OPS-171-TESTS',
]) {
  includes(queueReport, queueId, `OPS-171 queue includes ${queueId}`);
}

for (const requiredNoClaim of [
  'cannot grant authority',
  'cannot activate enforcement',
  'does not prove production readiness',
  'live customer PEP no-bypass proof',
  'live shared-store',
]) {
  includes(queueReport, requiredNoClaim, `OPS-171 queue keeps no-claim wording: ${requiredNoClaim}`);
}

includes(
  findingIndex,
  'OPS-171 consequence-admission family sub-sweep queue | `accepted limitation / sub-sweep backlog`',
  'OPS-171 finding index is no longer open',
);
excludes(
  findingIndex,
  'OPS-171 consequence-admission family sub-sweep queue | `open / partial-repo`',
  'OPS-171 finding index must not remain open',
);
includes(
  reportIndex,
  'OPS-171-SUB-SWEEP-QUEUE',
  'OPS-171 report index tracks the queue report',
);
includes(
  baseline,
  'OPS-171 is accepted as a sub-sweep backlog',
  'OPS-171 baseline keeps queue/backlog status explicit',
);
includes(
  controlMap,
  'OPS-171 family queue keeps policy-foundry, shadow, golden-refund, assurance/invariant, action-surface, customer-gate, and test assertion sub-sweeps backlog-tracked',
  'OPS-171 control map tracks the family queue',
);
includes(
  sweep22,
  'accepted limitation / sub-sweep backlog',
  'OPS-171 Sweep 22 report records the accepted backlog status',
);
includes(
  ops170,
  'OPS-171 remains accepted limitation / sub-sweep backlog',
  'OPS-170 report no longer says OPS-171 is open',
);

console.log(`consequence admission family sub-sweep queue tests passed (${passed} assertions)`);
