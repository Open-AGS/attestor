import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionRetryAttemptLedgerDescriptor,
} from '../src/consequence-admission/retry-attempt-ledger.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function lineFor(content: string, marker: string): string {
  const line = content.split(/\r?\n/u).find((entry) => entry.includes(marker));
  assert.ok(line, `Expected to find ${marker}`);
  return line;
}

function includes(content: string, expected: string, message: string): void {
  ok(content.includes(expected), message);
}

function testObservedFeaturesStayEvidenceOnly(): void {
  const normalization = readProjectFile(
    'src',
    'consequence-admission',
    'generic-input-normalization.ts',
  );
  const engine = [
    readProjectFile('src', 'consequence-admission', 'generic-engine.ts'),
    readProjectFile('src', 'consequence-admission', 'generic-engine-dimensions.ts'),
  ].join('\n');
  includes(
    normalization,
    'observedFeatures: normalizeGenericObservedFeatures(input.observedFeatures)',
    'Consequence admission proof discipline: observedFeatures are normalized from caller input',
  );
  includes(
    normalization,
    'observedFeatureOrigins: normalizeGenericObservedFeatureOrigins(input.observedFeatureOrigins)',
    'Consequence admission proof discipline: observed feature origins are normalized from caller input',
  );
  includes(
    normalization,
    'authoritySources: normalizeGenericAuthoritySources(input.authoritySources)',
    'Consequence admission proof discipline: generic authority sources are normalized from caller input',
  );
  includes(
    normalization,
    'approvals: normalizeGenericApprovals(input.approvals)',
    'Consequence admission proof discipline: generic approval provenance is normalized from caller input',
  );
  includes(
    normalization,
    'noGoConditions: normalizeGenericNoGoConditions(input.noGoConditions)',
    'Consequence admission proof discipline: generic no-go conditions are normalized from caller input',
  );
  includes(
    normalization,
    'agenticSupplyChain: normalizeGenericAgenticSupplyChain(input.agenticSupplyChain)',
    'Consequence admission proof discipline: generic agentic supply-chain metadata is normalized from caller input',
  );
  includes(
    normalization,
    'decisionContextDrift: normalizeGenericDecisionContextDrift(input.decisionContextDrift)',
    'Consequence admission proof discipline: generic decision-context drift metadata is normalized from caller input',
  );
  includes(
    normalization,
    'authorityCreep: normalizeGenericAuthorityCreep(input.authorityCreep)',
    'Consequence admission proof discipline: generic authority-creep metadata is normalized from caller input',
  );
  includes(
    engine,
    'evaluateConsequenceUntrustedContentAuthority({',
    'Consequence admission proof discipline: untrusted-content authority guard is runtime-wired for generic admissions',
  );
  includes(
    engine,
    'evaluateConsequenceApprovalProvenance({',
    'Consequence admission proof discipline: approval provenance guard is runtime-wired for generic approvals',
  );
  includes(
    engine,
    'evaluateConsequenceNoGoConditionLedger({',
    'Consequence admission proof discipline: no-go condition ledger is runtime-wired for generic admissions',
  );
  includes(
    engine,
    'evaluateConsequenceAgenticSupplyChain({',
    'Consequence admission proof discipline: agentic supply-chain guard is runtime-wired for generic admissions',
  );
  includes(
    engine,
    'evaluateConsequenceDecisionContextDrift({',
    'Consequence admission proof discipline: decision-context drift binding is runtime-wired for generic admissions',
  );
  includes(
    engine,
    'createAuthorityCreepGuard({',
    'Consequence admission proof discipline: authority-creep guard is runtime-wired for generic admissions',
  );
  includes(
    engine,
    "return input.observedFeatures?.[key] === true",
    'Consequence admission proof discipline: feature checks are boolean evidence reads',
  );
  includes(
    engine,
    "trustedObservedFeatureTrue(input, 'adapterReady')",
    'Consequence admission proof discipline: adapter readiness requires trusted feature origin',
  );
  includes(
    engine,
    "adapterReadyObserved: observedFeatureTrue(input, 'adapterReady')",
    'Consequence admission proof discipline: raw adapter readiness remains audit-visible',
  );
  includes(
    engine,
    "adapterReady: trustedObservedFeatureTrue(input, 'adapterReady')",
    'Consequence admission proof discipline: trusted adapter readiness is exposed as material evidence',
  );

  const quickstart = readProjectFile('docs', '01-overview', 'consequence-admission-quickstart.md');
  includes(
    quickstart,
    '`observedFeatures` are upstream/operator-derived evidence only.',
    'Consequence admission proof discipline: quickstart documents observedFeatures as evidence-only',
  );
  includes(
    quickstart,
    'they cannot grant',
    'Consequence admission proof discipline: quickstart keeps feature observations from becoming authority',
  );
  includes(
    quickstart,
    'authority, reduce evidence requirements, bypass review, or activate downstream',
    'Consequence admission proof discipline: quickstart keeps feature observations from reducing review',
  );
  includes(
    quickstart,
    'activate downstream',
    'Consequence admission proof discipline: quickstart keeps feature observations from activating execution',
  );
  includes(
    quickstart,
    '`observedFeatureOrigins.adapterReady` is one of `operator-attested`,',
    'Consequence admission proof discipline: quickstart documents trusted adapter readiness origins',
  );
  includes(
    quickstart,
    '`adapter-readiness-origin-untrusted`',
    'Consequence admission proof discipline: quickstart documents untrusted origin hold',
  );
  includes(
    quickstart,
    'Generic admissions now run the untrusted-content authority guard',
    'Consequence admission proof discipline: quickstart documents generic authority guard wiring',
  );
  includes(
    quickstart,
    '`authoritySources`',
    'Consequence admission proof discipline: quickstart documents authoritySources contract',
  );
  includes(
    quickstart,
    '`untrusted-content-authority-source` and `authority-block`',
    'Consequence admission proof discipline: quickstart documents untrusted authority fail-closed reasons',
  );
  includes(
    quickstart,
    'runs the approval-provenance guard',
    'Consequence admission proof discipline: quickstart documents approval guard wiring',
  );
  includes(
    quickstart,
    '`approvals` metadata',
    'Consequence admission proof discipline: quickstart documents approvals metadata',
  );
  includes(
    quickstart,
    '`approval-missing`',
    'Consequence admission proof discipline: quickstart documents missing approval hold',
  );
  includes(
    quickstart,
    'run the no-go condition ledger guard',
    'Consequence admission proof discipline: quickstart documents no-go ledger guard wiring',
  );
  includes(
    quickstart,
    '`noGoConditions`',
    'Consequence admission proof discipline: quickstart documents no-go condition metadata',
  );
  includes(
    quickstart,
    '`active-no-go-condition-present`',
    'Consequence admission proof discipline: quickstart documents active no-go block reason',
  );
  includes(
    quickstart,
    'raw case references, private hold owners, customer messages, or bypass text',
    'Consequence admission proof discipline: quickstart documents no-go redaction boundary',
  );
  includes(
    quickstart,
    'structured `agenticSupplyChain` metadata',
    'Consequence admission proof discipline: quickstart documents agentic supply-chain metadata',
  );
  includes(
    quickstart,
    'raw component refs, package names, permissions, source URLs',
    'Consequence admission proof discipline: quickstart documents supply-chain raw-data boundary',
  );
  includes(
    quickstart,
    'structured `decisionContextDrift` metadata',
    'Consequence admission proof discipline: quickstart documents decision-context metadata',
  );
  includes(
    quickstart,
    'raw model versions, policy versions, prompt text, config values',
    'Consequence admission proof discipline: quickstart documents decision-context raw-data boundary',
  );
  includes(
    quickstart,
    'structured `authorityCreep` metadata',
    'Consequence admission proof discipline: quickstart documents authority-creep metadata',
  );
  includes(
    quickstart,
    'write policy, activate enforcement, reduce review',
    'Consequence admission proof discipline: quickstart documents authority-creep no-authority boundary',
  );

  const hostedApi = readProjectFile('docs', '01-overview', 'hosted-action-authorization-api.md');
  includes(
    hostedApi,
    '`observedFeatures` are upstream/operator-derived evidence, not authority',
    'Consequence admission proof discipline: hosted API boundary documents feature trust origin',
  );
  includes(
    hostedApi,
    '`observedFeatureOrigins.adapterReady` marker is trusted',
    'Consequence admission proof discipline: hosted API boundary documents trusted origin marker',
  );
  includes(
    hostedApi,
    'authority must arrive as structured `authoritySources` references',
    'Consequence admission proof discipline: hosted API boundary documents authoritySources references',
  );
  includes(
    hostedApi,
    'approval must also arrive as structured `approvals` provenance',
    'Consequence admission proof discipline: hosted API boundary documents approvals provenance',
  );
  includes(
    hostedApi,
    'no-go condition state must arrive as structured `noGoConditions` metadata',
    'Consequence admission proof discipline: hosted API boundary documents no-go metadata',
  );
  includes(
    hostedApi,
    'agentic tool, connector, plugin, workflow, generated adapter, domain-pack, and provider-SDK supply-chain state must arrive as structured `agenticSupplyChain` metadata',
    'Consequence admission proof discipline: hosted API boundary documents agentic supply-chain metadata',
  );
  includes(
    hostedApi,
    'model, tool-schema, policy, config, prompt, verifier, and simulation context must arrive as structured `decisionContextDrift` metadata',
    'Consequence admission proof discipline: hosted API boundary documents decision-context metadata',
  );
  includes(
    hostedApi,
    'assurance measurement and decision-lineage state must arrive as structured `authorityCreep` metadata',
    'Consequence admission proof discipline: hosted API boundary documents authority-creep metadata',
  );
  includes(
    hostedApi,
    'must not return raw hold references',
    'Consequence admission proof discipline: hosted API boundary documents no-go raw-data boundary',
  );
  includes(
    hostedApi,
    'untrusted content, tool output, retrieved content, and model summaries cannot authorize',
    'Consequence admission proof discipline: hosted API boundary documents untrusted authority no-go',
  );
}

