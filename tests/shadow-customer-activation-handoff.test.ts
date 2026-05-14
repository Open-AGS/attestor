import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import {
  createGenericAdmissionEnvelope,
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
} from '../src/service/shadow-persistence-store.js';
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

const tempDir = mkdtempSync(join(tmpdir(), 'attestor-shadow-customer-activation-handoff-'));
const candidatePath = join(tempDir, 'shadow-policy-candidates.json');

const tenant: TenantContext = {
  tenantId: 'tenant_shadow_customer_activation_handoff',
  tenantName: 'Shadow Customer Activation Handoff Tenant',
  authenticatedAt: '2026-05-02T17:00:00.000Z',
  source: 'api_key',
  planId: 'community',
  monthlyRunQuota: 100,
};

const signingKey = generateKeyPair();
const signingIdentity = derivePublicKeyIdentity(signingKey.publicKeyPem);
const evidenceDigest = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const rollbackDigest = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const killSwitchDigest = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const monitoringDigest = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const breakGlassJustificationDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const breakGlassReconciliationDigest = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';

function createSafeEvent(index: number): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      tenantId: tenant.tenantId,
      requestedAt: `2026-05-02T17:0${index}:00.000Z`,
      decidedAt: `2026-05-02T17:0${index}:01.000Z`,
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
    occurredAt: `2026-05-02T17:0${index}:02.000Z`,
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
      signedAt: '2026-05-02T17:05:01.000Z',
      signingBoundary: 'external-kms-hsm',
      productionReady: true,
    });
  }

  return Object.freeze({
    algorithm: 'ed25519',
    signature: signPayload(payload.canonical, signingKey.privateKeyPem),
    signerRef: 'test-local-ed25519-signer',
    publicKeyFingerprint: signingIdentity.fingerprint,
    signedAt: '2026-05-02T17:05:01.000Z',
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
    now: () => '2026-05-02T17:05:00.000Z',
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
  equal((await transition(app, candidateId, 'proposed')).status, 200, 'Customer activation handoff route: candidate can be proposed');
  equal((await transition(app, candidateId, 'approved')).status, 200, 'Customer activation handoff route: candidate can be approved');
}

async function activateCandidate(app: Hono, candidateId: string): Promise<void> {
  await approveCandidate(app, candidateId);
  equal((await transition(app, candidateId, 'activated')).status, 200, 'Customer activation handoff route: candidate can be activated');
}

function completeHandoffBody(overrides: Record<string, unknown> = {}) {
  return {
    enforcementPointId: 'refund-service/ext-authz',
    boundaryKind: 'http-handler',
    verifierRef: 'verifier:refund-service-ci',
    evidenceRefs: [
      {
        id: 'ci:run:789',
        kind: 'adapter-test',
        digest: evidenceDigest,
        uri: 'https://example.invalid/attestor/evidence/ci-run-789',
      },
    ],
    observedVerificationChecks: SHADOW_DOWNSTREAM_VERIFICATION_CHECKS,
    activationRef: 'change:shadow-enforcement-activation-789',
    operatorRef: 'operator:security-reviewer',
    rolloutStrategy: 'canary',
    rollbackRef: {
      id: 'runbook:rollback-shadow-enforcement',
      kind: 'deployment-rollback',
      digest: rollbackDigest,
      uri: 'https://example.invalid/attestor/runbooks/rollback-shadow-enforcement',
    },
    killSwitchRef: {
      id: 'flag:disable-shadow-enforcement',
      kind: 'feature-flag-disable',
      digest: killSwitchDigest,
      uri: 'https://example.invalid/attestor/flags/disable-shadow-enforcement',
    },
    monitoringRef: {
      id: 'slo:shadow-enforcement-error-budget',
      kind: 'slo-alarm',
      digest: monitoringDigest,
      uri: 'https://example.invalid/attestor/alerts/shadow-enforcement',
    },
    expiresAt: '2026-05-02T18:05:00.000Z',
    ...overrides,
  };
}

async function postHandoff(
  app: Hono,
  body: unknown,
  sourceStatus: ShadowPolicyCandidateStatus = 'approved',
): Promise<Response> {
  return app.request(`/api/v1/shadow/customer-activation-handoff?status=${sourceStatus}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function controlBy(
  handoff: {
    readonly controlRefs: readonly {
      readonly control: string;
      readonly present: boolean;
      readonly blocker: string;
    }[];
  },
  control: string,
) {
  return handoff.controlRefs.find((entry) => entry.control === control);
}

async function testHandoffBlocksEvaluationSignerAndUnactivatedSource(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
  });
  const candidateId = await materializeCandidate(app);
  await approveCandidate(app, candidateId);

  const response = await postHandoff(app, completeHandoffBody());
  const text = await response.text();
  const body = JSON.parse(text) as {
    readonly productionReady: boolean;
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly customerControlsReady: boolean;
      readonly activationReadinessReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: blocked handoff returns 200');
  equal(body.productionReady, false, 'Customer activation handoff route: route does not claim production readiness');
  equal(body.autoEnforce, false, 'Customer activation handoff route: route does not auto-enforce');
  equal(body.rawPayloadStored, false, 'Customer activation handoff route: route is data-minimized');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: evaluation signer keeps handoff blocked');
  equal(body.handoff.customerControlsReady, true, 'Customer activation handoff route: customer controls can be complete while readiness is blocked');
  equal(body.handoff.activationReadinessReady, false, 'Customer activation handoff route: activation readiness remains false');
  ok(body.handoff.remainingActivationBlockers.includes('activation-readiness-required'), 'Customer activation handoff route: readiness blocker is carried');
  ok(body.handoff.remainingActivationBlockers.includes('production-signing-provider-required'), 'Customer activation handoff route: production signer blocker remains');
  ok(body.handoff.remainingActivationBlockers.includes('operator-activation-required'), 'Customer activation handoff route: operator activation blocker remains');
  equal(body.handoff.autoEnforce, false, 'Customer activation handoff artifact: never auto-enforces');
  equal(body.handoff.rawPayloadStored, false, 'Customer activation handoff artifact: keeps data minimized');
  equal(body.handoff.productionReady, false, 'Customer activation handoff artifact: avoids production-ready claim');
  ok(!text.includes('raw_customer_value_must_not_escape'), 'Customer activation handoff route: raw recipient is not exported');
  ok(!text.includes('raw_feature_value_must_not_escape'), 'Customer activation handoff route: raw feature is not exported');
  ok(!text.includes('order:1'), 'Customer activation handoff route: raw evidence id is not exported');
}

async function testHandoffCanBecomeReadyWithoutAutoEnforce(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(app, completeHandoffBody(), 'activated');
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffId: string;
      readonly generatedAt: string;
      readonly handoffReady: boolean;
      readonly handoffInstruction: string;
      readonly customerControlsReady: boolean;
      readonly activationReadinessReady: boolean;
      readonly rolloutStrategy: string;
      readonly sourceActivationReadinessDigest: string;
      readonly sourceIntegrationProofDigest: string;
      readonly sourcePublicationDigest: string;
      readonly sourceBindingDigest: string;
      readonly sourceSimulationDigest: string;
      readonly remainingActivationBlockers: readonly string[];
      readonly controlRefs: readonly {
        readonly control: string;
        readonly present: boolean;
        readonly blocker: string;
      }[];
      readonly approvalRequired: boolean;
      readonly autoEnforce: boolean;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly digest: string;
    };
  };
  const handoff = body.handoff;

  equal(response.status, 200, 'Customer activation handoff route: ready handoff returns 200');
  ok(handoff.handoffId.startsWith('customer-activation-handoff:sha256:'), 'Customer activation handoff route: handoff id is digest-bound');
  equal(handoff.generatedAt, '2026-05-02T17:05:00.000Z', 'Customer activation handoff route: generatedAt is carried');
  equal(handoff.handoffReady, true, 'Customer activation handoff route: all handoff gates can become ready');
  equal(handoff.handoffInstruction, 'Customer system may begin its controlled activation process. Attestor does not execute the activation.', 'Customer activation handoff route: instruction keeps execution outside Attestor');
  equal(handoff.customerControlsReady, true, 'Customer activation handoff route: customer controls are complete');
  equal(handoff.activationReadinessReady, true, 'Customer activation handoff route: readiness gate is complete');
  equal(handoff.rolloutStrategy, 'canary', 'Customer activation handoff route: rollout strategy is carried');
  ok(handoff.sourceActivationReadinessDigest.startsWith('sha256:'), 'Customer activation handoff route: readiness digest is carried');
  ok(handoff.sourceIntegrationProofDigest.startsWith('sha256:'), 'Customer activation handoff route: integration proof digest is carried');
  ok(handoff.sourcePublicationDigest.startsWith('sha256:'), 'Customer activation handoff route: publication digest is carried');
  ok(handoff.sourceBindingDigest.startsWith('sha256:'), 'Customer activation handoff route: binding digest is carried');
  ok(handoff.sourceSimulationDigest.startsWith('sha256:'), 'Customer activation handoff route: simulation digest is carried');
  equal(handoff.remainingActivationBlockers.length, 0, 'Customer activation handoff route: no handoff blockers remain');
  equal(handoff.controlRefs.length, 4, 'Customer activation handoff route: required customer controls are listed');
  ok(handoff.controlRefs.every((entry) => entry.present), 'Customer activation handoff route: every customer control is present');
  equal(handoff.approvalRequired, true, 'Customer activation handoff route: approval remains explicit');
  equal(handoff.autoEnforce, false, 'Customer activation handoff route: route never auto-enforces');
  equal(handoff.rawPayloadStored, false, 'Customer activation handoff route: handoff is data-minimized');
  equal(handoff.productionReady, false, 'Customer activation handoff route: evaluation artifact still avoids production-ready claim');
  ok(handoff.digest.startsWith('sha256:'), 'Customer activation handoff route: handoff digest is present');
}

async function testMissingKillSwitchBlocksHandoff(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({ killSwitchRef: null }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly customerControlsReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
      readonly controlRefs: readonly {
        readonly control: string;
        readonly present: boolean;
        readonly blocker: string;
      }[];
    };
  };
  const killSwitch = controlBy(body.handoff, 'kill-switch');

  equal(response.status, 200, 'Customer activation handoff route: missing kill switch returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: missing kill switch blocks handoff');
  equal(body.handoff.customerControlsReady, false, 'Customer activation handoff route: customer controls are incomplete');
  ok(body.handoff.remainingActivationBlockers.includes('kill-switch-required'), 'Customer activation handoff route: kill switch blocker remains');
  equal(killSwitch?.present, false, 'Customer activation handoff route: kill switch control is marked missing');
}

async function testExpiredActivationWindowBlocksHandoff(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({ expiresAt: '2026-05-02T17:00:00.000Z' }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: expired activation window returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: expired activation window blocks handoff');
  ok(body.handoff.remainingActivationBlockers.includes('activation-window-expired'), 'Customer activation handoff route: expired window blocker remains');
}

async function testBreakGlassRequiresExtraControls(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      rolloutStrategy: 'break-glass',
      expiresAt: null,
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly breakGlassControlsReady: boolean;
      readonly breakGlassWindowSeconds: number | null;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: incomplete break-glass returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: incomplete break-glass blocks handoff');
  equal(body.handoff.breakGlassControlsReady, false, 'Customer activation handoff route: incomplete break-glass controls are not ready');
  equal(body.handoff.breakGlassWindowSeconds, null, 'Customer activation handoff route: missing break-glass expiry has no window');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-secondary-approver-required'), 'Customer activation handoff route: break-glass requires secondary approver');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-expiry-required'), 'Customer activation handoff route: break-glass requires expiry');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-justification-required'), 'Customer activation handoff route: break-glass requires justification');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-reconciliation-required'), 'Customer activation handoff route: break-glass requires reconciliation');
}

async function testBreakGlassRejectsSameApproverAndLongWindow(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      rolloutStrategy: 'break-glass',
      secondaryApproverRef: 'operator:security-reviewer',
      expiresAt: '2026-05-02T22:06:00.000Z',
      breakGlassJustificationRef: {
        id: 'incident:shadow-break-glass-789',
        kind: 'incident-channel',
        digest: breakGlassJustificationDigest,
        uri: 'https://example.invalid/attestor/incidents/shadow-break-glass-789',
      },
      breakGlassReconciliationRef: {
        id: 'postmortem:shadow-break-glass-789',
        kind: 'manual-runbook',
        digest: breakGlassReconciliationDigest,
        uri: 'https://example.invalid/attestor/postmortems/shadow-break-glass-789',
      },
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly breakGlassControlsReady: boolean;
      readonly breakGlassWindowSeconds: number | null;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: unsafe break-glass returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: unsafe break-glass blocks handoff');
  equal(body.handoff.breakGlassControlsReady, false, 'Customer activation handoff route: unsafe break-glass controls are not ready');
  equal(body.handoff.breakGlassWindowSeconds, 18060, 'Customer activation handoff route: break-glass window is reported in seconds');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-secondary-approver-must-differ'), 'Customer activation handoff route: break-glass secondary approver must differ');
  ok(body.handoff.remainingActivationBlockers.includes('break-glass-window-too-long'), 'Customer activation handoff route: break-glass window is capped');
}

async function testBreakGlassCanBecomeReadyWithExtraControls(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      rolloutStrategy: 'break-glass',
      secondaryApproverRef: 'operator:incident-commander',
      expiresAt: '2026-05-02T20:05:00.000Z',
      breakGlassJustificationRef: {
        id: 'incident:shadow-break-glass-789',
        kind: 'incident-channel',
        digest: breakGlassJustificationDigest,
        uri: 'https://example.invalid/attestor/incidents/shadow-break-glass-789',
      },
      breakGlassReconciliationRef: {
        id: 'postmortem:shadow-break-glass-789',
        kind: 'manual-runbook',
        digest: breakGlassReconciliationDigest,
        uri: 'https://example.invalid/attestor/postmortems/shadow-break-glass-789',
      },
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly secondaryApproverRef: string | null;
      readonly breakGlassControlsReady: boolean;
      readonly breakGlassWindowSeconds: number | null;
      readonly breakGlassJustificationRef: { readonly digest: string } | null;
      readonly breakGlassReconciliationRef: { readonly digest: string } | null;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: complete break-glass returns 200');
  equal(body.handoff.handoffReady, true, 'Customer activation handoff route: complete break-glass can become ready');
  equal(body.handoff.secondaryApproverRef, 'operator:incident-commander', 'Customer activation handoff route: break-glass secondary approver is carried');
  equal(body.handoff.breakGlassControlsReady, true, 'Customer activation handoff route: complete break-glass controls are ready');
  equal(body.handoff.breakGlassWindowSeconds, 10800, 'Customer activation handoff route: complete break-glass window is reported');
  equal(body.handoff.breakGlassJustificationRef?.digest ?? null, breakGlassJustificationDigest, 'Customer activation handoff route: break-glass justification is carried');
  equal(body.handoff.breakGlassReconciliationRef?.digest ?? null, breakGlassReconciliationDigest, 'Customer activation handoff route: break-glass reconciliation is carried');
  equal(body.handoff.remainingActivationBlockers.length, 0, 'Customer activation handoff route: complete break-glass has no blockers');
}

async function testHighRiskActivationRequiresSecondaryApprover(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      boundaryKind: 'action-dispatcher',
      rolloutStrategy: 'canary',
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly activationBoundaryKind: string | null;
      readonly twoPersonApprovalRequired: boolean;
      readonly twoPersonApprovalReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: high-risk activation without secondary approver returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: high-risk activation without secondary approver blocks handoff');
  equal(body.handoff.activationBoundaryKind, 'action-dispatcher', 'Customer activation handoff route: high-risk boundary kind is carried');
  equal(body.handoff.twoPersonApprovalRequired, true, 'Customer activation handoff route: high-risk activation requires two-person approval');
  equal(body.handoff.twoPersonApprovalReady, false, 'Customer activation handoff route: missing secondary approver is not ready');
  ok(body.handoff.remainingActivationBlockers.includes('high-risk-secondary-approver-required'), 'Customer activation handoff route: high-risk secondary approver blocker remains');
}

async function testHighRiskActivationRejectsSameApprover(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      boundaryKind: 'payment-adapter',
      rolloutStrategy: 'phased',
      secondaryApproverRef: 'operator:security-reviewer',
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly activationBoundaryKind: string | null;
      readonly twoPersonApprovalRequired: boolean;
      readonly twoPersonApprovalReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: high-risk activation with same approver returns 200');
  equal(body.handoff.handoffReady, false, 'Customer activation handoff route: high-risk activation with same approver blocks handoff');
  equal(body.handoff.activationBoundaryKind, 'payment-adapter', 'Customer activation handoff route: payment boundary kind is carried');
  equal(body.handoff.twoPersonApprovalRequired, true, 'Customer activation handoff route: payment boundary requires two-person approval');
  equal(body.handoff.twoPersonApprovalReady, false, 'Customer activation handoff route: same secondary approver is not ready');
  ok(body.handoff.remainingActivationBlockers.includes('high-risk-secondary-approver-must-differ'), 'Customer activation handoff route: high-risk approvers must differ');
}

async function testHighRiskActivationCanBecomeReadyWithSecondaryApprover(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      boundaryKind: 'record-writer',
      rolloutStrategy: 'canary',
      secondaryApproverRef: 'operator:activation-approver',
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly handoff: {
      readonly handoffReady: boolean;
      readonly activationBoundaryKind: string | null;
      readonly secondaryApproverRef: string | null;
      readonly twoPersonApprovalRequired: boolean;
      readonly twoPersonApprovalReady: boolean;
      readonly remainingActivationBlockers: readonly string[];
    };
  };

  equal(response.status, 200, 'Customer activation handoff route: complete high-risk activation returns 200');
  equal(body.handoff.handoffReady, true, 'Customer activation handoff route: high-risk activation can become ready with a second approver');
  equal(body.handoff.activationBoundaryKind, 'record-writer', 'Customer activation handoff route: record-writer boundary kind is carried');
  equal(body.handoff.secondaryApproverRef, 'operator:activation-approver', 'Customer activation handoff route: high-risk secondary approver is carried');
  equal(body.handoff.twoPersonApprovalRequired, true, 'Customer activation handoff route: record-writer requires two-person approval');
  equal(body.handoff.twoPersonApprovalReady, true, 'Customer activation handoff route: high-risk two-person approval is ready');
  equal(body.handoff.remainingActivationBlockers.length, 0, 'Customer activation handoff route: complete high-risk activation has no blockers');
}

async function testInvalidCustomerControlDigestIsRejected(): Promise<void> {
  const app = createApp({
    events: Array.from({ length: 5 }, (_, index) => createSafeEvent(index + 1)),
    productionSigner: true,
  });
  const candidateId = await materializeCandidate(app);
  await activateCandidate(app, candidateId);

  const response = await postHandoff(
    app,
    completeHandoffBody({
      rollbackRef: {
        id: 'runbook:rollback-shadow-enforcement',
        kind: 'deployment-rollback',
        digest: 'sha256:not-a-valid-digest',
        uri: 'https://example.invalid/attestor/runbooks/rollback-shadow-enforcement',
      },
    }),
    'activated',
  );
  const body = await response.json() as {
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 400, 'Customer activation handoff route: invalid control digest is rejected');
  ok(
    body.reasonCodes.includes('customer-activation-handoff-failed'),
    'Customer activation handoff route: invalid digest has fail-closed reason code',
  );
}

try {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testHandoffBlocksEvaluationSignerAndUnactivatedSource();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testHandoffCanBecomeReadyWithoutAutoEnforce();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testMissingKillSwitchBlocksHandoff();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testExpiredActivationWindowBlocksHandoff();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testBreakGlassRequiresExtraControls();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testBreakGlassRejectsSameApproverAndLongWindow();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testBreakGlassCanBecomeReadyWithExtraControls();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testHighRiskActivationRequiresSecondaryApprover();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testHighRiskActivationRejectsSameApprover();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testHighRiskActivationCanBecomeReadyWithSecondaryApprover();
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  await testInvalidCustomerControlDigestIsRejected();

  console.log(`Shadow customer activation handoff tests: ${passed} passed, 0 failed`);
} finally {
  resetShadowPersistenceStoresForTests({ policyCandidatePath: candidatePath });
  if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
}
