import {
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  type X402AgentBudgetEvidence,
  type X402AgenticPaymentPreflight,
  type X402FacilitatorEvidence,
  type X402PaymentPayloadEvidence,
  type X402PaymentRequirementsEvidence,
  type X402PrivacyMetadataEvidence,
  type X402ResourceEvidence,
  type X402ServiceTrustEvidence,
} from '../crypto-authorization-core/x402-agentic-payment-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';
import {
  X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION,
  type X402ResourceServerAdmissionAction,
  type X402ResourceServerAdmissionExpectation,
  type X402ResourceServerAdmissionExpectationStatus,
  type X402ResourceServerAdmissionOutcome,
  type X402ResourceServerAdmissionPhase,
  type X402ResourceServerRuntimeObservation,
} from './x402-resource-server-types.js';
import {
  canonicalObject,
  expectation,
  normalizeComparable,
  normalizeMethod,
  normalizeUrl,
} from './x402-resource-server-internal.js';

export function expectationsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: X402AgenticPaymentPreflight;
  readonly resource: X402ResourceEvidence;
  readonly paymentRequirements: X402PaymentRequirementsEvidence;
  readonly paymentPayload: X402PaymentPayloadEvidence;
  readonly facilitator: X402FacilitatorEvidence;
  readonly budget: X402AgentBudgetEvidence;
  readonly serviceTrust: X402ServiceTrustEvidence;
  readonly privacy: X402PrivacyMetadataEvidence;
  readonly phase: X402ResourceServerAdmissionPhase;
  readonly runtimeObservation: X402ResourceServerRuntimeObservation | null;
}): readonly X402ResourceServerAdmissionExpectation[] {
  const planSurfaceReady =
    input.plan.surface === 'agent-payment-http' &&
    input.plan.adapterKind === 'x402-payment' &&
    input.preflight.adapterKind === 'x402-payment';
  const planExpectation = expectation(
    'plan-surface',
    planSurfaceReady ? 'satisfied' : 'failed',
    planSurfaceReady
      ? 'x402-plan-surface-ready'
      : 'x402-plan-surface-mismatch',
    {
      planSurface: input.plan.surface,
      planAdapterKind: input.plan.adapterKind ?? 'adapter-neutral',
      preflightAdapterKind: input.preflight.adapterKind,
    },
  );

  const preflightStatus: X402ResourceServerAdmissionExpectationStatus =
    input.plan.outcome === 'deny' || input.preflight.outcome === 'block'
      ? 'failed'
      : input.plan.outcome === 'admit' && input.preflight.outcome === 'allow'
        ? 'satisfied'
        : 'pending';
  const preflightExpectation = expectation(
    'adapter-preflight',
    preflightStatus,
    preflightStatus === 'failed'
      ? input.plan.outcome === 'deny'
        ? 'x402-admission-plan-denied'
        : 'x402-preflight-blocked'
      : preflightStatus === 'pending'
        ? 'x402-preflight-awaiting-evidence'
        : 'x402-preflight-ready',
    {
      planOutcome: input.plan.outcome,
      preflightOutcome: input.preflight.outcome,
      chainId: input.plan.chainId,
      network: input.preflight.network,
    },
  );

  const resourceRouteReady =
    input.resource.transport === 'http' &&
    normalizeMethod(input.resource.method, 'resource.method') ===
      normalizeMethod(input.preflight.method, 'preflight.method') &&
    normalizeUrl(input.resource.resourceUrl, 'resource.resourceUrl') ===
      normalizeUrl(input.preflight.resourceUrl, 'preflight.resourceUrl') &&
    normalizeComparable(input.paymentRequirements.network) ===
      normalizeComparable(input.preflight.network) &&
    normalizeComparable(input.plan.chainId) ===
      normalizeComparable(input.preflight.network);
  const resourceRouteExpectation = expectation(
    'resource-route',
    resourceRouteReady ? 'satisfied' : 'failed',
    resourceRouteReady
      ? 'x402-resource-route-bound'
      : 'x402-resource-route-mismatch',
    {
      transport: input.resource.transport,
      method: normalizeMethod(input.resource.method, 'resource.method'),
      resourceUrl: normalizeUrl(input.resource.resourceUrl, 'resource.resourceUrl'),
      routeId: input.resource.routeId ?? null,
      network: input.paymentRequirements.network,
      planChainId: input.plan.chainId,
    },
  );

  const serviceTrustReady =
    input.serviceTrust.resourceOriginAllowlisted &&
    input.serviceTrust.payToAllowlisted &&
    input.serviceTrust.assetAllowlisted &&
    input.serviceTrust.networkAllowlisted &&
    input.serviceTrust.priceMatchesCatalog;
  const serviceTrustExpectation = expectation(
    'service-trust',
    serviceTrustReady ? 'satisfied' : 'failed',
    serviceTrustReady
      ? 'x402-service-trust-ready'
      : 'x402-service-trust-failed',
    {
      merchantId: input.serviceTrust.merchantId,
      serviceDiscoveryRef: input.serviceTrust.serviceDiscoveryRef ?? null,
      resourceOriginAllowlisted: input.serviceTrust.resourceOriginAllowlisted,
      payToAllowlisted: input.serviceTrust.payToAllowlisted,
      assetAllowlisted: input.serviceTrust.assetAllowlisted,
      networkAllowlisted: input.serviceTrust.networkAllowlisted,
      priceMatchesCatalog: input.serviceTrust.priceMatchesCatalog,
    },
  );

  const privacyReady =
    input.privacy.metadataScanned &&
    input.privacy.metadataMinimized &&
    input.privacy.facilitatorDataMinimized &&
    (!input.privacy.piiDetected || input.privacy.piiRedacted) &&
    (!input.privacy.sensitiveQueryDetected || input.privacy.sensitiveQueryRedacted);
  const privacyExpectation = expectation(
    'privacy-posture',
    privacyReady ? 'satisfied' : 'failed',
    privacyReady
      ? 'x402-privacy-posture-ready'
      : 'x402-privacy-posture-failed',
    {
      metadataScanned: input.privacy.metadataScanned,
      piiDetected: input.privacy.piiDetected,
      piiRedacted: input.privacy.piiRedacted,
      sensitiveQueryDetected: input.privacy.sensitiveQueryDetected,
      sensitiveQueryRedacted: input.privacy.sensitiveQueryRedacted,
      metadataMinimized: input.privacy.metadataMinimized,
      facilitatorDataMinimized: input.privacy.facilitatorDataMinimized,
    },
  );

  const paymentRequiredSent =
    input.phase === 'payment-challenge'
      ? (input.runtimeObservation?.paymentRequiredHeaderSent ??
          input.resource.paymentRequiredHeaderPresent)
      : input.resource.paymentRequiredHeaderPresent;
  const paymentRequiredReady =
    input.resource.statusCode === X402_HTTP_PAYMENT_REQUIRED_STATUS &&
    paymentRequiredSent &&
    input.resource.paymentRequiredHeaderDecoded &&
    input.resource.responseBodyMatchesHeader;
  const paymentRequiredExpectation = expectation(
    'payment-required-header',
    paymentRequiredReady ? 'satisfied' : 'failed',
    paymentRequiredReady
      ? 'x402-payment-required-header-ready'
      : 'x402-payment-required-header-invalid',
    {
      phase: input.phase,
      statusCode: input.resource.statusCode,
      paymentRequiredHeaderPresent: paymentRequiredSent,
      paymentRequiredHeaderDecoded: input.resource.paymentRequiredHeaderDecoded,
      responseBodyMatchesHeader: input.resource.responseBodyMatchesHeader,
    },
  );

  const paymentSignatureSeen =
    input.runtimeObservation?.paymentSignatureHeaderSeen ??
    input.paymentPayload.paymentSignatureHeaderPresent;
  const paymentSignatureStatus: X402ResourceServerAdmissionExpectationStatus =
    input.phase === 'payment-challenge'
      ? paymentSignatureSeen
        ? 'satisfied'
        : 'pending'
      : paymentSignatureSeen
        ? input.paymentPayload.resourceMatchesRequirements &&
          input.paymentPayload.acceptedMatchesRequirements &&
          normalizeComparable(input.paymentPayload.payer) ===
            normalizeComparable(input.preflight.payer) &&
          normalizeComparable(input.paymentPayload.payTo) ===
            normalizeComparable(input.preflight.payTo) &&
          normalizeComparable(input.paymentPayload.amount) ===
            normalizeComparable(input.preflight.amount) &&
          normalizeComparable(input.paymentPayload.asset) ===
            normalizeComparable(input.preflight.asset) &&
          normalizeComparable(input.paymentPayload.network) ===
            normalizeComparable(input.preflight.network)
          ? 'satisfied'
          : 'failed'
        : 'missing';
  const paymentSignatureExpectation = expectation(
    'payment-signature-header',
    paymentSignatureStatus,
    paymentSignatureStatus === 'pending'
      ? 'x402-awaiting-payment-signature'
      : paymentSignatureStatus === 'missing'
        ? 'x402-payment-signature-header-missing'
        : paymentSignatureStatus === 'failed'
          ? 'x402-payment-signature-payload-mismatch'
          : 'x402-payment-signature-ready',
    {
      phase: input.phase,
      paymentSignatureHeaderPresent: paymentSignatureSeen,
      payer: input.paymentPayload.payer,
      payTo: input.paymentPayload.payTo,
      amount: input.paymentPayload.amount,
      asset: input.paymentPayload.asset,
      network: input.paymentPayload.network,
      resourceMatchesRequirements: input.paymentPayload.resourceMatchesRequirements,
      acceptedMatchesRequirements: input.paymentPayload.acceptedMatchesRequirements,
    },
  );

  const verifyAccepted =
    input.runtimeObservation?.verifyAccepted ?? input.facilitator.verifyResponseValid;
  const facilitatorVerifyStatus: X402ResourceServerAdmissionExpectationStatus =
    input.phase === 'payment-challenge'
      ? 'pending'
      : !input.facilitator.supportedChecked
        ? 'missing'
        : !input.facilitator.supportedKindAdvertised
          ? 'unsupported'
          : !input.facilitator.signerTrusted
            ? 'failed'
            : !input.facilitator.verifyRequested
              ? 'missing'
              : verifyAccepted &&
                  normalizeComparable(input.facilitator.verifyPayer ?? input.paymentPayload.payer) ===
                    normalizeComparable(input.paymentPayload.payer)
                ? 'satisfied'
                : 'failed';
  const facilitatorVerifyExpectation = expectation(
    'facilitator-verify',
    facilitatorVerifyStatus,
    facilitatorVerifyStatus === 'pending'
      ? 'x402-facilitator-verify-pending'
      : facilitatorVerifyStatus === 'missing'
        ? 'x402-facilitator-verify-missing'
        : facilitatorVerifyStatus === 'unsupported'
          ? 'x402-facilitator-kind-unsupported'
          : facilitatorVerifyStatus === 'failed'
            ? 'x402-facilitator-verify-failed'
            : 'x402-facilitator-verify-ready',
    {
      phase: input.phase,
      facilitatorUrl: input.facilitator.facilitatorUrl,
      path: input.facilitator.path,
      supportedChecked: input.facilitator.supportedChecked,
      supportedKindAdvertised: input.facilitator.supportedKindAdvertised,
      signerTrusted: input.facilitator.signerTrusted,
      verifyRequested: input.facilitator.verifyRequested,
      verifyAccepted,
      verifyPayer: input.facilitator.verifyPayer ?? null,
    },
  );

  const settlementAccepted =
    input.runtimeObservation?.settlementAccepted ?? input.facilitator.settleResponseSuccess;
  const facilitatorSettleStatus: X402ResourceServerAdmissionExpectationStatus =
    input.phase === 'payment-challenge'
      ? 'pending'
      : facilitatorVerifyStatus !== 'satisfied'
        ? 'pending'
        : !input.facilitator.settleRequested
          ? 'missing'
          : settlementAccepted === true
            ? 'satisfied'
            : settlementAccepted === null
              ? 'pending'
              : 'failed';
  const facilitatorSettleExpectation = expectation(
    'facilitator-settle',
    facilitatorSettleStatus,
    facilitatorSettleStatus === 'pending'
      ? 'x402-facilitator-settle-pending'
      : facilitatorSettleStatus === 'missing'
        ? 'x402-facilitator-settle-missing'
        : facilitatorSettleStatus === 'failed'
          ? 'x402-facilitator-settle-failed'
          : 'x402-facilitator-settle-ready',
    {
      phase: input.phase,
      settleRequested: input.facilitator.settleRequested,
      settlementAccepted,
      settlementTransaction: input.facilitator.settlementTransaction ?? null,
      settlementNetwork: input.facilitator.settlementNetwork ?? null,
      settlementAmount: input.facilitator.settlementAmount ?? null,
    },
  );

  const paymentResponseSent =
    input.runtimeObservation?.paymentResponseHeaderSent ??
    input.facilitator.paymentResponseHeaderPresent;
  const paymentResponseStatus: X402ResourceServerAdmissionExpectationStatus =
    input.phase === 'payment-challenge'
      ? 'pending'
      : facilitatorSettleStatus !== 'satisfied'
        ? 'pending'
        : paymentResponseSent
          ? 'satisfied'
          : 'failed';
  const paymentResponseExpectation = expectation(
    'payment-response-header',
    paymentResponseStatus,
    paymentResponseStatus === 'pending'
      ? 'x402-payment-response-header-pending'
      : paymentResponseStatus === 'failed'
        ? 'x402-payment-response-header-missing'
        : 'x402-payment-response-header-ready',
    {
      phase: input.phase,
      paymentResponseHeaderPresent: paymentResponseSent,
      settlementAccepted,
    },
  );

  const paymentIdentifierStatus: X402ResourceServerAdmissionExpectationStatus =
    input.budget.duplicatePaymentDetected
      ? 'failed'
      : input.budget.idempotencyFresh
        ? 'satisfied'
        : 'missing';
  const paymentIdentifierExpectation = expectation(
    'payment-identifier',
    paymentIdentifierStatus,
    paymentIdentifierStatus === 'failed'
      ? 'x402-duplicate-payment-detected'
      : paymentIdentifierStatus === 'missing'
        ? 'x402-payment-identifier-stale'
        : 'x402-payment-identifier-ready',
    {
      budgetId: input.budget.budgetId,
      idempotencyKey: input.budget.idempotencyKey,
      idempotencyFresh: input.budget.idempotencyFresh,
      duplicatePaymentDetected: input.budget.duplicatePaymentDetected,
      duplicatePaymentBlocked: input.runtimeObservation?.duplicatePaymentBlocked ?? null,
    },
  );

  const fulfillmentDeferred =
    input.runtimeObservation?.fulfillmentDeferredUntilSettlement ?? null;
  const returnedStatusCode = input.runtimeObservation?.returnedStatusCode ?? null;
  const resourceFulfilled = input.runtimeObservation?.resourceFulfilled ?? null;
  const fulfillmentGateStatus: X402ResourceServerAdmissionExpectationStatus =
    input.phase === 'payment-challenge'
      ? 'pending'
      : facilitatorSettleStatus !== 'satisfied'
        ? 'pending'
        : paymentResponseStatus !== 'satisfied'
          ? 'failed'
          : fulfillmentDeferred === false
            ? 'failed'
            : input.phase === 'resource-fulfillment' || resourceFulfilled === true
              ? 'satisfied'
              : 'pending';
  const fulfillmentGateExpectation = expectation(
    'fulfillment-gate',
    fulfillmentGateStatus,
    fulfillmentGateStatus === 'pending'
      ? 'x402-fulfillment-awaiting-release'
      : fulfillmentGateStatus === 'failed'
        ? 'x402-fulfillment-gate-failed'
        : 'x402-fulfillment-gate-ready',
    {
      phase: input.phase,
      settlementAccepted,
      paymentResponseHeaderPresent: paymentResponseSent,
      fulfillmentDeferredUntilSettlement: fulfillmentDeferred,
      resourceFulfilled,
      returnedStatusCode,
    },
  );

  return Object.freeze([
    planExpectation,
    preflightExpectation,
    resourceRouteExpectation,
    serviceTrustExpectation,
    privacyExpectation,
    paymentRequiredExpectation,
    paymentSignatureExpectation,
    facilitatorVerifyExpectation,
    facilitatorSettleExpectation,
    paymentResponseExpectation,
    paymentIdentifierExpectation,
    fulfillmentGateExpectation,
  ]);
}

