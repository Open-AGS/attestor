import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
  type ConsequenceFailureControlBinding,
} from './failure-mode-control-bindings.js';

export const CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION =
  'attestor.consequence-multi-agent-delegation-guard.v1';

export const CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS = [
  'human-user',
  'ai-agent',
  'service-account',
  'workflow',
  'tool',
  'unknown',
] as const;
export type ConsequenceMultiAgentDelegationPrincipalKind =
  typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS[number];

export const CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES = [
  'originator',
  'delegator',
  'delegate',
  'executor',
  'approver',
  'auditor',
] as const;
export type ConsequenceMultiAgentDelegationRole =
  typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES[number];

export const CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES = [
  'pass',
  'review',
  'block',
] as const;
export type ConsequenceMultiAgentDelegationOutcome =
  typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES[number];

export const CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES = [
  'delegation-chain-missing',
  'delegation-chain-too-short',
  'delegation-chain-too-deep',
  'delegation-principal-missing',
  'delegation-agent-identity-missing',
  'delegation-authority-missing',
  'delegation-scope-missing',
  'delegation-scope-unapproved',
  'delegation-cycle-detected',
  'delegation-actor-self-approved',
  'delegation-cross-tenant-unscoped',
  'delegation-pass',
  'delegation-review',
  'delegation-block',
] as const;
export type ConsequenceMultiAgentDelegationReasonCode =
  typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES[number];

export interface ConsequenceMultiAgentDelegationPrincipal {
  readonly principalRef: string;
  readonly principalKind: ConsequenceMultiAgentDelegationPrincipalKind;
  readonly role: ConsequenceMultiAgentDelegationRole;
  readonly tenantId?: string | null;
  readonly identityDigest?: string | null;
  readonly authorityDigest?: string | null;
  readonly scopeDigest?: string | null;
  readonly transportBindingDigest?: string | null;
}

export interface EvaluateConsequenceMultiAgentDelegationInput {
  readonly generatedAt?: string | null;
  readonly actionSurface?: string | null;
  readonly action?: string | null;
  readonly principalChain?: readonly ConsequenceMultiAgentDelegationPrincipal[] | null;
  readonly maxDelegationDepth?: number | null;
  readonly requestedDelegatedScopeDigest?: string | null;
  readonly approvedDelegatedScopeDigest?: string | null;
  readonly delegatingAuthorityDigest?: string | null;
}

export interface ConsequenceMultiAgentDelegationObservedPrincipal {
  readonly principalRefDigest: string;
  readonly principalKind: ConsequenceMultiAgentDelegationPrincipalKind;
  readonly role: ConsequenceMultiAgentDelegationRole;
  readonly tenantDigest?: string;
  readonly identityDigestPresent: boolean;
  readonly authorityDigestPresent: boolean;
  readonly scopeDigestPresent: boolean;
  readonly transportBindingDigestPresent: boolean;
}

