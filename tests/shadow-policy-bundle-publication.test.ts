import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyBundlePublication,
  type ShadowAdmissionEvent,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundleSigningPayload,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
  type ShadowPolicyCandidateStatus,
} from '../src/service/shadow-persistence-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import {
  derivePublicKeyIdentity,
  generateKeyPair,
  signPayload,
  verifySignature,
} from '../src/signing/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-bundle-publication-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_bundle_publication',
  tenantName: 'Shadow Bundle Publication Tenant',
  authenticatedAt: '2026-05-02T14:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const signingKey = generateKeyPair();
const signingIdentity = derivePublicKeyIdentity(signingKey.publicKeyPem);

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T14:0${index}:00.000Z`,
      decidedAt: `2026-05-02T14:0${index}:01.000Z`,
      amount: {
        value: 1000 + index,
        currency: 'HUF',
      },
      recipient: 'raw_customer_value_must_not_escape',
      evidenceRefs: [`order:${index}`],
      policyRef: 'policy:refunds:v1',
      observedFeatures: {
        rawMarker: 'raw_feature_value_must_not_escape',
      },
    }),
    occurredAt: `2026-05-02T14:0${index}:02.000Z`,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function createEvaluationSignature(
  payload: ShadowPolicyBundleSigningPayload,
): ShadowPolicyBundlePublicationSignature {
  return Object.freeze({
    algorithm: 'ed25519',
    signature: signPayload(payload.canonical, signingKey.privateKeyPem),
    signerRef: 'test-local-ed25519-signer',
    publicKeyFingerprint: signingIdentity.fingerprint,
    signedAt: '2026-05-02T14:05:01.000Z',
    signingBoundary: 'runtime-memory',
    productionReady: false,
  });
}

function createApp(input: {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly withSigner?: boolean;
}): Hono {
  const candidateStore = createFileBackedShadowPolicyCandidateStore({ path: candidatePath });
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? input.events : [],
    listShadowSimulations: () => [],
    materializeShadowPolicyCandidates: ({ tenant: routeTenant, bundle }) =>
      candidateStore.upsertBundle({
        tenantId: routeTenant.tenantId,
        bundle,
      }),
    listShadowPolicyCandidateRecords: ({ tenant: routeTenant, status }) =>
      candidateStore.list({
        tenantId: routeTenant.tenantId,
        status,
      }).records,
    transitionShadowPolicyCandidateStatus: ({ tenant: routeTenant, candidateId, status, actorRef, reason }) =>
      candidateStore.transitionStatus({
        tenantId: routeTenant.tenantId,
        candidateId,
        status,
        actorRef,
        reason,
      }).record,
    signShadowPolicyBundlePublication: input.withSigner
      ? ({ payload }) => createEvaluationSignature(payload)
      : undefined,
    now: () => '2026-05-02T14:05:00.000Z',
  });
  return app;
}

async function materializeCandidate(app: Hono): Promise<string> {
  const response = await app.request('/api/v1/shadow/policy-candidates/materialize', {
    method: 'POST',
  });
  const body = await response.json() as {
    readonly persisted: {
      readonly records: readonly { readonly candidateId: string }[];
    };
  };
  return body.persisted.records[0]?.candidateId ?? '';
}

async function transition(
  app: Hono,
  candidateId: string,
  status: ShadowPolicyCandidateStatus,
): Promise<Response> {
  return app.request(`/api/v1/shadow/policy-candidates/${encodeURIComponent(candidateId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status,
      actorRef: `operator:${status}`,
      reason: `Move candidate to ${status}.`,
    }),
  });
}

async function approveCandidate(app: Hono, candidateId: string): Promise<void> {
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Policy bundle publication route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Policy bundle publication route: candidate can be approved');
}

async function testPolicyBundlePublicationStaysUnsignedWithoutSigner(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
  });
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/policy-bundle-publication');
  const body = await response.json() as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly publication: {
      readonly signatureStatus: string;
      readonly signature: unknown;
      readonly publicationReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly signingPayload: {
        readonly digest: string;
        readonly ruleCount: number;
      };
    };
  };

  equal(response.status, 200, 'Policy bundle publication route: unsigned publication returns 200');
  equal(body.productionReady, false, 'Policy bundle publication route: route is not production-ready');
  equal(body.autoEnforce, false, 'Policy bundle publication route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Policy bundle publication route: route is data-minimized');
  equal(body.publication.signatureStatus, 'unsigned', 'Policy bundle publication route: no signer leaves artifact unsigned');
  equal(body.publication.signature, null, 'Policy bundle publication route: no signature is emitted without signer');
  equal(body.publication.publicationReady, false, 'Policy bundle publication route: unsigned artifact is not publication-ready');
  equal(body.publication.activationReady, false, 'Policy bundle publication route: activation remains false');
  ok(body.publication.remainingActivationBlockers.includes('bundle-signature-required'), 'Policy bundle publication route: signature blocker remains');
  ok(body.publication.signingPayload.digest.startsWith('sha256:'), 'Policy bundle publication route: signing payload digest is present');
  equal(body.publication.signingPayload.ruleCount, 1, 'Policy bundle publication route: signing payload binds rule count');
}

