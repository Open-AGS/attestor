import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
  createCanonicalShadowEvent,
  createCanonicalShadowEventFromAdmissionEvent,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowEnvelopeProjection,
  shadowEnvelopeProjectorDescriptor,
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
  const admission = createGenericAdmissionEnvelope({
    mode: 'observe',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    tenantId: 'tenant_raw_must_not_escape',
    requestedAt: '2026-05-17T08:00:00.000Z',
    decidedAt: '2026-05-17T08:00:01.000Z',
    requestId: 'request_raw_must_not_escape',
    recipient: 'customer_raw_must_not_escape',
    evidenceRefs: ['order_raw_must_not_escape'],
    policyRef: 'policy_raw_must_not_escape',
  });
  const shadowEvent = createShadowAdmissionEvent({
    admission,
    occurredAt: '2026-05-17T08:00:02.000Z',
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      rawFeature: 'feature_raw_must_not_escape',
    },
  });
  return createCanonicalShadowEventFromAdmissionEvent(shadowEvent, {
    actionKind: 'api-operation',
    targetAccountRefDigest: digestA,
    resourceRefDigest: digestB,
  });
}

function testProjectionBuildsShadowOnlyEnvelope(): void {
  const canonical = fixtureCanonicalShadowEvent();
  const projection = createShadowEnvelopeProjection(canonical, {
    actionTypeRegistryRefDigest: digestC,
    authorityRefDigest: digestD,
    coverageRefDigest: digestE,
    actorAuthorityClass: 'delegated',
    freshnessWindowSeconds: 300,
    policyScopeRefDigest: digestB,
  });

  equal(projection.version, 'attestor.shadow-envelope-projector.v1', 'Shadow envelope projector: version is explicit');
  equal(projection.accepts, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow envelope projector: accepts canonical shadow event version');
  equal(projection.produces, CONSEQUENCE_ENVELOPE_CONTRACT_VERSION, 'Shadow envelope projector: produces consequence envelope contract version');
  equal(projection.projectionMode, 'shadow-only', 'Shadow envelope projector: projection mode is shadow-only');
  equal(projection.sourceEventDigest, canonical.digest, 'Shadow envelope projector: binds source event digest');
  equal(projection.envelope.sourceEventRef.digest, canonical.digest, 'Shadow envelope projector: envelope binds source event digest');
  equal(projection.envelope.tenantContext.tenantRefDigest, canonical.tenantRefDigest, 'Shadow envelope projector: tenant digest is preserved');
  equal(projection.envelope.actorContext.actorRefDigest, canonical.actorRefDigest, 'Shadow envelope projector: actor digest is preserved');
  equal(projection.envelope.canonicalActionType.value, 'issue_refund', 'Shadow envelope projector: action type value projects from observed action name');
  equal(projection.envelope.canonicalActionType.registryRefDigest, digestC, 'Shadow envelope projector: action registry digest option is retained');
  equal(projection.envelope.consequenceClass, 'financial', 'Shadow envelope projector: inferred consequence class projects to envelope');
  equal(projection.envelope.reversibilityClass, 'irreversible', 'Shadow envelope projector: default reversibility is conservative');
  equal(projection.envelope.blastRadiusEstimate, 'tenant', 'Shadow envelope projector: default blast radius is tenant scoped');
  equal(projection.envelope.actorContext.authorityClass, 'delegated', 'Shadow envelope projector: actor authority class option is retained');
  equal(projection.envelope.actorContext.authorityRefDigest, digestD, 'Shadow envelope projector: authority digest option is retained');
  equal(projection.envelope.tenantContext.coverageRefDigest, digestE, 'Shadow envelope projector: coverage digest option is retained');
  equal(projection.envelope.timingContext.freshnessPosture, 'unknown', 'Shadow envelope projector: freshness posture is not invented');
  equal(projection.envelope.rawMaterialBoundary.policy, 'digest-only', 'Shadow envelope projector: digest-only redaction boundary is preserved');
  equal(projection.rawPayloadRead, false, 'Shadow envelope projector: raw payload read flag is false');
  equal(projection.grantsAuthority, false, 'Shadow envelope projector: cannot grant authority');
  equal(projection.canAdmit, false, 'Shadow envelope projector: cannot admit');
  equal(projection.activatesEnforcement, false, 'Shadow envelope projector: cannot activate enforcement');
  equal(projection.autoEnforce, false, 'Shadow envelope projector: cannot auto-enforce');
  equal(projection.productionReady, false, 'Shadow envelope projector: is not production readiness');
  ok(projection.envelopeRefDigest.startsWith('sha256:'), 'Shadow envelope projector: envelope digest is generated');
  ok(projection.tenantBindingDigest.startsWith('sha256:'), 'Shadow envelope projector: tenant binding digest is generated');
  ok(projection.idempotencyKeyDigest.startsWith('sha256:'), 'Shadow envelope projector: idempotency key digest is generated');
  ok(projection.digest.startsWith('sha256:'), 'Shadow envelope projector: projection digest is generated');
}

function testProjectionIsDeterministicAndDoesNotMutateSource(): void {
  const canonical = fixtureCanonicalShadowEvent();
  const before = JSON.stringify(canonical);
  const first = createShadowEnvelopeProjection(canonical);
  const second = createShadowEnvelopeProjection(canonical);
  const after = JSON.stringify(canonical);

  equal(after, before, 'Shadow envelope projector: source event is not mutated');
  equal(first.envelopeRefDigest, second.envelopeRefDigest, 'Shadow envelope projector: envelope digest is deterministic');
  equal(first.tenantBindingDigest, second.tenantBindingDigest, 'Shadow envelope projector: tenant binding digest is deterministic');
  equal(first.idempotencyKeyDigest, second.idempotencyKeyDigest, 'Shadow envelope projector: idempotency key digest is deterministic');
  equal(first.digest, second.digest, 'Shadow envelope projector: projection digest is deterministic');
}

function testProjectionPreservesRedactionAndDoesNotForwardRawMaterial(): void {
  const canonical = createCanonicalShadowEvent({
    occurredAt: '2026-05-17T09:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.integration.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'safe-transaction-service',
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: 'transaction-proposal',
      consequenceClass: null,
      resourceRefDigest: digestC,
      dataClass: 'programmable-money',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: 'programmable-money',
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: 'multisig-confirmation',
        principalRefDigest: digestD,
        resourceRefDigest: digestC,
        permissionRefDigest: digestE,
      },
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'metadata-only',
  });
  const projection = createShadowEnvelopeProjection(canonical);
  const serialized = JSON.stringify(projection);

  equal(projection.redaction.sourceRawMaterialPolicy, 'metadata-only', 'Shadow envelope projector: source redaction policy is recorded');
  equal(projection.redaction.envelopeRawMaterialPolicy, 'redacted-summary', 'Shadow envelope projector: metadata-only maps to redacted-summary');
  equal(projection.redaction.rawPayloadRead, false, 'Shadow envelope projector: raw payload read is false');
  equal(projection.redaction.rawPayloadForwarded, false, 'Shadow envelope projector: raw payload is not forwarded');
  equal(projection.redaction.rawPromptForwarded, false, 'Shadow envelope projector: raw prompt is not forwarded');
  equal(projection.redaction.rawProviderBodyForwarded, false, 'Shadow envelope projector: raw provider body is not forwarded');
  equal(projection.redaction.rawWalletMaterialForwarded, false, 'Shadow envelope projector: raw wallet material is not forwarded');
  equal(projection.redaction.rawCustomerIdentifierForwarded, false, 'Shadow envelope projector: raw customer id is not forwarded');
  equal(projection.redaction.rawTenantIdentifierForwarded, false, 'Shadow envelope projector: raw tenant id is not forwarded');
  equal(projection.envelope.evidenceRefs.length, 3, 'Shadow envelope projector: evidence, approval, and receipt refs project to evidence plane');
  equal(projection.envelope.authorityRefs.length, 2, 'Shadow envelope projector: authority and approval refs project to authority plane');
  equal(projection.envelope.priorChain[0]?.relationship, 'replay-related', 'Shadow envelope projector: replay relation is represented digest-only');
  ok(!serialized.includes('tenant_raw_must_not_escape'), 'Shadow envelope projector: raw tenant text does not escape');
  ok(!serialized.includes('customer_raw_must_not_escape'), 'Shadow envelope projector: raw customer text does not escape');
}

