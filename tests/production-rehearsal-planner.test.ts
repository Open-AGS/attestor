import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createProductionRehearsalPlan,
  renderProductionRehearsalPlan,
  type ProductionRehearsalManifest,
} from '../scripts/plan-production-rehearsal.ts';

let passed = 0;

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function cloneManifest(manifest: ProductionRehearsalManifest): ProductionRehearsalManifest {
  return JSON.parse(JSON.stringify(manifest)) as ProductionRehearsalManifest;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function packageScripts(): Readonly<Record<string, string>> {
  return readJson<PackageJson>('package.json').scripts;
}

function exampleManifest(): ProductionRehearsalManifest {
  return readJson<ProductionRehearsalManifest>(
    'docs',
    '08-deployment',
    'production-rehearsal-manifest.example.json',
  );
}

function filledManifest(): ProductionRehearsalManifest {
  const manifest = cloneManifest(exampleManifest());
  const mutable = manifest as unknown as {
    rehearsalId: string;
    targetEnvironment: {
      name: string;
      region: string;
      cluster?: string;
      publicHostname?: string;
      owner: string;
    };
    source: {
      commit: string;
      workflowRuns: Record<string, string>;
    };
  };

  mutable.rehearsalId = 'prod-rehearsal-2026-04-28';
  mutable.targetEnvironment.name = 'gke-prod-rehearsal';
  mutable.targetEnvironment.region = 'europe-west1';
  mutable.targetEnvironment.cluster = 'attestor-prod-rehearsal';
  mutable.targetEnvironment.publicHostname = 'attestor-rehearsal.example.invalid';
  mutable.targetEnvironment.owner = 'platform-operator';
  mutable.source.commit = 'f477ce4f477ce4f477ce4f477ce4f477ce4f477c';
  mutable.source.workflowRuns.evaluationSmoke = '25010000001';
  mutable.source.workflowRuns.fullVerify = '25010000002';
  mutable.source.workflowRuns.releaseProvenance = '25010000003';
  delete mutable.source.workflowRuns.productionRehearsal;

  return manifest;
}

function planFor(manifest: ProductionRehearsalManifest) {
  return createProductionRehearsalPlan(manifest, {
    manifestPath: 'docs/08-deployment/production-rehearsal-manifest.example.json',
    packageScripts: packageScripts(),
  });
}

function testPlannerAcceptsFilledManifestAndPrintsOrder(): void {
  const plan = planFor(filledManifest());
  const rendered = renderProductionRehearsalPlan(plan);

  equal(plan.issues.length, 0, 'Production rehearsal planner: filled manifest has no blocking issues');
  ok(plan.commandOrder.length >= 6, 'Production rehearsal planner: command order is populated');
  includes(rendered, 'Plan status: ready to hand to an operator.', 'Production rehearsal planner: rendered plan reports ready status');
  includes(rendered, 'npm run verify', 'Production rehearsal planner: rendered plan includes repo verify');
  includes(rendered, 'npm run render:production-readiness-packet', 'Production rehearsal planner: rendered plan includes readiness packet command');
  includes(rendered, 'gh attestation verify evaluation-artifacts.tar.gz', 'Production rehearsal planner: rendered plan includes provenance verification');
  includes(rendered, 'Pending evidence is not proof.', 'Production rehearsal planner: rendered plan preserves proof boundary');
}

function testPlannerRejectsTemplatePlaceholders(): void {
  const plan = planFor(exampleManifest());
  const rendered = renderProductionRehearsalPlan(plan);

  ok(plan.issues.length >= 6, 'Production rehearsal planner: template placeholders block planning');
  includes(rendered, 'Plan status: blocked.', 'Production rehearsal planner: rendered plan reports blocked status');
  includes(rendered, 'targetEnvironment.name must be set before planning.', 'Production rehearsal planner: target placeholder is surfaced');
  includes(rendered, 'source.commit must be the real commit under rehearsal.', 'Production rehearsal planner: placeholder commit is surfaced');
  includes(rendered, 'source.workflowRuns.evaluationSmoke must be set or removed before planning.', 'Production rehearsal planner: workflow placeholder is surfaced');
}

function testPlannerRejectsMissingScriptsAndUnsafeRuntime(): void {
  const manifest = cloneManifest(filledManifest());
  const mutable = manifest as unknown as {
    commandPlan: Array<{ command: string }>;
    runtime: {
      noLocalFallback: boolean;
      requireSharedAuthority: boolean;
    };
    secretPosture: {
      plaintextSecretsAllowed: boolean;
    };
  };

  mutable.commandPlan[0].command = 'npm run missing:production-rehearsal-script';
  mutable.runtime.noLocalFallback = false;
  mutable.runtime.requireSharedAuthority = false;
  mutable.secretPosture.plaintextSecretsAllowed = true;

  const plan = planFor(manifest);
  const rendered = renderProductionRehearsalPlan(plan);

  includes(rendered, 'missing npm script: missing:production-rehearsal-script', 'Production rehearsal planner: missing npm script is blocked');
  includes(rendered, 'runtime.noLocalFallback must be true.', 'Production rehearsal planner: local fallback is blocked');
  includes(rendered, 'production-shared requires runtime.requireSharedAuthority=true.', 'Production rehearsal planner: shared authority is required');
  includes(rendered, 'secretPosture.plaintextSecretsAllowed must be false.', 'Production rehearsal planner: plaintext secrets are blocked');
}

function testPlannerRejectsPrematureGoVerdict(): void {
  const manifest = cloneManifest(filledManifest());
  const mutable = manifest as unknown as {
    goNoGo: {
      verdict: string;
    };
  };
  mutable.goNoGo.verdict = 'go';

  const plan = planFor(manifest);
  const rendered = renderProductionRehearsalPlan(plan);

  includes(rendered, 'goNoGo.verdict must remain pending during planning.', 'Production rehearsal planner: premature go verdict is blocked');
}

function testTrackerMarksStep03CompleteWithoutRenumbering(): void {
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');

  includes(tracker, '| Completed | 6 |', 'Production rehearsal planner: tracker marks six steps complete');
  includes(tracker, '| Not started | 4 |', 'Production rehearsal planner: tracker leaves four steps not started');
  includes(
    tracker,
    '| 03 | complete | Add the one-command rehearsal planner |',
    'Production rehearsal planner: Step 03 is complete without changing the frozen title',
  );
  includes(
    tracker,
    '| 04 | complete | Bind rehearsal to a concrete target environment profile |',
    'Production rehearsal planner: Step 04 is complete after target binding',
  );
}

testPlannerAcceptsFilledManifestAndPrintsOrder();
testPlannerRejectsTemplatePlaceholders();
testPlannerRejectsMissingScriptsAndUnsafeRuntime();
testPlannerRejectsPrematureGoVerdict();
testTrackerMarksStep03CompleteWithoutRenumbering();

console.log(`Production rehearsal planner tests: ${passed} passed, 0 failed`);
