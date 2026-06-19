import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoAuthorizationIntent,
} from './object-model.js';
import type {
  CryptoConsequenceRiskAssessment,
} from './consequence-risk-mapping.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import type {
  CryptoAuthorizationSimulationResult,
  CryptoSimulationPreflightSignal,
} from './authorization-simulation.js';

/**
 * x402 agentic payment adapter.
 *
 * Step 18 keeps HTTP-native payment protocol details outside the core object
 * model while making the payment quote, signed payload, facilitator, replay,
 * budget, cadence, recipient, privacy, settlement, and Attestor release
 * evidence explicit before an autonomous agent may pay for an HTTP resource.
 */

export const X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION =
  'attestor.crypto-x402-agentic-payment-adapter.v1';

export const X402_PROTOCOL_VERSION = 2;
export const X402_HTTP_PAYMENT_REQUIRED_STATUS = 402;
export const X402_PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
export const X402_PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';
export const X402_PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';

export const X402_TRANSPORTS = ['http'] as const;
export type X402Transport = typeof X402_TRANSPORTS[number];

export const X402_PAYMENT_SCHEMES = ['exact'] as const;
export type X402PaymentScheme = typeof X402_PAYMENT_SCHEMES[number];

export const X402_NETWORK_NAMESPACES = ['eip155', 'solana'] as const;
export type X402NetworkNamespace = typeof X402_NETWORK_NAMESPACES[number];

export const X402_EXACT_AUTHORIZATION_MODES = [
  'eip-3009-transfer-with-authorization',
  'permit2-transfer',
  'svm-transfer-checked',
] as const;
export type X402ExactAuthorizationMode =
  typeof X402_EXACT_AUTHORIZATION_MODES[number];

export const X402_FACILITATOR_PATHS = [
  'facilitator-verify-settle',
  'self-hosted-facilitator',
  'local-verify-facilitator-settle',
] as const;
export type X402FacilitatorPath = typeof X402_FACILITATOR_PATHS[number];

export const X402_OUTCOMES = [
  'allow',
  'review-required',
  'block',
] as const;
export type X402Outcome = typeof X402_OUTCOMES[number];

export const X402_OBSERVATION_STATUSES = [
  'pass',
  'warn',
  'fail',
] as const;
export type X402ObservationStatus = typeof X402_OBSERVATION_STATUSES[number];

export const X402_CHECKS = [
  'x402-adapter-kind',
  'x402-agent-payment-intent',
  'x402-agent-identity-bound',
  'x402-protocol-version',
  'x402-http-transport',
  'x402-payment-required-header',
  'x402-resource-bound',
  'x402-accepts-selection',
  'x402-caip2-network-bound',
  'x402-exact-scheme-bound',
  'x402-asset-bound',
  'x402-recipient-bound',
  'x402-amount-bound',
  'x402-time-window-bound',
  'x402-payment-signature-payload',
  'x402-exact-authorization-bound',
  'x402-replay-and-idempotency',
  'x402-agent-budget-cadence',
  'x402-service-trust-posture',
  'x402-facilitator-support',
  'x402-facilitator-verify',
  'x402-settlement-posture',
  'x402-privacy-metadata-posture',
  'x402-release-binding-ready',
  'x402-policy-binding-ready',
  'x402-enforcement-binding-ready',
] as const;
export type X402Check = typeof X402_CHECKS[number];

export interface X402ResourceEvidence {
  readonly transport: X402Transport | string;
  readonly observedAt: string;
  readonly method: string;
  readonly resourceUrl: string;
  readonly statusCode: number;
  readonly paymentRequiredHeaderPresent: boolean;
  readonly paymentRequiredHeaderDecoded: boolean;
  readonly responseBodyMatchesHeader: boolean;
  readonly description?: string | null;
  readonly mimeType?: string | null;
  readonly routeId?: string | null;
}

export interface X402PaymentRequirementsEvidence {
  readonly x402Version: number;
  readonly acceptsCount: number;
  readonly selectedAcceptIndex: number;
  readonly scheme: X402PaymentScheme | string;
  readonly network: string;
  readonly amount: string;
  readonly asset: string;
  readonly payTo: string;
  readonly maxTimeoutSeconds: number;
  readonly extraName?: string | null;
  readonly extraVersion?: string | null;
  readonly requirementsHash?: string | null;
  readonly extensionsAdvertised?: readonly string[] | null;
}

export interface X402ExactAuthorizationEvidence {
  readonly mode: X402ExactAuthorizationMode | string;
  readonly from: string;
  readonly to: string;
  readonly value: string;
  readonly validAfterEpochSeconds: string;
  readonly validBeforeEpochSeconds: string;
  readonly nonce: string;
  readonly signature: string;
  readonly signatureValid: boolean;
  readonly domainName?: string | null;
  readonly domainVersion?: string | null;
  readonly domainChainId?: string | null;
  readonly verifyingContract?: string | null;
  readonly nonceUnused: boolean;
  readonly balanceSufficient: boolean;
  readonly transferSimulationSucceeded: boolean;
}

