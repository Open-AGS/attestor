import { Hono } from 'hono';
import {
  ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER,
  ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER,
  ATTESTOR_POLICY_IR_HASH_HEADER,
  ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER,
  ATTESTOR_POLICY_VERSION_HEADER,
  DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  createHttpMessageSignature,
} from '../src/release-enforcement-plane/http-message-signatures.js';
import {
  ATTESTOR_WEBHOOK_EVENT_ID_HEADER,
  ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER,
  HONO_RELEASE_WEBHOOK_BODY_CONTEXT_KEY,
  HONO_RELEASE_WEBHOOK_RECEIVER_CONTEXT_KEY,
  RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION,
  createHonoReleaseWebhookReceiver,
  evaluateReleaseWebhookRequest,
  releaseWebhookReceiverDeniedBody,
  type HonoReleaseWebhookReceiverEnv,
} from '../src/release-enforcement-plane/webhook-receiver.js';
import {
  createDegradedModeGrant,
  createInMemoryDegradedModeGrantStore,
  degradedModeScopeFromRequest,
  degradedModeScopeMatches,
  grantToBreakGlassGrant,
} from '../src/release-enforcement-plane/degraded-mode.js';
import {
  BODY,
  COMPILED_POLICY_INDEX_VERSION,
  COMPILED_POLICY_IR_VERSION,
  POLICY_HASH,
  POLICY_IR_HASH,
  TARGET_ID,
  deepEqual,
  equal,
  makeEnvelope,
  ok,
  passedCount,
  receiverOptions,
  register,
  replayLedger,
  setupValidWebhook,
} from './release-enforcement-plane-webhook-receiver-fixtures.js';

async function testDirectReceiverAcceptsSignedWebhook(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_valid',
    decisionId: 'decision-webhook-receiver-valid',
    nonce: 'nonce-webhook-valid',
  });
  const { store, introspector } = register(issued, decision);
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      introspector,
      store,
      nonce: 'nonce-webhook-valid',
    }),
  );

  equal(result.version, RELEASE_WEBHOOK_RECEIVER_SPEC_VERSION, 'Webhook receiver: result stamps stable spec version');
  equal(result.status, 'accepted', 'Webhook receiver: accepts valid signed webhook');
  equal(result.responseStatus, 202, 'Webhook receiver: accepted result is admission-ready');
  equal(result.decision?.outcome, 'allow', 'Webhook receiver: valid webhook creates allow decision');
  ok(result.receipt?.receiptDigest?.startsWith('sha256:'), 'Webhook receiver: accepted webhook emits receipt digest');
  equal(result.receipt?.policyHash, POLICY_HASH, 'Webhook receiver: receipt preserves policy hash provenance');
  equal(result.receipt?.policyVersion, 'policy.release-webhook-receiver-test.v1', 'Webhook receiver: receipt preserves policy version provenance');
  equal(result.receipt?.policyIrHash, POLICY_IR_HASH, 'Webhook receiver: receipt preserves compiled policy IR provenance');
  equal(result.receipt?.policyProvenanceSource, 'compiled-admission-policy-index', 'Webhook receiver: receipt preserves policy provenance source');
  equal(result.receipt?.compiledPolicyIndexVersion, COMPILED_POLICY_INDEX_VERSION, 'Webhook receiver: receipt preserves compiled policy index version');
  equal(result.receipt?.compiledPolicyIrVersion, COMPILED_POLICY_IR_VERSION, 'Webhook receiver: receipt preserves compiled policy IR version');
  deepEqual(
    result.verificationResult?.policyContext,
    {
      policyHash: POLICY_HASH,
      policyVersion: 'policy.release-webhook-receiver-test.v1',
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    'Webhook receiver: verification result carries full policy context',
  );
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_POLICY_VERSION_HEADER),
    'Webhook receiver: HTTP signature covers policy version by default',
  );
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_POLICY_IR_HASH_HEADER),
    'Webhook receiver: HTTP signature covers policy IR hash by default',
  );
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_POLICY_PROVENANCE_SOURCE_HEADER),
    'Webhook receiver: HTTP signature covers policy provenance source by default',
  );
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_COMPILED_POLICY_INDEX_VERSION_HEADER),
    'Webhook receiver: HTTP signature covers compiled policy index version by default',
  );
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER),
    'Webhook receiver: HTTP signature covers compiled policy IR version by default',
  );
  equal(result.online?.onlineChecked, true, 'Webhook receiver: webhook path performs online introspection');
  equal(result.online?.consumed, true, 'Webhook receiver: accepted webhook consumes token use');
  equal(result.offline?.freshness?.nonce.status, 'valid', 'Webhook receiver: nonce freshness is valid');
  deepEqual(result.failureReasons, [], 'Webhook receiver: valid webhook has no failures');
}

