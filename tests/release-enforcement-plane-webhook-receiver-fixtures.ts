import assert from 'node:assert/strict';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import {
  createReleaseTokenIssuer,
  type IssuedReleaseToken,
  type ReleaseTokenVerificationKey,
} from '../src/release-kernel/release-token.js';
import type { ReleaseDecision, ReleasePolicyProvenance } from '../src/release-kernel/object-model.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import type { CreateEnforcementPointReferenceInput } from '../src/release-enforcement-plane/types.js';
import type { NonceLedgerEntry, ReplayLedgerEntry } from '../src/release-enforcement-plane/freshness.js';
import {
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  createHttpAuthorizationEnvelope,
  createHttpMessageSignature,
  createHttpMessageSignatureReleaseTokenConfirmation,
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  generateHttpMessageSignatureKeyPair,
  type HttpAuthorizationEnvelope,
  type HttpMessageSignatureKeyPair,
} from '../src/release-enforcement-plane/http-message-signatures.js';
import {
  type ReleaseWebhookReceiverOptions,
} from '../src/release-enforcement-plane/webhook-receiver.js';

let passed = 0;

export function passedCount(): number { return passed; }

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

export const BODY = JSON.stringify({
  event: 'attestor.release.accepted',
  target: 'webhook.receiver.workflow',
  consequence: 'workflow.dispatch',
});
export const TARGET_ID = 'webhook.receiver.workflow';
export const OUTPUT_HASH = 'sha256:output';
export const CONSEQUENCE_HASH = 'sha256:consequence';
export const POLICY_HASH = 'sha256:policy';
export const POLICY_IR_HASH = 'sha256:policy-ir';
export const COMPILED_POLICY_INDEX_VERSION = 'attestor.policy-index.test.v1';
export const COMPILED_POLICY_IR_VERSION = 'attestor.policy-ir.test.v1';
export const WEBHOOK_URL = 'https://webhooks.attestor.test/hooks/release?attempt=1';

export function policyProvenance(): ReleasePolicyProvenance {
  return {
    source: 'compiled-admission-policy-index',
    policyId: 'policy.release-webhook-receiver-test',
    policySpecVersion: 'attestor.release-policy.v1',
    policyHash: POLICY_HASH,
    compiledPolicyHash: POLICY_HASH,
    compiledPolicyIrHash: POLICY_IR_HASH,
    compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
    compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    verificationValid: true,
    verificationErrorCodes: [],
    verificationWarningCodes: [],
  };
}

export function makeDecision(input: {
  readonly id: string;
  readonly targetId?: string;
  readonly consequenceType?: 'action' | 'communication' | 'record';
  readonly riskClass?: 'R2' | 'R3';
}): ReleaseDecision {
  const consequenceType = input.consequenceType ?? 'action';
  return createReleaseDecisionSkeleton({
    id: input.id,
    createdAt: '2026-04-18T16:00:00.000Z',
    status: 'accepted',
    policyVersion: 'policy.release-webhook-receiver-test.v1',
    policyHash: POLICY_HASH,
    policyProvenance: policyProvenance(),
    outputHash: OUTPUT_HASH,
    consequenceHash: CONSEQUENCE_HASH,
    outputContract: {
      artifactType: 'release-webhook-receiver-test.artifact',
      expectedShape: 'deterministic webhook receiver payload',
      consequenceType,
      riskClass: input.riskClass ?? 'R3',
    },
    capabilityBoundary: {
      allowedTools: ['release-webhook-receiver-test-tool'],
      allowedTargets: [input.targetId ?? TARGET_ID],
      allowedDataDomains: ['release-webhook-receiver-test'],
    },
    requester: {
      id: 'svc.release-webhook-receiver-test',
      type: 'service',
    },
    target: {
      kind: consequenceType === 'record' ? 'record-store' : 'workflow',
      id: input.targetId ?? TARGET_ID,
    },
  });
}

export function webhookPoint(input: {
  readonly targetId?: string;
  readonly consequenceType?: 'action' | 'communication' | 'record';
  readonly riskClass?: 'R2' | 'R3';
} = {}): CreateEnforcementPointReferenceInput {
  return {
    environment: 'test',
    enforcementPointId: 'webhook-receiver-pep',
    pointKind: 'webhook-receiver',
    boundaryKind: 'webhook',
    consequenceType: input.consequenceType ?? 'action',
    riskClass: input.riskClass ?? 'R3',
    tenantId: 'tenant-test',
    accountId: 'acct-test',
    workloadId: 'spiffe://attestor/tests/webhook-receiver',
    audience: input.targetId ?? TARGET_ID,
  };
}

export async function setupIssuer() {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  return {
    issuer,
    verificationKey: await issuer.exportVerificationKey(),
  };
}

