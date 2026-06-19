import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  X402_HTTP_PAYMENT_REQUIRED_STATUS,
  X402_PAYMENT_REQUIRED_HEADER,
  X402_PAYMENT_RESPONSE_HEADER,
  X402_PAYMENT_SIGNATURE_HEADER,
} from '../crypto-authorization-core/x402-agentic-payment-adapter.js';
import {
  actionFor,
  blockingReasonsFor,
  expectationsFor,
  middlewareIdFor,
  nextActionsFor,
  outcomeFor,
} from './x402-resource-server-evaluation.js';
import {
  canonicalObject,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeMethod,
  normalizeOptionalIdentifier,
  normalizePhase,
  normalizeRuntimeObservation,
  normalizeUrl,
} from './x402-resource-server-internal.js';
import {
  X402_RESOURCE_SERVER_ADMISSION_ACTIONS,
  X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_KINDS,
  X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_STATUSES,
  X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION,
  X402_RESOURCE_SERVER_ADMISSION_OUTCOMES,
  X402_RESOURCE_SERVER_ADMISSION_PHASES,
  type CreateX402ResourceServerAdmissionMiddlewareInput,
  type X402ResourceServerAdmissionDescriptor,
  type X402ResourceServerAdmissionFacilitatorContract,
  type X402ResourceServerAdmissionFulfillmentGate,
  type X402ResourceServerAdmissionHeaders,
  type X402ResourceServerAdmissionMiddleware,
} from './x402-resource-server-types.js';

export * from './x402-resource-server-types.js';

/**
 * x402 resource-server admission middleware turns the Attestor admission plan
 * and x402 preflight evidence into the concrete fail-closed contract a resource
 * server middleware should honor before returning a paid response.
 */

