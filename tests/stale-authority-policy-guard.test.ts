import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceStaleAuthorityPolicyGuardDescriptor,
  evaluateConsequenceStaleAuthorityPolicy,
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

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

function baseInput() {
  return {
    generatedAt: '2026-05-13T11:00:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    policyVersion: 'policy.refund.v3',
    currentPolicyVersion: 'policy.refund.v3',
    policyDigest: digest('a'),
    currentPolicyDigest: digest('a'),
    policyUpdatedAt: '2026-05-13T10:00:00.000Z',
    approvalIssuedAt: '2026-05-13T10:30:00.000Z',
    approvalValidFrom: '2026-05-13T10:30:00.000Z',
    approvalValidUntil: '2026-05-13T12:00:00.000Z',
    authorityCheckedAt: '2026-05-13T10:59:00.000Z',
    authorityExpiresAt: '2026-05-13T12:00:00.000Z',
    maxAuthorityAgeSeconds: 300,
    driftState: 'clean' as const,
  };
}

function testCurrentPolicyAndFreshAuthorityPass(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy(baseInput());

  equal(decision.version, 'attestor.consequence-stale-authority-policy-guard.v1', 'Stale guard: version is explicit');
  equal(decision.outcome, 'pass', 'Stale guard: current policy and fresh authority pass');
  equal(decision.allowed, true, 'Stale guard: pass decision is allowed');
  equal(decision.failClosed, false, 'Stale guard: pass decision is not fail-closed');
  ok(decision.reasonCodes.includes('stale-policy-pass'), 'Stale guard: pass reason is present');
  ok(decision.requiredControls.includes('policy-version-binding'), 'Stale guard: binding carries policy-version-binding control');
  ok(decision.digest.startsWith('sha256:'), 'Stale guard: decision digest is generated');
}

function testPolicyVersionMismatchBlocksAndIsDigestOnly(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    policyVersion: 'policy.refund.v2-private',
    currentPolicyVersion: 'policy.refund.v3-private',
  });
  const serialized = JSON.stringify(decision);

  equal(decision.outcome, 'block', 'Stale guard: policy version mismatch blocks');
  equal(decision.allowed, false, 'Stale guard: block decision is not allowed');
  equal(decision.failClosed, true, 'Stale guard: block decision is fail-closed');
  ok(decision.reasonCodes.includes('policy-version-mismatch'), 'Stale guard: mismatch reason is present');
  ok(decision.reasonCodes.includes('stale-policy-block'), 'Stale guard: block reason is present');
  excludes(serialized, /policy\.refund\.v2-private|policy\.refund\.v3-private/iu, 'Stale guard: serialized decision excludes raw policy version strings');
}

function testPolicyUpdatedAfterApprovalBlocks(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    policyUpdatedAt: '2026-05-13T10:45:00.000Z',
    approvalIssuedAt: '2026-05-13T10:30:00.000Z',
  });

  equal(decision.outcome, 'block', 'Stale guard: policy update after approval blocks');
  ok(decision.reasonCodes.includes('policy-updated-after-approval'), 'Stale guard: update-after-approval reason is present');
}

function testExpiredApprovalBlocks(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    approvalValidUntil: '2026-05-13T10:59:59.000Z',
  });

  equal(decision.outcome, 'block', 'Stale guard: expired approval blocks');
  ok(decision.reasonCodes.includes('approval-expired'), 'Stale guard: approval expired reason is present');
}

function testMissingFreshnessRequiresReview(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    authorityCheckedAt: null,
    policyVersion: null,
  });

  equal(decision.outcome, 'review', 'Stale guard: missing freshness and policy version reviews');
  equal(decision.allowed, false, 'Stale guard: review decision is not allowed');
  ok(decision.reasonCodes.includes('authority-freshness-missing'), 'Stale guard: missing freshness reason is present');
  ok(decision.reasonCodes.includes('policy-version-missing'), 'Stale guard: missing policy version reason is present');
  equal(decision.counts.reviewReasonCount >= 2, true, 'Stale guard: review reasons are counted');
}

