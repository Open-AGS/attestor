import { strict as assert } from 'node:assert';
import { createPrivateKey, sign } from 'node:crypto';
import {
  RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE,
  type IssuedReleaseEvidencePack,
  type ReleaseEvidenceStatement,
} from '../src/release-kernel/release-evidence-pack.js';
import { canonicalizeReleaseJson } from '../src/release-kernel/release-canonicalization.js';

let passed = 0;

export const VALID_PROVENANCE_DIGEST = `sha256:${'a'.repeat(64)}`;

export function passedCount(): number {
  return passed;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp | ErrorConstructor, message: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

function dssePreAuthEncoding(payloadType: string, payload: Buffer): Buffer {
  const payloadTypeBuffer = Buffer.from(payloadType, 'utf-8');
  return Buffer.concat([
    Buffer.from('DSSEv1 ', 'utf-8'),
    Buffer.from(String(payloadTypeBuffer.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payloadTypeBuffer,
    Buffer.from(' ', 'utf-8'),
    Buffer.from(String(payload.length), 'utf-8'),
    Buffer.from(' ', 'utf-8'),
    payload,
  ]);
}

export function resignEvidencePackStatement(input: {
  readonly issuedEvidencePack: IssuedReleaseEvidencePack;
  readonly statement: ReleaseEvidenceStatement;
  readonly privateKeyPem: string;
}): IssuedReleaseEvidencePack {
  const payload = Buffer.from(canonicalizeReleaseJson(input.statement as never), 'utf-8');
  const signature = sign(
    null,
    dssePreAuthEncoding(RELEASE_EVIDENCE_PACK_DSSE_PAYLOAD_TYPE, payload),
    createPrivateKey(input.privateKeyPem),
  );

  return {
    ...input.issuedEvidencePack,
    statement: input.statement,
    envelope: {
      ...input.issuedEvidencePack.envelope,
      payload: payload.toString('base64'),
      signatures: [
        {
          ...input.issuedEvidencePack.envelope.signatures[0]!,
          sig: signature.toString('base64'),
        },
      ],
    },
  };
}

export function makeFinanceReport(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'api-finance-release-evidence',
    timestamp: '2026-04-17T23:30:00.000Z',
    decision: 'pending_approval',
    certificate: { certificateId: 'cert_finance_release_evidence' },
    evidenceChain: { terminalHash: VALID_PROVENANCE_DIGEST, intact: true },
    execution: {
      success: true,
      rows: [
        {
          counterparty_name: 'Bank of Nova Scotia',
          exposure_usd: 250000000,
          credit_rating: 'AA-',
          sector: 'Banking',
        },
        {
          counterparty_name: 'BNP Paribas',
          exposure_usd: 185000000,
          credit_rating: 'A+',
          sector: 'Banking',
        },
      ],
    },
    liveProof: {
      mode: 'live_runtime',
      consistent: true,
    },
    receipt: {
      receiptStatus: 'withheld',
    },
    oversight: {
      status: 'pending',
    },
    escrow: {
      state: 'held',
    },
    filingReadiness: {
      status: 'internal_report_ready',
    },
    audit: {
      chainIntact: true,
    },
    attestation: {
      manifestHash: 'manifest_hash_release_evidence',
    },
    ...overrides,
  } as any;
}
