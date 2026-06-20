import assert from 'node:assert/strict';
import type { Hono } from 'hono';
import {
  createDpopProof,
  createInMemoryReleaseTokenIntrospectionStore,
  generateDpopKeyPair,
  Hono as HonoConstructor,
  issueGenericAdmissionProtectedReleaseToken,
  registerGenericAdmissionRoutes,
  releaseTokenIssuerFixture,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
  validAdmissionPayload,
} from './generic-admission-routes/helpers.js';
import {
  controlledDataExportIntentDigest,
  createGenericAdmissionEnvelope,
  evaluateConsequenceAdmissionGateWithReleaseEnforcement,
  evaluateControlledDataExportGate,
  type ControlledDataExportAllowedScope,
  type ControlledDataExportIntent,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import {
  createDpopBoundReleasePresentation,
  dpopReplayKey,
  type DpopKeyPair,
} from '../src/release-enforcement-plane/dpop.js';
import { createEnforcementRequest } from '../src/release-enforcement-plane/object-model.js';
import { verifyOnlineReleaseAuthorization } from '../src/release-enforcement-plane/online-verifier.js';
import {
  createReleaseTokenIntrospector,
  type RegisteredReleaseToken,
  type ReleaseTokenIntrospectionStore,
  type ReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import type { ReleaseTokenVerificationKey } from '../src/release-kernel/release-token.js';
import type { ReplayLedgerEntry } from '../src/release-enforcement-plane/freshness.js';
import type {
  EnforcementRequest,
  ReleasePresentation,
} from '../src/release-enforcement-plane/object-model.js';
import type { OnlineReleaseVerification } from '../src/release-enforcement-plane/online-verifier.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

const TENANT_ID = 'tenant_route';
const ADMISSION_ROUTE_URL = 'https://attestor.test/api/v1/admissions';
const DATA_EXPORT_TARGET = 'data-export-sandbox';
const DATA_EXPORT_ACTION = 'export_controlled_report';
const PEP_ID = 'data-export-sandbox-pep';
const GENERATED_AT = '2026-06-05T10:00:00.000Z';

type AdmissionProofBody = {
  readonly admission: GenericAdmissionEnvelope['admission'];
  readonly protectedReleaseToken: {
    readonly issued: boolean;
    readonly tokenId: string;
    readonly tokenDigest: string;
    readonly releaseDecisionId: string;
    readonly audience: string;
    readonly tenantId: string;
    readonly expiresAt: string;
    readonly senderConstrained: boolean;
    readonly introspectionRequired: boolean;
    readonly replayConsumptionRequired: boolean;
    readonly introspectionAuthorityRegistered: boolean;
    readonly rawReleaseTokenStored: boolean;
  };
  readonly protectedReleaseTokenAuthorization: {
    readonly token: string;
    readonly tokenId: string;
    readonly tokenDigest: string;
    readonly audience: string;
    readonly expiresAt: string;
    readonly storeRawTokenInAdmissionOrShadow: boolean;
  };
};

type AdmissionHarness = {
  readonly app: Hono;
  readonly dpop: DpopKeyPair;
  readonly introspectionStore: ReleaseTokenIntrospectionStore;
  readonly introspector: ReleaseTokenIntrospector;
  readonly verificationKey: ReleaseTokenVerificationKey;
  readonly recordedEnvelopes: readonly GenericAdmissionEnvelope[];
};

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function withFreshAdmissionTimes(payload: Record<string, unknown>): Record<string, unknown> {
  const approvals = Array.isArray(payload.approvals)
    ? payload.approvals.map((approval) => ({
        ...(approval as Record<string, unknown>),
        issuedAt: isoNow(-60_000),
        expiresAt: isoNow(10 * 60_000),
      }))
    : payload.approvals;
  return {
    ...payload,
    requestedAt: isoNow(-1_000),
    decidedAt: isoNow(),
    approvals,
  };
}

function baseExportIntent(overrides: Partial<ControlledDataExportIntent> = {}):
ControlledDataExportIntent {
  return {
    tenantId: TENANT_ID,
    targetId: DATA_EXPORT_TARGET,
    action: DATA_EXPORT_ACTION,
    classification: 'internal',
    fields: ['monthly_count', 'region', 'risk_band'],
    recordCount: 250,
    recipientRef: 'recipient:internal-analytics',
    purposeRef: 'purpose:monthly-risk-report',
    idempotencyKey: 'idem-data-export-m02b',
    ...overrides,
  };
}

function baseAllowedScope(overrides: Partial<ControlledDataExportAllowedScope> = {}):
ControlledDataExportAllowedScope {
  return {
    classification: 'internal',
    fields: ['monthly_count', 'region', 'risk_band'],
    maxRecordCount: 250,
    recipientRef: 'recipient:internal-analytics',
    purposeRef: 'purpose:monthly-risk-report',
    ...overrides,
  };
}

function dataMovementAdmissionPayload(
  intent: ControlledDataExportIntent,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return withFreshAdmissionTimes(validAdmissionPayload({
    action: DATA_EXPORT_ACTION,
    domain: 'data-disclosure',
    downstreamSystem: DATA_EXPORT_TARGET,
    policyRef: 'policy:data-export:v1',
    actor: 'analytics-ai-agent',
    reviewerRef: 'reviewer:data-owner',
    evidenceRefs: ['query-plan:digest-only', 'classification:internal-aggregate'],
    dataScope: {
      records: intent.recordCount,
      classification: intent.classification,
      fields: intent.fields,
    },
    amount: null,
    recipient: null,
    nativeInputRefs: [controlledDataExportIntentDigest(intent)],
    summary: 'analytics-ai-agent proposes a controlled aggregate data export.',
    ...overrides,
  }));
}

async function createHarness(): Promise<AdmissionHarness> {
  const app = new HonoConstructor();
  const issuer = releaseTokenIssuerFixture();
  const dpop = await generateDpopKeyPair();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(introspectionStore);
  const recordedEnvelopes: GenericAdmissionEnvelope[] = [];

  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: TENANT_ID,
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-data-movement-test-plan',
      monthlyRunQuota: 100,
    }),
    resolveProtectedReleaseTokenConfirmation: async ({ context, receivedAt }) => {
      const confirmation =
        await resolveHostedGenericAdmissionDpopSenderConfirmation({
          proofJwt: context.req.header('DPoP') ?? null,
          httpMethod: context.req.method,
          httpUri: context.req.url,
          now: receivedAt,
        });
      return confirmation.confirmation;
    },
    issueProtectedReleaseToken: ({ envelope, receivedAt, senderConfirmation }) =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        introspectionStore,
        confirmation: senderConfirmation ?? null,
        issuedAt: receivedAt,
      }),
    recordShadowAdmission: ({ envelope }) => {
      recordedEnvelopes.push(envelope);
    },
  });

  return {
    app,
    dpop,
    introspectionStore,
    introspector,
    verificationKey: await issuer.exportVerificationKey(),
    recordedEnvelopes,
  };
}

