import type { CryptoAuthorizationIntent } from './object-model.js';
import type { CryptoConsequenceRiskAssessment } from './consequence-risk-mapping.js';
import type {
  CryptoAllowanceAmountPosture,
  CryptoAllowanceDurationPosture,
  CryptoApprovalAllowanceMechanism,
  CryptoApprovalAllowanceObservation,
  CryptoApprovalAllowanceRevocationPosture,
} from './approval-allowance-consequence-types.js';
import {
  CRYPTO_APPROVAL_MAX_UINT256,
  ZERO_EVM_ADDRESS,
  caip2ChainId,
  decimalCompare,
  expectedSelectorFor,
  observation,
  requiresEvmRuntime,
  requiresPermitEvidence,
  sameAddress,
} from './approval-allowance-consequence-utils.js';

export function buildObservations(input: {
  readonly intent: CryptoAuthorizationIntent;
  readonly mechanism: CryptoApprovalAllowanceMechanism;
  readonly amountPosture: CryptoAllowanceAmountPosture;
  readonly durationPosture: CryptoAllowanceDurationPosture;
  readonly ownerAddress: string;
  readonly tokenAddress: string | null;
  readonly spenderAddress: string;
  readonly requestedAmount: string;
  readonly currentAllowance: string | null;
  readonly resultingAllowance: string;
  readonly allowanceExpiration: string | null;
  readonly permitDeadline: string | null;
  readonly permitNonce: string | null;
  readonly permitDomainChainId: string | null;
  readonly permitDomainVerifyingContract: string | null;
  readonly budgetId: string | null;
  readonly revocation: CryptoApprovalAllowanceRevocationPosture;
  readonly riskAssessment: CryptoConsequenceRiskAssessment;
}): readonly CryptoApprovalAllowanceObservation[] {
  const observations: CryptoApprovalAllowanceObservation[] = [];
  const intentKindOk =
    input.intent.consequenceKind === 'approval' ||
    input.intent.consequenceKind === 'permission-grant';
  const evmRuntimeOk =
    !requiresEvmRuntime(input.mechanism) ||
    input.intent.chain.namespace === 'eip155' ||
    input.intent.chain.runtimeFamily === 'evm';
  const asset = input.intent.asset;
  const expectedSelector = expectedSelectorFor(input.mechanism);
  const intentSelector = input.intent.target.functionSelector?.toLowerCase() ?? null;
  const maxAmount = input.intent.constraints.maxAmount;
  const tokenMatchesAsset =
    input.tokenAddress === null ||
    asset === null ||
    sameAddress(input.tokenAddress, asset.assetId);
  const targetAddress = input.intent.target.address;
  const targetBound =
    targetAddress === null ||
    sameAddress(targetAddress, input.tokenAddress) ||
    sameAddress(targetAddress, input.spenderAddress);
  const decreaseNeedsCurrent =
    input.mechanism === 'erc20-decrease-allowance' &&
    input.currentAllowance === null;
  const decreaseExceedsCurrent =
    input.mechanism === 'erc20-decrease-allowance' &&
    input.currentAllowance !== null &&
    decimalCompare(input.requestedAmount, input.currentAllowance) > 0;
  const requestedExceedsIntent =
    maxAmount !== null &&
    input.amountPosture !== 'decrease-only' &&
    input.amountPosture !== 'revoke' &&
    decimalCompare(input.requestedAmount, maxAmount) > 0;
  const resultingExceedsIntent =
    maxAmount !== null &&
    input.amountPosture !== 'decrease-only' &&
    input.amountPosture !== 'revoke' &&
    decimalCompare(input.resultingAllowance, maxAmount) > 0;
  const expiryBound =
    input.amountPosture === 'decrease-only' ||
    input.amountPosture === 'revoke' ||
    input.durationPosture === 'transaction-scoped' ||
    input.durationPosture === 'revoked' ||
    input.allowanceExpiration !== null;
  const budgetBound =
    input.amountPosture === 'decrease-only' ||
    input.amountPosture === 'revoke' ||
    input.budgetId !== null;
  const revocationBound =
    input.amountPosture === 'decrease-only' ||
    input.amountPosture === 'revoke' ||
    input.durationPosture === 'transaction-scoped' ||
    input.durationPosture === 'revoked' ||
    input.revocation.revocable;
  const permitDeadlineWithinIntent =
    input.permitDeadline === null ||
    Date.parse(input.permitDeadline) <= Date.parse(input.intent.constraints.validUntil);

  observations.push(
    observation({
      check: 'approval-intent-kind',
      status: intentKindOk ? 'pass' : 'fail',
      code: intentKindOk ? 'approval-intent-kind-bound' : 'approval-intent-kind-mismatch',
      message: intentKindOk
        ? 'Intent is an approval or permission-grant consequence.'
        : 'Approval allowance consequences require an approval or permission-grant intent.',
      evidence: {
        consequenceKind: input.intent.consequenceKind,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-chain-runtime',
      status: evmRuntimeOk ? 'pass' : 'fail',
      code: evmRuntimeOk ? 'approval-chain-runtime-compatible' : 'approval-chain-runtime-not-evm',
      message: evmRuntimeOk
        ? 'Approval mechanism is compatible with the intent chain runtime.'
        : 'ERC-20 and permit approval mechanisms require an EVM-compatible runtime.',
      evidence: {
        mechanism: input.mechanism,
        chainNamespace: input.intent.chain.namespace,
        runtimeFamily: input.intent.chain.runtimeFamily,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-token-bound',
      status:
        input.intent.consequenceKind === 'permission-grant' && input.tokenAddress === null
          ? 'pass'
          : asset === null || asset.assetKind === 'native-token' || !tokenMatchesAsset
            ? 'fail'
            : 'pass',
      code:
        input.intent.consequenceKind === 'permission-grant' && input.tokenAddress === null
          ? 'approval-token-not-required'
          : asset === null
            ? 'approval-token-asset-missing'
            : asset.assetKind === 'native-token'
              ? 'approval-token-native-asset-invalid'
              : tokenMatchesAsset
                ? 'approval-token-bound'
                : 'approval-token-asset-mismatch',
      message:
        input.intent.consequenceKind === 'permission-grant' && input.tokenAddress === null
          ? 'Wallet permission grant does not require a token address.'
          : asset === null
            ? 'Token approval requires an asset reference.'
            : asset.assetKind === 'native-token'
              ? 'Native token approvals are not ERC-20 allowance consequences.'
              : tokenMatchesAsset
                ? 'Token address is bound to the intent asset.'
                : 'Token address does not match the intent asset.',
      evidence: {
        tokenAddress: input.tokenAddress,
        assetId: asset?.assetId ?? null,
        assetKind: asset?.assetKind ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-owner-bound',
      status: sameAddress(input.ownerAddress, input.intent.account.address) ? 'pass' : 'fail',
      code: sameAddress(input.ownerAddress, input.intent.account.address)
        ? 'approval-owner-bound'
        : 'approval-owner-account-mismatch',
      message: sameAddress(input.ownerAddress, input.intent.account.address)
        ? 'Approval owner matches the intent account.'
        : 'Approval owner does not match the intent account.',
      evidence: {
        ownerAddress: input.ownerAddress,
        accountAddress: input.intent.account.address,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-spender-bound',
      status: input.spenderAddress === ZERO_EVM_ADDRESS ? 'fail' : 'pass',
      code: input.spenderAddress === ZERO_EVM_ADDRESS
        ? 'approval-spender-zero-address'
        : 'approval-spender-bound',
      message: input.spenderAddress === ZERO_EVM_ADDRESS
        ? 'Approval spender cannot be the EVM zero address.'
        : 'Approval spender is explicit and non-zero.',
      evidence: {
        spenderAddress: input.spenderAddress,
        targetCounterparty: input.intent.target.counterparty ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-target-bound',
      status: targetBound ? 'pass' : 'fail',
      code: targetBound ? 'approval-target-bound' : 'approval-target-mismatch',
      message: targetBound
        ? 'Intent target binds either the token contract or spender surface for the approval.'
        : 'Intent target must bind the token contract or spender surface for the approval.',
      evidence: {
        intentTargetAddress: targetAddress ?? null,
        tokenAddress: input.tokenAddress,
        spenderAddress: input.spenderAddress,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-function-selector-bound',
      status:
        expectedSelector === null || intentSelector === null || intentSelector === expectedSelector
          ? 'pass'
          : 'fail',
      code:
        expectedSelector === null
          ? 'approval-function-selector-adapter-specific'
          : intentSelector === null
            ? 'approval-function-selector-not-required'
            : intentSelector === expectedSelector
              ? 'approval-function-selector-bound'
              : 'approval-function-selector-mismatch',
      message:
        expectedSelector === null
          ? 'Approval mechanism has adapter-specific selector semantics outside the core.'
          : intentSelector === null
            ? 'Intent does not require a function selector match for this approval.'
            : intentSelector === expectedSelector
              ? 'Intent function selector matches the approval mechanism.'
              : 'Intent function selector does not match the approval mechanism.',
      evidence: {
        mechanism: input.mechanism,
        intentFunctionSelector: intentSelector,
        expectedFunctionSelector: expectedSelector,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-amount-posture',
      status:
        input.amountPosture === 'unlimited' && maxAmount !== CRYPTO_APPROVAL_MAX_UINT256
          ? 'warn'
          : 'pass',
      code:
        input.amountPosture === 'unlimited' && maxAmount !== CRYPTO_APPROVAL_MAX_UINT256
          ? 'approval-unlimited-requires-explicit-policy'
          : 'approval-amount-posture-bound',
      message:
        input.amountPosture === 'unlimited' && maxAmount !== CRYPTO_APPROVAL_MAX_UINT256
          ? 'Unlimited allowance requires explicit max-uint policy scope.'
          : 'Approval amount posture is explicitly classified.',
      evidence: {
        amountPosture: input.amountPosture,
        requestedAmount: input.requestedAmount,
        maxAmount: maxAmount ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-amount-within-intent',
      status: requestedExceedsIntent ? 'fail' : 'pass',
      code: requestedExceedsIntent
        ? 'approval-requested-amount-exceeds-intent'
        : 'approval-requested-amount-within-intent',
      message: requestedExceedsIntent
        ? 'Requested approval amount exceeds the intent maxAmount.'
        : 'Requested approval amount is within the intent maxAmount or does not increase allowance.',
      evidence: {
        requestedAmount: input.requestedAmount,
        maxAmount: maxAmount ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-resulting-allowance-within-intent',
      status: decreaseNeedsCurrent || decreaseExceedsCurrent || resultingExceedsIntent
        ? 'fail'
        : 'pass',
      code: decreaseNeedsCurrent
        ? 'approval-decrease-current-allowance-missing'
        : decreaseExceedsCurrent
          ? 'approval-decrease-exceeds-current-allowance'
          : resultingExceedsIntent
            ? 'approval-resulting-allowance-exceeds-intent'
            : 'approval-resulting-allowance-within-intent',
      message: decreaseNeedsCurrent
        ? 'Decrease allowance requires current allowance evidence.'
        : decreaseExceedsCurrent
          ? 'Decrease allowance amount exceeds current allowance evidence.'
          : resultingExceedsIntent
            ? 'Resulting allowance exceeds the intent maxAmount.'
            : 'Resulting allowance remains inside the intent maxAmount or reduces allowance.',
      evidence: {
        currentAllowance: input.currentAllowance,
        requestedAmount: input.requestedAmount,
        resultingAllowance: input.resultingAllowance,
        maxAmount: maxAmount ?? null,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-expiry-bound',
      status: expiryBound ? 'pass' : 'warn',
      code: expiryBound ? 'approval-expiry-bound' : 'approval-expiry-missing',
      message: expiryBound
        ? 'Approval is time-bound, transaction-scoped, or revokes allowance.'
        : 'Persistent approval is missing an allowance expiration.',
      evidence: {
        durationPosture: input.durationPosture,
        allowanceExpiration: input.allowanceExpiration,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-budget-bound',
      status: budgetBound ? 'pass' : 'warn',
      code: budgetBound ? 'approval-budget-bound' : 'approval-budget-missing',
      message: budgetBound
        ? 'Approval is tied to a budget or does not increase spending authority.'
        : 'Approval is missing a budget binding.',
      evidence: {
        budgetId: input.budgetId,
        amountPosture: input.amountPosture,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-revocation-bound',
      status: revocationBound ? 'pass' : 'warn',
      code: revocationBound ? 'approval-revocation-bound' : 'approval-revocation-missing',
      message: revocationBound
        ? 'Approval has a revocation path or is transaction-scoped/revoked.'
        : 'Approval is missing an explicit revocation path.',
      evidence: {
        revocable: input.revocation.revocable,
        method: input.revocation.method ?? null,
        authorityRef: input.revocation.authorityRef ?? null,
      },
    }),
  );

  const permitRequired = requiresPermitEvidence(input.mechanism);
  observations.push(
    observation({
      check: 'approval-permit-evidence-bound',
      status: !permitRequired
        ? 'pass'
        : input.permitDeadline !== null &&
            input.permitNonce !== null &&
            input.permitDomainChainId === caip2ChainId(input.intent) &&
            (input.permitDomainVerifyingContract === null ||
              input.mechanism === 'permit2-allowance' ||
              input.mechanism === 'permit2-signature-transfer' ||
              sameAddress(
                input.permitDomainVerifyingContract,
                input.tokenAddress ?? input.intent.target.address,
              )) &&
            permitDeadlineWithinIntent
          ? 'pass'
          : 'fail',
      code: !permitRequired
        ? 'approval-permit-evidence-not-required'
        : input.permitDeadline === null
          ? 'approval-permit-deadline-missing'
          : input.permitNonce === null
            ? 'approval-permit-nonce-missing'
            : input.permitDomainChainId !== caip2ChainId(input.intent)
              ? 'approval-permit-domain-chain-mismatch'
              : !permitDeadlineWithinIntent
                ? 'approval-permit-deadline-exceeds-intent'
                : 'approval-permit-evidence-bound',
      message: !permitRequired
        ? 'Approval mechanism does not require permit signature evidence.'
        : 'Permit signature evidence must bind nonce, deadline, chain domain, and verifying contract posture.',
      evidence: {
        mechanism: input.mechanism,
        permitDeadline: input.permitDeadline,
        permitNonce: input.permitNonce,
        permitDomainChainId: input.permitDomainChainId,
        permitDomainVerifyingContract: input.permitDomainVerifyingContract,
        intentChainId: caip2ChainId(input.intent),
      },
    }),
  );

  const temporaryExpected =
    input.mechanism === 'permit2-signature-transfer' ||
    input.mechanism === 'erc-7674-temporary-approve';
  observations.push(
    observation({
      check: 'approval-temporary-scope-bound',
      status:
        !temporaryExpected || input.durationPosture === 'transaction-scoped'
          ? 'pass'
          : 'fail',
      code:
        !temporaryExpected
          ? 'approval-temporary-scope-not-required'
          : input.durationPosture === 'transaction-scoped'
            ? 'approval-temporary-scope-bound'
            : 'approval-temporary-scope-mismatch',
      message:
        !temporaryExpected
          ? 'Approval mechanism is not expected to be transaction-scoped.'
          : input.durationPosture === 'transaction-scoped'
            ? 'Temporary approval is transaction-scoped.'
            : 'Temporary approval mechanism must be transaction-scoped.',
      evidence: {
        mechanism: input.mechanism,
        durationPosture: input.durationPosture,
      },
    }),
  );

  observations.push(
    observation({
      check: 'approval-risk-assessment-bound',
      status:
        input.riskAssessment.consequenceKind === input.intent.consequenceKind &&
        input.riskAssessment.riskClass === 'R4'
          ? 'pass'
          : 'fail',
      code:
        input.riskAssessment.consequenceKind === input.intent.consequenceKind &&
        input.riskAssessment.riskClass === 'R4'
          ? 'approval-risk-assessment-bound'
          : 'approval-risk-assessment-not-high-assurance',
      message:
        input.riskAssessment.consequenceKind === input.intent.consequenceKind &&
        input.riskAssessment.riskClass === 'R4'
          ? 'Approval allowance consequence is bound to high-assurance risk assessment.'
          : 'Approval allowance consequence must remain high-assurance and intent-consistent.',
      evidence: {
        riskClass: input.riskAssessment.riskClass,
        consequenceKind: input.riskAssessment.consequenceKind,
        requiredPolicyDimensions: input.riskAssessment.review.requiredPolicyDimensions,
      },
    }),
  );

  return Object.freeze(observations);
}
