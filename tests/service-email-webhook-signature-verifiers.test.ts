import assert from 'node:assert/strict';
import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';
import {
  mailgunSignatureTokenDigest,
  verifySignedMailgunWebhook,
} from '../src/service/mailgun-email-webhook.js';
import {
  verifySignedSendGridWebhook,
} from '../src/service/sendgrid-email-webhook.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function currentTimestamp(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}

function withEnv(env: Record<string, string | undefined>, fn: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    saved.set(key, process.env[key]);
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function mailgunSignature(signingKey: string, timestamp: string, token: string): string {
  return createHmac('sha256', signingKey)
    .update(`${timestamp}${token}`, 'utf8')
    .digest('hex');
}

function signSendGridPayload(privateKeyPem: string, rawPayload: string, timestamp: string): string {
  const signer = createSign('sha256');
  signer.update(timestamp, 'utf8');
  signer.update(rawPayload, 'utf8');
  signer.end();
  return signer.sign(privateKeyPem).toString('base64');
}

function testMailgunVerifierAcceptsValidSignature(): void {
  const signingKey = 'mailgun-signing-secret';
  const timestamp = currentTimestamp();
  const token = 'mailgun-token-123';
  withEnv({
    ATTESTOR_MAILGUN_WEBHOOK_SIGNING_KEY: signingKey,
    ATTESTOR_MAILGUN_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedMailgunWebhook({
        timestamp,
        token,
        signature: mailgunSignature(signingKey, timestamp, token),
      }),
      true,
      'Mailgun verifier accepts a valid timestamp/token HMAC',
    );
  });
}

function testMailgunVerifierRejectsInvalidInputs(): void {
  const signingKey = 'mailgun-signing-secret';
  const timestamp = currentTimestamp();
  const token = 'mailgun-token-123';
  const validSignature = mailgunSignature(signingKey, timestamp, token);

  withEnv({
    ATTESTOR_MAILGUN_WEBHOOK_SIGNING_KEY: undefined,
    ATTESTOR_MAILGUN_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedMailgunWebhook({ timestamp, token, signature: validSignature }),
      false,
      'Mailgun verifier rejects when signing key is unset',
    );
  });

  withEnv({
    ATTESTOR_MAILGUN_WEBHOOK_SIGNING_KEY: signingKey,
    ATTESTOR_MAILGUN_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedMailgunWebhook({
        timestamp: currentTimestamp(-600),
        token,
        signature: mailgunSignature(signingKey, currentTimestamp(-600), token),
      }),
      false,
      'Mailgun verifier rejects expired timestamps',
    );
    equal(
      verifySignedMailgunWebhook({
        timestamp: `${timestamp}abc`,
        token,
        signature: mailgunSignature(signingKey, `${timestamp}abc`, token),
      }),
      false,
      'Mailgun verifier rejects timestamps with trailing junk',
    );
    equal(
      verifySignedMailgunWebhook({ timestamp, token, signature: 'not-hex' }),
      false,
      'Mailgun verifier rejects non-hex signatures',
    );
    equal(
      verifySignedMailgunWebhook({ timestamp, token, signature: validSignature.slice(0, -2) }),
      false,
      'Mailgun verifier rejects hex signatures with mismatched length',
    );
  });
}

function testMailgunReplayTokenDigestIsDomainSeparated(): void {
  const signingKey = 'mailgun-signing-secret';
  const timestamp = currentTimestamp();
  const token = 'mailgun-token-123';
  withEnv({
    ATTESTOR_MAILGUN_WEBHOOK_SIGNING_KEY: signingKey,
  }, () => {
    const digest = mailgunSignatureTokenDigest({
      timestamp,
      token,
      signature: mailgunSignature(signingKey, timestamp, token),
    });
    ok(Boolean(digest), 'Mailgun replay token digest is emitted when signing key and token are present');
    assert.notEqual(
      digest,
      createHmac('sha256', signingKey).update(token, 'utf8').digest('hex'),
      'Mailgun replay token digest uses domain separation, not a bare token HMAC',
    );
    passed += 1;
  });
}

function testSendGridVerifierAcceptsValidSignature(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const rawPayload = JSON.stringify([{ email: 'ops@example.com', event: 'delivered' }]);
  const timestamp = currentTimestamp();

  withEnv({
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: publicKey,
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedSendGridWebhook({
        rawPayload,
        timestamp,
        signature: signSendGridPayload(privateKey, rawPayload, timestamp),
      }),
      true,
      'SendGrid verifier accepts a valid ECDSA signature over timestamp and raw payload',
    );
  });
}

function testSendGridVerifierRejectsInvalidInputs(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const rawPayload = JSON.stringify([{ email: 'ops@example.com', event: 'delivered' }]);
  const timestamp = currentTimestamp();
  const validSignature = signSendGridPayload(privateKey, rawPayload, timestamp);

  withEnv({
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: undefined,
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedSendGridWebhook({ rawPayload, timestamp, signature: validSignature }),
      false,
      'SendGrid verifier rejects when public key is unset',
    );
  });

  withEnv({
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: publicKey,
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedSendGridWebhook({
        rawPayload,
        timestamp: currentTimestamp(-600),
        signature: signSendGridPayload(privateKey, rawPayload, currentTimestamp(-600)),
      }),
      false,
      'SendGrid verifier rejects expired timestamps',
    );
    equal(
      verifySignedSendGridWebhook({
        rawPayload,
        timestamp: `${timestamp}abc`,
        signature: signSendGridPayload(privateKey, rawPayload, `${timestamp}abc`),
      }),
      false,
      'SendGrid verifier rejects timestamps with trailing junk',
    );
    equal(
      verifySignedSendGridWebhook({
        rawPayload,
        timestamp,
        signature: 'not-valid-base64-@@',
      }),
      false,
      'SendGrid verifier rejects malformed signature material',
    );
  });

  withEnv({
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: 'not-a-public-key',
    ATTESTOR_SENDGRID_EVENT_WEBHOOK_MAX_AGE_SECONDS: '300',
  }, () => {
    equal(
      verifySignedSendGridWebhook({ rawPayload, timestamp, signature: validSignature }),
      false,
      'SendGrid verifier fails closed on malformed public key configuration',
    );
  });
}

testMailgunVerifierAcceptsValidSignature();
testMailgunVerifierRejectsInvalidInputs();
testMailgunReplayTokenDigestIsDomainSeparated();
testSendGridVerifierAcceptsValidSignature();
testSendGridVerifierRejectsInvalidInputs();

console.log(`Service email webhook signature verifier tests: ${passed} passed, 0 failed`);
