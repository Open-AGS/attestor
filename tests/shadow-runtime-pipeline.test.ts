import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SHADOW_RUNTIME_PIPELINE_VERSION,
  createCanonicalShadowEvent,
  runShadowRuntimePipelineDryRun,
  shadowRuntimePipelineDescriptor,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
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

function fixtureCanonicalShadowEvent() {
  return createCanonicalShadowEvent({
    occurredAt: '2026-05-17T12:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.shadow-runtime-pipeline.test',
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
}

function testDescriptorRecordsShadowOnlyNoAuthorityWiring(): void {
  const descriptor = shadowRuntimePipelineDescriptor();

  equal(descriptor.version, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime pipeline: descriptor version is explicit');
  equal(descriptor.executionMode, 'shadow-only', 'Shadow runtime pipeline: descriptor is shadow-only');
  equal(descriptor.pureFunction, true, 'Shadow runtime pipeline: descriptor records pure function boundary');
  equal(descriptor.deterministicProjection, true, 'Shadow runtime pipeline: descriptor records deterministic projection');
  equal(descriptor.builtInAdapterRegistryUsed, true, 'Shadow runtime pipeline: descriptor uses built-in adapters');
  equal(descriptor.relationshipEvaluationBeforeFusion, true, 'Shadow runtime pipeline: relationships run before fusion');
  equal(descriptor.unsignedPacketOnly, true, 'Shadow runtime pipeline: descriptor only creates unsigned packets');
  equal(descriptor.noLiveEnforcement, true, 'Shadow runtime pipeline: descriptor forbids live enforcement');
  equal(descriptor.canAdmit, false, 'Shadow runtime pipeline: descriptor cannot admit');
  equal(descriptor.grantsAuthority, false, 'Shadow runtime pipeline: descriptor cannot grant authority');
  equal(descriptor.activatesEnforcement, false, 'Shadow runtime pipeline: descriptor cannot activate enforcement');
  equal(descriptor.learnsFromTraffic, false, 'Shadow runtime pipeline: descriptor does not learn');
  ok(
    descriptor.connects.includes('attestor.relationship-detector-contract.v1'),
    'Shadow runtime pipeline: descriptor connects relationship detector',
  );
  ok(
    descriptor.connects.includes('attestor.signed-assurance-packet.v1'),
    'Shadow runtime pipeline: descriptor connects signed assurance packet',
  );
}

function testPipelineRunsEndToEndWithoutAuthority(): void {
  const result = runShadowRuntimePipelineDryRun({
    event: fixtureCanonicalShadowEvent(),
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestD,
      freshnessWindowSeconds: 300,
    },
    generatedAt: '2026-05-17T12:00:01.000Z',
  });

  equal(result.version, SHADOW_RUNTIME_PIPELINE_VERSION, 'Shadow runtime pipeline: result version is explicit');
  equal(result.executionMode, 'shadow-only', 'Shadow runtime pipeline: result is shadow-only');
  equal(result.projection.projectionMode, 'shadow-only', 'Shadow runtime pipeline: projection is shadow-only');
  equal(result.adapterRegistry.coverageComplete, true, 'Shadow runtime pipeline: built-in adapter registry is complete');
  equal(result.counts.signalBatchCount, 6, 'Shadow runtime pipeline: emits one batch per built-in adapter');
  equal(result.counts.signalCount, 6, 'Shadow runtime pipeline: emits six typed signals');
  equal(result.counts.opinionCount, 6, 'Shadow runtime pipeline: projects signals into opinions');
  ok(result.counts.relationshipCount >= 6, 'Shadow runtime pipeline: detects review-forcing relationships');
  ok(result.counts.interactionRuleCount >= 6, 'Shadow runtime pipeline: emits interaction rules');
  ok(result.counts.modulatorCount >= 3, 'Shadow runtime pipeline: creates envelope context modulators');
  equal(result.fusion.relationshipAware, true, 'Shadow runtime pipeline: uses relationship-aware fusion');
  equal(result.conflictGate.runsAfterRelationshipAwareFusion, true, 'Shadow runtime pipeline: conflict gate follows fusion');
  ok(
    result.humanComprehensionGate.reasonLineCount <= 7,
    'Shadow runtime pipeline: human reason lines remain bounded',
  );
  ok(
    result.humanComprehensionGate.activeQuestionCount <= 3,
    'Shadow runtime pipeline: active questions remain bounded',
  );
  equal(result.assurancePacket.signatureStatus, 'unsigned', 'Shadow runtime pipeline: packet is unsigned');
  equal(result.assurancePacket.activationReady, false, 'Shadow runtime pipeline: packet cannot activate');
  equal(result.assurancePacket.canAdmit, false, 'Shadow runtime pipeline: packet cannot admit');
  equal(result.canAdmit, false, 'Shadow runtime pipeline: result cannot admit');
  equal(result.grantsAuthority, false, 'Shadow runtime pipeline: result cannot grant authority');
  equal(result.activatesEnforcement, false, 'Shadow runtime pipeline: result cannot activate enforcement');
  equal(result.autoEnforce, false, 'Shadow runtime pipeline: result cannot auto-enforce');
  equal(result.learnsFromTraffic, false, 'Shadow runtime pipeline: result does not learn');
  equal(result.crossTenantAggregation, false, 'Shadow runtime pipeline: result has no cross-tenant aggregation');
  equal(result.rawPayloadRead, false, 'Shadow runtime pipeline: result does not read raw payload');
  equal(result.rawPayloadStored, false, 'Shadow runtime pipeline: result stores no raw payload');
  equal(result.productionReady, false, 'Shadow runtime pipeline: result is not production readiness');
  ok(result.digest.startsWith('sha256:'), 'Shadow runtime pipeline: result digest is present');
}

function testPipelineIsDeterministicAndDoesNotMutateSource(): void {
  const event = fixtureCanonicalShadowEvent();
  const before = JSON.stringify(event);
  const first = runShadowRuntimePipelineDryRun({
    event,
    generatedAt: '2026-05-17T12:00:01.000Z',
  });
  const second = runShadowRuntimePipelineDryRun({
    event,
    generatedAt: '2026-05-17T12:00:01.000Z',
  });
  const after = JSON.stringify(event);

  equal(after, before, 'Shadow runtime pipeline: source event is not mutated');
  equal(first.projection.digest, second.projection.digest, 'Shadow runtime pipeline: projection digest is deterministic');
  equal(first.relationshipDetection.digest, second.relationshipDetection.digest, 'Shadow runtime pipeline: relationship digest is deterministic');
  equal(first.assurancePacket.digest, second.assurancePacket.digest, 'Shadow runtime pipeline: assurance packet digest is deterministic');
  equal(first.digest, second.digest, 'Shadow runtime pipeline: result digest is deterministic');
}

function testPipelineFailsClosedForUnsafeInput(): void {
  const event = fixtureCanonicalShadowEvent();

  throws(
    () =>
      runShadowRuntimePipelineDryRun({
        event: {
          ...event,
          rawPayloadStored: true,
        } as never,
      }),
    /must not store raw payload material/u,
    'Shadow runtime pipeline: raw payload shadow event fails closed',
  );
  throws(
    () =>
      runShadowRuntimePipelineDryRun({
        event,
        generatedAt: 'not-a-date',
      }),
    /generatedAt must be an ISO timestamp/u,
    'Shadow runtime pipeline: invalid generatedAt fails closed',
  );
  throws(
    () =>
      runShadowRuntimePipelineDryRun({
        event,
        reviewerCapacityPerHour: -1,
      }),
    /reviewerCapacityPerHour must be a non-negative integer/u,
    'Shadow runtime pipeline: invalid review capacity fails closed',
  );
}

function testDocsOverviewPackageSurfaceAndScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'shadow-runtime-pipeline.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Shadow Runtime Pipeline',
    'attestor.shadow-runtime-pipeline.v1',
    'Shadow Event -> Consequence Envelope',
    'Relationship Detector Contract',
    'Relationship-Aware Hazard Fusion',
    'Human Comprehension Gate',
    'Signed Assurance Packet',
    'NASA Runtime Assurance',
    'NVIDIA Safety Force Field',
    'OPA Decision Logs',
    'OpenTelemetry GenAI semantic conventions',
    'not live enforcement',
    'not policy activation',
    'not learning',
    'not production readiness',
  ]) {
    includes(doc, expected, `Shadow runtime pipeline doc: records ${expected}`);
  }

  for (const expected of [
    '| W05 | complete | Shadow Runtime Pipeline Dry Run |',
    'src/consequence-admission/shadow-runtime-pipeline.ts',
    'tests/shadow-runtime-pipeline.test.ts',
    'docs/02-architecture/shadow-runtime-pipeline.md',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    packageProbe,
    'shadowRuntimePipelineDescriptor',
    'Package probe: checks descriptor export',
  );
  includes(
    packageProbe,
    'runShadowRuntimePipelineDryRun',
    'Package probe: checks runner export',
  );
  equal(
    packageJson.scripts['test:shadow-runtime-pipeline'],
    'tsx tests/shadow-runtime-pipeline.test.ts',
    'Shadow runtime pipeline: package script is registered',
  );
}

testDescriptorRecordsShadowOnlyNoAuthorityWiring();
testPipelineRunsEndToEndWithoutAuthority();
testPipelineIsDeterministicAndDoesNotMutateSource();
testPipelineFailsClosedForUnsafeInput();
testDocsOverviewPackageSurfaceAndScriptStayAligned();

console.log(`Shadow runtime pipeline tests: ${passed} passed, 0 failed`);
