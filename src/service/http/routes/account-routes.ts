import type { Context, Hono } from 'hono';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type * as AccountMfa from '../../account/account-mfa.js';
import type * as AccountOidc from '../../account/account-oidc.js';
import type * as AccountPasskeys from '../../account/account-passkeys.js';
import type * as AccountSessionStore from '../../account/account-session-store.js';
import type * as AccountSaml from '../../account/account-saml.js';
import type * as AccountUserStore from '../../account/account-user-store.js';
import type * as BillingExport from '../../billing-export.js';
import type * as BillingFeatureService from '../../billing-feature-service.js';
import type * as BillingReconciliation from '../../billing-reconciliation.js';
import type * as PlanCatalog from '../../plan-catalog.js';
import type * as RateLimit from '../../rate-limit.js';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import type { SecretEnvelopeStatus } from '../../secret-envelope.js';
import type * as StripeBilling from '../../stripe-billing.js';
import {
  type AccountApiKeyService,
} from '../../application/account-api-key-service.js';
import { AccountAuthServiceError, type AccountAuthService } from '../../application/account-auth-service.js';
import type { AccountStateService } from '../../application/account-state-service.js';
import {
  AccountUserManagementServiceError,
  type AccountUserManagementService,
} from '../../application/account-user-management-service.js';
import type {
  PipelineIdempotencyReadyResult,
  PipelineIdempotencyService,
} from '../../application/pipeline-idempotency-service.js';
import type { HostedAccountRecord } from '../../account/account-store.js';
import type {
  AccountUserPasskeyCredentialRecord,
  AccountUserRecord,
  AccountUserRole,
} from '../../account/account-user-store.js';
import type { AccountUserActionTokenRecord } from '../../account/account-user-token-store.js';
import type { HostedBillingEntitlementRecord } from '../../billing-entitlement-store.js';
import type { HostedPasskeyAuthenticationChallengeState, HostedPasskeyAuthenticatorHint, HostedPasskeyRegistrationChallengeState } from '../../account/account-passkeys.js';
import type { TenantKeyRecord } from '../../tenant-key-store.js';
import type { AccountAccessContext, TenantContext } from '../../tenant-isolation.js';
import type { UsageContext } from '../../usage-meter.js';
import {
  recordAuthAttemptFailureShared as recordAuthAttemptFailure,
  recordAuthAttemptSuccessShared as recordAuthAttemptSuccess,
  recordAuthAttemptUseShared as recordAuthAttemptUse,
} from '../../account/auth-abuse-guard.js';
import {
  accountApiKeyServiceErrorResponse,
  accountAuthServiceErrorResponse,
  accountPasswordErrorResponse,
  accountRouteErrorMessage,
  accountUserManagementServiceErrorResponse,
  accountUserRoleFilter,
  AUTH_ATTEMPT_KIND,
  authAttemptBucket,
  authAttemptFor,
  authAttemptForActionToken,
  authAttemptForPasswordReset,
  hostedEmailDeliveryProviderFilter,
  hostedEmailDeliveryStatusFilter,
  maybeRateLimitAuthAttempt,
  maybeRateLimitCurrentPasswordAttempt,
  maybeRateLimitFederatedCallback,
  readAccountJsonBody,
} from './account-route-helpers.js';

interface CurrentHostedAccountResult {
  tenant: TenantContext;
  account: HostedAccountRecord;
  usage: UsageContext;
  rateLimit: RateLimit.TenantRateLimitContext;
}