function testRetryLedgerSharedStoreStaysLiveProofOnly(): void {
  const descriptor = consequenceAdmissionRetryAttemptLedgerDescriptor();
  equal(
    descriptor.defaultStoreKind,
    'in-memory-reference',
    'Consequence retry ledger proof discipline: default store remains local reference',
  );
  equal(
    descriptor.productionSharedStoreIncluded,
    true,
    'Consequence retry ledger proof discipline: shared store contract exists',
  );
  equal(
    descriptor.productionSharedStoreRuntimeWired,
    false,
    'Consequence retry ledger proof discipline: production shared runtime is not claimed wired',
  );
  equal(
    descriptor.productionSharedStoreContractRef,
    'src/service/consequence-shared-atomic-stores.ts',
    'Consequence retry ledger proof discipline: descriptor points at shared atomic store contract',
  );

  const sharedStore = readProjectFile('src', 'service', 'consequence-shared-atomic-stores.ts');
  includes(
    sharedStore,
    'readonly rlsPolicyInstalled: true;',
    'Consequence retry ledger proof discipline: shared store has an RLS contract marker',
  );
  includes(
    sharedStore,
    'readonly rlsForced: true;',
    'Consequence retry ledger proof discipline: shared store declares FORCE RLS schema posture',
  );
  includes(
    sharedStore,
    'FORCE ROW LEVEL SECURITY',
    'Consequence retry ledger proof discipline: shared store applies FORCE RLS in table DDL',
  );
  includes(
    sharedStore,
    'readonly productionSharedRuntimeWired: false;',
    'Consequence retry ledger proof discipline: shared runtime wiring remains a no-claim',
  );
  includes(
    sharedStore,
    'ON CONFLICT DO NOTHING',
    'Consequence retry ledger proof discipline: duplicate attempt recording uses atomic conflict handling',
  );
  includes(
    sharedStore,
    'tenant_scope_digest',
    'Consequence retry ledger proof discipline: shared store schema is tenant-scope keyed',
  );
}

