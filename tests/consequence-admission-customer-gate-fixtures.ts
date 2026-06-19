import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createConsequenceAdmissionFacadeResponse,
  type FinancePipelineAdmissionRun,
} from '../src/consequence-admission/index.js';

let passed = 0;

export const PROTECTED_POLICY_HASH = 'sha256:customer-gate-protected-policy';
export const PROTECTED_POLICY_IR_HASH = 'sha256:customer-gate-protected-policy-ir';
export const PROTECTED_OUTPUT_HASH = 'sha256:customer-gate-protected-output';
export const PROTECTED_CONSEQUENCE_HASH = 'sha256:customer-gate-protected-consequence';
export const PROTECTED_COMPILED_POLICY_INDEX_VERSION = 'attestor.customer-gate.policy-index.test.v1';
export const PROTECTED_COMPILED_POLICY_IR_VERSION = 'attestor.customer-gate.policy-ir.test.v1';

export function passedCount(): number {
  return passed;
}

export function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

export function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function throws(
  fn: () => unknown,
  expected: RegExp | ErrorConstructor | ((error: unknown) => boolean),
): void {
  assert.throws(fn, expected);
  passed += 1;
}

export async function rejects(fn: () => Promise<unknown>, expected: (error: unknown) => boolean): Promise<void> {
  await assert.rejects(fn, expected);
  passed += 1;
}

export function digestBearerToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export function financeRunFixture(
  overrides: Partial<FinancePipelineAdmissionRun> = {},
): FinancePipelineAdmissionRun {
  return {
    runId: 'run_customer_gate_001',
    decision: 'pass',
    proofMode: 'offline_fixture',
    warrant: 'issued',
    escrow: 'released',
    receipt: 'issued',
    capsule: 'closed',
    auditChainIntact: true,
    certificate: {
      certificateId: 'cert_customer_gate_001',
      signing: {
        fingerprint: 'fingerprint_customer_gate_001',
      },
    },
    verification: {
      digest: 'sha256:customer-gate',
    },
    tenantContext: {
      tenantId: 'tenant_customer_gate',
      source: 'hosted',
      planId: 'trial',
    },
    ...overrides,
  };
}

export function admissionFor(run: FinancePipelineAdmissionRun) {
  return createConsequenceAdmissionFacadeResponse({
    surface: 'finance-pipeline-run',
    run,
    decidedAt: '2026-04-23T18:30:00.000Z',
  });
}
