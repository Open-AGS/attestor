import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  type ConsequenceAdmissionDomain,
} from './taxonomy.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  PolicyDiscoveryControlClosure,
  ShadowPolicyDiscoveryCandidate,
  ShadowPolicyDiscoveryCandidates,
} from './policy-discovery-candidates.js';

export const POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION =
  'attestor.policy-foundry-candidate-registry.v1';

export const POLICY_FOUNDRY_CANDIDATE_SCHEMA_STATUSES = [
  'schema-bound',
  'needs-template',
  'blocked',
] as const;
export type PolicyFoundryCandidateSchemaStatus =
  typeof POLICY_FOUNDRY_CANDIDATE_SCHEMA_STATUSES[number];

export const POLICY_FOUNDRY_CANDIDATE_SCHEMA_KINDS = [
  'domain-template',
  'custom-template-required',
] as const;
export type PolicyFoundryCandidateSchemaKind =
  typeof POLICY_FOUNDRY_CANDIDATE_SCHEMA_KINDS[number];

export interface CreatePolicyFoundryCandidateRegistryInput {
  readonly candidates: ShadowPolicyDiscoveryCandidates | null;
  readonly generatedAt?: string | null;
}

export interface PolicyFoundryDomainTemplate {
  readonly domain: ConsequenceAdmissionDomain;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly schemaKind: PolicyFoundryCandidateSchemaKind;
  readonly requiredAttributes: readonly string[];
}

export interface PolicyFoundryRegisteredCandidate {
  readonly candidateId: string;
  readonly sourceCandidateDigest: string;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly schemaStatus: PolicyFoundryCandidateSchemaStatus;
  readonly templateId: string | null;
  readonly templateVersion: string | null;
  readonly schemaKind: PolicyFoundryCandidateSchemaKind;
  readonly proposedMode: ShadowPolicyDiscoveryCandidate['proposedMode'];
  readonly requiredControls: readonly PolicyDiscoveryControlClosure[];
  readonly requiredAttributes: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly noGoReasons: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly llmThresholdAuthorityAllowed: false;
  readonly thresholdAuthority: 'schema-or-customer-policy' | 'not-bound';
}

export interface PolicyFoundryCandidateRegistry {
  readonly version: typeof POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION;
  readonly generatedAt: string;
  readonly sourceCandidateBundleDigest: string | null;
  readonly candidateCount: number;
  readonly schemaBoundCount: number;
  readonly needsTemplateCount: number;
  readonly blockedCount: number;
  readonly candidates: readonly PolicyFoundryRegisteredCandidate[];
  readonly supportedTemplates: readonly PolicyFoundryDomainTemplate[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly llmThresholdAuthorityAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-candidate-registry';
  readonly canonical: string;
  readonly digest: string;
}

export interface PolicyFoundryCandidateRegistryDescriptor {
  readonly version: typeof POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION;
  readonly schemaStatuses: typeof POLICY_FOUNDRY_CANDIDATE_SCHEMA_STATUSES;
  readonly schemaKinds: typeof POLICY_FOUNDRY_CANDIDATE_SCHEMA_KINDS;
  readonly supportedTemplates: readonly PolicyFoundryDomainTemplate[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly llmThresholdAuthorityAllowed: false;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly dataMinimizationSurfaceKind: 'policy-foundry-candidate-registry';
}

function template(
  domain: ConsequenceAdmissionDomain,
  templateId: string,
  requiredAttributes: readonly string[],
): PolicyFoundryDomainTemplate {
  return Object.freeze({
    domain,
    templateId,
    templateVersion: 'v1',
    schemaKind: domain === 'custom' ? 'custom-template-required' : 'domain-template',
    requiredAttributes: Object.freeze([...requiredAttributes]),
  });
}

const COMMON_REQUIRED_ATTRIBUTES = [
  'tenantDigest',
  'actorDigest',
  'actionSurface',
  'downstreamSystem',
  'requestedAt',
  'policyRef',
  'authorityRef',
  'evidenceRefs',
  'idempotencyKeyDigest',
] as const;

export const POLICY_FOUNDRY_DOMAIN_TEMPLATES: readonly PolicyFoundryDomainTemplate[] =
Object.freeze([
  template('financial-record', 'financial-record.reviewed-record.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'sourceReportDigest',
    'reviewerRole',
  ]),
  template('money-movement', 'money-movement.refund-or-payment-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'amountBand',
    'currency',
    'paymentEvidenceRef',
  ]),
  template('programmable-money', 'programmable-money.wallet-action-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'walletActionKind',
    'chainId',
    'simulationDigest',
  ]),
  template('data-disclosure', 'data-disclosure.export-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'dataClass',
    'recipientClass',
    'minimizationRef',
  ]),
  template('authority-change', 'authority-change.delegation-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'targetRole',
    'delegationScope',
    'approverRef',
  ]),
  template('external-communication', 'external-communication.customer-message-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'recipientClass',
    'messageClass',
    'reviewQueueRef',
  ]),
  template('regulated-filing', 'regulated-filing.submission-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'filingType',
    'jurisdiction',
    'reviewerRole',
  ]),
  template('system-operation', 'system-operation.change-safety.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'environment',
    'changeTicketRef',
    'rollbackRef',
  ]),
  template('decision-support', 'decision-support.no-execute-review.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'decisionContextRef',
    'humanReviewPath',
  ]),
  template('custom', 'custom.customer-template-required.v1', [
    ...COMMON_REQUIRED_ATTRIBUTES,
    'customerTemplateRef',
  ]),
]);

