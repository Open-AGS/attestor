import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
  consequenceFailureModeRegistry,
  type ConsequenceFailureModeDefaultDecision,
  type ConsequenceFailureModeId,
} from './failure-mode-registry.js';

export const CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION =
  'attestor.consequence-failure-control-binding.v1';

export const CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS = [
  'untrusted-content-cannot-authorize-action',
  'trusted-evidence-required',
  'verified-approval-provenance-required',
  'scope-cannot-exceed-approved-boundary',
  'tenant-and-recipient-boundaries-must-hold',
  'review-or-block-cannot-auto-promote',
  'no-go-hold-overrides-natural-language',
  'replay-and-idempotency-required-before-execution',
  'decision-context-version-must-be-bound',
  'downstream-side-effects-must-be-declared',
  'least-privilege-tooling-and-supply-chain-review',
  'human-review-packet-must-highlight-risk',
  'sensitive-data-minimization-required',
] as const;
export type ConsequenceFailureControlInvariantId =
  typeof CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS[number];

export const CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES = [
  'admission',
  'customer-gate',
  'downstream-enforcement',
  'policy-foundry',
  'review-surface',
  'audit-proof',
  'runtime-readiness',
] as const;
export type ConsequenceFailureControlEnforcementPhase =
  typeof CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES[number];

export interface ConsequenceFailureControlInvariant {
  readonly id: ConsequenceFailureControlInvariantId;
  readonly summary: string;
  readonly checkKind: 'deterministic' | 'contract' | 'review-hardening';
  readonly violationDefaultDecision: ConsequenceFailureModeDefaultDecision;
}

