import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceRecipientTenantBoundaryReplayDescriptor,
  evaluateConsequenceRecipientTenantBoundaryReplay,
  type ConsequenceRecipientTenantBoundaryReplayCaseInput,
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

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function cleanCase(): ConsequenceRecipientTenantBoundaryReplayCaseInput {
  return {
    caseId: 'clean:external-review-packet',
    surface: 'external-review-packet',
    boundaryKinds: ['tenant', 'recipient', 'data-minimization'],
    expectedOutcome: 'pass',
    currentTenantId: 'tenant_current_private',
    recordTenantIds: ['tenant_current_private', 'tenant_current_private'],
    targetRecipientId: 'reviewer_internal_private',
    approvedRecipientIds: ['reviewer_internal_private'],
    contentDataClass: 'internal',
    allowedRecipientDataClasses: ['internal', 'confidential'],
    communicationContext: 'internal-review-workflow-private',
    redactionPolicyPassed: true,
    rawRecipientExposed: false,
    rawPayloadStored: false,
  };
}

function testCleanBoundaryReplayPasses(): void {
  const report = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt: '2026-05-13T12:00:00.000Z',
    cases: [cleanCase()],
  });
  const result = report.results[0];
  const serialized = JSON.stringify(report);

  equal(report.version, 'attestor.consequence-recipient-tenant-boundary-replay.v1', 'Boundary replay: version is explicit');
  equal(report.status, 'passed', 'Boundary replay: clean case passes');
  equal(report.caseCount, 1, 'Boundary replay: case count is retained');
  equal(report.failedCaseCount, 0, 'Boundary replay: no failed cases');
  equal(result?.outcome, 'pass', 'Boundary replay: clean result is pass');
  equal(result?.status, 'passed', 'Boundary replay: clean result matches expected decision');
  ok(result?.failureModeIds.includes('cross-tenant-leakage'), 'Boundary replay: tenant failure mode is bound');
  ok(result?.failureModeIds.includes('wrong-recipient-disclosure'), 'Boundary replay: recipient failure mode is bound');
  ok(result?.failureModeIds.includes('sensitive-data-disclosure'), 'Boundary replay: data minimization failure mode is bound');
  ok(result?.requiredControls.includes('tenant-bound-record-check'), 'Boundary replay: tenant-bound-record-check is required');
  ok(result?.requiredControls.includes('recipient-boundary-check'), 'Boundary replay: recipient-boundary-check is required');
  ok(result?.requiredControls.includes('data-minimization-surface-policy'), 'Boundary replay: data minimization control is required');
  ok(report.digest.startsWith('sha256:'), 'Boundary replay: digest is generated');
  excludes(serialized, /tenant_current_private|reviewer_internal_private|internal-review-workflow-private/iu, 'Boundary replay: serialized output excludes raw tenant, recipient, and context values');
}

function testForeignTenantBlocks(): void {
  const report = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt: '2026-05-13T12:01:00.000Z',
    cases: [
      {
        ...cleanCase(),
        caseId: 'foreign-tenant:business-risk-dashboard',
        surface: 'business-risk-dashboard',
        boundaryKinds: ['tenant'],
        expectedOutcome: 'block',
        currentTenantId: 'tenant_current_private',
        recordTenantIds: ['tenant_current_private', 'tenant_foreign_private'],
      },
    ],
  });
  const result = report.results[0];
  const serialized = JSON.stringify(report);

  equal(report.status, 'passed', 'Boundary replay: expected foreign tenant block passes replay');
  equal(result?.outcome, 'block', 'Boundary replay: foreign tenant record blocks');
  equal(result?.failClosed, true, 'Boundary replay: foreign tenant block is fail-closed');
  ok(result?.reasonCodes.includes('foreign-tenant-record'), 'Boundary replay: foreign tenant reason is present');
  equal(result?.observed.foreignRecordTenantDigests.length, 1, 'Boundary replay: foreign tenant digest is retained');
  excludes(serialized, /tenant_foreign_private|tenant_current_private/iu, 'Boundary replay: raw tenant ids are not serialized');
}

function testWrongRecipientAndDataClassBlock(): void {
  const report = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt: '2026-05-13T12:02:00.000Z',
    cases: [
      {
        ...cleanCase(),
        caseId: 'wrong-recipient:support-communication',
        surface: 'support-communication',
        boundaryKinds: ['recipient', 'data-minimization'],
        expectedOutcome: 'block',
        targetRecipientId: 'customer_external_private',
        approvedRecipientIds: ['internal_reviewer_private'],
        contentDataClass: 'internal',
        allowedRecipientDataClasses: ['customer-visible'],
        communicationContext: 'customer-email-private',
        redactionPolicyPassed: false,
        rawRecipientExposed: true,
      },
    ],
  });
  const result = report.results[0];
  const serialized = JSON.stringify(report);

  equal(report.status, 'passed', 'Boundary replay: expected wrong-recipient block passes replay');
  equal(result?.outcome, 'block', 'Boundary replay: wrong recipient blocks');
  ok(result?.reasonCodes.includes('recipient-out-of-scope'), 'Boundary replay: recipient out of scope reason is present');
  ok(result?.reasonCodes.includes('recipient-data-class-disallowed'), 'Boundary replay: disallowed data class reason is present');
  ok(result?.reasonCodes.includes('redaction-policy-failed'), 'Boundary replay: failed redaction reason is present');
  ok(result?.reasonCodes.includes('raw-recipient-exposed'), 'Boundary replay: raw recipient exposure reason is present');
  excludes(serialized, /customer_external_private|internal_reviewer_private|customer-email-private/iu, 'Boundary replay: raw recipient scope is not serialized');
}

