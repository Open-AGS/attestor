import {
  INTENT_SOLVER_ADMISSION_ACTIONS,
  INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION,
  INTENT_SOLVER_ADMISSION_OUTCOMES,
  INTENT_SOLVER_EXPECTATION_KINDS,
  INTENT_SOLVER_EXPECTATION_STATUSES,
  INTENT_SOLVER_ORDER_KINDS,
  INTENT_SOLVER_REPLAY_PROTECTION_MODES,
  INTENT_SOLVER_SETTLEMENT_METHODS,
  type IntentSolverAdmissionDescriptor,
  type IntentSolverAdmissionHandoff,
} from './intent-solver-types.js';

export function intentSolverAdmissionHandoffLabel(
  handoff: IntentSolverAdmissionHandoff,
): string {
  return [
    `intent-solver:${handoff.intentId}`,
    `outcome:${handoff.outcome}`,
    `route:${handoff.routeId}`,
    `solver:${handoff.solverId}`,
  ].join(' / ');
}

export function intentSolverAdmissionDescriptor(): IntentSolverAdmissionDescriptor {
  return Object.freeze({
    version: INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION,
    outcomes: INTENT_SOLVER_ADMISSION_OUTCOMES,
    actions: INTENT_SOLVER_ADMISSION_ACTIONS,
    orderKinds: INTENT_SOLVER_ORDER_KINDS,
    settlementMethods: INTENT_SOLVER_SETTLEMENT_METHODS,
    replayProtectionModes: INTENT_SOLVER_REPLAY_PROTECTION_MODES,
    expectationKinds: INTENT_SOLVER_EXPECTATION_KINDS,
    expectationStatuses: INTENT_SOLVER_EXPECTATION_STATUSES,
    runtimeChecks: Object.freeze([
      'routeCommitment',
      'settlementContract',
      'slippageLimit',
      'deadlineWindow',
      'fillInstructions',
      'liquidityPosture',
      'counterpartyScreening',
      'replayProtection',
      'postSettlementObservation',
    ]),
    standards: Object.freeze([
      'ERC-7683',
      'ResolvedCrossChainOrder',
      'IOriginSettler',
      'IDestinationSettler',
      'intent-settlement',
      'solver-preflight',
    ]),
  });
}
