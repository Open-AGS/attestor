import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

type OpenApiDocument = {
  readonly openapi: string;
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description: string;
  };
  readonly security: readonly Record<string, readonly string[]>[];
  readonly paths: Readonly<Record<string, unknown>>;
  readonly components: {
    readonly securitySchemes: Readonly<Record<string, unknown>>;
    readonly schemas: Readonly<Record<string, unknown>>;
    readonly responses: Readonly<Record<string, unknown>>;
    readonly headers: Readonly<Record<string, unknown>>;
  };
  readonly 'x-attestor-boundary': {
    readonly evaluationRelease: boolean;
    readonly productionReady: boolean;
    readonly complianceClaimed: boolean;
    readonly autoEnforceFromShadowReads: boolean;
    readonly rawPayloadStoredByShadowReads: boolean;
    readonly rawToolPayloadStoredByShadowReads: boolean;
    readonly providerBodiesExposedToModel: boolean;
    readonly modelSafeFeedbackOnly: boolean;
    readonly toolExecutionAuthorityGranted: boolean;
    readonly unsafeRetryAuthorityGranted: boolean;
    readonly publicHostedCryptoRouteClaimed: boolean;
  };
};

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function spec(): OpenApiDocument {
  return JSON.parse(
    readProjectFile('docs', 'api', 'attestor-action-authorization.openapi.json'),
  ) as OpenApiDocument;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(!content.includes(unexpected), `${message}\nDid not expect to find: ${unexpected}`);
  passed += 1;
}

function testOpenApiContractIsBoundedAndCurrent(): void {
  const document = spec();

  equal(document.openapi, '3.2.0', 'Hosted OpenAPI: contract uses the current OpenAPI version');
  equal(document.info.title, 'Attestor Action Authorization API', 'Hosted OpenAPI: title names the action authorization surface');
  equal(document.info.version, '0.2.0-evaluation', 'Hosted OpenAPI: version keeps evaluation release boundary');
  includes(document.info.description, 'not a production readiness claim', 'Hosted OpenAPI: description avoids production overclaim');
  includes(document.info.description, 'wallet/custody API', 'Hosted OpenAPI: description avoids custody overclaim');
  ok(
    document.security.some((entry) => Array.isArray(entry.bearerAuth)),
    'Hosted OpenAPI: bearer auth is required by default',
  );
  ok(
    Boolean(document.components.securitySchemes.bearerAuth),
    'Hosted OpenAPI: bearer auth scheme is defined',
  );
}

function testOpenApiContractListsOnlyCommittedActionAuthorizationRoutes(): void {
  const paths = Object.keys(spec().paths).sort();

  for (const expected of [
    '/api/v1/admissions',
    '/api/v1/shadow/action-risk-inventory',
    '/api/v1/shadow/audit-evidence',
    '/api/v1/shadow/business-risk-dashboard',
    '/api/v1/shadow/dashboard-summary',
    '/api/v1/shadow/policy-candidates',
    '/api/v1/shadow/recommendations',
    '/api/v1/shadow/summary',
  ]) {
    ok(paths.includes(expected), `Hosted OpenAPI: includes ${expected}`);
  }

  for (const unexpected of [
    '/api/v1/admit',
    '/api/v1/crypto',
    '/api/v1/wallet',
    '/api/v1/custody',
  ]) {
    ok(!paths.includes(unexpected), `Hosted OpenAPI: excludes unsupported route ${unexpected}`);
  }
}

function testOpenApiContractPreservesFailClosedAndNoStoreShape(): void {
  const document = spec();
  const text = JSON.stringify(document);
  const failClosedProblem = document.components.schemas.FailClosedProblem as {
    readonly properties: Readonly<Record<string, unknown>>;
    readonly required: readonly string[];
  };

  ok(Boolean(document.components.responses.FailClosedProblem), 'Hosted OpenAPI: fail-closed problem response is reusable');
  ok(Boolean(document.components.headers.NoStore), 'Hosted OpenAPI: no-store header is reusable');
  ok(failClosedProblem.required.includes('decision'), 'Hosted OpenAPI: problem requires decision');
  ok(failClosedProblem.required.includes('failClosed'), 'Hosted OpenAPI: problem requires failClosed');
  ok(failClosedProblem.required.includes('reasonCodes'), 'Hosted OpenAPI: problem requires reason codes');
  includes(text, '"Cache-Control"', 'Hosted OpenAPI: responses document Cache-Control');
  includes(text, '"no-store"', 'Hosted OpenAPI: responses document no-store posture');
  includes(text, '"const":"block"', 'Hosted OpenAPI: problem decision is block');
  includes(text, '"const":true', 'Hosted OpenAPI: problem failClosed is true');
}

