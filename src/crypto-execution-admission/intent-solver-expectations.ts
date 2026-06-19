import type { CryptoExecutionAdmissionPlan } from './index.js';
import type {
  IntentSolverAdmissionExpectation,
  IntentSolverCounterpartyEvidence,
  IntentSolverOrderEvidence,
  IntentSolverReplayEvidence,
  IntentSolverRouteCommitmentEvidence,
  IntentSolverRuntimeObservation,
  IntentSolverSettlementEvidence,
} from './intent-solver-types.js';
import {
  deadlineInFuture,
  deadlineNotAfter,
  expectation,
  parseAtomicUnits,
  sameIdentifier,
} from './intent-solver-utils.js';

function fillInstructionsCoverRoute(
  route: IntentSolverRouteCommitmentEvidence,
): boolean {
  const instructionChains = new Set(
    route.fillInstructions.map((instruction) => instruction.destinationChainId),
  );
  return route.destinationChainIds.every((chainId) => instructionChains.has(chainId));
}

function destinationSettlersCoverRoute(
  settlement: IntentSolverSettlementEvidence,
  route: IntentSolverRouteCommitmentEvidence,
): boolean {
  const normalizedSettlers = new Set(
    settlement.destinationSettlers.map((settler) => settler.toLowerCase()),
  );
  return route.fillInstructions.every((instruction) =>
    normalizedSettlers.has(instruction.destinationSettler.toLowerCase()),
  );
}

function routeCounterpartiesAllowed(
  route: IntentSolverRouteCommitmentEvidence,
  counterparty: IntentSolverCounterpartyEvidence,
): boolean {
  if (counterparty.blockedCounterpartyRefs.length === 0) return true;
  const blocked = new Set(
    counterparty.blockedCounterpartyRefs.map((value) => value.toLowerCase()),
  );
  return route.counterpartyRefs.every((value) => !blocked.has(value.toLowerCase()));
}

