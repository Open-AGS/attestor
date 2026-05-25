import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceRecipientTenantRuntimeBoundaryDescriptor,
  evaluateConsequenceRecipientTenantRuntimeBoundary,
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

function cleanDecision() {
  return evaluateConsequenceRecipientTenantRuntimeBoundary({
    generatedAt: '2026-05-14T12:00:00.000Z',
    surface: 'external-review-packet',
    boundaryKinds: ['tenant', 'recipient', 'data-minimization'],
    currentTenantId: 'tenant_current_private_runtime',
    recordTenantIds: ['tenant_current_private_runtime', 'tenant_current_private_runtime'],
    targetRecipientId: 'reviewer_private_runtime',
    approvedRecipientIds: ['reviewer_private_runtime'],
    contentDataClass: 'internal',
    allowedRecipientDataClasses: ['internal', 'confidential'],
    communicationContext: 'internal-review-context-private-runtime',
    redactionPolicyPassed: true,
    rawRecipientExposed: false,
    rawPayloadStored: false,
    runtimeSurfaceRef: 'route:/api/v1/review-packet/private',
  });
}

function testCleanRuntimeDecisionPasses(): void {
  const decision = cleanDecision();
  const serialized = JSON.stringify(decision);

  equal(
    decision.version,
    'attestor.consequence-recipient-tenant-boundary-runtime.v1',
    'Runtime boundary: version is explicit',
  );
  equal(decision.replayVersion, 'attestor.consequence-recipient-tenant-boundary-replay.v1', 'Runtime boundary: replay version is bound');
  equal(decision.outcome, 'pass', 'Runtime boundary: clean decision passes');
  equal(decision.allowed, true, 'Runtime boundary: clean decision is allowed');
  equal(decision.failClosed, false, 'Runtime boundary: clean decision is not fail-closed');
  equal(decision.runtimeBridge, true, 'Runtime boundary: bridge flag is explicit');
  equal(decision.syntheticOnly, false, 'Runtime boundary: bridge is not synthetic-only');
  equal(decision.downstreamMutationAllowed, false, 'Runtime boundary: bridge does not mutate downstream systems');
  ok(decision.failureModeIds.includes('cross-tenant-leakage'), 'Runtime boundary: cross-tenant failure mode is bound');
  ok(decision.failureModeIds.includes('wrong-recipient-disclosure'), 'Runtime boundary: wrong-recipient failure mode is bound');
  ok(decision.failureModeIds.includes('sensitive-data-disclosure'), 'Runtime boundary: sensitive-data failure mode is bound');
  ok(decision.requiredControls.includes('tenant-bound-record-check'), 'Runtime boundary: tenant control is required');
  ok(decision.requiredControls.includes('recipient-boundary-check'), 'Runtime boundary: recipient control is required');
  ok(decision.replayDigest.startsWith('sha256:'), 'Runtime boundary: replay digest is retained');
  ok(decision.digest.startsWith('sha256:'), 'Runtime boundary: decision digest is generated');
  excludes(
    serialized,
    /tenant_current_private_runtime|reviewer_private_runtime|internal-review-context-private-runtime|route:\/api\/v1\/review-packet\/private/iu,
    'Runtime boundary: serialized output excludes raw tenant, recipient, context, and surface refs',
  );
}

