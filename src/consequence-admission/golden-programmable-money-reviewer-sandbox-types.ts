import type {
  CryptoAccountKind,
  CryptoAssetKind,
  CryptoAuthorizationConsequenceKind,
  CryptoExecutionAdapterKind,
} from '../crypto-authorization-core/types.js';
import type {
  CanonicalShadowEventDecision,
} from './canonical-shadow-event-schema.js';
import type {
  GoldenProgrammableMoneyShadowFixtureOperationFacts,
  GoldenProgrammableMoneyShadowFixturePosture,
} from './golden-programmable-money-shadow-fixtures.js';
import type {
  ShadowRuntimeFixtureReplaySmokeResult,
} from './shadow-runtime-fixture-replay-smoke.js';

export const GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION =
  'attestor.golden-programmable-money-reviewer-sandbox.v1';
export const GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION =
  'attestor.golden-programmable-money-reviewer-sandbox-input.v1';

export const GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_ALLOWED_KEYS = [
  'version',
  'actionSurface',
  'adapterKind',
  'consequenceKind',
  'accountKind',
  'assetKind',
  'chainNamespace',
  'valueRisk',
  'counterpartyPosture',
  'approvalPosture',
  'policyScopeStatus',
  'replayFreshness',
  'adapterPreflightStatus',
  'settlementOrReceiptStatus',
  'instructionLikeEvidence',
  'externalSideEffect',
  'duplicateIntentAttempt',
] as const;

export const GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER = [
  'schema-validation',
  'programmable-money-surface-binding',
  'policy-scope-check',
  'authority-freshness-check',
  'adapter-preflight-check',
  'settlement-or-receipt-check',
  'replay-freshness-check',
  'instruction-like-evidence-check',
  'shadow-runtime-smoke',
  'decision-summary',
] as const;
export type GoldenProgrammableMoneyReviewerSandboxGate =
  typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER[number];

export const GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS = [
  'strict-json-allowlisted-shape',
  'eip-712-typed-data-domain-separation',
  'erc-4337-useroperation-entrypoint-bundler-boundary',
  'safe-guard-pre-post-transaction-hook-boundary',
  'x402-verify-settle-response-boundary',
  'fireblocks-cosigner-callback-approval-boundary',
  'erc-7683-intent-order-resolution-boundary',
] as const;

export type GoldenProgrammableMoneyReviewerSandboxStatus =
  | 'accepted'
  | 'invalid-schema'
  | 'outside-scope';

export interface GoldenProgrammableMoneyReviewerSandboxInput {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION;
  readonly actionSurface: string;
  readonly adapterKind: CryptoExecutionAdapterKind;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly accountKind: CryptoAccountKind;
  readonly assetKind: CryptoAssetKind;
  readonly chainNamespace: GoldenProgrammableMoneyShadowFixtureOperationFacts['chainNamespace'];
  readonly valueRisk: GoldenProgrammableMoneyShadowFixtureOperationFacts['valueRisk'];
  readonly counterpartyPosture: GoldenProgrammableMoneyShadowFixtureOperationFacts['counterpartyPosture'];
  readonly approvalPosture: GoldenProgrammableMoneyShadowFixtureOperationFacts['approvalPosture'];
  readonly policyScopeStatus: GoldenProgrammableMoneyShadowFixtureOperationFacts['policyScopeStatus'];
  readonly replayFreshness: GoldenProgrammableMoneyShadowFixtureOperationFacts['replayFreshness'];
  readonly adapterPreflightStatus: GoldenProgrammableMoneyShadowFixtureOperationFacts['adapterPreflightStatus'];
  readonly settlementOrReceiptStatus: GoldenProgrammableMoneyShadowFixtureOperationFacts['settlementOrReceiptStatus'];
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
  readonly duplicateIntentAttempt: boolean;
}