export async function issueWebhookToken(input: {
  readonly signatureKey: HttpMessageSignatureKeyPair;
  readonly tokenId: string;
  readonly decisionId: string;
  readonly targetId?: string;
  readonly consequenceType?: 'action' | 'communication' | 'record';
  readonly riskClass?: 'R2' | 'R3';
}): Promise<{
  readonly issued: IssuedReleaseToken;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly decision: ReleaseDecision;
}> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: input.decisionId,
    targetId: input.targetId,
    consequenceType: input.consequenceType,
    riskClass: input.riskClass,
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T16:00:00.000Z',
    tokenId: input.tokenId,
    tenantId: 'tenant-test',
    confirmation: createHttpMessageSignatureReleaseTokenConfirmation({
      publicKeyThumbprint: input.signatureKey.publicKeyThumbprint,
    }),
  });

  return { issued, verificationKey, decision };
}

export async function makeEnvelope(input: {
  readonly signatureKey: HttpMessageSignatureKeyPair;
  readonly issued: IssuedReleaseToken;
  readonly body?: string;
  readonly nonce?: string;
  readonly url?: string;
  readonly coveredComponents?: readonly string[];
}): Promise<HttpAuthorizationEnvelope> {
  return createHttpAuthorizationEnvelope({
    request: {
      method: 'POST',
      uri: input.url ?? WEBHOOK_URL,
      headers: {
        'content-type': 'application/json',
      },
      body: input.body ?? BODY,
    },
    issuedToken: input.issued,
    privateJwk: input.signatureKey.privateJwk,
    publicJwk: input.signatureKey.publicJwk,
    createdAt: '2026-04-18T16:01:00.000Z',
    expiresAt: '2026-04-18T16:02:00.000Z',
    nonce: input.nonce ?? 'nonce-webhook-1',
    presentedAt: '2026-04-18T16:01:00.000Z',
    coveredComponents: input.coveredComponents,
  });
}

export function nonceLedger(nonce: string): NonceLedgerEntry {
  return {
    nonce,
    issuedAt: '2026-04-18T16:00:50.000Z',
    expiresAt: '2026-04-18T16:01:50.000Z',
  };
}

export function replayLedger(key: string): ReplayLedgerEntry {
  return {
    subjectKind: 'http-message-signature',
    key,
    firstSeenAt: '2026-04-18T16:01:01.000Z',
    expiresAt: '2026-04-18T16:02:00.000Z',
  };
}

export function register(
  issued: IssuedReleaseToken,
  decision: ReleaseDecision,
): {
  readonly store: ReleaseTokenIntrospectionStore;
  readonly introspector: ReleaseTokenIntrospector;
} {
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  store.registerIssuedToken({ issuedToken: issued, decision });
  return { store, introspector };
}

export function receiverOptions(input: {
  readonly signatureKey: HttpMessageSignatureKeyPair;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly introspector?: ReleaseTokenIntrospector;
  readonly store?: ReleaseTokenIntrospectionStore;
  readonly nonce?: string;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly breakGlass?: boolean;
  readonly breakGlassExpiresAt?: string;
  readonly consumeBreakGlassGrant?: ReleaseWebhookReceiverOptions['consumeBreakGlassGrant'];
}): ReleaseWebhookReceiverOptions {
  return {
    verificationKey: input.verificationKey,
    signaturePublicJwk: input.signatureKey.publicJwk,
    enforcementPoint: webhookPoint(),
    introspector: input.introspector,
    usageStore: input.store,
    nonceLedgerEntry: input.nonce ? nonceLedger(input.nonce) : undefined,
    replayLedgerEntry: input.replayLedgerEntry,
    expectedNonce: input.nonce,
    now: () => '2026-04-18T16:01:10.000Z',
    breakGlassGrant: input.breakGlass
      ? {
          reason: 'control-plane-recovery',
          authorizedBy: {
            id: 'user.release-operator',
            type: 'user',
            role: 'release-operator',
          },
          authorizedAt: '2026-04-18T16:00:30.000Z',
          expiresAt: input.breakGlassExpiresAt ?? '2026-04-18T16:05:00.000Z',
          ticketId: 'INC-4242',
          rationale: 'Control-plane introspection is degraded; local signature verification remains valid.',
        }
      : undefined,
    consumeBreakGlassGrant: input.consumeBreakGlassGrant,
  };
}

export async function setupValidWebhook(input: {
  readonly tokenId: string;
  readonly decisionId: string;
  readonly nonce: string;
}) {
  const signatureKey = await generateHttpMessageSignatureKeyPair();
  const { issued, verificationKey, decision } = await issueWebhookToken({
    signatureKey,
    tokenId: input.tokenId,
    decisionId: input.decisionId,
  });
  const envelope = await makeEnvelope({
    signatureKey,
    issued,
    nonce: input.nonce,
  });
  return { signatureKey, issued, verificationKey, decision, envelope };
}
