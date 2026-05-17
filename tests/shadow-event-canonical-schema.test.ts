import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalShadowEventSchemaDescriptor,
  createCanonicalShadowEvent,
  createCanonicalShadowEventFromAdmissionEvent,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const digestB = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const digestC = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const digestD = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const digestE = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function testAdmissionShadowEventProjectsToCanonicalEnvelope(): void {
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
    observedFeatures: {
      rawFeature: 'feature_raw_must_not_escape',
    },
  });
  const shadowEvent = createShadowAdmissionEvent({
    admission,
    occurredAt: '2026-05-17T08:00:02.000Z',
    downstreamOutcome: 'proceeded',
    humanOutcome: 'approved',
    observedFeatures: {
      amountBucket: '25k-50k',
      rawFeature: 'feature_raw_must_not_escape',
    },
  });
  const canonical = createCanonicalShadowEventFromAdmissionEvent(shadowEvent, {
    actionKind: 'api-operation',
    targetAccountRefDigest: digestA,
    resourceRefDigest: digestB,
  });
  const serialized = JSON.stringify(canonical);

  equal(canonical.version, 'attestor.canonical-shadow-event.v1', 'Canonical shadow event: version is explicit');
  equal(canonical.cloudEventsSpecversion, '1.0', 'Canonical shadow event: CloudEvents specversion is recorded');
  equal(canonical.otelEventName, 'attestor.shadow_event', 'Canonical shadow event: OpenTelemetry event name is recorded');
  equal(canonical.sourceKind, 'admission-shadow', 'Canonical shadow event: source kind is retained');
  equal(canonical.observed.targetSystem, 'refund-service', 'Canonical shadow event: observed target system is retained');
  equal(canonical.observed.actionName, 'issue_refund', 'Canonical shadow event: observed action name is retained');
  equal(canonical.observed.consequenceClass, null, 'Canonical shadow event: observed facts do not invent consequence class');
  equal(canonical.inferred.consequenceClass, 'financial', 'Canonical shadow event: inferred consequence class is separated');
  equal(canonical.rawMaterialBoundary.rawPayloadStored, false, 'Canonical shadow event: raw payload storage is false');
  equal(canonical.rawMaterialBoundary.rawPromptStored, false, 'Canonical shadow event: raw prompt storage is false');
  equal(canonical.rawMaterialBoundary.rawProviderBodyStored, false, 'Canonical shadow event: raw provider body storage is false');
  equal(canonical.rawMaterialBoundary.rawWalletMaterialStored, false, 'Canonical shadow event: raw wallet material storage is false');
  equal(canonical.rawMaterialBoundary.rawCustomerIdentifierStored, false, 'Canonical shadow event: raw customer identifier storage is false');
  equal(canonical.autoEnforce, false, 'Canonical shadow event: cannot auto-enforce');
  equal(canonical.approvalRequiredForPromotion, true, 'Canonical shadow event: promotion requires approval');
  ok(canonical.eventId.startsWith('canonical-shadow:sha256:'), 'Canonical shadow event: event id is digest-backed');
  ok(canonical.digest.startsWith('sha256:'), 'Canonical shadow event: event digest is generated');
  ok(canonical.evidenceRefs.length >= 3, 'Canonical shadow event: evidence/provenance refs are projected');
  ok(canonical.policyRefs.length === 1, 'Canonical shadow event: policy ref is digest-only');
  ok(!serialized.includes('tenant_raw_must_not_escape'), 'Canonical shadow event: raw tenant id is not serialized');
  ok(!serialized.includes('customer_raw_must_not_escape'), 'Canonical shadow event: raw customer id is not serialized');
  ok(!serialized.includes('order_raw_must_not_escape'), 'Canonical shadow event: raw evidence id is not serialized');
  ok(!serialized.includes('feature_raw_must_not_escape'), 'Canonical shadow event: raw observed feature is not serialized');
  ok(!serialized.includes('policy_raw_must_not_escape'), 'Canonical shadow event: raw policy ref is not serialized');
}

