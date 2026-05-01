import {
  CONSEQUENCE_TYPES,
  type ConsequenceType,
  type RiskClass,
} from '../release-kernel/types.js';
import {
  CRYPTO_AUTHORIZATION_CONSEQUENCE_KINDS,
  type CryptoAuthorizationConsequenceKind,
} from '../crypto-authorization-core/types.js';

export const CONSEQUENCE_ADMISSION_EXTRA_CONSEQUENCE_KINDS = [
  'wallet-call',
  'token-approval',
  'intent-settlement',
  'custom',
] as const;

export const CONSEQUENCE_ADMISSION_KNOWN_CONSEQUENCE_KINDS = Object.freeze([
  ...CONSEQUENCE_TYPES,
  ...CRYPTO_AUTHORIZATION_CONSEQUENCE_KINDS,
  ...CONSEQUENCE_ADMISSION_EXTRA_CONSEQUENCE_KINDS,
] as const);

export type ConsequenceAdmissionKnownConsequenceKind =
  | ConsequenceType
  | CryptoAuthorizationConsequenceKind
  | typeof CONSEQUENCE_ADMISSION_EXTRA_CONSEQUENCE_KINDS[number];

export const CONSEQUENCE_ADMISSION_DOMAINS = [
  'financial-record',
  'money-movement',
  'programmable-money',
  'data-disclosure',
  'authority-change',
  'external-communication',
  'regulated-filing',
  'system-operation',
  'decision-support',
  'custom',
] as const;

export type ConsequenceAdmissionDomain =
  typeof CONSEQUENCE_ADMISSION_DOMAINS[number];

export const CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS = [
  'policy-scope',
  'actor-authority',
  'evidence-binding',
  'freshness-window',
  'downstream-verification',
  'scope-bound-token',
  'replay-protection',
  'human-review-path',
  'data-minimization',
  'secret-redaction',
  'audit-retention',
  'non-bypassable-integration',
] as const;

export type ConsequenceAdmissionControlRequirement =
  typeof CONSEQUENCE_ADMISSION_CONTROL_REQUIREMENTS[number];

export const CONSEQUENCE_ADMISSION_TAXONOMY_CHECK_KINDS = [
  'policy',
  'authority',
  'evidence',
  'freshness',
  'enforcement',
  'adapter-readiness',
] as const;

export type ConsequenceAdmissionTaxonomyCheckKind =
  typeof CONSEQUENCE_ADMISSION_TAXONOMY_CHECK_KINDS[number];

export interface ConsequenceAdmissionDomainProfile {
  readonly id: ConsequenceAdmissionDomain;
  readonly label: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly typicalDownstreamSystems: readonly string[];
  readonly defaultConsequenceKinds: readonly ConsequenceAdmissionKnownConsequenceKind[];
  readonly minimumRiskClass: RiskClass | 'custom';
  readonly requiredChecks: readonly ConsequenceAdmissionTaxonomyCheckKind[];
  readonly controlRequirements: readonly ConsequenceAdmissionControlRequirement[];
}

function domainProfile(
  input: ConsequenceAdmissionDomainProfile,
): ConsequenceAdmissionDomainProfile {
  return Object.freeze(input);
}

const COMMON_GATEWAY_CHECKS = [
  'policy',
  'authority',
  'evidence',
  'freshness',
  'enforcement',
] as const satisfies readonly ConsequenceAdmissionTaxonomyCheckKind[];

const PROOF_AND_ENFORCEMENT_CONTROLS = [
  'policy-scope',
  'actor-authority',
  'evidence-binding',
  'freshness-window',
  'downstream-verification',
  'audit-retention',
] as const satisfies readonly ConsequenceAdmissionControlRequirement[];

const STRONG_RELEASE_CONTROLS = [
  ...PROOF_AND_ENFORCEMENT_CONTROLS,
  'scope-bound-token',
  'replay-protection',
  'human-review-path',
  'non-bypassable-integration',
] as const satisfies readonly ConsequenceAdmissionControlRequirement[];

export const CONSEQUENCE_ADMISSION_TAXONOMY: Readonly<
  Record<ConsequenceAdmissionDomain, ConsequenceAdmissionDomainProfile>
