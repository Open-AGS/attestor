import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS,
  consequenceAdversarialEvidenceFixtureDescriptor,
  createConsequenceAdversarialEvidenceFixtureBundle,
  evaluateConsequenceAdversarialEvidenceFixtureBundle,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testBundleIsDigestOnlyAndReviewMaterialOnly(): void {
  const bundle = createConsequenceAdversarialEvidenceFixtureBundle({
    generatedAt: '2026-05-25T17:20:00.000Z',
    actionSurface: 'attestor.test.supplier-payment',
    action: 'approve_supplier_payment',
  });
  const serialized = JSON.stringify(bundle);

  equal(bundle.version, 'attestor.consequence-adversarial-evidence-fixtures.v1', 'Adversarial evidence fixtures: version is explicit');
  equal(bundle.caseCount, CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS.length, 'Adversarial evidence fixtures: every fixture kind is emitted');
  equal(bundle.approvalRequired, true, 'Adversarial evidence fixtures: approval remains required');
  equal(bundle.autoEnforce, false, 'Adversarial evidence fixtures: auto-enforce is false');
  equal(bundle.activatesEnforcement, false, 'Adversarial evidence fixtures: enforcement activation is false');
  equal(bundle.rawPayloadStored, false, 'Adversarial evidence fixtures: raw payload storage is false');
  equal(bundle.syntheticOnly, true, 'Adversarial evidence fixtures: synthetic-only boundary is explicit');
  equal(bundle.localReplayOnly, true, 'Adversarial evidence fixtures: local replay boundary is explicit');
  equal(bundle.executesProductionTraffic, false, 'Adversarial evidence fixtures: production traffic execution is false');
  equal(bundle.downstreamMutationAllowed, false, 'Adversarial evidence fixtures: downstream mutation is forbidden');
  equal(bundle.credentialUseAllowed, false, 'Adversarial evidence fixtures: credential use is forbidden');
  equal(bundle.productionReady, false, 'Adversarial evidence fixtures: production readiness is not claimed');
  equal(bundle.reviewMaterialOnly, true, 'Adversarial evidence fixtures: output is review material only');

  for (const kind of CONSEQUENCE_ADVERSARIAL_EVIDENCE_FIXTURE_KINDS) {
    ok(bundle.cases.some((entry) => entry.kind === kind), `Adversarial evidence fixtures: includes ${kind}`);
  }
  ok(
    bundle.cases.every((entry) =>
      entry.mustNotGrantAuthority &&
      entry.modelRationaleGrantsAuthority === false &&
      entry.expectedAllowed === false &&
      entry.expectedFailClosed === true &&
      entry.rawPayloadStored === false &&
      entry.syntheticOnly &&
      entry.localReplayOnly &&
      entry.executesProductionTraffic === false &&
      entry.downstreamMutationAllowed === false &&
      entry.credentialUseAllowed === false
    ),
    'Adversarial evidence fixtures: every case preserves no-authority/no-side-effect invariants',
  );
  ok(
    bundle.cases.every((entry) =>
      entry.caseDigest.startsWith('sha256:') &&
      entry.sources.every((source) => source.sourceRefDigest.startsWith('sha256:'))
    ),
    'Adversarial evidence fixtures: every case and source is digest-bound',
  );
  excludes(
    serialized,
    /ignore previous|system prompt|raw_prompt|sk_live|bearer |secret=|customer@example\.com/iu,
    'Adversarial evidence fixtures: serialized bundle excludes raw prompt, secret, and customer markers',
  );
}

