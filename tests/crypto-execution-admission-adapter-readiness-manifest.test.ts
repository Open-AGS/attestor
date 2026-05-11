import assert from 'node:assert/strict';
import {
  CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_MATRIX,
  CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES,
  createCryptoAdapterReadinessManifest,
  cryptoAdapterReadinessManifestDescriptor,
  cryptoAdapterReadinessManifestLabel,
} from '../src/crypto-execution-admission/index.js';
import type {
  CryptoExecutionAdmissionPlan,
  CryptoExecutionAdmissionStep,
  CryptoExecutionAdmissionSurface,
} from '../src/crypto-execution-admission/index.js';
import type { CryptoExecutionAdapterKind } from '../src/crypto-authorization-core/types.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function step(input: Partial<CryptoExecutionAdmissionStep>): CryptoExecutionAdmissionStep {
  return {
    stepId: input.stepId ?? 'step',
    kind: input.kind ?? 'collect-adapter-preflight',
    surface: input.surface ?? 'wallet-rpc',
    status: input.status ?? 'satisfied',
    reasonCode: input.reasonCode ?? 'ready',
    message: input.message ?? 'ready',
    source: input.source ?? 'admission-planner',
    standards: input.standards ?? [],
    evidence: input.evidence ?? {},
  };
}

function planFixture(input: {
  adapterKind: CryptoExecutionAdapterKind | null;
  surface: CryptoExecutionAdmissionSurface;
  outcome: CryptoExecutionAdmissionPlan['outcome'];
  steps: readonly CryptoExecutionAdmissionStep[];
  blockedReasons?: readonly string[];
}): CryptoExecutionAdmissionPlan {
  const suffix = input.adapterKind ?? 'adapter-neutral';
  return {
    version: 'attestor.crypto-execution-admission.v1',
    planId: `plan-${suffix}-${input.outcome}`,
    createdAt: '2026-05-11T07:30:00.000Z',
    integrationRef: `integration:${suffix}`,
    simulationId: `simulation-${suffix}`,
    simulationDigest: `sha256:simulation-${suffix}`,
    intentId: `intent-${suffix}`,
    consequenceKind: 'transfer',
    adapterKind: input.adapterKind,
    surface: input.surface,
    outcome: input.outcome,
    chainId: 'eip155:1',
    accountAddress: '0x1111111111111111111111111111111111111111',
    standards: ['attestor-core'],
    requiredHandoffArtifacts: ['attestor-release-authorization'],
    transportHeaders: [],
    steps: input.steps,
    blockedReasons: input.blockedReasons ?? [],
    nextActions: [],
    operatorNote: null,
    canonical: '{}',
    digest: `sha256:plan-${suffix}-${input.outcome}`,
  };
}

function testMatrixMatchesExecutionAdmissionProfiles(): void {
  equal(
    Object.keys(CRYPTO_ADAPTER_READINESS_MATRIX).length,
    Object.keys(CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES).length,
    'adapter readiness: every execution adapter profile has a matrix entry',
  );

  for (const [entryId, matrixEntry] of Object.entries(CRYPTO_ADAPTER_READINESS_MATRIX)) {
    const profile = CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES[
      entryId as keyof typeof CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES
    ];
    equal(
      matrixEntry.surface,
      profile.surface,
      `adapter readiness: ${entryId} surface matches execution-admission profile`,
    );
    equal(
      matrixEntry.adapterKind,
      profile.adapterKind,
      `adapter readiness: ${entryId} adapter kind matches execution-admission profile`,
    );
    ok(
      matrixEntry.requiredHandoffArtifacts.includes('attestor-release-authorization'),
      `adapter readiness: ${entryId} keeps release authorization as a required artifact`,
    );
    equal(
      matrixEntry.privateDataBoundary.rawPayloadStored,
      false,
      `adapter readiness: ${entryId} matrix declares no raw payload storage`,
    );
  }
}

function testManifestWithoutPlansNeedsEvidenceForEverySurface(): void {
  const manifest = createCryptoAdapterReadinessManifest({
    generatedAt: '2026-05-11T07:31:00.000Z',
    scopeRef: 'crypto-intelligence-step-04',
  });

  equal(
    manifest.version,
    CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
    'adapter readiness: manifest exposes version',
  );
  equal(manifest.coverage.totalEntries, 11, 'adapter readiness: matrix has 11 entries');
  equal(manifest.coverage.readyCount, 0, 'adapter readiness: no plan means nothing is ready');
  equal(
    manifest.coverage.needsEvidenceCount,
    11,
    'adapter readiness: no plan requires evidence for every adapter',
  );
  equal(
    manifest.entries.find((entry) => entry.matrixEntryId === 'wallet-call-api')
      ?.status,
    'needs-evidence',
    'adapter readiness: wallet RPC needs evidence without an admission plan',
  );
  ok(
    manifest.entries
      .find((entry) => entry.matrixEntryId === 'wallet-call-api')
      ?.missingEvidenceClasses.includes('wallet-capabilities'),
    'adapter readiness: wallet RPC missing evidence names wallet capabilities',
  );
  equal(manifest.rawPayloadStored, false, 'adapter readiness: manifest stores no raw payload');
  equal(
    manifest.privatePolicyThresholdsStored,
    false,
    'adapter readiness: manifest stores no private policy thresholds',
  );
  ok(manifest.digest.startsWith('sha256:'), 'adapter readiness: manifest has digest');
}

