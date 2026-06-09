import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
  consequenceAdmissionAdapterFrameworkDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionProtectedAdapter,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  type ConsequenceAdmissionCheck,
  type ConsequenceAdmissionRequest,
  type ConsequenceAdmissionResponse,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-02T19:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'adapter-framework-payment-tool',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/tool-wrapper',
    },
    proposedConsequence: {
      actor: 'procurement-ai-agent',
      action: 'submit_supplier_payment',
      downstreamSystem: 'supplier-payment-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'AI-assisted procurement agent proposes a supplier payment.',
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
      actorRef: 'actor:procurement-ai-agent',
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

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for protected adapter coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-02T19:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed adapter framework admission checks.',
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
        id: 'rt_adapter_framework_payment',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatching payment.',
      },
    ],
  });
}

function blockedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-02T19:00:01.000Z',
    decision: 'block',
    reason: 'Payment consequence was blocked before adapter execution.',
    reasonCodes: ['policy-blocked'],
  });
}

function paymentAdapter() {
  return createConsequenceAdmissionProtectedAdapter({
    adapterId: 'tool-wrapper:supplier-payment-service',
    adapterKind: 'tool-wrapper',
    verifierRef: 'tool-wrapper:supplier-payment-service',
    now: () => '2026-05-02T19:00:02.000Z',
    contract: {
      enforcementPointId: 'tool-wrapper:supplier-payment-service',
      boundaryKind: 'action-dispatcher',
      consequenceDomain: 'money-movement',
      downstreamSystems: ['supplier-payment-service'],
      acceptedConsequenceKinds: ['action', 'agent-payment'],
      acceptedRiskClasses: ['R3', 'R4'],
      policyRefs: ['policy:payments:v1'],
      environment: 'production',
    },
  });
}

function testDescriptor(): void {
  const descriptor = consequenceAdmissionAdapterFrameworkDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_ADAPTER_FRAMEWORK_VERSION,
    'Adapter framework: descriptor exposes stable version',
  );
  ok(
    descriptor.adapterKinds.includes('mcp-tool-wrapper'),
    'Adapter framework: MCP tool wrapper is an adapter kind',
  );
  ok(
    descriptor.adapterKinds.includes('tool-wrapper'),
    'Adapter framework: generic tool wrapper is an adapter kind',
  );
  equal(descriptor.verifiesBeforeExecute, true, 'Adapter framework: verifies before execute');
  equal(descriptor.rawExecuteExposed, false, 'Adapter framework: raw execute is not exposed');
  equal(descriptor.storesRawInputsExternally, false, 'Adapter framework: raw inputs are not exported');
  equal(descriptor.storesRawResultsExternally, false, 'Adapter framework: raw results are not exported');
}

function testProtectedAdapterExecutesOnlyAfterVerification(): void {
  let executionCount = 0;
  const adapter = paymentAdapter();
  const decision = adapter.run({
    admission: admittedPayment(),
    observation: {
      downstreamSystem: 'supplier-payment-service',
      idempotencyKey: 'idem:payment:adapter:001',
    },
    inputDigest: 'sha256:payment-command',
    execute: (verification) => {
      executionCount += 1;
      return {
        paymentId: 'pay_001',
        verificationDigest: verification.receiptDigest,
      };
    },
  });

  equal(adapter.rawExecuteExposed, false, 'Adapter framework: adapter does not expose raw executor');
  equal(decision.outcome, 'executed', 'Adapter framework: verified admission executes');
  equal(decision.executed, true, 'Adapter framework: executed flag is true');
  equal(decision.failClosed, false, 'Adapter framework: successful execution is not fail-closed');
  equal(executionCount, 1, 'Adapter framework: executor called exactly once');
  ok(
    decision.execution?.resultDigest.startsWith('sha256:'),
    'Adapter framework: execution result is stored as digest',
  );
  equal(
    JSON.stringify(decision).includes('idem:payment:adapter:001'),
    false,
    'Adapter framework: raw idempotency key is not exported',
  );
  equal(
    JSON.stringify(decision).includes('pay_001'),
    false,
    'Adapter framework: raw result is not exported',
  );
}

