import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCustomerAdmissionGateExample } from '../examples/customer-admission-gate.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import { generateKeyPair } from '../src/signing/keys.js';
import {
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION,
  ConsequenceAdmissionGateHeldError,
  ConsequenceAdmissionSignedBearerGateHeldError,
  assertConsequenceAdmissionGateAllows,
  assertConsequenceAdmissionGateAllowsSignedBearerToken,
  createConsequenceAdmissionFacadeResponse,
  evaluateConsequenceAdmissionGate,
  evaluateConsequenceAdmissionGateWithSignedBearerToken,
  type FinancePipelineAdmissionRun,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function digestBearerToken(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

function financeRunFixture(
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
      planId: 'community',
    },
    ...overrides,
  };
}

function admissionFor(run: FinancePipelineAdmissionRun) {
  return createConsequenceAdmissionFacadeResponse({
    surface: 'finance-pipeline-run',
    run,
    decidedAt: '2026-04-23T18:30:00.000Z',
  });
}

function testProceedGate(): void {
  const gate = evaluateConsequenceAdmissionGate({
    admission: admissionFor(financeRunFixture()),
    downstreamAction: 'customer_reporting_store.write',
    requireProof: true,
  });

  equal(gate.version, CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION, 'Customer gate: version is stable');
  equal(gate.outcome, 'proceed', 'Customer gate: admitted response proceeds');
  equal(gate.failClosed, false, 'Customer gate: proceed is not fail closed');
  equal(gate.proofSatisfied, true, 'Customer gate: proof requirement is satisfied');
  equal(gate.proofRefs.length, 2, 'Customer gate: proof refs are preserved');
  includes(gate.instruction, 'Run downstream action', 'Customer gate: instruction allows downstream action');
  ok(gate.reasonCodes.includes('customer-gate-proceed'), 'Customer gate: reason codes include proceed');
}

function testHoldGate(): void {
  const gate = evaluateConsequenceAdmissionGate({
    admission: admissionFor(financeRunFixture({
      decision: 'fail',
      certificate: null,
      verification: null,
      auditChainIntact: false,
    })),
    downstreamAction: 'customer_message_sender.send',
    requireProof: false,
  });

  equal(gate.outcome, 'hold', 'Customer gate: blocked response holds');
  equal(gate.failClosed, true, 'Customer gate: hold is fail closed');
  equal(gate.proofSkippedByCaller, true, 'Customer gate: explicit proof skip is telemetry-visible');
  includes(gate.instruction, 'Do not run downstream action', 'Customer gate: instruction blocks downstream action');
  ok(gate.reasonCodes.includes('customer-gate-hold'), 'Customer gate: reason codes include hold');
  ok(
    gate.reasonCodes.includes('customer-gate-proof-skipped-by-caller'),
    'Customer gate: proof skip reason is explicit',
  );
}

function testRequiredProofHoldsEvenWhenNativeDecisionPassed(): void {
  const gate = evaluateConsequenceAdmissionGate({
    admission: admissionFor(financeRunFixture({
      certificate: null,
      verification: null,
    })),
    downstreamAction: 'customer_reporting_store.write',
    requireProof: true,
  });

  equal(gate.decision, 'admit', 'Customer gate: native allow still maps to admit');
  equal(gate.outcome, 'hold', 'Customer gate: missing required proof holds');
  equal(gate.proofSatisfied, false, 'Customer gate: proof requirement fails');
  ok(gate.reasonCodes.includes('customer-gate-proof-required'), 'Customer gate: reason codes include proof requirement');
}

function testDefaultProofRequirementHoldsAdmittedResponseWithoutProof(): void {
  const gate = evaluateConsequenceAdmissionGate({
    admission: admissionFor(financeRunFixture({
      certificate: null,
      verification: null,
    })),
    downstreamAction: 'customer_reporting_store.write',
  });

  equal(gate.decision, 'admit', 'Customer gate: native allow is still visible');
  equal(gate.proofRequired, true, 'Customer gate: admit decisions require proof by default');
  equal(gate.outcome, 'hold', 'Customer gate: admitted response without proof holds by default');
  ok(gate.reasonCodes.includes('customer-gate-proof-required'), 'Customer gate: default proof requirement is explicit');
}

function testRequiredCheckFailureHoldsEvenWithProof(): void {
  const gate = evaluateConsequenceAdmissionGate({
    admission: admissionFor(financeRunFixture({
      warrant: 'missing',
      escrow: 'held',
      receipt: 'missing',
      capsule: 'open',
    })),
    downstreamAction: 'customer_reporting_store.write',
  });

  equal(gate.proofSatisfied, true, 'Customer gate: proof can be satisfied independently');
  equal(gate.proofSkippedByCaller, false, 'Customer gate: satisfied proof is not marked skipped');
  equal(gate.outcome, 'hold', 'Customer gate: failed required admission checks hold the consequence');
  ok(gate.reasonCodes.includes('customer-gate-required-check-failed'), 'Customer gate: required check failure is explicit');
  ok(gate.reasonCodes.includes('customer-gate-required-authority-failed'), 'Customer gate: failed authority check is named');
}

