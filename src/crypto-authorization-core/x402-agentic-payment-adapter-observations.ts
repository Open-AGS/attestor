import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import {
  X402_FACILITATOR_PATHS,
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_SIGNATURE_HEADER,
  X402_PROTOCOL_VERSION,
  type X402AgentBudgetEvidence,
  type X402Check,
  type X402FacilitatorEvidence,
  type X402Observation,
  type X402ObservationStatus,
  type X402PaymentPayloadEvidence,
  type X402PaymentRequirementsEvidence,
  type X402PrivacyMetadataEvidence,
  type X402ResourceEvidence,
  type X402ServiceTrustEvidence,
} from './x402-agentic-payment-adapter-types.js';
import {
  includesValue,
  normalizeIdentifier,
} from './x402-agentic-payment-adapter-normalize.js';
import {
  authorizationWindowSeconds,
  authorizationWithinIntentWindow,
  budgetWithinLimit,
  caip2ChainId,
  enforcementReady,
  expectedAuthorizationModeReady,
  intentMaxAmountReady,
  privacyReady,
  releaseReady,
  resourceOrigin,
  samePaymentAddress,
  sameString,
  selectedAcceptReady,
} from './x402-agentic-payment-adapter-readiness.js';

function observation(input: {
  readonly check: X402Check;
  readonly status: X402ObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): X402Observation {
  return Object.freeze({
    check: input.check,
    status: input.status,
    code: normalizeIdentifier(input.code, 'observation.code'),
    message: normalizeIdentifier(input.message, 'observation.message'),
    required: input.required ?? true,
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

export function buildObservations(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly resource: X402ResourceEvidence;
  readonly requirements: X402PaymentRequirementsEvidence;
  readonly payload: X402PaymentPayloadEvidence;
  readonly facilitator: X402FacilitatorEvidence;
  readonly budget: X402AgentBudgetEvidence;
  readonly serviceTrust: X402ServiceTrustEvidence;
  readonly privacy: X402PrivacyMetadataEvidence;
}): readonly X402Observation[] {
  const observations: X402Observation[] = [];
  const intentChainId = caip2ChainId(input.intent);
  const targetPayTo = input.intent.target.address ?? input.intent.target.counterparty;
  const intentAssetId = input.intent.asset?.assetId ?? null;
  const authorization = input.payload.authorization;
  const authorizationModeReady = expectedAuthorizationModeReady(
    authorization.mode,
    input.requirements.network,
    input.requirements.asset,
  );
  const timeWindowSeconds = authorizationWindowSeconds(authorization);
  const timeoutReady =
    timeWindowSeconds > 0n &&
    timeWindowSeconds <= BigInt(input.requirements.maxTimeoutSeconds) &&
    authorizationWithinIntentWindow(authorization, input.intent);
  const facilitatorPayer = input.facilitator.verifyPayer ?? input.facilitator.settlementPayer;
  const settlementReady =
    input.facilitator.settleRequested &&
    input.facilitator.settleResponseSuccess === true &&
    input.facilitator.paymentResponseHeaderPresent &&
    Boolean(input.facilitator.settlementTransaction) &&
    input.facilitator.settlementNetwork === input.requirements.network &&
    samePaymentAddress(input.facilitator.settlementPayer, input.payload.payer) &&
    input.facilitator.settlementAmount === input.requirements.amount;
  const serviceReady =
    input.serviceTrust.resourceOriginAllowlisted &&
    input.serviceTrust.payToAllowlisted &&
    input.serviceTrust.assetAllowlisted &&
    input.serviceTrust.assetAllowlistEvidenceRef !== null &&
    input.serviceTrust.networkAllowlisted &&
    input.serviceTrust.priceMatchesCatalog;

  observations.push(
    observation({
      check: 'x402-adapter-kind',
      status: input.intent.executionAdapterKind === 'x402-payment' ? 'pass' : 'fail',
      code: input.intent.executionAdapterKind === 'x402-payment'
        ? 'x402-adapter-kind-bound'
        : 'x402-adapter-kind-mismatch',
      message: input.intent.executionAdapterKind === 'x402-payment'
        ? 'Intent is bound to the x402 payment adapter.'
        : 'Intent is not bound to the x402 payment adapter.',
      evidence: {
        adapterKind: input.intent.executionAdapterKind ?? null,
      },
    }),
    observation({
      check: 'x402-agent-payment-intent',
      status:
        input.intent.consequenceKind === 'agent-payment' &&
        input.intent.target.targetKind === 'payee' &&
        input.intent.target.protocol === 'x402'
          ? 'pass'
          : 'fail',
      code:
        input.intent.consequenceKind === 'agent-payment' &&
        input.intent.target.targetKind === 'payee' &&
        input.intent.target.protocol === 'x402'
          ? 'x402-agent-payment-intent-bound'
          : 'x402-agent-payment-intent-mismatch',
      message:
        input.intent.consequenceKind === 'agent-payment' &&
        input.intent.target.targetKind === 'payee' &&
        input.intent.target.protocol === 'x402'
          ? 'Intent is a protocol-bound agent payment to an x402 payee.'
          : 'x402 payment execution requires an agent-payment intent targeting an x402 payee.',
      evidence: {
        consequenceKind: input.intent.consequenceKind,
        targetKind: input.intent.target.targetKind,
        protocol: input.intent.target.protocol ?? null,
      },
    }),
    observation({
      check: 'x402-agent-identity-bound',
      status:
        input.intent.requester.actorKind === 'agent' &&
        input.budget.agentId === input.intent.requester.actorId
          ? 'pass'
          : 'fail',
      code:
        input.intent.requester.actorKind === 'agent' &&
        input.budget.agentId === input.intent.requester.actorId
          ? 'x402-agent-identity-bound'
          : 'x402-agent-identity-mismatch',
      message:
        input.intent.requester.actorKind === 'agent' &&
        input.budget.agentId === input.intent.requester.actorId
          ? 'The paying agent identity is bound to the Attestor intent and budget ledger.'
          : 'x402 agent payment requires the same agent identity in the intent and budget evidence.',
      evidence: {
        requesterKind: input.intent.requester.actorKind,
        requesterId: input.intent.requester.actorId,
        budgetAgentId: input.budget.agentId,
      },
    }),
    observation({
      check: 'x402-protocol-version',
      status:
        input.requirements.x402Version === X402_PROTOCOL_VERSION &&
        input.payload.x402Version === X402_PROTOCOL_VERSION
          ? 'pass'
          : 'fail',
      code:
        input.requirements.x402Version === X402_PROTOCOL_VERSION &&
        input.payload.x402Version === X402_PROTOCOL_VERSION
          ? 'x402-protocol-version-v2'
          : 'x402-protocol-version-mismatch',
      message:
        input.requirements.x402Version === X402_PROTOCOL_VERSION &&
        input.payload.x402Version === X402_PROTOCOL_VERSION
          ? 'Payment requirement and payment payload use x402 protocol version 2.'
          : 'x402 payment requirement and payload must both use protocol version 2.',
      evidence: {
        requiredVersion: input.requirements.x402Version,
        payloadVersion: input.payload.x402Version,
      },
    }),
    observation({
      check: 'x402-http-transport',
      status:
        input.resource.transport === 'http' &&
        input.resource.statusCode === X402_HTTP_PAYMENT_REQUIRED_STATUS
          ? 'pass'
          : 'fail',
      code:
        input.resource.transport === 'http' &&
        input.resource.statusCode === X402_HTTP_PAYMENT_REQUIRED_STATUS
          ? 'x402-http-402-observed'
          : 'x402-http-402-missing',
      message:
        input.resource.transport === 'http' &&
        input.resource.statusCode === X402_HTTP_PAYMENT_REQUIRED_STATUS
          ? 'HTTP transport observed a 402 Payment Required response.'
          : 'x402 HTTP transport must observe a 402 Payment Required response.',
      evidence: {
        transport: input.resource.transport,
        statusCode: input.resource.statusCode,
      },
    }),
    observation({
      check: 'x402-payment-required-header',
      status:
        input.resource.paymentRequiredHeaderPresent &&
        input.resource.paymentRequiredHeaderDecoded &&
        input.resource.responseBodyMatchesHeader
          ? 'pass'
          : 'fail',
      code:
        input.resource.paymentRequiredHeaderPresent &&
        input.resource.paymentRequiredHeaderDecoded &&
        input.resource.responseBodyMatchesHeader
          ? 'x402-payment-required-header-bound'
          : 'x402-payment-required-header-invalid',
      message:
        input.resource.paymentRequiredHeaderPresent &&
        input.resource.paymentRequiredHeaderDecoded &&
        input.resource.responseBodyMatchesHeader
          ? 'PAYMENT-REQUIRED was present, decoded, and matched the response body.'
          : 'PAYMENT-REQUIRED must be present, decodable, and consistent with the response body.',
      evidence: {
        header: X402_PAYMENT_REQUIRED_HEADER,
        present: input.resource.paymentRequiredHeaderPresent,
        decoded: input.resource.paymentRequiredHeaderDecoded,
        bodyMatchesHeader: input.resource.responseBodyMatchesHeader,
      },
    }),
    observation({
      check: 'x402-resource-bound',
      status:
        input.resource.resourceUrl === input.intent.target.targetId &&
        input.payload.resourceMatchesRequirements
          ? 'pass'
          : 'fail',
      code:
        input.resource.resourceUrl === input.intent.target.targetId &&
        input.payload.resourceMatchesRequirements
          ? 'x402-resource-bound'
          : 'x402-resource-mismatch',
      message:
        input.resource.resourceUrl === input.intent.target.targetId &&
        input.payload.resourceMatchesRequirements
          ? 'Resource URL is bound to the intent and echoed by the payment payload.'
          : 'x402 resource URL must match the Attestor intent and payment payload.',
      evidence: {
        resourceUrl: input.resource.resourceUrl,
        intentTargetId: input.intent.target.targetId,
        origin: resourceOrigin(input.resource.resourceUrl),
        payloadResourceMatches: input.payload.resourceMatchesRequirements,
      },
    }),
    observation({
      check: 'x402-accepts-selection',
      status:
        selectedAcceptReady(input.requirements) &&
        input.payload.acceptedMatchesRequirements &&
        input.payload.extensionsEchoed
          ? 'pass'
          : 'fail',
      code:
        selectedAcceptReady(input.requirements) &&
        input.payload.acceptedMatchesRequirements &&
        input.payload.extensionsEchoed
          ? 'x402-accepts-selection-bound'
          : 'x402-accepts-selection-invalid',
      message:
        selectedAcceptReady(input.requirements) &&
        input.payload.acceptedMatchesRequirements &&
        input.payload.extensionsEchoed
          ? 'The selected accepts entry is in range and echoed by the payment payload.'
          : 'x402 accepted payment requirement must be selected, echoed, and extension-preserving.',
      evidence: {
        acceptsCount: input.requirements.acceptsCount,
        selectedAcceptIndex: input.requirements.selectedAcceptIndex,
        acceptedMatchesRequirements: input.payload.acceptedMatchesRequirements,
        extensionsAdvertised: input.requirements.extensionsAdvertised ?? [],
        extensionsEchoed: input.payload.extensionsEchoed,
      },
    }),
    observation({
      check: 'x402-caip2-network-bound',
      status:
        input.requirements.network === intentChainId &&
        input.payload.network === input.requirements.network
          ? 'pass'
          : 'fail',
      code:
        input.requirements.network === intentChainId &&
        input.payload.network === input.requirements.network
          ? 'x402-caip2-network-bound'
          : 'x402-caip2-network-mismatch',
      message:
        input.requirements.network === intentChainId &&
        input.payload.network === input.requirements.network
          ? 'Payment network is CAIP-2 bound to the Attestor intent chain.'
          : 'x402 payment network must match the Attestor intent chain and payload.',
      evidence: {
        intentChainId,
        requirementNetwork: input.requirements.network,
        payloadNetwork: input.payload.network,
      },
    }),
    observation({
      check: 'x402-exact-scheme-bound',
      status:
        input.requirements.scheme === 'exact' &&
        input.payload.scheme === 'exact'
          ? 'pass'
          : 'fail',
      code:
        input.requirements.scheme === 'exact' &&
        input.payload.scheme === 'exact'
          ? 'x402-exact-scheme-bound'
          : 'x402-exact-scheme-required',
      message:
        input.requirements.scheme === 'exact' &&
        input.payload.scheme === 'exact'
          ? 'The x402 exact payment scheme is bound in requirement and payload.'
          : 'This adapter only allows x402 exact scheme payments.',
      evidence: {
        requirementScheme: input.requirements.scheme,
        payloadScheme: input.payload.scheme,
      },
    }),
    observation({
      check: 'x402-asset-bound',
      status:
        input.payload.asset === input.requirements.asset &&
        (!intentAssetId || sameString(input.requirements.asset, intentAssetId))
          ? 'pass'
          : 'fail',
      code:
        input.payload.asset === input.requirements.asset &&
        (!intentAssetId || sameString(input.requirements.asset, intentAssetId))
          ? 'x402-asset-bound'
          : 'x402-asset-mismatch',
      message:
        input.payload.asset === input.requirements.asset &&
        (!intentAssetId || sameString(input.requirements.asset, intentAssetId))
          ? 'Payment asset is bound to the requirement, payload, and intent asset.'
          : 'x402 payment asset must match the requirement, payload, and Attestor intent asset.',
      evidence: {
        requirementAsset: input.requirements.asset,
        payloadAsset: input.payload.asset,
        intentAssetId,
      },
    }),
    observation({
      check: 'x402-recipient-bound',
      status:
        samePaymentAddress(input.requirements.payTo, input.payload.payTo) &&
        samePaymentAddress(input.requirements.payTo, targetPayTo)
          ? 'pass'
          : 'fail',
      code:
        samePaymentAddress(input.requirements.payTo, input.payload.payTo) &&
        samePaymentAddress(input.requirements.payTo, targetPayTo)
          ? 'x402-recipient-bound'
          : 'x402-recipient-mismatch',
      message:
        samePaymentAddress(input.requirements.payTo, input.payload.payTo) &&
        samePaymentAddress(input.requirements.payTo, targetPayTo)
          ? 'Payment recipient is bound to requirement, payload, and Attestor payee target.'
          : 'x402 payment recipient must match the quoted requirement, payload, and Attestor payee target.',
      evidence: {
        requirementPayTo: input.requirements.payTo,
        payloadPayTo: input.payload.payTo,
        intentTargetPayTo: targetPayTo ?? null,
      },
    }),
    observation({
      check: 'x402-amount-bound',
      status:
        input.payload.amount === input.requirements.amount &&
        authorization.value === input.requirements.amount &&
        intentMaxAmountReady(input.intent, input.requirements.amount)
          ? 'pass'
          : 'fail',
      code:
        input.payload.amount === input.requirements.amount &&
        authorization.value === input.requirements.amount &&
        intentMaxAmountReady(input.intent, input.requirements.amount)
          ? 'x402-amount-bound'
          : 'x402-amount-mismatch',
      message:
        input.payload.amount === input.requirements.amount &&
        authorization.value === input.requirements.amount &&
        intentMaxAmountReady(input.intent, input.requirements.amount)
          ? 'Payment amount exactly matches quote, payload authorization, and Attestor max amount.'
          : 'x402 exact payment amount must match the quote, payload authorization, and Attestor max amount.',
      evidence: {
        requirementAmount: input.requirements.amount,
        payloadAmount: input.payload.amount,
        authorizationValue: authorization.value,
        intentMaxAmount: input.intent.constraints.maxAmount ?? null,
      },
    }),
    observation({
      check: 'x402-time-window-bound',
      status: timeoutReady ? 'pass' : 'fail',
      code: timeoutReady
        ? 'x402-time-window-bound'
        : 'x402-time-window-invalid',
      message: timeoutReady
        ? 'Payment authorization validity is bounded by x402 timeout and Attestor intent validity.'
        : 'x402 payment authorization must be within maxTimeoutSeconds and the Attestor validity window.',
      evidence: {
        maxTimeoutSeconds: input.requirements.maxTimeoutSeconds,
        authorizationWindowSeconds: timeWindowSeconds.toString(),
        intentValidAfter: input.intent.constraints.validAfter,
        intentValidUntil: input.intent.constraints.validUntil,
      },
    }),
    observation({
      check: 'x402-payment-signature-payload',
      status:
        input.payload.paymentSignatureHeaderPresent &&
        input.payload.x402Version === input.requirements.x402Version &&
        input.payload.authorization.signatureValid
          ? 'pass'
          : 'fail',
      code:
        input.payload.paymentSignatureHeaderPresent &&
        input.payload.x402Version === input.requirements.x402Version &&
        input.payload.authorization.signatureValid
          ? 'x402-payment-signature-payload-bound'
          : 'x402-payment-signature-payload-invalid',
      message:
        input.payload.paymentSignatureHeaderPresent &&
        input.payload.x402Version === input.requirements.x402Version &&
        input.payload.authorization.signatureValid
          ? 'PAYMENT-SIGNATURE payload is present and signed by the payer.'
          : 'PAYMENT-SIGNATURE payload must be present, version matched, and validly signed.',
      evidence: {
        header: X402_PAYMENT_SIGNATURE_HEADER,
        present: input.payload.paymentSignatureHeaderPresent,
        payloadHash: input.payload.payloadHash ?? null,
        signatureValid: input.payload.authorization.signatureValid,
      },
    }),
    observation({
      check: 'x402-exact-authorization-bound',
      status:
        authorizationModeReady &&
        samePaymentAddress(authorization.from, input.payload.payer) &&
        samePaymentAddress(authorization.from, input.intent.account.address) &&
        samePaymentAddress(authorization.to, input.requirements.payTo) &&
        authorization.nonceUnused &&
        authorization.balanceSufficient &&
        authorization.transferSimulationSucceeded
          ? 'pass'
          : 'fail',
      code:
        authorizationModeReady &&
        samePaymentAddress(authorization.from, input.payload.payer) &&
        samePaymentAddress(authorization.from, input.intent.account.address) &&
        samePaymentAddress(authorization.to, input.requirements.payTo) &&
        authorization.nonceUnused &&
        authorization.balanceSufficient &&
        authorization.transferSimulationSucceeded
          ? 'x402-exact-authorization-bound'
          : 'x402-exact-authorization-invalid',
      message:
        authorizationModeReady &&
        samePaymentAddress(authorization.from, input.payload.payer) &&
        samePaymentAddress(authorization.from, input.intent.account.address) &&
        samePaymentAddress(authorization.to, input.requirements.payTo) &&
        authorization.nonceUnused &&
        authorization.balanceSufficient &&
        authorization.transferSimulationSucceeded
          ? 'Exact payment authorization is payer-bound, recipient-bound, unused, funded, and simulated.'
          : 'Exact payment authorization must bind payer, recipient, nonce, balance, and transfer simulation.',
      evidence: {
        mode: authorization.mode,
        from: authorization.from,
        payer: input.payload.payer,
        intentAccount: input.intent.account.address,
        to: authorization.to,
        nonceUnused: authorization.nonceUnused,
        balanceSufficient: authorization.balanceSufficient,
        transferSimulationSucceeded: authorization.transferSimulationSucceeded,
      },
    }),
    observation({
      check: 'x402-replay-and-idempotency',
      status:
        input.budget.idempotencyFresh &&
        !input.budget.duplicatePaymentDetected &&
        authorization.nonce === input.intent.constraints.nonce
          ? 'pass'
          : 'fail',
      code:
        input.budget.idempotencyFresh &&
        !input.budget.duplicatePaymentDetected &&
        authorization.nonce === input.intent.constraints.nonce
          ? 'x402-replay-and-idempotency-fresh'
          : 'x402-replay-or-idempotency-risk',
      message:
        input.budget.idempotencyFresh &&
        !input.budget.duplicatePaymentDetected &&
        authorization.nonce === input.intent.constraints.nonce
          ? 'Payment nonce and idempotency key are fresh and bound to the Attestor intent.'
          : 'x402 payment must not reuse a nonce, idempotency key, or previously detected duplicate payment.',
      evidence: {
        intentNonce: input.intent.constraints.nonce,
        authorizationNonce: authorization.nonce,
        idempotencyKey: input.budget.idempotencyKey,
        idempotencyFresh: input.budget.idempotencyFresh,
        duplicatePaymentDetected: input.budget.duplicatePaymentDetected,
      },
    }),
    observation({
      check: 'x402-agent-budget-cadence',
      status: budgetWithinLimit({
        budget: input.budget,
        requirements: input.requirements,
        intent: input.intent,
      })
        ? 'pass'
        : 'fail',
      code: budgetWithinLimit({
        budget: input.budget,
        requirements: input.requirements,
        intent: input.intent,
      })
        ? 'x402-agent-budget-cadence-bound'
        : 'x402-agent-budget-cadence-exceeded',
      message: budgetWithinLimit({
        budget: input.budget,
        requirements: input.requirements,
        intent: input.intent,
      })
        ? 'Agent budget, cadence, and request-count controls admit this payment.'
        : 'x402 agent payment exceeds or mismatches budget, cadence, amount, or request-count controls.',
      evidence: {
        budgetId: input.budget.budgetId,
        intentBudgetId: input.intent.constraints.budgetId ?? null,
        spendLimitAtomic: input.budget.spendLimitAtomic,
        spendUsedAtomic: input.budget.spendUsedAtomic,
        proposedSpendAtomic: input.budget.proposedSpendAtomic,
        requestsUsedInWindow: input.budget.requestsUsedInWindow,
        maxRequestsInWindow: input.budget.maxRequestsInWindow,
        cadence: input.budget.cadence,
        intentCadence: input.intent.constraints.cadence ?? null,
      },
    }),
    observation({
      check: 'x402-service-trust-posture',
      status: serviceReady ? 'pass' : 'fail',
      code: serviceReady
        ? 'x402-service-trust-ready'
        : input.serviceTrust.assetAllowlisted && input.serviceTrust.assetAllowlistEvidenceRef === null
          ? 'x402-asset-allowlist-evidence-missing'
          : 'x402-service-trust-not-ready',
      message: serviceReady
        ? 'Resource origin, recipient, asset, network, and catalog price are trusted.'
        : input.serviceTrust.assetAllowlisted && input.serviceTrust.assetAllowlistEvidenceRef === null
          ? 'x402 asset allowlist status must be backed by an evidence reference.'
          : 'x402 payment requires trusted resource origin, recipient, asset, network, and catalog price.',
      evidence: {
        merchantId: input.serviceTrust.merchantId,
        serviceDiscoveryRef: input.serviceTrust.serviceDiscoveryRef ?? null,
        resourceOriginAllowlisted: input.serviceTrust.resourceOriginAllowlisted,
        payToAllowlisted: input.serviceTrust.payToAllowlisted,
        assetAllowlisted: input.serviceTrust.assetAllowlisted,
        assetAllowlistEvidenceRef: input.serviceTrust.assetAllowlistEvidenceRef ?? null,
        networkAllowlisted: input.serviceTrust.networkAllowlisted,
        priceMatchesCatalog: input.serviceTrust.priceMatchesCatalog,
      },
    }),
    observation({
      check: 'x402-facilitator-support',
      status:
        includesValue(X402_FACILITATOR_PATHS, input.facilitator.path) &&
        input.facilitator.supportedChecked &&
        input.facilitator.supportedKindAdvertised &&
        input.facilitator.signerTrusted
          ? 'pass'
          : 'fail',
      code:
        includesValue(X402_FACILITATOR_PATHS, input.facilitator.path) &&
        input.facilitator.supportedChecked &&
        input.facilitator.supportedKindAdvertised &&
        input.facilitator.signerTrusted
          ? 'x402-facilitator-support-ready'
          : 'x402-facilitator-support-invalid',
      message:
        includesValue(X402_FACILITATOR_PATHS, input.facilitator.path) &&
        input.facilitator.supportedChecked &&
        input.facilitator.supportedKindAdvertised &&
        input.facilitator.signerTrusted
          ? 'Facilitator support was checked and the selected payment kind is advertised by a trusted signer.'
          : 'x402 facilitator must advertise the selected kind through a trusted support response.',
      evidence: {
        path: input.facilitator.path,
        facilitatorUrl: input.facilitator.facilitatorUrl,
        supportedChecked: input.facilitator.supportedChecked,
        supportedKindAdvertised: input.facilitator.supportedKindAdvertised,
        signerTrusted: input.facilitator.signerTrusted,
      },
    }),
    observation({
      check: 'x402-facilitator-verify',
      status:
        input.facilitator.verifyRequested &&
        input.facilitator.verifyResponseValid &&
        samePaymentAddress(facilitatorPayer, input.payload.payer)
          ? 'pass'
          : 'fail',
      code:
        input.facilitator.verifyRequested &&
        input.facilitator.verifyResponseValid &&
        samePaymentAddress(facilitatorPayer, input.payload.payer)
          ? 'x402-facilitator-verify-valid'
          : 'x402-facilitator-verify-invalid',
      message:
        input.facilitator.verifyRequested &&
        input.facilitator.verifyResponseValid &&
        samePaymentAddress(facilitatorPayer, input.payload.payer)
          ? 'Facilitator /verify accepted the payment authorization for the expected payer.'
          : 'x402 facilitator /verify must validate the payment authorization for the expected payer.',
      evidence: {
        verifyRequested: input.facilitator.verifyRequested,
        verifyResponseValid: input.facilitator.verifyResponseValid,
        verifyInvalidReason: input.facilitator.verifyInvalidReason ?? null,
        verifyPayer: input.facilitator.verifyPayer ?? null,
        payloadPayer: input.payload.payer,
      },
    }),
    observation({
      check: 'x402-settlement-posture',
      status:
        settlementReady ? 'pass' : input.facilitator.settleResponseSuccess === null ? 'warn' : 'fail',
      code:
        settlementReady
          ? 'x402-settlement-confirmed'
          : input.facilitator.settleResponseSuccess === null
            ? 'x402-settlement-pending-review'
            : 'x402-settlement-invalid',
      message:
        settlementReady
          ? 'Facilitator settlement succeeded and PAYMENT-RESPONSE details are bound.'
          : input.facilitator.settleResponseSuccess === null
            ? 'x402 settlement is verified but not yet confirmed; reviewer confirmation is required before access.'
            : 'x402 settlement must succeed and bind network, payer, amount, transaction, and PAYMENT-RESPONSE.',
      evidence: {
        settleRequested: input.facilitator.settleRequested,
        settleResponseSuccess: input.facilitator.settleResponseSuccess,
        settlementTransaction: input.facilitator.settlementTransaction ?? null,
        settlementNetwork: input.facilitator.settlementNetwork ?? null,
        settlementPayer: input.facilitator.settlementPayer ?? null,
        settlementAmount: input.facilitator.settlementAmount ?? null,
        paymentResponseHeaderPresent: input.facilitator.paymentResponseHeaderPresent,
      },
    }),
    observation({
      check: 'x402-privacy-metadata-posture',
      status: privacyReady(input.privacy) ? 'pass' : 'fail',
      code: privacyReady(input.privacy)
        ? 'x402-privacy-metadata-ready'
        : 'x402-privacy-metadata-risk',
      message: privacyReady(input.privacy)
        ? 'Payment metadata was scanned, minimized, and made safe for facilitator transmission.'
        : 'x402 payment metadata must be scanned, minimized, and redacted before facilitator transmission.',
      evidence: {
        metadataScanned: input.privacy.metadataScanned,
        piiDetected: input.privacy.piiDetected,
        piiRedacted: input.privacy.piiRedacted,
        sensitiveQueryDetected: input.privacy.sensitiveQueryDetected,
        sensitiveQueryRedacted: input.privacy.sensitiveQueryRedacted,
        metadataMinimized: input.privacy.metadataMinimized,
        facilitatorDataMinimized: input.privacy.facilitatorDataMinimized,
        reasonStringPiiDetected: input.privacy.reasonStringPiiDetected ?? false,
      },
    }),
    observation({
      check: 'x402-release-binding-ready',
      status: releaseReady(input.releaseBinding) ? 'pass' : 'fail',
      code: releaseReady(input.releaseBinding)
        ? 'x402-release-binding-ready'
        : 'x402-release-binding-not-ready',
      message: releaseReady(input.releaseBinding)
        ? 'Release binding is accepted and ready for x402 payment execution.'
        : 'x402 payment requires an accepted Attestor release binding.',
      evidence: {
        releaseBindingStatus: input.releaseBinding.status,
        releaseDecisionStatus: input.releaseBinding.releaseDecision.status,
        releaseBindingDigest: input.releaseBinding.digest,
      },
    }),
    observation({
      check: 'x402-policy-binding-ready',
      status: input.policyScopeBinding.activationRecord.state === 'active' ? 'pass' : 'fail',
      code: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'x402-policy-binding-ready'
        : 'x402-policy-binding-not-active',
      message: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'Policy control-plane activation is active for the x402 payment scope.'
        : 'x402 payment requires an active policy control-plane activation.',
      evidence: {
        activationId: input.policyScopeBinding.activationId,
        activationStatus: input.policyScopeBinding.activationRecord.state,
        policyScopeDigest: input.policyScopeBinding.digest,
      },
    }),
    observation({
      check: 'x402-enforcement-binding-ready',
      status: enforcementReady(input.enforcementBinding) ? 'pass' : 'fail',
      code: enforcementReady(input.enforcementBinding)
        ? 'x402-enforcement-binding-ready'
        : 'x402-enforcement-binding-not-ready',
      message: enforcementReady(input.enforcementBinding)
        ? 'Enforcement binding is fail-closed and attached to the action-dispatch boundary.'
        : 'x402 payment requires fail-closed action-dispatch enforcement binding.',
      evidence: {
        adapterKind: input.enforcementBinding.adapterKind ?? null,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
        failClosed: input.enforcementBinding.verificationProfile.failClosed,
        enforcementBindingDigest: input.enforcementBinding.digest,
      },
    }),
  );

  return Object.freeze(observations);
}