function testAuthorityTooOldRequiresReview(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    authorityCheckedAt: '2026-05-13T10:00:00.000Z',
    maxAuthorityAgeSeconds: 300,
  });

  equal(decision.outcome, 'review', 'Stale guard: too-old authority check reviews');
  ok(decision.reasonCodes.includes('authority-freshness-too-old'), 'Stale guard: too-old freshness reason is present');
}

function testDriftNoGoBlocks(): void {
  const decision = evaluateConsequenceStaleAuthorityPolicy({
    ...baseInput(),
    driftState: 'no-go',
    noGoReasons: ['fraud-hold-private-account-ref'],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.outcome, 'block', 'Stale guard: drift no-go blocks');
  ok(decision.reasonCodes.includes('drift-state-block'), 'Stale guard: drift block reason is present');
  ok(decision.reasonCodes.includes('no-go-reason-present'), 'Stale guard: no-go reason is present');
  equal(decision.counts.noGoReasonCount, 1, 'Stale guard: no-go count is retained');
  excludes(serialized, /fraud-hold-private-account-ref/iu, 'Stale guard: serialized decision excludes raw no-go reason text');
}

function testDescriptorDocsRegistryAndPackageScriptStayAligned(): void {
  const descriptor = consequenceStaleAuthorityPolicyGuardDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'stale-authority-policy-guard.md');
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-stale-authority-policy-guard.v1', 'Stale descriptor: version is explicit');
  equal(descriptor.failureModeId, 'stale-authority-or-policy', 'Stale descriptor: failure mode is bound');
  equal(descriptor.requiresPolicyVersion, true, 'Stale descriptor: policy version requirement is explicit');
  equal(descriptor.requiresCurrentPolicyVersion, true, 'Stale descriptor: current policy requirement is explicit');
  equal(descriptor.requiresApprovalValidityWindow, true, 'Stale descriptor: approval validity requirement is explicit');
  equal(descriptor.requiresAuthorityFreshness, true, 'Stale descriptor: authority freshness requirement is explicit');
  equal(descriptor.blocksNoGo, true, 'Stale descriptor: no-go block is explicit');
  equal(descriptor.blocksExpiredApproval, true, 'Stale descriptor: expired approval block is explicit');
  includes(doc, 'attestor.consequence-stale-authority-policy-guard.v1', 'Stale docs: version is named');
  includes(doc, 'src/consequence-admission/stale-authority-policy-guard.ts', 'Stale docs: source file is named');
  includes(doc, 'test:stale-authority-policy-guard', 'Stale docs: test command is named');
  includes(doc, 'stale-authority-or-policy', 'Stale docs: failure mode is named');
  includes(doc, 'does not prove customer policy stores, IdP checks, approval workflows, or downstream verifiers are wired to the latest source-of-truth state', 'Stale docs: limitation is explicit');
  includes(registry, 'stale-authority-policy-guard.ts', 'Failure registry: stale guard source evidence is recorded');
  equal(
    pkg.scripts['test:stale-authority-policy-guard'],
    'tsx tests/stale-authority-policy-guard.test.ts',
    'Package: stale guard test is exposed',
  );
}

try {
  testCurrentPolicyAndFreshAuthorityPass();
  testPolicyVersionMismatchBlocksAndIsDigestOnly();
  testPolicyUpdatedAfterApprovalBlocks();
  testExpiredApprovalBlocks();
  testMissingFreshnessRequiresReview();
  testAuthorityTooOldRequiresReview();
  testDriftNoGoBlocks();
  testDescriptorDocsRegistryAndPackageScriptStayAligned();
  console.log(`Stale authority policy guard tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Stale authority policy guard tests failed:', error);
  process.exitCode = 1;
}
