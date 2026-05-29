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

export async function runHostedPlanUsageFlow(): Promise<void> {
    process.env.ATTESTOR_TENANT_KEYS = 'pro-key:tenant-pro:Acme:pro:2';

    console.log('\n  [GET /api/v1/account/usage — tenant usage]');
    {
      const res = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: 'Bearer pro-key' },
      });
      ok(res.status === 200, 'Usage: status 200');
      const body = await res.json() as any;
      ok(body.tenantContext.tenantId === 'tenant-pro', 'Usage: tenant id');
      ok(body.tenantContext.planId === 'pro', 'Usage: plan id');
      ok(body.usage.used === 0, 'Usage: starts at 0');
      ok(body.usage.quota === 2, 'Usage: quota = 2');
      ok(body.usage.remaining === 2, 'Usage: remaining = 2');
      console.log(`    tenant=${body.tenantContext.tenantId}, plan=${body.tenantContext.planId}, used=${body.usage.used}/${body.usage.quota}`);
    }

    console.log('\n  [POST /api/v1/pipeline/run — tenant metering]');
    {
      const first = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pro-key' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(first.status === 200, 'Quota: first run allowed');
      const firstBody = await first.json() as any;
      ok(firstBody.tenantContext.planId === 'pro', 'Quota: plan propagated');
      ok(firstBody.usage.used === 1, 'Quota: first run increments usage');
      ok(firstBody.usage.remaining === 1, 'Quota: first run remaining = 1');

      const second = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pro-key' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(second.status === 200, 'Quota: second run allowed');
      const secondBody = await second.json() as any;
      ok(secondBody.usage.used === 2, 'Quota: second run increments usage');
      ok(secondBody.usage.remaining === 0, 'Quota: second run remaining = 0');

      const third = await fetch(`${BASE}/api/v1/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pro-key' },
        body: JSON.stringify({
          candidateSql: COUNTERPARTY_SQL,
          intent: COUNTERPARTY_INTENT,
          fixtures: [COUNTERPARTY_FIXTURE],
          generatedReport: COUNTERPARTY_REPORT,
          reportContract: COUNTERPARTY_REPORT_CONTRACT,
          sign: false,
        }),
      });
      ok(third.status === 200, 'Quota: paid Pro third run continues into soft overage');
      const thirdBody = await third.json() as any;
      ok(thirdBody.usage.used === 3, 'Quota: paid overage run increments usage');
      ok(thirdBody.usage.remaining === 0, 'Quota: paid overage remaining stays at 0');
      ok(thirdBody.usage.enforced === false, 'Quota: paid overage is not a hard stop');
      ok(thirdBody.usage.overage === true, 'Quota: paid overage is marked');
      ok(thirdBody.usage.overageUnits === 1, 'Quota: paid overage units are reported');
      console.log(`    quota soft-overage: used=${thirdBody.usage.used}/${thirdBody.usage.quota}, status=${third.status}`);

      const ledger = readUsageLedgerSnapshot();
      const persisted = ledger.records.find((entry) => entry.tenantId === 'tenant-pro' && entry.period === secondBody.usage.period);
      ok(Boolean(persisted), 'Quota: usage persisted to local ledger');
      ok(persisted?.used === 3, 'Quota: persisted ledger count includes paid overage');
    }

    process.env.ATTESTOR_TENANT_KEYS = '';

    console.log('\n  [File-backed tenant key issuance + revoke]');
    {
      const issued = issueTenantApiKey({
        tenantId: 'tenant-file',
        tenantName: 'File Co',
        planId: 'starter',
        monthlyRunQuota: 1,
      });

      const usageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issued.apiKey}` },
      });
      ok(usageRes.status === 200, 'File store: issued key is accepted');
      const usageBody = await usageRes.json() as any;
      ok(usageBody.tenantContext.tenantId === 'tenant-file', 'File store: tenant id propagated');
      ok(usageBody.tenantContext.planId === 'starter', 'File store: plan propagated');
      ok(usageBody.usage.quota === 1, 'File store: quota propagated');
      ok(usageBody.rateLimit.requestsPerWindow === 3, 'File store: rate limit propagated');

      const anonymousRes = await fetch(`${BASE}/api/v1/account/usage`);
      ok(anonymousRes.status === 401, 'File store: active keys enforce auth');

      revokeTenantApiKey(issued.record.id);

      const revokedRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${issued.apiKey}` },
      });
      ok(revokedRes.status === 401, 'File store: revoked key rejected');
      console.log(`    issued=${issued.record.id}, secret=redacted, revokedStatus=${revokedRes.status}`);
    }
}
