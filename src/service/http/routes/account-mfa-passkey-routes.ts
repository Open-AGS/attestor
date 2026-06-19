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
import { registerAccountPasskeyManagementRoutes } from './account-passkey-management-routes.js';

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
    isPendingTotpEnrollmentFresh,
    requireAccountSession,
    currentAccountAccess,
    decryptTotpSecret,
    encryptTotpSecret,
    generateRecoveryCodes,
    generateTotpSecretBase32,
    buildTotpOtpAuthUrl,
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
      const recovery = await stateService.consumeAccountUserRecoveryCode(user.id, recoveryCode);
      verified = recovery.accepted;
      recoveryCodeUsed = recovery.accepted;
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

  registerAccountPasskeyManagementRoutes(app, deps);

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
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || !code) {
      return c.json({ error: 'password and code are required.' }, 400);
    }
    const currentPasswordAttempt = await maybeRateLimitCurrentPasswordAttempt(c, access);
    if (currentPasswordAttempt.response) return currentPasswordAttempt.response;
    if (!verifyAccountUserPasswordRecord(user.password, password)) {
      await recordAuthAttemptFailure(currentPasswordAttempt.subject);
      return c.json({ error: 'Current password is invalid.' }, 403);
    }
    if (!user.mfa.totp.pendingSecretCiphertext || !user.mfa.totp.pendingSecretIv || !user.mfa.totp.pendingSecretAuthTag) {
      return c.json({ error: `Account user '${user.email}' does not have a pending TOTP enrollment.` }, 409);
    }
    if (!isPendingTotpEnrollmentFresh(user.mfa.totp)) {
      const now = new Date().toISOString();
      const nextUser = structuredClone(user);
      nextUser.mfa.totp.pendingSecretCiphertext = null;
      nextUser.mfa.totp.pendingSecretIv = null;
      nextUser.mfa.totp.pendingSecretAuthTag = null;
      nextUser.mfa.totp.pendingIssuedAt = null;
      nextUser.mfa.totp.updatedAt = now;
      nextUser.updatedAt = now;
      await stateService.saveAccountUserRecord(nextUser);
      await recordAccountSessionMutationAudit({
        routeId: 'account.mfa.totp.confirm',
        action: 'account.mfa.totp_enrollment_expired',
        access,
        requestPayload: {
          accountId: access.accountId,
          accountUserId: user.id,
        },
        statusCode: 409,
        metadata: {
          pendingExpired: true,
        },
      });
      return c.json({ error: 'Pending TOTP enrollment has expired. Start enrollment again.' }, 409);
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
    let usedRecoveryCodeId: string | null = null;
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
      const recovery = await stateService.consumeAccountUserRecoveryCode(user.id, recoveryCode);
      verified = recovery.accepted;
      recoveryCodeUsed = recovery.accepted;
      usedRecoveryCodeId = recovery.usedRecoveryCodeId;
      if (recovery.accepted) {
        nextUser.mfa.totp = recovery.record.mfa.totp;
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
        recoveryCodeId: usedRecoveryCodeId,
      },
      statusCode: 200,
      metadata: {
        sessionBoundaryAt: now,
        revokedPriorSessions: true,
        recoveryCodeUsed,
        recoveryCodeId: usedRecoveryCodeId,
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
