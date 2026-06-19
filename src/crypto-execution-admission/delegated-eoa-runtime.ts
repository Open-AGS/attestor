import type {
  Eip7702ExecutionEvidence,
  Eip7702ExecutionPath,
} from '../crypto-authorization-core/eip7702-delegation-adapter.js';
import type {
  DelegatedEoaAdmissionOutcome,
  DelegatedEoaRuntimeCheck,
  DelegatedEoaWalletCapabilityStatus,
} from './delegated-eoa-types.js';

export function walletCapabilityStatus(
  execution: Eip7702ExecutionEvidence,
): DelegatedEoaWalletCapabilityStatus | null {
  if (
    execution.executionPath !== 'wallet-call-api' &&
    execution.walletCapabilityObserved === null &&
    execution.walletCapabilitySupported === null &&
    execution.walletCapabilityRequested === null &&
    execution.atomicRequired === null
  ) {
    return null;
  }
  return Object.freeze({
    required: execution.executionPath === 'wallet-call-api',
    observed: execution.walletCapabilityObserved ?? null,
    supported: execution.walletCapabilitySupported ?? null,
    requested: execution.walletCapabilityRequested ?? null,
    atomicRequired: execution.atomicRequired ?? null,
  });
}

export function runtimeChecksFor(
  executionPath: Eip7702ExecutionPath,
): readonly DelegatedEoaRuntimeCheck[] {
  const checks: DelegatedEoaRuntimeCheck[] = [
    {
      standard: 'EIP-7702',
      check: 'authorizationTuple',
      reason: 'Authorization tuple must match the admitted authority, delegate, and nonce.',
    },
    {
      standard: 'EIP-7702',
      check: 'authorityNonce',
      reason: 'Authority nonce and pending-transaction posture must still match the admitted tuple.',
    },
    {
      standard: 'Attestor',
      check: 'delegateCodePosture',
      reason: 'Delegate code must stay audited, allowlisted, and scope-binding safe.',
    },
    {
      standard: 'EIP-7702',
      check: 'runtimeContextBinding',
      reason: 'Target, calldata class, value, gas, and nonce must stay bound to the admitted context.',
    },
  ];
  if (executionPath === 'set-code-transaction') {
    checks.push({
      standard: 'EIP-7702',
      check: 'setCodeTransactionType',
      reason: 'Direct delegated EOA execution must use type 0x04 with a non-empty authorization list.',
    });
  }
  if (executionPath === 'wallet-call-api') {
    checks.push({
      standard: 'EIP-5792',
      check: 'walletSendCalls',
      reason: 'Wallet runtime must project the admitted delegated EOA call through wallet_sendCalls.',
    });
    checks.push({
      standard: 'ERC-7902',
      check: 'eip7702Auth',
      reason: 'Wallet must support the eip7702Auth capability for the admitted authority/delegate pair.',
    });
  }
  if (executionPath === 'erc-4337-user-operation') {
    checks.push({
      standard: 'ERC-4337',
      check: 'eip7702Auth',
      reason: 'UserOperation path must carry the EIP-7702 authorization tuple when delegation is being changed.',
    });
    checks.push({
      standard: 'ERC-7769',
      check: 'preVerificationGasIncludesAuthorizationCost',
      reason: 'Bundler-facing gas evidence must account for EIP-7702 authorization overhead.',
    });
  }
  return Object.freeze(checks);
}

export function nextActionsFor(outcome: DelegatedEoaAdmissionOutcome): readonly string[] {
  switch (outcome) {
    case 'ready':
      return Object.freeze([
        'Proceed through the admitted EIP-7702 delegated EOA path.',
        'Record the post-execution nonce, code-state, and delegation observation against this Attestor handoff.',
      ]);
    case 'needs-runtime-evidence':
      return Object.freeze([
        'Collect the missing authorization tuple, nonce, wallet capability, initialization, sponsorship, or recovery evidence.',
        'Refresh the delegated EOA admission handoff before execution is submitted.',
      ]);
    case 'blocked':
      return Object.freeze([
        'Do not submit this delegated EOA execution path.',
        'Resolve the blocked tuple, nonce, delegate-code, runtime-path, wallet-capability, or recovery reason and create a new handoff.',
      ]);
  }
}