async function postAdmission(input: {
  readonly harness: AdmissionHarness;
  readonly intent: ControlledDataExportIntent;
  readonly proofJti: string;
  readonly overrides?: Record<string, unknown>;
}): Promise<{
  readonly response: Response;
  readonly body: AdmissionProofBody;
}> {
  const proof = await createDpopProof({
    privateJwk: input.harness.dpop.privateJwk,
    publicJwk: input.harness.dpop.publicJwk,
    httpMethod: 'POST',
    httpUri: ADMISSION_ROUTE_URL,
    proofJti: input.proofJti,
    issuedAt: isoNow(),
  });
  const response = await input.harness.app.request(ADMISSION_ROUTE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      DPoP: proof.proofJwt,
    },
    body: JSON.stringify(dataMovementAdmissionPayload(input.intent, input.overrides ?? {})),
  });
  return {
    response,
    body: await response.json() as AdmissionProofBody,
  };
}

function registeredTokenFor(
  harness: AdmissionHarness,
  body: AdmissionProofBody,
): RegisteredReleaseToken {
  const record = harness.introspectionStore.findToken(
    body.protectedReleaseTokenAuthorization.tokenId,
  );
  if (record === null) {
    throw new Error('Expected route-issued protected token to be registered for introspection.');
  }
  return record;
}

