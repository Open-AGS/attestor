import assert from 'node:assert/strict';
import {
  createConsequenceAdmissionRetryAttemptBinding,
  createGenericAdmissionEnvelope,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import {
  configureAgentLoopAbuseGuard,
  createServiceAgentLoopAbuseGuard,
  getAgentLoopAbuseGuardStatus,
  resetSharedAgentLoopAbuseGuardForTests,
} from '../src/service/agent-loop-abuse-guard.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

const envKeys = [
  'ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY',
  'ATTESTOR_AGENT_LOOP_GUARD_REDIS_URL',
  'ATTESTOR_AGENT_LOOP_GUARD_REQUIRE_SHARED',
  'ATTESTOR_HA_MODE',
  'ATTESTOR_RUNTIME_PROFILE',
  'ATTESTOR_ADMIN_API_KEY',
  'REDIS_URL',
] as const;

const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
  typeof envKeys[number],
  string | undefined
>;

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv(): void {
  for (const key of envKeys) delete process.env[key];
}

async function startRedis(): Promise<{ readonly url: string; readonly stop: () => Promise<void> }> {
  const redisModule = await import('redis-memory-server');
  const RedisMemoryServer =
    redisModule.RedisMemoryServer ?? (redisModule as any).default?.RedisMemoryServer;
  const server = new RedisMemoryServer();
  const host = await server.getHost();
  const port = await server.getPort();
  return {
    url: `redis://${host}:${port}`,
    stop: async () => {
      await server.stop();
    },
  };
}

function admissionEnvelope(input: {
  readonly actor?: string;
  readonly requestedAt?: string;
  readonly retryAttempt?: GenericAdmissionEnvelope['admission']['request']['retryAttempt'];
} = {}): GenericAdmissionEnvelope {
  const requestedAt = input.requestedAt ?? '2026-05-06T10:00:00.000Z';
  return createGenericAdmissionEnvelope({
    mode: 'review',
    actor: input.actor ?? 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    tenantId: 'tenant_loop',
    environment: 'test',
    requestedAt,
    decidedAt: requestedAt,
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    retryAttempt: input.retryAttempt,
  });
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
    requestedAt: '2026-05-06T10:00:00.000Z',
    decidedAt: '2026-05-06T10:00:01.000Z',
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
  readonly correctionReasonCodes: readonly string[];
  readonly correctionFields: readonly string[];
  readonly attemptedAt: string;
}): GenericAdmissionEnvelope {
  const previous = input.held.admission;
  return admissionEnvelope({
    requestedAt: input.attemptedAt,
    retryAttempt: createConsequenceAdmissionRetryAttemptBinding({
      previousAdmissionId: previous.admissionId,
      previousAdmissionDigest: previous.digest,
      previousRequestId: previous.request.requestId,
      attemptNumber: input.attemptNumber,
      attemptedAt: input.attemptedAt,
      correctionReasonCodes: input.correctionReasonCodes,
      correctionFields: input.correctionFields,
      idempotencyKey: `retry:shared:${input.attemptNumber}:${input.attemptedAt}`,
    }),
  });
}

async function testSharedRequiredFailsClosedWithoutRedis(): Promise<void> {
  clearEnv();
  process.env.ATTESTOR_HA_MODE = 'true';
  const guard = createServiceAgentLoopAbuseGuard();

  await assert.rejects(
    () => guard.evaluate({
      tenantId: 'tenant_loop',
      envelope: admissionEnvelope(),
      receivedAt: '2026-05-06T10:00:00.000Z',
    }),
    /requires shared Redis/u,
    'Agent loop shared guard: HA mode fails closed when Redis is unavailable',
  );
  passed += 1;
}

