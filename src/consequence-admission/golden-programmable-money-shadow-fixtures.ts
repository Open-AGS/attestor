import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  CryptoAccountKind,
  CryptoAssetKind,
  CryptoAuthorizationConsequenceKind,
  CryptoExecutionAdapterKind,
} from '../crypto-authorization-core/types.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  createCanonicalShadowEvent,
  type CanonicalShadowEvent,
  type CanonicalShadowEventActionKind,
  type CanonicalShadowEventDecision,
  type CanonicalShadowEventReference,
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

interface ScenarioDefinition {
  readonly scenario: GoldenProgrammableMoneyShadowFixtureScenario;
  readonly expectedPosture: GoldenProgrammableMoneyShadowFixturePosture;
  readonly expectedDecision: ConsequenceAdmissionDecision;
  readonly operationFacts: GoldenProgrammableMoneyShadowFixtureOperationFacts;
  readonly actionName:
    | 'propose_safe_transfer'
    | 'propose_token_approval'
    | 'propose_user_operation'
    | 'propose_delegated_eoa_call'
    | 'propose_x402_agent_payment'
    | 'propose_custody_withdrawal'
    | 'propose_intent_settlement'
    | 'propose_wallet_call_with_memo';
  readonly actionKind: CanonicalShadowEventActionKind;
  readonly amountBucket: string;
  readonly expectedEvidenceStates: readonly string[];
  readonly expectedSignals: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly decision: CanonicalShadowEventDecision;
  readonly evidenceSeeds: readonly string[];
  readonly approvalSeeds: readonly string[];
  readonly simulationSeeds: readonly string[];
  readonly receiptSeeds: readonly string[];
}

const BASE_OCCURRED_AT = '2026-05-26T13:30:00.000Z';
const BASE_OBSERVED_AT = '2026-05-26T13:30:01.000Z';