function releaseEnforcementRequestFor(input: {
  readonly body: AdmissionProofBody;
  readonly record: RegisteredReleaseToken;
  readonly targetId?: string;
}): EnforcementRequest {
  const targetId = input.targetId ?? input.record.audience;
  return createEnforcementRequest({
    id: `erq-data-export-m02b-${targetId}`,
    receivedAt: isoNow(),
    enforcementPoint: {
      environment: 'local-engine-proof',
      enforcementPointId: PEP_ID,
      pointKind: 'application-middleware',
      boundaryKind: 'http-request',
      consequenceType: input.record.consequenceType,
      riskClass: input.record.riskClass,
      tenantId: TENANT_ID,
      audience: targetId,
    },
    targetId,
    outputHash: input.record.outputHash,
    consequenceHash: input.record.consequenceHash,
    releaseTokenId: input.record.tokenId,
    releaseDecisionId: input.record.decisionId,
    requester: {
      id: 'svc.data-export-sandbox',
      type: 'service',
    },
    idempotencyKey: 'idem-data-export-m02b-release-enforcement',
    transport: {
      kind: 'http',
      method: 'POST',
      uri: 'https://data-export-sandbox.local/admission-gate',
      headersDigest: `sha256:${'4'.repeat(64)}`,
      bodyDigest: input.body.admission.digest,
    },
  });
}

async function releasePresentationFor(input: {
  readonly body: AdmissionProofBody;
  readonly dpop: DpopKeyPair;
  readonly request: EnforcementRequest;
  readonly nonce: string;
  readonly proofJti: string;
}): Promise<{
  readonly proofJwt: string;
  readonly presentation: ReleasePresentation;
}> {
  const proof = await createDpopProof({
    privateJwk: input.dpop.privateJwk,
    publicJwk: input.dpop.publicJwk,
    httpMethod: input.request.transport?.kind === 'http'
      ? input.request.transport.method
      : 'POST',
    httpUri: input.request.transport?.kind === 'http'
      ? input.request.transport.uri
      : 'https://data-export-sandbox.local/admission-gate',
    accessToken: input.body.protectedReleaseTokenAuthorization.token,
    nonce: input.nonce,
    proofJti: input.proofJti,
    issuedAt: isoNow(),
  });
  const presentation = createDpopBoundReleasePresentation({
    proof,
    releaseToken: input.body.protectedReleaseTokenAuthorization.token,
    releaseTokenId: input.body.protectedReleaseTokenAuthorization.tokenId,
    issuer: 'attestor.generic-admission.route.test',
    subject: `releaseDecision:${input.body.protectedReleaseToken.releaseDecisionId}`,
    audience: input.body.protectedReleaseTokenAuthorization.audience,
    expiresAt: input.body.protectedReleaseTokenAuthorization.expiresAt,
    presentedAt: isoNow(),
    scope: ['data-disclosure:export_controlled_report'],
  });
  return {
    proofJwt: proof.proofJwt,
    presentation,
  };
}

async function verifyReleaseEnforcement(input: {
  readonly harness: AdmissionHarness;
  readonly body: AdmissionProofBody;
  readonly targetId?: string;
  readonly nonce: string;
  readonly proofJti: string;
  readonly replayLedgerEntry?: ReplayLedgerEntry | null;
  readonly consumeOnSuccess?: boolean;
}): Promise<{
  readonly request: EnforcementRequest;
  readonly proofJwt: string;
  readonly releaseEnforcement: OnlineReleaseVerification;
}> {
  const record = registeredTokenFor(input.harness, input.body);
  const request = releaseEnforcementRequestFor({
    body: input.body,
    record,
    targetId: input.targetId,
  });
  const { proofJwt, presentation } = await releasePresentationFor({
    body: input.body,
    dpop: input.harness.dpop,
    request,
    nonce: input.nonce,
    proofJti: input.proofJti,
  });
  const releaseEnforcement = await verifyOnlineReleaseAuthorization({
    request,
    presentation,
    verificationKey: input.harness.verificationKey,
    now: isoNow(),
    introspector: input.harness.introspector,
    usageStore: input.harness.introspectionStore,
    consumeOnSuccess: input.consumeOnSuccess ?? true,
    forceOnlineIntrospection: true,
    replayLedgerEntry: input.replayLedgerEntry ?? null,
    nonceLedgerEntry: {
      nonce: input.nonce,
      issuedAt: isoNow(-1_000),
      expiresAt: isoNow(60_000),
    },
    resourceServerId: PEP_ID,
  });
  return { request, proofJwt, releaseEnforcement };
}

