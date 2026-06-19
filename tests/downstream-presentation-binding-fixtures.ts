import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionRequest,
  type ConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';

let passed = 0;

export function passedCount(): number { return passed; }

export function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
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

export function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp, message: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

export function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-01T12:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'presentation-binding-payment',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/payment-adapter',
    },
    proposedConsequence: {
      actor: 'AI-assisted payment workflow',
      action: 'prepare supplier payment dispatch',
      downstreamSystem: 'supplier-payment-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'AI-assisted workflow asks to dispatch a supplier payment.',
    },
    policyScope: {
      policyRef: 'policy:payments:v1',
      tenantId: 'tenant_payments',
      environment: 'production',
      dimensions: {
        domain: 'money-movement',
      },
    },
    authority: {
      actorRef: 'actor:payment-agent',
      reviewerRef: 'reviewer:finance-ops',
      authorityMode: 'named-reviewer',
    },
    evidence: [
      {
        id: 'evidence:invoice',
        kind: 'invoice',
        digest: 'sha256:invoice',
        uri: null,
      },
    ],
    nativeInputRefs: ['amount', 'recipient', 'idempotencyKey'],
  });
}

export function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for presentation binding coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

export function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed admission checks.',
    reasonCodes: ['payment-admitted'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_payment_presentation',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
      },
    ],
  });
}

export function admittedPaymentWithReceiptAndReleaseToken(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed admission checks with receipt and release proof.',
    reasonCodes: ['payment-admitted'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'admission-receipt',
        id: 'generic-admission:payment-receipt',
        digest: 'sha256:payment-receipt',
        uri: null,
        verifyHint: 'This proves Attestor produced an admission response, not downstream execution authority.',
      },
      {
        kind: 'release-token',
        id: 'rt_payment_presentation',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
      },
    ],
  });
}

export function receiptOnlyPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:01.500Z',
    decision: 'admit',
    reason: 'Payment consequence has an admission receipt only.',
    reasonCodes: ['payment-admission-receipt-only'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'admission-receipt',
        id: 'generic-admission:payment-receipt-only',
        digest: 'sha256:payment-receipt-only',
        uri: null,
        verifyHint: 'This proves Attestor produced an admission response, not downstream execution authority.',
      },
    ],
  });
}

export const RAW_NARROW_CONSTRAINT_ID = 'constraint:max-amount';
export const RAW_NARROW_CONSTRAINT_SUMMARY =
  'private-policy-threshold: payment amount must not exceed 250 EUR.';

export function narrowedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T12:00:02.000Z',
    decision: 'narrow',
    reason: 'Payment can proceed only below the bounded amount.',
    reasonCodes: ['payment-narrowed'],
    checks: [passCheck('policy'), passCheck('authority'), passCheck('evidence')],
    constraints: [
      {
        id: RAW_NARROW_CONSTRAINT_ID,
        summary: RAW_NARROW_CONSTRAINT_SUMMARY,
        enforcedBy: 'supplier-payment-service',
      },
    ],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_payment_presentation_narrow',
        digest: 'sha256:narrow-token',
        uri: null,
        verifyHint: 'Verify the narrow release token before dispatch.',
      },
    ],
  });
}

export function paymentContract(): ConsequenceAdmissionDownstreamContract {
  return createConsequenceAdmissionDownstreamContract({
    enforcementPointId: 'payment-adapter:supplier-payment-service',
    boundaryKind: 'payment-adapter',
    consequenceDomain: 'money-movement',
    downstreamSystems: ['supplier-payment-service'],
    acceptedConsequenceKinds: ['action', 'agent-payment'],
    acceptedRiskClasses: ['R3', 'R4'],
    policyRefs: ['policy:payments:v1'],
    environment: 'production',
  });
}

export function paymentBinding(admission = admittedPayment()) {
  return createConsequenceAdmissionPresentationBinding({
    admission,
    contract: paymentContract(),
    target: {
      uri: 'https://payments.example.internal/supplier-payments',
      method: 'POST',
      bodyDigest: 'sha256:payment-body',
    },
    replayKey: 'payment:tenant_a:invoice_1938:attempt_1',
    nonce: 'nonce:payment-adapter:001',
    presentedAt: '2026-05-01T12:00:05.000Z',
    expiresAt: '2026-05-01T12:01:05.000Z',
  });
}

export const EXPECTED = {
  targetUri: 'https://payments.example.internal/supplier-payments',
  method: 'POST',
  bodyDigest: 'sha256:payment-body',
  nonce: 'nonce:payment-adapter:001',
  requireBodyDigest: true,
  requireReplayKey: true,
  requireNonce: true,
  maxFreshnessSeconds: 60,
};