const SCENARIO_DEFINITIONS: readonly ScenarioDefinition[] = Object.freeze([
  {
    scenario: 'safe-transfer-allowlisted-recipient',
    expectedPosture: 'shadow-ready',
    expectedDecision: 'admit',
    operationFacts: Object.freeze({
      adapterKind: 'safe-guard',
      consequenceKind: 'transfer',
      accountKind: 'safe',
      assetKind: 'stablecoin',
      chainNamespace: 'eip155',
      valueRisk: 'medium',
      counterpartyPosture: 'allowlisted',
      approvalPosture: 'fresh',
      policyScopeStatus: 'matched',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'passed',
      settlementOrReceiptStatus: 'not-applicable',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_safe_transfer',
    actionKind: 'transaction-proposal',
    amountBucket: 'stablecoin:medium',
    expectedEvidenceStates: Object.freeze([
      'safe-guard-preflight-passed',
      'recipient-allowlisted',
      'fresh-owner-approval',
      'policy-scope-matched',
    ]),
    expectedSignals: Object.freeze(['safe-guard', 'allowlisted-counterparty', 'fresh-replay-window']),
    reasonCodes: Object.freeze([
      'programmable-money:safe-transfer-preflight-passed',
      'programmable-money:shadow-ready',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'observe',
      shadowDecision: 'would_admit',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:safe-transfer-preflight-passed',
        'programmable-money:shadow-ready',
      ]),
    }),
    evidenceSeeds: Object.freeze(['safe-guard-preflight-digest', 'recipient-allowlist-digest']),
    approvalSeeds: Object.freeze(['safe-owner-approval-digest']),
    simulationSeeds: Object.freeze(['safe-transaction-simulation-digest']),
    receiptSeeds: Object.freeze(['no-chain-receipt-fixture-only']),
  },
  {
    scenario: 'unlimited-approval-review',
    expectedPosture: 'needs-allowance-narrowing',
    expectedDecision: 'narrow',
    operationFacts: Object.freeze({
      adapterKind: 'wallet-call-api',
      consequenceKind: 'approval',
      accountKind: 'agent-wallet',
      assetKind: 'fungible-token',
      chainNamespace: 'eip155',
      valueRisk: 'high',
      counterpartyPosture: 'new-counterparty',
      approvalPosture: 'fresh',
      policyScopeStatus: 'overbroad',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'passed',
      settlementOrReceiptStatus: 'not-applicable',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_token_approval',
    actionKind: 'transaction-proposal',
    amountBucket: 'token:unlimited',
    expectedEvidenceStates: Object.freeze(['approval-over-cap', 'spender-new-counterparty', 'narrow-budget-required']),
    expectedSignals: Object.freeze(['allowance-cap-missing', 'validity-window-required']),
    reasonCodes: Object.freeze([
      'programmable-money:approval-over-policy-cap',
      'programmable-money:narrow-allowance-and-validity-window',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_narrow',
      effectiveDecision: 'narrow',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:approval-over-policy-cap',
        'programmable-money:narrow-allowance-and-validity-window',
      ]),
    }),
    evidenceSeeds: Object.freeze(['spender-risk-digest', 'allowance-policy-digest']),
    approvalSeeds: Object.freeze(['wallet-session-approval-digest']),
    simulationSeeds: Object.freeze(['approval-simulation-over-cap-digest']),
    receiptSeeds: Object.freeze(['no-chain-receipt-fixture-only']),
  },
  {
    scenario: 'erc4337-user-operation-paymaster-missing',
    expectedPosture: 'blocked-missing-paymaster-evidence',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      adapterKind: 'erc-4337-user-operation',
      consequenceKind: 'user-operation',
      accountKind: 'erc-4337-smart-account',
      assetKind: 'native-token',
      chainNamespace: 'eip155',
      valueRisk: 'high',
      counterpartyPosture: 'allowlisted',
      approvalPosture: 'fresh',
      policyScopeStatus: 'matched',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'missing',
      settlementOrReceiptStatus: 'not-applicable',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_user_operation',
    actionKind: 'transaction-proposal',
    amountBucket: 'native-token:gas-sponsored',
    expectedEvidenceStates: Object.freeze([
      'entrypoint-bound',
      'paymaster-evidence-missing',
      'bundler-simulation-required',
    ]),
    expectedSignals: Object.freeze(['erc-4337-validation-required', 'erc-7562-scope-required']),
    reasonCodes: Object.freeze([
      'programmable-money:paymaster-evidence-missing',
      'programmable-money:block-before-bundler-submission',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:paymaster-evidence-missing',
        'programmable-money:block-before-bundler-submission',
      ]),
    }),
    evidenceSeeds: Object.freeze(['entrypoint-digest', 'user-operation-hash-digest']),
    approvalSeeds: Object.freeze(['smart-account-owner-approval-digest']),
    simulationSeeds: Object.freeze(['bundler-simulation-missing-digest']),
    receiptSeeds: Object.freeze(['no-user-operation-receipt-fixture-only']),
  },
  {
    scenario: 'delegated-eoa-stale-authorization',
    expectedPosture: 'blocked-stale-delegation',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      adapterKind: 'eip-7702-delegation',
      consequenceKind: 'account-delegation',
      accountKind: 'eoa',
      assetKind: 'native-token',
      chainNamespace: 'eip155',
      valueRisk: 'critical',
      counterpartyPosture: 'new-counterparty',
      approvalPosture: 'stale',
      policyScopeStatus: 'matched',
      replayFreshness: 'stale',
      adapterPreflightStatus: 'failed',
      settlementOrReceiptStatus: 'not-applicable',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_delegated_eoa_call',
    actionKind: 'transaction-proposal',
    amountBucket: 'native-token:delegated-high',
    expectedEvidenceStates: Object.freeze([
      'authorization-tuple-stale',
      'delegate-code-review-required',
      'nonce-freshness-failed',
    ]),
    expectedSignals: Object.freeze(['eip-7702-authorization', 'revocation-required']),
    reasonCodes: Object.freeze([
      'programmable-money:eip7702-authorization-stale',
      'programmable-money:block-delegated-eoa-runtime',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:eip7702-authorization-stale',
        'programmable-money:block-delegated-eoa-runtime',
      ]),
    }),
    evidenceSeeds: Object.freeze(['delegation-tuple-digest', 'delegate-code-posture-digest']),
    approvalSeeds: Object.freeze(['stale-delegation-approval-digest']),
    simulationSeeds: Object.freeze(['delegated-eoa-preflight-failed-digest']),
    receiptSeeds: Object.freeze(['no-set-code-receipt-fixture-only']),
  },
  {
    scenario: 'x402-agent-payment-settlement-missing',
    expectedPosture: 'blocked-missing-settlement-proof',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      adapterKind: 'x402-payment',
      consequenceKind: 'agent-payment',
      accountKind: 'agent-wallet',
      assetKind: 'stablecoin',
      chainNamespace: 'eip155',
      valueRisk: 'medium',
      counterpartyPosture: 'allowlisted',
      approvalPosture: 'fresh',
      policyScopeStatus: 'matched',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'missing',
      settlementOrReceiptStatus: 'missing',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_x402_agent_payment',
    actionKind: 'api-operation',
    amountBucket: 'stablecoin:http-payment',
    expectedEvidenceStates: Object.freeze([
      'payment-required-bound',
      'payment-signature-required',
      'facilitator-settlement-missing',
    ]),
    expectedSignals: Object.freeze(['x402-payment', 'resource-fulfillment-blocked']),
    reasonCodes: Object.freeze([
      'programmable-money:x402-settlement-proof-missing',
      'programmable-money:block-resource-fulfillment',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:x402-settlement-proof-missing',
        'programmable-money:block-resource-fulfillment',
      ]),
    }),
    evidenceSeeds: Object.freeze(['payment-required-digest', 'payment-signature-digest']),
    approvalSeeds: Object.freeze(['agent-budget-approval-digest']),
    simulationSeeds: Object.freeze(['facilitator-verify-required-digest']),
    receiptSeeds: Object.freeze(['settlement-response-missing-digest']),
  },
  {
    scenario: 'custody-withdrawal-quorum-pending',
    expectedPosture: 'needs-custody-quorum-review',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      adapterKind: 'custody-cosigner',
      consequenceKind: 'custody-withdrawal',
      accountKind: 'custody-account',
      assetKind: 'stablecoin',
      chainNamespace: 'eip155',
      valueRisk: 'critical',
      counterpartyPosture: 'allowlisted',
      approvalPosture: 'quorum-pending',
      policyScopeStatus: 'matched',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'passed',
      settlementOrReceiptStatus: 'pending',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_custody_withdrawal',
    actionKind: 'transaction-proposal',
    amountBucket: 'stablecoin:critical',
    expectedEvidenceStates: Object.freeze(['custody-policy-allow', 'approval-quorum-pending', 'callback-freshness-required']),
    expectedSignals: Object.freeze(['custody-policy', 'separation-of-duties-required']),
    reasonCodes: Object.freeze([
      'programmable-money:custody-quorum-pending',
      'programmable-money:review-before-cosigner-response',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:custody-quorum-pending',
        'programmable-money:review-before-cosigner-response',
      ]),
    }),
    evidenceSeeds: Object.freeze(['custody-policy-version-digest', 'screening-result-digest']),
    approvalSeeds: Object.freeze(['approval-quorum-pending-digest']),
    simulationSeeds: Object.freeze(['custody-callback-preflight-digest']),
    receiptSeeds: Object.freeze(['no-custody-provider-receipt-fixture-only']),
  },
  {
    scenario: 'intent-solver-deadline-slippage-review',
    expectedPosture: 'needs-intent-route-review',
    expectedDecision: 'review',
    operationFacts: Object.freeze({
      adapterKind: 'intent-settlement',
      consequenceKind: 'bridge',
      accountKind: 'agent-wallet',
      assetKind: 'stablecoin',
      chainNamespace: 'eip155',
      valueRisk: 'high',
      counterpartyPosture: 'new-counterparty',
      approvalPosture: 'fresh',
      policyScopeStatus: 'overbroad',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'passed',
      settlementOrReceiptStatus: 'pending',
      instructionLikeEvidence: false,
      externalSideEffect: true,
    }),
    actionName: 'propose_intent_settlement',
    actionKind: 'transaction-proposal',
    amountBucket: 'stablecoin:cross-chain-high',
    expectedEvidenceStates: Object.freeze(['route-commitment-present', 'deadline-window-tight', 'slippage-review-required']),
    expectedSignals: Object.freeze(['erc-7683-style-intent', 'solver-liquidity-review']),
    reasonCodes: Object.freeze([
      'programmable-money:intent-route-needs-review',
      'programmable-money:deadline-slippage-boundary',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_review',
      effectiveDecision: 'review',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:intent-route-needs-review',
        'programmable-money:deadline-slippage-boundary',
      ]),
    }),
    evidenceSeeds: Object.freeze(['solver-route-commitment-digest', 'settlement-contract-digest']),
    approvalSeeds: Object.freeze(['cross-chain-budget-approval-digest']),
    simulationSeeds: Object.freeze(['intent-route-simulation-digest']),
    receiptSeeds: Object.freeze(['no-solver-settlement-receipt-fixture-only']),
  },
  {
    scenario: 'prompt-injection-in-wallet-memo',
    expectedPosture: 'blocked-instruction-like-memo',
    expectedDecision: 'block',
    operationFacts: Object.freeze({
      adapterKind: 'wallet-call-api',
      consequenceKind: 'transfer',
      accountKind: 'agent-wallet',
      assetKind: 'stablecoin',
      chainNamespace: 'eip155',
      valueRisk: 'high',
      counterpartyPosture: 'new-counterparty',
      approvalPosture: 'missing',
      policyScopeStatus: 'missing',
      replayFreshness: 'fresh',
      adapterPreflightStatus: 'missing',
      settlementOrReceiptStatus: 'not-applicable',
      instructionLikeEvidence: true,
      externalSideEffect: true,
    }),
    actionName: 'propose_wallet_call_with_memo',
    actionKind: 'transaction-proposal',
    amountBucket: 'stablecoin:high',
    expectedEvidenceStates: Object.freeze(['wallet-memo-instruction-like', 'authority-missing', 'policy-scope-missing']),
    expectedSignals: Object.freeze(['untrusted-content-authority-guard', 'model-rationale-not-authority']),
    reasonCodes: Object.freeze([
      'programmable-money:wallet-memo-is-not-authority',
      'programmable-money:block-instruction-like-evidence',
    ]),
    decision: Object.freeze({
      admissionDigest: null,
      mode: 'review',
      shadowDecision: 'would_block',
      effectiveDecision: 'block',
      allowed: false,
      failClosed: true,
      reasonCodes: Object.freeze([
        'programmable-money:wallet-memo-is-not-authority',
        'programmable-money:block-instruction-like-evidence',
      ]),
    }),
    evidenceSeeds: Object.freeze(['untrusted-wallet-memo-digest', 'missing-authority-digest']),
    approvalSeeds: Object.freeze(['missing-approval-digest']),
    simulationSeeds: Object.freeze(['wallet-capability-missing-digest']),
    receiptSeeds: Object.freeze(['no-wallet-receipt-fixture-only']),
  },
]);

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestFor(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function minute(index: number, seconds: number): string {
  return `2026-05-26T13:${String(30 + index).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`;
}

function refs(
  kind: CanonicalShadowEventReference['kind'],
  origin: CanonicalShadowEventReference['origin'],
  seeds: readonly string[],
): readonly CanonicalShadowEventReference[] {
  return Object.freeze(
    seeds.map((seed) =>
      Object.freeze({
        kind,
        origin,
        digest: digestFor(`golden-programmable-money-${kind}`, seed),
      }),
    ),
  );
}

function createFixture(
  definition: ScenarioDefinition,
  index: number,
  suiteRefs: {
    readonly sourceRecipeRefDigest: string;
    readonly actionSurfaceRefDigest: string;
    readonly cryptoAuthorizationCoreRefDigest: string;
    readonly cryptoExecutionAdmissionRefDigest: string;
  },
): GoldenProgrammableMoneyShadowFixture {
  const tenantRefDigest = digestFor('golden-programmable-money-tenant', 'fixture-only-tenant');
  const actorRefDigest = digestFor('golden-programmable-money-actor', {
    scenario: definition.scenario,
    actor: 'fixture-only-ai-agent',
  });
  const targetAccountRefDigest = digestFor('golden-programmable-money-account', {
    scenario: definition.scenario,
    accountKind: definition.operationFacts.accountKind,
    chainNamespace: definition.operationFacts.chainNamespace,
  });
  const resourceRefDigest = digestFor('golden-programmable-money-resource', {
    scenario: definition.scenario,
    adapterKind: definition.operationFacts.adapterKind,
    consequenceKind: definition.operationFacts.consequenceKind,
  });
  const policyRefDigest = digestFor('golden-programmable-money-policy', {
    scenario: definition.scenario,
    policyScopeStatus: definition.operationFacts.policyScopeStatus,
  });
  const assetRefDigest = digestFor('golden-programmable-money-asset', {
    scenario: definition.scenario,
    assetKind: definition.operationFacts.assetKind,
  });
  const chainRefDigest = digestFor('golden-programmable-money-chain', {
    namespace: definition.operationFacts.chainNamespace,
    fixtureChain: 'synthetic',
  });
  const event = createCanonicalShadowEvent({
    occurredAt: minute(index, 0) || BASE_OCCURRED_AT,
    observedAt: minute(index, 1) || BASE_OBSERVED_AT,
    sourceKind: 'crypto-execution-admission',
    producer: 'attestor-golden-programmable-money-fixture',
    tenantRefDigest,
    actorRefDigest,
    observed: Object.freeze({
      targetSystem: definition.operationFacts.adapterKind,
      targetAccountRefDigest,
      actionName: definition.actionName,
      actionKind: definition.actionKind,
      consequenceClass: 'programmable-money',
      resourceRefDigest,
      dataClass: 'digest-only-programmable-money-intent',
      amountAssetChain: Object.freeze({
        amountBucket: definition.amountBucket,
        assetRefDigest,
        chainRefDigest,
      }),
      authorityDelta: Object.freeze({
        authorityKind: definition.operationFacts.consequenceKind,
        principalRefDigest: actorRefDigest,
        resourceRefDigest,
        permissionRefDigest: policyRefDigest,
      }),
    }),
    inferred: Object.freeze({
      targetSystem: definition.operationFacts.adapterKind,
      targetAccountRefDigest,
      actionName: definition.actionName,
      actionKind: definition.actionKind,
      consequenceClass: 'programmable-money',
      resourceRefDigest,
      dataClass: definition.expectedPosture,
      amountAssetChain: Object.freeze({
        amountBucket: definition.amountBucket,
        assetRefDigest,
        chainRefDigest,
      }),
      authorityDelta: Object.freeze({
        authorityKind: definition.operationFacts.adapterKind,
        principalRefDigest: actorRefDigest,
        resourceRefDigest,
        permissionRefDigest: policyRefDigest,
      }),
    }),
    decision: definition.decision,
    outcome: Object.freeze({
      downstreamOutcome: 'not-observed',
      humanOutcome: 'not-reviewed',
    }),
    evidenceRefs: refs('evidence', 'observed', definition.evidenceSeeds),
    simulationRefs: refs('simulation', 'observed', definition.simulationSeeds),
    approvalRefs: refs('approval', 'operator-supplied', definition.approvalSeeds),
    receiptRefs: refs('receipt', 'observed', definition.receiptSeeds),
    policyRefs: refs('policy', 'operator-supplied', [policyRefDigest]),
    idempotencyRefDigest: digestFor('golden-programmable-money-idempotency', definition.scenario),
    replayRefDigest: digestFor('golden-programmable-money-replay', {
      scenario: definition.scenario,
      replayFreshness: definition.operationFacts.replayFreshness,
    }),
    traceRefDigest: digestFor('golden-programmable-money-trace', definition.scenario),
    schemaRefDigest: digestFor('golden-programmable-money-schema', GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION),
    rawMaterialPolicy: 'digest-only',
  });
  const payload = Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
    scenario: definition.scenario,
    fixtureId: `golden-programmable-money-${String(index + 1).padStart(2, '0')}`,
    expectedPosture: definition.expectedPosture,
    expectedDecision: definition.expectedDecision,
    operationFacts: definition.operationFacts,
    event,
    ...suiteRefs,
    expectedEvidenceStates: definition.expectedEvidenceStates,
    expectedSignals: definition.expectedSignals,
    reasonCodes: definition.reasonCodes,
    fixtureOnly: true,
    synthetic: true,
    shadowOnly: true,
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noRawPayload: true,
    noRawTransactionPayload: true,
    noRawWalletMaterial: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createGoldenProgrammableMoneyShadowFixtureSuite():
GoldenProgrammableMoneyShadowFixtureSuite {
  const suiteRefs = Object.freeze({
    sourceRecipeRefDigest: digestFor(
      'golden-programmable-money-source-recipe',
      'docs/02-architecture/golden-programmable-money-shadow-pilot.md',
    ),
    actionSurfaceRefDigest: digestFor(
      'golden-programmable-money-action-surface',
      'programmable_money.transaction_intent',
    ),
    cryptoAuthorizationCoreRefDigest: digestFor(
      'golden-programmable-money-crypto-authorization-core',
      'attestor/crypto-authorization-core',
    ),
    cryptoExecutionAdmissionRefDigest: digestFor(
      'golden-programmable-money-crypto-execution-admission',
      'attestor/crypto-execution-admission',
    ),
  });
  const fixtures = Object.freeze(
    SCENARIO_DEFINITIONS.map((definition, index) => createFixture(definition, index, suiteRefs)),
  );
  const payload = Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
    name: 'Golden Path: Programmable Money' as const,
    step: 'P01' as const,
    ...suiteRefs,
    fixtureCount: 8 as const,
    scenarios: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS,
    fixtures,
    shadowOnly: true,
    noTargetSystemCalls: true,
    noWalletCalls: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallbacks: true,
    noBundlerCalls: true,
    noFacilitatorCalls: true,
    noSolverCalls: true,
    noRawPayload: true,
    noRawTransactionPayload: true,
    noRawWalletMaterial: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenProgrammableMoneyShadowFixturesDescriptor():
GoldenProgrammableMoneyShadowFixturesDescriptor {
  return Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURES_VERSION,
    step: 'P01',
    sourceSchemaVersion: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    scenarios: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_SCENARIOS,
    shadowOnly: true,
    synthetic: true,
    noTargetSystemCalls: true,
    noWalletCalls: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallbacks: true,
    noBundlerCalls: true,
    noFacilitatorCalls: true,
    noSolverCalls: true,
    noRawPayload: true,
    noRawTransactionPayload: true,
    noRawWalletMaterial: true,
    noRawCustomerIdentifiers: true,
    autoEnforce: false,
    productionReady: false,
    nonClaims: GOLDEN_PROGRAMMABLE_MONEY_SHADOW_FIXTURE_NON_CLAIMS,
  });
}
