import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  EIP7702_INITCODE_MARKER,
  EIP7702_SET_CODE_TX_TYPE,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702DelegateCodeEvidence,
  type Eip7702DelegationPreflight,
  type Eip7702ExecutionEvidence,
  type Eip7702InitializationEvidence,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from '../crypto-authorization-core/eip7702-delegation-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';
import {
  chainIdNumberFromCaip2,
  delegationIndicatorFor,
  normalizeAddress,
  normalizeDecimalInteger,
  normalizeIdentifier,
  normalizeSelector,
} from './delegated-eoa-normalize.js';
import type {
  DelegatedEoaAdmissionExpectation,
  DelegatedEoaAdmissionExpectationKind,
  DelegatedEoaAdmissionExpectationStatus,
  DelegatedEoaAdmissionOutcome,
  DelegatedEoaRuntimeObservation,
} from './delegated-eoa-types.js';

function expectation(input: {
  readonly kind: DelegatedEoaAdmissionExpectationKind;
  readonly status: DelegatedEoaAdmissionExpectationStatus;
  readonly reasonCode: string;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): DelegatedEoaAdmissionExpectation {
  return Object.freeze({
    kind: input.kind,
    status: input.status,
    reasonCode: normalizeIdentifier(input.reasonCode, 'expectation.reasonCode'),
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

function authorizationExpectation(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
}): DelegatedEoaAdmissionExpectation {
  const currentChainId = chainIdNumberFromCaip2(input.plan.chainId);
  const chainScopeReady =
    input.authorization.chainId === '0' || input.authorization.chainId === currentChainId;
  const addressReady =
    input.authorization.authorityAddress ===
      normalizeAddress(input.preflight.authorityAddress, 'preflight.authorityAddress') &&
    input.authorization.delegationAddress ===
      normalizeAddress(input.preflight.delegationAddress, 'preflight.delegationAddress');
  const nonceReady =
    input.authorization.nonce ===
    normalizeDecimalInteger(input.preflight.authorizationNonce, 'preflight.authorizationNonce');
  const recoveredMissing = input.authorization.signatureRecoveredAddress === null;
  const recoveredReady =
    input.authorization.signatureRecoveredAddress === input.authorization.authorityAddress;
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-authorization-tuple-ready';
  if (!chainScopeReady) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-chain-scope-mismatch';
  } else if (!addressReady) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-address-mismatch';
  } else if (!nonceReady) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-nonce-mismatch';
  } else if (!input.authorization.signatureValid) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-signature-invalid';
  } else if (!input.authorization.lowS) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-high-s';
  } else if (recoveredMissing) {
    status = 'missing';
    reasonCode = 'eip7702-authorization-recovered-address-missing';
  } else if (!recoveredReady) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-recovered-address-mismatch';
  }
  return expectation({
    kind: 'authorization-tuple',
    status,
    reasonCode,
    evidence: {
      authorizationChainId: input.authorization.chainId,
      expectedChainId: currentChainId,
      authorityAddress: input.authorization.authorityAddress,
      delegationAddress: input.authorization.delegationAddress,
      nonce: input.authorization.nonce,
      tupleHash: input.authorization.tupleHash ?? null,
      signatureRecoveredAddress: input.authorization.signatureRecoveredAddress ?? null,
      signatureValid: input.authorization.signatureValid,
      lowS: input.authorization.lowS,
    },
  });
}

function authorityNonceExpectation(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
}): DelegatedEoaAdmissionExpectation {
  const authorityReady =
    input.accountState.authorityAddress === input.authorization.authorityAddress;
  const chainReady = input.accountState.chainId === input.plan.chainId;
  const nonceReady =
    input.accountState.currentNonce === input.authorization.nonce &&
    input.accountState.currentNonce ===
      normalizeDecimalInteger(input.preflight.authorizationNonce, 'preflight.authorizationNonce');
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-authority-nonce-ready';
  if (!authorityReady || !chainReady || !nonceReady) {
    status = 'failed';
    reasonCode = 'eip7702-authority-nonce-mismatch';
  } else if (!input.accountState.pendingTransactionPolicyCompliant) {
    status = 'failed';
    reasonCode = 'eip7702-pending-transaction-policy-noncompliant';
  }
  return expectation({
    kind: 'authority-nonce',
    status,
    reasonCode,
    evidence: {
      chainId: input.accountState.chainId,
      currentNonce: input.accountState.currentNonce,
      expectedNonce: input.authorization.nonce,
      pendingTransactionCount: input.accountState.pendingTransactionCount ?? null,
      pendingTransactionPolicyCompliant: input.accountState.pendingTransactionPolicyCompliant,
    },
  });
}

