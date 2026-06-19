import type { CryptoAdmissionReceiptClassification, CryptoAdmissionTelemetrySignal } from './telemetry-receipts.js';
import type { CryptoExecutionAdmissionOutcome } from './index.js';
import {
  CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES,
  CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES,
  type CryptoAdmissionConformanceSurface,
  type CryptoAdmissionNegativeConformanceClass,
  type CryptoAdmissionNegativeConformanceFixture,
} from './conformance-fixtures-types.js';
import type { CryptoExecutionAdapterKind } from '../crypto-authorization-core/types.js';

export interface NegativeConformanceCase {
  readonly scenario: string;
  readonly evidenceClass: string;
  readonly expectedFindingCode: string;
}

export interface NegativeConformanceSurfaceProfile {
  readonly adapterKind: CryptoExecutionAdapterKind;
  readonly standards: readonly string[];
  readonly cases: Readonly<
    Record<CryptoAdmissionNegativeConformanceClass, NegativeConformanceCase>
  >;
}

export const EXPECTED_SIGNAL_BY_OUTCOME: Readonly<
  Record<CryptoExecutionAdmissionOutcome, Exclude<CryptoAdmissionTelemetrySignal, 'receipt-issued'>>
> = Object.freeze({
  admit: 'admitted',
  deny: 'blocked',
  'needs-evidence': 'missing-evidence',
});

export const EXPECTED_CLASSIFICATION_BY_OUTCOME: Readonly<
  Record<CryptoExecutionAdmissionOutcome, CryptoAdmissionReceiptClassification>
> = Object.freeze({
  admit: 'admitted',
  deny: 'blocked',
  'needs-evidence': 'missing-evidence',
});

const NEGATIVE_OUTCOME_BY_CLASS: Readonly<
  Record<CryptoAdmissionNegativeConformanceClass, Exclude<CryptoExecutionAdmissionOutcome, 'admit'>>
> = Object.freeze({
  malformed: 'needs-evidence',
  stale: 'needs-evidence',
  malicious: 'deny',
  contradictory: 'deny',
  'privacy-unsafe': 'deny',
});

const NEGATIVE_ACTION_BY_CLASS: Readonly<
  Record<
    CryptoAdmissionNegativeConformanceClass,
    CryptoAdmissionNegativeConformanceFixture['expectedDownstreamAction']
  >
> = Object.freeze({
  malformed: 'collect-evidence',
  stale: 'collect-evidence',
  malicious: 'block-execution',
  contradictory: 'hold-for-review',
  'privacy-unsafe': 'reject-fixture',
});

export const NEGATIVE_SURFACE_PROFILES: Readonly<
  Record<CryptoAdmissionConformanceSurface, NegativeConformanceSurfaceProfile>