function testForeignTenantBlocks(): void {
  const decision = evaluateConsequenceRecipientTenantRuntimeBoundary({
    generatedAt: '2026-05-14T12:01:00.000Z',
    surface: 'business-risk-dashboard',
    boundaryKinds: ['tenant'],
    currentTenantId: 'tenant_current_private_runtime',
    recordTenantIds: ['tenant_current_private_runtime', 'tenant_foreign_private_runtime'],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.outcome, 'block', 'Runtime boundary: foreign tenant blocks');
  equal(decision.allowed, false, 'Runtime boundary: foreign tenant is not allowed');
  equal(decision.failClosed, true, 'Runtime boundary: foreign tenant fails closed');
  ok(decision.reasonCodes.includes('foreign-tenant-record'), 'Runtime boundary: foreign tenant reason is present');
  equal(decision.observed.foreignRecordTenantDigests.length, 1, 'Runtime boundary: foreign tenant digest is retained');
  excludes(serialized, /tenant_foreign_private_runtime|tenant_current_private_runtime/iu, 'Runtime boundary: raw tenant ids are not serialized');
}

function testWrongRecipientAndDataClassBlock(): void {
  const decision = evaluateConsequenceRecipientTenantRuntimeBoundary({
    generatedAt: '2026-05-14T12:02:00.000Z',
    surface: 'support-communication',
    boundaryKinds: ['recipient', 'data-minimization'],
    targetRecipientId: 'customer_external_private_runtime',
    approvedRecipientIds: ['reviewer_internal_private_runtime'],
    contentDataClass: 'internal',
    allowedRecipientDataClasses: ['customer-visible'],
    communicationContext: 'customer-email-private-runtime',
    redactionPolicyPassed: false,
    rawRecipientExposed: true,
  });
  const serialized = JSON.stringify(decision);

  equal(decision.outcome, 'block', 'Runtime boundary: wrong recipient and failed redaction block');
  equal(decision.allowed, false, 'Runtime boundary: wrong recipient is not allowed');
  ok(decision.reasonCodes.includes('recipient-out-of-scope'), 'Runtime boundary: recipient reason is present');
  ok(decision.reasonCodes.includes('recipient-data-class-disallowed'), 'Runtime boundary: data class reason is present');
  ok(decision.reasonCodes.includes('redaction-policy-failed'), 'Runtime boundary: redaction failure reason is present');
  ok(decision.reasonCodes.includes('raw-recipient-exposed'), 'Runtime boundary: raw recipient exposure reason is present');
  excludes(
    serialized,
    /customer_external_private_runtime|reviewer_internal_private_runtime|customer-email-private-runtime/iu,
    'Runtime boundary: raw recipient/context values are not serialized',
  );
}

function testMissingBoundaryEvidenceReviews(): void {
  const decision = evaluateConsequenceRecipientTenantRuntimeBoundary({
    generatedAt: '2026-05-14T12:03:00.000Z',
    surface: 'audit-evidence-export',
    boundaryKinds: ['tenant', 'recipient', 'data-minimization'],
    currentTenantId: 'tenant_current_private_runtime',
    recordTenantIds: ['tenant_current_private_runtime', null],
    targetRecipientId: null,
    approvedRecipientIds: [],
    contentDataClass: null,
    allowedRecipientDataClasses: [],
    communicationContext: null,
    redactionPolicyPassed: null,
  });

  equal(decision.outcome, 'review', 'Runtime boundary: missing evidence reviews');
  equal(decision.allowed, false, 'Runtime boundary: missing evidence is not allowed');
  equal(decision.failClosed, true, 'Runtime boundary: review fails closed for execution');
  ok(decision.reasonCodes.includes('record-tenant-missing'), 'Runtime boundary: missing tenant reason is present');
  ok(decision.reasonCodes.includes('recipient-identity-missing'), 'Runtime boundary: missing recipient reason is present');
  ok(decision.reasonCodes.includes('approved-recipient-scope-missing'), 'Runtime boundary: missing scope reason is present');
  ok(decision.reasonCodes.includes('redaction-policy-missing'), 'Runtime boundary: missing redaction reason is present');
}

function testDescriptorCoverageDocsAndTrackerStayAligned(): void {
  const descriptor = consequenceRecipientTenantRuntimeBoundaryDescriptor();
  const publicSurface = readProjectFile('src', 'consequence-admission', 'public-surface.ts');
  const coverage = readProjectFile('src', 'consequence-admission', 'failure-mode-guard-coverage.ts');
  const architectureDoc = readProjectFile('docs', '02-architecture', 'recipient-tenant-boundary-replay.md');
  const auditDoc = readProjectFile('docs', 'audit', 'f6-recipient-tenant-runtime-boundary.md');
  const validation = readProjectFile('docs', 'audit', 'f6-tenant-blast-radius-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  equal(
    descriptor.version,
    'attestor.consequence-recipient-tenant-boundary-runtime.v1',
    'Runtime boundary descriptor: version is explicit',
  );
  equal(descriptor.rendersRuntimeDecision, true, 'Runtime boundary descriptor: renders decision');
  equal(descriptor.rawPayloadStored, false, 'Runtime boundary descriptor: raw payload storage is false');
  equal(descriptor.digestOnly, true, 'Runtime boundary descriptor: digest-only output is explicit');
  equal(descriptor.productionReady, false, 'Runtime boundary descriptor: production readiness is false');
  includes(publicSurface, "export * from './recipient-tenant-boundary-runtime.js';", 'Public surface: runtime boundary module is exported');
  includes(coverage, "primaryImplementationPath: 'src/consequence-admission/recipient-tenant-boundary-runtime.ts'", 'Coverage: runtime boundary is primary evidence for tenant/recipient');
  includes(coverage, "runtimeClaim: 'renders-decision'", 'Coverage: runtime decision claim is present');
  includes(architectureDoc, 'attestor.consequence-recipient-tenant-boundary-runtime.v1', 'Architecture docs: runtime bridge version is named');
  includes(auditDoc, '# F6 Recipient/Tenant Runtime Boundary Bridge', 'Audit docs: F6 runtime boundary title exists');
  includes(auditDoc, 'F6-T8 remains `partial`, not `fixed`', 'Audit docs: remaining limitation is explicit');
  includes(validation, 'F6-T8 | Recipient/tenant boundary replay is not runtime enforcement. | `partial`', 'F6 validation: T8 remains partial');
  includes(validation, 'Replay-only coverage is now bridged into a deterministic runtime decision surface', 'F6 validation: runtime bridge evidence is documented');
  includes(tracker, 'Remaining F6 queue after recipient/tenant runtime boundary bridge: 0 planned', 'Tracker: remaining F6 count is zero');
  includes(tracker, 'F6-T8 recipient/tenant boundary replay-only | `partial`', 'Tracker: F6-T8 remains partial');
  includes(packageJson, '"test:f6-recipient-tenant-runtime-boundary"', 'Package: runtime boundary test script is exposed');
}

try {
  testCleanRuntimeDecisionPasses();
  testForeignTenantBlocks();
  testWrongRecipientAndDataClassBlock();
  testMissingBoundaryEvidenceReviews();
  testDescriptorCoverageDocsAndTrackerStayAligned();
  console.log(`F6 recipient/tenant runtime boundary tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F6 recipient/tenant runtime boundary tests failed:', error);
  process.exitCode = 1;
}