async function testPolicyProvenanceHeaderMismatchFailsClosed(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_policy_mismatch',
    decisionId: 'decision-webhook-receiver-policy-mismatch',
    nonce: 'nonce-webhook-policy-mismatch',
  });
  const { store, introspector } = register(issued, decision);
  const headers = {
    ...envelope.headers,
    [ATTESTOR_COMPILED_POLICY_IR_VERSION_HEADER]: 'attestor.policy-ir.test.wrong',
  };
  const signature = await createHttpMessageSignature({
    message: {
      method: 'POST',
      uri: envelope.uri,
      headers,
      body: BODY,
    },
    privateJwk: signatureKey.privateJwk,
    publicJwk: signatureKey.publicJwk,
    coveredComponents: envelope.coveredComponents,
    createdAt: envelope.createdAt,
    expiresAt: envelope.expiresAt,
    nonce: envelope.nonce,
  });

  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers({
        ...headers,
        'signature-input': signature.signatureInput,
        signature: signature.signature,
      }),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      introspector,
      store,
      nonce: 'nonce-webhook-policy-mismatch',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: signed policy provenance mismatch is rejected');
  equal(result.responseStatus, 403, 'Webhook receiver: policy provenance mismatch is fail-closed');
  deepEqual(result.failureReasons, ['stale-policy'], 'Webhook receiver: policy provenance mismatch maps to stale policy');
  equal(result.decision?.outcome, 'deny', 'Webhook receiver: stale policy creates deny decision');
}

async function testMissingPolicyProvenanceCoverageFailsClosed(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_policy_coverage',
    decisionId: 'decision-webhook-receiver-policy-coverage',
    nonce: 'nonce-webhook-policy-coverage',
  });
  const { store, introspector } = register(issued, decision);
  const envelope = await makeEnvelope({
    signatureKey,
    issued,
    nonce: 'nonce-webhook-policy-coverage',
    coveredComponents: DEFAULT_HTTP_AUTHORIZATION_ENVELOPE_COMPONENTS,
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      introspector,
      store,
      nonce: 'nonce-webhook-policy-coverage',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: missing policy provenance signature coverage is rejected');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Webhook receiver: missing coverage maps to binding mismatch');
  ok(
    result.signature?.coveredComponents.includes(ATTESTOR_POLICY_VERSION_HEADER) === false,
    'Webhook receiver: rejected envelope omitted policy version coverage',
  );
}

async function testMissingSignatureFailsClosed(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_missing_sig',
    decisionId: 'decision-webhook-receiver-missing-sig',
    nonce: 'nonce-webhook-missing-sig',
  });
  const headers = new Headers(envelope.headers);
  headers.delete('signature');
  headers.delete('signature-input');
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers,
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-missing-sig',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: missing HTTP signature is rejected');
  equal(result.responseStatus, 401, 'Webhook receiver: missing signature fails before handler admission');
  deepEqual(result.failureReasons, ['invalid-signature'], 'Webhook receiver: missing signature failure is explicit');
  equal(result.decision, null, 'Webhook receiver: missing envelope has no admission decision');
}

