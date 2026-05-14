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
  const validation = readProjectFile('docs', 'audit', 'f7-shadow-readiness-claim-alignment-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const moduleSource = readProjectFile('src', 'consequence-admission', 'shadow-readiness-claim-alignment.ts');
  const indexSource = readProjectFile('src', 'consequence-admission', 'index.ts');
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');

  includes(validation, '# F7 Shadow Readiness Claim Alignment Validation', 'F7 readiness validation: title exists');
  includes(validation, 'repository slice for F7-S10', 'F7 readiness validation: scope is explicit');
  includes(validation, '| F7-S10 production-ready descriptor enforcement | `partial` | `fixed` |', 'F7 readiness validation: S10 transition is recorded');
  includes(validation, 'zero planned', 'F7 readiness validation: remaining queue count is explicit');
  includes(validation, '`productionReady: false`', 'F7 readiness validation: production overclaim boundary exists');
  includes(validation, '`production-shared-shadow-blocked`', 'F7 readiness validation: production-shared blocker is named');

  includes(moduleSource, 'CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION', 'Repo evidence: version constant exists');
  includes(moduleSource, 'shadow-production-storage-path', 'Repo evidence: storage stage is covered');
  includes(moduleSource, 'selected-profile-storage-ready', 'Repo evidence: selected profile storage criterion exists');
  includes(moduleSource, 'productionReady: false', 'Repo evidence: production readiness is not overclaimed');
  includes(moduleSource, 'readinessOnly: true', 'Repo evidence: readiness-only output is explicit');
  includes(moduleSource, 'rawPayloadStored: false', 'Repo evidence: raw payload storage is false');

  includes(indexSource, 'shadowReadinessClaimAlignmentVersion', 'Repo evidence: descriptor exposes shadow readiness version');
  includes(indexSource, 'consequenceShadowReadinessClaimAlignmentDescriptor', 'Repo evidence: descriptor embeds shadow readiness surface');

  includes(coreRoutes, 'evaluateConsequenceShadowReadinessClaimAlignment', 'Repo evidence: core readiness evaluates shadow readiness');
  includes(coreRoutes, 'checks.shadowReadinessClaimAlignment', 'Repo evidence: /ready exposes shadow readiness check');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 8 | 2 | 0 |', 'Tracker: F7 final count row is present');
  includes(tracker, 'Remaining F7 queue after shadow readiness and claim alignment: 0 planned', 'Tracker: F7 final remaining count is explicit');
  includes(tracker, 'F7-S10 production-ready descriptor enforcement | `fixed`', 'Tracker: F7-S10 is fixed');
  includes(tracker, 'F7 Shadow Readiness Claim Alignment Validation', 'Tracker: F7 readiness validation evidence is linked');
  includes(tracker, 'F7 is closed for planned repository slices', 'Tracker: F7 closure is explicit');

  includes(packageJson, '"test:shadow-readiness-claim-alignment"', 'Package: shadow readiness module test script is exposed');
  includes(packageJson, '"test:f7-shadow-readiness-claim-alignment-validation"', 'Package: F7 readiness validation script is exposed');

  ok(validation.split('\n').length > 60, 'F7 readiness validation: document has enough detail');

  console.log(`F7 shadow readiness claim alignment validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 shadow readiness claim alignment validation tests failed:', error);
  process.exitCode = 1;
}
