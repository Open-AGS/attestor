import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCustomerAdmissionGateExample } from '../examples/customer-admission-gate.js';
import { createReleaseDecisionSkeleton, type ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import { generateKeyPair } from '../src/signing/keys.js';
import { createEnforcementRequest, type EnforcementRequest } from '../src/release-enforcement-plane/object-model.js';
import {
  createDpopBoundPresentationFromIssuedToken,
  createDpopProof,
  generateDpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import { verifyOnlineReleaseAuthorization } from '../src/release-enforcement-plane/online-verifier.js';
import {
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_RELEASE_ENFORCEMENT_VERSION,
  CONSEQUENCE_ADMISSION_CUSTOMER_GATE_SIGNED_BEARER_VERSION,
  ConsequenceAdmissionGateHeldError,
  ConsequenceAdmissionReleaseEnforcementGateHeldError,
  ConsequenceAdmissionSignedBearerGateHeldError,
  assertConsequenceAdmissionGateAllowsReleaseEnforcement,
  assertConsequenceAdmissionGateAllows,
  assertConsequenceAdmissionGateAllowsSignedBearerToken,
  createConsequenceAdmissionFacadeResponse,
  createGenericAdmissionEnvelope,
  evaluateConsequenceAdmissionGate,
  evaluateConsequenceAdmissionGateWithReleaseEnforcement,
  evaluateConsequenceAdmissionGateWithSignedBearerToken,
  type FinancePipelineAdmissionRun,
} from '../src/consequence-admission/index.js';

let passed = 0;
const PROTECTED_POLICY_HASH = 'sha256:customer-gate-protected-policy';
const PROTECTED_POLICY_IR_HASH = 'sha256:customer-gate-protected-policy-ir';
const PROTECTED_OUTPUT_HASH = 'sha256:customer-gate-protected-output';
const PROTECTED_CONSEQUENCE_HASH = 'sha256:customer-gate-protected-consequence';
const PROTECTED_COMPILED_POLICY_INDEX_VERSION = 'attestor.customer-gate.policy-index.test.v1';
const PROTECTED_COMPILED_POLICY_IR_VERSION = 'attestor.customer-gate.policy-ir.test.v1';

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
      planId: 'trial',
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

function validGenericMoneyAdmission(mode: 'observe' | 'enforce') {
  return createGenericAdmissionEnvelope({
    mode,
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T18:00:00.000Z',
    decidedAt: '2026-05-01T18:00:01.000Z',
    tenantId: 'tenant_customer_gate',
    policyRef: 'policy:refunds:v1',
    reviewerRef: 'reviewer:risk-owner',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: [{
      sourceKind: 'verified-approval',
      claimKind: 'approval',
      sourceRef: 'approval:refund:987',
      evidenceDigest: `sha256:${'a'.repeat(64)}`,
    }],
    approvals: [{
      approvalRef: 'approval:refund:987',
      sourceKind: 'approval-workflow',
      state: 'approved',
      sourceRef: 'workflow:refund-approval:987',
      reviewerRef: 'reviewer:risk-owner',
      reviewerAuthorityDigest: `sha256:${'b'.repeat(64)}`,
      approvalDigest: `sha256:${'c'.repeat(64)}`,
      scopeDigest: `sha256:${'d'.repeat(64)}`,
      issuedAt: '2026-05-01T17:00:00.000Z',
      expiresAt: '2026-05-01T19:00:00.000Z',
      signatureVerified: true,
    }],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });
}

function testNonEnforcingAdmissionCannotPassCustomerGate(): void {
  const envelope = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });
  const gate = evaluateConsequenceAdmissionGate({
    admission: envelope.admission,
    downstreamAction: 'refund-service.issueRefund',
  });

  equal(envelope.admission.allowed, true, 'Customer gate: observe admission can remain adoption-visible');
  equal(gate.outcome, 'hold', 'Customer gate: observe admission cannot execute');
  equal(gate.failClosed, true, 'Customer gate: observe admission holds fail closed');
  ok(
    gate.reasonCodes.includes('customer-gate-non-enforcing-mode-held'),
    'Customer gate: non-enforcing mode hold reason is explicit',
  );
  assert.throws(
    () =>
      assertConsequenceAdmissionGateAllows({
        admission: envelope.admission,
        downstreamAction: 'refund-service.issueRefund',
      }),
    ConsequenceAdmissionGateHeldError,
  );
  passed += 1;
}

