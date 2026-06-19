import type {
  GeneralCryptoAllowancePosture,
  GeneralCryptoCounterpartyTrust,
  GeneralCryptoDelegationPosture,
  GeneralCryptoPermitDomainStatus,
  GeneralCryptoRouteStatus,
  GeneralCryptoSafeStatus,
  GeneralCryptoSessionKeyScope,
  GeneralCryptoSimulationStatus,
  GeneralCryptoTransactionAction,
  GeneralCryptoTransactionGateCheck,
  GeneralCryptoUserOperationStatus,
  GeneralCryptoX402Status,
} from './general-crypto-transaction-gate-types.js';
import {
  check,
  digestPresenceCheck,
  standardsFor,
} from './general-crypto-transaction-gate-utils.js';

export function simulationCheck(
  status: GeneralCryptoSimulationStatus,
  simulationDigest: string | null,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action === 'x402.pay' && status === 'not-required') {
    return check(
      'simulation-binding',
      'pass',
      'simulation-not-required-for-x402',
      'x402 payment admission is bound through verify and settle evidence instead of transaction simulation.',
      ['x402 verify result', 'x402 settle result'],
      standards,
    );
  }
  if (status === 'passed' && simulationDigest !== null) {
    return check(
      'simulation-binding',
      'pass',
      'simulation-bound',
      'Simulation digest is present and marked passed.',
      ['simulation digest'],
      standards,
    );
  }
  if (status === 'failed') {
    return check(
      'simulation-binding',
      'fail',
      'simulation-failed',
      'Simulation failed for the proposed crypto action.',
      ['passing simulation digest'],
      standards,
    );
  }
  return check(
    'simulation-binding',
    'review',
    'simulation-missing',
    'Simulation evidence is missing or incomplete.',
    ['simulation digest'],
    standards,
  );
}

export function allowanceCheck(
  posture: GeneralCryptoAllowancePosture,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'erc20.approve' && action !== 'permit.sign') {
    return check(
      'allowance-boundary',
      'pass',
      'allowance-not-applicable',
      'Allowance boundary is not applicable to this action.',
      [],
      standards,
    );
  }
  if (posture === 'unlimited') {
    return check(
      'allowance-boundary',
      'fail',
      'unlimited-approval',
      'Unlimited allowance is not admitted by the general gate.',
      ['bounded allowance ref'],
      standards,
    );
  }
  if (posture === 'unknown' || posture === 'not-applicable') {
    return check(
      'allowance-boundary',
      'review',
      'allowance-posture-missing',
      'Allowance posture is missing or not classified.',
      ['allowance posture ref'],
      standards,
    );
  }
  return check(
    'allowance-boundary',
    'pass',
    'allowance-bounded',
    'Allowance is classified as bounded, increased, or temporary.',
    ['bounded allowance ref'],
    standards,
  );
}

export function counterpartyTrustCheck(
  trust: GeneralCryptoCounterpartyTrust,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (
    action !== 'erc20.approve' &&
    action !== 'permit.sign' &&
    action !== 'session_key.grant' &&
    action !== 'delegation.authorize'
  ) {
    return check(
      'counterparty-trust',
      'pass',
      'counterparty-trust-not-applicable',
      'Counterparty trust classification is not applicable to this action.',
      [],
      standards,
    );
  }
  if (trust === 'known') {
    return check(
      'counterparty-trust',
      'pass',
      'counterparty-known',
      'Counterparty is classified as known for this action.',
      ['trusted counterparty ref'],
      standards,
    );
  }
  return check(
    'counterparty-trust',
    'fail',
    trust === 'denied' ? 'spender-denied' : 'spender-unknown',
    trust === 'denied'
      ? 'The spender/counterparty is explicitly denied.'
      : 'The spender/counterparty trust status is unknown.',
    ['trusted counterparty ref'],
    standards,
  );
}

