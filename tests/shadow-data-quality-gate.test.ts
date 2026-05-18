import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS,
  SHADOW_DATA_QUALITY_GATE_VERSION,
  createCanonicalShadowEvent,
  createShadowDataQualityGate,
  evaluateShadowDataQualityGate,
  shadowDataQualityGateDescriptor,
  type CreateCanonicalShadowEventInput,
  type CreateShadowDataQualityGateInput,
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
const digestF = `sha256:${'f'.repeat(64)}`;
const digest0 = `sha256:${'0'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;

function canonicalInput(
  overrides?: Partial<CreateCanonicalShadowEventInput>,
): CreateCanonicalShadowEventInput {
  return {
    occurredAt: '2026-05-18T10:00:00.000Z',
    observedAt: '2026-05-18T10:01:00.000Z',
    sourceKind: 'admission-shadow',
    producer: 'attestor.consequence-admission',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: digestC,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestD,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: null,
    decision: {
      admissionDigest: digestE,
      mode: 'observe',
      shadowDecision: 'would-review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: ['shadow-data-quality-test'],
    },
    outcome: {
      downstreamOutcome: null,
      humanOutcome: null,
    },
    evidenceRefs: [
      { kind: 'evidence', digest: digestE, origin: 'observed' },
      { kind: 'provenance', digest: digestF, origin: 'observed' },
    ],
    approvalRefs: [{ kind: 'approval', digest: digest0, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digest1, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestC, origin: 'observed' }],
    idempotencyRefDigest: digestD,
    replayRefDigest: digestE,
    traceRefDigest: digestF,
    schemaRefDigest: digest0,
    rawMaterialPolicy: 'digest-only',
    ...overrides,
  };
}

function cleanGateInput(
  overrides?: Partial<CreateShadowDataQualityGateInput>,
): CreateShadowDataQualityGateInput {
  return {
    event: createCanonicalShadowEvent(canonicalInput()),
    evaluatedAt: '2026-05-18T10:02:00.000Z',
    evaluatorRefDigest: digest1,
    assuranceCaseRefDigest: digest0,
    attacksNodeId: 'evidence:shadow-data-quality',
    trustedProducers: ['attestor.consequence-admission'],
    ...overrides,
  };
}

function testDescriptorRecordsQualityGateBoundary(): void {
  const descriptor = shadowDataQualityGateDescriptor();

  equal(descriptor.version, SHADOW_DATA_QUALITY_GATE_VERSION, 'Shadow data quality: version is explicit');
  equal(descriptor.canonicalShadowEventSchemaVersion, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow data quality: binds canonical shadow schema');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Shadow data quality: binds assurance case contract');
  ok(descriptor.sourceAnchors.includes('cloudevents-required-context-and-privacy'), 'Shadow data quality: CloudEvents anchor is present');
  ok(descriptor.sourceAnchors.includes('w3c-prov-provenance-data-model'), 'Shadow data quality: W3C PROV anchor is present');
  ok(descriptor.sourceAnchors.includes('opentelemetry-timestamp-observedtimestamp-traceid'), 'Shadow data quality: OpenTelemetry anchor is present');
  ok(descriptor.sourceAnchors.includes('great-expectations-validation-result'), 'Shadow data quality: validation-result anchor is present');
  ok(descriptor.dimensions.includes('provenance'), 'Shadow data quality: provenance dimension is represented');
  ok(descriptor.dimensions.includes('freshness'), 'Shadow data quality: freshness dimension is represented');
  ok(descriptor.checkIds.includes('trace-correlation'), 'Shadow data quality: trace correlation check is represented');
  ok(descriptor.checkIds.includes('decision-fail-closed-posture'), 'Shadow data quality: fail-closed check is represented');
  ok(descriptor.dangerFlags.includes('provenance-ref-missing'), 'Shadow data quality: provenance flag is represented');
  ok(descriptor.outcomes.includes('quality-held-for-provenance'), 'Shadow data quality: provenance hold outcome is represented');
  equal(descriptor.defaultMaxObservationLagMs, SHADOW_DATA_QUALITY_GATE_DEFAULT_MAX_OBSERVATION_LAG_MS, 'Shadow data quality: default lag window is explicit');
  equal(descriptor.opensUnderminingDefeaters, true, 'Shadow data quality: opens undermining defeaters');
  equal(descriptor.assuranceCaseContextRequired, true, 'Shadow data quality: assurance case context is required');
  equal(descriptor.digestOnlyEvidence, true, 'Shadow data quality: evidence is digest-only');
  equal(descriptor.rawPayloadRead, false, 'Shadow data quality: descriptor reads no raw payload');
  equal(descriptor.learnsFromTraffic, false, 'Shadow data quality: descriptor does not learn from traffic');
  equal(descriptor.canAdmit, false, 'Shadow data quality: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Shadow data quality: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Shadow data quality: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-data-quality-platform'), 'Shadow data quality: platform claim is excluded');
}

function testCleanShadowEventIsReadyForAssuranceEvidence(): void {
  const record = createShadowDataQualityGate(cleanGateInput());
  const evaluation = evaluateShadowDataQualityGate(record);

  equal(record.version, SHADOW_DATA_QUALITY_GATE_VERSION, 'Shadow data quality: record version is explicit');
  equal(record.outcome, 'quality-ready-for-assurance-evidence', 'Shadow data quality: clean event is evidence-ready');
  equal(record.readyForAssuranceEvidence, true, 'Shadow data quality: readiness is true');
  equal(record.underminingDefeaterRequired, false, 'Shadow data quality: clean event needs no undermining defeater');
  equal(record.failedCheckCount, 0, 'Shadow data quality: clean event has no failed checks');
  equal(record.warningCheckCount, 0, 'Shadow data quality: clean event has no warnings');
  equal(record.passedCheckCount, 13, 'Shadow data quality: all checks pass');
  equal(record.evidenceRefCount, 2, 'Shadow data quality: evidence refs are counted');
  equal(record.provenanceRefCount, 1, 'Shadow data quality: provenance refs are counted');
  equal(record.traceRefPresent, true, 'Shadow data quality: trace ref is present');
  equal(record.replayOrIdempotencyRefPresent, true, 'Shadow data quality: replay/idempotency ref is present');
  equal(record.observationLagMs, 60000, 'Shadow data quality: lag is computed');
  equal(record.failClosed, false, 'Shadow data quality: clean event is not held');
  equal(record.rawPayloadRead, false, 'Shadow data quality: raw payload is not read');
  equal(record.canAdmit, false, 'Shadow data quality: record cannot admit');
  equal(record.activatesEnforcement, false, 'Shadow data quality: record cannot enforce');
  equal(record.productionReady, false, 'Shadow data quality: record is not production readiness');
  equal(evaluation.readyForAssuranceEvidence, true, 'Shadow data quality: evaluation preserves readiness');
  equal(evaluation.canAdmit, false, 'Shadow data quality: evaluation cannot admit');
  ok(record.digest.startsWith('sha256:'), 'Shadow data quality: record has digest');
  ok(evaluation.digest.startsWith('sha256:'), 'Shadow data quality: evaluation has digest');
}

function testMissingProvenanceHoldsEvidence(): void {
  const event = createCanonicalShadowEvent(canonicalInput({
    evidenceRefs: [],
    schemaRefDigest: null,
  }));
  const record = createShadowDataQualityGate(cleanGateInput({ event }));

  equal(record.outcome, 'quality-held-for-provenance', 'Shadow data quality: missing provenance holds evidence');
  equal(record.readyForAssuranceEvidence, false, 'Shadow data quality: missing provenance is not evidence-ready');
  equal(record.underminingDefeaterRequired, true, 'Shadow data quality: missing provenance opens defeater material');
  ok(record.dangerFlags.includes('evidence-ref-missing'), 'Shadow data quality: evidence missing flag is present');
  ok(record.dangerFlags.includes('provenance-ref-missing'), 'Shadow data quality: provenance missing flag is present');
  ok(record.dangerFlags.includes('schema-ref-missing'), 'Shadow data quality: schema missing flag is present');
  ok(record.underminingDefeaterReasonCodes.includes('provenance-ref-missing'), 'Shadow data quality: defeater reason includes provenance missing');
}

function testAssuranceCaseContextIsRequired(): void {
  const record = createShadowDataQualityGate(cleanGateInput({
    assuranceCaseRefDigest: null,
    attacksNodeId: null,
  }));

  equal(record.outcome, 'quality-held-for-assurance-case', 'Shadow data quality: missing assurance case context is held');
  ok(record.dangerFlags.includes('assurance-case-unbound'), 'Shadow data quality: assurance case unbound flag is present');
  equal(record.underminingDefeaterRequired, true, 'Shadow data quality: unbound evidence opens defeater material');
}

function testSparseInferredStaleAndUntrustedEventsOpenDefeater(): void {
  const event = createCanonicalShadowEvent(canonicalInput({
    observedAt: '2026-05-18T10:20:00.000Z',
    producer: 'untrusted.importer',
    observed: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: 'tool-call',
      consequenceClass: null,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: digestC,
      actionName: 'issue_refund',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestD,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    evidenceRefs: [
      { kind: 'evidence', digest: digestE, origin: 'inferred' },
      { kind: 'provenance', digest: digestF, origin: 'observed' },
    ],
  }));
  const record = createShadowDataQualityGate(cleanGateInput({ event }));

  equal(record.outcome, 'quality-open-undermining-defeater', 'Shadow data quality: weak event opens undermining defeater');
  ok(record.dangerFlags.includes('observation-lag-exceeded'), 'Shadow data quality: lag flag is present');
  ok(record.dangerFlags.includes('observed-facts-sparse'), 'Shadow data quality: sparse observed facts flag is present');
  ok(record.dangerFlags.includes('inferred-facts-dominate'), 'Shadow data quality: inferred-dominates flag is present');
  ok(record.dangerFlags.includes('inferred-reference-origin'), 'Shadow data quality: inferred reference flag is present');
  ok(record.dangerFlags.includes('producer-untrusted'), 'Shadow data quality: untrusted producer flag is present');
  equal(record.underminingDefeaterKind, 'undermining', 'Shadow data quality: defeater kind is undermining');
}

function testMissingTraceAndReplayAreCorrelationDefeaterMaterial(): void {
  const event = createCanonicalShadowEvent(canonicalInput({
    traceRefDigest: null,
    replayRefDigest: null,
    idempotencyRefDigest: null,
  }));
  const record = createShadowDataQualityGate(cleanGateInput({ event }));

  equal(record.outcome, 'quality-open-undermining-defeater', 'Shadow data quality: missing correlation refs opens defeater material');
  ok(record.dangerFlags.includes('trace-ref-missing'), 'Shadow data quality: missing trace flag is present');
  ok(record.dangerFlags.includes('replay-or-idempotency-ref-missing'), 'Shadow data quality: missing replay/idempotency flag is present');
  equal(record.warningCheckCount, 2, 'Shadow data quality: missing correlation refs are warnings');
}

function testDecisionFailOpenIsDefeaterMaterial(): void {
  const event = createCanonicalShadowEvent(canonicalInput({
    decision: {
      admissionDigest: digestE,
      mode: 'observe',
      shadowDecision: 'would-admit',
      effectiveDecision: 'admit',
      allowed: true,
      failClosed: false,
      reasonCodes: ['fail-open-test'],
    },
  }));
  const record = createShadowDataQualityGate(cleanGateInput({ event }));

  equal(record.outcome, 'quality-open-undermining-defeater', 'Shadow data quality: fail-open decision posture opens defeater');
  ok(record.dangerFlags.includes('decision-fail-open'), 'Shadow data quality: fail-open flag is present');
  equal(record.failedCheckCount, 1, 'Shadow data quality: fail-open is a failed quality check');
}

function testRawMaterialAndInvalidInputsFailClosed(): void {
  const event = createCanonicalShadowEvent(canonicalInput());

  throws(
    () => createShadowDataQualityGate(cleanGateInput({
      event: {
        ...event,
        rawPayloadStored: true,
      } as never,
    })),
    /must not store raw payload material/u,
    'Shadow data quality: raw payload storage fails closed',
  );

  throws(
    () => createShadowDataQualityGate(cleanGateInput({
      event: {
        ...event,
        version: 'attestor.other.v1',
      } as never,
    })),
    /canonical shadow event schema v1/u,
    'Shadow data quality: wrong schema fails closed',
  );

  throws(
    () => createShadowDataQualityGate(cleanGateInput({
      evaluatorRefDigest: 'raw-evaluator-id',
    })),
    /evaluatorRefDigest must be a sha256 digest reference/u,
    'Shadow data quality: raw evaluator ref fails closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const input = cleanGateInput();
  const before = JSON.stringify(input);
  const first = createShadowDataQualityGate(input);
  const second = createShadowDataQualityGate(input);

  equal(first.digest, second.digest, 'Shadow data quality: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Shadow data quality: input is not mutated');
  ok(Object.isFrozen(first), 'Shadow data quality: record is frozen');
}

function testDocsPackageAndOverview(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'shadow-data-quality-gate.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe-consequence-admission-package-surface.mjs',
  );

  for (const expected of [
    '# Shadow Data Quality Gate',
    'I02',
    'CloudEvents',
    'OpenTelemetry',
    'W3C PROV',
    'Great Expectations',
    'Deequ',
    'undermining defeater',
    'not-admission-decision',
    'not-data-quality-platform',
  ]) {
    includes(docs, expected, `Shadow data quality docs: records ${expected}`);
  }

  includes(overview, 'Progress: 4/14 complete after I03. 10 steps remain.', 'Overview: progress is updated');
  includes(overview, '| I02 | complete | Shadow Data Quality Gate |', 'Overview: I02 is complete');
  includes(overview, 'src/consequence-admission/shadow-data-quality-gate.ts', 'Overview: I02 source file is tracked');
  includes(overview, 'tests/shadow-data-quality-gate.test.ts', 'Overview: I02 test file is tracked');
  includes(overview, 'I02 turns shadow evidence quality into explicit undermining-defeater material', 'Overview: I02 summary is present');
  includes(annex, 'CloudEvents required context and privacy', 'Research annex: CloudEvents anchor is present');
  includes(annex, 'W3C PROV provenance data model', 'Research annex: W3C PROV anchor is present');
  includes(annex, 'OpenTelemetry log data model', 'Research annex: OpenTelemetry anchor is present');
  assert.equal(
    packageJson.scripts['test:shadow-data-quality-gate'],
    'tsx tests/shadow-data-quality-gate.test.ts',
    'Shadow data quality: package script is registered',
  );
  passed += 1;
  includes(packageProbe, 'SHADOW_DATA_QUALITY_GATE_VERSION', 'Package probe: I02 version is checked');
}

testDescriptorRecordsQualityGateBoundary();
testCleanShadowEventIsReadyForAssuranceEvidence();
testMissingProvenanceHoldsEvidence();
testAssuranceCaseContextIsRequired();
testSparseInferredStaleAndUntrustedEventsOpenDefeater();
testMissingTraceAndReplayAreCorrelationDefeaterMaterial();
testDecisionFailOpenIsDefeaterMaterial();
testRawMaterialAndInvalidInputsFailClosed();
testDeterminismAndNoMutation();
testDocsPackageAndOverview();

console.log(`Shadow data quality gate tests: ${passed} passed, 0 failed`);
