import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
  consequenceAdmissionAgentLoopAbuseGuardDescriptor,
  createConsequenceAdmissionAgentLoopAbuseGuard,
  createConsequenceAdmissionRetryAttemptBinding,
  createGenericAdmissionEnvelope,
  type GenericAdmissionEnvelope,
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

function heldAdmission(): GenericAdmissionEnvelope {
  return createGenericAdmissionEnvelope({
    mode: 'review',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    tenantId: 'tenant_loop',
    environment: 'test',
    requestedAt: '2026-05-05T09:00:00.000Z',
    decidedAt: '2026-05-05T09:00:01.000Z',
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
  });
}

function retryEnvelope(input: {
  readonly held: GenericAdmissionEnvelope;
  readonly attemptNumber: number;
  readonly correctionReasonCodes?: readonly string[];
  readonly correctionFields?: readonly string[];
  readonly attemptedAt?: string;
}): GenericAdmissionEnvelope {
  const heldAdmissionEnvelope = input.held.admission;
  const attemptedAt = input.attemptedAt ?? '2026-05-05T09:01:00.000Z';
  const retryAttempt = createConsequenceAdmissionRetryAttemptBinding({
    previousAdmissionId: heldAdmissionEnvelope.admissionId,
    previousAdmissionDigest: heldAdmissionEnvelope.digest,
    previousRequestId: heldAdmissionEnvelope.request.requestId,
    attemptNumber: input.attemptNumber,
    attemptedAt,
    correctionReasonCodes: input.correctionReasonCodes ?? [
      'policy-ref-missing',
      'evidence-ref-missing',
    ],
    correctionFields: input.correctionFields ?? ['policyRef', 'evidenceRefs'],
    idempotencyKey: `retry:tenant-loop:${input.attemptNumber}:${attemptedAt}`,
  });

  return createGenericAdmissionEnvelope({
    mode: 'review',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    tenantId: 'tenant_loop',
    environment: 'test',
    requestedAt: attemptedAt,
    decidedAt: attemptedAt,
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    retryAttempt,
  });
}

function testDescriptorExposesGuardBoundary(): void {
  const descriptor = consequenceAdmissionAgentLoopAbuseGuardDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_AGENT_LOOP_ABUSE_GUARD_VERSION,
    'Agent loop abuse guard: descriptor exposes stable version',
  );
  ok(
    descriptor.outcomes.includes('throttle'),
    'Agent loop abuse guard: descriptor exposes throttle outcome',
  );
  ok(
    descriptor.reasonCodes.includes('agent-loop-policy-probing-risk'),
    'Agent loop abuse guard: descriptor exposes policy probing reason',
  );
  ok(
    descriptor.nonRetryableReasonCodes.includes('feature-unsafe'),
    'Agent loop abuse guard: descriptor exposes non-retryable unsafe reason',
  );
  equal(
    descriptor.storesRawPayloadsExternally,
    false,
    'Agent loop abuse guard: descriptor does not store raw payloads',
  );
  equal(
    descriptor.productionSharedStoreIncluded,
    false,
    'Agent loop abuse guard: descriptor avoids production shared-store overclaiming',
  );
}

function testRecordsBoundRetryWithoutRawPayload(): void {
  const held = heldAdmission();
  const retry = retryEnvelope({ held, attemptNumber: 1 });
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    guardId: 'guard:tenant-loop',
    now: () => '2026-05-05T09:01:01.000Z',
  });
  const decision = guard.evaluate({
    tenantId: 'tenant_loop',
    envelope: retry,
    receivedAt: '2026-05-05T09:01:01.000Z',
  });

  equal(decision.outcome, 'allow', 'Agent loop abuse guard: first bounded retry is allowed');
  equal(decision.allowed, true, 'Agent loop abuse guard: allowed flag is true');
  equal(decision.failClosed, false, 'Agent loop abuse guard: allowed retry is not fail-closed');
  equal(
    decision.record?.rawPayloadStored,
    false,
    'Agent loop abuse guard: record states raw payload is not stored',
  );
  ok(
    decision.record?.correctionSignatureDigest?.startsWith('sha256:'),
    'Agent loop abuse guard: correction signature is digest-shaped',
  );
  equal(
    JSON.stringify(guard.snapshot()).includes('customer_123'),
    false,
    'Agent loop abuse guard: snapshot does not expose raw recipient payload',
  );
}

