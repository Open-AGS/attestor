import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
  CONSEQUENCE_FAILURE_CONTROL_BINDINGS,
} from './failure-mode-control-bindings.js';
import {
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES,
  CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
  consequenceFailureModeRegistry,
  type ConsequenceFailureModeId,
} from './failure-mode-registry.js';
import {
  CONSEQUENCE_FAILURE_REPLAY_FIXTURES,
  CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
} from './failure-mode-replay-fixtures.js';

export const CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION =
  'attestor.consequence-failure-mode-guard-coverage.v1';

export const CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_KINDS = [
  'dedicated-guard',
  'deterministic-contract',
  'replay-contract',
  'policy-foundry-contract',
  'integration-required',
] as const;
export type ConsequenceFailureModeGuardCoverageKind =
  typeof CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_KINDS[number];

export const CONSEQUENCE_FAILURE_MODE_GUARD_RUNTIME_CLAIMS = [
  'renders-decision',
  'detects-gap',
  'synthetic-replay',
  'requires-integration',
] as const;
export type ConsequenceFailureModeGuardRuntimeClaim =
  typeof CONSEQUENCE_FAILURE_MODE_GUARD_RUNTIME_CLAIMS[number];

export interface ConsequenceFailureModeGuardCoverageEntry {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION;
  readonly failureModeId: ConsequenceFailureModeId;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly controlBindingVersion: typeof CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION;
  readonly replayFixtureMatrixVersion: typeof CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION;
  readonly coverageKind: ConsequenceFailureModeGuardCoverageKind;
  readonly runtimeClaim: ConsequenceFailureModeGuardRuntimeClaim;
  readonly dedicatedGuardPresent: boolean;
  readonly controlBindingPresent: boolean;
  readonly replayFixturePresent: boolean;
  readonly activationReadinessRequired: boolean;
  readonly customerIntegrationRequired: boolean;
  readonly primaryImplementationPath: string;
  readonly codeEvidencePaths: readonly string[];
  readonly testEvidencePaths: readonly string[];
  readonly docEvidencePaths: readonly string[];
  readonly notProven: readonly string[];
  readonly limitation: string;
}

export interface ConsequenceFailureModeGuardCoverageMatrix {
  readonly version: typeof CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION;
  readonly registryVersion: typeof CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION;
  readonly registryDigest: string;
  readonly controlBindingVersion: typeof CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION;
  readonly replayFixtureMatrixVersion: typeof CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION;
  readonly entryCount: number;
  readonly entries: readonly ConsequenceFailureModeGuardCoverageEntry[];
  readonly coverageKinds: typeof CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_KINDS;
  readonly runtimeClaims: typeof CONSEQUENCE_FAILURE_MODE_GUARD_RUNTIME_CLAIMS;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly activatesEnforcement: false;
  readonly rawPayloadStored: false;
  readonly limitation: string;
  readonly canonical: string;
  readonly digest: string;
}