export interface ConsequenceFailureControlBinding {
  readonly version: typeof CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION;
  readonly failureModeId: ConsequenceFailureModeId;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly invariantIds: readonly ConsequenceFailureControlInvariantId[];
  readonly controlIds: readonly string[];
  readonly defaultDecision: ConsequenceFailureModeDefaultDecision;
  readonly violationDecision: ConsequenceFailureModeDefaultDecision;
  readonly enforcementPhases: readonly ConsequenceFailureControlEnforcementPhase[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthority: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly replayRequired: boolean;
  readonly limitation: string;
}

export interface ConsequenceFailureControlBindingContract {
  readonly version: typeof CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly registryDigest: string;
  readonly bindingCount: number;
  readonly invariantCount: number;
  readonly bindings: readonly ConsequenceFailureControlBinding[];
  readonly invariantCatalog: readonly ConsequenceFailureControlInvariant[];
  readonly enforcementPhases: typeof CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

interface BindingProfile {
  readonly invariantIds: readonly ConsequenceFailureControlInvariantId[];
  readonly enforcementPhases: readonly ConsequenceFailureControlEnforcementPhase[];
  readonly requiredEvidence: readonly string[];
  readonly requiredAuthority: readonly string[];
  readonly requiredAuditRecords: readonly string[];
  readonly replayRequired: boolean;
  readonly limitation: string;
}

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

function readonlyCopy<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

const INVARIANT_CATALOG: readonly ConsequenceFailureControlInvariant[] = Object.freeze([
  {
    id: 'untrusted-content-cannot-authorize-action',
    summary: 'Email, prompt text, documents, tool output, or model summaries cannot act as business authority.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'trusted-evidence-required',
    summary: 'Evidence must identify source, timestamp, integrity, and allowed evidence class before it can satisfy a control.',
    checkKind: 'contract',
    violationDefaultDecision: 'review',
  },
  {
    id: 'verified-approval-provenance-required',
    summary: 'Approval must come from a verified reviewer, source, or policy authority with digestable provenance.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'scope-cannot-exceed-approved-boundary',
    summary: 'Requested scope cannot exceed approved action, amount, record, recipient, tenant, or environment boundaries.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'narrow',
  },
  {
    id: 'tenant-and-recipient-boundaries-must-hold',
    summary: 'Tenant and recipient boundaries must be explicit and cannot be inferred from model text.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'review-or-block-cannot-auto-promote',
    summary: 'Review, hold, or block outcomes cannot be treated as advisory success by downstream integrations.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'no-go-hold-overrides-natural-language',
    summary: 'Fraud, legal, compliance, security, and policy no-go holds override natural-language rationale.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'replay-and-idempotency-required-before-execution',
    summary: 'Non-idempotent or consequential actions require replay protection and idempotency before execution.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
  {
    id: 'decision-context-version-must-be-bound',
    summary: 'Decision proof must bind policy, model/tool/config, and downstream verifier context versions where supplied.',
    checkKind: 'contract',
    violationDefaultDecision: 'review',
  },
  {
    id: 'downstream-side-effects-must-be-declared',
    summary: 'The proposed consequence must represent irreversible, external, batch, financial, legal, or operational effects.',
    checkKind: 'contract',
    violationDefaultDecision: 'review',
  },
  {
    id: 'least-privilege-tooling-and-supply-chain-review',
    summary: 'Tools, connectors, generated artifacts, and packs require least privilege and review before trusted use.',
    checkKind: 'contract',
    violationDefaultDecision: 'block',
  },
  {
    id: 'human-review-packet-must-highlight-risk',
    summary: 'Review surfaces must highlight no-go states, missing evidence, scope changes, and reviewer decision boundaries.',
    checkKind: 'review-hardening',
    violationDefaultDecision: 'review',
  },
  {
    id: 'sensitive-data-minimization-required',
    summary: 'Sensitive data must be minimized and redacted across evidence, review, dashboard, telemetry, and export surfaces.',
    checkKind: 'deterministic',
    violationDefaultDecision: 'block',
  },
]);

const BINDING_PROFILES = {
  'direct-prompt-injection': {
    invariantIds: [
      'untrusted-content-cannot-authorize-action',
      'trusted-evidence-required',
      'human-review-packet-must-highlight-risk',
    ],
    enforcementPhases: ['admission', 'policy-foundry', 'review-surface'],
    requiredEvidence: ['structured-action-fields', 'prompt-injection-signal', 'reason-code-summary'],
    requiredAuthority: ['customer-policy-authority'],
    requiredAuditRecords: ['admission-reason-codes', 'review-packet-risk-summary'],
    replayRequired: true,
    limitation: 'Direct prompt injection binding is contract-level until every admission surface consumes the same detector.',
  },
  'indirect-prompt-injection': {
    invariantIds: [
      'untrusted-content-cannot-authorize-action',
      'trusted-evidence-required',
      'sensitive-data-minimization-required',
      'least-privilege-tooling-and-supply-chain-review',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'policy-foundry', 'audit-proof'],
    requiredEvidence: ['external-content-source', 'trusted-source-classification', 'tool-chain-analysis'],
    requiredAuthority: ['non-content-authority-source'],
    requiredAuditRecords: ['external-content-boundary', 'tool-chain-risk-record'],
    replayRequired: true,
    limitation: 'Binding defines the invariant; full protection depends on tool/source classification coverage.',
  },
  'untrusted-content-authorizes-action': {
    invariantIds: [
      'untrusted-content-cannot-authorize-action',
      'verified-approval-provenance-required',
      'review-or-block-cannot-auto-promote',
    ],
    enforcementPhases: ['admission', 'customer-gate', 'downstream-enforcement', 'review-surface'],
    requiredEvidence: ['authority-source-type', 'content-source-type', 'approval-provenance-ref'],
    requiredAuthority: ['verified-authority-source'],
    requiredAuditRecords: ['authority-content-separation-record'],
    replayRequired: true,
    limitation: 'Binding prevents content-as-authority at contract level; source classification must be integrated per surface.',
  },
  'tool-misuse-excessive-agency': {
    invariantIds: [
      'scope-cannot-exceed-approved-boundary',
      'least-privilege-tooling-and-supply-chain-review',
      'downstream-side-effects-must-be-declared',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'runtime-readiness'],
    requiredEvidence: ['tool-scope-manifest', 'adapter-readiness-record', 'side-effect-inventory'],
    requiredAuthority: ['tool-owner-approval'],
    requiredAuditRecords: ['tool-scope-binding', 'downstream-contract-decision'],
    replayRequired: true,
    limitation: 'Binding requires declared tool scope; customer adapters still need runtime proof.',
  },
  'tool-result-poisoning': {
    invariantIds: [
      'trusted-evidence-required',
      'untrusted-content-cannot-authorize-action',
      'decision-context-version-must-be-bound',
    ],
    enforcementPhases: ['admission', 'policy-foundry', 'audit-proof'],
    requiredEvidence: ['tool-result-source', 'tool-result-integrity', 'tool-result-timestamp'],
    requiredAuthority: ['trusted-evidence-source'],
    requiredAuditRecords: ['tool-result-trust-classification'],
    replayRequired: true,
    limitation: 'Binding defines evidence requirements; individual tools still need source-specific validators.',
  },
  'sensitive-data-disclosure': {
    invariantIds: [
      'sensitive-data-minimization-required',
      'tenant-and-recipient-boundaries-must-hold',
      'trusted-evidence-required',
    ],
    enforcementPhases: ['admission', 'review-surface', 'audit-proof', 'downstream-enforcement'],
    requiredEvidence: ['data-classification', 'recipient-boundary', 'redaction-policy-result'],
    requiredAuthority: ['data-owner-policy'],
    requiredAuditRecords: ['redaction-decision-record', 'recipient-scope-record'],
    replayRequired: true,
    limitation: 'Binding requires minimization; every export/dashboard surface must keep invoking the redaction evaluator.',
  },
  'cross-tenant-leakage': {
    invariantIds: [
      'tenant-and-recipient-boundaries-must-hold',
      'sensitive-data-minimization-required',
      'trusted-evidence-required',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'audit-proof', 'runtime-readiness'],
    requiredEvidence: ['tenant-bound-record', 'foreign-tenant-rejection', 'tenant-scope-digest'],
    requiredAuthority: ['tenant-authority-context'],
    requiredAuditRecords: ['tenant-boundary-decision'],
    replayRequired: true,
    limitation: 'Binding requires tenant checks; coverage remains per-route and per-store until global replay matrix lands.',
  },
  'wrong-recipient-disclosure': {
    invariantIds: [
      'tenant-and-recipient-boundaries-must-hold',
      'scope-cannot-exceed-approved-boundary',
      'sensitive-data-minimization-required',
    ],
    enforcementPhases: ['admission', 'customer-gate', 'downstream-enforcement', 'review-surface'],
    requiredEvidence: ['recipient-identity', 'approved-recipient-scope', 'communication-context'],
    requiredAuthority: ['recipient-authority-policy'],
    requiredAuditRecords: ['recipient-boundary-decision'],
    replayRequired: true,
    limitation: 'Binding defines recipient scope checks; downstream senders must enforce equivalent checks before delivery.',
  },
  'fake-approval-laundering': {
    invariantIds: [
      'verified-approval-provenance-required',
      'untrusted-content-cannot-authorize-action',
      'human-review-packet-must-highlight-risk',
    ],
    enforcementPhases: ['admission', 'review-surface', 'audit-proof'],
    requiredEvidence: ['approval-source', 'reviewer-identity', 'approval-digest'],
    requiredAuthority: ['verified-reviewer-authority'],
    requiredAuditRecords: ['approval-provenance-record'],
    replayRequired: true,
    limitation: 'Binding rejects chat/email approval text; live IdP/reviewer integrations still need customer setup.',
  },
  'stale-authority-or-policy': {
    invariantIds: [
      'decision-context-version-must-be-bound',
      'verified-approval-provenance-required',
      'no-go-hold-overrides-natural-language',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'runtime-readiness', 'audit-proof'],
    requiredEvidence: ['policy-version', 'approval-validity-window', 'authority-freshness'],
    requiredAuthority: ['current-policy-authority'],
    requiredAuditRecords: ['freshness-decision-record'],
    replayRequired: true,
    limitation: 'Binding requires freshness fields; source-of-truth freshness still depends on configured authority stores.',
  },
  'no-go-hold-bypass': {
    invariantIds: [
      'no-go-hold-overrides-natural-language',
      'review-or-block-cannot-auto-promote',
      'human-review-packet-must-highlight-risk',
    ],
    enforcementPhases: ['admission', 'customer-gate', 'review-surface', 'audit-proof'],
    requiredEvidence: ['hold-state', 'hold-owner', 'hold-validity'],
    requiredAuthority: ['hold-owner-authority'],
    requiredAuditRecords: ['no-go-hold-decision'],
    replayRequired: true,
    limitation: 'Binding defines no-go dominance; a unified hold ledger remains a later implementation step.',
  },
  'scope-explosion': {
    invariantIds: [
      'scope-cannot-exceed-approved-boundary',
      'downstream-side-effects-must-be-declared',
      'review-or-block-cannot-auto-promote',
    ],
    enforcementPhases: ['admission', 'customer-gate', 'downstream-enforcement', 'policy-foundry'],
    requiredEvidence: ['requested-scope', 'approved-scope', 'scope-diff'],
    requiredAuthority: ['scope-owner-policy'],
    requiredAuditRecords: ['scope-diff-record', 'constraint-acknowledgement-record'],
    replayRequired: true,
    limitation: 'Binding requires scope diff; exact domain thresholds remain pack/customer policy inputs.',
  },
  'duplicate-execution-replay': {
    invariantIds: [
      'replay-and-idempotency-required-before-execution',
      'review-or-block-cannot-auto-promote',
      'downstream-side-effects-must-be-declared',
    ],
    enforcementPhases: ['customer-gate', 'downstream-enforcement', 'audit-proof', 'runtime-readiness'],
    requiredEvidence: ['idempotency-key', 'presentation-token-state', 'consume-result'],
    requiredAuthority: ['execution-boundary-owner'],
    requiredAuditRecords: ['replay-ledger-decision', 'idempotency-consume-record'],
    replayRequired: true,
    limitation: 'Binding requires replay safety; distributed consume must use shared atomic storage in production.',
  },
  'review-required-auto-promote': {
    invariantIds: [
      'review-or-block-cannot-auto-promote',
      'verified-approval-provenance-required',
      'scope-cannot-exceed-approved-boundary',
    ],
    enforcementPhases: ['customer-gate', 'downstream-enforcement', 'review-surface'],
    requiredEvidence: ['admission-decision', 'allowed-flag', 'fail-closed-flag'],
    requiredAuthority: ['customer-gate-contract'],
    requiredAuditRecords: ['customer-gate-decision'],
    replayRequired: true,
    limitation: 'Binding matches the reference customer gate; external integrations must adopt it or prove equivalent behavior.',
  },
  'human-review-fatigue': {
    invariantIds: [
      'human-review-packet-must-highlight-risk',
      'trusted-evidence-required',
      'no-go-hold-overrides-natural-language',
    ],
    enforcementPhases: ['review-surface', 'policy-foundry', 'audit-proof'],
    requiredEvidence: ['missing-evidence-summary', 'no-go-summary', 'reviewer-focus-area'],
    requiredAuthority: ['review-owner'],
    requiredAuditRecords: ['review-packet-digest', 'reviewer-decision-boundary'],
    replayRequired: true,
    limitation: 'Binding requires focused packets; reviewer-load scoring is not implemented yet.',
  },
  'model-tool-config-drift': {
    invariantIds: [
      'decision-context-version-must-be-bound',
      'trusted-evidence-required',
      'review-or-block-cannot-auto-promote',
    ],
    enforcementPhases: ['admission', 'runtime-readiness', 'audit-proof', 'policy-foundry'],
    requiredEvidence: ['model-version', 'tool-schema-version', 'policy-version', 'config-digest'],
    requiredAuthority: ['current-runtime-owner'],
    requiredAuditRecords: ['decision-context-binding-record', 'drift-decision-record'],
    replayRequired: true,
    limitation: 'Binding requires version context; it is not an independent model evaluation.',
  },
  'multi-agent-delegation-confusion': {
    invariantIds: [
      'verified-approval-provenance-required',
      'scope-cannot-exceed-approved-boundary',
      'least-privilege-tooling-and-supply-chain-review',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'review-surface'],
    requiredEvidence: ['delegation-chain', 'agent-identity', 'delegated-scope'],
    requiredAuthority: ['delegating-authority'],
    requiredAuditRecords: ['delegation-scope-record'],
    replayRequired: true,
    limitation: 'Binding covers delegation metadata; inter-agent transport authentication remains a later hardening surface.',
  },
  'hidden-downstream-side-effect': {
    invariantIds: [
      'downstream-side-effects-must-be-declared',
      'scope-cannot-exceed-approved-boundary',
      'replay-and-idempotency-required-before-execution',
    ],
    enforcementPhases: ['admission', 'downstream-enforcement', 'policy-foundry', 'audit-proof'],
    requiredEvidence: ['side-effect-inventory', 'reversibility-class', 'execution-receipt'],
    requiredAuthority: ['downstream-system-owner'],
    requiredAuditRecords: ['side-effect-declaration-record', 'execution-receipt-record'],
    replayRequired: true,
    limitation: 'Binding requires side-effect declaration; each downstream adapter must prove its own receipt semantics.',
  },
  'unsupported-confidence-or-hallucinated-evidence': {
    invariantIds: [
      'trusted-evidence-required',
      'human-review-packet-must-highlight-risk',
      'decision-context-version-must-be-bound',
    ],
    enforcementPhases: ['admission', 'review-surface', 'audit-proof'],
    requiredEvidence: ['evidence-ref', 'proof-digest', 'source-system-verification'],
    requiredAuthority: ['evidence-owner'],
    requiredAuditRecords: ['unsupported-claim-record', 'proof-digest-record'],
    replayRequired: true,
    limitation: 'Binding rejects unsupported claims; source-system verification is still domain/customer specific.',
  },
  'agentic-supply-chain-compromise': {
    invariantIds: [
      'least-privilege-tooling-and-supply-chain-review',
      'decision-context-version-must-be-bound',
      'downstream-side-effects-must-be-declared',
    ],
    enforcementPhases: ['runtime-readiness', 'policy-foundry', 'downstream-enforcement', 'audit-proof'],
    requiredEvidence: ['package-provenance', 'adapter-review', 'tool-permission-scope'],
    requiredAuthority: ['package-or-adapter-owner'],
    requiredAuditRecords: ['artifact-review-record', 'adapter-readiness-record'],
    replayRequired: true,
    limitation: 'Binding requires review/provenance; it cannot certify third-party code behavior without runtime evidence.',
  },
} satisfies Record<ConsequenceFailureModeId, BindingProfile>;

function assertInvariantCatalog(): void {
  const seen = new Set<string>();
  for (const invariant of INVARIANT_CATALOG) {
    if (seen.has(invariant.id)) {
      throw new Error(`Duplicate failure control invariant id: ${invariant.id}`);
    }
    seen.add(invariant.id);
  }
  for (const invariantId of CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS) {
    if (!seen.has(invariantId)) {
      throw new Error(`Missing failure control invariant catalog entry: ${invariantId}`);
    }
  }
}

function createBinding(
  failureModeId: ConsequenceFailureModeId,
): ConsequenceFailureControlBinding {
  const registryEntry = CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.find((item) =>
    item.id === failureModeId
  );
  if (!registryEntry) {
    throw new Error(`Cannot bind unknown failure mode id: ${failureModeId}`);
  }
  const profile = BINDING_PROFILES[failureModeId];

  return Object.freeze({
    version: CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
    failureModeId,
    registryVersion: CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
    invariantIds: readonlyCopy(profile.invariantIds),
    controlIds: readonlyCopy(registryEntry.requiredControls),
    defaultDecision: registryEntry.defaultDecision,
    violationDecision: registryEntry.defaultDecision,
    enforcementPhases: readonlyCopy(profile.enforcementPhases),
    requiredEvidence: readonlyCopy(profile.requiredEvidence),
    requiredAuthority: readonlyCopy(profile.requiredAuthority),
    requiredAuditRecords: readonlyCopy(profile.requiredAuditRecords),
    replayRequired: profile.replayRequired,
    limitation: profile.limitation,
  });
}

export const CONSEQUENCE_FAILURE_CONTROL_BINDINGS: readonly ConsequenceFailureControlBinding[] =
  Object.freeze(
    CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) =>
      createBinding(entry.id),
    ),
  );

function assertBindingShape(): void {
  assertInvariantCatalog();
  const registryIds = new Set(CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) => entry.id));
  const bindingIds = new Set<string>();
  const invariantIds = new Set(CONSEQUENCE_FAILURE_CONTROL_INVARIANT_IDS);
  const phaseIds = new Set(CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES);

  for (const binding of CONSEQUENCE_FAILURE_CONTROL_BINDINGS) {
    if (bindingIds.has(binding.failureModeId)) {
      throw new Error(`Duplicate failure control binding id: ${binding.failureModeId}`);
    }
    bindingIds.add(binding.failureModeId);
    if (!registryIds.has(binding.failureModeId)) {
      throw new Error(`Failure control binding references unknown registry id: ${binding.failureModeId}`);
    }
    if (binding.controlIds.length === 0) {
      throw new Error(`Failure control binding ${binding.failureModeId} must declare control ids.`);
    }
    if (binding.invariantIds.length === 0) {
      throw new Error(`Failure control binding ${binding.failureModeId} must declare invariants.`);
    }
    for (const invariantId of binding.invariantIds) {
      if (!invariantIds.has(invariantId)) {
        throw new Error(`Failure control binding ${binding.failureModeId} references unknown invariant ${invariantId}.`);
      }
    }
    for (const phase of binding.enforcementPhases) {
      if (!phaseIds.has(phase)) {
        throw new Error(`Failure control binding ${binding.failureModeId} references unknown phase ${phase}.`);
      }
    }
  }

  for (const registryId of registryIds) {
    if (!bindingIds.has(registryId)) {
      throw new Error(`Failure mode registry id has no control binding: ${registryId}`);
    }
  }
}

assertBindingShape();

export function consequenceFailureControlBindingContract(): ConsequenceFailureControlBindingContract {
  const registry = consequenceFailureModeRegistry();
  const payload = {
    version: CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
    registryVersion: registry.version,
    registryDigest: registry.digest,
    bindings: CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
    invariantCatalog: INVARIANT_CATALOG,
    enforcementPhases: CONSEQUENCE_FAILURE_CONTROL_ENFORCEMENT_PHASES,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    limitation:
      'The control binding contract maps known failure modes to invariants and required controls. It does not activate enforcement, prove customer workflow coverage, or certify production readiness.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    bindingCount: CONSEQUENCE_FAILURE_CONTROL_BINDINGS.length,
    invariantCount: INVARIANT_CATALOG.length,
    canonical,
    digest,
  });
}
