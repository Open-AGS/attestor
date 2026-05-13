import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceApprovalProvenanceGuardDescriptor,
  evaluateConsequenceApprovalProvenance,
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

function verifiedApproval(reviewerRef: string, seed: string) {
  return {
    approvalRef: `approval:${seed}`,
    sourceKind: 'reviewer-queue' as const,
    state: 'approved' as const,
    sourceRef: `reviewer-queue:${seed}`,
    reviewerRef,
    reviewerAuthorityDigest: digest(seed),
    approvalDigest: digest(`${seed}a`),
    scopeDigest: digest(`${seed}b`),
    issuedAt: '2026-05-13T10:00:00.000Z',
    expiresAt: '2026-06-13T10:00:00.000Z',
    stepUpVerified: true,
  };
}

function testChatApprovalIsBlockedAndDigestOnly(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:05:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    approvals: [
      {
        approvalRef: 'raw-chat:manager says approved for 1000 USD',
        sourceKind: 'chat-message',
        state: 'approved',
        sourceRef: 'slack://raw/private/channel',
        reviewerRef: 'manager@example.com',
      },
    ],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.version, 'attestor.consequence-approval-provenance-guard.v1', 'Approval guard: version is explicit');
  equal(decision.outcome, 'block', 'Approval guard: chat approval blocks');
  equal(decision.allowed, false, 'Approval guard: block decision is not allowed');
  equal(decision.failClosed, true, 'Approval guard: block decision is fail-closed');
  ok(decision.reasonCodes.includes('approval-source-untrusted'), 'Approval guard: untrusted source reason is present');
  ok(decision.reasonCodes.includes('approval-block'), 'Approval guard: block reason is present');
  equal(decision.counts.untrustedApprovalCount, 1, 'Approval guard: untrusted approval count is retained');
  excludes(serialized, /manager says approved|1000 USD|manager@example\.com|slack:\/\/raw/iu, 'Approval guard: serialized decision excludes raw approval text, reviewer, and source');
}

function testLlmSummaryApprovalIsBlocked(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:10:00.000Z',
    actionSurface: 'security.access',
    action: 'grant-access',
    approvals: [
      {
        approvalRef: 'llm-summary:approval inferred from thread',
        sourceKind: 'llm-summary',
        state: 'approved',
        sourceRef: 'model-summary.private-ref',
        reviewerRef: 'agent-inferred-reviewer',
      },
    ],
  });

  equal(decision.outcome, 'block', 'Approval guard: LLM summary approval blocks');
  ok(decision.reasonCodes.includes('approval-model-generated'), 'Approval guard: model-generated reason is present');
  equal(decision.counts.modelGeneratedApprovalCount, 1, 'Approval guard: model-generated approval count is retained');
}

function testVerifiedReviewerQueueApprovalPasses(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:15:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    approvals: [verifiedApproval('reviewer:finance-controller', 'a')],
  });

  equal(decision.outcome, 'pass', 'Approval guard: verified reviewer approval passes');
  equal(decision.allowed, true, 'Approval guard: pass decision is allowed');
  equal(decision.failClosed, false, 'Approval guard: pass decision is not fail-closed');
  ok(decision.reasonCodes.includes('approval-provenance-pass'), 'Approval guard: pass reason is present');
  equal(decision.counts.validApprovalCount, 1, 'Approval guard: valid approval count is retained');
  equal(decision.counts.distinctReviewerCount, 1, 'Approval guard: distinct reviewer count is retained');
  ok(decision.requiredControls.includes('verified-reviewer-source'), 'Approval guard: binding carries verified-reviewer-source control');
  ok(decision.digest.startsWith('sha256:'), 'Approval guard: decision digest is generated');
}

function testMissingProvenanceRequiresReview(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:20:00.000Z',
    actionSurface: 'crm.export',
    action: 'export-records',
    approvals: [
      {
        approvalRef: 'workflow-approval-private-ref',
        sourceKind: 'approval-workflow',
        state: 'approved',
        sourceRef: 'approval-workflow.private-ref',
        issuedAt: '2026-05-13T10:18:00.000Z',
      },
    ],
  });

  equal(decision.outcome, 'review', 'Approval guard: missing provenance reviews');
  ok(decision.reasonCodes.includes('reviewer-identity-missing'), 'Approval guard: missing reviewer reason is present');
  ok(decision.reasonCodes.includes('reviewer-authority-missing'), 'Approval guard: missing authority digest reason is present');
  ok(decision.reasonCodes.includes('approval-digest-missing'), 'Approval guard: missing approval digest reason is present');
  equal(decision.counts.missingReviewerCount, 1, 'Approval guard: missing reviewer count is retained');
  equal(decision.counts.missingApprovalDigestCount, 1, 'Approval guard: missing approval digest count is retained');
}