async function createProceedingGate(input: {
  readonly intent: ControlledDataExportIntent;
  readonly proofPrefix: string;
  readonly overrides?: Record<string, unknown>;
}): Promise<{
  readonly harness: AdmissionHarness;
  readonly body: AdmissionProofBody;
  readonly proofJwt: string;
  readonly releaseEnforcement: OnlineReleaseVerification;
  readonly customerGate: ReturnType<typeof evaluateConsequenceAdmissionGateWithReleaseEnforcement>;
}> {
  const harness = await createHarness();
  const { response, body } = await postAdmission({
    harness,
    intent: input.intent,
    proofJti: `dpop-admission-${input.proofPrefix}`,
    overrides: input.overrides,
  });
  equal(response.status, 200, `M02B: real admission route accepts ${input.proofPrefix}`);
  const { proofJwt, releaseEnforcement } = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: `nonce-${input.proofPrefix}`,
    proofJti: `dpop-release-${input.proofPrefix}`,
  });
  const customerGate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: body.admission,
    downstreamAction: DATA_EXPORT_TARGET,
    releaseEnforcement,
    releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
  });
  return { harness, body, proofJwt, releaseEnforcement, customerGate };
}

async function testFullRoutePepGateExportsAndProofPacket(): Promise<void> {
  const intent = baseExportIntent();
  const { harness, body, proofJwt, customerGate } = await createProceedingGate({
    intent,
    proofPrefix: 'm02b-happy',
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: intent,
    allowedScope: baseAllowedScope(),
    generatedAt: GENERATED_AT,
    enforcementPointId: 'controlled-data-export-gate',
  });
  const serialized = JSON.stringify(result.proofPacket);

  equal(customerGate.outcome, 'proceed', 'M02B: release-enforcement customer gate proceeds');
  equal(result.outcome, 'executed', 'M02B: export gate executes after valid PEP decision');
  equal(result.downstreamDecision.outcome, 'allow', 'M02B: downstream contract allows the export');
  equal(result.receipt.rawRowsStored, false, 'M02B: receipt stores no raw rows');
  equal(result.proofPacket.rawReleaseTokenStored, false, 'M02B: proof packet stores no raw release token');
  equal(result.proofPacket.rawSenderProofStored, false, 'M02B: proof packet stores no sender proof');
  equal(result.proofPacket.rawPayloadStored, false, 'M02B: proof packet stores no raw payload');
  equal(result.proofPacket.rawRowsStored, false, 'M02B: proof packet stores no raw rows');
  equal(result.proofPacket.liveProviderCalled, false, 'M02B: local export gate does not call a live provider');
  equal(result.proofPacket.productionReady, false, 'M02B: proof packet does not claim production readiness');
  equal(
    result.proofPacket.customerPepNoBypassProven,
    false,
    'M02B: proof packet does not claim live customer PEP no-bypass',
  );
  ok(
    body.admission.request.nativeInputRefs.includes(result.requestedScope.scopeDigest),
    'M02B: admission carries the digest-bound export intent ref',
  );
  equal(serialized.includes(body.protectedReleaseTokenAuthorization.token), false, 'M02B: proof packet excludes raw token');
  equal(serialized.includes(proofJwt), false, 'M02B: proof packet excludes raw DPoP proof');
  equal(serialized.includes('monthly_count'), false, 'M02B: proof packet excludes raw field names');
  equal(serialized.includes('risk_band'), false, 'M02B: proof packet excludes raw field names');
  equal(serialized.includes('recipient:internal-analytics'), false, 'M02B: proof packet excludes raw recipient ref');
  ok(
    harness.recordedEnvelopes.length === 1 &&
      !JSON.stringify(harness.recordedEnvelopes[0]).includes(
        body.protectedReleaseTokenAuthorization.token,
      ),
    'M02B: recorded admission envelope excludes caller raw token material',
  );
}

async function testExportIntentDigestMustMatchAdmissionNativeRef(): Promise<void> {
  const admittedIntent = baseExportIntent();
  const alteredIntent = baseExportIntent({
    fields: ['monthly_count', 'region', 'risk_band', 'raw_customer_id'],
  });
  const { body, customerGate } = await createProceedingGate({
    intent: admittedIntent,
    proofPrefix: 'm02b-intent-mismatch',
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: alteredIntent,
    allowedScope: baseAllowedScope({
      fields: ['monthly_count', 'region', 'risk_band', 'raw_customer_id'],
    }),
    generatedAt: GENERATED_AT,
  });

  equal(result.outcome, 'blocked', 'M02B: missing export-intent proof blocks export');
  ok(
    result.failureReasons.includes('export-intent-proof-missing'),
    'M02B: missing export-intent proof reason is explicit',
  );
  equal(result.receipt.receiptId, null, 'M02B: blocked export emits no downstream receipt id');
}

