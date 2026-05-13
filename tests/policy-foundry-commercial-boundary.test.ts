import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryCommercialBoundary,
  policyFoundryCommercialBoundaryDescriptor,
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

function testDeveloperKeepsSafetyMinimumsButBlocksProduction(): void {
  const boundary = createPolicyFoundryCommercialBoundary({
    generatedAt: '2026-05-13T12:00:00.000Z',
    plan: 'developer',
    requestedProductionWorkflowCount: 1,
    requestedCapabilities: [
      'basic-shadow-summary',
      'candidate-red-team-replay',
    ],
  });
  const serialized = JSON.stringify(boundary);

  equal(boundary.version, 'attestor.policy-foundry-commercial-boundary.v1', 'Commercial boundary: version is explicit');
  equal(boundary.plan, 'developer', 'Commercial boundary: developer plan is selected');
  equal(boundary.paidPlan, false, 'Commercial boundary: developer is not paid');
  equal(boundary.hostedProductionAllowed, false, 'Commercial boundary: developer has no hosted production entitlement');
  equal(boundary.productionWorkflowRequestAllowed, false, 'Commercial boundary: developer production request is blocked');
  ok(boundary.noGoReasons.includes('production-enforcement-not-in-plan'), 'Commercial boundary: developer production no-go is explicit');
  ok(boundary.noGoReasons.includes('requested-capability-not-in-plan'), 'Commercial boundary: unavailable advanced capability is explicit');
  ok(boundary.safetyMinimums.includes('redaction'), 'Commercial boundary: redaction remains in the safety floor');
  ok(boundary.safetyMinimums.includes('fail-closed-semantics'), 'Commercial boundary: fail-closed remains in the safety floor');
  equal(boundary.safetyMinimumsPaidOnlyAllowed, false, 'Commercial boundary: safety floor cannot be paid-only');
  equal(boundary.billingStateRequiredForSafetyMinimums, false, 'Commercial boundary: billing state is not required for safety minimums');
  equal(boundary.productionReady, false, 'Commercial boundary: production readiness is not claimed');
  excludes(serialized, /sk_live|rk_live|whsec|secret=/iu, 'Commercial boundary: serialized output excludes secret markers');
}

function testStarterAllowsOnlyOneCommercialWorkflowWithoutClaimingReadiness(): void {
  const boundary = createPolicyFoundryCommercialBoundary({
    generatedAt: '2026-05-13T12:05:00.000Z',
    plan: 'starter',
    requestedHostedProduction: true,
    requestedProductionWorkflowCount: 1,
    requestedCapabilities: [
      'policy-twin-preview',
      'active-questions',
      'review-enforce-ladder',
    ],
  });

  equal(boundary.plan, 'starter', 'Commercial boundary: starter plan is selected');
  equal(boundary.paidPlan, true, 'Commercial boundary: starter is paid');
  equal(boundary.hostedProductionAllowed, true, 'Commercial boundary: starter has hosted production commercial entitlement');
  equal(boundary.productionWorkflowRequestAllowed, true, 'Commercial boundary: one starter workflow is commercially allowed');
  equal(boundary.noGoReasons.length, 0, 'Commercial boundary: starter request has no commercial no-go');
  equal(boundary.approvalRequired, true, 'Commercial boundary: approval remains required');
  equal(boundary.autoEnforce, false, 'Commercial boundary: auto enforcement remains false');
  equal(boundary.activatesEnforcement, false, 'Commercial boundary: commercial boundary does not activate enforcement');
  equal(boundary.productionReady, false, 'Commercial boundary: commercial entitlement is not production readiness');
}

function testEnterpriseAllowsCustomerOperatedCapabilityAsBoundaryOnly(): void {
  const boundary = createPolicyFoundryCommercialBoundary({
    generatedAt: '2026-05-13T12:10:00.000Z',
    plan: 'enterprise',
    requestedCustomerOperatedDeployment: true,
    requestedCapabilities: [
      'customer-operated-deployment',
      'regulated-deployment-boundary',
      'custom-pack-boundary',
      'drift-policy-debt-detection',
    ],
  });

  equal(boundary.plan, 'enterprise', 'Commercial boundary: enterprise plan is selected');
  equal(boundary.customerOperatedAllowed, true, 'Commercial boundary: enterprise supports customer-operated deployment commercially');
  equal(boundary.noGoReasons.length, 0, 'Commercial boundary: enterprise customer-operated request has no commercial no-go');
  equal(boundary.commercialBoundaryOnly, true, 'Commercial boundary: output is commercial context only');
  equal(boundary.deploymentEntitlementEnforcementImplemented, false, 'Commercial boundary: hosted entitlement enforcement is not claimed implemented');
  equal(boundary.entitlementDecisionAuthority, false, 'Commercial boundary: entitlement is not the policy decision authority');
  ok(boundary.digest.startsWith('sha256:'), 'Commercial boundary: digest is generated');
}

