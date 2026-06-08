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
  currentTotpStepIndex,
  generateCurrentTotpCode,
  issueTenantApiKey,
  metricSamples,
  ok,
  pipelineRunHeaders,
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

export async function runAdminTenantKeyFlow(ctx: LiveApiHostedContext): Promise<void> {
      const createAccountBody = ctx.createAccountBody;
      const noAuth = await fetch(`${BASE}/api/v1/admin/tenant-keys`);
      ok(noAuth.status === 401, 'Admin API: auth required');

      const issueRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-issue-1',
        },
        body: JSON.stringify({
          tenantId: 'tenant-admin',
          tenantName: 'Admin Co',
          planId: 'pro',
        }),
      });
      ok(issueRes.status === 201, 'Admin API: issue key created');
      const issueBody = await issueRes.json() as any;
      ok(typeof issueBody.key.apiKey === 'string', 'Admin API: plaintext apiKey returned once');
      ok(issueBody.key.planId === 'pro', 'Admin API: plan persisted');
      ok(issueBody.key.monthlyRunQuota === 250000, 'Admin API: plan default quota applied');

      const issueReplayRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-issue-1',
        },
        body: JSON.stringify({
          tenantId: 'tenant-admin',
          tenantName: 'Admin Co',
          planId: 'pro',
        }),
      });
      ok(issueReplayRes.status === 201, 'Admin API: tenant issue replay preserves status');
      ok(issueReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin API: tenant issue replay header set');
      const issueReplayBody = await issueReplayRes.json() as any;
      ok(issueReplayBody.key.id === issueBody.key.id, 'Admin API: tenant issue replay preserves key id');
      ok(issueReplayBody.key.apiKey === issueBody.key.apiKey, 'Admin API: tenant issue replay preserves api key');

      const invalidPlanRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
        },
        body: JSON.stringify({
          tenantId: 'tenant-invalid',
          tenantName: 'Invalid Co',
          planId: 'wrong-plan',
        }),
      });
      ok(invalidPlanRes.status === 400, 'Admin API: invalid plan rejected');
      const invalidPlanBody = await invalidPlanRes.json() as any;
      ok(String(invalidPlanBody.error).includes('Valid plans'), 'Admin API: invalid plan error is actionable');

      const tenantUsage = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issueBody.key.apiKey}` },
      });
      ok(tenantUsage.status === 200, 'Admin API: issued key works on tenant route');
      const tenantUsageBody = await tenantUsage.json() as any;
      ok(tenantUsageBody.tenantContext.tenantId === 'tenant-admin', 'Admin API: tenant route resolves issued key');

      const tenantRun = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: pipelineRunHeaders('admin-tenant-key-initial-run', {
          Authorization: `Bearer ${issueBody.key.apiKey}`,
        }),
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(tenantRun.status === 200, 'Admin API: issued key can consume pipeline run');

      const listRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(listRes.status === 200, 'Admin API: list status 200');
      const listBody = await listRes.json() as any;
      ok(listBody.defaults.maxActiveKeysPerTenant === 2, 'Admin API: list exposes active-key policy');
      const listed = listBody.keys.find((entry: any) => entry.id === issueBody.key.id);
      ok(Boolean(listed), 'Admin API: issued key appears in list');
      ok(!('apiKeyHash' in listed), 'Admin API: hash not exposed');
      ok(typeof listed.lastUsedAt === 'string', 'Admin API: lastUsedAt captured after tenant use');

      const rotateRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-rotate-1',
        },
        body: JSON.stringify({}),
      });
      ok(rotateRes.status === 201, 'Admin API: rotate status 201');
      const rotateBody = await rotateRes.json() as any;
      ok(typeof rotateBody.newKey.apiKey === 'string', 'Admin API: rotate returns new plaintext API key');
      ok(rotateBody.newKey.rotatedFromKeyId === issueBody.key.id, 'Admin API: new key points to previous key');
      ok(rotateBody.previousKey.supersededByKeyId === rotateBody.newKey.id, 'Admin API: previous key points to replacement');

      const rotateReplayRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/rotate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-rotate-1',
        },
        body: JSON.stringify({}),
      });
      ok(rotateReplayRes.status === 201, 'Admin API: rotate replay preserves status');
      ok(rotateReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin API: rotate replay header set');
      const rotateReplayBody = await rotateReplayRes.json() as any;
      ok(rotateReplayBody.newKey.id === rotateBody.newKey.id, 'Admin API: rotate replay preserves new key id');
      ok(rotateReplayBody.newKey.apiKey === rotateBody.newKey.apiKey, 'Admin API: rotate replay preserves plaintext API key');

      const overlapOldRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issueBody.key.apiKey}` },
      });
      ok(overlapOldRes.status === 200, 'Admin API: previous key stays active during overlap');
      const overlapNewRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${rotateBody.newKey.apiKey}` },
      });
      ok(overlapNewRes.status === 200, 'Admin API: rotated key becomes active immediately');

      const thirdKeyRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
        },
        body: JSON.stringify({
          tenantId: 'tenant-admin',
          tenantName: 'Admin Co',
          planId: 'pro',
        }),
      });
      ok(thirdKeyRes.status === 409, 'Admin API: third active key for tenant rejected');

      const deactivateRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/deactivate`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-deactivate-1',
        },
      });
      ok(deactivateRes.status === 200, 'Admin API: deactivate status 200');
      const deactivateBody = await deactivateRes.json() as any;
      ok(deactivateBody.key.status === 'inactive', 'Admin API: deactivate marks key inactive');
      ok(typeof deactivateBody.key.deactivatedAt === 'string', 'Admin API: deactivate captures deactivatedAt');

      const deactivatedTenantRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issueBody.key.apiKey}` },
      });
      ok(deactivatedTenantRes.status === 401, 'Admin API: inactive key no longer works');

      const reactivateRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/reactivate`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-reactivate-1',
        },
      });
      ok(reactivateRes.status === 200, 'Admin API: reactivate status 200');
      const reactivateBody = await reactivateRes.json() as any;
      ok(reactivateBody.key.status === 'active', 'Admin API: reactivate restores active status');
      ok(reactivateBody.key.deactivatedAt === null, 'Admin API: reactivate clears deactivatedAt');

      const reactivatedTenantRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issueBody.key.apiKey}` },
      });
      ok(reactivatedTenantRes.status === 200, 'Admin API: reactivated key works again');

      await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/deactivate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-secret' },
      });

      const usageNoAuth = await fetch(`${BASE}/api/v1/admin/usage`);
      ok(usageNoAuth.status === 401, 'Admin Usage: auth required');

      const usageListRes = await fetch(`${BASE}/api/v1/admin/usage`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(usageListRes.status === 200, 'Admin Usage: list status 200');
      const usageListBody = await usageListRes.json() as any;
      const usageListed = usageListBody.records.find((entry: any) => entry.tenantId === 'tenant-admin');
      ok(Boolean(usageListed), 'Admin Usage: tenant-admin appears in usage report');
      ok(usageListed.tenantName === 'Admin Co', 'Admin Usage: tenant name enriched');
      ok(usageListed.planId === 'pro', 'Admin Usage: plan enriched');
      ok(usageListed.used === 1, 'Admin Usage: used count tracked');
      ok(usageListBody.summary.totalUsed >= 1, 'Admin Usage: summary totalUsed present');

      const accountRun = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: pipelineRunHeaders('admin-tenant-key-account-run', {
          Authorization: `Bearer ${createAccountBody.initialKey.apiKey}`,
        }),
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(accountRun.status === 200, 'Admin Accounts: created account key can consume pipeline run');
      const accountRunBody = await accountRun.json() as any;
      ok(accountRunBody.rateLimit.requestsPerWindow === 20, 'Admin Accounts: run response reflects synced pro rate limit');
      ok(accountRunBody.rateLimit.used >= 1, 'Admin Accounts: run rate limit usage increments');

      const archiveAccountRes = await fetch(`${BASE}/api/v1/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-create-archive-1',
        },
        body: JSON.stringify({
          accountName: 'Archive Co',
          contactEmail: 'ops@archive.example',
          tenantId: 'tenant-archive',
          tenantName: 'Archive Tenant',
        }),
      });
      ok(archiveAccountRes.status === 201, 'Admin Accounts: archive test account created');
      const archiveAccountBody = await archiveAccountRes.json() as any;

      const archiveRes = await fetch(`${BASE}/api/v1/admin/accounts/${archiveAccountBody.account.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-archive-1',
        },
        body: JSON.stringify({ reason: 'customer offboarded' }),
      });
      ok(archiveRes.status === 200, 'Admin Accounts: archive status 200');
      const archiveBody = await archiveRes.json() as any;
      ok(archiveBody.account.status === 'archived', 'Admin Accounts: archive marks account archived');
      ok(typeof archiveBody.account.archivedAt === 'string', 'Admin Accounts: archive captures archivedAt');

      const archivedUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${archiveAccountBody.initialKey.apiKey}` },
      });
      ok(archivedUsageRes.status === 403, 'Admin Accounts: archived account key blocked');
      const archivedUsageBody = await archivedUsageRes.json() as any;
      ok(archivedUsageBody.accountStatus === 'archived', 'Admin Accounts: archived account status surfaced');

      const archivedReactivateRes = await fetch(`${BASE}/api/v1/admin/accounts/${archiveAccountBody.account.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
        },
        body: JSON.stringify({ reason: 'should fail' }),
      });
      ok(archivedReactivateRes.status === 409, 'Admin Accounts: archived account cannot reactivate');

      const rateTenantRes = await fetch(`${BASE}/api/v1/admin/tenant-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
        },
        body: JSON.stringify({
          tenantId: 'tenant-rate',
          tenantName: 'Rate Co',
          planId: 'starter',
        }),
      });
      ok(rateTenantRes.status === 201, 'Admin API: starter tenant for rate-limit test issued');
      const rateTenantBody = await rateTenantRes.json() as any;
      const previousStarterRateLimitRequests = process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS;
      const previousRateLimitWindowSeconds = process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS;
      process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS = '1';
      process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS = '15';
      await waitForRateLimitWindowHead(
        Number.parseInt(process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS ?? '15', 10) || 15,
      );

      for (let attempt = 0; attempt < 1; attempt += 1) {
        const allowed = await fetch(`${BASE}/api/v1/pipeline/run`, {
          method: 'POST',
          headers: pipelineRunHeaders(`admin-tenant-key-rate-allowed-${attempt + 1}`, {
            Authorization: `Bearer ${rateTenantBody.key.apiKey}`,
          }),
          body: JSON.stringify({
            candidateSql: COUNTERPARTY_SQL,
            intent: COUNTERPARTY_INTENT,
            fixtures: [COUNTERPARTY_FIXTURE],
            generatedReport: COUNTERPARTY_REPORT,
            reportContract: COUNTERPARTY_REPORT_CONTRACT,
            sign: false,
          }),
        });
        ok(allowed.status === 200, `Rate Limit: starter request ${attempt + 1} allowed`);
        const allowedBody = await allowed.json() as any;
        ok(allowedBody.rateLimit.requestsPerWindow === 1, `Rate Limit: request ${attempt + 1} limit exposed`);
      }

      const limitedSync = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: pipelineRunHeaders('admin-tenant-key-rate-limited-sync', {
          Authorization: `Bearer ${rateTenantBody.key.apiKey}`,
        }),
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(limitedSync.status === 429, 'Rate Limit: sync route throttled after starter window exhausted');
      ok(limitedSync.headers.get('retry-after') !== null, 'Rate Limit: retry-after header present');
      const limitedSyncBody = await limitedSync.json() as any;
      ok(limitedSyncBody.rateLimit.remaining === 0, 'Rate Limit: sync 429 reports zero remaining');
      ok(limitedSyncBody.rateLimit.requestsPerWindow === 1, 'Rate Limit: sync 429 reports starter limit');

      const limitedAsync = await fetch(`${BASE}/api/v1/pipeline/run-async`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rateTenantBody.key.apiKey}`,
          'Idempotency-Key': 'admin-tenant-key-rate-limited-async',
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
      ok(limitedAsync.status === 429, 'Rate Limit: async route shares tenant window');

      await new Promise((resolve) => setTimeout(resolve, 15_200));

      const afterReset = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: pipelineRunHeaders('admin-tenant-key-after-reset', {
          Authorization: `Bearer ${rateTenantBody.key.apiKey}`,
        }),
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(afterReset.status === 200, 'Rate Limit: window reset allows new request');
      const afterResetBody = await afterReset.json() as any;
      ok(afterResetBody.rateLimit.used === 1, 'Rate Limit: reset starts new window usage at 1');
      if (typeof previousStarterRateLimitRequests === 'string') {
        process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS = previousStarterRateLimitRequests;
      } else {
        delete process.env.ATTESTOR_RATE_LIMIT_STARTER_REQUESTS;
      }
      if (typeof previousRateLimitWindowSeconds === 'string') {
        process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS = previousRateLimitWindowSeconds;
      } else {
        delete process.env.ATTESTOR_RATE_LIMIT_WINDOW_SECONDS;
      }

      const usageAccountFilterRes = await fetch(`${BASE}/api/v1/admin/usage?tenantId=tenant-account`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(usageAccountFilterRes.status === 200, 'Admin Usage: account tenant filter status 200');
      const usageAccountFilterBody = await usageAccountFilterRes.json() as any;
      ok(usageAccountFilterBody.records.length === 1, 'Admin Usage: account tenant appears in filter');
      ok(usageAccountFilterBody.records[0].accountId === createAccountBody.account.id, 'Admin Usage: account id enriched');
      ok(usageAccountFilterBody.records[0].accountName === 'Account Co', 'Admin Usage: account name enriched');

      const usageFilterRes = await fetch(`${BASE}/api/v1/admin/usage?tenantId=tenant-admin`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(usageFilterRes.status === 200, 'Admin Usage: tenant filter status 200');
      const usageFilterBody = await usageFilterRes.json() as any;
      ok(usageFilterBody.records.length === 1, 'Admin Usage: tenant filter narrows records');
      ok(usageFilterBody.records[0].tenantId === 'tenant-admin', 'Admin Usage: tenant filter record correct');

      const revokeRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-revoke-1',
        },
      });
      ok(revokeRes.status === 200, 'Admin API: revoke status 200');
      const revokeBody = await revokeRes.json() as any;
      ok(revokeBody.key.status === 'revoked', 'Admin API: revoke marks record revoked');

      const revokeReplayRes = await fetch(`${BASE}/api/v1/admin/tenant-keys/${issueBody.key.id}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-tenant-revoke-1',
        },
      });
      ok(revokeReplayRes.status === 200, 'Admin API: revoke replay preserves status');
      ok(revokeReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin API: revoke replay header set');
      const revokeReplayBody = await revokeReplayRes.json() as any;
      ok(revokeReplayBody.key.id === revokeBody.key.id, 'Admin API: revoke replay preserves key id');
      ok(revokeReplayBody.key.status === 'revoked', 'Admin API: revoke replay preserves status');

      const revokedTenantRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issueBody.key.apiKey}` },
      });
      ok(revokedTenantRes.status === 401, 'Admin API: revoked key no longer works');

      const replacementTenantRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${rotateBody.newKey.apiKey}` },
      });
      ok(replacementTenantRes.status === 200, 'Admin API: replacement key stays active after old revoke');

      const auditNoAuth = await fetch(`${BASE}/api/v1/admin/audit`);
      ok(auditNoAuth.status === 401, 'Admin Audit: auth required');

      const auditRes = await fetch(`${BASE}/api/v1/admin/audit?limit=200`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(auditRes.status === 200, 'Admin Audit: list status 200');
      const auditBody = await auditRes.json() as any;
      ok(auditBody.summary.chainIntact === true, 'Admin Audit: chain intact');
      ok(auditBody.summary.recordCount >= 12, 'Admin Audit: expected records present');
      const accountAudit = auditBody.records.find((entry: any) => entry.action === 'account.created' && entry.accountId === createAccountBody.account.id);
      ok(Boolean(accountAudit), 'Admin Audit: account create event present');
      ok(accountAudit.idempotencyKey === 'idem-account-create-1', 'Admin Audit: account create idempotency captured');
      const accountBillingAudit = auditBody.records.find((entry: any) => entry.action === 'account.billing.attached' && entry.accountId === createAccountBody.account.id);
      ok(Boolean(accountBillingAudit), 'Admin Audit: account billing attach event present');
      const accountSuspendAudit = auditBody.records.find((entry: any) => entry.action === 'account.suspended' && entry.accountId === createAccountBody.account.id);
      ok(Boolean(accountSuspendAudit), 'Admin Audit: account suspend event present');
      const accountReactivateAudit = auditBody.records.find((entry: any) => entry.action === 'account.reactivated' && entry.accountId === createAccountBody.account.id);
      ok(Boolean(accountReactivateAudit), 'Admin Audit: account reactivate event present');
      const accountArchiveAudit = auditBody.records.find((entry: any) => entry.action === 'account.archived' && entry.accountId === archiveAccountBody.account.id);
      ok(Boolean(accountArchiveAudit), 'Admin Audit: account archive event present');
      const stripeWebhookAudit = auditBody.records.find((entry: any) => entry.action === 'billing.stripe.webhook_applied' && entry.accountId === createAccountBody.account.id);
      ok(Boolean(stripeWebhookAudit), 'Admin Audit: stripe webhook event present');
      ok(stripeWebhookAudit.actorType === 'stripe_webhook', 'Admin Audit: stripe webhook actor type captured');
      const issueAudit = auditBody.records.find((entry: any) => entry.action === 'tenant_key.issued' && entry.tenantKeyId === issueBody.key.id);
      ok(Boolean(issueAudit), 'Admin Audit: tenant key issue event present');
      const rotateAudit = auditBody.records.find((entry: any) => entry.action === 'tenant_key.rotated' && entry.tenantKeyId === rotateBody.newKey.id);
      ok(Boolean(rotateAudit), 'Admin Audit: tenant key rotate event present');
      const deactivateAudit = auditBody.records.find((entry: any) => entry.action === 'tenant_key.deactivated' && entry.tenantKeyId === issueBody.key.id);
      ok(Boolean(deactivateAudit), 'Admin Audit: tenant key deactivate event present');
      const reactivateAudit = auditBody.records.find((entry: any) => entry.action === 'tenant_key.reactivated' && entry.tenantKeyId === issueBody.key.id);
      ok(Boolean(reactivateAudit), 'Admin Audit: tenant key reactivate event present');
      const revokeAudit = auditBody.records.find((entry: any) => entry.action === 'tenant_key.revoked' && entry.tenantKeyId === issueBody.key.id);
      ok(Boolean(revokeAudit), 'Admin Audit: tenant key revoke event present');

      const auditTenantFilterRes = await fetch(`${BASE}/api/v1/admin/audit?tenantId=tenant-admin`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(auditTenantFilterRes.status === 200, 'Admin Audit: tenant filter status 200');
      const auditTenantFilterBody = await auditTenantFilterRes.json() as any;
      ok(auditTenantFilterBody.records.every((entry: any) => entry.tenantId === 'tenant-admin'), 'Admin Audit: tenant filter narrows records');

      console.log(`    account=${createAccountBody.account.id}, issued=${issueBody.key.id}, usageUsed=${usageListed.used}, revoked=${revokeBody.key.status}`);
}