function delegateCodeExpectation(input: {
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
}): DelegatedEoaAdmissionExpectation {
  const addressReady =
    input.delegateCode.delegationAddress === input.authorization.delegationAddress;
  const criticalReady =
    input.delegateCode.audited &&
    input.delegateCode.allowlisted &&
    input.delegateCode.storageLayoutSafe &&
    input.delegateCode.supportsReplayProtection &&
    input.delegateCode.supportsTargetCalldataBinding &&
    input.delegateCode.supportsValueBinding &&
    input.delegateCode.supportsGasBinding;
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-delegate-code-ready';
  if (!addressReady) {
    status = 'failed';
    reasonCode = 'eip7702-delegate-address-mismatch';
  } else if (!criticalReady) {
    status = 'failed';
    reasonCode = 'eip7702-delegate-code-posture-blocked';
  } else if (!input.delegateCode.supportsExpiryBinding) {
    status = 'missing';
    reasonCode = 'eip7702-delegate-expiry-binding-missing';
  }
  return expectation({
    kind: 'delegate-code',
    status,
    reasonCode,
    evidence: {
      delegateImplementationId: input.delegateCode.delegateImplementationId,
      delegateCodeHash: input.delegateCode.delegateCodeHash,
      audited: input.delegateCode.audited,
      allowlisted: input.delegateCode.allowlisted,
      storageLayoutSafe: input.delegateCode.storageLayoutSafe,
      supportsReplayProtection: input.delegateCode.supportsReplayProtection,
      supportsTargetCalldataBinding: input.delegateCode.supportsTargetCalldataBinding,
      supportsValueBinding: input.delegateCode.supportsValueBinding,
      supportsGasBinding: input.delegateCode.supportsGasBinding,
      supportsExpiryBinding: input.delegateCode.supportsExpiryBinding,
    },
  });
}

function accountCodeStateExpectation(input: {
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
}): DelegatedEoaAdmissionExpectation {
  const currentDelegationAddress = input.accountState.currentDelegationAddress ?? null;
  const delegationIndicator = input.accountState.delegationIndicator ?? null;
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-account-code-state-ready';
  if (input.accountState.codeState === 'other-code') {
    status = 'failed';
    reasonCode = 'eip7702-account-has-other-code';
  } else if (input.accountState.codeState === 'empty') {
    if (
      currentDelegationAddress !== null ||
      delegationIndicator !== null
    ) {
      status = 'failed';
      reasonCode = 'eip7702-empty-account-state-inconsistent';
    }
  } else if (currentDelegationAddress === null) {
    status = 'missing';
    reasonCode = 'eip7702-current-delegation-address-missing';
  } else if (delegationIndicator === null) {
    status = 'missing';
    reasonCode = 'eip7702-delegation-indicator-missing';
  } else if (delegationIndicator !== delegationIndicatorFor(currentDelegationAddress)) {
    status = 'failed';
    reasonCode = 'eip7702-delegation-indicator-mismatch';
  }
  return expectation({
    kind: 'account-code-state',
    status,
    reasonCode,
    evidence: {
      codeState: input.accountState.codeState,
      currentDelegationAddress,
      delegationIndicator,
      requestedDelegationAddress: input.authorization.delegationAddress,
      codeHash: input.accountState.codeHash ?? null,
    },
  });
}

