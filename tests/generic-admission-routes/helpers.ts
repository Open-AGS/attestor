import assert from 'node:assert/strict';
export { assert };
import { Hono } from 'hono';
export { Hono };
import {
  createConsequenceAdmissionAgentLoopAbuseGuard,
  issueGenericAdmissionProtectedReleaseToken,
  type GenericAdmissionEnvelope,
} from '../../src/consequence-admission/index.js';

export {
  createConsequenceAdmissionAgentLoopAbuseGuard,
  issueGenericAdmissionProtectedReleaseToken,
};
import {
  createDpopProof,
  generateDpopKeyPair,
} from '../../src/release-enforcement-plane/dpop.js';

export {
  createDpopProof,
  generateDpopKeyPair,
};
import {
  createInMemoryReleaseTokenIntrospectionStore,
} from '../../src/release-kernel/release-introspection.js';

export { createInMemoryReleaseTokenIntrospectionStore };
import { createReleaseTokenIssuer } from '../../src/release-kernel/release-token.js';
export { createReleaseTokenIssuer };
import { generateKeyPair } from '../../src/signing/keys.js';
export { generateKeyPair };
import { registerGenericAdmissionRoutes } from '../../src/service/http/routes/generic-admission-routes.js';
export { registerGenericAdmissionRoutes };
import {
  resolveHostedGenericAdmissionDpopSenderConfirmation,
} from '../../src/service/hosted/hosted-generic-admission-sender-confirmation.js';

export { resolveHostedGenericAdmissionDpopSenderConfirmation };

let passed = 0;

export function getPassedCount(): number {
  return passed;
}

export function markPassed(): void {
  passed += 1;
}

export function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

export function trustedAuthoritySources(): readonly Record<string, string>[] {
  return [{
    sourceKind: 'verified-approval',
    claimKind: 'approval',
    sourceRef: 'approval:refund:987',
    evidenceDigest: `sha256:${'a'.repeat(64)}`,
  }];
}

export function trustedApprovals(): readonly Record<string, string | boolean>[] {
  return [{
    approvalRef: 'approval:refund:987',
    sourceKind: 'approval-workflow',
    state: 'approved',
    sourceRef: 'workflow:refund-approval:987',
    reviewerRef: 'reviewer:risk-owner',
    reviewerAuthorityDigest: digest('b'),
    approvalDigest: digest('c'),
    scopeDigest: digest('d'),
    issuedAt: '2026-05-01T17:00:00.000Z',
    expiresAt: '2026-05-01T19:00:00.000Z',
    signatureVerified: true,
  }];
}

export function cleanDecisionContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    modelVersion: 'model:route-private-refund-agent:2026-05-01',
    toolSchemaDigest: digest('1'),
    toolManifestDigest: digest('2'),
    policyVersion: 'policy:route-refunds:v4-private',
    policyDigest: digest('3'),
    configDigest: digest('4'),
    promptDigest: digest('5'),
    verifierDigest: digest('6'),
    simulationDigest: digest('7'),
    evaluatedAt: '2026-05-01T17:00:00.000Z',
    expiresAt: '2026-05-02T17:00:00.000Z',
    ...overrides,
  };
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  markPassed();
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  markPassed();
}

export function createApp(planId = 'custom-route-test-plan'): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId,
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    recordShadowAdmission: () => {},
  });
  return app;
}

export function createLoopGuardedApp(planId = 'custom-route-test-plan'): { readonly app: Hono; readonly shadowRecords: number } {
  const app = new Hono();
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxRetryAttemptsPerPreviousAdmission: 2,
    },
    now: () => '2026-05-01T18:12:00.000Z',
  });
  let shadowRecords = 0;
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId,
      monthlyRunQuota: 100,
    }),
    now: () => '2026-05-01T18:00:01.000Z',
    evaluateAgentLoopAbuse: ({ tenant, envelope, receivedAt }) =>
      guard.evaluate({
        tenantId: tenant.tenantId,
        envelope,
        receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });
  return {
    app,
    get shadowRecords() {
      return shadowRecords;
    },
  };
}

export function validAdmissionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'enforce',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T18:00:00.000Z',
    decidedAt: '2026-05-01T18:00:01.000Z',
    policyRef: 'policy:refunds:v1',
    reviewerRef: 'reviewer:risk-owner',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: trustedAuthoritySources(),
    approvals: trustedApprovals(),
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    ...overrides,
  };
}

export function releaseTokenIssuerFixture() {
  const keyPair = generateKeyPair();
  return createReleaseTokenIssuer({
    issuer: 'attestor.generic-admission.route.test',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
}