function testMissingBoundaryEvidenceRequiresReview(): void {
  const report = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt: '2026-05-13T12:03:00.000Z',
    cases: [
      {
        caseId: 'missing-boundary:audit-evidence-export',
        surface: 'audit-evidence-export',
        boundaryKinds: ['tenant', 'recipient', 'data-minimization'],
        expectedOutcome: 'review',
        currentTenantId: 'tenant_current_private',
        recordTenantIds: ['tenant_current_private', null],
        targetRecipientId: null,
        approvedRecipientIds: [],
        contentDataClass: null,
        allowedRecipientDataClasses: [],
        communicationContext: null,
        redactionPolicyPassed: null,
      },
    ],
  });
  const result = report.results[0];

  equal(report.status, 'review', 'Boundary replay: expected missing evidence review keeps report in review');
  equal(result?.outcome, 'review', 'Boundary replay: missing boundary evidence reviews');
  ok(result?.reasonCodes.includes('record-tenant-missing'), 'Boundary replay: missing record tenant reason is present');
  ok(result?.reasonCodes.includes('recipient-identity-missing'), 'Boundary replay: missing recipient reason is present');
  ok(result?.reasonCodes.includes('approved-recipient-scope-missing'), 'Boundary replay: missing approved scope reason is present');
  ok(result?.reasonCodes.includes('redaction-policy-missing'), 'Boundary replay: missing redaction policy reason is present');
}

function testUnexpectedDecisionMismatchFailsReplay(): void {
  const report = evaluateConsequenceRecipientTenantBoundaryReplay({
    generatedAt: '2026-05-13T12:04:00.000Z',
    cases: [
      {
        ...cleanCase(),
        caseId: 'mismatch:downstream-send',
        surface: 'downstream-send',
        expectedOutcome: 'pass',
        targetRecipientId: 'customer_external_private',
        approvedRecipientIds: ['internal_reviewer_private'],
        contentDataClass: 'confidential',
        allowedRecipientDataClasses: ['customer-visible'],
      },
    ],
  });
  const result = report.results[0];

  equal(report.status, 'failed', 'Boundary replay: expected/outcome mismatch fails report');
  equal(report.failedCaseCount, 1, 'Boundary replay: failed case count is retained');
  equal(result?.status, 'failed', 'Boundary replay: result status is failed');
  ok(result?.reasonCodes.includes('expected-boundary-decision-mismatch'), 'Boundary replay: mismatch reason is present');
}

function testDescriptorDocsRegistryAndPackageScriptStayAligned(): void {
  const descriptor = consequenceRecipientTenantBoundaryReplayDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'recipient-tenant-boundary-replay.md');
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-recipient-tenant-boundary-replay.v1', 'Boundary descriptor: version is explicit');
  ok(descriptor.failureModeIds.includes('cross-tenant-leakage'), 'Boundary descriptor: cross-tenant failure mode is included');
  ok(descriptor.failureModeIds.includes('wrong-recipient-disclosure'), 'Boundary descriptor: wrong-recipient failure mode is included');
  ok(descriptor.failureModeIds.includes('sensitive-data-disclosure'), 'Boundary descriptor: sensitive disclosure failure mode is included');
  equal(descriptor.rawPayloadStored, false, 'Boundary descriptor: raw payload storage is false');
  equal(descriptor.digestOnly, true, 'Boundary descriptor: digest-only output is explicit');
  includes(doc, 'attestor.consequence-recipient-tenant-boundary-replay.v1', 'Boundary docs: version is named');
  includes(doc, 'src/consequence-admission/recipient-tenant-boundary-replay.ts', 'Boundary docs: source file is named');
  includes(doc, 'test:recipient-tenant-boundary-replay', 'Boundary docs: test command is named');
  includes(doc, 'cross-tenant-leakage', 'Boundary docs: cross-tenant failure mode is named');
  includes(doc, 'wrong-recipient-disclosure', 'Boundary docs: wrong-recipient failure mode is named');
  includes(registry, 'recipient-tenant-boundary-replay.ts', 'Failure registry: boundary replay source evidence is recorded');
  equal(
    pkg.scripts['test:recipient-tenant-boundary-replay'],
    'tsx tests/recipient-tenant-boundary-replay.test.ts',
    'Package: boundary replay test is exposed',
  );
}

try {
  testCleanBoundaryReplayPasses();
  testForeignTenantBlocks();
  testWrongRecipientAndDataClassBlock();
  testMissingBoundaryEvidenceRequiresReview();
  testUnexpectedDecisionMismatchFailsReplay();
  testDescriptorDocsRegistryAndPackageScriptStayAligned();
  console.log(`Recipient/tenant boundary replay tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Recipient/tenant boundary replay tests failed:', error);
  process.exitCode = 1;
}
