import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryAuthorityRelationshipContext,
  policyFoundryAuthorityRelationshipContextDescriptor,
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

function digest(seed: string): string {
  return `sha256:${'a'.repeat(60)}${seed.padStart(4, '0').slice(-4)}`;
}

function testCompleteAuthorityContextIsReviewReadyAndDigestOnly(): void {
  const context = createPolicyFoundryAuthorityRelationshipContext({
    generatedAt: '2026-05-13T06:00:00.000Z',
    actionSurface: 'support.refund',
    domain: 'money-movement',
    tenantScopeRef: 'tenant_acme_private_raw_id',
    relationships: [
      {
        subjectKind: 'actor',
        subjectRef: 'alice.owner@example.com',
        relation: 'owner',
        objectKind: 'action-surface',
        objectRef: 'support.refund',
        source: 'idp-directory',
        evidenceDigest: digest('0001'),
        scopeKind: 'tenant',
        scopeRef: 'tenant_acme_private_raw_id',
        observedAt: '2026-05-13T05:00:00.000Z',
      },
      {
        subjectKind: 'group',
        subjectRef: 'finance-approvers-raw-group',
        relation: 'approver',
        objectKind: 'approval-workflow',
        objectRef: 'refund-approval-workflow',
        source: 'approval-workflow',
        evidenceDigest: digest('0002'),
        scopeKind: 'action-surface',
        scopeRef: 'support.refund',
      },
      {
        subjectKind: 'service-account',
        subjectRef: 'refund-agent-prod-service-account',
        relation: 'delegate',
        objectKind: 'downstream-system',
        objectRef: 'stripe-refunds-prod',
        source: 'customer-manifest',
        evidenceDigest: digest('0003'),
        scopeKind: 'action-surface',
        scopeRef: 'support.refund',
        expiresAt: '2026-06-13T06:00:00.000Z',
      },
      {
        subjectKind: 'tenant',
        subjectRef: 'tenant_acme_private_raw_id',
        relation: 'tenant-member',
        objectKind: 'organization',
        objectRef: 'acme-private-org',
        source: 'customer-manifest',
        evidenceDigest: digest('0004'),
      },
    ],
  });
  const serialized = JSON.stringify(context);

  equal(context.version, 'attestor.policy-foundry-authority-relationship-context.v1', 'Authority context: version is explicit');
  equal(context.status, 'review-ready', 'Authority context: complete relationship set is review-ready');
  equal(context.counts.relationshipCount, 4, 'Authority context: relationship count is retained');
  equal(context.counts.ownerCount, 1, 'Authority context: owner count is retained');
  equal(context.counts.approverCount, 1, 'Authority context: approver count is retained');
  equal(context.counts.delegateCount, 1, 'Authority context: delegate count is retained');
  equal(context.counts.serviceAccountRelationshipCount, 1, 'Authority context: service account relationships are counted');
  equal(context.counts.evidenceBoundRelationshipCount, 4, 'Authority context: evidence-bound relationships are counted');
  equal(context.noGoReasons.length, 0, 'Authority context: complete context has no no-go reasons');
  equal(context.approvalRequired, true, 'Authority context: approval remains required');
  equal(context.autoEnforce, false, 'Authority context: auto enforce is false');
  equal(context.authorityDecisionAllowed, false, 'Authority context: cannot grant authority');
  equal(context.storesRawIdentity, false, 'Authority context: raw identity storage is false');
  equal(context.digestOnly, true, 'Authority context: digest-only invariant is explicit');
  ok(context.tenantScopeDigest?.startsWith('sha256:'), 'Authority context: tenant scope is digested');
  ok(context.digest.startsWith('sha256:'), 'Authority context: digest is generated');
  excludes(serialized, /alice\.owner@example\.com|tenant_acme_private_raw_id|finance-approvers-raw-group|refund-agent-prod-service-account|stripe-refunds-prod|acme-private-org/iu, 'Authority context: serialized output excludes raw identity, tenant, group, service account, downstream, and org refs');
}

