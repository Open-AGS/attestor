/**
 * LIVE API Integration Tests
 *
 * These are NOT mocks. This test:
 * 1. Starts a real Hono HTTP server on port 3700
 * 2. Sends real HTTP requests to it
 * 3. Verifies real responses
 * 4. Stops the server
 *
 * Run: npx tsx tests/live-api.test.ts
 * Flow modules live under tests/live-api/.
 */

import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
export { mkdirSync, mkdtempSync, readFileSync, rmSync };
import { createServer } from 'node:net';
import { join } from 'node:path';
export { join };
import JSZip from 'jszip';
export { JSZip };
import Stripe from 'stripe';
export { Stripe };
import { startServer } from '../../src/service/api-server.js';
export { startServer };
import { issueTenantApiKey, resetTenantKeyStoreForTests, revokeTenantApiKey } from '../../src/service/tenant-key-store.js';
export { issueTenantApiKey, resetTenantKeyStoreForTests, revokeTenantApiKey };
import { readUsageLedgerSnapshot, resetUsageMeter } from '../../src/service/usage-meter.js';
export { readUsageLedgerSnapshot, resetUsageMeter };
import { resetTenantRateLimiterForTests } from '../../src/service/rate-limit.js';
export { resetTenantRateLimiterForTests };
import { resetAccountStoreForTests } from '../../src/service/account/account-store.js';
export { resetAccountStoreForTests };
import { resetAccountUserStoreForTests } from '../../src/service/account/account-user-store.js';
export { resetAccountUserStoreForTests };
import { resetAccountUserActionTokenStoreForTests } from '../../src/service/account/account-user-token-store.js';
export { resetAccountUserActionTokenStoreForTests };
import { resetAccountSessionStoreForTests } from '../../src/service/account/account-session-store.js';
export { resetAccountSessionStoreForTests };
import { resetAdminAuditLogForTests } from '../../src/service/admin-audit-log.js';
export { resetAdminAuditLogForTests };
import { resetAdminIdempotencyStoreForTests } from '../../src/service/admin-idempotency-store.js';
export { resetAdminIdempotencyStoreForTests };
import { readAsyncDeadLetterStoreSnapshot, resetAsyncDeadLetterStoreForTests } from '../../src/service/async/async-dead-letter-store.js';
export { readAsyncDeadLetterStoreSnapshot, resetAsyncDeadLetterStoreForTests };
import { resetStripeWebhookStoreForTests } from '../../src/service/billing/stripe/stripe-webhook-store.js';
export { resetStripeWebhookStoreForTests };
import { resetBillingEventLedgerForTests } from '../../src/service/billing/billing-event-ledger.js';
export { resetBillingEventLedgerForTests };
import { resetHostedBillingEntitlementStoreForTests } from '../../src/service/billing/billing-entitlement-store.js';
export { resetHostedBillingEntitlementStoreForTests };
import { resetHostedEmailDeliveryEventStoreForTests } from '../../src/service/async/email-delivery-event-store.js';
export { resetHostedEmailDeliveryEventStoreForTests };
import { resetObservabilityForTests } from '../../src/service/observability.js';
export { resetObservabilityForTests };
import { ATTESTOR_SERVICE_VERSION } from '../../src/service/version.js';
export { ATTESTOR_SERVICE_VERSION };
import { generateCurrentTotpCode } from '../../src/service/account/account-mfa.js';
export { generateCurrentTotpCode };
import {
  COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE,
  COUNTERPARTY_REPORT, COUNTERPARTY_REPORT_CONTRACT,
} from '../../src/financial/fixtures/scenarios.js';

export {
  COUNTERPARTY_SQL,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
};

export const BASE = 'http://localhost:3700';
export const stripe = new Stripe('sk_test_live_api');
let passed = 0;

export function getPassedCount(): number {
  return passed;
}

export async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a TCP port.'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolve(port));
    });
  });
}

export async function waitForJobStatus(
  jobId: string,
  expected: 'completed' | 'failed',
  timeoutMs: number = 6000,
  headers?: Record<string, string>,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/api/v1/pipeline/status/${jobId}`, { headers });
    const body = await res.json();
    if (body.status === expected) return body;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for async job ${jobId} to reach status '${expected}'.`);
}

export function ok(condition: boolean, msg: string): void {
  assert(condition, msg);
  passed++;
}

export function currentTotpStepIndex(nowMs = Date.now()): number {
  return Math.floor(nowMs / 30_000);
}

export async function waitForTotpStepAfter(step: number): Promise<void> {
  while (currentTotpStepIndex() <= step) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}

export function metricSamples(metrics: string, metricName: string, labels: Record<string, string>): number[] {
  const labelMatcher = Object.entries(labels).map(([key, value]) => `${key}="${value}"`);
  return metrics
    .split(/\r?\n/)
    .filter((line) => line.startsWith(metricName))
    .filter((line) => labelMatcher.every((part) => line.includes(part)))
    .map((line) => {
      const value = Number.parseFloat(line.trim().split(/\s+/).pop() ?? 'NaN');
      return value;
    })
    .filter((value) => Number.isFinite(value));
}

export function cookieHeaderFromResponse(res: Response): string | null {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const [cookiePair] = raw.split(';', 1);
  return cookiePair?.trim() || null;
}

export function csrfHeaders(cookie: string): Record<string, string> {
  return {
    Cookie: cookie,
    'x-attestor-csrf': 'live-api',
  };
}

export function pipelineRunHeaders(
  idempotencyKey: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    ...headers,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
}

export async function waitForRateLimitWindowHead(windowSeconds: number): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const elapsedMs = Date.now() % windowMs;
  if (elapsedMs <= 500) return;
  await new Promise((resolve) => setTimeout(resolve, windowMs - elapsedMs + 150));
}

export function unsignedBearerToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

export type LiveApiHostedContext = {
  createAccountBody?: any;
  listedAccount?: any;
  accountAdminCookie?: string | null;
  createBillingAdminBody?: any;
  createReadOnlyBody?: any;
  readOnlyCookie?: string | null;
  billingAdminCookie?: string | null;
};
