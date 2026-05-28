import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS,
  CONSEQUENCE_FAILURE_MODE_IDS,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function notIncludes(value: string, forbidden: string, message: string): void {
  assert.ok(!value.includes(forbidden), `${message}\nForbidden text: ${forbidden}`);
  passed += 1;
}

const reasonDoc = readProjectFile('docs', '05-proof', 'reason-codes.md');
const failureDoc = readProjectFile('docs', '05-proof', 'failure-modes-and-controls.md');
const readme = readProjectFile('README.md');
const pkg = JSON.parse(readProjectFile('package.json')) as {
  readonly scripts: Record<string, string>;
};

const GENERIC_ROUTE_GUARD_REASON_CODES = [
  'untrusted-content-authority-source',
  'authority-block',
  'approval-source-untrusted',
  'approval-block',
  'active-no-go-condition-present',
  'no-go-condition-block',
  'amount-exceeds-approved-scope',
  'recipient-out-of-scope',
  'record-count-exceeds-approved-scope',
  'tool-result-untrusted-source',
  'tool-result-block',
  'supply-chain-critical-component-block',
  'supply-chain-permission-overbroad',
  'raw-payload-stored',
  'auto-enforce-requested',
  'delegation-scope-unapproved',
  'delegation-actor-self-approved',
  'policy-version-mismatch',
  'policy-updated-after-approval',
  'stale-policy-block',
  'current-context-missing',
  'decision-context-block',
  'authority-creep-finding:policy-activation-requested',
  'authority-creep-finding:authority-action-requested',
  'agent-loop-attempt-budget-exhausted',
] as const;

function testReasonDocCoversRouteGuardCodes(): void {
  for (const reasonCode of GENERIC_ROUTE_GUARD_REASON_CODES) {
    includes(
      reasonDoc,
      reasonCode,
      `Public reason-code docs cover runtime-wired generic route reason code ${reasonCode}`,
    );
  }
}

function testFailureDocCoversRegistryAndInvariants(): void {
  for (const failureModeId of CONSEQUENCE_FAILURE_MODE_IDS) {
    includes(
      failureDoc,
      failureModeId,
      `Public failure-mode docs cover registry entry ${failureModeId}`,
    );
  }

  for (const invariantId of CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS) {
    const readableAnchor = invariantId.split('-').slice(0, 2).join('-');
    ok(
      failureDoc.includes(invariantId) || failureDoc.includes(readableAnchor),
      `Public failure-mode docs keep invariant family visible for ${invariantId}`,
    );
  }
}

function testDocsCarrySupportShapeAndNoClaims(): void {
  includes(reasonDoc, 'Five-second triage', 'Reason-code docs start with fast triage');
  includes(reasonDoc, 'RFC 9457', 'Reason-code docs cite RFC 9457 support shape');
  includes(reasonDoc, 'Stripe API errors', 'Reason-code docs cite Stripe support pattern');
  includes(reasonDoc, 'Google AIP-193', 'Reason-code docs cite Google AIP-193 support pattern');
  includes(reasonDoc, 'does not prove live customer PEP no-bypass', 'Reason-code docs keep live PEP no-claim');
  includes(reasonDoc, 'does not certify compliance', 'Reason-code docs keep compliance no-claim');

  includes(failureDoc, 'What went wrong, which control caught it', 'Failure-mode docs state support question');
  includes(failureDoc, 'does not activate enforcement', 'Failure-mode docs keep enforcement no-claim');
  includes(failureDoc, 'Live customer PEP no-bypass', 'Failure-mode docs keep live proof no-claim');
  includes(failureDoc, 'Review is not permission to execute', 'Failure-mode docs prevent review auto-promote');

  notIncludes(reasonDoc, 'enterprise-grade', 'Reason-code docs avoid enterprise marketing language');
  notIncludes(failureDoc, 'enterprise-grade', 'Failure-mode docs avoid enterprise marketing language');
  notIncludes(reasonDoc, 'production-ready', 'Reason-code docs avoid production-ready claim wording');
  notIncludes(failureDoc, 'production-ready', 'Failure-mode docs avoid production-ready claim wording');
}

function testDocsAreDiscoverableAndScripted(): void {
  includes(readme, 'docs/05-proof/reason-codes.md', 'README links public reason-code docs');
  includes(readme, 'docs/05-proof/failure-modes-and-controls.md', 'README links public failure-mode docs');
  assert.equal(
    pkg.scripts['test:public-support-reference-docs'],
    'tsx tests/public-support-reference-docs.test.ts',
    'Package exposes public support reference docs test',
  );
  passed += 1;
}

try {
  testReasonDocCoversRouteGuardCodes();
  testFailureDocCoversRegistryAndInvariants();
  testDocsCarrySupportShapeAndNoClaims();
  testDocsAreDiscoverableAndScripted();
  console.log(`Public support reference docs tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Public support reference docs tests failed:', error);
  process.exitCode = 1;
}
