import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_STALE_AUTHORITY_POLICY_GUARD_VERSION =
  'attestor.consequence-stale-authority-policy-guard.v1';

export const CONSEQUENCE_STALE_AUTHORITY_POLICY_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceStaleAuthorityPolicyOutcome =
  typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_OUTCOMES[number];

export const CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES = [
  'clean',
  'watch',
  'debt-detected',
  'no-go',
] as const;
export type ConsequenceStaleAuthorityPolicyDriftState =
  typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES[number];

export const CONSEQUENCE_STALE_AUTHORITY_POLICY_REASON_CODES = [
  'policy-version-missing',
  'current-policy-version-missing',
  'policy-version-mismatch',
  'policy-superseded',
  'policy-updated-after-approval',
  'approval-validity-window-missing',
  'approval-issued-at-missing',
  'approval-issued-at-invalid',
  'approval-not-yet-valid',
  'approval-expired',
  'authority-freshness-missing',
  'authority-freshness-invalid',
  'authority-freshness-too-old',
  'authority-expires-at-invalid',
  'authority-expired',
  'drift-state-review',
  'drift-state-block',
  'no-go-reason-present',
  'stale-policy-pass',
  'stale-policy-review',
  'stale-policy-block',
] as const;
export type ConsequenceStaleAuthorityPolicyReasonCode =
  typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_REASON_CODES[number];

export interface EvaluateConsequenceStaleAuthorityPolicyInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly policyVersion?: string | null;
  readonly currentPolicyVersion?: string | null;
  readonly policyDigest?: string | null;
  readonly currentPolicyDigest?: string | null;
  readonly policyUpdatedAt?: string | null;
  readonly policySupersededAt?: string | null;
  readonly approvalIssuedAt?: string | null;
  readonly approvalValidFrom?: string | null;
  readonly approvalValidUntil?: string | null;
  readonly authorityCheckedAt?: string | null;
  readonly authorityExpiresAt?: string | null;
  readonly maxAuthorityAgeSeconds?: number | null;
  readonly driftState?: ConsequenceStaleAuthorityPolicyDriftState | null;
  readonly noGoReasons?: readonly string[] | null;
}