async function testTamperedBodyIsDenied(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_tamper',
    decisionId: 'decision-webhook-receiver-tamper',
    nonce: 'nonce-webhook-tamper',
  });
  const { store, introspector } = register(issued, decision);
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: JSON.stringify({ event: 'tampered' }),
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      introspector,
      store,
      nonce: 'nonce-webhook-tamper',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: tampered body is rejected');
  equal(result.responseStatus, 403, 'Webhook receiver: body tampering is not retryable');
  equal(result.decision?.outcome, 'deny', 'Webhook receiver: tampered body creates deny decision');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Webhook receiver: content digest mismatch maps to binding mismatch');
  equal(result.retryable, false, 'Webhook receiver: tampered body rejection is non-retryable');
}

async function testReplayLedgerHitIsConflict(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_replay',
    decisionId: 'decision-webhook-receiver-replay',
    nonce: 'nonce-webhook-replay',
  });
  const { store, introspector } = register(issued, decision);
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      introspector,
      store,
      nonce: 'nonce-webhook-replay',
      replayLedgerEntry: replayLedger(envelope.replayKey),
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: replayed signature is rejected');
  equal(result.responseStatus, 409, 'Webhook receiver: replay maps to conflict');
  deepEqual(result.failureReasons, ['replayed-authorization'], 'Webhook receiver: replay reason is explicit');
  equal(result.decision?.outcome, 'deny', 'Webhook receiver: replay creates deny decision');
}

async function testIntrospectionUnavailableRequiresBreakGlass(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_no_introspection',
    decisionId: 'decision-webhook-receiver-no-introspection',
    nonce: 'nonce-webhook-no-introspection',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-no-introspection',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: online-required path rejects when introspection is unavailable');
  equal(result.responseStatus, 503, 'Webhook receiver: introspection outage is retryable');
  equal(result.retryable, true, 'Webhook receiver: retry hint is set for control-plane outage');
  deepEqual(
    result.failureReasons,
    ['introspection-unavailable', 'break-glass-required'],
    'Webhook receiver: missing break-glass grant is explicit',
  );
  equal(result.decision?.outcome, 'deny', 'Webhook receiver: outage without break-glass remains deny');
}

async function testBreakGlassCanAdmitLocallyVerifiedWebhook(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_break_glass',
    decisionId: 'decision-webhook-receiver-break-glass',
    nonce: 'nonce-webhook-break-glass',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-break-glass',
      breakGlass: true,
      consumeBreakGlassGrant: ({ grant }) => grant,
    }),
  );

  equal(result.status, 'break-glass-accepted', 'Webhook receiver: active grant can admit locally verified webhook');
  equal(result.responseStatus, 202, 'Webhook receiver: break-glass admission is handler-ready');
  equal(result.decision?.outcome, 'break-glass-allow', 'Webhook receiver: break-glass creates explicit outcome');
  equal(result.breakGlass?.ticketId, 'INC-4242', 'Webhook receiver: break-glass grant is retained');
  deepEqual(result.failureReasons, ['introspection-unavailable'], 'Webhook receiver: break-glass keeps original failure reasons');
}

async function testRawBreakGlassGrantRequiresConsumption(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_break_glass_raw',
    decisionId: 'decision-webhook-receiver-break-glass-raw',
    nonce: 'nonce-webhook-break-glass-raw',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-break-glass-raw',
      breakGlass: true,
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: raw break-glass grant does not admit without consumption');
  equal(result.breakGlass, null, 'Webhook receiver: unconsumed break-glass grant is not attached');
  deepEqual(
    result.failureReasons,
    ['introspection-unavailable', 'break-glass-required'],
    'Webhook receiver: unconsumed grant still reports explicit break-glass requirement',
  );
}

