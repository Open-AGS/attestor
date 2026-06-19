import type { EnforcementFailureReason } from './types.js';
import type { HttpMessageForSignature } from './http-message-signatures-types.js';
import {
  contentDigestForBody,
  epochSeconds,
  normalizeComponentName,
  normalizeHttpMessageHeaders,
  uniqueFailureReasons,
} from './http-message-signatures-utils.js';
import {
  timingSafeStringEqual,
} from './http-message-signatures-crypto.js';

export function timeFailureReasons(input: {
  readonly created: number | null;
  readonly expires: number | null;
  readonly now: string;
  readonly maxAgeSeconds: number;
  readonly clockSkewSeconds: number;
}): readonly EnforcementFailureReason[] {
  const reasons: EnforcementFailureReason[] = [];
  const now = epochSeconds(input.now);

  if (input.created === null) {
    reasons.push('invalid-signature');
  } else {
    if (input.created > now + input.clockSkewSeconds) {
      reasons.push('future-issued-at');
    }
    if (now - input.created > input.maxAgeSeconds + input.clockSkewSeconds) {
      reasons.push('stale-authorization');
    }
  }

  if (input.expires !== null && now - input.clockSkewSeconds >= input.expires) {
    reasons.push('expired-authorization');
  }

  return uniqueFailureReasons(reasons);
}

export function coverageFailureReasons(input: {
  readonly coveredComponents: readonly string[];
  readonly requiredCoveredComponents: readonly string[];
}): readonly EnforcementFailureReason[] {
  if (input.requiredCoveredComponents.length === 0) {
    return ['binding-mismatch'];
  }
  const covered = new Set(input.coveredComponents.map(normalizeComponentName));
  const missing = input.requiredCoveredComponents
    .map(normalizeComponentName)
    .some((component) => !covered.has(component));
  return missing ? ['binding-mismatch'] : [];
}

export function contentDigestFailureReasons(message: HttpMessageForSignature): readonly EnforcementFailureReason[] {
  const headers = normalizeHttpMessageHeaders(message.headers);
  const received = headers['content-digest'];
  if (received === undefined) {
    return ['binding-mismatch'];
  }
  return timingSafeStringEqual(received, contentDigestForBody(message.body))
    ? []
    : ['binding-mismatch'];
}