function testAttemptNumberBeyondBudgetThrottles(): void {
  const held = heldAdmission();
  const retry = retryEnvelope({ held, attemptNumber: 3 });
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxRetryAttemptsPerPreviousAdmission: 2,
    },
    now: () => '2026-05-05T09:01:01.000Z',
  });
  const decision = guard.evaluate({
    tenantId: 'tenant_loop',
    envelope: retry,
    receivedAt: '2026-05-05T09:01:01.000Z',
  });

  equal(decision.outcome, 'throttle', 'Agent loop abuse guard: attempt beyond budget throttles');
  equal(decision.allowed, false, 'Agent loop abuse guard: throttled retry is not allowed');
  equal(decision.failClosed, true, 'Agent loop abuse guard: throttled retry fails closed');
  ok(
    decision.reasonCodes.includes('agent-loop-attempt-budget-exhausted'),
    'Agent loop abuse guard: budget exhaustion reason is explicit',
  );
  ok(decision.retryAfterSeconds > 0, 'Agent loop abuse guard: throttled retry has retry-after');
  equal(guard.snapshot().recordCount, 0, 'Agent loop abuse guard: throttled retry is not recorded');
}

function testNonRetryableCorrectionHolds(): void {
  const held = heldAdmission();
  const retry = retryEnvelope({
    held,
    attemptNumber: 1,
    correctionReasonCodes: ['feature-unsafe'],
    correctionFields: ['observedFeatures.unsafe'],
  });
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    now: () => '2026-05-05T09:01:01.000Z',
  });
  const decision = guard.evaluate({
    tenantId: 'tenant_loop',
    envelope: retry,
    receivedAt: '2026-05-05T09:01:01.000Z',
  });

  equal(decision.outcome, 'hold', 'Agent loop abuse guard: non-retryable correction holds');
  equal(decision.allowed, false, 'Agent loop abuse guard: non-retryable correction is not allowed');
  ok(
    decision.reasonCodes.includes('agent-loop-non-retryable-correction'),
    'Agent loop abuse guard: non-retryable reason is explicit',
  );
  equal(guard.snapshot().recordCount, 0, 'Agent loop abuse guard: non-retryable attempt is not recorded');
}

function testDistinctCorrectionSignaturesHoldAsPolicyProbingRisk(): void {
  const held = heldAdmission();
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxDistinctCorrectionSignaturesPerPreviousAdmission: 1,
    },
    now: () => '2026-05-05T09:01:01.000Z',
  });
  const first = guard.evaluate({
    tenantId: 'tenant_loop',
    envelope: retryEnvelope({
      held,
      attemptNumber: 1,
      correctionReasonCodes: ['evidence-ref-missing'],
      correctionFields: ['evidenceRefs'],
      attemptedAt: '2026-05-05T09:01:00.000Z',
    }),
    receivedAt: '2026-05-05T09:01:01.000Z',
  });
  const second = guard.evaluate({
    tenantId: 'tenant_loop',
    envelope: retryEnvelope({
      held,
      attemptNumber: 2,
      correctionReasonCodes: ['policy-ref-missing'],
      correctionFields: ['policyRef'],
      attemptedAt: '2026-05-05T09:01:30.000Z',
    }),
    receivedAt: '2026-05-05T09:01:31.000Z',
  });

  equal(first.outcome, 'allow', 'Agent loop abuse guard: first correction signature records');
  equal(second.outcome, 'hold', 'Agent loop abuse guard: second distinct signature holds');
  ok(
    second.reasonCodes.includes('agent-loop-policy-probing-risk'),
    'Agent loop abuse guard: probing reason is explicit',
  );
  equal(guard.snapshot().recordCount, 1, 'Agent loop abuse guard: probing hold does not append');
}

function testDocsScriptsAndPackageSurfaceExposeGuard(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'agent-loop-abuse-guard.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  equal(
    packageJson.scripts['test:agent-loop-abuse-guard'],
    'tsx tests/consequence-admission-agent-loop-abuse-guard.test.ts',
    'Agent loop abuse guard: focused test script is exposed',
  );
  includes(
    readme,
    'docs/02-architecture/agent-loop-abuse-guard.md',
    'Agent loop abuse guard: README links architecture doc',
  );
  includes(
    doc,
    'retry loop from becoming DoS or policy probing',
    'Agent loop abuse guard: doc states purpose',
  );
  includes(
    systemOverview,
    '[Agent loop abuse guard](agent-loop-abuse-guard.md)',
    'Agent loop abuse guard: system overview links doc',
  );
  includes(
    packageProbe,
    'consequenceAdmissionAgentLoopAbuseGuardDescriptor',
    'Agent loop abuse guard: package surface probe checks descriptor',
  );
}

testDescriptorExposesGuardBoundary();
testRecordsBoundRetryWithoutRawPayload();
testAttemptNumberBeyondBudgetThrottles();
testNonRetryableCorrectionHolds();
testDistinctCorrectionSignaturesHoldAsPolicyProbingRisk();
testDocsScriptsAndPackageSurfaceExposeGuard();

console.log(`Consequence admission agent loop abuse guard tests: ${passed} passed, 0 failed`);