function testAdmissionReceiptAloneDoesNotSatisfyExecutionProof(): void {
  const envelope = validGenericMoneyAdmission('enforce');
  const gate = evaluateConsequenceAdmissionGate({
    admission: envelope.admission,
    downstreamAction: 'refund-service.issueRefund',
  });

  equal(envelope.admission.allowed, true, 'Customer gate: complete generic enforce admission remains admitted');
  equal(envelope.admission.proof[0]?.kind, 'admission-receipt', 'Customer gate: generic proof is an admission receipt');
  equal(gate.outcome, 'hold', 'Customer gate: admission receipt alone does not execute');
  equal(gate.proofSatisfied, false, 'Customer gate: execution proof excludes admission receipts');
  ok(
    gate.reasonCodes.includes('customer-gate-execution-proof-required'),
    'Customer gate: execution proof requirement is explicit',
  );
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

function protectedPolicyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.customer-gate-release-enforcement-test',
    policySpecVersion: 'attestor.release-policy.v1',
    policyHash: PROTECTED_POLICY_HASH,
    compiledPolicyHash: PROTECTED_POLICY_HASH,
    compiledPolicyIrHash: PROTECTED_POLICY_IR_HASH,
    compiledPolicyIndexVersion: PROTECTED_COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: PROTECTED_COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

function protectedCustomerGateRequest(input: {
  readonly downstreamAction: string;
  readonly tokenId: string;
  readonly decisionId: string;
  readonly uri?: string;
}): EnforcementRequest {
  return createEnforcementRequest({
    id: 'customer-gate-protected-request',
    receivedAt: '2026-05-15T10:01:00.000Z',
    enforcementPoint: {
      environment: 'test',
      enforcementPointId: 'customer-gate-protected-pep',
      pointKind: 'record-write-gateway',
      boundaryKind: 'record-write',
      consequenceType: 'record',
      riskClass: 'R4',
      tenantId: 'tenant_customer_gate',
      accountId: 'acct_customer_gate',
      workloadId: 'spiffe://attestor.test/ns/customer-gate/sa/record-writer',
      audience: input.downstreamAction,
    },
    targetId: input.downstreamAction,
    outputHash: PROTECTED_OUTPUT_HASH,
    consequenceHash: PROTECTED_CONSEQUENCE_HASH,
    releaseTokenId: input.tokenId,
    releaseDecisionId: input.decisionId,
    transport: {
      kind: 'http',
      method: 'POST',
      uri: input.uri ?? 'https://customer.example.test/reporting/write?debug=true#discarded',
      headersDigest: 'sha256:customer-gate-protected-headers',
      bodyDigest: 'sha256:customer-gate-protected-body',
    },
  });
}

async function createProtectedDpopReleaseEnforcement(input: {
  readonly downstreamAction: string;
  readonly tenantId: string;
  readonly consumeOnSuccess: boolean;
}) {
  const dpopKey = await generateDpopKeyPair();
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.customer-gate.protected.test',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const decision = createReleaseDecisionSkeleton({
    id: 'decision-customer-gate-protected',
    createdAt: '2026-05-15T10:00:00.000Z',
    status: 'accepted',
    policyVersion: 'customer.gate.release-enforcement.v1',
    policyHash: PROTECTED_POLICY_HASH,
    policyProvenance: protectedPolicyProvenance(),
    outputHash: PROTECTED_OUTPUT_HASH,
    consequenceHash: PROTECTED_CONSEQUENCE_HASH,
    outputContract: {
      artifactType: 'customer-gate.release-enforcement',
      expectedShape: 'sender-constrained release-enforcement proof for protected customer gate execution',
      consequenceType: 'record',
      riskClass: 'R4',
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
      kind: 'record-store',
      id: input.downstreamAction,
    },
  });
  const issued = await issuer.issue({
    decision,
    audience: input.downstreamAction,
    tenantId: input.tenantId,
    issuedAt: '2026-05-15T10:00:00.000Z',
    ttlSeconds: 300,
    confirmation: { jkt: dpopKey.publicKeyThumbprint },
  });
  const request = protectedCustomerGateRequest({
    downstreamAction: input.downstreamAction,
    tokenId: issued.tokenId,
    decisionId: decision.id,
  });
  const proof = await createDpopProof({
    privateJwk: dpopKey.privateJwk,
    publicJwk: dpopKey.publicJwk,
    httpMethod: 'POST',
    httpUri: request.transport?.kind === 'http' ? request.transport.uri : '',
    accessToken: issued.token,
    nonce: 'nonce-customer-gate-protected',
    proofJti: 'dpop-proof-customer-gate-protected',
    issuedAt: '2026-05-15T10:01:00.000Z',
  });
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  store.registerIssuedToken({ issuedToken: issued, decision });
  const releaseEnforcement = await verifyOnlineReleaseAuthorization({
    request,
    presentation: createDpopBoundPresentationFromIssuedToken({
      issuedToken: issued,
      proof,
      presentedAt: '2026-05-15T10:01:00.000Z',
    }),
    verificationKey: await issuer.exportVerificationKey(),
    now: '2026-05-15T10:01:10.000Z',
    introspector,
    usageStore: store,
    consumeOnSuccess: input.consumeOnSuccess,
    replayLedgerEntry: null,
    nonceLedgerEntry: {
      nonce: 'nonce-customer-gate-protected',
      issuedAt: '2026-05-15T10:00:50.000Z',
      expiresAt: '2026-05-15T10:01:30.000Z',
    },
    resourceServerId: 'customer-gate-protected-pep',
  });

  return {
    issued,
    proof,
    releaseEnforcement,
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

async function testReleaseEnforcementGateAllowsSenderConstrainedVerifiedToken(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const tenantId = 'tenant_customer_gate';
  const { issued, proof, releaseEnforcement } = await createProtectedDpopReleaseEnforcement({
    downstreamAction,
    tenantId,
    consumeOnSuccess: true,
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
        verifyHint: 'Use release-enforcement-plane online verification before running the protected customer gate action.',
      },
    ]),
  };
  const gate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission,
    downstreamAction,
    releaseEnforcement,
    releaseTokenDigest: digestBearerToken(issued.token),
  });
  const serialized = JSON.stringify(gate);

  equal(
    gate.version,
    CONSEQUENCE_ADMISSION_CUSTOMER_GATE_RELEASE_ENFORCEMENT_VERSION,
    'Customer gate release enforcement: version is stable',
  );
  equal(gate.baseGateVersion, CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION, 'Customer gate release enforcement: base gate version is retained');
  equal(gate.outcome, 'proceed', 'Customer gate release enforcement: verified sender-constrained token proceeds');
  equal(gate.releaseEnforcement.valid, true, 'Customer gate release enforcement: release-enforcement proof is valid');
  equal(gate.releaseEnforcement.status, 'valid', 'Customer gate release enforcement: online verifier status is valid');
  equal(gate.releaseEnforcement.onlineChecked, true, 'Customer gate release enforcement: online introspection was checked');
  equal(gate.releaseEnforcement.replayConsumed, true, 'Customer gate release enforcement: replay usage was consumed');
  equal(gate.releaseEnforcement.presentationMode, 'dpop-bound-token', 'Customer gate release enforcement: DPoP presentation mode is recorded');
  equal(gate.releaseEnforcement.senderConstrained, true, 'Customer gate release enforcement: sender constraint is recorded');
  equal(gate.releaseEnforcement.proofRefMatched, true, 'Customer gate release enforcement: admission proof ref is matched');
  equal(gate.releaseEnforcement.rawReleaseTokenStored, false, 'Customer gate release enforcement: raw release token is not stored');
  equal(serialized.includes(issued.token), false, 'Customer gate release enforcement: decision does not serialize raw token');
  equal(serialized.includes(proof.proofJwt), false, 'Customer gate release enforcement: decision does not serialize raw DPoP proof JWT');
  ok(
    gate.reasonCodes.includes('customer-gate-release-enforcement-valid'),
    'Customer gate release enforcement: valid reason code is present',
  );

  const asserted = assertConsequenceAdmissionGateAllowsReleaseEnforcement({
    admission,
    downstreamAction,
    releaseEnforcement,
    releaseTokenDigest: digestBearerToken(issued.token),
  });
  equal(asserted.outcome, 'proceed', 'Customer gate release enforcement: assert helper returns proceed decision');
}

