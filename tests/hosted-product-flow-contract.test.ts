import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HOSTED_JOURNEY_CONTRACT_VERSION,
  HOSTED_JOURNEY_PRODUCT_MODEL,
  HOSTED_PRODUCT_FLOW_READINESS_GATES,
  HOSTED_JOURNEY_ROUTE_CONTRACTS,
  HOSTED_JOURNEY_STEP_CONTRACTS,
  HOSTED_JOURNEY_TRUTH_SOURCES,
  hostedJourneyContract,
} from '../src/service/hosted-journey-contract.js';
import {
  STRIPE_SUPPORTED_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_ROUTE,
} from '../src/service/stripe-webhook-events.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

const routeOwnerFiles = {
  account_routes: ['src', 'service', 'http', 'routes', 'account-routes.ts'],
  pipeline_execution_routes: ['src', 'service', 'http', 'routes', 'pipeline-execution-routes.ts'],
  pipeline_verification_routes: ['src', 'service', 'http', 'routes', 'pipeline-verification-routes.ts'],
  stripe_webhook_routes: ['src', 'service', 'http', 'routes', 'stripe-webhook-routes.ts'],
} as const;

function routeSnippet(method: 'GET' | 'POST', path: string): string {
  return `app.${method.toLowerCase()}('${path}'`;
}

function testDescriptorShape(): void {
  const contract = hostedJourneyContract();

  equal(contract.version, HOSTED_JOURNEY_CONTRACT_VERSION, 'Hosted journey contract: version is exported');
  equal(contract.productModel, HOSTED_JOURNEY_PRODUCT_MODEL, 'Hosted journey contract: product model is one Attestor core');
  equal(contract.defaultEvaluationPlanId, 'developer', 'Hosted journey contract: Developer is default evaluation path');
  equal(contract.firstPaidHostedPlanId, 'starter', 'Hosted journey contract: starter is first paid hosted plan');
  ok(contract.consequenceBoundary.includes('before the downstream system'), 'Hosted journey contract: consequence boundary is explicit');
  ok(contract.packSelection.includes('does not auto-detect packs'), 'Hosted journey contract: no auto-detect promise');
  ok(contract.billingConvergence.includes('signed Stripe webhooks'), 'Hosted journey contract: billing convergence belongs to signed webhooks');
  deepEqual(
    contract.readinessGates,
    HOSTED_PRODUCT_FLOW_READINESS_GATES,
    'Hosted journey contract: readiness gates are exported machine-readably',
  );
  deepEqual(
    contract.supportedStripeWebhookEvents,
    [...STRIPE_SUPPORTED_WEBHOOK_EVENTS],
    'Hosted journey contract: Stripe webhook event list is canonical',
  );
}

function testTruthSources(): void {
  const contract = hostedJourneyContract();

  equal(
    contract.truthSources.customerContract,
    HOSTED_JOURNEY_TRUTH_SOURCES.customerContract,
    'Hosted journey contract: customer contract truth source is exported',
  );
  equal(
    contract.truthSources.operatingModel,
    'docs/01-overview/operating-model.md',
    'Hosted journey contract: operating model truth source is exported',
  );
  equal(
    contract.truthSources.pricingPackaging,
    'docs/01-overview/product-packaging.md',
    'Hosted journey contract: pricing truth source remains product packaging',
  );
  equal(
    contract.truthSources.operatorStripe,
    'docs/01-overview/stripe-commercial-bootstrap.md',
    'Hosted journey contract: operator Stripe truth source remains separate',
  );
  equal(
    contract.truthSources.firstApiCallQuickstart,
    'docs/01-overview/hosted-first-api-call.md',
    'Hosted journey contract: first API-call quickstart truth source is exported',
  );
  equal(
    contract.truthSources.firstIntegrationExamples,
    'docs/01-overview/finance-and-crypto-first-integrations.md',
    'Hosted journey contract: first integration examples truth source is exported',
  );
  equal(
    contract.truthSources.accountVisibilityGuide,
    'docs/01-overview/hosted-account-visibility.md',
    'Hosted journey contract: account visibility guide truth source is exported',
  );
}

function testRouteContractsMapToShippedRoutes(): void {
  for (const route of HOSTED_JOURNEY_ROUTE_CONTRACTS) {
    const content = readProjectFile(...routeOwnerFiles[route.owner]);
    ok(
      content.includes(routeSnippet(route.method, route.path)),
      `Hosted journey contract: shipped route exists for ${route.method} ${route.path}`,
    );
  }
}