export interface AccountMutationAuditInput {
  routeId: string;
  action: AdminAuditAction;
  access: AccountAccessContext;
  requestPayload: unknown;
  statusCode: number;
  accountId?: string | null;
  tenantId?: string | null;
  tenantKeyId?: string | null;
  planId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AccountRouteDeps {
  authService: AccountAuthService;
  apiKeyService: AccountApiKeyService;
  stateService: AccountStateService;
  userManagementService: AccountUserManagementService;
  currentHostedAccount(context: Context): Promise<CurrentHostedAccountResult | Response>;
  setSessionCookieForRecord(context: Context, sessionToken: string, expiresAt: string): void;
  accountUserView(record: AccountUserRecord): Record<string, unknown>;
  adminAccountView(record: HostedAccountRecord): Record<string, unknown>;
  accountApiKeyView(record: TenantKeyRecord): Record<string, unknown>;
  verifyAccountUserPasswordRecord: typeof AccountUserStore.verifyAccountUserPasswordRecord;
  totpSummary: typeof AccountMfa.totpSummary;
  buildHostedPasskeyAuthenticationOptions: typeof AccountPasskeys.buildHostedPasskeyAuthenticationOptions;
  asAuthenticationResponse(value: unknown): AuthenticationResponseJSON | null;
  parsePasskeyAuthenticationChallenge(
    record: AccountUserActionTokenRecord,
  ): HostedPasskeyAuthenticationChallengeState | null;
  verifyHostedPasskeyAuthentication: typeof AccountPasskeys.verifyHostedPasskeyAuthentication;
  passkeyCredentialToWebAuthnCredential: typeof AccountPasskeys.passkeyCredentialToWebAuthnCredential;
  getHostedSamlMetadata: typeof AccountSaml.getHostedSamlMetadata;
  buildHostedSamlAuthorizationRequest: typeof AccountSaml.buildHostedSamlAuthorizationRequest;
  completeHostedSamlAuthorization: typeof AccountSaml.completeHostedSamlAuthorization;
  hostedSamlAllowsAutomaticLinking: typeof AccountSaml.hostedSamlAllowsAutomaticLinking;
  linkAccountUserSamlIdentity: typeof AccountSaml.linkAccountUserSamlIdentity;
  buildHostedOidcAuthorizationRequest: typeof AccountOidc.buildHostedOidcAuthorizationRequest;
  completeHostedOidcAuthorization: typeof AccountOidc.completeHostedOidcAuthorization;
  hostedOidcAllowsAutomaticLinking: typeof AccountOidc.hostedOidcAllowsAutomaticLinking;
  linkAccountUserOidcIdentity: typeof AccountOidc.linkAccountUserOidcIdentity;
  verifyTotpCodeWithStep: typeof AccountMfa.verifyTotpCodeWithStep;
  verifyAndConsumeRecoveryCode: typeof AccountMfa.verifyAndConsumeRecoveryCode;
  requireAccountSession(
    context: Context,
    options?: {
      roles?: AccountUserRole[];
      allowApiKey?: boolean;
    },
  ): Response | null;
  currentAccountAccess(context: Context): AccountAccessContext | null;
  buildHostedPasskeyRegistrationOptions: typeof AccountPasskeys.buildHostedPasskeyRegistrationOptions;
  parsePasskeyRegistrationChallenge(
    record: AccountUserActionTokenRecord,
  ): HostedPasskeyRegistrationChallengeState | null;
  asRegistrationResponse(value: unknown): RegistrationResponseJSON | null;
  verifyHostedPasskeyRegistration: typeof AccountPasskeys.verifyHostedPasskeyRegistration;
  buildAccountUserPasskeyCredentialRecord: typeof AccountPasskeys.buildAccountUserPasskeyCredentialRecord;
  generateHostedPasskeyUserHandle: typeof AccountPasskeys.generateHostedPasskeyUserHandle;
  accountUserDetailedMfaView(record: AccountUserRecord): ReturnType<typeof AccountMfa.totpSummary>;
  accountUserDetailedOidcView(
    record: AccountUserRecord,
    requestOrigin?: string | URL | null,
  ): Record<string, unknown>;
  accountUserDetailedSamlView(
    record: AccountUserRecord,
    requestOrigin?: string | URL | null,
  ): Record<string, unknown>;
  accountUserDetailedPasskeyView(record: AccountUserRecord): Record<string, unknown>;
  accountPasskeyCredentialView(record: AccountUserPasskeyCredentialRecord): Record<string, unknown>;
  decryptTotpSecret: typeof AccountMfa.decryptTotpSecret;
  getSecretEnvelopeStatus(): SecretEnvelopeStatus;
  encryptTotpSecret: typeof AccountMfa.encryptTotpSecret;
  generateRecoveryCodes: typeof AccountMfa.generateRecoveryCodes;
  generateTotpSecretBase32: typeof AccountMfa.generateTotpSecretBase32;
  buildTotpOtpAuthUrl: typeof AccountMfa.buildTotpOtpAuthUrl;
  normalizePasskeyAuthenticatorHint(value: unknown): HostedPasskeyAuthenticatorHint | null;
  currentAccountRole(context: Context): AccountUserRole | null;
  getTenantPipelineRateLimit: typeof RateLimit.getTenantPipelineRateLimit;
  readHostedBillingEntitlement(account: HostedAccountRecord): Promise<HostedBillingEntitlementRecord>;
  buildHostedFeatureServiceView: typeof BillingFeatureService.buildHostedFeatureServiceView;
  accountUserActionTokenView(record: AccountUserActionTokenRecord): Record<string, unknown>;
  getCookie(context: Context, key: string, prefix?: string): string | undefined;
  deleteCookie(context: Context, key: string, options?: { path?: string }): void;
  sessionCookieName: typeof AccountSessionStore.sessionCookieName;
  accountMfaErrorResponse(context: Context, error: unknown): Response | null;
  getHostedPlan: typeof PlanCatalog.getHostedPlan;
  createHostedCheckoutSession: typeof StripeBilling.createHostedCheckoutSession;
  stripeBillingErrorResponse(context: Context, error: unknown): Response | null;
  createHostedBillingPortalSession: typeof StripeBilling.createHostedBillingPortalSession;
  buildHostedBillingExport: typeof BillingExport.buildHostedBillingExport;
  renderHostedBillingExportCsv: typeof BillingExport.renderHostedBillingExportCsv;
  buildHostedBillingReconciliation: typeof BillingReconciliation.buildHostedBillingReconciliation;
  billingEntitlementView(record: HostedBillingEntitlementRecord): Record<string, unknown>;
  currentTenant(context: Context): TenantContext;
  recordAccountMutationAudit(input: AccountMutationAuditInput): Promise<void>;
  accountMutationIdempotencyService?: PipelineIdempotencyService;
}

export function registerAccountRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    authService,
    apiKeyService,
    stateService,
    userManagementService,
    currentHostedAccount,
    setSessionCookieForRecord,
    accountUserView,
    adminAccountView,
    accountApiKeyView,
    verifyAccountUserPasswordRecord,
    totpSummary,
    buildHostedPasskeyAuthenticationOptions,
    asAuthenticationResponse,
    parsePasskeyAuthenticationChallenge,
    verifyHostedPasskeyAuthentication,
    passkeyCredentialToWebAuthnCredential,
    getHostedSamlMetadata,
    buildHostedSamlAuthorizationRequest,
    completeHostedSamlAuthorization,
    hostedSamlAllowsAutomaticLinking,
    linkAccountUserSamlIdentity,
    buildHostedOidcAuthorizationRequest,
    completeHostedOidcAuthorization,
    hostedOidcAllowsAutomaticLinking,
    linkAccountUserOidcIdentity,
    verifyTotpCodeWithStep,
    verifyAndConsumeRecoveryCode,
    requireAccountSession,
    currentAccountAccess,
    buildHostedPasskeyRegistrationOptions,
    parsePasskeyRegistrationChallenge,
    asRegistrationResponse,
    verifyHostedPasskeyRegistration,
    buildAccountUserPasskeyCredentialRecord,
    generateHostedPasskeyUserHandle,
    accountUserDetailedMfaView,
    accountUserDetailedOidcView,
    accountUserDetailedSamlView,
    accountUserDetailedPasskeyView,
    accountPasskeyCredentialView,
    decryptTotpSecret,
    encryptTotpSecret,
    generateRecoveryCodes,
    generateTotpSecretBase32,
    buildTotpOtpAuthUrl,
    normalizePasskeyAuthenticatorHint,
    getTenantPipelineRateLimit,
    readHostedBillingEntitlement,
    buildHostedFeatureServiceView,
    accountUserActionTokenView,
    getCookie,
    deleteCookie,
    sessionCookieName,
    accountMfaErrorResponse,
    getHostedPlan,
    createHostedCheckoutSession,
    stripeBillingErrorResponse,
    createHostedBillingPortalSession,
    buildHostedBillingExport,
    renderHostedBillingExportCsv,
    buildHostedBillingReconciliation,
    billingEntitlementView,
    currentTenant,
    recordAccountMutationAudit,
    accountMutationIdempotencyService,
  } = deps;

  async function recordPasskeyAuthenticationFailure(record: AccountUserActionTokenRecord): Promise<void> {
    const now = new Date().toISOString();
    const nextRecord = structuredClone(record);
    nextRecord.attemptCount += 1;
    nextRecord.lastAttemptAt = now;
    nextRecord.updatedAt = now;
    if (nextRecord.maxAttempts !== null && nextRecord.attemptCount >= nextRecord.maxAttempts) {
      nextRecord.revokedAt = now;
    }
    await stateService.saveAccountUserActionTokenRecord(nextRecord);
  }

  async function recordAccountSessionMutationAudit(input: AccountMutationAuditInput): Promise<void> {
    await recordAccountMutationAudit(input);
  }

  type AccountMutationIdempotencyBegin =
    | { readonly kind: 'ready'; readonly ready: PipelineIdempotencyReadyResult | null }
    | { readonly kind: 'response'; readonly response: Response };

  function accountIdempotencyKeyFor(c: Context): string | null {
    const normalized = c.req.header('Idempotency-Key')?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  function accountIdempotencyReplayResponse(input: {
    readonly statusCode: number;
    readonly responseBody: unknown;
    readonly replay: boolean;
  }): Response {
    return new Response(JSON.stringify(input.responseBody), {
      status: input.statusCode,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store',
        ...(input.replay ? { 'x-attestor-idempotent-replay': 'true' } : {}),
      },
    });
  }

  async function beginAccountMutationIdempotency(
    c: Context,
    access: AccountAccessContext,
    routeId: string,
    requestPayload: unknown,
  ): Promise<AccountMutationIdempotencyBegin> {
    const idempotencyKey = accountIdempotencyKeyFor(c);
    if (!idempotencyKey) {
      return { kind: 'ready', ready: null };
    }

    if (!accountMutationIdempotencyService) {
      return {
        kind: 'response',
        response: c.json({
          error: 'Account mutation idempotency store is not configured.',
        }, 503),
      };
    }

    const begin = await accountMutationIdempotencyService.begin({
      idempotencyKey,
      tenantId: `account:${access.accountId}`,
      routeId,
      requestPayload,
    });

    if (begin.kind === 'ready') {
      return { kind: 'ready', ready: begin };
    }

    if (begin.kind === 'replay') {
      return {
        kind: 'response',
        response: accountIdempotencyReplayResponse({
          statusCode: begin.statusCode,
          responseBody: begin.responseBody,
          replay: true,
        }),
      };
    }

    if (begin.kind === 'conflict') {
      return {
        kind: 'response',
        response: c.json({
          error: 'Idempotency-Key was already used for a different account mutation request.',
        }, 409),
      };
    }

    return {
      kind: 'response',
      response: c.json({
        error: 'Account mutation idempotency store is not configured.',
      }, 503),
    };
  }

  async function finalizeAccountMutationIdempotency(
    access: AccountAccessContext,
    routeId: string,
    requestPayload: unknown,
    idempotency: PipelineIdempotencyReadyResult | null,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!idempotency?.idempotencyKey || !accountMutationIdempotencyService) {
      return responseBody;
    }
    return accountMutationIdempotencyService.finalize({
      idempotencyKey: idempotency.idempotencyKey,
      tenantId: `account:${access.accountId}`,
      routeId,
      requestPayload,
      statusCode,
      responseBody,
    });
  }

app.post('/api/v1/account/users/bootstrap', async (c) => {
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  try {
    const created = await authService.bootstrapFirstUser({
      current,
      email,
      displayName,
      password,
    });
    return c.json({
      user: accountUserView(created.user),
      bootstrap: true,
    }, 201);
  } catch (err) {
    const mapped = accountAuthServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/auth/signup', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const accountName = typeof body.accountName === 'string' ? body.accountName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const authAttempt = authAttemptFor(c, email);
  const signupRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (signupRateLimit) return signupRateLimit;

  try {
    const signup = await authService.signup({
      accountName,
      email,
      displayName,
      password,
    });
    await recordAuthAttemptSuccess(authAttempt);

    setSessionCookieForRecord(c, signup.sessionToken, signup.session.expiresAt);

    return c.json({
      signup: true,
      session: {
        id: signup.session.id,
        expiresAt: signup.session.expiresAt,
        source: 'account_session',
      },
      user: accountUserView(signup.user),
      account: adminAccountView(signup.account),
      commercial: signup.commercial,
      initialKey: {
        ...accountApiKeyView(signup.initialKey),
        apiKey: signup.apiKey,
      },
    }, 201);
  } catch (err) {
    const mapped = accountAuthServiceErrorResponse(c, err);
    if (mapped) {
      if (err instanceof AccountAuthServiceError) {
        await recordAuthAttemptFailure(authAttempt);
      }
      return mapped;
    }
    throw err;
  }
});

app.post('/api/v1/auth/login', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const authAttempt = authAttemptFor(c, email);
  const loginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (loginRateLimit) return loginRateLimit;

  try {
    const login = await authService.login({ email, password });
    await recordAuthAttemptSuccess(authAttempt);

    if (login.mfaRequired) {
      return c.json({
        mfaRequired: true,
        challengeToken: login.challengeToken,
        challenge: login.challenge,
        user: accountUserView(login.user),
        account: adminAccountView(login.account),
      });
    }

    setSessionCookieForRecord(c, login.sessionToken, login.session.expiresAt);

    return c.json({
      session: {
        id: login.session.id,
        expiresAt: login.session.expiresAt,
        source: 'account_session',
      },
      user: accountUserView(login.user),
      account: adminAccountView(login.account),
    });
  } catch (err) {
    const mapped = accountAuthServiceErrorResponse(c, err);
    if (mapped) {
      if (err instanceof AccountAuthServiceError && err.statusCode === 401) {
        await recordAuthAttemptFailure(authAttempt);
      }
      return mapped;
    }
    throw err;
  }
});

const HOSTED_PASSKEY_LOGIN_UNAVAILABLE_ERROR = 'Hosted passkey login is not available for that account identifier.';

