import assert from 'node:assert/strict';
import {
  CRYPTO_ADAPTER_READINESS_MANIFEST_SPEC_VERSION,
  CRYPTO_ADAPTER_READINESS_MATRIX,
  CRYPTO_EXECUTION_ADMISSION_ADAPTER_PROFILES,
  createCryptoAdapterReadinessManifest,
  createCryptoAdapterReadinessIntelligenceProfile,
  cryptoAdapterReadinessIntelligenceDescriptor,
  cryptoAdapterReadinessIntelligenceProfileLabel,
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

function testIntelligenceProfilePrioritizesReadinessWork(): void {
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
    ],
  });
  const x402Plan = planFixture({
    adapterKind: 'x402-payment',
    surface: 'agent-payment-http',
    outcome: 'needs-evidence',
    steps: [
      step({
        stepId: 'preflight:x402-payment',
        kind: 'verify-http-payment',
        surface: 'agent-payment-http',
        source: 'x402-payment',
        status: 'required',
        reasonCode: 'x402-payment-verification-missing',
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
    generatedAt: '2026-05-11T07:34:00.000Z',
    scopeRef: 'crypto-engine-hardening-ii-step-01',
    plans: [walletPlan, x402Plan, bundlerPlan],
  });
  const profile = createCryptoAdapterReadinessIntelligenceProfile({ manifest });
  const descriptor = cryptoAdapterReadinessIntelligenceDescriptor();
  const walletEntry = profile.entries.find(
    (entry) => entry.matrixEntryId === 'wallet-call-api',
  );
  const x402Entry = profile.entries.find((entry) => entry.matrixEntryId === 'x402-payment');
  const bundlerEntry = profile.entries.find(
    (entry) => entry.matrixEntryId === 'erc-4337-user-operation',
  );

  equal(
    descriptor.version,
    'attestor.crypto-adapter-readiness-intelligence.v1',
    'adapter readiness intelligence: descriptor exposes version',
  );
  ok(
    descriptor.riskFactorKinds.includes('account-abstraction-validation-review'),
    'adapter readiness intelligence: descriptor exposes account abstraction review factor',
  );
  equal(
    walletEntry?.posture,
    'execution-ready',
    'adapter readiness intelligence: admitted wallet plan is execution-ready',
  );
  equal(
    walletEntry?.readinessScore,
    100,
    'adapter readiness intelligence: ready wallet plan receives full score',
  );
  equal(
    x402Entry?.posture,
    'review-required',
    'adapter readiness intelligence: partial x402 plan routes to review',
  );
  equal(
    x402Entry?.nextAction,
    'run-required-preflight',
    'adapter readiness intelligence: x402 missing preflight points to preflight action',
  );
  ok(
    x402Entry?.riskFactors.some(
      (factor) => factor.kind === 'http-payment-verification-review',
    ),
    'adapter readiness intelligence: x402 payment verification is a first-class factor',
  );
  equal(
    bundlerEntry?.posture,
    'blocked',
    'adapter readiness intelligence: denied bundler plan is blocked',
  );
  ok(
    bundlerEntry?.riskFactors.some(
      (factor) => factor.kind === 'account-abstraction-validation-review',
    ),
    'adapter readiness intelligence: ERC-4337 validation review is surfaced',
  );
  equal(
    profile.summary.executionReadyCount,
    1,
    'adapter readiness intelligence: summary counts ready entries',
  );
  equal(
    profile.summary.reviewRequiredCount,
    1,
    'adapter readiness intelligence: summary counts partial plan review entries',
  );
  equal(
    profile.summary.blockedCount,
    1,
    'adapter readiness intelligence: summary counts blocked entries',
  );
  equal(
    profile.summary.evidenceRequiredCount,
    8,
    'adapter readiness intelligence: summary counts missing-plan entries',
  );
  ok(
    profile.summary.topRiskFactorKinds.some(
      (entry) => entry.value === 'admission-plan-missing',
    ),
    'adapter readiness intelligence: top factors prioritize missing admission plans',
  );
  ok(
    profile.summary.standardsCoverage.some(
      (entry) => entry.standard === 'ERC-4337' && entry.blockedCount > 0,
    ),
    'adapter readiness intelligence: standards coverage captures blocked ERC-4337 posture',
  );
  equal(
    profile.rawPayloadStored,
    false,
    'adapter readiness intelligence: profile stores no raw payload',
  );
  ok(
    !profile.canonical.includes('0x1111111111111111111111111111111111111111'),
    'adapter readiness intelligence: canonical output excludes raw wallet address',
  );
  ok(
    cryptoAdapterReadinessIntelligenceProfileLabel(profile).includes('blocked:1'),
    'adapter readiness intelligence: label summarizes blocked posture',
  );
}

testMatrixMatchesExecutionAdmissionProfiles();
testManifestWithoutPlansNeedsEvidenceForEverySurface();
testManifestClassifiesReadyBlockedAndMissingAdapters();
testDescriptorAndDeterminism();
testIntelligenceProfilePrioritizesReadinessWork();

console.log(`crypto-execution-admission-adapter-readiness-manifest: ${passed} assertions passed`);
