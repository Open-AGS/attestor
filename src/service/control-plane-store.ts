/**
 * Shared Control Plane Store - compatibility facade.
 *
 * BOUNDARY:
 * - Optional shared PostgreSQL state is implemented in responsibility-named
 *   modules under `src/service/control-plane-store/`.
 * - File-backed stores remain the fallback for self-host/dev and existing
 *   operator flows.
 * - This facade preserves the historical service import path while the store
 *   families stay isolated behind smaller modules.
 * - This is a control-plane state slice, not full multi-region HA or an
 *   entitlement service.
 */

export {
  appendAdminAuditRecordState,
  listAdminAuditRecordsState,
} from './control-plane-store/admin-audit-state.js';
export {
  lookupAdminIdempotencyState,
  recordAdminIdempotencyState,
} from './control-plane-store/admin-idempotency-state.js';
export {
  consumeAccountUserActionTokenState,
  countAccountUsersForAccountState,
  createAccountUserState,
  exportAccountSessionStoreSnapshot,
  exportAccountUserActionTokenStoreSnapshot,
  exportAccountUserStoreSnapshot,
  findAccountSessionByTokenState,
  findAccountUserActionTokenByTokenState,
  findAccountUserByEmailState,
  findAccountUserByIdState,
  findAccountUserByOidcIdentityState,
  findAccountUserByPasskeyCredentialIdState,
  findAccountUserBySamlIdentityState,
  issueAccountInviteTokenState,
  issueAccountMfaLoginTokenState,
  issueAccountPasskeyChallengeTokenState,
  issueAccountSessionState,
  issuePasswordResetTokenState,
  listAccountUserActionTokensByAccountIdState,
  listAccountUsersByAccountIdState,
  listAllAccountUsersState,
  listHostedSamlReplaysState,
  recordAccountUserLoginState,
  recordAccountUserTotpVerificationStepState,
  recordHostedSamlReplayState,
  restoreAccountSessionStoreSnapshot,
  restoreAccountUserActionTokenStoreSnapshot,
  restoreAccountUserStoreSnapshot,
  revokeAccountSessionByTokenState,
  revokeAccountSessionsForAccountState,
  revokeAccountSessionsForUserState,
  revokeAccountSessionState,
  revokeAccountUserActionTokensForUserState,
  revokeAccountUserActionTokenState,
  saveAccountUserActionTokenRecordState,
  saveAccountUserRecordState,
  setAccountUserPasswordState,
  setAccountUserStatusState,
  type AccountSessionStoreSnapshot,
  type AccountUserActionTokenStoreSnapshot,
  type AccountUserStoreSnapshot,
} from './control-plane-store/account-auth-state.js';
export {
  exportAsyncDeadLetterStoreSnapshot,
  listAsyncDeadLetterRecordsState,
  removeAsyncDeadLetterRecordState,
  restoreAsyncDeadLetterStoreSnapshot,
  upsertAsyncDeadLetterRecordState,
  type AsyncDeadLetterStoreSnapshot,
} from './control-plane-store/async-dead-letter-state.js';
export {
  exportHostedEmailDeliveryEventStoreSnapshot,
  listHostedEmailDeliveriesState,
  recordHostedEmailDispatchEventState,
  recordHostedEmailProviderEventState,
  restoreHostedEmailDeliveryEventStoreSnapshot,
  type EmailDeliveryEventStoreSnapshot,
} from './control-plane-store/email-delivery-state.js';
export {
  applyStripeCheckoutCompletionState,
  applyStripeInvoiceStateState,
  applyStripeSubscriptionStateState,
  attachStripeBillingToAccountState,
  createHostedAccountState,
  exportHostedAccountStoreSnapshot,
  exportHostedBillingEntitlementStoreSnapshot,
  exportWorkflowEntitlementStoreSnapshot,
  findHostedAccountByIdState,
  findHostedAccountByTenantIdState,
  findHostedBillingEntitlementByAccountIdState,
  findWorkflowEntitlementByStripeSubscriptionItemIdState,
  findWorkflowEntitlementByTenantAndWorkflowState,
  listHostedAccountsState,
  listHostedBillingEntitlementsState,
  listWorkflowEntitlementsState,
  provisionHostedAccountState,
  restoreHostedAccountStoreSnapshot,
  restoreHostedBillingEntitlementStoreSnapshot,
  restoreWorkflowEntitlementStoreSnapshot,
  setHostedAccountStatusState,
  consumeWorkflowEntitlementAdmissionState,
  upsertHostedBillingEntitlementState,
  upsertPendingWorkflowEntitlementState,
  upsertWorkflowEntitlementFromStripeState,
  type BillingEntitlementStoreSnapshot,
  type HostedAccountStoreSnapshot,
  type WorkflowEntitlementSnapshot,
} from './control-plane-store/hosted-billing-state.js';
export {
  controlPlaneStoreMode,
  controlPlaneStoreSource,
  isSharedControlPlaneConfigured,
} from './control-plane-store/pg.js';
export {
  ensurePipelineIdempotencyStateReady,
  lookupPipelineIdempotencyState,
  recordPipelineIdempotencyState,
} from './control-plane-store/pipeline-idempotency-state.js';
export {
  exportAdminAuditLogStoreSnapshot,
  exportAdminIdempotencyStoreSnapshot,
  resetSharedControlPlaneStoreForTests,
  restoreAdminAuditLogStoreSnapshot,
  restoreAdminIdempotencyStoreSnapshot,
  type AdminAuditLogStoreSnapshot,
  type AdminIdempotencyStoreSnapshot,
} from './control-plane-store/snapshots.js';
export {
  claimProcessedStripeWebhookState,
  exportStripeWebhookStoreSnapshot,
  finalizeProcessedStripeWebhookState,
  lookupProcessedStripeWebhookState,
  recordProcessedStripeWebhookState,
  releaseProcessedStripeWebhookClaimState,
  restoreStripeWebhookStoreSnapshot,
  type StripeWebhookClaimState,
  type StripeWebhookStoreSnapshot,
} from './control-plane-store/stripe-webhook-state.js';
export {
  exportTenantKeyStoreSnapshot,
  findActiveTenantKeyState,
  findTenantRecordByTenantIdState,
  hasTenantKeyRecordsState,
  issueTenantApiKeyState,
  listTenantKeyRecordsState,
  recoverTenantApiKeyState,
  restoreTenantKeyStoreSnapshot,
  revokeTenantApiKeyState,
  rotateTenantApiKeyState,
  setTenantApiKeyStatusState,
  syncTenantPlanByTenantIdState,
  type TenantKeyStoreSnapshot,
} from './control-plane-store/tenant-key-state.js';
export {
  canConsumePipelineRunState,
  consumePipelineRunState,
  exportUsageLedgerStoreSnapshot,
  getUsageContextState,
  queryUsageLedgerState,
  restoreUsageLedgerStoreSnapshot,
  type UsageLedgerStoreSnapshot,
} from './control-plane-store/usage-state.js';