app.post('/api/v1/auth/passkeys/options', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const authAttempt = authAttemptFor(c, email);
  const passkeyOptionsRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (passkeyOptionsRateLimit) return passkeyOptionsRateLimit;

  if (!email) {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: 'email is required for hosted passkey login in the current first slice.' }, 400);
  }

  const user = await stateService.findAccountUserByEmail(email);
  if (!user || user.status !== 'active') {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: HOSTED_PASSKEY_LOGIN_UNAVAILABLE_ERROR }, 404);
  }
  if (user.passkeys.credentials.length === 0) {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: HOSTED_PASSKEY_LOGIN_UNAVAILABLE_ERROR }, 404);
  }

  const account = await stateService.findHostedAccountById(user.accountId);
  if (!account) {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: HOSTED_PASSKEY_LOGIN_UNAVAILABLE_ERROR }, 404);
  }
  if (account.status === 'archived') {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: HOSTED_PASSKEY_LOGIN_UNAVAILABLE_ERROR }, 404);
  }

  try {
    const built = await buildHostedPasskeyAuthenticationOptions({
      requestOrigin: c.req.url,
      user,
    });
    const issued = await stateService.issueAccountPasskeyChallengeToken({
      purpose: 'passkey_authentication',
      accountId: account.id,
      accountUserId: user.id,
      email: user.email,
      context: {
        challenge: built.challengeState.challenge,
        rpId: built.challengeState.rpId,
        origin: built.challengeState.origin,
      },
    });
    return c.json({
      challengeToken: issued.token,
      authentication: built.authentication,
      mode: 'email_lookup',
      hintedUser: null,
    });
  } catch (err) {
    await recordAuthAttemptFailure(authAttempt);
    return c.json({ error: accountRouteErrorMessage(err) }, 400);
  }
});

app.post('/api/v1/auth/passkeys/verify', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
  const response = asAuthenticationResponse(body.response);
  if (!challengeToken || !response) {
    return c.json({ error: 'challengeToken and a valid WebAuthn authentication response are required.' }, 400);
  }

  const challengeRecord = await stateService.findAccountUserActionTokenByToken(challengeToken);
  const challenge = challengeRecord ? parsePasskeyAuthenticationChallenge(challengeRecord) : null;
  if (!challengeRecord || !challenge || !challengeRecord.accountUserId) {
    return c.json({ error: 'Passkey authentication challenge is invalid or expired.' }, 400);
  }

  const user = await stateService.findAccountUserById(challengeRecord.accountUserId);
  const account = user ? await stateService.findHostedAccountById(user.accountId) : null;
  if (!user || !account || account.id !== challengeRecord.accountId || user.status !== 'active' || account.status === 'archived') {
    await recordPasskeyAuthenticationFailure(challengeRecord);
    return c.json({ error: 'Passkey authentication challenge is invalid or expired.' }, 400);
  }

  const credentialUser = await stateService.findAccountUserByPasskeyCredentialId(response.id);
  if (!credentialUser || credentialUser.id !== user.id) {
    await recordPasskeyAuthenticationFailure(challengeRecord);
    return c.json({ error: 'Passkey credential could not be matched to the challenged account user.' }, 400);
  }

  const credentialIndex = user.passkeys.credentials.findIndex((entry) => entry.credentialId === response.id);
  if (credentialIndex < 0) {
    await recordPasskeyAuthenticationFailure(challengeRecord);
    return c.json({ error: 'Passkey credential could not be matched to the challenged account user.' }, 400);
  }
  const storedCredential = user.passkeys.credentials[credentialIndex]!;

  let verification;
  try {
    verification = await verifyHostedPasskeyAuthentication({
      challengeState: challenge,
      response,
      credential: passkeyCredentialToWebAuthnCredential(storedCredential),
    });
  } catch (err) {
    await recordPasskeyAuthenticationFailure(challengeRecord);
    return c.json({ error: accountRouteErrorMessage(err) }, 400);
  }
  if (!verification.verified) {
    await recordPasskeyAuthenticationFailure(challengeRecord);
    return c.json({ error: 'Passkey authentication could not be verified.' }, 400);
  }

  const now = new Date().toISOString();
  const nextUser = structuredClone(user);
  const nextCredential = nextUser.passkeys.credentials[credentialIndex]!;
  nextCredential.counter = verification.authenticationInfo.newCounter;
  nextCredential.deviceType = verification.authenticationInfo.credentialDeviceType;
  nextCredential.backedUp = verification.authenticationInfo.credentialBackedUp;
  nextCredential.lastUsedAt = now;
  nextUser.passkeys.updatedAt = now;
  nextUser.updatedAt = now;
  await stateService.saveAccountUserRecord(nextUser);
  await stateService.consumeAccountUserActionToken(challengeRecord.id);
  await stateService.revokeAccountUserActionTokensForUser(user.id, 'passkey_authentication');

  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  const issued = await stateService.issueAccountSession({
    accountId: account.id,
    accountUserId: user.id,
    role: user.role,
  });
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);

  return c.json({
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    upstreamAuth: {
      provider: 'passkey',
      credentialId: storedCredential.credentialId,
    },
    user: accountUserView(loginTouch.record),
    account: adminAccountView(account),
  });
});

app.get('/api/v1/auth/saml/metadata', (c) => {
  try {
    const metadata = getHostedSamlMetadata(c.req.url);
    c.header('content-type', 'application/samlmetadata+xml; charset=utf-8');
    return c.body(metadata);
  } catch (err) {
    const message = accountRouteErrorMessage(err);
    const status = message.includes('not configured') ? 503 : 400;
    return c.json({ error: message }, status);
  }
});

app.post('/api/v1/auth/saml/login', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const authAttempt = authAttemptFor(c, email);
  const samlLoginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (samlLoginRateLimit) return samlLoginRateLimit;

  try {
    const authorization = buildHostedSamlAuthorizationRequest({
      requestOrigin: c.req.url,
      emailHint: email || null,
    });
    await recordAuthAttemptUse(authAttempt);
    return c.json({ authorization });
  } catch (err) {
    const message = accountRouteErrorMessage(err);
    const status = message.includes('not configured') ? 503 : 400;
    return c.json({ error: message }, status);
  }
});

app.post('/api/v1/auth/saml/acs', async (c) => {
  const callbackRateLimit = await maybeRateLimitFederatedCallback(c, 'saml');
  if (callbackRateLimit) return callbackRateLimit;

  const body = await c.req.parseBody();
  const samlResponse = typeof body.SAMLResponse === 'string' ? body.SAMLResponse.trim() : '';
  const relayState = typeof body.RelayState === 'string' ? body.RelayState.trim() : '';
  if (!samlResponse || !relayState) {
    return c.json({ error: 'SAMLResponse and RelayState are required.' }, 400);
  }

  let callback;
  try {
    callback = await completeHostedSamlAuthorization({
      requestOrigin: c.req.url,
      samlResponse,
      relayState,
    });
  } catch (err) {
    const message = accountRouteErrorMessage(err);
    const status = message.includes('not configured') ? 503 : 400;
    return c.json({ error: message }, status);
  }

  const replay = await stateService.recordHostedSamlReplay({
    requestId: callback.relayState.requestId,
    responseId: callback.responseId,
    issuer: callback.identity.issuer,
    subject: callback.identity.subject,
    consumedAt: new Date().toISOString(),
    expiresAt: callback.relayState.expiresAt,
  });
  if (replay.duplicate) {
    return c.json({
      error: 'SAML response has already been consumed.',
      requestId: callback.relayState.requestId,
    }, 409);
  }

  let user = await stateService.findAccountUserBySamlIdentity(
    callback.identity.issuer,
    callback.identity.subject,
  );
  if (!user) {
    if (!hostedSamlAllowsAutomaticLinking(callback.identity) || !callback.identity.email) {
      return c.json({
        error: 'SAML identity could not be matched to an existing hosted account user.',
        identity: {
          issuer: callback.identity.issuer,
          subject: callback.identity.subject,
          email: callback.identity.email,
          nameId: callback.identity.nameId,
        },
      }, 403);
    }
    user = await stateService.findAccountUserByEmail(callback.identity.email);
  }
  if (!user) {
    return c.json({
      error: 'SAML identity could not be matched to an existing hosted account user.',
      identity: {
        issuer: callback.identity.issuer,
        subject: callback.identity.subject,
        email: callback.identity.email,
        nameId: callback.identity.nameId,
      },
    }, 403);
  }
  if (user.status !== 'active') {
    return c.json({ error: `Account user '${user.email}' is inactive.` }, 403);
  }

  const account = await stateService.findHostedAccountById(user.accountId);
  if (!account) {
    return c.json({ error: `Hosted account '${user.accountId}' was not found.` }, 404);
  }
  if (account.status === 'archived') {
    return c.json({ error: `Hosted account '${account.id}' is archived and cannot accept new sessions.` }, 403);
  }

  const sync = linkAccountUserSamlIdentity(user, callback.identity);
  if (sync.changed) {
    await stateService.saveAccountUserRecord(sync.record);
    user = sync.record;
  }

  const userTotp = totpSummary(user.mfa.totp);
  if (userTotp.enabled) {
    const issued = await stateService.issueAccountMfaLoginToken({
      accountId: account.id,
      accountUserId: user.id,
      email: user.email,
    });
    return c.json({
      mfaRequired: true,
      challengeToken: issued.token,
      challenge: {
        id: issued.record.id,
        method: 'totp',
        expiresAt: issued.record.expiresAt,
        maxAttempts: issued.record.maxAttempts,
        remainingAttempts: issued.record.maxAttempts === null
          ? null
          : Math.max(issued.record.maxAttempts - issued.record.attemptCount, 0),
      },
      upstreamAuth: {
        provider: 'saml',
        issuer: callback.identity.issuer,
        subject: callback.identity.subject,
        nameId: callback.identity.nameId,
      },
      user: accountUserView(user),
      account: adminAccountView(account),
    });
  }

  const issued = await stateService.issueAccountSession({
    accountId: account.id,
    accountUserId: user.id,
    role: user.role,
  });
  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);

  return c.json({
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    upstreamAuth: {
      provider: 'saml',
      issuer: callback.identity.issuer,
      subject: callback.identity.subject,
      nameId: callback.identity.nameId,
    },
    user: accountUserView(loginTouch.record),
    account: adminAccountView(account),
  });
});