function testAssertGateThrowsWhenHeld(): void {
  assert.throws(
    () =>
      assertConsequenceAdmissionGateAllows({
        admission: admissionFor(financeRunFixture({ decision: 'fail' })),
        downstreamAction: 'customer_message_sender.send',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConsequenceAdmissionGateHeldError);
      assert.equal(error.gateDecision.outcome, 'hold');
      return true;
    },
  );
  passed += 1;
}

async function issueCustomerGateReleaseToken(input: {
  readonly downstreamAction: string;
  readonly tenantId: string;
  readonly riskClass?: 'R1' | 'R3';
  readonly confirmation?: { readonly jkt: string };
}) {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.customer-gate.test',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const decision = createReleaseDecisionSkeleton({
    id: `decision-${input.downstreamAction}`,
    createdAt: '2026-05-15T10:00:00.000Z',
    status: 'accepted',
    policyVersion: 'customer.gate.release.v1',
    policyHash: 'sha256:customer-gate-policy',
    outputHash: 'sha256:customer-gate-output',
    consequenceHash: 'sha256:customer-gate-consequence',
    outputContract: {
      artifactType: 'customer-gate.release-token',
      expectedShape: 'signed bearer release token for a customer gate downstream action',
      consequenceType: 'action',
      riskClass: input.riskClass ?? 'R1',
    },
    capabilityBoundary: {
      allowedTools: ['customer-gate'],
      allowedTargets: [input.downstreamAction],
      allowedDataDomains: ['customer-gate-test'],
    },
    requester: {
      id: 'svc.customer-gate-test',
      type: 'service',
    },
    target: {
      kind: 'custom',
      id: input.downstreamAction,
    },
  });
  const issued = await issuer.issue({
    decision,
    audience: input.downstreamAction,
    tenantId: input.tenantId,
    issuedAt: '2026-05-15T10:00:00.000Z',
    ttlSeconds: 300,
    confirmation: input.confirmation,
  });

  return {
    issued,
    verificationKey: await issuer.exportVerificationKey(),
  };
}

async function testSignedBearerGateAllowsMatchingReleaseToken(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const tenantId = 'tenant_customer_gate';
  const { issued, verificationKey } = await issueCustomerGateReleaseToken({
    downstreamAction,
    tenantId,
  });
  const baseAdmission = admissionFor(financeRunFixture());
  const admission = {
    ...baseAdmission,
    proof: Object.freeze([
      ...baseAdmission.proof,
      {
        kind: 'release-token' as const,
        id: issued.tokenId,
        digest: digestBearerToken(issued.token),
        uri: null,
        verifyHint: 'Verify the signed bearer release token before running the customer gate action.',
      },
    ]),
  };
  const gate = await evaluateConsequenceAdmissionGateWithSignedBearerToken({
    admission,
    downstreamAction,
    authorizationHeader: `Bearer ${issued.token}`,
    verificationKey,
    currentDate: '2026-05-15T10:01:00.000Z',
  });
  const serialized = JSON.stringify(gate);

  equal(
    gate.version,
    CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION,
    'Customer gate signed bearer: version is stable',
  );
  equal(gate.baseGateVersion, CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION, 'Customer gate signed bearer: base gate version is retained');
  equal(gate.outcome, 'proceed', 'Customer gate signed bearer: matching release token proceeds');
  equal(gate.signedBearer.valid, true, 'Customer gate signed bearer: signed bearer verification is valid');
  equal(gate.signedBearer.signatureVerified, true, 'Customer gate signed bearer: signature is verified');
  equal(gate.signedBearer.proofRefMatched, true, 'Customer gate signed bearer: token matches admission proof ref');
  equal(gate.signedBearer.rawBearerTokenStored, false, 'Customer gate signed bearer: raw bearer token is not stored');
  equal(serialized.includes(issued.token), false, 'Customer gate signed bearer: decision does not serialize raw token');
  ok(gate.reasonCodes.includes('customer-gate-signed-bearer-valid'), 'Customer gate signed bearer: valid reason code is present');
}

async function testSignedBearerGateFailsClosedWithoutProofMatch(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const { issued, verificationKey } = await issueCustomerGateReleaseToken({
    downstreamAction,
    tenantId: 'tenant_customer_gate',
  });
  const gate = await evaluateConsequenceAdmissionGateWithSignedBearerToken({
    admission: admissionFor(financeRunFixture()),
    downstreamAction,
    bearerToken: issued.token,
    verificationKey,
    currentDate: '2026-05-15T10:01:00.000Z',
  });

  equal(gate.outcome, 'hold', 'Customer gate signed bearer: missing release-token proof holds');
  equal(gate.signedBearer.valid, false, 'Customer gate signed bearer: missing proof ref invalidates token presentation');
  ok(
    gate.signedBearer.failureReasons.includes('proof-ref-missing'),
    'Customer gate signed bearer: missing proof ref failure is explicit',
  );
}