async function testReleaseEnforcementGateRequiresReplayConsumption(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const tenantId = 'tenant_customer_gate';
  const { issued, releaseEnforcement } = await createProtectedDpopReleaseEnforcement({
    downstreamAction,
    tenantId,
    consumeOnSuccess: false,
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
        verifyHint: 'Use release-enforcement-plane online verification before running the protected customer gate action.',
      },
    ]),
  };
  const gate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission,
    downstreamAction,
    releaseEnforcement,
    releaseTokenDigest: digestBearerToken(issued.token),
  });

  equal(gate.outcome, 'hold', 'Customer gate release enforcement: missing replay consumption holds');
  equal(gate.releaseEnforcement.valid, false, 'Customer gate release enforcement: missing replay consumption is invalid');
  ok(
    gate.releaseEnforcement.failureReasons.includes('replay-consumption-required'),
    'Customer gate release enforcement: replay consumption failure is explicit',
  );

  assert.throws(
    () =>
      assertConsequenceAdmissionGateAllowsReleaseEnforcement({
        admission,
        downstreamAction,
        releaseEnforcement,
        releaseTokenDigest: digestBearerToken(issued.token),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConsequenceAdmissionReleaseEnforcementGateHeldError);
      assert.ok(error.gateDecision.releaseEnforcement.failureReasons.includes('replay-consumption-required'));
      return true;
    },
  );
  passed += 1;
}

