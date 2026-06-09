import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_POLICY_LIMIT_VERSION,
  consequenceAdmissionDescriptor,
  consequenceAdmissionPolicyLimitDescriptor,
  createConsequenceAdmissionPolicyLimitSet,
  evaluateConsequenceAdmissionPolicyLimits,
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

function paymentLimitSet() {
  return createConsequenceAdmissionPolicyLimitSet({
    id: 'limits:payments:v1',
    policyRef: 'policy:payments:v1',
    consequenceDomain: 'money-movement',
    limits: [
      {
        id: 'limit:amount',
        kind: 'amount',
        label: 'Supplier payment amount cap',
        consequenceDomain: 'money-movement',
        maxAmount: 250,
        currency: 'EUR',
        breachAction: 'narrow',
      },
      {
        id: 'limit:recipient',
        kind: 'recipient-allowlist',
        label: 'Supplier recipient allowlist',
        consequenceDomain: 'money-movement',
        allowedRecipients: ['supplier_copper_yard', 'supplier_steel_works'],
        breachAction: 'block',
      },
      {
        id: 'limit:velocity',
        kind: 'velocity',
        label: 'Procurement payment velocity',
        consequenceDomain: 'money-movement',
        maxCount: 3,
        windowSeconds: 3600,
        subject: 'procurement-agent',
        breachAction: 'block',
      },
      {
        id: 'limit:review-threshold',
        kind: 'human-review-threshold',
        label: 'High-value payment review',
        consequenceDomain: 'money-movement',
        thresholdAmount: 1000,
        currency: 'EUR',
        breachAction: 'review',
      },
      {
        id: 'limit:risk',
        kind: 'risk-class-ceiling',
        label: 'Payment risk ceiling',
        consequenceDomain: 'money-movement',
        maxRiskClass: 'R3',
        breachAction: 'block',
      },
    ],
  });
}

function passingPaymentObservation() {
  return {
    consequenceKind: 'action' as const,
    amount: {
      value: 240,
      currency: 'EUR',
    },
    recipient: 'supplier_steel_works',
    velocity: {
      count: 2,
      windowSeconds: 3600,
      subject: 'procurement-agent',
    },
    riskClass: 'R3' as const,
  };
}

function testDescriptorAndAdmissionDescriptorExposeLimitVocabulary(): void {
  const descriptor = consequenceAdmissionPolicyLimitDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_POLICY_LIMIT_VERSION,
    'Policy limits: descriptor exposes stable version',
  );
  ok(descriptor.limitKinds.includes('amount'), 'Policy limits: amount limit is present');
  ok(descriptor.limitKinds.includes('velocity'), 'Policy limits: velocity limit is present');
  ok(descriptor.limitKinds.includes('recipient-allowlist'), 'Policy limits: recipient allowlist is present');
  ok(descriptor.limitKinds.includes('human-review-threshold'), 'Policy limits: review threshold is present');
  ok(descriptor.breachActions.includes('narrow'), 'Policy limits: narrow breach action is present');
  equal(
    descriptor.failClosedOnMissingRequiredMeasurement,
    true,
    'Policy limits: missing required measurements fail closed',
  );
  ok(
    descriptor.velocityMeasurementSources.includes('shared-durable-counter'),
    'Policy limits: descriptor exposes shared durable velocity source',
  );
  equal(
    descriptor.supportsSharedVelocitySourceRequirement,
    true,
    'Policy limits: descriptor supports requiring shared velocity measurements',
  );
  ok(
    admissionDescriptor.policyLimitKinds.includes('data-scope'),
    'Policy limits: admission descriptor exposes policy limit kinds',
  );
  ok(
    admissionDescriptor.policyLimitBreachActions.includes('block'),
    'Policy limits: admission descriptor exposes breach actions',
  );
}