interface CoverageProfile {
  readonly coverageKind: ConsequenceFailureModeGuardCoverageKind;
  readonly runtimeClaim: ConsequenceFailureModeGuardRuntimeClaim;
  readonly dedicatedGuardPresent: boolean;
  readonly customerIntegrationRequired: boolean;
  readonly primaryImplementationPath: string;
  readonly codeEvidencePaths: readonly string[];
  readonly testEvidencePaths: readonly string[];
  readonly docEvidencePaths: readonly string[];
  readonly notProven: readonly string[];
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

const COMMON_NOT_PROVEN = [
  'live customer workflow coverage',
  'downstream verifier integration',
  'production enforcement activation',
] as const;

const COVERAGE_PROFILES = {
  'direct-prompt-injection': {
    coverageKind: 'replay-contract',
    runtimeClaim: 'synthetic-replay',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts',
    codeEvidencePaths: [
      'src/consequence-admission/action-surface-onboarding-red-team-fixtures.ts',
      'src/consequence-admission/policy-foundry-red-team-replay.ts',
    ],
    testEvidencePaths: [
      'tests/action-surface-onboarding-red-team-fixtures.test.ts',
      'tests/policy-foundry-red-team-replay.test.ts',
    ],
    docEvidencePaths: ['docs/02-architecture/failure-mode-replay-fixtures.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Prompt-injection scenarios are replay-backed; a single central detector is not yet integrated across every admission surface.',
  },
  'indirect-prompt-injection': {
    coverageKind: 'integration-required',
    runtimeClaim: 'requires-integration',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/service/hosted-llm-agent-tool-boundary-guard.ts',
    codeEvidencePaths: [
      'src/service/hosted-llm-agent-tool-boundary-guard.ts',
      'src/consequence-admission/failure-mode-replay-fixtures.ts',
    ],
    testEvidencePaths: [
      'tests/hosted-llm-agent-tool-boundary-guard.test.ts',
      'tests/failure-mode-replay-fixtures.test.ts',
    ],
    docEvidencePaths: ['docs/02-architecture/failure-mode-registry.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Hosted tool-boundary evidence exists, but customer-specific untrusted-content isolation still requires integration evidence.',
  },
  'untrusted-content-authorizes-action': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/untrusted-content-authority-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/untrusted-content-authority-guard.ts'],
    testEvidencePaths: ['tests/untrusted-content-authority-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/untrusted-content-authority-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard renders a deterministic authority-content decision; route and downstream enforcement adoption remain integration work.',
  },
  'tool-misuse-excessive-agency': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/adapter-framework.ts',
    codeEvidencePaths: [
      'src/consequence-admission/adapter-framework.ts',
      'src/consequence-admission/integration-mode-readiness.ts',
    ],
    testEvidencePaths: [
      'tests/consequence-admission-adapter-framework.test.ts',
      'tests/integration-mode-readiness.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/adapter-framework.md',
      'docs/02-architecture/integration-mode-readiness.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Tool scope and adapter readiness are contract-checked; customer tool execution still needs verifier, gateway, or provider-native delegation evidence.',
  },
  'tool-result-poisoning': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/tool-result-poisoning-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/tool-result-poisoning-guard.ts'],
    testEvidencePaths: ['tests/tool-result-poisoning-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/tool-result-poisoning-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard classifies supplied tool-result metadata; each tool still needs source-specific validators and metadata emission.',
  },
  'sensitive-data-disclosure': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/data-minimization-redaction-policy.ts',
    codeEvidencePaths: ['src/consequence-admission/data-minimization-redaction-policy.ts'],
    testEvidencePaths: ['tests/data-minimization-redaction-policy.test.ts'],
    docEvidencePaths: ['docs/02-architecture/data-minimization-redaction-policy.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'A central data minimization contract exists; every future review/export/dashboard surface still has to invoke it.',
  },
  'cross-tenant-leakage': {
    coverageKind: 'replay-contract',
    runtimeClaim: 'synthetic-replay',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/recipient-tenant-boundary-replay.ts',
    codeEvidencePaths: ['src/consequence-admission/recipient-tenant-boundary-replay.ts'],
    testEvidencePaths: [
      'tests/recipient-tenant-boundary-replay.test.ts',
      'tests/shadow-route-tenant-boundary.test.ts',
    ],
    docEvidencePaths: ['docs/02-architecture/recipient-tenant-boundary-replay.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Boundary replay is explicit, but every route, store, dashboard, and export surface must still prove tenant binding.',
  },
  'wrong-recipient-disclosure': {
    coverageKind: 'replay-contract',
    runtimeClaim: 'synthetic-replay',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/recipient-tenant-boundary-replay.ts',
    codeEvidencePaths: ['src/consequence-admission/recipient-tenant-boundary-replay.ts'],
    testEvidencePaths: [
      'tests/recipient-tenant-boundary-replay.test.ts',
      'tests/downstream-enforcement-contract.test.ts',
    ],
    docEvidencePaths: ['docs/02-architecture/recipient-tenant-boundary-replay.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Recipient replay is explicit, but downstream senders must still enforce equivalent recipient checks before delivery.',
  },
  'fake-approval-laundering': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/approval-provenance-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/approval-provenance-guard.ts'],
    testEvidencePaths: ['tests/approval-provenance-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/approval-provenance-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard rejects fake approval classes; live IdP, reviewer queue, and downstream verifier integrations still need customer setup.',
  },
  'stale-authority-or-policy': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/stale-authority-policy-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/stale-authority-policy-guard.ts'],
    testEvidencePaths: ['tests/stale-authority-policy-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/stale-authority-policy-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard evaluates supplied freshness fields; source-of-truth policy stores and approval workflows remain integration work.',
  },
  'no-go-hold-bypass': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/no-go-condition-ledger.ts',
    codeEvidencePaths: ['src/consequence-admission/no-go-condition-ledger.ts'],
    testEvidencePaths: ['tests/no-go-condition-ledger.test.ts'],
    docEvidencePaths: ['docs/02-architecture/no-go-condition-ledger.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The no-go ledger blocks supplied active holds; live fraud, legal, compliance, security, privacy, and risk system integrations remain required.',
  },
  'scope-explosion': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/scope-explosion-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/scope-explosion-guard.ts'],
    testEvidencePaths: ['tests/scope-explosion-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/scope-explosion-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard renders requested-vs-approved scope decisions; domain thresholds and downstream verifier enforcement remain customer inputs.',
  },
  'duplicate-execution-replay': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/presentation-replay-ledger.ts',
    codeEvidencePaths: [
      'src/consequence-admission/presentation-replay-ledger.ts',
      'src/consequence-admission/retry-attempt-ledger.ts',
    ],
    testEvidencePaths: [
      'tests/presentation-replay-ledger.test.ts',
      'tests/retry-attempt-ledger.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/presentation-replay-ledger.md',
      'docs/02-architecture/retry-attempt-ledger.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Replay/idempotency contracts exist; distributed production consumption still needs shared atomic storage evidence.',
  },
  'review-required-auto-promote': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/customer-gate.ts',
    codeEvidencePaths: ['src/consequence-admission/customer-gate.ts'],
    testEvidencePaths: ['tests/consequence-admission-customer-gate.test.ts'],
    docEvidencePaths: ['docs/02-architecture/downstream-enforcement-contract.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The reference customer gate is correct; external integrations must adopt it or prove equivalent fail-closed behavior.',
  },
  'human-review-fatigue': {
    coverageKind: 'dedicated-guard',
    runtimeClaim: 'renders-decision',
    dedicatedGuardPresent: true,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/human-review-fatigue-guard.ts',
    codeEvidencePaths: ['src/consequence-admission/human-review-fatigue-guard.ts'],
    testEvidencePaths: ['tests/human-review-fatigue-guard.test.ts'],
    docEvidencePaths: ['docs/02-architecture/human-review-fatigue-guard.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'The guard checks packet quality and aggregate behavior signals; it does not prove reviewer intent, expertise, or live capacity.',
  },
  'model-tool-config-drift': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/decision-context-drift-binding.ts',
    codeEvidencePaths: [
      'src/consequence-admission/decision-context-drift-binding.ts',
      'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts',
    ],
    testEvidencePaths: [
      'tests/decision-context-drift-binding.test.ts',
      'tests/policy-foundry-drift-policy-debt-detector.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/decision-context-drift-binding.md',
      'docs/02-architecture/policy-foundry-onboarding.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Decision-context drift binding checks supplied context evidence; it does not independently scan every runtime or evaluate model quality.',
  },
  'multi-agent-delegation-confusion': {
    coverageKind: 'policy-foundry-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/policy-foundry-authority-relationship-context.ts',
    codeEvidencePaths: ['src/consequence-admission/policy-foundry-authority-relationship-context.ts'],
    testEvidencePaths: ['tests/policy-foundry-authority-relationship-context.test.ts'],
    docEvidencePaths: ['docs/02-architecture/policy-foundry-onboarding.md'],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Policy Foundry flags unscoped delegation; inter-agent transport authentication and per-agent authority enforcement remain future hardening.',
  },
  'hidden-downstream-side-effect': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/downstream-enforcement-contract.ts',
    codeEvidencePaths: [
      'src/consequence-admission/downstream-enforcement-contract.ts',
      'src/consequence-admission/downstream-execution-receipt.ts',
    ],
    testEvidencePaths: [
      'tests/downstream-enforcement-contract.test.ts',
      'tests/downstream-execution-receipt.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/downstream-enforcement-contract.md',
      'docs/02-architecture/downstream-execution-receipt.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Downstream contracts and receipts exist; each adapter still has to prove side-effect declaration and receipt semantics.',
  },
  'unsupported-confidence-or-hallucinated-evidence': {
    coverageKind: 'deterministic-contract',
    runtimeClaim: 'detects-gap',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/audit-evidence-export.ts',
    codeEvidencePaths: [
      'src/consequence-admission/audit-evidence-export.ts',
      'src/consequence-admission/external-review-packet.ts',
    ],
    testEvidencePaths: [
      'tests/consequence-audit-evidence-export.test.ts',
      'tests/consequence-external-review-packet.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/audit-evidence-export.md',
      'docs/02-architecture/external-review-packet.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Evidence exports organize proof references; source-system verification is still domain/customer specific.',
  },
  'agentic-supply-chain-compromise': {
    coverageKind: 'integration-required',
    runtimeClaim: 'requires-integration',
    dedicatedGuardPresent: false,
    customerIntegrationRequired: true,
    primaryImplementationPath: 'src/consequence-admission/action-surface-integration-artifacts.ts',
    codeEvidencePaths: [
      'src/consequence-admission/adapter-framework.ts',
      'src/consequence-admission/action-surface-integration-artifacts.ts',
      'src/consequence-admission/domain-pack-boundary.ts',
    ],
    testEvidencePaths: [
      'tests/consequence-admission-adapter-framework.test.ts',
      'tests/action-surface-integration-artifacts.test.ts',
      'tests/domain-pack-boundary.test.ts',
    ],
    docEvidencePaths: [
      'docs/02-architecture/adapter-framework.md',
      'docs/02-architecture/domain-pack-boundary.md',
    ],
    notProven: COMMON_NOT_PROVEN,
    limitation:
      'Adapter and pack review contracts exist; third-party code behavior cannot be proven without customer-supplied evidence and runtime tests.',
  },
} satisfies Record<ConsequenceFailureModeId, CoverageProfile>;

function createCoverageEntry(
  failureModeId: ConsequenceFailureModeId,
): ConsequenceFailureModeGuardCoverageEntry {
  const binding = CONSEQUENCE_FAILURE_CONTROL_BINDINGS.find((item) =>
    item.failureModeId === failureModeId
  );
  const replay = CONSEQUENCE_FAILURE_REPLAY_FIXTURES.find((item) =>
    item.failureModeId === failureModeId
  );
  if (!binding || !replay) {
    throw new Error(`Cannot create guard coverage entry for unbound failure mode: ${failureModeId}`);
  }
  const profile = COVERAGE_PROFILES[failureModeId];
  return Object.freeze({
    version: CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION,
    failureModeId,
    registryVersion: CONSEQUENCE_FAILURE_MODE_REGISTRY_VERSION,
    controlBindingVersion: CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
    replayFixtureMatrixVersion: CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
    coverageKind: profile.coverageKind,
    runtimeClaim: profile.runtimeClaim,
    dedicatedGuardPresent: profile.dedicatedGuardPresent,
    controlBindingPresent: true,
    replayFixturePresent: true,
    activationReadinessRequired: profile.dedicatedGuardPresent,
    customerIntegrationRequired: profile.customerIntegrationRequired,
    primaryImplementationPath: profile.primaryImplementationPath,
    codeEvidencePaths: readonlyCopy(profile.codeEvidencePaths),
    testEvidencePaths: readonlyCopy(profile.testEvidencePaths),
    docEvidencePaths: readonlyCopy(profile.docEvidencePaths),
    notProven: readonlyCopy(profile.notProven),
    limitation: profile.limitation,
  });
}

export const CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES:
readonly ConsequenceFailureModeGuardCoverageEntry[] = Object.freeze(
  CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) =>
    createCoverageEntry(entry.id),
  ),
);

function assertCoverageShape(): void {
  const registryIds = new Set(CONSEQUENCE_FAILURE_MODE_REGISTRY_ENTRIES.map((entry) => entry.id));
  const coverageIds = new Set<string>();

  for (const coverage of CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES) {
    if (coverageIds.has(coverage.failureModeId)) {
      throw new Error(`Duplicate failure mode guard coverage entry: ${coverage.failureModeId}`);
    }
    coverageIds.add(coverage.failureModeId);
    if (!registryIds.has(coverage.failureModeId)) {
      throw new Error(`Failure mode guard coverage references unknown id: ${coverage.failureModeId}`);
    }
    if (coverage.codeEvidencePaths.length === 0 || coverage.testEvidencePaths.length === 0) {
      throw new Error(`Failure mode guard coverage ${coverage.failureModeId} must include code and test evidence.`);
    }
    if (coverage.dedicatedGuardPresent && !coverage.primaryImplementationPath.endsWith('-guard.ts')) {
      throw new Error(`Dedicated guard coverage ${coverage.failureModeId} must point to a guard module.`);
    }
    if (coverage.notProven.length === 0) {
      throw new Error(`Failure mode guard coverage ${coverage.failureModeId} must state what is not proven.`);
    }
  }

  for (const registryId of registryIds) {
    if (!coverageIds.has(registryId)) {
      throw new Error(`Failure mode registry id has no guard coverage entry: ${registryId}`);
    }
  }
}

assertCoverageShape();

export function consequenceFailureModeGuardCoverageMatrix():
ConsequenceFailureModeGuardCoverageMatrix {
  const registry = consequenceFailureModeRegistry();
  const payload = {
    version: CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_VERSION,
    registryVersion: registry.version,
    registryDigest: registry.digest,
    controlBindingVersion: CONSEQUENCE_FAILURE_CONTROL_BINDING_VERSION,
    replayFixtureMatrixVersion: CONSEQUENCE_FAILURE_REPLAY_FIXTURE_MATRIX_VERSION,
    entries: CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES,
    coverageKinds: CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_KINDS,
    runtimeClaims: CONSEQUENCE_FAILURE_MODE_GUARD_RUNTIME_CLAIMS,
    approvalRequired: true,
    autoEnforce: false,
    productionReady: false,
    activatesEnforcement: false,
    rawPayloadStored: false,
    limitation:
      'The guard coverage matrix records repository-side coverage status for known failure modes. It does not activate enforcement, prove customer workflow coverage, or certify production readiness.',
  } as const;
  const { canonical, digest } = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    entryCount: CONSEQUENCE_FAILURE_MODE_GUARD_COVERAGE_ENTRIES.length,
    canonical,
    digest,
  });
}
