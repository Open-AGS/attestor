import {
  CRYPTO_RELEASE_ARTIFACT_PATHS,
  CRYPTO_RELEASE_BINDING_CHECKS,
  CRYPTO_RELEASE_BINDING_STATUSES,
  CRYPTO_RELEASE_DECISION_BINDING_SPEC_VERSION,
  type CryptoReleaseDecisionBindingDescriptor,
} from './release-decision-binding-types.js';

export function cryptoReleaseDecisionBindingDescriptor():
CryptoReleaseDecisionBindingDescriptor {
  return Object.freeze({
    version: CRYPTO_RELEASE_DECISION_BINDING_SPEC_VERSION,
    artifactPaths: CRYPTO_RELEASE_ARTIFACT_PATHS,
    statuses: CRYPTO_RELEASE_BINDING_STATUSES,
    bindingChecks: CRYPTO_RELEASE_BINDING_CHECKS,
    standards: Object.freeze([
      'EIP-712',
      'ERC-1271-aware',
      'ERC-4337-ready',
      'ERC-7715-ready',
      'EIP-7702-ready',
      'DSSE-evidence-ready',
    ]),
  });
}
