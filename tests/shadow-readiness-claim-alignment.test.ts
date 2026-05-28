import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionDescriptor,
  consequenceShadowReadinessClaimAlignmentDescriptor,
  evaluateConsequenceShadowReadinessClaimAlignment,
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

function excludes(value: string, pattern: RegExp, message: string): void {
  assert.doesNotMatch(value, pattern, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function testDescriptorCoversShadowPipeline(): void {
  const descriptor = consequenceShadowReadinessClaimAlignmentDescriptor();

  equal(
    descriptor.version,
    'attestor.shadow-readiness-claim-alignment.v1',
    'Shadow readiness: version is stable',
  );
  equal(descriptor.purpose, 'shadow-readiness-claim-alignment', 'Shadow readiness: purpose is explicit');
  equal(descriptor.approvalRequired, true, 'Shadow readiness: approval remains required');
  equal(descriptor.autoEnforce, false, 'Shadow readiness: auto-enforce is false');
  equal(descriptor.productionReady, false, 'Shadow readiness: production readiness is not claimed');
  equal(descriptor.activatesEnforcement, false, 'Shadow readiness: descriptor does not activate enforcement');
  equal(descriptor.rawPayloadStored, false, 'Shadow readiness: raw payload storage is false');
  equal(descriptor.readinessOnly, true, 'Shadow readiness: descriptor is readiness-only');
  ok(descriptor.stageIds.includes('shadow-admission-events'), 'Shadow readiness: event stage is covered');
  ok(descriptor.stageIds.includes('shadow-policy-simulation'), 'Shadow readiness: simulation stage is covered');
  ok(descriptor.stageIds.includes('shadow-policy-bundle-publication'), 'Shadow readiness: bundle stage is covered');
  ok(descriptor.stageIds.includes('shadow-customer-activation-handoff'), 'Shadow readiness: handoff stage is covered');
  ok(descriptor.stageIds.includes('shadow-production-storage-path'), 'Shadow readiness: storage stage is covered');
  ok(descriptor.criterionIds.includes('selected-profile-storage-ready'), 'Shadow readiness: storage criterion exists');
  ok(descriptor.criterionIds.includes('production-signing-boundary-split'), 'Shadow readiness: signing boundary criterion exists');
  equal(descriptor.stageProfiles.length, descriptor.stageIds.length, 'Shadow readiness: every stage has a profile');
}

function testEvaluationModeAcceptedWithoutProductionClaim(): void {
  const readiness = evaluateConsequenceShadowReadinessClaimAlignment({
    generatedAt: '2026-05-14T08:00:00.000Z',
    runtimeProfileId: 'evaluation',
  });

  equal(readiness.state, 'evaluation-shadow-accepted', 'Shadow readiness: evaluation profile is accepted');
  equal(readiness.claimAlignmentReady, true, 'Shadow readiness: evaluation claim alignment is ready');
  equal(readiness.readyForSelectedProfile, true, 'Shadow readiness: selected evaluation profile is ready');
  equal(readiness.productionReady, false, 'Shadow readiness: production readiness remains false');
  equal(readiness.autoEnforce, false, 'Shadow readiness: evaluation does not auto-enforce');
  equal(readiness.activatesEnforcement, false, 'Shadow readiness: evaluation does not activate enforcement');
  equal(readiness.rawPayloadStored, false, 'Shadow readiness: output is data-minimized');
  equal(readiness.blockerCount, 0, 'Shadow readiness: evaluation has no blockers');
  ok(readiness.digest.startsWith('sha256:'), 'Shadow readiness: digest is emitted');
}

function testProductionSharedBlocksWhenStorageIsNotReady(): void {
  const readiness = evaluateConsequenceShadowReadinessClaimAlignment({
    generatedAt: '2026-05-14T08:05:00.000Z',
    runtimeProfileId: 'production-shared',
    productionStoragePath: {
      version: 'attestor.production-storage-path.v1',
      state: 'production-shared-blocked',
      readyForSelectedProfile: false,
      productionReady: false,
      blockers: [
        {
          code: 'evaluation-store-not-shared',
          component: 'shadow-admission-events',
          message: 'Shadow event history is evaluation storage.',
        },
      ],
    },
  });

  equal(readiness.state, 'production-shared-shadow-blocked', 'Shadow readiness: production-shared blocks');
  equal(readiness.claimAlignmentReady, false, 'Shadow readiness: blocked production-shared is not claim-aligned');
  equal(readiness.readyForSelectedProfile, false, 'Shadow readiness: blocked production-shared is not ready');
  ok(
    readiness.blockerCodes.includes('shadow-production-storage-path:selected-profile-storage-ready'),
    'Shadow readiness: storage blocker is explicit',
  );
  ok(
    readiness.storageBlockerRefs.includes('shadow-admission-events:evaluation-store-not-shared'),
    'Shadow readiness: storage blocker reference is retained',
  );
}

function testProductionSharedCanBecomeClaimAlignedWithoutOverclaim(): void {
  const readiness = evaluateConsequenceShadowReadinessClaimAlignment({
    generatedAt: '2026-05-14T08:10:00.000Z',
    runtimeProfileId: 'production-shared',
    productionStoragePath: {
      version: 'attestor.production-storage-path.v1',
      state: 'production-shared-ready',
      readyForSelectedProfile: true,
      productionReady: true,
      blockers: [],
    },
  });

  equal(readiness.state, 'production-shared-shadow-ready', 'Shadow readiness: production-shared can be claim-aligned');
  equal(readiness.claimAlignmentReady, true, 'Shadow readiness: complete evidence clears claim-alignment blockers');
  equal(readiness.readyForSelectedProfile, true, 'Shadow readiness: complete evidence clears selected-profile blockers');
  equal(readiness.productionReady, false, 'Shadow readiness: claim alignment still does not certify production readiness');
  equal(readiness.approvalRequired, true, 'Shadow readiness: customer/operator approval remains required');
  equal(readiness.autoEnforce, false, 'Shadow readiness: complete checklist still does not auto-enforce');
}

function testDocsPackageAndDescriptorSurfaceAreAligned(): void {
  const descriptor = consequenceAdmissionDescriptor();
  equal(
    descriptor.shadowReadinessClaimAlignmentVersion,
    'attestor.shadow-readiness-claim-alignment.v1',
    'Shadow readiness: admission descriptor exposes version',
  );
  ok(
    descriptor.shadowReadinessClaimAlignment.stageProfiles.some((profile) =>
      profile.stageId === 'shadow-customer-activation-receipt'
    ),
    'Shadow readiness: admission descriptor embeds the stage profiles',
  );

  const doc = readProjectFile('docs', 'audit', 'f7-shadow-readiness-claim-alignment-validation.md');
  includes(doc, '# F7 Shadow Readiness Claim Alignment Validation', 'Shadow readiness doc: title exists');
  includes(doc, 'repository slice for F7-S10', 'Shadow readiness doc: scope is explicit');
  includes(doc, '| F7-S10 production-ready descriptor enforcement | `partial` | `fixed` |', 'Shadow readiness doc: transition is recorded');
  includes(doc, 'zero planned', 'Shadow readiness doc: remaining count is explicit');

  const packageJson = readProjectFile('package.json');
  includes(packageJson, '"test:shadow-readiness-claim-alignment"', 'Shadow readiness: package script is exposed');
  includes(packageJson, '"test:f7-shadow-readiness-claim-alignment-validation"', 'Shadow readiness: validation script is exposed');

  const runner = readProjectFile('scripts', 'run', 'run-suite.mjs');
  includes(runner, 'test:shadow-readiness-claim-alignment', 'Shadow readiness: architecture suite includes module test');

  const probe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  includes(probe, 'consequenceShadowReadinessClaimAlignmentDescriptor', 'Shadow readiness: package probe covers descriptor');

  const serialized = JSON.stringify(evaluateConsequenceShadowReadinessClaimAlignment());
  excludes(
    serialized,
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|private_key|database_url|raw-model-prompt/u,
    'Shadow readiness: serialized output does not contain secret/raw markers',
  );
}

try {
  testDescriptorCoversShadowPipeline();
  testEvaluationModeAcceptedWithoutProductionClaim();
  testProductionSharedBlocksWhenStorageIsNotReady();
  testProductionSharedCanBecomeClaimAlignedWithoutOverclaim();
  testDocsPackageAndDescriptorSurfaceAreAligned();
  console.log(`Shadow readiness claim alignment tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Shadow readiness claim alignment tests failed:', error);
  process.exitCode = 1;
}