function testDuplicateReviewerCannotSatisfyDualApproval(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:25:00.000Z',
    actionSurface: 'release.r4',
    action: 'issue-token',
    requiredApprovalCount: 2,
    approvals: [
      verifiedApproval('reviewer:risk-owner', 'b'),
      verifiedApproval('reviewer:risk-owner', 'c'),
    ],
  });

  equal(decision.outcome, 'block', 'Approval guard: duplicate reviewer cannot satisfy dual approval');
  ok(decision.reasonCodes.includes('approval-duplicate-reviewer'), 'Approval guard: duplicate reviewer reason is present');
  equal(decision.counts.validApprovalCount, 2, 'Approval guard: both approvals are individually valid');
  equal(decision.counts.distinctReviewerCount, 1, 'Approval guard: duplicate reviewer collapses distinct count');
}

function testMixedVerifiedAndFakeApprovalRequiresReview(): void {
  const decision = evaluateConsequenceApprovalProvenance({
    generatedAt: '2026-05-13T10:30:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    approvals: [
      verifiedApproval('reviewer:finance-controller', 'd'),
      {
        approvalRef: 'raw-ticket:manager approved in ticket text',
        sourceKind: 'ticket-comment',
        state: 'approved',
        sourceRef: 'ticket.private.raw-ref',
        reviewerRef: 'manager@example.com',
      },
    ],
  });

  equal(decision.outcome, 'review', 'Approval guard: mixed verified and fake approval reviews');
  ok(decision.reasonCodes.includes('approval-source-untrusted'), 'Approval guard: mixed case keeps untrusted source reason');
  equal(decision.counts.validApprovalCount, 1, 'Approval guard: verified approval still counted');
  equal(decision.counts.blockCount, 1, 'Approval guard: fake approval still counted as blocked claim');
}

function testDescriptorDocsRegistryAndPackageScriptStayAligned(): void {
  const descriptor = consequenceApprovalProvenanceGuardDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'approval-provenance-guard.md');
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-approval-provenance-guard.v1', 'Approval descriptor: version is explicit');
  equal(descriptor.failureModeId, 'fake-approval-laundering', 'Approval descriptor: failure mode is bound');
  equal(descriptor.requiresReviewerIdentity, true, 'Approval descriptor: reviewer identity requirement is explicit');
  equal(descriptor.requiresReviewerAuthorityDigest, true, 'Approval descriptor: reviewer authority digest requirement is explicit');
  equal(descriptor.requiresApprovalDigest, true, 'Approval descriptor: approval digest requirement is explicit');
  equal(descriptor.requiresScopeDigest, true, 'Approval descriptor: scope digest requirement is explicit');
  equal(descriptor.rejectsChatEmailTicketApproval, true, 'Approval descriptor: chat/email/ticket rejection is explicit');
  equal(descriptor.allowsModelSelfApproval, false, 'Approval descriptor: model self approval is false');
  equal(descriptor.storesRawApprovalText, false, 'Approval descriptor: raw approval text storage is false');
  includes(doc, 'attestor.consequence-approval-provenance-guard.v1', 'Approval docs: version is named');
  includes(doc, 'src/consequence-admission/approval-provenance-guard.ts', 'Approval docs: source file is named');
  includes(doc, 'test:approval-provenance-guard', 'Approval docs: test command is named');
  includes(doc, 'fake-approval-laundering', 'Approval docs: failure mode is named');
  includes(doc, 'does not prove every customer IdP, approval workflow, reviewer queue, or downstream verifier has integrated the guard', 'Approval docs: limitation is explicit');
  includes(registry, 'approval-provenance-guard.ts', 'Failure registry: approval guard source evidence is recorded');
  equal(
    pkg.scripts['test:approval-provenance-guard'],
    'tsx tests/approval-provenance-guard.test.ts',
    'Package: approval provenance guard test is exposed',
  );
}

try {
  testChatApprovalIsBlockedAndDigestOnly();
  testLlmSummaryApprovalIsBlocked();
  testVerifiedReviewerQueueApprovalPasses();
  testMissingProvenanceRequiresReview();
  testDuplicateReviewerCannotSatisfyDualApproval();
  testMixedVerifiedAndFakeApprovalRequiresReview();
  testDescriptorDocsRegistryAndPackageScriptStayAligned();
  console.log(`Approval provenance guard tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Approval provenance guard tests failed:', error);
  process.exitCode = 1;
}