app.post('/api/v1/auth/oidc/login', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const authAttempt = authAttemptFor(c, email);
  const oidcLoginRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (oidcLoginRateLimit) return oidcLoginRateLimit;

  try {
    const authorization = await buildHostedOidcAuthorizationRequest({
      requestOrigin: c.req.url,
      emailHint: email || null,
    });
    await recordAuthAttemptUse(authAttempt);
    return c.json({
      authorization: {
        mode: authorization.mode,
        issuerUrl: authorization.issuerUrl,
        redirectUrl: authorization.redirectUrl,
        scopes: authorization.scopes,
        authorizationUrl: authorization.authorizationUrl,
        expiresAt: authorization.expiresAt,
      },
    });
  } catch (err) {
    const message = accountRouteErrorMessage(err);
    if (message.includes('not configured')) {
      return c.json({ error: message }, 503);
    }
    return c.json({ error: message }, 400);
  }
});

app.get('/api/v1/auth/oidc/callback', async (c) => {
  const callbackRateLimit = await maybeRateLimitFederatedCallback(c, 'oidc');
  if (callbackRateLimit) return callbackRateLimit;

  let callback;
  try {
    callback = await completeHostedOidcAuthorization(c.req.url);
  } catch (err) {
    const message = accountRouteErrorMessage(err);
    const status = message.includes('not configured') ? 503 : 400;
    return c.json({ error: message }, status);
  }

  let user = await stateService.findAccountUserByOidcIdentity(
    callback.identity.issuer,
    callback.identity.subject,
  );
  if (!user) {
    if (!hostedOidcAllowsAutomaticLinking(callback.identity) || !callback.identity.email) {
      return c.json({
        error: 'OIDC identity could not be matched to an existing hosted account user.',
        identity: {
          issuer: callback.identity.issuer,
          subject: callback.identity.subject,
          email: callback.identity.email,
          emailVerified: callback.identity.emailVerified,
        },
      }, 403);
    }
    user = await stateService.findAccountUserByEmail(callback.identity.email);
  }
  if (!user) {
    return c.json({
      error: 'OIDC identity could not be matched to an existing hosted account user.',
      identity: {
        issuer: callback.identity.issuer,
        subject: callback.identity.subject,
        email: callback.identity.email,
        emailVerified: callback.identity.emailVerified,
      },
    }, 403);
  }
  if (user.status !== 'active') {
    return c.json({ error: `Account user '${user.email}' is inactive.` }, 403);
  }

  const account = await stateService.findHostedAccountById(user.accountId);
  if (!account) {
    return c.json({ error: `Hosted account '${user.accountId}' was not found.` }, 404);
  }
  if (account.status === 'archived') {
    return c.json({ error: `Hosted account '${account.id}' is archived and cannot accept new sessions.` }, 403);
  }

  const sync = linkAccountUserOidcIdentity(user, callback.identity);
  if (sync.changed) {
    await stateService.saveAccountUserRecord(sync.record);
    user = sync.record;
  }

  const userTotp = totpSummary(user.mfa.totp);
  if (userTotp.enabled) {
    const issued = await stateService.issueAccountMfaLoginToken({
      accountId: account.id,
      accountUserId: user.id,
      email: user.email,
    });
    return c.json({
      mfaRequired: true,
      challengeToken: issued.token,
      challenge: {
        id: issued.record.id,
        method: 'totp',
        expiresAt: issued.record.expiresAt,
        maxAttempts: issued.record.maxAttempts,
        remainingAttempts: issued.record.maxAttempts === null
          ? null
          : Math.max(issued.record.maxAttempts - issued.record.attemptCount, 0),
      },
      upstreamAuth: {
        provider: 'oidc',
        issuer: callback.identity.issuer,
        subject: callback.identity.subject,
      },
      user: accountUserView(user),
      account: adminAccountView(account),
    });
  }

  const issued = await stateService.issueAccountSession({
    accountId: account.id,
    accountUserId: user.id,
    role: user.role,
  });
  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);

  return c.json({
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    upstreamAuth: {
      provider: 'oidc',
      issuer: callback.identity.issuer,
      subject: callback.identity.subject,
    },
    user: accountUserView(loginTouch.record),
    account: adminAccountView(account),
  });
});

app.post('/api/v1/auth/mfa/verify', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  if (!challengeToken || (!code && !recoveryCode)) {
    return c.json({ error: 'challengeToken and either code or recoveryCode are required.' }, 400);
  }

  const challenge = await stateService.findAccountUserActionTokenByToken(challengeToken);
  if (!challenge || challenge.purpose !== 'mfa_login' || !challenge.accountUserId) {
    return c.json({ error: 'MFA challenge is invalid or expired.' }, 400);
  }

  const user = await stateService.findAccountUserById(challenge.accountUserId);
  const account = user ? await stateService.findHostedAccountById(user.accountId) : null;
  if (!user || !account || account.id !== challenge.accountId || user.status !== 'active' || account.status === 'archived') {
    return c.json({ error: 'MFA challenge is invalid or expired.' }, 400);
  }
  if (!user.mfa.totp.enabledAt || !user.mfa.totp.secretCiphertext || !user.mfa.totp.secretIv || !user.mfa.totp.secretAuthTag) {
    return c.json({ error: `Account user '${user.email}' does not have active MFA configured.` }, 409);
  }

  let verified = false;
  let recoveryCodeUsed = false;
  const nextUser = structuredClone(user);

  if (code) {
    try {
      const totpVerification = verifyTotpCodeWithStep({
        secretBase32: decryptTotpSecret({
          ciphertext: user.mfa.totp.secretCiphertext,
          iv: user.mfa.totp.secretIv,
          authTag: user.mfa.totp.secretAuthTag,
        }),
        code,
        lastAcceptedStep: user.mfa.totp.lastAcceptedStep,
      });
      verified = totpVerification.ok;
      if (verified && totpVerification.acceptedStep) {
        const consumed = await stateService.recordAccountUserTotpVerificationStep(
          user.id,
          totpVerification.acceptedStep,
        );
        verified = consumed.accepted;
      }
    } catch (err) {
      const mapped = accountMfaErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  } else {
    const recovery = verifyAndConsumeRecoveryCode(user.mfa.totp, recoveryCode);
    verified = recovery.ok;
    recoveryCodeUsed = recovery.ok;
    if (recovery.ok) {
      nextUser.mfa.totp = recovery.nextTotp;
      nextUser.updatedAt = recovery.nextTotp.updatedAt ?? nextUser.updatedAt;
      await stateService.saveAccountUserRecord(nextUser);
    }
  }

  if (!verified) {
    const nextChallenge = structuredClone(challenge);
    nextChallenge.attemptCount += 1;
    nextChallenge.lastAttemptAt = new Date().toISOString();
    nextChallenge.updatedAt = nextChallenge.lastAttemptAt;
    if (nextChallenge.maxAttempts !== null && nextChallenge.attemptCount >= nextChallenge.maxAttempts) {
      nextChallenge.revokedAt = nextChallenge.lastAttemptAt;
    }
    await stateService.saveAccountUserActionTokenRecord(nextChallenge);
    return c.json({ error: 'MFA code is invalid or expired.' }, 400);
  }

  await stateService.consumeAccountUserActionToken(challenge.id);
  await stateService.revokeAccountUserActionTokensForUser(user.id, 'mfa_login');
  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  const issued = await stateService.issueAccountSession({
    accountId: account.id,
    accountUserId: user.id,
    role: user.role,
  });
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);

  return c.json({
    verified: true,
    recoveryCodeUsed,
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    user: accountUserView(loginTouch.record),
    account: adminAccountView(account),
  });
});

app.post('/api/v1/auth/logout', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;

  const token = c.req.header('x-attestor-session')
    ?? getCookie(c, sessionCookieName())
    ?? null;
  if (token) {
    await stateService.revokeAccountSessionByToken(token);
  }
  deleteCookie(c, sessionCookieName(), {
    path: '/api/v1',
  });
  return c.json({ loggedOut: true });
});

