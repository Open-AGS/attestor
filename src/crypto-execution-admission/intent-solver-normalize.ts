import type {
  IntentSolverCounterpartyEvidence,
  IntentSolverFillInstructionEvidence,
  IntentSolverOrderEvidence,
  IntentSolverReplayEvidence,
  IntentSolverRouteCommitmentEvidence,
  IntentSolverRuntimeObservation,
  IntentSolverSettlementEvidence,
} from './intent-solver-types.js';
import {
  deadlineNotAfter,
  normalizeAtomicUnits,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeNonNegativeInteger,
  normalizeOptionalIdentifier,
  normalizeOptionalIsoTimestamp,
  normalizeOptionalStringList,
  normalizeOrderKind,
  normalizePositiveInteger,
  normalizeReplayProtectionMode,
  normalizeScreeningStatus,
  normalizeSettlementMethod,
  normalizeStringList,
} from './intent-solver-utils.js';

export function normalizedOrder(order: IntentSolverOrderEvidence): IntentSolverOrderEvidence {
  const openDeadline = normalizeOptionalIsoTimestamp(order.openDeadline, 'order.openDeadline');
  const fillDeadline = normalizeIsoTimestamp(order.fillDeadline, 'order.fillDeadline');
  if (!deadlineNotAfter(openDeadline, fillDeadline)) {
    throw new Error(
      'intent-solver admission order.openDeadline must be at or before order.fillDeadline.',
    );
  }
  return Object.freeze({
    orderKind: normalizeOrderKind(order.orderKind),
    orderId: normalizeIdentifier(order.orderId, 'order.orderId'),
    user: normalizeIdentifier(order.user, 'order.user'),
    originChainId: normalizeIdentifier(order.originChainId, 'order.originChainId'),
    originSettler: normalizeIdentifier(order.originSettler, 'order.originSettler'),
    orderDataType: normalizeOptionalIdentifier(order.orderDataType, 'order.orderDataType'),
    orderDataHash: normalizeIdentifier(order.orderDataHash, 'order.orderDataHash'),
    openDeadline,
    fillDeadline,
    nonce: normalizeIdentifier(order.nonce, 'order.nonce'),
    signatureHash: normalizeOptionalIdentifier(order.signatureHash, 'order.signatureHash'),
    resolvedOrderHash: normalizeOptionalIdentifier(
      order.resolvedOrderHash,
      'order.resolvedOrderHash',
    ),
    maxSpentHash: normalizeOptionalIdentifier(order.maxSpentHash, 'order.maxSpentHash'),
    minReceivedHash: normalizeOptionalIdentifier(
      order.minReceivedHash,
      'order.minReceivedHash',
    ),
  });
}

export function normalizedFillInstruction(
  instruction: IntentSolverFillInstructionEvidence,
  index: number,
): IntentSolverFillInstructionEvidence {
  return Object.freeze({
    instructionId: normalizeIdentifier(
      instruction.instructionId,
      `route.fillInstructions[${index}].instructionId`,
    ),
    destinationChainId: normalizeIdentifier(
      instruction.destinationChainId,
      `route.fillInstructions[${index}].destinationChainId`,
    ),
    destinationSettler: normalizeIdentifier(
      instruction.destinationSettler,
      `route.fillInstructions[${index}].destinationSettler`,
    ),
    originDataHash: normalizeIdentifier(
      instruction.originDataHash,
      `route.fillInstructions[${index}].originDataHash`,
    ),
  });
}

export function normalizedRoute(
  route: IntentSolverRouteCommitmentEvidence,
): IntentSolverRouteCommitmentEvidence {
  const destinationChainIds = normalizeStringList(
    route.destinationChainIds,
    'route.destinationChainIds',
  );
  if (route.fillInstructions.length === 0) {
    throw new Error('intent-solver admission route.fillInstructions requires at least one value.');
  }
  return Object.freeze({
    routeId: normalizeIdentifier(route.routeId, 'route.routeId'),
    routeHash: normalizeIdentifier(route.routeHash, 'route.routeHash'),
    quoteId: normalizeOptionalIdentifier(route.quoteId, 'route.quoteId'),
    quoteExpiresAt: normalizeOptionalIsoTimestamp(route.quoteExpiresAt, 'route.quoteExpiresAt'),
    committedAt: normalizeIsoTimestamp(route.committedAt, 'route.committedAt'),
    solverId: normalizeIdentifier(route.solverId, 'route.solverId'),
    solverAddress: normalizeOptionalIdentifier(route.solverAddress, 'route.solverAddress'),
    originChainId: normalizeIdentifier(route.originChainId, 'route.originChainId'),
    destinationChainIds,
    inputToken: normalizeIdentifier(route.inputToken, 'route.inputToken'),
    inputAmount: normalizeAtomicUnits(route.inputAmount, 'route.inputAmount'),
    outputToken: normalizeIdentifier(route.outputToken, 'route.outputToken'),
    quotedOutputAmount: normalizeAtomicUnits(
      route.quotedOutputAmount,
      'route.quotedOutputAmount',
    ),
    minOutputAmount: normalizeAtomicUnits(route.minOutputAmount, 'route.minOutputAmount'),
    slippageBps: normalizeNonNegativeInteger(route.slippageBps, 'route.slippageBps'),
    maxSlippageBps: normalizeNonNegativeInteger(
      route.maxSlippageBps,
      'route.maxSlippageBps',
    ),
    fillInstructions: Object.freeze(
      route.fillInstructions.map((instruction, index) =>
        normalizedFillInstruction(instruction, index),
      ),
    ),
    exclusiveSolverId: normalizeOptionalIdentifier(
      route.exclusiveSolverId,
      'route.exclusiveSolverId',
    ),
    exclusivityDeadline: normalizeOptionalIsoTimestamp(
      route.exclusivityDeadline,
      'route.exclusivityDeadline',
    ),
    counterpartyRefs: Object.freeze(
      route.counterpartyRefs.map((value, index) =>
        normalizeIdentifier(value, `route.counterpartyRefs[${index}]`),
      ),
    ),
    routeSimulationHash: normalizeOptionalIdentifier(
      route.routeSimulationHash,
      'route.routeSimulationHash',
    ),
  });
}

