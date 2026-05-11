import assert from 'node:assert/strict';
import {
  CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
  createConsequenceAdmissionPackDecisionProfile,
  consequenceAdmissionDescriptor,
  consequenceAdmissionPackDecisionProfileDescriptor,
  consequenceAdmissionPackDecisionProfileLabel,
  createCryptoExecutionPlanAdmissionResponse,
  createFinancePipelineAdmissionRequest,
  createFinancePipelineAdmissionResponse,
  evaluateConsequenceDataMinimizationArtifact,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  type FinancePipelineAdmissionRun,
} from '../src/consequence-admission/index.js';
import {
  createCryptoExecutionAdmissionPlan,
  type CryptoExecutionAdmissionPlan,
} from '../src/crypto-execution-admission/index.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationObservation,
  CryptoSimulationPreflightSource,
} from '../src/crypto-authorization-core/authorization-simulation.js';
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

function financeRequest() {
  return createFinancePipelineAdmissionRequest({
    requestedAt: '2026-05-11T16:00:00.000Z',
    runId: 'run_pack_decision_finance',
    tenantId: 'tenant_pack_decision',
    environment: 'hosted',
  });
}

function financeRun(overrides: Partial<FinancePipelineAdmissionRun> = {}):
FinancePipelineAdmissionRun {
  return {
    runId: 'run_pack_decision_finance',
    decision: 'pass',
    proofMode: 'fixture',
    warrant: 'issued',
    escrow: 'released',
    receipt: 'issued',
    capsule: 'closed',
    auditChainIntact: true,
    certificate: {
      certificateId: 'cert_pack_decision',
      signing: {
        fingerprint: 'fingerprint_pack_decision',
      },
    },
    verification: {
      path: '.attestor/verification/pack-decision.json',
      digest: 'sha256:verification',
    },
    tenantContext: {
      tenantId: 'tenant_pack_decision',
      source: 'hosted',
      planId: 'starter',
    },
    usage: {
      used: 10,
      remaining: 90,
      quota: 100,
      enforced: true,
    },
    rateLimit: {
      remaining: 20,
      resetAt: '2026-05-11T17:00:00.000Z',
      enforced: true,
    },
    ...overrides,
  };
}

function observation(
  source: CryptoSimulationPreflightSource,
  status: CryptoSimulationObservation['status'],
): CryptoSimulationObservation {
  return {
    check: 'adapter-preflight-readiness',
    source,
    status,
    severity: status === 'fail' ? 'critical' : status === 'pass' ? 'info' : 'warning',
    code: status === 'pass' ? `${source}-ready` : `${source}-missing`,
    message: status === 'pass'
      ? `${source} preflight passed.`
      : `${source} preflight is required.`,
    required: true,
    evidence: {
      source,
      status,
    },
  };
}

function simulation(input: {
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly outcome: CryptoAuthorizationSimulationResult['outcome'];
  readonly requiredPreflightSources?: readonly CryptoSimulationPreflightSource[];
  readonly preflightStatus?: CryptoSimulationObservation['status'];
  readonly adapterReady?: boolean;
}): CryptoAuthorizationSimulationResult {
  const requiredPreflightSources = input.requiredPreflightSources ?? [];
  const preflightStatus = input.preflightStatus ?? 'pass';
  const adapterReady = input.adapterReady ?? true;

  return {
    version: 'attestor.crypto-authorization-simulation.v1',
    simulationId: `simulation-${input.adapterKind ?? 'neutral'}`,
    simulatedAt: '2026-05-11T16:00:00.000Z',
    intentId: `intent-${input.adapterKind ?? 'neutral'}`,
    consequenceKind: input.adapterKind === 'erc-4337-user-operation'
      ? 'user-operation'
      : input.adapterKind === 'eip-7702-delegation'
        ? 'account-delegation'
        : 'agent-payment',
    adapterKind: input.adapterKind,
    chainId: 'eip155:8453',
    accountAddress: '0x1111111111111111111111111111111111111111',
    riskClass: 'R3',
    reviewAuthorityMode: 'dual-approval',
    outcome: input.outcome,
    confidence: 'medium',
    reasonCodes: input.outcome === 'deny-preview' ? ['blocked-by-simulation'] : [],
    readiness: {
      releaseBinding: 'ready',
      policyBinding: 'ready',
      enforcementBinding: 'ready',
      adapterPreflight: adapterReady
        ? 'ready'
        : preflightStatus === 'fail'
          ? 'blocked'
          : 'missing',
    },
    requiredPreflightSources,
    recommendedPreflightSources: [],
    observations: requiredPreflightSources.map((source) =>
      observation(source, preflightStatus),
    ),
    requiredNextArtifacts: adapterReady ? [] : ['missing-adapter-evidence'],
    releaseBindingDigest: 'sha256:release',
    policyScopeDigest: 'sha256:policy',
    enforcementBindingDigest: 'sha256:enforcement',
    operatorNote: null,
    canonical: '{}',
    digest: `sha256:${input.adapterKind ?? 'neutral'}-${input.outcome}`,
  };
}