app.post('/api/v1/auth/password/change', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || !newPassword) {
    return c.json({ error: 'currentPassword and newPassword are required.' }, 400);
  }
  const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
  if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
  if (!verifyAccountUserPasswordRecord(user.password, currentPassword)) {
    await recordAuthAttemptFailure(currentPasswordAttempt.subject);
    return c.json({ error: 'Current password is invalid.' }, 403);
  }
  const passwordPolicyError = accountPasswordErrorResponse(c, newPassword, 'newPassword', {
    displayName: user.displayName,
    email: user.email,
  });
  if (passwordPolicyError) return passwordPolicyError;

  const updated = await stateService.setAccountUserPassword(user.id, newPassword);
  await stateService.revokeAccountSessionsForUser(user.id);
  await stateService.revokeAccountUserActionTokensForUser(user.id, 'password_reset');
  const issued = await stateService.issueAccountSession({
    accountId: access.accountId,
    accountUserId: user.id,
    role: user.role,
  });
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);
  const passwordChangedAt = new Date().toISOString();
  await recordAccountSessionMutationAudit({
    routeId: 'auth.password.change',
    action: 'account.password.changed',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: user.id,
      revokedPriorSessions: true,
      revokedPasswordResetTokens: true,
    },
    statusCode: 200,
    metadata: {
      sessionBoundaryAt: passwordChangedAt,
      revokedPriorSessions: true,
      revokedPasswordResetTokens: true,
    },
  });

  return c.json({
    changed: true,
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    user: accountUserView(updated.record),
  });
});

app.get('/api/v1/auth/me', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  const account = await stateService.findHostedAccountById(access.accountId);
  if (!user || !account) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }
  return c.json({
    session: {
      id: access.sessionId,
      source: access.source,
      role: access.role,
    },
    user: accountUserView(user),
    account: adminAccountView(account),
  });
});

app.get('/api/v1/account/mfa', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }
  return c.json({
    mfa: accountUserDetailedMfaView(user),
  });
});

app.get('/api/v1/account/oidc', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }
  return c.json({
    oidc: accountUserDetailedOidcView(user, c.req.url),
  });
});

app.get('/api/v1/account/saml', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }
  return c.json({
    saml: accountUserDetailedSamlView(user, c.req.url),
  });
});

app.get('/api/v1/account/passkeys', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }
  return c.json({
    passkeys: accountUserDetailedPasskeyView(user),
  });
});

app.post('/api/v1/account/passkeys/register/options', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const password = typeof body.password === 'string' ? body.password : '';
  const preferredAuthenticatorType = normalizePasskeyAuthenticatorHint(body.preferredAuthenticatorType);
  if (!password) {
    return c.json({ error: 'password is required.' }, 400);
  }
  const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
  if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
  if (!verifyAccountUserPasswordRecord(user.password, password)) {
    await recordAuthAttemptFailure(currentPasswordAttempt.subject);
    return c.json({ error: 'Current password is invalid.' }, 403);
  }

  try {
    const built = await buildHostedPasskeyRegistrationOptions({
      requestOrigin: c.req.url,
      user,
      userHandle: user.passkeys.userHandle || generateHostedPasskeyUserHandle(),
      preferredAuthenticatorType,
    });
    const issued = await stateService.issueAccountPasskeyChallengeToken({
      purpose: 'passkey_registration',
      accountId: access.accountId,
      accountUserId: user.id,
      email: user.email,
      context: {
        challenge: built.challengeState.challenge,
        rpId: built.challengeState.rpId,
        origin: built.challengeState.origin,
        userHandle: built.challengeState.userHandle,
      },
    });
    return c.json({
      challengeToken: issued.token,
      registration: built.registration,
      rp: {
        id: built.config.rpId,
        name: built.config.rpName,
        origin: built.config.origin,
      },
    });
  } catch (err) {
    return c.json({ error: accountRouteErrorMessage(err) }, 400);
  }
});

app.post('/api/v1/account/passkeys/register/verify', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const sessionUser = await stateService.findAccountUserById(access.accountUserId);
  if (!sessionUser || sessionUser.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
  const response = asRegistrationResponse(body.response);
  if (!challengeToken || !response) {
    return c.json({ error: 'challengeToken and a valid WebAuthn registration response are required.' }, 400);
  }

  const challengeRecord = await stateService.findAccountUserActionTokenByToken(challengeToken);
  const challenge = challengeRecord ? parsePasskeyRegistrationChallenge(challengeRecord) : null;
  if (
    !challengeRecord
    || !challenge
    || challenge.accountId !== access.accountId
    || challenge.accountUserId !== access.accountUserId
  ) {
    return c.json({ error: 'Passkey registration challenge is invalid or expired.' }, 400);
  }

  let verification;
  try {
    verification = await verifyHostedPasskeyRegistration({
      challengeState: challenge,
      response,
    });
  } catch (err) {
    return c.json({ error: accountRouteErrorMessage(err) }, 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'Passkey registration could not be verified.' }, 400);
  }

  const now = new Date().toISOString();
  const nextUser = structuredClone(sessionUser);
  const nextCredential = buildAccountUserPasskeyCredentialRecord({
    credential: verification.registrationInfo.credential,
    transports: response.response.transports ?? [],
    aaguid: verification.registrationInfo.aaguid,
    deviceType: verification.registrationInfo.credentialDeviceType,
    backedUp: verification.registrationInfo.credentialBackedUp,
    createdAt: now,
  });
  const existingIndex = nextUser.passkeys.credentials.findIndex(
    (entry) => entry.credentialId === nextCredential.credentialId,
  );
  if (existingIndex >= 0) {
    const existing = nextUser.passkeys.credentials[existingIndex]!;
    nextCredential.id = existing.id;
    nextCredential.createdAt = existing.createdAt;
    nextCredential.lastUsedAt = existing.lastUsedAt;
    nextUser.passkeys.credentials.splice(existingIndex, 1);
  }
  nextUser.passkeys.userHandle = challenge.userHandle;
  nextUser.passkeys.credentials.push(nextCredential);
  nextUser.passkeys.updatedAt = now;
  nextUser.updatedAt = now;
  await stateService.saveAccountUserRecord(nextUser);
  await stateService.consumeAccountUserActionToken(challengeRecord.id);
  await stateService.revokeAccountUserActionTokensForUser(nextUser.id, 'passkey_registration');
  await recordAccountSessionMutationAudit({
    routeId: 'account.passkeys.register.verify',
    action: 'account.passkey.registered',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: access.accountUserId,
      challengeId: challengeRecord.id,
    },
    statusCode: 200,
    metadata: {
      credentialRecordId: nextCredential.id,
      deviceType: nextCredential.deviceType,
      backedUp: nextCredential.backedUp,
      replacedExistingCredential: existingIndex >= 0,
    },
  });

  return c.json({
    registered: true,
    passkey: accountPasskeyCredentialView(nextCredential),
    user: accountUserView(nextUser),
  });
});

app.post('/api/v1/account/passkeys/:id/delete', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const passkeyId = c.req.param('id')?.trim() ?? '';
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const password = typeof body.password === 'string' ? body.password : '';
  if (!passkeyId || !password) {
    return c.json({ error: 'passkey id and password are required.' }, 400);
  }
  const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
  if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
  if (!verifyAccountUserPasswordRecord(user.password, password)) {
    await recordAuthAttemptFailure(currentPasswordAttempt.subject);
    return c.json({ error: 'Current password is invalid.' }, 403);
  }

  const credentialIndex = user.passkeys.credentials.findIndex((entry) => entry.id === passkeyId);
  if (credentialIndex < 0) {
    return c.json({ error: `Passkey '${passkeyId}' was not found for the current account user.` }, 404);
  }

  const nextUser = structuredClone(user);
  nextUser.passkeys.credentials.splice(credentialIndex, 1);
  nextUser.passkeys.updatedAt = new Date().toISOString();
  nextUser.updatedAt = nextUser.passkeys.updatedAt;
  await stateService.saveAccountUserRecord(nextUser);
  await recordAccountSessionMutationAudit({
    routeId: 'account.passkeys.delete',
    action: 'account.passkey.deleted',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: access.accountUserId,
      passkeyId,
    },
    statusCode: 200,
    metadata: {
      passkeyId,
    },
  });

  return c.json({
    deleted: true,
    passkeyId,
    user: accountUserView(nextUser),
  });
});

app.post('/api/v1/account/mfa/totp/enroll', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  const account = await stateService.findHostedAccountById(access.accountId);
  if (!user || !account || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    return c.json({ error: 'password is required.' }, 400);
  }
  const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
  if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
  if (!verifyAccountUserPasswordRecord(user.password, password)) {
    await recordAuthAttemptFailure(currentPasswordAttempt.subject);
    return c.json({ error: 'Current password is invalid.' }, 403);
  }
  if (totpSummary(user.mfa.totp).enabled) {
    return c.json({ error: `Account user '${user.email}' already has TOTP MFA enabled.` }, 409);
  }

  let secretBase32: string;
  let secretEnvelope: ReturnType<typeof encryptTotpSecret>;
  try {
    secretBase32 = generateTotpSecretBase32();
    secretEnvelope = encryptTotpSecret(secretBase32);
  } catch (err) {
    const mapped = accountMfaErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
  const now = new Date().toISOString();
  const nextUser = structuredClone(user);
  nextUser.mfa.totp.pendingSecretCiphertext = secretEnvelope.ciphertext;
  nextUser.mfa.totp.pendingSecretIv = secretEnvelope.iv;
  nextUser.mfa.totp.pendingSecretAuthTag = secretEnvelope.authTag;
  nextUser.mfa.totp.pendingIssuedAt = now;
  nextUser.mfa.totp.updatedAt = now;
  nextUser.updatedAt = now;
  await stateService.saveAccountUserRecord(nextUser);
  await recordAccountSessionMutationAudit({
    routeId: 'account.mfa.totp.enroll',
    action: 'account.mfa.totp_enrolled',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: access.accountUserId,
    },
    statusCode: 200,
    metadata: {
      pendingIssuedAt: now,
    },
  });

  const issuer = process.env.ATTESTOR_MFA_ISSUER?.trim() || 'Attestor';
  return c.json({
    enrollment: {
      method: 'totp',
      issuer,
      accountName: user.email,
      secretBase32,
      otpauthUrl: buildTotpOtpAuthUrl({
        issuer,
        accountName: user.email,
        secretBase32,
      }),
      digits: 6,
      periodSeconds: 30,
      algorithm: 'SHA1',
      pendingIssuedAt: now,
    },
  });
});

