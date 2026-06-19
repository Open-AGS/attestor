import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
  createPolicyFoundrySelfOnboardingCliPacket,
} from '../src/consequence-admission/index.js';
import {
  POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION,
  createFileBackedPolicyFoundryHostedWizardStateStore,
  policyFoundryHostedWizardStateDescriptor,
} from '../src/service/policy-foundry/policy-foundry-hosted-wizard-state.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function rejects(fn: () => unknown, expected: RegExp, message: string): void {
  assert.throws(fn, expected, message);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function hostedReviewSurface() {
  const packet = createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt: '2026-05-13T13:00:00.000Z',
    tenantId: 'tenant_private_wizard_state',
    manifests: [
      {
        text: JSON.stringify({
          openapi: '3.1.0',
          info: { title: 'Refund API', version: '1.0.0' },
          paths: {
            '/refunds': {
              post: {
                operationId: 'issueRefund',
                description: 'raw_prompt_must_not_escape rk_live_must_not_escape',
                responses: { '200': { description: 'ok' } },
              },
            },
          },
        }),
        sourceRef: 'C:/Users/thedi/private/refunds.openapi.json',
        manifestKind: 'openapi',
        defaultDomain: 'money-movement',
        downstreamSystem: 'refund-service',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T13:01:00.000Z',
    workflowId: 'customer-facing-workflow-ref',
    selfOnboardingPacket: packet,
    commercialBoundary: createPolicyFoundryCommercialBoundary({
      generatedAt: '2026-05-13T13:01:00.000Z',
      plan: 'starter',
      requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
    }),
  });
  return createPolicyFoundryHostedReviewSurface({
    generatedAt: '2026-05-13T13:02:00.000Z',
    workflow,
  });
}

function workspacePath(file: string): {
  readonly workspace: string;
  readonly path: string;
} {
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-pfwiz-'));
  return {
    workspace,
    path: join(workspace, file),
  };
}

function testDescriptor(): void {
  const descriptor = policyFoundryHostedWizardStateDescriptor();

  equal(descriptor.version, POLICY_FOUNDRY_HOSTED_WIZARD_STATE_VERSION, 'Hosted wizard state: descriptor version is stable');
  equal(descriptor.storageMode, 'file-backed-evaluation', 'Hosted wizard state: descriptor storage mode is explicit');
  equal(descriptor.tenantBoundLookup, true, 'Hosted wizard state: descriptor requires tenant-bound lookup');
  equal(descriptor.storesRawPayload, false, 'Hosted wizard state: descriptor stores no raw payload');
  equal(descriptor.storesRawReviewSurface, false, 'Hosted wizard state: descriptor stores no raw review surface');
  equal(descriptor.autoEnforce, false, 'Hosted wizard state: descriptor never auto-enforces');
  equal(descriptor.productionReady, false, 'Hosted wizard state: descriptor does not claim production readiness');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-hosted-wizard-state', 'Hosted wizard state: descriptor binds data minimization surface');
}

function testFileBackedWizardStatePersistsDigestOnlyResumeState(): void {
  const { workspace, path } = workspacePath('wizard-state.json');
  try {
    const store = createFileBackedPolicyFoundryHostedWizardStateStore({ path });
    const surface = hostedReviewSurface();
    const tenantDigest = digest('tenant_private_wizard_state');
    const first = store.upsert({
      sessionId: 'customer-visible-session-ref',
      tenantDigest,
      tenantSource: 'api_key',
      planId: 'trial',
      reviewSurface: surface,
      ttlHours: 24,
      recordedAt: '2026-05-13T13:03:00.000Z',
    });
    const second = store.upsert({
      sessionId: 'customer-visible-session-ref',
      tenantDigest,
      tenantSource: 'api_key',
      planId: 'trial',
      reviewSurface: surface,
      ttlHours: 24,
      recordedAt: '2026-05-13T13:04:00.000Z',
    });
    const reloaded = createFileBackedPolicyFoundryHostedWizardStateStore({ path });
    const found = reloaded.find({
      tenantDigest,
      sessionId: first.record.sessionId,
      now: '2026-05-13T13:05:00.000Z',
    });
    const foreignTenant = reloaded.find({
      tenantDigest: digest('tenant_other_wizard_state'),
      sessionId: first.record.sessionId,
      now: '2026-05-13T13:05:00.000Z',
    });
    const fileText = readFileSync(path, 'utf8');

    equal(first.kind, 'created', 'Hosted wizard state: first upsert creates state');
    equal(second.kind, 'updated', 'Hosted wizard state: second upsert updates same state');
    ok(first.record.sessionId.startsWith('pfwiz_'), 'Hosted wizard state: returned session id is generated');
    equal(first.record.tenantDigest, tenantDigest, 'Hosted wizard state: tenant digest is retained');
    equal(first.record.workflowDigest, surface.workflowDigest, 'Hosted wizard state: workflow digest is retained');
    equal(first.record.reviewSurfaceDigest, surface.digest, 'Hosted wizard state: review surface digest is retained');
    equal(first.record.rawPayloadStored, false, 'Hosted wizard state: raw payload storage is false');
    equal(first.record.rawReviewSurfaceStored, false, 'Hosted wizard state: raw review surface storage is false');
    equal(first.record.productionReady, false, 'Hosted wizard state: production readiness is false');
    equal(first.record.autoEnforce, false, 'Hosted wizard state: autoEnforce is false');
    equal(second.record.events.length, 2, 'Hosted wizard state: update appends an event');
    equal(second.record.events[1]?.eventKind, 'updated', 'Hosted wizard state: update event is explicit');
    equal(found.record?.sessionId, first.record.sessionId, 'Hosted wizard state: file-backed state survives reload');
    equal(foreignTenant.record, null, 'Hosted wizard state: foreign tenant lookup returns no state');
    excludes(fileText, /tenant_private_wizard_state/u, 'Hosted wizard state: raw tenant id is not stored');
    excludes(fileText, /customer-visible-session-ref/u, 'Hosted wizard state: caller session ref is not stored raw');
    excludes(fileText, /raw_prompt_must_not_escape|rk_live_must_not_escape|C:\/Users\/thedi\/private/u, 'Hosted wizard state: raw manifest material is not stored');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function testExpiredAndCorruptStateFailClosed(): void {
  const { workspace, path } = workspacePath('wizard-state.json');
  try {
    const store = createFileBackedPolicyFoundryHostedWizardStateStore({ path });
    const surface = hostedReviewSurface();
    const tenantDigest = digest('tenant_private_wizard_state');
    const created = store.upsert({
      tenantDigest,
      tenantSource: 'api_key',
      reviewSurface: surface,
      ttlHours: 1,
      recordedAt: '2026-05-13T13:00:00.000Z',
    });
    const expired = store.find({
      tenantDigest,
      sessionId: created.record.sessionId,
      now: '2026-05-13T14:01:00.000Z',
    });

    equal(expired.record, null, 'Hosted wizard state: expired sessions are pruned and not resumed');

    writeFileSync(path, '{not-json');
    rejects(
      () => createFileBackedPolicyFoundryHostedWizardStateStore({ path }).exportSnapshot(),
      /corruption detected/u,
      'Hosted wizard state: corrupt state file fails closed',
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

testDescriptor();
testFileBackedWizardStatePersistsDigestOnlyResumeState();
testExpiredAndCorruptStateFailClosed();

ok(passed > 0, 'Policy Foundry hosted wizard state tests executed');
console.log(`Policy Foundry hosted wizard state tests: ${passed} passed, 0 failed`);