function testProjectionFailsClosedForInvalidInputs(): void {
  const canonical = fixtureCanonicalShadowEvent();

  throws(
    () =>
      createShadowEnvelopeProjection({
        ...canonical,
        version: 'attestor.other.v1',
      } as never),
    /canonical shadow event schema v1/u,
    'Shadow envelope projector: wrong schema version fails closed',
  );
  throws(
    () =>
      createShadowEnvelopeProjection({
        ...canonical,
        tenantRefDigest: 'tenant_raw',
      } as never),
    /tenantRefDigest must be a sha256 digest reference/u,
    'Shadow envelope projector: raw tenant refs fail closed',
  );
  throws(
    () =>
      createShadowEnvelopeProjection({
        ...canonical,
        rawPayloadStored: true,
      } as never),
    /must not store raw payload material/u,
    'Shadow envelope projector: raw payload storage fails closed',
  );
  throws(
    () =>
      createShadowEnvelopeProjection(canonical, {
        actionTypeRegistryRefDigest: 'registry_raw',
      }),
    /actionTypeRegistryRefDigest must be a sha256 digest reference/u,
    'Shadow envelope projector: raw option refs fail closed',
  );
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = shadowEnvelopeProjectorDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'shadow-envelope-projector.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  equal(descriptor.version, 'attestor.shadow-envelope-projector.v1', 'Shadow envelope projector: descriptor version is explicit');
  equal(descriptor.accepts, CANONICAL_SHADOW_EVENT_SCHEMA_VERSION, 'Shadow envelope projector: descriptor accepts canonical shadow schema');
  equal(descriptor.produces, CONSEQUENCE_ENVELOPE_CONTRACT_VERSION, 'Shadow envelope projector: descriptor produces envelope contract');
  equal(descriptor.deterministic, true, 'Shadow envelope projector: descriptor records deterministic projection');
  equal(descriptor.sourceEventMutationAllowed, false, 'Shadow envelope projector: descriptor forbids source mutation');
  equal(descriptor.rawPayloadRead, false, 'Shadow envelope projector: descriptor forbids raw payload reads');
  equal(descriptor.canAdmit, false, 'Shadow envelope projector: descriptor cannot admit');

  for (const expected of [
    '# Shadow Envelope Projector',
    'attestor.shadow-envelope-projector.v1',
    'CanonicalShadowEvent',
    'ConsequenceEnvelopeContract',
    'pure deterministic projection builder',
    'CloudEvents',
    'OpenTelemetry',
    'AWS CloudTrail log file validation',
    'not live enforcement',
    'not signal extraction',
    'not fusion',
    'not TLA+-checked',
    'never mutates',
    'never reads raw payload',
    'never grants authority',
  ]) {
    includes(doc, expected, `Shadow envelope projector doc: records ${expected}`);
  }

  includes(
    overview,
    '| W01 | complete | Shadow Envelope Projector |',
    'Shadow envelope projector: runtime wiring tracker marks W01 complete',
  );
  includes(
    overview,
    'src/consequence-admission/shadow-envelope-projector.ts',
    'Shadow envelope projector: overview records implementation file',
  );
  equal(
    packageJson.scripts['test:shadow-envelope-projector'],
    'tsx tests/shadow-envelope-projector.test.ts',
    'Shadow envelope projector: package script is registered',
  );
  includes(
    packageProbe,
    'SHADOW_ENVELOPE_PROJECTOR_VERSION',
    'Shadow envelope projector: package surface probe covers export',
  );
}

testProjectionBuildsShadowOnlyEnvelope();
testProjectionIsDeterministicAndDoesNotMutateSource();
testProjectionPreservesRedactionAndDoesNotForwardRawMaterial();
testProjectionFailsClosedForInvalidInputs();
testDescriptorDocsAndPackageSurfaceStayAligned();

console.log(`Shadow envelope projector tests: ${passed} passed, 0 failed`);
