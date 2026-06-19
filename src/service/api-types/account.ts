/**
 * Attestor service API account types.
 *
 * This module is re-exported by ../api-types.ts for compatibility.
 */

import type { AdminAccountRecord, AdminTenantKeyRecord } from './admin.js';
import type { RateLimitContext, UsageContext } from './shared.js';

export interface AccountUsageResponse {
  tenantContext: { tenantId: string; source: string; planId: string | null };
  usage: UsageContext;
  rateLimit: RateLimitContext;
}

export interface AccountSummaryResponse {
  account: AdminAccountRecord;
  entitlement: AccountBillingEntitlementRecord;
  tenantContext: { tenantId: string; source: string; planId: string | null };
  usage: UsageContext;
  rateLimit: RateLimitContext;
}

export interface AccountBillingEntitlementRecord {
  id: string;
  accountId: string;
  tenantId: string;
  provider: 'manual' | 'stripe';
  status: 'provisioned' | 'checkout_completed' | 'active' | 'trialing' | 'delinquent' | 'suspended' | 'archived';
  accessEnabled: boolean;
  effectivePlanId: string | null;
  requestedPlanId: string | null;
  monthlyRunQuota: number | null;
  requestsPerWindow: number | null;
  asyncPendingJobsPerTenant: number | null;
  accountStatus: 'active' | 'suspended' | 'archived';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus:
    | 'trialing'
    | 'active'
    | 'incomplete'
    | 'incomplete_expired'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused'
    | null;
  stripePriceId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceStatus: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  stripeEntitlementLookupKeys: string[];
  stripeEntitlementFeatureIds: string[];
  stripeEntitlementSummaryUpdatedAt: string | null;
  lastEventId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  effectiveAt: string | null;
  delinquentSince: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBillingEntitlementResponse {
  entitlement: AccountBillingEntitlementRecord;
}

export interface AccountFeatureRecord {
  key:
    | 'api.access'
    | 'account.users'
    | 'billing.checkout'
    | 'billing.portal'
    | 'billing.export'
    | 'billing.reconciliation'
    | 'async.pipeline'
    | 'iam.oidc_sso'
    | 'iam.saml_sso'
    | 'healthcare.validation';
  displayName: string;
  description: string;
  category: 'access' | 'account' | 'billing' | 'runtime' | 'identity' | 'domain';
  granted: boolean;
  available: boolean;
  grantSource: 'stripe_entitlement' | 'plan_default' | 'stripe_not_granted' | 'not_in_plan';
  planEligible: boolean;
  stripeManaged: boolean;
  stripeSummaryPresent: boolean;
  configuredLookupKeys: string[];
  matchedLookupKeys: string[];
}

export interface AccountFeaturesResponse {
  accountId: string;
  tenantId: string;
  effectivePlanId: string | null;
  provider: 'manual' | 'stripe';
  entitlementStatus: 'provisioned' | 'checkout_completed' | 'active' | 'trialing' | 'delinquent' | 'suspended' | 'archived';
  accessEnabled: boolean;
  stripeSummaryUpdatedAt: string | null;
  features: AccountFeatureRecord[];
  summary: {
    featureCount: number;
    grantedCount: number;
    availableCount: number;
    stripeGrantedCount: number;
    planDefaultCount: number;
    stripeDeniedCount: number;
    notInPlanCount: number;
    stripeSummaryPresent: boolean;
  };
}

export interface AccountUserMfaSummaryView {
  enabled: boolean;
  method: 'totp' | null;
  enrolledAt: string | null;
  pendingEnrollment: boolean;
}

export interface AccountUserFederationSummaryView {
  oidcLinked: boolean;
  oidcIdentityCount: number;
  lastOidcLoginAt: string | null;
  samlLinked: boolean;
  samlIdentityCount: number;
  lastSamlLoginAt: string | null;
}

export interface AccountUserPasskeySummaryView {
  enabled: boolean;
  credentialCount: number;
  userHandleConfigured: boolean;
  lastUsedAt: string | null;
}

export interface AccountUserRecordView {
  id: string;
  accountId: string;
  email: string;
  displayName: string;
  role: 'account_admin' | 'billing_admin' | 'read_only';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  lastLoginAt: string | null;
  mfa: AccountUserMfaSummaryView;
  passkeys: AccountUserPasskeySummaryView;
  federation: AccountUserFederationSummaryView;
}

export interface AccountUsersListResponse {
  users: AccountUserRecordView[];
}

export interface AccountBootstrapUserRequest {
  email: string;
  displayName: string;
  password: string;
}

export interface AccountBootstrapUserResponse {
  user: AccountUserRecordView;
  bootstrap: true;
}

export interface AuthSignupRequest {
  accountName: string;
  email: string;
  displayName: string;
  password: string;
}

export interface AccountApiKeyRecord extends AdminTenantKeyRecord {}

export interface AuthSignupResponse {
  signup: true;
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
  account: AdminAccountRecord;
  commercial: {
    currentPhase: 'evaluation' | 'paid';
    includedMonthlyRunQuota: number | null;
    trialAccountEntitlementId: 'trial';
    trialDurationDays: number;
    workflowBillingTierIds: string[];
    workflowCheckoutRoute: '/api/v1/account/billing/workflows/checkout';
  };
  initialKey: AccountApiKeyRecord & { apiKey: string };
}

export interface AccountCreateUserRequest {
  email: string;
  displayName: string;
  password: string;
  role: 'account_admin' | 'billing_admin' | 'read_only';
}

export interface AccountCreateUserResponse {
  user: AccountUserRecordView;
}

export interface AccountSetUserStatusResponse {
  user: AccountUserRecordView;
}

export interface AccountUserActionTokenRecordView {
  id: string;
  purpose: 'invite' | 'password_reset' | 'mfa_login' | 'passkey_registration' | 'passkey_authentication';
  accountId: string;
  accountUserId: string | null;
  email: string;
  displayName: string | null;
  role: 'account_admin' | 'billing_admin' | 'read_only' | null;
  status: 'pending' | 'consumed' | 'revoked' | 'expired';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
}

export interface AccountUserInvitesListResponse {
  invites: AccountUserActionTokenRecordView[];
}

export interface AccountInviteUserRequest {
  email: string;
  displayName: string;
  role: 'account_admin' | 'billing_admin' | 'read_only';
  expiresHours?: number;
}

export interface AccountInviteUserResponse {
  invite: AccountUserActionTokenRecordView;
  inviteToken?: string | null;
  delivery: {
    deliveryId: string;
    mode: 'manual' | 'smtp';
    provider: 'manual' | 'smtp' | 'sendgrid_smtp' | 'mailgun_smtp';
    channel: 'api_response' | 'smtp';
    delivered: boolean;
    recipient: string;
    messageId: string | null;
    actionUrl: string | null;
    tokenReturned: boolean;
  };
}

export interface AccountRevokeInviteResponse {
  invite: AccountUserActionTokenRecordView;
}

export interface AccountAcceptInviteRequest {
  inviteToken: string;
  password: string;
}

export interface AccountAcceptInviteResponse {
  accepted: true;
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
  account: AdminAccountRecord;
}

export interface AccountIssuePasswordResetRequest {
  ttlMinutes?: number;
}

export interface AccountIssuePasswordResetResponse {
  reset: AccountUserActionTokenRecordView;
  resetToken?: string | null;
  delivery: {
    deliveryId: string;
    mode: 'manual' | 'smtp';
    provider: 'manual' | 'smtp' | 'sendgrid_smtp' | 'mailgun_smtp';
    channel: 'api_response' | 'smtp';
    delivered: boolean;
    recipient: string;
    messageId: string | null;
    actionUrl: string | null;
    tokenReturned: boolean;
  };
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AccountApiKeysListResponse {
  keys: AccountApiKeyRecord[];
  defaults: {
    maxActiveKeysPerTenant: number;
  };
}

export interface AccountIssueApiKeyResponse {
  key: AccountApiKeyRecord & { apiKey: string };
}

export interface AccountRotateApiKeyResponse {
  previousKey: AccountApiKeyRecord;
  newKey: AccountApiKeyRecord & { apiKey: string };
}

export interface AccountApiKeyStatusResponse {
  key: AccountApiKeyRecord;
}

export interface AuthOidcLoginRequest {
  email?: string;
}

export interface AuthSamlLoginRequest {
  email?: string;
}

export interface AuthOidcUpstreamView {
  provider: 'oidc';
  issuer: string;
  subject: string;
}

export interface AuthSamlUpstreamView {
  provider: 'saml';
  issuer: string;
  subject: string;
  nameId: string;
}

export interface AuthPasskeyUpstreamView {
  provider: 'passkey';
  credentialId: string;
}

export type AuthUpstreamAuthView = AuthOidcUpstreamView | AuthSamlUpstreamView | AuthPasskeyUpstreamView;

export interface AuthLoginResponse {
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  upstreamAuth?: AuthUpstreamAuthView;
  user: AccountUserRecordView;
  account: AdminAccountRecord;
}

export interface AuthLoginMfaChallengeResponse {
  mfaRequired: true;
  challengeToken: string;
  challenge: {
    id: string;
    method: 'totp' | 'passkey_totp_fallback';
    expiresAt: string;
    maxAttempts: number | null;
    remainingAttempts: number | null;
  };
  upstreamAuth?: AuthUpstreamAuthView;
  user: AccountUserRecordView;
  account: AdminAccountRecord;
}

export interface AuthOidcLoginResponse {
  authorization: {
    mode: 'authorization_code_pkce';
    issuerUrl: string;
    redirectUrl: string;
    scopes: string[];
    authorizationUrl: string;
    expiresAt: string;
  };
}

export interface AuthSamlLoginResponse {
  authorization: {
    mode: 'sp_initiated_redirect';
    entityId: string;
    metadataUrl: string;
    acsUrl: string;
    authorizationUrl: string;
    requestId: string;
    expiresAt: string;
  };
}

export interface AuthMfaVerifyRequest {
  challengeToken: string;
  code?: string;
  recoveryCode?: string;
}

export interface AuthMfaVerifyResponse {
  verified: true;
  recoveryCodeUsed: boolean;
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
  account: AdminAccountRecord;
}

export interface AccountPasskeyCredentialView {
  id: string;
  credentialId: string;
  transports: Array<'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'>;
  aaguid: string | null;
  deviceType: 'singleDevice' | 'multiDevice' | null;
  backedUp: boolean | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AccountPasskeysResponse {
  passkeys: {
    enabled: boolean;
    credentialCount: number;
    userHandleConfigured: boolean;
    lastUsedAt: string | null;
    updatedAt: string | null;
    credentials: AccountPasskeyCredentialView[];
  };
}

export interface AccountPasskeyRegisterOptionsRequest {
  password: string;
  preferredAuthenticatorType?: 'securityKey' | 'localDevice' | 'remoteDevice';
}

export interface AccountPasskeyRegisterOptionsResponse {
  challengeToken: string;
  registration: Record<string, unknown>;
  rp: {
    id: string;
    name: string;
    origin: string;
  };
}

export interface AccountPasskeyRegisterVerifyRequest {
  challengeToken: string;
  response: Record<string, unknown>;
}

export interface AccountPasskeyRegisterVerifyResponse {
  registered: true;
  passkey: AccountPasskeyCredentialView;
  user: AccountUserRecordView;
}

export interface AccountPasskeyDeleteRequest {
  password: string;
}

export interface AccountPasskeyDeleteResponse {
  deleted: true;
  passkeyId: string;
  user: AccountUserRecordView;
}

export interface AuthPasskeyOptionsRequest {
  email?: string;
}

export interface AuthPasskeyOptionsResponse {
  challengeToken: string;
  authentication: Record<string, unknown>;
  mode: 'usernameless' | 'email_lookup';
  hintedUser: AccountUserRecordView | null;
}

export interface AuthPasskeyVerifyRequest {
  challengeToken: string;
  response: Record<string, unknown>;
}

export interface AuthMeResponse {
  session: {
    id: string;
    source: 'account_session';
    role: 'account_admin' | 'billing_admin' | 'read_only';
  };
  user: AccountUserRecordView;
  account: AdminAccountRecord;
}

export interface AuthLogoutResponse {
  loggedOut: true;
}

export interface AuthPasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthPasswordChangeResponse {
  changed: true;
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
}

export interface AuthPasswordResetRequest {
  resetToken: string;
  newPassword: string;
}

export interface AuthPasswordResetResponse {
  reset: true;
}

export interface AccountMfaSummaryResponse {
  mfa: {
    enabled: boolean;
    method: 'totp' | null;
    enrolledAt: string | null;
    pendingEnrollment: boolean;
    recoveryCodesRemaining: number;
    lastVerifiedAt: string | null;
    updatedAt: string | null;
  };
}

export interface AccountOidcSummaryResponse {
  oidc: {
    configured: boolean;
    issuerUrl: string | null;
    redirectUrl: string | null;
    scopes: string[];
    identities: Array<{
      id: string;
      issuer: string;
      subject: string;
      email: string | null;
      linkedAt: string;
      lastLoginAt: string | null;
    }>;
  };
}

export interface AccountSamlSummaryResponse {
  saml: {
    configured: boolean;
    entityId: string | null;
    metadataUrl: string | null;
    acsUrl: string | null;
    authnRequestsSigned: boolean;
    identities: Array<{
      id: string;
      issuer: string;
      subject: string;
      email: string | null;
      nameIdFormat: string | null;
      linkedAt: string;
      lastLoginAt: string | null;
    }>;
  };
}

export interface AccountMfaTotpEnrollRequest {
  password: string;
}

export interface AccountMfaTotpEnrollResponse {
  enrollment: {
    method: 'totp';
    issuer: string;
    accountName: string;
    secretBase32: string;
    otpauthUrl: string;
    digits: 6;
    periodSeconds: 30;
    algorithm: 'SHA1';
    pendingIssuedAt: string;
  };
}

export interface AccountMfaTotpConfirmRequest {
  code: string;
}

export interface AccountMfaTotpConfirmResponse {
  enabled: true;
  recoveryCodes: string[];
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
}

export interface AccountMfaDisableRequest {
  password: string;
  code?: string;
  recoveryCode?: string;
}

export interface AccountMfaDisableResponse {
  disabled: true;
  recoveryCodeUsed: boolean;
  session: {
    id: string;
    expiresAt: string;
    source: 'account_session';
  };
  user: AccountUserRecordView;
}
