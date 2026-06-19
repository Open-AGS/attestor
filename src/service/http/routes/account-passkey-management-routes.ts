import type { Hono } from 'hono';
import {
  recordAuthAttemptFailureShared as recordAuthAttemptFailure,
} from '../../account/auth-abuse-guard.js';
import type { AccountMutationAuditInput, AccountRouteDeps } from './account-routes.js';
import {
  accountRouteErrorMessage,
  maybeRateLimitCurrentPasswordAttempt,
  readAccountJsonBody,
} from './account-route-helpers.js';

export function registerAccountPasskeyManagementRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    stateService,
    accountUserView,
    verifyAccountUserPasswordRecord,
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
    normalizePasskeyAuthenticatorHint,
    requireAccountSession,
    currentAccountAccess,
    recordAccountMutationAudit,
  } = deps;

  async function recordAccountSessionMutationAudit(input: AccountMutationAuditInput): Promise<void> {
    await recordAccountMutationAudit(input);
  }

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

    const claimedChallenge = await stateService.consumeAccountUserActionToken(challengeRecord.id);
    if (!claimedChallenge.record) {
      return c.json({ error: 'Passkey registration challenge has already been used.' }, 409);
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
}
