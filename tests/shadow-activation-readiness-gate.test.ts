import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
  createShadowActivationReadinessGate,
  createShadowAdmissionEvent,
  SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
  type ShadowAdmissionEvent,
  type ShadowPolicyBundlePublicationSignature,
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-activation-readiness-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_activation_readiness',
  tenantName: 'Shadow Activation Readiness Tenant',
  authenticatedAt: '2026-05-02T16:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const signingKey = generateKeyPair();
const signingIdentity = derivePublicKeyIdentity(signingKey.publicKeyPem);
const evidenceDigest = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T16:0${index}:00.000Z`,
      decidedAt: `2026-05-02T16:0${index}:01.000Z`,
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
    occurredAt: `2026-05-02T16:0${index}:02.000Z`,
    downstreamOutcome: 'proceeded',
    observedFeatures: {
      rawMarker: 'raw_feature_value_must_not_escape',
    },
  });
}

function createSignature(
  payload: ShadowPolicyBundleSigningPayload,
  productionReady: boolean,
): ShadowPolicyBundlePublicationSignature {
  if (productionReady) {
    return Object.freeze({
      algorithm: 'external-kms',
      signature: `external-kms-signature:${payload.digest}`,
      signerRef: 'kms:prod-policy-bundle-signer',
      publicKeyFingerprint: 'kms-fingerprint:prod-policy-bundle-signer',
      signedAt: '2026-05-02T16:05:01.000Z',
      signingBoundary: 'external-kms-hsm',
      productionReady: true,
    });
  }

  return Object.freeze({
    algorithm: 'ed25519',
    signature: signPayload(payload.canonical, signingKey.privateKeyPem),
    signerRef: 'test-local-ed25519-signer',
    publicKeyFingerprint: signingIdentity.fingerprint,
    signedAt: '2026-05-02T16:05:01.000Z',
    signingBoundary: 'runtime-memory',
    productionReady: false,
  });
}

function createApp(input: {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly productionSigner?: boolean;
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
    signShadowPolicyBundlePublication: ({ payload }) =>
      createSignature(payload, input.productionSigner ?? false),
    now: () => '2026-05-02T16:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Activation readiness route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Activation readiness route: candidate can be approved');
}

async function activateCandidate(app: Hono, candidateId: string): Promise<void> {
  await approveCandidate(app, candidateId);
  equal((await transition(app, candidateId, 'activated')).status, 200, 'Activation readiness route: candidate can be activated');
}

function readinessRequestBody(observedVerificationChecks: readonly string[]) {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:456',
        kind: 'adapter-test',
        digest: evidenceDigest,
        uri: 'https://example.invalid/attestor/evidence/ci-run-456',
      },
    ],
    observedVerificationChecks,
  };
}

async function postReadiness(
  app: Hono,
  body: unknown,
  sourceStatus: ShadowPolicyCandidateStatus = 'approved',
): Promise<Response> {
  return app.request(`/api/v1/shadow/activation-readiness?status=${sourceStatus}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function testActivationReadinessBlocksEvaluationSignerAndUnactivatedSource(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
  });
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);

  const response = await postReadiness(app, readinessRequestBody(SHADOW_DOWNSTREAM_VERIFICATION_CHECKS));
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly activationReadiness: {
      readonly readinessState: string;
      readonly activationReady: boolean;
      readonly sourceStatus: string;
      readonly signatureStatus: string;
      readonly remainingActivationBlockers: readonly string[];
      readonly componentStatuses: readonly {
        readonly component: string;
        readonly status: string;
        readonly blockers: readonly string[];
      }[];
    };
  };
  const components = new Map(body.activationReadiness.componentStatuses.map((entry) => [entry.component, entry]));

  equal(response.status, 200, 'Activation readiness route: blocked readiness returns 200');
  equal(body.productionReady, false, 'Activation readiness route: route does not claim production readiness');
  equal(body.autoEnforce, false, 'Activation readiness route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Activation readiness route: route is data-minimized');
  equal(body.activationReadiness.readinessState, 'blocked', 'Activation readiness route: evaluation signer keeps gate blocked');
  equal(body.activationReadiness.activationReady, false, 'Activation readiness route: activation is not ready');
  equal(body.activationReadiness.sourceStatus, 'approved', 'Activation readiness route: approved source status is carried');
  equal(body.activationReadiness.signatureStatus, 'signed-evaluation', 'Activation readiness route: evaluation signer is explicit');
  ok(body.activationReadiness.remainingActivationBlockers.includes('production-signing-provider-required'), 'Activation readiness route: production signer blocker remains');
  ok(body.activationReadiness.remainingActivationBlockers.includes('operator-activation-required'), 'Activation readiness route: operator activation blocker remains');
  equal(components.get('downstream-integration-proof')?.status, 'pass', 'Activation readiness route: integration proof component passes');
  equal(components.get('production-signing-boundary')?.status, 'block', 'Activation readiness route: production signing component blocks');
  equal(components.get('operator-activation')?.status, 'block', 'Activation readiness route: operator activation component blocks');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Activation readiness route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Activation readiness route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Activation readiness route: raw evidence id is not exported');
}