function testFixtureBundleExercisesAuthorityGuard(): void {
  const bundle = createConsequenceAdversarialEvidenceFixtureBundle({
    generatedAt: '2026-05-25T17:21:00.000Z',
  });
  const evaluation = evaluateConsequenceAdversarialEvidenceFixtureBundle(
    bundle,
    '2026-05-25T17:22:00.000Z',
  );

  equal(evaluation.version, bundle.version, 'Adversarial evidence fixtures: evaluation version follows bundle');
  equal(evaluation.fixtureBundleDigest, bundle.digest, 'Adversarial evidence fixtures: evaluation binds source bundle digest');
  equal(evaluation.caseCount, bundle.caseCount, 'Adversarial evidence fixtures: evaluation covers every case');
  equal(evaluation.status, 'passed', 'Adversarial evidence fixtures: expected authority decisions all pass');
  equal(evaluation.failedCaseCount, 0, 'Adversarial evidence fixtures: no expected decision fails');
  equal(evaluation.noGoReasons.length, 0, 'Adversarial evidence fixtures: no no-go reasons remain');
  equal(evaluation.rawPayloadStored, false, 'Adversarial evidence fixtures: evaluation stores no raw payload');
  equal(evaluation.productionReady, false, 'Adversarial evidence fixtures: evaluation does not claim production readiness');
  ok(evaluation.digest.startsWith('sha256:'), 'Adversarial evidence fixtures: evaluation digest is generated');

  const byKind = new Map(evaluation.results.map((entry) => [entry.kind, entry]));
  equal(
    byKind.get('model-rationale-self-approval')?.observedOutcome,
    'block',
    'Adversarial evidence fixtures: model rationale self-approval blocks',
  );
  ok(
    byKind.get('model-rationale-self-approval')?.reasonCodes.includes('model-generated-authority-source'),
    'Adversarial evidence fixtures: model-generated authority source is named',
  );
  equal(
    byKind.get('signed-evidence-not-authority')?.observedOutcome,
    'review',
    'Adversarial evidence fixtures: signed evidence alone reviews rather than authorizes',
  );
  ok(
    byKind.get('signed-evidence-not-authority')?.reasonCodes.includes('trusted-evidence-not-authority'),
    'Adversarial evidence fixtures: evidence-not-authority reason is named',
  );
  equal(
    byKind.get('mixed-trusted-and-injected-approval')?.observedOutcome,
    'review',
    'Adversarial evidence fixtures: mixed trusted/injected approval reviews',
  );
  ok(
    byKind.get('trust-class-promotion-attempt')?.reasonCodes.includes('trust-class-override-rejected'),
    'Adversarial evidence fixtures: trust-class promotion attempt is rejected',
  );
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = consequenceAdversarialEvidenceFixtureDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'adversarial-evidence-fixtures.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  const researchIndex = readProjectFile('docs', 'research', 'README.md');
  const researchLedger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const baseline = readProjectFile('docs', 'audit', 'current-posture-baseline.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.autoEnforce, false, 'Adversarial evidence descriptor: auto-enforce is false');
  equal(descriptor.activatesEnforcement, false, 'Adversarial evidence descriptor: activatesEnforcement is false');
  equal(descriptor.syntheticOnly, true, 'Adversarial evidence descriptor: synthetic-only boundary is explicit');
  equal(descriptor.reviewMaterialOnly, true, 'Adversarial evidence descriptor: review-material-only boundary is explicit');
  ok(
    descriptor.fixtureKinds.includes('model-rationale-self-approval'),
    'Adversarial evidence descriptor: model rationale self-approval fixture is listed',
  );

  for (const expected of [
    'attestor.consequence-adversarial-evidence-fixtures.v1',
    'src/consequence-admission/adversarial-evidence-fixtures.ts',
    'npm run test:adversarial-evidence-fixtures',
    'model-rationale-self-approval',
    'signed-evidence-not-authority',
    'reviewMaterialOnly = true',
    'activatesEnforcement = false',
    'OWASP LLM01 Prompt Injection',
    'NIST AI RMF',
    'OpenAI safety guidance',
  ]) {
    includes(docs, expected, `Adversarial evidence docs: records ${expected}`);
  }

  includes(
    systemOverview,
    '[Adversarial evidence fixtures](adversarial-evidence-fixtures.md)',
    'System overview links adversarial evidence fixtures',
  );
  includes(
    readme,
    '[Repository navigator](docs/01-overview/repository-navigator.md)',
    'README routes deeper adversarial evidence docs through the navigator',
  );
  includes(
    navigator,
    '[Failure modes and controls](../05-proof/failure-modes-and-controls.md)',
    'Repository navigator links failure-mode controls',
  );
  includes(
    researchIndex,
    'adversarial-evidence-authority-boundary.md',
    'Research index links adversarial evidence research note',
  );
  includes(
    researchLedger,
    'adversarial-evidence-authority-boundary.md',
    'Research ledger records adversarial evidence research note',
  );
  includes(
    baseline,
    'adversarial evidence fixture bundle',
    'Baseline records adversarial evidence fixture progress',
  );
  equal(
    packageJson.scripts['test:adversarial-evidence-fixtures'],
    'tsx tests/adversarial-evidence-fixtures.test.ts',
    'Package: adversarial evidence fixture test is exposed',
  );
}

testBundleIsDigestOnlyAndReviewMaterialOnly();
testFixtureBundleExercisesAuthorityGuard();
testDescriptorDocsAndPackageSurfaceStayAligned();

console.log(`Adversarial evidence fixture tests: ${passed} passed, 0 failed`);
