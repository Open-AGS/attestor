import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS,
  hostedLlmAgentToolBoundaryGuardProfile,
} from '../src/service/hosted-llm-agent-tool-boundary-guard.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function projectPathExists(pathWithAnchor: string): boolean {
  return existsSync(join(process.cwd(), pathWithAnchor.split('#')[0] ?? pathWithAnchor));
}

function testHostedBoundaryIsNotDescriptorOnly(): void {
  const profile = hostedLlmAgentToolBoundaryGuardProfile();
  const hostedBoundaryTest = readProjectFile('tests', 'hosted-llm-agent-tool-boundary-guard.test.ts');

  ok(profile.guards.length >= 5, 'F4 hosted LLM boundary: profile exposes multiple hosted boundary guards');
  includes(
    hostedBoundaryTest,
    'testImplementationEvidenceMatchesSource',
    'F4 hosted LLM boundary: existing test checks implementation evidence against source',
  );
  includes(
    hostedBoundaryTest,
    'testMaterialScannerFindsUnsafeToolAndProviderLeaks',
    'F4 hosted LLM boundary: existing test runs the unsafe material scanner',
  );
  includes(
    hostedBoundaryTest,
    'testEveryGuardIsCompleteAndSecretSafe',
    'F4 hosted LLM boundary: existing test checks every guard descriptor',
  );
}

function testEveryDeclaredEvidenceAndValidationFileExists(): void {
  for (const guard of HOSTED_LLM_AGENT_TOOL_BOUNDARY_GUARDS) {
    ok(guard.implementationEvidence.length > 0, `F4 hosted LLM boundary: ${guard.id} has implementation evidence`);
    ok(guard.validation.length > 0, `F4 hosted LLM boundary: ${guard.id} has validation evidence`);
    ok(
      guard.implementationEvidence.every(projectPathExists),
      `F4 hosted LLM boundary: ${guard.id} implementation evidence files exist`,
    );
    ok(
      guard.validation.every(projectPathExists),
      `F4 hosted LLM boundary: ${guard.id} validation files exist`,
    );
  }
}

function testProfileKeepsProductionBoundaryHonest(): void {
  const profile = hostedLlmAgentToolBoundaryGuardProfile();

  includes(
    profile.unresolvedProductionDependency,
    'live deployment env',
    'F4 hosted LLM boundary: live deployment dependency remains explicit',
  );
  includes(
    profile.unresolvedProductionDependency,
    'hosted product smoke tests',
    'F4 hosted LLM boundary: hosted smoke dependency remains explicit',
  );
}

function testDocsTrackerAndPackageStayAligned(): void {
  const validationDoc = readProjectFile('docs', 'audit', 'f4-hosted-llm-boundary-conformance-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(validationDoc, 'Status: `invalid-as-stated`', 'F4 hosted LLM boundary doc: status is explicit');
  includes(
    validationDoc,
    'test:hosted-llm-agent-tool-boundary-guard',
    'F4 hosted LLM boundary doc: existing conformance test is named',
  );
  includes(
    tracker,
    'F4-LLM01-B hosted LLM agent tool boundary descriptor-only | `invalid-as-stated`',
    'Tracker: F4-LLM01-B is closed as invalid-as-stated',
  );
  equal(
    packageJson.scripts['test:f4-hosted-llm-boundary-conformance-validation'],
    'tsx tests/f4-hosted-llm-boundary-conformance-validation.test.ts',
    'Package: F4 hosted LLM boundary validation script is exposed',
  );
}

try {
  testHostedBoundaryIsNotDescriptorOnly();
  testEveryDeclaredEvidenceAndValidationFileExists();
  testProfileKeepsProductionBoundaryHonest();
  testDocsTrackerAndPackageStayAligned();
  console.log(`F4 hosted LLM boundary conformance validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F4 hosted LLM boundary conformance validation tests failed:', error);
  process.exitCode = 1;
}