function testAuditIndexesAndLiveProofGateAgree(): void {
  const findingIndex = readProjectFile('docs', 'audit', 'finding-index.md');
  const ops167 = lineFor(findingIndex, 'OPS-167 caller-supplied `observedFeatures` trust origin');
  includes(ops167, '`closed`', 'OPS-167 is closed repo-side');
  includes(
    ops167,
    'Locking tests: `tests/generic-admission-mode-ladder.test.ts`; `tests/generic-admission-routes.test.ts`; `tests/generic-admission-guard-route-matrix.test.ts`; `tests/hosted-action-authorization-openapi.test.ts`; `tests/consequence-admission-proof-discipline.test.ts`.',
    'OPS-167 cites the generic admission route and proof-discipline locking tests',
  );
  includes(
    ops167,
    '`humanReviewFatigue`',
    'OPS-167 records human-review fatigue runtime wiring',
  );
  includes(
    ops167,
    '`multiAgentDelegation`',
    'OPS-167 records multi-agent delegation runtime wiring',
  );
  includes(
    ops167,
    '`authorityCreep`',
    'OPS-167 records authority-creep runtime wiring',
  );
  includes(
    ops167,
    '`adapter-readiness-origin-untrusted`',
    'OPS-167 records the trusted-origin runtime hold',
  );

  const ops168 = lineFor(findingIndex, 'OPS-168 consequence retry-attempt ledger shared-store proof gap');
  includes(
    ops168,
    '`closed / live-proof-only`',
    'OPS-168 is closed repo-side and remains live-proof-only',
  );
  includes(
    ops168,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'OPS-168 names the live proof flag',
  );

  const liveProofRegister = readProjectFile('docs', 'audit', 'live-proof-register.md');
  const proofRow = lineFor(liveProofRegister, 'LP-CONSEQUENCE-RETRY-ATTEMPT-LEDGER-SHARED-STORE');
  includes(proofRow, '`repo-gated`', 'Consequence retry live proof is repo-gated');
  includes(
    proofRow,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Live proof register names the consequence retry proof flag',
  );

  const opsGate = readProjectFile('scripts', 'check', 'check-ops-live-shadow-readiness.mjs');
  includes(
    opsGate,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Ops live gate requires consequence retry proof before live-shadow claims',
  );
}