async function testWrongTenantCannotExport(): Promise<void> {
  const intent = baseExportIntent();
  const { body, customerGate } = await createProceedingGate({
    intent,
    proofPrefix: 'm02b-wrong-tenant',
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: baseExportIntent({ tenantId: 'tenant_other' }),
    allowedScope: baseAllowedScope(),
    generatedAt: GENERATED_AT,
  });

  equal(result.outcome, 'blocked', 'M02B: wrong tenant cannot export');
  ok(result.failureReasons.includes('tenant-mismatch'), 'M02B: tenant mismatch reason is explicit');
  equal(result.receipt.executedRecordCount, 0, 'M02B: wrong tenant executes zero records');
}

async function testWrongTargetCannotExport(): Promise<void> {
  const intent = baseExportIntent();
  const { body, customerGate } = await createProceedingGate({
    intent,
    proofPrefix: 'm02b-wrong-target',
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: baseExportIntent({ targetId: 'data-export-sandbox-other' }),
    allowedScope: baseAllowedScope(),
    generatedAt: GENERATED_AT,
  });

  equal(result.outcome, 'blocked', 'M02B: wrong target cannot export');
  ok(result.failureReasons.includes('target-mismatch'), 'M02B: target mismatch reason is explicit');
  equal(result.receipt.receiptId, null, 'M02B: wrong target emits no downstream receipt id');
}

async function testConsumedTokenCannotExportAgain(): Promise<void> {
  const intent = baseExportIntent();
  const harness = await createHarness();
  const { body } = await postAdmission({
    harness,
    intent,
    proofJti: 'dpop-admission-m02b-replay',
  });
  const first = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-m02b-first-use',
    proofJti: 'dpop-release-m02b-first-use',
  });
  equal(first.releaseEnforcement.status, 'valid', 'M02B: first protected token use is valid');

  const second = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-m02b-second-use',
    proofJti: 'dpop-release-m02b-second-use',
  });
  const customerGate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: body.admission,
    downstreamAction: DATA_EXPORT_TARGET,
    releaseEnforcement: second.releaseEnforcement,
    releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: intent,
    allowedScope: baseAllowedScope(),
    generatedAt: GENERATED_AT,
  });

  equal(second.releaseEnforcement.status, 'invalid', 'M02B: reused consumed token is invalid');
  ok(
    second.releaseEnforcement.failureReasons.includes('replayed-authorization'),
    'M02B: reused token reports replayed authorization',
  );
  equal(result.outcome, 'blocked', 'M02B: invalid replayed token cannot export');
  ok(
    result.failureReasons.includes('release-enforcement-proof-invalid'),
    'M02B: export gate records invalid release-enforcement proof',
  );
}

async function testReplayedProofCannotExport(): Promise<void> {
  const intent = baseExportIntent();
  const harness = await createHarness();
  const { body } = await postAdmission({
    harness,
    intent,
    proofJti: 'dpop-admission-m02b-replayed-proof',
  });
  const replayLedgerEntry: ReplayLedgerEntry = {
    subjectKind: 'dpop-proof',
    key: dpopReplayKey('dpop-release-m02b-replayed-proof'),
    firstSeenAt: isoNow(-500),
    expiresAt: isoNow(60_000),
  };
  const replayed = await verifyReleaseEnforcement({
    harness,
    body,
    nonce: 'nonce-m02b-replayed-proof',
    proofJti: 'dpop-release-m02b-replayed-proof',
    replayLedgerEntry,
  });
  const customerGate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
    admission: body.admission,
    downstreamAction: DATA_EXPORT_TARGET,
    releaseEnforcement: replayed.releaseEnforcement,
    releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: intent,
    allowedScope: baseAllowedScope(),
    generatedAt: GENERATED_AT,
  });

  equal(replayed.releaseEnforcement.status, 'invalid', 'M02B: replayed proof is invalid');
  ok(
    replayed.releaseEnforcement.failureReasons.includes('replayed-authorization'),
    'M02B: replayed proof failure is explicit',
  );
  equal(result.outcome, 'blocked', 'M02B: replayed proof cannot export');
  equal(registeredTokenFor(harness, body).status, 'issued', 'M02B: replayed proof does not consume token');
}