export function blockingReasonsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: X402AgenticPaymentPreflight;
  readonly paymentRequirements: X402PaymentRequirementsEvidence;
  readonly paymentPayload: X402PaymentPayloadEvidence;
  readonly expectations: readonly X402ResourceServerAdmissionExpectation[];
}): readonly string[] {
  const reasons: string[] = [];
  if (input.plan.surface !== 'agent-payment-http') {
    reasons.push('admission-plan-surface-not-agent-payment-http');
  }
  if (input.plan.adapterKind !== 'x402-payment') {
    reasons.push('admission-plan-adapter-not-x402-payment');
  }
  if (input.preflight.adapterKind !== 'x402-payment') {
    reasons.push('preflight-adapter-not-x402-payment');
  }
  if (input.plan.outcome === 'deny') {
    reasons.push('admission-plan-denied');
  }
  if (input.preflight.outcome === 'block') {
    reasons.push('x402-preflight-blocked');
  }
  if (
    normalizeComparable(input.plan.chainId) !==
      normalizeComparable(input.preflight.network) ||
    normalizeComparable(input.paymentRequirements.network) !==
      normalizeComparable(input.preflight.network) ||
    normalizeComparable(input.paymentPayload.network) !==
      normalizeComparable(input.preflight.network)
  ) {
    reasons.push('x402-network-mismatch');
  }
  if (
    normalizeComparable(input.plan.accountAddress) !==
      normalizeComparable(input.preflight.payer) ||
    normalizeComparable(input.paymentPayload.payer) !==
      normalizeComparable(input.preflight.payer)
  ) {
    reasons.push('x402-payer-mismatch');
  }
  if (
    normalizeComparable(input.paymentRequirements.payTo) !==
      normalizeComparable(input.preflight.payTo) ||
    normalizeComparable(input.paymentPayload.payTo) !==
      normalizeComparable(input.preflight.payTo)
  ) {
    reasons.push('x402-payto-mismatch');
  }
  if (
    normalizeComparable(input.paymentRequirements.amount) !==
      normalizeComparable(input.preflight.amount) ||
    normalizeComparable(input.paymentPayload.amount) !==
      normalizeComparable(input.preflight.amount)
  ) {
    reasons.push('x402-amount-mismatch');
  }
  if (
    normalizeComparable(input.paymentRequirements.asset) !==
      normalizeComparable(input.preflight.asset) ||
    normalizeComparable(input.paymentPayload.asset) !==
      normalizeComparable(input.preflight.asset)
  ) {
    reasons.push('x402-asset-mismatch');
  }
  input.expectations
    .filter((entry) => entry.status === 'failed' || entry.status === 'unsupported')
    .forEach((entry) => reasons.push(entry.reasonCode));
  return Object.freeze(reasons);
}