function testManifestClassifiesReadyBlockedAndMissingAdapters(): void {
  const walletPlan = planFixture({
    adapterKind: 'wallet-call-api',
    surface: 'wallet-rpc',
    outcome: 'admit',
    steps: [
      step({
        stepId: 'preflight:wallet-capabilities',
        kind: 'prepare-wallet-call',
        source: 'wallet-capabilities',
        status: 'satisfied',
      }),
      step({
        stepId: 'preflight:wallet-call-preparation',
        kind: 'prepare-wallet-call',
        source: 'wallet-call-preparation',
        status: 'satisfied',
      }),
      step({
        stepId: 'submit-execution',
        kind: 'prepare-wallet-call',
        source: 'admission-planner',
        status: 'required',
      }),
      step({
        stepId: 'record-admission-receipt',
        kind: 'record-admission-receipt',
        surface: 'attestor-core',
        source: 'admission-planner',
        status: 'required',
      }),
    ],
  });
  const bundlerPlan = planFixture({
    adapterKind: 'erc-4337-user-operation',
    surface: 'account-abstraction-bundler',
    outcome: 'deny',
    blockedReasons: ['erc-7562-validation-failed'],
    steps: [
      step({
        stepId: 'preflight:erc-7562-validation-scope',
        kind: 'simulate-user-operation',
        surface: 'account-abstraction-bundler',
        source: 'erc-7562-validation-scope',
        status: 'blocked',
        reasonCode: 'erc-7562-validation-failed',
      }),
    ],
  });
  const manifest = createCryptoAdapterReadinessManifest({
    generatedAt: '2026-05-11T07:32:00.000Z',
    plans: [walletPlan, bundlerPlan],
  });
  const walletEntry = manifest.entries.find(
    (entry) => entry.matrixEntryId === 'wallet-call-api',
  );
  const bundlerEntry = manifest.entries.find(
    (entry) => entry.matrixEntryId === 'erc-4337-user-operation',
  );
  const x402Entry = manifest.entries.find((entry) => entry.matrixEntryId === 'x402-payment');

  equal(walletEntry?.status, 'ready', 'adapter readiness: admitted wallet plan is ready');
  deepEqual(
    walletEntry?.missingEvidenceClasses,
    [],
    'adapter readiness: terminal submit and receipt steps do not create missing preflight evidence',
  );
  equal(
    walletEntry?.readyPlanDigest,
    walletPlan.digest,
    'adapter readiness: ready entry carries the admitted plan digest',
  );
  equal(bundlerEntry?.status, 'blocked', 'adapter readiness: denied bundler plan blocks');
  ok(
    bundlerEntry?.missingEvidenceClasses.includes('erc-7562-validation-scope'),
    'adapter readiness: blocked bundler entry names validation-scope evidence',
  );
  ok(
    bundlerEntry?.modelSafeFeedback.includes('blocked:erc-7562-validation-failed'),
    'adapter readiness: blocked feedback stays reason-code based',
  );
  equal(x402Entry?.status, 'needs-evidence', 'adapter readiness: unmatched x402 remains missing');
  equal(manifest.coverage.readyCount, 1, 'adapter readiness: coverage counts ready entries');
  equal(manifest.coverage.blockedCount, 1, 'adapter readiness: coverage counts blocked entries');
  equal(
    manifest.coverage.needsEvidenceCount,
    9,
    'adapter readiness: coverage counts remaining missing entries',
  );
  ok(
    !manifest.canonical.includes('0x1111111111111111111111111111111111111111'),
    'adapter readiness: manifest canonical payload does not leak raw account addresses',
  );
}

function testDescriptorAndDeterminism(): void {
  const descriptor = cryptoAdapterReadinessManifestDescriptor();
  const first = createCryptoAdapterReadinessManifest({
    generatedAt: '2026-05-11T07:33:00.000Z',
    scopeRef: 'crypto-intelligence-step-04',
  });
  const second = createCryptoAdapterReadinessManifest({
    generatedAt: '2026-05-11T07:33:00.000Z',
    scopeRef: 'crypto-intelligence-step-04',
  });

  equal(
    descriptor.matrixEntryCount,
    11,
    'adapter readiness: descriptor exposes matrix entry count',
  );
  ok(
    descriptor.surfaces.includes('custody-policy-engine'),
    'adapter readiness: descriptor covers custody policy engine',
  );
  ok(
    descriptor.standards.includes('EIP-7702'),
    'adapter readiness: descriptor includes delegated EOA standard',
  );
  equal(first.digest, second.digest, 'adapter readiness: manifest digest is deterministic');
  ok(
    cryptoAdapterReadinessManifestLabel(first).includes('needs-evidence:11'),
    'adapter readiness: label summarizes coverage',
  );
}

testMatrixMatchesExecutionAdmissionProfiles();
testManifestWithoutPlansNeedsEvidenceForEverySurface();
testManifestClassifiesReadyBlockedAndMissingAdapters();
testDescriptorAndDeterminism();

console.log(`crypto-execution-admission-adapter-readiness-manifest: ${passed} assertions passed`);