function testUnsafeAuthorityContextStaysCustomerBindingWork(): void {
  const context = createPolicyFoundryAuthorityRelationshipContext({
    generatedAt: '2026-05-13T06:00:00.000Z',
    actionSurface: 'crm.export',
    domain: 'data-disclosure',
    relationships: [
      {
        subjectKind: 'actor',
        subjectRef: 'suggested-user@example.com',
        relation: 'delegate',
        objectKind: 'downstream-system',
        objectRef: 'crm-prod',
        source: 'llm-suggested',
        expiresAt: '2026-05-12T06:00:00.000Z',
      },
    ],
  });

  equal(context.status, 'needs-customer-binding', 'Authority context: unsafe relationship set needs customer binding');
  ok(context.noGoReasons.includes('owner-binding-missing'), 'Authority context: missing owner is a no-go');
  ok(context.noGoReasons.includes('approver-binding-missing'), 'Authority context: missing approver is a no-go');
  ok(context.noGoReasons.includes('tenant-scope-missing'), 'Authority context: missing tenant scope is a no-go');
  ok(context.noGoReasons.includes('unscoped-delegation'), 'Authority context: unscoped delegation is a no-go');
  ok(context.noGoReasons.includes('expired-authority-grant'), 'Authority context: expired grant is a no-go');
  ok(context.noGoReasons.includes('missing-authority-evidence-digest'), 'Authority context: missing evidence digest is a no-go');
  ok(context.noGoReasons.includes('llm-authority-source'), 'Authority context: LLM-suggested authority source is a no-go');
  equal(context.counts.llmSuggestedRelationshipCount, 1, 'Authority context: LLM-suggested relationship is counted');
}

function testMissingAuthorityContextIsNotProvided(): void {
  const context = createPolicyFoundryAuthorityRelationshipContext({
    generatedAt: '2026-05-13T06:00:00.000Z',
  });

  equal(context.status, 'not-provided', 'Authority context: missing relationships are not provided');
  ok(context.noGoReasons.includes('authority-relationships-missing'), 'Authority context: missing relationships are a no-go');
  equal(context.counts.relationshipCount, 0, 'Authority context: missing relationships have zero count');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = policyFoundryAuthorityRelationshipContextDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-authority-relationship-context.v1', 'Authority context descriptor: version is explicit');
  ok(descriptor.relationKinds.includes('owner'), 'Authority context descriptor: owner relation is exposed');
  ok(descriptor.relationKinds.includes('approver'), 'Authority context descriptor: approver relation is exposed');
  ok(descriptor.relationKinds.includes('delegate'), 'Authority context descriptor: delegate relation is exposed');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-authority-relationship-context', 'Authority context descriptor: data minimization surface is explicit');
  equal(descriptor.authorityDecisionAllowed, false, 'Authority context descriptor: authority decisions are not allowed');
  equal(descriptor.storesRawIdentity, false, 'Authority context descriptor: raw identity storage is false');
  equal(descriptor.digestOnly, true, 'Authority context descriptor: digest-only invariant is explicit');
  includes(doc, 'src/consequence-admission/policy-foundry-authority-relationship-context.ts', 'Policy Foundry docs: authority context contract is named');
  includes(doc, 'test:policy-foundry-authority-relationship-context', 'Policy Foundry docs: authority context test command is named');
  includes(tracker, 'Step 07', 'Deepening tracker: Step 07 is present');
  includes(tracker, 'complete | Add Authority Relationship Context', 'Deepening tracker: Step 07 is complete');
  includes(tracker, 'Step 01 through Step 12 are complete', 'Deepening tracker: self-onboarding list is complete');
  includes(
    pkg.scripts['test:policy-foundry-authority-relationship-context'] ?? '',
    'tsx tests/policy-foundry-authority-relationship-context.test.ts',
    'Package: authority context test command is exposed',
  );
}

testCompleteAuthorityContextIsReviewReadyAndDigestOnly();
testUnsafeAuthorityContextStaysCustomerBindingWork();
testMissingAuthorityContextIsNotProvided();
testDescriptorDocsAndPackageScriptStayAligned();

ok(passed > 0, 'Policy Foundry authority relationship context tests executed');
console.log(`Policy Foundry authority relationship context tests: ${passed} passed, 0 failed`);
