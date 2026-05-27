import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluatePolicyFoundryRedTeamReplay,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function event(input: {
  readonly actor: string;
  readonly occurredAt: string;
  readonly requestId?: string | null;
  readonly tenantId?: string | null;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: 'rotate_secret',
      domain: 'system-operation',
      downstreamSystem: 'secret-manager',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: input.requestId ?? `request:${input.actor}:${input.occurredAt}`,
      tenantId: input.tenantId ?? 'tenant_policy_foundry',
      policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? ['change:approved'],
      recipient: 'raw_recipient_must_not_escape',
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: `authority:${input.actor}`,
          trustClass: 'trusted-authority',
          evidenceDigest: `sha256:authority-${input.actor}`,
        },
      ],
      observedFeatures: input.observedFeatures ?? { adapterReady: true },
      observedFeatureOrigins: {
        adapterReady: 'trusted-adapter',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
      ...(input.observedFeatures ?? { adapterReady: true }),
    },
  });
}

function candidateFor(
  events: readonly ShadowAdmissionEvent[],
  actionSurface = 'secret-manager.rotate_secret',
) {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-01T23:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-01T23:01:00.000Z',
  });
  const candidate = bundle.candidates.find((item) => item.actionSurface === actionSurface) ?? null;
  return { report, candidate };
}

