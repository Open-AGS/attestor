import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGenericAdmissionEnvelope,
  createPolicyFoundryCandidateRegistry,
  createPolicyFoundryCounterexampleLedger,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  evaluatePolicyFoundryReadiness,
  evaluatePolicyFoundryRedTeamReplay,
  policyFoundryCounterexampleLedgerDescriptor,
  type PolicyFoundryRegisteredCandidate,
  type ShadowAdmissionEvent,
  type ShadowPolicyDiscoveryCandidate,
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

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function event(input: {
  readonly actor: string;
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly requestId?: string | null;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: input.actor,
      action: input.action ?? 'rotate_secret',
      domain: input.domain ?? 'system-operation',
      downstreamSystem: input.downstreamSystem ?? 'secret-manager',
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      requestId: input.requestId ?? `request:${input.actor}:${input.occurredAt}`,
      policyRef: input.policyRef === undefined ? 'policy:ops:v1' : input.policyRef,
      evidenceRefs: input.evidenceRefs ?? ['change:approved'],
      recipient: 'raw_recipient_must_not_escape',
      observedFeatures: input.observedFeatures ?? { adapterReady: true },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'approved',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
      privateThreshold: 'threshold_must_not_escape',
      ...(input.observedFeatures ?? { adapterReady: true }),
    },
  });
}

function candidateContext(events: readonly ShadowAdmissionEvent[]): {
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly registeredCandidate: PolicyFoundryRegisteredCandidate;
  readonly report: ReturnType<typeof createShadowPolicySimulationReport>;
} {
  const report = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-13T00:00:00.000Z',
    minimumPromotionEvents: 5,
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-13T00:01:00.000Z',
  });
  const registry = createPolicyFoundryCandidateRegistry({
    candidates: bundle,
    generatedAt: '2026-05-13T00:02:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === events[0]?.actionSurface
  );
  assert.ok(candidate, 'expected test candidate');
  const registeredCandidate = registry.candidates.find((item) =>
    item.candidateId === candidate.candidateId
  );
  assert.ok(registeredCandidate, 'expected registered candidate');
  return { candidate, registeredCandidate, report };
}

function cleanEvents(): readonly ShadowAdmissionEvent[] {
  return Array.from({ length: 24 }, (_, index) =>
    event({
      actor: `ops-agent-${index % 4}`,
      occurredAt: `2026-05-13T00:${String(index).padStart(2, '0')}:00.000Z`,
      humanOutcome: index % 4 === 0 ? 'approved' : 'not-reviewed',
    }),
  );
}

function testCleanLedgerStaysDigestOnlyAndUnblocked(): void {
  const events = cleanEvents();
  const { candidate, registeredCandidate, report } = candidateContext(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-13T00:03:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    customerApproved: true,
    redTeamReplayStatus: replay.status,
    generatedAt: '2026-05-13T00:04:00.000Z',
  });
  const ledger = createPolicyFoundryCounterexampleLedger({
    candidate,
    registeredCandidate,
    readiness,
    redTeamReplay: replay,
    events,
    generatedAt: '2026-05-13T00:05:00.000Z',
  });
  const serialized = JSON.stringify(ledger);

  equal(ledger.version, 'attestor.policy-foundry-counterexample-ledger.v1', 'Counterexample ledger: version is explicit');
  equal(ledger.status, 'clean', 'Counterexample ledger: clean sample is not blocked');
  equal(ledger.promotionBlocked, false, 'Counterexample ledger: clean sample does not block promotion');
  equal(ledger.approvalRequired, true, 'Counterexample ledger: approval remains required');
  equal(ledger.autoEnforce, false, 'Counterexample ledger: auto enforce is false');
  equal(ledger.rawPayloadStored, false, 'Counterexample ledger: raw payload storage is false');
  equal(ledger.productionReady, false, 'Counterexample ledger: production readiness is not claimed');
  equal(ledger.evidenceDigestOnly, true, 'Counterexample ledger: evidence is digest-only');
  equal(ledger.matchingEventCount, 24, 'Counterexample ledger: matching event count is retained');
  equal(ledger.counterexampleCount, 0, 'Counterexample ledger: counterexample count is zero');
  equal(ledger.missingProofCount, 0, 'Counterexample ledger: missing proof count is zero');
  equal(ledger.highRiskAutoAdmitCount, 0, 'Counterexample ledger: high-risk auto-admit count is zero');
  ok(ledger.dominantActorDigest?.startsWith('sha256:'), 'Counterexample ledger: dominant actor is digested');
  ok(ledger.digest.startsWith('sha256:'), 'Counterexample ledger: digest is generated');
  ok(
    ledger.entries.some((entry) =>
      entry.kind === 'supporting-evidence' &&
      entry.status === 'supporting' &&
      entry.evidenceDigests.length > 0
    ),
    'Counterexample ledger: supporting evidence entry carries digests',
  );
  excludes(serialized, /ops-agent-|raw_recipient_must_not_escape|raw_feature_must_not_escape|threshold_must_not_escape/iu, 'Counterexample ledger: serialized output excludes raw actor, recipient, feature, and threshold markers');
}