export function createX402ResourceServerAdmissionMiddleware(
  input: CreateX402ResourceServerAdmissionMiddlewareInput,
): X402ResourceServerAdmissionMiddleware {
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const phase = normalizePhase(input.phase);
  const method = normalizeMethod(input.resource.method, 'resource.method');
  const resourceUrl = normalizeUrl(input.resource.resourceUrl, 'resource.resourceUrl');
  const runtimeObservation = normalizeRuntimeObservation(input.runtimeObservation);
  const expectations = expectationsFor({
    ...input,
    phase,
    runtimeObservation,
  });
  const blockingReasons = blockingReasonsFor({
    plan: input.plan,
    preflight: input.preflight,
    paymentRequirements: input.paymentRequirements,
    paymentPayload: input.paymentPayload,
    expectations,
  });
  const outcome = outcomeFor({
    phase,
    plan: input.plan,
    preflight: input.preflight,
    expectations,
    blockingReasons,
  });
  const action = actionFor({
    outcome,
    phase,
    expectations,
  });
  const middlewareId =
    normalizeOptionalIdentifier(input.middlewareId, 'middlewareId') ??
    middlewareIdFor({
      plan: input.plan,
      preflight: input.preflight,
      phase,
      createdAt,
    });

  const headers: X402ResourceServerAdmissionHeaders = Object.freeze({
    paymentRequiredStatus: X402_HTTP_PAYMENT_REQUIRED_STATUS,
    paymentRequired: X402_PAYMENT_REQUIRED_HEADER,
    paymentSignature: X402_PAYMENT_SIGNATURE_HEADER,
    paymentResponse: X402_PAYMENT_RESPONSE_HEADER,
  });

  const facilitatorContract: X402ResourceServerAdmissionFacilitatorContract =
    Object.freeze({
      facilitatorUrl: normalizeUrl(
        input.facilitator.facilitatorUrl,
        'facilitator.facilitatorUrl',
      ),
      path: input.facilitator.path,
      verifyPath: '/verify',
      settlePath: '/settle',
    });

  const fulfillmentGate: X402ResourceServerAdmissionFulfillmentGate = Object.freeze({
    requiresSettlementSuccess: true,
    requiresPaymentResponseHeader: true,
    requiresIdempotencyProtection: true,
    challengeStatusCode: X402_HTTP_PAYMENT_REQUIRED_STATUS,
  });

  const attestorSidecar = Object.freeze({
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    releaseBindingDigest: input.preflight.releaseBindingDigest,
    policyScopeDigest: input.preflight.policyScopeDigest,
    enforcementBindingDigest: input.preflight.enforcementBindingDigest,
    phase,
    outcome,
    action,
  });

  const canonicalPayload = {
    version: X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION,
    middlewareId,
    createdAt,
    phase,
    outcome,
    action,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    simulationId: input.plan.simulationId,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    routeId: normalizeOptionalIdentifier(input.resource.routeId, 'resource.routeId'),
    method,
    resourceUrl,
    payer: normalizeIdentifier(input.paymentPayload.payer, 'paymentPayload.payer'),
    payTo: normalizeIdentifier(input.paymentRequirements.payTo, 'paymentRequirements.payTo'),
    network: normalizeIdentifier(input.paymentRequirements.network, 'paymentRequirements.network'),
    scheme: normalizeIdentifier(input.paymentRequirements.scheme, 'paymentRequirements.scheme'),
    amount: normalizeIdentifier(input.paymentRequirements.amount, 'paymentRequirements.amount'),
    asset: normalizeIdentifier(input.paymentRequirements.asset, 'paymentRequirements.asset'),
    budgetId: normalizeIdentifier(input.budget.budgetId, 'budget.budgetId'),
    idempotencyKey: normalizeIdentifier(input.budget.idempotencyKey, 'budget.idempotencyKey'),
    requirementsHash: normalizeOptionalIdentifier(
      input.paymentRequirements.requirementsHash,
      'paymentRequirements.requirementsHash',
    ),
    payloadHash: normalizeOptionalIdentifier(
      input.paymentPayload.payloadHash,
      'paymentPayload.payloadHash',
    ),
    settlementTransaction: normalizeOptionalIdentifier(
      input.facilitator.settlementTransaction,
      'facilitator.settlementTransaction',
    ),
    headers,
    facilitatorContract,
    fulfillmentGate,
    runtimeObservation,
    attestorSidecar,
    expectations,
    blockingReasons,
    nextActions: nextActionsFor({ outcome, action }),
    operatorNote: normalizeOptionalIdentifier(input.operatorNote, 'operatorNote'),
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function x402ResourceServerAdmissionLabel(
  middleware: X402ResourceServerAdmissionMiddleware,
): string {
  return [
    `x402-resource-server:${middleware.phase}`,
    `${middleware.method} ${middleware.resourceUrl}`,
    `outcome:${middleware.outcome}`,
    `action:${middleware.action}`,
  ].join(' / ');
}

export function x402ResourceServerAdmissionDescriptor():
X402ResourceServerAdmissionDescriptor {
  return Object.freeze({
    version: X402_RESOURCE_SERVER_ADMISSION_MIDDLEWARE_SPEC_VERSION,
    phases: X402_RESOURCE_SERVER_ADMISSION_PHASES,
    outcomes: X402_RESOURCE_SERVER_ADMISSION_OUTCOMES,
    actions: X402_RESOURCE_SERVER_ADMISSION_ACTIONS,
    expectationKinds: X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_KINDS,
    expectationStatuses: X402_RESOURCE_SERVER_ADMISSION_EXPECTATION_STATUSES,
    headers: Object.freeze({
      paymentRequiredStatus: X402_HTTP_PAYMENT_REQUIRED_STATUS,
      paymentRequired: X402_PAYMENT_REQUIRED_HEADER,
      paymentSignature: X402_PAYMENT_SIGNATURE_HEADER,
      paymentResponse: X402_PAYMENT_RESPONSE_HEADER,
    }),
    standards: Object.freeze(['x402-v2', 'HTTP 402', 'EIP-3009']),
    runtimeChecks: Object.freeze([
      'PAYMENT-REQUIRED',
      'PAYMENT-SIGNATURE',
      'facilitatorVerify',
      'facilitatorSettle',
      'PAYMENT-RESPONSE',
      'paymentIdentifier',
      'fulfillmentGate',
    ]),
  });
}
