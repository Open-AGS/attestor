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
import type * as BillingExport from '../../billing/billing-export.js';
import type * as BillingFeatureService from '../../billing/billing-feature-service.js';
import type * as BillingReconciliation from '../../billing/billing-reconciliation.js';
import type * as PlanCatalog from '../../plan-catalog.js';
import type * as RateLimit from '../../rate-limit.js';
import type { AdminAuditAction } from '../../admin-audit-log.js';
import type { SecretEnvelopeStatus } from '../../secret-envelope.js';
import type * as StripeBilling from '../../billing/stripe/stripe-billing.js';
import {
  type AccountApiKeyService,
} from '../../application/account-api-key-service.js';
import type { AccountAuthService } from '../../application/account-auth-service.js';
import type { AccountStateService } from '../../application/account-state-service.js';
import type { AccountUserManagementService } from '../../application/account-user-management-service.js';
import type { PipelineIdempotencyService } from '../../application/pipeline-idempotency-service.js';
import type { HostedAccountRecord } from '../../account/account-store.js';
import type {
  AccountUserPasskeyCredentialRecord,
  AccountUserRecord,
  AccountUserRole,
} from '../../account/account-user-store.js';
import type { AccountUserActionTokenRecord } from '../../account/account-user-token-store.js';
import type { HostedBillingEntitlementRecord } from '../../billing/billing-entitlement-store.js';
import type {
  ListWorkflowEntitlementsFilters,
  PendingWorkflowEntitlementInput,
  StoredWorkflowEntitlementRecord,
} from '../../workflow-entitlement-store.js';
import type { HostedPasskeyAuthenticationChallengeState, HostedPasskeyAuthenticatorHint, HostedPasskeyRegistrationChallengeState } from '../../account/account-passkeys.js';
import type { TenantKeyRecord } from '../../tenant-key-store.js';
import type { AccountAccessContext, TenantContext } from '../../tenant-isolation.js';
import type { UsageContext } from '../../usage-meter.js';
import { registerAccountAdminUserRoutes } from './account-admin-user-routes.js';
import { registerAccountBillingRoutes } from './account-billing-routes.js';
import { registerAccountFederatedAuthRoutes } from './account-federated-auth-routes.js';
import { registerAccountMfaPasskeyRoutes } from './account-mfa-passkey-routes.js';
import { registerAccountPublicAuthRoutes } from './account-public-auth-routes.js';

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
  createHostedWorkflowCheckoutSession: typeof StripeBilling.createHostedWorkflowCheckoutSession;
  listWorkflowEntitlements(filters?: ListWorkflowEntitlementsFilters): Promise<{
    records: StoredWorkflowEntitlementRecord[];
    path: string | null;
  }>;
  findWorkflowEntitlementByTenantAndWorkflow(
    tenantId: string,
    workflowId: string,
  ): Promise<StoredWorkflowEntitlementRecord | null>;
  upsertPendingWorkflowEntitlement(
    input: PendingWorkflowEntitlementInput,
  ): Promise<{ record: StoredWorkflowEntitlementRecord; path: string | null }>;
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
  registerAccountPublicAuthRoutes(app, deps);
  registerAccountFederatedAuthRoutes(app, deps);
  registerAccountMfaPasskeyRoutes(app, deps);
  registerAccountAdminUserRoutes(app, deps);
  registerAccountBillingRoutes(app, deps);
}
