import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
  consequenceAdmissionDownstreamContractDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  evaluateConsequenceAdmissionDownstreamContract,
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
  assert.equal(actual, expected);
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
    requestedAt: '2026-05-01T10:00:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'supplier-payment-gate',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/payment-adapter',
    },
    proposedConsequence: {
      actor: 'AI-assisted procurement workflow',
      action: 'prepare supplier payment dispatch',
      downstreamSystem: 'supplier-payment-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'AI-assisted workflow asks to send a supplier payment to the payment service.',
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
      actorRef: 'actor:procurement-agent',
      reviewerRef: 'reviewer:finance-ops',
      authorityMode: 'named-reviewer',
    },
    evidence: [
      {
        id: 'evidence:supplier-invoice',
        kind: 'invoice',
        digest: 'sha256:invoice',
        uri: null,
      },
    ],
    nativeInputRefs: ['supplierId', 'amount', 'destinationAccount'],
  });
}

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for the proposed downstream consequence.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedPayment(): ConsequenceAdmissionResponse {
  return createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T10:00:01.000Z',
    decision: 'admit',
    reason: 'Payment consequence passed policy, authority, evidence, freshness, and enforcement checks.',
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
        id: 'rt_supplier_payment',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before dispatching payment.',
      },
    ],
  });
}

function paymentContract() {
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

function testDescriptor(): void {
  const descriptor = consequenceAdmissionDownstreamContractDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
    'Downstream contract: descriptor exposes stable version',
  );
  ok(
    descriptor.boundaryKinds.includes('payment-adapter'),
    'Downstream contract: payment adapter is a boundary kind',
  );
  ok(
    descriptor.bindingFields.includes('idempotency-key'),
    'Downstream contract: idempotency is a first-class binding',
  );
  deepEqual(
    descriptor.executableDecisions,
    ['admit', 'narrow'],
    'Downstream contract: only admit and narrow are executable',
  );
  ok(
    descriptor.failureReasons.includes('narrow-constraints-unacknowledged'),
    'Downstream contract: narrow constraint failure is explicit',
  );
  equal(
    descriptor.decisionExposesRawConstraints,
    false,
    'Downstream contract: descriptor declares raw constraints are not exposed',
  );
  equal(
    descriptor.decisionConstraintReferenceMode,
    'digests-only',
    'Downstream contract: descriptor declares digest-only constraint refs',
  );
  equal(
    descriptor.executionProofExcludesAdmissionReceipt,
    true,
    'Downstream contract: descriptor declares admission receipts are not execution proof',
  );
}

function testMatchingAdmissionAllowsDownstreamAction(): void {
  const decision = evaluateConsequenceAdmissionDownstreamContract({
    admission: admittedPayment(),
    contract: paymentContract(),
    observation: {
      idempotencyKey: 'idem:supplier-payment:001',
    },
  });

  equal(decision.outcome, 'allow', 'Downstream contract: matching admission allows payment adapter');
  equal(decision.allowed, true, 'Downstream contract: allowed flag is true on allow');
  equal(decision.failClosed, false, 'Downstream contract: failClosed is false only on allow');
  equal(decision.proofSatisfied, true, 'Downstream contract: proof is satisfied');
  equal(decision.idempotencySatisfied, true, 'Downstream contract: idempotency is satisfied');
  equal(decision.failureReasons.length, 0, 'Downstream contract: allow carries no failure reasons');
}

function testAdmissionReceiptAloneDoesNotSatisfyProofRequirement(): void {
  const receiptOnlyAdmission = createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T10:00:01.500Z',
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
        id: 'generic-admission:receipt-only',
        digest: 'sha256:admission-receipt',
        uri: null,
        verifyHint: 'This proves Attestor produced an admission response, not downstream execution authority.',
      },
    ],
  });
  const decision = evaluateConsequenceAdmissionDownstreamContract({
    admission: receiptOnlyAdmission,
    contract: paymentContract(),
    observation: {
      idempotencyKey: 'idem:supplier-payment:receipt-only',
    },
  });

  equal(
    receiptOnlyAdmission.allowed,
    true,
    'Downstream contract: receipt-only admission can remain admitted at response level',
  );
  equal(decision.outcome, 'hold', 'Downstream contract: receipt-only proof holds');
  equal(decision.proofSatisfied, false, 'Downstream contract: admission receipt is not execution proof');
  deepEqual(
    decision.failureReasons,
    ['proof-missing'],
    'Downstream contract: receipt-only proof fails as missing execution proof',
  );
  ok(
    decision.reasonCodes.includes('downstream-contract-proof-missing'),
    'Downstream contract: proof-missing reason code is explicit',
  );
}

