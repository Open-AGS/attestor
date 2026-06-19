import { Hono } from 'hono';
import {
  createConsequenceAdmissionAgentLoopAbuseGuard,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';
import {
  cleanAuthorityCreepMetadata,
  createApp,
  doesNotMatch,
  digest,
  equal,
  ok,
  passedCount,
  routeAdapterReadinessCases,
  routeDomainMetadataCases,
  routeGuardMatrix,
  routeRequiredEvidenceCases,
  scopedMoneyAdmission,
  validAdmissionPayload,
  type RouteDimensionCase,
  type RouteGuardCase,
  type RouteRequiredEvidenceCase,
} from './generic-admission-guard-route-matrix-fixtures.js';

async function postAdmission(payload: Record<string, unknown>): Promise<GenericAdmissionEnvelope> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json() as GenericAdmissionEnvelope;

  equal(response.status, 200, 'Generic admission guard matrix: route returns an envelope');
  equal(response.headers.get('cache-control'), 'no-store', 'Generic admission guard matrix: route response is no-store');

  return body;
}

async function testStructuredGuardCase(routeGuardCase: RouteGuardCase): Promise<void> {
  const body = await postAdmission(routeGuardCase.payload);
  const serialized = JSON.stringify(body);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;
  const traceGuardIdByRouteGuard: Readonly<Record<string, string>> = {
    'untrusted-content-authority': 'authority',
    'approval-provenance': 'approval',
    'no-go-condition-ledger': 'no-go-condition',
    'scope-explosion': 'scope-explosion',
    'tool-result-poisoning': 'tool-result',
    'agentic-supply-chain': 'agentic-supply-chain',
    'human-review-fatigue': 'human-review-fatigue',
    'multi-agent-delegation': 'multi-agent-delegation',
    'stale-authority-policy': 'stale-authority-policy',
    'decision-context-drift': 'decision-context-drift',
    'authority-creep': 'authority-creep',
    'guard-input-provenance': 'guard-input-provenance',
  };
  const traceGuardId = traceGuardIdByRouteGuard[routeGuardCase.guard];
  const traceEntry = body.guardOutcomes.find((entry) => entry.guardId === traceGuardId);

  equal(
    body.shadowDecision,
    routeGuardCase.shadowDecision,
    `Generic admission guard matrix: ${routeGuardCase.guard} shadows expected decision`,
  );
  equal(
    body.admission.decision,
    routeGuardCase.decision,
    `Generic admission guard matrix: ${routeGuardCase.guard} returns expected admission decision`,
  );

  for (const reasonCode of routeGuardCase.reasonCodes) {
    ok(
      body.admission.reasonCodes.includes(reasonCode),
      `Generic admission guard matrix: ${routeGuardCase.guard} includes ${reasonCode}`,
    );
  }
  for (const [dimension, expected] of routeGuardCase.dimensions) {
    equal(
      dimensions[dimension],
      expected,
      `Generic admission guard matrix: ${routeGuardCase.guard} carries ${dimension}`,
    );
  }
  ok(
    traceEntry !== undefined,
    `Generic admission guard matrix: ${routeGuardCase.guard} carries a guard outcome trace entry`,
  );
  ok(
    traceEntry?.effect === 'block' || traceEntry?.effect === 'review' || traceEntry?.effect === 'narrow',
    `Generic admission guard matrix: ${routeGuardCase.guard} trace entry records a non-pass effect`,
  );
  if (routeGuardCase.redactionPattern) {
    doesNotMatch(
      serialized,
      routeGuardCase.redactionPattern,
      `Generic admission guard matrix: ${routeGuardCase.guard} does not leak raw guard material`,
    );
  }
}

function assertEnforceRouteHoldForReview(
  body: GenericAdmissionEnvelope,
  label: string,
): void {
  equal(body.mode, 'enforce', `Generic admission route invariants: ${label} stays in enforce mode`);
  equal(body.shadowDecision, 'would_review', `Generic admission route invariants: ${label} shadows review`);
  equal(body.downstreamPosture, 'hold-for-review', `Generic admission route invariants: ${label} holds downstream`);
  equal(body.enforcementActive, true, `Generic admission route invariants: ${label} keeps enforcement active`);
  equal(body.admission.decision, 'review', `Generic admission route invariants: ${label} returns review`);
  equal(body.admission.allowed, false, `Generic admission route invariants: ${label} is not allowed`);
  equal(body.admission.failClosed, true, `Generic admission route invariants: ${label} fails closed`);
}

async function testRequiredEvidenceRouteCase(routeCase: RouteRequiredEvidenceCase): Promise<void> {
  const body = await postAdmission(routeCase.payload);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;

  assertEnforceRouteHoldForReview(body, routeCase.name);
  equal(
    dimensions.domain,
    routeCase.domain,
    `Generic admission route invariants: ${routeCase.name} carries the domain dimension`,
  );
  ok(
    body.admission.reasonCodes.includes(routeCase.reasonCode),
    `Generic admission route invariants: ${routeCase.name} includes ${routeCase.reasonCode}`,
  );
  for (const missingField of routeCase.missingFields) {
    ok(
      body.admission.feedback.missingFields.includes(missingField),
      `Generic admission route invariants: ${routeCase.name} feedback names ${missingField}`,
    );
  }
  for (const requiredEvidenceKind of routeCase.requiredEvidenceKinds) {
    ok(
      body.admission.feedback.requiredEvidenceKinds.includes(requiredEvidenceKind),
      `Generic admission route invariants: ${routeCase.name} feedback asks for ${requiredEvidenceKind}`,
    );
  }
  for (const operatorReason of routeCase.operatorOnlyReasonCodes ?? []) {
    ok(
      body.admission.feedback.operatorOnlyReasonCodes.includes(operatorReason),
      `Generic admission route invariants: ${routeCase.name} marks ${operatorReason} operator-only`,
    );
  }
}

