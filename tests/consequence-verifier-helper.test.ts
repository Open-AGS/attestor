import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
  ConsequenceAdmissionVerificationHeldError,
  assertConsequenceAdmissionVerifiedForDownstream,
  consequenceAdmissionVerifierHelperDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionVerifier,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  verifyConsequenceAdmissionForDownstream,
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

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function paymentRequest(): ConsequenceAdmissionRequest {
  return createConsequenceAdmissionRequest({
    requestedAt: '2026-05-01T11:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'payment-verifier-helper',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/payment-adapter',
    },
    proposedConsequence: {
      actor: 'AI-assisted payment workflow',
      action: 'prepare payment dispatch',
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

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for verifier helper coverage.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T11:00:01.000Z',
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
        id: 'rt_payment_verifier_helper',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatch.',
      },
    ],
  });
}

const CONTRACT_INPUT = {
  enforcementPointId: 'payment-adapter:supplier-payment-service',
  boundaryKind: 'payment-adapter' as const,
  consequenceDomain: 'money-movement' as const,
  downstreamSystems: ['supplier-payment-service'],
  acceptedConsequenceKinds: ['action', 'agent-payment'] as const,
  acceptedRiskClasses: ['R3', 'R4'] as const,
  policyRefs: ['policy:payments:v1'],
  environment: 'production',
};

function testDescriptor(): void {
  const descriptor = consequenceAdmissionVerifierHelperDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    'Verifier helper: descriptor exposes stable version',
  );
  equal(
    descriptor.verifies,
    'downstream-contract-binding',
    'Verifier helper: descriptor names downstream contract binding',
  );
  equal(
    descriptor.cryptographicTokenVerification,
    false,
    'Verifier helper: descriptor does not overclaim cryptographic token verification',
  );
  equal(descriptor.failClosed, true, 'Verifier helper: descriptor is fail-closed');
}

function testVerifyReturnsStructuredAllow(): void {
  const verification = verifyConsequenceAdmissionForDownstream({
    admission: admittedPayment(),
    contract: CONTRACT_INPUT,
    verifiedAt: '2026-05-01T11:00:02.000Z',
    verifierRef: 'payment-adapter:supplier-payment-service',
    observation: {
      idempotencyKey: 'idem:payment:001',
    },
  });

  equal(verification.verified, true, 'Verifier helper: matching downstream contract verifies');
  equal(verification.failClosed, false, 'Verifier helper: successful verification is not fail-closed');
  equal(verification.downstreamDecision.outcome, 'allow', 'Verifier helper: downstream decision allows');
  ok(verification.receiptDigest.startsWith('sha256:'), 'Verifier helper: verification has digest-shaped receipt');
  ok(
    verification.reasonCodes.includes('verifier-helper-verified'),
    'Verifier helper: verified reason code is present',
  );
}

function testCreateVerifierAssertAllowsAndCarriesStableDefaults(): void {
  const verifier = createConsequenceAdmissionVerifier({
    verifierRef: 'payment-adapter:supplier-payment-service',
    contract: CONTRACT_INPUT,
    now: () => '2026-05-01T11:00:03.000Z',
  });
  const verification = verifier.assert({
    admission: admittedPayment(),
    observation: {
      idempotencyKey: 'idem:payment:002',
    },
  });

  equal(
    verifier.version,
    CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    'Verifier helper: created helper carries version',
  );
  equal(
    verification.verifiedAt,
    '2026-05-01T11:00:03.000Z',
    'Verifier helper: helper now callback controls verifiedAt',
  );
  equal(
    verification.verifierRef,
    'payment-adapter:supplier-payment-service',
    'Verifier helper: default verifier ref is applied',
  );
  equal(verification.verified, true, 'Verifier helper: assert returns verification on allow');
}

function testAssertThrowsFailClosedOnHold(): void {
  const verifier = createConsequenceAdmissionVerifier({
    contract: CONTRACT_INPUT,
    now: () => '2026-05-01T11:00:04.000Z',
  });

  assert.throws(
    () =>
      verifier.assert({
        admission: admittedPayment(),
      }),
    (error: unknown) => {
      ok(
        error instanceof ConsequenceAdmissionVerificationHeldError,
        'Verifier helper: held assertion throws typed error',
      );
      if (error instanceof ConsequenceAdmissionVerificationHeldError) {
        equal(error.verification.verified, false, 'Verifier helper: typed error carries held verification');
        equal(error.verification.failClosed, true, 'Verifier helper: held verification fails closed');
        ok(
          error.verification.downstreamDecision.failureReasons.includes('idempotency-key-missing'),
          'Verifier helper: held verification carries downstream failure reason',
        );
      }
      return true;
    },
    'Verifier helper: assert throws when contract holds',
  );
  passed += 1;
}

function testStandaloneAssertUsesSameError(): void {
  assert.throws(
    () =>
      assertConsequenceAdmissionVerifiedForDownstream({
        admission: admittedPayment(),
        contract: CONTRACT_INPUT,
        verifiedAt: '2026-05-01T11:00:05.000Z',
      }),
    ConsequenceAdmissionVerificationHeldError,
    'Verifier helper: standalone assert throws held error',
  );
  passed += 1;
}

function testDocsAndScriptsExposeHelper(): void {
  const readme = readProjectFile('README.md');
  const helperDoc = readProjectFile('docs', '02-architecture', 'verifier-helper.md');
  const contractDoc = readProjectFile('docs', '02-architecture', 'downstream-enforcement-contract.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/downstream-enforcement-contract.md',
    'Verifier helper: README links the downstream contract',
  );
  includes(
    helperDoc,
    'It does not replace cryptographic release-token verification.',
    'Verifier helper: doc does not overclaim token verification',
  );
  includes(
    contractDoc,
    '[Verifier helper](verifier-helper.md)',
    'Verifier helper: downstream contract doc links helper',
  );
  includes(
    systemOverview,
    '[Verifier helper](verifier-helper.md)',
    'Verifier helper: system overview links helper',
  );
  equal(
    packageJson.scripts['test:consequence-verifier-helper'],
    'tsx tests/consequence-verifier-helper.test.ts',
    'Verifier helper: focused test script is exposed',
  );
}

testDescriptor();
testVerifyReturnsStructuredAllow();
testCreateVerifierAssertAllowsAndCarriesStableDefaults();
testAssertThrowsFailClosedOnHold();
testStandaloneAssertUsesSameError();
testDocsAndScriptsExposeHelper();

console.log(`Consequence verifier helper tests: ${passed} passed, 0 failed`);
