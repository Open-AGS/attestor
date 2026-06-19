import { existsSync } from 'node:fs';
import { generateCurrentTotpCode } from '../src/service/account/account-mfa.js';
import { buildAccountUserPasskeyCredentialRecord } from '../src/service/account/account-passkeys.js';
import {
  findAccountUserByEmailState,
  issueAccountPasskeyChallengeTokenState,
  saveAccountUserRecordState,
} from '../src/service/control-plane-store.js';
import {
  authFixtureCredential,
  authenticationChallenge,
  authenticationResponse,
  registrationChallenge,
  registrationResponse,
  webauthnOrigin,
} from './helpers/passkey-fixtures.js';
import {
  accountMutationHeaders,
  currentTotpStepIndex,
  ok,
  waitForTotpStepAfter,
} from './live-control-plane-pg-fixtures.js';

type RunSharedPgAccountAuthScenarioInput = {
  readonly base: string;
  readonly tenantAuth: Record<string, string>;
  readonly accountUserStorePath: string;
  readonly accountUserTokenStorePath: string;
  readonly accountSessionStorePath: string;
};

export type SharedPgAccountAuthScenarioResult = {
  readonly accountSessionCookie: string;
  readonly lastOwnerTotpStep: number;
  readonly mfaSecretBase32: string;
};

