import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAgenticSupplyChainGuardDescriptor,
  evaluateConsequenceAgenticSupplyChain,
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

function completeComponent(overrides = {}) {
  return {
    componentRef: 'pkg:@attestor/example@1.0.0',
    componentKind: 'npm-package',
    trustClass: 'first-party',
    criticality: 'medium',
    sourceRef: 'github:AI-gateway-systems/attestor@0123456789abcdef',
    sourcePinned: true,
    version: '1.0.0',
    integrityDigest: digest('a'),
    provenanceRef: 'github-attestation:run-123',
    provenanceVerified: true,
    signatureVerified: true,
    sbomRef: 'cyclonedx:private-ref',
    ownerAuthorityDigest: digest('b'),
    reviewDigest: digest('c'),
    permissionScopeDigest: digest('d'),
    declaredPermissions: ['payments.refund.read'],
    allowedPermissions: ['payments.refund.read'],
    installScriptsPresent: false,
    networkEgressDeclared: false,
    generatedArtifact: false,
    generatedArtifactReviewed: true,
    domainPackBoundaryVerified: true,
    adapterReadinessDigest: digest('e'),
    runtimeReplayTestDigest: digest('f'),
    ...overrides,
  } as const;
}

function testCriticalThirdPartyMcpWithoutProvenanceBlocks(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:00:00.000Z',
    actionSurface: 'support.refund',
    action: 'issue-refund',
    components: [
      completeComponent({
        componentRef: 'mcp:refund-helper from attacker.example',
        componentKind: 'mcp-server',
        trustClass: 'third-party',
        criticality: 'critical',
        sourceRef: 'https://github.com/example/refund-helper',
        sourcePinned: false,
        version: null,
        integrityDigest: null,
        provenanceRef: null,
        provenanceVerified: false,
        signatureVerified: false,
        sbomRef: null,
        reviewDigest: null,
        runtimeReplayTestDigest: null,
      }),
    ],
  });
  const serialized = JSON.stringify(decision);

  equal(decision.version, 'attestor.consequence-agentic-supply-chain-guard.v1', 'Supply-chain guard: version is explicit');
  equal(decision.outcome, 'block', 'Supply-chain guard: critical unproven third-party component blocks');
  equal(decision.allowed, false, 'Supply-chain guard: block is not allowed');
  equal(decision.failClosed, true, 'Supply-chain guard: block is fail-closed');
  ok(decision.reasonCodes.includes('supply-chain-source-unpinned'), 'Supply-chain guard: unpinned source reason is present');
  ok(decision.reasonCodes.includes('supply-chain-provenance-missing'), 'Supply-chain guard: missing provenance reason is present');
  ok(decision.reasonCodes.includes('supply-chain-critical-component-block'), 'Supply-chain guard: critical block reason is present');
  ok(decision.reasonCodes.includes('supply-chain-block'), 'Supply-chain guard: aggregate block reason is present');
  equal(decision.counts.missingProvenanceCount, 1, 'Supply-chain guard: missing provenance count is retained');
  equal(decision.counts.unverifiedProvenanceCount, 1, 'Supply-chain guard: unverified provenance count is retained');
  excludes(serialized, /attacker\.example|refund-helper/iu, 'Supply-chain guard: serialized decision excludes raw component/source refs');
}

function testOverbroadPermissionsBlockEvenWithProvenance(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:05:00.000Z',
    actionSurface: 'crm.export',
    action: 'export-customer-records',
    components: [
      completeComponent({
        componentKind: 'connector',
        trustClass: 'verified-vendor',
        criticality: 'high',
        declaredPermissions: ['crm.contacts.read', 'crm.contacts.delete'],
        allowedPermissions: ['crm.contacts.read'],
      }),
    ],
  });

  equal(decision.outcome, 'block', 'Supply-chain guard: overbroad permissions block');
  ok(decision.reasonCodes.includes('supply-chain-permission-overbroad'), 'Supply-chain guard: overbroad permission reason is present');
  equal(decision.counts.overbroadPermissionCount, 1, 'Supply-chain guard: overbroad permission count is retained');
  equal(decision.observedComponents[0]?.overbroadPermissionDigests.length, 1, 'Supply-chain guard: overbroad permission is digest-only');
}

function testGeneratedAdapterMustBeReviewed(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:10:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    components: [
      completeComponent({
        componentKind: 'generated-adapter',
        trustClass: 'generated',
        criticality: 'high',
        generatedArtifact: true,
        generatedArtifactReviewed: false,
      }),
    ],
  });

  equal(decision.outcome, 'block', 'Supply-chain guard: unreviewed generated adapter blocks when high impact');
  ok(
    decision.reasonCodes.includes('supply-chain-generated-artifact-review-missing'),
    'Supply-chain guard: generated artifact review reason is present',
  );
  equal(decision.counts.unreviewedGeneratedArtifactCount, 1, 'Supply-chain guard: unreviewed generated count is retained');
}

