import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenExternalCommunicationPolicyFoundryProjection,
  goldenExternalCommunicationPolicyFoundryProjectionDescriptor,
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

function testProjectionShape(): void {
  const projection = createGoldenExternalCommunicationPolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-external-communication-policy-foundry-projection.v1', 'E02 projection: version is explicit');
  equal(projection.step, 'E02', 'E02 projection: step is explicit');
  equal(projection.sourceFixtureCount, 8, 'E02 projection: consumes eight E01 fixtures');
  equal(projection.actionSurface, 'external_communication.customer_message', 'E02 projection: action surface is customer message');
  equal(projection.domain, 'external-communication', 'E02 projection: domain is external communication');
  equal(projection.approvalRequired, true, 'E02 projection: approval remains required');
  equal(projection.autoEnforce, false, 'E02 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'E02 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'E02 projection: raw payload storage is false');
  equal(projection.rawMessageBodyStored, false, 'E02 projection: raw message body storage is false');
  equal(projection.rawRecipientIdentifiersStored, false, 'E02 projection: raw recipient identifiers storage is false');
  equal(projection.productionReady, false, 'E02 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'E02 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'E02 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'E02 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenExternalCommunicationPolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'E02 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'E02 summary: communication candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'E02 summary: recommended rollout is review-required');
  equal(summary.eventCount, 8, 'E02 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 1, 'E02 summary: admit count comes from approved support reply fixture');
  equal(summary.decisionImpact.narrowCount, 1, 'E02 summary: narrow count comes from public overclaim narrowing fixture');
  equal(summary.decisionImpact.reviewCount, 3, 'E02 summary: review count comes from promise, commercial, and adversarial ticket fixtures');
  equal(summary.decisionImpact.blockCount, 3, 'E02 summary: block count comes from legal, recipient, and duplicate-send fixtures');
  equal(summary.gapCounts.policy, 3, 'E02 summary: public/commercial/replay policy gaps are counted');
  equal(summary.gapCounts.evidence, 4, 'E02 summary: missing/instruction-like evidence gaps are counted');
  equal(summary.gapCounts.authority, 4, 'E02 summary: claim, recipient, and commercial authority gaps are counted');
  equal(summary.policyTwinEvidenceOnly, true, 'E02 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'E02 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'E02 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'E02 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenExternalCommunicationPolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'outbound-promise-needs-authority',
    'legal-claim-without-authority',
    'recipient-tenant-mismatch',
    'public-claim-overclaim',
    'commercial-email-control-gap',
    'instruction-like-ticket-review',
    'duplicate-send-replay',
  ]) {
    includes(gapKinds, expected, `E02 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 7, 'E02 named gaps: exactly seven named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'E02 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'E02 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'E02 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'E02 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    8,
    'E02 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    8,
    'E02 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    3,
    'E02 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenExternalCommunicationPolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'E02 projection: no raw email address is serialized');
  excludes(serialized, /\b(customer|recipient|account|tenant)[_-]?[0-9]{3,}\b/iu, 'E02 projection: no raw customer, recipient, account, or tenant id is serialized');
  excludes(serialized, /rawEmailBody|rawMessageText|messageText|emailAddress|phoneNumber|recipientEmail|subjectLine/iu, 'E02 projection: no raw message or recipient fields are serialized');
  excludes(serialized, /providerBody|mailgunPayload|sendgridPayload|crmPayload|ticketBody/iu, 'E02 projection: no raw provider material is serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenExternalCommunicationPolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-external-communication-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-external-communication-policy-foundry-projection.v1', 'E02 descriptor: version is explicit');
  equal(descriptor.step, 'E02', 'E02 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'E02 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'E02 descriptor: auto enforcement is false');
  equal(descriptor.rawMessageBodyStored, false, 'E02 descriptor: raw message body storage is false');
  equal(descriptor.rawRecipientIdentifiersStored, false, 'E02 descriptor: raw recipient identifier storage is false');
  equal(descriptor.productionReady, false, 'E02 descriptor: production readiness is false');

  for (const expected of [
    'Progress after E04 lands: 4/4 complete. 0 steps remain.',
    '| E02 | complete | Policy Foundry communication projection |',
    'review-only candidate for `external_communication.customer_message`',
    'recipient, tenant, claim, evidence, approval, commercial-email, public-claim, and replay gaps',
  ]) {
    includes(doc, expected, `E02 doc: records ${expected}`);
  }

  includes(
    ledger,
    'External Communication Golden Path E02',
    'E02 ledger: records the projection step',
  );
  equal(
    packageJson.scripts['test:golden-external-communication-policy-foundry-projection'],
    'tsx tests/golden-external-communication-policy-foundry-projection.test.ts',
    'E02 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-external-communication-policy-foundry-projection: ${passed} assertions passed`);
