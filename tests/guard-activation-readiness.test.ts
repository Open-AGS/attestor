import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS,
  consequenceAdmissionDescriptor,
  consequenceGuardActivationReadinessDescriptor,
  evaluateConsequenceGuardActivationReadiness,
  type ConsequenceGuardActivationCriterionEvidence,
  type ConsequenceGuardActivationGuardId,
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
  assert.ok(value.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(value: string, pattern: RegExp, message: string): void {
  assert.doesNotMatch(value, pattern, message);
  passed += 1;
}

function readProjectFile(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

function completeEvidenceForGuard(
  guardId: ConsequenceGuardActivationGuardId,
): readonly ConsequenceGuardActivationCriterionEvidence[] {
  return CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS.map((criterionId) => ({
    guardId,
    criterionId,
    status: 'pass',
    evidenceRefs: [`evidence/${guardId}/${criterionId}`],
    limitation: 'Test fixture evidence proves this criterion for the scoped guard only.',
  }));
}

function completeEvidenceForAllGuards(): readonly ConsequenceGuardActivationCriterionEvidence[] {
  const descriptor = consequenceGuardActivationReadinessDescriptor();
  return descriptor.guardIds.flatMap((guardId) => completeEvidenceForGuard(guardId));
}

function testDescriptorIsExplicitlyReadinessOnly(): void {
  const descriptor = consequenceGuardActivationReadinessDescriptor();

  equal(
    descriptor.version,
    'attestor.consequence-guard-activation-readiness.v1',
    'Guard activation readiness: version is stable',
  );
  equal(descriptor.separatesDecisionRenderingFromEnforcement, true, 'Guard activation readiness: decision and enforcement are separated');
  equal(descriptor.approvalRequired, true, 'Guard activation readiness: approval remains required');
  equal(descriptor.autoEnforce, false, 'Guard activation readiness: auto-enforce is false');
  equal(descriptor.productionReady, false, 'Guard activation readiness: production readiness is not claimed');
  equal(descriptor.activatesEnforcement, false, 'Guard activation readiness: descriptor does not activate enforcement');
  equal(descriptor.rawPayloadStored, false, 'Guard activation readiness: raw payload storage is false');
  ok(descriptor.guardIds.includes('agent-loop-abuse-guard'), 'Guard activation readiness: agent-loop guard is covered');
  ok(descriptor.guardIds.includes('tool-result-poisoning-guard'), 'Guard activation readiness: tool-result guard is covered');
  ok(descriptor.guardIds.includes('agentic-supply-chain-guard'), 'Guard activation readiness: agentic supply-chain guard is covered');
  ok(descriptor.guardIds.includes('multi-agent-delegation-guard'), 'Guard activation readiness: multi-agent delegation guard is covered');
  ok(descriptor.criterionIds.includes('signed-decision-binding'), 'Guard activation readiness: signed decision criterion is required');
  ok(descriptor.criterionIds.includes('downstream-verifier-integrated'), 'Guard activation readiness: downstream verifier criterion is required');
  ok(
    descriptor.criteria.every((criterion) => criterion.requiredForProductionEnforcement),
    'Guard activation readiness: every criterion is required before production enforcement claim',
  );
}

function testDefaultEvaluationBlocksProductionEnforcement(): void {
  const readiness = evaluateConsequenceGuardActivationReadiness({
    generatedAt: '2026-05-14T08:00:00.000Z',
  });

  equal(readiness.activationReady, false, 'Guard activation readiness: default readiness is blocked');
  equal(readiness.productionReady, false, 'Guard activation readiness: production readiness is still false');
  equal(readiness.autoEnforce, false, 'Guard activation readiness: auto-enforce stays false');
  equal(readiness.activatesEnforcement, false, 'Guard activation readiness: evaluator does not activate enforcement');
  equal(readiness.rawPayloadStored, false, 'Guard activation readiness: output stores no raw payloads');
  equal(readiness.readinessOnly, true, 'Guard activation readiness: output is readiness-only');
  ok(readiness.blockerCount > 0, 'Guard activation readiness: default output has blockers');
  ok(
    readiness.blockerCodes.includes('agent-loop-abuse-guard:production-shared-state-proven'),
    'Guard activation readiness: shared-state blocker is explicit',
  );
  ok(
    readiness.blockerCodes.includes('tool-result-poisoning-guard:signed-decision-binding'),
    'Guard activation readiness: signed-decision blocker is explicit',
  );
  ok(
    readiness.guards.every((guard) => guard.state === 'production-enforcement-blocked'),
    'Guard activation readiness: static guard outputs are blocked, not ready',
  );
  ok(readiness.digest.startsWith('sha256:'), 'Guard activation readiness: digest is emitted');
}

function testScopedEvidenceCanMarkOneGuardReadyWithoutGlobalClaim(): void {
  const readiness = evaluateConsequenceGuardActivationReadiness({
    generatedAt: '2026-05-14T08:05:00.000Z',
    evidence: completeEvidenceForGuard('tool-result-poisoning-guard'),
  });
  const toolGuard = readiness.guards.find((guard) => guard.guardId === 'tool-result-poisoning-guard');
  const agentLoopGuard = readiness.guards.find((guard) => guard.guardId === 'agent-loop-abuse-guard');

  equal(toolGuard?.activationReady, true, 'Guard activation readiness: supplied evidence can clear a scoped guard');
  equal(toolGuard?.state, 'production-enforcement-ready', 'Guard activation readiness: scoped guard can become activation-ready');
  equal(agentLoopGuard?.activationReady, false, 'Guard activation readiness: other guards remain blocked');
  equal(readiness.activationReady, false, 'Guard activation readiness: global readiness remains blocked until every guard is proven');
  equal(readiness.productionReady, false, 'Guard activation readiness: scoped evidence does not claim production readiness');
}

function testAllEvidenceClearsActivationButNotProductionReadiness(): void {
  const readiness = evaluateConsequenceGuardActivationReadiness({
    generatedAt: '2026-05-14T08:10:00.000Z',
    evidence: completeEvidenceForAllGuards(),
  });

  equal(readiness.activationReady, true, 'Guard activation readiness: complete evidence clears activation checklist');
  equal(readiness.blockerCount, 0, 'Guard activation readiness: complete evidence clears blockers');
  equal(readiness.productionReady, false, 'Guard activation readiness: even complete checklist does not certify production readiness');
  equal(readiness.autoEnforce, false, 'Guard activation readiness: complete checklist still does not auto-enforce');
  equal(readiness.activatesEnforcement, false, 'Guard activation readiness: complete checklist still does not activate enforcement');
}

function testDocsScriptsAndPackageSurfaceAreAligned(): void {
  const descriptor = consequenceAdmissionDescriptor();
  equal(
    descriptor.guardActivationReadinessVersion,
    'attestor.consequence-guard-activation-readiness.v1',
    'Guard activation readiness: admission descriptor exposes version',
  );
  ok(
    descriptor.guardActivationReadiness.guardProfiles.some((profile) =>
      profile.guardId === 'approval-provenance-guard'
    ),
    'Guard activation readiness: admission descriptor embeds profile',
  );

  const doc = readProjectFile('docs', '02-architecture', 'guard-activation-readiness.md');
  includes(doc, 'Guard Activation Readiness', 'Guard activation readiness doc: title exists');
  includes(doc, 'decision rendering is not enforcement activation', 'Guard activation readiness doc: core distinction exists');
  includes(doc, '`signed-decision-binding`', 'Guard activation readiness doc: signed decision criterion exists');
  includes(doc, '`customer-activation-approved`', 'Guard activation readiness doc: customer approval criterion exists');
  includes(doc, 'Kubernetes readiness probes', 'Guard activation readiness doc: readiness anchor exists');

  const audit = readProjectFile('docs', 'audit', 'f3-guard-activation-checklist.md');
  includes(audit, 'F3-R3', 'Guard activation readiness audit: F3-R3 label exists');
  includes(audit, 'not complete production enforcement', 'Guard activation readiness audit: limitation is explicit');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:guard-activation-readiness'],
    'tsx tests/guard-activation-readiness.test.ts',
    'Guard activation readiness: package script is exposed',
  );

  const runner = readProjectFile('scripts', 'run-suite.mjs');
  includes(runner, 'test:guard-activation-readiness', 'Guard activation readiness: architecture suite includes script');

  const probe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');
  includes(probe, 'consequenceGuardActivationReadinessDescriptor', 'Guard activation readiness: package probe covers descriptor');

  const serialized = JSON.stringify(evaluateConsequenceGuardActivationReadiness());
  excludes(
    serialized,
    /\b(?:sk|rk)_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|private_key|database_url|raw-model-prompt/u,
    'Guard activation readiness: serialized output does not contain secret/raw markers',
  );
}

try {
  testDescriptorIsExplicitlyReadinessOnly();
  testDefaultEvaluationBlocksProductionEnforcement();
  testScopedEvidenceCanMarkOneGuardReadyWithoutGlobalClaim();
  testAllEvidenceClearsActivationButNotProductionReadiness();
  testDocsScriptsAndPackageSurfaceAreAligned();
  console.log(`Guard activation readiness tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Guard activation readiness tests failed:', error);
  process.exitCode = 1;
}