function executionPathExpectation(input: {
  readonly preflight: Eip7702DelegationPreflight;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly execution: Eip7702ExecutionEvidence;
}): DelegatedEoaAdmissionExpectation {
  const pathReady = input.execution.executionPath === input.preflight.executionPath;
  const targetReady =
    input.execution.target === normalizeAddress(input.preflight.target, 'preflight.target');
  const selectorReady =
    input.execution.functionSelector ===
    normalizeSelector(input.preflight.functionSelector, 'preflight.functionSelector');
  const tupleIndexReady =
    input.execution.authorizationListNonEmpty &&
    input.execution.authorizationListLength > 0 &&
    input.execution.tupleIndex >= 0 &&
    input.execution.tupleIndex < input.execution.authorizationListLength &&
    input.execution.tupleIsLastValidForAuthority;
  const bindingsReady =
    input.execution.targetCalldataSigned &&
    input.execution.valueSigned &&
    input.execution.gasLimitSigned &&
    input.execution.nonceSigned &&
    input.execution.runtimeContextBound;
  const expiryReady = input.execution.expirySigned;
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-execution-path-ready';
  if (!pathReady) {
    status = 'failed';
    reasonCode = 'eip7702-execution-path-mismatch';
  } else if (!targetReady || !selectorReady) {
    status = 'failed';
    reasonCode = 'eip7702-target-or-selector-mismatch';
  } else if (!tupleIndexReady) {
    status = 'failed';
    reasonCode = 'eip7702-authorization-list-evidence-invalid';
  } else if (!bindingsReady) {
    status = 'failed';
    reasonCode = 'eip7702-call-scope-binding-failed';
  } else if (input.execution.executionPath === 'set-code-transaction') {
    if (input.execution.transactionType !== EIP7702_SET_CODE_TX_TYPE) {
      status = 'failed';
      reasonCode = 'eip7702-transaction-type-mismatch';
    } else if (!expiryReady) {
      status = 'missing';
      reasonCode = 'eip7702-expiry-binding-missing';
    }
  } else if (input.execution.executionPath === 'erc-4337-user-operation') {
    if (input.execution.eip7702AuthIncluded !== true) {
      status = 'failed';
      reasonCode = 'eip7702-useroperation-auth-missing';
    } else if (input.execution.initCodeMarker !== EIP7702_INITCODE_MARKER) {
      status = 'failed';
      reasonCode = 'eip7702-useroperation-initcode-marker-mismatch';
    } else if (input.execution.entryPoint === null) {
      status = 'missing';
      reasonCode = 'eip7702-useroperation-entrypoint-missing';
    } else if (input.execution.preVerificationGasIncludesAuthorizationCost !== true) {
      status = 'failed';
      reasonCode = 'eip7702-useroperation-auth-gas-not-covered';
    } else if (!expiryReady) {
      status = 'missing';
      reasonCode = 'eip7702-expiry-binding-missing';
    }
  } else if (!expiryReady) {
    status = 'missing';
    reasonCode = 'eip7702-expiry-binding-missing';
  }
  return expectation({
    kind: 'execution-path',
    status,
    reasonCode,
    evidence: {
      executionPath: input.execution.executionPath,
      transactionType: input.execution.transactionType ?? null,
      authorizationListLength: input.execution.authorizationListLength,
      tupleIndex: input.execution.tupleIndex,
      tupleIsLastValidForAuthority: input.execution.tupleIsLastValidForAuthority,
      target: input.execution.target,
      functionSelector: input.execution.functionSelector ?? null,
      targetCalldataSigned: input.execution.targetCalldataSigned,
      valueSigned: input.execution.valueSigned,
      gasLimitSigned: input.execution.gasLimitSigned,
      nonceSigned: input.execution.nonceSigned,
      expirySigned: input.execution.expirySigned,
      runtimeContextBound: input.execution.runtimeContextBound,
      eip7702AuthIncluded: input.execution.eip7702AuthIncluded ?? null,
      initCodeMarker: input.execution.initCodeMarker ?? null,
      preVerificationGasIncludesAuthorizationCost:
        input.execution.preVerificationGasIncludesAuthorizationCost ?? null,
      entryPoint: input.execution.entryPoint ?? null,
      userOperationHash: input.execution.userOperationHash ?? null,
    },
  });
}

function walletCapabilityExpectation(
  execution: Eip7702ExecutionEvidence,
): DelegatedEoaAdmissionExpectation {
  if (execution.executionPath !== 'wallet-call-api') {
    return expectation({
      kind: 'wallet-capability',
      status: 'satisfied',
      reasonCode: 'eip7702-wallet-capability-not-required',
      evidence: {
        executionPath: execution.executionPath,
      },
    });
  }
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-wallet-capability-ready';
  if (execution.walletCapabilityObserved !== true || execution.walletCapabilityRequested !== true) {
    status = 'missing';
    reasonCode = 'eip7702-wallet-capability-evidence-missing';
  } else if (execution.walletCapabilitySupported !== true) {
    status = 'unsupported';
    reasonCode = 'eip7702-wallet-capability-unsupported';
  }
  return expectation({
    kind: 'wallet-capability',
    status,
    reasonCode,
    evidence: {
      observed: execution.walletCapabilityObserved ?? null,
      supported: execution.walletCapabilitySupported ?? null,
      requested: execution.walletCapabilityRequested ?? null,
      atomicRequired: execution.atomicRequired ?? null,
    },
  });
}

