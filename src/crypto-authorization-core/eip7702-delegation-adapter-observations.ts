import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoReleaseDecisionBinding } from './release-decision-binding.js';
import type { CryptoPolicyControlPlaneScopeBinding } from './policy-control-plane-scope-binding.js';
import type { CryptoEnforcementVerificationBinding } from './enforcement-plane-verification.js';
import {
  EIP7702_AUTHORIZATION_MAGIC,
  type Eip7702AccountStateEvidence,
  type Eip7702AuthorizationTupleEvidence,
  type Eip7702Check,
  type Eip7702DelegateCodeEvidence,
  type Eip7702ExecutionEvidence,
  type Eip7702InitializationEvidence,
  type Eip7702Observation,
  type Eip7702ObservationStatus,
  type Eip7702RecoveryEvidence,
  type Eip7702SponsorEvidence,
} from './eip7702-delegation-adapter-types.js';
import {
  ZERO_EVM_ADDRESS,
  caip2ChainId,
  eip155ChainId,
  nonceMatches,
  normalizeIdentifier,
  sameAddress,
} from './eip7702-delegation-adapter-normalize.js';
import {
  accountCodeReady,
  authorizationChainReady,
  authorizationListReady,
  callScopeSigned,
  delegateCodeReady,
  erc4337Ready,
  executionPathReady,
  initializationReady,
  recoveryReady,
  sponsorReady,
  walletCapabilityReady,
} from './eip7702-delegation-adapter-readiness.js';

function observation(input: {
  readonly check: Eip7702Check;
  readonly status: Eip7702ObservationStatus;
  readonly code: string;
  readonly message: string;
  readonly required?: boolean;
  readonly evidence?: Readonly<Record<string, CanonicalReleaseJsonValue>>;
}): Eip7702Observation {
  return Object.freeze({
    check: input.check,
    status: input.status,
    code: normalizeIdentifier(input.code, 'observation.code'),
    message: normalizeIdentifier(input.message, 'observation.message'),
    required: input.required ?? true,
    evidence: Object.freeze(input.evidence ?? {}),
  });
}

