import assert from 'node:assert/strict';
import { Hono } from 'hono';
import type { FilingAdapter, FilingPackage, TaxonomyMapping } from '../src/filing/filing-adapter.js';
import {
  isReleaseBoundFilingAdapter,
  registerPipelineFilingRoutes,
} from '../src/service/http/routes/pipeline-filing-routes.js';
import type {
  FinanceFilingReleaseCandidate,
  FinanceFilingReleaseMaterial,
} from '../src/release-layer/finance.js';
import type {
  ReleaseTokenVerificationKey,
  ReleaseVerificationContext,
  ReleaseVerificationInput,
} from '../src/release-layer/index.js';
import { ReleaseVerificationError } from '../src/release-kernel/release-verification.js';
import type { RequestPathReleaseTokenIntrospectionStore } from '../src/service/release/release-authority-request-path.js';
import type { TenantContext } from '../src/service/tenant-isolation.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function unsupportedAdapter(flags: { mapped: boolean; packaged: boolean }): FilingAdapter {
  return {
    id: 'iso20022-payments-draft',
    format: 'iso20022',
    taxonomyVersion: 'draft',
    description: 'Unbound test adapter',
    mapToTaxonomy(): TaxonomyMapping {
      flags.mapped = true;
      throw new Error('Unsupported adapter should not map without an explicit release binding.');
    },
    generatePackage(): FilingPackage {
      flags.packaged = true;
      throw new Error('Unsupported adapter should not package without an explicit release binding.');
    },
  };
}

function releaseBoundAdapter(): FilingAdapter {
  return {
    id: 'xbrl-us-gaap-2024',
    format: 'xbrl',
    taxonomyVersion: 'test',
    description: 'Release-bound test adapter',
    mapToTaxonomy(): TaxonomyMapping {
      throw new Error('Release-bound redaction test should not map taxonomy.');
    },
    generatePackage(): FilingPackage {
      throw new Error('Release-bound redaction test should not generate a package.');
    },
  };
}

function releaseMaterial(): FinanceFilingReleaseMaterial {
  return {
    target: { id: 'attestor.api.finance.filing-export' },
    hashBundle: {
      outputHash: 'sha256:output',
      consequenceHash: 'sha256:consequence',
    },
  } as FinanceFilingReleaseMaterial;
}

const tenantContext: TenantContext = {
  tenantId: 'tenant_filing_export',
  tenantName: 'Filing export tenant',
  authenticatedAt: '2026-05-31T10:00:00.000Z',
  source: 'api_key',
  planId: 'pro',
  monthlyRunQuota: 100,
};

async function testReleaseBindingPredicateIsDefaultDeny(): Promise<void> {
  equal(
    isReleaseBoundFilingAdapter('xbrl-us-gaap-2024', 'xbrl-us-gaap-2024'),
    true,
    'Filing export: current finance adapter is explicitly release-bound',
  );
  equal(
    isReleaseBoundFilingAdapter('iso20022-payments-draft', 'xbrl-us-gaap-2024'),
    false,
    'Filing export: unknown registered adapter is not release-bound by default',
  );
}