function testContractFailsClosedOnMissingIdempotencyAndWrongSystem(): void {
  const missingReplay = evaluateConsequenceAdmissionDownstreamContract({
    admission: admittedPayment(),
    contract: paymentContract(),
  });
  const wrongSystem = evaluateConsequenceAdmissionDownstreamContract({
    admission: admittedPayment(),
    contract: paymentContract(),
    observation: {
      downstreamSystem: 'unapproved-payment-service',
      idempotencyKey: 'idem:supplier-payment:002',
    },
  });

  equal(missingReplay.outcome, 'hold', 'Downstream contract: missing idempotency holds');
  deepEqual(
    missingReplay.failureReasons,
    ['idempotency-key-missing'],
    'Downstream contract: missing idempotency reason is precise',
  );
  equal(wrongSystem.outcome, 'hold', 'Downstream contract: wrong downstream system holds');
  deepEqual(
    wrongSystem.failureReasons,
    ['downstream-system-mismatch'],
    'Downstream contract: downstream mismatch reason is precise',
  );
}

function testContractFailsClosedOnNonExecutableDecision(): void {
  const reviewAdmission = createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T10:00:02.000Z',
    decision: 'review',
    reason: 'Payment requires human review.',
    reasonCodes: ['payment-review-required'],
  });
  const decision = evaluateConsequenceAdmissionDownstreamContract({
    admission: reviewAdmission,
    contract: paymentContract(),
    observation: {
      idempotencyKey: 'idem:supplier-payment:003',
    },
  });

  equal(decision.outcome, 'hold', 'Downstream contract: review does not execute');
  deepEqual(
    decision.failureReasons,
    ['admission-not-allowed', 'admission-fail-closed', 'decision-not-executable'],
    'Downstream contract: review failure reasons show why it cannot execute',
  );
}

function testNarrowRequiresConstraintAcknowledgement(): void {
  const rawConstraintSummary = 'private-policy-threshold: payment amount must not exceed 250 EUR.';
  const narrowAdmission = createConsequenceAdmissionResponse({
    request: paymentRequest(),
    decidedAt: '2026-05-01T10:00:03.000Z',
    decision: 'narrow',
    reason: 'Payment can proceed only below the risk limit.',
    reasonCodes: ['payment-narrowed'],
    constraints: [
      {
        id: 'constraint:max-amount',
        summary: rawConstraintSummary,
        enforcedBy: 'supplier-payment-service',
      },
    ],
    checks: [passCheck('policy'), passCheck('authority'), passCheck('evidence')],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_supplier_payment_narrow',
        digest: 'sha256:narrow-token',
        uri: null,
        verifyHint: 'Verify the narrow release token before dispatching payment.',
      },
    ],
  });
  const held = evaluateConsequenceAdmissionDownstreamContract({
    admission: narrowAdmission,
    contract: paymentContract(),
    observation: {
      idempotencyKey: 'idem:supplier-payment:004',
    },
  });
  const allowed = evaluateConsequenceAdmissionDownstreamContract({
    admission: narrowAdmission,
    contract: paymentContract(),
    observation: {
      idempotencyKey: 'idem:supplier-payment:005',
      acceptedConstraintIds: ['constraint:max-amount'],
    },
  });
  const serializedDecisions = JSON.stringify({ held, allowed });

  equal(held.outcome, 'hold', 'Downstream contract: narrow without constraint acknowledgement holds');
  deepEqual(
    held.failureReasons,
    ['narrow-constraints-unacknowledged'],
    'Downstream contract: narrow constraint reason is precise',
  );
  equal(allowed.outcome, 'allow', 'Downstream contract: acknowledged narrow constraint allows bounded action');
  equal(
    Object.prototype.hasOwnProperty.call(allowed, 'constraints'),
    false,
    'Downstream contract: decision does not carry raw constraint objects',
  );
  equal(
    allowed.constraintRefs.length,
    1,
    'Downstream contract: decision carries one redacted constraint ref',
  );
  ok(
    allowed.constraintRefs[0]?.idDigest.startsWith('sha256:'),
    'Downstream contract: constraint id is represented by digest',
  );
  equal(
    allowed.constraintRefs[0]?.kind,
    'max-amount',
    'Downstream contract: constraint ref carries machine-readable kind',
  );
  equal(
    allowed.constraintRefs[0]?.parameterDigest,
    null,
    'Downstream contract: constraint ref carries null parameter digest when none is provided',
  );
  ok(
    allowed.constraintRefs[0]?.constraintDigest.startsWith('sha256:'),
    'Downstream contract: constraint body is represented by digest',
  );
  equal(
    serializedDecisions.includes(rawConstraintSummary),
    false,
    'Downstream contract: decision serialization omits raw constraint summary',
  );
  equal(
    serializedDecisions.includes('constraint:max-amount'),
    false,
    'Downstream contract: decision serialization omits raw constraint id',
  );
}