export async function runSharedPgAccountAuthScenario(
  input: RunSharedPgAccountAuthScenarioInput,
): Promise<SharedPgAccountAuthScenarioResult> {
  const {
    base,
    tenantAuth,
    accountUserStorePath,
    accountUserTokenStorePath,
    accountSessionStorePath,
  } = input;

  const accountRes = await fetch(`${base}/api/v1/account`, { headers: tenantAuth });
  ok(accountRes.status === 200, 'Tenant account summary: 200');
  const accountBody = await accountRes.json() as any;
  ok(accountBody.account.accountName === 'PG Hosted Co', 'Tenant account summary: account name matches');
  ok(accountBody.usage.used === 0, 'Tenant account summary: usage starts at 0');
  ok(accountBody.entitlement.status === 'provisioned', 'Tenant account summary: entitlement starts provisioned');
  ok(accountBody.entitlement.effectivePlanId === 'trial', 'Tenant account summary: trial entitlement projected');

  const entitlementRes = await fetch(`${base}/api/v1/account/entitlement`, { headers: tenantAuth });
  ok(entitlementRes.status === 200, 'Tenant entitlement summary: 200');
  const entitlementBody = await entitlementRes.json() as any;
  ok(entitlementBody.entitlement.provider === 'manual', 'Tenant entitlement summary: provider starts manual');

  const initialFeaturesRes = await fetch(`${base}/api/v1/account/features`, { headers: tenantAuth });
  ok(initialFeaturesRes.status === 200, 'Tenant features summary: 200');
  const initialFeaturesBody = await initialFeaturesRes.json() as any;
  ok(initialFeaturesBody.features.some((entry: any) => entry.key === 'api.access' && entry.grantSource === 'plan_default'), 'Tenant features summary: api.access starts as plan-default feature');

  const bootstrapRes = await fetch(`${base}/api/v1/account/users/bootstrap`, {
    method: 'POST',
    headers: {
      ...tenantAuth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'owner@pg-hosted.example',
      displayName: 'PG Owner',
      password: 'RiverQuartz91!',
    }),
  });
  ok(bootstrapRes.status === 201, 'Account bootstrap via shared PG: 201');
  const bootstrapBody = await bootstrapRes.json() as any;
  ok(bootstrapBody.user.role === 'account_admin', 'Account bootstrap via shared PG: account_admin created');
  ok(!existsSync(accountUserStorePath), 'Shared PG: bootstrap does not create local user store file');

  const loginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@pg-hosted.example',
      password: 'RiverQuartz91!',
    }),
  });
  ok(loginRes.status === 200, 'Account login via shared PG: 200');
  let accountSessionCookie = loginRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
  ok(Boolean(accountSessionCookie), 'Account login via shared PG: session cookie returned');
  ok(!existsSync(accountSessionStorePath), 'Shared PG: login does not create local session store file');

  const meRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Cookie: accountSessionCookie! },
  });
  ok(meRes.status === 200, 'Account me via shared PG session: 200');
  const meBody = await meRes.json() as any;
  ok(meBody.session.role === 'account_admin', 'Account me via shared PG session: role persisted');

  const mfaEnrollRes = await fetch(`${base}/api/v1/account/mfa/totp/enroll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accountMutationHeaders(accountSessionCookie!),
    },
    body: JSON.stringify({
      password: 'RiverQuartz91!',
    }),
  });
  ok(mfaEnrollRes.status === 200, 'Shared PG MFA enroll: 200');
  const mfaEnrollBody = await mfaEnrollRes.json() as any;
  const mfaSecretBase32 = mfaEnrollBody.enrollment.secretBase32 as string;
  ok(typeof mfaSecretBase32 === 'string', 'Shared PG MFA enroll: secret returned');
  ok(!existsSync(accountUserStorePath), 'Shared PG MFA enroll: no local account user store created');

  let lastOwnerTotpStep = currentTotpStepIndex();
  const mfaConfirmRes = await fetch(`${base}/api/v1/account/mfa/totp/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accountMutationHeaders(accountSessionCookie!),
    },
    body: JSON.stringify({
      password: 'RiverQuartz91!',
      code: generateCurrentTotpCode(mfaSecretBase32),
    }),
  });
  ok(mfaConfirmRes.status === 200, 'Shared PG MFA confirm: 200');
  const mfaConfirmBody = await mfaConfirmRes.json() as any;
  accountSessionCookie = mfaConfirmRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
  ok(Boolean(accountSessionCookie), 'Shared PG MFA confirm: fresh session cookie returned');
  ok(Array.isArray(mfaConfirmBody.recoveryCodes) && mfaConfirmBody.recoveryCodes.length === 8, 'Shared PG MFA confirm: recovery codes returned');
  ok(!existsSync(accountSessionStorePath), 'Shared PG MFA confirm: no local session store created');

  const mfaSummaryRes = await fetch(`${base}/api/v1/account/mfa`, {
    headers: { Cookie: accountSessionCookie! },
  });
  ok(mfaSummaryRes.status === 200, 'Shared PG MFA summary: 200');
  const mfaSummaryBody = await mfaSummaryRes.json() as any;
  ok(mfaSummaryBody.mfa.enabled === true, 'Shared PG MFA summary: enabled=true');

  const passkeyOptionsRes = await fetch(`${base}/api/v1/account/passkeys/register/options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accountMutationHeaders(accountSessionCookie!),
    },
    body: JSON.stringify({
      password: 'RiverQuartz91!',
      preferredAuthenticatorType: 'localDevice',
    }),
  });
  ok(passkeyOptionsRes.status === 200, 'Shared PG passkey register options: 200');
  ok(!existsSync(accountUserTokenStorePath), 'Shared PG passkey register options: no local token store created');

  const passkeyUser = await findAccountUserByEmailState('owner@pg-hosted.example');
  ok(Boolean(passkeyUser), 'Shared PG passkey seed: user lookup available');
  const seededRegistrationToken = await issueAccountPasskeyChallengeTokenState({
    purpose: 'passkey_registration',
    accountId: passkeyUser!.accountId,
    accountUserId: passkeyUser!.id,
    email: passkeyUser!.email,
    context: {
      challenge: registrationChallenge,
      rpId: 'dev.dontneeda.pw',
      origin: webauthnOrigin,
      userHandle: 'shared-pg-passkey-user-handle',
    },
  });

  const passkeyRegisterVerifyRes = await fetch(`${base}/api/v1/account/passkeys/register/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accountMutationHeaders(accountSessionCookie!),
    },
    body: JSON.stringify({
      challengeToken: seededRegistrationToken.token,
      response: registrationResponse,
    }),
  });
  ok(passkeyRegisterVerifyRes.status === 200, 'Shared PG passkey register verify: 200');
  const passkeyRegisterVerifyBody = await passkeyRegisterVerifyRes.json() as any;
  ok(passkeyRegisterVerifyBody.user.passkeys.credentialCount === 1, 'Shared PG passkey register verify: count=1');
  ok(!existsSync(accountUserStorePath), 'Shared PG passkey register verify: no local user store created');

  const passkeyUserForAuth = await findAccountUserByEmailState('owner@pg-hosted.example');
  ok(Boolean(passkeyUserForAuth), 'Shared PG passkey auth seed: user lookup available');
  const nextPasskeyUser = structuredClone(passkeyUserForAuth!);
  nextPasskeyUser.passkeys.userHandle = nextPasskeyUser.passkeys.userHandle || 'shared-pg-passkey-user-handle';
  nextPasskeyUser.passkeys.credentials = [
    buildAccountUserPasskeyCredentialRecord({
      credential: {
        id: authFixtureCredential.id,
        publicKey: Buffer.from(authFixtureCredential.publicKey),
        counter: authFixtureCredential.counter,
      },
      transports: ['internal'],
      aaguid: null,
      deviceType: 'singleDevice',
      backedUp: false,
    }),
  ];
  nextPasskeyUser.passkeys.updatedAt = new Date().toISOString();
  nextPasskeyUser.updatedAt = nextPasskeyUser.passkeys.updatedAt;
  await saveAccountUserRecordState(nextPasskeyUser);

  const passkeyAuthOptionsRes = await fetch(`${base}/api/v1/auth/passkeys/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@pg-hosted.example' }),
  });
  ok(passkeyAuthOptionsRes.status === 200, 'Shared PG passkey auth options: 200');
  ok(!existsSync(accountUserTokenStorePath), 'Shared PG passkey auth options: no local token store created');

  const seededAuthenticationToken = await issueAccountPasskeyChallengeTokenState({
    purpose: 'passkey_authentication',
    accountId: nextPasskeyUser.accountId,
    accountUserId: nextPasskeyUser.id,
    email: nextPasskeyUser.email,
    context: {
      challenge: authenticationChallenge,
      rpId: 'dev.dontneeda.pw',
      origin: webauthnOrigin,
    },
  });

  const passkeyAuthVerifyRes = await fetch(`${base}/api/v1/auth/passkeys/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: seededAuthenticationToken.token,
      response: authenticationResponse,
    }),
  });
  ok(passkeyAuthVerifyRes.status === 200, 'Shared PG passkey auth verify: 200');
  const passkeyAuthVerifyBody = await passkeyAuthVerifyRes.json() as any;
  ok(passkeyAuthVerifyBody.upstreamAuth?.provider === 'passkey', 'Shared PG passkey auth verify: provider=passkey');
  const passkeySessionCookie = passkeyAuthVerifyRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
  ok(Boolean(passkeySessionCookie), 'Shared PG passkey auth verify: session cookie returned');
  ok(!existsSync(accountSessionStorePath), 'Shared PG passkey auth verify: no local session store created');

  const passkeyMeRes = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Cookie: passkeySessionCookie! },
  });
  ok(passkeyMeRes.status === 200, 'Shared PG passkey auth session: /me works');

  const mfaLoginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@pg-hosted.example',
        password: 'RiverQuartz91!',
    }),
  });
  ok(mfaLoginRes.status === 200, 'Shared PG MFA login: challenge response');
  const mfaLoginBody = await mfaLoginRes.json() as any;
  ok(mfaLoginBody.mfaRequired === true, 'Shared PG MFA login: mfaRequired');
  ok(!existsSync(accountUserTokenStorePath), 'Shared PG MFA login: no local action token store created');

  await waitForTotpStepAfter(lastOwnerTotpStep);
  lastOwnerTotpStep = currentTotpStepIndex();
  const mfaVerifyRes = await fetch(`${base}/api/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: mfaLoginBody.challengeToken,
      code: generateCurrentTotpCode(mfaSecretBase32),
    }),
  });
  ok(mfaVerifyRes.status === 200, 'Shared PG MFA verify: 200');
  accountSessionCookie = mfaVerifyRes.headers.get('set-cookie')?.split(';', 1)[0] ?? null;
  ok(Boolean(accountSessionCookie), 'Shared PG MFA verify: session cookie returned');

  const inviteRes = await fetch(`${base}/api/v1/account/users/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...accountMutationHeaders(accountSessionCookie!),
    },
    body: JSON.stringify({
      email: 'invitee@pg-hosted.example',
      displayName: 'PG Invitee',
      role: 'read_only',
    }),
  });
  ok(inviteRes.status === 201, 'Account invite via shared PG: 201');
  const inviteBody = await inviteRes.json() as any;
  ok(inviteBody.invite.status === 'pending', 'Account invite via shared PG: pending');
  ok(!existsSync(accountUserTokenStorePath), 'Shared PG: invite does not create local token store file');

  const acceptInviteRes = await fetch(`${base}/api/v1/account/users/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inviteToken: inviteBody.inviteToken,
        password: 'CobaltLedger92!',
    }),
  });
  ok(acceptInviteRes.status === 201, 'Account invite accept via shared PG: 201');
  const acceptInviteBody = await acceptInviteRes.json() as any;
  ok(acceptInviteBody.user.email === 'invitee@pg-hosted.example', 'Account invite accept via shared PG: user created');

  const sessionAccountRes = await fetch(`${base}/api/v1/account`, {
    headers: { Cookie: accountSessionCookie! },
  });
  ok(sessionAccountRes.status === 200, 'Account summary via shared PG session: 200');
  const sessionAccountBody = await sessionAccountRes.json() as any;
  ok(sessionAccountBody.tenantContext.source === 'account_session', 'Account summary via shared PG session: source=account_session');

  return {
    accountSessionCookie: accountSessionCookie!,
    lastOwnerTotpStep,
    mfaSecretBase32,
  };
}
