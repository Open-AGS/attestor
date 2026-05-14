import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceMultiAgentDelegationGuardDescriptor,
  evaluateConsequenceMultiAgentDelegation,
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
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

function completeChain() {
  return [
    {
      principalRef: 'agent://support-orchestrator/private',
      principalKind: 'ai-agent',
      role: 'delegator',
      tenantId: 'tenant-private-a',
      identityDigest: digest('a'),
      authorityDigest: digest('b'),
      scopeDigest: digest('c'),
      transportBindingDigest: digest('d'),
    },
    {
      principalRef: 'agent://refund-worker/private',
      principalKind: 'ai-agent',
      role: 'executor',
      tenantId: 'tenant-private-a',
      identityDigest: digest('e'),
      authorityDigest: digest('f'),
      scopeDigest: digest('c'),
      transportBindingDigest: digest('g'),
    },
    {
      principalRef: 'reviewer://finance-owner/private',
      principalKind: 'human-user',
      role: 'approver',
      tenantId: 'tenant-private-a',
      identityDigest: digest('h'),
      authorityDigest: digest('i'),
      scopeDigest: digest('c'),
      transportBindingDigest: digest('j'),
    },
  ] as const;
}

function testMissingDelegationChainRequiresReview(): void {
  const decision = evaluateConsequenceMultiAgentDelegation({
    generatedAt: '2026-05-14T10:00:00.000Z',
    actionSurface: 'agent.refund',
    action: 'delegate-refund',
  });

  equal(decision.version, 'attestor.consequence-multi-agent-delegation-guard.v1', 'Multi-agent guard: version is stable');
  equal(decision.outcome, 'review', 'Multi-agent guard: missing chain reviews');
  equal(decision.allowed, false, 'Multi-agent guard: review is not allowed');
  equal(decision.failClosed, true, 'Multi-agent guard: review is fail-closed');
  ok(decision.reasonCodes.includes('delegation-chain-missing'), 'Multi-agent guard: missing-chain reason is present');
  ok(decision.reasonCodes.includes('delegation-review'), 'Multi-agent guard: review reason is present');
  equal(decision.counts.principalCount, 0, 'Multi-agent guard: empty chain count is retained');
  ok(decision.digest.startsWith('sha256:'), 'Multi-agent guard: digest is emitted');
}

function testCompleteDelegationChainCanPass(): void {
  const decision = evaluateConsequenceMultiAgentDelegation({
    generatedAt: '2026-05-14T10:05:00.000Z',
    actionSurface: 'agent.refund',
    action: 'delegate-refund',
    principalChain: completeChain(),
    requestedDelegatedScopeDigest: digest('c'),
    approvedDelegatedScopeDigest: digest('c'),
    delegatingAuthorityDigest: digest('b'),
  });

  equal(decision.outcome, 'pass', 'Multi-agent guard: complete delegation chain passes');
  equal(decision.allowed, true, 'Multi-agent guard: pass is allowed');
  ok(decision.reasonCodes.includes('delegation-pass'), 'Multi-agent guard: pass reason is present');
  equal(decision.counts.agentPrincipalCount, 2, 'Multi-agent guard: agent principal count is retained');
  equal(decision.counts.missingIdentityCount, 0, 'Multi-agent guard: identity evidence is complete');
  equal(decision.counts.missingAuthorityCount, 0, 'Multi-agent guard: authority evidence is complete');
  equal(decision.counts.missingScopeCount, 0, 'Multi-agent guard: scope evidence is complete');
  excludes(JSON.stringify(decision), /support-orchestrator|refund-worker|finance-owner|tenant-private-a/u, 'Multi-agent guard: raw refs are not serialized');
}