async function testBreakGlassGrantConsumptionIsOneUse(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_break_glass_one_use',
    decisionId: 'decision-webhook-receiver-break-glass-one-use',
    nonce: 'nonce-webhook-break-glass-one-use',
  });
  const store = createInMemoryDegradedModeGrantStore();
  const grant = store.registerGrant(createDegradedModeGrant({
    id: 'dmg_webhook_one_use',
    state: 'break-glass-open',
    reason: 'control-plane-recovery',
    scope: {
      environment: 'test',
      enforcementPointId: 'webhook-receiver-pep',
      pointKind: 'webhook-receiver',
      boundaryKind: 'webhook',
      tenantId: 'tenant-test',
      accountId: 'acct-test',
      workloadId: 'spiffe://attestor/tests/webhook-receiver',
      audience: TARGET_ID,
      targetId: TARGET_ID,
      consequenceType: 'action',
      riskClass: 'R3',
    },
    authorizedBy: {
      id: 'user.release-operator',
      type: 'user',
      role: 'release-operator',
    },
    approvedBy: [
      {
        id: 'user.incident-commander',
        type: 'user',
        role: 'incident-commander',
      },
    ],
    authorizedAt: '2026-04-18T16:00:30.000Z',
    startsAt: '2026-04-18T16:00:30.000Z',
    expiresAt: '2026-04-18T16:05:00.000Z',
    ticketId: 'INC-4242',
    rationale: 'Control-plane introspection is degraded; local signature verification remains valid.',
    maxUses: 1,
    remainingUses: 1,
  }));
  const options = receiverOptions({
    signatureKey,
    verificationKey,
    nonce: 'nonce-webhook-break-glass-one-use',
    breakGlass: true,
    consumeBreakGlassGrant: (input) => {
      const stored = store.findGrant(grant.id);
      if (!stored || !degradedModeScopeMatches(stored.scope, degradedModeScopeFromRequest(input.request))) {
        return null;
      }
      const consumed = store.consumeGrant({
        id: grant.id,
        checkedAt: input.context.checkedAt,
        actor: grant.authorizedBy,
        failureReasons: input.failureReasons,
        metadata: { requestId: input.request.id },
      });
      return consumed ? grantToBreakGlassGrant(consumed) : null;
    },
  });

  const first = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    options,
  );
  const second = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    options,
  );

  equal(first.status, 'break-glass-accepted', 'Webhook receiver: consumed one-use grant admits once');
  equal(second.status, 'rejected', 'Webhook receiver: exhausted one-use grant cannot admit again');
  equal(
    store.listAuditRecords().filter((record) => record.action === 'grant-used').length,
    1,
    'Webhook receiver: consumed grant is recorded once in degraded-mode audit',
  );
}

async function testBreakGlassRejectsOverlongGrant(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_break_glass_overlong',
    decisionId: 'decision-webhook-receiver-break-glass-overlong',
    nonce: 'nonce-webhook-break-glass-overlong',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-break-glass-overlong',
      breakGlass: true,
      breakGlassExpiresAt: '2026-04-18T17:00:31.000Z',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: overlong break-glass grant is rejected');
  equal(result.responseStatus, 503, 'Webhook receiver: overlong break-glass grant remains retryable');
  equal(result.breakGlass, null, 'Webhook receiver: overlong break-glass grant is not attached');
  deepEqual(
    result.failureReasons,
    ['introspection-unavailable', 'break-glass-required'],
    'Webhook receiver: overlong grant still reports explicit break-glass requirement',
  );
}

async function testBreakGlassCannotBypassInvalidSignature(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_break_glass_tamper',
    decisionId: 'decision-webhook-receiver-break-glass-tamper',
    nonce: 'nonce-webhook-break-glass-tamper',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: JSON.stringify({ event: 'tampered' }),
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-break-glass-tamper',
      breakGlass: true,
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: break-glass cannot bypass invalid signature binding');
  equal(result.decision?.outcome, 'deny', 'Webhook receiver: invalid signed envelope remains deny under break-glass');
  equal(result.breakGlass, null, 'Webhook receiver: invalid envelope does not attach break-glass grant');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Webhook receiver: invalid signature failure is preserved');
}

