import type {
  CustodyCosignerCallbackEvidence,
  CustodyCosignerPolicyPreflight,
} from '../crypto-authorization-core/custody-cosigner-policy-adapter.js';
import type { CryptoExecutionAdmissionPlan } from './index.js';
import {
  CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
  type CustodyPolicyAdmissionCallbackAction,
  type CustodyPolicyAdmissionCallbackOutcome,
  type CustodyPolicyAdmissionExpectation,
} from './custody-policy-callback-types.js';
import {
  canonicalObject,
} from './custody-policy-callback-utils.js';

export function blockingReasonsFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly expectations: readonly CustodyPolicyAdmissionExpectation[];
}): readonly string[] {
  const reasons: string[] = [];
  if (input.plan.outcome === 'deny') reasons.push('admission-plan-denied');
  if (input.preflight.outcome === 'block') reasons.push('custody-preflight-blocked');
  input.expectations
    .filter((entry) => entry.status === 'failed' || entry.status === 'unsupported')
    .forEach((entry) => reasons.push(entry.reasonCode));
  return Object.freeze([...new Set(reasons)]);
}

export function outcomeFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly expectations: readonly CustodyPolicyAdmissionExpectation[];
  readonly blockingReasons: readonly string[];
}): CustodyPolicyAdmissionCallbackOutcome {
  if (input.blockingReasons.length > 0) return 'deny';
  if (input.plan.outcome !== 'admit' || input.preflight.outcome !== 'allow') {
    return 'needs-review';
  }
  if (
    input.expectations.some(
      (entry) => entry.status === 'missing' || entry.status === 'pending',
    )
  ) {
    return 'needs-review';
  }
  return 'allow';
}

export function actionFor(
  outcome: CustodyPolicyAdmissionCallbackOutcome,
): CustodyPolicyAdmissionCallbackAction {
  switch (outcome) {
    case 'allow':
      return 'approve-request';
    case 'needs-review':
      return 'queue-review';
    case 'deny':
      return 'reject-request';
  }
}

export function normalizedCallbackActionFor(
  action: CustodyPolicyAdmissionCallbackAction,
): 'approve' | 'pending-review' | 'reject' {
  switch (action) {
    case 'approve-request':
      return 'approve';
    case 'queue-review':
      return 'pending-review';
    case 'reject-request':
      return 'reject';
  }
}

export function nextActionsFor(input: {
  readonly outcome: CustodyPolicyAdmissionCallbackOutcome;
  readonly action: CustodyPolicyAdmissionCallbackAction;
}): readonly string[] {
  if (input.outcome === 'allow') {
    return Object.freeze([
      'Return the provider approval response only for this Attestor-bound custody request.',
      'Record the provider activity id, signature hash, or transaction hash against this callback contract after signing or broadcast.',
    ]);
  }
  if (input.outcome === 'needs-review') {
    return Object.freeze([
      'Do not approve the custody signing path yet.',
      'Queue reviewer, quorum, policy, callback freshness, or provider evidence and mint a fresh callback contract before approval.',
    ]);
  }
  return Object.freeze([
    'Reject or fail closed for this custody request.',
    'Do not sign, broadcast, or retry automatically until a new Attestor admission contract is created.',
  ]);
}

export function contractIdFor(input: {
  readonly plan: CryptoExecutionAdmissionPlan;
  readonly preflight: CustodyCosignerPolicyPreflight;
  readonly callback: CustodyCosignerCallbackEvidence;
  readonly createdAt: string;
}): string {
  return canonicalObject({
    version: CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    preflightId: input.preflight.preflightId,
    preflightDigest: input.preflight.digest,
    callbackId: input.callback.callbackId,
    nonce: input.callback.nonce,
    createdAt: input.createdAt,
  }).digest;
}
