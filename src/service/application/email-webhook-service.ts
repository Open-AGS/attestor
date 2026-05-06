import type {
  HostedEmailDeliveryEventRecord,
  HostedEmailDeliverySummaryRecord,
  RecordHostedEmailProviderEventInput,
} from '../email-delivery-event-store.js';
import type {
  MailgunWebhookEventRecord,
  MailgunWebhookSignatureRecord,
  MailgunWebhookStatus,
} from '../mailgun-email-webhook.js';
import { envTruthy } from '../deployment-safety.js';
import type {
  SendGridWebhookEventRecord,
  SendGridWebhookStatus,
} from '../sendgrid-email-webhook.js';

export type EmailWebhookStatusCode = 200 | 400 | 503;

export interface EmailWebhookServiceResult {
  statusCode: EmailWebhookStatusCode;
  responseBody: Record<string, unknown>;
}

export interface SendGridWebhookInput {
  rawPayload: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
}

export interface MailgunWebhookInput {
  rawPayload: string;
}

export interface EmailWebhookService {
  handleSendGrid(input: SendGridWebhookInput): Promise<EmailWebhookServiceResult>;
  handleMailgun(input: MailgunWebhookInput): Promise<EmailWebhookServiceResult>;
}

export interface EmailWebhookServiceDeps {
  getSendGridWebhookStatus(): SendGridWebhookStatus;
  verifySignedSendGridWebhook(input: {
    rawPayload: string;
    signature: string;
    timestamp: string;
  }): boolean;
  parseSendGridWebhookEvents(rawPayload: string): SendGridWebhookEventRecord[];
  getMailgunWebhookStatus(): MailgunWebhookStatus;
  parseMailgunWebhookEvent(rawPayload: string): {
    signature: MailgunWebhookSignatureRecord;
    event: MailgunWebhookEventRecord;
  };
  verifySignedMailgunWebhook(input: MailgunWebhookSignatureRecord): boolean;
  mailgunSignatureTokenDigest(input: MailgunWebhookSignatureRecord): string | null;
  isSharedControlPlaneConfigured(): boolean;
  findEmailDeliveryById(deliveryId: string): Promise<HostedEmailDeliverySummaryRecord | null>;
  recordEmailProviderEvent(
    input: RecordHostedEmailProviderEventInput,
  ): Promise<{
    kind: 'recorded' | 'duplicate' | 'conflict';
    record: HostedEmailDeliveryEventRecord;
    path: string | null;
  }>;
  sendGridEventTypeToStatusHint(eventType: string): RecordHostedEmailProviderEventInput['statusHint'];
  mailgunEventTypeToStatusHint(
    eventType: string,
    severity?: string | null,
  ): RecordHostedEmailProviderEventInput['statusHint'];
  now(): string;
}

interface EmailWebhookCounters {
  applied: number;
  duplicate: number;
  ignored: number;
  conflict: number;
}

function ok(responseBody: Record<string, unknown>): EmailWebhookServiceResult {
  return {
    statusCode: 200,
    responseBody,
  };
}

function badRequest(error: string): EmailWebhookServiceResult {
  return {
    statusCode: 400,
    responseBody: { error },
  };
}

function disabled(error: string): EmailWebhookServiceResult {
  return {
    statusCode: 503,
    responseBody: { error },
  };
}

function requiresSharedEmailWebhookStore(): boolean {
  return envTruthy(process.env.ATTESTOR_HA_MODE)
    || envTruthy(process.env.ATTESTOR_EMAIL_WEBHOOK_REQUIRE_SHARED_STORE);
}

function sharedStoreUnavailable(deps: EmailWebhookServiceDeps): EmailWebhookServiceResult | null {
  if (!requiresSharedEmailWebhookStore() || deps.isSharedControlPlaneConfigured()) return null;
  return disabled('Email provider webhooks require shared control-plane storage in HA/shared-store mode.');
}

function incrementCounter(
  counters: EmailWebhookCounters,
  outcome: 'recorded' | 'duplicate' | 'conflict',
): void {
  if (outcome === 'recorded') counters.applied += 1;
  else if (outcome === 'duplicate') counters.duplicate += 1;
  else counters.conflict += 1;
}

async function recordSendGridEvent(
  deps: EmailWebhookServiceDeps,
  event: SendGridWebhookEventRecord,
  counters: EmailWebhookCounters,
): Promise<void> {
  if (!event.deliveryId || !event.email) {
    counters.ignored += 1;
    return;
  }

  const delivery = await deps.findEmailDeliveryById(event.deliveryId);
  const result = await deps.recordEmailProviderEvent({
    deliveryId: event.deliveryId,
    accountId: delivery?.accountId ?? null,
    accountUserId: delivery?.accountUserId ?? null,
    purpose: event.purpose ?? delivery?.purpose ?? null,
    provider: 'sendgrid_smtp',
    channel: 'smtp',
    recipient: event.email,
    messageId: delivery?.messageId ?? null,
    providerMessageId: event.sgMessageId ?? delivery?.providerMessageId ?? null,
    providerEventId: event.sgEventId,
    eventType: `sendgrid.${event.event}`,
    statusHint: deps.sendGridEventTypeToStatusHint(event.event),
    actionUrl: delivery?.actionUrl ?? null,
    tokenReturned: delivery?.tokenReturned ?? false,
    occurredAt: event.timestamp
      ? new Date(event.timestamp * 1000).toISOString()
      : deps.now(),
    metadata: event.raw,
    rawPayload: event.raw,
  });
  incrementCounter(counters, result.kind);
}

