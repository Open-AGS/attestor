import type {
  CryptoAccountKind,
  CryptoAssetKind,
  CryptoAuthorizationConsequenceKind,
  CryptoExecutionAdapterKind,
} from '../crypto-authorization-core/types.js';
import type {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  CanonicalShadowEvent,
} from './canonical-shadow-event-schema.js';
import type { ConsequenceAdmissionDecision } from './index.js';

export const GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION =
  'attestor.golden-programmable-money-shadow-fixtures.v1';

export const GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS = [
  'safe-transfer-allowlisted-recipient',
  'unlimited-approval-review',
  'erc4337-user-operation-paymaster-missing',
  'delegated-eoa-stale-authorization',
  'x402-agent-payment-settlement-missing',
  'custody-withdrawal-quorum-pending',
  'intent-solver-deadline-slippage-review',
  'prompt-injection-in-wallet-memo',
] as const;
export type GoldenProgrammableMoneyShadowFixtureScenario =
  typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS[number];

export const GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_POSTURES = [
  'shadow-ready',
  'needs-allowance-narrowing',
  'blocked-missing-paymaster-evidence',
  'blocked-stale-delegation',
  'blocked-missing-settlement-proof',
  'needs-custody-quorum-review',
  'needs-intent-route-review',
  'blocked-instruction-like-memo',
] as const;
export type GoldenProgrammableMoneyShadowFixturePosture =
  typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_POSTURES[number];

export const GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_NON_CLAIMS = [
  'not-a-wallet-custodian-signer-bundler-or-broadcaster',
  'not-live-safe-wallet-custody-x402-or-solver-integration',
  'not-customer-pep-enforcement-proof',
  'not-chain-settlement-or-payment-finality-proof',
  'not-production-ready',
] as const;

export interface GoldenProgrammableMoneyShadowFixtureOperationFacts {
  readonly adapterKind: CryptoExecutionAdapterKind;
  readonly consequenceKind: CryptoAuthorizationConsequenceKind;
  readonly accountKind: CryptoAccountKind;
  readonly assetKind: CryptoAssetKind;
  readonly chainNamespace: 'eip155' | 'solana';
  readonly valueRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly counterpartyPosture: 'allowlisted' | 'new-counterparty' | 'sanctions-review-required';
  readonly approvalPosture: 'fresh' | 'stale' | 'missing' | 'quorum-pending';
  readonly policyScopeStatus: 'matched' | 'overbroad' | 'missing';
  readonly replayFreshness: 'fresh' | 'stale' | 'duplicate';
  readonly adapterPreflightStatus: 'passed' | 'missing' | 'failed';
  readonly settlementOrReceiptStatus: 'not-applicable' | 'pending' | 'missing' | 'observed';
  readonly instructionLikeEvidence: boolean;
  readonly externalSideEffect: boolean;
}

export interface GoldenProgrammableMoneyShadowFixture {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly scenario: GoldenProgrammableMoneyShadowFixtureScenario;
  readonly fixtureId: string;
  readonly expectedPosture: GoldenProgrammableMoneyShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly operationFacts: GoldenProgrammableMoneyShadowFixtureOperationFacts;
  readonly event: CanonicalShadowEvent;
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly cryptoAuthorizationCoreRefDigest: string;
  readonly cryptoExecutionAdmissionRefDigest: string;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly fixtureOnly: true;
  readonly synthetic: true;
  readonly shadowOnly: true;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noRawPayload: true;
  readonly noRawTransactionPayload: true;
  readonly noRawWalletMaterial: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenProgrammableMoneyShadowFixtureSuite {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly name: 'Golden Path: Programmable Money';
  readonly step: 'P01';
  readonly sourceRecipeRefDigest: string;
  readonly actionSurfaceRefDigest: string;
  readonly cryptoAuthorizationCoreRefDigest: string;
  readonly cryptoExecutionAdmissionRefDigest: string;
  readonly fixtureCount: 8;
  readonly scenarios: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS;
  readonly fixtures: readonly GoldenProgrammableMoneyShadowFixture[];
  readonly shadowOnly: true;
  readonly noTargetSystemCalls: true;
  readonly noWalletCalls: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallbacks: true;
  readonly noBundlerCalls: true;
  readonly noFacilitatorCalls: true;
  readonly noSolverCalls: true;
  readonly noRawPayload: true;
  readonly noRawTransactionPayload: true;
  readonly noRawWalletMaterial: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenProgrammableMoneyShadowFixturesDescriptor {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION;
  readonly step: 'P01';
  readonly sourceSchemaVersion: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly scenarios: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS;
  readonly shadowOnly: true;
  readonly synthetic: true;
  readonly noTargetSystemCalls: true;
  readonly noWalletCalls: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallbacks: true;
  readonly noBundlerCalls: true;
  readonly noFacilitatorCalls: true;
  readonly noSolverCalls: true;
  readonly noRawPayload: true;
  readonly noRawTransactionPayload: true;
  readonly noRawWalletMaterial: true;
  readonly noRawCustomerIdentifiers: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: typeof GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_NON_CLAIMS;
}