async function testSharedActorWindowCoordinatesAcrossInstances(redisUrl: string): Promise<void> {
  await resetSharedAgentLoopAbuseGuardForTests();
  clearEnv();
  process.env.ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY = 'agent-loop-shared-test-key';
  process.env.ATTESTOR_HA_MODE = 'true';
  configureAgentLoopAbuseGuard({ redisUrl, redisMode: 'test' });

  const guardA = createServiceAgentLoopAbuseGuard({
    policy: {
      maxAdmissionsPerActorWindow: 2,
    },
  });
  const guardB = createServiceAgentLoopAbuseGuard({
    policy: {
      maxAdmissionsPerActorWindow: 2,
    },
  });
  const first = await guardA.evaluate({
    tenantId: 'tenant_loop',
    envelope: admissionEnvelope({ requestedAt: '2026-05-06T10:01:00.000Z' }),
    receivedAt: '2026-05-06T10:01:01.000Z',
  });
  const second = await guardB.evaluate({
    tenantId: 'tenant_loop',
    envelope: admissionEnvelope({ requestedAt: '2026-05-06T10:01:02.000Z' }),
    receivedAt: '2026-05-06T10:01:02.000Z',
  });
  const third = await guardA.evaluate({
    tenantId: 'tenant_loop',
    envelope: admissionEnvelope({ requestedAt: '2026-05-06T10:01:03.000Z' }),
    receivedAt: '2026-05-06T10:01:03.000Z',
  });

  equal(getAgentLoopAbuseGuardStatus().backend, 'redis', 'Agent loop shared guard: Redis backend is configured');
  equal(first.outcome, 'allow', 'Agent loop shared guard: first instance allows first admission');
  equal(second.outcome, 'allow', 'Agent loop shared guard: second instance sees shared actor budget');
  equal(third.outcome, 'throttle', 'Agent loop shared guard: shared actor budget throttles across instances');
  ok(
    third.reasonCodes.includes('agent-loop-window-exhausted'),
    'Agent loop shared guard: shared actor throttle reason is explicit',
  );
}

async function testSharedCorrectionSignatureBudgetCoordinatesAcrossInstances(
  redisUrl: string,
): Promise<void> {
  await resetSharedAgentLoopAbuseGuardForTests();
  clearEnv();
  process.env.ATTESTOR_AGENT_LOOP_GUARD_HASH_KEY = 'agent-loop-shared-test-key';
  process.env.ATTESTOR_HA_MODE = 'true';
  configureAgentLoopAbuseGuard({ redisUrl, redisMode: 'test' });

  const guardA = createServiceAgentLoopAbuseGuard({
    policy: {
      maxDistinctCorrectionSignaturesPerPreviousAdmission: 1,
    },
  });
  const guardB = createServiceAgentLoopAbuseGuard({
    policy: {
      maxDistinctCorrectionSignaturesPerPreviousAdmission: 1,
    },
  });
  const held = heldAdmission();
  const first = await guardA.evaluate({
    tenantId: 'tenant_loop',
    envelope: retryEnvelope({
      held,
      attemptNumber: 1,
      correctionReasonCodes: ['evidence-ref-missing'],
      correctionFields: ['evidenceRefs'],
      attemptedAt: '2026-05-06T10:02:00.000Z',
    }),
    receivedAt: '2026-05-06T10:02:01.000Z',
  });
  const second = await guardB.evaluate({
    tenantId: 'tenant_loop',
    envelope: retryEnvelope({
      held,
      attemptNumber: 2,
      correctionReasonCodes: ['policy-ref-missing'],
      correctionFields: ['policyRef'],
      attemptedAt: '2026-05-06T10:02:30.000Z',
    }),
    receivedAt: '2026-05-06T10:02:31.000Z',
  });

  equal(first.outcome, 'allow', 'Agent loop shared guard: first correction signature records');
  equal(first.record?.rawPayloadStored, false, 'Agent loop shared guard: shared record stores no raw payload');
  equal(second.outcome, 'hold', 'Agent loop shared guard: second instance enforces shared signature budget');
  ok(
    second.reasonCodes.includes('agent-loop-policy-probing-risk'),
    'Agent loop shared guard: shared signature hold reason is explicit',
  );
}

async function main(): Promise<void> {
  let redis: { readonly url: string; readonly stop: () => Promise<void> } | null = null;
  try {
    await testSharedRequiredFailsClosedWithoutRedis();
    redis = await startRedis();
    await testSharedActorWindowCoordinatesAcrossInstances(redis.url);
    await testSharedCorrectionSignatureBudgetCoordinatesAcrossInstances(redis.url);

    console.log(`Consequence admission shared agent loop abuse guard tests: ${passed} passed, 0 failed`);
  } finally {
    await resetSharedAgentLoopAbuseGuardForTests();
    await redis?.stop();
    restoreEnv();
  }
}

main().catch((error) => {
  console.error('\nConsequence admission shared agent loop abuse guard tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
