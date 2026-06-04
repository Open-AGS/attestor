import {
  createHash,
} from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionCorrectionCatalog,
  ConsequenceAdmissionCorrectionCatalogEntry,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionFeedback,
  ConsequenceAdmissionFeedbackDisclosureLevel,
  ConsequenceAdmissionRetryBudgetEvaluation,
  ConsequenceAdmissionRetryGuidance,
  EvaluateConsequenceAdmissionRetryBudgetInput,
  GenericAdmissionMode,
} from './contracts.js';
import {
  CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
  CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
  CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
  GENERIC_ADMISSION_MODES,
} from './contracts.js';

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Consequence admission ${fieldName} must not be empty.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Consequence admission ${fieldName} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function readonlyCopy<T>(items: readonly T[] | null | undefined): readonly T[] {
  return Object.freeze([...(items ?? [])]);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Consequence admission ${fieldName} must be a positive integer.`);
  }
  return value;
}

export const CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES:
readonly ConsequenceAdmissionCorrectionCatalogEntry[] = Object.freeze([
  {
    reasonCode: 'policy-ref-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['policyRef'],
    requiredEvidenceKinds: ['policy_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Attach a bounded policy reference accepted by the customer environment.',
  },
  {
    reasonCode: 'evidence-ref-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['evidenceRefs'],
    requiredEvidenceKinds: ['evidence_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Attach evidence references instead of raw customer or private data.',
  },
  {
    reasonCode: 'amount-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['amount'],
    requiredEvidenceKinds: [],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide the proposed amount scope as structured metadata.',
  },
  {
    reasonCode: 'recipient-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['recipient'],
    requiredEvidenceKinds: [],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide a bounded recipient reference for the proposed consequence.',
  },
  {
    reasonCode: 'data-scope-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['dataScope'],
    requiredEvidenceKinds: ['data_scope_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide data scope metadata such as classification, fields, or record bounds.',
  },
  {
    reasonCode: 'authority-mode-missing',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: ['authorityMode'],
    requiredEvidenceKinds: ['authority_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Provide the customer-approved authority mode or authority reference.',
  },
  {
    reasonCode: 'guard-input-provenance-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance'],
    requiredEvidenceKinds: ['guard_input_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Required guard input provenance must come from a trusted customer, operator, or Attestor runtime boundary.',
  },
  {
    reasonCode: 'guard-input-source-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.sourceClass'],
    requiredEvidenceKinds: ['trusted_guard_input_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Caller-supplied, model-generated, or unverified tool output cannot satisfy guard input provenance.',
  },
  {
    reasonCode: 'guard-input-digest-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.sourceDigest'],
    requiredEvidenceKinds: ['guard_input_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Guard input provenance must bind to digest material instead of raw guard inputs.',
  },
  {
    reasonCode: 'guard-input-timestamp-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.recordedAt'],
    requiredEvidenceKinds: ['guard_input_freshness_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Guard input provenance must include a freshness timestamp.',
  },
  {
    reasonCode: 'guard-input-tenant-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.tenantId'],
    requiredEvidenceKinds: ['guard_input_tenant_binding_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Guard input provenance must bind to the tenant boundary.',
  },
  {
    reasonCode: 'guard-input-authority-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.sourceClass'],
    requiredEvidenceKinds: ['trusted_guard_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted guard input cannot satisfy authority checks.',
  },
  {
    reasonCode: 'guard-input-policy-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.sourceClass'],
    requiredEvidenceKinds: ['trusted_guard_policy_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted guard input cannot satisfy policy checks.',
  },
  {
    reasonCode: 'guard-input-evidence-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance.sourceClass'],
    requiredEvidenceKinds: ['trusted_guard_evidence_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted guard input cannot satisfy evidence checks without customer or operator review.',
  },
  {
    reasonCode: 'guard-input-review',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance'],
    requiredEvidenceKinds: ['guard_input_review_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Guard input provenance is incomplete and must be reviewed before execution.',
  },
  {
    reasonCode: 'guard-input-block',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['guardInputProvenance'],
    requiredEvidenceKinds: ['trusted_guard_input_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Guard input provenance failed closed.',
  },
  {
    reasonCode: 'authority-source-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A trusted authority source must be supplied by the customer gateway, operator workflow, or trusted authority record.',
  },
  {
    reasonCode: 'untrusted-content-authority-source',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted content cannot authorize the proposed consequence.',
  },
  {
    reasonCode: 'model-generated-authority-source',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Model-generated text cannot be used as authority for the proposed consequence.',
  },
  {
    reasonCode: 'trust-class-override-rejected',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources.trustClass'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A source cannot self-promote from untrusted content into trusted authority.',
  },
  {
    reasonCode: 'trusted-authority-evidence-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources.evidenceDigest'],
    requiredEvidenceKinds: ['trusted_authority_evidence_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Trusted authority sources must include evidence digest material.',
  },
  {
    reasonCode: 'trusted-evidence-not-authority',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Trusted evidence can support a decision, but it does not grant authority by itself.',
  },
  {
    reasonCode: 'mixed-trusted-and-untrusted-authority-source',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Mixed trusted and untrusted authority claims require customer or operator review.',
  },
  {
    reasonCode: 'authority-review-required',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Authority provenance is incomplete and must be reviewed before execution.',
  },
  {
    reasonCode: 'authority-block',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['authoritySources'],
    requiredEvidenceKinds: ['trusted_authority_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Authority provenance failed closed.',
  },
  {
    reasonCode: 'approval-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance is required when approval is used as authority.',
  },
  {
    reasonCode: 'approval-source-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.sourceRef'],
    requiredEvidenceKinds: ['approval_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must name the source system or workflow reference.',
  },
  {
    reasonCode: 'approval-source-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['trusted_approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted content cannot be treated as approval.',
  },
  {
    reasonCode: 'approval-model-generated',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['trusted_approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Model-generated text cannot be used as approval.',
  },
  {
    reasonCode: 'approval-tool-output-unverified',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['verified_tool_approval_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Tool output must be verified before it can support approval provenance.',
  },
  {
    reasonCode: 'approval-state-not-approved',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.state'],
    requiredEvidenceKinds: ['approved_state_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance has not reached an approved state.',
  },
  {
    reasonCode: 'approval-state-rejected-or-revoked',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.state'],
    requiredEvidenceKinds: ['active_approval_state_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Rejected or revoked approvals fail closed.',
  },
  {
    reasonCode: 'reviewer-identity-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.reviewerRef'],
    requiredEvidenceKinds: ['reviewer_identity_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must bind to a reviewer identity.',
  },
  {
    reasonCode: 'reviewer-authority-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.reviewerAuthorityDigest'],
    requiredEvidenceKinds: ['reviewer_authority_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must bind the reviewer authority evidence.',
  },
  {
    reasonCode: 'approval-digest-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.approvalDigest'],
    requiredEvidenceKinds: ['approval_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must carry a digest of the approval record.',
  },
  {
    reasonCode: 'approval-scope-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.scopeDigest'],
    requiredEvidenceKinds: ['approval_scope_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must bind the approved scope.',
  },
  {
    reasonCode: 'approval-issued-at-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.issuedAt'],
    requiredEvidenceKinds: ['approval_issued_at'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance must include an issued-at timestamp.',
  },
  {
    reasonCode: 'approval-issued-at-invalid',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.issuedAt'],
    requiredEvidenceKinds: ['approval_issued_at'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval issued-at timestamp must be valid.',
  },
  {
    reasonCode: 'approval-expired',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.expiresAt'],
    requiredEvidenceKinds: ['fresh_approval_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Expired approvals fail closed or require review.',
  },
  {
    reasonCode: 'approval-step-up-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.stepUpVerified'],
    requiredEvidenceKinds: ['step_up_approval_proof'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Step-up approval evidence is missing.',
  },
  {
    reasonCode: 'approval-signature-unverified',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.signatureVerificationInput'],
    requiredEvidenceKinds: ['signed_approval_verification'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Signed approval provenance must verify against the configured trust binding.',
  },
  {
    reasonCode: 'approval-trust-class-source-mismatch',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.trustClass'],
    requiredEvidenceKinds: ['trusted_approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval source kind determines trust class; caller overrides cannot promote it.',
  },
  {
    reasonCode: 'approval-duplicate-reviewer',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals.reviewerRef'],
    requiredEvidenceKinds: ['distinct_reviewer_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Multiple approvals must come from distinct reviewer identities when required.',
  },
  {
    reasonCode: 'approval-count-insufficient',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Not enough valid approvals are bound to the proposed consequence.',
  },
  {
    reasonCode: 'approval-review',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance requires customer or operator review.',
  },
  {
    reasonCode: 'approval-block',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['approvals'],
    requiredEvidenceKinds: ['approval_provenance_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Approval provenance failed closed.',
  },
  {
    reasonCode: 'narrow-required',
    audience: 'model',
    disclosureLevel: 'actionable',
    missingFields: [],
    requiredEvidenceKinds: ['narrowing_ref'],
    retryableByModel: true,
    operatorOnly: false,
    safeSummary: 'Retry only with a narrower customer-approved consequence scope.',
  },
  {
    reasonCode: 'adapter-readiness-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['observedFeatures.adapterReady'],
    requiredEvidenceKinds: ['adapter_readiness_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Adapter readiness is an operator or customer integration control.',
  },
  {
    reasonCode: 'adapter-readiness-origin-untrusted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['observedFeatureOrigins.adapterReady'],
    requiredEvidenceKinds: ['adapter_readiness_origin_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Adapter readiness must be attested by an operator, customer gateway, Attestor runtime, or trusted adapter.',
  },
  {
    reasonCode: 'custom-domain-review-required',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['customer_policy_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Custom consequence domains require customer policy review before automation.',
  },
  {
    reasonCode: 'hold-ledger-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions'],
    requiredEvidenceKinds: ['no_go_condition_ledger_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go condition state must be supplied by the customer or operator boundary.',
  },
  {
    reasonCode: 'active-no-go-condition-present',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_condition_release_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'An active no-go condition blocks automatic execution.',
  },
  {
    reasonCode: 'pending-hold-review-required',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_condition_review_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A pending no-go hold requires customer or operator review.',
  },
  {
    reasonCode: 'hold-owner-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.ownerRef'],
    requiredEvidenceKinds: ['no_go_hold_owner_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go hold records must bind to a responsible owner.',
  },
  {
    reasonCode: 'hold-authority-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.ownerAuthorityDigest'],
    requiredEvidenceKinds: ['no_go_hold_authority_digest'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go hold records must bind to owner authority evidence.',
  },
  {
    reasonCode: 'hold-validity-missing',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.issuedAt', 'noGoConditions.expiresAt'],
    requiredEvidenceKinds: ['no_go_hold_validity_window'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go hold records must include a bounded validity window.',
  },
  {
    reasonCode: 'hold-issued-at-invalid',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.issuedAt'],
    requiredEvidenceKinds: ['no_go_hold_validity_window'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go hold issued-at timestamps must be valid.',
  },
  {
    reasonCode: 'hold-expires-at-invalid',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.expiresAt'],
    requiredEvidenceKinds: ['no_go_hold_validity_window'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go hold expiry timestamps must be valid.',
  },
  {
    reasonCode: 'untrusted-hold-source',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: ['noGoConditions.sourceKind'],
    requiredEvidenceKinds: ['trusted_no_go_hold_source_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Untrusted content cannot create or release a no-go hold.',
  },
  {
    reasonCode: 'natural-language-bypass-attempted',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_bypass_review_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A natural-language attempt to bypass a no-go hold blocks automatic execution.',
  },
  {
    reasonCode: 'natural-language-bypass-inferred',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_bypass_review_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'Detected no-go bypass language must be reviewed outside the model loop.',
  },
  {
    reasonCode: 'no-go-condition-review',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_condition_review_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go condition state requires customer or operator review.',
  },
  {
    reasonCode: 'no-go-condition-block',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: ['no_go_condition_release_ref'],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'No-go condition state blocks automatic execution.',
  },
  {
    reasonCode: 'policy-blocked',
    audience: 'customer-review',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'The customer policy blocked the proposed consequence.',
  },
  {
    reasonCode: 'feature-blocked',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A customer or operator supplied blocked signal prevented automatic retry.',
  },
  {
    reasonCode: 'feature-unsafe',
    audience: 'operator-control',
    disclosureLevel: 'minimal',
    missingFields: [],
    requiredEvidenceKinds: [],
    retryableByModel: false,
    operatorOnly: true,
    safeSummary: 'A customer or operator supplied unsafe signal prevented automatic retry.',
  },
]);

const ADMISSION_CORRECTION_HINTS:
Readonly<Record<string, ConsequenceAdmissionCorrectionCatalogEntry>> = Object.freeze(
  Object.fromEntries(
    CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES.map((entry) => [
      entry.reasonCode,
      entry,
    ]),
  ) as Record<string, ConsequenceAdmissionCorrectionCatalogEntry>,
);

export function uniqueSortedStrings(items: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(items)].sort());
}

function admissionCorrectionHints(
  reasonCodes: readonly string[],
): readonly ConsequenceAdmissionCorrectionCatalogEntry[] {
  return Object.freeze(
    reasonCodes
      .map((code) => ADMISSION_CORRECTION_HINTS[code])
      .filter((hint): hint is ConsequenceAdmissionCorrectionCatalogEntry => hint !== undefined),
  );
}

export function consequenceAdmissionCorrectionCatalog():
ConsequenceAdmissionCorrectionCatalog {
  const entries = CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES;
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
    entries,
    reasonCodes: uniqueSortedStrings(entries.map((entry) => entry.reasonCode)),
    modelRetryableReasonCodes: uniqueSortedStrings(
      entries
        .filter((entry) => entry.retryableByModel && !entry.operatorOnly)
        .map((entry) => entry.reasonCode),
    ),
    operatorOnlyReasonCodes: uniqueSortedStrings(
      entries.filter((entry) => entry.operatorOnly).map((entry) => entry.reasonCode),
    ),
  });
}

export function consequenceAdmissionCorrectionForReason(
  reasonCode: string,
): ConsequenceAdmissionCorrectionCatalogEntry | null {
  const normalized = normalizeIdentifier(reasonCode, 'correction reasonCode');
  return ADMISSION_CORRECTION_HINTS[normalized] ?? null;
}

function admissionFeedbackInstruction(input: {
  readonly allowed: boolean;
  readonly retryAllowed: boolean;
  readonly operatorOnlyReasonCodes: readonly string[];
  readonly reasonCodes: readonly string[];
}): string {
  if (input.allowed && input.reasonCodes.length === 0) {
    return 'No correction is required. Do not retry solely to seek a different decision.';
  }
  if (input.retryAllowed) {
    return [
      'Retry only with bounded references for the missing fields.',
      'Do not include raw customer, bank, wallet, credential, secret, or private policy data.',
    ].join(' ');
  }
  if (input.operatorOnlyReasonCodes.length > 0) {
    return 'Do not retry automatically. Route the action to the customer review or operator boundary.';
  }
  if (input.allowed) {
    return 'Use the reason codes as shadow feedback. Do not include raw sensitive data in a retry.';
  }
  return 'Do not retry automatically without customer-controlled review.';
}

export function createAdmissionFeedback(input: {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly retryAllowed: boolean;
}): ConsequenceAdmissionFeedback {
  const hints = admissionCorrectionHints(input.reasonCodes);
  const missingFields = uniqueSortedStrings(hints.flatMap((hint) => [...hint.missingFields]));
  const requiredEvidenceKinds = uniqueSortedStrings(
    hints.flatMap((hint) => [...hint.requiredEvidenceKinds]),
  );
  const operatorOnlyReasonCodes = uniqueSortedStrings(
    input.reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
  const disclosureLevel: ConsequenceAdmissionFeedbackDisclosureLevel =
    missingFields.length > 0 || requiredEvidenceKinds.length > 0
      ? 'actionable'
      : 'minimal';

  return Object.freeze({
    disclosureLevel,
    safeForModel: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
    missingFields,
    requiredEvidenceKinds,
    operatorOnlyReasonCodes,
    safeInstruction: admissionFeedbackInstruction({
      allowed: input.allowed,
      retryAllowed: input.retryAllowed,
      operatorOnlyReasonCodes,
      reasonCodes: input.reasonCodes,
    }),
  });
}

function genericModeFromOperationalContext(
  operationalContext: Readonly<Record<string, string | number | boolean | null>>,
): GenericAdmissionMode | null {
  const mode = operationalContext.mode;
  return typeof mode === 'string' && GENERIC_ADMISSION_MODES.includes(mode as GenericAdmissionMode)
    ? mode as GenericAdmissionMode
    : null;
}

function retryAllowedByReasonCodes(reasonCodes: readonly string[]): boolean {
  const hints = admissionCorrectionHints(reasonCodes);
  return hints.some((hint) => hint.retryableByModel) &&
    !hints.some((hint) => hint.operatorOnly);
}

function nonRetryableReasonCodes(reasonCodes: readonly string[]): readonly string[] {
  return uniqueSortedStrings(
    reasonCodes.filter((code) => ADMISSION_CORRECTION_HINTS[code]?.operatorOnly === true),
  );
}

export function createAdmissionRetryGuidance(input: {
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly operationalContext: Readonly<Record<string, string | number | boolean | null>>;
}): ConsequenceAdmissionRetryGuidance {
  const nonRetryable = nonRetryableReasonCodes(input.reasonCodes);
  const retryAllowed =
    input.decision === 'review' &&
    !input.allowed &&
    nonRetryable.length === 0 &&
    retryAllowedByReasonCodes(input.reasonCodes);
  const retryCategory: ConsequenceAdmissionRetryGuidance['retryCategory'] =
    input.allowed
      ? 'not-needed'
      : retryAllowed
        ? 'safe-correction'
        : input.decision === 'review'
          ? 'human-review-required'
          : 'not-retryable';

  return Object.freeze({
    retryAllowed,
    retryCategory,
    maxAttempts: retryAllowed ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS : 0,
    retryWindowSeconds: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS
      : null,
    nextAllowedMode: retryAllowed
      ? genericModeFromOperationalContext(input.operationalContext)
      : null,
    requiresChangedRequest: retryAllowed,
    sameRequestReplayAllowed: false,
    retryBindingRequired: retryAllowed,
    retryBindingFields: retryAllowed
      ? CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS
      : Object.freeze([]),
    nonRetryableReasonCodes: nonRetryable,
  });
}

function retryBudgetNumber(
  value: number | null | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value === null) return fallback;
  return normalizePositiveInteger(value, fieldName);
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(new Date(timestamp).getTime() + seconds * 1000).toISOString();
}

function retryBudgetInstruction(retryAllowed: boolean): string {
  if (retryAllowed) {
    return [
      'Bound retry may proceed as a correction attempt.',
      'The downstream system must still honor the new admission decision before execution.',
    ].join(' ');
  }
  return 'Do not retry automatically. Route the action to customer review or operator control.';
}

export function evaluateConsequenceAdmissionRetryBudget(
  input: EvaluateConsequenceAdmissionRetryBudgetInput,
): ConsequenceAdmissionRetryBudgetEvaluation {
  const previous = input.previousAdmission;
  const attempt = input.retryAttempt;
  const maxAttempts = retryBudgetNumber(
    input.maxAttempts,
    previous.retry.maxAttempts,
    'retryBudget.maxAttempts',
  );
  const retryWindowSeconds = retryBudgetNumber(
    input.retryWindowSeconds,
    previous.retry.retryWindowSeconds ?? CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
    'retryBudget.retryWindowSeconds',
  );
  const evaluatedAt = normalizeIsoTimestamp(
    input.evaluatedAt ?? attempt.attemptedAt,
    'retryBudget.evaluatedAt',
  );
  const windowStartedAt = previous.decidedAt;
  const windowExpiresAt = addSeconds(windowStartedAt, retryWindowSeconds);
  const reasonCodes: string[] = [];

  if (!previous.retry.retryAllowed) {
    reasonCodes.push('previous-retry-not-allowed');
  }
  if (attempt.previousAdmissionId !== previous.admissionId) {
    reasonCodes.push('retry-previous-admission-id-mismatch');
  }
  if (attempt.previousAdmissionDigest !== previous.digest) {
    reasonCodes.push('retry-previous-admission-digest-mismatch');
  }
  if (attempt.previousRequestId !== previous.request.requestId) {
    reasonCodes.push('retry-previous-request-id-mismatch');
  }
  if (attempt.attemptNumber > maxAttempts) {
    reasonCodes.push('retry-budget-exhausted');
  }
  if (new Date(attempt.attemptedAt).getTime() < new Date(windowStartedAt).getTime()) {
    reasonCodes.push('retry-before-previous-decision');
  }
  if (new Date(attempt.attemptedAt).getTime() > new Date(windowExpiresAt).getTime()) {
    reasonCodes.push('retry-window-expired');
  }
  if (attempt.correctionReasonCodes.length === 0) {
    reasonCodes.push('retry-correction-reason-missing');
  }

  const previousFeedbackReasons = new Set(previous.feedback.reasonCodes);
  const unboundCorrectionReasons = attempt.correctionReasonCodes.filter(
    (reason) => !previousFeedbackReasons.has(reason),
  );
  if (unboundCorrectionReasons.length > 0) {
    reasonCodes.push('retry-correction-reason-unbound');
  }

  const previousOperatorOnlyReasons = new Set(previous.feedback.operatorOnlyReasonCodes);
  const operatorOnlyCorrectionReasons = attempt.correctionReasonCodes.filter((reason) =>
    previousOperatorOnlyReasons.has(reason),
  );
  if (operatorOnlyCorrectionReasons.length > 0) {
    reasonCodes.push('retry-operator-only-reason');
  }

  const retryAllowed = reasonCodes.length === 0;
  const payload = {
    version: CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
    outcome: retryAllowed ? 'allow-retry' : 'hold-for-review',
    retryAllowed,
    failClosed: !retryAllowed,
    previousAdmissionId: previous.admissionId,
    previousAdmissionDigest: previous.digest,
    retryAttemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    maxAttempts,
    attemptsRemaining: Math.max(maxAttempts - attempt.attemptNumber, 0),
    retryWindowSeconds,
    windowStartedAt,
    windowExpiresAt,
    evaluatedAt,
    reasonCodes: uniqueSortedStrings(reasonCodes),
    safeInstruction: retryBudgetInstruction(retryAllowed),
  } satisfies Omit<ConsequenceAdmissionRetryBudgetEvaluation, 'canonical' | 'digest'>;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
