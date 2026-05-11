import assert from 'node:assert/strict';

const cryptoCore = await import('attestor/crypto-authorization-core');

assert.equal(
  cryptoCore.CRYPTO_AUTHORIZATION_CORE_PLATFORM_SURFACE_SPEC_VERSION,
  'attestor.crypto-authorization-core-platform.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.types.CRYPTO_AUTHORIZATION_CORE_SPEC_VERSION,
  'attestor.crypto-authorization-core.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.simulation.CRYPTO_AUTHORIZATION_SIMULATION_SPEC_VERSION,
  'attestor.crypto-authorization-simulation.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligenceRiskSignals.CRYPTO_INTELLIGENCE_RISK_SIGNALS_SPEC_VERSION,
  'attestor.crypto-intelligence-risk-signals.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.policyGapNarrowing.CRYPTO_POLICY_GAP_NARROWING_SPEC_VERSION,
  'attestor.crypto-policy-gap-narrowing.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .CRYPTO_INTELLIGENCE_PRIVACY_MINIMIZATION_SPEC_VERSION,
  'attestor.crypto-intelligence-privacy-minimization.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.x402AgenticPayment.X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
  'attestor.crypto-x402-agentic-payment-adapter.v1',
);
assert.equal(
  cryptoCore.cryptoAuthorizationCore.custodyCosignerPolicy.CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  'attestor.crypto-custody-cosigner-policy-adapter.v1',
);

let blockedInternalPath = false;
try {
  await import('attestor/crypto-authorization-core/types.js');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  blockedInternalPath =
    message.includes('Package subpath') ||
    message.includes('ERR_PACKAGE_PATH_NOT_EXPORTED');
}

assert.equal(
  blockedInternalPath,
  true,
  'internal crypto authorization core module paths should stay outside the public package surface',
);

const privacyEvaluation =
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'risk-signal-assessment',
      artifact: {
        reasonCodes: ['route-boundary-unsafe'],
        routeCommitmentDigest: 'sha256:route',
      },
    });
assert.equal(privacyEvaluation.allowed, true);
assert.equal(privacyEvaluation.rawPayloadStored, false);

const unsafePrivacyEvaluation =
  cryptoCore.cryptoAuthorizationCore.intelligencePrivacyMinimization
    .evaluateCryptoIntelligencePrivacyMinimizationArtifact({
      surfaceKind: 'admission-telemetry-event',
      artifact: {
        rawTransactionPayload: '0xraw',
      },
    });
assert.equal(unsafePrivacyEvaluation.allowed, false);
assert.ok(unsafePrivacyEvaluation.reasonCodes.includes('raw-transaction-payload-field'));

console.log('crypto-authorization-core package surface probe passed');
