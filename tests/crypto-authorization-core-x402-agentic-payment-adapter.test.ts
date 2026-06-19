import assert from 'node:assert/strict';
import {
  X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
  X402_CHECKS,
  X402_EXACT_AUTHORIZATION_MODES,
  X402_FACILITATOR_PATHS,
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  X402_OUTCOMES,
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_RESPONSE_HEADER,
  X402_PAYMENT_SCHEMES,
  X402_PAYMENT_SIGNATURE_HEADER,
  X402_PROTOCOL_VERSION,
  createX402AgenticPaymentPreflight,
  simulateX402AgenticPaymentAuthorization,
  x402AgenticPaymentAdapterDescriptor,
  x402AgenticPaymentPreflightLabel,
} from '../src/crypto-authorization-core/x402-agentic-payment-adapter.js';
import {
  OTHER_ADDRESS,
  PAY_TO_ADDRESS,
  authorization,
  budget,
  facilitator,
  fixtureSuite,
  payload,
  preflightInput,
  privacy,
  requirements,
  resource,
  serviceTrust,
} from './crypto-authorization-core-x402-agentic-payment-adapter-fixtures.js';

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
  const descriptor = x402AgenticPaymentAdapterDescriptor();

  equal(
    descriptor.version,
    X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
    'x402 adapter: descriptor exposes version',
  );
  equal(
    descriptor.protocolVersion,
    X402_PROTOCOL_VERSION,
    'x402 adapter: descriptor exposes protocol version',
  );
  equal(
    descriptor.paymentRequiredStatus,
    X402_HTTP_PAYMENT_REQUIRED_STATUS,
    'x402 adapter: descriptor exposes HTTP 402 status',
  );
  equal(
    descriptor.headers.paymentRequired,
    X402_PAYMENT_REQUIRED_HEADER,
    'x402 adapter: descriptor exposes PAYMENT-REQUIRED header',
  );
  equal(
    descriptor.headers.paymentSignature,
    X402_PAYMENT_SIGNATURE_HEADER,
    'x402 adapter: descriptor exposes PAYMENT-SIGNATURE header',
  );
  equal(
    descriptor.headers.paymentResponse,
    X402_PAYMENT_RESPONSE_HEADER,
    'x402 adapter: descriptor exposes PAYMENT-RESPONSE header',
  );
  deepEqual(
    descriptor.schemes,
    X402_PAYMENT_SCHEMES,
    'x402 adapter: descriptor exposes schemes',
  );
  deepEqual(
    descriptor.authorizationModes,
    X402_EXACT_AUTHORIZATION_MODES,
    'x402 adapter: descriptor exposes exact authorization modes',
  );
  deepEqual(
    descriptor.facilitatorPaths,
    X402_FACILITATOR_PATHS,
    'x402 adapter: descriptor exposes facilitator paths',
  );
  deepEqual(
    descriptor.outcomes,
    X402_OUTCOMES,
    'x402 adapter: descriptor exposes outcomes',
  );
  deepEqual(
    descriptor.checks,
    X402_CHECKS,
    'x402 adapter: descriptor exposes checks',
  );
  ok(
    descriptor.references.includes('EIP-3009'),
    'x402 adapter: descriptor names EIP-3009',
  );
  ok(
    descriptor.references.includes('CAIP-2'),
    'x402 adapter: descriptor names CAIP-2',
  );
  ok(
    descriptor.references.includes('metadata-privacy-filtering'),
    'x402 adapter: descriptor names metadata privacy filtering',
  );
}

function testCreatesAllowPreflight(): void {
  const input = preflightInput();
  const preflight = createX402AgenticPaymentPreflight(input);
  const second = createX402AgenticPaymentPreflight(input);

  equal(
    preflight.version,
    X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
    'x402 adapter: preflight carries version',
  );
  equal(
    preflight.adapterKind,
    'x402-payment',
    'x402 adapter: preflight carries adapter kind',
  );
  equal(
    preflight.outcome,
    'allow',
    'x402 adapter: complete payment preflight allows',
  );
  equal(
    preflight.signal.source,
    'x402-payment',
    'x402 adapter: emits x402 simulation source',
  );
  equal(
    preflight.signal.status,
    'pass',
    'x402 adapter: allow signal passes',
  );
  equal(
    preflight.network,
    'eip155:8453',
    'x402 adapter: preflight binds CAIP-2 network',
  );
  equal(
    preflight.payTo,
    PAY_TO_ADDRESS,
    'x402 adapter: preflight binds payTo recipient',
  );
  equal(
    preflight.amount,
    '120000',
    'x402 adapter: preflight binds atomic amount',
  );
  equal(
    preflight.digest,
    second.digest,
    'x402 adapter: preflight digest is deterministic',
  );
  ok(
    preflight.observations.every((entry) => entry.status === 'pass'),
    'x402 adapter: all allow observations pass',
  );
  ok(
    x402AgenticPaymentPreflightLabel(preflight).includes('outcome:allow'),
    'x402 adapter: label includes outcome',
  );
}