async function testNarrowDecisionExportsOnlyNarrowedScope(): Promise<void> {
  const intent = baseExportIntent({
    fields: ['account_id', 'monthly_count', 'region', 'risk_band'],
    recordCount: 250,
  });
  const { body, customerGate } = await createProceedingGate({
    intent,
    proofPrefix: 'm02b-narrow',
    overrides: {
      scopeOwnerPolicyRef: 'policy:data-export-scope:v1',
      requestedScope: {
        recordCount: 250,
        operationType: 'read',
        tenantId: TENANT_ID,
        environment: 'production',
        downstreamSystem: DATA_EXPORT_TARGET,
        dataClass: 'internal',
        reversibilityClass: 'reversible',
      },
      approvedScope: {
        maxRecordCount: 100,
        operationTypes: ['read'],
        tenantId: TENANT_ID,
        environments: ['production'],
        downstreamSystems: [DATA_EXPORT_TARGET],
        dataClasses: ['internal'],
        reversibilityClasses: ['reversible'],
      },
    },
  });
  const result = evaluateControlledDataExportGate({
    admission: body.admission,
    customerGate,
    exportIntent: intent,
    allowedScope: baseAllowedScope({
      fields: ['monthly_count', 'region', 'risk_band'],
      maxRecordCount: 100,
    }),
    acceptedConstraintIds: body.admission.constraints.map((constraint) => constraint.id),
    generatedAt: GENERATED_AT,
  });
  const packet = JSON.stringify(result.proofPacket);

  equal(body.admission.decision, 'narrow', 'M02B: route admission can return narrow');
  ok(
    body.admission.constraints.length > 0,
    'M02B: narrow admission carries executable constraints',
  );
  equal(result.outcome, 'narrowed', 'M02B: export gate narrows the export');
  equal(result.receipt.executedRecordCount, 100, 'M02B: narrowed export uses approved record cap');
  equal(result.receipt.executedFieldCount, 3, 'M02B: narrowed export removes unapproved fields');
  equal(packet.includes('account_id'), false, 'M02B: proof packet excludes removed raw field name');
  equal(packet.includes('monthly_count'), false, 'M02B: proof packet excludes allowed raw field name');
}

async function testObserveReviewAndBlockCannotExport(): Promise<void> {
  const intent = baseExportIntent();
  const { body, releaseEnforcement } = await createProceedingGate({
    intent,
    proofPrefix: 'm02b-mode-blockers',
  });
  const observedAdmission = createGenericAdmissionEnvelope(dataMovementAdmissionPayload(intent, {
    mode: 'observe',
  })).admission;
  const reviewAdmission = createGenericAdmissionEnvelope(dataMovementAdmissionPayload(intent, {
    mode: 'review',
    evidenceRefs: [],
  })).admission;
  const blockAdmission = createGenericAdmissionEnvelope(dataMovementAdmissionPayload(intent, {
    observedFeatures: { blocked: true },
  })).admission;

  for (const [label, admission] of [
    ['observe', observedAdmission],
    ['review', reviewAdmission],
    ['block', blockAdmission],
  ] as const) {
    const customerGate = evaluateConsequenceAdmissionGateWithReleaseEnforcement({
      admission,
      downstreamAction: DATA_EXPORT_TARGET,
      releaseEnforcement,
      releaseTokenDigest: body.protectedReleaseTokenAuthorization.tokenDigest,
    });
    const result = evaluateControlledDataExportGate({
      admission,
      customerGate,
      exportIntent: intent,
      allowedScope: baseAllowedScope(),
      acceptedConstraintIds: admission.constraints.map((constraint) => constraint.id),
      generatedAt: GENERATED_AT,
    });

    equal(customerGate.outcome, 'hold', `M02B: ${label} admission holds at customer gate`);
    equal(
      result.outcome === 'blocked' || result.outcome === 'held-for-review',
      true,
      `M02B: ${label} admission cannot export`,
    );
    equal(result.receipt.executedRecordCount, 0, `M02B: ${label} admission executes zero records`);
  }
}

async function main(): Promise<void> {
  await testFullRoutePepGateExportsAndProofPacket();
  await testExportIntentDigestMustMatchAdmissionNativeRef();
  await testWrongTenantCannotExport();
  await testWrongTargetCannotExport();
  await testConsumedTokenCannotExportAgain();
  await testReplayedProofCannotExport();
  await testNarrowDecisionExportsOnlyNarrowedScope();
  await testObserveReviewAndBlockCannotExport();

  console.log(`Data Movement M02B consequence engine proof tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nData Movement M02B consequence engine proof tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
