import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
  consequenceAdmissionDescriptor,
  consequenceFailureModeRegistry,
  consequenceFailureModeRegistryPlacementDescriptor,
  consequenceFailureModeRuntimeExtensionDescriptor,
  evaluateConsequenceFailureModeRuntimeExtensions,
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

function excludes(value: string, expected: string, message: string): void {
  assert.ok(!value.includes(expected), `${message}\nExpected to exclude: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function validExtension() {
  return {
    extensionId: 'customer-wire-transfer-hold',
    scopeKind: 'tenant' as const,
    scopeDigest: 'sha256:tenant-scope',
    name: 'Customer wire transfer hold',
    summary: 'Block wire transfers while the customer fraud hold is active.',
    classifications: ['authority', 'workflow', 'security'] as const,
    severity: 'high' as const,
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'auditability'] as const,
    requiredControls: ['fraud-hold-state-required', 'verified-finance-approval-required'] as const,
    defaultDecision: 'block' as const,
    invariantIds: [
      'no-go-hold-overrides-natural-language',
      'verified-approval-provenance-required',
    ] as const,
    enforcementPhases: ['admission', 'customer-gate', 'audit-proof'] as const,
    requiredEvidence: ['fraud-hold-state-digest', 'approval-provenance-digest'] as const,
    requiredAuthority: ['tenant-risk-owner'] as const,
    requiredAuditRecords: ['runtime-extension-activation-record'] as const,
    replayRequired: true,
    ownerAuthorityDigest: 'sha256:owner-authority',
    approvalDigest: 'sha256:approval',
    sourceRecordDigest: 'sha256:source-record',
    expiresAt: '2026-05-15T00:00:00.000Z',
  };
}

function testDescriptorIsConservative(): void {
  const descriptor = consequenceFailureModeRuntimeExtensionDescriptor();
  const admission = consequenceAdmissionDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
    'Runtime extensions: version constant is exposed',
  );
  equal(
    descriptor.version,
    'attestor.consequence-failure-mode-runtime-extension.v1',
    'Runtime extensions: version literal is stable',
  );
  equal(descriptor.mutatesCanonicalRegistry, false, 'Runtime extensions: canonical registry is not mutated');
  equal(descriptor.requiresScopedOverlay, true, 'Runtime extensions: scoped overlay is required');
  equal(descriptor.requiresOwnerAuthorityDigest, true, 'Runtime extensions: owner authority digest is required');
  equal(descriptor.requiresApprovalDigest, true, 'Runtime extensions: approval digest is required');
  equal(descriptor.requiresSourceRecordDigest, true, 'Runtime extensions: source record digest is required');
  equal(descriptor.requiresReplayBinding, true, 'Runtime extensions: replay binding is required');
  equal(descriptor.autoEnforce, false, 'Runtime extensions: auto-enforce is false');
  equal(descriptor.productionReady, false, 'Runtime extensions: production readiness is false');
  equal(descriptor.activatesEnforcement, false, 'Runtime extensions: activation is false');
  equal(descriptor.rawPayloadStored, false, 'Runtime extensions: raw payload storage is false');
  ok(descriptor.allowedScopes.includes('tenant'), 'Runtime extensions: tenant scope is supported');
  ok(descriptor.outcomes.includes('block'), 'Runtime extensions: block outcome is supported');
  ok(
    descriptor.reasonCodes.includes('runtime-extension-id-collides-with-core-registry'),
    'Runtime extensions: core collision reason code is exposed',
  );
  equal(
    admission.failureModeRuntimeExtensionVersion,
    CONSEQUENCE_FAILURE_MODE_RUNTIME_EXTENSION_VERSION,
    'Admission descriptor exposes runtime extension version',
  );
  equal(
    admission.failureModeRuntimeExtensionReasonCodes.includes('runtime-extension-owner-authority-missing'),
    true,
    'Admission descriptor exposes runtime extension reason codes',
  );
}

function testValidExtensionPassesWithoutRawPayloadStorage(): void {
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [validExtension()],
  });

  equal(evaluation.outcome, 'pass', 'Runtime extensions: complete extension passes');
  equal(evaluation.allowed, true, 'Runtime extensions: pass outcome is allowed for the extension overlay');
  equal(evaluation.failClosed, false, 'Runtime extensions: pass outcome is not fail-closed');
  equal(evaluation.extensionCount, 1, 'Runtime extensions: extension count is recorded');
  equal(evaluation.blockCount, 0, 'Runtime extensions: no block count for complete extension');
  equal(evaluation.reviewCount, 0, 'Runtime extensions: no review count for complete extension');
  equal(evaluation.mutatesCanonicalRegistry, false, 'Runtime extensions: evaluation does not mutate registry');
  equal(evaluation.rawPayloadStored, false, 'Runtime extensions: raw payload storage is false');
  ok(evaluation.digest.startsWith('sha256:'), 'Runtime extensions: digest is generated');
  excludes(evaluation.canonical, 'customer-wire-transfer-hold', 'Runtime extensions: canonical omits raw extension id');
  excludes(evaluation.canonical, 'wire transfers', 'Runtime extensions: canonical omits raw summary text');
  ok(
    evaluation.observedExtensions[0]?.extensionIdDigest?.startsWith('sha256:'),
    'Runtime extensions: extension id is represented as digest',
  );
}

function testMissingExtensionReviews(): void {
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [],
  });

  equal(evaluation.outcome, 'review', 'Runtime extensions: empty extension set reviews');
  equal(evaluation.allowed, false, 'Runtime extensions: empty extension set is not allowed');
  ok(
    evaluation.reasonCodes.includes('runtime-extension-missing'),
    'Runtime extensions: missing extension reason is present',
  );
}

function testCoreRegistryCollisionBlocks(): void {
  const extension = {
    ...validExtension(),
    extensionId: 'direct-prompt-injection',
  };
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [extension],
  });

  equal(evaluation.outcome, 'block', 'Runtime extensions: core registry id collision blocks');
  ok(
    evaluation.reasonCodes.includes('runtime-extension-id-collides-with-core-registry'),
    'Runtime extensions: collision reason code is present',
  );
}

function testMissingAuthorityApprovalReplayBlocks(): void {
  const extension = {
    ...validExtension(),
    ownerAuthorityDigest: null,
    approvalDigest: null,
    replayRequired: false,
  };
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [extension],
  });

  equal(evaluation.outcome, 'block', 'Runtime extensions: missing authority approval and replay block');
  ok(
    evaluation.reasonCodes.includes('runtime-extension-owner-authority-missing'),
    'Runtime extensions: owner authority reason is present',
  );
  ok(
    evaluation.reasonCodes.includes('runtime-extension-approval-missing'),
    'Runtime extensions: approval reason is present',
  );
  ok(
    evaluation.reasonCodes.includes('runtime-extension-replay-missing'),
    'Runtime extensions: replay reason is present',
  );
}

function testExpiredExtensionBlocks(): void {
  const extension = {
    ...validExtension(),
    expiresAt: '2026-05-13T00:00:00.000Z',
  };
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [extension],
  });

  equal(evaluation.outcome, 'block', 'Runtime extensions: expired extension blocks');
  ok(
    evaluation.reasonCodes.includes('runtime-extension-expired'),
    'Runtime extensions: expired reason code is present',
  );
}

function testRegistryDigestIsBoundAndPlacementIsIndexed(): void {
  const registry = consequenceFailureModeRegistry();
  const evaluation = evaluateConsequenceFailureModeRuntimeExtensions({
    generatedAt: '2026-05-14T00:00:00.000Z',
    extensions: [validExtension()],
  });
  const placement = consequenceFailureModeRegistryPlacementDescriptor();

  equal(evaluation.registryDigest, registry.digest, 'Runtime extensions: registry digest is bound');
  ok(
    placement.sourceFiles.includes('src/consequence-admission/failure-mode-runtime-extensions.ts'),
    'Runtime extensions: placement source file is indexed',
  );
}

function testDocsAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'failure-mode-runtime-extensions.md');
  const registryDoc = readProjectFile('docs', '02-architecture', 'failure-mode-registry.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'attestor.consequence-failure-mode-runtime-extension.v1', 'Runtime extension docs: version is named');
  includes(doc, 'does not mutate the canonical registry', 'Runtime extension docs: registry mutation non-claim is present');
  includes(doc, 'owner authority digest', 'Runtime extension docs: owner authority requirement is named');
  includes(doc, 'approval digest', 'Runtime extension docs: approval requirement is named');
  includes(doc, 'source record digest', 'Runtime extension docs: source record requirement is named');
  includes(doc, 'test:failure-mode-runtime-extensions', 'Runtime extension docs: test command is named');
  includes(
    registryDoc,
    'runtime extension overlays',
    'Failure registry docs: runtime extension overlays are named',
  );
  equal(
    pkg.scripts['test:failure-mode-runtime-extensions'],
    'tsx tests/failure-mode-runtime-extensions.test.ts',
    'Package: runtime extension test is exposed',
  );
}

try {
  testDescriptorIsConservative();
  testValidExtensionPassesWithoutRawPayloadStorage();
  testMissingExtensionReviews();
  testCoreRegistryCollisionBlocks();
  testMissingAuthorityApprovalReplayBlocks();
  testExpiredExtensionBlocks();
  testRegistryDigestIsBoundAndPlacementIsIndexed();
  testDocsAndPackageScriptStayAligned();
  console.log(`Failure mode runtime extension tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Failure mode runtime extension tests failed:', error);
  process.exitCode = 1;
}