function cryptoPlan(input: {
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly outcome: CryptoAuthorizationSimulationResult['outcome'];
  readonly requiredPreflightSources?: readonly CryptoSimulationPreflightSource[];
  readonly preflightStatus?: CryptoSimulationObservation['status'];
  readonly adapterReady?: boolean;
}): CryptoExecutionAdmissionPlan {
  return createCryptoExecutionAdmissionPlan({
    simulation: simulation(input),
    createdAt: '2026-05-11T16:00:01.000Z',
    integrationRef: input.adapterKind
      ? `integration:${input.adapterKind}`
      : 'integration:adapter-neutral',
  });
}

function testDescriptorAndDataMinimizationSurface(): void {
  const descriptor = consequenceAdmissionPackDecisionProfileDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const dataMinimization = consequenceDataMinimizationRedactionPolicyDescriptor();
  const evaluation = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'pack-decision-profile',
    exposedUnits: ['reason-codes', 'digests', 'counts', 'status'],
  });

  equal(
    descriptor.version,
    CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    'pack decision profile: descriptor exposes version',
  );
  ok(
    descriptor.supportedPackFamilies.includes('finance'),
    'pack decision profile: finance pack is supported',
  );
  ok(
    descriptor.supportedPackFamilies.includes('crypto'),
    'pack decision profile: crypto pack is supported',
  );
  ok(
    descriptor.signalKinds.includes('crypto-adapter-readiness-posture'),
    'pack decision profile: crypto adapter signal is exposed',
  );
  equal(
    admissionDescriptor.packDecisionProfileVersion,
    CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    'pack decision profile: consequence descriptor exposes version',
  );
  ok(
    dataMinimization.surfaceKinds.includes('pack-decision-profile'),
    'pack decision profile: data minimization covers profile surface',
  );
  equal(evaluation.allowed, true, 'pack decision profile: allowed units are privacy-safe');
}

function testFinanceAcceptedReleaseIsExecutionReady(): void {
  const response = createFinancePipelineAdmissionResponse({
    request: financeRequest(),
    run: financeRun({
      release: {
        filingExport: {
          decisionId: 'release_decision_pack',
          decisionStatus: 'accepted',
          policyVersion: 'finance-policy-v1',
          tokenId: 'release_token_pack',
          expiresAt: '2026-05-11T17:00:00.000Z',
          evidencePackId: 'evidence_pack_pack',
          evidencePackDigest: 'sha256:evidence-pack',
        },
      },
    }),
    decidedAt: '2026-05-11T16:00:02.000Z',
  });
  const profile = createConsequenceAdmissionPackDecisionProfile(response);

  equal(profile.packFamily, 'finance', 'pack decision profile: finance pack is preserved');
  equal(profile.posture, 'execution-ready', 'pack decision profile: finance release is ready');
  equal(profile.recommendedAction, 'proceed', 'pack decision profile: finance release can proceed');
  equal(profile.proofSummary.hasReleaseToken, true, 'pack decision profile: release token is detected');
  equal(profile.proofSummary.hasEvidencePack, true, 'pack decision profile: evidence pack is detected');
  equal(profile.facts.releaseDecisionPresent, true, 'pack decision profile: release decision presence is summarized');
  equal(profile.rawPayloadStored, false, 'pack decision profile: raw payload is not stored');
  ok(
    !profile.canonical.includes('tenant_pack_decision'),
    'pack decision profile: canonical profile excludes raw tenant id',
  );
}

function testFinanceMissingAuthorityRoutesToRequiredCheckResolution(): void {
  const response = createFinancePipelineAdmissionResponse({
    request: financeRequest(),
    run: financeRun({
      proofMode: 'missing',
      warrant: 'missing',
      escrow: 'held',
      receipt: 'missing',
      capsule: 'open',
      auditChainIntact: false,
      certificate: null,
      verification: null,
    }),
    decidedAt: '2026-05-11T16:00:02.000Z',
  });
  const profile = createConsequenceAdmissionPackDecisionProfile(response);

  equal(profile.decision, 'review', 'pack decision profile: failed finance pass becomes review');
  equal(profile.posture, 'human-review-required', 'pack decision profile: failed checks require review');
  equal(profile.recommendedAction, 'resolve-required-checks', 'pack decision profile: required failures are actionable');
  ok(
    profile.signals.some((signal) => signal.kind === 'required-check-failure'),
    'pack decision profile: required check failure signal is present',
  );
  ok(
    profile.modelSafeFeedback.includes('signal:finance-authority-chain-posture'),
    'pack decision profile: model-safe feedback names authority posture',
  );
}