async function testPolicyBundlePublicationCarriesEvaluationSignatureWithoutRawPayload(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    withSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  const response = await app.request('/api/v1/shadow/policy-bundle-publication');
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly publication: {
      readonly publicationId: string;
      readonly tenantId: string;
      readonly sourcePacketDigest: string;
      readonly sourceBundleDraftDigest: string;
      readonly sourceSimulationDigest: string;
      readonly signatureStatus: string;
      readonly signatureRequired: boolean;
      readonly signature: {
        readonly algorithm: string;
        readonly signature: string;
        readonly signerRef: string;
        readonly publicKeyFingerprint: string;
        readonly signingBoundary: string;
        readonly productionReady: boolean;
      };
      readonly publicationReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly signingPayload: {
        readonly canonical: string;
        readonly digest: string;
        readonly ruleCount: number;
        readonly ruleDigests: readonly {
          readonly ruleId: string;
          readonly candidateDigest: string;
          readonly ruleDigest: string;
          readonly targetMode: string;
        }[];
      };
      readonly digest: string;
    };
  };
  const publication = body.publication;
  const rule = publication.signingPayload.ruleDigests[0];

  equal(response.status, 200, 'Policy bundle publication route: signed evaluation publication returns 200');
  ok(publication.publicationId.startsWith('policy-bundle-publication:sha256:'), 'Policy bundle publication route: publication id is digest-bound');
  equal(publication.tenantId, tenant.tenantId, 'Policy bundle publication route: tenant scope is carried');
  ok(publication.sourcePacketDigest.startsWith('sha256:'), 'Policy bundle publication route: source packet digest is carried');
  ok(publication.sourceBundleDraftDigest.startsWith('sha256:'), 'Policy bundle publication route: source bundle draft digest is carried');
  ok(publication.sourceSimulationDigest.startsWith('sha256:'), 'Policy bundle publication route: source simulation digest is carried');
  equal(publication.signatureStatus, 'signed-evaluation', 'Policy bundle publication route: local signer is evaluation-only');
  equal(publication.signatureRequired, true, 'Policy bundle publication route: signature remains required');
  equal(publication.signature.algorithm, 'ed25519', 'Policy bundle publication route: signature algorithm is explicit');
  equal(publication.signature.signerRef, 'test-local-ed25519-signer', 'Policy bundle publication route: signer ref is explicit');
  equal(publication.signature.publicKeyFingerprint, signingIdentity.fingerprint, 'Policy bundle publication route: public key fingerprint is carried');
  equal(publication.signature.signingBoundary, 'runtime-memory', 'Policy bundle publication route: signing boundary is explicit');
  equal(publication.signature.productionReady, false, 'Policy bundle publication route: evaluation signer does not overclaim production');
  ok(
    verifySignature(
      publication.signingPayload.canonical,
      publication.signature.signature,
      signingKey.publicKeyPem,
    ),
    'Policy bundle publication route: signature verifies against the signing payload canonical body',
  );
  equal(publication.publicationReady, true, 'Policy bundle publication route: signed simulation is publication-ready');
  equal(publication.activationReady, false, 'Policy bundle publication route: activation remains false');
  ok(!publication.remainingActivationBlockers.includes('bundle-signature-required'), 'Policy bundle publication route: signature gate is closed by signature');
  ok(publication.remainingActivationBlockers.includes('production-signing-provider-required'), 'Policy bundle publication route: production signer remains required');
  ok(publication.remainingActivationBlockers.includes('downstream-verification-required'), 'Policy bundle publication route: downstream verification still remains required on master');
  ok(publication.signingPayload.digest.startsWith('sha256:'), 'Policy bundle publication route: signing payload digest is present');
  equal(publication.signingPayload.ruleCount, 1, 'Policy bundle publication route: signing payload has one rule');
  equal(rule?.targetMode, 'enforce', 'Policy bundle publication route: enforce target is signed');
  ok(rule?.candidateDigest.startsWith('sha256:'), 'Policy bundle publication route: candidate digest is signed');
  ok(rule?.ruleDigest.startsWith('sha256:'), 'Policy bundle publication route: rule digest is signed');
  ok(publication.digest.startsWith('sha256:'), 'Policy bundle publication route: publication digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Policy bundle publication route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Policy bundle publication route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Policy bundle publication route: raw evidence id is not exported');
}

async function testPolicyBundlePublicationRejectsUnsafeSourceStatus(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
  });
  const response = await app.request('/api/v1/shadow/policy-bundle-publication?status=draft');
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Policy bundle publication route: draft source status is rejected');
  ok(
    body.reasonCodes.includes('invalid-policy-promotion-source-status'),
    'Policy bundle publication route: invalid source status has reason code',
  );
}

function testPolicyBundlePublicationModuleRejectsInvalidTimestamp(): void {
  assert.throws(
    () => createShadowPolicyBundlePublication({
      simulation: {
        version: 'attestor.shadow-policy-promotion-simulation.v1',
        simulationId: 'policy-promotion-simulation:sha256:test',
        generatedAt: '2026-05-02T14:05:00.000Z',
        sourcePacketId: 'policy-promotion-packet:sha256:test',
        sourcePacketDigest: 'sha256:packet',
        sourceBundleDraftDigest: 'sha256:bundle',
        tenantId: tenant.tenantId,
        eventCount: 0,
        matchedEventCount: 0,
        unmatchedEventCount: 0,
        evaluationCount: 0,
        impactCounts: {
          admit: 0,
          audit: 0,
          warn: 0,
          holdForReview: 0,
          block: 0,
        },
        ruleSimulations: [],
        simulationReady: false,
        activationReady: false,
        remainingActivationBlockers: ['bundle-signature-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:simulation',
      },
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Policy bundle publication module: generatedAt must be valid',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPolicyBundlePublicationStaysUnsignedWithoutSigner();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPolicyBundlePublicationCarriesEvaluationSignatureWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testPolicyBundlePublicationRejectsUnsafeSourceStatus();
  testPolicyBundlePublicationModuleRejectsInvalidTimestamp();

  console.log(`Shadow policy bundle publication tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