export interface GoldenProgrammableMoneyReviewerSandboxSafetyBoundary {
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawTransactionPayloadRead: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialRead: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

export interface GoldenProgrammableMoneyReviewerSandboxDecisionSummary {
  readonly shadowDecision: CanonicalShadowEventDecision['shadowDecision'];
  readonly effectiveDecision: CanonicalShadowEventDecision['effectiveDecision'];
  readonly packetDecision: 'admit' | 'narrow' | 'review' | 'block';
  readonly fusionPosture: string;
  readonly conflictOutcome: string;
  readonly humanStatus: string;
  readonly evidenceCompletenessPercent: number;
  readonly reasonCodes: readonly string[];
  readonly decisionRelevantDigest: string;
}

export interface GoldenProgrammableMoneyReviewerSandboxResult {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_VERSION;
  readonly step: 'P04';
  readonly generatedAt: string;
  readonly inputVersion:
    typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_INPUT_VERSION | null;
  readonly inputStatus: GoldenProgrammableMoneyReviewerSandboxStatus;
  readonly inputDigest: string | null;
  readonly engineScope: 'programmable_money.transaction_intent';
  readonly requestedActionSurface: string | null;
  readonly schemaErrors: readonly string[];
  readonly issueCodes: readonly string[];
  readonly expectedPosture: GoldenProgrammableMoneyShadowFixturePosture | null;
  readonly eventDigest: string | null;
  readonly smokeDigest: string | null;
  readonly envelopeRefDigest: string | null;
  readonly assurancePacketDigest: string | null;
  readonly gateOrder: typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_GATE_ORDER;
  readonly decisionSummary: GoldenProgrammableMoneyReviewerSandboxDecisionSummary | null;
  readonly smokeResult: ShadowRuntimeFixtureReplaySmokeResult | null;
  readonly sourceAnchors: typeof GOLDEN_PROGRAMMABLE_MONEY_REVIEWER_SANDBOX_SOURCE_ANCHORS;
  readonly noClaims: readonly string[];
  readonly safetyBoundary: GoldenProgrammableMoneyReviewerSandboxSafetyBoundary;
  readonly engineRan: boolean;
  readonly shadowOnly: true;
  readonly previewOnly: true;
  readonly reviewerSupplied: true;
  readonly canonical: string;
  readonly digest: string;
}

export const GENERATED_AT = '2026-05-26T16:15:00.000Z';
export const BASE_OCCURRED_AT = '2026-05-26T16:15:00.000Z';
export const BASE_OBSERVED_AT = '2026-05-26T16:15:01.000Z';
export const ENGINE_SCOPE = 'programmable_money.transaction_intent' as const;
export const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

export const ADAPTER_KINDS: readonly CryptoExecutionAdapterKind[] = [
  'wallet-call-api',
  'safe-guard',
  'erc-4337-user-operation',
  'eip-7702-delegation',
  'x402-payment',
  'custody-cosigner',
  'intent-settlement',
] as const;
export const CONSEQUENCE_KINDS: readonly CryptoAuthorizationConsequenceKind[] = [
  'transfer',
  'approval',
  'user-operation',
  'account-delegation',
  'agent-payment',
  'custody-withdrawal',
  'bridge',
] as const;
export const ACCOUNT_KINDS: readonly CryptoAccountKind[] = [
  'agent-wallet',
  'safe',
  'erc-4337-smart-account',
  'eoa',
  'custody-account',
] as const;
export const ASSET_KINDS: readonly CryptoAssetKind[] = [
  'stablecoin',
  'native-token',
  'fungible-token',
  'non-fungible-token',
] as const;
export const CHAIN_NAMESPACES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['chainNamespace'][] = [
  'eip155',
  'solana',
] as const;
export const VALUE_RISKS:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['valueRisk'][] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export const COUNTERPARTY_POSTURES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['counterpartyPosture'][] = [
  'allowlisted',
  'new-counterparty',
  'sanctions-review-required',
] as const;
export const APPROVAL_POSTURES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['approvalPosture'][] = [
  'fresh',
  'stale',
  'missing',
  'quorum-pending',
] as const;
export const POLICY_SCOPE_STATUSES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['policyScopeStatus'][] = [
  'matched',
  'overbroad',
  'missing',
] as const;
export const REPLAY_FRESHNESS_VALUES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['replayFreshness'][] = [
  'fresh',
  'stale',
  'duplicate',
] as const;
export const ADAPTER_PREFLIGHT_STATUSES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['adapterPreflightStatus'][] = [
  'passed',
  'missing',
  'failed',
] as const;
export const SETTLEMENT_OR_RECEIPT_STATUSES:
readonly GoldenProgrammableMoneyShadowFixtureOperationFacts['settlementOrReceiptStatus'][] = [
  'not-applicable',
  'pending',
  'missing',
  'observed',
] as const;