app.post('/api/v1/account/mfa/totp/confirm', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return c.json({ error: 'code is required.' }, 400);
  }
  if (!user.mfa.totp.pendingSecretCiphertext || !user.mfa.totp.pendingSecretIv || !user.mfa.totp.pendingSecretAuthTag) {
    return c.json({ error: `Account user '${user.email}' does not have a pending TOTP enrollment.` }, 409);
  }

  let secretBase32: string;
  try {
    secretBase32 = decryptTotpSecret({
      ciphertext: user.mfa.totp.pendingSecretCiphertext,
      iv: user.mfa.totp.pendingSecretIv,
      authTag: user.mfa.totp.pendingSecretAuthTag,
    });
  } catch (err) {
    const mapped = accountMfaErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
  const totpVerification = verifyTotpCodeWithStep({ secretBase32, code });
  if (!totpVerification.ok || !totpVerification.acceptedStep) {
    return c.json({ error: 'TOTP code is invalid.' }, 400);
  }

  const recovery = generateRecoveryCodes();
  const now = new Date().toISOString();
  const nextUser = structuredClone(user);
  nextUser.mfa.totp.secretCiphertext = user.mfa.totp.pendingSecretCiphertext;
  nextUser.mfa.totp.secretIv = user.mfa.totp.pendingSecretIv;
  nextUser.mfa.totp.secretAuthTag = user.mfa.totp.pendingSecretAuthTag;
  nextUser.mfa.totp.pendingSecretCiphertext = null;
  nextUser.mfa.totp.pendingSecretIv = null;
  nextUser.mfa.totp.pendingSecretAuthTag = null;
  nextUser.mfa.totp.pendingIssuedAt = null;
  nextUser.mfa.totp.enabledAt = now;
  nextUser.mfa.totp.updatedAt = now;
  nextUser.mfa.totp.sessionBoundaryAt = now;
  nextUser.mfa.totp.lastVerifiedAt = now;
  nextUser.mfa.totp.lastAcceptedStep = totpVerification.acceptedStep;
  nextUser.mfa.totp.recoveryCodes = recovery.hashedCodes;
  nextUser.mfa.totp.recoveryCodesIssuedAt = now;
  nextUser.updatedAt = now;
  await stateService.saveAccountUserRecord(nextUser);

  await stateService.revokeAccountSessionsForUser(user.id);
  await stateService.revokeAccountUserActionTokensForUser(user.id, 'mfa_login');
  const issued = await stateService.issueAccountSession({
    accountId: access.accountId,
    accountUserId: user.id,
    role: user.role,
  });
  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);
  await recordAccountSessionMutationAudit({
    routeId: 'account.mfa.totp.confirm',
    action: 'account.mfa.totp_confirmed',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: user.id,
    },
    statusCode: 200,
    metadata: {
      sessionBoundaryAt: now,
      revokedPriorSessions: true,
    },
  });

  return c.json({
    enabled: true,
    recoveryCodes: recovery.codes,
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    user: accountUserView(loginTouch.record),
  });
});

app.post('/api/v1/account/mfa/disable', async (c) => {
  const unauthorized = requireAccountSession(c);
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const user = await stateService.findAccountUserById(access.accountUserId);
  if (!user || user.accountId !== access.accountId) {
    return c.json({ error: 'Current account session could not be resolved.' }, 404);
  }

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  if (!password || (!code && !recoveryCode)) {
    return c.json({ error: 'password and either code or recoveryCode are required.' }, 400);
  }
  const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
  if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
  if (!verifyAccountUserPasswordRecord(user.password, password)) {
    await recordAuthAttemptFailure(currentPasswordAttempt.subject);
    return c.json({ error: 'Current password is invalid.' }, 403);
  }
  if (!totpSummary(user.mfa.totp).enabled || !user.mfa.totp.secretCiphertext || !user.mfa.totp.secretIv || !user.mfa.totp.secretAuthTag) {
    return c.json({ error: `Account user '${user.email}' does not have TOTP MFA enabled.` }, 409);
  }

  let verified = false;
  let recoveryCodeUsed = false;
  const nextUser = structuredClone(user);
  if (code) {
    try {
      const totpVerification = verifyTotpCodeWithStep({
        secretBase32: decryptTotpSecret({
          ciphertext: user.mfa.totp.secretCiphertext,
          iv: user.mfa.totp.secretIv,
          authTag: user.mfa.totp.secretAuthTag,
        }),
        code,
        lastAcceptedStep: user.mfa.totp.lastAcceptedStep,
      });
      verified = totpVerification.ok;
      if (verified && totpVerification.acceptedStep) {
        const consumed = await stateService.recordAccountUserTotpVerificationStep(
          user.id,
          totpVerification.acceptedStep,
        );
        verified = consumed.accepted;
        nextUser.mfa.totp.lastAcceptedStep = totpVerification.acceptedStep;
      }
    } catch (err) {
      const mapped = accountMfaErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  } else {
    const recovery = verifyAndConsumeRecoveryCode(user.mfa.totp, recoveryCode);
    verified = recovery.ok;
    recoveryCodeUsed = recovery.ok;
    if (recovery.ok) {
      nextUser.mfa.totp = recovery.nextTotp;
    }
  }
  if (!verified) {
    return c.json({ error: 'MFA code is invalid or expired.' }, 400);
  }

  const now = new Date().toISOString();
  nextUser.mfa.totp.enabledAt = null;
  nextUser.mfa.totp.updatedAt = now;
  nextUser.mfa.totp.sessionBoundaryAt = now;
  nextUser.mfa.totp.secretCiphertext = null;
  nextUser.mfa.totp.secretIv = null;
  nextUser.mfa.totp.secretAuthTag = null;
  nextUser.mfa.totp.pendingSecretCiphertext = null;
  nextUser.mfa.totp.pendingSecretIv = null;
  nextUser.mfa.totp.pendingSecretAuthTag = null;
  nextUser.mfa.totp.pendingIssuedAt = null;
  nextUser.mfa.totp.lastVerifiedAt = now;
  nextUser.mfa.totp.lastAcceptedStep = null;
  nextUser.mfa.totp.recoveryCodes = [];
  nextUser.mfa.totp.recoveryCodesIssuedAt = null;
  nextUser.updatedAt = now;
  await stateService.saveAccountUserRecord(nextUser);

  await stateService.revokeAccountSessionsForUser(user.id);
  await stateService.revokeAccountUserActionTokensForUser(user.id, 'mfa_login');
  const issued = await stateService.issueAccountSession({
    accountId: access.accountId,
    accountUserId: user.id,
    role: user.role,
  });
  const loginTouch = await stateService.recordAccountUserLogin(user.id);
  setSessionCookieForRecord(c, issued.sessionToken, issued.record.expiresAt);
  await recordAccountSessionMutationAudit({
    routeId: 'account.mfa.disable',
    action: 'account.mfa.disabled',
    access,
    requestPayload: {
      accountId: access.accountId,
      accountUserId: user.id,
      usedRecoveryCode: recoveryCodeUsed,
    },
    statusCode: 200,
    metadata: {
      sessionBoundaryAt: now,
      revokedPriorSessions: true,
      recoveryCodeUsed,
    },
  });

  return c.json({
    disabled: true,
    recoveryCodeUsed,
    session: {
      id: issued.record.id,
      expiresAt: issued.record.expiresAt,
      source: 'account_session',
    },
    user: accountUserView(loginTouch.record),
  });
});

app.get('/api/v1/account/usage', async (c) => {
  const tenant = currentTenant(c);
  const usage = await stateService.getUsageContext(tenant.tenantId, tenant.planId, tenant.monthlyRunQuota);
  const rateLimit = await getTenantPipelineRateLimit(tenant.tenantId, tenant.planId);
  return c.json({
    tenantContext: {
      tenantId: tenant.tenantId,
      source: tenant.source,
      planId: tenant.planId,
    },
    usage,
    rateLimit,
  });
});

app.get('/api/v1/account', async (c) => {
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;
  const entitlement = await readHostedBillingEntitlement(current.account);
  return c.json({
    account: adminAccountView(current.account),
    entitlement: billingEntitlementView(entitlement),
    tenantContext: {
      tenantId: current.tenant.tenantId,
      source: current.tenant.source,
      planId: current.tenant.planId,
    },
    usage: current.usage,
    rateLimit: current.rateLimit,
  });
});

app.get('/api/v1/account/entitlement', async (c) => {
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;
  const entitlement = await readHostedBillingEntitlement(current.account);
  return c.json({
    entitlement: billingEntitlementView(entitlement),
  });
});

app.get('/api/v1/account/features', async (c) => {
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;
  const entitlement = await readHostedBillingEntitlement(current.account);
  return c.json(buildHostedFeatureServiceView(entitlement));
});

app.get('/api/v1/account/api-keys', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  try {
    const result = await apiKeyService.list(access.accountId);
    return c.json({
      keys: result.keys.map((entry) => accountApiKeyView(entry)),
      defaults: result.defaults,
    });
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/api-keys', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const routeId = 'account.api_keys.issue';
  const requestPayload = { accountId: access.accountId, action: 'issue' };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const issued = await apiKeyService.issue(access.accountId);
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.api_key.issued',
      access,
      requestPayload,
      statusCode: 201,
      tenantId: issued.record.tenantId,
      tenantKeyId: issued.record.id,
      planId: issued.record.planId,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        keyStatus: issued.record.status,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 201, {
      key: {
        ...accountApiKeyView(issued.record),
        apiKey: issued.apiKey,
      },
    });
    return c.json(responseBody, 201);
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/api-keys/:id/rotate', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const keyId = c.req.param('id');
  const routeId = 'account.api_keys.rotate';
  const requestPayload = { accountId: access.accountId, keyId };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const rotated = await apiKeyService.rotate(access.accountId, keyId);
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.api_key.rotated',
      access,
      requestPayload,
      statusCode: 201,
      tenantId: rotated.record.tenantId,
      tenantKeyId: rotated.record.id,
      planId: rotated.record.planId,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        rotatedFromKeyId: rotated.previousRecord.id,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 201, {
      previousKey: accountApiKeyView(rotated.previousRecord),
      newKey: {
        ...accountApiKeyView(rotated.record),
        apiKey: rotated.apiKey,
      },
    });
    return c.json(responseBody, 201);
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/api-keys/:id/deactivate', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const keyId = c.req.param('id');
  const routeId = 'account.api_keys.deactivate';
  const requestPayload = { accountId: access.accountId, keyId, status: 'inactive' };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const result = await apiKeyService.setStatus(access.accountId, keyId, 'inactive');
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.api_key.deactivated',
      access,
      requestPayload,
      statusCode: 200,
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        keyStatus: result.record.status,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      key: accountApiKeyView(result.record),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/api-keys/:id/reactivate', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const keyId = c.req.param('id');
  const routeId = 'account.api_keys.reactivate';
  const requestPayload = { accountId: access.accountId, keyId, status: 'active' };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const result = await apiKeyService.setStatus(access.accountId, keyId, 'active');
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.api_key.reactivated',
      access,
      requestPayload,
      statusCode: 200,
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        keyStatus: result.record.status,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      key: accountApiKeyView(result.record),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/api-keys/:id/revoke', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const keyId = c.req.param('id');
  const routeId = 'account.api_keys.revoke';
  const requestPayload = { accountId: access.accountId, keyId };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const result = await apiKeyService.revoke(access.accountId, keyId);
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.api_key.revoked',
      access,
      requestPayload,
      statusCode: 200,
      tenantId: result.record.tenantId,
      tenantKeyId: result.record.id,
      planId: result.record.planId,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        keyStatus: result.record.status,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      key: accountApiKeyView(result.record),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountApiKeyServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.get('/api/v1/account/users', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const users = await userManagementService.listUsers(access.accountId);
  return c.json({
    users: users.map(accountUserView),
  });
});