> = Object.freeze({
  'financial-record': domainProfile({
    id: 'financial-record',
    label: 'Financial Record',
    description:
      'A durable financial report, accounting record, reconciliation output, or filing-preparation artifact created from AI-assisted work.',
    examples: [
      'prepare a revenue-recognition record from warehouse data',
      'write a counterparty exposure report for review',
      'assemble a filing-preparation packet from governed SQL output',
    ],
    typicalDownstreamSystems: [
      'reporting store',
      'finance workflow',
      'filing preparation path',
      'review queue',
    ],
    defaultConsequenceKinds: ['record', 'decision-support'],
    minimumRiskClass: 'R3',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: [
      ...PROOF_AND_ENFORCEMENT_CONTROLS,
      'data-minimization',
      'secret-redaction',
    ],
  }),
  'money-movement': domainProfile({
    id: 'money-movement',
    label: 'Money Movement',
    description:
      'A proposed payment, payout, refund, credit, adjustment, or payment-adjacent dispatch before it reaches financial infrastructure.',
    examples: [
      'pay a supplier after reading a changed bank-account instruction',
      'issue a customer refund or credit',
      'dispatch an operational payout from an AI-assisted workflow',
    ],
    typicalDownstreamSystems: [
      'payment processor',
      'banking workflow',
      'billing system',
      'refund service',
    ],
    defaultConsequenceKinds: ['action', 'agent-payment'],
    minimumRiskClass: 'R3',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: STRONG_RELEASE_CONTROLS,
  }),
  'programmable-money': domainProfile({
    id: 'programmable-money',
    label: 'Programmable Money',
    description:
      'A wallet, account, contract, custody, solver, or payment-protocol consequence where an AI-assisted system prepares execution.',
    examples: [
      'prepare a Safe transaction',
      'submit an ERC-4337 user operation',
      'approve a token allowance or custody withdrawal',
      'route an intent-solver settlement handoff',
    ],
    typicalDownstreamSystems: [
      'wallet RPC',
      'Safe guard',
      'bundler',
      'custody callback',
      'intent solver',
      'x402 resource server',
    ],
    defaultConsequenceKinds: [
      'transfer',
      'approval',
      'permission-grant',
      'account-delegation',
      'contract-call',
      'batch-call',
      'swap',
      'bridge',
      'user-operation',
      'agent-payment',
      'custody-withdrawal',
      'governance-action',
      'wallet-call',
      'token-approval',
      'intent-settlement',
    ],
    minimumRiskClass: 'R3',
    requiredChecks: [
      ...COMMON_GATEWAY_CHECKS,
      'adapter-readiness',
    ],
    controlRequirements: STRONG_RELEASE_CONTROLS,
  }),
  'data-disclosure': domainProfile({
    id: 'data-disclosure',
    label: 'Data Disclosure',
    description:
      'A proposed export, report, live query result, or customer-data package before sensitive data leaves its control boundary.',
    examples: [
      'export a customer account package',
      'send a live database-backed report to an external recipient',
      'return a sensitive operational report from a warehouse connector',
    ],
    typicalDownstreamSystems: [
      'data warehouse',
      'customer export service',
      'report delivery path',
      'case-management system',
    ],
    defaultConsequenceKinds: ['record', 'communication', 'action', 'decision-support'],
    minimumRiskClass: 'R3',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: [
      ...PROOF_AND_ENFORCEMENT_CONTROLS,
      'data-minimization',
      'secret-redaction',
      'non-bypassable-integration',
    ],
  }),
  'authority-change': domainProfile({
    id: 'authority-change',
    label: 'Authority Change',
    description:
      'A change to account state, entitlement, role, delegation, service account, approval authority, or administrative control.',
    examples: [
      'grant an admin role',
      'suspend or restore a customer account',
      'rotate a service credential or change an entitlement',
    ],
    typicalDownstreamSystems: [
      'identity provider',
      'tenant admin plane',
      'authorization service',
      'customer account system',
    ],
    defaultConsequenceKinds: [
      'action',
      'permission-grant',
      'account-delegation',
      'user-operation',
    ],
    minimumRiskClass: 'R4',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: STRONG_RELEASE_CONTROLS,
  }),
  'external-communication': domainProfile({
    id: 'external-communication',
    label: 'External Communication',
    description:
      'A message, notice, reply, or structured communication before it is sent outside the internal reasoning boundary.',
    examples: [
      'send a customer support reply',
      'deliver a legal or billing notice',
      'publish a controlled operational update',
    ],
    typicalDownstreamSystems: [
      'email provider',
      'notification service',
      'customer messaging system',
      'ticketing system',
    ],
    defaultConsequenceKinds: ['communication'],
    minimumRiskClass: 'R2',
    requiredChecks: ['policy', 'authority', 'evidence', 'enforcement'],
    controlRequirements: [
      'policy-scope',
      'actor-authority',
      'evidence-binding',
      'downstream-verification',
      'audit-retention',
      'data-minimization',
      'secret-redaction',
    ],
  }),
  'regulated-filing': domainProfile({
    id: 'regulated-filing',
    label: 'Regulated Filing',
    description:
      'A filing, formal notice, disclosure, or regulated artifact before it enters a filing or legal delivery path.',
    examples: [
      'produce a tax or regulatory filing packet',
      'prepare a customer disclosure',
      'release a formal notice that must be retained',
    ],
    typicalDownstreamSystems: [
      'filing system',
      'case record',
      'document release path',
      'review queue',
    ],
    defaultConsequenceKinds: ['record', 'communication'],
    minimumRiskClass: 'R4',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: [
      ...STRONG_RELEASE_CONTROLS,
      'data-minimization',
      'secret-redaction',
    ],
  }),
  'system-operation': domainProfile({
    id: 'system-operation',
    label: 'System Operation',
    description:
      'A deploy, infrastructure mutation, incident-response action, secret rotation, or operational workflow change.',
    examples: [
      'deploy a service change',
      'rotate a production secret',
      'run an incident-response action against live infrastructure',
    ],
    typicalDownstreamSystems: [
      'deployment pipeline',
      'cloud control plane',
      'secret manager',
      'incident automation',
    ],
    defaultConsequenceKinds: ['action'],
    minimumRiskClass: 'R3',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: STRONG_RELEASE_CONTROLS,
  }),
  'decision-support': domainProfile({
    id: 'decision-support',
    label: 'Decision Support',
    description:
      'A recommendation, briefing, or triage output that informs a later human or machine decision without directly executing the consequence.',
    examples: [
      'prepare an analyst briefing note',
      'recommend a risk tier for review',
      'triage a case before a separate release step',
    ],
    typicalDownstreamSystems: [
      'review queue',
      'case-management system',
      'analyst workspace',
      'internal dashboard',
    ],
    defaultConsequenceKinds: ['decision-support'],
    minimumRiskClass: 'R0',
    requiredChecks: ['policy', 'evidence'],
    controlRequirements: [
      'policy-scope',
      'evidence-binding',
      'audit-retention',
      'data-minimization',
    ],
  }),
  custom: domainProfile({
    id: 'custom',
    label: 'Custom',
    description:
      'A customer-defined consequence domain. It must be explicitly scoped before it is treated as eligible for automatic admission.',
    examples: [
      'domain-specific workflow mutation',
      'private customer pack surface',
      'non-standard downstream system handoff',
    ],
    typicalDownstreamSystems: [
      'customer-defined system',
      'private integration',
      'custom enforcement point',
    ],
    defaultConsequenceKinds: ['custom'],
    minimumRiskClass: 'custom',
    requiredChecks: COMMON_GATEWAY_CHECKS,
    controlRequirements: [
      ...STRONG_RELEASE_CONTROLS,
      'data-minimization',
      'secret-redaction',
    ],
  }),
});