function cleanEvents(): readonly ShadowAdmissionEvent[] {
  return Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-01T22:${String(index).padStart(2, '0')}:02.000Z`,
    }),
  );
}

function testCleanCandidatePassesEvidenceReplay(): void {
  const events = cleanEvents();
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-01T23:02:00.000Z',
  });
  const serialized = JSON.stringify(replay);

  equal(replay.version, 'attestor.policy-foundry-red-team-replay.v1', 'Policy Foundry red-team replay: version is explicit');
  equal(replay.approvalRequired, true, 'Policy Foundry red-team replay: approval remains required');
  equal(replay.autoEnforce, false, 'Policy Foundry red-team replay: replay never auto-enforces');
  equal(replay.rawPayloadStored, false, 'Policy Foundry red-team replay: raw payload boundary is explicit');
  equal(replay.evidenceReplayOnly, true, 'Policy Foundry red-team replay: evidence-only limitation is explicit');
  equal(replay.status, 'passed', 'Policy Foundry red-team replay: clean candidate passes');
  equal(replay.failedCaseCount, 0, 'Policy Foundry red-team replay: clean candidate has no failed cases');
  equal(replay.caseCount, 12, 'Policy Foundry red-team replay: required case set is stable');
  ok(replay.digest.startsWith('sha256:'), 'Policy Foundry red-team replay: digest is generated');
  ok(!serialized.includes('ops-agent-'), 'Policy Foundry red-team replay: raw actor IDs are not serialized');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Policy Foundry red-team replay: raw recipient is not serialized');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Policy Foundry red-team replay: raw feature values are not serialized');
}

function testMissingControlsFailReplay(): void {
  const events = [
    event({
      actor: 'ops-agent-1',
      occurredAt: '2026-05-02T22:00:02.000Z',
      policyRef: null,
      evidenceRefs: [],
    }),
    event({
      actor: 'ops-agent-2',
      occurredAt: '2026-05-02T22:01:02.000Z',
      policyRef: null,
      evidenceRefs: [],
    }),
  ];
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-02T23:02:00.000Z',
  });

  equal(replay.status, 'failed', 'Policy Foundry red-team replay: missing controls fail replay');
  ok(
    replay.cases.some((entry) => entry.kind === 'missing-policy-schema' && entry.status === 'failed'),
    'Policy Foundry red-team replay: missing policy case fails',
  );
  ok(
    replay.cases.some((entry) => entry.kind === 'missing-evidence' && entry.status === 'failed'),
    'Policy Foundry red-team replay: missing evidence case fails',
  );
}

function testScopeAndCustomDomainControlsFailReplay(): void {
  const events = [
    createShadowAdmissionEvent({
      admission: createGenericAdmissionEnvelope({
        mode: 'observe',
        actor: 'support-agent-scope',
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        requestedAt: '2026-05-02T22:10:02.000Z',
        decidedAt: '2026-05-02T22:10:02.000Z',
        requestId: 'request:scope-gap',
        tenantId: 'tenant_policy_foundry',
        policyRef: 'policy:refund:v1',
        evidenceRefs: ['ticket:approved'],
        authoritySources: [
          {
            sourceKind: 'authority-record',
            claimKind: 'authorization',
            sourceRef: 'authority:support-agent-scope',
            trustClass: 'trusted-authority',
            evidenceDigest: 'sha256:authority-support-agent-scope',
          },
        ],
      }),
      occurredAt: '2026-05-02T22:10:02.000Z',
      downstreamOutcome: 'proceeded',
      humanOutcome: 'approved',
      observedFeatures: {},
    }),
    createShadowAdmissionEvent({
      admission: createGenericAdmissionEnvelope({
        mode: 'observe',
        actor: 'custom-agent',
        action: 'custom_action',
        domain: 'custom',
        downstreamSystem: 'custom-system',
        requestedAt: '2026-05-02T22:11:02.000Z',
        decidedAt: '2026-05-02T22:11:02.000Z',
        requestId: 'request:custom-gap',
        tenantId: 'tenant_policy_foundry',
        policyRef: 'policy:custom:v1',
        evidenceRefs: ['custom:evidence'],
        authoritySources: [
          {
            sourceKind: 'authority-record',
            claimKind: 'authorization',
            sourceRef: 'authority:custom-agent',
            trustClass: 'trusted-authority',
            evidenceDigest: 'sha256:authority-custom-agent',
          },
        ],
      }),
      occurredAt: '2026-05-02T22:11:02.000Z',
      downstreamOutcome: 'proceeded',
      humanOutcome: 'approved',
      observedFeatures: {},
    }),
  ];
  const scopeContext = candidateFor(events, 'refund-service.issue_refund');
  const scopeReplay = evaluatePolicyFoundryRedTeamReplay({
    candidate: scopeContext.candidate,
    report: scopeContext.report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-02T23:12:00.000Z',
  });
  const customContext = candidateFor(events, 'custom-system.custom_action');
  const customReplay = evaluatePolicyFoundryRedTeamReplay({
    candidate: customContext.candidate,
    report: customContext.report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-02T23:13:00.000Z',
  });

  equal(scopeReplay.status, 'failed', 'Policy Foundry red-team replay: scope gaps fail replay');
  ok(
    scopeReplay.cases.some((entry) => entry.kind === 'missing-scope-binding' && entry.status === 'failed'),
    'Policy Foundry red-team replay: missing scope case fails',
  );
  equal(customReplay.status, 'failed', 'Policy Foundry red-team replay: custom domain gaps fail replay');
  ok(
    customReplay.cases.some((entry) => entry.kind === 'custom-domain-contract-missing' && entry.status === 'failed'),
    'Policy Foundry red-team replay: custom-domain contract case fails',
  );
}

function testForeignTenantDuplicateAndBurstFailReplay(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: 'single-operator-agent',
      occurredAt: `2026-05-03T22:${String(index).padStart(2, '0')}:02.000Z`,
      requestId: index < 6 ? 'duplicate-request' : `request:${index}`,
      tenantId: index === 0 ? 'tenant_foreign' : 'tenant_policy_foundry',
    }),
  );
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-03T23:02:00.000Z',
  });

  equal(replay.status, 'failed', 'Policy Foundry red-team replay: boundary and replay pressure fail replay');
  ok(
    replay.cases.some((entry) => entry.kind === 'foreign-tenant-record' && entry.status === 'failed'),
    'Policy Foundry red-team replay: foreign tenant case fails',
  );
  ok(
    replay.cases.some((entry) => entry.kind === 'duplicate-replayed-request' && entry.status === 'failed'),
    'Policy Foundry red-team replay: duplicate replay case fails',
  );
  ok(
    replay.cases.some((entry) => entry.kind === 'actor-burst' && entry.status === 'failed'),
    'Policy Foundry red-team replay: actor burst case fails',
  );
  ok(replay.dominantActorDigest?.startsWith('sha256:'), 'Policy Foundry red-team replay: dominant actor is digested');
}

function testUnsafeSignalsFailReplay(): void {
  const events = cleanEvents().map((item, index) =>
    index === 0
      ? event({
        actor: 'ops-agent-unsafe',
        occurredAt: '2026-05-04T22:00:02.000Z',
        observedFeatures: {
          adapterReady: true,
          highRisk: true,
          unsafeProofUri: true,
          promptInjection: true,
        },
      })
      : item
  );
  const { report, candidate } = candidateFor(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-04T23:02:00.000Z',
  });

  equal(replay.status, 'failed', 'Policy Foundry red-team replay: unsafe signals fail replay');
  ok(
    replay.cases.some((entry) => entry.kind === 'high-risk-auto-admit' && entry.status === 'failed'),
    'Policy Foundry red-team replay: high-risk auto-admit case fails',
  );
  ok(
    replay.cases.some((entry) => entry.kind === 'unsafe-proof-uri-signal' && entry.status === 'failed'),
    'Policy Foundry red-team replay: unsafe proof URI signal case fails',
  );
  ok(
    replay.cases.some((entry) => entry.kind === 'malicious-summary-signal' && entry.status === 'failed'),
    'Policy Foundry red-team replay: malicious summary signal case fails',
  );
}

testCleanCandidatePassesEvidenceReplay();
testMissingControlsFailReplay();
testScopeAndCustomDomainControlsFailReplay();
testForeignTenantDuplicateAndBurstFailReplay();
testUnsafeSignalsFailReplay();

console.log(`Policy Foundry red-team replay tests: ${passed} passed, 0 failed`);
