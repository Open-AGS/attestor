import assert from 'node:assert/strict';
import {
  CUSTODY_COSIGNER_AUTH_METHODS,
  CUSTODY_COSIGNER_OUTCOMES,
  CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  CUSTODY_COSIGNER_RESPONSE_ACTIONS,
  CUSTODY_COSIGNER_CHECKS,
  CUSTODY_KEY_TYPES,
  CUSTODY_POLICY_DECISION_STATUSES,
  CUSTODY_POLICY_EFFECTS,
  CUSTODY_POLICY_PROVIDERS,
  CUSTODY_POST_EXECUTION_STATUSES,
  createCustodyCosignerPolicyPreflight,
  custodyCosignerPolicyAdapterDescriptor,
  custodyCosignerPolicyPreflightLabel,
  simulateCustodyCosignerPolicyAuthorization,
} from '../src/crypto-authorization-core/custody-cosigner-policy-adapter.js';
import {
  DESTINATION_ADDRESS,
  OTHER_ADDRESS,
  USDC_MAINNET,
  approvals,
  callback,
  fixtureSuite,
  keyPosture,
  policyDecision,
  postExecution,
  preflightInput,
  screening,
  transaction,
} from './crypto-authorization-core-custody-cosigner-policy-adapter-fixtures.js';

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

function testDescriptor(): void {
  const descriptor = custodyCosignerPolicyAdapterDescriptor();

  equal(
    descriptor.version,
    CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
    'custody adapter: descriptor exposes version',
  );
  equal(
    descriptor.adapterKind,
    'custody-cosigner',
    'custody adapter: descriptor exposes adapter kind',
  );
  deepEqual(
    descriptor.providers,
    CUSTODY_POLICY_PROVIDERS,
    'custody adapter: descriptor exposes providers',
  );
  deepEqual(
    descriptor.policyEffects,
    CUSTODY_POLICY_EFFECTS,
    'custody adapter: descriptor exposes policy effects',
  );
  deepEqual(
    descriptor.decisionStatuses,
    CUSTODY_POLICY_DECISION_STATUSES,
    'custody adapter: descriptor exposes decision statuses',
  );
  deepEqual(
    descriptor.authMethods,
    CUSTODY_COSIGNER_AUTH_METHODS,
    'custody adapter: descriptor exposes co-signer auth methods',
  );
  deepEqual(
    descriptor.responseActions,
    CUSTODY_COSIGNER_RESPONSE_ACTIONS,
    'custody adapter: descriptor exposes response actions',
  );
  deepEqual(
    descriptor.keyTypes,
    CUSTODY_KEY_TYPES,
    'custody adapter: descriptor exposes key types',
  );
  deepEqual(
    descriptor.postExecutionStatuses,
    CUSTODY_POST_EXECUTION_STATUSES,
    'custody adapter: descriptor exposes post execution statuses',
  );
  deepEqual(
    descriptor.outcomes,
    CUSTODY_COSIGNER_OUTCOMES,
    'custody adapter: descriptor exposes outcomes',
  );
  deepEqual(
    descriptor.checks,
    CUSTODY_COSIGNER_CHECKS,
    'custody adapter: descriptor exposes checks',
  );
  ok(
    descriptor.references.includes('Fireblocks API co-signer callback'),
    'custody adapter: descriptor names Fireblocks co-signer callbacks',
  );
  ok(
    descriptor.references.includes('Turnkey policy engine'),
    'custody adapter: descriptor names Turnkey policy engine',
  );
}

