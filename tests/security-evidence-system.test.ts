import assert from 'node:assert/strict';
import {
  REQUIRED_FINDINGS,
  REQUIRED_LIVE_PROOFS,
  REQUIRED_PR_TEMPLATE_FIELDS,
  SECURITY_EVIDENCE_DOCS,
  validateSecurityEvidenceSystem,
} from '../scripts/check-security-evidence-system.mjs';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testSecurityEvidenceSystemPasses(): void {
  const result = validateSecurityEvidenceSystem();

  equal(result.ok, true, 'security evidence system check passes');
  equal(result.failures.length, 0, 'security evidence system reports no failures');
}

function testRequiredIndexesAreRegistered(): void {
  for (const docPath of [
    'docs/audit/README.md',
    'docs/audit/report-index.md',
    'docs/audit/finding-index.md',
    'docs/audit/live-proof-register.md',
    'docs/audit/control-map.md',
    'docs/research/README.md',
  ]) {
    ok(SECURITY_EVIDENCE_DOCS.includes(docPath), `${docPath} is registered as a required evidence doc`);
  }
}

function testHighSignalFindingsAreSeeded(): void {
  for (const finding of ['B-081', 'B-033', 'Customer PEP no-bypass', 'Required PR reviews']) {
    ok(REQUIRED_FINDINGS.includes(finding), `${finding} is seeded in the required finding index set`);
  }
}

function testLiveProofRegisterIsSeeded(): void {
  for (const proofId of ['LP-HTTPS-EDGE', 'LP-CUSTOMER-PEP-NO-BYPASS', 'LP-KMS-RUNTIME-SIGNING', 'LP-FINDING-TEST-COVERAGE']) {
    ok(REQUIRED_LIVE_PROOFS.includes(proofId), `${proofId} is seeded in the live proof register`);
  }
}

function testPrTemplateEvidenceFieldsAreSeeded(): void {
  for (const field of ['Finding index updated:', 'Live proof register updated:', 'Evidence system exception:']) {
    ok(REQUIRED_PR_TEMPLATE_FIELDS.includes(field), `${field} is required in the PR evidence system section`);
  }
}

testSecurityEvidenceSystemPasses();
testRequiredIndexesAreRegistered();
testHighSignalFindingsAreSeeded();
testLiveProofRegisterIsSeeded();
testPrTemplateEvidenceFieldsAreSeeded();

console.log(`Security evidence system tests: ${passed} passed, 0 failed`);
