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

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

const assertionNames = [
  'EnvelopeTenantBinding',
  'TraceTenantBinding',
  'SignalTenantBinding',
  'PacketTenantBinding',
  'AccessNonInterference',
  'ReviewAssignmentTenantBinding',
  'DecisionNonInterference',
] as const;

function testAlloyModuleDefinesTenantOwnedRelations(): void {
  const model = readProjectFile('specs', 'tenant-isolation.als');

  for (const expected of [
    'module tenantIsolation',
    'sig Tenant {}',
    'abstract sig TenantOwned {',
    'owner: one Tenant',
    'sig Actor extends TenantOwned {}',
    'sig Resource extends TenantOwned {}',
    'sig Reviewer extends TenantOwned {}',
    'sig Envelope extends TenantOwned {',
    'actor: one Actor',
    'resource: one Resource',
    'sig Trace extends TenantOwned {',
    'sourceEnvelope: one Envelope',
    'sig Signal extends TenantOwned {',
    'sourceTrace: one Trace',
    'dependsOn: set Signal',
    'sig Packet extends TenantOwned {',
    'envelope: one Envelope',
    'trace: one Trace',
    'signals: set Signal',
    'sig Access extends TenantOwned {',
    'accessor: one Actor',
    'target: one TenantOwned',
    'context: one Envelope',
    'sig ReviewAssignment extends TenantOwned {',
    'reviewer: one Reviewer',
    'packet: one Packet',
    'sig Decision extends TenantOwned {',
    'reviewer: lone Reviewer',
  ]) {
    includes(model, expected, `Tenant isolation Alloy: records ${expected}`);
  }
}

function testAlloyFactsBindEveryRelationToTenantOwner(): void {
  const model = readProjectFile('specs', 'tenant-isolation.als');

  for (const expected of [
    'fact TenantScopedReferences {',
    'e.actor.owner = e.owner',
    'e.resource.owner = e.owner',
    't.sourceEnvelope.owner = t.owner',
    's.sourceTrace.owner = s.owner',
    's.dependsOn.owner in s.owner',
    'p.envelope.owner = p.owner',
    'p.trace.owner = p.owner',
    'p.signals.owner in p.owner',
    'a.accessor.owner = a.owner',
    'a.target.owner = a.owner',
    'a.context.owner = a.owner',
    'r.reviewer.owner = r.owner',
    'r.packet.owner = r.owner',
    'd.packet.owner = d.owner',
    'd.trace.owner = d.owner',
    'd.reviewer.owner in d.owner',
    'fact NoSignalCycles {',
    'no s: Signal | s in s.^dependsOn',
  ]) {
    includes(model, expected, `Tenant isolation Alloy: records fact fragment ${expected}`);
  }
}

function testAlloyAssertionsAndCommandsStayAligned(): void {
  const model = readProjectFile('specs', 'tenant-isolation.als');

  includes(
    model,
    'run consistentTenantIsolationExample for 6 but exactly 2 Tenant',
    'Tenant isolation Alloy: has consistency run command',
  );

  for (const assertion of assertionNames) {
    includes(model, `assert ${assertion} {`, `Tenant isolation Alloy: defines assertion ${assertion}`);
    includes(
      model,
      `check ${assertion} for 6 but exactly 3 Tenant`,
      `Tenant isolation Alloy: checks assertion ${assertion}`,
    );
  }

  for (const expected of [
    'all e: Envelope |',
    'all t: Trace |',
    'all s: Signal |',
    'all p: Packet |',
    'all a: Access |',
    'all r: ReviewAssignment |',
    'all d: Decision |',
  ]) {
    includes(model, expected, `Tenant isolation Alloy: quantifies ${expected}`);
  }
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'tenant-isolation-model.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Tenant Isolation Model',
    'W08 implementation contract',
    'manual Alloy relation model',
    'specs/tenant-isolation.als',
    'tests/tenant-isolation-model.test.ts',
    'TenantScopedReferences',
    'NoSignalCycles',
    'EnvelopeTenantBinding',
    'TraceTenantBinding',
    'SignalTenantBinding',
    'PacketTenantBinding',
    'AccessNonInterference',
    'ReviewAssignmentTenantBinding',
    'DecisionNonInterference',
    'does not run the Alloy Analyzer',
    'Alloy language reference',
    'Alloy: A Language and Tool for Exploring Software Designs',
    'Core isolation concepts',
    'Tenant isolation',
    'SP 800-207A',
  ]) {
    includes(doc, expected, `Tenant isolation doc: records ${expected}`);
  }

  for (const expected of [
    '| W08 | complete | Alloy Tenant Isolation Model |',
    'specs/tenant-isolation.als',
    'tests/tenant-isolation-model.test.ts',
    'docs/02-architecture/tenant-isolation-model.md',
    'Alloy Analyzer execution claim',
    'PostgreSQL RLS replacement',
    'runtime PEP replacement',
    'Tenant isolation and relation-model framing',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  excludes(
    doc,
    /\bproduction-ready\b|\bformally verified TypeScript\b|\bAlloy Analyzer passed\b|\bproduction isolation certified\b/u,
    'Tenant isolation doc: avoids overclaim wording',
  );
  assert.equal(
    packageJson.scripts['test:tenant-isolation-model'],
    'tsx tests/tenant-isolation-model.test.ts',
    'Tenant isolation model: package script is registered',
  );
  passed += 1;
}

testAlloyModuleDefinesTenantOwnedRelations();
testAlloyFactsBindEveryRelationToTenantOwner();
testAlloyAssertionsAndCommandsStayAligned();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Tenant isolation model tests: ${passed} passed, 0 failed`);
