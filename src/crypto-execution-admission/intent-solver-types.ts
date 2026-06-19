import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';

export const INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION =
  'attestor.crypto-intent-solver-admission-handoff.v1';

export const INTENT_SOLVER_ADMISSION_OUTCOMES = [
  'ready',
  'needs-solver-evidence',
  'blocked',
] as const;
export type IntentSolverAdmissionOutcome =
  typeof INTENT_SOLVER_ADMISSION_OUTCOMES[number];

export const INTENT_SOLVER_ADMISSION_ACTIONS = [
  'submit-order',
  'request-route-review',
  'block-route',
] as const;
export type IntentSolverAdmissionAction =
  typeof INTENT_SOLVER_ADMISSION_ACTIONS[number];

export const INTENT_SOLVER_ORDER_KINDS = [
  'erc-7683-gasless',
  'erc-7683-onchain',
  'solver-api-quote',
  'custom-intent',
] as const;
export type IntentSolverOrderKind = typeof INTENT_SOLVER_ORDER_KINDS[number];

export const INTENT_SOLVER_SETTLEMENT_METHODS = [
  'erc-7683-open-for',
  'erc-7683-open',
  'solver-api-submit',
  'custom-settlement',
] as const;
export type IntentSolverSettlementMethod =
  typeof INTENT_SOLVER_SETTLEMENT_METHODS[number];

export const INTENT_SOLVER_REPLAY_PROTECTION_MODES = [
  'erc-7683-nonce',
  'permit2-nonce',
  'idempotency-key',
  'one-time-order-id',
] as const;
export type IntentSolverReplayProtectionMode =
  typeof INTENT_SOLVER_REPLAY_PROTECTION_MODES[number];

export const INTENT_SOLVER_COUNTERPARTY_SCREENING_STATUSES = [
  'clear',
  'pending',
  'blocked',
] as const;
export type IntentSolverCounterpartyScreeningStatus =
  typeof INTENT_SOLVER_COUNTERPARTY_SCREENING_STATUSES[number];

export const INTENT_SOLVER_EXPECTATION_KINDS = [
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
  'post-settlement',
] as const;
export type IntentSolverExpectationKind =
  typeof INTENT_SOLVER_EXPECTATION_KINDS[number];

export const INTENT_SOLVER_EXPECTATION_STATUSES = [
  'satisfied',
  'missing',
  'pending',
  'failed',
  'unsupported',
] as const;
export type IntentSolverExpectationStatus =
  typeof INTENT_SOLVER_EXPECTATION_STATUSES[number];

export interface IntentSolverOrderEvidence {
  readonly orderKind: IntentSolverOrderKind;
  readonly orderId: string;
  readonly user: string;
  readonly originChainId: string;
  readonly originSettler: string;
  readonly orderDataType: string | null;
  readonly orderDataHash: string;
  readonly openDeadline: string | null;
  readonly fillDeadline: string;
  readonly nonce: string;
  readonly signatureHash: string | null;
  readonly resolvedOrderHash: string | null;
  readonly maxSpentHash: string | null;
  readonly minReceivedHash: string | null;
}

export interface IntentSolverFillInstructionEvidence {
  readonly instructionId: string;
  readonly destinationChainId: string;
  readonly destinationSettler: string;
  readonly originDataHash: string;
}

export interface IntentSolverRouteCommitmentEvidence {
  readonly routeId: string;
  readonly routeHash: string;
  readonly quoteId: string | null;
  readonly quoteExpiresAt: string | null;
  readonly committedAt: string;
  readonly solverId: string;
  readonly solverAddress: string | null;
  readonly originChainId: string;
  readonly destinationChainIds: readonly string[];
  readonly inputToken: string;
  readonly inputAmount: string;
  readonly outputToken: string;
  readonly quotedOutputAmount: string;
  readonly minOutputAmount: string;
  readonly slippageBps: number;
  readonly maxSlippageBps: number;
  readonly fillInstructions: readonly IntentSolverFillInstructionEvidence[];
  readonly exclusiveSolverId: string | null;
  readonly exclusivityDeadline: string | null;
  readonly counterpartyRefs: readonly string[];
  readonly routeSimulationHash: string | null;
}

export interface IntentSolverSettlementEvidence {
  readonly settlementSystem: string;
  readonly settlementMethod: IntentSolverSettlementMethod;
  readonly originSettler: string;
  readonly destinationSettlers: readonly string[];
  readonly settlementContractVerified: boolean;
  readonly settlementSecurityReviewed: boolean;
  readonly settlementWindowSeconds: number;
  readonly fillDeadline: string;
  readonly refundPathAvailable: boolean;
  readonly settlementOracle: string | null;
  readonly liquiditySource: string | null;
}

export interface IntentSolverCounterpartyEvidence {
  readonly solverId: string;
  readonly solverAddress: string | null;
  readonly allowlisted: boolean;
  readonly allowlistEvidenceRef?: string | null;
  readonly blocked: boolean;
  readonly screeningStatus: IntentSolverCounterpartyScreeningStatus;
  readonly screeningEvidenceRef?: string | null;
  readonly reputationTier: string | null;
  readonly bondPosted: boolean | null;
  readonly requiredBondSatisfied: boolean | null;
  readonly blockedCounterpartyRefs: readonly string[];
}