export function outcomeFor(input: {
  readonly phase: X402ResourceServerAdmissionPhase;
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: X402AgenticPaymentPreflight;
  readonly expectations: readonly X402ResourceServerAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
}): X402ResourceServerAdmissionOutcome {
  if (input.blockingReasons.length > 0) return 'blocked';
  if (input.phase === 'payment-challenge') return 'needs-http-evidence';
  if (input.plan.outcome !== 'admit' || input.preflight.outcome !== 'allow') {
    return 'needs-http-evidence';
  }
  if (
    input.expectations.some(
      (entry) => entry.status === 'missing' || entry.status === 'pending',
    )
  ) {
    return 'needs-http-evidence';
  }
  return 'ready';
}

export function actionFor(input: {
  readonly outcome: X402ResourceServerAdmissionOutcome;
  readonly phase: X402ResourceServerAdmissionPhase;
  readonly expectations: readonly X402ResourceServerAdmissionExpectation[];
}): X402ResourceServerAdmissionAction {
  if (input.outcome === 'blocked') return 'block-request';
  if (input.phase === 'payment-challenge') return 'issue-payment-required';
  const byKind = new Map(
    input.expectations.map((entry) => [entry.kind, entry] as const),
  );
  const paymentSignature = byKind.get('payment-signature-header');
  if (paymentSignature && paymentSignature.status !== 'satisfied') {
    return 'issue-payment-required';
  }
  const verify = byKind.get('facilitator-verify');
  if (verify && verify.status !== 'satisfied') {
    return 'verify-payment';
  }
  const settle = byKind.get('facilitator-settle');
  if (settle && settle.status !== 'satisfied') {
    return 'settle-payment';
  }
  return 'fulfill-resource';
}