function testRouteContractsStayFocused(): void {
  const routeKeys = HOSTED_JOURNEY_ROUTE_CONTRACTS.map((route) => route.key);
  const routePaths = HOSTED_JOURNEY_ROUTE_CONTRACTS.map((route) => route.path);

  ok(routeKeys.includes('signup'), 'Hosted journey contract: signup route is included');
  ok(routeKeys.includes('checkout'), 'Hosted journey contract: checkout route is included');
  ok(routeKeys.includes('stripe_webhook'), 'Hosted journey contract: Stripe webhook route is included');
  ok(routeKeys.includes('features'), 'Hosted journey contract: features route is included');
  ok(routeKeys.includes('billing_export'), 'Hosted journey contract: billing export route is included');
  ok(routeKeys.includes('billing_reconciliation'), 'Hosted journey contract: billing reconciliation route is included');
  ok(routePaths.includes('/api/v1/pipeline/run'), 'Hosted journey contract: first consequence call is included');
  ok(routePaths.includes('/api/v1/verify'), 'Hosted journey contract: verification route is included');
  ok(routePaths.includes('/api/v1/account/features'), 'Hosted journey contract: account features route is included');
  ok(routePaths.includes('/api/v1/account/billing/export'), 'Hosted journey contract: billing export route is included');
  ok(routePaths.includes('/api/v1/account/billing/reconciliation'), 'Hosted journey contract: billing reconciliation route is included');
  ok(routePaths.includes(STRIPE_WEBHOOK_ROUTE), 'Hosted journey contract: Stripe webhook path uses canonical constant');
  ok(
    HOSTED_JOURNEY_ROUTE_CONTRACTS.every((route) => route.requiredHeaders.length > 0),
    'Hosted journey contract: each route declares required headers or auth context',
  );
}

function testAuthAndBillingBoundaries(): void {
  const checkout = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'checkout');
  const webhook = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'stripe_webhook');
  const signup = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'signup');
  const firstCall = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'first_consequence_call');
  const billingExport = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'billing_export');
  const billingReconciliation = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'billing_reconciliation');
  const billingPortal = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'billing_portal');
  const issueApiKey = HOSTED_JOURNEY_ROUTE_CONTRACTS.find((route) => route.key === 'issue_api_key');

  equal(signup?.authBoundary, 'none', 'Hosted journey contract: signup starts without auth');
  equal(firstCall?.authBoundary, 'tenant_api_key', 'Hosted journey contract: first consequence call uses tenant API key');
  equal(checkout?.authBoundary, 'account_session', 'Hosted journey contract: checkout uses account session');
  ok(checkout?.requiredHeaders.includes('Idempotency-Key'), 'Hosted journey contract: checkout requires Idempotency-Key');
  ok(checkout?.requiredHeaders.includes('x-attestor-csrf'), 'Hosted journey contract: checkout requires CSRF confirmation for cookie sessions');
  ok(billingPortal?.requiredHeaders.includes('x-attestor-csrf'), 'Hosted journey contract: billing portal requires CSRF confirmation for cookie sessions');
  ok(issueApiKey?.requiredHeaders.includes('x-attestor-csrf'), 'Hosted journey contract: API key issuance requires CSRF confirmation for cookie sessions');
  equal(billingExport?.authBoundary, 'account_session_or_tenant_api_key', 'Hosted journey contract: billing export can be read from account plane or tenant API key');
  equal(billingReconciliation?.authBoundary, 'account_session', 'Hosted journey contract: billing reconciliation stays account-session bound');
  equal(webhook?.authBoundary, 'stripe_signature', 'Hosted journey contract: webhook uses Stripe signature');
  ok(webhook?.failureSignals.some((signal) => signal.includes('payload hash')), 'Hosted journey contract: webhook conflict handling is explicit');
}

function testStepContractsUseKnownRoutes(): void {
  const knownRouteKeys = new Set(HOSTED_JOURNEY_ROUTE_CONTRACTS.map((route) => route.key));
  const stepIds = HOSTED_JOURNEY_STEP_CONTRACTS.map((step) => step.id);

  deepEqual(
    stepIds,
    [
      'create-hosted-account',
      'inspect-evaluation-state',
      'make-first-attestor-call',
      'upgrade-through-checkout',
      'converge-billing-state',
      'operate-account-plane',
    ],
    'Hosted journey contract: step order is stable',
  );

  for (const step of HOSTED_JOURNEY_STEP_CONTRACTS) {
    ok(step.routeKeys.length > 0, `Hosted journey contract: ${step.id} has route keys`);
    ok(
      step.routeKeys.every((routeKey) => knownRouteKeys.has(routeKey)),
      `Hosted journey contract: ${step.id} references known route keys`,
    );
    ok(step.successSignals.length > 0, `Hosted journey contract: ${step.id} declares success signals`);
    ok(step.failureSignals.length > 0, `Hosted journey contract: ${step.id} declares failure signals`);
  }
}