export interface X402PaymentPayloadEvidence {
  readonly x402Version: number;
  readonly paymentSignatureHeaderPresent: boolean;
  readonly payloadHash?: string | null;
  readonly resourceMatchesRequirements: boolean;
  readonly acceptedMatchesRequirements: boolean;
  readonly payer: string;
  readonly scheme: X402PaymentScheme | string;
  readonly network: string;
  readonly amount: string;
  readonly asset: string;
  readonly payTo: string;
  readonly authorization: X402ExactAuthorizationEvidence;
  readonly extensionsEchoed: boolean;
}

export interface X402FacilitatorEvidence {
  readonly path: X402FacilitatorPath | string;
  readonly facilitatorUrl: string;
  readonly supportedChecked: boolean;
  readonly supportedKindAdvertised: boolean;
  readonly signerTrusted: boolean;
  readonly verifyRequested: boolean;
  readonly verifyResponseValid: boolean;
  readonly verifyInvalidReason?: string | null;
  readonly verifyPayer?: string | null;
  readonly settleRequested: boolean;
  readonly settleResponseSuccess: boolean | null;
  readonly settlementTransaction?: string | null;
  readonly settlementNetwork?: string | null;
  readonly settlementPayer?: string | null;
  readonly settlementAmount?: string | null;
  readonly paymentResponseHeaderPresent: boolean;
}

export interface X402AgentBudgetEvidence {
  readonly agentId: string;
  readonly budgetId: string;
  readonly spendLimitAtomic: string;
  readonly spendUsedAtomic: string;
  readonly proposedSpendAtomic: string;
  readonly cadence: string;
  readonly requestsUsedInWindow: number;
  readonly maxRequestsInWindow: number;
  readonly idempotencyKey: string;
  readonly idempotencyFresh: boolean;
  readonly duplicatePaymentDetected: boolean;
  readonly correlationId?: string | null;
}

export interface X402ServiceTrustEvidence {
  readonly merchantId: string;
  readonly serviceDiscoveryRef?: string | null;
  readonly resourceOriginAllowlisted: boolean;
  readonly payToAllowlisted: boolean;
  readonly assetAllowlisted: boolean;
  readonly assetAllowlistEvidenceRef?: string | null;
  readonly networkAllowlisted: boolean;
  readonly priceMatchesCatalog: boolean;
}

export interface X402PrivacyMetadataEvidence {
  readonly metadataScanned: boolean;
  readonly piiDetected: boolean;
  readonly piiRedacted: boolean;
  readonly sensitiveQueryDetected: boolean;
  readonly sensitiveQueryRedacted: boolean;
  readonly metadataMinimized: boolean;
  readonly facilitatorDataMinimized: boolean;
  readonly reasonStringPiiDetected?: boolean | null;
}

export interface X402Observation {
  readonly check: X402Check;
  readonly status: X402ObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required: boolean;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface CreateX402AgenticPaymentPreflightInput {
  readonly intent: CryptoAuthorizationIntent;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly resource: X402ResourceEvidence;
  readonly paymentRequirements: X402PaymentRequirementsEvidence;
  readonly paymentPayload: X402PaymentPayloadEvidence;
  readonly facilitator: X402FacilitatorEvidence;
  readonly budget: X402AgentBudgetEvidence;
  readonly serviceTrust: X402ServiceTrustEvidence;
  readonly privacy: X402PrivacyMetadataEvidence;
  readonly preflightId?: string | null;
}

export interface X402AgenticPaymentPreflight {
  readonly version: typeof X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION;
  readonly preflightId: string;
  readonly adapterKind: 'x402-payment';
  readonly checkedAt: string;
  readonly x402Version: typeof X402_PROTOCOL_VERSION;
  readonly transport: X402Transport;
  readonly resourceUrl: string;
  readonly method: string;
  readonly payer: string;
  readonly payTo: string;
  readonly network: string;
  readonly scheme: X402PaymentScheme;
  readonly asset: string;
  readonly amount: string;
  readonly budgetId: string;
  readonly idempotencyKey: string;
  readonly outcome: X402Outcome;
  readonly signal: CryptoSimulationPreflightSignal;
  readonly observations: readonly X402Observation[];
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface X402AgenticPaymentSimulationResult {
  readonly preflight: X402AgenticPaymentPreflight;
  readonly simulation: CryptoAuthorizationSimulationResult;
}

export interface X402AgenticPaymentAdapterDescriptor {
  readonly version: typeof X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION;
  readonly adapterKind: 'x402-payment';
  readonly protocolVersion: typeof X402_PROTOCOL_VERSION;
  readonly paymentRequiredStatus: typeof X402_HTTP_PAYMENT_REQUIRED_STATUS;
  readonly headers: {
    readonly paymentRequired: typeof X402_PAYMENT_REQUIRED_HEADER;
    readonly paymentSignature: typeof X402_PAYMENT_SIGNATURE_HEADER;
    readonly paymentResponse: typeof X402_PAYMENT_RESPONSE_HEADER;
  };
  readonly transports: typeof X402_TRANSPORTS;
  readonly schemes: typeof X402_PAYMENT_SCHEMES;
  readonly networkNamespaces: typeof X402_NETWORK_NAMESPACES;
  readonly authorizationModes: typeof X402_EXACT_AUTHORIZATION_MODES;
  readonly facilitatorPaths: typeof X402_FACILITATOR_PATHS;
  readonly outcomes: typeof X402_OUTCOMES;
  readonly checks: typeof X402_CHECKS;
  readonly references: readonly string[];
}