async function testRejectedResponseBodyAndHeaders(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_body',
    decisionId: 'decision-webhook-receiver-body',
    nonce: 'nonce-webhook-body',
  });
  const headers = new Headers(envelope.headers);
  headers.delete('authorization');
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers,
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-body',
    }),
  );
  const body = releaseWebhookReceiverDeniedBody(result);

  equal(result.status, 'rejected', 'Webhook receiver: missing bearer token is rejected');
  equal(result.responseStatus, 401, 'Webhook receiver: missing bearer token maps to challenge status');
  deepEqual(body.failureReasons, ['missing-release-authorization'], 'Webhook receiver: denied body reports failure reasons');
  equal(body.requestId, null, 'Webhook receiver: denied body omits request id when request was not built');
  equal(body.retryable, false, 'Webhook receiver: missing authorization is not retryable');
}

async function testMalformedBearerCredentialFailsClosed(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_malformed_bearer',
    decisionId: 'decision-webhook-receiver-malformed-bearer',
    nonce: 'nonce-webhook-malformed-bearer',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'POST',
      url: envelope.uri,
      headers: {
        ...envelope.headers,
        authorization: `${envelope.headers.authorization};injection=true`,
      },
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-malformed-bearer',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: parameterized bearer credential is rejected');
  equal(result.responseStatus, 401, 'Webhook receiver: parameterized bearer maps to challenge status');
  deepEqual(
    result.failureReasons,
    ['missing-release-authorization'],
    'Webhook receiver: parameterized bearer is not parsed as release authorization',
  );
}

async function testMethodGuardFailsBeforeVerification(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_get',
    decisionId: 'decision-webhook-receiver-get',
    nonce: 'nonce-webhook-get',
  });
  const result = await evaluateReleaseWebhookRequest(
    {
      method: 'GET',
      url: envelope.uri,
      headers: new Headers(envelope.headers),
      body: BODY,
    },
    receiverOptions({
      signatureKey,
      verificationKey,
      nonce: 'nonce-webhook-get',
    }),
  );

  equal(result.status, 'rejected', 'Webhook receiver: non-POST webhook request is rejected');
  equal(result.responseStatus, 405, 'Webhook receiver: method guard maps to method-not-allowed');
  deepEqual(result.failureReasons, ['binding-mismatch'], 'Webhook receiver: method guard records binding mismatch');
}

async function testHonoReceiverAdmitsHandlerAfterVerification(): Promise<void> {
  const { signatureKey, issued, verificationKey, decision, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_hono',
    decisionId: 'decision-webhook-receiver-hono',
    nonce: 'nonce-webhook-hono',
  });
  const { store, introspector } = register(issued, decision);
  const app = new Hono<HonoReleaseWebhookReceiverEnv>();
  let handlerReached = 0;

  app.post(
    '/hooks/release',
    createHonoReleaseWebhookReceiver(
      receiverOptions({
        signatureKey,
        verificationKey,
        introspector,
        store,
        nonce: 'nonce-webhook-hono',
      }),
      (context, result, body) => {
        handlerReached += 1;
        const storedResult = context.get(HONO_RELEASE_WEBHOOK_RECEIVER_CONTEXT_KEY);
        const storedBody = context.get(HONO_RELEASE_WEBHOOK_BODY_CONTEXT_KEY);
        return context.json({
          status: result.status,
          storedStatus: storedResult.status,
          bodyLength: body.byteLength,
          storedBodyLength: storedBody.byteLength,
          outcome: result.decision?.outcome,
        }, 202);
      },
    ),
  );

  const response = await app.request(envelope.uri, {
    method: 'POST',
    headers: new Headers({
      ...envelope.headers,
      [ATTESTOR_WEBHOOK_EVENT_ID_HEADER]: 'evt-webhook-hono',
    }),
    body: BODY,
  });
  const body = await response.json() as {
    readonly status: string;
    readonly storedStatus: string;
    readonly bodyLength: number;
    readonly storedBodyLength: number;
    readonly outcome: string;
  };

  equal(response.status, 202, 'Webhook receiver: Hono handler returns accepted response');
  equal(response.headers.get(ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER), 'accepted', 'Webhook receiver: Hono stamps status header');
  equal(handlerReached, 1, 'Webhook receiver: Hono handler runs after verification');
  equal(body.status, 'accepted', 'Webhook receiver: Hono handler sees accepted result');
  equal(body.storedStatus, 'accepted', 'Webhook receiver: Hono context stores result');
  equal(body.bodyLength, BODY.length, 'Webhook receiver: Hono handler receives raw body bytes');
  equal(body.storedBodyLength, BODY.length, 'Webhook receiver: Hono context stores raw body bytes');
  equal(body.outcome, 'allow', 'Webhook receiver: Hono handler receives allow decision');
}