async function testActivationReadinessCanBecomeEligibleWithoutAutoEnforce(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postReadiness(
    app,
    readinessRequestBody(SHADOW_DOWNSTREAM_VERIFICATION_CHECKS),
    'activated',
  );
  const body = await response.json() as {
    readonly activationReadiness: {
      readonly gateId: string;
      readonly readinessState: string;
      readonly activationReady: boolean;
      readonly activationInstruction: string;
      readonly sourceChainMatches: boolean;
      readonly signatureStatus: string;
      readonly remainingActivationBlockers: readonly string[];
      readonly componentStatuses: readonly {
        readonly component: string;
        readonly status: string;
      }[];
      readonly approvalRequired: boolean;
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly digest: string;
    };
  };
  const gate = body.activationReadiness;

  equal(response.status, 200, 'Activation readiness route: eligible activation readiness returns 200');
  ok(gate.gateId.startsWith('activation-readiness-gate:sha256:'), 'Activation readiness route: gate id is digest-bound');
  equal(gate.readinessState, 'customer-controlled-activation-eligible', 'Activation readiness route: eligible state is explicit');
  equal(gate.activationReady, true, 'Activation readiness route: all gates can become activation-ready');
  equal(gate.activationInstruction, 'Eligible for customer-controlled activation review. This route does not auto-enforce.', 'Activation readiness route: instruction keeps customer control explicit');
  equal(gate.sourceChainMatches, true, 'Activation readiness route: source chain matches');
  equal(gate.signatureStatus, 'signed-production', 'Activation readiness route: production signature status is carried');
  equal(gate.remainingActivationBlockers.length, 0, 'Activation readiness route: no activation blockers remain');
  ok(gate.componentStatuses.every((entry) => entry.status === 'pass'), 'Activation readiness route: every component passes');
  equal(gate.approvalRequired, true, 'Activation readiness route: approval remains explicit');
  equal(gate.autoEnforce, false, 'Activation readiness route: route never auto-enforces');
  equal(gate.rawPayloadStored, false, 'Activation readiness route: gate is data-minimized');
  equal(gate.productionReady, false, 'Activation readiness route: evaluation artifact still avoids production-ready claim');
  ok(gate.digest.startsWith('sha256:'), 'Activation readiness route: gate digest is present');
}

async function testActivationReadinessKeepsIncompleteIntegrationBlocked(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postReadiness(
    app,
    readinessRequestBody(['verify-artifact-signature']),
    'activated',
  );
  const body = await response.json() as {
    readonly activationReadiness: {
      readonly activationReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly componentStatuses: readonly {
        readonly component: string;
        readonly status: string;
        readonly blockers: readonly string[];
      }[];
    };
  };
  const integration = body.activationReadiness.componentStatuses.find(
    (entry) => entry.component === 'downstream-integration-proof',
  );

  equal(response.status, 200, 'Activation readiness route: incomplete integration proof returns 200');
  equal(body.activationReadiness.activationReady, false, 'Activation readiness route: incomplete proof blocks activation');
  ok(body.activationReadiness.remainingActivationBlockers.includes('downstream-integration-proof-required'), 'Activation readiness route: integration proof blocker remains');
  ok(body.activationReadiness.remainingActivationBlockers.includes('downstream-integration-checks-incomplete'), 'Activation readiness route: incomplete checks blocker remains');
  equal(integration?.status, 'block', 'Activation readiness route: integration component blocks');
  ok(integration?.blockers.includes('downstream-integration-checks-incomplete'), 'Activation readiness route: integration component lists incomplete checks');
}