function initializationExpectation(input: {
  readonly execution: Eip7702ExecutionEvidence;
  readonly initialization: Eip7702InitializationEvidence;
}): DelegatedEoaAdmissionExpectation {
  if (!input.initialization.initializationRequired) {
    return expectation({
      kind: 'initialization',
      status: 'satisfied',
      reasonCode: 'eip7702-initialization-not-required',
    });
  }
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-initialization-ready';
  if (input.initialization.initializationCalldataHash === null) {
    status = 'missing';
    reasonCode = 'eip7702-initialization-calldata-hash-missing';
  } else if (input.initialization.initializationSignedByAuthority !== true) {
    status = 'failed';
    reasonCode = 'eip7702-initialization-not-signed-by-authority';
  } else if (input.initialization.frontRunProtected !== true) {
    status = 'failed';
    reasonCode = 'eip7702-initialization-front-run-protection-missing';
  } else if (
    input.execution.executionPath === 'erc-4337-user-operation' &&
    input.initialization.initializationExecutedBeforeValidation !== true
  ) {
    status = 'failed';
    reasonCode = 'eip7702-initialization-not-before-validation';
  }
  return expectation({
    kind: 'initialization',
    status,
    reasonCode,
    evidence: {
      initializationRequired: input.initialization.initializationRequired,
      initializationCalldataHash: input.initialization.initializationCalldataHash ?? null,
      initializationSignedByAuthority:
        input.initialization.initializationSignedByAuthority ?? null,
      initializationExecutedBeforeValidation:
        input.initialization.initializationExecutedBeforeValidation ?? null,
      frontRunProtected: input.initialization.frontRunProtected ?? null,
    },
  });
}

function sponsorshipExpectation(
  sponsor: Eip7702SponsorEvidence,
): DelegatedEoaAdmissionExpectation {
  if (!sponsor.sponsored) {
    return expectation({
      kind: 'sponsorship',
      status: 'satisfied',
      reasonCode: 'eip7702-sponsorship-not-used',
    });
  }
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-sponsored-path-ready';
  if (sponsor.sponsorAddress === null) {
    status = 'missing';
    reasonCode = 'eip7702-sponsor-address-missing';
  } else if (sponsor.sponsorBondRequired === true && sponsor.sponsorBondPresent !== true) {
    status = 'failed';
    reasonCode = 'eip7702-sponsor-bond-missing';
  } else if (sponsor.reimbursementBound !== true) {
    status = 'failed';
    reasonCode = 'eip7702-sponsor-reimbursement-unbound';
  }
  return expectation({
    kind: 'sponsorship',
    status,
    reasonCode,
    evidence: {
      sponsored: sponsor.sponsored,
      sponsorAddress: sponsor.sponsorAddress ?? null,
      sponsorBondRequired: sponsor.sponsorBondRequired ?? null,
      sponsorBondPresent: sponsor.sponsorBondPresent ?? null,
      reimbursementBound: sponsor.reimbursementBound ?? null,
    },
  });
}

function recoveryExpectation(
  recovery: Eip7702RecoveryEvidence,
): DelegatedEoaAdmissionExpectation {
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-recovery-ready';
  if (!recovery.privateKeyStillControlsAccountAcknowledged) {
    status = 'failed';
    reasonCode = 'eip7702-private-key-control-not-acknowledged';
  } else if (
    !recovery.revocationPathReady ||
    (!recovery.zeroAddressClearSupported && !recovery.emergencyDelegateResetPrepared)
  ) {
    status = 'missing';
    reasonCode = 'eip7702-recovery-posture-incomplete';
  }
  return expectation({
    kind: 'recovery',
    status,
    reasonCode,
    evidence: {
      revocationPathReady: recovery.revocationPathReady,
      zeroAddressClearSupported: recovery.zeroAddressClearSupported,
      privateKeyStillControlsAccountAcknowledged:
        recovery.privateKeyStillControlsAccountAcknowledged,
      emergencyDelegateResetPrepared: recovery.emergencyDelegateResetPrepared,
      recoveryAuthorityRef: recovery.recoveryAuthorityRef ?? null,
    },
  });
}