function testSafetyMinimumCannotBePaywalledEvenOnEnterprise(): void {
  const boundary = createPolicyFoundryCommercialBoundary({
    generatedAt: '2026-05-13T12:15:00.000Z',
    plan: 'enterprise',
    blockedSafetyMinimums: [
      'redaction',
      'proof-verification',
      'private-enterprise-only-control',
    ],
  });

  equal(boundary.safetyFloorViolationCount, 2, 'Commercial boundary: known paid-only safety minimums are counted');
  ok(boundary.noGoReasons.includes('safety-minimum-paywalled'), 'Commercial boundary: paywalled safety minimum is a no-go');
  equal(boundary.safetyMinimumsPaidOnlyAllowed, false, 'Commercial boundary: safety minimum paywalling is forbidden');
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = policyFoundryCommercialBoundaryDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const dataMinDoc = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const packaging = readProjectFile('docs', '01-overview', 'product-packaging.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-commercial-boundary.v1', 'Commercial boundary descriptor: version is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-commercial-boundary', 'Commercial boundary descriptor: data minimization surface is explicit');
  equal(descriptor.safetyMinimumsPaidOnlyAllowed, false, 'Commercial boundary descriptor: safety floor cannot be paid-only');
  equal(descriptor.billingStateRequiredForSafetyMinimums, false, 'Commercial boundary descriptor: safety floor does not depend on billing state');
  equal(descriptor.deploymentEntitlementEnforcementImplemented, false, 'Commercial boundary descriptor: entitlement enforcement is not overclaimed');
  ok(descriptor.plans.includes('enterprise'), 'Commercial boundary descriptor: enterprise plan is named');
  ok(descriptor.capabilities.includes('drift-policy-debt-detection'), 'Commercial boundary descriptor: drift capability is named');
  ok(descriptor.safetyMinimums.includes('offline-verifier-access'), 'Commercial boundary descriptor: offline verifier access remains safety floor');
  includes(doc, 'src/consequence-admission/policy-foundry-commercial-boundary.ts', 'Policy Foundry docs: commercial boundary contract is named');
  includes(doc, 'test:policy-foundry-commercial-boundary', 'Policy Foundry docs: commercial boundary test command is named');
  includes(dataMinDoc, 'policy-foundry-commercial-boundary', 'Data minimization docs: commercial boundary surface is named');
  includes(tracker, 'complete | Add Commercial Boundary Contract', 'Deepening tracker: Step 12 is complete');
  includes(tracker, 'Step 01 through Step 12 are complete', 'Deepening tracker: list completion is explicit');
  includes(packaging, 'repo-side commercial boundary contract is implemented', 'Product packaging: repo-side commercial boundary is stated');
  includes(packaging, 'hosted entitlement enforcement remains a deployment/product integration task', 'Product packaging: hosted entitlement implementation limitation is explicit');
  equal(
    pkg.scripts['test:policy-foundry-commercial-boundary'],
    'tsx tests/policy-foundry-commercial-boundary.test.ts',
    'Package: commercial boundary test is exposed',
  );
}

try {
  testDeveloperKeepsSafetyMinimumsButBlocksProduction();
  testStarterAllowsOnlyOneCommercialWorkflowWithoutClaimingReadiness();
  testEnterpriseAllowsCustomerOperatedCapabilityAsBoundaryOnly();
  testSafetyMinimumCannotBePaywalledEvenOnEnterprise();
  testDescriptorDocsAndPackageSurfaceStayAligned();
  ok(passed > 0, 'Policy Foundry commercial boundary tests executed');
  console.log(`Policy Foundry commercial boundary tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry commercial boundary tests failed:', error);
  process.exitCode = 1;
}
