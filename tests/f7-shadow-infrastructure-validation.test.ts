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
  const validation = readProjectFile('docs', 'audit', 'f7-shadow-infrastructure-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');
  const shadowEvents = readProjectFile('src', 'consequence-admission', 'shadow-events.ts');
  const shadowSimulation = readProjectFile('src', 'consequence-admission', 'shadow-simulation.ts');
  const shadowRoutes = readProjectFile('src', 'service', 'http', 'routes', 'shadow-routes.ts');
  const activationHandoff = readProjectFile(
    'src',
    'consequence-admission',
    'shadow-customer-activation-handoff.ts',
  );
  const productionStoragePath = readProjectFile('src', 'service', 'bootstrap', 'production-storage-path.ts');

  includes(validation, '# F7 Shadow Infrastructure Red-Team Validation', 'F7 validation: title exists');
  includes(validation, 'Baseline: `origin/master`', 'F7 validation: origin/master baseline is explicit');
  includes(validation, 'not live production evidence', 'F7 validation: production-evidence boundary is explicit');

  for (const id of ['F7-S1', 'F7-S2', 'F7-S3', 'F7-S4', 'F7-S5', 'F7-S6', 'F7-S7', 'F7-S8', 'F7-S9', 'F7-S10']) {
    includes(validation, id, `F7 validation: ${id} is tracked`);
    includes(tracker, id, `Tracker: ${id} is tracked`);
  }

  includes(validation, 'F7-S5 | `customerControlsReady` can flip true with missing required controls', 'F7 validation: S5 claim is described');
  includes(validation, '`invalid-as-stated`', 'F7 validation: invalid-as-stated status is used');
  includes(validation, '`accepted-limitation`', 'F7 validation: accepted limitation status is used');
  includes(validation, 'six planned repository units', 'F7 validation: remaining unit count is explicit');
  includes(validation, 'Shadow event origin and redaction witness', 'F7 validation: next remediation unit is named');
  includes(validation, 'Two-person high-risk activation handoff', 'F7 validation: two-person unit is named');
  includes(validation, 'OWASP API Security Top 10 2023', 'F7 validation: external source anchor is present');
  includes(validation, 'NIST SP 800-53 Rev. 5', 'F7 validation: NIST source anchor is present');

  includes(tracker, '| F7 shadow infrastructure red-team | 10 | 6 | 4 | 0 |', 'Tracker: F7 current count row is present');
  includes(tracker, 'Remaining F7 queue after high-risk two-person activation: 2 planned', 'Tracker: remaining F7 count is explicit');
  includes(tracker, 'F6 is closed for planned repository slices', 'Tracker: F6 closed statement is present');
  includes(tracker, 'F7 is now the active queue', 'Tracker: F7 active queue statement is present');
  includes(tracker, 'F7 validation and tracker sync. Done.', 'Tracker: F7 first queue item is marked done');
  includes(tracker, 'F7-S1/F7-S2 shadow event origin and redaction witness. Done in this slice.', 'Tracker: F7 second queue item is marked done');
  includes(tracker, 'F7-S3 server-owned simulation policy floor. Done in this slice.', 'Tracker: F7 third queue item is marked done');
  includes(tracker, 'F7-S4 break-glass rollout has no extra gate | `fixed`', 'Tracker: F7 break-glass finding is fixed');
  includes(tracker, 'F7-S8 single-operator shadow activation | `fixed`', 'Tracker: F7 single-operator finding is fixed');
  includes(tracker, 'F7-S5 customer controls readiness aggregation | `invalid-as-stated`', 'Tracker: F7 S5 is invalid as stated');
  includes(tracker, 'F7-S6 shadow persistence per-node single-host | `accepted-limitation`', 'Tracker: F7 S6 is accepted as limitation');
  includes(tracker, 'F7 Shadow Event Origin And Redaction Witness Validation', 'Tracker: F7 origin/redaction witness evidence is linked');
  includes(tracker, 'F7 Break-Glass Hardening Validation', 'Tracker: F7 break-glass validation evidence is linked');
  includes(tracker, 'F7 High-Risk Two-Person Activation Validation', 'Tracker: F7 high-risk activation validation evidence is linked');

  includes(packageJson, '"test:f7-shadow-infrastructure-validation"', 'Package: F7 validation test script is exposed');
  includes(packageJson, '"test:f7-shadow-origin-redaction-witness-validation"', 'Package: F7 witness validation test script is exposed');
  includes(packageJson, '"test:f7-shadow-simulation-floor-validation"', 'Package: F7 simulation floor validation test script is exposed');
  includes(packageJson, '"test:f7-break-glass-hardening-validation"', 'Package: F7 break-glass validation test script is exposed');
  includes(packageJson, '"test:f7-high-risk-two-person-activation-validation"', 'Package: F7 high-risk activation validation test script is exposed');

  includes(shadowEvents, 'SHADOW_ADMISSION_REDACTION_LEVELS', 'Repo evidence: shadow redaction levels exist');
  includes(shadowEvents, "'operator-supplied'", 'Repo evidence: operator-supplied redaction level exists');
  includes(shadowEvents, 'observedFeatureDigest', 'Repo evidence: shadow events digest observed features');
  includes(shadowEvents, 'originWitnessDigest', 'Repo evidence: shadow events bind origin witness digest');
  includes(shadowEvents, 'redactionWitnessDigest', 'Repo evidence: shadow events bind redaction witness digest');
  includes(shadowEvents, 'rawPayloadStored: false', 'Repo evidence: shadow events declare no raw payload storage');

  includes(shadowSimulation, 'minimumPromotionEvents', 'Repo evidence: simulation threshold exists');
  includes(shadowRoutes, 'deps.listShadowEvents({ tenant })', 'Repo evidence: simulation route uses persisted tenant events');
  includes(shadowRoutes, 'minimumPromotionEvents must be a positive integer no larger than 10000', 'Repo evidence: threshold input is bounded');

  includes(activationHandoff, "'break-glass'", 'Repo evidence: break-glass strategy exists');
  includes(activationHandoff, 'operatorRef', 'Repo evidence: activation handoff has operatorRef');
  includes(activationHandoff, 'customerControlsReady = controlRefs.every((control) => control.present)', 'Repo evidence: customer control readiness is strict');

  includes(productionStoragePath, 'shadow-admission-events', 'Repo evidence: shadow admission storage path is inventoried');
  includes(productionStoragePath, 'shared-durable', 'Repo evidence: shared durable storage mode exists');
  includes(productionStoragePath, 'production-shared-blocked', 'Repo evidence: production-shared blocks when storage is not ready');
  includes(productionStoragePath, 'readyForSelectedProfile', 'Repo evidence: selected profile readiness is explicit');

  ok(validation.split('\n').length > 70, 'F7 validation: document has enough detail');

  console.log(`F7 shadow infrastructure validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F7 shadow infrastructure validation tests failed:', error);
  process.exitCode = 1;
}