export function nextActionsFor(input: {
  readonly outcome: X402ResourceServerAdmissionOutcome;
  readonly action: X402ResourceServerAdmissionAction;
}): readonly string[] {
  if (input.outcome === 'blocked') {
    return Object.freeze([
      'Do not fulfill the resource for this request.',
      'Return a fail-closed denial or HTTP 402 response and create a new admission after fixing the blocked reason.',
    ]);
  }
  switch (input.action) {
    case 'issue-payment-required':
      return Object.freeze([
        'Return HTTP 402 with the PAYMENT-REQUIRED header for the admitted route.',
        'Do not verify, settle, or fulfill the resource until the client retries with PAYMENT-SIGNATURE.',
      ]);
    case 'verify-payment':
      return Object.freeze([
        'Verify the PAYMENT-SIGNATURE payload locally or through facilitator /verify before any fulfillment.',
        'Keep the resource blocked until verification succeeds for the admitted payer, amount, asset, and payee.',
      ]);
    case 'settle-payment':
      return Object.freeze([
        'Call facilitator /settle or settle locally and wait for settlement success before any fulfillment.',
        'Prepare the PAYMENT-RESPONSE header only after settlement outcome is known.',
      ]);
    case 'fulfill-resource':
      return Object.freeze([
        'Return the paid resource only after settlement success and PAYMENT-RESPONSE binding are in place.',
        'Record the Attestor admission middleware digest alongside the downstream settlement result.',
      ]);
    case 'block-request':
      return Object.freeze([
        'Do not fulfill the resource.',
        'Resolve the blocked admission reason and mint a new middleware contract.',
      ]);
  }
}

export function middlewareIdFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: X402AgenticPaymentPreflight;
  readonly phase: X402ResourceServerAdmissionPhase;
  readonly createdAt: string;
}): string {
  return canonicalObject({
    version: X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    phase: input.phase,
    createdAt: input.createdAt,
  }).digest;
}