function testScopeMismatchBlocks(): void {
  const decision = evaluateConsequenceMultiAgentDelegation({
    generatedAt: '2026-05-14T10:10:00.000Z',
    actionSurface: 'agent.refund',
    action: 'delegate-refund',
    principalChain: completeChain(),
    requestedDelegatedScopeDigest: digest('c'),
    approvedDelegatedScopeDigest: digest('z'),
    delegatingAuthorityDigest: digest('b'),
  });

  equal(decision.outcome, 'block', 'Multi-agent guard: unapproved delegated scope blocks');
  ok(decision.reasonCodes.includes('delegation-scope-unapproved'), 'Multi-agent guard: scope mismatch reason is present');
  ok(decision.reasonCodes.includes('delegation-block'), 'Multi-agent guard: block reason is present');
}

function testCyclesAndSelfApprovalBlock(): void {
  const selfApprovedChain = [
    ...completeChain().slice(0, 2),
    {
      principalRef: 'agent://refund-worker/private',
      principalKind: 'ai-agent',
      role: 'approver',
      tenantId: 'tenant-private-a',
      identityDigest: digest('e'),
      authorityDigest: digest('f'),
      scopeDigest: digest('c'),
      transportBindingDigest: digest('g'),
    },
  ] as const;
  const decision = evaluateConsequenceMultiAgentDelegation({
    generatedAt: '2026-05-14T10:15:00.000Z',
    actionSurface: 'agent.refund',
    action: 'delegate-refund',
    principalChain: selfApprovedChain,
    requestedDelegatedScopeDigest: digest('c'),
    approvedDelegatedScopeDigest: digest('c'),
    delegatingAuthorityDigest: digest('b'),
  });

  equal(decision.outcome, 'block', 'Multi-agent guard: cycle/self approval blocks');
  ok(decision.reasonCodes.includes('delegation-cycle-detected'), 'Multi-agent guard: cycle reason is present');
  ok(decision.reasonCodes.includes('delegation-actor-self-approved'), 'Multi-agent guard: self-approval reason is present');
}

function testDescriptorDocsAndPackageScriptStayAligned(): void {
  const descriptor = consequenceMultiAgentDelegationGuardDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'multi-agent-delegation-guard.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.consequence-multi-agent-delegation-guard.v1', 'Multi-agent descriptor: version is stable');
  equal(descriptor.failureModeId, 'multi-agent-delegation-confusion', 'Multi-agent descriptor: failure mode is stable');
  equal(descriptor.requiresPrincipalChain, true, 'Multi-agent descriptor: principal chain is required');
  equal(descriptor.requiresAgentIdentityDigest, true, 'Multi-agent descriptor: agent identity digest is required');
  equal(descriptor.requiresDelegatingAuthorityDigest, true, 'Multi-agent descriptor: delegating authority digest is required');
  equal(descriptor.requiresDelegatedScopeDigest, true, 'Multi-agent descriptor: delegated scope digest is required');
  equal(descriptor.rejectsSelfApproval, true, 'Multi-agent descriptor: self approval is rejected');
  equal(descriptor.rejectsCycles, true, 'Multi-agent descriptor: cycles are rejected');
  equal(descriptor.storesRawPrincipalRefs, false, 'Multi-agent descriptor: raw principal refs are not stored');
  equal(descriptor.productionReady, false, 'Multi-agent descriptor: production readiness is not claimed');
  includes(doc, 'attestor.consequence-multi-agent-delegation-guard.v1', 'Multi-agent docs: version is named');
  includes(doc, 'multi-agent-delegation-confusion', 'Multi-agent docs: failure mode is named');
  equal(
    pkg.scripts['test:multi-agent-delegation-guard'],
    'tsx tests/multi-agent-delegation-guard.test.ts',
    'Package: multi-agent delegation guard test script is exposed',
  );
}

try {
  testMissingDelegationChainRequiresReview();
  testCompleteDelegationChainCanPass();
  testScopeMismatchBlocks();
  testCyclesAndSelfApprovalBlock();
  testDescriptorDocsAndPackageScriptStayAligned();
  console.log(`Multi-agent delegation guard tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Multi-agent delegation guard tests failed:', error);
  process.exitCode = 1;
}