function testActivationReadinessModuleRejectsInvalidTimestamp(): void {
  assert.throws(
    () => createShadowActivationReadinessGate({
      sourceStatus: 'approved',
      publication: {
        version: 'attestor.shadow-policy-bundle-publication.v1',
        publicationId: 'publication',
        generatedAt: '2026-05-02T16:05:00.000Z',
        tenantId: tenant.tenantId,
        sourcePacketId: 'packet',
        sourcePacketDigest: 'sha256:packet',
        sourceBundleDraftDigest: 'sha256:bundle',
        sourceSimulationId: 'simulation',
        sourceSimulationDigest: 'sha256:simulation',
        signingPayload: {
          version: 'attestor.shadow-policy-bundle-signing-payload.v1',
          tenantId: tenant.tenantId,
          sourcePacketId: 'packet',
          sourcePacketDigest: 'sha256:packet',
          sourceBundleDraftDigest: 'sha256:bundle',
          sourceSimulationId: 'simulation',
          sourceSimulationDigest: 'sha256:simulation',
          targetModes: [],
          ruleCount: 0,
          ruleDigests: [],
          canonical: '{}',
          digest: 'sha256:payload',
        },
        signatureStatus: 'unsigned',
        signatureRequired: true,
        signature: null,
        productionSigningBoundaryRequired: true,
        productionSigningBoundaryReady: false,
        publicationReady: false,
        activationReady: false,
        remainingActivationBlockers: ['bundle-signature-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:publication',
      },
      binding: {
        version: 'attestor.shadow-downstream-verification-binding.v1',
        bindingId: 'binding',
        generatedAt: '2026-05-02T16:05:00.000Z',
        tenantId: tenant.tenantId,
        sourceSimulationId: 'simulation',
        sourceSimulationDigest: 'sha256:simulation',
        sourcePacketId: 'packet',
        sourcePacketDigest: 'sha256:packet',
        sourceBundleDraftDigest: 'sha256:bundle',
        eventCount: 0,
        matchedEventCount: 0,
        ruleCount: 0,
        ruleBindings: [],
        requiredVerificationChecks: [],
        downstreamVerificationDraftReady: false,
        activationReady: false,
        remainingActivationBlockers: ['downstream-verification-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:binding',
      },
      integrationProof: {
        version: 'attestor.shadow-downstream-integration-proof.v1',
        proofId: 'proof',
        generatedAt: '2026-05-02T16:05:00.000Z',
        tenantId: tenant.tenantId,
        enforcementPointId: 'refund-service/ext-authz',
        boundaryKind: 'http-handler',
        verifierRef: 'verifier',
        sourcePublicationId: 'publication',
        sourcePublicationDigest: 'sha256:publication',
        sourceBindingId: 'binding',
        sourceBindingDigest: 'sha256:binding',
        sourceSimulationDigest: 'sha256:simulation',
        sourcePacketDigest: 'sha256:packet',
        sourceBundleDraftDigest: 'sha256:bundle',
        sourceChainMatches: true,
        requiredCheckCount: 0,
        observedCheckCount: 0,
        observedVerificationChecks: [],
        missingVerificationChecks: [],
        evidenceRefs: [],
        evidenceDigest: 'sha256:evidence',
        integrationProofReady: false,
        activationReady: false,
        remainingActivationBlockers: ['downstream-integration-proof-required'],
        approvalRequired: true,
        autoEnforce: false,
        rawPayloadStored: false,
        productionReady: false,
        canonical: '{}',
        digest: 'sha256:proof',
      },
      generatedAt: 'not-a-date',
    }),
    /generatedAt must be an ISO timestamp/u,
    'Activation readiness module: generatedAt must be valid',
  );
  passed += 1;
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testActivationReadinessBlocksEvaluationSignerAndUnactivatedSource();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testActivationReadinessCanBecomeEligibleWithoutAutoEnforce();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testActivationReadinessKeepsIncompleteIntegrationBlocked();
  testActivationReadinessModuleRejectsInvalidTimestamp();

  console.log(`Shadow activation readiness gate tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
