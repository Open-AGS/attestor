import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_CHECK_KINDS,
  SIGNAL_ADAPTER_REGISTRY_VERSION,
  createBuiltinSignalAdapterRegistry,
  createSignalAdapterRegistration,
  createSignalAdapterRegistry,
  createSignalExtractorDeclaration,
  consequenceAdmissionDescriptor,
  signalAdapterRegistryDescriptor,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function testDescriptorAndBuiltinRegistryCoverAdmissionChecks(): void {
  const descriptor = signalAdapterRegistryDescriptor();
  const registry = createBuiltinSignalAdapterRegistry();
  const admissionDescriptor = consequenceAdmissionDescriptor();

  equal(descriptor.version, SIGNAL_ADAPTER_REGISTRY_VERSION, 'Signal adapter registry: descriptor version is explicit');
  equal(descriptor.signalExtractorContractVersion, 'attestor.signal-extractor-contract.v1', 'Signal adapter registry: descriptor binds extractor contract');
  equal(descriptor.signalRelationshipContractVersion, 'attestor.signal-relationship-contract.v1', 'Signal adapter registry: descriptor binds relationship contract');
  equal(descriptor.builtInAdapterCount, 6, 'Signal adapter registry: six built-in adapters are registered');
  equal(descriptor.coverageComplete, true, 'Signal adapter registry: descriptor reports complete coverage');
  equal(registry.coverageComplete, true, 'Signal adapter registry: built-in registry coverage is complete');
  deepEqual(
    [...registry.sourceCheckKindsCovered].sort(),
    [...CONSEQUENCE_ADMISSION_CHECK_KINDS].sort(),
    'Signal adapter registry: source check coverage matches admission check kinds',
  );
  deepEqual(
    [...descriptor.sourceCheckKinds].sort(),
    [...admissionDescriptor.checkKinds].sort(),
    'Signal adapter registry: descriptor check kinds match admission descriptor',
  );
}

function testBuiltinAdaptersMapChecksToExpectedSignals(): void {
  const registry = createBuiltinSignalAdapterRegistry();
  const byCheck = new Map(registry.registrations.map((registration) => [
    registration.sourceCheckKind,
    registration,
  ]));

  equal(byCheck.get('policy')?.signalKind, 'policy_gap', 'Signal adapter registry: policy check maps to policy_gap');
  equal(byCheck.get('authority')?.signalKind, 'authority_gap', 'Signal adapter registry: authority check maps to authority_gap');
  equal(byCheck.get('evidence')?.signalKind, 'evidence_gap', 'Signal adapter registry: evidence check maps to evidence_gap');
  equal(byCheck.get('freshness')?.signalKind, 'freshness_gap', 'Signal adapter registry: freshness check maps to freshness_gap');
  equal(byCheck.get('enforcement')?.signalKind, 'hazard', 'Signal adapter registry: enforcement check maps to hazard');
  equal(byCheck.get('adapter-readiness')?.signalKind, 'measurement_degraded_signal', 'Signal adapter registry: adapter readiness maps to measurement degraded');
  equal(byCheck.get('adapter-readiness')?.extractor.authorityMode, 'measurement-only', 'Signal adapter registry: adapter readiness is measurement-only');
  equal(byCheck.get('enforcement')?.extractor.canEmitHardFloor, false, 'Signal adapter registry: enforcement adapter cannot emit hard_floor');

  for (const registration of registry.registrations) {
    equal(registration.version, SIGNAL_ADAPTER_REGISTRY_VERSION, `Signal adapter registry: ${registration.adapterId} version is explicit`);
    deepEqual(
      registration.triggerOutcomes,
      ['fail', 'not-applicable', 'warn'],
      `Signal adapter registry: ${registration.adapterId} excludes pass outcome`,
    );
    deepEqual(
      registration.dedupeKeyFields,
      ['sourceCheckKind', 'sourceEvidenceDigest', 'envelopeRefDigest'],
      `Signal adapter registry: ${registration.adapterId} dedupe key is explicit`,
    );
    equal(registration.duplicateEvidenceRelationshipCandidate, 'duplicates', `Signal adapter registry: ${registration.adapterId} emits only duplicate candidate`);
    equal(registration.passOutcomeMayMarkSafe, false, `Signal adapter registry: ${registration.adapterId} cannot mark pass as safe`);
    equal(registration.relationshipDetectionIncluded, false, `Signal adapter registry: ${registration.adapterId} does not detect relationships`);
    equal(registration.fusionIncluded, false, `Signal adapter registry: ${registration.adapterId} does not run fusion`);
    equal(registration.grantsAuthority, false, `Signal adapter registry: ${registration.adapterId} cannot grant authority`);
    equal(registration.canAdmit, false, `Signal adapter registry: ${registration.adapterId} cannot admit`);
    equal(registration.activatesEnforcement, false, `Signal adapter registry: ${registration.adapterId} cannot activate enforcement`);
    equal(registration.autoEnforce, false, `Signal adapter registry: ${registration.adapterId} cannot auto-enforce`);
    equal(registration.productionReady, false, `Signal adapter registry: ${registration.adapterId} is not production readiness`);
  }
}

