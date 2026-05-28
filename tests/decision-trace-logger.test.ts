import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  DECISION_TRACE_LOGGER_VERSION,
  DECISION_TRACE_PHASES,
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createCanonicalShadowEvent,
  createDecisionTraceLogger,
  decisionTraceLoggerDescriptor,
  runShadowRuntimePipelineDryRun,
  verifyDecisionTraceEntries,
  type DecisionTraceEntry,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;

function fixturePipeline() {
  const event = createCanonicalShadowEvent({
    occurredAt: '2026-05-17T13:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.decision-trace-logger.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: null,
      actionName: 'refund.create',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestC,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: null,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: 'delegated-service-role',
        principalRefDigest: digestB,
        resourceRefDigest: digestC,
        permissionRefDigest: digestD,
      },
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'digest-only',
  });

  return runShadowRuntimePipelineDryRun({
    event,
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestF,
      freshnessWindowSeconds: 300,
    },
    generatedAt: '2026-05-17T13:00:01.000Z',
  });
}

function testDescriptorRecordsNonAuthorityTraceBoundary(): void {
  const descriptor = decisionTraceLoggerDescriptor();

  equal(descriptor.version, DECISION_TRACE_LOGGER_VERSION, 'Decision trace logger: descriptor version is explicit');
  equal(descriptor.shadowRuntimePipelineVersion, SHADOW_RUNTIME_PIPELINE_VERSION, 'Decision trace logger: descriptor binds W05 pipeline version');
  equal(descriptor.tamperEvidentHistoryVersion, CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION, 'Decision trace logger: descriptor names the existing tamper-evident history version');
  deepEqual([...descriptor.phases], [...DECISION_TRACE_PHASES], 'Decision trace logger: descriptor exposes the full ordered phase list');
  equal(descriptor.chainMode, 'linear-hash-chain', 'Decision trace logger: descriptor records linear hash-chain mode');
  equal(descriptor.ttlRequired, true, 'Decision trace logger: TTL is mandatory');
  equal(descriptor.replayRejected, true, 'Decision trace logger: replay rejection is explicit');
  equal(descriptor.digestOnly, true, 'Decision trace logger: descriptor is digest-only');
  equal(descriptor.structuredForOfflineSpecChecks, true, 'Decision trace logger: trace is structured for offline spec checks');
  equal(descriptor.writesAuditPlane, false, 'Decision trace logger: descriptor cannot write audit plane');
  equal(descriptor.canAdmit, false, 'Decision trace logger: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Decision trace logger: descriptor cannot activate enforcement');
  equal(descriptor.rawPayloadStored, false, 'Decision trace logger: descriptor stores no raw payload');
  ok(
    descriptor.nonClaims.includes('not-production-log-integrity'),
    'Decision trace logger: production log integrity is a non-claim',
  );
}

