import {
  DELEGATED_EOA_ADMISSION_EXPECTATION_KINDS,
  DELEGATED_EOA_ADMISSION_EXPECTATION_STATUSES,
  DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION,
  DELEGATED_EOA_ADMISSION_OUTCOMES,
  type DelegatedEoaAdmissionDescriptor,
} from './delegated-eoa-types.js';

export function delegatedEoaAdmissionDescriptor(): DelegatedEoaAdmissionDescriptor {
  return Object.freeze({
    version: DELEGATED_EOA_ADMISSION_HANDOFF_SPEC_VERSION,
    outcomes: DELEGATED_EOA_ADMISSION_OUTCOMES,
    expectationKinds: DELEGATED_EOA_ADMISSION_EXPECTATION_KINDS,
    expectationStatuses: DELEGATED_EOA_ADMISSION_EXPECTATION_STATUSES,
    standards: Object.freeze([
      'EIP-7702',
      'EIP-5792',
      'ERC-7902',
      'ERC-4337',
      'ERC-7769',
      'Attestor release layer',
      'Attestor policy control plane',
      'Attestor enforcement plane',
    ]),
    runtimeChecks: Object.freeze([
      'authorizationTuple',
      'authorityNonce',
      'delegateCodePosture',
      'runtimeContextBinding',
      'setCodeTransactionType',
      'walletSendCalls',
      'eip7702Auth',
      'preVerificationGasIncludesAuthorizationCost',
    ]),
  });
}