function testFinanceReviewQueueRoutesToFinanceReview(): void {
  const response = createFinancePipelineAdmissionResponse({
    request: financeRequest(),
    run: financeRun({
      release: {
        filingExport: {
          decisionId: 'release_decision_review',
          decisionStatus: 'review-required',
          reviewQueueId: 'review_queue_pack',
        },
      },
    }),
    decidedAt: '2026-05-11T16:00:02.000Z',
  });
  const profile = createConsequenceAdmissionPackDecisionProfile(response);

  equal(profile.posture, 'human-review-required', 'pack decision profile: review queue is human review');
  equal(profile.recommendedAction, 'route-to-finance-review', 'pack decision profile: finance review queue is routed');
  ok(
    profile.signals.some((signal) =>
      signal.reasonCodes.includes('finance-review-queue-present'),
    ),
    'pack decision profile: review queue signal is present',
  );
}

function testCryptoNeedsEvidenceRunsPreflightWithoutRawWalletLeak(): void {
  const plan = cryptoPlan({
    adapterKind: 'erc-4337-user-operation',
    outcome: 'review-required',
    requiredPreflightSources: ['erc-4337-validation', 'erc-7562-validation-scope'],
    preflightStatus: 'not-run',
    adapterReady: false,
  });
  const response = createCryptoExecutionPlanAdmissionResponse({
    plan,
    decidedAt: '2026-05-11T16:00:02.000Z',
  });
  const profile = createConsequenceAdmissionPackDecisionProfile(response);

  equal(profile.packFamily, 'crypto', 'pack decision profile: crypto pack is preserved');
  equal(profile.posture, 'human-review-required', 'pack decision profile: crypto needs evidence requires review');
  equal(profile.recommendedAction, 'run-crypto-preflight', 'pack decision profile: crypto preflight is the next action');
  equal(profile.proofSummary.hasAdmissionPlan, true, 'pack decision profile: admission plan proof is detected');
  equal(profile.facts.hostedRouteClaimed, false, 'pack decision profile: crypto hosted route is not claimed');
  equal(profile.facts.planDigestPresent, true, 'pack decision profile: plan digest presence is summarized');
  ok(
    profile.signals.some((signal) => signal.kind === 'crypto-adapter-readiness-posture'),
    'pack decision profile: adapter readiness signal is present',
  );
  ok(
    !profile.canonical.includes('0x1111111111111111111111111111111111111111'),
    'pack decision profile: canonical profile excludes raw wallet address',
  );
}

function testCryptoDenyBlocksDownstream(): void {
  const plan = cryptoPlan({
    adapterKind: 'eip-7702-delegation',
    outcome: 'deny-preview',
    requiredPreflightSources: ['eip-7702-authorization'],
    preflightStatus: 'fail',
    adapterReady: false,
  });
  const response = createCryptoExecutionPlanAdmissionResponse({
    plan,
    decidedAt: '2026-05-11T16:00:02.000Z',
  });
  const profile = createConsequenceAdmissionPackDecisionProfile(response);

  equal(profile.decision, 'block', 'pack decision profile: crypto deny maps to block');
  equal(profile.posture, 'blocked', 'pack decision profile: blocked crypto plan is blocked');
  equal(profile.recommendedAction, 'block-downstream', 'pack decision profile: blocked crypto plan blocks downstream');
  ok(
    profile.signals.some((signal) => signal.kind === 'crypto-plan-posture'),
    'pack decision profile: crypto plan posture signal is present',
  );
  ok(
    consequenceAdmissionPackDecisionProfileLabel(profile).includes('action:block-downstream'),
    'pack decision profile: label includes recommended action',
  );
}

testDescriptorAndDataMinimizationSurface();
testFinanceAcceptedReleaseIsExecutionReady();
testFinanceMissingAuthorityRoutesToRequiredCheckResolution();
testFinanceReviewQueueRoutesToFinanceReview();
testCryptoNeedsEvidenceRunsPreflightWithoutRawWalletLeak();
testCryptoDenyBlocksDownstream();

console.log(`consequence-admission-pack-decision-profile: ${passed} assertions passed`);
