import type { Hono } from 'hono';
import {
  recordAuthAttemptUseShared as recordAuthAttemptUse,
} from '../../account/auth-abuse-guard.js';
import type { AccountRouteDeps } from './account-routes.js';
import {
  accountRouteErrorMessage,
  authAttemptFor,
  maybeRateLimitAuthAttempt,
  maybeRateLimitFederatedCallback,
  readAccountJsonBody,
} from './account-route-helpers.js';

export function registerAccountFederatedAuthRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    stateService,
    setSessionCookieForRecord,
    accountUserView,
    adminAccountView,
    totpSummary,
    getHostedSamlMetadata,
    buildHostedSamlAuthorizationRequest,
    completeHostedSamlAuthorization,
    hostedSamlAllowsAutomaticLinking,
    linkAccountUserSamlIdentity,
    buildHostedOidcAuthorizationRequest,
    completeHostedOidcAuthorization,
    hostedOidcAllowsAutomaticLinking,
    linkAccountUserOidcIdentity,
  } = deps;

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
}
