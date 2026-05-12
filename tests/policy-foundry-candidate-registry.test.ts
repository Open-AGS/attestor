import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGenericAdmissionEnvelope,
  createPolicyFoundryCandidateRegistry,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  policyFoundryCandidateRegistryDescriptor,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function event(input: {
  readonly action: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly authorityRef?: string | null;
  readonly occurredAt: string;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-agent-raw-must-not-escape',
      action: input.action,
      domain: input.domain,
      downstreamSystem: input.downstreamSystem,
      requestedAt: input.occurredAt,
      decidedAt: input.occurredAt,
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      authorityRef: input.authorityRef ?? null,
      recipient: 'raw_recipient_must_not_escape',
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: 'proceeded',
    humanOutcome: 'not-reviewed',
    observedFeatures: {
      privateThreshold: 'threshold_must_not_escape',
    },
  });
}

function candidateBundle() {
  const report = createShadowPolicySimulationReport({
    events: [
      event({
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        occurredAt: '2026-05-12T22:00:00.000Z',
      }),
      event({
        action: 'custom_action',
        domain: 'custom',
        downstreamSystem: 'custom-system',
        occurredAt: '2026-05-12T22:01:00.000Z',
      }),
    ],
    proposedMode: 'review',
    generatedAt: '2026-05-12T22:10:00.000Z',
  });
  return createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-12T22:11:00.000Z',
  });
}

function testKnownDomainCandidateIsSchemaBound(): void {
  const bundle = candidateBundle();
  const registry = createPolicyFoundryCandidateRegistry({
    candidates: bundle,
    generatedAt: '2026-05-12T22:12:00.000Z',
  });
  const serialized = JSON.stringify(registry);
  const refund = registry.candidates.find((candidate) =>
    candidate.actionSurface === 'refund-service.issue_refund'
  );

  equal(registry.version, 'attestor.policy-foundry-candidate-registry.v1', 'Candidate registry: version is explicit');
  equal(registry.sourceCandidateBundleDigest, bundle.digest, 'Candidate registry: source bundle digest is bound');
  equal(registry.approvalRequired, true, 'Candidate registry: approval is required');
  equal(registry.autoEnforce, false, 'Candidate registry: auto enforce is false');
  equal(registry.rawPayloadStored, false, 'Candidate registry: raw payload storage is false');
  equal(registry.productionReady, false, 'Candidate registry: production readiness is false');
  equal(registry.activatesEnforcement, false, 'Candidate registry: enforcement activation is false');
  equal(registry.llmThresholdAuthorityAllowed, false, 'Candidate registry: LLM threshold authority is false');
  ok(registry.schemaBoundCount >= 1, 'Candidate registry: at least one candidate is schema-bound');
  equal(refund?.schemaStatus, 'schema-bound', 'Candidate registry: money movement candidate is schema-bound');
  equal(refund?.templateId, 'money-movement.refund-or-payment-safety.v1', 'Candidate registry: refund template is selected');
  equal(refund?.thresholdAuthority, 'schema-or-customer-policy', 'Candidate registry: threshold authority is schema/customer policy');
  ok(refund?.requiredAttributes.includes('amountBand'), 'Candidate registry: money movement amount band attribute is required');
  ok(refund?.requiredAttributes.includes('paymentEvidenceRef'), 'Candidate registry: payment evidence attribute is required');
  ok(refund?.sourceCandidateDigest.startsWith('sha256:'), 'Candidate registry: source candidate digest is generated');
  excludes(serialized, /support-agent-raw-must-not-escape|raw_recipient_must_not_escape|threshold_must_not_escape/iu, 'Candidate registry: serialized output excludes raw actor, recipient, and threshold markers');
}

function testCustomDomainNeedsTemplate(): void {
  const bundle = candidateBundle();
  const registry = createPolicyFoundryCandidateRegistry({
    candidates: bundle,
    generatedAt: '2026-05-12T22:13:00.000Z',
  });
  const custom = registry.candidates.find((candidate) =>
    candidate.actionSurface === 'custom-system.custom_action'
  );

  ok(registry.needsTemplateCount >= 1, 'Candidate registry: custom template gap is counted');
  equal(custom?.schemaStatus, 'needs-template', 'Candidate registry: custom domain needs template');
  equal(custom?.templateId, null, 'Candidate registry: custom domain has no final template id');
  equal(custom?.thresholdAuthority, 'not-bound', 'Candidate registry: custom threshold authority is not bound');
  ok(
    custom?.noGoReasons.includes('custom-domain-template-required'),
    'Candidate registry: custom template no-go is explicit',
  );
  ok(
    custom?.requiredAttributes.includes('customerTemplateRef'),
    'Candidate registry: customer template ref is required',
  );
}

function testEmptyRegistryIsExplicit(): void {
  const registry = createPolicyFoundryCandidateRegistry({
    candidates: null,
    generatedAt: '2026-05-12T22:14:00.000Z',
  });

  equal(registry.sourceCandidateBundleDigest, null, 'Candidate registry: empty registry has no source digest');
  equal(registry.candidateCount, 0, 'Candidate registry: empty registry has zero candidates');
  equal(registry.schemaBoundCount, 0, 'Candidate registry: empty registry has zero bound candidates');
  equal(registry.needsTemplateCount, 0, 'Candidate registry: empty registry has zero template gaps');
  ok(registry.digest.startsWith('sha256:'), 'Candidate registry: empty registry still has digest');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryCandidateRegistryDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-candidate-registry.v1', 'Candidate registry descriptor: version is explicit');
  equal(descriptor.autoEnforce, false, 'Candidate registry descriptor: auto enforce is false');
  equal(descriptor.llmThresholdAuthorityAllowed, false, 'Candidate registry descriptor: LLM threshold authority is false');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-candidate-registry', 'Candidate registry descriptor: data minimization surface is explicit');
  ok(
    descriptor.supportedTemplates.some((template) => template.domain === 'money-movement'),
    'Candidate registry descriptor: money movement template is exposed',
  );
  includes(doc, 'src/consequence-admission/policy-foundry-candidate-registry.ts', 'Policy Foundry docs: candidate registry contract is named');
  includes(doc, 'test:policy-foundry-candidate-registry', 'Policy Foundry docs: candidate registry test command is named');
  includes(tracker, 'Step 04', 'Deepening tracker: Step 04 is present');
  includes(tracker, 'Schema-Bound Candidate Registry', 'Deepening tracker: candidate registry step is named');
  includes(tracker, 'attestor.policy-foundry-candidate-registry.v1', 'Deepening tracker: candidate registry version is named');
  equal(
    pkg.scripts['test:policy-foundry-candidate-registry'],
    'tsx tests/policy-foundry-candidate-registry.test.ts',
    'Package: candidate registry test is exposed',
  );
}

try {
  testKnownDomainCandidateIsSchemaBound();
  testCustomDomainNeedsTemplate();
  testEmptyRegistryIsExplicit();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Policy Foundry candidate registry tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry candidate registry tests failed:', error);
  process.exitCode = 1;
}
