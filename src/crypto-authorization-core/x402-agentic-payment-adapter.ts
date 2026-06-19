import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createCryptoAuthorizationSimulation,
} from './authorization-simulation.js';
import {
  X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
  X402_PROTOCOL_VERSION,
  type CreateX402AgenticPaymentPreflightInput,
  type X402AgentBudgetEvidence,
  type X402AgenticPaymentPreflight,
  type X402AgenticPaymentSimulationResult,
  type X402FacilitatorEvidence,
  type X402PaymentPayloadEvidence,
  type X402PaymentRequirementsEvidence,
  type X402ResourceEvidence,
} from './x402-agentic-payment-adapter-types.js';
import {
  assertAdapterConsistency,
  normalizeBudget,
  normalizeFacilitator,
  normalizeOptionalIdentifier,
  normalizePayload,
  normalizePrivacy,
  normalizeRequirements,
  normalizeResource,
  normalizeServiceTrust,
} from './x402-agentic-payment-adapter-normalize.js';
import { buildObservations } from './x402-agentic-payment-adapter-observations.js';
import {
  outcomeFromObservations,
  signalFor,
} from './x402-agentic-payment-adapter-signal.js';

export * from './x402-agentic-payment-adapter-types.js';
export { x402AgenticPaymentAdapterDescriptor } from './x402-agentic-payment-adapter-descriptor.js';

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: 'sha256:' + createHash('sha256').update(canonical).digest('hex'),
  });
}

function preflightIdFor(input: {
  readonly resource: X402ResourceEvidence;
  readonly requirements: X402PaymentRequirementsEvidence;
  readonly payload: X402PaymentPayloadEvidence;
  readonly facilitator: X402FacilitatorEvidence;
  readonly budget: X402AgentBudgetEvidence;
  readonly releaseBindingDigest: string;
  readonly policyScopeDigest: string;
  readonly enforcementBindingDigest: string;
}): string {
  return canonicalObject({
    version: X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
    resourceUrl: input.resource.resourceUrl,
    method: input.resource.method,
    network: input.requirements.network,
    scheme: input.requirements.scheme,
    amount: input.requirements.amount,
    asset: input.requirements.asset,
    payTo: input.requirements.payTo,
    payloadHash: input.payload.payloadHash ?? null,
    authorizationNonce: input.payload.authorization.nonce,
    facilitatorUrl: input.facilitator.facilitatorUrl,
    budgetId: input.budget.budgetId,
    idempotencyKey: input.budget.idempotencyKey,
    releaseBindingDigest: input.releaseBindingDigest,
    policyScopeDigest: input.policyScopeDigest,
    enforcementBindingDigest: input.enforcementBindingDigest,
  }).digest;
}

export function createX402AgenticPaymentPreflight(
  input: CreateX402AgenticPaymentPreflightInput,
): X402AgenticPaymentPreflight {
  assertAdapterConsistency(input);
  const resource = normalizeResource(input.resource);
  const requirements = normalizeRequirements(input.paymentRequirements);
  const payload = normalizePayload(input.paymentPayload, requirements);
  const facilitator = normalizeFacilitator(input.facilitator);
  const budget = normalizeBudget(input.budget);
  const serviceTrust = normalizeServiceTrust(input.serviceTrust);
  const privacy = normalizePrivacy(input.privacy);
  const observations = buildObservations({
    intent: input.intent,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    resource,
    requirements,
    payload,
    facilitator,
    budget,
    serviceTrust,
    privacy,
  });
  const outcome = outcomeFromObservations(observations);
  const preflightId =
    normalizeOptionalIdentifier(input.preflightId, 'preflightId') ??
    preflightIdFor({
      resource,
      requirements,
      payload,
      facilitator,
      budget,
      releaseBindingDigest: input.releaseBinding.digest,
      policyScopeDigest: input.policyScopeBinding.digest,
      enforcementBindingDigest: input.enforcementBinding.digest,
    });
  const signal = signalFor({
    outcome,
    preflightId,
    resource,
    requirements,
    payload,
    facilitator,
    budget,
    observations,
  });
  const canonicalPayload = {
    version: X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
    preflightId,
    adapterKind: 'x402-payment' as const,
    checkedAt: resource.observedAt,
    x402Version: X402_PROTOCOL_VERSION,
    transport: 'http' as const,
    resourceUrl: resource.resourceUrl,
    method: resource.method,
    payer: payload.payer,
    payTo: requirements.payTo,
    network: requirements.network,
    scheme: 'exact' as const,
    asset: requirements.asset,
    amount: requirements.amount,
    budgetId: budget.budgetId,
    idempotencyKey: budget.idempotencyKey,
    outcome,
    signal,
    observations,
    releaseBindingDigest: input.releaseBinding.digest,
    policyScopeDigest: input.policyScopeBinding.digest,
    enforcementBindingDigest: input.enforcementBinding.digest,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function simulateX402AgenticPaymentAuthorization(
  input: CreateX402AgenticPaymentPreflightInput,
): X402AgenticPaymentSimulationResult {
  const preflight = createX402AgenticPaymentPreflight(input);
  const simulation = createCryptoAuthorizationSimulation({
    intent: input.intent,
    riskAssessment: input.riskAssessment,
    releaseBinding: input.releaseBinding,
    policyScopeBinding: input.policyScopeBinding,
    enforcementBinding: input.enforcementBinding,
    simulatedAt: preflight.checkedAt,
    preflightSignals: [preflight.signal],
    operatorNote: `x402 payment ${preflight.payer} -> ${preflight.payTo} ${preflight.amount} ${preflight.asset} preflight ${preflight.outcome}.`,
  });

  return Object.freeze({
    preflight,
    simulation,
  });
}

export function x402AgenticPaymentPreflightLabel(
  preflight: X402AgenticPaymentPreflight,
): string {
  return [
    `x402:${preflight.method}`,
    preflight.resourceUrl,
    `payTo:${preflight.payTo}`,
    `amount:${preflight.amount}`,
    `outcome:${preflight.outcome}`,
  ].join(' / ');
}