export interface ConsequenceMultiAgentDelegationDecision {
  readonly version: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION;
  readonly generatedAt: string;
  readonly actionSurface?: string;
  readonly action?: string;
  readonly outcome: ConsequenceMultiAgentDelegationOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly reasonCodes: readonly ConsequenceMultiAgentDelegationReasonCode[];
  readonly failureModeId: 'multi-agent-delegation-confusion';
  readonly invariantIds: readonly [
    'verified-approval-provenance-required',
    'scope-cannot-exceed-approved-boundary',
    'least-privilege-tooling-and-supply-chain-review',
  ];
  readonly protectedPrinciples: readonly [
    'customer authority',
    'fail-closed boundary',
    'auditability',
  ];
  readonly requiredControls: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthoritySources: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly counts: {
    readonly principalCount: number;
    readonly agentPrincipalCount: number;
    readonly missingIdentityCount: number;
    readonly missingAuthorityCount: number;
    readonly missingScopeCount: number;
    readonly distinctTenantCount: number;
  };
  readonly observedPrincipals: readonly ConsequenceMultiAgentDelegationObservedPrincipal[];
  readonly requestedDelegatedScopeDigest?: string;
  readonly approvedDelegatedScopeDigest?: string;
  readonly delegatingAuthorityDigest?: string;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly digestOnly: true;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceMultiAgentDelegationGuardDescriptor {
  readonly version: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION;
  readonly failureModeId: 'multi-agent-delegation-confusion';
  readonly principalKinds: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS;
  readonly roles: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES;
  readonly outcomes: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES;
  readonly reasonCodes: typeof CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES;
  readonly requiresPrincipalChain: true;
  readonly requiresAgentIdentityDigest: true;
  readonly requiresDelegatingAuthorityDigest: true;
  readonly requiresDelegatedScopeDigest: true;
  readonly rejectsSelfApproval: true;
  readonly rejectsCycles: true;
  readonly storesRawPrincipalRefs: false;
  readonly digestOnly: true;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
}

const AGENTIC_PRINCIPAL_KINDS = new Set<ConsequenceMultiAgentDelegationPrincipalKind>([
  'ai-agent',
  'service-account',
  'workflow',
  'tool',
]);

const AUTHORITY_ROLES = new Set<ConsequenceMultiAgentDelegationRole>([
  'delegator',
  'approver',
]);

const SCOPE_ROLES = new Set<ConsequenceMultiAgentDelegationRole>([
  'delegator',
  'delegate',
  'executor',
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

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeMaxDelegationDepth(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return 3;
  return Math.min(value, 10);
}

function failureModeBinding(): ConsequenceFailureControlBinding {
  const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
    item.failureModeId === 'multi-agent-delegation-confusion'
  );
  if (!binding) {
    throw new Error('Missing failure control binding for multi-agent-delegation-confusion.');
  }
  return binding;
}

function observedPrincipal(
  principal: ConsequenceMultiAgentDelegationPrincipal,
): ConsequenceMultiAgentDelegationObservedPrincipal {
  const tenantId = normalizeOptionalString(principal.tenantId);
  return Object.freeze({
    principalRefDigest: digestText(principal.principalRef),
    principalKind: principal.principalKind,
    role: principal.role,
    ...(tenantId ? { tenantDigest: digestText(tenantId) } : {}),
    identityDigestPresent: Boolean(normalizeOptionalString(principal.identityDigest)),
    authorityDigestPresent: Boolean(normalizeOptionalString(principal.authorityDigest)),
    scopeDigestPresent: Boolean(normalizeOptionalString(principal.scopeDigest)),
    transportBindingDigestPresent: Boolean(normalizeOptionalString(principal.transportBindingDigest)),
  });
}

function uniqueReasonCodes(
  items: readonly ConsequenceMultiAgentDelegationReasonCode[],
): readonly ConsequenceMultiAgentDelegationReasonCode[] {
  return Object.freeze([...new Set(items)]);
}

function evaluateOutcome(
  reasonCodes: readonly ConsequenceMultiAgentDelegationReasonCode[],
): ConsequenceMultiAgentDelegationOutcome {
  if (
    reasonCodes.includes('delegation-cycle-detected') ||
    reasonCodes.includes('delegation-actor-self-approved') ||
    reasonCodes.includes('delegation-scope-unapproved')
  ) {
    return 'block';
  }
  if (reasonCodes.length > 0) return 'review';
  return 'pass';
}

export function evaluateConsequenceMultiAgentDelegation(
  input: EvaluateConsequenceMultiAgentDelegationInput = {},
): ConsequenceMultiAgentDelegationDecision {
  const generatedAt = normalizeOptionalString(input.generatedAt) ?? new Date().toISOString();
  const maxDelegationDepth = normalizeMaxDelegationDepth(input.maxDelegationDepth);
  const principalChain = Object.freeze([...(input.principalChain ?? [])]);
  const observedPrincipals = Object.freeze(principalChain.map(observedPrincipal));
  const reasonCodes: ConsequenceMultiAgentDelegationReasonCode[] = [];
  const binding = failureModeBinding();
  const actionSurface = normalizeOptionalString(input.actionSurface);
  const action = normalizeOptionalString(input.action);
  const delegatingAuthorityDigest = normalizeOptionalString(input.delegatingAuthorityDigest);

  if (principalChain.length === 0) reasonCodes.push('delegation-chain-missing');
  if (principalChain.length === 1) reasonCodes.push('delegation-chain-too-short');
  if (principalChain.length > maxDelegationDepth) reasonCodes.push('delegation-chain-too-deep');
  if (principalChain.some((principal) => normalizeOptionalString(principal.principalRef) === null)) {
    reasonCodes.push('delegation-principal-missing');
  }

  const refDigests = observedPrincipals.map((principal) => principal.principalRefDigest);
  if (new Set(refDigests).size !== refDigests.length) {
    reasonCodes.push('delegation-cycle-detected');
  }

  const agentPrincipals = observedPrincipals.filter((principal) =>
    AGENTIC_PRINCIPAL_KINDS.has(principal.principalKind)
  );
  const missingIdentityPrincipals = agentPrincipals.filter(
    (principal) => !principal.identityDigestPresent,
  );
  if (missingIdentityPrincipals.length > 0) reasonCodes.push('delegation-agent-identity-missing');

  const authorityPrincipals = observedPrincipals.filter((principal) =>
    AUTHORITY_ROLES.has(principal.role)
  );
  const missingAuthorityPrincipals = authorityPrincipals.filter(
    (principal) => !principal.authorityDigestPresent,
  );
  if (!delegatingAuthorityDigest) {
    reasonCodes.push('delegation-authority-missing');
  } else if (missingAuthorityPrincipals.length > 0) {
    reasonCodes.push('delegation-authority-missing');
  }

  const scopePrincipals = observedPrincipals.filter((principal) => SCOPE_ROLES.has(principal.role));
  const missingScopePrincipals = scopePrincipals.filter((principal) => !principal.scopeDigestPresent);
  const requestedDelegatedScopeDigest = normalizeOptionalString(input.requestedDelegatedScopeDigest);
  const approvedDelegatedScopeDigest = normalizeOptionalString(input.approvedDelegatedScopeDigest);
  if (!requestedDelegatedScopeDigest || !approvedDelegatedScopeDigest || missingScopePrincipals.length > 0) {
    reasonCodes.push('delegation-scope-missing');
  } else if (requestedDelegatedScopeDigest !== approvedDelegatedScopeDigest) {
    reasonCodes.push('delegation-scope-unapproved');
  }

  const approverRefs = new Set(
    observedPrincipals
      .filter((principal) => principal.role === 'approver')
      .map((principal) => principal.principalRefDigest),
  );
  const executorRefs = new Set(
    observedPrincipals
      .filter((principal) => principal.role === 'executor')
      .map((principal) => principal.principalRefDigest),
  );
  if ([...approverRefs].some((ref) => executorRefs.has(ref))) {
    reasonCodes.push('delegation-actor-self-approved');
  }

  const tenantDigests = observedPrincipals
    .map((principal) => principal.tenantDigest)
    .filter((value): value is string => typeof value === 'string');
  const distinctTenantCount = new Set(tenantDigests).size;
  if (distinctTenantCount > 1 && !approvedDelegatedScopeDigest) {
    reasonCodes.push('delegation-cross-tenant-unscoped');
  }

  const baseReasonCodes = uniqueReasonCodes(reasonCodes);
  const outcome = evaluateOutcome(baseReasonCodes);
  const finalReasonCodes = uniqueReasonCodes([
    ...baseReasonCodes,
    outcome === 'pass'
      ? 'delegation-pass'
      : outcome === 'block'
        ? 'delegation-block'
        : 'delegation-review',
  ]);
  const payload = {
    version: CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION,
    generatedAt,
    ...(actionSurface ? { actionSurface } : {}),
    ...(action ? { action } : {}),
    outcome,
    allowed: outcome === 'pass',
    failClosed: outcome !== 'pass',
    reasonCodes: finalReasonCodes,
    failureModeId: 'multi-agent-delegation-confusion',
    invariantIds: [
      'verified-approval-provenance-required',
      'scope-cannot-exceed-approved-boundary',
      'least-privilege-tooling-and-supply-chain-review',
    ],
    protectedPrinciples: ['customer authority', 'fail-closed boundary', 'auditability'],
    requiredControls: binding.controlIds,
    requiredEvidence: binding.requiredEvidence,
    requiredAuthoritySources: binding.requiredAuthority,
    requiredAuditRecords: binding.requiredAuditRecords,
    counts: {
      principalCount: observedPrincipals.length,
      agentPrincipalCount: agentPrincipals.length,
      missingIdentityCount: missingIdentityPrincipals.length,
      missingAuthorityCount: missingAuthorityPrincipals.length + (delegatingAuthorityDigest ? 0 : 1),
      missingScopeCount: missingScopePrincipals.length + (requestedDelegatedScopeDigest && approvedDelegatedScopeDigest ? 0 : 1),
      distinctTenantCount,
    },
    observedPrincipals,
    ...(requestedDelegatedScopeDigest ? { requestedDelegatedScopeDigest } : {}),
    ...(approvedDelegatedScopeDigest ? { approvedDelegatedScopeDigest } : {}),
    ...(delegatingAuthorityDigest ? { delegatingAuthorityDigest } : {}),
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    digestOnly: true,
    limitation:
      'This guard renders digest-only delegation decisions; inter-agent transport authentication and live downstream enforcement remain customer integration responsibilities.',
  } as const satisfies Omit<ConsequenceMultiAgentDelegationDecision, 'canonical' | 'digest'>;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical,
    digest,
  });
}

export function consequenceMultiAgentDelegationGuardDescriptor(): ConsequenceMultiAgentDelegationGuardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_VERSION,
    failureModeId: 'multi-agent-delegation-confusion',
    principalKinds: CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS,
    roles: CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES,
    outcomes: CONSEQUENCE_MULTI_AGENT_DELEGATION_GUARD_OUTCOMES,
    reasonCodes: CONSEQUENCE_MULTI_AGENT_DELEGATION_REASON_CODES,
    requiresPrincipalChain: true,
    requiresAgentIdentityDigest: true,
    requiresDelegatingAuthorityDigest: true,
    requiresDelegatedScopeDigest: true,
    rejectsSelfApproval: true,
    rejectsCycles: true,
    storesRawPrincipalRefs: false,
    digestOnly: true,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
  });
}
