import type { CryptoSimulationPreflightSignal } from './authorization-simulation.js';
import {
  X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
  X402_PROTOCOL_VERSION,
  type X402AgentBudgetEvidence,
  type X402FacilitatorEvidence,
  type X402Observation,
  type X402Outcome,
  type X402PaymentPayloadEvidence,
  type X402PaymentRequirementsEvidence,
  type X402ResourceEvidence,
} from './x402-agentic-payment-adapter-types.js';

export function outcomeFromObservations(observations: readonly X402Observation[]): X402Outcome {
  if (observations.some((entry) => entry.status === 'fail')) {
    return 'block';
  }
  if (observations.some((entry) => entry.required && entry.status === 'warn')) {
    return 'review-required';
  }
  return 'allow';
}

function signalStatusFor(outcome: X402Outcome): CryptoSimulationPreflightSignal['status'] {
  switch (outcome) {
    case 'allow':
      return 'pass';
    case 'review-required':
      return 'warn';
    case 'block':
      return 'fail';
  }
}

function nonPassingReasonCodes(observations: readonly X402Observation[]): readonly string[] {
  return Object.freeze(
    observations
      .filter((entry) => entry.status !== 'pass')
      .map((entry) => entry.code),
  );
}

export function signalFor(input: {
  readonly outcome: X402Outcome;
  readonly preflightId: string;
  readonly resource: X402ResourceEvidence;
  readonly requirements: X402PaymentRequirementsEvidence;
  readonly payload: X402PaymentPayloadEvidence;
  readonly facilitator: X402FacilitatorEvidence;
  readonly budget: X402AgentBudgetEvidence;
  readonly observations: readonly X402Observation[];
}): CryptoSimulationPreflightSignal {
  return Object.freeze({
    source: 'x402-payment',
    status: signalStatusFor(input.outcome),
    code: input.outcome === 'allow'
      ? 'x402-agentic-payment-adapter-allow'
      : input.outcome === 'review-required'
        ? 'x402-agentic-payment-adapter-review-required'
        : 'x402-agentic-payment-adapter-block',
    message: input.outcome === 'allow'
      ? 'x402 agentic payment adapter accepted the Attestor-bound payment preflight.'
      : input.outcome === 'review-required'
        ? 'x402 agentic payment adapter needs settlement or reviewer evidence before access.'
        : 'x402 agentic payment adapter would block HTTP-native agent payment fail-closed.',
    required: true,
    evidence: Object.freeze({
      adapterVersion: X402_AGENTIC_PAYMENT_ADAPTER_SPEC_VERSION,
      preflightId: input.preflightId,
      protocolVersion: X402_PROTOCOL_VERSION,
      resourceUrl: input.resource.resourceUrl,
      method: input.resource.method,
      network: input.requirements.network,
      scheme: input.requirements.scheme,
      amount: input.requirements.amount,
      asset: input.requirements.asset,
      payTo: input.requirements.payTo,
      payer: input.payload.payer,
      facilitatorUrl: input.facilitator.facilitatorUrl,
      budgetId: input.budget.budgetId,
      idempotencyKey: input.budget.idempotencyKey,
      reasonCodes: nonPassingReasonCodes(input.observations),
    }),
  });
}
