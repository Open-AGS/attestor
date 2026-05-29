import type { Hono } from 'hono';
import { AccountAuthServiceError } from '../../application/account-auth-service.js';
import { AccountUserManagementServiceError } from '../../application/account-user-management-service.js';
import {
  recordAuthAttemptFailureShared as recordAuthAttemptFailure,
  recordAuthAttemptSuccessShared as recordAuthAttemptSuccess,
} from '../../account/auth-abuse-guard.js';
import type { AccountRouteDeps } from './account-routes.js';
import {
  accountAuthServiceErrorResponse,
  accountPasswordErrorResponse,
  accountUserManagementServiceErrorResponse,
  authAttemptFor,
  authAttemptForPasswordReset,
  maybeRateLimitAuthAttempt,
  maybeRateLimitCurrentPasswordAttempt,
  readAccountJsonBody,
} from './account-route-helpers.js';

export function registerAccountPublicAuthRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    authService,
    userManagementService,
    stateService,
    currentHostedAccount,
    setSessionCookieForRecord,
    accountUserView,
    adminAccountView,
    accountApiKeyView,
    verifyAccountUserPasswordRecord,
    requireAccountSession,
    currentAccountAccess,
    getCookie,
    deleteCookie,
    sessionCookieName,
    recordAccountMutationAudit,
  } = deps;

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
    await recordAccountMutationAudit({
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
}