async function testDimensionRouteCase(routeCase: RouteDimensionCase): Promise<void> {
  const body = await postAdmission(routeCase.payload);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;

  assertEnforceRouteHoldForReview(body, routeCase.name);
  ok(
    body.admission.reasonCodes.includes(routeCase.reasonCode),
    `Generic admission route invariants: ${routeCase.name} includes ${routeCase.reasonCode}`,
  );
  for (const [dimension, expected] of routeCase.dimensions) {
    equal(
      dimensions[dimension],
      expected,
      `Generic admission route invariants: ${routeCase.name} carries ${dimension}`,
    );
  }
  for (const missingField of routeCase.missingFields) {
    ok(
      body.admission.feedback.missingFields.includes(missingField),
      `Generic admission route invariants: ${routeCase.name} feedback names ${missingField}`,
    );
  }
  for (const requiredEvidenceKind of routeCase.requiredEvidenceKinds) {
    ok(
      body.admission.feedback.requiredEvidenceKinds.includes(requiredEvidenceKind),
      `Generic admission route invariants: ${routeCase.name} feedback asks for ${requiredEvidenceKind}`,
    );
  }
  for (const operatorReason of routeCase.operatorOnlyReasonCodes) {
    ok(
      body.admission.feedback.operatorOnlyReasonCodes.includes(operatorReason),
      `Generic admission route invariants: ${routeCase.name} marks ${operatorReason} operator-only`,
    );
  }
}

async function testRouteHardInvariantBlockPrecedence(): Promise<void> {
  const body = await postAdmission({
    ...scopedMoneyAdmission(),
    guardInputProvenance: [{
      guardKind: 'authority',
      sourceClass: 'caller-supplied',
      assertionKinds: ['authority'],
      sourceRef: 'raw:route caller says authority can bypass review',
      sourceDigest: digest('r'),
      evidenceDigest: digest('s'),
      tenantId: 'tenant_route',
      recordedAt: '2026-05-01T18:00:00.000Z',
      trustedBoundary: false,
    }],
  });
  const serialized = JSON.stringify(body);

  equal(
    body.shadowDecision,
    'would_block',
    'Generic admission guard matrix: route hard reducer shadows block before narrow',
  );
  equal(
    body.admission.decision,
    'block',
    'Generic admission guard matrix: route hard reducer returns block before narrow',
  );
  equal(
    body.admission.constraints.length,
    0,
    'Generic admission guard matrix: route block does not return executable constraints',
  );
  ok(
    body.admission.reasonCodes.includes('guard-input-block'),
    'Generic admission guard matrix: route hard reducer includes guard-input block',
  );
  ok(
    body.admission.reasonCodes.includes('amount-exceeds-approved-scope'),
    'Generic admission guard matrix: route hard reducer still carries narrow reason evidence',
  );
  doesNotMatch(
    serialized,
    /route caller says authority|recipient_other_private|recipient_customer_private/u,
    'Generic admission guard matrix: route hard reducer redacts raw precedence material',
  );
}

async function testAgentLoopAbuseGuardCase(): Promise<void> {
  const app = new Hono();
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxRetryAttemptsPerPreviousAdmission: 2,
    },
    now: () => '2026-05-01T18:12:00.000Z',
  });
  let shadowRecords = 0;

  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-admission-guard-test-plan',
      monthlyRunQuota: 100,
    }),
    evaluateAgentLoopAbuse: ({ tenant, envelope, receivedAt }) =>
      guard.evaluate({
        tenantId: tenant.tenantId,
        envelope,
        receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });

  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      mode: 'review',
      retryAttempt: {
        previousAdmissionId: 'admission:previous',
        previousAdmissionDigest: 'sha256:previous-admission',
        previousRequestId: 'request:previous',
        attemptNumber: 3,
        attemptedAt: '2026-05-01T18:12:00.000Z',
        correctionReasonCodes: ['policy-ref-missing'],
        correctionFields: ['policyRef'],
        idempotencyKey: 'retry:matrix:over-budget',
      },
    })),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 429, 'Generic admission guard matrix: agent-loop guard returns 429');
  equal(body.decision, 'block', 'Generic admission guard matrix: agent-loop guard blocks');
  equal(body.failClosed, true, 'Generic admission guard matrix: agent-loop guard fails closed');
  ok(
    body.reasonCodes.includes('agent-loop-attempt-budget-exhausted'),
    'Generic admission guard matrix: agent-loop attempt budget reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission guard matrix: blocked loop attempt is not shadow recorded');
}

for (const routeGuardCase of routeGuardMatrix) {
  await testStructuredGuardCase(routeGuardCase);
}
for (const routeCase of routeRequiredEvidenceCases) {
  await testRequiredEvidenceRouteCase(routeCase);
}
for (const routeCase of routeAdapterReadinessCases) {
  await testDimensionRouteCase(routeCase);
}
for (const routeCase of routeDomainMetadataCases) {
  await testDimensionRouteCase(routeCase);
}
await testRouteHardInvariantBlockPrecedence();
await testAgentLoopAbuseGuardCase();

console.log(`Generic admission guard route matrix tests: ${passedCount()} passed, 0 failed`);