async function testRegisteredButUnboundAdapterFailsClosedBeforeExport(): Promise<void> {
  const app = new Hono();
  const flags = {
    mapped: false,
    packaged: false,
    tokenResolved: false,
    releaseVerified: false,
    materialBuilt: false,
  };
  const adapter = unsupportedAdapter(flags);

  registerPipelineFilingRoutes(app, {
    currentTenant: () => tenantContext,
    FINANCE_FILING_ADAPTER_ID: 'xbrl-us-gaap-2024',
    buildFinanceFilingReleaseMaterial(_candidate: FinanceFilingReleaseCandidate): FinanceFilingReleaseMaterial {
      flags.materialBuilt = true;
      throw new Error('Unbound adapter should not build finance release material.');
    },
    apiReleaseIntrospectionStore: {} as RequestPathReleaseTokenIntrospectionStore,
    filingRegistry: {
      get(id: string) {
        return id === adapter.id ? adapter : undefined;
      },
      list() {
        return [adapter];
      },
    },
    buildCounterpartyEnvelope() {
      throw new Error('Unbound adapter should not build a decision envelope.');
    },
    apiReleaseVerificationKeyPromise: Promise.resolve({} as ReleaseTokenVerificationKey),
    resolveReleaseTokenFromRequest() {
      flags.tokenResolved = true;
      return 'unexpected';
    },
    async verifyReleaseAuthorization(_input: ReleaseVerificationInput): Promise<ReleaseVerificationContext> {
      flags.releaseVerified = true;
      throw new Error('Unbound adapter should not verify release authorization.');
    },
    apiReleaseIntrospector: async () => ({
      active: false,
      reason: 'not-called',
      claims: null,
      checkedAt: new Date().toISOString(),
    }),
    ReleaseVerificationError,
  });

  const response = await app.request('/api/v1/filing/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adapterId: adapter.id,
      runId: 'run_unbound_adapter',
      decision: 'pass',
      certificateId: 'cert_unbound',
      evidenceChainTerminal: 'sha256:unbound',
      rows: [{ amount: 100 }],
      proofMode: 'fixture',
    }),
  });
  const body = await response.json() as { error?: string; error_description?: string };

  equal(response.status, 403, 'Filing export: registered but unbound adapter returns forbidden');
  equal(body.error, 'filing_adapter_not_release_bound', 'Filing export: unbound adapter error is explicit');
  ok(
    body.error_description?.includes('Add an explicit release material and token verification binding'),
    'Filing export: remediation explains explicit binding requirement',
  );
  equal(flags.materialBuilt, false, 'Filing export: unbound adapter does not build release material');
  equal(flags.tokenResolved, false, 'Filing export: unbound adapter does not resolve a release token');
  equal(flags.releaseVerified, false, 'Filing export: unbound adapter does not call release verification');
  equal(flags.mapped, false, 'Filing export: unbound adapter does not map taxonomy');
  equal(flags.packaged, false, 'Filing export: unbound adapter does not generate a package');
}

async function testUnexpectedFilingFailureReturnsRedactedProblemDetail(): Promise<void> {
  const app = new Hono();
  const adapter = releaseBoundAdapter();

  registerPipelineFilingRoutes(app, {
    currentTenant: () => tenantContext,
    FINANCE_FILING_ADAPTER_ID: adapter.id,
    buildFinanceFilingReleaseMaterial(): FinanceFilingReleaseMaterial {
      throw new Error('SECRET_FILING_EXCEPTION_MARKER: downstream package builder failed');
    },
    apiReleaseIntrospectionStore: {} as RequestPathReleaseTokenIntrospectionStore,
    filingRegistry: {
      get(id: string) {
        return id === adapter.id ? adapter : undefined;
      },
      list() {
        return [adapter];
      },
    },
    buildCounterpartyEnvelope() {
      throw new Error('not reached');
    },
    apiReleaseVerificationKeyPromise: Promise.resolve({} as ReleaseTokenVerificationKey),
    resolveReleaseTokenFromRequest() {
      return 'not reached';
    },
    async verifyReleaseAuthorization(): Promise<ReleaseVerificationContext> {
      throw new Error('not reached');
    },
    apiReleaseIntrospector: async () => ({
      active: false,
      reason: 'not-called',
      claims: null,
      checkedAt: new Date().toISOString(),
    }),
    ReleaseVerificationError,
  });

  const response = await app.request('/api/v1/filing/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adapterId: adapter.id,
      runId: 'run_redacted',
      rows: [{ amount: 100 }],
    }),
  });
  const body = await response.json() as Record<string, unknown>;

  equal(response.status, 500, 'Filing export: unexpected failure returns 500');
  equal(body.error, 'internal_error', 'Filing export: unexpected failure uses a bounded error code');
  equal(body.message, 'Filing export failed.', 'Filing export: unexpected failure uses a route-owned message');
  ok(
    !JSON.stringify(body).includes('SECRET_FILING_EXCEPTION_MARKER'),
    'Filing export: unexpected failure does not echo raw exception context',
  );
}