function testDomainAndPolicyScopeMustMatch(): void {
  const wrongDomainContract = createConsequenceAdmissionDownstreamContract({
    enforcementPointId: 'wallet-adapter:main',
    boundaryKind: 'wallet-adapter',
    consequenceDomain: 'programmable-money',
    downstreamSystems: ['supplier-payment-service'],
    acceptedConsequenceKinds: ['action'],
    acceptedRiskClasses: ['R3'],
    policyRefs: ['policy:payments:v1'],
  });
  const wrongPolicyContract = createConsequenceAdmissionDownstreamContract({
    enforcementPointId: 'payment-adapter:supplier-payment-service',
    boundaryKind: 'payment-adapter',
    consequenceDomain: 'money-movement',
    downstreamSystems: ['supplier-payment-service'],
    acceptedConsequenceKinds: ['action'],
    acceptedRiskClasses: ['R3'],
    policyRefs: ['policy:payments:v2'],
  });

  const wrongDomain = evaluateConsequenceAdmissionDownstreamContract({
    admission: admittedPayment(),
    contract: wrongDomainContract,
    observation: {
      idempotencyKey: 'idem:supplier-payment:006',
    },
  });
  const wrongPolicy = evaluateConsequenceAdmissionDownstreamContract({
    admission: admittedPayment(),
    contract: wrongPolicyContract,
    observation: {
      idempotencyKey: 'idem:supplier-payment:007',
    },
  });

  deepEqual(
    wrongDomain.failureReasons,
    ['consequence-domain-mismatch'],
    'Downstream contract: consequence domain mismatch is explicit',
  );
  deepEqual(
    wrongPolicy.failureReasons,
    ['policy-ref-mismatch'],
    'Downstream contract: policy mismatch is explicit',
  );
}

function testDocsAndScriptsExposeContract(): void {
  const readme = readProjectFile('README.md');
  const contractDoc = readProjectFile('docs', '02-architecture', 'downstream-enforcement-contract.md');
  const taxonomyDoc = readProjectFile('docs', '02-architecture', 'consequence-taxonomy.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/downstream-enforcement-contract.md',
    'Downstream contract: README links contract doc',
  );
  includes(
    contractDoc,
    'Attestor is only a gateway if the downstream system refuses to act without an admissible Attestor decision.',
    'Downstream contract: doc opens with customer-side enforcement boundary',
  );
  includes(
    contractDoc,
    'The downstream decision therefore does not echo raw constraint `summary`, `enforcedBy`, or constraint id values.',
    'Downstream contract: doc states raw constraints stay out of decisions',
  );
  includes(
    contractDoc,
    '`constraintRefs`',
    'Downstream contract: doc names digest-only constraint refs',
  );
  includes(
    taxonomyDoc,
    '[Downstream enforcement contract](downstream-enforcement-contract.md)',
    'Downstream contract: taxonomy links contract',
  );
  includes(
    systemOverview,
    '[Downstream enforcement contract](downstream-enforcement-contract.md)',
    'Downstream contract: system overview links contract',
  );
  equal(
    packageJson.scripts['test:downstream-enforcement-contract'],
    'tsx tests/downstream-enforcement-contract.test.ts',
    'Downstream contract: focused test script is exposed',
  );
}

testDescriptor();
testMatchingAdmissionAllowsDownstreamAction();
testAdmissionReceiptAloneDoesNotSatisfyProofRequirement();
testContractFailsClosedOnMissingIdempotencyAndWrongSystem();
testContractFailsClosedOnNonExecutableDecision();
testNarrowRequiresConstraintAcknowledgement();
testDomainAndPolicyScopeMustMatch();
testDocsAndScriptsExposeContract();

console.log(`Downstream enforcement contract tests: ${passed} passed, 0 failed`);