function testRiskSignalsBlockPromotion(): void {
  const events = Array.from({ length: 24 }, (_, index) =>
    event({
      actor: 'single-operator-agent',
      requestId: index < 8 ? 'duplicate-request' : `request:${index}`,
      policyRef: null,
      evidenceRefs: [],
      observedFeatures: {
        highRisk: true,
        adapterReady: false,
      },
      occurredAt: `2026-05-13T01:${String(index).padStart(2, '0')}:00.000Z`,
      humanOutcome: index === 0 ? 'rejected' : 'approved',
    }),
  );
  const { candidate, registeredCandidate, report } = candidateContext(events);
  const replay = evaluatePolicyFoundryRedTeamReplay({
    candidate,
    report,
    events,
    tenantId: 'tenant_policy_foundry',
    generatedAt: '2026-05-13T01:30:00.000Z',
  });
  const readiness = evaluatePolicyFoundryReadiness({
    candidate,
    report,
    events,
    customerApproved: true,
    redTeamReplayStatus: replay.status,
    generatedAt: '2026-05-13T01:31:00.000Z',
  });
  const ledger = createPolicyFoundryCounterexampleLedger({
    candidate,
    registeredCandidate,
    readiness,
    redTeamReplay: replay,
    events,
    generatedAt: '2026-05-13T01:32:00.000Z',
  });

  equal(ledger.status, 'blocked', 'Counterexample ledger: risky signals block promotion');
  equal(ledger.promotionBlocked, true, 'Counterexample ledger: promotion blocked is explicit');
  ok(ledger.counterexampleCount > 0, 'Counterexample ledger: counterexamples are counted');
  ok(ledger.missingProofCount > 0, 'Counterexample ledger: missing proof is counted');
  ok(ledger.highRiskAutoAdmitCount > 0, 'Counterexample ledger: high-risk auto-admits are counted');
  ok(ledger.replayDuplicateRate > 0.1, 'Counterexample ledger: replay pressure is retained');
  ok(ledger.noGoReasons.includes('counterexamples-present'), 'Counterexample ledger: counterexample no-go is retained');
  ok(ledger.noGoReasons.includes('missing-evidence-coverage'), 'Counterexample ledger: missing evidence no-go is retained');
  ok(ledger.noGoReasons.includes('single-actor-concentration'), 'Counterexample ledger: actor concentration no-go is retained');
  ok(ledger.noGoReasons.includes('replay-duplicate-pressure'), 'Counterexample ledger: replay no-go is retained');
  ok(
    ledger.entries.some((entry) => entry.kind === 'simulation-counterexample' && entry.status === 'blocking'),
    'Counterexample ledger: simulation counterexample entry blocks',
  );
  ok(
    ledger.entries.some((entry) => entry.kind === 'missing-proof' && entry.status === 'blocking'),
    'Counterexample ledger: missing proof entry blocks',
  );
  ok(
    ledger.entries.some((entry) => entry.kind === 'high-risk-auto-admit' && entry.status === 'blocking'),
    'Counterexample ledger: high-risk auto-admit entry blocks',
  );
  ok(
    ledger.entries.some((entry) => entry.kind === 'actor-concentration' && entry.status === 'blocking'),
    'Counterexample ledger: actor concentration entry blocks',
  );
  ok(
    ledger.entries.some((entry) => entry.kind === 'replay-duplicate-pressure' && entry.status === 'blocking'),
    'Counterexample ledger: replay pressure entry blocks',
  );
  ok(
    ledger.entries.some((entry) => entry.kind === 'red-team-replay-failure' && entry.status === 'blocking'),
    'Counterexample ledger: red-team replay failure entry blocks',
  );
}

