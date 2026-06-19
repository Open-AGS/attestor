import {
  CUSTODY_POLICY_ADMISSION_CALLBACK_ACTIONS,
  CUSTODY_POLICY_ADMISSION_CALLBACK_OUTCOMES,
  CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
  CUSTODY_POLICY_ADMISSION_EXPECTATION_KINDS,
  CUSTODY_POLICY_ADMISSION_EXPECTATION_STATUSES,
  CUSTODY_POLICY_CALLBACK_INTEGRATION_MODES,
  CUSTODY_POLICY_CALLBACK_PROTOCOLS,
  type CustodyPolicyAdmissionCallbackDescriptor,
} from './custody-policy-callback-types.js';

export function custodyPolicyAdmissionCallbackDescriptor():
CustodyPolicyAdmissionCallbackDescriptor {
  return Object.freeze({
    version: CUSTODY_POLICY_ADMISSION_CALLBACK_SPEC_VERSION,
    outcomes: CUSTODY_POLICY_ADMISSION_CALLBACK_OUTCOMES,
    actions: CUSTODY_POLICY_ADMISSION_CALLBACK_ACTIONS,
    integrationModes: CUSTODY_POLICY_CALLBACK_INTEGRATION_MODES,
    protocols: CUSTODY_POLICY_CALLBACK_PROTOCOLS,
    expectationKinds: CUSTODY_POLICY_ADMISSION_EXPECTATION_KINDS,
    expectationStatuses: CUSTODY_POLICY_ADMISSION_EXPECTATION_STATUSES,
    runtimeChecks: Object.freeze([
      'planSurface',
      'adapterPreflight',
      'providerBinding',
      'transactionBinding',
      'policyDecision',
      'approvalQuorum',
      'callbackAuthentication',
      'callbackFreshness',
      'attestorTokenBinding',
      'screening',
      'velocityLimit',
      'keyPosture',
      'callbackResponse',
    ]),
    standards: Object.freeze([
      'Fireblocks API co-signer callback',
      'Turnkey policy engine',
      'MPC custody signing',
      'Attestor release layer',
      'Attestor policy control plane',
      'Attestor enforcement plane',
    ]),
  });
}
