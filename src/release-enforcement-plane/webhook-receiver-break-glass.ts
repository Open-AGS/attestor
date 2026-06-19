import type {
  EnforcementBreakGlassGrant,
} from './object-model.js';
import type { OfflineReleaseVerification } from './offline-verifier.js';
import type { OnlineReleaseVerification } from './online-verifier.js';
import type { EnforcementFailureReason } from './types.js';
import {
  DEFAULT_WEBHOOK_BREAK_GLASS_FAILURE_REASONS,
  DEFAULT_WEBHOOK_BREAK_GLASS_MAX_TTL_SECONDS,
  type ReleaseWebhookReceiverOptions,
} from './webhook-receiver-types.js';

export function activeBreakGlassGrant(
  grant: EnforcementBreakGlassGrant | null | undefined,
  checkedAt: string,
  maxTtlSeconds = DEFAULT_WEBHOOK_BREAK_GLASS_MAX_TTL_SECONDS,
): EnforcementBreakGlassGrant | null {
  if (!grant) {
    return null;
  }
  if (!Number.isInteger(maxTtlSeconds) || maxTtlSeconds <= 0) {
    return null;
  }
  const nowMs = new Date(checkedAt).getTime();
  const authorizedAtMs = new Date(grant.authorizedAt).getTime();
  const expiresAtMs = new Date(grant.expiresAt).getTime();
  if (
    Number.isNaN(authorizedAtMs) ||
    Number.isNaN(expiresAtMs) ||
    authorizedAtMs > nowMs ||
    expiresAtMs <= nowMs
  ) {
    return null;
  }
  if (expiresAtMs - authorizedAtMs > maxTtlSeconds * 1000) {
    return null;
  }
  return grant;
}

export function breakGlassAllowedFailures(options: ReleaseWebhookReceiverOptions): ReadonlySet<EnforcementFailureReason> {
  return new Set(options.breakGlassAllowedFailureReasons ?? DEFAULT_WEBHOOK_BREAK_GLASS_FAILURE_REASONS);
}

export function canUseBreakGlass(input: {
  readonly online: OnlineReleaseVerification | null;
  readonly offline: OfflineReleaseVerification | null;
  readonly failureReasons: readonly EnforcementFailureReason[];
  readonly options: ReleaseWebhookReceiverOptions;
}): boolean {
  const offline = input.online?.offline ?? input.offline;
  if (!offline || !offline.offlineVerified || offline.profile.overridePosture === 'not-allowed') {
    return false;
  }

  const allowed = breakGlassAllowedFailures(input.options);
  return input.failureReasons.length > 0 && input.failureReasons.every((reason) => allowed.has(reason));
}
