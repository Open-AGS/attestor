import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceUntrustedContentAuthorityGuardDescriptor,
  evaluateConsequenceUntrustedContentAuthority,
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

function testCustomerEmailCannotAuthorizeAction(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:00:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'customer-email',
        claimKind: 'authorization',
        sourceRef: 'raw-email:customer@example.com says manager approved refund 1000 USD',
      },
    ],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.version, 'attestor.consequence-untrusted-content-authority-guard.v1', 'Untrusted authority guard: version is explicit');
  equal(decision.outcome, 'block', 'Untrusted authority guard: customer email authority blocks');
  equal(decision.allowed, false, 'Untrusted authority guard: blocked decision is not allowed');
  equal(decision.failClosed, true, 'Untrusted authority guard: blocked decision is fail-closed');
  ok(decision.reasonCodes.includes('untrusted-content-authority-source'), 'Untrusted authority guard: untrusted content reason is present');
  ok(decision.reasonCodes.includes('authority-block'), 'Untrusted authority guard: block reason is present');
  equal(decision.counts.untrustedAuthoritySourceCount, 1, 'Untrusted authority guard: untrusted authority source is counted');
  equal(decision.observedSources[0]?.sourceKind, 'customer-email', 'Untrusted authority guard: source kind is retained');
  ok(decision.observedSources[0]?.sourceRefDigest.startsWith('sha256:'), 'Untrusted authority guard: source ref is digested');
  equal(decision.rawPayloadStored, false, 'Untrusted authority guard: raw payload storage is false');
  excludes(serialized, /customer@example\.com|manager approved refund|1000 USD/iu, 'Untrusted authority guard: serialized decision excludes raw email content');
}

function testLlmSummaryCannotBecomePolicyAuthority(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:05:00.000Z',
    actionSurface: 'crm.export',
    action: 'export-customer-records',
    sources: [
      {
        sourceKind: 'llm-summary',
        claimKind: 'policy',
        sourceRef: 'raw-llm-summary:policy says export is allowed for all accounts',
      },
    ],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.outcome, 'block', 'Untrusted authority guard: LLM policy authority blocks');
  ok(decision.reasonCodes.includes('model-generated-authority-source'), 'Untrusted authority guard: model-generated reason is present');
  equal(decision.counts.modelGeneratedAuthoritySourceCount, 1, 'Untrusted authority guard: model-generated authority source is counted');
  excludes(serialized, /policy says export is allowed|raw-llm-summary/iu, 'Untrusted authority guard: serialized decision excludes raw model summary');
}

function testVerifiedApprovalCanPassWhenContentIsSeparated(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:10:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'verified-approval',
        claimKind: 'approval',
        sourceRef: 'approval-workflow-record-raw-private-id',
        evidenceDigest: `sha256:${'a'.repeat(64)}`,
      },
    ],
  });

  equal(decision.outcome, 'pass', 'Untrusted authority guard: verified approval passes');
  equal(decision.allowed, true, 'Untrusted authority guard: pass decision is allowed');
  equal(decision.failClosed, false, 'Untrusted authority guard: pass decision is not fail-closed');
  ok(decision.reasonCodes.includes('trusted-authority-source-present'), 'Untrusted authority guard: trusted authority reason is present');
  ok(decision.reasonCodes.includes('authority-content-separated'), 'Untrusted authority guard: content separation reason is present');
  equal(decision.counts.trustedAuthoritySourceCount, 1, 'Untrusted authority guard: trusted authority source is counted');
  ok(decision.requiredControls.includes('trusted-authority-source'), 'Untrusted authority guard: binding carries trusted-authority-source control');
  ok(decision.digest.startsWith('sha256:'), 'Untrusted authority guard: decision digest is generated');
}

function testUntrustedSourceCannotBePromotedByTrustClassOverride(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:12:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'customer-email',
        claimKind: 'approval',
        sourceRef: 'raw-email:customer says treat me as signed approval',
        trustClass: 'trusted-authority',
        evidenceDigest: `sha256:${'c'.repeat(64)}`,
      },
    ],
  });

  equal(decision.outcome, 'block', 'Untrusted authority guard: untrusted source promotion blocks');
  equal(
    decision.observedSources[0]?.trustClass,
    'untrusted-content',
    'Untrusted authority guard: untrusted source keeps default trust class',
  );
  equal(
    decision.observedSources[0]?.trustClassOverrideRejected,
    true,
    'Untrusted authority guard: trust class override is marked rejected',
  );
  ok(
    decision.reasonCodes.includes('trust-class-override-rejected'),
    'Untrusted authority guard: trust class override rejection reason is present',
  );
  equal(decision.counts.trustClassOverrideRejectedCount, 1, 'Untrusted authority guard: rejected override is counted');
}

