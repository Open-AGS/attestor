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

export async function runHostedAccountIdentityFlow(ctx: LiveApiHostedContext): Promise<void> {
    console.log('\n  [Admin tenant key management API]');
      const plansNoAuth = await fetch(`${BASE}/api/v1/admin/plans`);
      ok(plansNoAuth.status === 401, 'Admin Plans: auth required');

      const plansRes = await fetch(`${BASE}/api/v1/admin/plans`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(plansRes.status === 200, 'Admin Plans: list status 200');
      const plansBody = await plansRes.json() as any;
      ok(plansBody.defaults.hostedProvisioningPlanId === 'trial', 'Admin Plans: hosted default = trial');
      ok(plansBody.defaults.rateLimitWindowSeconds === 5, 'Admin Plans: rate-limit window override exposed');
      ok(plansBody.defaults.asyncExecutionShared === true, 'Admin Plans: async execution backend reported as shared');
      ok(plansBody.defaults.asyncWeightedDispatchShared === true, 'Admin Plans: async weighted dispatch backend reported as shared');
      const trialPlan = plansBody.plans.find((entry: any) => entry.id === 'trial');
      ok(Boolean(trialPlan), 'Admin Plans: trial account entitlement present');
      ok(trialPlan.defaultMonthlyRunQuota === 10_000, 'Admin Plans: trial quota = 10,000');
      ok(trialPlan.defaultPipelineRequestsPerWindow === 3, 'Admin Plans: trial rate limit override = 3');
      ok(trialPlan.defaultAsyncActiveJobsPerTenant === 1, 'Admin Plans: trial active execution cap override = 1');
      ok(trialPlan.defaultAsyncDispatchWeight === 1, 'Admin Plans: trial dispatch weight override = 1');
      ok(trialPlan.defaultAsyncDispatchWindowMs === 400, 'Admin Plans: trial dispatch window = 400ms');
      ok(trialPlan.billingSurface === 'workflow_entitlement', 'Admin Plans: billing surface is workflow entitlement');
      ok(trialPlan.defaultForHostedProvisioning === true, 'Admin Plans: trial is hosted default');

      const accountsNoAuth = await fetch(`${BASE}/api/v1/admin/accounts`);
      ok(accountsNoAuth.status === 401, 'Admin Accounts: auth required');

      const createAccountRes = await fetch(`${BASE}/api/v1/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-create-1',
        },
        body: JSON.stringify({
          accountName: 'Account Co',
          contactEmail: 'ops@account.example',
          tenantId: 'tenant-account',
          tenantName: 'Account Tenant',
        }),
      });
      ok(createAccountRes.status === 201, 'Admin Accounts: create status 201');
      ctx.createAccountBody = await createAccountRes.json() as any;
      const createAccountBody = ctx.createAccountBody;
      ok(createAccountBody.account.accountName === 'Account Co', 'Admin Accounts: account name persisted');
      ok(typeof createAccountBody.initialKey.apiKey === 'string', 'Admin Accounts: initial key returned');
      ok(createAccountBody.initialKey.planId === 'trial', 'Admin Accounts: trial account entitlement applied');
      ok(createAccountBody.initialKey.monthlyRunQuota === 10_000, 'Admin Accounts: trial quota applied');

      const createAccountReplayRes = await fetch(`${BASE}/api/v1/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-create-1',
        },
        body: JSON.stringify({
          accountName: 'Account Co',
          contactEmail: 'ops@account.example',
          tenantId: 'tenant-account',
          tenantName: 'Account Tenant',
        }),
      });
      ok(createAccountReplayRes.status === 201, 'Admin Accounts: idempotent replay preserves status');
      ok(createAccountReplayRes.headers.get('x-attestor-idempotent-replay') === 'true', 'Admin Accounts: replay header set');
      const createAccountReplayBody = await createAccountReplayRes.json() as any;
      ok(createAccountReplayBody.account.id === createAccountBody.account.id, 'Admin Accounts: replay preserves account id');
      ok(createAccountReplayBody.initialKey.id === createAccountBody.initialKey.id, 'Admin Accounts: replay preserves initial key id');
      ok(createAccountReplayBody.initialKey.apiKey === createAccountBody.initialKey.apiKey, 'Admin Accounts: replay preserves plaintext API key');

      const createAccountConflictRes = await fetch(`${BASE}/api/v1/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-secret',
          'Idempotency-Key': 'idem-account-create-1',
        },
        body: JSON.stringify({
          accountName: 'Account Co Changed',
          contactEmail: 'ops@account.example',
          tenantId: 'tenant-account',
          tenantName: 'Account Tenant',
        }),
      });
      ok(createAccountConflictRes.status === 409, 'Admin Accounts: mismatched idempotent request rejected');

      const accountsListRes = await fetch(`${BASE}/api/v1/admin/accounts`, {
        headers: { Authorization: 'Bearer admin-secret' },
      });
      ok(accountsListRes.status === 200, 'Admin Accounts: list status 200');
      const accountsListBody = await accountsListRes.json() as any;
      const listedAccount = accountsListBody.accounts.find((entry: any) => entry.id === createAccountBody.account.id);
      ctx.listedAccount = listedAccount;
      ok(Boolean(listedAccount), 'Admin Accounts: new account appears in list');
      ok(listedAccount.primaryTenantId === 'tenant-account', 'Admin Accounts: primary tenant persisted');

      const accountUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(accountUsageRes.status === 200, 'Admin Accounts: initial key works on tenant route');
      const accountUsageBody = await accountUsageRes.json() as any;
      ok(accountUsageBody.rateLimit.requestsPerWindow === 3, 'Admin Accounts: trial rate limit visible on account usage');

      const forgedTenantToken = unsignedBearerToken({
        tenantId: createAccountBody.account.primaryTenantId,
        tenantName: 'Forged Tenant',
        planId: 'trial',
        monthlyRunQuota: 999999,
      });
      const forgedUsageRes = await fetch(`${BASE}/api/v1/account/usage`, {
        headers: { Authorization: `Bearer ${forgedTenantToken}` },
      });
      ok(forgedUsageRes.status === 401, 'Hosted auth: unsigned bearer tenant claim is rejected');
      const forgedUsageBody = await forgedUsageRes.json() as any;
      ok(
        String(forgedUsageBody.error ?? '').includes('Valid tenant API key required'),
        'Hosted auth: forged bearer rejection explains tenant API key requirement',
      );

      const forgedBootstrapRes = await fetch(`${BASE}/api/v1/account/users/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedTenantToken}`,
        },
        body: JSON.stringify({
          email: 'forged@account.example',
          displayName: 'Forged Admin',
          password: 'ForgedBootstrap123!',
        }),
      });
      ok(forgedBootstrapRes.status === 401, 'Hosted auth: forged bearer token cannot bootstrap an account admin');

      const accountSummaryRes = await fetch(`${BASE}/api/v1/account`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(accountSummaryRes.status === 200, 'Account API: summary status 200');
      const accountSummaryBody = await accountSummaryRes.json() as any;
      ok(accountSummaryBody.account.id === createAccountBody.account.id, 'Account API: summary returns hosted account');
      ok(accountSummaryBody.account.billing.provider === null, 'Account API: billing starts empty');
      ok(accountSummaryBody.entitlement.provider === 'manual', 'Account API: initial entitlement provider is manual');
      ok(accountSummaryBody.entitlement.status === 'provisioned', 'Account API: initial entitlement status is provisioned');
      ok(accountSummaryBody.entitlement.accessEnabled === true, 'Account API: initial entitlement enables access');

      const accountEntitlementRes = await fetch(`${BASE}/api/v1/account/entitlement`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(accountEntitlementRes.status === 200, 'Account Entitlement: status 200');
      const accountEntitlementBody = await accountEntitlementRes.json() as any;
      ok(accountEntitlementBody.entitlement.accountId === createAccountBody.account.id, 'Account Entitlement: account id matches');
      ok(accountEntitlementBody.entitlement.effectivePlanId === 'trial', 'Account Entitlement: trial account entitlement reflected');

      const accountFeaturesInitialRes = await fetch(`${BASE}/api/v1/account/features`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(accountFeaturesInitialRes.status === 200, 'Account Features: initial status 200');
      const accountFeaturesInitialBody = await accountFeaturesInitialRes.json() as any;
      const trialApiFeature = accountFeaturesInitialBody.features.find((entry: any) => entry.key === 'api.access');
      ok(Boolean(trialApiFeature), 'Account Features: api.access feature present');
      ok(trialApiFeature.granted === true, 'Account Features: api.access initially granted by trial default');
      ok(trialApiFeature.grantSource === 'plan_default', 'Account Features: api.access initial source is plan default');

      const bootstrapRes = await fetch(`${BASE}/api/v1/account/users/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${createAccountBody.initialKey.apiKey}`,
        },
        body: JSON.stringify({
          email: 'owner@account.example',
          displayName: 'Owner Admin',
          password: 'BootstrapPass123!',
        }),
      });
      ok(bootstrapRes.status === 201, 'Account Users: bootstrap status 201');
      const bootstrapBody = await bootstrapRes.json() as any;
      ok(bootstrapBody.bootstrap === true, 'Account Users: bootstrap flag true');
      ok(bootstrapBody.user.role === 'account_admin', 'Account Users: bootstrap user is account_admin');

      const bootstrapConflictRes = await fetch(`${BASE}/api/v1/account/users/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${createAccountBody.initialKey.apiKey}`,
        },
        body: JSON.stringify({
          email: 'second@account.example',
          displayName: 'Second Admin',
          password: 'BootstrapPass456!',
        }),
      });
      ok(bootstrapConflictRes.status === 409, 'Account Users: bootstrap blocked once users exist');

      const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@account.example',
          password: 'BootstrapPass123!',
        }),
      });
      ok(loginRes.status === 200, 'Auth: login status 200');
      const loginBody = await loginRes.json() as any;
      ctx.accountAdminCookie = cookieHeaderFromResponse(loginRes);
      let accountAdminCookie = ctx.accountAdminCookie;
      ok(Boolean(accountAdminCookie), 'Auth: login sets session cookie');
      ok(loginBody.session.source === 'account_session', 'Auth: login returns account_session source');
      ok(loginBody.user.lastLoginAt !== null, 'Auth: login updates lastLoginAt');

      const meRes = await fetch(`${BASE}/api/v1/auth/me`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(meRes.status === 200, 'Auth: me status 200');
      const meBody = await meRes.json() as any;
      ok(meBody.user.email === 'owner@account.example', 'Auth: me returns logged-in user');
      ok(meBody.session.role === 'account_admin', 'Auth: me returns account_admin role');

      const sessionAccountRes = await fetch(`${BASE}/api/v1/account`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(sessionAccountRes.status === 200, 'Account API: summary also works with session cookie');
      const sessionAccountBody = await sessionAccountRes.json() as any;
      ok(sessionAccountBody.tenantContext.source === 'account_session', 'Account API: session summary source=account_session');

      const usersNoSessionRes = await fetch(`${BASE}/api/v1/account/users`, {
        headers: { Authorization: `Bearer ${createAccountBody.initialKey.apiKey}` },
      });
      ok(usersNoSessionRes.status === 401, 'Account Users: session required for user listing');

      const createBillingAdminRes = await fetch(`${BASE}/api/v1/account/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
        },
        body: JSON.stringify({
          email: 'billing@account.example',
          displayName: 'Billing Admin',
          password: 'R7!mQ2zL9pV4xS8',
          role: 'billing_admin',
        }),
      });
      ok(createBillingAdminRes.status === 201, 'Account Users: create billing_admin status 201');
      ctx.createBillingAdminBody = await createBillingAdminRes.json() as any;
      const createBillingAdminBody = ctx.createBillingAdminBody;
      ok(createBillingAdminBody.user.role === 'billing_admin', 'Account Users: billing_admin role persisted');

      const createReadOnlyRes = await fetch(`${BASE}/api/v1/account/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
        },
        body: JSON.stringify({
          email: 'readonly@account.example',
          displayName: 'Read Only',
          password: 'H7!kP2vR9xL4sT6',
          role: 'read_only',
        }),
      });
      ok(createReadOnlyRes.status === 201, 'Account Users: create read_only status 201');
      ctx.createReadOnlyBody = await createReadOnlyRes.json() as any;
      const createReadOnlyBody = ctx.createReadOnlyBody;
      ok(createReadOnlyBody.user.role === 'read_only', 'Account Users: read_only role persisted');

      const inviteRes = await fetch(`${BASE}/api/v1/account/users/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
        },
        body: JSON.stringify({
          email: 'invitee@account.example',
          displayName: 'Invited User',
          role: 'read_only',
        }),
      });
      ok(inviteRes.status === 201, 'Account Users: invite status 201');
      const inviteBody = await inviteRes.json() as any;
      ok(inviteBody.invite.status === 'pending', 'Account Users: invite starts pending');
      ok(typeof inviteBody.inviteToken === 'string' && inviteBody.inviteToken.startsWith('atok_'), 'Account Users: invite token returned once');

      const invitesListRes = await fetch(`${BASE}/api/v1/account/users/invites`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(invitesListRes.status === 200, 'Account Users: invite list status 200');
      const invitesListBody = await invitesListRes.json() as any;
      ok(invitesListBody.invites.some((entry: any) => entry.id === inviteBody.invite.id && entry.status === 'pending'), 'Account Users: invite list shows pending invite');

      const acceptInviteRes = await fetch(`${BASE}/api/v1/account/users/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: inviteBody.inviteToken,
          password: 'InviteAccept123!',
        }),
      });
      ok(acceptInviteRes.status === 201, 'Account Users: invite accept status 201');
      const acceptInviteBody = await acceptInviteRes.json() as any;
      const invitedCookie = cookieHeaderFromResponse(acceptInviteRes);
      ok(Boolean(invitedCookie), 'Account Users: invite accept issues session cookie');
      ok(acceptInviteBody.accepted === true, 'Account Users: invite accept flag true');
      ok(acceptInviteBody.user.email === 'invitee@account.example', 'Account Users: invite creates expected user');

      const usersListRes = await fetch(`${BASE}/api/v1/account/users`, {
        headers: csrfHeaders(accountAdminCookie!),
      });
      ok(usersListRes.status === 200, 'Account Users: list status 200');
      const usersListBody = await usersListRes.json() as any;
      ok(usersListBody.users.length === 4, 'Account Users: list returns bootstrap + billing + read_only + invitee');

      const readOnlyLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'H7!kP2vR9xL4sT6',
        }),
      });
      ok(readOnlyLoginRes.status === 200, 'Auth: read_only login status 200');
      let readOnlyCookie = cookieHeaderFromResponse(readOnlyLoginRes);
      ok(Boolean(readOnlyCookie), 'Auth: read_only login sets session cookie');

      const readOnlyUsersRes = await fetch(`${BASE}/api/v1/account/users`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(readOnlyUsersRes.status === 403, 'RBAC: read_only user blocked from user listing');

      const readOnlyPasswordChangeRes = await fetch(`${BASE}/api/v1/auth/password/change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(readOnlyCookie!),
        },
        body: JSON.stringify({
          currentPassword: 'H7!kP2vR9xL4sT6',
          newPassword: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyPasswordChangeRes.status === 200, 'Auth: password change status 200');
      const readOnlyPasswordChangeBody = await readOnlyPasswordChangeRes.json() as any;
      const rotatedReadOnlyCookie = cookieHeaderFromResponse(readOnlyPasswordChangeRes);
      ok(Boolean(rotatedReadOnlyCookie), 'Auth: password change rotates session cookie');
      ok(readOnlyPasswordChangeBody.changed === true, 'Auth: password change returns changed=true');

      const oldReadOnlySessionRes = await fetch(`${BASE}/api/v1/auth/me`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(oldReadOnlySessionRes.status === 401, 'Auth: pre-change read_only session is revoked');
      readOnlyCookie = rotatedReadOnlyCookie;

      const readOnlyOldPasswordLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'H7!kP2vR9xL4sT6',
        }),
      });
      ok(readOnlyOldPasswordLoginRes.status === 401, 'Auth: old read_only password no longer works');

      const readOnlyNewPasswordLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyNewPasswordLoginRes.status === 200, 'Auth: new read_only password works');
      readOnlyCookie = cookieHeaderFromResponse(readOnlyNewPasswordLoginRes);

      const readOnlyMfaEnrollRes = await fetch(`${BASE}/api/v1/account/mfa/totp/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(readOnlyCookie!),
        },
        body: JSON.stringify({
          password: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyMfaEnrollRes.status === 200, 'MFA: TOTP enrollment start status 200');
      const readOnlyMfaEnrollBody = await readOnlyMfaEnrollRes.json() as any;
      ok(readOnlyMfaEnrollBody.enrollment.method === 'totp', 'MFA: enrollment method is totp');
      ok(typeof readOnlyMfaEnrollBody.enrollment.secretBase32 === 'string', 'MFA: enrollment returns secret');
      ok(String(readOnlyMfaEnrollBody.enrollment.otpauthUrl).startsWith('otpauth://totp/'), 'MFA: enrollment returns otpauth URL');
      const readOnlyPendingMfaRes = await fetch(`${BASE}/api/v1/account/mfa`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(readOnlyPendingMfaRes.status === 200, 'MFA: summary status 200 while pending');
      const readOnlyPendingMfaBody = await readOnlyPendingMfaRes.json() as any;
      ok(readOnlyPendingMfaBody.mfa.pendingEnrollment === true, 'MFA: summary shows pending enrollment');

      const readOnlyMfaConfirmStep = currentTotpStepIndex();
      const readOnlyMfaConfirmRes = await fetch(`${BASE}/api/v1/account/mfa/totp/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(readOnlyCookie!),
        },
        body: JSON.stringify({
          code: generateCurrentTotpCode(readOnlyMfaEnrollBody.enrollment.secretBase32),
        }),
      });
      ok(readOnlyMfaConfirmRes.status === 200, 'MFA: TOTP confirm status 200');
      const readOnlyMfaConfirmBody = await readOnlyMfaConfirmRes.json() as any;
      const readOnlyMfaCookie = cookieHeaderFromResponse(readOnlyMfaConfirmRes);
      ok(Boolean(readOnlyMfaCookie), 'MFA: confirm rotates session cookie');
      ok(readOnlyMfaConfirmBody.enabled === true, 'MFA: confirm enables MFA');
      ok(Array.isArray(readOnlyMfaConfirmBody.recoveryCodes) && readOnlyMfaConfirmBody.recoveryCodes.length === 8, 'MFA: confirm returns recovery codes once');

      const stalePreMfaSessionRes = await fetch(`${BASE}/api/v1/auth/me`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(stalePreMfaSessionRes.status === 401, 'MFA: pre-enrollment session revoked after enable');
      readOnlyCookie = readOnlyMfaCookie;

      const readOnlyEnabledMfaRes = await fetch(`${BASE}/api/v1/account/mfa`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(readOnlyEnabledMfaRes.status === 200, 'MFA: summary status 200 after enable');
      const readOnlyEnabledMfaBody = await readOnlyEnabledMfaRes.json() as any;
      ok(readOnlyEnabledMfaBody.mfa.enabled === true, 'MFA: summary shows enabled');
      ok(readOnlyEnabledMfaBody.mfa.recoveryCodesRemaining === 8, 'MFA: summary shows recovery code count');

      const readOnlyMfaLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'readonly@account.example',
          password: 'M4!qZ8nY2vC7pR1',
        }),
      });
      ok(readOnlyMfaLoginRes.status === 200, 'MFA: login returns challenge response');
      const readOnlyMfaLoginBody = await readOnlyMfaLoginRes.json() as any;
      ok(readOnlyMfaLoginBody.mfaRequired === true, 'MFA: login requires second factor');
      ok(typeof readOnlyMfaLoginBody.challengeToken === 'string' && readOnlyMfaLoginBody.challengeToken.startsWith('atok_'), 'MFA: challenge token returned');

      const readOnlyMfaWrongVerifyRes = await fetch(`${BASE}/api/v1/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: readOnlyMfaLoginBody.challengeToken,
          code: '000000',
        }),
      });
      ok(readOnlyMfaWrongVerifyRes.status === 400, 'MFA: wrong TOTP code rejected');

      await waitForTotpStepAfter(readOnlyMfaConfirmStep);
      const readOnlyMfaVerifyRes = await fetch(`${BASE}/api/v1/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: readOnlyMfaLoginBody.challengeToken,
          code: generateCurrentTotpCode(readOnlyMfaEnrollBody.enrollment.secretBase32),
        }),
      });
      ok(readOnlyMfaVerifyRes.status === 200, 'MFA: verify challenge status 200');
      const readOnlyMfaVerifyBody = await readOnlyMfaVerifyRes.json() as any;
      readOnlyCookie = cookieHeaderFromResponse(readOnlyMfaVerifyRes);
      ok(Boolean(readOnlyCookie), 'MFA: verify issues new session cookie');
      ok(readOnlyMfaVerifyBody.verified === true, 'MFA: verify returns verified=true');
      ok(readOnlyMfaVerifyBody.recoveryCodeUsed === false, 'MFA: verify notes TOTP path');

      const readOnlyMfaDisableRes = await fetch(`${BASE}/api/v1/account/mfa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(readOnlyCookie!),
        },
        body: JSON.stringify({
          password: 'M4!qZ8nY2vC7pR1',
          recoveryCode: readOnlyMfaConfirmBody.recoveryCodes[0],
        }),
      });
      ok(readOnlyMfaDisableRes.status === 200, 'MFA: disable status 200');
      const readOnlyMfaDisableBody = await readOnlyMfaDisableRes.json() as any;
      const readOnlyPostDisableCookie = cookieHeaderFromResponse(readOnlyMfaDisableRes);
      ok(Boolean(readOnlyPostDisableCookie), 'MFA: disable rotates session cookie');
      ok(readOnlyMfaDisableBody.disabled === true, 'MFA: disable returns disabled=true');
      ok(readOnlyMfaDisableBody.recoveryCodeUsed === true, 'MFA: disable accepts recovery code');
      readOnlyCookie = readOnlyPostDisableCookie;

      const readOnlyDisabledMfaRes = await fetch(`${BASE}/api/v1/account/mfa`, {
        headers: csrfHeaders(readOnlyCookie!),
      });
      ok(readOnlyDisabledMfaRes.status === 200, 'MFA: summary status 200 after disable');
      const readOnlyDisabledMfaBody = await readOnlyDisabledMfaRes.json() as any;
      ok(readOnlyDisabledMfaBody.mfa.enabled === false, 'MFA: summary shows disabled after disable');

      const billingAdminLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'R7!mQ2zL9pV4xS8',
        }),
      });
      ok(billingAdminLoginRes.status === 200, 'Auth: billing_admin login status 200');
      let billingAdminCookie = cookieHeaderFromResponse(billingAdminLoginRes);
      ok(Boolean(billingAdminCookie), 'Auth: billing_admin login sets session cookie');

      const billingResetRes = await fetch(`${BASE}/api/v1/account/users/${createBillingAdminBody.user.id}/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(accountAdminCookie!),
        },
        body: JSON.stringify({ ttlMinutes: 20 }),
      });
      ok(billingResetRes.status === 201, 'Account Users: password reset issue status 201');
      const billingResetBody = await billingResetRes.json() as any;
      ok(billingResetBody.reset.status === 'pending', 'Account Users: password reset token pending');
      ok(typeof billingResetBody.resetToken === 'string' && billingResetBody.resetToken.startsWith('atok_'), 'Account Users: password reset token returned');

      const billingPasswordResetApplyRes = await fetch(`${BASE}/api/v1/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken: billingResetBody.resetToken,
          newPassword: 'T8!nR3yM6qW1cZ5',
        }),
      });
      ok(billingPasswordResetApplyRes.status === 200, 'Auth: password reset apply status 200');
      const billingPasswordResetApplyBody = await billingPasswordResetApplyRes.json() as any;
      ok(billingPasswordResetApplyBody.reset === true, 'Auth: password reset apply flag true');

      const billingOldPasswordLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'R7!mQ2zL9pV4xS8',
        }),
      });
      ok(billingOldPasswordLoginRes.status === 401, 'Auth: billing_admin old password rejected after reset');

      const billingNewPasswordLoginRes = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'billing@account.example',
          password: 'T8!nR3yM6qW1cZ5',
        }),
      });
      ok(billingNewPasswordLoginRes.status === 200, 'Auth: billing_admin new password accepted after reset');
      billingAdminCookie = cookieHeaderFromResponse(billingNewPasswordLoginRes);
      ok(Boolean(billingAdminCookie), 'Auth: billing_admin reset login sets new session cookie');
      ctx.accountAdminCookie = accountAdminCookie;
      ctx.readOnlyCookie = readOnlyCookie;
      ctx.billingAdminCookie = billingAdminCookie;
}
