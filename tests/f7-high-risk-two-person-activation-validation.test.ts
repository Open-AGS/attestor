import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const validation = readProjectFile('docs', 'audit', 'f7-high-risk-two-person-activation-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const handoff = readProjectFile(
    'src',
    'consequence-admission',
    'shadow-customer-activation-handoff.ts',
  );
  const routes = readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts');
  const handoffTests = readProjectFile('tests', 'shadow-customer-activation-handoff.test.ts');
  const packageJson = readProjectFile('package.json');

  includes(validation, '# F7 High-Risk Two-Person Activation Validation', 'F7 high-risk validation: title exists');
  includes(validation, 'repository slice for F7-S8', 'F7 high-risk validation: scope is explicit');
  includes(validation, '| F7-S8 single-operator shadow activation | `open` | `fixed` |', 'F7 high-risk validation: S8 transition is recorded');
  includes(validation, 'two planned', 'F7 high-risk validation: remaining queue count is explicit');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 8 | 2 | 0 |', 'Tracker: F7 count is updated after signing-boundary slice');
  includes(tracker, 'Remaining F7 queue after shadow readiness and claim alignment: 0 planned', 'Tracker: F7 remaining count is updated');
  includes(tracker, 'F7-S8 single-operator shadow activation | `fixed`', 'Tracker: F7-S8 is fixed');
  includes(tracker, 'F7 High-Risk Two-Person Activation Validation', 'Tracker: F7 high-risk validation evidence is linked');

  includes(handoff, 'SHADOW_CUSTOMER_ACTIVATION_HIGH_RISK_BOUNDARY_KINDS', 'Source: high-risk boundary set exists');
  includes(handoff, "'payment-adapter'", 'Source: payment adapter is high risk');
  includes(handoff, "'wallet-adapter'", 'Source: wallet adapter is high risk');
  includes(handoff, 'activationBoundaryKind', 'Source: activation boundary kind is carried');
  includes(handoff, 'twoPersonApprovalRequired', 'Source: two-person approval requirement is carried');
  includes(handoff, 'twoPersonApprovalReady', 'Source: two-person approval readiness is carried');
  includes(handoff, 'high-risk-secondary-approver-required', 'Source: missing high-risk approver blocks handoff');
  includes(handoff, 'high-risk-secondary-approver-must-differ', 'Source: same high-risk approver blocks handoff');

  includes(routes, 'activationBoundaryKind: body.integration.boundaryKind', 'Routes: integration boundary kind is passed into handoff');

  includes(handoffTests, 'high-risk activation without secondary approver blocks handoff', 'Tests: missing high-risk secondary approver is blocked');
  includes(handoffTests, 'high-risk activation with same approver blocks handoff', 'Tests: same high-risk approver is blocked');
  includes(handoffTests, 'high-risk activation can become ready with a second approver', 'Tests: high-risk activation can become ready with second approver');

  includes(packageJson, '"test:f7-high-risk-two-person-activation-validation"', 'Package: F7 high-risk validation script is exposed');

  ok(validation.split('\n').length > 30, 'F7 high-risk validation: document has enough detail');

  console.log(`F7 high-risk two-person activation validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 high-risk two-person activation validation tests failed:', error);
  process.exitCode = 1;
}
