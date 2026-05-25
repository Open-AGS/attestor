import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGoldenAuthorityChangePolicyFoundryProjection,
  goldenAuthorityChangePolicyFoundryProjectionDescriptor,
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
  const projection = createGoldenAuthorityChangePolicyFoundryProjection();

  equal(projection.version, 'attestor.golden-authority-change-policy-foundry-projection.v1', 'A02 projection: version is explicit');
  equal(projection.step, 'A02', 'A02 projection: step is explicit');
  equal(projection.sourceFixtureCount, 8, 'A02 projection: consumes eight A01 fixtures');
  equal(projection.actionSurface, 'authority_change.identity_workflow', 'A02 projection: action surface is authority change identity workflow');
  equal(projection.domain, 'authority-change', 'A02 projection: domain is authority change');
  equal(projection.approvalRequired, true, 'A02 projection: approval remains required');
  equal(projection.autoEnforce, false, 'A02 projection: auto enforcement is false');
  equal(projection.activatesEnforcement, false, 'A02 projection: enforcement activation is false');
  equal(projection.rawPayloadStored, false, 'A02 projection: raw payload storage is false');
  equal(projection.rawIdentityAttributesStored, false, 'A02 projection: raw identity attributes storage is false');
  equal(projection.productionReady, false, 'A02 projection: production readiness is false');
  equal(projection.reviewMaterialOnly, true, 'A02 projection: output is review material only');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.digest), 'A02 projection: digest is canonical');
  ok(/^sha256:[a-f0-9]{64}$/u.test(projection.sourceFixtureSuiteDigest), 'A02 projection: source fixture suite digest is canonical');
}

function testPolicyTwinSummaryIsReviewOnly(): void {
  const projection = createGoldenAuthorityChangePolicyFoundryProjection();
  const summary = projection.policyTwinSummary;

  equal(summary.version, 'attestor.policy-foundry-policy-twin-summary.v1', 'A02 summary: policy twin summary version is retained');
  equal(summary.status, 'review-only', 'A02 summary: authority change candidate stays review-only');
  equal(summary.recommendedRolloutStep, 'review-required', 'A02 summary: recommended rollout is review-required');
  equal(summary.eventCount, 8, 'A02 summary: event count is fixture count');
  equal(summary.decisionImpact.admitCount, 2, 'A02 summary: admit count comes from approved grant and revocation fixtures');
  equal(summary.decisionImpact.narrowCount, 1, 'A02 summary: narrow count comes from privileged-role narrowing fixture');
  equal(summary.decisionImpact.reviewCount, 2, 'A02 summary: review count comes from delegation and adversarial ticket fixtures');
  equal(summary.decisionImpact.blockCount, 3, 'A02 summary: block count comes from break-glass, tenant, and stale approval fixtures');
  equal(summary.gapCounts.policy, 4, 'A02 summary: privilege/break-glass policy gaps are counted');
  equal(summary.gapCounts.evidence, 4, 'A02 summary: missing/stale/instruction-like evidence gaps are counted');
  equal(summary.gapCounts.authority, 4, 'A02 summary: tenant, approval, and SoD authority gaps are counted');
  equal(summary.policyTwinEvidenceOnly, true, 'A02 summary: policy twin output is evidence-only');
  equal(summary.autoEnforce, false, 'A02 summary: auto enforcement is false');
  equal(summary.activatesEnforcement, false, 'A02 summary: enforcement activation is false');
  equal(summary.productionReady, false, 'A02 summary: production readiness is false');
}

function testNamedGapsAndBacktestMaterial(): void {
  const projection = createGoldenAuthorityChangePolicyFoundryProjection();
  const gapKinds = projection.namedGaps.map((gap) => gap.kind).join('\n');

  for (const expected of [
    'overbroad-privilege',
    'break-glass-approval-missing',
    'external-delegation-unapproved',
    'tenant-scope-mismatch',
    'stale-approval',
    'instruction-like-ticket-review',
    'separation-of-duties-conflict',
  ]) {
    includes(gapKinds, expected, `A02 named gaps: records ${expected}`);
  }

  equal(projection.namedGaps.length, 7, 'A02 named gaps: exactly seven named gaps are emitted');
  ok(
    projection.namedGaps.every((gap) => gap.reviewOnly === true),
    'A02 named gaps: every gap is review-only',
  );
  equal(
    projection.reviewOnlyCandidate.proposedMode,
    'review',
    'A02 review-only candidate: proposed mode is review',
  );
  equal(
    projection.reviewOnlyCandidate.autoEnforce,
    false,
    'A02 review-only candidate: auto enforcement is false',
  );
  equal(
    projection.reviewOnlyCandidate.activatesEnforcement,
    false,
    'A02 review-only candidate: enforcement activation is false',
  );
  equal(
    projection.backtestMaterial.fixtureDigests.length,
    8,
    'A02 backtest material: fixture digests are retained',
  );
  equal(
    projection.backtestMaterial.eventDigests.length,
    8,
    'A02 backtest material: event digests are retained',
  );
  equal(
    projection.backtestMaterial.decisionCounts.block,
    3,
    'A02 backtest material: block count is retained',
  );
}

function testDataMinimization(): void {
  const projection = createGoldenAuthorityChangePolicyFoundryProjection();
  const serialized = JSON.stringify(projection);

  excludes(serialized, /@[a-z0-9.-]+\.[a-z]{2,}/iu, 'A02 projection: no raw email address is serialized');
  excludes(serialized, /\b(user|employee|account|tenant)[_-]?[0-9]{3,}\b/iu, 'A02 projection: no raw user, account, or tenant id is serialized');
  excludes(serialized, /firstName|lastName|displayName|phoneNumber|streetAddress|rawSubject|rawPrincipal/iu, 'A02 projection: no raw identity attribute fields are serialized');
  excludes(serialized, /providerBody|identityProviderPayload|systemOfRecordPayload/iu, 'A02 projection: no raw identity-provider material is serialized');
}

function testDescriptorDocsAndScriptsStayAligned(): void {
  const descriptor = goldenAuthorityChangePolicyFoundryProjectionDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'golden-authority-change-shadow-pilot.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(descriptor.version, 'attestor.golden-authority-change-policy-foundry-projection.v1', 'A02 descriptor: version is explicit');
  equal(descriptor.step, 'A02', 'A02 descriptor: step is explicit');
  equal(descriptor.reviewOnly, true, 'A02 descriptor: review-only is explicit');
  equal(descriptor.autoEnforce, false, 'A02 descriptor: auto enforcement is false');
  equal(descriptor.productionReady, false, 'A02 descriptor: production readiness is false');

  for (const expected of [
    'Progress after A02 lands: 2/4 complete. 2 steps remain.',
    '| A02 | complete once merged | Policy Foundry authority projection |',
    'review-only candidate',
    'subject, resource, permission, tenant, approval, SoD, and least-privilege gaps',
  ]) {
    includes(doc, expected, `A02 doc: records ${expected}`);
  }

  includes(
    ledger,
    'Authority Change Golden Path A02',
    'A02 ledger: records the projection step',
  );
  equal(
    packageJson.scripts['test:golden-authority-change-policy-foundry-projection'],
    'tsx tests/golden-authority-change-policy-foundry-projection.test.ts',
    'A02 package script: targeted test is registered',
  );
}

testProjectionShape();
testPolicyTwinSummaryIsReviewOnly();
testNamedGapsAndBacktestMaterial();
testDataMinimization();
testDescriptorDocsAndScriptsStayAligned();

console.log(`golden-authority-change-policy-foundry-projection: ${passed} assertions passed`);
