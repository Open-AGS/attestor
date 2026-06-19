import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowDownstreamIntegrationProof,
  createShadowAdmissionEvent,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  type ShadowAdmissionEvent,
  type ShadowDownstreamVerificationBinding,
  type ShadowPolicyBundlePublicationSignature,
  type ShadowPolicyBundlePublication,
  type ShadowPolicyBundleSigningPayload,
} from '../src/consequence-admission/index.js';
import { registerShadowRoutes } from '../src/service/http/routes/shadow-routes.js';
import {
  createFileBackedShadowPolicyCandidateStore,
  resetShadowPersistenceStoresForTests,
  type ShadowPolicyCandidateStatus,
} from '../src/service/shadow/shadow-persistence-store.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';
import {
  derivePublicKeyIdentity,
  generateKeyPair,
  signPayload,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-downstream-integration-proof-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_downstream_integration_proof',
  tenantName: 'Shadow Downstream Integration Proof Tenant',
  authenticatedAt: '2026-05-02T15:00:00.000Z',
  source: 'api_key',
  planId: 'trial',
  monthlyRunQuota: 100,
};

const signingKey = generateKeyPair();
const signingIdentity = derivePublicKeyIdentity(signingKey.publicKeyPem);
const evidenceDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const sourcePacketDigest = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const sourceBundleDraftDigest = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const sourceSimulationDigest = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T15:0${index}:00.000Z`,
      decidedAt: `2026-05-02T15:0${index}:01.000Z`,
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
    occurredAt: `2026-05-02T15:0${index}:02.000Z`,
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
    signedAt: '2026-05-02T15:05:01.000Z',
    signingBoundary: 'runtime-memory',
    productionReady: false,
  });
}

function createApp(events: readonly ShadowAdmissionEvent[]): Hono {
  const candidateStore = createFileBackedShadowPolicyCandidateStore({ path: candidatePath });
  const app = new Hono();
  registerShadowRoutes(app, {
    currentTenant: () => tenant,
    listShadowEvents: ({ tenant: routeTenant }) =>
      routeTenant.tenantId === tenant.tenantId ? events : [],
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
    signShadowPolicyBundlePublication: ({ payload }) => createEvaluationSignature(payload),
    now: () => '2026-05-02T15:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Downstream integration proof route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Downstream integration proof route: candidate can be approved');
}

function proofRequestBody(
  observedVerificationChecks: readonly string[],
  digest = evidenceDigest,
) {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:123',
        kind: 'adapter-test',
        digest,
        uri: 'https://example.invalid/attestor/evidence/ci-run-123',
      },
    ],
    observedVerificationChecks,
  };
}

async function postProof(app: Hono, body: unknown): Promise<Response> {
  return app.request('/api/v1/shadow/downstream-integration-proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function prepareApprovedApp(): Promise<Hono> {
  const app = createApp(Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)));
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);
  return app;
}

async function testIncompleteProofKeepsIntegrationBlocker(): Promise<void> {
  const app = await prepareApprovedApp();
  const response = await postProof(app, proofRequestBody(['verify-artifact-signature']));
  const body = await response.json() as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly proof: {
      readonly integrationProofReady: boolean;
      readonly activationReady: boolean;
      readonly requiredCheckCount: number;
      readonly observedCheckCount: number;
      readonly missingVerificationChecks: readonly string[];
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Downstream integration proof route: incomplete proof returns 200');
  equal(body.productionReady, false, 'Downstream integration proof route: route is not production-ready');
  equal(body.autoEnforce, false, 'Downstream integration proof route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Downstream integration proof route: route is data-minimized');
  equal(body.proof.integrationProofReady, false, 'Downstream integration proof route: incomplete checks do not close proof gate');
  equal(body.proof.activationReady, false, 'Downstream integration proof route: activation remains false');
  equal(body.proof.requiredCheckCount, SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.length, 'Downstream integration proof route: required check count is carried');
  equal(body.proof.observedCheckCount, 1, 'Downstream integration proof route: one observed check is carried');
  ok(body.proof.missingVerificationChecks.includes('verify-source-digests'), 'Downstream integration proof route: missing checks are listed');
  ok(body.proof.remainingActivationBlockers.includes('downstream-integration-proof-required'), 'Downstream integration proof route: integration proof blocker remains');
  ok(body.proof.remainingActivationBlockers.includes('downstream-integration-checks-incomplete'), 'Downstream integration proof route: incomplete checks blocker remains');
}

async function testCompleteProofBindsPublicationBindingAndEvidenceWithoutRawPayload(): Promise<void> {
  const app = await prepareApprovedApp();
  const response = await postProof(app, proofRequestBody(SHADOW_DOWNSTREAM_VERIFICATION_CHECKS));
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly proof: {
      readonly proofId: string;
      readonly tenantId: string;
      readonly enforcementPointId: string;
      readonly boundaryKind: string;
      readonly verifierRef: string;
      readonly sourcePublicationDigest: string;
      readonly sourceBindingDigest: string;
      readonly sourceSimulationDigest: string;
      readonly sourcePacketDigest: string;
      readonly sourceBundleDraftDigest: string;
      readonly sourceChainMatches: boolean;
      readonly requiredCheckCount: number;
      readonly observedCheckCount: number;
      readonly missingVerificationChecks: readonly string[];
      readonly evidenceRefs: readonly {
        readonly id: string;
        readonly kind: string;
        readonly digest: string;
        readonly uri: string | null;
      }[];
      readonly evidenceDigest: string;
      readonly integrationProofReady: boolean;
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly approvalRequired: boolean;
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly digest: string;
    };
  };
  const proof = body.proof;

  equal(response.status, 200, 'Downstream integration proof route: complete proof returns 200');
  ok(proof.proofId.startsWith('downstream-integration-proof:sha256:'), 'Downstream integration proof route: proof id is digest-bound');
  equal(proof.tenantId, tenant.tenantId, 'Downstream integration proof route: tenant scope is carried');
  equal(proof.enforcementPointId, 'refund-service/ext-authz', 'Downstream integration proof route: enforcement point is carried');
  equal(proof.boundaryKind, 'http-handler', 'Downstream integration proof route: boundary kind is carried');
  equal(proof.verifierRef, 'verifier:refund-service-ci', 'Downstream integration proof route: verifier ref is carried');
  ok(proof.sourcePublicationDigest.startsWith('sha256:'), 'Downstream integration proof route: publication digest is carried');
  ok(proof.sourceBindingDigest.startsWith('sha256:'), 'Downstream integration proof route: binding digest is carried');
  ok(proof.sourceSimulationDigest.startsWith('sha256:'), 'Downstream integration proof route: simulation digest is carried');
  ok(proof.sourcePacketDigest.startsWith('sha256:'), 'Downstream integration proof route: packet digest is carried');
  ok(proof.sourceBundleDraftDigest.startsWith('sha256:'), 'Downstream integration proof route: bundle draft digest is carried');
  equal(proof.sourceChainMatches, true, 'Downstream integration proof route: publication and binding source chain matches');
  equal(proof.requiredCheckCount, SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.length, 'Downstream integration proof route: all required checks are counted');
  equal(proof.observedCheckCount, SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.length, 'Downstream integration proof route: all observed checks are counted');
  equal(proof.missingVerificationChecks.length, 0, 'Downstream integration proof route: complete proof has no missing checks');
  equal(proof.evidenceRefs.length, 1, 'Downstream integration proof route: evidence reference is carried');
  equal(proof.evidenceRefs[0]?.digest, evidenceDigest, 'Downstream integration proof route: evidence digest is carried');
  ok(proof.evidenceDigest.startsWith('sha256:'), 'Downstream integration proof route: evidence set digest is carried');
  equal(proof.integrationProofReady, true, 'Downstream integration proof route: complete evidence closes integration proof gate');
  equal(proof.activationReady, false, 'Downstream integration proof route: activation remains false');
  ok(!proof.remainingActivationBlockers.includes('downstream-integration-proof-required'), 'Downstream integration proof route: integration proof blocker is closed');
  ok(!proof.remainingActivationBlockers.includes('downstream-verification-required'), 'Downstream integration proof route: downstream verification blocker is closed');
  ok(!proof.remainingActivationBlockers.includes('bundle-signature-required'), 'Downstream integration proof route: bundle signature blocker is closed by evaluation signature');
  ok(proof.remainingActivationBlockers.includes('production-signing-provider-required'), 'Downstream integration proof route: production signer remains required');
  equal(proof.approvalRequired, true, 'Downstream integration proof route: approval is still required');
  equal(proof.autoEnforce, false, 'Downstream integration proof route: route never auto-enforces');
  equal(proof.rawPayloadStored, false, 'Downstream integration proof route: proof is data-minimized');
  equal(proof.productionReady, false, 'Downstream integration proof route: proof does not claim production readiness');
  ok(proof.digest.startsWith('sha256:'), 'Downstream integration proof route: proof digest is present');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Downstream integration proof route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Downstream integration proof route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Downstream integration proof route: raw evidence id is not exported');
}

async function testProofRejectsInvalidBoundaryKind(): Promise<void> {
  const app = await prepareApprovedApp();
  const response = await postProof(app, {
    ...proofRequestBody(SHADOW_DOWNSTREAM_VERIFICATION_CHECKS),
    boundaryKind: 'unsafe-scheduler',
  });
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Downstream integration proof route: invalid boundary kind is rejected');
  ok(
    body.reasonCodes.includes('invalid-downstream-integration-proof-input'),
    'Downstream integration proof route: invalid boundary has reason code',
  );
}

async function testProofRejectsInvalidEvidenceDigest(): Promise<void> {
  const app = await prepareApprovedApp();
  const response = await postProof(
    app,
    proofRequestBody(SHADOW_DOWNSTREAM_VERIFICATION_CHECKS, 'sha256:not-a-valid-digest'),
  );
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Downstream integration proof route: invalid evidence digest is rejected');
  ok(
    body.reasonCodes.includes('downstream-integration-proof-failed'),
    'Downstream integration proof route: invalid digest has fail-closed reason code',
  );
}

function tenantMismatchPublication(): ShadowPolicyBundlePublication {
  const signingPayload = {
    version: 'attestor.shadow-policy-bundle-signing-payload.v1',
    tenantId: 'tenant_shadow_downstream_publication',
    sourcePacketId: 'shadow-packet:tenant-boundary',
    sourcePacketDigest,
    sourceBundleDraftDigest,
    sourceSimulationId: 'shadow-simulation:tenant-boundary',
    sourceSimulationDigest,
    targetModes: Object.freeze(['review']),
    ruleCount: 0,
    ruleDigests: Object.freeze([]),
    canonical: '{"tenantId":"tenant_shadow_downstream_publication"}',
    digest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  } as const satisfies ShadowPolicyBundleSigningPayload;

  return Object.freeze({
    version: 'attestor.shadow-policy-bundle-publication.v1',
    publicationId: 'shadow-policy-publication:tenant-boundary',
    generatedAt: '2026-05-02T15:08:00.000Z',
    tenantId: 'tenant_shadow_downstream_publication',
    sourcePacketId: signingPayload.sourcePacketId,
    sourcePacketDigest,
    sourceBundleDraftDigest,
    sourceSimulationId: signingPayload.sourceSimulationId,
    sourceSimulationDigest,
    signingPayload,
    signatureStatus: 'signed-evaluation',
    signatureRequired: true,
    signature: {
      algorithm: 'ed25519',
      signature: 'test-signature',
      signerRef: 'test-local-ed25519-signer',
      publicKeyFingerprint: signingIdentity.fingerprint,
      signedAt: '2026-05-02T15:08:01.000Z',
      signingBoundary: 'runtime-memory',
      productionReady: false,
    },
    productionSigningBoundaryRequired: true,
    productionSigningBoundaryReady: false,
    publicationReady: true,
    activationReady: false,
    remainingActivationBlockers: Object.freeze(['production-signing-provider-required']),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    canonical: '{"publicationId":"shadow-policy-publication:tenant-boundary"}',
    digest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  });
}

function tenantMismatchBinding(): ShadowDownstreamVerificationBinding {
  return Object.freeze({
    version: 'attestor.shadow-downstream-verification-binding.v1',
    bindingId: 'shadow-downstream-binding:tenant-boundary',
    generatedAt: '2026-05-02T15:08:02.000Z',
    tenantId: 'tenant_shadow_downstream_binding',
    sourceSimulationId: 'shadow-simulation:tenant-boundary',
    sourceSimulationDigest,
    sourcePacketId: 'shadow-packet:tenant-boundary',
    sourcePacketDigest,
    sourceBundleDraftDigest,
    eventCount: 3,
    matchedEventCount: 3,
    ruleCount: 0,
    ruleBindings: Object.freeze([]),
    requiredVerificationChecks: Object.freeze(
      SHADOW_DOWNSTREAM_VERIFICATION_CHECKS.map((check) => Object.freeze({
        check,
        required: true,
        failClosed: true,
        summary: `Verify ${check}.`,
        bindingFields: Object.freeze(['tenantId']),
      })),
    ),
    downstreamVerificationDraftReady: true,
    activationReady: false,
    remainingActivationBlockers: Object.freeze(['downstream-integration-proof-required']),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    canonical: '{"bindingId":"shadow-downstream-binding:tenant-boundary"}',
    digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
  });
}

function testProofChainTenantMismatchCannotActivate(): void {
  const proof = createShadowDownstreamIntegrationProof({
    publication: tenantMismatchPublication(),
    binding: tenantMismatchBinding(),
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    observedVerificationChecks: SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
    evidenceRefs: [
      {
        id: 'ci:run:tenant-boundary',
        kind: 'adapter-test',
        digest: evidenceDigest,
        uri: 'https://example.invalid/attestor/evidence/tenant-boundary',
      },
    ],
    generatedAt: '2026-05-02T15:08:03.000Z',
  });

  equal(
    proof.tenantId,
    'tenant_shadow_downstream_binding',
    'Downstream integration proof: proof remains bound to the binding tenant',
  );
  equal(
    proof.sourceChainMatches,
    false,
    'Downstream integration proof: publication/binding tenant mismatch breaks the source chain',
  );
  equal(
    proof.integrationProofReady,
    false,
    'Downstream integration proof: tenant mismatch cannot close the integration proof gate',
  );
  equal(
    proof.activationReady,
    false,
    'Downstream integration proof: tenant mismatch cannot activate enforcement',
  );
  equal(
    proof.productionReady,
    false,
    'Downstream integration proof: tenant mismatch does not claim production readiness',
  );
  ok(
    proof.remainingActivationBlockers.includes('source-artifact-chain-mismatch'),
    'Downstream integration proof: tenant mismatch carries a source-chain blocker',
  );
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testIncompleteProofKeepsIntegrationBlocker();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testCompleteProofBindsPublicationBindingAndEvidenceWithoutRawPayload();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testProofRejectsInvalidBoundaryKind();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testProofRejectsInvalidEvidenceDigest();
  testProofChainTenantMismatchCannotActivate();

  console.log(`Shadow downstream integration proof tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