function testOpenApiContractPreservesShadowBoundaries(): void {
  const document = spec();
  const text = JSON.stringify(document);
  const boundary = document['x-attestor-boundary'];

  equal(boundary.evaluationRelease, true, 'Hosted OpenAPI: evaluation boundary is explicit');
  equal(boundary.productionReady, false, 'Hosted OpenAPI: production readiness is not claimed');
  equal(boundary.complianceClaimed, false, 'Hosted OpenAPI: compliance is not claimed');
  equal(boundary.autoEnforceFromShadowReads, false, 'Hosted OpenAPI: shadow reads cannot auto-enforce');
  equal(boundary.rawPayloadStoredByShadowReads, false, 'Hosted OpenAPI: shadow reads stay data-minimized');
  equal(boundary.rawToolPayloadStoredByShadowReads, false, 'Hosted OpenAPI: shadow reads cannot store raw tool payloads');
  equal(boundary.providerBodiesExposedToModel, false, 'Hosted OpenAPI: provider bodies are not model-facing');
  equal(boundary.modelSafeFeedbackOnly, true, 'Hosted OpenAPI: admission feedback is model-safe only');
  equal(boundary.toolExecutionAuthorityGranted, false, 'Hosted OpenAPI: admission responses do not grant tool execution authority');
  equal(boundary.unsafeRetryAuthorityGranted, false, 'Hosted OpenAPI: unsafe retry authority is not granted');
  equal(boundary.publicHostedCryptoRouteClaimed, false, 'Hosted OpenAPI: hosted crypto route is not claimed');
  includes(text, '"ModelSafeFeedback"', 'Hosted OpenAPI: model-safe feedback schema is documented');
  includes(text, '"safeForModel"', 'Hosted OpenAPI: model-safe feedback flag is documented');
  includes(text, '"safeInstruction"', 'Hosted OpenAPI: safe instruction boundary is documented');
  includes(text, '"operatorOnlyReasonCodes"', 'Hosted OpenAPI: operator-only retry boundary is documented');
  includes(text, '"observedFeatureOrigins"', 'Hosted OpenAPI: observed feature origin markers are documented');
  includes(text, '"operator-attested"', 'Hosted OpenAPI: operator-attested feature origin is documented');
  includes(text, '"caller-supplied"', 'Hosted OpenAPI: caller-supplied feature origin is explicitly classified');
  includes(text, '"authoritySources"', 'Hosted OpenAPI: authority-source contract is documented');
  includes(text, '"approvals"', 'Hosted OpenAPI: approval provenance contract is documented');
  includes(text, '"noGoConditions"', 'Hosted OpenAPI: no-go condition contract is documented');
  includes(text, '"noGoNaturalLanguageSignals"', 'Hosted OpenAPI: no-go bypass signal contract is documented');
  includes(text, '"fraud-hold"', 'Hosted OpenAPI: no-go hold kind is documented');
  includes(text, '"production-freeze"', 'Hosted OpenAPI: production freeze no-go kind is documented');
  includes(text, '"noGoBypassAttemptRef"', 'Hosted OpenAPI: no-go bypass reference is documented');
  includes(text, '"verified-approval"', 'Hosted OpenAPI: trusted approval source kind is documented');
  includes(text, '"approval-workflow"', 'Hosted OpenAPI: approval workflow provenance source is documented');
  includes(text, '"approvalDigest"', 'Hosted OpenAPI: approval digest provenance is documented');
  includes(text, '"reviewerAuthorityDigest"', 'Hosted OpenAPI: reviewer authority digest is documented');
  includes(text, '"customer-email"', 'Hosted OpenAPI: untrusted customer email source kind is documented');
  includes(text, '"llm-summary"', 'Hosted OpenAPI: model-generated source kind is documented');
  includes(text, '"approvalRequired"', 'Hosted OpenAPI: approval boundary is documented');
  includes(text, '"autoEnforce"', 'Hosted OpenAPI: autoEnforce boundary is documented');
  includes(text, '"decisionSupportOnly"', 'Hosted OpenAPI: dashboard is decision support only');
  includes(text, '"impactMode"', 'Hosted OpenAPI: dashboard impact mode is explicit');
  includes(text, '"rawImpactValueStored"', 'Hosted OpenAPI: raw impact boundary is explicit');
  includes(text, '/api/v1/shadow/dashboard-summary', 'Hosted OpenAPI: dashboard summary route is documented');
}

function testDocsPointToTheOpenApiTruthSource(): void {
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '01-overview', 'hosted-action-authorization-api.md');

  includes(readme, 'Hosted action authorization API', 'Hosted OpenAPI docs: README links the API contract guide');
  includes(readme, 'docs/01-overview/hosted-action-authorization-api.md', 'Hosted OpenAPI docs: README link points at guide');
  includes(doc, 'docs/api/attestor-action-authorization.openapi.json', 'Hosted OpenAPI docs: guide points at OpenAPI file');
  includes(doc, '`POST /api/v1/admissions`', 'Hosted OpenAPI docs: guide names the canonical admission route');
  includes(doc, '`GET /api/v1/shadow/dashboard-summary`', 'Hosted OpenAPI docs: guide names dashboard summary route');
  includes(doc, 'RFC 9457-style problem details', 'Hosted OpenAPI docs: guide names problem details boundary');
  includes(doc, 'no-go condition state must arrive as structured `noGoConditions` metadata', 'Hosted OpenAPI docs: guide documents no-go metadata');
  includes(doc, 'no public hosted crypto HTTP route is claimed', 'Hosted OpenAPI docs: guide avoids hosted crypto overclaim');
  excludes(doc, 'POST /api/v1/admit', 'Hosted OpenAPI docs: guide does not revive old route placeholder');
}

testOpenApiContractIsBoundedAndCurrent();
testOpenApiContractListsOnlyCommittedActionAuthorizationRoutes();
testOpenApiContractPreservesFailClosedAndNoStoreShape();
testOpenApiContractPreservesShadowBoundaries();
testDocsPointToTheOpenApiTruthSource();

console.log(`Hosted action authorization OpenAPI tests: ${passed} passed, 0 failed`);