export interface IntentSolverReplayEvidence {
  readonly replayProtectionMode: IntentSolverReplayProtectionMode;
  readonly nonce: string;
  readonly nonceFresh: boolean;
  readonly idempotencyKey: string;
  readonly orderAlreadyOpened: boolean;
  readonly duplicateOrderDetected: boolean;
  readonly routeReplayDetected: boolean;
}

export interface IntentSolverRuntimeObservation {
  readonly observedAt: string;
  readonly orderSubmitted?: boolean | null;
  readonly openTransactionHash?: string | null;
  readonly fillTransactionHashes?: readonly string[] | null;
  readonly settlementCompleted?: boolean | null;
  readonly replayBlocked?: boolean | null;
}

export interface IntentSolverAdmissionExpectation {
  readonly kind: IntentSolverExpectationKind;
  readonly status: IntentSolverExpectationStatus;
  readonly reasonCode: string;
  readonly evidence: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}

export interface IntentSolverAdmissionSettlementWindow {
  readonly openDeadline: string | null;
  readonly fillDeadline: string;
  readonly quoteExpiresAt: string | null;
  readonly settlementWindowSeconds: number;
}

export interface IntentSolverAdmissionSlippageBound {
  readonly inputAmount: string;
  readonly quotedOutputAmount: string;
  readonly minOutputAmount: string;
  readonly slippageBps: number;
  readonly maxSlippageBps: number;
}

export interface IntentSolverAdmissionSubmitContract {
  readonly settlementMethod: IntentSolverSettlementMethod;
  readonly orderKind: IntentSolverOrderKind;
  readonly originSettler: string;
  readonly destinationSettlers: readonly string[];
  readonly requiresResolvedOrder: true;
  readonly requiresFillInstructionBinding: true;
  readonly requiresReplayProtection: true;
  readonly requiresAttestorSidecar: true;
}

export interface CreateIntentSolverAdmissionHandoffInput {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly order: IntentSolverOrderEvidence;
  readonly route: IntentSolverRouteCommitmentEvidence;
  readonly settlement: IntentSolverSettlementEvidence;
  readonly counterparty: IntentSolverCounterpartyEvidence;
  readonly replay: IntentSolverReplayEvidence;
  readonly createdAt: string;
  readonly handoffId?: string | null;
  readonly runtimeObservation?: IntentSolverRuntimeObservation | null;
  readonly operatorNote?: string | null;
}

export interface IntentSolverAdmissionHandoff {
  readonly version: typeof INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly handoffId: string;
  readonly createdAt: string;
  readonly outcome: IntentSolverAdmissionOutcome;
  readonly action: IntentSolverAdmissionAction;
  readonly planId: string;
  readonly planDigest: string;
  readonly simulationId: string;
  readonly intentId: string;
  readonly orderId: string;
  readonly orderKind: IntentSolverOrderKind;
  readonly routeId: string;
  readonly routeHash: string;
  readonly solverId: string;
  readonly solverAddress: string | null;
  readonly originChainId: string;
  readonly destinationChainIds: readonly string[];
  readonly originSettler: string;
  readonly destinationSettlers: readonly string[];
  readonly settlementMethod: IntentSolverSettlementMethod;
  readonly settlementWindow: IntentSolverAdmissionSettlementWindow;
  readonly slippage: IntentSolverAdmissionSlippageBound;
  readonly replayProtectionMode: IntentSolverReplayProtectionMode;
  readonly idempotencyKey: string;
  readonly submitContract: IntentSolverAdmissionSubmitContract;
  readonly runtimeObservation: IntentSolverRuntimeObservation | null;
  readonly attestorSidecar: Readonly<Record<string, CanonicalReleaseJsonValue>>;
  readonly expectations: readonly IntentSolverAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
  readonly nextActions: readonly string[];
  readonly operatorNote: string | null;
  readonly canonical: string;
  readonly digest: string;
}

export interface IntentSolverAdmissionDescriptor {
  readonly version: typeof INTENT_SOLVER_ADMISSION_HANDOFF_SPEC_VERSION;
  readonly outcomes: typeof INTENT_SOLVER_ADMISSION_OUTCOMES;
  readonly actions: typeof INTENT_SOLVER_ADMISSION_ACTIONS;
  readonly orderKinds: typeof INTENT_SOLVER_ORDER_KINDS;
  readonly settlementMethods: typeof INTENT_SOLVER_SETTLEMENT_METHODS;
  readonly replayProtectionModes: typeof INTENT_SOLVER_REPLAY_PROTECTION_MODES;
  readonly expectationKinds: typeof INTENT_SOLVER_EXPECTATION_KINDS;
  readonly expectationStatuses: typeof INTENT_SOLVER_EXPECTATION_STATUSES;
  readonly runtimeChecks: readonly string[];
  readonly standards: readonly string[];
}