export function normalizedSettlement(
  settlement: IntentSolverSettlementEvidence,
): IntentSolverSettlementEvidence {
  return Object.freeze({
    settlementSystem: normalizeIdentifier(settlement.settlementSystem, 'settlement.system'),
    settlementMethod: normalizeSettlementMethod(settlement.settlementMethod),
    originSettler: normalizeIdentifier(settlement.originSettler, 'settlement.originSettler'),
    destinationSettlers: normalizeStringList(
      settlement.destinationSettlers,
      'settlement.destinationSettlers',
    ),
    settlementContractVerified: Boolean(settlement.settlementContractVerified),
    settlementSecurityReviewed: Boolean(settlement.settlementSecurityReviewed),
    settlementWindowSeconds: normalizePositiveInteger(
      settlement.settlementWindowSeconds,
      'settlement.settlementWindowSeconds',
    ),
    fillDeadline: normalizeIsoTimestamp(settlement.fillDeadline, 'settlement.fillDeadline'),
    refundPathAvailable: Boolean(settlement.refundPathAvailable),
    settlementOracle: normalizeOptionalIdentifier(
      settlement.settlementOracle,
      'settlement.settlementOracle',
    ),
    liquiditySource: normalizeOptionalIdentifier(
      settlement.liquiditySource,
      'settlement.liquiditySource',
    ),
  });
}

export function normalizedCounterparty(
  counterparty: IntentSolverCounterpartyEvidence,
): IntentSolverCounterpartyEvidence {
  return Object.freeze({
    solverId: normalizeIdentifier(counterparty.solverId, 'counterparty.solverId'),
    solverAddress: normalizeOptionalIdentifier(
      counterparty.solverAddress,
      'counterparty.solverAddress',
    ),
    allowlisted: Boolean(counterparty.allowlisted),
    allowlistEvidenceRef: normalizeOptionalIdentifier(
      counterparty.allowlistEvidenceRef,
      'counterparty.allowlistEvidenceRef',
    ),
    blocked: Boolean(counterparty.blocked),
    screeningStatus: normalizeScreeningStatus(counterparty.screeningStatus),
    screeningEvidenceRef: normalizeOptionalIdentifier(
      counterparty.screeningEvidenceRef,
      'counterparty.screeningEvidenceRef',
    ),
    reputationTier: normalizeOptionalIdentifier(
      counterparty.reputationTier,
      'counterparty.reputationTier',
    ),
    bondPosted: counterparty.bondPosted ?? null,
    requiredBondSatisfied: counterparty.requiredBondSatisfied ?? null,
    blockedCounterpartyRefs: Object.freeze(
      counterparty.blockedCounterpartyRefs.map((value, index) =>
        normalizeIdentifier(value, `counterparty.blockedCounterpartyRefs[${index}]`),
      ),
    ),
  });
}

export function normalizedReplay(replay: IntentSolverReplayEvidence): IntentSolverReplayEvidence {
  return Object.freeze({
    replayProtectionMode: normalizeReplayProtectionMode(replay.replayProtectionMode),
    nonce: normalizeIdentifier(replay.nonce, 'replay.nonce'),
    nonceFresh: Boolean(replay.nonceFresh),
    idempotencyKey: normalizeIdentifier(replay.idempotencyKey, 'replay.idempotencyKey'),
    orderAlreadyOpened: Boolean(replay.orderAlreadyOpened),
    duplicateOrderDetected: Boolean(replay.duplicateOrderDetected),
    routeReplayDetected: Boolean(replay.routeReplayDetected),
  });
}

export function normalizedRuntimeObservation(
  observation: IntentSolverRuntimeObservation | null | undefined,
): IntentSolverRuntimeObservation | null {
  if (!observation) return null;
  return Object.freeze({
    observedAt: normalizeIsoTimestamp(observation.observedAt, 'runtimeObservation.observedAt'),
    orderSubmitted: observation.orderSubmitted ?? null,
    openTransactionHash: normalizeOptionalIdentifier(
      observation.openTransactionHash,
      'runtimeObservation.openTransactionHash',
    ),
    fillTransactionHashes: normalizeOptionalStringList(
      observation.fillTransactionHashes,
      'runtimeObservation.fillTransactionHashes',
    ),
    settlementCompleted: observation.settlementCompleted ?? null,
    replayBlocked: observation.replayBlocked ?? null,
  });
}
