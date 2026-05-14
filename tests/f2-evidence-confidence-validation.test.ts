import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

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
  const doc = readProjectFile('docs', 'audit', 'f2-evidence-confidence-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const auditExport = readProjectFile('src', 'consequence-admission', 'audit-evidence-export.ts');
  const reviewPacket = readProjectFile('src', 'consequence-admission', 'external-review-packet.ts');

  const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
    item.failureModeId === 'unsupported-confidence-or-hallucinated-evidence'
  );
  const coverage = CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES.find((item) =>
    item.failureModeId === 'unsupported-confidence-or-hallucinated-evidence'
  );

  assert.ok(binding, 'Evidence confidence validation: control binding exists');
  assert.ok(coverage, 'Evidence confidence validation: guard coverage exists');

  equal(binding.invariantIds.includes('trusted-evidence-required'), true, 'Evidence confidence validation: trusted evidence invariant is required');
  equal(binding.requiredEvidence.includes('source-system-verification'), true, 'Evidence confidence validation: source-system verification is required');
  equal(binding.requiredAuditRecords.includes('proof-digest-record'), true, 'Evidence confidence validation: proof digest audit record is required');
  equal(binding.limitation.includes('source-system verification is still domain/customer specific'), true, 'Evidence confidence validation: binding limitation is explicit');

  equal(coverage.coverageKind, 'deterministic-contract', 'Evidence confidence validation: coverage is contract-level');
  equal(coverage.dedicatedGuardPresent, false, 'Evidence confidence validation: no dedicated guard is overclaimed');
  equal(coverage.customerIntegrationRequired, true, 'Evidence confidence validation: customer integration remains required');
  equal(coverage.limitation.includes('source-system verification is still domain/customer specific'), true, 'Evidence confidence validation: coverage limitation is explicit');

  includes(auditExport, 'artifactRefs', 'Evidence confidence validation: audit export carries artifact refs');
  includes(auditExport, 'rawPayloadStored: false', 'Evidence confidence validation: audit export is digest-first');
  includes(auditExport, 'complianceClaimed: false', 'Evidence confidence validation: audit export does not claim compliance');
  includes(reviewPacket, 'normalizeOptionalDigest', 'Evidence confidence validation: review packet normalizes evidence digests');
  includes(reviewPacket, 'not-customer-enforcement-proof-by-itself', 'Evidence confidence validation: review packet non-claim is explicit');
  includes(reviewPacket, 'Verify audit evidence digests and artifact references before trusting the packet', 'Evidence confidence validation: reviewer instruction requires verification');

  includes(doc, 'Status: `partial`.', 'Evidence confidence validation doc: status is partial');
  includes(doc, 'The original "no guard exists" wording is stale, but the finding is not fixed.', 'Evidence confidence validation doc: stale wording is corrected');
  includes(doc, 'Current code does not provide a universal source-system verifier', 'Evidence confidence validation doc: source-system verifier gap is explicit');
  includes(doc, 'No production, compliance, or complete hallucination-prevention claim is made.', 'Evidence confidence validation doc: no overclaim is present');

  includes(tracker, 'F2-AG-6 unsupported confidence / hallucinated evidence | `partial`', 'Tracker: F2-AG-6 is partial');
  includes(tracker, 'F4-LLM09-A hallucinated evidence / unsupported confidence | `partial`', 'Tracker: F4-LLM09-A is partial');
  includes(tracker, 'docs/audit/f2-evidence-confidence-validation.md', 'Tracker: validation doc is linked');
  includes(packageJson, '"test:f2-evidence-confidence-validation"', 'Package: evidence confidence validation test is exposed');

  excludes(doc, /Status: `fixed`/u, 'Evidence confidence validation doc: does not overclaim fixed');
  excludes(tracker, /F2-AG-6 unsupported confidence \/ hallucinated evidence \| `fixed`/u, 'Tracker: F2-AG-6 is not marked fixed');
  excludes(tracker, /F4-LLM09-A hallucinated evidence \/ unsupported confidence \| `fixed`/u, 'Tracker: F4-LLM09-A is not marked fixed');

  console.log(`F2 evidence confidence validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F2 evidence confidence validation tests failed:', error);
  process.exitCode = 1;
}