async function testSignedBearerGateRejectsBearerOnlyUpgradeForProtectedTokens(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const tenantId = 'tenant_customer_gate';
  const { issued, verificationKey } = await issueCustomerGateReleaseToken({
    downstreamAction,
    tenantId,
    riskClass: 'R3',
  });
  const baseAdmission = admissionFor(financeRunFixture());
  const admission = {
    ...baseAdmission,
    proof: Object.freeze([
      ...baseAdmission.proof,
      {
        kind: 'release-token' as const,
        id: issued.tokenId,
        digest: digestBearerToken(issued.token),
        uri: null,
        verifyHint: 'Use release-enforcement-plane for protected token presentation.',
      },
    ]),
  };
  const gate = await evaluateConsequenceAdmissionGateWithSignedBearerToken({
    admission,
    downstreamAction,
    bearerToken: issued.token,
    verificationKey,
    currentDate: '2026-05-15T10:01:00.000Z',
  });

  equal(gate.outcome, 'hold', 'Customer gate signed bearer: introspection-required token holds');
  equal(gate.signedBearer.introspectionRequired, true, 'Customer gate signed bearer: introspection requirement is visible');
  ok(
    gate.signedBearer.failureReasons.includes('introspection-required'),
    'Customer gate signed bearer: introspection-required failure is explicit',
  );

  await assert.rejects(
    () =>
      assertConsequenceAdmissionGateAllowsSignedBearerToken({
        admission,
        downstreamAction,
        bearerToken: issued.token,
        verificationKey,
        currentDate: '2026-05-15T10:01:00.000Z',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConsequenceAdmissionSignedBearerGateHeldError);
      assert.ok(error.gateDecision.signedBearer.failureReasons.includes('introspection-required'));
      return true;
    },
  );
  passed += 1;
}

function testExampleAndDocs(): void {
  const result = runCustomerAdmissionGateExample();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '01-overview', 'customer-admission-gate.md');
  const tryFirst = readProjectFile('docs', '01-overview', 'try-attestor-first.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  includes(result.output, 'Customer-side Attestor admission gate', 'Customer gate example: has title');
  includes(result.output, 'Customer gate: PROCEED', 'Customer gate example: shows proceed');
  includes(result.output, 'Customer gate: HOLD', 'Customer gate example: shows hold');
  includes(result.output, 'Customer system enforces the gate', 'Customer gate example: names enforcement responsibility');

  includes(readme, 'docs/01-overview/customer-admission-gate.md', 'README: links customer gate docs');
  includes(doc, 'npm run example:customer-gate', 'Customer gate doc: includes runnable command');
  includes(doc, 'assertConsequenceAdmissionGateAllows', 'Customer gate doc: includes copy-paste helper');
  includes(doc, 'This helper is not the hosted admission API.', 'Customer gate doc: keeps route boundary honest');
  includes(doc, '`POST /api/v1/admissions`', 'Customer gate doc: points to the generic route');
  includes(doc, 'This does not add a public hosted crypto route.', 'Customer gate doc: keeps crypto boundary honest');
  includes(doc, 'This does not auto-detect packs from payload shape.', 'Customer gate doc: rejects auto detection');
  includes(doc, 'Signed bearer compatibility path', 'Customer gate doc: documents signed bearer compatibility');
  includes(doc, 'does not store the raw bearer token', 'Customer gate doc: signed bearer path is secret-safe');
  includes(doc, 'not protected production enforcement', 'Customer gate doc: bearer-only path does not overclaim production enforcement');
  includes(tryFirst, '[Customer admission gate](customer-admission-gate.md)', 'Try-first doc: links the next integration step');

  equal(packageJson.scripts['example:customer-gate'], 'tsx examples/customer-admission-gate.ts', 'Package: customer gate example script exists');
  equal(packageJson.scripts['test:consequence-admission-customer-gate'], 'tsx tests/consequence-admission-customer-gate.test.ts', 'Package: customer gate test script exists');
  includes(packageJson.scripts.test, 'scripts/run-suite.mjs test', 'Package: npm test delegates to the suite runner');
  includes(packageJson.scripts.verify, 'scripts/run-suite.mjs verify', 'Package: verify delegates to the suite runner');
}

testProceedGate();
testHoldGate();
testRequiredProofHoldsEvenWhenNativeDecisionPassed();
testDefaultProofRequirementHoldsAdmittedResponseWithoutProof();
testRequiredCheckFailureHoldsEvenWithProof();
testAssertGateThrowsWhenHeld();
await testSignedBearerGateAllowsMatchingReleaseToken();
await testSignedBearerGateFailsClosedWithoutProofMatch();
await testSignedBearerGateRejectsBearerOnlyUpgradeForProtectedTokens();
testExampleAndDocs();

console.log(`Consequence admission customer gate tests: ${passed} passed, 0 failed`);