function testCreatesAllowPreflight(): void {
  const input = preflightInput();
  const preflight = createCustodyCosignerPolicyPreflight(input);
  const second = createCustodyCosignerPolicyPreflight(input);

  equal(
    preflight.version,
    CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
    'custody adapter: preflight carries version',
  );
  equal(
    preflight.adapterKind,
    'custody-cosigner',
    'custody adapter: preflight carries adapter kind',
  );
  equal(
    preflight.outcome,
    'allow',
    'custody adapter: complete custody policy preflight allows',
  );
  equal(
    preflight.signal.source,
    'custody-policy',
    'custody adapter: emits custody-policy simulation source',
  );
  equal(
    preflight.signal.status,
    'pass',
    'custody adapter: allow signal passes',
  );
  equal(
    preflight.provider,
    'fireblocks',
    'custody adapter: preflight binds provider',
  );
  equal(
    preflight.chain,
    'eip155:1',
    'custody adapter: preflight binds CAIP-2 chain',
  );
  equal(
    preflight.asset,
    USDC_MAINNET,
    'custody adapter: preflight binds asset',
  );
  equal(
    preflight.amount,
    '2500000000',
    'custody adapter: preflight binds atomic amount',
  );
  equal(
    preflight.destinationAddress,
    DESTINATION_ADDRESS,
    'custody adapter: preflight binds destination',
  );
  equal(
    preflight.digest,
    second.digest,
    'custody adapter: preflight digest is deterministic',
  );
  ok(
    preflight.observations.every((entry) => entry.status === 'pass'),
    'custody adapter: all allow observations pass',
  );
  ok(
    custodyCosignerPolicyPreflightLabel(preflight).includes('outcome:allow'),
    'custody adapter: label includes outcome',
  );
}

function testSimulationAllowsCustodyWithdrawal(): void {
  const result = simulateCustodyCosignerPolicyAuthorization(preflightInput());

  equal(
    result.preflight.outcome,
    'allow',
    'custody adapter: simulation wrapper carries allow preflight',
  );
  equal(
    result.simulation.outcome,
    'allow-preview',
    'custody adapter: custody execution allows simulation preview',
  );
  equal(
    result.simulation.readiness.adapterPreflight,
    'ready',
    'custody adapter: simulation adapter preflight is ready',
  );
  deepEqual(
    result.simulation.requiredPreflightSources,
    ['custody-policy'],
    'custody adapter: simulation requires custody policy evidence',
  );
  deepEqual(
    result.simulation.requiredNextArtifacts,
    [],
    'custody adapter: allow simulation has no required next artifacts',
  );
}

function testPendingPolicyRequiresReview(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    policyDecision: policyDecision({
      effect: 'review-required',
      status: 'pending',
    }),
  });

  equal(
    preflight.outcome,
    'review-required',
    'custody adapter: pending custody policy decision requires review',
  );
  equal(
    preflight.signal.status,
    'warn',
    'custody adapter: pending policy signal warns',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-policy-decision-pending-review'),
    'custody adapter: pending policy reason is present',
  );
}

function testQuorumPendingBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    approvals: approvals({
      collectedApprovals: 1,
      quorumSatisfied: false,
      approverIds: ['ops-approver-a'],
      collectedRoles: ['treasury-ops'],
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: incomplete approval quorum blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-approval-quorum-pending'),
    'custody adapter: quorum pending reason is present',
  );
  ok(
    preflight.observations.some((entry) =>
      entry.code === 'custody-approval-quorum-pending' && entry.status === 'fail'),
    'custody adapter: quorum pending is a hard failure',
  );
}

function testExplicitDenyBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    policyDecision: policyDecision({
      effect: 'deny',
      status: 'denied',
      explicitDeny: true,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: explicit custody policy deny blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-policy-explicit-deny'),
    'custody adapter: explicit deny reason is present',
  );
}

function testImplicitDenyBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    policyDecision: policyDecision({
      matched: false,
      implicitDeny: true,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: implicit custody policy deny blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-policy-implicit-deny'),
    'custody adapter: implicit deny reason is present',
  );
}

function testDestinationMismatchBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    transaction: transaction({
      destinationAddress: OTHER_ADDRESS,
      destinationRef: 'custody-destination:other',
      targetId: 'custody-destination:other',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: destination mismatch blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-destination-mismatch'),
    'custody adapter: destination mismatch reason is present',
  );
}

function testAmountLimitBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    transaction: transaction({
      amount: '6000000000',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: amount over intent limit blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-chain-asset-amount-mismatch'),
    'custody adapter: amount mismatch reason is present',
  );
}

function testReplayBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    transaction: transaction({
      idempotencyFresh: false,
      duplicateRequestDetected: true,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: duplicate custody request blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-idempotency-replay-risk'),
    'custody adapter: replay reason is present',
  );
}

function testCallbackAuthenticationBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    callback: callback({
      authenticated: false,
      signatureValid: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: unauthenticated co-signer callback blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-cosigner-callback-authentication-failed'),
    'custody adapter: callback auth failure reason is present',
  );
}

function testStaleCallbackBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    callback: callback({
      nonceFresh: false,
      responseWithinSeconds: 35,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: stale co-signer callback blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-cosigner-callback-replay-risk'),
    'custody adapter: callback freshness reason is present',
  );
}

function testCosignerPendingReviewRequiresReview(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    callback: callback({
      responseAction: 'pending-review',
    }),
  });

  equal(
    preflight.outcome,
    'review-required',
    'custody adapter: pending co-signer response requires review',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-cosigner-response-review-required'),
    'custody adapter: co-signer pending reason is present',
  );
}

function testScreeningBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    screening: screening({
      sanctionsHit: true,
      riskScore: 95,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: sanctions or risk hit blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-screening-risk-blocked'),
    'custody adapter: screening risk reason is present',
  );
}

function testVelocityLimitBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    screening: screening({
      velocityLimitRemainingAtomic: '1000000',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: velocity limit exhaustion blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-velocity-or-limit-exceeded'),
    'custody adapter: velocity limit reason is present',
  );
}

function testUnsafeKeyPostureBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    keyPosture: keyPosture({
      keyExportable: true,
      cosignerHealthy: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: unsafe key posture blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-key-posture-unsafe'),
    'custody adapter: key posture reason is present',
  );
}

function testDutySeparationBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    approvals: approvals({
      requesterApproved: true,
      dutySeparationSatisfied: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: self-approval blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-duty-separation-violated'),
    'custody adapter: duty separation reason is present',
  );
}

function testAuthorizedBreakGlassRequiresReview(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    approvals: approvals({
      breakGlassUsed: true,
      breakGlassAuthorized: true,
    }),
  });

  equal(
    preflight.outcome,
    'review-required',
    'custody adapter: authorized break-glass requires review posture',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-break-glass-authorized-review'),
    'custody adapter: break-glass review reason is present',
  );
}

function testFailedProviderStatusBlocks(): void {
  const preflight = createCustodyCosignerPolicyPreflight({
    ...preflightInput(),
    postExecution: postExecution({
      status: 'failed',
      providerStatus: 'FAILED',
      failureReason: 'provider_rejected',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'custody adapter: failed provider terminal status blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'custody-post-execution-status-failed'),
    'custody adapter: failed provider status reason is present',
  );
}

function testWrongAdapterThrows(): void {
  assert.throws(
    () =>
      createCustodyCosignerPolicyPreflight({
        ...preflightInput(),
        ...fixtureSuite('wallet-call-api'),
      }),
    /requires intent execution adapter custody-cosigner/u,
    'custody adapter: wrong adapter throws',
  );
  passed += 1;
}

testDescriptor();
testCreatesAllowPreflight();
testSimulationAllowsCustodyWithdrawal();
testPendingPolicyRequiresReview();
testQuorumPendingBlocks();
testExplicitDenyBlocks();
testImplicitDenyBlocks();
testDestinationMismatchBlocks();
testAmountLimitBlocks();
testReplayBlocks();
testCallbackAuthenticationBlocks();
testStaleCallbackBlocks();
testCosignerPendingReviewRequiresReview();
testScreeningBlocks();
testVelocityLimitBlocks();
testUnsafeKeyPostureBlocks();
testDutySeparationBlocks();
testAuthorizedBreakGlassRequiresReview();
testFailedProviderStatusBlocks();
testWrongAdapterThrows();

console.log(`crypto-authorization-core-custody-cosigner-policy-adapter: ${passed} checks passed`);