function testDirectCanonicalEventRequiresDigestReferences(): void {
  const canonical = createCanonicalShadowEvent({
    occurredAt: '2026-05-17T08:10:00.000Z',
    observedAt: '2026-05-17T08:10:01.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.integration.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'safe-transaction-service',
      targetAccountRefDigest: digestC,
      actionName: 'safe.tx.propose',
      actionKind: 'transaction-proposal',
      consequenceClass: null,
      resourceRefDigest: digestD,
      dataClass: 'programmable-money',
      amountAssetChain: {
        amountBucket: '1k-10k',
        assetRefDigest: digestE,
        chainRefDigest: digestA,
      },
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
        principalRefDigest: digestB,
        resourceRefDigest: digestD,
        permissionRefDigest: digestE,
      },
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    simulationRefs: [{ kind: 'simulation', digest: digestB, origin: 'inferred' }],
    approvalRefs: [{ kind: 'approval', digest: digestC, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestD, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestE, origin: 'observed' }],
    idempotencyRefDigest: digestA,
    replayRefDigest: digestB,
    traceRefDigest: digestC,
    schemaRefDigest: digestD,
    rawMaterialPolicy: 'digest-only',
  });

  equal(canonical.observedFieldCount, 7, 'Canonical shadow event: observed field count is explicit');
  equal(canonical.inferredFieldCount, 2, 'Canonical shadow event: inferred field count is explicit');
  equal(canonical.observed.consequenceClass, null, 'Canonical shadow event: observed consequence class can stay empty');
  equal(canonical.inferred.authorityDelta?.authorityKind, 'multisig-confirmation', 'Canonical shadow event: inferred authority delta is retained');
  equal(canonical.evidenceRefs[0]?.origin, 'observed', 'Canonical shadow event: evidence ref origin is retained');
  equal(canonical.simulationRefs[0]?.origin, 'inferred', 'Canonical shadow event: simulation ref origin is retained');

  throws(
    () =>
      createCanonicalShadowEvent({
        occurredAt: '2026-05-17T08:10:00.000Z',
        sourceKind: 'target-system-shadow',
        producer: 'attestor.integration.test',
        tenantRefDigest: 'tenant_raw',
        actorRefDigest: digestB,
        observed: canonical.observed,
      }),
    /tenantRefDigest must be a sha256 digest reference/u,
    'Canonical shadow event: raw tenant references fail closed',
  );
  throws(
    () =>
      createCanonicalShadowEvent({
        occurredAt: '2026-05-17T08:10:00.000Z',
        sourceKind: 'target-system-shadow',
        producer: 'attestor.integration.test',
        tenantRefDigest: digestA,
        actorRefDigest: digestB,
        observed: {
          ...canonical.observed,
          actionKind: 'vendor-magic' as never,
        },
      }),
    /actionKind must be one of/u,
    'Canonical shadow event: unknown action kinds fail closed',
  );
}

function testDescriptorAndDocsStayAligned(): void {
  const descriptor = canonicalShadowEventSchemaDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'shadow-event-canonical-schema.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const targetMatrix = readProjectFile('docs', '02-architecture', 'target-system-compatibility-matrix.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.canonical-shadow-event.v1', 'Canonical shadow event: descriptor version is explicit');
  equal(descriptor.separatesObservedAndInferredFacts, true, 'Canonical shadow event: descriptor separates observed and inferred facts');
  equal(descriptor.rawPayloadStored, false, 'Canonical shadow event: descriptor blocks raw payload storage');
  ok(descriptor.actionKinds.includes('transaction-proposal'), 'Canonical shadow event: descriptor covers crypto proposal actions');
  ok(descriptor.consequenceClasses.includes('authority-change'), 'Canonical shadow event: descriptor covers authority changes');

  for (const expected of [
    '# Shadow Event Canonical Schema',
    'CloudEvents',
    'OpenTelemetry Logs Data Model',
    'OCSF',
    'W3C PROV',
    'observed',
    'inferred',
    'raw prompts',
    'raw provider bodies',
    'raw wallet material',
    'raw customer identifiers',
    'Action Surface Graph',
    '[Evidence State Model](evidence-state-model.md)',
  ]) {
    includes(doc, expected, `Canonical shadow event doc: records ${expected}`);
  }

  for (const expected of [
    '| Complete | 20 |',
    '| Remaining | 6 |',
    '| 14 | complete | Shadow event canonical schema |',
    '| 15 | complete | Action surface graph |',
    '| 16 | complete | Evidence state model |',
    '| 17 | complete | Policy Candidate PR contract |',
    '| 18 | complete | Active Question Engine |',
    '| 19 | complete | Counterexample replay generator |',
    'completion of steps 21-26',
  ]) {
    includes(masterPlan, expected, `Canonical shadow event: master plan records ${expected}`);
  }

  includes(
    ledger,
    '### 56. Shadow Event Canonical Schema',
    'Canonical shadow event: research ledger entry is present',
  );
  includes(
    targetMatrix,
    '[shadow event canonical schema](shadow-event-canonical-schema.md)',
    'Canonical shadow event: target matrix links the Step 14 schema',
  );
  assert.equal(
    packageJson.scripts['test:shadow-event-canonical-schema'],
    'tsx tests/shadow-event-canonical-schema.test.ts',
    'Canonical shadow event: package script is registered',
  );
  passed += 1;

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(not|without|until|claim|readiness|evidence))/iu,
    'Canonical shadow event doc: does not make an unqualified production-ready claim',
  );
}

testAdmissionShadowEventProjectsToCanonicalEnvelope();
testDirectCanonicalEventRequiresDigestReferences();
testDescriptorAndDocsStayAligned();

console.log(`Shadow event canonical schema tests: ${passed} passed, 0 failed`);