const TEMPLATE_BY_DOMAIN: ReadonlyMap<string, PolicyFoundryDomainTemplate> =
  new Map(POLICY_FOUNDRY_DOMAIN_TEMPLATES.map((item) => [item.domain, item]));

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

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Policy Foundry candidate registry ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function sourceCandidateDigest(candidate: ShadowPolicyDiscoveryCandidate): string {
  return canonicalObject({
    candidateId: candidate.candidateId,
    actionSurface: candidate.actionSurface,
    domain: candidate.domain,
    action: candidate.action,
    proposedMode: candidate.proposedMode,
    requiredControls: candidate.requiredControls,
    sourceRecommendationKinds: candidate.sourceRecommendationKinds,
    reasonCodes: candidate.reasonCodes,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

function domainTemplate(domain: string | null): PolicyFoundryDomainTemplate | null {
  if (domain === null) return null;
  const normalized = (CONSEQUENCE_ADMISSION_DOMAINS as readonly string[]).includes(domain)
    ? domain
    : 'custom';
  return TEMPLATE_BY_DOMAIN.get(normalized) ?? null;
}

function noGoReasonsFor(input: {
  readonly candidate: ShadowPolicyDiscoveryCandidate;
  readonly template: PolicyFoundryDomainTemplate | null;
}): readonly string[] {
  const reasons = new Set<string>();
  if (input.candidate.actionSurface === null) reasons.add('action-surface-missing');
  if (input.template === null) reasons.add('domain-template-missing');
  if (input.template?.schemaKind === 'custom-template-required') {
    reasons.add('custom-domain-template-required');
  }
  if (
    input.candidate.reasonCodes.some((reason) =>
      reason.toLowerCase().includes('llm') ||
      reason.toLowerCase().includes('threshold')
    )
  ) {
    reasons.add('llm-threshold-authority-disallowed');
  }
  return Object.freeze([...reasons].sort());
}

function schemaStatus(noGoReasons: readonly string[]): PolicyFoundryCandidateSchemaStatus {
  if (noGoReasons.includes('action-surface-missing')) return 'blocked';
  if (
    noGoReasons.includes('custom-domain-template-required') ||
    noGoReasons.includes('domain-template-missing')
  ) {
    return 'needs-template';
  }
  return 'schema-bound';
}

function registerCandidate(
  candidate: ShadowPolicyDiscoveryCandidate,
): PolicyFoundryRegisteredCandidate {
  const template = domainTemplate(candidate.domain);
  const noGoReasons = noGoReasonsFor({ candidate, template });
  const status = schemaStatus(noGoReasons);
  return Object.freeze({
    candidateId: candidate.candidateId,
    sourceCandidateDigest: sourceCandidateDigest(candidate),
    actionSurface: candidate.actionSurface,
    domain: candidate.domain,
    schemaStatus: status,
    templateId: status === 'schema-bound' ? template?.templateId ?? null : null,
    templateVersion: status === 'schema-bound' ? template?.templateVersion ?? null : null,
    schemaKind: template?.schemaKind ?? 'custom-template-required',
    proposedMode: candidate.proposedMode,
    requiredControls: candidate.requiredControls,
    requiredAttributes: template?.requiredAttributes ?? Object.freeze([...COMMON_REQUIRED_ATTRIBUTES]),
    reasonCodes: candidate.reasonCodes,
    noGoReasons,
    approvalRequired: true,
    autoEnforce: false,
    llmThresholdAuthorityAllowed: false,
    thresholdAuthority: status === 'schema-bound' ? 'schema-or-customer-policy' : 'not-bound',
  });
}

export function createPolicyFoundryCandidateRegistry(
  input: CreatePolicyFoundryCandidateRegistryInput,
): PolicyFoundryCandidateRegistry {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const registered = Object.freeze(
    (input.candidates?.candidates ?? [])
      .map(registerCandidate)
      .sort((left, right) =>
        left.schemaStatus.localeCompare(right.schemaStatus) ||
        (left.actionSurface ?? '').localeCompare(right.actionSurface ?? '')
      ),
  );
  const payload = {
    version: POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION as typeof POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION,
    generatedAt,
    sourceCandidateBundleDigest: input.candidates?.digest ?? null,
    candidateCount: registered.length,
    schemaBoundCount: registered.filter((candidate) => candidate.schemaStatus === 'schema-bound').length,
    needsTemplateCount: registered.filter((candidate) => candidate.schemaStatus === 'needs-template').length,
    blockedCount: registered.filter((candidate) => candidate.schemaStatus === 'blocked').length,
    candidates: registered,
    supportedTemplates: POLICY_FOUNDRY_DOMAIN_TEMPLATES,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    activatesEnforcement: false as const,
    llmThresholdAuthorityAllowed: false as const,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION as typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-candidate-registry' as const,
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function policyFoundryCandidateRegistryDescriptor(): PolicyFoundryCandidateRegistryDescriptor {
  return Object.freeze({
    version: POLICY_FOUNDRY_CANDIDATE_REGISTRY_VERSION,
    schemaStatuses: POLICY_FOUNDRY_CANDIDATE_SCHEMA_STATUSES,
    schemaKinds: POLICY_FOUNDRY_CANDIDATE_SCHEMA_KINDS,
    supportedTemplates: POLICY_FOUNDRY_DOMAIN_TEMPLATES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    activatesEnforcement: false,
    llmThresholdAuthorityAllowed: false,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    dataMinimizationSurfaceKind: 'policy-foundry-candidate-registry',
  });
}