async function testReleaseEnforcementGateRequiresAdmissionProofBinding(): Promise<void> {
  const downstreamAction = 'customer_reporting_store.write';
  const tenantId = 'tenant_customer_gate';
  const { issued, releaseEnforcement } = await createProtectedDpopReleaseEnforcement({
    downstreamAction,
    tenantId,
    consumeOnSuccess: true,
  });
  const gate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: admissionFor(financeRunFixture()),
    downstreamAction,
    releaseEnforcement,
    releaseTokenDigest: digestBearerToken(issued.token),
  });

  equal(gate.outcome, 'hold', 'Customer gate release enforcement: missing release-token proof ref holds');
  ok(
    gate.releaseEnforcement.failureReasons.includes('proof-ref-missing'),
    'Customer gate release enforcement: missing proof ref failure is explicit',
  );
}

function testExampleAndDocs(): void {
  const result = runCustomerAdmissionGateExample();
  const readme = readProjectFile('README.md');
  const integrationHub = readProjectFile('docs', '01-overview', 'how-to-integrate-attestor.md');
  const doc = readProjectFile('docs', '01-overview', 'customer-admission-gate.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  includes(result.output, 'Customer-side Attestor admission gate', 'Customer gate example: has title');
  includes(result.output, 'Customer gate: PROCEED', 'Customer gate example: shows proceed');
  includes(result.output, 'Customer gate: HOLD', 'Customer gate example: shows hold');
  includes(result.output, 'Customer system enforces the gate', 'Customer gate example: names enforcement responsibility');

  includes(integrationHub, '[Customer admission gate](customer-admission-gate.md)', 'Integration hub: links customer gate docs');
  includes(doc, 'npm run example:customer-gate', 'Customer gate doc: includes runnable command');
  includes(doc, 'assertConsequenceAdmissionGateAllows', 'Customer gate doc: includes copy-paste helper');
  includes(doc, 'This page shows customer-side gate helpers.', 'Customer gate doc: keeps route boundary honest');
  includes(doc, 'execution proof by itself.', 'Customer gate doc: admission receipt is not execution proof');
  includes(doc, 'The hosted admission API, crypto', 'Customer gate doc: keeps route and crypto boundaries honest');
  includes(doc, 'domain selection', 'Customer gate doc: keeps domain selection explicit');
  includes(doc, 'Signed bearer compatibility path', 'Customer gate doc: documents signed bearer compatibility');
  includes(doc, 'does not store the raw bearer token', 'Customer gate doc: signed bearer path is secret-safe');
  includes(doc, 'bearer-token compatibility path', 'Customer gate doc: bearer-only path is described as compatibility');
  includes(doc, 'Release-enforcement proof path', 'Customer gate doc: documents release-enforcement proof path');
  includes(doc, 'assertConsequenceAdmissionGateAllowsReleaseEnforcement', 'Customer gate doc: includes release-enforcement helper');
  includes(doc, 'sender-constrained, online-checked, replay-consumed', 'Customer gate doc: protected path requires sender constraint, online liveness, and replay consumption');
  includes(doc, 'store the raw release token or sender proof', 'Customer gate doc: release-enforcement path is secret-safe');
  includes(readme, 'then [customer gate](docs/01-overview/customer-admission-gate.md)', 'README: links the next integration step');

  equal(packageJson.scripts['example:customer-gate'], 'tsx examples/customer-admission-gate.ts', 'Package: customer gate example script exists');
  equal(packageJson.scripts['test:consequence-admission-customer-gate'], 'tsx tests/consequence-admission-customer-gate.test.ts', 'Package: customer gate test script exists');
  includes(packageJson.scripts.test, 'scripts/run/run-suite.mjs test', 'Package: npm test delegates to the suite runner');
  includes(packageJson.scripts.verify, 'scripts/run/run-suite.mjs verify', 'Package: verify delegates to the suite runner');
}

testProceedGate();
testHoldGate();
testRequiredProofHoldsEvenWhenNativeDecisionPassed();
testDefaultProofRequirementHoldsAdmittedResponseWithoutProof();
testRequiredCheckFailureHoldsEvenWithProof();
testAssertGateThrowsWhenHeld();
testNonEnforcingAdmissionCannotPassCustomerGate();
testAdmissionReceiptAloneDoesNotSatisfyExecutionProof();
await testSignedBearerGateAllowsMatchingReleaseToken();
await testSignedBearerGateFailsClosedWithoutProofMatch();
await testSignedBearerGateRejectsBearerOnlyUpgradeForProtectedTokens();
await testReleaseEnforcementGateAllowsSenderConstrainedVerifiedToken();
await testReleaseEnforcementGateRequiresReplayConsumption();
await testReleaseEnforcementGateRequiresAdmissionProofBinding();
testExampleAndDocs();

console.log(`Consequence admission customer gate tests: ${passed} passed, 0 failed`);