function testHeldVerificationDoesNotExecute(): void {
  let executionCount = 0;
  const decision = paymentAdapter().run({
    admission: admittedPayment(),
    observation: {
      downstreamSystem: 'supplier-payment-service',
    },
    execute: () => {
      executionCount += 1;
      return { paymentId: 'pay_should_not_run' };
    },
  });

  equal(decision.outcome, 'held', 'Adapter framework: missing idempotency holds');
  equal(decision.executed, false, 'Adapter framework: held decision does not execute');
  equal(decision.failClosed, true, 'Adapter framework: held decision fails closed');
  equal(executionCount, 0, 'Adapter framework: executor is not called on hold');
  deepEqual(
    decision.failureReasons,
    ['verification-held'],
    'Adapter framework: held failure reason is precise',
  );
  ok(
    decision.verification.downstreamDecision.failureReasons.includes('idempotency-key-missing'),
    'Adapter framework: downstream verification reason remains attached',
  );
}

function testBlockedAdmissionDoesNotExecute(): void {
  let executionCount = 0;
  const decision = paymentAdapter().run({
    admission: blockedPayment(),
    observation: {
      downstreamSystem: 'supplier-payment-service',
      idempotencyKey: 'idem:payment:adapter:002',
    },
    execute: () => {
      executionCount += 1;
      return { paymentId: 'pay_blocked' };
    },
  });

  equal(decision.outcome, 'held', 'Adapter framework: blocked admission holds');
  equal(executionCount, 0, 'Adapter framework: blocked admission does not execute');
  ok(
    decision.verification.downstreamDecision.failureReasons.includes('decision-not-executable'),
    'Adapter framework: blocked admission carries decision-not-executable reason',
  );
}

function testExecutorFailureIsRecordedWithoutRawError(): void {
  const decision = paymentAdapter().run({
    admission: admittedPayment(),
    observation: {
      downstreamSystem: 'supplier-payment-service',
      idempotencyKey: 'idem:payment:adapter:003',
    },
    execute: () => {
      throw new Error('provider secret error body should not be exposed');
    },
  });

  equal(decision.outcome, 'execution-failed', 'Adapter framework: executor throw records failure');
  equal(decision.executed, false, 'Adapter framework: failed execution is not treated as executed');
  equal(decision.failClosed, true, 'Adapter framework: failed execution fails closed');
  deepEqual(
    decision.failureReasons,
    ['executor-threw'],
    'Adapter framework: executor failure reason is precise',
  );
  ok(
    decision.execution?.resultDigest.startsWith('sha256:'),
    'Adapter framework: executor error is digested',
  );
  equal(
    JSON.stringify(decision).includes('provider secret error body'),
    false,
    'Adapter framework: raw downstream error is not exported',
  );
}

function testDocsAndScriptsExposeAdapterFramework(): void {
  const readme = readProjectFile('README.md');
  const adapterDoc = readProjectFile('docs', '02-architecture', 'adapter-framework.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    '[How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)',
    'Adapter framework: README links the integration guide',
  );
  includes(
    adapterDoc,
    'verify before execute',
    'Adapter framework: doc states verify-before-execute rule',
  );
  includes(
    systemOverview,
    '[Adapter framework](adapter-framework.md)',
    'Adapter framework: system overview links doc',
  );
  equal(
    packageJson.scripts['test:consequence-admission-adapter-framework'],
    'tsx tests/consequence-admission-adapter-framework.test.ts',
    'Adapter framework: focused test script is exposed',
  );
}

testDescriptor();
testProtectedAdapterExecutesOnlyAfterVerification();
testHeldVerificationDoesNotExecute();
testBlockedAdmissionDoesNotExecute();
testExecutorFailureIsRecordedWithoutRawError();
testDocsAndScriptsExposeAdapterFramework();

console.log(`Consequence admission adapter framework tests: ${passed} passed, 0 failed`);