export const CONSEQUENCE_ADMISSION_KIND_DOMAIN_MAP: Readonly<
  Record<
    ConsequenceAdmissionKnownConsequenceKind,
    readonly ConsequenceAdmissionDomain[]
  >
> = Object.freeze({
  communication: ['external-communication', 'regulated-filing', 'data-disclosure'],
  record: ['financial-record', 'regulated-filing', 'data-disclosure'],
  action: ['money-movement', 'authority-change', 'system-operation', 'data-disclosure'],
  'decision-support': ['decision-support', 'financial-record', 'data-disclosure'],
  transfer: ['programmable-money', 'money-movement'],
  approval: ['programmable-money'],
  'permission-grant': ['programmable-money', 'authority-change'],
  'account-delegation': ['programmable-money', 'authority-change'],
  'contract-call': ['programmable-money'],
  'batch-call': ['programmable-money'],
  swap: ['programmable-money'],
  bridge: ['programmable-money'],
  'user-operation': ['programmable-money', 'authority-change'],
  'agent-payment': ['programmable-money', 'money-movement'],
  'custody-withdrawal': ['programmable-money', 'money-movement'],
  'governance-action': ['programmable-money', 'authority-change'],
  'wallet-call': ['programmable-money'],
  'token-approval': ['programmable-money'],
  'intent-settlement': ['programmable-money', 'money-movement'],
  custom: ['custom'],
});

export function consequenceAdmissionDomainsForKind(
  kind: ConsequenceAdmissionKnownConsequenceKind,
): readonly ConsequenceAdmissionDomain[] {
  return CONSEQUENCE_ADMISSION_KIND_DOMAIN_MAP[kind];
}

export function consequenceAdmissionDomainProfile(
  domain: ConsequenceAdmissionDomain,
): ConsequenceAdmissionDomainProfile {
  return CONSEQUENCE_ADMISSION_TAXONOMY[domain];
}

export function consequenceAdmissionProfilesForKind(
  kind: ConsequenceAdmissionKnownConsequenceKind,
): readonly ConsequenceAdmissionDomainProfile[] {
  return Object.freeze(
    consequenceAdmissionDomainsForKind(kind).map((domain) =>
      consequenceAdmissionDomainProfile(domain),
    ),
  );
}