function testDomainPackBoundaryViolationBlocks(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:15:00.000Z',
    actionSurface: 'crypto.wallet',
    action: 'prepare-wallet-action',
    components: [
      completeComponent({
        componentKind: 'domain-pack',
        trustClass: 'first-party',
        criticality: 'high',
        domainPackBoundaryVerified: false,
      }),
    ],
  });

  equal(decision.outcome, 'block', 'Supply-chain guard: unverified domain pack boundary blocks');
  ok(
    decision.reasonCodes.includes('supply-chain-domain-pack-boundary-unverified'),
    'Supply-chain guard: domain pack boundary reason is present',
  );
}

function testCompleteFirstPartyPackageCanPass(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:20:00.000Z',
    actionSurface: 'payments.refund',
    action: 'issue-refund',
    components: [completeComponent()],
  });

  equal(decision.outcome, 'pass', 'Supply-chain guard: complete first-party evidence passes');
  equal(decision.allowed, true, 'Supply-chain guard: pass is allowed');
  equal(decision.failClosed, false, 'Supply-chain guard: pass is not fail-closed');
  ok(decision.reasonCodes.includes('supply-chain-pass'), 'Supply-chain guard: pass reason is present');
  ok(decision.digest.startsWith('sha256:'), 'Supply-chain guard: digest is generated');
}

function testMissingComponentsRequiresReview(): void {
  const decision = evaluateConsequenceAgenticSupplyChain({
    generatedAt: '2026-05-14T09:25:00.000Z',
    actionSurface: 'support.email',
    action: 'send-email',
    components: [],
  });

  equal(decision.outcome, 'review', 'Supply-chain guard: missing component manifest reviews');
  ok(decision.reasonCodes.includes('supply-chain-component-missing'), 'Supply-chain guard: missing component reason is present');
  equal(decision.counts.componentCount, 0, 'Supply-chain guard: empty manifest count is retained');
}

function testDescriptorDocsRegistryAndPackageScriptStayAligned(): void {
  const descriptor = consequenceAgenticSupplyChainGuardDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'agentic-supply-chain-guard.md');
  const registry = readProjectFile('src', 'consequence-admission', 'failure-mode-registry.ts');
  const coverage = readProjectFile('src', 'consequence-admission', 'failure-mode-guard-coverage.ts');
  const activation = readProjectFile('src', 'consequence-admission', 'guard-activation-readiness.ts');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-agentic-supply-chain-guard.v1', 'Supply-chain descriptor: version is explicit');
  equal(descriptor.failureModeId, 'agentic-supply-chain-compromise', 'Supply-chain descriptor: failure mode is bound');
  equal(descriptor.requiresPinnedSource, true, 'Supply-chain descriptor: pinned source is required');
  equal(descriptor.requiresVerifiedProvenance, true, 'Supply-chain descriptor: verified provenance is required');
  equal(descriptor.requiresLeastPrivilegeScope, true, 'Supply-chain descriptor: least privilege scope is required');
  equal(descriptor.rejectsOverbroadPermissions, true, 'Supply-chain descriptor: overbroad permissions are rejected');
  equal(descriptor.storesRawComponentRefs, false, 'Supply-chain descriptor: raw refs are not stored');
  includes(doc, 'attestor.consequence-agentic-supply-chain-guard.v1', 'Supply-chain docs: version is named');
  includes(doc, 'src/consequence-admission/agentic-supply-chain-guard.ts', 'Supply-chain docs: source file is named');
  includes(doc, 'OWASP LLM03:2025 Supply Chain', 'Supply-chain docs: OWASP anchor is named');
  includes(doc, 'SLSA provenance', 'Supply-chain docs: SLSA anchor is named');
  includes(doc, 'does not certify third-party code behavior', 'Supply-chain docs: limitation is explicit');
  includes(registry, 'agentic-supply-chain-guard.ts', 'Failure registry: supply-chain guard source evidence is recorded');
  includes(coverage, "coverageKind: 'dedicated-guard'", 'Guard coverage: supply-chain now has dedicated guard coverage');
  includes(activation, "'agentic-supply-chain-guard'", 'Guard activation readiness: supply-chain guard is included');
  equal(
    pkg.scripts['test:agentic-supply-chain-guard'],
    'tsx tests/agentic-supply-chain-guard.test.ts',
    'Package: supply-chain guard test is exposed',
  );
}

try {
  testCriticalThirdPartyMcpWithoutProvenanceBlocks();
  testOverbroadPermissionsBlockEvenWithProvenance();
  testGeneratedAdapterMustBeReviewed();
  testDomainPackBoundaryViolationBlocks();
  testCompleteFirstPartyPackageCanPass();
  testMissingComponentsRequiresReview();
  testDescriptorDocsRegistryAndPackageScriptStayAligned();
  console.log(`Agentic supply-chain guard tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Agentic supply-chain guard tests failed:', error);
  process.exitCode = 1;
}
