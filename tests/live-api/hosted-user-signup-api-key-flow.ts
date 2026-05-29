import {
  ATTESTOR_SERVICE_VERSION,
  BASE,
  COUNTERPARTY_FIXTURE,
  COUNTERPARTY_INTENT,
  COUNTERPARTY_REPORT,
  COUNTERPARTY_REPORT_CONTRACT,
  COUNTERPARTY_SQL,
  JSZip,
  cookieHeaderFromResponse,
  csrfHeaders,
  currentTotpStepIndex,
  generateCurrentTotpCode,
  issueTenantApiKey,
  metricSamples,
  ok,
  readAsyncDeadLetterStoreSnapshot,
  readFileSync,
  readUsageLedgerSnapshot,
  revokeTenantApiKey,
  stripe,
  unsignedBearerToken,
  waitForJobStatus,
  waitForRateLimitWindowHead,
  waitForTotpStepAfter,
} from './helpers.js';
import type { LiveApiHostedContext } from './helpers.js';

export async function runHostedUserSignupApiKeyFlow(ctx: LiveApiHostedContext): Promise<void> {
      const createAccountBody = ctx.createAccountBody;
      const accountAdminCookie = ctx.accountAdminCookie;
      const createReadOnlyBody = ctx.createReadOnlyBody;
      const deactivateReadOnlyRes = await fetch(`${BASE}/api/v1/account/users/${createReadOnlyBody.user.id}/deactivate`, {
        method: 'POST',
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(deactivateReadOnlyRes.status === 200, 'Account Users: deactivate read_only status 200');
      const deactivateReadOnlyBody = await deactivateReadOnlyRes.json() as any;
      ok(deactivateReadOnlyBody.user.status === 'inactive', 'Account Users: read_only marked inactive');

      const readOnlyAfterDeactivateLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyAfterDeactivateLoginRes.status === 403, 'Auth: inactive read_only user cannot log in');

      const reactivateReadOnlyRes = await fetch(`${BASE}/api/v1/account/users/${createReadOnlyBody.user.id}/reactivate`, {
        method: 'POST',
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(reactivateReadOnlyRes.status === 200, 'Account Users: reactivate read_only status 200');
      const reactivateReadOnlyBody = await reactivateReadOnlyRes.json() as any;
      ok(reactivateReadOnlyBody.user.status === 'active', 'Account Users: read_only reactivated');

      const readOnlyReLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyReLoginRes.status === 200, 'Auth: reactivated read_only user can log in again');
      const readOnlyLogoutCookie = cookieHeaderFromResponse(readOnlyReLoginRes);
      ok(Boolean(readOnlyLogoutCookie), 'Auth: reactivated read_only login sets cookie');

      const readOnlyLogoutRes = await fetch(`${BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: csrfHeaders(readOnlyLogoutCookie!),
      });
      ok(readOnlyLogoutRes.status === 200, 'Auth: logout status 200');

      const readOnlyAfterLogoutMeRes = await fetch(`${BASE}/api/v1/auth/me`, {
        headers: csrfHeaders(readOnlyLogoutCookie!),
      });
      ok(readOnlyAfterLogoutMeRes.status === 401, 'Auth: logged-out session rejected by me endpoint');

      const billingEventsNoAuth = await fetch(`${BASE}/api/v1/admin/billing/events`);
      ok(billingEventsNoAuth.status === 401, 'Admin Billing Events: auth required');

      // Billing Events ledger requires ATTESTOR_BILLING_LEDGER_PG_URL — skip detailed checks when PG not configured
      const billingEventsRes = await fetch(`${BASE}/api/v1/admin/billing/events?accountId=${createAccountBody.account.id}&limit=10`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      if (billingEventsRes.status === 200) {
        const billingEventsBody = await billingEventsRes.json() as any;
        ok(billingEventsBody.summary.recordCount === 5, 'Admin Billing Events: five webhook events stored for account');
        ok(billingEventsBody.summary.appliedCount === 5, 'Admin Billing Events: all stored events applied');
        const checkoutLedger = billingEventsBody.records.find((entry: any) => entry.providerEventId === 'evt_checkout_account_001_completed');
        ok(Boolean(checkoutLedger), 'Admin Billing Events: checkout completion event present');
        ok(checkoutLedger.stripeCheckoutSessionId === checkoutBody.checkoutSessionId, 'Admin Billing Events: checkout event captures session id');
        ok(checkoutLedger.mappedPlanId === 'pro', 'Admin Billing Events: checkout event captures mapped plan');
        const pastDueLedger = billingEventsBody.records.find((entry: any) => entry.providerEventId === 'evt_sub_account_001_past_due');
        ok(Boolean(pastDueLedger), 'Admin Billing Events: past_due event present');
        ok(pastDueLedger.accountStatusAfter === 'suspended', 'Admin Billing Events: past_due captures suspended status');
        ok(pastDueLedger.billingStatusAfter === 'past_due', 'Admin Billing Events: past_due captures billing status');
        const activeLedger = billingEventsBody.records.find((entry: any) => entry.providerEventId === 'evt_sub_account_001_active');
        ok(Boolean(activeLedger), 'Admin Billing Events: active event present');
        ok(activeLedger.accountStatusBefore === 'suspended', 'Admin Billing Events: active event captures previous status');
        ok(activeLedger.accountStatusAfter === 'active', 'Admin Billing Events: active event captures restored status');
        ok(activeLedger.mappedPlanId === 'pro', 'Admin Billing Events: active event captures mapped plan');
        const invoiceFailedLedger = billingEventsBody.records.find((entry: any) => entry.providerEventId === 'evt_invoice_account_001_failed');
        ok(Boolean(invoiceFailedLedger), 'Admin Billing Events: invoice failure event present');
        ok(invoiceFailedLedger.stripeInvoiceId === 'in_account_001_failed', 'Admin Billing Events: invoice failure captures invoice id');
        ok(invoiceFailedLedger.stripeInvoiceAmountDue === 5000, 'Admin Billing Events: invoice failure captures amount due');
        const invoicePaidLedger = billingEventsBody.records.find((entry: any) => entry.providerEventId === 'evt_invoice_account_001_paid');
        ok(Boolean(invoicePaidLedger), 'Admin Billing Events: invoice paid event present');
        ok(invoicePaidLedger.stripeInvoiceStatus === 'paid', 'Admin Billing Events: invoice paid captures invoice status');
        ok(invoicePaidLedger.stripeInvoiceAmountPaid === 5000, 'Admin Billing Events: invoice paid captures amount paid');

        const billingEventTypeRes = await fetch(`${BASE}/api/v1/admin/billing/events?eventType=customer.subscription.updated`, {
          headers: { Authorization: 'Bearer admin-secret' },
        });
        ok(billingEventTypeRes.status === 200, 'Admin Billing Events: eventType filter status 200');
        const billingEventTypeBody = await billingEventTypeRes.json() as any;
        ok(billingEventTypeBody.records.length >= 2, 'Admin Billing Events: eventType filter returns Stripe subscription updates');
        console.log(`    billing events: ${billingEventsBody.summary.recordCount} records (PG ledger)`);
      } else {
        console.log(`    billing events: skipped (PG ledger not configured, status ${billingEventsRes.status})`);
      }

      const billingEntitlementsNoAuth = await fetch(`${BASE}/api/v1/admin/billing/entitlements`);
      ok(billingEntitlementsNoAuth.status === 401, 'Admin Billing Entitlements: auth required');

      const billingEntitlementsRes = await fetch(`${BASE}/api/v1/admin/billing/entitlements?accountId=${createAccountBody.account.id}`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(billingEntitlementsRes.status === 200, 'Admin Billing Entitlements: status 200');
      const billingEntitlementsBody = await billingEntitlementsRes.json() as any;
      ok(billingEntitlementsBody.summary.recordCount === 1, 'Admin Billing Entitlements: one record returned for account');
      ok(billingEntitlementsBody.records[0].status === 'active', 'Admin Billing Entitlements: active entitlement returned');
      ok(billingEntitlementsBody.records[0].effectivePlanId === 'pro', 'Admin Billing Entitlements: plan filter view shows pro');

      const metricsNoAuth = await fetch(`${BASE}/api/v1/admin/metrics`);
      ok(metricsNoAuth.status === 401, 'Admin Metrics: auth required');

      const metricsRes = await fetch(`${BASE}/api/v1/admin/metrics`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(metricsRes.status === 200, 'Admin Metrics: status 200');
      ok((metricsRes.headers.get('content-type') ?? '').includes('text/plain'), 'Admin Metrics: content type is text/plain');
      const metricsBody = await metricsRes.text();
      ok(metricsBody.includes('attestor_http_requests_total'), 'Admin Metrics: http request counter exposed');
      ok(metricsBody.includes('route=\"/api/v1/health\"'), 'Admin Metrics: health route labeled');
      ok(metricsBody.includes('attestor_trace_context_requests_total'), 'Admin Metrics: trace context counter exposed');
      ok(metricsBody.includes('attestor_billing_webhook_events_total'), 'Admin Metrics: billing webhook counter exposed');
      const durationBuckets = metricSamples(metricsBody, 'attestor_http_request_duration_seconds_bucket', {
        method: 'GET',
        route: '/api/v1/health',
      });
      ok(durationBuckets.length >= 2, 'Admin Metrics: duration histogram buckets exposed');
      ok(durationBuckets.every((value, index) => index === 0 || value >= durationBuckets[index - 1]), 'Admin Metrics: duration histogram buckets are monotonic');
      const durationCount = metricSamples(metricsBody, 'attestor_http_request_duration_seconds_count', {
        method: 'GET',
        route: '/api/v1/health',
      })[0];
      const plusInfBucket = metricSamples(metricsBody, 'attestor_http_request_duration_seconds_bucket', {
        method: 'GET',
        route: '/api/v1/health',
        le: '+Inf',
      })[0];
      ok(typeof durationCount === 'number' && typeof plusInfBucket === 'number' && plusInfBucket === durationCount, 'Admin Metrics: +Inf bucket matches histogram count');

      const scrapeMetricsNoAuth = await fetch(`${BASE}/api/v1/metrics`);
      ok(scrapeMetricsNoAuth.status === 401, 'Scrape Metrics: auth required');

      const scrapeMetricsWrongAuth = await fetch(`${BASE}/api/v1/metrics`, {
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      ok(scrapeMetricsWrongAuth.status === 401, 'Scrape Metrics: wrong token rejected');

      const scrapeMetricsRes = await fetch(`${BASE}/api/v1/metrics`, {
        headers: { Authorization: 'Bearer metrics-secret' },
      });
      ok(scrapeMetricsRes.status === 200, 'Scrape Metrics: status 200');
      ok((scrapeMetricsRes.headers.get('content-type') ?? '').includes('text/plain'), 'Scrape Metrics: content type is text/plain');
      const scrapeMetricsBody = await scrapeMetricsRes.text();
      ok(scrapeMetricsBody.includes('attestor_http_requests_total'), 'Scrape Metrics: request counter exposed');

      const observabilityLog = readFileSync(process.env.ATTESTOR_OBSERVABILITY_LOG_PATH!, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
      ok(observabilityLog.some((entry: any) => entry.route === '/api/v1/health' && entry.traceId), 'Observability Log: health request captured with trace id');
      ok(observabilityLog.some((entry: any) => entry.route === '/api/v1/billing/stripe/webhook' && entry.accountPresent === true), 'Observability Log: billing webhook captured with account context');
      ok(observabilityLog.every((entry: any) => !('accountId' in entry) && !('tenantId' in entry) && !('remoteAddress' in entry) && !('userAgent' in entry)), 'Observability Log: privacy-safe projection omits raw identifiers and client metadata');

      const telemetryNoAuth = await fetch(`${BASE}/api/v1/admin/telemetry`);
      ok(telemetryNoAuth.status === 401, 'Admin Telemetry: auth required');

      const telemetryRes = await fetch(`${BASE}/api/v1/admin/telemetry`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(telemetryRes.status === 200, 'Admin Telemetry: status 200');
      const telemetryBody = await telemetryRes.json() as any;
      ok(telemetryBody.telemetry.enabled === false, 'Admin Telemetry: disabled by default without OTLP env');

      const signupRes = await fetch(`${BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: 'Self Serve Co',
          email: 'founder@selfserve.example',
          displayName: 'Founder Owner',
          password: 'V9!pL4mQ7xT2zR5',
        }),
      });
      ok(signupRes.status === 201, 'Auth Signup: status 201');
      const signupBody = await signupRes.json() as any;
      let signupCookie = cookieHeaderFromResponse(signupRes);
      ok(Boolean(signupCookie), 'Auth Signup: session cookie issued');
      ok(signupBody.signup === true, 'Auth Signup: signup flag true');
      ok(signupBody.user.role === 'account_admin', 'Auth Signup: first user is account_admin');
      ok(signupBody.initialKey.planId === 'developer', 'Auth Signup: developer plan applied');
      ok(signupBody.commercial.currentPhase === 'evaluation', 'Auth Signup: signup starts in evaluation phase');
      ok(signupBody.commercial.includedMonthlyRunQuota === 500, 'Auth Signup: developer includes 500 hosted admissions before upgrade');
      ok(signupBody.commercial.firstHostedPlanId === 'starter', 'Auth Signup: starter is the first hosted paid plan');
      ok(signupBody.commercial.firstHostedPlanTrialDays === null, 'Auth Signup: paid checkout trial default is not surfaced as enabled');
      ok(typeof signupBody.initialKey.apiKey === 'string', 'Auth Signup: initial API key returned');

      const signupUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${signupBody.initialKey.apiKey}` },
      });
      ok(signupUsageRes.status === 200, 'Auth Signup: initial API key works');
      const signupUsageBody = await signupUsageRes.json() as any;
      ok(signupUsageBody.tenantContext.planId === 'developer', 'Auth Signup: developer plan visible in usage');
      ok(signupUsageBody.usage.quota === 500, 'Auth Signup: developer signup has 500 included hosted admissions');
      ok(signupUsageBody.usage.enforced === true, 'Auth Signup: developer hosted quota is enforced');

      const signupPipelineRunRes = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signupBody.initialKey.apiKey}`,
        },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(signupPipelineRunRes.status === 200, 'Auth Signup: evaluation account can consume one of the included developer hosted admissions');
      const signupPipelineRunBody = await signupPipelineRunRes.json() as any;
      ok(signupPipelineRunBody.decision === 'pass', 'Auth Signup: developer hosted admission still executes the governed pipeline');

      for (let attempt = 2; attempt <= 10; attempt += 1) {
        const res = await fetch(`${BASE}/api/v1/pipeline/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${signupBody.initialKey.apiKey}`,
          },
          body: JSON.stringify({
            candidateSql: COUNTERPARTY_SQL,
            intent: COUNTERPARTY_INTENT,
            fixtures: [COUNTERPARTY_FIXTURE],
            generatedReport: COUNTERPARTY_REPORT,
            reportContract: COUNTERPARTY_REPORT_CONTRACT,
            sign: false,
          }),
        });
        ok(res.status === 200, `Auth Signup: developer run ${attempt} stays within the included quota`);
      }

      const signupAdditionalRunRes = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signupBody.initialKey.apiKey}`,
        },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(signupAdditionalRunRes.status === 200, 'Auth Signup: developer quota is large enough that the live smoke does not exhaust it');

      const accountKeysRes = await fetch(`${BASE}/api/v1/account/api-keys`, {
        headers: csrfHeaders(signupCookie!),
      });
      ok(accountKeysRes.status === 200, 'Account API Keys: list status 200');
      const accountKeysBody = await accountKeysRes.json() as any;
      ok(accountKeysBody.keys.length === 1, 'Account API Keys: initial key listed');
      ok(accountKeysBody.keys[0].id === signupBody.initialKey.id, 'Account API Keys: initial key id matches signup response');

      const rotateAccountKeyRes = await fetch(`${BASE}/api/v1/account/api-keys/${signupBody.initialKey.id}/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(signupCookie!),
        },
      });
      ok(rotateAccountKeyRes.status === 201, 'Account API Keys: rotate status 201');
      const rotateAccountKeyBody = await rotateAccountKeyRes.json() as any;
      ok(typeof rotateAccountKeyBody.newKey.apiKey === 'string', 'Account API Keys: rotate returns new plaintext key');
      ok(rotateAccountKeyBody.previousKey.id === signupBody.initialKey.id, 'Account API Keys: rotate preserves previous key id reference');

      const revokeSupersededKeyRes = await fetch(`${BASE}/api/v1/account/api-keys/${signupBody.initialKey.id}/revoke`, {
        method: 'POST',
        headers: csrfHeaders(signupCookie!),
      });
      ok(revokeSupersededKeyRes.status === 200, 'Account API Keys: revoke superseded signup key status 200');
      const revokeSupersededKeyBody = await revokeSupersededKeyRes.json() as any;
      ok(revokeSupersededKeyBody.key.status === 'revoked', 'Account API Keys: superseded signup key marked revoked');

      const issueAccountKeyRes = await fetch(`${BASE}/api/v1/account/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(signupCookie!),
        },
      });
      ok(issueAccountKeyRes.status === 201, 'Account API Keys: issue status 201');
      const issueAccountKeyBody = await issueAccountKeyRes.json() as any;
      ok(typeof issueAccountKeyBody.key.apiKey === 'string', 'Account API Keys: plaintext key returned on issue');
      ok(issueAccountKeyBody.key.planId === 'developer', 'Account API Keys: issued key inherits developer plan');

      const deactivateKeyRes = await fetch(`${BASE}/api/v1/account/api-keys/${issueAccountKeyBody.key.id}/deactivate`, {
        method: 'POST',
        headers: csrfHeaders(signupCookie!),
      });
      ok(deactivateKeyRes.status === 200, 'Account API Keys: deactivate status 200');
      const deactivateKeyBody = await deactivateKeyRes.json() as any;
      ok(deactivateKeyBody.key.status === 'inactive', 'Account API Keys: key marked inactive');

      const reactivateKeyRes = await fetch(`${BASE}/api/v1/account/api-keys/${issueAccountKeyBody.key.id}/reactivate`, {
        method: 'POST',
        headers: csrfHeaders(signupCookie!),
      });
      ok(reactivateKeyRes.status === 200, 'Account API Keys: reactivate status 200');
      const reactivateKeyBody = await reactivateKeyRes.json() as any;
      ok(reactivateKeyBody.key.status === 'active', 'Account API Keys: key marked active again');

      const revokeKeyRes = await fetch(`${BASE}/api/v1/account/api-keys/${issueAccountKeyBody.key.id}/revoke`, {
        method: 'POST',
        headers: csrfHeaders(signupCookie!),
      });
      ok(revokeKeyRes.status === 200, 'Account API Keys: revoke status 200');
      const revokeKeyBody = await revokeKeyRes.json() as any;
      ok(revokeKeyBody.key.status === 'revoked', 'Account API Keys: key marked revoked');

      const signupReadOnlyCreateRes = await fetch(`${BASE}/api/v1/account/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(signupCookie!),
        },
        body: JSON.stringify({
          email: 'reader@selfserve.example',
          displayName: 'Reader',
          password: 'K8!vN3qT6xP1zM9',
          role: 'read_only',
        }),
      });
      ok(signupReadOnlyCreateRes.status === 201, 'Account API Keys: create read_only user status 201');

      const signupReadOnlyLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'reader@selfserve.example',
          password: 'K8!vN3qT6xP1zM9',
        }),
      });
      ok(signupReadOnlyLoginRes.status === 200, 'Account API Keys: read_only login status 200');
      const signupReadOnlyCookie = cookieHeaderFromResponse(signupReadOnlyLoginRes);
      ok(Boolean(signupReadOnlyCookie), 'Account API Keys: read_only session cookie issued');

      const readOnlyListKeysRes = await fetch(`${BASE}/api/v1/account/api-keys`, {
        headers: csrfHeaders(signupReadOnlyCookie!),
      });
      ok(readOnlyListKeysRes.status === 403, 'Account API Keys: read_only blocked from listing keys');

      const readOnlyIssueKeyRes = await fetch(`${BASE}/api/v1/account/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(signupReadOnlyCookie!),
        },
      });
      ok(readOnlyIssueKeyRes.status === 403, 'Account API Keys: read_only blocked from issuing keys');
}