> = Object.freeze({
  'wallet-rpc': Object.freeze({
    adapterKind: 'wallet-call-api',
    standards: Object.freeze(['EIP-5792', 'ERC-7715', 'ERC-7902']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Wallet RPC call bundle omits a parseable prepared-call structure.',
        evidenceClass: 'prepared-call-bundle',
        expectedFindingCode: 'wallet-rpc-call-bundle-malformed',
      },
      stale: {
        scenario: 'Wallet capability evidence is older than the admitted wallet-call scope.',
        evidenceClass: 'wallet-capabilities',
        expectedFindingCode: 'wallet-rpc-capabilities-stale',
      },
      malicious: {
        scenario: 'Wallet permission request attempts to expand spend or target scope.',
        evidenceClass: 'wallet-permission-scope',
        expectedFindingCode: 'wallet-rpc-permission-escalation',
      },
      contradictory: {
        scenario: 'Wallet chain and prepared-call chain disagree.',
        evidenceClass: 'wallet-chain-binding',
        expectedFindingCode: 'wallet-rpc-chain-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Wallet metadata includes data that must be rejected before feedback.',
        evidenceClass: 'wallet-metadata-redaction',
        expectedFindingCode: 'wallet-rpc-metadata-privacy-rejected',
      },
    }),
  }),
  'smart-account-guard': Object.freeze({
    adapterKind: 'safe-guard',
    standards: Object.freeze(['Safe Guard', 'Safe Module Guard', 'ERC-1271']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Safe transaction hash evidence is not structurally valid.',
        evidenceClass: 'safe-transaction-hash',
        expectedFindingCode: 'safe-transaction-hash-malformed',
      },
      stale: {
        scenario: 'Guard installation evidence is stale relative to the current Safe config.',
        evidenceClass: 'guard-precheck',
        expectedFindingCode: 'safe-guard-installation-stale',
      },
      malicious: {
        scenario: 'Module path attempts to bypass the expected guard enforcement point.',
        evidenceClass: 'module-guard-precheck',
        expectedFindingCode: 'safe-module-guard-bypass',
      },
      contradictory: {
        scenario: 'Safe owner or threshold evidence conflicts with the guard precheck.',
        evidenceClass: 'safe-owner-threshold',
        expectedFindingCode: 'safe-owner-threshold-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Safe integration metadata contains material that must not enter telemetry.',
        evidenceClass: 'safe-metadata-redaction',
        expectedFindingCode: 'safe-metadata-privacy-rejected',
      },
    }),
  }),
  'account-abstraction-bundler': Object.freeze({
    adapterKind: 'erc-4337-user-operation',
    standards: Object.freeze(['ERC-4337', 'ERC-7562', 'ERC-1271']),
    cases: Object.freeze({
      malformed: {
        scenario: 'UserOperation evidence is not structurally parseable.',
        evidenceClass: 'user-operation-hash',
        expectedFindingCode: 'erc4337-user-operation-malformed',
      },
      stale: {
        scenario: 'UserOperation validity or nonce evidence is stale.',
        evidenceClass: 'simulate-validation-result',
        expectedFindingCode: 'erc4337-validation-stale',
      },
      malicious: {
        scenario: 'Paymaster, factory, or account validation attempts an unsafe execution path.',
        evidenceClass: 'erc-7562-validation-scope',
        expectedFindingCode: 'erc4337-validation-scope-malicious',
      },
      contradictory: {
        scenario: 'EntryPoint, chain, or account evidence conflicts with the admitted plan.',
        evidenceClass: 'entrypoint-chain-binding',
        expectedFindingCode: 'erc4337-entrypoint-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'UserOperation metadata includes material that must be rejected before export.',
        evidenceClass: 'user-operation-metadata-redaction',
        expectedFindingCode: 'erc4337-metadata-privacy-rejected',
      },
    }),
  }),
  'modular-account-runtime': Object.freeze({
    adapterKind: 'erc-6900-plugin',
    standards: Object.freeze(['ERC-7579', 'ERC-6900', 'ERC-4337']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Module or plugin manifest cannot be parsed into an approved runtime shape.',
        evidenceClass: 'plugin-manifest-approval',
        expectedFindingCode: 'modular-account-manifest-malformed',
      },
      stale: {
        scenario: 'Module installation evidence is stale relative to runtime state.',
        evidenceClass: 'module-installation-evidence',
        expectedFindingCode: 'modular-account-installation-stale',
      },
      malicious: {
        scenario: 'Module hook attempts to bypass validation or execution checks.',
        evidenceClass: 'module-hook-precheck',
        expectedFindingCode: 'modular-account-hook-bypass',
      },
      contradictory: {
        scenario: 'Module type, selector, or plugin manifest evidence conflicts.',
        evidenceClass: 'module-runtime-binding',
        expectedFindingCode: 'modular-account-runtime-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Module metadata includes material that must stay out of proof and telemetry.',
        evidenceClass: 'module-metadata-redaction',
        expectedFindingCode: 'modular-account-metadata-privacy-rejected',
      },
    }),
  }),
  'delegated-eoa-runtime': Object.freeze({
    adapterKind: 'eip-7702-delegation',
    standards: Object.freeze(['EIP-7702', 'EIP-5792', 'ERC-7902']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Delegated EOA authorization tuple is not structurally valid.',
        evidenceClass: 'authorization-list-tuple',
        expectedFindingCode: 'eip7702-authorization-tuple-malformed',
      },
      stale: {
        scenario: 'Delegation nonce or validity evidence is stale.',
        evidenceClass: 'delegation-freshness',
        expectedFindingCode: 'eip7702-delegation-stale',
      },
      malicious: {
        scenario: 'Delegate code target is not approved for the admitted account scope.',
        evidenceClass: 'delegate-code-approval',
        expectedFindingCode: 'eip7702-delegate-code-malicious',
      },
      contradictory: {
        scenario: 'Authorization tuple chain and wallet-call chain disagree.',
        evidenceClass: 'delegated-chain-binding',
        expectedFindingCode: 'eip7702-chain-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Delegation metadata includes material that must not enter model feedback.',
        evidenceClass: 'delegation-metadata-redaction',
        expectedFindingCode: 'eip7702-metadata-privacy-rejected',
      },
    }),
  }),
  'agent-payment-http': Object.freeze({
    adapterKind: 'x402-payment',
    standards: Object.freeze(['x402-v2', 'HTTP 402', 'EIP-3009']),
    cases: Object.freeze({
      malformed: {
        scenario: 'x402 payment header or payment response cannot be decoded.',
        evidenceClass: 'x402-payment-header',
        expectedFindingCode: 'x402-payment-header-malformed',
      },
      stale: {
        scenario: 'Payment requirement or facilitator verification is stale.',
        evidenceClass: 'x402-payment-requirement',
        expectedFindingCode: 'x402-payment-requirement-stale',
      },
      malicious: {
        scenario: 'Facilitator, payee, or resource route attempts to change the admitted payment scope.',
        evidenceClass: 'x402-facilitator-trust',
        expectedFindingCode: 'x402-facilitator-or-payee-malicious',
      },
      contradictory: {
        scenario: 'Amount, network, asset, or payer evidence conflicts across x402 handoff material.',
        evidenceClass: 'x402-payment-verification',
        expectedFindingCode: 'x402-payment-scope-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'x402 metadata includes material that must not be echoed to telemetry or proof.',
        evidenceClass: 'x402-metadata-redaction',
        expectedFindingCode: 'x402-metadata-privacy-rejected',
      },
    }),
  }),
  'custody-policy-engine': Object.freeze({
    adapterKind: 'custody-cosigner',
    standards: Object.freeze(['custody-policy-engine', 'co-signer-callback']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Custody co-signer callback evidence cannot be parsed into a decision.',
        evidenceClass: 'co-signer-response',
        expectedFindingCode: 'custody-cosigner-callback-malformed',
      },
      stale: {
        scenario: 'Custody policy decision is stale for the requested withdrawal.',
        evidenceClass: 'custody-policy-decision',
        expectedFindingCode: 'custody-policy-decision-stale',
      },
      malicious: {
        scenario: 'Custody callback attempts to bypass quorum or approval policy.',
        evidenceClass: 'custody-quorum-binding',
        expectedFindingCode: 'custody-quorum-bypass',
      },
      contradictory: {
        scenario: 'Provider status and Attestor custody policy outcome conflict.',
        evidenceClass: 'custody-provider-status',
        expectedFindingCode: 'custody-provider-status-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Custody callback body includes material that must not be stored in outputs.',
        evidenceClass: 'custody-callback-redaction',
        expectedFindingCode: 'custody-callback-privacy-rejected',
      },
    }),
  }),
  'intent-solver': Object.freeze({
    adapterKind: 'intent-settlement',
    standards: Object.freeze(['ERC-7683', 'intent-settlement', 'solver-preflight']),
    cases: Object.freeze({
      malformed: {
        scenario: 'Intent order or route commitment cannot be parsed.',
        evidenceClass: 'solver-route-commitment',
        expectedFindingCode: 'intent-solver-order-malformed',
      },
      stale: {
        scenario: 'Settlement deadline, quote, or route freshness has expired.',
        evidenceClass: 'settlement-preflight',
        expectedFindingCode: 'intent-solver-settlement-stale',
      },
      malicious: {
        scenario: 'Solver route attempts to substitute destination, asset, or settlement path.',
        evidenceClass: 'solver-route-risk',
        expectedFindingCode: 'intent-solver-route-malicious',
      },
      contradictory: {
        scenario: 'Route commitment and settlement preflight conflict.',
        evidenceClass: 'route-settlement-binding',
        expectedFindingCode: 'intent-solver-route-contradiction',
      },
      'privacy-unsafe': {
        scenario: 'Solver route metadata includes material that must not be disclosed.',
        evidenceClass: 'solver-route-redaction',
        expectedFindingCode: 'intent-solver-route-privacy-rejected',
      },
    }),
  }),
});

