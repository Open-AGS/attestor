import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenDataExportPolicyFoundryProjection,
  goldenDataExportPolicyFoundryProjectionDescriptor,
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
  const projection = createGoldenDataExportPolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-data-export-policy-foundry-projection.v1', 'D02 projection: version is explicit');
  equal(projection.step, 'D02', 'D02 projection: step is explicit');
  equal(projection.sourceFixtureCount, 8, 'D02 projection: consumes eight D01 fixtures');
  equal(projection.actionSurface, 'data_movement.controlled_export', 'D02 projection: action surface is controlled data export');
  equal(projection.domain, 'data-movement', 'D02 projection: domain is data movement');
  equal(projection.approvalRequired, true, 'D02 projection: approval remains required');
  equal(projection.autoEnforce, false, 'D02 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'D02 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'D02 projection: raw payload storage is false');
  equal(projection.productionReady, false, 'D02 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'D02 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'D02 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'D02 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenDataExportPolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'D02 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'D02 summary: data export candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'D02 summary: recommended rollout is review-required');
  equal(summary.eventCount, 8, 'D02 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 2, 'D02 summary: admit count comes from approved fixtures');
  equal(summary.decisionImpact.narrowCount, 1, 'D02 summary: narrow count comes from field narrowing fixture');
  equal(summary.decisionImpact.reviewCount, 2, 'D02 summary: review count comes from recipient and adversarial fixtures');
  equal(summary.decisionImpact.blockCount, 3, 'D02 summary: block count comes from tenant, stale approval, and write fixtures');
  equal(summary.gapCounts.policy, 2, 'D02 summary: field minimization and write policy gaps are counted');
  equal(summary.gapCounts.evidence, 4, 'D02 summary: missing/stale/instruction-like evidence gaps are counted');
  equal(summary.gapCounts.authority, 4, 'D02 summary: recipient, tenant, and approval gaps are counted');
  equal(summary.policyTwinEvidenceOnly, true, 'D02 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'D02 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'D02 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'D02 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenDataExportPolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'overbroad-personal-data',
    'external-recipient-unapproved',
    'tenant-scope-mismatch',
    'stale-approval',
    'instruction-like-evidence-review',
    'write-side-effect',
    'purpose-binding-missing',
  ]) {
    includes(gapKinds, expected, `D02 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 7, 'D02 named gaps: exactly seven named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'D02 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'D02 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'D02 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'D02 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    8,
    'D02 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    8,
    'D02 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    3,
    'D02 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenDataExportPolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /\bSELECT\b|\bUPDATE\b|\bINSERT\b|\bDELETE\b|\bMERGE\b/iu, 'D02 projection: no raw SQL is serialized');
  excludes(serialized, /\b(email|customerEmail|customerName|accountNumber|ssn|phoneNumber)\b/iu, 'D02 projection: no raw customer fields are serialized');
  excludes(serialized, /\bcus_[a-zA-Z0-9_]+|\btenant_[a-zA-Z0-9_]+|\buser_[a-zA-Z0-9_]+/u, 'D02 projection: no raw customer, tenant, or user identifiers are serialized');
  excludes(serialized, /rowPayload|rawRows|providerBody|warehouseStatement/iu, 'D02 projection: no raw data export material is serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenDataExportPolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-data-export-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-data-export-policy-foundry-projection.v1', 'D02 descriptor: version is explicit');
  equal(descriptor.step, 'D02', 'D02 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'D02 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'D02 descriptor: auto enforcement is false');
  equal(descriptor.productionReady, false, 'D02 descriptor: production readiness is false');

  for (const expected of [
    'Status: complete. D01-D04 are repository-side only.',
    'Progress after D04 lands: 4/4 complete. 0 steps remain.',
    '| D02 | complete | Policy Foundry data export projection |',
    'review-only candidate',
    'recipient, field, tenant, approval, and purpose gaps',
  ]) {
    includes(doc, expected, `D02 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Controlled Data Export Golden Path D02',
    'D02 ledger: records the projection step',
  );
  equal(
    packageJson.scripts['test:golden-data-export-policy-foundry-projection'],
    'tsx tests/golden-data-export-policy-foundry-projection.test.ts',
    'D02 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-data-export-policy-foundry-projection: ${passed} assertions passed`);