export function buildEip7702Observations(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
  readonly enforcementBinding: CryptoEnforcementVerificationBinding;
  readonly authorization: Eip7702AuthorizationTupleEvidence;
  readonly accountState: Eip7702AccountStateEvidence;
  readonly delegateCode: Eip7702DelegateCodeEvidence;
  readonly execution: Eip7702ExecutionEvidence;
  readonly initialization: Eip7702InitializationEvidence;
  readonly sponsor: Eip7702SponsorEvidence;
  readonly recovery: Eip7702RecoveryEvidence;
}): readonly Eip7702Observation[] {
  const observations: Eip7702Observation[] = [];
  const intentChainId = caip2ChainId(input.intent);
  const targetAddress = input.intent.target.address ?? null;
  const requiredSelector = input.intent.target.functionSelector?.toLowerCase() ?? null;
  const requiredCalldataClass = input.intent.target.calldataClass ?? null;
  const signatureReady =
    input.authorization.signatureValid &&
    input.authorization.lowS &&
    sameAddress(input.authorization.authorityAddress, input.authorization.signatureRecoveredAddress);
  const authorizationNonceReady =
    input.authorization.nonce === input.accountState.currentNonce &&
    nonceMatches(input.intent.constraints.nonce, input.authorization.nonce);
  const authorizationChainScoped = authorizationChainReady({
    authorization: input.authorization,
    intent: input.intent,
  });
  const delegationAddressReady =
    input.authorization.delegationAddress !== ZERO_EVM_ADDRESS &&
    sameAddress(input.authorization.delegationAddress, input.delegateCode.delegationAddress);
  const releaseReady =
    input.releaseBinding.status === 'bound' &&
    input.releaseBinding.releaseDecision.status === 'accepted';
  const enforcementReady =
    input.enforcementBinding.adapterKind === 'eip-7702-delegation' &&
    input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind === 'action-dispatch' &&
    input.enforcementBinding.verificationProfile.failClosed;
  const postExecutionReady =
    input.execution.postExecutionSuccess === null ||
    input.execution.postExecutionSuccess === true;

  observations.push(
    observation({
      check: 'eip7702-adapter-kind',
      status: input.intent.executionAdapterKind === 'eip-7702-delegation' ? 'pass' : 'fail',
      code: input.intent.executionAdapterKind === 'eip-7702-delegation'
        ? 'eip7702-adapter-kind-bound'
        : 'eip7702-adapter-kind-mismatch',
      message: input.intent.executionAdapterKind === 'eip-7702-delegation'
        ? 'Intent is bound to the EIP-7702 delegation adapter.'
        : 'Intent is not bound to the EIP-7702 delegation adapter.',
      evidence: {
        adapterKind: input.intent.executionAdapterKind ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-account-kind-eoa',
      status: input.intent.account.accountKind === 'eoa' ? 'pass' : 'fail',
      code: input.intent.account.accountKind === 'eoa'
        ? 'eip7702-account-kind-eoa'
        : 'eip7702-account-kind-not-eoa',
      message: input.intent.account.accountKind === 'eoa'
        ? 'Intent account is an EOA as required for EIP-7702 delegated execution.'
        : 'EIP-7702 delegated execution requires an EOA account.',
      evidence: {
        accountKind: input.intent.account.accountKind,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-authority-matches-intent',
      status:
        sameAddress(input.authorization.authorityAddress, input.intent.account.address) &&
        sameAddress(input.accountState.authorityAddress, input.intent.account.address)
          ? 'pass'
          : 'fail',
      code:
        sameAddress(input.authorization.authorityAddress, input.intent.account.address) &&
        sameAddress(input.accountState.authorityAddress, input.intent.account.address)
          ? 'eip7702-authority-bound'
          : 'eip7702-authority-mismatch',
      message:
        sameAddress(input.authorization.authorityAddress, input.intent.account.address) &&
        sameAddress(input.accountState.authorityAddress, input.intent.account.address)
          ? 'Authorization tuple authority and observed account state match the intent account.'
          : 'Authorization tuple authority or observed account state does not match the intent account.',
      evidence: {
        intentAccount: input.intent.account.address,
        tupleAuthority: input.authorization.authorityAddress,
        observedAuthority: input.accountState.authorityAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-chain-matches-intent',
      status: input.accountState.chainId === intentChainId ? 'pass' : 'fail',
      code: input.accountState.chainId === intentChainId
        ? 'eip7702-chain-bound'
        : 'eip7702-chain-mismatch',
      message: input.accountState.chainId === intentChainId
        ? 'Observed EIP-7702 account state is on the intent chain.'
        : 'Observed EIP-7702 account state is not on the intent chain.',
      evidence: {
        observedChainId: input.accountState.chainId,
        intentChainId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-authorization-chain-scope',
      status: authorizationChainScoped ? 'pass' : 'fail',
      code: authorizationChainScoped
        ? 'eip7702-authorization-chain-scoped'
        : input.authorization.chainId === '0'
          ? 'eip7702-universal-chain-authorization-not-allowed'
          : 'eip7702-authorization-chain-mismatch',
      message: authorizationChainScoped
        ? 'Authorization tuple chain id is scoped to the current EIP-155 chain or explicitly allowed as universal.'
        : input.authorization.chainId === '0'
          ? 'Universal EIP-7702 authorization is not allowed unless the intent explicitly opts in.'
          : 'Authorization tuple chain id is not valid for this EIP-155 chain.',
      evidence: {
        tupleChainId: input.authorization.chainId,
        intentEip155ChainId: eip155ChainId(input.intent),
        universalChainAuthorizationAllowed:
          input.intent.constraints.allowUniversalChainAuthorization,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-authorization-signature',
      status: signatureReady ? 'pass' : 'fail',
      code: !input.authorization.signatureValid
        ? 'eip7702-authorization-signature-invalid'
        : !input.authorization.lowS
          ? 'eip7702-authorization-signature-malleable'
          : !sameAddress(input.authorization.authorityAddress, input.authorization.signatureRecoveredAddress)
            ? 'eip7702-authorization-recovered-authority-mismatch'
            : 'eip7702-authorization-signature-valid',
      message: signatureReady
        ? 'Authorization tuple signature is valid, low-s, and recovers the authority address.'
        : 'Authorization tuple signature is invalid, malleable, or recovers the wrong authority.',
      evidence: {
        magic: EIP7702_AUTHORIZATION_MAGIC,
        tupleHash: input.authorization.tupleHash ?? null,
        authorityAddress: input.authorization.authorityAddress,
        recoveredAddress: input.authorization.signatureRecoveredAddress ?? null,
        yParity: input.authorization.yParity,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-authorization-nonce',
      status: authorizationNonceReady ? 'pass' : 'fail',
      code: input.authorization.nonce !== input.accountState.currentNonce
        ? 'eip7702-authority-nonce-stale'
        : authorizationNonceReady
          ? 'eip7702-authorization-nonce-bound'
          : 'eip7702-authorization-nonce-mismatch',
      message: authorizationNonceReady
        ? 'Authorization tuple nonce matches account state and Attestor replay constraints.'
        : 'Authorization tuple nonce is stale or not bound to Attestor replay constraints.',
      evidence: {
        tupleNonce: input.authorization.nonce,
        observedNonce: input.accountState.currentNonce,
        intentNonce: input.intent.constraints.nonce,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-delegation-address-bound',
      status: delegationAddressReady ? 'pass' : 'fail',
      code: input.authorization.delegationAddress === ZERO_EVM_ADDRESS
        ? 'eip7702-delegation-clear-not-execution'
        : delegationAddressReady
          ? 'eip7702-delegation-address-bound'
          : 'eip7702-delegation-address-mismatch',
      message: delegationAddressReady
        ? 'Authorization tuple delegation address matches the approved delegate code evidence.'
        : 'Delegation address is zero or does not match approved delegate code evidence.',
      evidence: {
        tupleDelegationAddress: input.authorization.delegationAddress,
        delegateCodeAddress: input.delegateCode.delegationAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-delegate-code-posture',
      status: delegateCodeReady(input.delegateCode) ? 'pass' : 'fail',
      code: delegateCodeReady(input.delegateCode)
        ? 'eip7702-delegate-code-ready'
        : 'eip7702-delegate-code-not-approved',
      message: delegateCodeReady(input.delegateCode)
        ? 'Delegate code is audited, allowlisted, storage-safe, and supports bounded execution proofs.'
        : 'Delegate code lacks audit, allowlist, storage, or signed-scope support.',
      evidence: {
        delegateCodeHash: input.delegateCode.delegateCodeHash,
        implementationId: input.delegateCode.delegateImplementationId,
        audited: input.delegateCode.audited,
        allowlisted: input.delegateCode.allowlisted,
        storageLayoutSafe: input.delegateCode.storageLayoutSafe,
        supportsReplayProtection: input.delegateCode.supportsReplayProtection,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-account-code-state',
      status: accountCodeReady({
        accountState: input.accountState,
        authorization: input.authorization,
      }) ? 'pass' : 'fail',
      code: input.accountState.codeState === 'other-code'
        ? 'eip7702-account-has-nondelegation-code'
        : accountCodeReady({ accountState: input.accountState, authorization: input.authorization })
          ? 'eip7702-account-code-state-compatible'
          : 'eip7702-current-delegation-mismatch',
      message: accountCodeReady({ accountState: input.accountState, authorization: input.authorization })
        ? 'Account code state is empty or already delegated to the intended code target.'
        : 'Account code state is incompatible with the requested EIP-7702 delegation.',
      evidence: {
        codeState: input.accountState.codeState,
        currentDelegationAddress: input.accountState.currentDelegationAddress ?? null,
        delegationIndicator: input.accountState.delegationIndicator ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-authorization-list',
      status: authorizationListReady(input.execution) ? 'pass' : 'fail',
      code: !input.execution.authorizationListNonEmpty || input.execution.authorizationListLength === 0
        ? 'eip7702-authorization-list-empty'
        : !input.execution.tupleIsLastValidForAuthority
          ? 'eip7702-authorization-tuple-not-last-valid'
          : authorizationListReady(input.execution)
            ? 'eip7702-authorization-list-bound'
            : 'eip7702-authorization-list-invalid-index',
      message: authorizationListReady(input.execution)
        ? 'Authorization list is non-empty and the tuple is the last valid occurrence for the authority.'
        : 'Authorization list is empty, invalidly indexed, or superseded by a later tuple.',
      evidence: {
        authorizationListLength: input.execution.authorizationListLength,
        tupleIndex: input.execution.tupleIndex,
        tupleIsLastValidForAuthority: input.execution.tupleIsLastValidForAuthority,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-execution-path',
      status: executionPathReady({
        accountState: input.accountState,
        execution: input.execution,
      }) ? 'pass' : 'fail',
      code: executionPathReady({ accountState: input.accountState, execution: input.execution })
        ? 'eip7702-execution-path-ready'
        : 'eip7702-execution-path-not-ready',
      message: executionPathReady({ accountState: input.accountState, execution: input.execution })
        ? 'Execution path satisfies set-code, ERC-4337, or wallet-call EIP-7702 requirements.'
        : 'Execution path lacks required EIP-7702 transaction, UserOperation, or wallet capability evidence.',
      evidence: {
        executionPath: input.execution.executionPath,
        transactionType: input.execution.transactionType ?? null,
        userOperationHash: input.execution.userOperationHash ?? null,
        initCodeMarker: input.execution.initCodeMarker ?? null,
        walletCapabilitySupported: input.execution.walletCapabilitySupported ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-target-matches-intent',
      status: targetAddress === null
        ? 'warn'
        : sameAddress(input.execution.target, targetAddress)
          ? 'pass'
          : 'fail',
      code: targetAddress === null
        ? 'eip7702-target-not-required'
        : sameAddress(input.execution.target, targetAddress)
          ? 'eip7702-target-bound'
          : 'eip7702-target-mismatch',
      message: targetAddress === null
        ? 'Crypto authorization intent does not require an execution target.'
        : sameAddress(input.execution.target, targetAddress)
          ? 'Delegated EOA execution target matches the intent.'
          : 'Delegated EOA execution target does not match the intent.',
      evidence: {
        executionTarget: input.execution.target,
        intentTargetAddress: targetAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-function-selector-matches-intent',
      status: requiredSelector === null
        ? 'pass'
        : input.execution.functionSelector === requiredSelector
          ? 'pass'
          : 'fail',
      code: requiredSelector === null
        ? 'eip7702-function-selector-not-required'
        : input.execution.functionSelector === requiredSelector
          ? 'eip7702-function-selector-bound'
          : 'eip7702-function-selector-mismatch',
      message: requiredSelector === null
        ? 'Crypto authorization intent does not require a function selector.'
        : input.execution.functionSelector === requiredSelector
          ? 'Delegated EOA function selector matches the intent.'
          : 'Delegated EOA function selector does not match the intent.',
      evidence: {
        executionFunctionSelector: input.execution.functionSelector ?? null,
        intentFunctionSelector: requiredSelector,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-calldata-class-matches-intent',
      status: requiredCalldataClass === null
        ? 'pass'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'pass'
          : 'fail',
      code: requiredCalldataClass === null
        ? 'eip7702-calldata-class-not-required'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'eip7702-calldata-class-bound'
          : 'eip7702-calldata-class-mismatch',
      message: requiredCalldataClass === null
        ? 'Crypto authorization intent does not require a calldata class.'
        : input.execution.calldataClass === requiredCalldataClass
          ? 'Delegated EOA calldata class matches the intent.'
          : 'Delegated EOA calldata class does not match the intent.',
      evidence: {
        calldataClass: input.execution.calldataClass ?? null,
        intentCalldataClass: requiredCalldataClass,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-call-scope-signed',
      status: callScopeSigned(input.execution) ? 'pass' : 'fail',
      code: callScopeSigned(input.execution)
        ? 'eip7702-call-scope-signed'
        : 'eip7702-call-scope-not-signed',
      message: callScopeSigned(input.execution)
        ? 'Delegate execution binds target, calldata, value, gas, nonce, expiry, and runtime context.'
        : 'Delegate execution lacks signed target, calldata, value, gas, nonce, expiry, or runtime-context binding.',
      evidence: {
        targetCalldataSigned: input.execution.targetCalldataSigned,
        valueSigned: input.execution.valueSigned,
        gasLimitSigned: input.execution.gasLimitSigned,
        nonceSigned: input.execution.nonceSigned,
        expirySigned: input.execution.expirySigned,
        runtimeContextBound: input.execution.runtimeContextBound,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-initialization-posture',
      status: initializationReady(input.initialization) ? 'pass' : 'fail',
      code: !input.initialization.initializationRequired
        ? 'eip7702-initialization-not-required'
        : initializationReady(input.initialization)
          ? 'eip7702-initialization-front-run-protected'
          : 'eip7702-initialization-not-protected',
      message: !input.initialization.initializationRequired
        ? 'Delegated EOA execution does not require initialization.'
        : initializationReady(input.initialization)
          ? 'Initialization calldata is signed, ordered before validation, and front-run protected.'
          : 'Initialization calldata is missing, unsigned, unordered, or not front-run protected.',
      evidence: {
        initializationRequired: input.initialization.initializationRequired,
        initializationCalldataHash: input.initialization.initializationCalldataHash ?? null,
        initializationSignedByAuthority: input.initialization.initializationSignedByAuthority ?? null,
        initializationExecutedBeforeValidation:
          input.initialization.initializationExecutedBeforeValidation ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-erc4337-posture',
      status: erc4337Ready({
        accountState: input.accountState,
        execution: input.execution,
      }) ? 'pass' : 'fail',
      code: input.execution.executionPath !== 'erc-4337-user-operation'
        ? 'eip7702-erc4337-not-applicable'
        : erc4337Ready({ accountState: input.accountState, execution: input.execution })
          ? 'eip7702-erc4337-posture-ready'
          : 'eip7702-erc4337-posture-not-ready',
      message: input.execution.executionPath !== 'erc-4337-user-operation'
        ? 'Execution is not using ERC-4337 UserOperation submission.'
        : erc4337Ready({ accountState: input.accountState, execution: input.execution })
          ? 'ERC-4337 EIP-7702 marker, auth inclusion, EntryPoint, and gas posture are ready.'
          : 'ERC-4337 EIP-7702 marker, auth inclusion, EntryPoint, or gas posture is missing.',
      evidence: {
        userOperationHash: input.execution.userOperationHash ?? null,
        entryPoint: input.execution.entryPoint ?? null,
        initCodeMarker: input.execution.initCodeMarker ?? null,
        eip7702AuthIncluded: input.execution.eip7702AuthIncluded ?? null,
        preVerificationGasIncludesAuthorizationCost:
          input.execution.preVerificationGasIncludesAuthorizationCost ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-wallet-capability-posture',
      status: walletCapabilityReady(input.execution) ? 'pass' : 'fail',
      code: input.execution.executionPath !== 'wallet-call-api'
        ? 'eip7702-wallet-capability-not-applicable'
        : walletCapabilityReady(input.execution)
          ? 'eip7702-wallet-capability-ready'
          : 'eip7702-wallet-capability-missing',
      message: input.execution.executionPath !== 'wallet-call-api'
        ? 'Execution is not using wallet-call capability negotiation.'
        : walletCapabilityReady(input.execution)
          ? 'Wallet-call path requested, observed, and supports the EIP-7702 authorization capability.'
          : 'Wallet-call path did not prove support for the EIP-7702 authorization capability.',
      evidence: {
        walletCapabilityRequested: input.execution.walletCapabilityRequested ?? null,
        walletCapabilityObserved: input.execution.walletCapabilityObserved ?? null,
        walletCapabilitySupported: input.execution.walletCapabilitySupported ?? null,
        atomicRequired: input.execution.atomicRequired ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-pending-transaction-posture',
      status: input.accountState.pendingTransactionPolicyCompliant ? 'pass' : 'fail',
      code: input.accountState.pendingTransactionPolicyCompliant
        ? 'eip7702-pending-transaction-posture-ready'
        : 'eip7702-pending-transaction-risk',
      message: input.accountState.pendingTransactionPolicyCompliant
        ? 'Pending-transaction posture is compatible with delegated EOA execution.'
        : 'Pending-transaction posture violates delegated EOA propagation safeguards.',
      evidence: {
        pendingTransactionCount: input.accountState.pendingTransactionCount ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-sponsor-posture',
      status: sponsorReady(input.sponsor) ? 'pass' : 'fail',
      code: !input.sponsor.sponsored
        ? 'eip7702-sponsor-not-used'
        : sponsorReady(input.sponsor)
          ? 'eip7702-sponsor-posture-ready'
          : 'eip7702-sponsor-posture-not-ready',
      message: !input.sponsor.sponsored
        ? 'Delegated EOA execution is not sponsored by a relayer.'
        : sponsorReady(input.sponsor)
          ? 'Sponsored relayer posture binds sponsor address, bond, and reimbursement terms.'
          : 'Sponsored relayer posture lacks sponsor address, bond, or reimbursement binding.',
      evidence: {
        sponsored: input.sponsor.sponsored,
        sponsorAddress: input.sponsor.sponsorAddress ?? null,
        sponsorBondRequired: input.sponsor.sponsorBondRequired ?? null,
        sponsorBondPresent: input.sponsor.sponsorBondPresent ?? null,
        reimbursementBound: input.sponsor.reimbursementBound ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-release-binding-ready',
      status: releaseReady ? 'pass' : 'fail',
      code: releaseReady
        ? 'eip7702-release-binding-ready'
        : 'eip7702-release-binding-not-executable',
      message: releaseReady
        ? 'Release binding is executable for EIP-7702 delegated execution.'
        : 'Release binding must be accepted, not overridden, before delegated execution.',
      evidence: {
        bindingStatus: input.releaseBinding.status,
        releaseStatus: input.releaseBinding.releaseDecision.status,
        releaseDecisionId: input.releaseBinding.releaseDecisionId,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-policy-binding-ready',
      status: input.policyScopeBinding.activationRecord.state === 'active' ? 'pass' : 'fail',
      code: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'eip7702-policy-binding-active'
        : 'eip7702-policy-binding-not-active',
      message: input.policyScopeBinding.activationRecord.state === 'active'
        ? 'Policy-control-plane binding is active for EIP-7702 delegated execution.'
        : 'Policy-control-plane binding is not active.',
      evidence: {
        activationId: input.policyScopeBinding.activationId,
        activationState: input.policyScopeBinding.activationRecord.state,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-enforcement-binding-ready',
      status: enforcementReady ? 'pass' : 'fail',
      code: enforcementReady
        ? 'eip7702-enforcement-binding-ready'
        : 'eip7702-enforcement-binding-not-ready',
      message: enforcementReady
        ? 'Enforcement binding is fail-closed and action-dispatch scoped for EIP-7702.'
        : 'Enforcement binding is not EIP-7702 action-dispatch ready.',
      evidence: {
        adapterKind: input.enforcementBinding.adapterKind,
        boundaryKind: input.enforcementBinding.enforcementRequest.enforcementPoint.boundaryKind,
        profileId: input.enforcementBinding.verificationProfile.id,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-revocation-and-recovery',
      status: recoveryReady(input.recovery) ? 'pass' : 'fail',
      code: recoveryReady(input.recovery)
        ? 'eip7702-revocation-and-recovery-ready'
        : 'eip7702-revocation-and-recovery-missing',
      message: recoveryReady(input.recovery)
        ? 'Revocation, zero-address clearing, private-key continuity, and emergency reset posture are ready.'
        : 'Revocation, zero-address clearing, private-key continuity, or emergency reset posture is missing.',
      evidence: {
        revocationPathReady: input.recovery.revocationPathReady,
        zeroAddressClearSupported: input.recovery.zeroAddressClearSupported,
        privateKeyStillControlsAccountAcknowledged:
          input.recovery.privateKeyStillControlsAccountAcknowledged,
        emergencyDelegateResetPrepared: input.recovery.emergencyDelegateResetPrepared,
        recoveryAuthorityRef: input.recovery.recoveryAuthorityRef ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'eip7702-post-execution-status',
      status: postExecutionReady ? 'pass' : 'fail',
      code: postExecutionReady
        ? 'eip7702-post-execution-compatible'
        : 'eip7702-post-execution-failed',
      message: postExecutionReady
        ? 'No failed delegated-EOA post-execution status was observed.'
        : 'Delegated-EOA post-execution status failed and must block.',
      evidence: {
        postExecutionSuccess: input.execution.postExecutionSuccess ?? null,
      },
    }),
  );

  return Object.freeze(observations);
}