app.post('/api/v1/account/users', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = accountUserRoleFilter(typeof body.role === 'string' ? body.role.trim() : null);
  if (!email || !displayName || !password || !role) {
    return c.json({ error: 'email, displayName, password, and role are required.' }, 400);
  }
  const passwordPolicyError = accountPasswordErrorResponse(c, password, 'password', {
    displayName,
    email,
  });
  if (passwordPolicyError) return passwordPolicyError;
  const routeId = 'account.users.create';
  const requestPayload = {
    accountId: access.accountId,
    email,
    displayName,
    role,
  };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;

  try {
    const created = await userManagementService.createUser({
      accountId: access.accountId,
      email,
      displayName,
      password,
      role,
    });
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.created',
      access,
      requestPayload,
      statusCode: 201,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        targetUserId: created.id,
        targetRole: created.role,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 201, {
      user: accountUserView(created),
    });
    return c.json(responseBody, 201);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.get('/api/v1/account/users/invites', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const invites = await userManagementService.listInvites(access.accountId);
  return c.json({
    invites: invites.map(accountUserActionTokenView),
  });
});

app.post('/api/v1/account/users/invites', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const role = accountUserRoleFilter(typeof body.role === 'string' ? body.role.trim() : null);
  const expiresHours = typeof body.expiresHours === 'number' ? body.expiresHours : null;
  if (!email || !displayName || !role) {
    return c.json({ error: 'email, displayName, and role are required.' }, 400);
  }
  const routeId = 'account.users.invites.issue';
  const requestPayload = {
    accountId: access.accountId,
    email,
    displayName,
    role,
    expiresHours,
  };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const issued = await userManagementService.issueInvite({
      accountId: access.accountId,
      actorUserId: access.accountUserId,
      email,
      displayName,
      role,
      expiresHours,
    });
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.invite_issued',
      access,
      requestPayload,
      statusCode: 201,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        inviteId: issued.record.id,
        targetRole: issued.record.role,
        tokenReturned: issued.delivery.tokenReturned,
        deliveryMode: issued.delivery.mode,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 201, {
      invite: accountUserActionTokenView(issued.record),
      ...(issued.delivery.tokenReturned ? { inviteToken: issued.token } : {}),
      delivery: issued.delivery,
    });
    return c.json(responseBody, 201);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/users/invites/:id/revoke', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const inviteId = c.req.param('id');
  const routeId = 'account.users.invites.revoke';
  const requestPayload = { accountId: access.accountId, inviteId };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const revoked = await userManagementService.revokeInvite(access.accountId, inviteId);
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.invite_revoked',
      access,
      requestPayload,
      statusCode: 200,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        inviteId: revoked.id,
        targetRole: revoked.role,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      invite: accountUserActionTokenView(revoked),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/users/invites/accept', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const authAttempt = authAttemptForActionToken(c, AUTH_ATTEMPT_KIND.invite, inviteToken);
  const inviteAcceptRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (inviteAcceptRateLimit) return inviteAcceptRateLimit;
  try {
    const accepted = await userManagementService.acceptInvite({
      inviteToken,
      password,
    });
    await recordAuthAttemptSuccess(authAttempt);
    setSessionCookieForRecord(c, accepted.sessionToken, accepted.session.expiresAt);
    return c.json({
      accepted: true,
      session: {
        id: accepted.session.id,
        expiresAt: accepted.session.expiresAt,
        source: 'account_session',
      },
      user: accountUserView(accepted.user),
      account: adminAccountView(accepted.account),
    }, 201);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) {
      if (err instanceof AccountUserManagementServiceError && err.statusCode === 400) {
        await recordAuthAttemptFailure(authAttempt);
      }
      return mapped;
    }
    throw err;
  }
});

app.post('/api/v1/account/users/:id/deactivate', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const targetUserId = c.req.param('id');
  const routeId = 'account.users.deactivate';
  const requestPayload = { accountId: access.accountId, targetUserId, status: 'inactive' };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const updated = await userManagementService.setUserStatus(access.accountId, targetUserId, 'inactive');
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.deactivated',
      access,
      requestPayload,
      statusCode: 200,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        targetUserId: updated.record.id,
        targetRole: updated.record.role,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      user: accountUserView(updated.record),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/users/:id/reactivate', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const targetUserId = c.req.param('id');
  const routeId = 'account.users.reactivate';
  const requestPayload = { accountId: access.accountId, targetUserId, status: 'active' };
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  try {
    const updated = await userManagementService.setUserStatus(access.accountId, targetUserId, 'active');
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.reactivated',
      access,
      requestPayload,
      statusCode: 200,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        targetUserId: updated.record.id,
        targetRole: updated.record.role,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 200, {
      user: accountUserView(updated.record),
    });
    return c.json(responseBody);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/account/users/:id/password-reset', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const ttlMinutes = typeof body.ttlMinutes === 'number' ? body.ttlMinutes : null;
  const targetUserId = c.req.param('id');
  const requestPayload = { accountId: access.accountId, targetUserId, ttlMinutes };
  const authAttempt = authAttemptFor(c, authAttemptBucket(
    AUTH_ATTEMPT_KIND.passwordResetIssue,
    access.accountId,
    targetUserId,
  ));
  const resetIssueRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (resetIssueRateLimit) return resetIssueRateLimit;
  const routeId = 'account.users.password_reset.issue';
  const idempotency = await beginAccountMutationIdempotency(c, access, routeId, requestPayload);
  if (idempotency.kind === 'response') return idempotency.response;
  await recordAuthAttemptUse(authAttempt);
  try {
    const issued = await userManagementService.issuePasswordReset({
      accountId: access.accountId,
      actorUserId: access.accountUserId,
      targetUserId,
      ttlMinutes,
    });
    await recordAccountSessionMutationAudit({
      routeId,
      action: 'account.user.password_reset_issued',
      access,
      requestPayload,
      statusCode: 201,
      idempotencyKey: idempotency.ready?.idempotencyKey ?? null,
      metadata: {
        resetTokenId: issued.record.id,
        targetUserId: issued.record.accountUserId,
        tokenReturned: issued.delivery.tokenReturned,
        deliveryMode: issued.delivery.mode,
      },
    });
    const responseBody = await finalizeAccountMutationIdempotency(access, routeId, requestPayload, idempotency.ready, 201, {
      reset: accountUserActionTokenView(issued.record),
      ...(issued.delivery.tokenReturned ? { resetToken: issued.token } : {}),
      delivery: issued.delivery,
    });
    return c.json(responseBody, 201);
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
});