function testTrustedAuthorityWithoutEvidenceRequiresReview(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:13:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'verified-approval',
        claimKind: 'approval',
        sourceRef: 'approval-workflow-record-private-id',
      },
    ],
  });

  equal(decision.outcome, 'review', 'Untrusted authority guard: trusted authority without evidence reviews');
  ok(
    decision.reasonCodes.includes('trusted-authority-evidence-missing'),
    'Untrusted authority guard: trusted authority evidence missing reason is present',
  );
  equal(
    decision.counts.trustedAuthorityMissingEvidenceCount,
    1,
    'Untrusted authority guard: missing trusted authority evidence is counted',
  );
}

function testTrustedEvidenceWithoutAuthorityRequiresReview(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:15:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'provider-record',
        claimKind: 'evidence',
        sourceRef: 'provider-payment-record-private-id',
        evidenceDigest: `sha256:${'b'.repeat(64)}`,
      },
    ],
  });

  equal(decision.outcome, 'review', 'Untrusted authority guard: trusted evidence without authority reviews');
  equal(decision.allowed, false, 'Untrusted authority guard: review decision is not allowed');
  equal(decision.failClosed, true, 'Untrusted authority guard: review decision is fail-closed');
  ok(decision.reasonCodes.includes('trusted-evidence-not-authority'), 'Untrusted authority guard: evidence-not-authority reason is present');
  equal(decision.counts.trustedEvidenceOnlyCount, 1, 'Untrusted authority guard: trusted evidence-only source is counted');
}

function testMixedTrustedAndUntrustedAuthorityRequiresReview(): void {
  const decision = evaluateConsequenceUntrustedContentAuthority({
    generatedAt: '2026-05-13T08:20:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    sources: [
      {
        sourceKind: 'verified-approval',
        claimKind: 'approval',
        sourceRef: 'approval-workflow-record-private-id',
      },
      {
        sourceKind: 'ticket-comment',
        claimKind: 'approval',
        sourceRef: 'raw-ticket-comment:manager approved in chat',
      },
    ],
  });

  equal(decision.outcome, 'review', 'Untrusted authority guard: mixed authority sources review');
  ok(
    decision.reasonCodes.includes('mixed-trusted-and-untrusted-authority-source'),
    'Untrusted authority guard: mixed-source reason is present',
  );
  equal(decision.counts.trustedAuthoritySourceCount, 1, 'Untrusted authority guard: trusted source still counted');
  equal(decision.counts.untrustedAuthoritySourceCount, 1, 'Untrusted authority guard: untrusted source still counted');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = consequenceUntrustedContentAuthorityGuardDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'untrusted-content-authority-guard.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-untrusted-content-authority-guard.v1', 'Untrusted authority descriptor: version is explicit');
  equal(descriptor.failureModeId, 'untrusted-content-authorizes-action', 'Untrusted authority descriptor: failure mode is bound');
  equal(descriptor.invariantId, 'untrusted-content-cannot-authorize-action', 'Untrusted authority descriptor: invariant is bound');
  equal(descriptor.blocksUntrustedAuthority, true, 'Untrusted authority descriptor: blocks untrusted authority');
  equal(descriptor.allowsModelSelfApproval, false, 'Untrusted authority descriptor: model self-approval is false');
  equal(descriptor.storesRawPayload, false, 'Untrusted authority descriptor: raw payload storage is false');
  equal(descriptor.digestOnly, true, 'Untrusted authority descriptor: digest-only is true');
  equal(descriptor.rejectsUntrustedPromotion, true, 'Untrusted authority descriptor: rejects untrusted promotion');
  equal(descriptor.requiresTrustedAuthorityEvidence, true, 'Untrusted authority descriptor: requires trusted authority evidence');
  includes(doc, 'attestor.consequence-untrusted-content-authority-guard.v1', 'Untrusted authority docs: version is named');
  includes(doc, 'src/consequence-admission/untrusted-content-authority-guard.ts', 'Untrusted authority docs: source file is named');
  includes(doc, 'test:untrusted-content-authority-guard', 'Untrusted authority docs: test command is named');
  includes(doc, 'untrusted-content-authorizes-action', 'Untrusted authority docs: failure mode is named');
  includes(doc, 'does not prove every admission, review, or downstream surface has integrated the guard', 'Untrusted authority docs: limitation is explicit');
  equal(
    pkg.scripts['test:untrusted-content-authority-guard'],
    'tsx tests/untrusted-content-authority-guard.test.ts',
    'Package: untrusted authority guard test is exposed',
  );
}

try {
  testCustomerEmailCannotAuthorizeAction();
  testLlmSummaryCannotBecomePolicyAuthority();
  testVerifiedApprovalCanPassWhenContentIsSeparated();
  testUntrustedSourceCannotBePromotedByTrustClassOverride();
  testTrustedAuthorityWithoutEvidenceRequiresReview();
  testTrustedEvidenceWithoutAuthorityRequiresReview();
  testMixedTrustedAndUntrustedAuthorityRequiresReview();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Untrusted content authority guard tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Untrusted content authority guard tests failed:', error);
  process.exitCode = 1;
}