function testPassingObservationAdmits(): void {
  const evaluation = evaluateConsequenceAdmissionPolicyLimits({
    limitSet: paymentLimitSet(),
    observation: passingPaymentObservation(),
  });

  equal(evaluation.decision, 'admit', 'Policy limits: passing payment admits');
  equal(evaluation.allowed, true, 'Policy limits: admitted evaluation is allowed');
  equal(evaluation.failClosed, false, 'Policy limits: admitted evaluation is not fail-closed');
  equal(evaluation.constraints.length, 0, 'Policy limits: passing payment carries no constraints');
  ok(
    evaluation.reasonCodes.includes('policy-limit-decision-admit'),
    'Policy limits: admit decision reason code is present',
  );
}

function testAmountBreachNarrowsWithConstraint(): void {
  const evaluation = evaluateConsequenceAdmissionPolicyLimits({
    limitSet: paymentLimitSet(),
    observation: {
      ...passingPaymentObservation(),
      amount: {
        value: 300,
        currency: 'EUR',
      },
    },
  });

  equal(evaluation.decision, 'narrow', 'Policy limits: amount cap breach narrows');
  equal(evaluation.allowed, true, 'Policy limits: narrow remains allowed with constraints');
  equal(evaluation.constraints.length, 1, 'Policy limits: narrow carries an explicit constraint');
  equal(
    evaluation.constraints[0]?.summary,
    'Maximum amount is 250 EUR.',
    'Policy limits: amount constraint is concrete',
  );
}

function testRecipientBreachBlocks(): void {
  const evaluation = evaluateConsequenceAdmissionPolicyLimits({
    limitSet: paymentLimitSet(),
    observation: {
      ...passingPaymentObservation(),
      recipient: 'unknown_supplier',
    },
  });

  equal(evaluation.decision, 'block', 'Policy limits: unapproved recipient blocks');
  equal(evaluation.allowed, false, 'Policy limits: blocked evaluation is not allowed');
  equal(evaluation.failClosed, true, 'Policy limits: blocked evaluation fails closed');
  ok(
    evaluation.reasonCodes.includes('policy-limit-recipient-breach'),
    'Policy limits: recipient breach reason is present',
  );
}

function testReviewThresholdRequiresReview(): void {
  const evaluation = evaluateConsequenceAdmissionPolicyLimits({
    limitSet: paymentLimitSet(),
    observation: {
      ...passingPaymentObservation(),
      amount: {
        value: 1000,
        currency: 'EUR',
      },
    },
  });

  equal(evaluation.decision, 'review', 'Policy limits: review threshold requires review');
  equal(evaluation.allowed, false, 'Policy limits: review is not automatically allowed');
  equal(evaluation.failClosed, true, 'Policy limits: review fails closed until reviewer path resolves');
  ok(
    evaluation.reasonCodes.includes('policy-limit-review-threshold-breach'),
    'Policy limits: review threshold reason is present',
  );
}

function testMissingRequiredMeasurementBlocks(): void {
  const evaluation = evaluateConsequenceAdmissionPolicyLimits({
    limitSet: paymentLimitSet(),
    observation: {
      consequenceKind: 'action',
      amount: {
        value: 240,
        currency: 'EUR',
      },
      recipient: 'supplier_steel_works',
      riskClass: 'R3',
    },
  });

  equal(evaluation.decision, 'block', 'Policy limits: missing required velocity blocks');
  ok(
    evaluation.reasonCodes.includes('policy-limit-required-measurement-missing'),
    'Policy limits: missing measurement reason is present',
  );
}

