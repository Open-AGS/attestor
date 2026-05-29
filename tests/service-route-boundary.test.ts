import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE_ROOT = join(process.cwd(), 'src', 'service', 'http', 'routes');

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function readAccountRouteSources(): string {
  return readdirSync(ROUTE_ROOT)
    .filter((file) => /^account.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(ROUTE_ROOT, file), 'utf8'))
    .join('\n');
}

function readAdminRouteSources(): string {
  return readdirSync(ROUTE_ROOT)
    .filter((file) => /^admin.*\.ts$/u.test(file))
    .map((file) => readFileSync(join(ROUTE_ROOT, file), 'utf8'))
    .join('\n');
}

function collectRouteFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...collectRouteFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(`${process.cwd().replaceAll('\\', '/')}/`, '');
}

function testReleaseReviewRouteIsStronglyTyped(): void {
  const releaseReviewRoute = readFileSync(
    join(ROUTE_ROOT, 'release-review-routes.ts'),
    'utf8',
  );

  assert.doesNotMatch(releaseReviewRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(releaseReviewRoute, /:\s*any\b/u);
  assert.doesNotMatch(releaseReviewRoute, /\bas any\b/u);
  assert.match(releaseReviewRoute, /ReleaseReviewRouteDeps/u);
  assert.match(releaseReviewRoute, /ReleaseReviewerQueueStore/u);
  assert.match(releaseReviewRoute, /ReleaseDecisionLogWriter/u);
}

function testAllServiceRoutesHaveClosedAnyDebt(): void {
  const offenders = collectRouteFiles(ROUTE_ROOT)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('type RouteDependency = any'))
    .map(normalizePath)
    .sort();

  assert.deepEqual(offenders, []);
}

function testDirectStoreRouteDebtIsExplicitlyBounded(): void {
  const offenders = collectRouteFiles(ROUTE_ROOT)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes("control-plane-store.js"))
    .map(normalizePath)
    .sort();

  assert.deepEqual(offenders, []);
}

function testRoutesDoNotExposeLegacyStateFunctionPorts(): void {
  const legacyStatePorts = [
    'canConsumePipelineRunState',
    'consumePipelineRunState',
    'upsertAsyncDeadLetterRecordState',
    'listHostedEmailDeliveriesState',
    'recordHostedEmailProviderEventState',
  ];
  const offenders = collectRouteFiles(ROUTE_ROOT)
    .filter((filePath) => {
      const content = readFileSync(filePath, 'utf8');
      return legacyStatePorts.some((port) => content.includes(port));
    })
    .map(normalizePath)
    .sort();

  assert.deepEqual(offenders, []);
}

