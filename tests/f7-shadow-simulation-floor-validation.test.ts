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
  const validation = readProjectFile('docs', 'audit', 'f7-shadow-simulation-floor-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const simulation = readProjectFile('src', 'consequence-admission', 'shadow-simulation.ts');
  const simulationTests = readProjectFile('tests', 'shadow-policy-simulation.test.ts');
  const packageJson = readProjectFile('package.json');

  includes(validation, '# F7 Shadow Simulation Policy Floor Validation', 'F7 simulation floor validation: title exists');
  includes(validation, 'repository slice for F7-S3', 'F7 simulation floor validation: scope is explicit');
  includes(validation, '| F7-S3 simulation window / threshold manipulation | `partial` | `fixed` |', 'F7 simulation floor validation: S3 transition is recorded');
  includes(validation, 'four planned', 'F7 simulation floor validation: remaining queue count is explicit');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 6 | 4 | 0 |', 'Tracker: F7 count is updated after high-risk activation slice');
  includes(tracker, 'Remaining F7 queue after high-risk two-person activation: 2 planned', 'Tracker: F7 remaining count is updated');
  includes(tracker, 'F7-S3 simulation window / threshold manipulation | `fixed`', 'Tracker: F7-S3 is fixed');
  includes(tracker, 'F7 Shadow Simulation Policy Floor Validation', 'Tracker: F7 simulation floor validation evidence is linked');

  includes(simulation, 'SHADOW_POLICY_SIMULATION_MINIMUM_PROMOTION_EVENTS_FLOOR', 'Source: simulation floor constant exists');
  includes(simulation, 'requestedMinimumPromotionEvents', 'Source: requested threshold is preserved');
  includes(simulation, 'minimumPromotionEventsSource', 'Source: threshold source is reported');
  includes(simulation, 'caller-request-raised-to-floor', 'Source: low caller threshold is raised');
  includes(simulation, 'minimumPromotionEvents must be a positive integer', 'Source: invalid threshold fails closed');

  includes(simulationTests, 'one clean event cannot bypass the promotion floor', 'Tests: floor bypass is blocked');
  includes(simulationTests, 'caller threshold below floor is raised', 'Tests: caller threshold is raised');

  includes(packageJson, '"test:f7-shadow-simulation-floor-validation"', 'Package: F7 simulation floor validation script is exposed');

  ok(validation.split('\n').length > 35, 'F7 simulation floor validation: document has enough detail');

  console.log(`F7 shadow simulation floor validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 shadow simulation floor validation tests failed:', error);
  process.exitCode = 1;
}