app.post('/api/v1/auth/password/reset', async (c) => {
  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const resetToken = typeof body.resetToken === 'string' ? body.resetToken.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const authAttempt = authAttemptForPasswordReset(c, resetToken);
  const resetRateLimit = await maybeRateLimitAuthAttempt(c, authAttempt);
  if (resetRateLimit) return resetRateLimit;
  try {
    await userManagementService.consumePasswordReset({ resetToken, newPassword });
    await recordAuthAttemptSuccess(authAttempt);
    deleteCookie(c, sessionCookieName(), {
      path: '/api/v1',
    });
    return c.json({
      reset: true,
    });
  } catch (err) {
    const mapped = accountUserManagementServiceErrorResponse(c, err);
    if (mapped) {
      if (err instanceof AccountUserManagementServiceError && err.statusCode === 400) {
        await recordAuthAttemptFailure(authAttempt);
      }
      return mapped;
    }
    throw err;
  }
});

app.get('/api/v1/account/email/deliveries', async (c) => {
  const unauthorized = requireAccountSession(c, {
    roles: ['account_admin', 'billing_admin'],
  });
  if (unauthorized) return unauthorized;
  const access = currentAccountAccess(c)!;
  const purpose = c.req.query('purpose')?.trim();
  const status = c.req.query('status')?.trim();
  const provider = c.req.query('provider')?.trim();
  const recipient = c.req.query('recipient')?.trim();
  const limitRaw = c.req.query('limit')?.trim();
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const statusFilter = hostedEmailDeliveryStatusFilter(status);
  const providerFilter = hostedEmailDeliveryProviderFilter(provider);
  const deliveries = await stateService.listHostedEmailDeliveries({
    accountId: access.accountId,
    purpose: purpose === 'invite' || purpose === 'password_reset' ? purpose : null,
    status: statusFilter,
    provider: providerFilter,
    recipient: recipient || null,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return c.json({
    accountId: access.accountId,
    records: deliveries.records,
    summary: {
      purposeFilter: purpose ?? null,
      statusFilter: status ?? null,
      providerFilter: provider ?? null,
      recipientFilter: recipient ?? null,
      recordCount: deliveries.records.length,
    },
  });
});

app.post('/api/v1/account/billing/checkout', async (c) => {
  const roleGate = requireAccountSession(c, {
    roles: ['account_admin', 'billing_admin'],
  });
  if (roleGate) return roleGate;
  const access = currentAccountAccess(c)!;
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;

  const body = await readAccountJsonBody(c);
  if (body instanceof Response) return body;
  const idempotencyKey = c.req.header('Idempotency-Key')?.trim() ?? '';
  if (!idempotencyKey) {
    return c.json({ error: 'Idempotency-Key header is required for hosted checkout.' }, 400);
  }
  const requestedPlanId = typeof body.planId === 'string' ? body.planId.trim() : '';
  if (!requestedPlanId) {
    return c.json({ error: 'planId is required.' }, 400);
  }

  const plan = getHostedPlan(requestedPlanId);
  if (!plan || plan.intendedFor === 'evaluation') {
    return c.json({
      error: `Hosted billing checkout only supports hosted/enterprise plans. Valid hosted plans: starter, pro, scale, enterprise.`,
    }, 400);
  }

  let checkout;
  try {
    checkout = await createHostedCheckoutSession({
      account: current.account,
      tenant: current.tenant,
      plan,
      idempotencyKey,
    });
  } catch (err) {
    const mapped = stripeBillingErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
  await recordAccountSessionMutationAudit({
    routeId: 'account.billing.checkout',
    action: 'account.billing.checkout_started',
    access,
    requestPayload: {
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
      planId: requestedPlanId,
    },
    statusCode: 200,
    tenantId: current.tenant.tenantId,
    planId: checkout.planId,
    idempotencyKey,
    metadata: {
      mock: checkout.mock,
    },
  });

  c.header('x-attestor-idempotency-key', idempotencyKey);
  return c.json({
    accountId: current.account.id,
    tenantId: current.tenant.tenantId,
    planId: checkout.planId,
    stripePriceId: checkout.stripePriceId,
    stripeOveragePriceId: checkout.stripeOveragePriceId,
    trialDays: checkout.trialDays,
    checkoutSessionId: checkout.sessionId,
    checkoutUrl: checkout.url,
    mock: checkout.mock,
  });
});

app.post('/api/v1/account/billing/portal', async (c) => {
  const roleGate = requireAccountSession(c, {
    roles: ['account_admin', 'billing_admin'],
  });
  if (roleGate) return roleGate;
  const access = currentAccountAccess(c)!;
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;

  let portal;
  try {
    portal = await createHostedBillingPortalSession({
      account: current.account,
    });
  } catch (err) {
    const mapped = stripeBillingErrorResponse(c, err);
    if (mapped) return mapped;
    throw err;
  }
  await recordAccountSessionMutationAudit({
    routeId: 'account.billing.portal',
    action: 'account.billing.portal_started',
    access,
    requestPayload: {
      accountId: current.account.id,
      tenantId: current.tenant.tenantId,
    },
    statusCode: 200,
    tenantId: current.tenant.tenantId,
    metadata: {
      mock: portal.mock,
    },
  });

  return c.json({
    accountId: current.account.id,
    tenantId: current.tenant.tenantId,
    portalSessionId: portal.sessionId,
    portalUrl: portal.url,
    mock: portal.mock,
  });
});

app.get('/api/v1/account/billing/export', async (c) => {
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;

  c.set('obs.accountId', current.account.id);
  c.set('obs.accountStatus', current.account.status);
  c.set('obs.tenantId', current.account.primaryTenantId);
  c.set('obs.planId', current.tenant.planId ?? current.account.billing.lastCheckoutPlanId ?? null);

  const format = (c.req.query('format')?.trim().toLowerCase() ?? 'json');
  if (format !== 'json' && format !== 'csv') {
    return c.json({ error: "format must be 'json' or 'csv'." }, 400);
  }

  const rawLimit = c.req.query('limit');
  const parsedLimit = rawLimit === undefined
    ? null
    : Number.parseInt(rawLimit, 10);
  if (rawLimit !== undefined && (parsedLimit === null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
    return c.json({ error: 'limit must be a positive integer.' }, 400);
  }

  const entitlement = await readHostedBillingEntitlement(current.account);
  const payload = await buildHostedBillingExport({
    account: current.account,
    entitlement,
    usage: current.usage,
    limit: parsedLimit ?? undefined,
  });
  const reconciliation = buildHostedBillingReconciliation(payload);

  if (format === 'csv') {
    c.header('content-type', 'text/csv; charset=utf-8');
    c.header('cache-control', 'no-store');
    c.header('content-disposition', `attachment; filename="${current.account.id}-billing-export.csv"`);
    return c.body(renderHostedBillingExportCsv(payload));
  }

  return c.json({
    ...payload,
    entitlement: billingEntitlementView(entitlement),
    reconciliation,
  });
});

app.get('/api/v1/account/billing/reconciliation', async (c) => {
  const roleGate = requireAccountSession(c, {
    roles: ['account_admin', 'billing_admin', 'read_only'],
  });
  if (roleGate) return roleGate;
  const current = await currentHostedAccount(c);
  if (current instanceof Response) return current;

  c.set('obs.accountId', current.account.id);
  c.set('obs.accountStatus', current.account.status);
  c.set('obs.tenantId', current.account.primaryTenantId);
  c.set('obs.planId', current.tenant.planId ?? current.account.billing.lastCheckoutPlanId ?? null);

  const rawLimit = c.req.query('limit');
  const parsedLimit = rawLimit === undefined
    ? null
    : Number.parseInt(rawLimit, 10);
  if (rawLimit !== undefined && (parsedLimit === null || !Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
    return c.json({ error: 'limit must be a positive integer.' }, 400);
  }

  const entitlement = await readHostedBillingEntitlement(current.account);
  const payload = await buildHostedBillingExport({
    account: current.account,
    entitlement,
    usage: current.usage,
    limit: parsedLimit ?? undefined,
  });
  const reconciliation = buildHostedBillingReconciliation(payload);

  return c.json({
    accountId: current.account.id,
    tenantId: current.account.primaryTenantId,
    stripeCustomerId: current.account.billing.stripeCustomerId,
    stripeSubscriptionId: current.account.billing.stripeSubscriptionId,
    entitlement: billingEntitlementView(entitlement),
    reconciliation,
  });
});

}



