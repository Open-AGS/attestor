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
  const validation = readProjectFile('docs', 'audit', 'f7-break-glass-hardening-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const handoff = readProjectFile(
    'src',
    'consequence-admission',
    'shadow-customer-activation-handoff.ts',
  );
  const routes = readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts');
  const handoffTests = readProjectFile('tests', 'shadow-customer-activation-handoff.test.ts');
  const packageJson = readProjectFile('package.json');

  includes(validation, '# F7 Break-Glass Hardening Validation', 'F7 break-glass validation: title exists');
  includes(validation, 'repository slice for F7-S4', 'F7 break-glass validation: scope is explicit');
  includes(validation, '| F7-S4 break-glass rollout has no extra gate | `open` | `fixed` |', 'F7 break-glass validation: S4 transition is recorded');
  includes(validation, 'three planned', 'F7 break-glass validation: remaining queue count is explicit');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 5 | 4 | 1 |', 'Tracker: F7 count is updated after break-glass hardening');
  includes(tracker, 'Remaining F7 queue after break-glass hardening: 3 planned', 'Tracker: F7 remaining count is updated');
  includes(tracker, 'F7-S4 break-glass rollout has no extra gate | `fixed`', 'Tracker: F7-S4 is fixed');
  includes(tracker, 'F7 Break-Glass Hardening Validation', 'Tracker: F7 break-glass validation evidence is linked');

  includes(handoff, 'SHADOW_CUSTOMER_ACTIVATION_BREAK_GLASS_MAX_WINDOW_MS', 'Source: break-glass max window constant exists');
  includes(handoff, 'secondaryApproverRef', 'Source: secondary approver is modeled');
  includes(handoff, 'breakGlassJustificationRef', 'Source: break-glass justification is modeled');
  includes(handoff, 'breakGlassReconciliationRef', 'Source: break-glass reconciliation is modeled');
  includes(handoff, 'breakGlassControlsReady', 'Source: break-glass readiness is modeled');
  includes(handoff, 'break-glass-secondary-approver-required', 'Source: missing secondary approver blocks break-glass');
  includes(handoff, 'break-glass-secondary-approver-must-differ', 'Source: same-actor approval blocks break-glass');
  includes(handoff, 'break-glass-expiry-required', 'Source: missing expiry blocks break-glass');
  includes(handoff, 'break-glass-window-too-long', 'Source: long break-glass window blocks activation');
  includes(handoff, 'break-glass-justification-required', 'Source: missing justification blocks break-glass');
  includes(handoff, 'break-glass-reconciliation-required', 'Source: missing reconciliation blocks break-glass');

  includes(routes, 'secondaryApproverRef', 'Routes: secondary approver is accepted');
  includes(routes, 'breakGlassJustificationRef', 'Routes: justification ref is accepted');
  includes(routes, 'breakGlassReconciliationRef', 'Routes: reconciliation ref is accepted');

  includes(handoffTests, 'incomplete break-glass blocks handoff', 'Tests: incomplete break-glass is blocked');
  includes(handoffTests, 'break-glass secondary approver must differ', 'Tests: same approver is rejected');
  includes(handoffTests, 'complete break-glass can become ready', 'Tests: complete break-glass can be ready');

  includes(packageJson, '"test:f7-break-glass-hardening-validation"', 'Package: F7 break-glass validation script is exposed');

  ok(validation.split('\n').length > 30, 'F7 break-glass validation: document has enough detail');

  console.log(`F7 break-glass hardening validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 break-glass hardening validation tests failed:', error);
  process.exitCode = 1;
}