export function expectationsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly createdAt: string;
  readonly order: IntentSolverOrderEvidence;
  readonly route: IntentSolverRouteCommitmentEvidence;
  readonly settlement: IntentSolverSettlementEvidence;
  readonly counterparty: IntentSolverCounterpartyEvidence;
  readonly replay: IntentSolverReplayEvidence;
  readonly runtimeObservation: IntentSolverRuntimeObservation | null;
}): readonly IntentSolverAdmissionExpectation[] {
  const {
    plan,
    createdAt,
    order,
    route,
    settlement,
    counterparty,
    replay,
    runtimeObservation,
  } = input;
  const minOutput = parseAtomicUnits(route.minOutputAmount, 'route.minOutputAmount');
  const quotedOutput = parseAtomicUnits(route.quotedOutputAmount, 'route.quotedOutputAmount');
  const routeChainsCovered = fillInstructionsCoverRoute(route);
  const settlementCoversRoute = destinationSettlersCoverRoute(settlement, route);
  const routeCounterpartiesClean = routeCounterpartiesAllowed(route, counterparty);
  const counterpartyTrustEvidenceReady =
    counterparty.allowlisted &&
    counterparty.screeningStatus === 'clear' &&
    counterparty.allowlistEvidenceRef !== null &&
    counterparty.screeningEvidenceRef !== null;
  const counterpartyBindingReady =
    counterpartyTrustEvidenceReady &&
    !counterparty.blocked &&
    routeCounterpartiesClean;
  const counterpartyBindingPending =
    !counterparty.blocked &&
    (
      counterparty.screeningStatus === 'pending' ||
      (
        counterparty.allowlisted &&
        counterparty.screeningStatus === 'clear' &&
        !counterpartyTrustEvidenceReady
      )
    );
  const orderFresh =
    deadlineInFuture(order.openDeadline, createdAt) &&
    deadlineInFuture(order.fillDeadline, createdAt) &&
    deadlineInFuture(route.quoteExpiresAt, createdAt) &&
    deadlineInFuture(route.exclusivityDeadline, createdAt);
  const deadlinesBound =
    settlement.fillDeadline === order.fillDeadline &&
    deadlineNotAfter(route.quoteExpiresAt, order.fillDeadline) &&
    deadlineNotAfter(route.exclusivityDeadline, order.fillDeadline);

  return Object.freeze([
    expectation({
      kind: 'plan-surface',
      status:
        plan.surface === 'intent-solver' && plan.adapterKind === 'intent-settlement'
          ? 'satisfied'
          : 'failed',
      reasonCode:
        plan.surface === 'intent-solver' && plan.adapterKind === 'intent-settlement'
          ? 'intent-solver-plan-bound'
          : 'intent-solver-plan-surface-mismatch',
      evidence: {
        planSurface: plan.surface,
        adapterKind: plan.adapterKind,
        planOutcome: plan.outcome,
      },
    }),
    expectation({
      kind: 'adapter-preflight',
      status:
        plan.outcome === 'deny'
          ? 'failed'
          : plan.outcome === 'admit'
            ? 'satisfied'
            : 'missing',
      reasonCode:
        plan.outcome === 'deny'
          ? 'intent-solver-plan-denied'
          : plan.outcome === 'admit'
            ? 'intent-solver-plan-admitted'
            : 'intent-solver-plan-needs-evidence',
      evidence: {
        requiredArtifacts: [...plan.requiredHandoffArtifacts],
        blockedReasons: [...plan.blockedReasons],
      },
    }),
    expectation({
      kind: 'order-binding',
      status:
        sameIdentifier(order.originChainId, plan.chainId) &&
        sameIdentifier(order.user, plan.accountAddress) &&
        sameIdentifier(route.originChainId, order.originChainId)
          ? 'satisfied'
          : 'failed',
      reasonCode:
        sameIdentifier(order.originChainId, plan.chainId) &&
        sameIdentifier(order.user, plan.accountAddress) &&
        sameIdentifier(route.originChainId, order.originChainId)
          ? 'intent-order-bound-to-plan'
          : 'intent-order-plan-mismatch',
      evidence: {
        orderId: order.orderId,
        orderKind: order.orderKind,
        orderUser: order.user,
        planAccount: plan.accountAddress,
        originChainId: order.originChainId,
        planChainId: plan.chainId,
      },
    }),
    expectation({
      kind: 'route-commitment',
      status: route.routeHash && route.routeSimulationHash ? 'satisfied' : 'missing',
      reasonCode:
        route.routeHash && route.routeSimulationHash
          ? 'solver-route-commitment-bound'
          : 'solver-route-commitment-missing',
      evidence: {
        routeId: route.routeId,
        routeHash: route.routeHash,
        routeSimulationHash: route.routeSimulationHash,
      },
    }),
    expectation({
      kind: 'solver-identity',
      status:
        counterparty.solverId === route.solverId &&
        sameIdentifier(counterparty.solverAddress, route.solverAddress)
          ? 'satisfied'
          : 'failed',
      reasonCode:
        counterparty.solverId === route.solverId &&
        sameIdentifier(counterparty.solverAddress, route.solverAddress)
          ? 'solver-identity-bound'
          : 'solver-identity-mismatch',
      evidence: {
        routeSolverId: route.solverId,
        counterpartySolverId: counterparty.solverId,
        routeSolverAddress: route.solverAddress,
        counterpartySolverAddress: counterparty.solverAddress,
      },
    }),
    expectation({
      kind: 'settlement-contract',
      status:
        sameIdentifier(order.originSettler, settlement.originSettler) &&
        settlementCoversRoute &&
        settlement.settlementContractVerified &&
        settlement.settlementSecurityReviewed
          ? 'satisfied'
          : settlement.settlementContractVerified
            ? 'pending'
            : 'failed',
      reasonCode:
        sameIdentifier(order.originSettler, settlement.originSettler) &&
        settlementCoversRoute &&
        settlement.settlementContractVerified &&
        settlement.settlementSecurityReviewed
          ? 'settlement-contracts-verified'
          : !settlement.settlementContractVerified
            ? 'settlement-contract-unverified'
            : 'settlement-contract-review-pending',
      evidence: {
        originSettler: settlement.originSettler,
        destinationSettlers: [...settlement.destinationSettlers],
        settlementSystem: settlement.settlementSystem,
        settlementSecurityReviewed: settlement.settlementSecurityReviewed,
      },
    }),
    expectation({
      kind: 'counterparty-binding',
      status: counterpartyBindingReady
        ? 'satisfied'
        : counterpartyBindingPending
          ? 'pending'
          : 'failed',
      reasonCode: counterpartyBindingReady
        ? 'solver-counterparties-clear'
        : counterpartyBindingPending
          ? counterparty.screeningStatus === 'pending'
            ? 'solver-counterparty-screening-pending'
            : 'solver-counterparty-evidence-missing'
          : 'solver-counterparty-blocked',
      evidence: {
        allowlisted: counterparty.allowlisted,
        allowlistEvidenceRef: counterparty.allowlistEvidenceRef ?? null,
        blocked: counterparty.blocked,
        screeningStatus: counterparty.screeningStatus,
        screeningEvidenceRef: counterparty.screeningEvidenceRef ?? null,
        counterpartyEvidenceSource: 'customer-solver-screening-evidence',
        counterpartyRefs: [...route.counterpartyRefs],
        blockedCounterpartyRefs: [...counterparty.blockedCounterpartyRefs],
      },
    }),
    expectation({
      kind: 'slippage-limit',
      status:
        minOutput <= quotedOutput && route.slippageBps <= route.maxSlippageBps
          ? 'satisfied'
          : 'failed',
      reasonCode:
        minOutput <= quotedOutput && route.slippageBps <= route.maxSlippageBps
          ? 'solver-slippage-within-bound'
          : 'solver-slippage-out-of-bound',
      evidence: {
        quotedOutputAmount: route.quotedOutputAmount,
        minOutputAmount: route.minOutputAmount,
        slippageBps: route.slippageBps,
        maxSlippageBps: route.maxSlippageBps,
      },
    }),
    expectation({
      kind: 'deadline-window',
      status: orderFresh && deadlinesBound ? 'satisfied' : 'failed',
      reasonCode:
        orderFresh && deadlinesBound
          ? 'solver-deadlines-bound-and-fresh'
          : 'solver-deadline-window-invalid',
      evidence: {
        createdAt,
        openDeadline: order.openDeadline,
        fillDeadline: order.fillDeadline,
        quoteExpiresAt: route.quoteExpiresAt,
        exclusivityDeadline: route.exclusivityDeadline,
        settlementFillDeadline: settlement.fillDeadline,
      },
    }),
    expectation({
      kind: 'fill-instructions',
      status:
        routeChainsCovered &&
        route.fillInstructions.length > 0 &&
        order.resolvedOrderHash !== null
          ? 'satisfied'
          : 'missing',
      reasonCode:
        routeChainsCovered &&
        route.fillInstructions.length > 0 &&
        order.resolvedOrderHash !== null
          ? 'solver-fill-instructions-bound'
          : 'solver-fill-instructions-incomplete',
      evidence: {
        destinationChainIds: [...route.destinationChainIds],
        fillInstructionCount: route.fillInstructions.length,
        resolvedOrderHash: order.resolvedOrderHash,
      },
    }),
    expectation({
      kind: 'liquidity-posture',
      status:
        settlement.liquiditySource &&
        settlement.refundPathAvailable &&
        counterparty.requiredBondSatisfied !== false
          ? 'satisfied'
          : 'pending',
      reasonCode:
        settlement.liquiditySource &&
        settlement.refundPathAvailable &&
        counterparty.requiredBondSatisfied !== false
          ? 'solver-liquidity-and-refund-ready'
          : 'solver-liquidity-or-refund-pending',
      evidence: {
        liquiditySource: settlement.liquiditySource,
        refundPathAvailable: settlement.refundPathAvailable,
        bondPosted: counterparty.bondPosted,
        requiredBondSatisfied: counterparty.requiredBondSatisfied,
      },
    }),
    expectation({
      kind: 'attestor-token-binding',
      status: plan.requiredHandoffArtifacts.includes('attestor-release-authorization')
        ? 'satisfied'
        : 'failed',
      reasonCode: plan.requiredHandoffArtifacts.includes('attestor-release-authorization')
        ? 'attestor-release-authorization-bound'
        : 'attestor-release-authorization-missing',
      evidence: {
        planId: plan.planId,
        planDigest: plan.digest,
        simulationDigest: plan.simulationDigest,
      },
    }),
    expectation({
      kind: 'replay-protection',
      status:
        replay.nonce === order.nonce &&
        replay.nonceFresh &&
        !replay.orderAlreadyOpened &&
        !replay.duplicateOrderDetected &&
        !replay.routeReplayDetected
          ? 'satisfied'
          : 'failed',
      reasonCode:
        replay.nonce === order.nonce &&
        replay.nonceFresh &&
        !replay.orderAlreadyOpened &&
        !replay.duplicateOrderDetected &&
        !replay.routeReplayDetected
          ? 'solver-replay-protection-bound'
          : 'solver-replay-risk-detected',
      evidence: {
        replayProtectionMode: replay.replayProtectionMode,
        orderNonce: order.nonce,
        replayNonce: replay.nonce,
        idempotencyKey: replay.idempotencyKey,
        orderAlreadyOpened: replay.orderAlreadyOpened,
        duplicateOrderDetected: replay.duplicateOrderDetected,
        routeReplayDetected: replay.routeReplayDetected,
      },
    }),
    expectation({
      kind: 'post-settlement',
      status:
        runtimeObservation === null
          ? 'pending'
          : runtimeObservation.replayBlocked === true ||
              runtimeObservation.settlementCompleted === false
            ? 'failed'
            : runtimeObservation.settlementCompleted === true
              ? 'satisfied'
              : 'pending',
      reasonCode:
        runtimeObservation === null
          ? 'solver-post-settlement-not-observed'
          : runtimeObservation.replayBlocked === true
            ? 'solver-post-settlement-replay-blocked'
            : runtimeObservation.settlementCompleted === false
              ? 'solver-post-settlement-failed'
              : runtimeObservation.settlementCompleted === true
                ? 'solver-post-settlement-recorded'
                : 'solver-post-settlement-pending',
      evidence: {
        observedAt: runtimeObservation?.observedAt ?? null,
        orderSubmitted: runtimeObservation?.orderSubmitted ?? null,
        settlementCompleted: runtimeObservation?.settlementCompleted ?? null,
        replayBlocked: runtimeObservation?.replayBlocked ?? null,
      },
    }),
  ]);
}