function testCustomTemplateGapBlocksCandidate(): void {
  const events = [
    event({
      actor: 'custom-agent',
      action: 'custom_action',
      domain: 'custom',
      downstreamSystem: 'custom-system',
      occurredAt: '2026-05-13T02:00:00.000Z',
    }),
  ];
  const { candidate, registeredCandidate, report } = candidateContext(events);
  const ledger = createPolicyFoundryCounterexampleLedger({
    candidate,
    registeredCandidate,
    readiness: null,
    redTeamReplay: null,
    events,
    generatedAt: '2026-05-13T02:01:00.000Z',
  });

  equal(registeredCandidate.schemaStatus, 'needs-template', 'Counterexample ledger setup: custom candidate needs template');
  equal(ledger.status, 'blocked', 'Counterexample ledger: custom template gap blocks promotion');
  ok(ledger.noGoReasons.includes('custom-domain-template-required'), 'Counterexample ledger: custom template no-go is retained');
  ok(
    ledger.entries.some((entry) =>
      entry.kind === 'schema-template-gap' &&
      entry.status === 'blocking' &&
      entry.reasonCodes.includes('custom-domain-template-required')
    ),
    'Counterexample ledger: schema template gap is explicit',
  );
  ok(report.digest.startsWith('sha256:'), 'Counterexample ledger setup: report digest is generated');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryCounterexampleLedgerDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-counterexample-ledger.v1', 'Counterexample ledger descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Counterexample ledger descriptor: auto enforce is false');
  equal(descriptor.evidenceDigestOnly, true, 'Counterexample ledger descriptor: digest-only evidence is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-counterexample-ledger', 'Counterexample ledger descriptor: data minimization surface is explicit');
  ok(
    descriptor.entryKinds.includes('replay-duplicate-pressure'),
    'Counterexample ledger descriptor: replay pressure entry is exposed',
  );
  includes(doc, 'src/consequence-admission/policy-foundry-counterexample-ledger.ts', 'Policy Foundry docs: counterexample ledger contract is named');
  includes(doc, 'test:policy-foundry-counterexample-ledger', 'Policy Foundry docs: counterexample ledger test command is named');
  includes(tracker, 'Step 05', 'Deepening tracker: Step 05 is present');
  includes(tracker, 'Counterexample Ledger', 'Deepening tracker: counterexample ledger step is named');
  includes(tracker, 'attestor.policy-foundry-counterexample-ledger.v1', 'Deepening tracker: counterexample ledger version is named');
  equal(
    pkg.scripts['test:policy-foundry-counterexample-ledger'],
    'tsx tests/policy-foundry-counterexample-ledger.test.ts',
    'Package: counterexample ledger test is exposed',
  );
}

try {
  testCleanLedgerStaysDigestOnlyAndUnblocked();
  testRiskSignalsBlockPromotion();
  testCustomTemplateGapBlocksCandidate();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry counterexample ledger tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry counterexample ledger tests failed:', error);
  process.exitCode = 1;
}