function testReleaseReviewRouteUsesPublicReleaseLayerTypes(): void {
  const releaseReviewRoute = readFileSync(
    join(ROUTE_ROOT, 'release-review-routes.ts'),
    'utf8',
  );

  assert.match(releaseReviewRoute, /from '..\/..\/..\/release-layer\/index\.js'/u);
  assert.doesNotMatch(releaseReviewRoute, /release-kernel\//u);
}

function testReleaseReviewRouteTokenResponseCarriesPolicyProvenance(): void {
  const releaseReviewRoute = readFileSync(
    join(ROUTE_ROOT, 'release-review-routes.ts'),
    'utf8',
  );

  assert.match(releaseReviewRoute, /policyVersion: issuedToken\.claims\.policy_version \?\? null/u);
  assert.match(releaseReviewRoute, /policyHash: issuedToken\.claims\.policy_hash/u);
  assert.match(releaseReviewRoute, /policyIrHash: issuedToken\.claims\.policy_ir_hash \?\? null/u);
  assert.match(
    releaseReviewRoute,
    /policyProvenanceSource: issuedToken\.claims\.policy_provenance_source \?\? null/u,
  );
  assert.match(
    releaseReviewRoute,
    /compiledPolicyIndexVersion: issuedToken\.claims\.compiled_policy_index_version \?\? null/u,
  );
  assert.match(
    releaseReviewRoute,
    /compiledPolicyIrVersion: issuedToken\.claims\.compiled_policy_ir_version \?\? null/u,
  );
  assert.match(releaseReviewRoute, /policyContext: ReleaseEvidenceTokenPolicyContext/u);
  assert.match(releaseReviewRoute, /policyVersion: policyContext\.policyVersion/u);
  assert.match(releaseReviewRoute, /policyHash: policyContext\.policyHash/u);
  assert.match(releaseReviewRoute, /policyContext,/u);
}

function testReleaseReviewRouteEvidenceResponseCarriesPolicyContext(): void {
  const releaseReviewRoute = readFileSync(
    join(ROUTE_ROOT, 'release-review-routes.ts'),
    'utf8',
  );

  assert.match(releaseReviewRoute, /type ReleaseEvidencePolicyContext/u);
  assert.match(releaseReviewRoute, /policyContext: ReleaseEvidencePolicyContext/u);
  assert.match(
    releaseReviewRoute,
    /policyContext: issuedEvidencePack\.evidencePack\.policyContext/u,
  );
}

function testWebhookRoutesAreSplitByProviderBoundary(): void {
  const webhookRoute = readFileSync(join(ROUTE_ROOT, 'webhook-routes.ts'), 'utf8');
  const emailWebhookRoute = readFileSync(join(ROUTE_ROOT, 'email-webhook-routes.ts'), 'utf8');
  const stripeWebhookRoute = readFileSync(join(ROUTE_ROOT, 'stripe-webhook-routes.ts'), 'utf8');

  assert.match(webhookRoute, /registerEmailWebhookRoutes\(app, deps\);/u);
  assert.match(webhookRoute, /registerStripeWebhookRoutes\(app, deps\);/u);
  assert.doesNotMatch(webhookRoute, /type RouteDependency = any/u);

  assert.match(emailWebhookRoute, /export interface EmailWebhookRouteDeps/u);
  assert.doesNotMatch(emailWebhookRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(emailWebhookRoute, /:\s*any\b/u);
  assert.doesNotMatch(emailWebhookRoute, /\bas any\b/u);

  assert.match(stripeWebhookRoute, /export interface StripeWebhookRouteDeps/u);
  assert.doesNotMatch(stripeWebhookRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(stripeWebhookRoute, /:\s*any\b/u);
  assert.doesNotMatch(stripeWebhookRoute, /\bas any\b/u);
}

function testEmailWebhookRouteDelegatesProviderUseCase(): void {
  const emailWebhookRoute = readFileSync(join(ROUTE_ROOT, 'email-webhook-routes.ts'), 'utf8');
  const emailWebhookService = readProjectFile('src', 'service', 'application', 'email-webhook-service.ts');

  assert.match(emailWebhookRoute, /emailWebhookService: EmailWebhookService/u);
  assert.match(emailWebhookRoute, /emailWebhookService\.handleSendGrid/u);
  assert.match(emailWebhookRoute, /emailWebhookService\.handleMailgun/u);
  assert.doesNotMatch(emailWebhookRoute, /verifySignedSendGridWebhook/u);
  assert.doesNotMatch(emailWebhookRoute, /parseSendGridWebhookEvents/u);
  assert.doesNotMatch(emailWebhookRoute, /recordHostedEmailProviderEventState/u);
  assert.doesNotMatch(emailWebhookRoute, /listHostedEmailDeliveriesState/u);

  assert.match(emailWebhookService, /export interface EmailWebhookService/u);
  assert.match(emailWebhookService, /handleSendGrid\(input: SendGridWebhookInput\)/u);
  assert.match(emailWebhookService, /handleMailgun\(input: MailgunWebhookInput\)/u);
  assert.match(emailWebhookService, /recordEmailProviderEvent/u);
}

function testStripeWebhookRouteDelegatesIngressUseCase(): void {
  const stripeWebhookRoute = readFileSync(join(ROUTE_ROOT, 'stripe-webhook-routes.ts'), 'utf8');
  const stripeWebhookService = readProjectFile('src', 'service', 'application', 'stripe-webhook-service.ts');
  const stripeWebhookBillingProcessor = readProjectFile(
    'src',
    'service',
    'application',
    'stripe-webhook-billing-processor.ts',
  );
  const stripeWebhookBillingProcessorTypes = readProjectFile(
    'src',
    'service',
    'application',
    'stripe-webhook-billing-processor-types.ts',
  );
  const stripeWebhookBillingProcessorContext = readProjectFile(
    'src',
    'service',
    'application',
    'stripe-webhook-billing-processor-context.ts',
  );

  assert.match(stripeWebhookRoute, /stripeWebhookService: StripeWebhookService/u);
  assert.match(stripeWebhookRoute, /stripeWebhookBillingProcessor: StripeWebhookBillingProcessor/u);
  assert.match(stripeWebhookRoute, /stripeWebhookService\.begin/u);
  assert.match(stripeWebhookRoute, /stripeWebhookBillingProcessor\.process/u);
  assert.doesNotMatch(stripeWebhookRoute, /claimStripeBillingEvent/u);
  assert.doesNotMatch(stripeWebhookRoute, /claimProcessedStripeWebhookState/u);
  assert.doesNotMatch(stripeWebhookRoute, /lookupProcessedStripeWebhookState/u);
  assert.doesNotMatch(stripeWebhookRoute, /finalizeProcessedStripeWebhookState/u);
  assert.doesNotMatch(stripeWebhookRoute, /recordProcessedStripeWebhookState/u);
  assert.doesNotMatch(stripeWebhookRoute, /releaseProcessedStripeWebhookClaimState/u);
  assert.doesNotMatch(stripeWebhookRoute, /applyStripeSubscriptionStateState/u);
  assert.doesNotMatch(stripeWebhookRoute, /appendAdminAuditRecordState/u);
  assert.doesNotMatch(stripeWebhookRoute, /billing-event-ledger/u);
  assert.doesNotMatch(stripeWebhookRoute, /control-plane-store/u);

  assert.match(stripeWebhookService, /export interface StripeWebhookService/u);
  assert.match(stripeWebhookService, /begin\(input: StripeWebhookBeginInput\)/u);
  assert.match(stripeWebhookService, /releaseClaim\(\)/u);
  assert.match(stripeWebhookBillingProcessor, /StripeWebhookBillingProcessor/u);
  assert.match(stripeWebhookBillingProcessorTypes, /export interface StripeWebhookBillingProcessor/u);
  assert.match(stripeWebhookBillingProcessorTypes, /process\(stripeWebhook: StripeWebhookProcessingHandle\)/u);
  assert.match(stripeWebhookBillingProcessorContext, /export function accountStoreErrorResponse/u);
}

function testStripeWebhookBillingProcessorUsesNamedEventProcessors(): void {
  const stripeWebhookBillingProcessor = readProjectFile(
    'src',
    'service',
    'application',
    'stripe-webhook-billing-processor.ts',
  );
  const stripeWebhookBillingUnsupportedEvent = readProjectFile(
    'src',
    'service',
    'application',
    'stripe-webhook-billing-unsupported-event.ts',
  );

  assert.match(stripeWebhookBillingProcessor, /processUnsupportedStripeBillingEvent/u);
  assert.match(stripeWebhookBillingUnsupportedEvent, /export async function processUnsupportedStripeBillingEvent/u);
  assert.match(stripeWebhookBillingProcessor, /async function processSubscriptionEvent/u);
  assert.match(stripeWebhookBillingProcessor, /async function processCheckoutCompletedEvent/u);
  assert.match(stripeWebhookBillingProcessor, /async function processChargeEvent/u);
  assert.match(stripeWebhookBillingProcessor, /async function processEntitlementSummaryEvent/u);
  assert.match(stripeWebhookBillingProcessor, /async function processInvoiceEvent/u);
  assert.match(stripeWebhookBillingProcessor, /return processSubscriptionEvent\(stripeWebhook, c\);/u);
  assert.match(stripeWebhookBillingProcessor, /return processCheckoutCompletedEvent\(stripeWebhook, c\);/u);
  assert.match(stripeWebhookBillingProcessor, /return processChargeEvent\(stripeWebhook, c\);/u);
  assert.match(stripeWebhookBillingProcessor, /return processEntitlementSummaryEvent\(stripeWebhook, c\);/u);
  assert.match(stripeWebhookBillingProcessor, /return processInvoiceEvent\(stripeWebhook, c\);/u);
}

function testAdminRouteIsStronglyTyped(): void {
  const adminRoute = readFileSync(join(ROUTE_ROOT, 'admin-routes.ts'), 'utf8');
  const adminRouteContext = readFileSync(join(ROUTE_ROOT, 'admin-route-context.ts'), 'utf8');

  assert.match(adminRoute, /export type \{ AdminRouteDeps \} from '.\/admin-route-context\.js';/u);
  assert.match(adminRouteContext, /export interface AdminRouteDeps/u);
  assert.doesNotMatch(adminRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(adminRoute, /:\s*any\b/u);
  assert.doesNotMatch(adminRoute, /\bas any\b/u);
  assert.doesNotMatch(adminRouteContext, /type RouteDependency = any/u);
  assert.doesNotMatch(adminRouteContext, /:\s*any\b/u);
  assert.doesNotMatch(adminRouteContext, /\bas any\b/u);
}

function testAdminRouteDelegatesMutationUseCase(): void {
  const adminRoute = readFileSync(join(ROUTE_ROOT, 'admin-routes.ts'), 'utf8');
  const adminRoutes = readAdminRouteSources();
  const adminRouteContext = readFileSync(join(ROUTE_ROOT, 'admin-route-context.ts'), 'utf8');
  const adminMutationService = readProjectFile('src', 'service', 'application', 'admin-mutation-service.ts');

  assert.match(adminRoute, /registerAdminAccountMutationRoutes\(app, deps\);/u);
  assert.match(adminRouteContext, /adminMutationService: AdminMutationService/u);
  assert.match(adminRoutes, /adminMutationService\.begin/u);
  assert.match(adminRoutes, /adminMutationService\.finalize/u);
  assert.doesNotMatch(adminRoute, /adminMutationRequest/u);
  assert.doesNotMatch(adminRoute, /finalizeAdminMutation/u);

  assert.match(adminMutationService, /export interface AdminMutationService/u);
  assert.match(adminMutationService, /begin\(input: AdminMutationBeginInput\)/u);
  assert.match(adminMutationService, /finalize\(input: AdminMutationFinalizationInput\)/u);
}

function testAdminRouteDelegatesControlUseCases(): void {
  const adminRoute = readFileSync(join(ROUTE_ROOT, 'admin-routes.ts'), 'utf8');
  const adminRoutes = readAdminRouteSources();
  const adminRouteContext = readFileSync(join(ROUTE_ROOT, 'admin-route-context.ts'), 'utf8');
  const adminControlService = readProjectFile('src', 'service', 'application', 'admin-control-service.ts');

  assert.match(adminRoute, /registerAdminAccountMutationRoutes\(app, deps\);/u);
  assert.match(adminRoute, /registerAdminTenantKeyRoutes\(app, deps\);/u);
  assert.match(adminRouteContext, /adminControlService: AdminControlService/u);
  assert.match(adminRoutes, /adminControlService\.provisionHostedAccount/u);
  assert.match(adminRoutes, /adminControlService\.attachStripeBilling/u);
  assert.match(adminRoutes, /adminControlService\.setHostedAccountStatus/u);
  assert.match(adminRoutes, /adminControlService\.issueTenantApiKey/u);
  assert.match(adminRoutes, /adminControlService\.rotateTenantApiKey/u);
  assert.match(adminRoutes, /adminControlService\.setTenantApiKeyStatus/u);
  assert.match(adminRoutes, /adminControlService\.recoverTenantApiKey/u);
  assert.match(adminRoutes, /adminControlService\.revokeTenantApiKey/u);
  assert.doesNotMatch(adminRoute, /provisionHostedAccountState/u);
  assert.doesNotMatch(adminRoute, /attachStripeBillingToAccountState/u);
  assert.doesNotMatch(adminRoute, /setHostedAccountStatusState/u);
  assert.doesNotMatch(adminRoute, /revokeAccountSessionsForAccountState/u);
  assert.doesNotMatch(adminRoute, /issueTenantApiKeyState/u);
  assert.doesNotMatch(adminRoute, /rotateTenantApiKeyState/u);
  assert.doesNotMatch(adminRoute, /setTenantApiKeyStatusState/u);
  assert.doesNotMatch(adminRoute, /recoverTenantApiKeyState/u);
  assert.doesNotMatch(adminRoute, /revokeTenantApiKeyState/u);

  assert.match(adminControlService, /export interface AdminControlService/u);
  assert.match(adminControlService, /provisionHostedAccount\(input: AdminControlProvisionAccountInput\)/u);
  assert.match(adminControlService, /attachStripeBilling\(input: AdminControlAttachStripeBillingInput\)/u);
  assert.match(adminControlService, /setHostedAccountStatus\(input: AdminControlSetHostedAccountStatusInput\)/u);
  assert.match(adminControlService, /recoverTenantApiKey\(input: AdminControlRecoverTenantKeyInput\)/u);
}

function testAdminRouteDelegatesQueryUseCases(): void {
  const adminRoute = readFileSync(join(ROUTE_ROOT, 'admin-routes.ts'), 'utf8');
  const adminRoutes = readAdminRouteSources();
  const adminRouteContext = readFileSync(join(ROUTE_ROOT, 'admin-route-context.ts'), 'utf8');
  const adminQueryService = readProjectFile('src', 'service', 'application', 'admin-query-service.ts');

  assert.match(adminRoute, /registerAdminReadRoutes\(app, deps\);/u);
  assert.match(adminRoute, /registerAdminQueueRoutes\(app, deps\);/u);
  assert.match(adminRouteContext, /adminQueryService: AdminQueryService/u);
  assert.match(adminRoutes, /adminQueryService\.listTenantKeys/u);
  assert.match(adminRoutes, /adminQueryService\.listHostedAccounts/u);
  assert.match(adminRoutes, /adminQueryService\.findHostedAccountById/u);
  assert.match(adminRoutes, /adminQueryService\.listAdminAuditRecords/u);
  assert.match(adminRoutes, /adminQueryService\.listHostedBillingEntitlements/u);
  assert.match(adminRoutes, /adminQueryService\.listHostedEmailDeliveries/u);
  assert.match(adminRoutes, /adminQueryService\.listAsyncDeadLetters/u);
  assert.match(adminRoutes, /adminQueryService\.listUsage/u);
  assert.doesNotMatch(adminRoute, /control-plane-store/u);
  assert.doesNotMatch(adminRoute, /listTenantKeyRecordsState/u);
  assert.doesNotMatch(adminRoute, /listHostedAccountsState/u);
  assert.doesNotMatch(adminRoute, /findHostedAccountByIdState/u);
  assert.doesNotMatch(adminRoute, /listAdminAuditRecordsState/u);
  assert.doesNotMatch(adminRoute, /listHostedBillingEntitlementsState/u);
  assert.doesNotMatch(adminRoute, /listHostedEmailDeliveriesState/u);
  assert.doesNotMatch(adminRoute, /listAsyncDeadLetterRecordsState/u);
  assert.doesNotMatch(adminRoute, /queryUsageLedgerState/u);

  assert.match(adminQueryService, /export interface AdminQueryService/u);
  assert.match(adminQueryService, /listTenantKeys\(\)/u);
  assert.match(adminQueryService, /listUsage/u);
}

function testAdminRouteRequiresSharedDegradedModeGrantStore(): void {
  const adminRoute = readFileSync(join(ROUTE_ROOT, 'admin-routes.ts'), 'utf8');
  const adminRouteContext = readFileSync(join(ROUTE_ROOT, 'admin-route-context.ts'), 'utf8');
  const apiRouteRuntime = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'api-route-runtime.ts',
  );
  const releaseRuntime = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'release-runtime.ts',
  );

  assert.match(adminRouteContext, /releaseDegradedModeGrantStore: RequestPathDegradedModeGrantStore;/u);
  assert.doesNotMatch(adminRouteContext, /releaseDegradedModeGrantStore\?: RequestPathDegradedModeGrantStore;/u);
  assert.doesNotMatch(adminRoute, /createInMemoryDegradedModeGrantStore/u);
  assert.match(apiRouteRuntime, /createReleaseRuntimeBootstrap\(\{/u);
  assert.match(apiRouteRuntime, /allowPreflightOnDurabilityViolation:\s*runtimeProfile\.id === 'production-shared'/u);
  assert.match(apiRouteRuntime, /resolveRuntimeProfile\(\)/u);
  assert.match(apiRouteRuntime, /releaseDegradedModeGrantStore:\s*apiReleaseDegradedModeGrantStore/u);
  assert.match(
    releaseRuntime,
    /sharedAuthorityRequestPath\?\.apiReleaseDegradedModeGrantStore[\s\S]*createFileBackedDegradedModeGrantStore\(\)/u,
  );
}

function testAccountRouteIsStronglyTyped(): void {
  const accountRoute = readFileSync(join(ROUTE_ROOT, 'account-routes.ts'), 'utf8');

  assert.match(accountRoute, /export interface AccountRouteDeps/u);
  assert.doesNotMatch(accountRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(accountRoute, /:\s*any\b/u);
  assert.doesNotMatch(accountRoute, /\bas any\b/u);
}

function testAccountRouteDelegatesAuthUseCases(): void {
  const accountRoute = readFileSync(join(ROUTE_ROOT, 'account-routes.ts'), 'utf8');
  const accountRoutes = readAccountRouteSources();
  const accountRouteHelpers = readProjectFile('src', 'service', 'http', 'routes', 'account-route-helpers.ts');
  const accountAuthService = readProjectFile('src', 'service', 'application', 'account-auth-service.ts');

  assert.match(accountRoute, /authService: AccountAuthService/u);
  assert.match(accountRoutes, /authService\.bootstrapFirstUser/u);
  assert.match(accountRoutes, /authService\.signup/u);
  assert.match(accountRoutes, /authService\.login/u);
  assert.match(accountRoutes, /from '..\/..\/account\/auth-abuse-guard\.js'/u);
  assert.match(accountRouteHelpers, /checkAuthAttemptAllowed/u);
  assert.match(accountRoutes, /recordAuthAttemptFailure/u);
  assert.match(accountRoutes, /recordAuthAttemptSuccess/u);
  assert.match(accountRouteHelpers, /resolveAuthAttemptSource/u);
  assert.doesNotMatch(accountRoute, /countAccountUsersForAccountState/u);
  assert.doesNotMatch(accountRoute, /provisionHostedAccountState/u);
  assert.doesNotMatch(accountRoute, /deriveSignupTenantId/u);

  assert.match(accountAuthService, /export interface AccountAuthService/u);
  assert.match(accountAuthService, /bootstrapFirstUser/u);
  assert.match(accountAuthService, /signup/u);
  assert.match(accountAuthService, /login/u);
}

function testAccountRouteDelegatesApiKeyUseCases(): void {
  const accountRoute = readFileSync(join(ROUTE_ROOT, 'account-routes.ts'), 'utf8');
  const accountRoutes = readAccountRouteSources();
  const accountApiKeyService = readProjectFile('src', 'service', 'application', 'account-api-key-service.ts');

  assert.match(accountRoute, /apiKeyService: AccountApiKeyService/u);
  assert.match(accountRoutes, /apiKeyService\.list/u);
  assert.match(accountRoutes, /apiKeyService\.issue/u);
  assert.match(accountRoutes, /apiKeyService\.rotate/u);
  assert.match(accountRoutes, /apiKeyService\.setStatus/u);
  assert.match(accountRoutes, /apiKeyService\.revoke/u);
  assert.doesNotMatch(accountRoute, /findTenantRecordByTenantIdState/u);
  assert.doesNotMatch(accountRoute, /listTenantKeyRecordsState/u);
  assert.doesNotMatch(accountRoute, /issueTenantApiKeyState/u);
  assert.doesNotMatch(accountRoute, /rotateTenantApiKeyState/u);
  assert.doesNotMatch(accountRoute, /setTenantApiKeyStatusState/u);
  assert.doesNotMatch(accountRoute, /revokeTenantApiKeyState/u);

  assert.match(accountApiKeyService, /export interface AccountApiKeyService/u);
  assert.match(accountApiKeyService, /list\(accountId: string\)/u);
  assert.match(accountApiKeyService, /issue\(accountId: string\)/u);
  assert.match(accountApiKeyService, /rotate\(accountId: string, keyId: string\)/u);
}

function testCoreRouteExposesReleaseTokenJwksFromRuntimeKey(): void {
  const coreRoute = readFileSync(join(ROUTE_ROOT, 'core-routes.ts'), 'utf8');
  const apiRouteRuntime = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'api-route-runtime.ts',
  );

  assert.match(coreRoute, /apiReleaseVerificationKeysPromise: Promise<readonly ReleaseTokenVerificationKey\[\]>/u);
  assert.match(coreRoute, /app\.get\('\/api\/v1\/release-token\/jwks'/u);
  assert.match(coreRoute, /releaseTokenVerificationKeysToJwks\(verificationKeys\)/u);
  assert.match(coreRoute, /cache-control', 'no-store'/u);
  assert.match(apiRouteRuntime, /apiReleaseVerificationKeysPromise,/u);
}

function testAccountRouteDelegatesUserManagementUseCases(): void {
  const accountRoute = readFileSync(join(ROUTE_ROOT, 'account-routes.ts'), 'utf8');
  const accountRoutes = readAccountRouteSources();
  const accountUserManagementService = readProjectFile(
    'src',
    'service',
    'application',
    'account-user-management-service.ts',
  );

  assert.match(accountRoute, /userManagementService: AccountUserManagementService/u);
  assert.match(accountRoutes, /userManagementService\.listUsers/u);
  assert.match(accountRoutes, /userManagementService\.createUser/u);
  assert.match(accountRoutes, /userManagementService\.issueInvite/u);
  assert.match(accountRoutes, /userManagementService\.revokeInvite/u);
  assert.match(accountRoutes, /userManagementService\.acceptInvite/u);
  assert.match(accountRoutes, /userManagementService\.setUserStatus/u);
  assert.match(accountRoutes, /userManagementService\.issuePasswordReset/u);
  assert.match(accountRoutes, /userManagementService\.consumePasswordReset/u);
  assert.doesNotMatch(accountRoute, /createAccountUserState/u);
  assert.doesNotMatch(accountRoute, /listAccountUsersByAccountIdState/u);
  assert.doesNotMatch(accountRoute, /listAccountUserActionTokensByAccountIdState/u);
  assert.doesNotMatch(accountRoute, /issueAccountInviteTokenState/u);
  assert.doesNotMatch(accountRoute, /issuePasswordResetTokenState/u);
  assert.doesNotMatch(accountRoute, /setAccountUserStatusState/u);
  assert.doesNotMatch(accountRoute, /deliverHostedInviteEmail/u);
  assert.doesNotMatch(accountRoute, /deliverHostedPasswordResetEmail/u);

  assert.match(accountUserManagementService, /export interface AccountUserManagementService/u);
  assert.match(accountUserManagementService, /createUser\(input: AccountUserCreateInput\)/u);
  assert.match(accountUserManagementService, /acceptInvite\(input: AccountUserInviteAcceptInput\)/u);
  assert.match(accountUserManagementService, /consumePasswordReset\(input: AccountUserPasswordResetConsumeInput\)/u);
}

function testAccountRouteUsesStateServicePort(): void {
  const accountRoute = readFileSync(join(ROUTE_ROOT, 'account-routes.ts'), 'utf8');
  const accountRoutes = readAccountRouteSources();
  const accountStateService = readProjectFile('src', 'service', 'application', 'account-state-service.ts');

  assert.match(accountRoute, /stateService: AccountStateService/u);
  assert.match(accountRoutes, /stateService\.findAccountUserByEmail/u);
  assert.match(accountRoutes, /stateService\.issueAccountSession/u);
  assert.match(accountRoutes, /stateService\.findHostedAccountById/u);
  assert.match(accountRoutes, /stateService\.saveAccountUserRecord/u);
  assert.match(accountRoutes, /stateService\.recordHostedSamlReplay/u);
  assert.match(accountRoutes, /stateService\.listHostedEmailDeliveries/u);
  assert.doesNotMatch(accountRoute, /control-plane-store/u);
  assert.doesNotMatch(accountRoute, /findAccountUserByEmailState/u);
  assert.doesNotMatch(accountRoute, /issueAccountSessionState/u);
  assert.doesNotMatch(accountRoute, /findHostedAccountByIdState/u);
  assert.doesNotMatch(accountRoute, /saveAccountUserRecordState/u);
  assert.doesNotMatch(accountRoute, /recordHostedSamlReplayState/u);
  assert.doesNotMatch(accountRoute, /listHostedEmailDeliveriesState/u);

  assert.match(accountStateService, /export interface AccountStateService/u);
  assert.match(accountStateService, /createAccountStateService/u);
}

function testPipelineRoutesAreSplitByUseCaseBoundary(): void {
  const pipelineRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-routes.ts'), 'utf8');

  assert.match(pipelineRoute, /registerPipelineExecutionRoutes\(app, deps\);/u);
  assert.match(pipelineRoute, /registerPipelineVerificationRoutes\(app, deps\);/u);
  assert.match(pipelineRoute, /registerPipelineFilingRoutes\(app, deps\);/u);
  assert.match(pipelineRoute, /registerPipelineAsyncRoutes\(app, deps\);/u);
  assert.doesNotMatch(pipelineRoute, /type RouteDependency = any/u);

  const verificationRoute = readFileSync(
    join(ROUTE_ROOT, 'pipeline-verification-routes.ts'),
    'utf8',
  );
  assert.match(verificationRoute, /export interface PipelineVerificationRoutesDeps/u);
  assert.doesNotMatch(verificationRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(verificationRoute, /:\s*any\b/u);
  assert.doesNotMatch(verificationRoute, /\bas any\b/u);

  const filingRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-filing-routes.ts'), 'utf8');
  assert.match(filingRoute, /export interface PipelineFilingRoutesDeps/u);
  assert.doesNotMatch(filingRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(filingRoute, /:\s*any\b/u);
  assert.doesNotMatch(filingRoute, /\bas any\b/u);

  const asyncRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-async-routes.ts'), 'utf8');
  assert.match(asyncRoute, /export interface PipelineAsyncRoutesDeps/u);
  assert.doesNotMatch(asyncRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(asyncRoute, /:\s*any\b/u);
  assert.doesNotMatch(asyncRoute, /\bas any\b/u);

  const executionRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-execution-routes.ts'), 'utf8');
  assert.match(executionRoute, /export interface PipelineExecutionRoutesDeps/u);
  assert.match(executionRoute, /evaluateFinanceFilingReleaseTarget/u);
  assert.match(executionRoute, /evaluateFinanceCommunicationReleaseTarget/u);
  assert.match(executionRoute, /evaluateFinanceActionReleaseTarget/u);
  assert.match(executionRoute, /buildPipelineRunAutoFilingArtifacts/u);
  assert.doesNotMatch(executionRoute, /type RouteDependency = any/u);
  assert.doesNotMatch(executionRoute, /:\s*any\b/u);
  assert.doesNotMatch(executionRoute, /\bas any\b/u);
}

function testPipelineRoutesDelegateUsageAndDeadLetterUseCases(): void {
  const asyncRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-async-routes.ts'), 'utf8');
  const executionRoute = readFileSync(join(ROUTE_ROOT, 'pipeline-execution-routes.ts'), 'utf8');
  const usageService = readProjectFile('src', 'service', 'application', 'pipeline-usage-service.ts');
  const deadLetterService = readProjectFile('src', 'service', 'application', 'pipeline-dead-letter-service.ts');

  assert.match(asyncRoute, /pipelineUsageService: PipelineUsageService/u);
  assert.match(asyncRoute, /pipelineUsageService\.check/u);
  assert.match(asyncRoute, /pipelineUsageService\.consume/u);
  assert.match(asyncRoute, /pipelineDeadLetterService: PipelineDeadLetterService/u);
  assert.match(asyncRoute, /pipelineDeadLetterService\.record/u);
  assert.doesNotMatch(asyncRoute, /canConsumePipelineRunState/u);
  assert.doesNotMatch(asyncRoute, /consumePipelineRunState/u);
  assert.doesNotMatch(asyncRoute, /upsertAsyncDeadLetterRecordState/u);

  assert.match(executionRoute, /pipelineUsageService: PipelineUsageService/u);
  assert.match(executionRoute, /pipelineUsageService\.check/u);
  assert.match(executionRoute, /pipelineUsageService\.consume/u);
  assert.doesNotMatch(executionRoute, /canConsumePipelineRunState/u);
  assert.doesNotMatch(executionRoute, /consumePipelineRunState/u);

  assert.match(usageService, /export interface PipelineUsageService/u);
  assert.match(usageService, /check\(tenant: PipelineUsageTenant\)/u);
  assert.match(usageService, /consume\(tenant: PipelineUsageTenant\)/u);
  assert.match(deadLetterService, /export interface PipelineDeadLetterService/u);
  assert.match(deadLetterService, /record\(input: AsyncDeadLetterRecord\)/u);
}

testReleaseReviewRouteIsStronglyTyped();
testAllServiceRoutesHaveClosedAnyDebt();
testDirectStoreRouteDebtIsExplicitlyBounded();
testRoutesDoNotExposeLegacyStateFunctionPorts();
testReleaseReviewRouteUsesPublicReleaseLayerTypes();
testReleaseReviewRouteTokenResponseCarriesPolicyProvenance();
testReleaseReviewRouteEvidenceResponseCarriesPolicyContext();
testWebhookRoutesAreSplitByProviderBoundary();
testEmailWebhookRouteDelegatesProviderUseCase();
testStripeWebhookRouteDelegatesIngressUseCase();
testStripeWebhookBillingProcessorUsesNamedEventProcessors();
testAdminRouteIsStronglyTyped();
testAdminRouteDelegatesMutationUseCase();
testAdminRouteDelegatesControlUseCases();
testAdminRouteDelegatesQueryUseCases();
testAdminRouteRequiresSharedDegradedModeGrantStore();
testAccountRouteIsStronglyTyped();
testAccountRouteDelegatesAuthUseCases();
testAccountRouteDelegatesApiKeyUseCases();
testCoreRouteExposesReleaseTokenJwksFromRuntimeKey();
testAccountRouteDelegatesUserManagementUseCases();
testAccountRouteUsesStateServicePort();
testPipelineRoutesAreSplitByUseCaseBoundary();
testPipelineRoutesDelegateUsageAndDeadLetterUseCases();

console.log('Service route boundary tests: 24 passed, 0 failed');
