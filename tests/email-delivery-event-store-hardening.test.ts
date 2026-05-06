import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  listHostedEmailDeliveryEvents,
  recordHostedEmailDispatchEvent,
  recordHostedEmailProviderEvent,
} from '../src/service/email-delivery-event-store.js';

let passed = 0;
function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

const savedPath = process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH;
const workspace = mkdtempSync(join(tmpdir(), 'attestor-email-store-hardening-'));

try {
  process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = join(workspace, 'email-delivery-events.json');

  const dispatch = recordHostedEmailDispatchEvent({
    deliveryId: 'delivery_redact',
    accountId: 'acct_1',
    accountUserId: 'user_1',
    purpose: 'invite',
    provider: 'smtp',
    channel: 'smtp',
    recipient: 'Invitee@Example.TEST',
    messageId: 'msg_1',
    actionUrl: 'https://attestor.example/invite?token=secret-token&x=1',
    tokenReturned: false,
    occurredAt: '2026-05-06T08:00:00.000Z',
    metadata: {},
  });
  ok(dispatch.record.actionUrl === 'https://attestor.example/invite?token=redacted&x=1', 'Email store hardening: dispatch action URL is redacted at store boundary');
  ok(!JSON.stringify(listHostedEmailDeliveryEvents().records).includes('secret-token'), 'Email store hardening: persisted records do not expose bearer token');

  const first = recordHostedEmailProviderEvent({
    deliveryId: 'delivery_redact',
    accountId: 'acct_1',
    accountUserId: 'user_1',
    purpose: 'invite',
    provider: 'mailgun_smtp',
    channel: 'smtp',
    recipient: 'invitee@example.test',
    messageId: 'msg_1',
    providerMessageId: 'mg_msg_1',
    providerEventId: 'mailgun_evt_1',
    eventType: 'mailgun.delivered',
    statusHint: 'delivered',
    actionUrl: 'https://attestor.example/invite?token=second-secret',
    tokenReturned: false,
    occurredAt: '2026-05-06T08:01:00.000Z',
    metadata: {
      mailgunSignatureTokenDigest: 'mailgun_token_digest_1',
    },
    rawPayload: {
      id: 'mailgun_evt_1',
    },
  });
  ok(first.kind === 'recorded', 'Email store hardening: first provider event records');
  ok(first.record.actionUrl === 'https://attestor.example/invite?token=redacted', 'Email store hardening: provider action URL is redacted at store boundary');

  const replay = recordHostedEmailProviderEvent({
    deliveryId: 'delivery_redact',
    accountId: 'acct_1',
    accountUserId: 'user_1',
    purpose: 'invite',
    provider: 'mailgun_smtp',
    channel: 'smtp',
    recipient: 'invitee@example.test',
    messageId: 'msg_1',
    providerMessageId: 'mg_msg_2',
    providerEventId: 'mailgun_evt_mutated',
    eventType: 'mailgun.opened',
    statusHint: 'delivered',
    actionUrl: null,
    tokenReturned: false,
    occurredAt: '2026-05-06T08:02:00.000Z',
    metadata: {
      mailgunSignatureTokenDigest: 'mailgun_token_digest_1',
    },
    rawPayload: {
      id: 'mailgun_evt_mutated',
    },
  });
  ok(replay.kind === 'conflict', 'Email store hardening: Mailgun signature-token replay with mutated payload conflicts');

  assert.throws(
    () => recordHostedEmailProviderEvent({
      deliveryId: 'delivery_redact',
      accountId: 'acct_1',
      accountUserId: 'user_1',
      purpose: 'invite',
      provider: 'sendgrid_smtp',
      channel: 'smtp',
      recipient: 'invitee@example.test',
      messageId: 'msg_1',
      providerMessageId: 'sg_msg_1',
      providerEventId: null,
      eventType: 'sendgrid.delivered',
      statusHint: 'delivered',
      actionUrl: null,
      tokenReturned: false,
      occurredAt: '2026-05-06T08:03:00.000Z',
      metadata: {},
      rawPayload: {},
    }),
    /providerEventId/u,
    'Email store hardening: provider events without providerEventId fail closed',
  );
  passed += 1;

  console.log(`Email delivery event store hardening tests: ${passed} passed, 0 failed`);
} finally {
  if (savedPath === undefined) delete process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH;
  else process.env.ATTESTOR_EMAIL_DELIVERY_EVENTS_PATH = savedPath;
  rmSync(workspace, { recursive: true, force: true });
}