async function recordMailgunEvent(
  deps: EmailWebhookServiceDeps,
  event: MailgunWebhookEventRecord,
  signatureTokenDigest: string,
  counters: EmailWebhookCounters,
): Promise<void> {
  if (!event.deliveryId || !event.email) {
    counters.ignored += 1;
    return;
  }

  const delivery = await deps.findEmailDeliveryById(event.deliveryId);
  const result = await deps.recordEmailProviderEvent({
    deliveryId: event.deliveryId,
    accountId: delivery?.accountId ?? null,
    accountUserId: delivery?.accountUserId ?? null,
    purpose: event.purpose ?? delivery?.purpose ?? null,
    provider: 'mailgun_smtp',
    channel: 'smtp',
    recipient: event.email,
    messageId: delivery?.messageId ?? null,
    providerMessageId: event.messageId ?? delivery?.providerMessageId ?? null,
    providerEventId: event.eventId,
    eventType: `mailgun.${event.event}`,
    statusHint: deps.mailgunEventTypeToStatusHint(event.event, event.severity),
    actionUrl: delivery?.actionUrl ?? null,
    tokenReturned: delivery?.tokenReturned ?? false,
    occurredAt: event.timestamp
      ? new Date(event.timestamp * 1000).toISOString()
      : deps.now(),
    metadata: {
      ...event.raw,
      mailgunEventId: event.eventId,
      mailgunSignatureTokenDigest: signatureTokenDigest,
      severity: event.severity ?? null,
    },
    rawPayload: event.raw,
  });
  incrementCounter(counters, result.kind);
}

export function createEmailWebhookService(deps: EmailWebhookServiceDeps): EmailWebhookService {
  return {
    async handleSendGrid(input) {
      const webhookStatus = deps.getSendGridWebhookStatus();
      if (!webhookStatus.configured) {
        return disabled(
          'SendGrid event webhook disabled. Set ATTESTOR_SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY to enable delivery analytics.',
        );
      }
      const sharedStoreError = sharedStoreUnavailable(deps);
      if (sharedStoreError) return sharedStoreError;

      const signature = input.signature?.trim() ?? '';
      const timestamp = input.timestamp?.trim() ?? '';
      if (!signature || !timestamp) {
        return badRequest(
          'Signed SendGrid webhook requires X-Twilio-Email-Event-Webhook-Signature and X-Twilio-Email-Event-Webhook-Timestamp.',
        );
      }

      if (!deps.verifySignedSendGridWebhook({
        rawPayload: input.rawPayload,
        signature,
        timestamp,
      })) {
        return badRequest('SendGrid webhook signature verification failed.');
      }

      let events: SendGridWebhookEventRecord[];
      try {
        events = deps.parseSendGridWebhookEvents(input.rawPayload);
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
      if (events.some((event) => !event.sgEventId)) {
        return badRequest('SendGrid webhook event requires sg_event_id for replay-safe idempotency.');
      }

      const counters: EmailWebhookCounters = {
        applied: 0,
        duplicate: 0,
        ignored: 0,
        conflict: 0,
      };
      for (const event of events) {
        await recordSendGridEvent(deps, event, counters);
      }

      return ok({
        received: true,
        provider: 'sendgrid_smtp',
        eventCount: events.length,
        ...counters,
      });
    },

    async handleMailgun(input) {
      const webhookStatus = deps.getMailgunWebhookStatus();
      if (!webhookStatus.configured) {
        return disabled(
          'Mailgun event webhook disabled. Set ATTESTOR_MAILGUN_WEBHOOK_SIGNING_KEY to enable delivery analytics.',
        );
      }
      const sharedStoreError = sharedStoreUnavailable(deps);
      if (sharedStoreError) return sharedStoreError;

      let parsed: {
        signature: MailgunWebhookSignatureRecord;
        event: MailgunWebhookEventRecord;
      };
      try {
        parsed = deps.parseMailgunWebhookEvent(input.rawPayload);
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }

      if (!deps.verifySignedMailgunWebhook(parsed.signature)) {
        return badRequest('Mailgun webhook signature verification failed.');
      }
      if (!parsed.event.eventId) {
        return badRequest('Mailgun webhook event-data.id is required for replay-safe idempotency.');
      }
      const signatureTokenDigest = deps.mailgunSignatureTokenDigest(parsed.signature);
      if (!signatureTokenDigest) {
        return badRequest('Mailgun webhook signature token could not be bound for replay protection.');
      }

      const counters: EmailWebhookCounters = {
        applied: 0,
        duplicate: 0,
        ignored: 0,
        conflict: 0,
      };
      await recordMailgunEvent(deps, parsed.event, signatureTokenDigest, counters);

      return ok({
        received: true,
        provider: 'mailgun_smtp',
        eventCount: 1,
        ...counters,
      });
    },
  };
}