function testVelocityCanRequireSharedDurableSource(): void {
  const limitSet = createConsequenceAdmissionPolicyLimitSet({
    id: 'limits:velocity-shared:v1',
    policyRef: 'policy:velocity:v1',
    consequenceDomain: 'money-movement',
    limits: [
      {
        id: 'limit:velocity-shared',
        kind: 'velocity',
        label: 'Shared procurement velocity',
        consequenceDomain: 'money-movement',
        maxCount: 3,
        windowSeconds: 3600,
        subject: 'procurement-agent',
        requireSharedCounter: true,
        breachAction: 'block',
      },
    ],
  });
  const operatorAsserted = evaluateConsequenceAdmissionPolicyLimits({
    limitSet,
    observation: {
      consequenceKind: 'action',
      velocity: {
        count: 2,
        windowSeconds: 3600,
        subject: 'procurement-agent',
        source: 'operator-asserted',
      },
    },
  });
  const shared = evaluateConsequenceAdmissionPolicyLimits({
    limitSet,
    observation: {
      consequenceKind: 'action',
      velocity: {
        count: 2,
        windowSeconds: 3600,
        subject: 'procurement-agent',
        source: 'shared-durable-counter',
      },
    },
  });

  equal(
    operatorAsserted.decision,
    'block',
    'Policy limits: shared velocity requirement blocks operator-asserted counters',
  );
  ok(
    operatorAsserted.reasonCodes.includes('policy-limit-velocity-source-not-shared'),
    'Policy limits: non-shared velocity source reason is explicit',
  );
  equal(
    shared.decision,
    'admit',
    'Policy limits: shared durable velocity source satisfies the limit',
  );
}

function testDataScopeLimitBlocksUnmeasuredOrOverscopedExport(): void {
  const limitSet = createConsequenceAdmissionPolicyLimitSet({
    id: 'limits:data-export:v1',
    policyRef: 'policy:data-export:v1',
    consequenceDomain: 'data-disclosure',
    limits: [
      {
        id: 'limit:data-scope',
        kind: 'data-scope',
        label: 'Customer export scope',
        consequenceDomain: 'data-disclosure',
        allowedDataDomains: ['billing-summary', 'customer-support'],
        maxRecords: 100,
        breachAction: 'block',
      },
    ],
  });
  const missing = evaluateConsequenceAdmissionPolicyLimits({
    limitSet,
    observation: {
      consequenceKind: 'record',
      riskClass: 'R3',
    },
  });
  const overscoped = evaluateConsequenceAdmissionPolicyLimits({
    limitSet,
    observation: {
      consequenceKind: 'record',
      dataScope: {
        domains: ['billing-summary', 'raw-pii'],
        recordCount: 20,
      },
      riskClass: 'R3',
    },
  });
  const tooManyRecords = evaluateConsequenceAdmissionPolicyLimits({
    limitSet,
    observation: {
      consequenceKind: 'record',
      dataScope: {
        domains: ['billing-summary'],
        recordCount: 101,
      },
      riskClass: 'R3',
    },
  });

  deepEqual(
    [missing.decision, overscoped.decision, tooManyRecords.decision],
    ['block', 'block', 'block'],
    'Policy limits: missing or overscoped data export blocks',
  );
}

function testDocsAndPackageExposePolicyLimitModel(): void {
  const readme = readProjectFile('README.md');
  const policyDoc = readProjectFile('docs', '02-architecture', 'policy-limit-model.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'It checks policy, approval, evidence, allowed scope',
    'Policy limits: README names policy and scope checks',
  );
  includes(
    policyDoc,
    'Missing required measurements fail closed as `block`.',
    'Policy limits: doc states missing measurements fail closed',
  );
  includes(
    systemOverview,
    '[Policy limit model](policy-limit-model.md)',
    'Policy limits: system overview links policy limit model',
  );
  includes(
    purpose,
    '[Policy limit model](../02-architecture/policy-limit-model.md)',
    'Policy limits: purpose links policy limit model',
  );
  equal(
    packageJson.scripts['test:policy-limit-model'],
    'tsx tests/policy-limit-model.test.ts',
    'Policy limits: focused test script is exposed',
  );
}

testDescriptorAndAdmissionDescriptorExposeLimitVocabulary();
testPassingObservationAdmits();
testAmountBreachNarrowsWithConstraint();
testRecipientBreachBlocks();
testReviewThresholdRequiresReview();
testMissingRequiredMeasurementBlocks();
testVelocityCanRequireSharedDurableSource();
testDataScopeLimitBlocksUnmeasuredOrOverscopedExport();
testDocsAndPackageExposePolicyLimitModel();

console.log(`Policy limit model tests: ${passed} passed, 0 failed`);