function testLoggerRecordsEightPhaseDigestOnlyTrace(): void {
  const pipeline = fixturePipeline();
  const before = JSON.stringify(pipeline);
  const logger = createDecisionTraceLogger({
    traceId: 'trace:w06:happy-path',
    ttlSeconds: 3600,
    now: () => '2026-05-17T13:00:00.000Z',
  });

  const decision = logger.recordPipeline(pipeline, '2026-05-17T13:00:02.000Z');
  const after = JSON.stringify(pipeline);
  const entries = logger.list();
  const verification = logger.verify('2026-05-17T13:30:00.000Z');
  const snapshot = logger.snapshot('2026-05-17T13:30:00.000Z');

  equal(after, before, 'Decision trace logger: source pipeline is not mutated');
  equal(decision.outcome, 'recorded', 'Decision trace logger: first pipeline append records');
  equal(decision.recorded, true, 'Decision trace logger: append decision marks recorded true');
  equal(decision.failClosed, false, 'Decision trace logger: successful append is not fail-closed');
  equal(decision.entryCount, DECISION_TRACE_PHASES.length, 'Decision trace logger: one entry is recorded per phase');
  equal(entries.length, DECISION_TRACE_PHASES.length, 'Decision trace logger: list returns all phase entries');
  deepEqual(entries.map((entry) => entry.phase), [...DECISION_TRACE_PHASES], 'Decision trace logger: phases remain ordered');
  equal(entries[0]?.previousEntryDigest ?? null, null, 'Decision trace logger: first entry has no previous entry');
  equal(entries[0]?.previousRootDigest ?? null, null, 'Decision trace logger: first entry has no previous root');

  entries.forEach((entry, index) => {
    equal(entry.version, DECISION_TRACE_LOGGER_VERSION, `Decision trace logger: entry ${index + 1} version is explicit`);
    equal(entry.sequence, index + 1, `Decision trace logger: entry ${index + 1} sequence is contiguous`);
    equal(entry.pipelineDigest, pipeline.digest, `Decision trace logger: entry ${index + 1} binds pipeline digest`);
    equal(entry.envelopeRefDigest, pipeline.projection.envelopeRefDigest, `Decision trace logger: entry ${index + 1} binds envelope ref digest`);
    equal(entry.observedAt, '2026-05-17T13:00:02.000Z', `Decision trace logger: entry ${index + 1} observedAt is normalized`);
    equal(entry.ttlExpiresAt, '2026-05-17T14:00:02.000Z', `Decision trace logger: entry ${index + 1} has TTL expiry`);
    equal(entry.rawPayloadStored, false, `Decision trace logger: entry ${index + 1} stores no raw payload`);
    equal(entry.rawPromptStored, false, `Decision trace logger: entry ${index + 1} stores no raw prompt`);
    equal(entry.rawProviderBodyStored, false, `Decision trace logger: entry ${index + 1} stores no raw provider body`);
    equal(entry.grantsAuthority, false, `Decision trace logger: entry ${index + 1} grants no authority`);
    equal(entry.canAdmit, false, `Decision trace logger: entry ${index + 1} cannot admit`);
    equal(entry.activatesEnforcement, false, `Decision trace logger: entry ${index + 1} cannot activate enforcement`);
    equal(entry.productionReady, false, `Decision trace logger: entry ${index + 1} is not production readiness`);
    ok(entry.entryPayloadDigest.startsWith('sha256:'), `Decision trace logger: entry ${index + 1} has payload digest`);
    ok(entry.entryDigest.startsWith('sha256:'), `Decision trace logger: entry ${index + 1} has entry digest`);
    ok(entry.rootDigest.startsWith('sha256:'), `Decision trace logger: entry ${index + 1} has root digest`);
    if (index > 0) {
      equal(entry.previousEntryDigest, entries[index - 1]?.entryDigest ?? null, `Decision trace logger: entry ${index + 1} chains previous entry`);
      equal(entry.previousRootDigest, entries[index - 1]?.rootDigest ?? null, `Decision trace logger: entry ${index + 1} chains previous root`);
    }
  });

  equal(verification.valid, true, 'Decision trace logger: verification accepts intact trace');
  equal(verification.failClosed, false, 'Decision trace logger: intact verification is not fail-closed');
  equal(verification.verifiedEntryCount, DECISION_TRACE_PHASES.length, 'Decision trace logger: verification counts entries');
  equal(verification.rootDigest, entries.at(-1)?.rootDigest ?? null, 'Decision trace logger: verification root matches last entry');
  equal(snapshot.entryCount, DECISION_TRACE_PHASES.length, 'Decision trace logger: snapshot counts entries');
  equal(snapshot.writesAuditPlane, false, 'Decision trace logger: snapshot does not write audit plane');
  equal(snapshot.signatureIncluded, false, 'Decision trace logger: snapshot is not a signed production log');
  equal(snapshot.externalImmutabilityClaimed, false, 'Decision trace logger: snapshot does not claim external immutability');
  equal(snapshot.complianceClaimed, false, 'Decision trace logger: snapshot does not claim compliance');
  equal(snapshot.productionReady, false, 'Decision trace logger: snapshot is not production readiness');
  ok(snapshot.digest.startsWith('sha256:'), 'Decision trace logger: snapshot has digest');
}

function testLoggerRejectsReplayAndCapacityOverflowFailClosed(): void {
  const pipeline = fixturePipeline();
  const logger = createDecisionTraceLogger({
    traceId: 'trace:w06:replay',
    ttlSeconds: 3600,
    now: () => '2026-05-17T13:00:00.000Z',
  });

  const first = logger.recordPipeline(pipeline, '2026-05-17T13:00:02.000Z');
  const second = logger.recordPipeline(pipeline, '2026-05-17T13:00:03.000Z');
  const small = createDecisionTraceLogger({
    traceId: 'trace:w06:capacity',
    ttlSeconds: 3600,
    maxEntries: DECISION_TRACE_PHASES.length - 1,
    now: () => '2026-05-17T13:00:00.000Z',
  });
  const held = small.recordPipeline(pipeline, '2026-05-17T13:00:02.000Z');

  equal(first.outcome, 'recorded', 'Decision trace logger: first append records');
  equal(second.outcome, 'replay-rejected', 'Decision trace logger: second append rejects replay');
  equal(second.recorded, false, 'Decision trace logger: replay append is not recorded');
  equal(second.failClosed, true, 'Decision trace logger: replay fails closed');
  ok(second.failureReasons.includes('pipeline-replay'), 'Decision trace logger: replay reason is explicit');
  equal(logger.list().length, DECISION_TRACE_PHASES.length, 'Decision trace logger: replay does not append entries');
  equal(held.outcome, 'held', 'Decision trace logger: capacity exhaustion holds append');
  equal(held.failClosed, true, 'Decision trace logger: capacity exhaustion fails closed');
  ok(held.failureReasons.includes('trace-capacity-exhausted'), 'Decision trace logger: capacity failure reason is explicit');
  equal(small.list().length, 0, 'Decision trace logger: capacity hold does not append entries');
}