function postExecutionExpectation(input: {
  readonly delegationAddress: string;
  readonly runtimeObservation: DelegatedEoaRuntimeObservation | null;
}): DelegatedEoaAdmissionExpectation {
  if (input.runtimeObservation === null) {
    return expectation({
      kind: 'post-execution',
      status: 'satisfied',
      reasonCode: 'eip7702-post-execution-pending',
    });
  }
  let status: DelegatedEoaAdmissionExpectationStatus = 'satisfied';
  let reasonCode = 'eip7702-post-execution-compatible';
  if (!input.runtimeObservation.success) {
    status = 'failed';
    reasonCode = 'eip7702-post-execution-failed';
  } else if (
    input.runtimeObservation.delegationAddress !== null &&
    input.runtimeObservation.delegationAddress !== input.delegationAddress
  ) {
    status = 'failed';
    reasonCode = 'eip7702-post-execution-delegation-mismatch';
  } else if (input.runtimeObservation.codeState === 'other-code') {
    status = 'failed';
    reasonCode = 'eip7702-post-execution-other-code';
  }
  return expectation({
    kind: 'post-execution',
    status,
    reasonCode,
    evidence: {
      runtimeObservation: input.runtimeObservation as unknown as CanonicalReleaseJsonValue,
    },
  });
}

export function expectationsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly initialization: Eip7702InitializationEvidence;
  readonly sponsor: Eip7702SponsorEvidence;
  readonly recovery: Eip7702RecoveryEvidence;
  readonly runtimeObservation: DelegatedEoaRuntimeObservation | null;
}): readonly DelegatedEoaAdmissionExpectation[] {
  const planSurfaceReady =
    input.plan.surface === 'delegated-eoa-runtime' &&
    input.plan.adapterKind === 'eip-7702-delegation' &&
    input.preflight.adapterKind === 'eip-7702-delegation' &&
    input.plan.chainId === input.preflight.chainId &&
    normalizeAddress(input.plan.accountAddress, 'plan.accountAddress') ===
      normalizeAddress(input.preflight.authorityAddress, 'preflight.authorityAddress');
  const adapterPreflightReady = input.preflight.outcome === 'allow';
  const adapterPreflightStatus: DelegatedEoaAdmissionExpectationStatus =
    adapterPreflightReady
      ? 'satisfied'
      : input.preflight.outcome === 'review-required'
        ? 'missing'
        : 'failed';
  const adapterPreflightReason =
    input.preflight.outcome === 'allow'
      ? 'eip7702-preflight-allow'
      : input.preflight.outcome === 'review-required'
        ? 'eip7702-preflight-review-required'
        : 'eip7702-preflight-blocked';
  return Object.freeze([
    expectation({
      kind: 'plan-surface',
      status: planSurfaceReady ? 'satisfied' : 'unsupported',
      reasonCode: planSurfaceReady
        ? 'delegated-eoa-plan-surface-ready'
        : 'delegated-eoa-plan-surface-mismatch',
      evidence: {
        planSurface: input.plan.surface,
        planAdapterKind: input.plan.adapterKind,
        preflightAdapterKind: input.preflight.adapterKind,
        planChainId: input.plan.chainId,
        preflightChainId: input.preflight.chainId,
        planAccountAddress: input.plan.accountAddress,
        preflightAuthorityAddress: input.preflight.authorityAddress,
      },
    }),
    expectation({
      kind: 'adapter-preflight',
      status: adapterPreflightStatus,
      reasonCode: adapterPreflightReason,
      evidence: {
        preflightOutcome: input.preflight.outcome,
        preflightDigest: input.preflight.digest,
        executionPath: input.preflight.executionPath,
      },
    }),
    authorizationExpectation(input),
    authorityNonceExpectation(input),
    delegateCodeExpectation(input),
    accountCodeStateExpectation(input),
    executionPathExpectation(input),
    walletCapabilityExpectation(input.execution),
    initializationExpectation(input),
    sponsorshipExpectation(input.sponsor),
    recoveryExpectation(input.recovery),
    postExecutionExpectation({
      delegationAddress: input.authorization.delegationAddress,
      runtimeObservation: input.runtimeObservation,
    }),
  ]);
}

export function blockingReasonsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly expectations: readonly DelegatedEoaAdmissionExpectation[];
}): readonly string[] {
  const reasons: string[] = [];
  if (input.plan.outcome === 'deny') {
    reasons.push('admission-plan-denied');
  }
  input.expectations
    .filter((entry) => entry.status === 'unsupported' || entry.status === 'failed')
    .forEach((entry) => reasons.push(entry.reasonCode));
  return Object.freeze(reasons);
}

export function outcomeFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: Eip7702DelegationPreflight;
  readonly expectations: readonly DelegatedEoaAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
}): DelegatedEoaAdmissionOutcome {
  if (input.blockingReasons.length > 0) return 'blocked';
  if (input.plan.outcome !== 'admit' || input.preflight.outcome !== 'allow') {
    return 'needs-runtime-evidence';
  }
  if (input.expectations.some((entry) => entry.status === 'missing')) {
    return 'needs-runtime-evidence';
  }
  return 'ready';
}