function testSimulationAllowsPayment(): void {
  const result = simulateX402AgenticPaymentAuthorization(preflightInput());

  equal(
    result.preflight.outcome,
    'allow',
    'x402 adapter: simulation wrapper carries allow preflight',
  );
  equal(
    result.simulation.outcome,
    'allow-preview',
    'x402 adapter: payment execution allows simulation preview',
  );
  equal(
    result.simulation.readiness.adapterPreflight,
    'ready',
    'x402 adapter: simulation adapter preflight is ready',
  );
  deepEqual(
    result.simulation.requiredPreflightSources,
    ['x402-payment'],
    'x402 adapter: simulation requires x402 payment evidence',
  );
  deepEqual(
    result.simulation.requiredNextArtifacts,
    [],
    'x402 adapter: allow simulation has no required next artifacts',
  );
}

function testPermit2ExactModeAllows(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentPayload: payload({
      authorization: authorization({
        mode: 'permit2-transfer',
      }),
    }),
  });

  equal(
    preflight.outcome,
    'allow',
    'x402 adapter: Permit2 exact transfer mode allows on EVM networks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-exact-authorization-bound'),
    'x402 adapter: exact authorization observation is present',
  );
}

function testPendingSettlementRequiresReview(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    facilitator: facilitator({
      settleResponseSuccess: null,
      settlementTransaction: null,
      settlementNetwork: null,
      settlementPayer: null,
      settlementAmount: null,
      paymentResponseHeaderPresent: false,
    }),
  });

  equal(
    preflight.outcome,
    'review-required',
    'x402 adapter: verified but unsettled payment requires review',
  );
  equal(
    preflight.signal.status,
    'warn',
    'x402 adapter: pending settlement signal warns',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-settlement-pending-review'),
    'x402 adapter: pending settlement reason is present',
  );
}

function testSettlementSuccessWithoutTransactionBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    facilitator: facilitator({
      settleResponseSuccess: true,
      settlementTransaction: null,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: successful settlement without transaction evidence blocks',
  );
  ok(
    preflight.observations.some(
      (entry) =>
        entry.check === 'x402-settlement-posture' &&
        entry.status === 'fail' &&
        entry.code === 'x402-settlement-invalid',
    ),
    'x402 adapter: missing settlement transaction is an invalid settlement reason',
  );
}

function testBudgetExceededBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    budget: budget({
      spendUsedAtomic: '950000',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: budget overflow blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-agent-budget-cadence-exceeded'),
    'x402 adapter: budget overflow reason is present',
  );
}

function testCadenceExceededBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    budget: budget({
      requestsUsedInWindow: 10,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: cadence request limit blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.check === 'x402-agent-budget-cadence'),
    'x402 adapter: cadence check is present',
  );
}

function testRecipientMismatchBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentRequirements: requirements({
      payTo: OTHER_ADDRESS,
    }),
    paymentPayload: payload({
      payTo: OTHER_ADDRESS,
      authorization: authorization({
        to: OTHER_ADDRESS,
      }),
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: recipient mismatch blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-recipient-mismatch'),
    'x402 adapter: recipient mismatch reason is present',
  );
}

function testInvalidSignatureBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentPayload: payload({
      authorization: authorization({
        signatureValid: false,
      }),
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: invalid payment signature blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-payment-signature-payload-invalid'),
    'x402 adapter: invalid signature reason is present',
  );
}

function testReplayAndIdempotencyBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    budget: budget({
      idempotencyFresh: false,
      duplicatePaymentDetected: true,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: stale idempotency blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-replay-or-idempotency-risk'),
    'x402 adapter: replay/idempotency reason is present',
  );
}

function testUnredactedMetadataBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    privacy: privacy({
      piiDetected: true,
      piiRedacted: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: unredacted payment metadata blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-privacy-metadata-risk'),
    'x402 adapter: privacy risk reason is present',
  );
}

function testRedactedMetadataAllows(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    privacy: privacy({
      piiDetected: true,
      piiRedacted: true,
      sensitiveQueryDetected: true,
      sensitiveQueryRedacted: true,
    }),
  });

  equal(
    preflight.outcome,
    'allow',
    'x402 adapter: redacted metadata allows',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-privacy-metadata-ready'),
    'x402 adapter: privacy ready reason is present',
  );
}

function testFacilitatorUnsupportedBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    facilitator: facilitator({
      supportedKindAdvertised: false,
      signerTrusted: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: unsupported facilitator kind blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-facilitator-support-invalid'),
    'x402 adapter: facilitator support reason is present',
  );
}

function testFacilitatorVerifyBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    facilitator: facilitator({
      verifyResponseValid: false,
      verifyInvalidReason: 'insufficient_funds',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: facilitator verify failure blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-facilitator-verify-invalid'),
    'x402 adapter: facilitator verify reason is present',
  );
}

function testServiceTrustBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    serviceTrust: serviceTrust({
      resourceOriginAllowlisted: false,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: untrusted service origin blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-service-trust-not-ready'),
    'x402 adapter: service trust reason is present',
  );

  const missingAssetEvidence = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    serviceTrust: serviceTrust({
      assetAllowlistEvidenceRef: null,
    }),
  });

  equal(
    missingAssetEvidence.outcome,
    'block',
    'x402 adapter: asset allowlist without evidence blocks',
  );
  ok(
    missingAssetEvidence.observations.some(
      (entry) => entry.code === 'x402-asset-allowlist-evidence-missing',
    ),
    'x402 adapter: missing asset evidence reason is present',
  );
}

function testUnsupportedSchemeBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentRequirements: requirements({
      scheme: 'upto',
    }),
    paymentPayload: payload({
      scheme: 'upto',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: non-exact scheme blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-exact-scheme-required'),
    'x402 adapter: exact scheme reason is present',
  );
}

function testResourceMismatchBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    resource: resource({
      resourceUrl: 'https://api.attestor.example/market-data/other',
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: resource mismatch blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-resource-mismatch'),
    'x402 adapter: resource mismatch reason is present',
  );
}

function testTimeWindowBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentPayload: payload({
      authorization: authorization({
        validBeforeEpochSeconds: '1776762120',
      }),
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: overlong authorization window blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-time-window-invalid'),
    'x402 adapter: time window reason is present',
  );
}

function testAcceptsOutOfRangeBlocks(): void {
  const preflight = createX402AgenticPaymentPreflight({
    ...preflightInput(),
    paymentRequirements: requirements({
      acceptsCount: 1,
      selectedAcceptIndex: 1,
    }),
  });

  equal(
    preflight.outcome,
    'block',
    'x402 adapter: accepts index out of range blocks',
  );
  ok(
    preflight.observations.some((entry) => entry.code === 'x402-accepts-selection-invalid'),
    'x402 adapter: accepts selection reason is present',
  );
}

function testWrongAdapterThrows(): void {
  assert.throws(
    () =>
      createX402AgenticPaymentPreflight({
        ...preflightInput(),
        ...fixtureSuite('wallet-call-api'),
      }),
    /requires intent execution adapter x402-payment/u,
    'x402 adapter: wrong adapter throws',
  );
  passed += 1;
}

testDescriptor();
testCreatesAllowPreflight();
testSimulationAllowsPayment();
testPermit2ExactModeAllows();
testPendingSettlementRequiresReview();
testSettlementSuccessWithoutTransactionBlocks();
testBudgetExceededBlocks();
testCadenceExceededBlocks();
testRecipientMismatchBlocks();
testInvalidSignatureBlocks();
testReplayAndIdempotencyBlocks();
testUnredactedMetadataBlocks();
testRedactedMetadataAllows();
testFacilitatorUnsupportedBlocks();
testFacilitatorVerifyBlocks();
testServiceTrustBlocks();
testUnsupportedSchemeBlocks();
testResourceMismatchBlocks();
testTimeWindowBlocks();
testAcceptsOutOfRangeBlocks();
testWrongAdapterThrows();

console.log(`crypto-authorization-core-x402-agentic-payment-adapter: ${passed} checks passed`);
