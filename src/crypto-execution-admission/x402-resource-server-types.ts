import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_RESPONSE_HEADER,
  X402_PAYMENT_SIGNATURE_HEADER,
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

export const X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION =
  'attestor.crypto-x402-resource-server-admission-middleware.v1';

export const X402_RESOURCE_SERVER_ADMISSION_PHASES = [
  'payment-challenge',
  'payment-retry',
  'resource-fulfillment',
] as const;
export type X402ResourceServerAdmissionPhase =
  typeof X402_RESOURCE_SERVER_ADMISSION_PHASES[number];

export const X402_RESOURCE_SERVER_ADMISSION_OUTCOMES = [
  'ready',
  'needs-http-evidence',
  'blocked',
] as const;
export type X402ResourceServerAdmissionOutcome =
  typeof X402_RESOURCE_SERVER_ADMISSION_OUTCOMES[number];

export const X402_RESOURCE_SERVER_ADMISSION_ACTIONS = [
  'issue-payment-required',
  'verify-payment',
  'settle-payment',
  'fulfill-resource',
  'block-request',
] as const;
export type X402ResourceServerAdmissionAction =
  typeof X402_RESOURCE_SERVER_ADMISSION_ACTIONS[number];

export const X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_KINDS = [
  'plan-surface',
  'adapter-preflight',
  'resource-route',
  'service-trust',
  'privacy-posture',
  'payment-required-header',
  'payment-signature-header',
  'facilitator-verify',
  'facilitator-settle',
  'payment-response-header',
  'payment-identifier',
  'fulfillment-gate',
] as const;
export type X402ResourceServerAdmissionExpectationKind =
  typeof X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_KINDS[number];

export const X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_STATUSES = [
  'satisfied',
  'missing',
  'failed',
  'unsupported',
  'pending',
] as const;
export type X402ResourceServerAdmissionExpectationStatus =
  typeof X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_STATUSES[number];

export interface X402ResourceServerRuntimeObservation {
  readonly observedAt: string;
  readonly paymentRequiredHeaderSent?: boolean | null;
  readonly paymentSignatureHeaderSeen?: boolean | null;
  readonly paymentResponseHeaderSent?: boolean | null;
  readonly verifyAccepted?: boolean | null;
  readonly settlementAccepted?: boolean | null;
  readonly fulfillmentDeferredUntilSettlement?: boolean | null;
  readonly resourceFulfilled?: boolean | null;
  readonly duplicatePaymentBlocked?: boolean | null;
  readonly returnedStatusCode?: number | null;
}

export interface X402ResourceServerAdmissionExpectation {
  readonly kind: X402ResourceServerAdmissionExpectationKind;
  readonly status: X402ResourceServerAdmissionExpectationStatus;
  readonly reasonCode: string;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface X402ResourceServerAdmissionHeaders {
  readonly paymentRequiredStatus: typeof X402_HTTP_PAYMENT_REQUIRED_STATUS;
  readonly paymentRequired: typeof X402_PAYMENT_REQUIRED_HEADER;
  readonly paymentSignature: typeof X402_PAYMENT_SIGNATURE_HEADER;
  readonly paymentResponse: typeof X402_PAYMENT_RESPONSE_HEADER;
}

export interface X402ResourceServerAdmissionFacilitatorContract {
  readonly facilitatorUrl: string;
  readonly path: X402FacilitatorEvidence['path'];
  readonly verifyPath: '/verify';
  readonly settlePath: '/settle';
}

export interface X402ResourceServerAdmissionFulfillmentGate {
  readonly requiresSettlementSuccess: true;
  readonly requiresPaymentResponseHeader: true;
  readonly requiresIdempotencyProtection: true;
  readonly challengeStatusCode: typeof X402_HTTP_PAYMENT_REQUIRED_STATUS;
}

export interface CreateX402ResourceServerAdmissionMiddlewareInput {
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
  readonly createdAt: string;
  readonly middlewareId?: string | null;
  readonly runtimeObservation?: X402ResourceServerRuntimeObservation | null;
  readonly operatorNote?: string | null;
}

export interface X402ResourceServerAdmissionMiddleware {
  readonly version: typeof X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION;
  readonly middlewareId: string;
  readonly createdAt: string;
  readonly phase: X402ResourceServerAdmissionPhase;
  readonly outcome: X402ResourceServerAdmissionOutcome;
  readonly action: X402ResourceServerAdmissionAction;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly preflightId: string;
  readonly preflightDigest: string;
  readonly routeId: string | null;
  readonly method: string;
  readonly resourceUrl: string;
  readonly payer: string;
  readonly payTo: string;
  readonly network: string;
  readonly scheme: string;
  readonly amount: string;
  readonly asset: string;
  readonly budgetId: string;
  readonly idempotencyKey: string;
  readonly requirementsHash: string | null;
  readonly payloadHash: string | null;
  readonly settlementTransaction: string | null;
  readonly headers: X402ResourceServerAdmissionHeaders;
  readonly facilitatorContract: X402ResourceServerAdmissionFacilitatorContract;
  readonly fulfillmentGate: X402ResourceServerAdmissionFulfillmentGate;
  readonly runtimeObservation: X402ResourceServerRuntimeObservation | null;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly expectations: readonly X402ResourceServerAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface X402ResourceServerAdmissionDescriptor {
  readonly version: typeof X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION;
  readonly phases: typeof X402_RESOURCE_SERVER_ADMISSION_PHASES;
  readonly outcomes: typeof X402_RESOURCE_SERVER_ADMISSION_OUTCOMES;
  readonly actions: typeof X402_RESOURCE_SERVER_ADMISSION_ACTIONS;
  readonly expectationKinds: typeof X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_KINDS;
  readonly expectationStatuses: typeof X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_STATUSES;
  readonly headers: X402ResourceServerAdmissionHeaders;
  readonly standards: readonly string[];
  readonly runtimeChecks: readonly string[];
}