export function negativeFixture(input: {
  readonly surface: CryptoAdmissionConformanceSurface;
  readonly profile: NegativeConformanceSurfaceProfile;
  readonly negativeClass: CryptoAdmissionNegativeConformanceClass;
  readonly scenario: NegativeConformanceCase;
}): CryptoAdmissionNegativeConformanceFixture {
  const expectedPlanOutcome = NEGATIVE_OUTCOME_BY_CLASS[input.negativeClass];
  const expectedSignal = EXPECTED_SIGNAL_BY_OUTCOME[expectedPlanOutcome] as Exclude<
    CryptoAdmissionTelemetrySignal,
    'admitted' | 'receipt-issued'
  >;
  return Object.freeze({
    fixtureId: `${input.surface}-${input.negativeClass}-negative-v1`,
    surface: input.surface,
    adapterKind: input.profile.adapterKind,
    negativeClass: input.negativeClass,
    standards: input.profile.standards,
    scenario: input.scenario.scenario,
    evidenceClass: input.scenario.evidenceClass,
    expectedFindingCode: input.scenario.expectedFindingCode,
    expectedPlanOutcome,
    expectedSignal,
    expectedDownstreamAction: NEGATIVE_ACTION_BY_CLASS[input.negativeClass],
    modelSafeFeedback: Object.freeze([
      `negative-class:${input.negativeClass}`,
      `finding:${input.scenario.expectedFindingCode}`,
      `evidence:${input.scenario.evidenceClass}`,
    ]),
    shouldFailClosed: true,
    rawPayloadStored: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export const CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_FIXTURES = Object.freeze(
  CRYPTO_ADMISSION_CONFORMANCE_REQUIRED_SURFACES.flatMap((surface) => {
    const profile = NEGATIVE_SURFACE_PROFILES[surface];
    return CRYPTO_ADMISSION_NEGATIVE_CONFORMANCE_CLASSES.map((negativeClass) =>
      negativeFixture({
        surface,
        profile,
        negativeClass,
        scenario: profile.cases[negativeClass],
      }),
    );
  }),
);