async function testUnexpectedReleaseVerificationFailureReturnsRedactedChallenge(): Promise<void> {
  const app = new Hono();
  const adapter = releaseBoundAdapter();
  let verificationInput: ReleaseVerificationInput | null = null;

  registerPipelineFilingRoutes(app, {
    currentTenant: () => tenantContext,
    FINANCE_FILING_ADAPTER_ID: adapter.id,
    buildFinanceFilingReleaseMaterial: releaseMaterial,
    apiReleaseIntrospectionStore: {} as RequestPathReleaseTokenIntrospectionStore,
    filingRegistry: {
      get(id: string) {
        return id === adapter.id ? adapter : undefined;
      },
      list() {
        return [adapter];
      },
    },
    buildCounterpartyEnvelope() {
      throw new Error('not reached');
    },
    apiReleaseVerificationKeyPromise: Promise.resolve({} as ReleaseTokenVerificationKey),
    resolveReleaseTokenFromRequest() {
      return 'token';
    },
    async verifyReleaseAuthorization(input): Promise<ReleaseVerificationContext> {
      verificationInput = input;
      throw new Error('SECRET_RELEASE_TOKEN_MARKER: token verifier leaked detail');
    },
    apiReleaseIntrospector: async () => ({
      active: false,
      reason: 'not-called',
      claims: null,
      checkedAt: new Date().toISOString(),
    }),
    ReleaseVerificationError,
  });

  const response = await app.request('/api/v1/filing/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json', DPoP: 'dpop-proof-jwt' },
    body: JSON.stringify({
      adapterId: adapter.id,
      runId: 'run_redacted',
      rows: [{ amount: 100 }],
    }),
  });
  const body = await response.json() as Record<string, unknown>;

  equal(response.status, 401, 'Filing export: unexpected release verification failure returns 401');
  equal(body.error, 'invalid_token', 'Filing export: release verification failure keeps OAuth error code');
  equal(
    body.error_description,
    'Release verification failed.',
    'Filing export: release verification failure uses a route-owned description',
  );
  ok(
    !JSON.stringify(body).includes('SECRET_RELEASE_TOKEN_MARKER') &&
      !(response.headers.get('www-authenticate') ?? '').includes('SECRET_RELEASE_TOKEN_MARKER'),
    'Filing export: release verification challenge and body do not echo raw exception context',
  );
  equal(
    verificationInput?.expectedTenantId ?? null,
    tenantContext.tenantId,
    'Filing export: release verification binds the token to the current route tenant',
  );
  equal(
    verificationInput?.requireSenderConstrainedToken,
    true,
    'Filing export: release verification requires sender-constrained tokens',
  );
  equal(
    verificationInput?.dpopProofJwt,
    'dpop-proof-jwt',
    'Filing export: release verification forwards the DPoP proof for sender binding',
  );
  equal(
    verificationInput?.dpopHttpMethod,
    'POST',
    'Filing export: DPoP verification binds to the export HTTP method',
  );
  ok(
    verificationInput?.dpopHttpUri?.endsWith('/api/v1/filing/export'),
    'Filing export: DPoP verification binds to the export HTTP URI',
  );
}

await testReleaseBindingPredicateIsDefaultDeny();
await testRegisteredButUnboundAdapterFailsClosedBeforeExport();
await testUnexpectedFilingFailureReturnsRedactedProblemDetail();
await testUnexpectedReleaseVerificationFailureReturnsRedactedChallenge();

console.log(`Pipeline filing default-secure tests: ${passed} passed, 0 failed`);
