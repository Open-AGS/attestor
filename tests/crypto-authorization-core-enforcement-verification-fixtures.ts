import assert from 'node:assert/strict';
import { generateKeyPair } from '../src/signing/keys.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
  type ReleaseTokenVerificationKey,
} from '../src/release-kernel/release-token.js';
import type { ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createMtlsReleaseTokenConfirmation,
} from '../src/release-enforcement-plane/workload-binding.js';
import {
  createCryptoEnforcementVerificationBinding,
  type CryptoEnforcementVerificationBinding,
} from '../src/crypto-authorization-core/enforcement-plane-verification.js';
import type {
  CryptoPolicyControlPlaneScopeBinding,
} from '../src/crypto-authorization-core/policy-control-plane-scope-binding.js';
import type {
  CryptoReleaseDecisionBinding,
} from '../src/crypto-authorization-core/release-decision-binding.js';
import {
  createCryptoAccountReference,
  createCryptoAssetReference,
  createCryptoChainReference,
} from '../src/crypto-authorization-core/types.js';

let passed = 0;

export const ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111';
export const BRIDGE_ADDRESS = '0x2222222222222222222222222222222222222222';
export const VERIFYING_CONTRACT = '0x9999999999999999999999999999999999999999';
export const SIGNATURE = `0x${'11'.repeat(65)}`;
export const CERT_THUMBPRINT = 'cert-thumbprint-crypto-enforcement';
export const SPIFFE_ID = 'spiffe://attestor.test/ns/crypto/sa/safe-guard';
export const CHECKED_AT = '2026-04-21T09:02:00.000Z';
export const POLICY_IR_HASH = 'sha256:crypto-policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.crypto-policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.crypto-policy-ir.test.v1';

export function passedCount(): number {
  return passed;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

export function throws(fn: () => unknown, expected: RegExp | ErrorConstructor, message?: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

export function trustedWorkloadBinding() {
  return {
    expectedCertificateThumbprint: CERT_THUMBPRINT,
    expectedSpiffeId: SPIFFE_ID,
    expectedTrustDomain: 'attestor.test',
  } as const;
}

export function cryptoPolicyProvenance(policyHash: string): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.crypto-enforcement-test',
    policySpecVersion: 'attestor.crypto-policy.v1',
    policyHash,
    compiledPolicyHash: policyHash,
    compiledPolicyIrHash: POLICY_IR_HASH,
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

export function fixtureChain() {
  return createCryptoChainReference({
    namespace: 'eip155',
    chainId: '1',
  });
}

export function fixtureAccount() {
  return createCryptoAccountReference({
    accountKind: 'safe',
    chain: fixtureChain(),
    address: ACCOUNT_ADDRESS,
    accountLabel: 'Treasury Safe',
  });
}

export function fixtureAsset() {
  return createCryptoAssetReference({
    assetKind: 'stablecoin',
    chain: fixtureChain(),
    assetId: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  });
}

export function createBinding(
  releaseBinding: CryptoReleaseDecisionBinding,
  policyScopeBinding: CryptoPolicyControlPlaneScopeBinding | null,
): CryptoEnforcementVerificationBinding {
  return createCryptoEnforcementVerificationBinding({
    releaseBinding,
    policyScopeBinding,
    requestId: 'erq_crypto_enforcement_001',
    receivedAt: '2026-04-21T09:01:00.000Z',
    enforcementPoint: {
      enforcementPointId: 'pep.crypto.safe-guard',
      workloadId: SPIFFE_ID,
    },
    traceId: 'trace-crypto-enforcement-001',
    idempotencyKey: 'idem-crypto-enforcement-001',
  });
}

export function issueableReleaseDecision(
  decision: CryptoReleaseDecisionBinding['releaseDecision'],
): CryptoReleaseDecisionBinding['releaseDecision'] {
  return Object.freeze({
    ...decision,
    status: 'accepted',
    policyProvenance:
      decision.policyProvenance ?? cryptoPolicyProvenance(decision.policyHash),
  });
}

export async function setupIssuer(): Promise<{
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly issue: (input: {
    readonly tokenId: string;
    readonly decision: CryptoReleaseDecisionBinding['releaseDecision'];
    readonly tenantId?: string | null;
  }) => Promise<IssuedReleaseToken>;
}> {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  return {
    verificationKey: await issuer.exportVerificationKey(),
    issue(input) {
      return issuer.issue({
        decision: input.decision,
        issuedAt: '2026-04-21T09:01:30.000Z',
        tokenId: input.tokenId,
        tenantId: input.tenantId ?? null,
        confirmation: createMtlsReleaseTokenConfirmation({
          certificateThumbprint: CERT_THUMBPRINT,
          spiffeId: SPIFFE_ID,
        }),
      });
    },
  };
}

export async function issuedPresentationFixture(input: {
  readonly releaseBinding: CryptoReleaseDecisionBinding;
  readonly policyScopeBinding: CryptoPolicyControlPlaneScopeBinding;
}): Promise<{
  readonly binding: CryptoEnforcementVerificationBinding;
  readonly issued: IssuedReleaseToken;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly releaseDecision: CryptoReleaseDecisionBinding['releaseDecision'];
}> {
  const binding = createBinding(input.releaseBinding, input.policyScopeBinding);
  const releaseDecision = issueableReleaseDecision(input.releaseBinding.releaseDecision);
  const issuer = await setupIssuer();
  const issued = await issuer.issue({
    tokenId: 'rt_crypto_enforcement_001',
    decision: releaseDecision,
    tenantId: binding.enforcementRequest.enforcementPoint.tenantId,
  });

  return {
    binding,
    issued,
    verificationKey: issuer.verificationKey,
    releaseDecision,
  };
}