function testApiTypeContractsExist(): void {
  const apiTypes = readProjectFile('src', 'service', 'api-types.ts');
  const expectedTypes = [
    'AuthSignupRequest',
    'AuthSignupResponse',
    'AccountSummaryResponse',
    'AccountUsageResponse',
    'AccountFeaturesResponse',
    'AccountBillingCheckoutResponse',
    'AccountBillingPortalResponse',
    'AccountBillingExportResponse',
    'AccountBillingReconciliationResponse',
    'AccountApiKeysListResponse',
    'AccountIssueApiKeyResponse',
    'VerifyResponse',
  ];

  for (const typeName of expectedTypes) {
    ok(apiTypes.includes(`interface ${typeName}`), `Hosted journey contract: ${typeName} exists in API types`);
  }
}

function testDocsReflectContract(): void {
  const contractDoc = readProjectFile('docs', '01-overview', 'hosted-journey-contract.md');
  const customerJourney = readProjectFile('docs', '01-overview', 'hosted-customer-journey.md');
  const packaging = readProjectFile('docs', '01-overview', 'product-packaging.md');
  const deployment = readProjectFile('docs', '08-deployment', 'deployment.md');
  const normalizedDeployment = deployment.replace(/\s+/gu, ' ');
  const edgeContract = readProjectFile('src', 'service', 'http-production-edge-contract.ts');
  const apiServer = readProjectFile('src', 'service', 'api-server.ts');

  ok(contractDoc.includes('This is the canonical customer journey contract'), 'Hosted journey contract: doc states canonical role');
  ok(contractDoc.includes('src/service/hosted-journey-contract.ts'), 'Hosted journey contract: doc links machine-readable descriptor');
  ok(contractDoc.includes('Operating model](operating-model.md)'), 'Hosted journey contract: doc links operating model');
  ok(contractDoc.includes('First hosted API call](hosted-first-api-call.md)'), 'Hosted journey contract: doc links first API-call quickstart');
  ok(contractDoc.includes('Finance and crypto first integrations](finance-and-crypto-first-integrations.md)'), 'Hosted journey contract: doc links first integration examples');
  ok(contractDoc.includes('Hosted account visibility](hosted-account-visibility.md)'), 'Hosted journey contract: doc links account visibility guide');
  ok(contractDoc.includes('Attestor does not auto-detect what pack to run'), 'Hosted journey contract: doc rejects auto-detect promise');
  ok(contractDoc.includes('Idempotency-Key'), 'Hosted journey contract: doc names checkout idempotency');
  ok(contractDoc.includes('Stripe-Signature'), 'Hosted journey contract: doc names webhook signature boundary');
  ok(customerJourney.includes('Hosted journey contract](hosted-journey-contract.md)'), 'Hosted journey contract: hosted journey links contract');
  ok(customerJourney.includes('Hosted account visibility](hosted-account-visibility.md)'), 'Hosted journey contract: hosted journey links account visibility guide');
  ok(packaging.includes('Hosted journey contract](hosted-journey-contract.md)'), 'Hosted journey contract: packaging links contract');
  ok(normalizedDeployment.includes('header-presence CSRF boundary'), 'Hosted journey contract: deployment doc names header-presence CSRF boundary');
  ok(normalizedDeployment.includes('not a synchronizer-token or'), 'Hosted journey contract: deployment doc rejects token-binding overclaim');
  ok(normalizedDeployment.includes('does not validate the header value'), 'Hosted journey contract: deployment doc states CSRF header value is not session-bound');
  ok(normalizedDeployment.includes('does not install permissive CORS response headers'), 'Hosted journey contract: deployment doc states repo-side CORS boundary');
  ok(normalizedDeployment.includes('no-go for cookie-authenticated account mutations'), 'Hosted journey contract: deployment doc states permissive CORS no-go');
  ok(normalizedDeployment.includes('Sec-Fetch-Site: cross-site'), 'Hosted journey contract: deployment doc states Fetch Metadata cross-site rejection');
  ok(normalizedDeployment.includes('ATTESTOR_ACCOUNT_SESSION_ALLOWED_ORIGINS'), 'Hosted journey contract: deployment doc names account-session allowed origin env');
  ok(normalizedDeployment.includes('exact only'), 'Hosted journey contract: deployment doc rejects wildcard-style allowed origins');
  assert.doesNotMatch(edgeContract, /Access-Control-Allow-Origin/iu, 'Hosted journey contract: edge contract does not install permissive CORS allow-origin');
  passed += 1;
  assert.doesNotMatch(apiServer, /hono\/cors|cors\(/iu, 'Hosted journey contract: API server does not install Hono CORS middleware');
  passed += 1;
}

async function main(): Promise<void> {
  testDescriptorShape();
  testTruthSources();
  testRouteContractsMapToShippedRoutes();
  testRouteContractsStayFocused();
  testAuthAndBillingBoundaries();
  testStepContractsUseKnownRoutes();
  testApiTypeContractsExist();
  testDocsReflectContract();

  ok(passed > 0, 'Hosted journey contract: tests executed');
  console.log(`\nHosted product flow contract tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nHosted product flow contract tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