export function permitDomainCheck(
  status: GeneralCryptoPermitDomainStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'permit.sign') {
    return check(
      'permit-domain',
      'pass',
      'permit-domain-not-applicable',
      'Permit domain binding is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'matched') {
    return check(
      'permit-domain',
      'pass',
      'permit-domain-matched',
      'Permit typed-data domain is bound to the expected chain and verifying contract.',
      ['typed data digest', 'domain separator evidence'],
      standards,
    );
  }
  return check(
    'permit-domain',
    status === 'mismatch' ? 'fail' : 'review',
    status === 'mismatch' ? 'permit-domain-mismatch' : 'permit-domain-missing',
    status === 'mismatch'
      ? 'Permit typed-data domain does not match the expected chain or verifying contract.'
      : 'Permit typed-data domain evidence is missing.',
    ['typed data digest', 'domain separator evidence'],
    standards,
  );
}

export function routeCheck(
  status: GeneralCryptoRouteStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'swap.execute' && action !== 'bridge.transfer') {
    return check(
      'route-and-slippage',
      'pass',
      'route-not-applicable',
      'Route and slippage binding is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'route-and-simulation-bound') {
    return check(
      'route-and-slippage',
      'pass',
      'route-and-simulation-bound',
      'Route, slippage, destination, and simulation evidence are bound.',
      ['route ref', 'simulation digest', 'slippage or destination risk ref'],
      standards,
    );
  }
  return check(
    'route-and-slippage',
    'review',
    status,
    'Route, slippage, destination, or simulation evidence is incomplete.',
    ['route ref', 'simulation digest', 'slippage or destination risk ref'],
    standards,
  );
}

export function safeCheck(
  status: GeneralCryptoSafeStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'safe.tx.propose') {
    return check(
      'safe-transaction',
      'pass',
      'safe-not-applicable',
      'Safe transaction evidence is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'quorum-met') {
    return check(
      'safe-transaction',
      'pass',
      'safe-quorum-met',
      'Safe transaction hash and quorum evidence are bound.',
      ['safe transaction hash', 'quorum or guard evidence'],
      standards,
    );
  }
  return check(
    'safe-transaction',
    status === 'safe-tx-hash-missing' ? 'fail' : 'review',
    status,
    'Safe transaction hash, quorum, or guard evidence is incomplete.',
    ['safe transaction hash', 'quorum or guard evidence'],
    standards,
  );
}

export function userOperationCheck(
  status: GeneralCryptoUserOperationStatus,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'userop.submit') {
    return check(
      'user-operation',
      'pass',
      'userop-not-applicable',
      'UserOperation evidence is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'validated') {
    return check(
      'user-operation',
      'pass',
      'userop-validated',
      'UserOperation hash, EntryPoint, and validation simulation are bound.',
      ['user operation hash', 'entrypoint ref', 'simulateValidation result'],
      standards,
    );
  }
  return check(
    'user-operation',
    status === 'validation-failed' ? 'fail' : 'review',
    status,
    'UserOperation EntryPoint, hash, or validation evidence is incomplete.',
    ['user operation hash', 'entrypoint ref', 'simulateValidation result'],
    standards,
  );
}

export function sessionKeyCheck(
  scope: GeneralCryptoSessionKeyScope,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'session_key.grant') {
    return check(
      'session-key-scope',
      'pass',
      'session-key-not-applicable',
      'Session-key scope is not applicable to this action.',
      [],
      standards,
    );
  }
  if (scope === 'bounded') {
    return check(
      'session-key-scope',
      'pass',
      'session-key-bounded',
      'Session-key permission scope is bounded.',
      ['bounded session scope'],
      standards,
    );
  }
  return check(
    'session-key-scope',
    scope === 'overbroad' ? 'fail' : 'review',
    scope === 'overbroad' ? 'session-key-overbroad' : 'session-key-scope-missing',
    'Session-key permission scope is missing, unknown, or overbroad.',
    ['bounded session scope'],
    standards,
  );
}

