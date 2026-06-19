import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION,
  type CreateIntentSolverAdmissionHandoffInput,
  type IntentSolverAdmissionAction,
  type IntentSolverAdmissionExpectation,
  type IntentSolverAdmissionHandoff,
  type IntentSolverAdmissionOutcome,
  type IntentSolverExpectationKind,
} from './intent-solver-types.js';
import {
  canonicalObject,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
} from './intent-solver-utils.js';
import {
  normalizedCounterparty,
  normalizedOrder,
  normalizedReplay,
  normalizedRoute,
  normalizedRuntimeObservation,
  normalizedSettlement,
} from './intent-solver-normalize.js';
import { expectationsFor } from './intent-solver-expectations.js';

function outcomeFor(
  expectations: readonly IntentSolverAdmissionExpectation[],
): IntentSolverAdmissionOutcome {
  if (expectations.some((entry) => entry.status === 'failed' || entry.status === 'unsupported')) {
    return 'blocked';
  }
  const admissionBlockingKinds: readonly IntentSolverExpectationKind[] = [
    'plan-surface',
    'adapter-preflight',
    'order-binding',
    'route-commitment',
    'solver-identity',
    'settlement-contract',
    'counterparty-binding',
    'slippage-limit',
    'deadline-window',
    'fill-instructions',
    'liquidity-posture',
    'attestor-token-binding',
    'replay-protection',
  ];
  const admissionExpectations = expectations.filter((entry) =>
    admissionBlockingKinds.includes(entry.kind),
  );
  if (admissionExpectations.some((entry) => entry.status !== 'satisfied')) {
    return 'needs-solver-evidence';
  }
  return 'ready';
}

function actionFor(outcome: IntentSolverAdmissionOutcome): IntentSolverAdmissionAction {
  if (outcome === 'ready') return 'submit-order';
  if (outcome === 'needs-solver-evidence') return 'request-route-review';
  return 'block-route';
}

function blockingReasonsFor(
  expectations: readonly IntentSolverAdmissionExpectation[],
): readonly string[] {
  return Object.freeze(
    expectations
      .filter((entry) => entry.status === 'failed' || entry.status === 'unsupported')
      .map((entry) => entry.reasonCode),
  );
}

function nextActionsFor(
  outcome: IntentSolverAdmissionOutcome,
  expectations: readonly IntentSolverAdmissionExpectation[],
): readonly string[] {
  if (outcome === 'ready') {
    return Object.freeze([
      'Submit the admitted intent order through the bound settlement method and solver route.',
      'Record post-settlement observation against the Attestor handoff after execution returns.',
    ]);
  }
  if (outcome === 'blocked') {
    return Object.freeze([
      'Do not open, fill, submit, or broadcast this intent route.',
      'Create a new solver route commitment after resolving blocked Attestor expectations.',
    ]);
  }
  return Object.freeze(
    expectations
      .filter((entry) => entry.status === 'missing' || entry.status === 'pending')
      .map((entry) => entry.reasonCode),
  );
}

function handoffIdFor(input: {
  readonly planId: string;
  readonly orderId: string;
  readonly routeId: string;
  readonly createdAt: string;
}): string {
  const material = canonicalizeReleaseJson(input as unknown as CanonicalReleaseJsonValue);
  return `intent-solver-handoff-${createHash('sha256')
    .update(material)
    .digest('hex')
    .slice(0, 24)}`;
}

export function createIntentSolverAdmissionHandoff(
  input: CreateIntentSolverAdmissionHandoffInput,
): IntentSolverAdmissionHandoff {
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const order = normalizedOrder(input.order);
  const route = normalizedRoute(input.route);
  const settlement = normalizedSettlement(input.settlement);
  const counterparty = normalizedCounterparty(input.counterparty);
  const replay = normalizedReplay(input.replay);
  const runtimeObservation = normalizedRuntimeObservation(input.runtimeObservation);
  const expectations = expectationsFor({
    plan: input.plan,
    createdAt,
    order,
    route,
    settlement,
    counterparty,
    replay,
    runtimeObservation,
  });
  const outcome = outcomeFor(expectations);
  const action = actionFor(outcome);
  const handoffId =
    normalizeOptionalIdentifier(input.handoffId, 'handoffId') ??
    handoffIdFor({
      planId: input.plan.planId,
      orderId: order.orderId,
      routeId: route.routeId,
      createdAt,
    });
  const destinationSettlers = Object.freeze([...settlement.destinationSettlers]);
  const canonicalPayload = {
    version: INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION,
    handoffId,
    createdAt,
    outcome,
    action,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    simulationId: input.plan.simulationId,
    intentId: input.plan.intentId,
    orderId: order.orderId,
    orderKind: order.orderKind,
    routeId: route.routeId,
    routeHash: route.routeHash,
    solverId: route.solverId,
    solverAddress: route.solverAddress,
    originChainId: order.originChainId,
    destinationChainIds: Object.freeze([...route.destinationChainIds]),
    originSettler: order.originSettler,
    destinationSettlers,
    settlementMethod: settlement.settlementMethod,
    settlementWindow: Object.freeze({
      openDeadline: order.openDeadline,
      fillDeadline: order.fillDeadline,
      quoteExpiresAt: route.quoteExpiresAt,
      settlementWindowSeconds: settlement.settlementWindowSeconds,
    }),
    slippage: Object.freeze({
      inputAmount: route.inputAmount,
      quotedOutputAmount: route.quotedOutputAmount,
      minOutputAmount: route.minOutputAmount,
      slippageBps: route.slippageBps,
      maxSlippageBps: route.maxSlippageBps,
    }),
    replayProtectionMode: replay.replayProtectionMode,
    idempotencyKey: replay.idempotencyKey,
    submitContract: Object.freeze({
      settlementMethod: settlement.settlementMethod,
      orderKind: order.orderKind,
      originSettler: settlement.originSettler,
      destinationSettlers,
      requiresResolvedOrder: true,
      requiresFillInstructionBinding: true,
      requiresReplayProtection: true,
      requiresAttestorSidecar: true,
    }),
    runtimeObservation,
    attestorSidecar: Object.freeze({
      attestorPlanId: input.plan.planId,
      attestorPlanDigest: input.plan.digest,
      attestorSimulationId: input.plan.simulationId,
      attestorSimulationDigest: input.plan.simulationDigest,
      routeHash: route.routeHash,
      orderDataHash: order.orderDataHash,
      resolvedOrderHash: order.resolvedOrderHash,
    }),
    expectations,
    blockingReasons: blockingReasonsFor(expectations),
    nextActions: nextActionsFor(outcome, expectations),
    operatorNote: normalizeOptionalIdentifier(input.operatorNote, 'operatorNote'),
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