function testVerificationDetectsTamperReorderAndExpiry(): void {
  const pipeline = fixturePipeline();
  const logger = createDecisionTraceLogger({
    traceId: 'trace:w06:tamper',
    ttlSeconds: 60,
    now: () => '2026-05-17T13:00:00.000Z',
  });
  logger.recordPipeline(pipeline, '2026-05-17T13:00:02.000Z');
  const entries = logger.list();
  const tampered = [
    {
      ...entries[0],
      outputDigest: digestF,
    },
    ...entries.slice(1),
  ] as readonly DecisionTraceEntry[];
  const reordered = [
    entries[1] as DecisionTraceEntry,
    entries[0] as DecisionTraceEntry,
    ...entries.slice(2),
  ] as readonly DecisionTraceEntry[];
  const tamperVerification = verifyDecisionTraceEntries({
    traceId: logger.traceId,
    entries: tampered,
    verifiedAt: '2026-05-17T13:00:30.000Z',
  });
  const reorderVerification = verifyDecisionTraceEntries({
    traceId: logger.traceId,
    entries: reordered,
    verifiedAt: '2026-05-17T13:00:30.000Z',
  });
  const expiredVerification = logger.verify('2026-05-17T13:02:03.000Z');

  equal(tamperVerification.valid, false, 'Decision trace logger: tampered entry is invalid');
  equal(tamperVerification.failClosed, true, 'Decision trace logger: tamper fails closed');
  ok(
    tamperVerification.failureReasons.includes('entry-payload-digest-mismatch'),
    'Decision trace logger: tamper reports payload digest mismatch',
  );
  equal(reorderVerification.valid, false, 'Decision trace logger: reordered entries are invalid');
  ok(
    reorderVerification.failureReasons.includes('sequence-gap'),
    'Decision trace logger: reorder reports sequence gap',
  );
  ok(
    reorderVerification.failureReasons.includes('previous-entry-digest-mismatch'),
    'Decision trace logger: reorder reports previous-entry mismatch',
  );
  equal(expiredVerification.valid, false, 'Decision trace logger: expired trace is invalid');
  ok(
    expiredVerification.failureReasons.includes('ttl-expired'),
    'Decision trace logger: expired trace reports TTL failure',
  );
}

function testLoggerFailsClosedForUnsafeInputs(): void {
  const pipeline = fixturePipeline();

  throws(
    () =>
      createDecisionTraceLogger({
        traceId: 'trace:w06:bad-ttl',
        ttlSeconds: 0,
      }),
    /ttlSeconds is required and must be a positive integer/u,
    'Decision trace logger: missing TTL fails closed',
  );

  const logger = createDecisionTraceLogger({
    traceId: 'trace:w06:unsafe-pipeline',
    ttlSeconds: 3600,
  });

  throws(
    () =>
      logger.recordPipeline({
        ...pipeline,
        rawPayloadStored: true,
      } as never),
    /must preserve shadow-only no-authority invariants/u,
    'Decision trace logger: unsafe pipeline fails closed',
  );
}

function testDocsOverviewPackageSurfaceAndScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'decision-trace-logger.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Decision Trace Logger',
    'attestor.decision-trace-logger.v1',
    'PObserve-style',
    'CloudTrail log file integrity validation',
    'OPA Decision Logs',
    'OpenTelemetry Logs Data Model',
    'linear hash chain',
    'replay-rejected',
    'ttlSeconds',
    'not production log integrity',
    'not live enforcement',
    'not formal verification',
    'not production readiness',
  ]) {
    includes(doc, expected, `Decision trace logger doc: records ${expected}`);
  }

  for (const expected of [
    '| W06 | complete | Decision Trace Logger |',
    'src/consequence-admission/decision-trace-logger.ts',
    'tests/decision-trace-logger.test.ts',
    'docs/02-architecture/decision-trace-logger.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    packageProbe,
    'decisionTraceLoggerDescriptor',
    'Package probe: checks descriptor export',
  );
  includes(
    packageProbe,
    'createDecisionTraceLogger',
    'Package probe: checks logger export',
  );
  includes(
    packageProbe,
    'verifyDecisionTraceEntries',
    'Package probe: checks verification export',
  );
  equal(
    packageJson.scripts['test:decision-trace-logger'],
    'tsx tests/decision-trace-logger.test.ts',
    'Decision trace logger: package script is registered',
  );
}

testDescriptorRecordsNonAuthorityTraceBoundary();
testLoggerRecordsEightPhaseDigestOnlyTrace();
testLoggerRejectsReplayAndCapacityOverflowFailClosed();
testVerificationDetectsTamperReorderAndExpiry();
testLoggerFailsClosedForUnsafeInputs();
testDocsOverviewPackageSurfaceAndScriptStayAligned();

console.log(`Decision trace logger tests: ${passed} passed, 0 failed`);