function testRegistrationFailsClosedForUnsafeShapes(): void {
  const extractor = createSignalExtractorDeclaration({
    extractorId: 'policy-foundry.policy-check.extractor',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['policy_gap'],
  });

  throws(
    () =>
      createSignalAdapterRegistration({
        adapterId: 'policy-foundry.policy-check.adapter',
        sourceCheckKind: 'policy',
        extractor,
        signalKind: 'evidence_gap',
        evidenceRefKind: 'evidence',
        readModelKind: 'policy',
      }),
    /signalKind must be declared/u,
    'Signal adapter registry: undeclared signal kind fails closed',
  );

  throws(
    () =>
      createSignalAdapterRegistration({
        adapterId: 'policy-foundry.policy-check.adapter',
        sourceCheckKind: 'policy',
        extractor,
        signalKind: 'policy_gap',
        triggerOutcomes: ['pass' as never],
        evidenceRefKind: 'evidence',
        readModelKind: 'policy',
      }),
    /pass outcome must not emit a safe signal/u,
    'Signal adapter registry: pass outcome fails closed',
  );

  const hardFloorExtractor = createSignalExtractorDeclaration({
    extractorId: 'tier1.hard-floor.extractor',
    sourcePlane: 'tier-1-hard-gate',
    category: 'verdict',
    authorityMode: 'hard-floor',
    allowedKinds: ['hard_floor'],
  });
  const hardFloorRegistration = createSignalAdapterRegistration({
    adapterId: 'tier1.hard-floor.adapter',
    sourceCheckKind: 'enforcement',
    extractor: hardFloorExtractor,
    signalKind: 'hard_floor',
    evidenceRefKind: 'authority',
    readModelKind: 'policy',
  });

  equal(hardFloorRegistration.signalKind, 'hard_floor', 'Signal adapter registry: tier-1 hard_floor registration is representable');
}

function testRegistryRejectsDuplicateEvidenceShapes(): void {
  const registry = createBuiltinSignalAdapterRegistry();
  const first = registry.registrations[0];
  assert.ok(first);

  throws(
    () =>
      createSignalAdapterRegistry([
        first,
        {
          ...first,
          adapterId: 'duplicate.policy.adapter',
        },
      ]),
    /one registration per source check kind/u,
    'Signal adapter registry: duplicate source check kind fails closed',
  );
  throws(
    () =>
      createSignalAdapterRegistry([
        first,
        {
          ...first,
          adapterId: 'duplicate.signature.adapter',
          sourceCheckKind: 'authority',
        },
      ]),
    /duplicate adapter signatures would double-count evidence/u,
    'Signal adapter registry: duplicate adapter signature fails closed',
  );
}

function testDocsOverviewPackageAndProbeStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'signal-adapter-registry.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile('scripts', 'probe-consequence-admission-package-surface.mjs');

  for (const expected of [
    '# Signal Adapter Registry',
    'attestor.signal-adapter-registry.v1',
    'CONSEQUENCE_ADMISSION_CHECK_KINDS',
    'createBuiltinSignalAdapterRegistry()',
    'createSignalAdapterRegistration()',
    'policy_gap',
    'authority_gap',
    'evidence_gap',
    'freshness_gap',
    'measurement_degraded_signal',
    'Open Policy Agent decision logs',
    'OpenTelemetry',
    'Model Context Protocol',
    'Accellera UVM',
    'not runtime adaptation',
    'not relationship detection',
    'not fusion',
    'not live enforcement',
    'never grants authority',
  ]) {
    includes(doc, expected, `Signal adapter registry doc: records ${expected}`);
  }

  includes(
    overview,
    '| W03 | complete | Existing Checks To Signal Adapter Registry |',
    'Signal adapter registry: runtime wiring tracker marks W03 complete',
  );
  includes(
    overview,
    'src/consequence-admission/signal-adapter-registry.ts',
    'Signal adapter registry: overview records implementation file',
  );
  equal(
    packageJson.scripts['test:signal-adapter-registry'],
    'tsx tests/signal-adapter-registry.test.ts',
    'Signal adapter registry: package script is registered',
  );
  includes(
    packageProbe,
    'SIGNAL_ADAPTER_REGISTRY_VERSION',
    'Signal adapter registry: package surface probe covers export',
  );
}

testDescriptorAndBuiltinRegistryCoverAdmissionChecks();
testBuiltinAdaptersMapChecksToExpectedSignals();
testRegistrationFailsClosedForUnsafeShapes();
testRegistryRejectsDuplicateEvidenceShapes();
testDocsOverviewPackageAndProbeStayAligned();

console.log(`Signal adapter registry tests: ${passed} passed, 0 failed`);