export interface ConsequenceStaleAuthorityPolicyDecision {
  readonly version: typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly outcome: ConsequenceStaleAuthorityPolicyOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceStaleAuthorityPolicyReasonCode[];
  readonly failureModeId: 'stale-authority-or-policy';
  readonly invariantIds: readonly [
    'decision-context-version-must-be-bound',
    'verified-approval-provenance-required',
    'no-go-hold-overrides-natural-language',
  ];
  readonly protectedPrinciples: readonly [
    'customer authority',
    'runtime readiness',
    'fail-closed boundary',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly observed: {
    readonly policyVersionDigest?: string;
    readonly currentPolicyVersionDigest?: string;
    readonly policyDigest?: string;
    readonly currentPolicyDigest?: string;
    readonly policyUpdatedAt?: string;
    readonly policySupersededAt?: string;
    readonly approvalIssuedAt?: string;
    readonly approvalValidFrom?: string;
    readonly approvalValidUntil?: string;
    readonly authorityCheckedAt?: string;
    readonly authorityExpiresAt?: string;
    readonly maxAuthorityAgeSeconds: number;
    readonly driftState: ConsequenceStaleAuthorityPolicyDriftState;
    readonly noGoReasonDigests: readonly string[];
  };
  readonly counts: {
    readonly noGoReasonCount: number;
    readonly blockReasonCount: number;
    readonly reviewReasonCount: number;
  };
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceStaleAuthorityPolicyGuardDescriptor {
  readonly version: typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_GUARD_VERSION;
  readonly failureModeId: 'stale-authority-or-policy';
  readonly outcomes: typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_OUTCOMES;
  readonly driftStates: typeof CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES;
  readonly requiresPolicyVersion: true;
  readonly requiresCurrentPolicyVersion: true;
  readonly requiresApprovalValidityWindow: true;
  readonly requiresAuthorityFreshness: true;
  readonly blocksNoGo: true;
  readonly blocksExpiredApproval: true;
  readonly blocksPolicyMismatch: true;
  readonly storesRawPolicyOrAuthorityRefs: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const DEFAULT_MAX_AUTHORITY_AGE_SECONDS = 300;

const BLOCK_REASON_CODES = new Set<ConsequenceStaleAuthorityPolicyReasonCode>([
  'policy-version-mismatch',
  'policy-superseded',
  'policy-updated-after-approval',
  'approval-expired',
  'authority-expired',
  'drift-state-block',
  'no-go-reason-present',
]);

const REVIEW_REASON_CODES = new Set<ConsequenceStaleAuthorityPolicyReasonCode>([
  'policy-version-missing',
  'current-policy-version-missing',
  'approval-validity-window-missing',
  'approval-issued-at-missing',
  'approval-issued-at-invalid',
  'approval-not-yet-valid',
  'authority-freshness-missing',
  'authority-freshness-invalid',
  'authority-freshness-too-old',
  'authority-expires-at-invalid',
  'drift-state-review',
]);

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueReasonCodes(
  items: readonly ConsequenceStaleAuthorityPolicyReasonCode[],
): readonly ConsequenceStaleAuthorityPolicyReasonCode[] {
  return readonlyCopy([...new Set(items)]);
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function ageSeconds(now: string, past: string): number {
  return Math.max(0, Math.floor((new Date(now).getTime() - new Date(past).getTime()) / 1000));
}

function binding(): ConsequenceFailureControlBinding {
  const found = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find(
    (item) => item.failureModeId === 'stale-authority-or-policy',
  );
  if (!found) {
    throw new Error('Missing control binding for stale-authority-or-policy.');
  }
  return found;
}

function effectiveMaxAuthorityAgeSeconds(value: number | null | undefined): number {
  const raw = value ?? DEFAULT_MAX_AUTHORITY_AGE_SECONDS;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_AUTHORITY_AGE_SECONDS;
  return Math.floor(raw);
}

export function evaluateConsequenceStaleAuthorityPolicy(
  input: EvaluateConsequenceStaleAuthorityPolicyInput,
): ConsequenceStaleAuthorityPolicyDecision {
  const generatedAt = normalizeTimestamp(input.generatedAt ?? null) ?? new Date(0).toISOString();
  const policyUpdatedAt = normalizeTimestamp(input.policyUpdatedAt ?? null);
  const policySupersededAt = normalizeTimestamp(input.policySupersededAt ?? null);
  const approvalIssuedAt = normalizeTimestamp(input.approvalIssuedAt ?? null);
  const approvalValidFrom = normalizeTimestamp(input.approvalValidFrom ?? null);
  const approvalValidUntil = normalizeTimestamp(input.approvalValidUntil ?? null);
  const authorityCheckedAt = normalizeTimestamp(input.authorityCheckedAt ?? null);
  const authorityExpiresAt = normalizeTimestamp(input.authorityExpiresAt ?? null);
  const maxAuthorityAgeSeconds = effectiveMaxAuthorityAgeSeconds(input.maxAuthorityAgeSeconds);
  const driftState = input.driftState ?? 'clean';
  const noGoReasons = readonlyCopy(input.noGoReasons ?? []);
  const reasonCodes: ConsequenceStaleAuthorityPolicyReasonCode[] = [];

  if (!input.policyVersion) reasonCodes.push('policy-version-missing');
  if (!input.currentPolicyVersion) reasonCodes.push('current-policy-version-missing');
  if (input.policyVersion && input.currentPolicyVersion && input.policyVersion !== input.currentPolicyVersion) {
    reasonCodes.push('policy-version-mismatch');
  }
  if (
    input.policyDigest &&
    input.currentPolicyDigest &&
    input.policyDigest !== input.currentPolicyDigest
  ) {
    reasonCodes.push('policy-version-mismatch');
  }
  if (input.policySupersededAt && !policySupersededAt) reasonCodes.push('policy-superseded');
  if (policySupersededAt && new Date(policySupersededAt).getTime() <= new Date(generatedAt).getTime()) {
    reasonCodes.push('policy-superseded');
  }
  if (policyUpdatedAt && approvalIssuedAt && new Date(policyUpdatedAt).getTime() > new Date(approvalIssuedAt).getTime()) {
    reasonCodes.push('policy-updated-after-approval');
  }

  if (!input.approvalIssuedAt) reasonCodes.push('approval-issued-at-missing');
  if (input.approvalIssuedAt && !approvalIssuedAt) reasonCodes.push('approval-issued-at-invalid');
  if (!approvalValidFrom || !approvalValidUntil) reasonCodes.push('approval-validity-window-missing');
  if (approvalValidFrom && new Date(approvalValidFrom).getTime() > new Date(generatedAt).getTime()) {
    reasonCodes.push('approval-not-yet-valid');
  }
  if (approvalValidUntil && new Date(approvalValidUntil).getTime() <= new Date(generatedAt).getTime()) {
    reasonCodes.push('approval-expired');
  }

  if (!input.authorityCheckedAt) reasonCodes.push('authority-freshness-missing');
  if (input.authorityCheckedAt && !authorityCheckedAt) reasonCodes.push('authority-freshness-invalid');
  if (authorityCheckedAt && ageSeconds(generatedAt, authorityCheckedAt) > maxAuthorityAgeSeconds) {
    reasonCodes.push('authority-freshness-too-old');
  }
  if (input.authorityExpiresAt && !authorityExpiresAt) reasonCodes.push('authority-expires-at-invalid');
  if (authorityExpiresAt && new Date(authorityExpiresAt).getTime() <= new Date(generatedAt).getTime()) {
    reasonCodes.push('authority-expired');
  }

  if (driftState === 'watch' || driftState === 'debt-detected') {
    reasonCodes.push('drift-state-review');
  }
  if (driftState === 'no-go') {
    reasonCodes.push('drift-state-block');
  }
  if (noGoReasons.length > 0) {
    reasonCodes.push('no-go-reason-present');
  }

  const uniqueCodes = uniqueReasonCodes(reasonCodes);
  const hasBlock = uniqueCodes.some((code) => BLOCK_REASON_CODES.has(code));
  const hasReview = uniqueCodes.some((code) => REVIEW_REASON_CODES.has(code));
  const outcome: ConsequenceStaleAuthorityPolicyOutcome = hasBlock
    ? 'block'
    : hasReview
      ? 'review'
      : 'pass';
  const finalReasonCodes = uniqueReasonCodes([
    ...uniqueCodes,
    outcome === 'block'
      ? 'stale-policy-block'
      : outcome === 'review'
        ? 'stale-policy-review'
        : 'stale-policy-pass',
  ]);
  const controlBinding = binding();
  const payload = {
    version: CONSEQUENCE_STALE_AUTHORITY_POLICY_GUARD_VERSION,
    generatedAt,
    ...(input.actionSurface ? { actionSurface: input.actionSurface } : {}),
    ...(input.action ? { action: input.action } : {}),
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes: finalReasonCodes,
    failureModeId: 'stale-authority-or-policy',
    invariantIds: [
      'decision-context-version-must-be-bound',
      'verified-approval-provenance-required',
      'no-go-hold-overrides-natural-language',
    ] as const,
    protectedPrinciples: [
      'customer authority',
      'runtime readiness',
      'fail-closed boundary',
    ] as const,
    requiredControls: controlBinding.controlIds,
    requiredEvidence: controlBinding.requiredEvidence,
    requiredAuthoritySources: controlBinding.requiredAuthority,
    requiredAuditRecords: controlBinding.requiredAuditRecords,
    observed: {
      ...(input.policyVersion ? { policyVersionDigest: digestText(input.policyVersion) } : {}),
      ...(input.currentPolicyVersion
        ? { currentPolicyVersionDigest: digestText(input.currentPolicyVersion) }
        : {}),
      ...(input.policyDigest ? { policyDigest: input.policyDigest } : {}),
      ...(input.currentPolicyDigest ? { currentPolicyDigest: input.currentPolicyDigest } : {}),
      ...(policyUpdatedAt ? { policyUpdatedAt } : {}),
      ...(policySupersededAt ? { policySupersededAt } : {}),
      ...(approvalIssuedAt ? { approvalIssuedAt } : {}),
      ...(approvalValidFrom ? { approvalValidFrom } : {}),
      ...(approvalValidUntil ? { approvalValidUntil } : {}),
      ...(authorityCheckedAt ? { authorityCheckedAt } : {}),
      ...(authorityExpiresAt ? { authorityExpiresAt } : {}),
      maxAuthorityAgeSeconds,
      driftState,
      noGoReasonDigests: readonlyCopy(noGoReasons.map((reason) => digestText(reason))),
    },
    counts: {
      noGoReasonCount: noGoReasons.length,
      blockReasonCount: finalReasonCodes.filter((code) => BLOCK_REASON_CODES.has(code)).length,
      reviewReasonCount: finalReasonCodes.filter((code) => REVIEW_REASON_CODES.has(code)).length,
    },
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    limitation:
      'This guard classifies stale policy and authority context. It does not prove customer policy stores, IdP checks, approval workflows, or downstream verifiers are wired to the latest source-of-truth state.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceStaleAuthorityPolicyGuardDescriptor(): ConsequenceStaleAuthorityPolicyGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_STALE_AUTHORITY_POLICY_GUARD_VERSION,
    failureModeId: 'stale-authority-or-policy',
    outcomes: CONSEQUENCE_STALE_AUTHORITY_POLICY_OUTCOMES,
    driftStates: CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES,
    requiresPolicyVersion: true,
    requiresCurrentPolicyVersion: true,
    requiresApprovalValidityWindow: true,
    requiresAuthorityFreshness: true,
    blocksNoGo: true,
    blocksExpiredApproval: true,
    blocksPolicyMismatch: true,
    storesRawPolicyOrAuthorityRefs: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