function testBaselineAndControlMapKeepNoClaims(): void {
  const baseline = readProjectFile('docs', 'audit', 'current-posture-baseline.md');
  includes(
    baseline,
    'OPS-167 is repo-side closed by runtime trust-origin checks',
    'Baseline records OPS-167 repo-side closure',
  );
  includes(
    baseline,
    'generic admissions now run the untrusted-content authority guard over structured `authoritySources`',
    'Baseline records generic authority guard runtime wiring',
  );
  includes(
    baseline,
    'OPS-168 is repo-side closed / live-proof-only through `ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF`',
    'Baseline records OPS-168 live-proof gate',
  );
  includes(
    baseline,
    'production remains not proven',
    'Baseline keeps production readiness separated from repo evidence',
  );

  const controlMap = readProjectFile('docs', 'audit', 'control-map.md');
  includes(
    controlMap,
    'observedFeatures upstream/operator-derived evidence only',
    'Control map records observedFeatures authority boundary',
  );
  includes(
    controlMap,
    'ATTESTOR_CONSEQUENCE_RETRY_ATTEMPT_LEDGER_PROOF',
    'Control map names the consequence retry proof flag',
  );
  includes(
    controlMap,
    'Customer PEP no-bypass remains behind `LP-CUSTOMER-PEP-NO-BYPASS`',
    'Control map keeps customer PEP no-bypass as live proof',
  );
}

testObservedFeaturesStayEvidenceOnly();
testRetryLedgerSharedStoreStaysLiveProofOnly();
testAuditIndexesAndLiveProofGateAgree();
testBaselineAndControlMapKeepNoClaims();

console.log(`Consequence admission proof-discipline tests: ${passed} passed, 0 failed`);
