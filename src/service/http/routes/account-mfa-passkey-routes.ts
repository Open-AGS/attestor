import type { Hono } from 'hono';
import type { AccountUserActionTokenRecord } from '../../account/account-user-token-store.js';
import {
  recordAuthAttemptFailureShared as recordAuthAttemptFailure,
} from '../../account/auth-abuse-guard.js';
import type { AccountMutationAuditInput, AccountRouteDeps } from './account-routes.js';
import {
  accountRouteErrorMessage,
  authAttemptFor,
  maybeRateLimitAuthAttempt,
  maybeRateLimitCurrentPasswordAttempt,
  readAccountJsonBody,
} from './account-route-helpers.js';

export function registerAccountMfaPasskeyRoutes(app: Hono, deps: AccountRouteDeps): void {
  const {
    stateService,
    setSessionCookieForRecord,
    accountUserView,
    adminAccountView,
    verifyAccountUserPasswordRecord,
    totpSummary,
    buildHostedPasskeyAuthenticationOptions,
    asAuthenticationResponse,
    parsePasskeyAuthenticationChallenge,
    verifyHostedPasskeyAuthentication,
    passkeyCredentialToWebAuthnCredential,
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
    accountMfaErrorResponse,
    recordAccountMutationAudit,
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

    const claimedChallenge = await stateService.consumeAccountUserActionToken(challengeRecord.id);
    if (!claimedChallenge.record) {
      return c.json({ error: 'Passkey authentication challenge has already been used.' }, 409);
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
    let acceptedTotpStep: string | null = null;
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
          acceptedTotpStep = totpVerification.acceptedStep;
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

    const claimedChallenge = await stateService.consumeAccountUserActionToken(challenge.id);
    if (!claimedChallenge.record) {
      return c.json({ error: 'MFA challenge has already been used.' }, 409);
    }
    if (acceptedTotpStep !== null) {
      const consumed = await stateService.recordAccountUserTotpVerificationStep(
        user.id,
        acceptedTotpStep,
      );
      if (!consumed.accepted) {
        return c.json({ error: 'MFA code is invalid or expired.' }, 400);
      }
    }
    if (recoveryCodeUsed) {
      await stateService.saveAccountUserRecord(nextUser);
    }
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
}