export function delegationCheck(
  posture: GeneralCryptoDelegationPosture,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'delegation.authorize') {
    return check(
      'delegation-scope',
      'pass',
      'delegation-not-applicable',
      'Delegation scope is not applicable to this action.',
      [],
      standards,
    );
  }
  if (posture === 'bounded') {
    return check(
      'delegation-scope',
      'pass',
      'delegation-bounded',
      'Delegation authorization scope is bounded.',
      ['bounded delegation scope'],
      standards,
    );
  }
  return check(
    'delegation-scope',
    posture === 'overbroad' ? 'fail' : 'review',
    posture === 'overbroad' ? 'delegation-overbroad' : 'delegation-scope-missing',
    'Delegation authorization scope is missing, unknown, or overbroad.',
    ['bounded delegation scope'],
    standards,
  );
}

export function x402Check(
  status: GeneralCryptoX402Status,
  action: GeneralCryptoTransactionAction,
): GeneralCryptoTransactionGateCheck {
  const standards = standardsFor(action);
  if (action !== 'x402.pay') {
    return check(
      'x402-payment',
      'pass',
      'x402-not-applicable',
      'x402 payment verification is not applicable to this action.',
      [],
      standards,
    );
  }
  if (status === 'verified-and-settled') {
    return check(
      'x402-payment',
      'pass',
      'x402-verified-and-settled',
      'x402 verify and settle evidence are bound.',
      ['payment-required challenge', 'facilitator verify result', 'facilitator settle result'],
      standards,
    );
  }
  return check(
    'x402-payment',
    status === 'verify-failed' || status === 'settle-failed' ? 'fail' : 'review',
    status,
    'x402 challenge, verify, settle, or response evidence is incomplete.',
    ['payment-required challenge', 'facilitator verify result', 'facilitator settle result'],
    standards,
  );
}

export function requiredDigestChecks(
  input: {
    readonly action: GeneralCryptoTransactionAction;
    readonly assetRefDigest: string | null;
    readonly targetContractRefDigest: string | null;
    readonly counterpartyRefDigest: string | null;
    readonly amountRefDigest: string | null;
    readonly callDataDigest: string | null;
    readonly typedDataDigest: string | null;
    readonly routeRefDigest: string | null;
  },
): readonly GeneralCryptoTransactionGateCheck[] {
  const standards = standardsFor(input.action);
  const checks: GeneralCryptoTransactionGateCheck[] = [];
  if (
    input.action === 'native.transfer' ||
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve' ||
    input.action === 'permit.sign' ||
    input.action === 'swap.execute' ||
    input.action === 'bridge.transfer'
  ) {
    checks.push(digestPresenceCheck('asset-binding', input.assetRefDigest, 'asset-ref', 'asset ref', standards));
  }
  if (
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve'
  ) {
    checks.push(
      digestPresenceCheck(
        'contract-binding',
        input.targetContractRefDigest,
        'target-contract-ref',
        'target contract ref',
        standards,
      ),
    );
  }
  if (
    input.action !== 'x402.pay' &&
    input.action !== 'userop.submit' &&
    input.action !== 'safe.tx.propose'
  ) {
    checks.push(
      digestPresenceCheck(
        'counterparty-binding',
        input.counterpartyRefDigest,
        'counterparty-ref',
        'counterparty ref',
        standards,
      ),
    );
  }
  if (
    input.action === 'native.transfer' ||
    input.action === 'erc20.transfer' ||
    input.action === 'erc20.approve' ||
    input.action === 'permit.sign' ||
    input.action === 'swap.execute' ||
    input.action === 'bridge.transfer'
  ) {
    checks.push(digestPresenceCheck('amount-binding', input.amountRefDigest, 'amount-ref', 'amount ref', standards));
  }
  if (input.action === 'safe.tx.propose') {
    checks.push(
      digestPresenceCheck('calldata-binding', input.callDataDigest, 'calldata-ref', 'call data digest', standards),
    );
  }
  if (
    input.action === 'permit.sign' ||
    input.action === 'session_key.grant' ||
    input.action === 'delegation.authorize'
  ) {
    checks.push(
      digestPresenceCheck('typed-data-binding', input.typedDataDigest, 'typed-data-ref', 'typed data digest', standards),
    );
  }
  if (input.action === 'swap.execute' || input.action === 'bridge.transfer') {
    checks.push(digestPresenceCheck('route-binding', input.routeRefDigest, 'route-ref', 'route ref', standards));
  }
  return Object.freeze(checks);
}
