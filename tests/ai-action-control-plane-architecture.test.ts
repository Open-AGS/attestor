import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function testArchitectureDecisionIsExplicitAndBounded(): void {
  const doc = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');

  includes(
    doc,
    'Reference-monitor-style, contract-first AI Action Control Plane',
    'AI action control-plane docs: decision is explicit',
  );
  includes(
    doc,
    'contract-first modular monolith with explicit package and import boundaries',
    'AI action control-plane docs: implementation shape is explicit',
  );
  includes(
    doc,
    'Do not shorten this to "Attestor is a reference monitor."',
    'AI action control-plane docs: avoids pure reference-monitor overclaim',
  );
  includes(
    doc,
    'that workflow has a real enforcement point, gateway, verifier, or adapter',
    'AI action control-plane docs: complete mediation depends on deployed PEP evidence',
  );
  includes(
    doc,
    'This document does not claim Attestor is production-ready.',
    'AI action control-plane docs: production-readiness non-claim is explicit',
  );
}

function testControlPlaneRolesStayMapped(): void {
  const doc = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');

  for (const expected of [
    '| PDP | Policy Decision Point:',
    '| PEP | Policy Enforcement Point:',
    '| PIP | Policy Information Point:',
    '| PAP | Policy Administration Point:',
    '| Audit proof |',
    '| Replay |',
    '| Packs |',
    '| Hosted service |',
  ]) {
    includes(doc, expected, `AI action control-plane docs: role mapping includes ${expected}`);
  }

  includes(
    doc,
    'Packs may provide domain templates, evidence defaults, adapters, and replay',
    'AI action control-plane docs: pack boundary inputs are explicit',
  );
  includes(
    doc,
    'fixtures; packs must not fork the admission decision vocabulary.',
    'AI action control-plane docs: packs cannot fork the decision vocabulary',
  );
  includes(
    doc,
    'attestor.consequence-failure-mode-registry-placement.v1',
    'AI action control-plane docs: failure registry placement contract is named',
  );
  includes(
    doc,
    'attestor.consequence-replay-layer-placement.v1',
    'AI action control-plane docs: replay layer placement contract is named',
  );
  includes(
    doc,
    '`src/service` is a composition root',
    'AI action control-plane docs: hosted service composition boundary is explicit',
  );
}

function testInvariantsAndRefactorImplicationArePresent(): void {
  const doc = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');

  for (const expected of [
    'Untrusted content cannot authorize action.',
    'Model confidence cannot replace business authority.',
    'Requested scope cannot exceed approved scope.',
    'Tenant and recipient boundaries cannot be inferred from natural language.',
    'Non-idempotent or irreversible actions require replay protection and stronger proof.',
  ]) {
    includes(doc, expected, `AI action control-plane docs: invariant is present: ${expected}`);
  }

  includes(
    doc,
    'The completed trailing-slash normalizer cleanup is the first small platform',
    'AI action control-plane docs: first refactor proof is explicit',
  );
  includes(
    doc,
    'do not turn `src/platform` into a broad utility dumping ground',
    'AI action control-plane docs: platform primitive boundary blocks utils sprawl',
  );
}

function testRoleNamingContractIsMachineReadable(): void {
  const doc = readProjectFile('docs', '02-architecture', 'ai-action-control-plane-architecture.md');

  includes(
    doc,
    '`src/consequence-admission/control-plane-roles.ts`',
    'AI action control-plane docs: role naming contract points at source',
  );
  includes(
    doc,
    '`attestor/consequence-admission`',
    'AI action control-plane docs: role naming contract is exported through the admission package',
  );
}

function testSystemOverviewLinksArchitectureDecision(): void {
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');

  includes(
    systemOverview,
    '[AI Action Control Plane architecture](ai-action-control-plane-architecture.md)',
    'AI action control-plane docs: system overview links the architecture decision',
  );
  includes(
    systemOverview,
    'reference-monitor-style admission core',
    'AI action control-plane docs: system overview names the admission-core placement question',
  );
}

testArchitectureDecisionIsExplicitAndBounded();
testControlPlaneRolesStayMapped();
testInvariantsAndRefactorImplicationArePresent();
testRoleNamingContractIsMachineReadable();
testSystemOverviewLinksArchitectureDecision();

console.log(`AI action control-plane architecture tests: ${passed} passed, 0 failed`);
