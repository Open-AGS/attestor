import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS,
  CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
  consequenceAdmissionDescriptor,
  consequenceReplayLayerPlacementDescriptor,
  type ConsequenceReplayLayerPlacementKind,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function surface(kind: ConsequenceReplayLayerPlacementKind) {
  const found = consequenceReplayLayerPlacementDescriptor().surfaces.find((item) =>
    item.kind === kind
  );
  assert.ok(found, `Missing replay layer placement surface: ${kind}`);
  return found;
}

function testPlacementShapeIsSharedAndNonAuthorizing(): void {
  const placement = consequenceReplayLayerPlacementDescriptor();
  const admission = consequenceAdmissionDescriptor();

  equal(
    placement.version,
    CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
    'Replay layer placement: version constant is used',
  );
  equal(
    placement.version,
    'attestor.consequence-replay-layer-placement.v1',
    'Replay layer placement: version literal is stable',
  );
  equal(
    placement.owningLayer,
    'shared-control-layer',
    'Replay layer placement: owning layer is shared control layer',
  );
  equal(placement.primaryRole, 'replay', 'Replay layer placement: replay role owns placement');
  ok(
    placement.supportingRoles.includes('pdp'),
    'Replay layer placement: PDP supports replay placement',
  );
  ok(
    placement.supportingRoles.includes('pep'),
    'Replay layer placement: PEP supports replay placement',
  );
  ok(
    placement.supportingRoles.includes('audit-proof'),
    'Replay layer placement: audit proof supports replay placement',
  );
  ok(
    placement.nonOwningRoles.includes('pack'),
    'Replay layer placement: packs are not replay layer owners',
  );
  ok(
    placement.nonOwningRoles.includes('hosted-service'),
    'Replay layer placement: hosted service is not replay layer owner',
  );
  equal(placement.autoEnforce, false, 'Replay layer placement: auto enforce is false');
  equal(placement.productionReady, false, 'Replay layer placement: production readiness is false');
  equal(placement.activatesEnforcement, false, 'Replay layer placement: activation is false');
  includes(
    placement.limitation,
    'does not execute customer infrastructure',
    'Replay layer placement: limitation prevents execution overclaim',
  );
  equal(
    admission.replayLayerPlacementVersion,
    CONSEQUENCE_REPLAY_LAYER_PLACEMENT_VERSION,
    'Replay layer placement: admission descriptor exposes placement version',
  );
  equal(
    admission.replayLayerPlacement.primaryRole,
    'replay',
    'Replay layer placement: admission descriptor exposes replay owner',
  );
}

function testReplaySurfaceInventoryIsCompleteAndBounded(): void {
  const placement = consequenceReplayLayerPlacementDescriptor();
  const kinds = placement.surfaces.map((item) => item.kind);

  deepEqual(
    placement.placementKinds,
    CONSEQUENCE_REPLAY_LAYER_PLACEMENT_KINDS,
    'Replay layer placement: placement kinds are exported in stable order',
  );
  deepEqual(
    kinds,
    [
      'synthetic-failure-mode-replay',
      'presentation-replay-consumption',
      'local-adversarial-replay',
      'sandbox-downstream-replay',
    ],
    'Replay layer placement: expected replay surface inventory is complete',
  );

  for (const item of placement.surfaces) {
    ok(item.version.length > 0, `Replay layer placement: ${item.kind} names a version`);
    ok(item.sourceFile.startsWith('src/consequence-admission/'), `Replay layer placement: ${item.kind} is inside consequence admission`);
    equal(item.rawPayloadStored, false, `Replay layer placement: ${item.kind} stores no raw payload`);
    equal(item.downstreamMutationAllowed, false, `Replay layer placement: ${item.kind} cannot mutate downstream`);
    equal(item.productionTrafficAllowed, false, `Replay layer placement: ${item.kind} cannot use production traffic`);
    equal(item.productionReady, false, `Replay layer placement: ${item.kind} is not production-ready proof`);
    ok(item.requiredProof.length > 0, `Replay layer placement: ${item.kind} names required proof`);
    ok(item.limitation.length > 0, `Replay layer placement: ${item.kind} has a limitation`);
  }
}

function testCriticalReplayBoundariesAreExplicit(): void {
  const synthetic = surface('synthetic-failure-mode-replay');
  const presentation = surface('presentation-replay-consumption');
  const local = surface('local-adversarial-replay');
  const sandbox = surface('sandbox-downstream-replay');

  equal(
    synthetic.executionBoundary,
    'synthetic-review-material',
    'Replay layer placement: failure fixtures are synthetic review material',
  );
  equal(
    presentation.executionBoundary,
    'customer-enforcement-boundary',
    'Replay layer placement: presentation replay belongs at enforcement boundary',
  );
  ok(
    presentation.requiredProof.includes('atomic-consume-result'),
    'Replay layer placement: presentation replay requires atomic consume proof',
  );
  equal(
    local.executionBoundary,
    'local-non-mutating-harness',
    'Replay layer placement: adversarial replay is local non-mutating harness',
  );
  equal(
    sandbox.executionBoundary,
    'sandbox-or-staging-dry-run',
    'Replay layer placement: downstream replay is sandbox/staging dry-run only',
  );
  ok(
    sandbox.requiredProof.includes('sandbox-boundary-proof'),
    'Replay layer placement: sandbox replay requires sandbox boundary proof',
  );
}

function testDocsScriptsAndPackageSurfaceStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'replay-layer-placement.md');
  const architecture = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');
  const fixtureDoc = readProjectFile('docs', '02-architecture', 'failure-mode-replay-fixtures.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(doc, 'attestor.consequence-replay-layer-placement.v1', 'Replay layer docs: placement version is named');
  includes(doc, 'src/consequence-admission/replay-layer-placement.ts', 'Replay layer docs: source file is named');
  includes(doc, 'presentation-replay-consumption', 'Replay layer docs: presentation replay surface is named');
  includes(doc, 'sandbox-downstream-replay', 'Replay layer docs: sandbox replay surface is named');
  includes(doc, 'does not execute customer infrastructure', 'Replay layer docs: execution non-claim is present');
  includes(architecture, 'attestor.consequence-replay-layer-placement.v1', 'Architecture docs: replay placement contract is named');
  includes(fixtureDoc, '[Replay layer placement](replay-layer-placement.md)', 'Replay fixture docs: replay placement doc is linked');
  includes(packageProbe, 'consequenceReplayLayerPlacementDescriptor', 'Package probe: replay placement descriptor is checked');
  equal(
    pkg.scripts['test:replay-layer-placement'],
    'tsx tests/replay-layer-placement.test.ts',
    'Package: replay layer placement test is exposed',
  );
}

testPlacementShapeIsSharedAndNonAuthorizing();
testReplaySurfaceInventoryIsCompleteAndBounded();
testCriticalReplayBoundariesAreExplicit();
testDocsScriptsAndPackageSurfaceStayAligned();

console.log(`Replay layer placement tests: ${passed} passed, 0 failed`);