async function testHonoReceiverBlocksRejectedWebhook(): Promise<void> {
  const { signatureKey, verificationKey, envelope } = await setupValidWebhook({
    tokenId: 'rt_webhook_receiver_hono_block',
    decisionId: 'decision-webhook-receiver-hono-block',
    nonce: 'nonce-webhook-hono-block',
  });
  const app = new Hono<HonoReleaseWebhookReceiverEnv>();
  let handlerReached = 0;

  app.post(
    '/hooks/release',
    createHonoReleaseWebhookReceiver(
      receiverOptions({
        signatureKey,
        verificationKey,
        nonce: 'nonce-webhook-hono-block',
      }),
      () => {
        handlerReached += 1;
        return new Response('should not run');
      },
    ),
  );

  const response = await app.request(envelope.uri, {
    method: 'POST',
    headers: new Headers(envelope.headers),
    body: BODY,
  });
  const body = await response.json() as { readonly failureReasons: readonly string[] };

  equal(response.status, 503, 'Webhook receiver: Hono returns fail-closed response when introspection is unavailable');
  equal(response.headers.get(ATTESTOR_WEBHOOK_RECEIVER_STATUS_HEADER), 'rejected', 'Webhook receiver: Hono stamps rejected status');
  equal(handlerReached, 0, 'Webhook receiver: rejected Hono webhook does not reach handler');
  deepEqual(body.failureReasons, ['introspection-unavailable', 'break-glass-required'], 'Webhook receiver: Hono rejection reports failures');
}

async function main(): Promise<void> {
  await testDirectReceiverAcceptsSignedWebhook();
  await testPolicyProvenanceHeaderMismatchFailsClosed();
  await testMissingPolicyProvenanceCoverageFailsClosed();
  await testMissingSignatureFailsClosed();
  await testTamperedBodyIsDenied();
  await testReplayLedgerHitIsConflict();
  await testIntrospectionUnavailableRequiresBreakGlass();
  await testBreakGlassCanAdmitLocallyVerifiedWebhook();
  await testRawBreakGlassGrantRequiresConsumption();
  await testBreakGlassGrantConsumptionIsOneUse();
  await testBreakGlassRejectsOverlongGrant();
  await testBreakGlassCannotBypassInvalidSignature();
  await testRejectedResponseBodyAndHeaders();
  await testMalformedBearerCredentialFailsClosed();
  await testMethodGuardFailsBeforeVerification();
  await testHonoReceiverAdmitsHandlerAfterVerification();
  await testHonoReceiverBlocksRejectedWebhook();

  console.log(`Release enforcement-plane webhook receiver tests: ${passedCount()} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane webhook receiver tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
