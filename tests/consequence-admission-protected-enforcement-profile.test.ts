import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
  consequenceAdmissionProtectedEnforcementProfileDescriptor,
  resolveConsequenceAdmissionProtectedEnforcementProfile,
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

function notIncludes<T>(items: readonly T[], unexpected: T, message: string): void {
  assert.ok(!items.includes(unexpected), message);
  passed += 1;
}

function testDescriptorIsTruthful(): void {
  const descriptor = consequenceAdmissionProtectedEnforcementProfileDescriptor();

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_PROTECTED_ENFORCEMENT_PROFILE_VERSION,
    'Protected enforcement profile: descriptor exposes stable version',
  );
  equal(
    descriptor.highRiskRequiresReleaseEnforcementPlane,
    true,
    'Protected enforcement profile: high risk requires release enforcement plane',
  );
  equal(
    descriptor.bearerOnlyForbiddenForProtectedExecution,
    true,
    'Protected enforcement profile: bearer-only protected execution is forbidden',
  );
  equal(
    descriptor.cryptographicTokenVerification,
    false,
    'Protected enforcement profile: descriptor does not overclaim token verification',
  );
  equal(
    descriptor.activatesEnforcement,
    false,
    'Protected enforcement profile: descriptor does not claim runtime activation',
  );
}

function testR3RequiresReleaseEnforcementPlane(): void {
  const profile = resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R3',
    boundaryKind: 'payment-adapter',
    consequenceDomain: 'money-movement',
    consequenceKind: 'agent-payment',
  });

  equal(
    profile.minimumPath,
    'release-enforcement-plane',
    'Protected enforcement profile: R3 needs the release enforcement plane',
  );
  equal(profile.productionSensitive, true, 'Protected enforcement profile: R3 is production-sensitive by default');
  equal(profile.senderConstraintRequired, true, 'Protected enforcement profile: R3 requires sender constraint');
  equal(profile.onlineIntrospectionRequired, true, 'Protected enforcement profile: R3 requires online introspection');
  equal(profile.replayConsumeRequired, true, 'Protected enforcement profile: R3 requires replay consume');
  equal(profile.bearerOnlyAllowed, false, 'Protected enforcement profile: R3 forbids bearer-only execution');
  notIncludes(
    profile.allowedPresentationModes,
    'bearer-release-token',
    'Protected enforcement profile: R3 protected modes exclude bearer-only presentation',
  );
  ok(
    profile.reasonCodes.includes('protected-enforcement-high-risk-release-enforcement-plane-required'),
    'Protected enforcement profile: R3 reason names high-risk release enforcement requirement',
  );
}

function testR4RequiresReleaseEnforcementPlane(): void {
  const profile = resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R4',
    boundaryKind: 'action-dispatcher',
    consequenceDomain: 'operations',
    consequenceKind: 'action',
  });

  equal(
    profile.minimumPath,
    'release-enforcement-plane',
    'Protected enforcement profile: R4 needs the release enforcement plane',
  );
  ok(
    profile.reasonCodes.includes('protected-enforcement-sender-constraint-required'),
    'Protected enforcement profile: R4 reason names sender constraint',
  );
  ok(
    profile.reasonCodes.includes('protected-enforcement-bearer-only-forbidden'),
    'Protected enforcement profile: R4 reason names bearer-only ban',
  );
}

function testProductionSensitiveLowerRiskEscalates(): void {
  const profile = resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R1',
    boundaryKind: 'record-writer',
    consequenceDomain: 'data-access',
    consequenceKind: 'record',
    productionSensitive: true,
  });

  equal(
    profile.minimumPath,
    'release-enforcement-plane',
    'Protected enforcement profile: production-sensitive lower risk escalates to release enforcement plane',
  );
  equal(profile.bearerOnlyAllowed, false, 'Protected enforcement profile: production-sensitive path forbids bearer-only');
  ok(
    profile.reasonCodes.includes(
      'protected-enforcement-production-sensitive-release-enforcement-plane-required',
    ),
    'Protected enforcement profile: production-sensitive reason code is present',
  );
}

function testR2RequiresDownstreamContract(): void {
  const profile = resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R2',
    boundaryKind: 'communication-sender',
    consequenceDomain: 'external-communication',
    consequenceKind: 'communication',
    productionSensitive: false,
  });

  equal(
    profile.minimumPath,
    'downstream-contract',
    'Protected enforcement profile: R2 needs downstream contract at minimum',
  );
  equal(profile.onlineIntrospectionRequired, true, 'Protected enforcement profile: R2 requires online introspection');
  equal(profile.replayConsumeRequired, true, 'Protected enforcement profile: R2 requires replay consume');
  equal(profile.senderConstraintRequired, false, 'Protected enforcement profile: R2 does not require sender constraint');
  equal(profile.bearerOnlyAllowed, false, 'Protected enforcement profile: R2 still forbids bearer-only as complete enforcement');
}

function testLowRiskCustomerGateCompatibilityIsExplicit(): void {
  const profile = resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R1',
    boundaryKind: 'http-handler',
    consequenceDomain: 'decision-support',
    consequenceKind: 'decision-support',
    productionSensitive: false,
  });

  equal(
    profile.minimumPath,
    'customer-gate',
    'Protected enforcement profile: R1 non-sensitive path may use customer gate',
  );
  equal(profile.bearerOnlyAllowed, true, 'Protected enforcement profile: R1 non-sensitive path allows bearer compatibility');
  ok(
    profile.reasonCodes.includes('protected-enforcement-low-risk-customer-gate-compatible'),
    'Protected enforcement profile: low-risk reason code is present',
  );
}

function testDocsAndPackageExposeProfile(): void {
  const customerGateDoc = readProjectFile('docs', '01-overview', 'customer-admission-gate.md');
  const validationDoc = readProjectFile(
    'docs',
    'audit',
    'f2-customer-gate-enforcement-validation.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  includes(
    customerGateDoc,
    'Protected customer enforcement profile',
    'Protected enforcement profile: customer gate doc names protected profile',
  );
  includes(
    customerGateDoc,
    '`attestor/release-enforcement-plane`',
    'Protected enforcement profile: customer gate doc points to release enforcement plane',
  );
  includes(
    validationDoc,
    'R3/R4',
    'Protected enforcement profile: audit validation names high-risk closure',
  );
  equal(
    packageJson.scripts['test:consequence-admission-protected-enforcement-profile'],
    'tsx tests/consequence-admission-protected-enforcement-profile.test.ts',
    'Protected enforcement profile: focused test script is exposed',
  );
}

testDescriptorIsTruthful();
testR3RequiresReleaseEnforcementPlane();
testR4RequiresReleaseEnforcementPlane();
testProductionSensitiveLowerRiskEscalates();
testR2RequiresDownstreamContract();
testLowRiskCustomerGateCompatibilityIsExplicit();
testDocsAndPackageExposeProfile();

console.log(`Consequence admission protected enforcement profile tests: ${passed} passed, 0 failed`);
