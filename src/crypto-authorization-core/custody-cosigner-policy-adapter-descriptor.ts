import {
  CUSTODY_COSIGNER_AUTH_METHODS,
  CUSTODY_COSIGNER_CHECKS,
  CUSTODY_COSIGNER_OUTCOMES,
  CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
  CUSTODY_COSIGNER_RESPONSE_ACTIONS,
  CUSTODY_KEY_TYPES,
  CUSTODY_POLICY_DECISION_STATUSES,
  CUSTODY_POLICY_EFFECTS,
  CUSTODY_POLICY_PROVIDERS,
  CUSTODY_POST_EXECUTION_STATUSES,
  type CustodyCosignerPolicyAdapterDescriptor,
} from './custody-cosigner-policy-adapter-types.js';

export function custodyCosignerPolicyAdapterDescriptor():
CustodyCosignerPolicyAdapterDescriptor {
  return Object.freeze({
    version: CUSTODY_COSIGNER_POLICY_ADAPTER_SPEC_VERSION,
    adapterKind: 'custody-cosigner',
    providers: CUSTODY_POLICY_PROVIDERS,
    policyEffects: CUSTODY_POLICY_EFFECTS,
    decisionStatuses: CUSTODY_POLICY_DECISION_STATUSES,
    authMethods: CUSTODY_COSIGNER_AUTH_METHODS,
    responseActions: CUSTODY_COSIGNER_RESPONSE_ACTIONS,
    keyTypes: CUSTODY_KEY_TYPES,
    postExecutionStatuses: CUSTODY_POST_EXECUTION_STATUSES,
    outcomes: CUSTODY_COSIGNER_OUTCOMES,
    checks: CUSTODY_COSIGNER_CHECKS,
    references: Object.freeze([
      'Fireblocks transaction authorization policy',
      'Fireblocks API co-signer callback',
      'Fireblocks co-signer approval quorum',
      'Turnkey policy engine',
      'Turnkey activity approval quorum',
      'MPC custody signing',
      'attestor-release-token',
      'release-enforcement-plane action-dispatch',
    ]),
  });
}
