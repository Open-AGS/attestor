import assert from 'node:assert/strict';
import { buildAttestationPack, verifyAttestation } from '../src/financial/attestation.js';
import {
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
} from '../src/financial/fixtures/scenarios.js';
import { runFinancialPipeline } from '../src/financial/pipeline.js';
import { issueReceipt, verifyReceipt } from '../src/financial/receipt.js';

const signingKey = 'test-financial-hmac-key';

function buildPassingReport() {
  return runFinancialPipeline({
    runId: 'financial-hmac-verification',
    intent: COUNTERPARTY_INTENT,
    candidateSql: COUNTERPARTY_SQL,
    fixtures: [COUNTERPARTY_FIXTURE],
    generatedReport: COUNTERPARTY_REPORT,
    reportContract: COUNTERPARTY_REPORT_CONTRACT,
  });
}

function mutateHexDigest(digest: string): string {
  return `${digest.slice(0, -1)}${digest.endsWith('0') ? '1' : '0'}`;
}

function testAttestationHmacVerification(): void {
  const report = buildPassingReport();
  const pack = buildAttestationPack(report, signingKey);
  assert.equal(pack.signatureMode, 'hmac_sha256');
  assert.equal(verifyAttestation(pack, signingKey).signatureVerified, true);

  assert.equal(
    verifyAttestation({ ...pack, signature: mutateHexDigest(pack.signature!) }, signingKey).signatureVerified,
    false,
  );
  assert.equal(verifyAttestation({ ...pack, signature: 'not-hex' }, signingKey).signatureVerified, false);
  assert.equal(verifyAttestation({ ...pack, signature: pack.signature!.slice(2) }, signingKey).signatureVerified, false);
}

function testReceiptHmacVerification(): void {
  const report = buildPassingReport();
  const receipt = issueReceipt(report, signingKey);
  assert.equal(receipt.signatureMode, 'hmac_sha256');
  assert.equal(verifyReceipt(receipt, signingKey).signatureValid, true);

  assert.equal(
    verifyReceipt({ ...receipt, signature: mutateHexDigest(receipt.signature!) }, signingKey).signatureValid,
    false,
  );
  assert.equal(verifyReceipt({ ...receipt, signature: 'not-hex' }, signingKey).signatureValid, false);
  assert.equal(verifyReceipt({ ...receipt, signature: receipt.signature!.slice(2) }, signingKey).signatureValid, false);
}

testAttestationHmacVerification();
testReceiptHmacVerification();

console.log('Financial HMAC verification tests: 2 passed, 0 failed');
